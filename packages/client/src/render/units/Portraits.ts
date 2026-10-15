import { UNIT_DEFS } from '@bulwark/shared';
import {
  AmbientLight,
  Box3,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  PerspectiveCamera,
  RenderTarget,
  Scene,
  SRGBColorSpace,
  type Texture,
  Vector3,
  type WebGPURenderer,
} from 'three/webgpu';
import { createToonMaterial, type ToonParams } from '../materials/ToonMaterial';
import { UNIT_MODELS } from './models';

/**
 * BFME2 tarzı portreler: her birim modeli küçük bir render hedefine, sıcak ana ışık + soğuk
 * kenar ışığıyla omuz hizasından (büyük yaratıklarda tüm gövde) çizilir ve PNG data URL olarak
 * saklanır. Kahraman portreleri, komut çubuğu madalyonu ve eğitim düğmeleri bunları kullanır.
 * Üretim tek seferlik ve asenkrondur; hazır olana kadar arayüz ikonlara düşer.
 */
const SIZE = 128;

export class Portraits {
  private readonly urls = new Map<number, string>();
  /** İstenip henüz üretilmemiş portreler (sırayla, boşta üretilir). */
  private readonly queue: number[] = [];
  private render: ((id: number) => Promise<void>) | null = null;
  private pumping = false;
  /** Portreler hazır olunca (arayüzü tazelemek için). */
  onReady: (() => void) | null = null;
  /** Her birkaç portrede bir (arayüzü aşamalı tazelemek için). */
  onProgress: (() => void) | null = null;

  /** Portre (yoksa undefined; istenen portre sıraya alınır ve kısa süre sonra hazır olur). */
  get(unitType: number): string | undefined {
    const u = this.urls.get(unitType);
    if (u === undefined && this.render && !this.queue.includes(unitType) && UNIT_MODELS[unitType]) {
      this.queue.push(unitType);
      this.pump();
    }
    return u;
  }

  /**
   * `first`: hemen üretilecek birimler (tarafın kahramanları, kışla birimleri, işçi). Diğerleri
   * yalnızca arayüz isteyince üretilir. Kodlama asenkron (toBlob) ve portreler arasında ana
   * döngüye nefes payı bırakılır — maç başında kasma olmasın.
   */
  async build(
    renderer: WebGPURenderer,
    palette: Texture,
    params: ToonParams,
    first: readonly number[] = [],
  ): Promise<void> {
    const scene = new Scene();
    scene.add(new HemisphereLight('#d8e4ff', '#3a2a1a', 1.1));
    scene.add(new AmbientLight('#ffffff', 0.25));
    const key = new DirectionalLight('#ffe6c0', 2.6);
    key.position.set(4, 5, 3);
    const rim = new DirectionalLight('#9cc4ff', 2.0);
    rim.position.set(-4, 3, -4);
    scene.add(key, rim);
    const mat = createToonMaterial(palette, params);
    const cam = new PerspectiveCamera(28, 1, 0.1, 200);
    const rt = new RenderTarget(SIZE, SIZE, { depthBuffer: true });
    rt.texture.colorSpace = SRGBColorSpace;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const g = canvas.getContext('2d');
    if (!g) return;
    const box = new Box3();
    const center = new Vector3();
    const flip =
      (renderer as unknown as { backend: { isWebGLBackend?: boolean } }).backend.isWebGLBackend === true;
    this.render = async (id: number) => {
      const def = UNIT_DEFS[id];
      if (!def || this.urls.has(id)) return;
      const make = UNIT_MODELS[def.id];
      if (!make) return;
      const geo = make();
      const mesh = new Mesh(geo, mat);
      scene.add(mesh);
      box.setFromObject(mesh);
      const h = box.max.y;
      const big = h > 3.2 || box.max.x - box.min.x > 3.5;
      // İnsan boyu: baş ve omuzlar; büyük yaratıklar: tüm gövde.
      if (big) box.getCenter(center);
      else center.set(0.12, h * 0.83, 0);
      const span = big ? Math.max(h, box.max.x - box.min.x) * 0.62 : h * 0.3;
      const dist = span / Math.tan((cam.fov * Math.PI) / 360);
      // Model +X'e bakar: kamera önden, hafif yandan ve yukarıdan.
      cam.position.set(center.x + dist * 0.94, center.y + dist * 0.12, center.z + dist * 0.32);
      cam.lookAt(center);
      // Hedefi ve temizleme alfasını hemen geri al: okuma beklerken ana döngü ekrana çizer.
      const prevTarget = renderer.getRenderTarget();
      const prevAlpha = renderer.getClearAlpha();
      renderer.setRenderTarget(rt);
      renderer.setClearAlpha(0);
      renderer.clear();
      renderer.render(scene, cam);
      renderer.setRenderTarget(prevTarget);
      renderer.setClearAlpha(prevAlpha);
      scene.remove(mesh);
      geo.dispose();
      const px = (await renderer.readRenderTargetPixelsAsync(rt, 0, 0, SIZE, SIZE)) as Uint8Array;
      const img = g.createImageData(SIZE, SIZE);
      for (let y = 0; y < SIZE; y++) {
        const src = (flip ? SIZE - 1 - y : y) * SIZE * 4;
        img.data.set(px.subarray(src, src + SIZE * 4), y * SIZE * 4);
      }
      g.putImageData(img, 0, 0);
      // Asenkron PNG kodlama (toDataURL ana iş parçacığını kilitler).
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
      if (blob) this.urls.set(def.id, URL.createObjectURL(blob));
    };
    for (const id of first) {
      await this.render(id);
      await idle();
    }
    this.onProgress?.();
    this.onReady?.();
    this.pump();
  }

  private pump(): void {
    if (this.pumping || !this.render) return;
    this.pumping = true;
    void (async () => {
      let n = 0;
      while (this.queue.length > 0 && this.render) {
        const id = this.queue.shift() as number;
        await this.render(id);
        await idle();
        if (++n % 2 === 0) this.onProgress?.();
      }
      if (n > 0) this.onProgress?.();
      this.pumping = false;
    })();
  }
}

/** Ana döngüye bir-iki kare bırak. */
const idle = () => new Promise<void>((r) => setTimeout(r, 60));
