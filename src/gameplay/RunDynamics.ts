import type { SledSnapshot } from "../simulation/SledSimulation";

export type CourseObjectKind = "coin" | "boost" | "rock";

export type CourseObject = {
  id: string;
  kind: CourseObjectKind;
  x: number;
  z: number;
};

export type DynamicsEvent =
  | { type: "coin"; combo: number; points: number }
  | { type: "boost"; points: number }
  | { type: "rock" }
  | { type: "airtime"; seconds: number; points: number };

export type RunDynamicsSnapshot = {
  score: number;
  runCoins: number;
  combo: number;
  bestCombo: number;
  missionProgress: number;
  missionTarget: number;
  missionComplete: boolean;
  consumedIds: ReadonlySet<string>;
};

export const COURSE_OBJECTS: readonly CourseObject[] = [
  { id: "c01", kind: "coin", x: 0, z: 18 },
  { id: "c02", kind: "coin", x: 0, z: 21 },
  { id: "c03", kind: "coin", x: 0, z: 24 },
  { id: "c04", kind: "coin", x: 2, z: 27 },
  { id: "c05", kind: "coin", x: 4, z: 30 },
  { id: "r01", kind: "rock", x: 4.5, z: 38 },
  { id: "b01", kind: "boost", x: -5, z: 48 },
  { id: "b02", kind: "boost", x: 5, z: 48 },
  { id: "c06", kind: "coin", x: -6, z: 83 },
  { id: "c07", kind: "coin", x: -3, z: 86 },
  { id: "c08", kind: "coin", x: 0, z: 89 },
  { id: "c09", kind: "coin", x: 3, z: 92 },
  { id: "c10", kind: "coin", x: 6, z: 95 },
  { id: "r02", kind: "rock", x: -5, z: 106 },
  { id: "r03", kind: "rock", x: 5, z: 106 },
  { id: "b03", kind: "boost", x: 0, z: 122 },
  { id: "c11", kind: "coin", x: 0, z: 158 },
  { id: "c12", kind: "coin", x: -2.5, z: 162 },
  { id: "c13", kind: "coin", x: 2.5, z: 166 },
  { id: "c14", kind: "coin", x: -5, z: 172 },
  { id: "c15", kind: "coin", x: 5, z: 176 },
  { id: "r04", kind: "rock", x: 0, z: 184 },
  { id: "b04", kind: "boost", x: -5.5, z: 194 },
  { id: "b05", kind: "boost", x: 5.5, z: 194 },
] as const;

const MISSION_TARGET = 3;

export class RunDynamics {
  private eventScore = 0;
  private distance = 0;
  private runCoins = 0;
  private combo = 0;
  private bestCombo = 0;
  private comboSeconds = 0;
  private flightSeconds = 0;
  private readonly consumedIds = new Set<string>();

  reset(): void {
    this.eventScore = 0;
    this.distance = 0;
    this.runCoins = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.comboSeconds = 0;
    this.flightSeconds = 0;
    this.consumedIds.clear();
  }

  update(
    previous: SledSnapshot,
    current: SledSnapshot,
    dt: number,
  ): DynamicsEvent[] {
    const events: DynamicsEvent[] = [];
    this.distance = current.distanceMeters;
    this.comboSeconds = Math.max(0, this.comboSeconds - dt);
    if (this.comboSeconds === 0) this.combo = 0;

    if (!current.grounded) this.flightSeconds += dt;
    if (!previous.grounded && current.grounded) {
      if (this.flightSeconds >= 0.45) {
        this.extendCombo();
        const points = Math.round(this.flightSeconds * 45) * this.combo;
        this.eventScore += points;
        events.push({ type: "airtime", seconds: this.flightSeconds, points });
      }
      this.flightSeconds = 0;
    }

    for (const object of COURSE_OBJECTS) {
      if (this.consumedIds.has(object.id)) continue;
      // Course objects sit on the snow. Requiring the whole swept segment to
      // stay grounded prevents a jump from collecting or hitting objects that
      // were passed several metres below the sled. This also avoids a false
      // collision on the single frame that transitions into or out of flight.
      if (!previous.grounded || !current.grounded) continue;
      if (previous.z > object.z || current.z < object.z) continue;
      const radius =
        object.kind === "boost" ? 2.6 : object.kind === "rock" ? 1.45 : 1.25;
      if (Math.abs(current.x - object.x) > radius) continue;

      this.consumedIds.add(object.id);
      if (object.kind === "coin") {
        this.extendCombo();
        this.runCoins += 1;
        const points = 12 * this.combo;
        this.eventScore += points;
        events.push({ type: "coin", combo: this.combo, points });
      } else if (object.kind === "boost") {
        const points = 25 * Math.max(1, this.combo);
        this.eventScore += points;
        events.push({ type: "boost", points });
      } else {
        this.combo = 0;
        this.comboSeconds = 0;
        events.push({ type: "rock" });
      }
    }

    return events;
  }

  get snapshot(): RunDynamicsSnapshot {
    return {
      score: Math.floor(this.distance) + this.eventScore,
      runCoins: this.runCoins,
      combo: this.combo,
      bestCombo: this.bestCombo,
      missionProgress: Math.min(this.runCoins, MISSION_TARGET),
      missionTarget: MISSION_TARGET,
      missionComplete: this.runCoins >= MISSION_TARGET,
      consumedIds: this.consumedIds,
    };
  }

  private extendCombo(): void {
    this.combo = this.comboSeconds > 0 ? this.combo + 1 : 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.comboSeconds = 3.2;
  }
}
