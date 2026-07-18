import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  LatheGeometry,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  SplineCurve,
  SRGBColorSpace,
  Vector2,
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
import {
  createBoostPadModel,
  createDirectionSign,
  createFenceSection,
  createPremiumMaterials,
  createRampRail,
  createRockModel,
  createSlingshotPost,
  createSnowflakeModel,
} from "./WorldModels";

export class SnowScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(55, 1, 0.1, 420);
  private readonly materials = createPremiumMaterials();
  private readonly rider = new Group();
  private readonly penguin = new PenguinRider();
  private readonly slingshot = new Group();
  private readonly leftBand: Mesh<BoxGeometry, MeshStandardMaterial>;
  private readonly rightBand: Mesh<BoxGeometry, MeshStandardMaterial>;
  private readonly courseVisuals = new Map<string, Object3D>();
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
      color: 0xd9f3fa,
      roughness: 0.68,
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
      this.scene.add(
        createRampRail(
          -RAMP_PHYSICAL_HALF_WIDTH,
          ramp.start,
          ramp.end,
          surfaceHeightAt,
          this.materials,
        ),
        createRampRail(
          RAMP_PHYSICAL_HALF_WIDTH,
          ramp.start,
          ramp.end,
          surfaceHeightAt,
          this.materials,
        ),
      );
    }
  }

  private createCourseObjects(): void {
    for (const [index, object] of COURSE_OBJECTS.entries()) {
      let visual: Object3D;
      if (object.kind === "coin") {
        visual = createSnowflakeModel(this.materials);
        visual.position.set(
          object.x,
          surfaceHeightAt(object.x, object.z) + 1.05,
          object.z,
        );
      } else if (object.kind === "boost") {
        visual = createBoostPadModel(this.materials);
        visual.position.set(
          object.x,
          surfaceHeightAt(object.x, object.z) + 0.11,
          object.z,
        );
        visual.rotation.x = -Math.atan(surfaceSlopeZAt(object.x, object.z));
      } else {
        visual = createRockModel(this.materials, index % 3);
        visual.position.set(
          object.x,
          surfaceHeightAt(object.x, object.z) + 0.7,
          object.z,
        );
        visual.rotation.y = object.z;
      }
      this.courseVisuals.set(object.id, visual);
      this.scene.add(visual);
    }
  }

  private createSlingshot(): [
    Mesh<BoxGeometry, MeshStandardMaterial>,
    Mesh<BoxGeometry, MeshStandardMaterial>,
  ] {
    const bandMaterial = new MeshStandardMaterial({
      color: 0xe54862,
      roughness: 0.52,
    });
    for (const x of [-1.65, 1.65]) {
      const post = createSlingshotPost(x, this.materials);
      post.position.set(x, surfaceHeightAt(x, 0.7) + 1.15, 0.7);
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
    const trunkGeometry = new CylinderGeometry(1, 1, 1, 12, 2);
    // A single revolved profile gives every fir a layered, organic silhouette
    // without multiplying draw calls. Separate snow clumps keep the crown
    // readable against pale mountains and avoid the old topiary-ball look.
    const crownProfile = new SplineCurve([
      new Vector2(0.05, 1.2),
      new Vector2(0.34, 1.02),
      new Vector2(0.2, 0.76),
      new Vector2(0.72, 0.56),
      new Vector2(0.42, 0.28),
      new Vector2(0.98, 0.06),
      new Vector2(0.58, -0.25),
      new Vector2(1.18, -0.52),
      new Vector2(0.76, -0.78),
      new Vector2(0.08, -0.9),
    ]).getPoints(36);
    const crownGeometry = new LatheGeometry(crownProfile, 24);
    const snowClumpGeometry = new LatheGeometry(
      new SplineCurve([
        new Vector2(0.06, 0.2),
        new Vector2(0.34, 0.19),
        new Vector2(0.72, 0.1),
        new Vector2(1, 0),
        new Vector2(0.58, -0.08),
        new Vector2(0.08, -0.1),
      ]).getPoints(20),
      20,
    );
    const mountainGeometry = new LatheGeometry(
      new SplineCurve([
        new Vector2(1.08, -0.5),
        new Vector2(1.02, -0.28),
        new Vector2(0.82, -0.05),
        new Vector2(0.58, 0.18),
        new Vector2(0.27, 0.38),
        new Vector2(0.02, 0.5),
      ]).getPoints(28),
      28,
    );
    const mountainSnowGeometry = new LatheGeometry(
      new SplineCurve([
        new Vector2(1, -0.5),
        new Vector2(0.86, -0.3),
        new Vector2(0.58, -0.02),
        new Vector2(0.25, 0.3),
        new Vector2(0.02, 0.5),
      ]).getPoints(22),
      28,
    );
    const trunks = new InstancedMesh(trunkGeometry, this.materials.bark, 46);
    const crowns = new InstancedMesh(crownGeometry, this.materials.pine, 46);
    const snowClumps = new InstancedMesh(
      snowClumpGeometry,
      this.materials.snow,
      46 * 3,
    );
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
        crowns,
        dummy,
        index,
        x,
        base + 3.65 * scale,
        z,
        2.05 * scale,
        3.05 * scale,
        1.88 * scale,
        rotation,
      );
      const clumps = [
        { y: 5.92, width: 0.68, depth: 0.6 },
        { y: 4.82, width: 1.05, depth: 0.82 },
        { y: 3.5, width: 1.42, depth: 1.05 },
      ];
      clumps.forEach((clump, clumpIndex) => {
        this.setSceneryInstance(
          snowClumps,
          dummy,
          index * 3 + clumpIndex,
          x,
          base + clump.y * scale,
          z - 0.06 * clumpIndex,
          clump.width * scale,
          0.16 * scale,
          clump.depth * scale,
          rotation + clumpIndex * 0.17,
        );
      });
    }
    this.scene.add(trunks, crowns, snowClumps);

    const mountains = new InstancedMesh(
      mountainGeometry,
      this.materials.mountain,
      18,
    );
    const mountainSnow = new InstancedMesh(
      mountainSnowGeometry,
      this.materials.mountainSnow,
      18,
    );
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
      this.setSceneryInstance(
        mountainSnow,
        dummy,
        index,
        x,
        base + scale * 1.18,
        z,
        scale * 0.47,
        scale * 0.52,
        scale * 0.47,
        index * 0.31,
      );
    }
    this.scene.add(mountains, mountainSnow);

    for (let index = 0; index < 8; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const z = 38 + index * 34;
      const sign = createDirectionSign(side, this.materials);
      sign.position.set(side * 12.5, surfaceHeightAt(side * 12.5, z), z);
      sign.rotation.y = side < 0 ? 0.22 : -0.22;
      this.scene.add(sign);
    }
    for (let index = 0; index < 10; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const z = 24 + Math.floor(index / 2) * 42;
      const fence = createFenceSection(this.materials);
      fence.position.set(side * 15.5, surfaceHeightAt(side * 15.5, z), z);
      fence.rotation.y = side < 0 ? 0.08 : -0.08;
      this.scene.add(fence);
    }
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
