import { factionDef, type MatchInfo, MatchState, SPELL_DEFS, type SpellDef } from '@bulwark/shared';
import type { PlayerInput } from '../../input/PlayerInput';
import type { RTSCamera } from '../../render/camera/RTSCamera';
import type { SpellFx } from '../../render/fx/SpellFx';
import type { SpellShow } from '../../render/fx/SpellShow';
import { SIM_TICK_MS } from '../../sim-host/protocol';
import type { Scenario } from '../scenario';
import { icon, richIcon } from './icons';

/**
 * Güçler (Spellbook, GDD §9) — ekranın solunda dikey sütun: kademe başlıkları (I–IV), yuvarlak
 * güç düğmeleri, bekleme halkası, kilit ve PP maliyeti. 1–9, 0 kısayolları; açık güce basınca
 * hedefli güçlerde zeminde halka belirir.
 */
const SPELL_ICON: Record<string, string> = {
  heal: 'heal',
  rally: 'rally',
  arrow_volley: 'volley',
  elven_allies: 'leaf',
  rohirrim: 'horse',
  army_of_dead: 'ghost',
  sun_flare: 'sun',
  earthquake: 'quake',
  eagles: 'eagle',
  flood: 'wave',
};
const ROMAN = ['', 'I', 'II', 'III', 'IV'];
const PULSE: Record<string, string> = {
  heal: '#7dffa0',
  arrow_volley: '#ffd27a',
  elven_allies: '#bff5d0',
  rohirrim: '#ffe08a',
  army_of_dead: '#5dffa8',
  sun_flare: '#fff0a0',
  earthquake: '#c8a070',
  eagles: '#ffe0a0',
  flood: '#8fd0ff',
};
const KEYS = [
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Digit6',
  'Digit7',
  'Digit8',
  'Digit9',
  'Digit0',
];

export interface PowersDeps {
  /** FACTIONS indeksi: tarafa özgü güç adları ve ikonları (Isengard). */
  faction?: number;
  scenario: Scenario;
  input: PlayerInput;
  fx: SpellFx;
  /** Büyük güç gösterileri (kartallar, sel, deprem, güneş). */
  show?: SpellShow;
  cam: RTSCamera;
  groundY: (x: number, z: number) => number;
  onClick?: () => void;
}

/** Tarafa göre güç adı/açıklama/ikon (etki aynı). */
const spellView = (faction: number, def: SpellDef) => {
  const o = factionDef(faction).spells?.[def.key];
  return {
    name: o?.name ?? def.name,
    desc: o?.desc ?? def.desc,
    icon: o?.icon ?? SPELL_ICON[def.key] ?? 'power',
  };
};

export class PowersColumn {
  private readonly root: HTMLDivElement;
  private readonly pp: HTMLDivElement;
  private readonly btns: HTMLButtonElement[] = [];
  private readonly tip: HTMLDivElement;
  private match: MatchInfo | null = null;
  private tick = 0;

