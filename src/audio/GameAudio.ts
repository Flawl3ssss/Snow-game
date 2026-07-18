export type GameSound =
  "launch" | "coin" | "boost" | "rock" | "airtime" | "result" | "upgrade";

const patterns: Record<GameSound, readonly [number, number, number][]> = {
  launch: [
    [180, 0, 0.09],
    [300, 0.07, 0.13],
  ],
  coin: [
    [720, 0, 0.06],
    [980, 0.05, 0.09],
  ],
  boost: [
    [240, 0, 0.08],
    [480, 0.05, 0.16],
    [760, 0.12, 0.13],
  ],
  rock: [[95, 0, 0.18]],
  airtime: [
    [420, 0, 0.08],
    [620, 0.06, 0.12],
  ],
  result: [
    [330, 0, 0.1],
    [440, 0.09, 0.1],
    [660, 0.18, 0.18],
  ],
  upgrade: [
    [520, 0, 0.08],
    [780, 0.07, 0.12],
  ],
};

export class GameAudio {
  private context?: AudioContext;

  play(sound: GameSound): void {
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;
    this.context ??= new AudioContextClass();
    void this.context.resume().catch(() => undefined);
    const now = this.context.currentTime;
    for (const [frequency, offset, duration] of patterns[sound]) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = sound === "rock" ? "sawtooth" : "sine";
      oscillator.frequency.setValueAtTime(frequency, now + offset);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.075, now + offset + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + duration + 0.02);
    }
  }

  close(): void {
    void this.context?.close().catch(() => undefined);
  }
}
