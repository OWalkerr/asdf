import { MathUtils, PerspectiveCamera, Vector3 } from 'three/webgpu';

/**
 * BFME2 tarzı RTS kamerası (GDD §11.2, Phase 1 / Adım 2).
 *
 * Durum: hedef nokta (yerde), yaw, zoom (mesafe). Pitch zoom'dan türetilir:
 * yakınlaştıkça kamera hafifçe yatar (sahneye "içeriden" bakış), uzaklaştıkça
 * stratejik tepe görünümüne dikleşir.
 *
 * Kontroller:
 *   WASD / ok tuşları / ekran kenarı → kaydır     Orta tuş sürükle → kaydır
 *   Q / E veya Alt + sol sürükle      → döndür     Tekerlek → zoom (imlece doğru)
 *   Home / Space                      → başlangıç görünümü
 * Sağ tık bilinçli olarak serbest bırakıldı: birim emirleri içindir.
 */
export interface RTSCameraOptions {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  minDistance: number;
  maxDistance: number;
  /** Yakın ve uzak zoom'daki pitch (derece, yataydan). */
  pitchNear: number;
  pitchFar: number;
  /** Zemin yüksekliği örnekleyici (hedef noktası araziye oturur). */
  heightAt?: (x: number, z: number) => number;
}

const DEFAULTS: RTSCameraOptions = {
  bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 },
  minDistance: 14,
  maxDistance: 150,
  pitchNear: 38,
  pitchFar: 62,
};

export class RTSCamera {
  readonly camera: PerspectiveCamera;
  readonly opts: RTSCameraOptions;

  /** Ayarlanabilir hassasiyetler (debug panelinden). */
  panSpeed = 1.1; // ekran yüksekliği / saniye, mesafeye göre ölçeklenir
  rotateSpeed = 1.6; // radyan / saniye
  zoomStep = 0.12; // tekerlek tıkı başına oran
  edgePan = true;
  edgeSize = 12; // px
  damping = 12; // yumuşatma sertliği (büyük = daha keskin)

  // Hedef (istenen) ve mevcut (yumuşatılmış) durum.
  private goal = { x: 0, z: 0, yaw: 0, dist: 80 };
  private cur = { x: 0, z: 0, yaw: 0, dist: 80, y: 0 };
  private home = { x: 0, z: 0, yaw: 0, dist: 80 };

  private keys = new Set<string>();
  private pointer = { x: -1, y: -1, inside: false };
  private drag: { mode: 'pan' | 'rotate'; x: number; y: number } | null = null;
  private dom: HTMLElement | null = null;
  private readonly tmp = new Vector3();

  constructor(aspect: number, opts: Partial<RTSCameraOptions> = {}) {
    this.opts = { ...DEFAULTS, ...opts };
    this.camera = new PerspectiveCamera(40, aspect, 0.5, 1200);
  }

  setHome(x: number, z: number, yawDeg: number, dist: number): void {
    this.home = { x, z, yaw: MathUtils.degToRad(yawDeg), dist };
    Object.assign(this.goal, this.home);
    Object.assign(this.cur, this.home);
    this.cur.y = this.opts.heightAt?.(x, z) ?? 0;
    this.apply();
  }

  /** Zoom oranı 0 (en yakın) … 1 (en uzak). */
  get zoom01(): number {
    const { minDistance, maxDistance } = this.opts;
    return (this.cur.dist - minDistance) / (maxDistance - minDistance);
  }

  get target(): { x: number; z: number } {
    return { x: this.cur.x, z: this.cur.z };
  }

