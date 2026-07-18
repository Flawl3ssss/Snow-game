import {
  BufferGeometry,
  CircleGeometry,
  Color,
  DynamicDrawUsage,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  Vector3,
} from "three";
import type { Scene } from "three";
import type { DynamicsEvent } from "../gameplay/RunDynamics";
import {
  surfaceHeightAt,
  type SledSnapshot,
} from "../simulation/SledSimulation";

const WIND_STREAKS = 44;
const SPRAY_PARTICLES = 84;
const BURST_PARTICLES = 60;

export type SpeedEffectSnapshot = {
  windIntensity: number;
  activeSprayParticles: number;
  activeBurstParticles: number;
  shadowClearance: number;
};

export const speedEffectIntensity = (speed: number): number =>
  MathUtils.clamp((speed - 11) / 16, 0, 1);

const hash = (value: number): number => {
  const sine = Math.sin(value * 127.1) * 43_758.5453;
  return sine - Math.floor(sine);
};

export class SpeedEffects {
  private readonly windPositions = new Float32Array(WIND_STREAKS * 6);
  private readonly windGeometry = new BufferGeometry();
  private readonly windMaterial = new LineBasicMaterial({
    color: 0xdff8ff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  private readonly wind: LineSegments;

  private readonly sprayPositions = new Float32Array(SPRAY_PARTICLES * 3);
  private readonly sprayVelocities = new Float32Array(SPRAY_PARTICLES * 3);
  private readonly sprayLife = new Float32Array(SPRAY_PARTICLES);
  private readonly sprayGeometry = new BufferGeometry();
  private readonly sprayMaterial = new PointsMaterial({
    color: 0xf4fcff,
    size: 0.15,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    sizeAttenuation: true,
  });
  private readonly spray: Points;

  private readonly burstPositions = new Float32Array(BURST_PARTICLES * 3);
  private readonly burstVelocities = new Float32Array(BURST_PARTICLES * 3);
  private readonly burstLife = new Float32Array(BURST_PARTICLES);
  private readonly burstColors = new Float32Array(BURST_PARTICLES * 3);
  private readonly burstGeometry = new BufferGeometry();
  private readonly burstMaterial = new PointsMaterial({
    size: 0.2,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    sizeAttenuation: true,
    vertexColors: true,
  });
  private readonly burst: Points;

  private readonly shadow = new Mesh(
    new CircleGeometry(1, 24),
    new MeshBasicMaterial({
      color: 0x24536a,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    }),
  );
  private readonly reducedMotion: boolean;
  private previousElapsed = 0;
  private sprayCursor = 0;
  private burstCursor = 0;
  private emissionAccumulator = 0;
  private pendingEvents: DynamicsEvent[] = [];
  private currentSnapshot: SpeedEffectSnapshot = {
    windIntensity: 0,
    activeSprayParticles: 0,
    activeBurstParticles: 0,
    shadowClearance: 0,
  };

  constructor(scene: Scene) {
    this.reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const windAttribute = new Float32BufferAttribute(this.windPositions, 3);
    windAttribute.setUsage(DynamicDrawUsage);
    this.windGeometry.setAttribute("position", windAttribute);
    this.wind = new LineSegments(this.windGeometry, this.windMaterial);
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
    scene.add(this.shadow, this.wind, this.spray, this.burst);
  }

  update(snapshot: SledSnapshot, active: boolean): void {
    const rawDelta = snapshot.elapsedSeconds - this.previousElapsed;
    const dt = MathUtils.clamp(rawDelta || 1 / 60, 1 / 240, 1 / 20);
    this.previousElapsed = snapshot.elapsedSeconds;

    const intensity = active ? speedEffectIntensity(snapshot.forwardSpeed) : 0;
    this.updateShadow(snapshot, active);
    this.updateWind(snapshot, intensity);
    this.updateParticles(dt);

    if (active && snapshot.grounded && !this.reducedMotion) {
      this.emissionAccumulator +=
        dt * MathUtils.lerp(8, 38, intensity) * (snapshot.forwardSpeed / 27);
      while (this.emissionAccumulator >= 1) {
        this.spawnSpray(snapshot);
        this.emissionAccumulator -= 1;
      }
    }

    for (const event of this.pendingEvents)
      this.spawnEventBurst(event, snapshot);
    this.pendingEvents = [];
    this.refreshSnapshot(intensity, snapshot);
  }

  trigger(event: DynamicsEvent): void {
    this.pendingEvents.push(event);
  }

  reset(): void {
    this.previousElapsed = 0;
    this.emissionAccumulator = 0;
    this.pendingEvents = [];
    this.sprayLife.fill(0);
    this.burstLife.fill(0);
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
  }

  private updateWind(snapshot: SledSnapshot, intensity: number): void {
    this.wind.visible = intensity > 0.02 && !this.reducedMotion;
    this.windMaterial.opacity = intensity * 0.54;
    if (!this.wind.visible) return;

    for (let index = 0; index < WIND_STREAKS; index += 1) {
      const phase =
        (hash(index * 2.71) +
          snapshot.elapsedSeconds * (0.52 + intensity * 1.7)) %
        1;
      const x = snapshot.x + (hash(index * 5.13 + 8) * 2 - 1) * 12;
      const y =
        snapshot.height + 0.35 + hash(index * 7.31 + 4) * (4.5 + intensity);
      const z = snapshot.z - 5 + phase * 30;
      const length = 0.35 + intensity * (1.2 + hash(index * 9.7) * 2.4);
      const offset = index * 6;
      this.windPositions[offset] = x;
      this.windPositions[offset + 1] = y;
      this.windPositions[offset + 2] = z;
      this.windPositions[offset + 3] = x - snapshot.lateralSpeed * 0.035;
      this.windPositions[offset + 4] = y + 0.03;
      this.windPositions[offset + 5] = z + length;
    }
    this.windGeometry.attributes.position!.needsUpdate = true;
  }

  private updateShadow(snapshot: SledSnapshot, active: boolean): void {
    const terrainHeight = surfaceHeightAt(snapshot.x, snapshot.z);
    const clearance = Math.max(0, snapshot.height - terrainHeight);
    const scale = 1 + Math.min(clearance, 7) * 0.08;
    this.shadow.visible = active;
    this.shadow.position.set(snapshot.x, terrainHeight + 0.035, snapshot.z);
    this.shadow.scale.set(1.35 * scale, 0.68 * scale, 1);
    const material = this.shadow.material;
    material.opacity = MathUtils.clamp(0.24 - clearance * 0.028, 0.045, 0.24);
  }

  private updateParticles(dt: number): void {
    let sprayActive = false;
    for (let index = 0; index < SPRAY_PARTICLES; index += 1) {
      if ((this.sprayLife[index] ?? 0) <= 0) continue;
      sprayActive = true;
      this.sprayLife[index] = (this.sprayLife[index] ?? 0) - dt;
      const offset = index * 3;
      this.sprayVelocities[offset + 1] =
        (this.sprayVelocities[offset + 1] ?? 0) - 5.2 * dt;
      this.integrate(this.sprayPositions, this.sprayVelocities, offset, dt);
    }
    this.spray.visible = sprayActive;
    this.sprayGeometry.attributes.position!.needsUpdate = true;

    let burstActive = false;
    for (let index = 0; index < BURST_PARTICLES; index += 1) {
      if ((this.burstLife[index] ?? 0) <= 0) continue;
      burstActive = true;
      this.burstLife[index] = (this.burstLife[index] ?? 0) - dt;
      const offset = index * 3;
      this.burstVelocities[offset + 1] =
        (this.burstVelocities[offset + 1] ?? 0) - 3.5 * dt;
      this.integrate(this.burstPositions, this.burstVelocities, offset, dt);
    }
    this.burst.visible = burstActive;
    this.burstGeometry.attributes.position!.needsUpdate = true;
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
    this.sprayPositions[offset] = snapshot.x + (hash(seed) * 2 - 1) * 0.85;
    this.sprayPositions[offset + 1] = snapshot.height + 0.12;
    this.sprayPositions[offset + 2] = snapshot.z - 1.15;
    this.sprayVelocities[offset] =
      (hash(seed + 2) * 2 - 1) * (0.8 + snapshot.forwardSpeed * 0.025);
    this.sprayVelocities[offset + 1] = 0.5 + hash(seed + 4) * 1.35;
    this.sprayVelocities[offset + 2] = -0.7 - hash(seed + 6) * 2.2;
    this.sprayLife[index] = 0.35 + hash(seed + 8) * 0.38;
  }

  private spawnEventBurst(event: DynamicsEvent, snapshot: SledSnapshot): void {
    const config =
      event.type === "coin"
        ? { count: 12, color: 0x72e8ff, lift: 2.8 }
        : event.type === "boost"
          ? { count: 20, color: 0xffc84d, lift: 2.1 }
          : event.type === "rock"
            ? { count: 16, color: 0x91a9b6, lift: 1.8 }
            : { count: 24, color: 0xf2fbff, lift: 3.2 };
    const color = new Color(config.color);
    const origin = new Vector3(
      snapshot.x,
      snapshot.height + (event.type === "coin" ? 0.9 : 0.2),
      snapshot.z,
    );

    for (let particle = 0; particle < config.count; particle += 1) {
      const index = this.burstCursor % BURST_PARTICLES;
      this.burstCursor += 1;
      const offset = index * 3;
      const seed = this.burstCursor * 6.19;
      this.burstPositions[offset] = origin.x;
      this.burstPositions[offset + 1] = origin.y;
      this.burstPositions[offset + 2] = origin.z;
      this.burstVelocities[offset] = (hash(seed) * 2 - 1) * 3.4;
      this.burstVelocities[offset + 1] = 0.6 + hash(seed + 2) * config.lift;
      this.burstVelocities[offset + 2] = (hash(seed + 4) * 2 - 1) * 2.2;
      this.burstColors[offset] = color.r;
      this.burstColors[offset + 1] = color.g;
      this.burstColors[offset + 2] = color.b;
      this.burstLife[index] = 0.48 + hash(seed + 6) * 0.42;
    }
    this.burstGeometry.attributes.color!.needsUpdate = true;
  }

  private refreshSnapshot(windIntensity: number, snapshot: SledSnapshot): void {
    let activeSprayParticles = 0;
    let activeBurstParticles = 0;
    for (const life of this.sprayLife) if (life > 0) activeSprayParticles += 1;
    for (const life of this.burstLife) if (life > 0) activeBurstParticles += 1;
    this.currentSnapshot = {
      windIntensity: this.reducedMotion ? 0 : windIntensity,
      activeSprayParticles,
      activeBurstParticles,
      shadowClearance: Math.max(
        0,
        snapshot.height - surfaceHeightAt(snapshot.x, snapshot.z),
      ),
    };
  }
}
