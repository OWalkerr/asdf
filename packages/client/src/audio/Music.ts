import type { AudioEngine } from './AudioEngine';

/**
 * Uyarlanır savaş müziği (BFME2 ruhu, tamamen prosedürel): ağır tempolu minör akor dizisi üstünde
 * katmanlar. Sakinken yalnızca yaylı pad ve uzak koro; düşman yaklaştıkça yaylı ostinato, savaş
 * davulları (taiko) ve bakır boru motifleri girer. Dalga başında boru çağrısı, zaferde majör
 * kapanış, yenilgide karanlık akor. İyi taraflar Dm–B♭–F–C, kötü taraflar Dm–E♭–B♭–A (frig).
 */
const BPM = 76;
const BEAT = 60 / BPM;
const LOOK = 0.35;

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
// Akorlar MIDI (kök, üçlü, beşli) — 4 vuruşluk ölçü başına bir akor.
const GOOD = [
  [50, 53, 57],
  [46, 50, 53],
  [41, 45, 48],
  [48, 52, 55],
];
const EVIL = [
  [50, 53, 57],
  [51, 55, 58],
  [46, 49, 53],
  [45, 49, 52],
];
/** Boru motifi (akor köküne göre yarım ton). */
const MOTIF = [0, 7, 5, 3, 2, 0];

export class Music {
  private gain: GainNode | null = null;
  private timer = 0;
  private nextBeat = 0;
  private beat = 0;
  private intensity = 0.1;
  private target = 0.1;
  private enabled = true;
  private evil = false;
  private hornQueued = false;

  constructor(private readonly a: AudioEngine) {
    try {
      this.enabled = localStorage.getItem('bulwark.music') !== '0';
    } catch {
      this.enabled = true;
    }
    a.onStart(() => this.start());
  }

  get isOn(): boolean {
    return this.enabled;
  }

  /** Müzik düzeyi (Seçenekler, 0–1). */
  private level = 0.3;

  setLevel(v: number): void {
    this.level = 0.3 * Math.max(0, Math.min(1, v));
    const ctx = this.a.ctx;
    if (this.gain && ctx && this.enabled) this.gain.gain.setTargetAtTime(this.level, ctx.currentTime, 0.2);
  }

