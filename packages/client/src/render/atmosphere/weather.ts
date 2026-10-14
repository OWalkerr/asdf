import { Color, DirectionalLight, type HemisphereLight, type Scene } from 'three/webgpu';
import type { FloatUniform } from '../tsl-types';

/**
 * Şimşek (GDD §3.5): rastgele aralıklarla 2–3 çakımlık parlama. Gölgesiz ikincil directional ışık
 * + gökyüzü flash uniform'u + ambient artışı. Tamamen görsel (sim'den bağımsız, deterministik değil).
 */
export class Lightning {
  private readonly light: DirectionalLight;
  private next = 6 + Math.random() * 8;
  private t = -1;
  private pulses: number[] = [];
  private readonly baseHemi: number;
  enabled = true;
  /** Çakım anında (ses için gök gürültüsü). */
  onStrike: (() => void) | null = null;

  constructor(
    scene: Scene,
    private readonly hemi: HemisphereLight,
    private readonly skyFlash: FloatUniform,
  ) {
    this.light = new DirectionalLight(new Color('#cfe0ff'), 0);
    this.light.position.set(-120, 260, 80);
    scene.add(this.light, this.light.target);
    this.baseHemi = hemi.intensity;
  }

  update(dt: number): void {
    if (!this.enabled) return;
    this.next -= dt;
    if (this.next <= 0) {
      this.next = 9 + Math.random() * 14;
      this.t = 0;
      // Çakım başlangıç zamanları (s): ana + 1–2 yankı.
      this.pulses = [0, 0.12 + Math.random() * 0.1];
      if (Math.random() < 0.6) this.pulses.push(0.35 + Math.random() * 0.25);
      this.light.position.set((Math.random() - 0.5) * 400, 260, (Math.random() - 0.2) * 300);
      this.onStrike?.();
    }
    let f = 0;
    if (this.t >= 0) {
      this.t += dt;
      for (const p of this.pulses) {
        const k = this.t - p;
        if (k >= 0 && k < 0.18) f = Math.max(f, (1 - k / 0.18) ** 2 * (p === 0 ? 1 : 0.7));
      }
      if (this.t > 1) this.t = -1;
    }
    this.light.intensity = f * 5;
    this.skyFlash.value = f;
    this.hemi.intensity = this.baseHemi * (1 + f * 1.5);
  }
}
