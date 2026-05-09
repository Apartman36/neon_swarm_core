type OscillatorKind = OscillatorType;

const MIN_INTERVALS = {
  energy: 260,
  laser: 95,
  wave: 1500,
  upgrade: 260,
  shock: 900,
  damage: 620,
};

export class GameAudio {
  private context?: AudioContext;
  private muted = false;
  private lastPlayed: Record<keyof typeof MIN_INTERVALS, number> = {
    energy: 0,
    laser: 0,
    wave: 0,
    upgrade: 0,
    shock: 0,
    damage: 0,
  };

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) void this.context?.suspend();
  }

  async resume(): Promise<void> {
    if (this.muted || typeof window === "undefined") return;
    const AudioContextCtor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    this.context ??= new AudioContextCtor();
    if (this.context.state === "suspended") await this.context.resume();
  }

  energy(): void {
    if (!this.canPlay("energy")) return;
    this.tone(680, 0.075, "sine", 0.024, 0, 1120);
  }

  laser(): void {
    if (!this.canPlay("laser")) return;
    this.tone(1320, 0.035, "triangle", 0.012, 0, 980);
  }

  wave(): void {
    if (!this.canPlay("wave")) return;
    this.tone(170, 0.18, "sawtooth", 0.026, 0, 118);
    this.tone(236, 0.2, "triangle", 0.018, 0.16, 176);
  }

  upgrade(): void {
    if (!this.canPlay("upgrade")) return;
    this.tone(520, 0.09, "sine", 0.026, 0, 780);
    this.tone(1040, 0.12, "triangle", 0.018, 0.08, 1320);
  }

  shock(): void {
    if (!this.canPlay("shock")) return;
    this.tone(84, 0.42, "sine", 0.06, 0, 44);
    this.tone(48, 0.55, "triangle", 0.035, 0.04, 34);
    this.tone(360, 0.16, "sine", 0.018, 0.08, 140);
  }

  damage(): void {
    if (!this.canPlay("damage")) return;
    this.tone(98, 0.16, "sawtooth", 0.034, 0, 72);
  }

  private canPlay(kind: keyof typeof MIN_INTERVALS): boolean {
    if (this.muted || !this.context || this.context.state !== "running") return false;
    const now = performance.now();
    if (now - this.lastPlayed[kind] < MIN_INTERVALS[kind]) return false;
    this.lastPlayed[kind] = now;
    return true;
  }

  private tone(frequency: number, duration: number, type: OscillatorKind, gain: number, delay = 0, endFrequency?: number): void {
    const context = this.context;
    if (!context || this.muted || context.state !== "running") return;

    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    }
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(gain, start + duration * 0.18);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }
}
