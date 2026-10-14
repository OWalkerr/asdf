import type { SimHost } from '../../sim-host/SimHost';

/**
 * Oyun hızı (tek oyunculu): duraklat / 1× / 2× / 3×. Kısayollar: P duraklat-devam, + / − hız.
 * Uzun haritalarda (Kule Savaşı 30 dalga) dalga aralarını hızlandırmak için.
 */
const SPEEDS = [1, 2, 3] as const;

export class SpeedControl {
  private readonly root: HTMLDivElement;
  private readonly veil: HTMLDivElement;
  private speed = 1;
  private paused = false;
  onClick: (() => void) | null = null;

  constructor(private readonly sim: SimHost) {
    this.root = document.createElement('div');
    this.root.id = 'speed';
    this.root.innerHTML = `<button type="button" data-s="0" title="Duraklat (P)">❚❚</button>${SPEEDS.map(
      (s) => `<button type="button" data-s="${s}" title="Hız ${s}× (+ / −)">${s}×</button>`,
    ).join('')}`;
    this.veil = document.createElement('div');
    this.veil.id = 'pauseveil';
    this.veil.innerHTML = '<b>Duraklatıldı</b><span>Devam için P</span>';
    document.body.append(this.root, this.veil);
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.root.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest('[data-s]') as HTMLElement | null;
      if (!el) return;
      const s = Number(el.dataset.s);
      if (s === 0) this.togglePause();
      else this.set(s, false);
      this.onClick?.();
    });
    window.addEventListener('keydown', (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'KeyP' || e.code === 'Pause') this.togglePause();
      else if (e.code === 'Equal' || e.code === 'NumpadAdd') this.set(Math.min(3, this.speed + 1), false);
      else if (e.code === 'Minus' || e.code === 'NumpadSubtract')
        this.set(Math.max(1, this.speed - 1), false);
    });
    this.render();
  }

  private togglePause(): void {
    this.paused = !this.paused;
    this.sim.setSpeed(this.paused ? 0 : this.speed);
    this.render();
  }

  private set(s: number, paused: boolean): void {
    this.speed = s;
    this.paused = paused;
    this.sim.setSpeed(paused ? 0 : s);
    this.render();
  }

  private render(): void {
    this.root.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
      const s = Number(b.dataset.s);
      b.classList.toggle('on', s === 0 ? this.paused : !this.paused && s === this.speed);
    });
    this.veil.classList.toggle('show', this.paused);
  }
}