  setFaction(evil: boolean): void {
    this.evil = evil;
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem('bulwark.music', this.enabled ? '1' : '0');
    } catch {
      /* depolama yok */
    }
    const ctx = this.a.ctx;
    if (this.gain && ctx) this.gain.gain.setTargetAtTime(this.enabled ? this.level : 0, ctx.currentTime, 0.4);
    return this.enabled;
  }

  /** Savaş yoğunluğu hedefi [0, 1] (yakın düşman, çarpışma). */
  setIntensity(v: number): void {
    this.target = Math.max(0.05, Math.min(1, v));
  }

  /** Dalga başı: bir sonraki ölçüde boru çağrısı. */
  waveStart(): void {
    this.hornQueued = true;
  }

  /** Maç sonu kapanışı. */
  finale(victory: boolean): void {
    const ctx = this.a.ctx;
    if (!ctx || !this.gain) return;
    const at = ctx.currentTime + 0.1;
    const chord = victory ? [50, 54, 57, 62, 66] : [38, 41, 45, 50, 51];
    for (const n of chord)
      this.voice('sawtooth', hz(n), at, 4.5, victory ? 0.08 : 0.07, victory ? 2400 : 700, 0.6);
    if (victory) for (let i = 0; i < 4; i++) this.drum(at + i * 0.18, 0.9);
    window.clearInterval(this.timer);
  }

  private start(): void {
    const ctx = this.a.ctx;
    const out = this.a.out;
    if (!ctx || !out) return;
    this.gain = ctx.createGain();
    this.gain.gain.value = this.enabled ? this.level : 0;
    this.gain.connect(out);
    this.nextBeat = ctx.currentTime + 0.2;
    this.timer = window.setInterval(() => this.schedule(), 100);
  }

  private schedule(): void {
    const ctx = this.a.ctx;
    if (!ctx || !this.gain) return;
    // Yoğunluk yumuşak takip (yükselişte hızlı, düşüşte yavaş).
    const k = this.target > this.intensity ? 0.08 : 0.015;
    this.intensity += (this.target - this.intensity) * k;
    while (this.nextBeat < ctx.currentTime + LOOK) {
      this.playBeat(this.nextBeat, this.beat);
      this.nextBeat += BEAT;
      this.beat++;
    }
  }

  private playBeat(at: number, beat: number): void {
    const prog = this.evil ? EVIL : GOOD;
    const bar = Math.floor(beat / 4);
    const pos = beat % 4;
    const chord = prog[bar % prog.length] as number[];
    const I = this.intensity;
    if (pos === 0) {
      // Pad: yaylı akor (her ölçü), koro yoğunlukla.
      for (const n of chord) this.voice('sawtooth', hz(n), at, BEAT * 4.2, 0.035, 900, 1.2);
      this.voice('sine', hz((chord[0] as number) - 12), at, BEAT * 4, 0.08, 400, 0.8);
      if (I > 0.55)
        for (const n of chord) this.voice('triangle', hz(n + 12), at, BEAT * 4, 0.025 * I, 1600, 1.5);
      if (this.hornQueued) {
        this.hornQueued = false;
        this.horn(at, chord[0] as number);
      } else if (I > 0.75 && bar % 4 === 2) this.horn(at, chord[0] as number);
    }
    // Ostinato: sekizlik arpej (orta yoğunluktan itibaren).
    if (I > 0.25)
      for (let h = 0; h < 2; h++) {
        const n = (chord[(beat * 2 + h) % 3] as number) + 12;
        this.voice(
          'triangle',
          hz(n),
          at + (h * BEAT) / 2,
          BEAT / 2.2,
          0.05 * Math.min(1, (I - 0.2) * 1.6),
          2200,
          0.02,
        );
      }
    // Davullar: 1. ve 3. vuruş; yoğunlukta 16'lık dolgu.
    if (I > 0.35 && (pos === 0 || pos === 2)) this.drum(at, 0.6 + I * 0.4);
    if (I > 0.7 && pos === 3) for (let i = 0; i < 3; i++) this.drum(at + (i * BEAT) / 4, 0.35 + I * 0.2);
  }

  /** Zarflı tek nota: osilatör → alçak geçiren → kazanç. */
  private voice(
    type: OscillatorType,
    f: number,
    at: number,
    dur: number,
    peak: number,
    cutoff: number,
    attack: number,
  ): void {
    const ctx = this.a.ctx;
    if (!ctx || !this.gain) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = (Math.random() - 0.5) * 8;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(peak, at + Math.min(attack, dur * 0.5));
    g.gain.setValueAtTime(peak, at + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(lp).connect(g).connect(this.gain);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  /** Taiko: perde düşen sinüs + kısa gürültü vuruşu. */
  private drum(at: number, vel: number): void {
    const ctx = this.a.ctx;
    if (!ctx || !this.gain) return;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(110, at);
    o.frequency.exponentialRampToValueAtTime(42, at + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.5 * vel, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
    o.connect(g).connect(this.gain);
    o.start(at);
    o.stop(at + 0.5);
    const n = this.a.noiseSource();
    if (!n) return;
    const bp = ctx.createBiquadFilter();
    bp.type = 'lowpass';
    bp.frequency.value = 700;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, at);
    ng.gain.exponentialRampToValueAtTime(0.18 * vel, at + 0.005);
    ng.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
    n.connect(bp).connect(ng).connect(this.gain);
    n.start(at, Math.random());
    n.stop(at + 0.15);
  }

  /** Bakır boru motifi (ölçünün kökünden). */
  private horn(at: number, root: number): void {
    MOTIF.forEach((iv, i) => {
      const t = at + i * BEAT * (i === MOTIF.length - 1 ? 0.75 : 0.5);
      const d = i === MOTIF.length - 1 ? BEAT * 2.5 : BEAT * 0.55;
      this.voice('sawtooth', hz(root + iv), t, d, 0.07, 1300, 0.06);
      this.voice('sawtooth', hz(root + iv - 12), t, d, 0.04, 900, 0.06);
    });
  }
}