  attach(dom: HTMLElement): void {
    this.dom = dom;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    dom.addEventListener('pointermove', this.onPointerMove);
    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('pointerleave', this.onPointerLeave);
    dom.addEventListener('wheel', this.onWheel, { passive: false });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  detach(): void {
    const dom = this.dom;
    if (!dom) return;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    dom.removeEventListener('pointermove', this.onPointerMove);
    dom.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    dom.removeEventListener('pointerleave', this.onPointerLeave);
    dom.removeEventListener('wheel', this.onWheel);
    this.dom = null;
  }

  update(dt: number): void {
    const g = this.goal;
    // --- Klavye + kenar kaydırma (kamera yaw'ına göre ekran-uzayı yönleri) ---
    let px = 0;
    let pz = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) pz -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) pz += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) px -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) px += 1;
    if (this.edgePan && this.pointer.inside && !this.drag && this.dom) {
      const { clientWidth: w, clientHeight: h } = this.dom;
      const e = this.edgeSize;
      if (this.pointer.x <= e) px -= 1;
      else if (this.pointer.x >= w - e) px += 1;
      if (this.pointer.y <= e) pz -= 1;
      else if (this.pointer.y >= h - e) pz += 1;
    }
    if (px !== 0 || pz !== 0) {
      const len = Math.hypot(px, pz);
      const speed = this.panSpeed * g.dist * dt;
      this.panScreen((px / len) * speed, (pz / len) * speed);
    }
    if (this.keys.has('KeyQ')) g.yaw += this.rotateSpeed * dt;
    if (this.keys.has('KeyE')) g.yaw -= this.rotateSpeed * dt;

    this.clampGoal();

    // --- Kare hızından bağımsız üstel yumuşatma ---
    const k = 1 - Math.exp(-this.damping * dt);
    const c = this.cur;
    c.x += (g.x - c.x) * k;
    c.z += (g.z - c.z) * k;
    c.yaw += (g.yaw - c.yaw) * k;
    c.dist += (g.dist - c.dist) * k;
    const groundY = this.opts.heightAt?.(c.x, c.z) ?? 0;
    c.y += (groundY - c.y) * k;
    this.apply();
  }

  /** Yerdeki hedefi ekran-uzayı (sağ, aşağı) yönünde dünya birimiyle kaydırır. */
  private panScreen(right: number, down: number): void {
    const s = Math.sin(this.goal.yaw);
    const c = Math.cos(this.goal.yaw);
    // yaw=0'da kamera +Z'den -Z'ye bakar: ekran sağı = +X, ekran aşağısı = +Z.
    this.goal.x += right * c + down * s;
    this.goal.z += -right * s + down * c;
  }

  private clampGoal(): void {
    const { bounds, minDistance, maxDistance } = this.opts;
    const g = this.goal;
    g.x = MathUtils.clamp(g.x, bounds.minX, bounds.maxX);
    g.z = MathUtils.clamp(g.z, bounds.minZ, bounds.maxZ);
    g.dist = MathUtils.clamp(g.dist, minDistance, maxDistance);
  }

  private apply(): void {
    const { pitchNear, pitchFar } = this.opts;
    const c = this.cur;
    const t = MathUtils.clamp(this.zoom01, 0, 1);
    // Ease-in: pitch uzak zoom'da hızla dikleşir, yakında yavaş değişir.
    const pitch = MathUtils.degToRad(MathUtils.lerp(pitchNear, pitchFar, t * t * (3 - 2 * t)));
    const horiz = Math.cos(pitch) * c.dist;
    this.camera.position.set(
      c.x + Math.sin(c.yaw) * horiz,
      c.y + Math.sin(pitch) * c.dist,
      c.z + Math.cos(c.yaw) * horiz,
    );
    this.camera.lookAt(this.tmp.set(c.x, c.y, c.z));
  }

  // --- Olaylar -------------------------------------------------------------

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement) return;
    this.keys.add(e.code);
    if (e.code === 'Home' || e.code === 'Space') {
      Object.assign(this.goal, this.home);
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onBlur = (): void => {
    this.keys.clear();
    this.drag = null;
    this.pointer.inside = false;
  };

  private onPointerMove = (e: PointerEvent): void => {
    this.pointer.x = e.offsetX;
    this.pointer.y = e.offsetY;
    this.pointer.inside = true;
    if (!this.drag || !this.dom) return;
    const dx = e.clientX - this.drag.x;
    const dy = e.clientY - this.drag.y;
    this.drag.x = e.clientX;
    this.drag.y = e.clientY;
    if (this.drag.mode === 'rotate') {
      this.goal.yaw -= (dx / this.dom.clientWidth) * Math.PI * 1.5;
    } else {
      // Piksel → dünya: görünür yer yüksekliği ≈ 2·dist·tan(fov/2).
      const worldPerPx =
        (2 * this.goal.dist * Math.tan(MathUtils.degToRad(this.camera.fov / 2))) / this.dom.clientHeight;
      this.panScreen(-dx * worldPerPx, -dy * worldPerPx);
    }
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button === 1) {
      this.drag = { mode: 'pan', x: e.clientX, y: e.clientY };
      e.preventDefault();
    } else if (e.button === 0 && e.altKey) {
      this.drag = { mode: 'rotate', x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  };

  private onPointerUp = (): void => {
    this.drag = null;
  };

  private onPointerLeave = (): void => {
    this.pointer.inside = false;
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const steps = MathUtils.clamp(e.deltaY / 100, -3, 3);
    const before = this.goal.dist;
    this.goal.dist = MathUtils.clamp(
      before * (1 + this.zoomStep) ** steps,
      this.opts.minDistance,
      this.opts.maxDistance,
    );
    // İmlece doğru zoom: yakınlaşırken hedef, imlecin altındaki noktaya kayar.
    if (this.dom && this.goal.dist < before) {
      const nx = e.offsetX / this.dom.clientWidth - 0.5;
      const ny = e.offsetY / this.dom.clientHeight - 0.5;
      const pull = (before - this.goal.dist) * 0.9;
      this.panScreen(nx * pull * this.camera.aspect, ny * pull * 1.4);
    }
  };
}
