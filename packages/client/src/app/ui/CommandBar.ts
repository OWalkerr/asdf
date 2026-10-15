import { richIcon } from './icons';
import { buttonClass, buttonFace, cooldownHtml, cooldownStyle } from './RadialMenu';

/**
 * BFME2 tarzı alt komut çubuğu (GDD §11.1): solda can halkalı madalyon portre, ortada seçimin
 * adı/özeti, sağda iki sıra yuvarlak komut düğmesi; üstte imleçle açılan ipucu kutusu.
 * İçerik bağlamdan (CommandContext) üretilir; DOM yalnızca imza değişince yeniden kurulur.
 */
export interface CommandTip {
  title: string;
  body?: string;
  /** Maliyet / süre satırı (ör. "◆ 250 · 12 sn"). */
  meta?: string;
}

export interface CommandButton {
  icon: string;
  label: string;
  state: 'ready' | 'off' | 'done' | 'busy' | 'locked' | 'active';
  /** Altında gösterilen kısa değer (maliyet, süre, ✓). */
  badge?: string;
  /** Araştırma / bekleme ilerlemesi [0, 1] (halka). */
  progress?: number;
  /** Kalan bekleme / süre (sn): düğmede karanlık dilim + ortada sayaç. */
  cooldown?: number;
  /** Portre (birim/kahraman düğmeleri); yoksa renkli ikon. */
  img?: string;
  tip: CommandTip;
  run?: () => void;
}

export interface CommandContext {
  /** Bağlam anahtarı + değişen değerler: aynıysa DOM dokunulmaz. */
  key: string;
  portrait: string;
  /** Madalyon portresi (render edilmiş birim); yoksa ikon. */
  portraitImg?: string;
  title: string;
  subtitle: string;
  /** Can oranı [0, 1] (madalyon halkası); undefined = halka yok. */
  hp?: number;
  /** Rütbe yıldızları (1–5). */
  rank?: number;
  /** Kahraman seviyesi (1–10): yıldız yerine "Sv N" rozeti ve XP çubuğu. */
  level?: number;
  /** Sonraki seviyeye ilerleme [0, 1]. */
  xp?: number;
  lines?: string[];
  buttons: CommandButton[];
}

const HOTKEYS = ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN'];
const HOTKEY_LABEL = ['Z', 'X', 'C', 'V', 'B', 'N'];

export class CommandBar {
  readonly root: HTMLDivElement;
  private readonly tip: HTMLDivElement;
  private readonly medal: HTMLDivElement;
  private readonly info: HTMLDivElement;
  private readonly grid: HTMLDivElement;
  private ctx: CommandContext | null = null;
  private key = '';
  private hover = -1;
  /** Düğmeye basıldı (arayüz sesi). */
  onClick: (() => void) | null = null;
  /** Dur kısayolu (H) için. */
  stop: (() => void) | null = null;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'cmdbar';
    this.root.innerHTML = `
      <div class="tip"></div>
      <div class="medal"></div>
      <div class="info"></div>
      <div class="grid"></div>`;
    this.tip = this.root.querySelector('.tip') as HTMLDivElement;
    this.medal = this.root.querySelector('.medal') as HTMLDivElement;
    this.info = this.root.querySelector('.info') as HTMLDivElement;
    this.grid = this.root.querySelector('.grid') as HTMLDivElement;
    document.body.appendChild(this.root);
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.grid.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest('[data-i]') as HTMLElement | null;
      if (el) this.press(Number(el.dataset.i));
    });
    this.grid.addEventListener('pointerover', (e) => {
      const el = (e.target as HTMLElement).closest('[data-i]') as HTMLElement | null;
      this.hover = el ? Number(el.dataset.i) : -1;
      this.showTip();
    });
    this.grid.addEventListener('pointerleave', () => {
      this.hover = -1;
      this.showTip();
    });
    window.addEventListener('keydown', (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const i = HOTKEYS.indexOf(e.code);
      if (i >= 0 && this.ctx?.buttons[i]) {
        this.press(i);
        e.preventDefault();
      } else if (e.code === 'KeyH' && this.stop) {
        this.stop();
        e.preventDefault();
      }
    });
  }

  private press(i: number): void {
    const b = this.ctx?.buttons[i];
    if (!b?.run || (b.state !== 'ready' && b.state !== 'active')) return;
    b.run();
    this.onClick?.();
    this.key = '';
  }

  /** DOM'u bir sonraki render'da yeniden kur (ör. portreler hazır olunca). */
  invalidate(): void {
    this.key = '';
  }

  render(ctx: CommandContext): void {
    this.ctx = ctx;
    if (ctx.key === this.key) return;
    this.key = ctx.key;
    const hp = ctx.hp;
    const ring =
      hp === undefined
        ? ''
        : `style="--hp:${Math.max(0, Math.min(1, hp)) * 360}deg;--hpc:${hp > 0.5 ? '#7fd05a' : hp > 0.25 ? '#e8c440' : '#e0442e'}"`;
    this.medal.innerHTML = `<div class="ring ${hp === undefined ? 'none' : ''}" ${ring}></div><div class="face">${ctx.portraitImg ? `<img class="pt" src="${ctx.portraitImg}" alt="">` : richIcon(ctx.portrait)}</div>${
      ctx.level
        ? `<div class="lvl">Sv ${ctx.level}</div>${ctx.xp !== undefined ? `<div class="xpbar"><i style="width:${Math.round(ctx.xp * 100)}%"></i></div>` : ''}`
        : ctx.rank && ctx.rank > 1
          ? `<div class="stars">${'★'.repeat(ctx.rank - 1)}</div>`
          : ''
    }`;
    this.info.innerHTML = `<h3>${ctx.title}</h3><div class="sub">${ctx.subtitle}</div>${(ctx.lines ?? []).map((l) => `<div class="line">${l}</div>`).join('')}`;
    this.grid.innerHTML = Array.from({ length: 12 }, (_, i) => {
      const b = ctx.buttons[i];
      if (!b) return '<span class="slot"></span>';
      const cd = b.cooldown !== undefined && b.cooldown > 0;
      return `<button type="button" class="${buttonClass(b)}" data-i="${i}" aria-label="${b.label}" ${cooldownStyle(b)}>
        ${buttonFace(b)}${b.badge && !cd ? `<small>${b.badge}</small>` : ''}${cooldownHtml(b)}${i < 6 ? `<kbd>${HOTKEY_LABEL[i]}</kbd>` : ''}</button>`;
    }).join('');
    this.showTip();
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
