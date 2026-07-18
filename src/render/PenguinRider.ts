import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from "three";
import type { GameState } from "../app/GameStateMachine";
import type {
  LaunchParameters,
  SledSnapshot,
} from "../simulation/SledSimulation";

type PenguinPose = {
  bodyBob: number;
  bodyPitch: number;
  bodyLean: number;
  headYaw: number;
  flipperSpread: number;
  scarfSway: number;
};

export const penguinPoseAt = (
  snapshot: SledSnapshot,
  state: GameState,
  aim: LaunchParameters,
  reducedMotion: boolean,
): PenguinPose => {
  const preparing = state === "BASE" || state === "AIMING";
  const speedRatio = MathUtils.clamp(snapshot.forwardSpeed / 24, 0, 1);
  const phase = snapshot.elapsedSeconds * (7 + speedRatio * 7);
  const bodyBob = reducedMotion
    ? 0
    : preparing
      ? Math.sin(snapshot.elapsedSeconds * 2.4) * 0.018
      : snapshot.grounded
        ? Math.sin(phase) * 0.025 * speedRatio
        : 0.035;
  const bodyPitch = preparing
    ? -aim.power * 0.16
    : snapshot.grounded
      ? 0.03 + speedRatio * 0.08
      : MathUtils.clamp(-snapshot.verticalSpeed * 0.018, -0.12, 0.16);
  const bodyLean = preparing ? aim.aim * 0.06 : -snapshot.steer * 0.1;
  const headYaw = preparing ? aim.aim * 0.18 : snapshot.steer * 0.24;
  const flipperSpread = snapshot.grounded
    ? 0.42 + Math.abs(snapshot.steer) * 0.28
    : 1.02;
  const scarfSway = reducedMotion
    ? 0
    : Math.sin(snapshot.elapsedSeconds * 8) * 0.08 + snapshot.steer * 0.16;
  return {
    bodyBob,
    bodyPitch,
    bodyLean,
    headYaw,
    flipperSpread,
    scarfSway,
  };
};

export class PenguinRider {
  readonly root = new Group();
  readonly sledMaterial: MeshStandardMaterial;
  private readonly character = new Group();
  private readonly head = new Group();
  private readonly leftFlipper = new Group();
  private readonly rightFlipper = new Group();
  private readonly scarfTail = new Group();

  constructor() {
    const navy = new MeshStandardMaterial({
      color: 0x17324a,
      roughness: 0.82,
    });
    const ivory = new MeshStandardMaterial({
      color: 0xfff1d6,
      roughness: 0.88,
    });
    const coral = new MeshStandardMaterial({
      color: 0xff765c,
      roughness: 0.74,
    });
    const eye = new MeshStandardMaterial({
      color: 0x102536,
      roughness: 0.72,
    });
    const runner = new MeshStandardMaterial({
      color: 0x35576c,
      roughness: 0.42,
      metalness: 0.28,
    });
    this.sledMaterial = new MeshStandardMaterial({
      color: 0x20b6c9,
      emissive: 0x168bb0,
      emissiveIntensity: 0,
      roughness: 0.68,
    });

    this.createSled(runner);
    this.createPenguin(navy, ivory, coral, eye);
    this.root.add(this.character);
  }

  update(
    snapshot: SledSnapshot,
    state: GameState,
    aim: LaunchParameters,
    reducedMotion: boolean,
  ): void {
    const pose = penguinPoseAt(snapshot, state, aim, reducedMotion);
    this.character.position.y = pose.bodyBob;
    this.character.rotation.set(pose.bodyPitch, 0, pose.bodyLean);
    this.head.rotation.y = pose.headYaw;
    // The flipper meshes point down in local space. These signs rotate them
    // away from the body; the opposite pair folds them behind the torso in the
    // chase camera and destroys the airborne silhouette.
    this.leftFlipper.rotation.z = -pose.flipperSpread;
    this.rightFlipper.rotation.z = pose.flipperSpread;
    this.leftFlipper.rotation.x = snapshot.grounded ? -0.08 : -0.28;
    this.rightFlipper.rotation.x = snapshot.grounded ? -0.08 : -0.28;
    this.scarfTail.rotation.y = pose.scarfSway;
    this.scarfTail.rotation.x =
      0.28 + MathUtils.clamp(snapshot.forwardSpeed / 24, 0, 1) * 0.28;
  }

