import {
  ECONOMY,
  HERO,
  type MapDef,
  type MatchInfo,
  MatchState,
  UNIT_DEFS,
  UnitTypeId,
} from '@bulwark/shared';
import type { RTSCamera } from '../../render/camera/RTSCamera';
import type { StructureRenderer } from '../../render/structures/StructureRenderer';
import type { UnitRenderer } from '../../render/units/UnitRenderer';
import { SIM_TICK_MS } from '../../sim-host/protocol';
import type { Scenario } from '../scenario';
import { icon } from './icons';

/**
 * Üst arayüz (GDD §11.1, BFME2 düzeni):
 *   sol üst  — kahraman portresi (çağır / seç / yeniden canlanma sayacı) ve kale düğmesi (K)
 *   üst orta — dalga, geri sayım; FD: kale canı + kapı kalkanları, TD: kalan can
 *   sağ üst  — kaynaklar (altın, gelir, ordu)
 */
const fmt = (ticks: number) => {
  const s = Math.max(0, Math.ceil((ticks * SIM_TICK_MS) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export interface TopHudDeps {
  def: MapDef;
  scenario: Scenario;
  units: UnitRenderer;
  structures: StructureRenderer | null;
  cam: RTSCamera;
  selectHero: (hero: number) => void;
  selectFortress: () => void;
  onClick?: () => void;
}

export class TopHud {
  private readonly heroes: HTMLDivElement;
  private readonly heroBtn: HTMLButtonElement;
  private readonly fortBtn: HTMLButtonElement;
  private readonly status: HTMLDivElement;
  private readonly res: HTMLDivElement;
  private match: MatchInfo | null = null;
  private tick = 0;
  private heroPos: { x: number; z: number } | null = null;

  constructor(private readonly d: TopHudDeps) {
    this.heroes = document.createElement('div');
    this.heroes.id = 'heroes';
    this.heroes.innerHTML =
      '<button type="button" class="portrait hero"></button><button type="button" class="portrait fort"></button>';
    this.heroBtn = this.heroes.querySelector('.hero') as HTMLButtonElement;
    this.fortBtn = this.heroes.querySelector('.fort') as HTMLButtonElement;
    this.heroBtn.addEventListener('click', () => this.heroAction());
    this.fortBtn.addEventListener('click', () => this.fortAction());
    this.heroes.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.status = document.createElement('div');
    this.status.id = 'status';
    this.res = document.createElement('div');
    this.res.id = 'resources';
    document.body.append(this.heroes, this.status, this.res);
    window.addEventListener('keydown', (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'KeyF') this.heroAction();
      if (e.code === 'KeyK') this.fortAction();
    });
  }

  private heroAction(): void {
    const m = this.match;
    if (!m || m.state !== MatchState.Playing) return;
    if (m.hero !== 0) {
      this.d.selectHero(m.hero);
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

  private fortAction(): void {
    this.d.selectFortress();
    const c = this.d.def.citadel;
    this.d.cam.lookAt(c.pos[0], c.pos[1] + 12);
    this.d.onClick?.();
  }

  update(m: MatchInfo, tick: number): void {
    this.match = m;
    this.tick = tick;
    // Kahraman portresi
    let hp = 1;
    let rank = 1;
    this.heroPos = null;
    if (m.hero !== 0)
      this.d.units.forEach((x, _y, z, b, _t, h, _type, r) => {
        if (b === m.hero) {
          this.heroPos = { x, z };
          hp = h;
          rank = r;
        }
      });
    const cost = UNIT_DEFS[UnitTypeId.Aragorn]?.cost ?? 0;
    const wait = m.hero === 0 && tick < m.heroReady ? fmt(m.heroReady - tick) : '';
    const heroState = m.hero !== 0 ? 'alive' : wait ? 'dead' : m.gold >= cost ? 'ready' : 'off';
    const heroHtml = `<span class="ring" style="--hp:${(m.hero ? hp : 0) * 360}deg"></span>${icon('hero')}<small>${
      m.hero ? `${'★'.repeat(Math.max(0, rank - 1)) || 'Aragorn'}` : wait ? 'Düştü' : `◆${cost}`
    }</small>${wait ? `<b class="cdn">${Math.ceil(((m.heroReady - tick) * SIM_TICK_MS) / 1000)}</b>` : ''}<kbd>F</kbd>`;
    this.heroBtn.style.setProperty(
      '--p',
      `${m.hero === 0 && wait ? (1 - (m.heroReady - tick) / (HERO.reviveTime * 20)) * 360 : 360}deg`,
    );
    if (this.heroBtn.innerHTML !== heroHtml) this.heroBtn.innerHTML = heroHtml;
    this.heroBtn.dataset.state = heroState;
    this.heroBtn.title =
      m.hero !== 0
        ? 'Aragorn — seç ve kamerayı getir (F)'
        : wait
          ? `Aragorn düştü — ${wait} sonra yeniden çağrılabilir`
          : `Aragorn'u çağır (F) — ◆${cost}. Kalenin kapısından çıkar.`;
    const fs = this.d.structures?.fortress;
    const fhp = fs ? fs.hp / Math.max(1, fs.max) : 1;
    const fortHtml = `<span class="ring" style="--hp:${fhp * 360}deg"></span>${icon('castle')}<small>${
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
    const res = `<div>${icon('coin')}<b>${m.gold}</b><span>+${income}/sn</span></div><div>${icon('power')}<b>${(m.pp / 10).toFixed(1)}</b><span>güç</span></div><div>${icon('army')}<b>${army}</b><span>tabur</span></div>`;
    if (this.res.innerHTML !== res) this.res.innerHTML = res;
  }
}