  constructor(private readonly d: PowersDeps) {
    this.root = document.createElement('div');
    this.root.id = 'powers';
    this.root.innerHTML =
      '<div class="head"><span>Güçler</span><div class="pp"></div></div><div class="list"></div><div class="tip"></div>';
    this.pp = this.root.querySelector('.pp') as HTMLDivElement;
    this.tip = this.root.querySelector('.tip') as HTMLDivElement;
    const list = this.root.querySelector('.list') as HTMLDivElement;
    let tier = 0;
    SPELL_DEFS.forEach((def, i) => {
      if (def.tier !== tier) {
        tier = def.tier;
        const t = document.createElement('div');
        t.className = 'tier';
        t.textContent = ROMAN[tier] ?? `${tier}`;
        list.appendChild(t);
      }
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'power';
      b.addEventListener('click', () => this.action(i));
      b.addEventListener('pointerenter', () => this.showTip(i, b));
      b.addEventListener('pointerleave', () => this.tip.classList.remove('show'));
      list.appendChild(b);
      this.btns.push(b);
    });
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
    document.body.appendChild(this.root);
    window.addEventListener('keydown', (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement) return;
      const i = KEYS.indexOf(e.code);
      if (i >= 0) this.action(i);
    });
  }

  private showTip(i: number, el: HTMLElement): void {
    const def = SPELL_DEFS[i];
    if (!def) return;
    const unlocked = ((this.match?.spells ?? 0) & (1 << i)) !== 0;
    const view = spellView(this.d.faction ?? 0, def);
    this.tip.innerHTML = `<b>${view.name}</b><em>Kademe ${ROMAN[def.tier]} · ${unlocked ? `bekleme ${def.cooldown} sn` : `açmak için ${def.cost} PP`}</em><p>${view.desc}</p>`;
    this.tip.style.top = `${el.offsetTop}px`;
    this.tip.classList.add('show');
  }

  /** Kilitli güce tıklandı ama açılamıyor: nedenini kısa süre göster. */
  private explain(i: number): void {
    const m = this.match;
    const def = SPELL_DEFS[i];
    const btn = this.btns[i];
    if (!m || !def || !btn) return;
    const tierOk =
      def.tier === 1 || SPELL_DEFS.some((s, k) => s.tier === def.tier - 1 && m.spells & (1 << k));
    const need = def.cost - m.pp / 10;
    this.tip.innerHTML = `<b>${spellView(this.d.faction ?? 0, def).name} kilitli</b><p>${
      !tierOk
        ? `Önce ${ROMAN[def.tier - 1]}. kademeden bir güç aç.`
        : `${need.toFixed(1)} Güç Puanı daha gerekli. Güç Puanı düşman öldürerek ve her dalga başında kazanılır.`
    }</p>`;
    this.tip.style.top = `${btn.offsetTop}px`;
    this.tip.classList.add('show');
    btn.classList.remove('deny');
    void btn.offsetWidth;
    btn.classList.add('deny');
    window.setTimeout(() => this.tip.classList.remove('show'), 2600);
  }

  private canUnlock(i: number): boolean {
    const m = this.match;
    const def = SPELL_DEFS[i];
    if (!m || !def || m.spells & (1 << i)) return false;
    const tierOk =
      def.tier === 1 || SPELL_DEFS.some((s, k) => s.tier === def.tier - 1 && m.spells & (1 << k));
    return tierOk && m.pp >= def.cost * 10;
  }

  private action(i: number): void {
    const m = this.match;
    const def = SPELL_DEFS[i];
    if (!m || !def || m.state !== MatchState.Playing) return;
    if (!(m.spells & (1 << i))) {
      if (this.canUnlock(i)) {
        this.d.scenario.unlockSpell(i);
        this.d.onClick?.();
      } else this.explain(i);
      return;
    }
    if (this.tick < (m.spellReady[i] ?? 0)) return;
    this.d.onClick?.();
    if (def.radius > 0) {
      this.d.input.beginTargeting({
        radius: def.radius,
        onPick: (x, z) => {
          this.d.scenario.castSpell(i, x, z);
          const y = this.d.groundY(x, z);
          this.d.fx.pulse(x, y, z, def.radius, PULSE[def.key] ?? '#ffd27a');
          this.d.show?.cast(def.key, x, y, z, def.radius);
        },
      });
    } else {
      this.d.scenario.castSpell(i, 0, 0);
      const t = this.d.cam.target;
      this.d.fx.pulse(t.x, this.d.groundY(t.x, t.z), t.z, 45, '#ffcf5a', 1.6);
    }
  }

  update(match: MatchInfo, tick: number): void {
    this.match = match;
    this.tick = tick;
    const ppTxt = `${icon('power')}<b>${(match.pp / 10).toFixed(1)}</b>`;
    if (this.pp.innerHTML !== ppTxt) this.pp.innerHTML = ppTxt;
    SPELL_DEFS.forEach((def, i) => {
      const b = this.btns[i] as HTMLButtonElement;
      const unlocked = (match.spells & (1 << i)) !== 0;
      const left = unlocked ? Math.max(0, (match.spellReady[i] ?? 0) - tick) : 0;
      const cd = Math.ceil((left * SIM_TICK_MS) / 1000);
      const state = !unlocked ? (this.canUnlock(i) ? 'open' : 'locked') : cd > 0 ? 'cd' : 'ready';
      const prog = cd > 0 ? 1 - left / (def.cooldown * 20) : 1;
      const label = !unlocked ? `${def.cost}` : '';
      const h = `${richIcon(spellView(this.d.faction ?? 0, def).icon)}${!unlocked ? `<i class="lock">${icon('lock')}</i>` : ''}${label ? `<small>${label}</small>` : ''}${cd > 0 ? `<b class="cdn">${cd}</b>` : ''}<kbd>${(i + 1) % 10}</kbd>`;
      if (b.innerHTML !== h) b.innerHTML = h;
      b.dataset.state = state;
      b.style.setProperty('--p', `${prog * 360}deg`);
      b.classList.toggle('active', def.key === 'rally' && match.rallyUntil > tick);
    });
  }
}
