import { type Camera, Vector3 } from 'three/webgpu';
import type { CommandButton, CommandContext } from './CommandBar';
import { richIcon } from './icons';

/**
 * BFME tarzı halka menü: bir yapıya, inşa yuvasına veya kaleye tıklanınca, seçilenin ekran
 * konumunun etrafında yuvarlak komut düğmeleri açılır (komut çubuğuyla aynı bağlam ve
 * düğmeler). Bekleme/ilerleme sayaçları düğmenin üzerinde saat yönünde açılan karanlık dilim ve
 * ortada kalan saniye olarak görünür. Seçili şey ekrandan çıkarsa halka gizlenir.
 */
export interface RadialAnchor {
  x: number;
  y: number;
  z: number;
}

export const cooldownHtml = (b: Pick<CommandButton, 'cooldown'>): string =>
  b.cooldown !== undefined && b.cooldown > 0 ? `<b class="cdn">${b.cooldown}</b>` : '';

export const cooldownStyle = (b: Pick<CommandButton, 'progress' | 'cooldown'>): string =>
  b.progress !== undefined ? `style="--p:${Math.max(0, Math.min(1, b.progress)) * 360}deg"` : '';

/** Düğme yüzü: portre varsa resim, yoksa renkli ikon. */
export const buttonFace = (b: Pick<CommandButton, 'img' | 'icon'>): string =>
  b.img ? `<img class="pt" src="${b.img}" alt="">` : richIcon(b.icon);

export const buttonClass = (b: CommandButton): string =>
  `cmd ${b.state}${b.progress !== undefined ? ' prog' : ''}${b.cooldown !== undefined && b.cooldown > 0 ? ' cd' : ''}`;

export class RadialMenu {
  private readonly root: HTMLDivElement;
  private readonly ring: HTMLDivElement;
  private readonly plate: HTMLDivElement;
  private readonly tip: HTMLDivElement;
  private ctx: CommandContext | null = null;
  private anchor: RadialAnchor | null = null;
  private key = '';
  private hover = -1;
  private readonly v = new Vector3();
  onClick: (() => void) | null = null;

  constructor(private readonly camera: Camera) {
    this.root = document.createElement('div');
    this.root.id = 'radial';
    this.root.innerHTML = '<div class="ring"></div><div class="plate"></div><div class="tip"></div>';
    this.ring = this.root.querySelector('.ring') as HTMLDivElement;
    this.plate = this.root.querySelector('.plate') as HTMLDivElement;
    this.tip = this.root.querySelector('.tip') as HTMLDivElement;
    document.body.appendChild(this.root);
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.root.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest('[data-i]') as HTMLElement | null;
      if (!el) return;
      const b = this.ctx?.buttons[Number(el.dataset.i)];
      if (!b?.run || (b.state !== 'ready' && b.state !== 'active')) return;
      b.run();
      this.onClick?.();
      this.key = '';
    });
    this.root.addEventListener('pointerover', (e) => {
      const el = (e.target as HTMLElement).closest('[data-i]') as HTMLElement | null;
      this.hover = el ? Number(el.dataset.i) : -1;
      this.showTip();
    });
    this.root.addEventListener('pointerleave', () => {
      this.hover = -1;
      this.showTip();
    });
  }

  invalidate(): void {
    this.key = '';
  }

  /** Bağlamı göster (null = kapat). Konum her karede `place` ile güncellenir. */
  render(ctx: CommandContext | null, anchor: RadialAnchor | null): void {
    this.ctx = ctx;
    this.anchor = anchor;
    if (!ctx || !anchor || ctx.buttons.length === 0) {
      if (this.key !== '') {
        this.root.classList.remove('open');
        this.key = '';
      }
      return;
    }
    if (ctx.key === this.key) return;
    const reopen = this.key === '' || this.key.split(':')[0] !== ctx.key.split(':')[0];
    this.key = ctx.key;
    const n = ctx.buttons.length;
    const r = n <= 4 ? 62 : n <= 7 ? 76 : 92;
    this.ring.style.setProperty('--r', `${r}px`);
    this.ring.innerHTML = ctx.buttons
      .map((b, i) => {
        return `<button type="button" class="${buttonClass(b)}" data-i="${i}" aria-label="${b.label}" ${cooldownStyle(b)}
          >${buttonFace(b)}${
            b.badge && !(b.cooldown && b.cooldown > 0) ? `<small>${b.badge}</small>` : ''
          }${cooldownHtml(b)}</button>`;
      })
      .join('');
    // Düğmeler halka üzerinde, saat 12'den saat yönünde.
    this.ring.querySelectorAll<HTMLButtonElement>('button').forEach((el, i) => {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      el.style.left = `${(Math.cos(a) * r).toFixed(1)}px`;
      el.style.top = `${(Math.sin(a) * r).toFixed(1)}px`;
      el.style.transitionDelay = `${i * 18}ms`;
    });
    this.plate.innerHTML = `<b>${ctx.title}</b>${ctx.subtitle ? `<span>${ctx.subtitle}</span>` : ''}`;
    this.plate.style.top = `${r + 34}px`;
    this.tip.style.top = `${r + 64}px`;
    if (reopen) {
      this.root.classList.remove('open');
      void this.root.offsetWidth;
    }
    this.root.classList.add('open');
    this.showTip();
  }

  /** Her karede: halkayı seçilenin ekran konumuna taşı. */
  place(width: number, height: number): void {
    if (!this.anchor || this.key === '') return;
    this.v.set(this.anchor.x, this.anchor.y, this.anchor.z).project(this.camera);
    const off = this.v.z > 1 || Math.abs(this.v.x) > 1.1 || Math.abs(this.v.y) > 1.1;
    this.root.classList.toggle('away', off);
    const x = ((this.v.x + 1) / 2) * width;
    const y = ((1 - this.v.y) / 2) * height;
    this.root.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }

  private showTip(): void {
    const b = this.hover >= 0 ? this.ctx?.buttons[this.hover] : undefined;
    if (!b) {
      this.tip.classList.remove('show');
      return;
    }
    this.tip.innerHTML = `<b>${b.tip.title}</b>${b.tip.meta ? `<em>${b.tip.meta}</em>` : ''}${b.tip.body ? `<p>${b.tip.body}</p>` : ''}`;
    this.tip.classList.add('show');
  }
}
