import {
  COMMAND_POINTS,
  ECONOMY,
  factionDef,
  HERO,
  type HeroDef,
  type MapDef,
  type MatchInfo,
  MatchState,
  UNIT_DEFS,
} from '@bulwark/shared';
import type { RTSCamera } from '../../render/camera/RTSCamera';
import type { StructureRenderer } from '../../render/structures/StructureRenderer';
import type { UnitRenderer } from '../../render/units/UnitRenderer';
import { SIM_TICK_MS } from '../../sim-host/protocol';
import { roster } from '../cah';
import type { Scenario } from '../scenario';
import { icon, richIcon } from './icons';

/**
 * Üst arayüz (GDD §11.1, BFME2 düzeni):
 *   sol üst  — kahraman portreleri (Aragorn F, Gandalf G, Legolas J: çağır / seç / yeniden
 *              canlanma sayacı) ve kale düğmesi (K)
 *   üst orta — dalga, geri sayım; FD: kale canı + kapı kalkanları, TD: kalan can
 *   sağ üst  — kaynaklar (altın, gelir, ordu)
 */
const fmt = (ticks: number) => {
  const s = Math.max(0, Math.ceil((ticks * SIM_TICK_MS) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export interface TopHudDeps {
  def: MapDef;
  /** FACTIONS indeksi (kahraman kadrosu). */
  faction: number;
  scenario: Scenario;
  units: UnitRenderer;
  structures: StructureRenderer | null;
  cam: RTSCamera;
  selectHero: (hero: number) => void;
  selectFortress: () => void;
  onClick?: () => void;
  /** Render edilmiş kahraman portreleri (yoksa ikon). */
  portrait?: (unitType: number) => string | undefined;
}

export class TopHud {
  private readonly heroes: HTMLDivElement;
  private readonly heroBtns: HTMLButtonElement[] = [];
  private readonly heroDefs: readonly HeroDef[];
  private readonly fortBtn: HTMLButtonElement;
  private readonly status: HTMLDivElement;
  private readonly res: HTMLDivElement;
  private match: MatchInfo | null = null;
  private tick = 0;
  private heroPos: ({ x: number; z: number } | null)[] = [];

  constructor(private readonly d: TopHudDeps) {
    this.heroDefs = roster(d.faction);
    this.heroes = document.createElement('div');
    this.heroes.id = 'heroes';
    this.heroes.innerHTML = `${this.heroDefs.map(() => '<button type="button" class="portrait hero"></button>').join('')}<button type="button" class="portrait fort"></button>`;
    this.heroes.querySelectorAll<HTMLButtonElement>('.hero').forEach((b, k) => {
      this.heroBtns.push(b);
      b.addEventListener('click', () => this.heroAction(k));
    });
    this.fortBtn = this.heroes.querySelector('.fort') as HTMLButtonElement;
    this.fortBtn.addEventListener('click', () => this.fortAction());
    this.heroes.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.status = document.createElement('div');
    this.status.id = 'status';
    this.res = document.createElement('div');
    this.res.id = 'resources';
    document.body.append(this.heroes, this.status, this.res);
    window.addEventListener('keydown', (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = this.heroDefs.findIndex((h) => h.key === e.code);
      if (k >= 0) this.heroAction(k);
      if (e.code === 'KeyK') this.fortAction();
    });
  }

  private heroAction(k: number): void {
    const m = this.match;
    const def = this.heroDefs[k];
    if (!m || !def || m.state !== MatchState.Playing) return;
    const b = m.heroes[k] ?? 0;
    if (b !== 0) {
      this.d.selectHero(b);
      const p = this.heroPos[k];
      if (p) this.d.cam.lookAt(p.x, p.z);
      this.d.onClick?.();
      return;
    }
    const cost = UNIT_DEFS[def.unitType]?.cost ?? 0;
    if (this.tick >= (m.heroReady[k] ?? 0) && m.gold >= cost) {
      this.d.scenario.summonHero(def.unitType);
      this.d.onClick?.();
    }
  }

  private fortAction(): void {
    this.d.selectFortress();
    const c = this.d.def.citadel;
    this.d.cam.lookAt(c.pos[0], c.pos[1] + 12);
    this.d.onClick?.();
  }

  update(m: MatchInfo, tick: number): void {
    this.match = m;
    this.tick = tick;
    // Kahraman portreleri
    this.heroDefs.forEach((def, k) => {
      const btn = this.heroBtns[k] as HTMLButtonElement;
      const b = m.heroes[k] ?? 0;
      const ready = m.heroReady[k] ?? 0;
      const name = UNIT_DEFS[def.unitType]?.name ?? '';
      let hp = 1;
      let rank = 1;
      this.heroPos[k] = null;
      if (b !== 0)
        this.d.units.forEach((x, _y, z, ub, _t, h, _type, r) => {
          if (ub === b) {
            this.heroPos[k] = { x, z };
            hp = h;
            rank = r;
          }
        });
      const cost = UNIT_DEFS[def.unitType]?.cost ?? 0;
      const left = b === 0 && tick < ready ? ready - tick : 0;
      const wait = left > 0 ? fmt(left) : '';
      const state = b !== 0 ? 'alive' : wait ? 'dead' : m.gold >= cost ? 'ready' : 'off';
      const key = def.key.slice(3);
      const pic = this.d.portrait?.(def.unitType);
      const face = pic ? `<img class="pt" src="${pic}" alt="">` : richIcon(def.icon);
      const html = `<span class="ring" style="--hp:${(b ? hp : 0) * 360}deg"></span>${face}<small>${
        b ? `Sv ${rank}` : wait ? 'Düştü' : `◆${cost}`
      }</small>${wait ? `<b class="cdn">${Math.ceil((left * SIM_TICK_MS) / 1000)}</b>` : ''}<kbd>${key}</kbd>`;
      btn.style.setProperty('--p', `${wait ? (1 - left / (HERO.reviveTime * 20)) * 360 : 360}deg`);
      if (btn.innerHTML !== html) btn.innerHTML = html;
      btn.dataset.state = state;
      btn.title =
        b !== 0
          ? `${name} — seç ve kamerayı getir (${key})`
          : wait
            ? `${name} düştü — ${wait} sonra yeniden çağrılabilir`
            : `${name} — çağır (${key}) · ◆${cost}. Kalenin kapısından çıkar.`;
    });
    const fs = this.d.structures?.fortress;
    const fhp = fs ? fs.hp / Math.max(1, fs.max) : 1;
    const fortHtml = `<span class="ring" style="--hp:${fhp * 360}deg"></span>${richIcon('castle')}<small>${
      m.fortResearch >= 0 ? `%${Math.round(m.fortPct * 100)}` : 'Kale'
    }</small><kbd>K</kbd>`;
    if (this.fortBtn.innerHTML !== fortHtml) this.fortBtn.innerHTML = fortHtml;
    this.fortBtn.title = `${this.d.def.citadel.name ?? 'Kale'} — yükseltmeler, kahraman, kapı onarımı (K)`;

    // Üst orta durum
    const def = this.d.def;
    const name = m.waveIndex > 0 ? def.waves[m.waveIndex - 1]?.name : undefined;
    const next = m.nextWaveTick >= 0 ? fmt(m.nextWaveTick - tick) : '';
    const wave =
      m.waveIndex === 0
        ? `<b>Hazırlık</b><span>İlk dalga ${next}</span>`
        : `<b>Dalga ${m.waveIndex} / ${m.waveCount}</b><span>${name ?? ''}${next ? ` · sonraki ${next}` : ''}</span>`;
    let defense = '';
    if (def.mode === 'TD') {
      defense = `<div class="lives">${icon('heart')}<b>${m.lives}</b><span>can</span>${
        m.zone > 0 ? `<em class="zone" title="Uç bölgede bekleyen düşman taburu">⚠ ${m.zone}</em>` : ''
      }</div>`;
    } else {
      const gates = m.gateHp
        .map((g, i) => {
          const r = g / Math.max(1, m.gateMax[i] ?? 1);
          const c = r <= 0 ? 'down' : r < 0.35 ? 'low' : r < 0.7 ? 'mid' : 'ok';
          return `<i class="gate ${c}" title="${def.gates[i]?.name ?? 'Kapı'}: ${g} / ${m.gateMax[i]}">${icon('armor')}</i>`;
        })
        .join('');
      defense = `<div class="fort"><span class="bar"><i style="width:${fhp * 100}%"></i></span><em>${def.citadel.name ?? 'Kale'}</em></div><div class="gates">${gates}</div>`;
    }
    const st = `<div class="wave">${wave}<span class="foes">${icon('army')} ${m.enemiesAlive}</span></div>${defense}`;
    if (this.status.innerHTML !== st) this.status.innerHTML = st;

    // Kaynaklar
    let army = 0;
    const seen = new Set<number>();
    this.d.units.forEach((_x, _y, _z, b, t) => {
      if (t === 0 && b !== 0 && !seen.has(b)) {
        seen.add(b);
        army++;
      }
    });
    const income = ECONOMY.income + ((m.fortUp & (1 << 4)) !== 0 ? 4 : 0);
    const res = `<div>${icon('coin')}<b>${m.gold}</b><span>+${income}/sn</span></div><div>${icon('power')}<b>${(m.pp / 10).toFixed(1)}</b><span>güç</span></div><div title="Komuta puanı (${army} tabur). Tavan çiftliklerle yükselir, en fazla ${COMMAND_POINTS.max}." class="${m.cpUsed >= m.cpCap ? 'cpfull' : ''}">${icon('army')}<b>${m.cpUsed}/${m.cpCap}</b><span>komuta</span></div>`;
    if (this.res.innerHTML !== res) this.res.innerHTML = res;
  }
}
