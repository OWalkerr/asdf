import type { Scenario } from '../app/scenario';
import type { RTSCamera } from '../render/camera/RTSCamera';
import type { OrderMarker } from '../render/fx/OrderMarker';
import type { PickCursor } from '../render/fx/PickCursor';
import type { SlotMarkers } from '../render/map/SlotMarkers';
import type { GroundPicker } from './GroundPicker';
import type { Selection } from './Selection';

/**
 * Oyuncu fare girdisi (GDD §11.2, BFME2 varsayılanları):
 *   Sol tık        → tabur seç (Shift: ekle/çıkar); asker yoksa inşa slotu seç; boşsa seçimi temizle
 *   Sol sürükle    → kutu seçimi (Shift: ekle)
 *   Sağ tık        → seçili taburlara hareket emri
 *   Esc            → seçimi temizle
 * Alt + sol sürükle ve orta tuş kameraya aittir (RTSCamera).
 */
const DRAG_THRESHOLD_PX = 6;

export interface PlayerInputDeps {
  canvas: HTMLCanvasElement;
  selBox: HTMLDivElement;
  cam: RTSCamera;
  picker: GroundPicker;
  selection: Selection;
  scenario: Scenario;
  cursor: PickCursor;
  marker: OrderMarker;
  slots?: SlotMarkers | undefined;
}

export class PlayerInput {
  hoverText = '—';
  private pointer = { x: 0, y: 0, inside: false };
  private drag: { x0: number; y0: number; active: boolean } | null = null;

  constructor(private readonly d: PlayerInputDeps) {
    const { canvas } = d;
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerleave', this.onLeave);
    canvas.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') d.selection.click(0, false);
    });
  }

  private get size() {
    return { w: this.d.canvas.clientWidth, h: this.d.canvas.clientHeight };
  }

  /** Her karede: imleç altındaki zemin/slot (kamera hareket edince de değişir). */
  update(): void {
    const { picker, cam, cursor, slots } = this.d;
    if (!this.pointer.inside) return;
    const { w, h } = this.size;
    const hit = picker.pick(cam.camera, this.pointer.x, this.pointer.y, w, h);
    if (!hit) {
      cursor.hide();
      slots?.setHovered(-1);
      this.hoverText = '—';
      return;
    }
    const slot = slots ? slots.nearest(hit.point.x, hit.point.y, hit.point.z) : -1;
    slots?.setHovered(slot);
    cursor.show(hit.point, hit.normal, slot >= 0 ? 0.6 : 1);
    const p = hit.point;
    this.hoverText = `(${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})`;
  }

  private onMove = (e: PointerEvent): void => {
    this.pointer.x = e.offsetX;
    this.pointer.y = e.offsetY;
    this.pointer.inside = true;
    const drag = this.drag;
    if (!drag) return;
    if (!drag.active && Math.hypot(e.offsetX - drag.x0, e.offsetY - drag.y0) > DRAG_THRESHOLD_PX)
      drag.active = true;
    if (drag.active) {
      const box = this.d.selBox.style;
      box.display = 'block';
      box.left = `${Math.min(drag.x0, e.offsetX)}px`;
      box.top = `${Math.min(drag.y0, e.offsetY)}px`;
      box.width = `${Math.abs(e.offsetX - drag.x0)}px`;
      box.height = `${Math.abs(e.offsetY - drag.y0)}px`;
    }
  };

  private onLeave = (): void => {
    this.pointer.inside = false;
    this.d.cursor.hide();
    this.d.slots?.setHovered(-1);
  };

  private onDown = (e: PointerEvent): void => {
    if (e.button === 2) {
      this.order(e.offsetX, e.offsetY);
      return;
    }
    if (e.button === 0 && !e.altKey) this.drag = { x0: e.offsetX, y0: e.offsetY, active: false };
  };

  private onUp = (e: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || e.button !== 0) return;
    this.drag = null;
    this.d.selBox.style.display = 'none';
    const { cam, selection, picker, slots } = this.d;
    const { w, h } = this.size;
    const x = e.clientX - this.d.canvas.getBoundingClientRect().left;
    const y = e.clientY - this.d.canvas.getBoundingClientRect().top;
    if (drag.active) {
      selection.box(cam.camera, { x0: drag.x0, y0: drag.y0, x1: x, y1: y }, w, h, e.shiftKey);
      slots?.setSelected(-1);
      return;
    }
    const battalion = selection.pick(cam.camera, x, y, w, h);
    if (battalion !== 0) {
      selection.click(battalion, e.shiftKey);
      slots?.setSelected(-1);
      return;
    }
    const hit = picker.pick(cam.camera, x, y, w, h);
    const slot = hit && slots ? slots.nearest(hit.point.x, hit.point.y, hit.point.z) : -1;
    slots?.setSelected(slot);
    if (!e.shiftKey) selection.click(0, false);
  };

  private order(sx: number, sy: number): void {
    const { selection, picker, cam, scenario, marker } = this.d;
    if (selection.selected.size === 0) return;
    const { w, h } = this.size;
    const hit = picker.pick(cam.camera, sx, sy, w, h);
    if (!hit) return;
    scenario.order(selection.selected, hit.point.x, hit.point.z);
    marker.show(hit.point, performance.now());
  }
}
