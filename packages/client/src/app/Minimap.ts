import type { MapDef } from '@bulwark/shared';
import { type PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from 'three/webgpu';
import type { RTSCamera } from '../render/camera/RTSCamera';
import type { StructureRenderer } from '../render/structures/StructureRenderer';
import type { UnitRenderer } from '../render/units/UnitRenderer';
import { icon } from './ui/icons';

/**
 * Mini harita (GDD §11.1, sağ alt): arazi bir kez rasterize edilir; 10 Hz'de birlik noktaları,
 * yapılar, kapılar ve kameranın yer izdüşümü çizilir. Tıkla/sürükle → kamera oraya kayar.
 * Kuzey (−Z) yukarıda.
 */
const SIZE = 196;
const TEAM = ['#6fa8ff', '#ff5a4a', '#5ad16a', '#f0c95a'];
/** Oyuncu tarafının mini harita rengi (Rohan: yeşil). */
export const setPlayerMinimapColor = (hex: string): void => {
  TEAM[0] = hex;
};

export class Minimap {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly bg: HTMLCanvasElement;
  private readonly ray = new Raycaster();
  private readonly plane = new Plane(new Vector3(0, 1, 0), 0);
  private readonly hit = new Vector3();
  private readonly ndc = new Vector2();
  private accum = 1;
  /** Palantír çevresindeki düğmeler (help / sound / home). */
  onButton: ((action: string) => void) | null = null;
  private dragging = false;

  constructor(
    private readonly def: MapDef,
    heightAt: (x: number, z: number) => number,
    private readonly cam: RTSCamera,
  ) {
    const root = document.createElement('div');
    root.id = 'palantir';
    // BFME2 palantírı: yuvarlak görüş taşı, süslü metal halka ve çevresinde küçük düğmeler.
    const ring = document.createElement('div');
    ring.className = 'frame';
    root.appendChild(ring);
    const btns = document.createElement('div');
    btns.className = 'pbtns';
    btns.innerHTML = `<button type="button" data-a="help" title="Kontroller (?)">${icon('help')}</button><button type="button" data-a="sound" title="Ses (M)">${icon('sound')}</button><button type="button" data-a="home" title="Kaleye dön (Space)">${icon('castle')}</button>`;
    btns.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest('[data-a]') as HTMLElement | null;
      if (el) this.onButton?.(el.dataset.a ?? '');
    });
    btns.addEventListener('pointerdown', (e) => e.stopPropagation());
    root.appendChild(btns);
    this.canvas = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = this.canvas.height = SIZE * dpr;
    this.canvas.style.width = this.canvas.style.height = `${SIZE}px`;
    root.appendChild(this.canvas);
    document.body.appendChild(root);
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    this.ctx.scale(dpr, dpr);
    this.bg = this.paintTerrain(heightAt);

    const go = (e: PointerEvent) => {
      const r = this.canvas.getBoundingClientRect();
      const [x, z] = this.toWorld(e.clientX - r.left, e.clientY - r.top);
      cam.lookAt(x, z);
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.dragging = true;
      this.canvas.setPointerCapture(e.pointerId);
      go(e);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.dragging) go(e);
    });
    this.canvas.addEventListener('pointerup', () => {
      this.dragging = false;
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private toMap(x: number, z: number): [number, number] {
    const s = SIZE / this.def.size;
    return [(x + this.def.size / 2) * s, (z + this.def.size / 2) * s];
  }

  private toWorld(px: number, py: number): [number, number] {
    const s = this.def.size / SIZE;
    return [px * s - this.def.size / 2, py * s - this.def.size / 2];
  }

  /** Yükseklikten basit renk: vadi yeşil, yamaç kaya, zirve kar; hafif gölgeleme. */
  private paintTerrain(heightAt: (x: number, z: number) => number): HTMLCanvasElement {
    const n = 96;
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    const img = g.createImageData(n, n);
    const step = this.def.size / n;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = -this.def.size / 2 + (i + 0.5) * step;
        const z = -this.def.size / 2 + (j + 0.5) * step;
        const h = heightAt(x, z);
        const shade = 0.75 + Math.max(-0.25, Math.min(0.25, (h - heightAt(x + step, z - step)) * 0.08));
        let col: [number, number, number];
        if (h > 40) col = [205, 210, 214];
        else if (h > 18) col = [104, 99, 94];
        else if (h > 8) col = [118, 112, 96];
        else col = z > -10 ? [96, 116, 70] : [78, 100, 58];
        const o = (j * n + i) * 4;
        img.data[o] = col[0] * shade;
        img.data[o + 1] = col[1] * shade;
        img.data[o + 2] = col[2] * shade;
        img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  update(dt: number, units: UnitRenderer, structures: StructureRenderer | null): void {
    this.accum += dt;
    if (this.accum < 0.1) return;
    this.accum = 0;
    const g = this.ctx;
    g.imageSmoothingEnabled = true;
    g.drawImage(this.bg, 0, 0, SIZE, SIZE);
    // Surlar ve kapılar
    g.strokeStyle = '#d8ccb0';
    g.lineWidth = 2.5;
    for (const w of this.def.walls) {
      g.beginPath();
      w.points.forEach(([x, z], i) => {
        const [px, py] = this.toMap(x, z);
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      });
      g.stroke();
    }
    const plateau = this.def.id === 'helms_deep' ? this.def.terrain.plateaus[0] : undefined;
    if (plateau) {
      const [px, py] = this.toMap(plateau.center[0], plateau.center[1]);
      g.beginPath();
      g.arc(px, py, (19 * SIZE) / this.def.size, 0, Math.PI * 2);
      g.stroke();
    }
    // Kale işareti
    {
      const [kx, ky] = this.toMap(this.def.citadel.pos[0], this.def.citadel.pos[1]);
      g.fillStyle = '#f3ead6';
      g.beginPath();
      g.arc(kx, ky, 4, 0, Math.PI * 2);
      g.fill();
    }
    // Yollar (TD/FD koridorları)
    g.strokeStyle = 'rgba(150,110,70,0.85)';
    g.lineWidth = 2;
    for (const road of this.def.terrain.roads ?? []) {
      g.beginPath();
      road.points.forEach(([x, z], i) => {
        const [px, py] = this.toMap(x, z);
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      });
      g.stroke();
    }
    for (const river of this.def.terrain.rivers ?? []) {
      g.strokeStyle = 'rgba(60,110,150,0.9)';
      g.lineWidth = (river.width * SIZE) / this.def.size;
      g.beginPath();
      river.points.forEach(([x, z], i) => {
        const [px, py] = this.toMap(x, z);
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      });
      g.stroke();
    }
    g.fillStyle = '#f0c95a';
    for (const gate of this.def.gates) {
      const [px, py] = this.toMap(gate.pos[0], gate.pos[1]);
      g.fillRect(px - 2.5, py - 2.5, 5, 5);
    }
    // Yapılar
    if (structures) {
      g.fillStyle = '#e8e4d8';
      for (const st of structures.bySlot.values()) {
        const [px, py] = this.toMap(st.x, st.z);
        g.fillRect(px - 2, py - 2, 4, 4);
      }
    }
    // Birlikler (asker başına 1 px nokta)
    units.forEach((x, _y, z, b, team) => {
      if (b === 0) return;
      const [px, py] = this.toMap(x, z);
      g.fillStyle = TEAM[team] ?? '#fff';
      g.fillRect(px - 0.75, py - 0.75, 1.5, 1.5);
    });
    // Kamera görüş alanı (ekran köşelerinin zemin izdüşümü)
    const camera = this.cam.camera as PerspectiveCamera;
    camera.updateMatrixWorld();
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 1;
    g.beginPath();
    let first = true;
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      this.ray.setFromCamera(this.ndc.set(sx, sy), camera);
      // Ufka bakan üst köşeler: kesişim yoksa uzak bir noktaya kırp.
      if (!this.ray.ray.intersectPlane(this.plane, this.hit) || this.hit.distanceTo(camera.position) > 900)
        this.ray.ray.at(400, this.hit);
      const [px, py] = this.toMap(this.hit.x, this.hit.z);
      if (first) g.moveTo(px, py);
      else g.lineTo(px, py);
      first = false;
    }
    g.closePath();
    g.stroke();
  }
}
