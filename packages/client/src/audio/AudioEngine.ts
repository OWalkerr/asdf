/**
 * Prosedürel ses motoru (GDD §12, ses v1): hiç ses dosyası yok — tüm efektler WebAudio
 * osilatör ve gürültü buffer'larından sentezlenir. AudioContext tarayıcı kuralı gereği ilk
 * kullanıcı etkileşiminde açılır. Konumsal efektler kamera hedefine uzaklıkla zayıflar.
 */
export class AudioEngine {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted = false;
  /** Efekt türü başına son çalma zamanları (aşırı yığılmayı önler). */
  private readonly recent = new Map<string, number[]>();
  private startHooks: (() => void)[] = [];

  constructor() {
    try {
      this.muted = localStorage.getItem('bulwark.muted') === '1';
    } catch {
      this.muted = false;
    }
    const unlock = () => {
      this.ensure();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Bağlam açılınca çalışacak kurulum (ör. yağmur döngüsü). */
  onStart(cb: () => void): void {
    if (this.ctx) cb();
    else this.startHooks.push(cb);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    try {
      localStorage.setItem('bulwark.muted', m ? '1' : '0');
    } catch {
      /* depolama yoksa yalnızca bu oturum */
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  private ensure(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.8;
    // Hafif kompresör: kalabalık savaşta patlamayı önler.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    this.master = master;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;
    for (const cb of this.startHooks) cb();
    this.startHooks = [];
  }

  /** Aynı türden son 1 sn'de en fazla `perSec` çalma. */
  allow(kind: string, perSec: number): boolean {
    if (!this.ctx || this.muted) return false;
    const now = this.ctx.currentTime;
    const list = this.recent.get(kind) ?? [];
    while (list.length && now - (list[0] as number) > 1) list.shift();
    if (list.length >= perSec) return false;
    list.push(now);
    this.recent.set(kind, list);
    return true;
  }

  get out(): GainNode | null {
    return this.master;
  }

  /** Gürültü kaynağı (döngülü veya tek atış). */
  noiseSource(loop = false): AudioBufferSourceNode | null {
    if (!this.ctx || !this.noise) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = loop;
    if (!loop) src.loopStart = 0;
    return src;
  }

  /** Zarflı kazanç düğümü: attack → peak → üstel sönüm. */
  envelope(peak: number, attack: number, decay: number, at = this.ctx?.currentTime ?? 0): GainNode | null {
    if (!this.ctx) return null;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    return g;
  }
}
