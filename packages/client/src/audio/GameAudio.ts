import { SNAP_PROJ_INTS, type SnapshotFrame } from '@bulwark/shared';
import type { AudioEngine } from './AudioEngine';

/**
 * Oyun sesleri (GDD §12): yağmur ambiyansı, gök gürültüsü, kılıç çarpışması, ok yaylımı,
 * koçbaşı darbesi, savaş borusu, inşa/araştırma tamamlanma çanı, arayüz tıkı.
 * Olaylar snapshot farklarından ve görsel efekt çağrılarından türetilir; sim'e dokunmaz.
 */
export class GameAudio {
  private listener = { x: 0, z: 0, zoom: 0.5 };
  private lastProjTick = -1;
  private seenProj = new Set<number>();
  private gateHp: number[] = [];
  private built = new Map<number, number>();
  private upgrades = 0;

  constructor(private readonly a: AudioEngine) {
    a.onStart(() => this.startRain());
  }

  setListener(x: number, z: number, zoom01: number): void {
    this.listener.x = x;
    this.listener.z = z;
    this.listener.zoom = zoom01;
  }

  /** Kamera hedefine uzaklık ve zoom'a göre kazanç [0, 1]. */
  private spatial(x: number, z: number): number {
    const d = Math.hypot(x - this.listener.x, z - this.listener.z);
    const reach = 60 + this.listener.zoom * 120;
    const near = 1 - this.listener.zoom * 0.55;
    return Math.max(0, 1 - d / reach) * near;
  }

  private startRain(): void {
    const { ctx } = this.a;
    const out = this.a.out;
    if (!ctx || !out) return;
    const hiss = this.a.noiseSource(true);
    const rumble = this.a.noiseSource(true);
    if (!hiss || !rumble) return;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 0.6;
    const g1 = ctx.createGain();
    g1.gain.value = 0.07;
    hiss.connect(bp).connect(g1).connect(out);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 180;
    const g2 = ctx.createGain();
    g2.gain.value = 0.09;
    rumble.playbackRate.value = 0.7;
    rumble.connect(lp).connect(g2).connect(out);
    hiss.start();
    rumble.start(0, 0.7);
  }