  private createSled(runnerMaterial: MeshStandardMaterial): void {
    const deck = new Group();
    for (let index = 0; index < 4; index += 1) {
      const slat = new Mesh(
        new BoxGeometry(1.78, 0.1, 0.58),
        this.sledMaterial,
      );
      slat.position.set(0, 0.25, -0.9 + index * 0.6);
      deck.add(slat);
    }
    for (const x of [-0.72, 0.72]) {
      const rail = new Mesh(
        new CylinderGeometry(0.065, 0.065, 3.05, 8),
        runnerMaterial,
      );
      rail.rotation.x = Math.PI / 2;
      rail.position.set(x, 0.08, 0);
      deck.add(rail);
      const nose = new Mesh(
        new TorusGeometry(0.24, 0.065, 6, 12, Math.PI * 0.55),
        runnerMaterial,
      );
      nose.rotation.set(0, Math.PI / 2, Math.PI * 0.1);
      nose.position.set(x, 0.29, 1.46);
      deck.add(nose);
    }
    for (const z of [-0.92, 0.92]) {
      const brace = new Mesh(
        new CylinderGeometry(0.045, 0.045, 1.5, 8),
        runnerMaterial,
      );
      brace.rotation.z = Math.PI / 2;
      brace.position.set(0, 0.16, z);
      deck.add(brace);
    }
    this.root.add(deck);
  }

  private createPenguin(
    navy: MeshStandardMaterial,
    ivory: MeshStandardMaterial,
    coral: MeshStandardMaterial,
    eye: MeshStandardMaterial,
  ): void {
    const body = new Mesh(new SphereGeometry(0.68, 20, 14), navy);
    body.scale.set(0.92, 1.18, 0.84);
    body.position.set(0, 1.22, 0.02);

    const belly = new Mesh(new SphereGeometry(0.55, 18, 12), ivory);
    belly.scale.set(0.7, 1, 0.24);
    belly.position.set(0, 1.15, 0.58);

    const headShell = new Mesh(new SphereGeometry(0.57, 20, 14), navy);
    const face = new Mesh(new SphereGeometry(0.43, 18, 12), ivory);
    face.scale.set(0.82, 0.78, 0.24);
    face.position.set(0, 0.02, 0.47);
    this.head.position.set(0, 1.88, 0.08);
    this.head.add(headShell, face);

    for (const x of [-0.16, 0.16]) {
      const pupil = new Mesh(new SphereGeometry(0.065, 10, 8), eye);
      pupil.position.set(x, 0.1, 0.72);
      this.head.add(pupil);
    }

    const beak = new Mesh(new ConeGeometry(0.15, 0.34, 4), coral);
    beak.rotation.x = Math.PI / 2;
    beak.rotation.y = Math.PI / 4;
    beak.position.set(0, -0.06, 0.84);
    this.head.add(beak);

    this.leftFlipper.position.set(-0.54, 1.42, 0.06);
    this.rightFlipper.position.set(0.54, 1.42, 0.06);
    const leftWing = new Mesh(new ConeGeometry(0.23, 0.92, 8), navy);
    const rightWing = leftWing.clone();
    leftWing.position.y = -0.35;
    rightWing.position.y = -0.35;
    this.leftFlipper.add(leftWing);
    this.rightFlipper.add(rightWing);

    for (const x of [-0.28, 0.28]) {
      const foot = new Mesh(new SphereGeometry(0.22, 12, 8), coral);
      foot.scale.set(1, 0.28, 1.35);
      foot.position.set(x, 0.48, 0.47);
      this.character.add(foot);
    }

    const scarf = new Mesh(new TorusGeometry(0.46, 0.065, 6, 20), coral);
    scarf.rotation.x = Math.PI / 2;
    scarf.position.set(0, 1.66, 0.08);
    const scarfTailMesh = new Mesh(new BoxGeometry(0.18, 0.55, 0.065), coral);
    scarfTailMesh.position.y = -0.23;
    this.scarfTail.position.set(0.36, 1.58, -0.3);
    this.scarfTail.add(scarfTailMesh);

    this.character.add(
      body,
      belly,
      this.head,
      this.leftFlipper,
      this.rightFlipper,
      scarf,
      this.scarfTail,
    );
  }
}
