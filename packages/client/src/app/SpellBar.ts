import { type MatchInfo, MatchState, SPELL_DEFS, UNIT_DEFS, UnitTypeId } from '@bulwark/shared';
import type { PlayerInput } from '../input/PlayerInput';
import type { Selection } from '../input/Selection';
import type { RTSCamera } from '../render/camera/RTSCamera';
import type { SpellFx } from '../render/fx/SpellFx';
import type { UnitRenderer } from '../render/units/UnitRenderer';
import { SIM_TICK_MS } from '../sim-host/protocol';
import type { Scenario } from './scenario';

/**
 * Kahraman + Spellbook çubuğu (GDD §8, §9, §11.1): komut panelinin üstünde.
 *   F      → Aragorn'u çağır / seç ve kameraya getir
 *   1–6    → büyüyü aç (PP) veya kullan; hedefli büyülerde zeminde nokta seçilir
 */
const SPELL_ICON: Record<string, string> = {
  heal: '<path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z" fill="currentColor"/>',
  rally: '<path d="M5 2h2v20H5zM8 3h11l-3 4 3 4H8z" fill="currentColor"/>',
  elven_allies:
    '<path d="M12 2c3 4 6 8 6 12a6 6 0 0 1-12 0c0-4 3-8 6-12zm0 5c-1.5 2.5-3 5-3 7a3 3 0 0 0 6 0c0-2-1.5-4.5-3-7z" fill="currentColor"/>',
  rohirrim:
    '<path d="M4 20l3-7 2-1 1-4 4-3 3 1 3 4-2 1-2-2-2 3 1 3-2 1v4h-2v-4l-3-1-2 5z" fill="currentColor"/>',
  army_of_dead:
    '<path d="M12 2a7 7 0 0 0-7 7v11l2-2 2 2 2-2 2 2 2-2 2 2 2-2V9a7 7 0 0 0-7-7zM9 8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" fill="currentColor"/>',
  arrow_volley:
    '<path d="M3 21l7-7M7 21l7-7M11 21l7-7" stroke="currentColor" stroke-width="2"/><path d="M10 14l1-5 4 3zM14 14l1-5 4 3zM18 14l1-5 4 3z" fill="currentColor"/>',
};
const HERO_ICON = '<path d="M12 2l2 3h-4zM11 5h2v9h-2zM8 14h8v2h-3v6h-2v-6H8z" fill="currentColor"/>';
const svg = (p: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const secs = (ticks: number) => Math.max(0, Math.ceil((ticks * SIM_TICK_MS) / 1000));

interface HeroInfo {
  x: number;
  z: number;
  hp: number;
  rank: number;
}

export interface SpellBarDeps {
  scenario: Scenario;
  input: PlayerInput;
  fx: SpellFx;
  cam: RTSCamera;
  selection: Selection;
  units: UnitRenderer;
  groundY: (x: number, z: number) => number;
  onClick?: () => void;
}

export class SpellBar {
  private readonly root: HTMLDivElement;
  private readonly ppEl: HTMLDivElement;
  private readonly heroBtn: HTMLButtonElement;
  private readonly spellBtns: HTMLButtonElement[] = [];
  private match: MatchInfo | null = null;
  private tick = 0;
  private heroPos: HeroInfo | null = null;

  constructor(private readonly d: SpellBarDeps) {
    this.root = document.createElement('div');
    this.root.id = 'spellbar';
    this.heroBtn = document.createElement('button');
    this.heroBtn.type = 'button';
    this.heroBtn.className = 'hero';
    this.heroBtn.addEventListener('click', () => this.heroAction());
    this.root.appendChild(this.heroBtn);
    SPELL_DEFS.forEach((def, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'spell';
      b.title = `${def.name} — ${def.desc} (Kademe ${def.tier}, ${def.cost} PP, bekleme ${def.cooldown} sn)`;
      b.addEventListener('click', () => this.spellAction(i));
      this.root.appendChild(b);
      this.spellBtns.push(b);
    });
    this.ppEl = document.createElement('div');
    this.ppEl.className = 'pp';
    this.root.appendChild(this.ppEl);
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
    document.body.appendChild(this.root);
    window.addEventListener('keydown', (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'KeyF') this.heroAction();
      const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].indexOf(e.code);
      if (i >= 0) this.spellAction(i);
    });
  }

  private heroAction(): void {
    const m = this.match;
    if (!m || m.state !== MatchState.Playing) return;
    if (m.hero !== 0) {
      this.d.selection.click(m.hero, false);
      if (this.heroPos) this.d.cam.lookAt(this.heroPos.x, this.heroPos.z);
      this.d.onClick?.();
      return;
    }
    const cost = UNIT_DEFS[UnitTypeId.Aragorn]?.cost ?? 0;
    if (this.tick >= m.heroReady && m.gold >= cost) {
      this.d.scenario.summonHero(UnitTypeId.Aragorn);
      this.d.onClick?.();
    }
  }

  private spellAction(i: number): void {
    const m = this.match;
    const def = SPELL_DEFS[i];
    if (!m || !def || m.state !== MatchState.Playing) return;
    const unlocked = (m.spells & (1 << i)) !== 0;
    if (!unlocked) {
      if (this.canUnlock(i)) {
        this.d.scenario.unlockSpell(i);
        this.d.onClick?.();
      }
      return;
    }
    if (this.tick < (m.spellReady[i] ?? 0)) return;
    this.d.onClick?.();
    if (def.radius > 0) {
      this.d.input.beginTargeting({
        radius: def.radius,
        onPick: (x, z) => {
          this.d.scenario.castSpell(i, x, z);
          const color: Record<string, string> = {
            heal: '#7dffa0',
            arrow_volley: '#ffd27a',
            elven_allies: '#bff5d0',
            rohirrim: '#ffe08a',
            army_of_dead: '#5dffa8',
          };
          this.d.fx.pulse(x, this.d.groundY(x, z), z, def.radius, color[def.key] ?? '#ffd27a');
        },
      });
    } else {
      this.d.scenario.castSpell(i, 0, 0);
      const t = this.d.cam.target;
      this.d.fx.pulse(t.x, this.d.groundY(t.x, t.z), t.z, 45, '#ffcf5a', 1.6);
    }
  }

  private canUnlock(i: number): boolean {
    const m = this.match;
    const def = SPELL_DEFS[i];
    if (!m || !def || m.spells & (1 << i)) return false;
    const tierOk =
      def.tier === 1 || SPELL_DEFS.some((s, k) => s.tier === def.tier - 1 && m.spells & (1 << k));
    return tierOk && m.pp >= def.cost * 10;
  }

  update(match: MatchInfo, tick: number): void {
    // Komut panelinin hemen üstünde dur (panel içeriğe göre uzar).
    const panelH = document.getElementById('cmdpanel')?.offsetHeight ?? 110;
    const bottom = `${panelH + 22}px`;
    if (this.root.style.bottom !== bottom) this.root.style.bottom = bottom;
    this.match = match;
    this.tick = tick;
    // Kahramanın konumu/canı (çizilen birimlerden).
    this.heroPos = null;
    if (match.hero !== 0) {
      this.d.units.forEach((x, _y, z, b, _t, hp, _type, rank) => {
        if (b === match.hero) this.heroPos = { x, z, hp, rank };
      });
    }
    const cost = UNIT_DEFS[UnitTypeId.Aragorn]?.cost ?? 0;
    let html: string;
    let off = false;
    const info = this.heroPos as HeroInfo | null;
    if (match.hero !== 0) {
      const hp = Math.round((info?.hp ?? 1) * 100);
      html = `${svg(HERO_ICON)}<span><b>Aragorn</b><small>Rütbe ${info?.rank ?? 1} · %${hp}</small></span><kbd>F</kbd>`;
    } else if (tick < match.heroReady) {
      html = `${svg(HERO_ICON)}<span><b>Aragorn</b><small>${secs(match.heroReady - tick)} sn</small></span><kbd>F</kbd>`;
      off = true;
    } else {
      html = `${svg(HERO_ICON)}<span><b>Aragorn</b><small>Çağır ◆${cost}</small></span><kbd>F</kbd>`;
      off = match.gold < cost;
    }
    if (this.heroBtn.innerHTML !== html) this.heroBtn.innerHTML = html;
    this.heroBtn.classList.toggle('off', off);
    this.heroBtn.classList.toggle('alive', match.hero !== 0);
    this.heroBtn.title =
      "Aragorn — liderlik: 20 m içindeki taburlara +%25 hasar. Yetenekler: Elendil'in Kılıcı, Athelas (rütbe 3). Ölürse 45 sn sonra yeniden çağrılabilir.";

    SPELL_DEFS.forEach((def, i) => {
      const b = this.spellBtns[i] as HTMLButtonElement;
      const unlocked = (match.spells & (1 << i)) !== 0;
      const cd = unlocked ? secs((match.spellReady[i] ?? 0) - tick) : 0;
      const rallyOn = def.key === 'rally' && match.rallyUntil > tick;
      const state = !unlocked ? (this.canUnlock(i) ? 'open' : 'locked') : cd > 0 ? 'cd' : 'ready';
      const label = !unlocked ? `${def.cost} PP` : cd > 0 ? `${cd} sn` : 'hazır';
      const h = `${svg(SPELL_ICON[def.key] ?? '')}<small>${label}</small><kbd>${i + 1}</kbd>`;
      if (b.innerHTML !== h) b.innerHTML = h;
      b.dataset.state = state;
      b.classList.toggle('active', rallyOn);
    });
    const ppTxt = `<b>${(match.pp / 10).toFixed(1)}</b><span>Güç Puanı</span>`;
    if (this.ppEl.innerHTML !== ppTxt) this.ppEl.innerHTML = ppTxt;
  }
}