  thunder(): void {
    if (!this.a.allow('thunder', 2)) return;
    const { ctx } = this.a;
    const out = this.a.out;
    const src = this.a.noiseSource();
    if (!ctx || !out || !src) return;
    const at = ctx.currentTime + 0.4 + Math.random() * 1.2;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, at);
    lp.frequency.exponentialRampToValueAtTime(90, at + 2.5);
    const env = this.a.envelope(0.9, 0.06, 3.2, at);
    if (!env) return;
    src.connect(lp).connect(env).connect(out);
    src.playbackRate.value = 0.5;
    src.start(at, Math.random());
    src.stop(at + 3.6);
  }

  clash(x: number, z: number): void {
    const v = this.spatial(x, z);
    if (v < 0.04 || !this.a.allow('clash', 14)) return;
    const { ctx } = this.a;
    const out = this.a.out;
    if (!ctx || !out) return;
    const at = ctx.currentTime + Math.random() * 0.03;
    const env = this.a.envelope(0.22 * v, 0.002, 0.18, at);
    if (!env) return;
    env.connect(out);
    const base = 1700 + Math.random() * 1500;
    for (const r of [1, 1.47, 2.09]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = base * r;
      o.connect(env);
      o.start(at);
      o.stop(at + 0.22);
    }
    const n = this.a.noiseSource();
    if (n) {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 3000;
      const ne = this.a.envelope(0.25 * v, 0.001, 0.05, at);
      if (ne) {
        n.connect(hp).connect(ne).connect(out);
        n.start(at, Math.random());
        n.stop(at + 0.08);
      }
    }
  }

  private volley(x: number, z: number): void {
    const v = this.spatial(x, z);
    if (v < 0.04 || !this.a.allow('volley', 6)) return;
    const { ctx } = this.a;
    const out = this.a.out;
    const n = this.a.noiseSource();
    if (!ctx || !out || !n) return;
    const at = ctx.currentTime;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(3800, at);
    bp.frequency.exponentialRampToValueAtTime(700, at + 0.35);
    const env = this.a.envelope(0.3 * v, 0.03, 0.35, at);
    if (!env) return;
    n.connect(bp).connect(env).connect(out);
    n.start(at, Math.random());
    n.stop(at + 0.45);
  }

  /** Kapıya ağır darbe (koçbaşı / balta): alçak gümleme. */
  private boom(x: number, z: number, strength: number): void {
    const v = Math.max(0.25, this.spatial(x, z));
    if (!this.a.allow('boom', 3)) return;
    const { ctx } = this.a;
    const out = this.a.out;
    if (!ctx || !out) return;
    const at = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(95, at);
    o.frequency.exponentialRampToValueAtTime(38, at + 0.5);
    const env = this.a.envelope(0.7 * v * strength, 0.005, 0.7, at);
    if (!env) return;
    o.connect(env).connect(out);
    o.start(at);
    o.stop(at + 0.8);
    const n = this.a.noiseSource();
    if (n) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 600;
      const ne = this.a.envelope(0.4 * v * strength, 0.002, 0.25, at);
      if (ne) {
        n.connect(lp).connect(ne).connect(out);
        n.start(at, Math.random());
        n.stop(at + 0.3);
      }
    }
  }

  /** Savaş borusu: düşman (alçak, kaba) veya Rohan/Gondor (parlak). */
  horn(enemy: boolean): void {
    if (!this.a.allow('horn', 1)) return;
    const { ctx } = this.a;
    const out = this.a.out;
    if (!ctx || !out) return;
    const at = ctx.currentTime + 0.05;
    const f = enemy ? 73 : 147;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(enemy ? 380 : 700, at);
    lp.frequency.linearRampToValueAtTime(enemy ? 900 : 1600, at + 1.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.32, at + 0.5);
    g.gain.setValueAtTime(0.32, at + 2.2);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 3.4);
    lp.connect(g).connect(out);
    for (const [mul, det] of [
      [1, 0],
      [1, 7],
      [1.5, -5],
      [2, 3],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * mul * 0.94, at);
      o.frequency.exponentialRampToValueAtTime(f * mul, at + 0.35);
      o.detune.value = det;
      o.connect(lp);
      o.start(at);
      o.stop(at + 3.5);
    }
  }

  /** Tamamlanma çanı (inşa / araştırma / eğitim). */
  chime(high = false): void {
    if (!this.a.allow('chime', 3)) return;
    const { ctx } = this.a;
    const out = this.a.out;
    if (!ctx || !out) return;
    const at = ctx.currentTime;
    [660, 990, high ? 1320 : 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const env = this.a.envelope(0.12, 0.01, 0.9, at + i * 0.08);
      if (!env) return;
      o.connect(env).connect(out);
      o.start(at + i * 0.08);
      o.stop(at + i * 0.08 + 1);
    });
  }

  /** Büyük güç sesleri (prosedürel). */
  spell(kind: 'eagle' | 'eagleHit' | 'flood' | 'quake' | 'flare'): void {
    if (!this.a.allow(`spell-${kind}`, 4)) return;
    const { ctx } = this.a;
    const out = this.a.out;
    if (!ctx || !out) return;
    const at = ctx.currentTime + 0.02;
    const noise = (
      dur: number,
      type: BiquadFilterType,
      f0: number,
      f1: number,
      peak: number,
      attack: number,
    ) => {
      const src = this.a.noiseSource(true);
      const env = this.a.envelope(peak, attack, dur, at);
      if (!src || !env) return;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.setValueAtTime(f0, at);
      f.frequency.exponentialRampToValueAtTime(f1, at + dur);
      src.connect(f).connect(env).connect(out);
      src.start(at);
      src.stop(at + dur + attack + 0.2);
    };
    if (kind === 'eagle') {
      // Kartal çığlığı: iki inen tiz çağrı.
      for (const [d, f] of [
        [0, 2600],
        [0.55, 2300],
      ] as const) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(f, at + d);
        o.frequency.exponentialRampToValueAtTime(f * 0.55, at + d + 0.5);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 38;
        const lg = ctx.createGain();
        lg.gain.value = 90;
        lfo.connect(lg).connect(o.frequency);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 2200;
        bp.Q.value = 2;
        const env = this.a.envelope(0.09, 0.03, 0.5, at + d);
        if (!env) return;
        o.connect(bp).connect(env).connect(out);
        o.start(at + d);
        lfo.start(at + d);
        o.stop(at + d + 0.7);
        lfo.stop(at + d + 0.7);
      }
    } else if (kind === 'eagleHit') noise(0.5, 'lowpass', 600, 80, 0.5, 0.01);
    else if (kind === 'flood') noise(3.2, 'bandpass', 300, 1400, 0.45, 0.4);
    else if (kind === 'quake') {
      noise(4.2, 'lowpass', 160, 60, 0.8, 0.3);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(42, at);
      o.frequency.linearRampToValueAtTime(30, at + 4);
      const env = this.a.envelope(0.4, 0.4, 3.8, at);
      if (!env) return;
      o.connect(env).connect(out);
      o.start(at);
      o.stop(at + 4.5);
    } else {
      // Güneş Parlaması: parlak koro akoru.
      for (const f of [523, 659, 784, 1046]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        const env = this.a.envelope(0.06, 0.25, 1.6, at);
        if (!env) return;
        o.connect(env).connect(out);
        o.start(at);
        o.stop(at + 2.2);
      }
    }
  }

  click(): void {
    if (!this.a.allow('click', 10)) return;
    const { ctx } = this.a;
    const out = this.a.out;
    if (!ctx || !out) return;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 520;
    const env = this.a.envelope(0.05, 0.002, 0.05);
    if (!env) return;
    o.connect(env).connect(out);
    o.start();
    o.stop(ctx.currentTime + 0.08);
  }

  /** Snapshot farklarından olaylar: yeni oklar, kapı darbeleri, yapı/araştırma tamamlanması. */
  updateFromFrame(frame: SnapshotFrame, gates: readonly { pos: readonly [number, number] }[]): void {
    if (frame.tick === this.lastProjTick) return;
    this.lastProjTick = frame.tick;
    const FX = 1 / 65536;
    const next = new Set<number>();
    const pr = frame.projectiles;
    for (let i = 0; i < frame.projCount; i++) {
      const o = i * SNAP_PROJ_INTS;
      const eid = pr[o] as number;
      next.add(eid);
      if (!this.seenProj.has(eid)) this.volley((pr[o + 1] as number) * FX, (pr[o + 2] as number) * FX);
    }
    this.seenProj = next;
    frame.match.gateHp.forEach((hp, i) => {
      const prev = this.gateHp[i];
      const g = gates[i];
      if (prev !== undefined && g && prev - hp >= 80)
        this.boom(g.pos[0], g.pos[1], Math.min(1, (prev - hp) / 400));
      this.gateHp[i] = hp;
    });
    const st = frame.structures;
    for (let i = 0; i < frame.structCount; i++) {
      const o = i * 6;
      const eid = st[o] as number;
      const left = st[o + 4] as number;
      const kind = ((st[o + 1] as number) >>> 16) & 0xff;
      if (kind === 0) continue;
      const prev = this.built.get(eid);
      if (prev !== undefined && prev > 0 && left === 0) this.chime();
      this.built.set(eid, left);
    }
    const up = frame.match.upgrades;
    if (up & ~this.upgrades) this.chime(true);
    this.upgrades = up;
  }
}
