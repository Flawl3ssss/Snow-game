import {
  AmbientLight,
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import type { BufferAttribute, BufferGeometry, Material } from "three";
import type { GameState } from "../app/GameStateMachine";
import {
  surfaceHeightAt,
  surfaceSlopeZAt,
  type LaunchParameters,
  type SledSnapshot,
} from "../simulation/SledSimulation";

export class SnowScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(55, 1, 0.1, 420);
  private readonly rider = new Group();
  private readonly slingshot = new Group();
  private readonly leftBand: Mesh<BoxGeometry, MeshStandardMaterial>;
  private readonly rightBand: Mesh<BoxGeometry, MeshStandardMaterial>;
  private renderWidth = 1;
  private renderHeight = 1;
  private cameraX = 0;
  private cameraY = 5.5;
  private cameraZ = -10;

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

    this.scene.add(new AmbientLight(0xbce8ff, 2.4));
    const sun = new DirectionalLight(0xfff7e8, 3.5);
    sun.position.set(-10, 18, -8);
    this.scene.add(sun);

    this.scene.add(this.createTrack());
    this.createRampMarkers();
    this.createRider();
    [this.leftBand, this.rightBand] = this.createSlingshot();
    this.createScenery();
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
    this.slingshot.visible = isPreparing;
    if (isPreparing) this.updateBand(this.leftBand, -1.65, this.rider.position);
    if (isPreparing) this.updateBand(this.rightBand, 1.65, this.rider.position);

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
    this.camera.position.set(this.cameraX, this.cameraY, this.cameraZ);
    this.camera.lookAt(
      isPreparing ? pullX * 0.25 : snapshot.x,
      targetY,
      targetZ,
    );
    this.renderer.render(this.scene, this.camera);
  }

  resetCamera(): void {
    this.cameraX = 0;
    this.cameraY = 5.5;
    this.cameraZ = -10;
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

  dispose(): void {
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

    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const z = positions.getZ(index) + 180;
      positions.setXYZ(index, x, surfaceHeightAt(x, z), z);
    }

    geometry.computeVertexNormals();
    return new Mesh(
      geometry,
      new MeshStandardMaterial({
        color: 0xeaf8ff,
        roughness: 0.92,
        metalness: 0,
      }),
    );
  }

  private createRampMarkers(): void {
    const material = new MeshStandardMaterial({
      color: 0xff8b36,
      roughness: 0.82,
      metalness: 0,
    });
    for (const z of [66, 135]) {
      const marker = new Mesh(new BoxGeometry(8.5, 0.1, 7.5), material);
      marker.position.set(0, surfaceHeightAt(0, z) + 0.06, z);
      marker.rotation.x = -Math.atan(surfaceSlopeZAt(0, z));
      this.scene.add(marker);
    }
  }

  private createRider(): void {
    const sled = new Mesh(
      new BoxGeometry(2.1, 0.2, 2.8),
      new MeshStandardMaterial({ color: 0x24a9d8, roughness: 0.55 }),
    );
    sled.position.y = 0.1;
    const body = new Mesh(
      new SphereGeometry(0.68, 20, 14),
      new MeshStandardMaterial({ color: 0xff765c, roughness: 0.7 }),
    );
    body.scale.set(0.88, 1.2, 0.82);
    body.position.set(0, 0.9, 0.1);
    this.rider.add(sled, body);
    this.scene.add(this.rider);
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
    for (let index = 0; index < 46; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const z = 5 + index * 7.5;
      const x = side * (18 + (index % 3) * 3);
      const tree = new Group();
      const trunk = new Mesh(new BoxGeometry(0.55, 2, 0.55), trunkMaterial);
      trunk.position.y = 0.8;
      const crown = new Mesh(new ConeGeometry(2.1, 5.2, 7), pineMaterial);
      crown.position.y = 4;
      tree.add(trunk, crown);
      tree.position.set(x, surfaceHeightAt(x, z), z);
      tree.scale.setScalar(0.8 + (index % 4) * 0.08);
      this.scene.add(tree);
    }
  }
}
