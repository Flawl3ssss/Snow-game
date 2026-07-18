import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DodecahedronGeometry,
  Float32BufferAttribute,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import type { BufferAttribute, BufferGeometry, Material } from "three";
import type { GameState } from "../app/GameStateMachine";
import {
  COURSE_OBJECTS,
  type DynamicsEvent,
  type RunDynamicsSnapshot,
} from "../gameplay/RunDynamics";
import {
  RAMP_PHYSICAL_HALF_WIDTH,
  RAMP_SURFACES,
  surfaceHeightAt,
  surfaceSlopeZAt,
  type LaunchParameters,
  type SledSnapshot,
} from "../simulation/SledSimulation";
import { PenguinRider } from "./PenguinRider";
import { SpeedEffects, type SpeedEffectSnapshot } from "./SpeedEffects";

export class SnowScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(55, 1, 0.1, 420);
  private readonly rider = new Group();
  private readonly penguin = new PenguinRider();
  private readonly slingshot = new Group();
  private readonly leftBand: Mesh<BoxGeometry, MeshStandardMaterial>;
  private readonly rightBand: Mesh<BoxGeometry, MeshStandardMaterial>;
  private readonly courseVisuals = new Map<string, Mesh>();
  private readonly sledMaterial = this.penguin.sledMaterial;
  private readonly boostLight = new PointLight(0xffb632, 0, 8, 2);
  private readonly speedEffects: SpeedEffects;
  private readonly reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  private renderWidth = 1;
  private renderHeight = 1;
  private cameraX = 0;
  private cameraY = 5.5;
  private cameraZ = -10;
  private boostPulse = 0;
  private impactShake = 0;
  private landingSquash = 0;
  private previousGrounded = true;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setClearColor(0xc8efff);

    this.scene.background = new Color(0xc8efff);
    this.scene.fog = new Fog(0xc8efff, 72, 230);
    this.camera.position.set(0, 5.5, -10);
    this.camera.lookAt(0, 0, 14);

    this.scene.add(new HemisphereLight(0xbfeaff, 0x7895a6, 2.7));
    const sun = new DirectionalLight(0xfff1d6, 3.8);
    sun.position.set(-14, 22, -10);
    this.scene.add(sun);

    this.scene.add(this.createTrack());
    this.createRampMarkers();
    this.createCourseObjects();
    this.rider.add(this.penguin.root, this.boostLight);
    this.boostLight.position.set(0, 0.45, -0.4);
    this.scene.add(this.rider);
    [this.leftBand, this.rightBand] = this.createSlingshot();
    this.createScenery();
    this.speedEffects = new SpeedEffects(this.scene);
  }

  resize(cssWidth: number, cssHeight: number, pixelRatio: number): void {
    this.renderWidth = Math.max(1, Math.floor(cssWidth));
    this.renderHeight = Math.max(1, Math.floor(cssHeight));
    this.camera.aspect = this.renderWidth / this.renderHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(pixelRatio, 1.75));
    this.renderer.setSize(this.renderWidth, this.renderHeight, false);
  }

  render(
    snapshot: SledSnapshot,
    state: GameState,
    aim: LaunchParameters,
    dynamics: RunDynamicsSnapshot,
  ): void {
    const isPreparing = state === "BASE" || state === "AIMING";
    const pullZ = isPreparing ? -aim.power * 3.1 : 0;
    const pullX = isPreparing ? aim.aim * aim.power * 2.15 : snapshot.x;
    const riderZ = isPreparing ? pullZ : snapshot.z;
    const riderHeight = isPreparing
      ? surfaceHeightAt(pullX, riderZ)
      : snapshot.height;
    const terrainPitch = Math.atan(surfaceSlopeZAt(pullX, riderZ));

    this.rider.position.set(pullX, riderHeight + 0.34, riderZ);
    this.rider.rotation.set(
      -(isPreparing ? terrainPitch : snapshot.pitchRadians),
      isPreparing ? aim.aim * 0.18 : snapshot.headingRadians,
      isPreparing ? 0 : snapshot.rollRadians,
    );
    if (
      state === "RIDING" &&
      !this.previousGrounded &&
      snapshot.grounded &&
      snapshot.landingImpact > 0.6
    ) {
      this.landingSquash = MathUtils.clamp(
        0.38 + snapshot.landingImpact * 0.075,
        0.38,
        1,
      );
    }
    this.previousGrounded = snapshot.grounded;
    const squash = this.reducedMotion ? 0 : this.landingSquash;
    this.rider.scale.set(1 + squash * 0.045, 1 - squash * 0.075, 1.02);
    this.penguin.update(snapshot, state, aim, this.reducedMotion);
    this.sledMaterial.emissiveIntensity = this.boostPulse * 2.6;
    this.boostLight.intensity = this.boostPulse * 7;
    this.slingshot.visible = isPreparing;
    if (isPreparing) this.updateBand(this.leftBand, -1.65, this.rider.position);
    if (isPreparing) this.updateBand(this.rightBand, 1.65, this.rider.position);

    for (const object of COURSE_OBJECTS) {
      const visual = this.courseVisuals.get(object.id);
      if (!visual) continue;
      visual.visible = !dynamics.consumedIds.has(object.id);
      if (object.kind === "coin") {
        visual.rotation.y = snapshot.elapsedSeconds * 2.8 + object.z * 0.1;
        visual.position.y =
          surfaceHeightAt(object.x, object.z) +
          1.05 +
          Math.sin(snapshot.elapsedSeconds * 4 + object.z) * 0.12;
      }
    }

    const desiredCameraX = isPreparing ? 0 : snapshot.x;
    const desiredCameraZ = isPreparing ? -10 : snapshot.z - 10;
    this.cameraX = MathUtils.lerp(this.cameraX, desiredCameraX, 0.13);
    this.cameraZ = MathUtils.lerp(this.cameraZ, desiredCameraZ, 0.13);
    const terrainCameraY = surfaceHeightAt(this.cameraX, this.cameraZ) + 5.5;
    const desiredCameraY = isPreparing
      ? terrainCameraY
      : Math.max(terrainCameraY, snapshot.height + 4.8);
    this.cameraY = MathUtils.lerp(this.cameraY, desiredCameraY, 0.1);
    const targetZ = riderZ + (snapshot.grounded || isPreparing ? 13 : 9);
    const targetTerrainY = surfaceHeightAt(snapshot.x, targetZ) + 0.7;
    const targetY = isPreparing
      ? targetTerrainY
      : Math.max(
          targetTerrainY,
          snapshot.height + (snapshot.grounded ? 0.2 : -0.2),
        );
    const shake = this.reducedMotion
      ? 0
      : this.impactShake * Math.sin(snapshot.elapsedSeconds * 70);
    this.camera.position.set(
      this.cameraX + shake * 0.22,
      this.cameraY + Math.abs(shake) * 0.08,
      this.cameraZ,
    );
    this.camera.lookAt(
      isPreparing ? pullX * 0.25 : snapshot.x,
      targetY,
      targetZ,
    );
    const desiredFov = this.reducedMotion
      ? 55
      : 55 +
        Math.min(10, Math.max(0, snapshot.forwardSpeed - 8) * 0.48) +
        this.boostPulse * 6;
    this.camera.fov = MathUtils.lerp(this.camera.fov, desiredFov, 0.13);
    this.camera.updateProjectionMatrix();
    this.speedEffects.update(snapshot, state === "RIDING");
    this.boostPulse *= 0.94;
    this.impactShake *= 0.84;
    this.landingSquash *= 0.78;
    this.renderer.render(this.scene, this.camera);
  }

  triggerCourseEvent(event: DynamicsEvent): void {
    this.speedEffects.trigger(event);
    if (event.type === "boost") this.boostPulse = 1;
    if (event.type === "rock") this.impactShake = 1;
    if (event.type === "airtime") {
      this.boostPulse = Math.max(this.boostPulse, 0.35);
      this.landingSquash = MathUtils.clamp(event.seconds * 0.6, 0.35, 1);
    }
  }

  resetCamera(): void {
    this.cameraX = 0;
    this.cameraY = 5.5;
    this.cameraZ = -10;
    this.previousGrounded = true;
    this.speedEffects.reset();
  }

  snapCamera(snapshot: SledSnapshot, state: GameState): void {
    const isPreparing = state === "BASE" || state === "AIMING";
    this.cameraX = isPreparing ? 0 : snapshot.x;
    this.cameraZ = isPreparing ? -10 : snapshot.z - 10;
    const terrainCameraY = surfaceHeightAt(this.cameraX, this.cameraZ) + 5.5;
    this.cameraY = isPreparing
      ? terrainCameraY
      : Math.max(terrainCameraY, snapshot.height + 4.8);
  }

  get sizeLabel(): string {
    return `${this.renderWidth}×${this.renderHeight}`;
  }

  get effectSnapshot(): SpeedEffectSnapshot {
    return this.speedEffects.snapshot;
  }

  dispose(): void {
    this.speedEffects.dispose();
    this.scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const mesh = object as Mesh<BufferGeometry, Material | Material[]>;
      mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      materials.forEach((material) => material.dispose());
    });
    this.renderer.dispose();
  }

  private createTrack(): Mesh<PlaneGeometry, MeshStandardMaterial> {
    const geometry = new PlaneGeometry(58, 400, 28, 280);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.getAttribute("position") as BufferAttribute;
    const colors: number[] = [];
    const centerColor = new Color(0xeaf7fa);
    const edgeColor = new Color(0xb9ddea);

    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const z = positions.getZ(index) + 180;
      positions.setXYZ(index, x, surfaceHeightAt(x, z), z);
      const edgeMix = MathUtils.smoothstep(Math.abs(x), 9, 29) * 0.72;
      const color = centerColor.clone().lerp(edgeColor, edgeMix);
      const variation = Math.sin(z * 0.11 + x * 0.17) * 0.018;
      colors.push(
        MathUtils.clamp(color.r + variation, 0, 1),
        MathUtils.clamp(color.g + variation, 0, 1),
        MathUtils.clamp(color.b + variation, 0, 1),
      );
    }

    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return new Mesh(
      geometry,
      new MeshStandardMaterial({
        color: 0xeaf8ff,
        roughness: 0.92,
        metalness: 0,
        vertexColors: true,
      }),
    );
  }

  private createRampMarkers(): void {
    const material = new MeshStandardMaterial({
      color: 0xff8b36,
      roughness: 0.82,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    for (const ramp of RAMP_SURFACES) {
      const length = ramp.end - ramp.start;
      const centerZ = (ramp.start + ramp.end) * 0.5;
      const geometry = new PlaneGeometry(
        RAMP_PHYSICAL_HALF_WIDTH * 2 + 0.16,
        length,
        16,
        32,
      );
      geometry.rotateX(-Math.PI / 2);
      const positions = geometry.getAttribute("position") as BufferAttribute;

      for (let index = 0; index < positions.count; index += 1) {
        const x = positions.getX(index);
        const z = positions.getZ(index) + centerZ;
        positions.setXYZ(index, x, surfaceHeightAt(x, z) + 0.045, z);
      }

      geometry.computeVertexNormals();
      const marker = new Mesh(geometry, material);
      this.scene.add(marker);
    }
  }

  private createCourseObjects(): void {
    const coinMaterial = new MeshStandardMaterial({
      color: 0x72e8ff,
      emissive: 0x167b9e,
      emissiveIntensity: 1.2,
      roughness: 0.3,
      metalness: 0.15,
    });
    const boostMaterial = new MeshStandardMaterial({
      color: 0xffd04f,
      emissive: 0xff6f2d,
      emissiveIntensity: 0.9,
      roughness: 0.55,
    });
    const rockMaterial = new MeshStandardMaterial({
      color: 0x526b79,
      roughness: 0.95,
    });

    for (const object of COURSE_OBJECTS) {
      let visual: Mesh;
      if (object.kind === "coin") {
        visual = new Mesh(new OctahedronGeometry(0.48, 0), coinMaterial);
        visual.scale.set(0.7, 1.25, 0.7);
        visual.position.set(
          object.x,
          surfaceHeightAt(object.x, object.z) + 1.05,
          object.z,
        );
      } else if (object.kind === "boost") {
        visual = new Mesh(new BoxGeometry(4.8, 0.12, 3.2), boostMaterial);
        visual.position.set(
          object.x,
          surfaceHeightAt(object.x, object.z) + 0.08,
          object.z,
        );
        visual.rotation.x = -Math.atan(surfaceSlopeZAt(object.x, object.z));
      } else {
        visual = new Mesh(new DodecahedronGeometry(0.82, 0), rockMaterial);
        visual.scale.set(1.2, 0.9, 1);
        visual.position.set(
          object.x,
          surfaceHeightAt(object.x, object.z) + 0.66,
          object.z,
        );
        visual.rotation.set(0.2, object.z, 0.12);
      }
      this.courseVisuals.set(object.id, visual);
      this.scene.add(visual);
    }
  }

  private createSlingshot(): [
    Mesh<BoxGeometry, MeshStandardMaterial>,
    Mesh<BoxGeometry, MeshStandardMaterial>,
  ] {
    const postMaterial = new MeshStandardMaterial({
      color: 0x68462f,
      roughness: 0.9,
    });
    const bandMaterial = new MeshStandardMaterial({
      color: 0xe54862,
      roughness: 0.75,
    });
    for (const x of [-1.65, 1.65]) {
      const post = new Mesh(
        new CylinderGeometry(0.2, 0.3, 2.7, 8),
        postMaterial,
      );
      post.position.set(x, surfaceHeightAt(x, 0.7) + 1.15, 0.7);
      post.rotation.z = x < 0 ? -0.13 : 0.13;
      this.slingshot.add(post);
    }
    const leftBand = new Mesh(new BoxGeometry(0.1, 0.1, 1), bandMaterial);
    const rightBand = new Mesh(new BoxGeometry(0.1, 0.1, 1), bandMaterial);
    this.slingshot.add(leftBand, rightBand);
    this.scene.add(this.slingshot);
    return [leftBand, rightBand];
  }

  private updateBand(
    band: Mesh<BoxGeometry, MeshStandardMaterial>,
    postX: number,
    riderPosition: Vector3,
  ): void {
    const start = new Vector3(postX, surfaceHeightAt(postX, 0.7) + 2.25, 0.7);
    const end = new Vector3(
      riderPosition.x,
      riderPosition.y + 0.42,
      riderPosition.z,
    );
    band.position.copy(start).add(end).multiplyScalar(0.5);
    band.scale.z = start.distanceTo(end);
    band.lookAt(end);
  }

  private createScenery(): void {
    const trunkMaterial = new MeshStandardMaterial({
      color: 0x75513a,
      roughness: 1,
    });
    const pineMaterial = new MeshStandardMaterial({
      color: 0x176b57,
      roughness: 0.9,
    });
    const snowMaterial = new MeshStandardMaterial({
      color: 0xf4fbfd,
      roughness: 0.96,
    });
    const mountainMaterial = new MeshStandardMaterial({
      color: 0x91b9ce,
      roughness: 1,
      flatShading: true,
    });
    const trunkGeometry = new BoxGeometry(1, 1, 1);
    const crownGeometry = new ConeGeometry(1, 1, 7);
    const mountainGeometry = new ConeGeometry(1, 1, 5);
    const trunks = new InstancedMesh(trunkGeometry, trunkMaterial, 46);
    const lowerCrowns = new InstancedMesh(crownGeometry, pineMaterial, 46);
    const middleCrowns = new InstancedMesh(crownGeometry, pineMaterial, 46);
    const upperCrowns = new InstancedMesh(crownGeometry, pineMaterial, 46);
    const snowCaps = new InstancedMesh(crownGeometry, snowMaterial, 46);
    const dummy = new Object3D();

    for (let index = 0; index < 46; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const z = 5 + index * 7.5;
      const x = side * (18 + (index % 3) * 3);
      const base = surfaceHeightAt(x, z);
      const scale = 0.82 + (index % 4) * 0.08;
      const rotation = (index * 1.73) % (Math.PI * 2);
      this.setSceneryInstance(
        trunks,
        dummy,
        index,
        x,
        base + 0.85 * scale,
        z,
        0.5 * scale,
        1.7 * scale,
        0.5 * scale,
        rotation,
      );
      this.setSceneryInstance(
        lowerCrowns,
        dummy,
        index,
        x,
        base + 2.65 * scale,
        z,
        2.15 * scale,
        2.8 * scale,
        2.15 * scale,
        rotation,
      );
      this.setSceneryInstance(
        middleCrowns,
        dummy,
        index,
        x,
        base + 4.05 * scale,
        z,
        1.7 * scale,
        2.5 * scale,
        1.7 * scale,
        rotation + 0.2,
      );
      this.setSceneryInstance(
        upperCrowns,
        dummy,
        index,
        x,
        base + 5.25 * scale,
        z,
        1.18 * scale,
        2.15 * scale,
        1.18 * scale,
        rotation - 0.15,
      );
      this.setSceneryInstance(
        snowCaps,
        dummy,
        index,
        x,
        base + 5.62 * scale,
        z,
        0.88 * scale,
        0.8 * scale,
        0.88 * scale,
        rotation,
      );
    }
    this.scene.add(trunks, lowerCrowns, middleCrowns, upperCrowns, snowCaps);

    const mountains = new InstancedMesh(mountainGeometry, mountainMaterial, 18);
    for (let index = 0; index < 18; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const z = 28 + Math.floor(index / 2) * 38;
      const x = side * (42 + (index % 3) * 8);
      const base = surfaceHeightAt(x, z) - 3;
      const scale = 8 + (index % 4) * 2.2;
      this.setSceneryInstance(
        mountains,
        dummy,
        index,
        x,
        base + scale * 0.65,
        z,
        scale,
        scale * 1.3,
        scale,
        index * 0.31,
      );
    }
    this.scene.add(mountains);
  }

  private setSceneryInstance(
    instances: InstancedMesh,
    dummy: Object3D,
    index: number,
    x: number,
    y: number,
    z: number,
    scaleX: number,
    scaleY: number,
    scaleZ: number,
    rotationY: number,
  ): void {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, rotationY, 0);
    dummy.scale.set(scaleX, scaleY, scaleZ);
    dummy.updateMatrix();
    instances.setMatrixAt(index, dummy.matrix);
  }
}
