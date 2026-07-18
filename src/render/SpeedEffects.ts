import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  Float32BufferAttribute,
  InstancedMesh,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RingGeometry,
  Vector3,
} from "three";
import type { Scene } from "three";
import type { DynamicsEvent } from "../gameplay/RunDynamics";
import {
  surfaceHeightAt,
  type SledSnapshot,
} from "../simulation/SledSimulation";

const WIND_STREAKS = 58;
const SPRAY_PARTICLES = 128;
const BURST_PARTICLES = 112;
const SHOCKWAVES = 6;
const HIDDEN_Y = -1_000;

type ShockwaveState = {
  mesh: Mesh<RingGeometry, MeshBasicMaterial>;
  age: number;
  duration: number;
  maximumScale: number;
};

export type SpeedEffectSnapshot = {
  windIntensity: number;
  activeSprayParticles: number;
  activeBurstParticles: number;
  activeShockwaves: number;
  shadowClearance: number;
};

export const speedEffectIntensity = (speed: number): number =>
  MathUtils.clamp((speed - 9.5) / 15.5, 0, 1);

const hash = (value: number): number => {
  const sine = Math.sin(value * 127.1) * 43_758.5453;
  return sine - Math.floor(sine);
};

const createSoftTexture = (shadow = false): CanvasTexture => {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is required for effects");
  const gradient = context.createRadialGradient(32, 32, 2, 32, 32, 31);
  if (shadow) {
    gradient.addColorStop(0, "rgba(255,255,255,0.92)");
    gradient.addColorStop(0.46, "rgba(255,255,255,0.54)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
  } else {
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.24, "rgba(255,255,255,0.96)");
    gradient.addColorStop(0.62, "rgba(255,255,255,0.34)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
  }
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return new CanvasTexture(canvas);
};

const hidePool = (positions: Float32Array): void => {
  for (let offset = 1; offset < positions.length; offset += 3) {
    positions[offset] = HIDDEN_Y;
  }
};

export class SpeedEffects {
  private readonly particleTexture = createSoftTexture();
  private readonly shadowTexture = createSoftTexture(true);
  private readonly windGeometry = new BoxGeometry(0.035, 0.035, 1);
  private readonly windMaterial = new MeshBasicMaterial({
    color: 0x71d9ff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  private readonly wind = new InstancedMesh(
    this.windGeometry,
    this.windMaterial,
    WIND_STREAKS,
  );
  private readonly windMatrix = new Matrix4();

  private readonly sprayPositions = new Float32Array(SPRAY_PARTICLES * 3);
  private readonly sprayVelocities = new Float32Array(SPRAY_PARTICLES * 3);
  private readonly sprayLife = new Float32Array(SPRAY_PARTICLES);
  private readonly sprayGeometry = new BufferGeometry();
  private readonly sprayMaterial = new PointsMaterial({
    color: 0xe9faff,
    map: this.particleTexture,
    size: 0.38,
    transparent: true,
    opacity: 0.94,
    alphaTest: 0.025,
    depthWrite: false,
    sizeAttenuation: true,
    blending: NormalBlending,
  });
  private readonly spray: Points;

  private readonly burstPositions = new Float32Array(BURST_PARTICLES * 3);
  private readonly burstVelocities = new Float32Array(BURST_PARTICLES * 3);
  private readonly burstLife = new Float32Array(BURST_PARTICLES);
  private readonly burstColors = new Float32Array(BURST_PARTICLES * 3);
  private readonly burstGeometry = new BufferGeometry();
  private readonly burstMaterial = new PointsMaterial({
    map: this.particleTexture,
    size: 0.52,
    transparent: true,
    opacity: 0.96,
    alphaTest: 0.02,
    depthWrite: false,
    sizeAttenuation: true,
    vertexColors: true,
    blending: NormalBlending,
  });
  private readonly burst: Points;
  private readonly shadow = new Mesh(
    new PlaneGeometry(2, 2),
    new MeshBasicMaterial({
      color: 0x1d5068,
      map: this.shadowTexture,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    }),
  );
  private readonly shockwaves: ShockwaveState[] = [];
  private readonly reducedMotion: boolean;
  private previousElapsed = 0;
  private previousGrounded = true;
  private sprayCursor = 0;
  private burstCursor = 0;
  private shockwaveCursor = 0;
  private emissionAccumulator = 0;
  private pendingEvents: DynamicsEvent[] = [];
  private currentSnapshot: SpeedEffectSnapshot = {
    windIntensity: 0,
    activeSprayParticles: 0,
    activeBurstParticles: 0,
    activeShockwaves: 0,
    shadowClearance: 0,
  };

  constructor(scene: Scene) {
    this.reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    hidePool(this.sprayPositions);
    hidePool(this.burstPositions);

    this.wind.instanceMatrix.setUsage(DynamicDrawUsage);
    this.wind.frustumCulled = false;

    const sprayAttribute = new Float32BufferAttribute(this.sprayPositions, 3);
    sprayAttribute.setUsage(DynamicDrawUsage);
    this.sprayGeometry.setAttribute("position", sprayAttribute);
    this.spray = new Points(this.sprayGeometry, this.sprayMaterial);
    this.spray.frustumCulled = false;

    const burstPositionAttribute = new Float32BufferAttribute(
      this.burstPositions,
      3,
    );
    burstPositionAttribute.setUsage(DynamicDrawUsage);
    const burstColorAttribute = new Float32BufferAttribute(this.burstColors, 3);
    burstColorAttribute.setUsage(DynamicDrawUsage);
    this.burstGeometry.setAttribute("position", burstPositionAttribute);
    this.burstGeometry.setAttribute("color", burstColorAttribute);
    this.burst = new Points(this.burstGeometry, this.burstMaterial);
    this.burst.frustumCulled = false;

    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 1;
    for (let index = 0; index < SHOCKWAVES; index += 1) {
      const mesh = new Mesh(
        new RingGeometry(0.72, 1, 32),
        new MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: NormalBlending,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      mesh.renderOrder = 2;
      this.shockwaves.push({ mesh, age: 1, duration: 1, maximumScale: 1 });
      scene.add(mesh);
    }
    scene.add(this.shadow, this.wind, this.spray, this.burst);
  }

  update(snapshot: SledSnapshot, active: boolean): void {
    const rawDelta = snapshot.elapsedSeconds - this.previousElapsed;
    const dt = MathUtils.clamp(rawDelta || 1 / 60, 1 / 240, 1 / 20);
    this.previousElapsed = snapshot.elapsedSeconds;
    const intensity = active ? speedEffectIntensity(snapshot.forwardSpeed) : 0;
    const landed = active && !this.previousGrounded && snapshot.grounded;

    this.updateShadow(snapshot, active);
    this.updateWind(snapshot, intensity);
    this.updateParticles(dt);
    this.updateShockwaves(dt);

    if (active && snapshot.grounded && !this.reducedMotion) {
      this.emissionAccumulator +=
        dt *
        MathUtils.lerp(18, 72, intensity) *
        MathUtils.clamp(snapshot.forwardSpeed / 18, 0.3, 1.35);
      while (this.emissionAccumulator >= 1) {
        this.spawnSpray(snapshot);
        this.emissionAccumulator -= 1;
      }
    }

    if (landed && snapshot.landingImpact > 0.6 && !this.reducedMotion) {
      this.spawnLanding(snapshot, snapshot.landingImpact);
    }
    for (const event of this.pendingEvents) {
      if (event.type !== "airtime" || !landed) {
        this.spawnEventBurst(event, snapshot);
      }
    }
    this.pendingEvents = [];
    this.previousGrounded = snapshot.grounded;
    this.refreshSnapshot(intensity, snapshot);
  }

  trigger(event: DynamicsEvent): void {
    this.pendingEvents.push(event);
  }

  reset(): void {
    this.previousElapsed = 0;
    this.previousGrounded = true;
    this.emissionAccumulator = 0;
    this.pendingEvents = [];
    this.sprayLife.fill(0);
    this.burstLife.fill(0);
    hidePool(this.sprayPositions);
    hidePool(this.burstPositions);
    for (const shockwave of this.shockwaves) shockwave.mesh.visible = false;
    this.wind.visible = false;
  }

  get snapshot(): SpeedEffectSnapshot {
    return { ...this.currentSnapshot };
  }

  dispose(): void {
    this.windGeometry.dispose();
    this.windMaterial.dispose();
    this.sprayGeometry.dispose();
    this.sprayMaterial.dispose();
    this.burstGeometry.dispose();
    this.burstMaterial.dispose();
    this.particleTexture.dispose();
    this.shadowTexture.dispose();
    for (const shockwave of this.shockwaves) {
      shockwave.mesh.geometry.dispose();
      shockwave.mesh.material.dispose();
    }
  }

  private updateWind(snapshot: SledSnapshot, intensity: number): void {
    this.wind.visible = intensity > 0.025 && !this.reducedMotion;
    this.windMaterial.opacity = 0.18 + intensity * 0.68;
    if (!this.wind.visible) return;

    for (let index = 0; index < WIND_STREAKS; index += 1) {
      const phase =
        (hash(index * 2.71) +
          snapshot.elapsedSeconds * (0.75 + intensity * 2.4)) %
        1;
      const nearCenter = hash(index * 4.2 + 12) > 0.58;
      const radius = nearCenter ? 5.5 : 11.5;
      const x = snapshot.x + (hash(index * 5.13 + 8) * 2 - 1) * radius;
      const y =
        snapshot.height + 0.25 + hash(index * 7.31 + 4) * (5.5 + intensity);
      const z = snapshot.z - 3 + phase * 28;
      const length = 0.8 + intensity * (2.5 + hash(index * 9.7) * 3.8);
      const width = 0.025 + intensity * 0.045;
      this.windMatrix.makeScale(width, width, length);
      this.windMatrix.setPosition(x - snapshot.lateralSpeed * 0.02, y, z);
      this.wind.setMatrixAt(index, this.windMatrix);
    }
    this.wind.instanceMatrix.needsUpdate = true;
  }

  private updateShadow(snapshot: SledSnapshot, active: boolean): void {
    const terrainHeight = surfaceHeightAt(snapshot.x, snapshot.z);
    const clearance = Math.max(0, snapshot.height - terrainHeight);
    const scale = 1 + Math.min(clearance, 8) * 0.105;
    this.shadow.visible = active;
    this.shadow.position.set(snapshot.x, terrainHeight + 0.045, snapshot.z);
    this.shadow.scale.set(1.65 * scale, 0.88 * scale, 1);
    this.shadow.material.opacity = MathUtils.clamp(
      0.37 - clearance * 0.035,
      0.075,
      0.37,
    );
  }

  private updateParticles(dt: number): void {
    this.updateParticlePool(
      this.sprayPositions,
      this.sprayVelocities,
      this.sprayLife,
      dt,
      4.6,
    );
    this.updateParticlePool(
      this.burstPositions,
      this.burstVelocities,
      this.burstLife,
      dt,
      3.8,
    );
    this.spray.visible = this.sprayLife.some((life) => life > 0);
    this.burst.visible = this.burstLife.some((life) => life > 0);
    this.sprayGeometry.attributes.position!.needsUpdate = true;
    this.burstGeometry.attributes.position!.needsUpdate = true;
  }

  private updateParticlePool(
    positions: Float32Array,
    velocities: Float32Array,
    life: Float32Array,
    dt: number,
    gravity: number,
  ): void {
    for (let index = 0; index < life.length; index += 1) {
      if ((life[index] ?? 0) <= 0) continue;
      life[index] = (life[index] ?? 0) - dt;
      const offset = index * 3;
      if ((life[index] ?? 0) <= 0) {
        positions[offset + 1] = HIDDEN_Y;
        continue;
      }
      velocities[offset + 1] = (velocities[offset + 1] ?? 0) - gravity * dt;
      this.integrate(positions, velocities, offset, dt);
    }
  }

  private updateShockwaves(dt: number): void {
    for (const shockwave of this.shockwaves) {
      if (!shockwave.mesh.visible) continue;
      shockwave.age += dt;
      const progress = shockwave.age / shockwave.duration;
      if (progress >= 1) {
        shockwave.mesh.visible = false;
        continue;
      }
      const eased = 1 - Math.pow(1 - progress, 2);
      shockwave.mesh.scale.setScalar(
        MathUtils.lerp(0.35, shockwave.maximumScale, eased),
      );
      shockwave.mesh.material.opacity = (1 - progress) * 0.78;
    }
  }

  private integrate(
    positions: Float32Array,
    velocities: Float32Array,
    offset: number,
    dt: number,
  ): void {
    positions[offset] =
      (positions[offset] ?? 0) + (velocities[offset] ?? 0) * dt;
    positions[offset + 1] =
      (positions[offset + 1] ?? 0) + (velocities[offset + 1] ?? 0) * dt;
    positions[offset + 2] =
      (positions[offset + 2] ?? 0) + (velocities[offset + 2] ?? 0) * dt;
  }

  private spawnSpray(snapshot: SledSnapshot): void {
    const index = this.sprayCursor % SPRAY_PARTICLES;
    this.sprayCursor += 1;
    const offset = index * 3;
    const seed = this.sprayCursor * 3.17;
    const runnerSide = this.sprayCursor % 2 === 0 ? -0.68 : 0.68;
    this.sprayPositions[offset] =
      snapshot.x + runnerSide + (hash(seed) * 2 - 1) * 0.22;
    this.sprayPositions[offset + 1] = snapshot.height + 0.15;
    this.sprayPositions[offset + 2] = snapshot.z - 1.25;
    this.sprayVelocities[offset] =
      runnerSide * (0.55 + hash(seed + 2) * 1.15) +
      snapshot.lateralSpeed * 0.12;
    this.sprayVelocities[offset + 1] = 0.85 + hash(seed + 4) * 1.9;
    this.sprayVelocities[offset + 2] = -1.4 - hash(seed + 6) * 3.4;
    this.sprayLife[index] = 0.5 + hash(seed + 8) * 0.55;
  }

  private spawnLanding(snapshot: SledSnapshot, impact: number): void {
    const origin = new Vector3(snapshot.x, snapshot.height + 0.12, snapshot.z);
    const strength = MathUtils.clamp(impact / 8, 0.45, 1.4);
    this.spawnBurst(origin, Math.round(36 * strength), 0xeafaff, 3.2, 4.2);
    this.spawnShockwave(origin, 0xe7f9ff, 2.5 + strength, 0.58);
  }

  private spawnEventBurst(event: DynamicsEvent, snapshot: SledSnapshot): void {
    const config =
      event.type === "coin"
        ? { count: 26, color: 0x5de5ff, lift: 4.2, spread: 3.2, ring: 2.2 }
        : event.type === "boost"
          ? { count: 42, color: 0xffbd38, lift: 3.2, spread: 4.8, ring: 4 }
          : event.type === "rock"
            ? { count: 34, color: 0x718b99, lift: 2.8, spread: 4.2, ring: 3 }
            : { count: 46, color: 0xeafaff, lift: 4.6, spread: 4.4, ring: 3.5 };
    const origin = new Vector3(
      snapshot.x,
      snapshot.height + (event.type === "coin" ? 0.9 : 0.18),
      snapshot.z,
    );
    this.spawnBurst(
      origin,
      config.count,
      config.color,
      config.lift,
      config.spread,
    );
    this.spawnShockwave(origin, config.color, config.ring, 0.62);
  }

  private spawnBurst(
    origin: Vector3,
    count: number,
    colorValue: number,
    lift: number,
    spread: number,
  ): void {
    const color = new Color(colorValue);
    for (let particle = 0; particle < count; particle += 1) {
      const index = this.burstCursor % BURST_PARTICLES;
      this.burstCursor += 1;
      const offset = index * 3;
      const seed = this.burstCursor * 6.19;
      this.burstPositions[offset] = origin.x;
      this.burstPositions[offset + 1] = origin.y;
      this.burstPositions[offset + 2] = origin.z;
      this.burstVelocities[offset] = (hash(seed) * 2 - 1) * spread;
      this.burstVelocities[offset + 1] = 0.8 + hash(seed + 2) * lift;
      this.burstVelocities[offset + 2] =
        (hash(seed + 4) * 2 - 1) * spread * 0.75;
      this.burstColors[offset] = color.r;
      this.burstColors[offset + 1] = color.g;
      this.burstColors[offset + 2] = color.b;
      this.burstLife[index] = 0.65 + hash(seed + 6) * 0.65;
    }
    this.burstGeometry.attributes.color!.needsUpdate = true;
  }

  private spawnShockwave(
    origin: Vector3,
    color: number,
    maximumScale: number,
    duration: number,
  ): void {
    const shockwave = this.shockwaves[this.shockwaveCursor % SHOCKWAVES];
    this.shockwaveCursor += 1;
    if (!shockwave) return;
    shockwave.age = 0;
    shockwave.duration = duration;
    shockwave.maximumScale = maximumScale;
    shockwave.mesh.position.set(
      origin.x,
      surfaceHeightAt(origin.x, origin.z) + 0.07,
      origin.z,
    );
    shockwave.mesh.scale.setScalar(0.35);
    shockwave.mesh.material.color.setHex(color);
    shockwave.mesh.material.opacity = 0.78;
    shockwave.mesh.visible = true;
  }

  private refreshSnapshot(windIntensity: number, snapshot: SledSnapshot): void {
    let activeSprayParticles = 0;
    let activeBurstParticles = 0;
    let activeShockwaves = 0;
    for (const life of this.sprayLife) if (life > 0) activeSprayParticles += 1;
    for (const life of this.burstLife) if (life > 0) activeBurstParticles += 1;
    for (const shockwave of this.shockwaves) {
      if (shockwave.mesh.visible) activeShockwaves += 1;
    }
    this.currentSnapshot = {
      windIntensity: this.reducedMotion ? 0 : windIntensity,
      activeSprayParticles,
      activeBurstParticles,
      activeShockwaves,
      shadowClearance: Math.max(
        0,
        snapshot.height - surfaceHeightAt(snapshot.x, snapshot.z),
      ),
    };
  }
}
