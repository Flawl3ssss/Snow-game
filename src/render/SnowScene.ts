import {
  AmbientLight,
  BoxGeometry,
  Color,
  ConeGeometry,
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
  WebGLRenderer,
} from "three";
import type { BufferAttribute, BufferGeometry, Material } from "three";
import type { FoundationSnapshot } from "../simulation/FoundationSimulation";

export class SnowScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(55, 1, 0.1, 280);
  private readonly rider = new Group();
  private readonly track: Mesh<PlaneGeometry, MeshStandardMaterial>;
  private renderWidth = 1;
  private renderHeight = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setClearColor(0xc8efff);

    this.scene.background = new Color(0xc8efff);
    this.scene.fog = new Fog(0xc8efff, 70, 210);

    this.camera.position.set(0, 5.5, -10);
    this.camera.lookAt(0, 0, 14);

    this.scene.add(new AmbientLight(0xbce8ff, 2.4));
    const sun = new DirectionalLight(0xfff7e8, 3.5);
    sun.position.set(-10, 18, -8);
    this.scene.add(sun);

    this.track = this.createTrack();
    this.scene.add(this.track);
    this.createRider();
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

  render(snapshot: FoundationSnapshot): void {
    const previewProgress = Math.min(snapshot.distanceMeters * 0.05, 16);
    this.rider.position.z = previewProgress;
    this.rider.position.y = -previewProgress * 0.08 + 0.34;
    this.rider.rotation.x = MathUtils.degToRad(-4.6);

    const cameraTargetZ = previewProgress + 13;
    this.camera.position.z = previewProgress - 10;
    this.camera.position.y = 5.5 - previewProgress * 0.08;
    this.camera.lookAt(0, -cameraTargetZ * 0.08 + 0.5, cameraTargetZ);
    this.renderer.render(this.scene, this.camera);
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
    const geometry = new PlaneGeometry(58, 220, 18, 55);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.getAttribute("position") as BufferAttribute;

    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const z = positions.getZ(index) + 80;
      const edgeLift = Math.pow(Math.abs(x) / 29, 2) * 2.8;
      const gentleWave = Math.sin(z * 0.075) * 0.18;
      positions.setXYZ(index, x, -z * 0.08 + edgeLift + gentleWave, z);
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

  private createScenery(): void {
    const trunkMaterial = new MeshStandardMaterial({
      color: 0x75513a,
      roughness: 1,
    });
    const pineMaterial = new MeshStandardMaterial({
      color: 0x176b57,
      roughness: 0.9,
    });

    for (let index = 0; index < 20; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const z = 8 + index * 7.5;
      const tree = new Group();
      const trunk = new Mesh(new BoxGeometry(0.55, 2, 0.55), trunkMaterial);
      trunk.position.y = 0.8;
      const crown = new Mesh(new ConeGeometry(2.1, 5.2, 7), pineMaterial);
      crown.position.y = 4;
      tree.add(trunk, crown);
      tree.position.set(side * (18 + (index % 3) * 3), -z * 0.08, z);
      tree.scale.setScalar(0.8 + (index % 4) * 0.08);
      this.scene.add(tree);
    }
  }
}
