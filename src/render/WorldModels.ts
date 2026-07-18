import {
  CatmullRomCurve3,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import type { BufferGeometry, Object3D } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type PremiumMaterials = ReturnType<typeof createPremiumMaterials>;

export const createPremiumMaterials = () => ({
  snow: new MeshStandardMaterial({
    color: 0xf4fbff,
    roughness: 0.72,
  }),
  snowShadow: new MeshStandardMaterial({ color: 0xc4e3ef, roughness: 0.9 }),
  pine: new MeshStandardMaterial({ color: 0x176650, roughness: 0.78 }),
  pineLight: new MeshStandardMaterial({ color: 0x27826b, roughness: 0.8 }),
  bark: new MeshStandardMaterial({ color: 0x75452e, roughness: 0.82 }),
  wood: new MeshStandardMaterial({
    color: 0x8a512f,
    roughness: 0.58,
  }),
  rock: new MeshStandardMaterial({ color: 0x526b79, roughness: 0.86 }),
  ice: new MeshStandardMaterial({
    color: 0x67e8f9,
    emissive: 0x087baf,
    emissiveIntensity: 1.05,
    roughness: 0.12,
    metalness: 0.05,
    transparent: true,
    opacity: 0.9,
  }),
  gold: new MeshStandardMaterial({
    color: 0xffc83d,
    emissive: 0xff7a18,
    emissiveIntensity: 0.78,
    roughness: 0.27,
    metalness: 0.46,
  }),
  orange: new MeshStandardMaterial({
    color: 0xff794d,
    roughness: 0.48,
  }),
  mountain: new MeshStandardMaterial({ color: 0x789bb1, roughness: 0.94 }),
  mountainSnow: new MeshStandardMaterial({ color: 0xeaf7fb, roughness: 0.9 }),
});

const roundedBar = (
  width: number,
  height: number,
  depth: number,
  radius: number,
  material: MeshStandardMaterial,
): Mesh =>
  new Mesh(new RoundedBoxGeometry(width, height, depth, 3, radius), material);

const collapseModel = (
  source: Group,
  materials: readonly MeshStandardMaterial[],
): Group => {
  source.updateMatrixWorld(true);
  const result = new Group();
  for (const material of materials) {
    const geometries: BufferGeometry[] = [];
    source.traverse((object) => {
      if (!(object instanceof Mesh) || object.material !== material) return;
      const mesh = object as Mesh<BufferGeometry, MeshStandardMaterial>;
      const geometry = mesh.geometry.index
        ? mesh.geometry.toNonIndexed()
        : mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      geometries.push(geometry);
    });
    if (geometries.length === 0) continue;
    const merged = mergeGeometries(geometries, false);
    if (merged) result.add(new Mesh(merged, material));
  }
  return result;
};

export const createSnowflakeModel = (materials: PremiumMaterials): Group => {
  const root = new Group();
  const core = new Mesh(new SphereGeometry(0.16, 18, 12), materials.ice);
  root.add(core);
  for (let arm = 0; arm < 3; arm += 1) {
    const axis = new Group();
    const spine = roundedBar(0.105, 1.18, 0.105, 0.035, materials.ice);
    axis.add(spine);
    for (const direction of [-1, 1]) {
      for (const y of [-0.37, 0.37]) {
        const twig = roundedBar(0.07, 0.38, 0.075, 0.025, materials.ice);
        twig.position.set(direction * 0.13, y, 0);
        twig.rotation.z = direction * 0.72 + (y < 0 ? Math.PI : 0);
        axis.add(twig);
      }
    }
    axis.rotation.z = arm * (Math.PI / 3);
    root.add(axis);
  }
  root.scale.setScalar(0.88);
  return collapseModel(root, [materials.ice]);
};

export const createBoostPadModel = (materials: PremiumMaterials): Group => {
  const root = new Group();
  const base = roundedBar(4.8, 0.18, 3.2, 0.24, materials.gold);
  root.add(base);
  const chevronShape = new Shape();
  chevronShape.moveTo(-0.85, -0.32);
  chevronShape.lineTo(0, 0.22);
  chevronShape.lineTo(0.85, -0.32);
  chevronShape.lineTo(0.85, 0.08);
  chevronShape.lineTo(0, 0.65);
  chevronShape.lineTo(-0.85, 0.08);
  chevronShape.closePath();
  for (const z of [-0.68, 0, 0.68]) {
    const chevron = new Mesh(
      new ExtrudeGeometry(chevronShape, {
        depth: 0.07,
        bevelEnabled: true,
        bevelSegments: 2,
        bevelSize: 0.045,
        bevelThickness: 0.025,
      }),
      materials.snow,
    );
    chevron.rotation.x = Math.PI / 2;
    chevron.position.set(0, 0.16, z);
    root.add(chevron);
  }
  return collapseModel(root, [materials.gold, materials.snow]);
};

export const createRockModel = (
  materials: PremiumMaterials,
  variant: number,
): Group => {
  const root = new Group();
  const stone = new Mesh(new IcosahedronGeometry(0.86, 2), materials.rock);
  stone.scale.set(1.16 + variant * 0.03, 0.82, 0.96 - variant * 0.02);
  stone.rotation.set(0.08, variant * 1.7, 0.06);
  const cap = new Mesh(new SphereGeometry(0.7, 20, 12), materials.snow);
  cap.scale.set(1.08, 0.24, 0.86);
  cap.position.set(-0.05, 0.58, -0.02);
  root.add(stone, cap);
  return collapseModel(root, [materials.rock, materials.snow]);
};

export const createSlingshotPost = (
  x: number,
  materials: PremiumMaterials,
): Group => {
  const root = new Group();
  const post = new Mesh(
    new CylinderGeometry(0.25, 0.34, 2.75, 20, 5),
    materials.wood,
  );
  post.rotation.z = x < 0 ? -0.12 : 0.12;
  const collar = new Mesh(
    new TorusGeometry(0.28, 0.055, 8, 24),
    materials.orange,
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.05;
  const cap = new Mesh(new SphereGeometry(0.27, 18, 12), materials.wood);
  cap.scale.y = 0.42;
  cap.position.y = 1.36;
  root.add(post, collar, cap);
  return collapseModel(root, [materials.wood, materials.orange]);
};

export const createRampRail = (
  x: number,
  start: number,
  end: number,
  heightAt: (x: number, z: number) => number,
  materials: PremiumMaterials,
): Mesh => {
  const points: Vector3[] = [];
  for (let index = 0; index <= 14; index += 1) {
    const z = MathUtils.lerp(start, end, index / 14);
    points.push(new Vector3(x, heightAt(x, z) + 0.16, z));
  }
  return new Mesh(
    new TubeGeometry(new CatmullRomCurve3(points), 42, 0.13, 10, false),
    materials.orange,
  );
};

export const createDirectionSign = (
  direction: -1 | 1,
  materials: PremiumMaterials,
): Group => {
  const root = new Group();
  const pole = new Mesh(
    new CylinderGeometry(0.1, 0.13, 2.4, 14),
    materials.wood,
  );
  pole.position.y = 1.1;
  const board = roundedBar(2.15, 0.92, 0.18, 0.12, materials.wood);
  board.position.y = 2.15;
  const shaft = roundedBar(0.82, 0.12, 0.06, 0.04, materials.snow);
  shaft.position.set(-direction * 0.08, 2.15, -0.13);
  shaft.rotation.z = direction < 0 ? 0 : Math.PI;
  const head = new Mesh(new CylinderGeometry(0, 0.31, 0.58, 3), materials.snow);
  head.rotation.set(0, 0, direction * Math.PI * 0.5);
  head.position.set(direction * 0.46, 2.15, -0.13);
  root.add(pole, board, shaft, head);
  return collapseModel(root, [materials.wood, materials.snow]);
};

export const createFenceSection = (materials: PremiumMaterials): Group => {
  const root = new Group();
  for (const x of [-1.2, 1.2]) {
    const pole = new Mesh(
      new CylinderGeometry(0.07, 0.1, 1.4, 12),
      materials.wood,
    );
    pole.position.set(x, 0.65, 0);
    root.add(pole);
  }
  for (const y of [0.55, 1.0]) {
    const rail = roundedBar(2.5, 0.12, 0.12, 0.04, materials.orange);
    rail.position.y = y;
    root.add(rail);
  }
  return collapseModel(root, [materials.wood, materials.orange]);
};

export const setInstance = (
  instances: {
    setMatrixAt: (index: number, matrix: Object3D["matrix"]) => void;
  },
  dummy: Object3D,
  index: number,
  position: Vector3,
  scale: Vector3,
  rotationY: number,
): void => {
  dummy.position.copy(position);
  dummy.rotation.set(0, rotationY, 0);
  dummy.scale.copy(scale);
  dummy.updateMatrix();
  instances.setMatrixAt(index, dummy.matrix);
};
