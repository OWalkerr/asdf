import {
  type AbilityDef,
  BUILDING_DEFS,
  BUILDING_KINDS,
  BUILDING_LEVEL,
  type BuildingKind,
  ECONOMY,
  FORTRESS_UPGRADES,
  HEROES,
  type MapDef,
  type MatchInfo,
  SLOT_BUILDS,
  UNIT_DEFS,
  UnitTypeId,
  UPGRADE_DEFS,
} from '@bulwark/shared';
import type { SlotMarkers } from '../../render/map/SlotMarkers';
import type { StructureRenderer } from '../../render/structures/StructureRenderer';
import type { UnitRenderer } from '../../render/units/UnitRenderer';
import { SIM_TICK_MS } from '../../sim-host/protocol';
import type { Scenario } from '../scenario';
import type { CommandBar, CommandButton, CommandContext } from './CommandBar';
import type { RadialAnchor, RadialMenu } from './RadialMenu';

/**
 * Seçime göre komut çubuğu bağlamı (GDD §11.1): taburlar (kahraman yetenekleri), boş inşa
 * yuvası, bina (kışla kuyruğu, demirhane araştırması, kule bilgisi), kale (yükseltmeler,
 * kahraman, kapı onarımı) ve boş durum.
 */
export const UNIT_LABELS: Record<number, string> = {
  0: 'Gondor Askerleri',
  1: 'Mordor Orkları',
  2: 'Kule Muhafızları',
  3: 'Uruk-hai',
  4: 'Gondor Okçuları',
  5: 'Koçbaşı',
  6: 'Aragorn',
  7: 'Lurtz',
  8: 'Lórien Okçuları',
  9: 'Rohirrim',
  10: 'Ölüler Ordusu',
  11: 'Ork Okçuları',
  12: 'Warg Biniciler',
  13: 'Mağara Trolü',
  14: 'Gandalf',
  15: 'Legolas',
  16: 'Balrog',
  17: 'Merdiven Takımı',
  18: 'Su Gözcüsü',
  19: 'Ateş Ejderi',
  20: 'Kuşatma Kulesi',
};
const UNIT_ICON: Record<number, string> = {
  0: 'sword',
  1: 'sword',
  2: 'spear',
  3: 'sword',
  4: 'bow',
  5: 'catapult',
  6: 'hero',
  7: 'sword',
  8: 'bow',
  9: 'horse',
  10: 'ghost',
  11: 'bow',
  12: 'wolf',
  13: 'club',
  14: 'staff',
  15: 'bow',
  16: 'flame',
  17: 'ladder',
  18: 'eye',
  19: 'flame',
  20: 'tower',
};
const STAT_HERO = new Set(HEROES.map((h) => h.unitType));
const ABILITY_ICON: Record<string, string> = {
  elendil: 'blade',
  athelas: 'leaf',
  wizard_blast: 'blast',
  word_of_power: 'power',
  arrow_wind: 'volley',
  train_archers: 'bow',
};
const HERO_DESC: Record<number, string> = {
  6: "Aragorn: liderlik aurası, Elendil'in Kılıcı ve Athelas.",
  14: 'Beyaz Gandalf: Asa Patlaması ve yıkıcı Kudret Sözü.',
  15: 'Legolas: uzun menzilli elf okçusu; Ok Rüzgârı ve Okçu Eğitimi.',
};
const UNIT_DESC: Record<number, string> = {
  0: 'Kılıç ve kalkanlı çok yönlü piyade. Orklara karşı güçlü.',
  2: 'Ağır zırhlı mızrakçılar; süvari ve Uruk hücumunu karşılar.',
  4: 'Uzun menzilli okçular; zırhsız düşmana etkili.',
};
const BUILD_ICON: Record<BuildingKind, string> = {
  arrow_tower: 'tower',
  barracks: 'hall',
  forge: 'anvil',
  catapult: 'catapult',
};
const BUILD_DESC: Record<BuildingKind, string> = {
  arrow_tower: 'Menzildeki düşman taburlarına 3 oklu yaylım atar.',
  barracks: 'Gondor piyadesi, okçu ve Kule Muhafızı yetiştirir.',
  forge: 'Takım çapında yükseltmeler: kılıç, zırh, ateşli ok.',
  catapult: 'Uzaktaki düşman kümelerine alan hasarlı taş atar; koçbaşı ve Uruk saflarına etkili.',
};
const UP_ICON = ['blade', 'armor', 'flame'];
const ROMAN = ['', 'I', 'II', 'III'];
/** Seviye çarpanı: taban × (100 + pct·(seviye−1)) / 100. */
const lv = (base: number, pct: number, level: number) => Math.round((base * (100 + pct * (level - 1))) / 100);
const FORT_ICON = ['wall', 'slits', 'catapult', 'banner', 'coin'];
const SLOT_NAMES: Record<string, string> = {
  wall_socket: 'Sur Soketi',
  tower: 'Kule Platformu',
  building: 'İnşa Arsası',
};
const secs = (ticks: number) => Math.max(0, Math.ceil((ticks * SIM_TICK_MS) / 1000));

export interface HudDeps {
  def: MapDef;
  scenario: Scenario;
  units: UnitRenderer;
  structures: StructureRenderer;
  slots: SlotMarkers;
  selected: Set<number>;
  bar: CommandBar;
  /** Kale seçili mi (HeroBar / dünya tıklaması). */
  fortressSelected: () => boolean;
  gateRepair: () => readonly number[];
  /** BFME tarzı halka menü (yapı/yuva/kale seçiliyken). */
  radial?: RadialMenu;
  groundY: (x: number, z: number) => number;
}

export class HudController {
  private match: MatchInfo | null = null;
  private tick = 0;
  /** Kahraman yeteneği kullanıldı (görsel efekt). */
  onAbility: ((ability: AbilityDef['key'], hero: number) => void) | null = null;

  constructor(private readonly d: HudDeps) {}

  update(match: MatchInfo, tick: number): void {
    this.match = match;
    this.tick = tick;
    const { selected, slots, structures } = this.d;
    let ctx: CommandContext;
    let anchor: RadialAnchor | null = null;
    this.d.bar.stop = null;
    if (selected.size > 0) ctx = this.battalions();
    else if (this.d.fortressSelected()) {
      ctx = this.fortress();
      const c = this.d.def.citadel;
      const td = this.d.def.mode === 'TD';
      anchor = {
        x: c.pos[0],
        y: this.d.groundY(c.pos[0], c.pos[1]) + (c.elevation ?? 0) + (td ? 9 : 13),
        z: c.pos[1],
      };
    } else if (slots.selectedIndex >= 0) {
      const i = slots.selectedIndex;
      const st = structures.bySlot.get(i);
      if (st) {
        ctx = this.building(i);
        anchor = { x: st.x, y: st.y + (st.top - st.y) * 0.5, z: st.z };
      } else {
        ctx = this.slot(i);
        const sd = this.d.def.slots[i];
        if (sd)
          anchor = { x: sd.pos[0], y: this.d.groundY(sd.pos[0], sd.pos[1]) + sd.elevation + 1, z: sd.pos[1] };
      }
    } else ctx = this.idle();
    this.d.bar.render(ctx);
    this.d.radial?.render(anchor ? ctx : null, anchor);
  }

  private get gold(): number {
    return this.match?.gold ?? 0;
  }

  private idle(): CommandContext {
    const fd = this.d.def.mode === 'FD';
    return {
      key: `idle:${this.d.def.id}`,
      portrait: fd ? 'castle' : 'tower',
      title: this.d.def.name,
      subtitle: fd ? 'Kale Savunması' : 'Kule Savunması',
      lines: fd
        ? [
            'Kapıları tut, kaleyi koru. Kale düşerse savaş biter.',
            'Altın halkalı yuvalara kule ve bina kur; kaleyi seçip (K) yükselt.',
          ]
        : [
            'Düşman yolu izleyip çıkışa yürür; sızan her tabur can götürür.',
            'Yolun kenarındaki yuvalara okçu kulesi ve mancınık kur.',
          ],
      buttons: [],
    };
  }

  private battalions(): CommandContext {
    const counts = new Map<number, { battalions: Set<number>; men: number; hp: number; rank: number }>();
    this.d.units.forEach((_x, _y, _z, b, _team, hp, type, rank) => {
      if (!this.d.selected.has(b)) return;
      let c = counts.get(type);
      if (!c) {
        c = { battalions: new Set(), men: 0, hp: 0, rank: 0 };
        counts.set(type, c);
      }
      c.battalions.add(b);
      c.men++;
      c.hp += hp;
      c.rank = Math.max(c.rank, rank);
    });
    const m = this.match;
    const sel = this.d.selected;
    this.d.bar.stop = () => this.d.scenario.stop(sel);
    const types = [...counts.keys()];
    const main = types[0] ?? 0;
    const mc = counts.get(main);
    let men = 0;
    let hpSum = 0;
    let cap = 0;
    for (const [t, c] of counts) {
      men += c.men;
      hpSum += c.hp;
      cap += (UNIT_DEFS[t]?.battalionSize ?? 1) * c.battalions.size;
    }
    const hp = cap > 0 ? hpSum / cap : 1;
    const buttons: CommandButton[] = [];
    // Seçili kahramanların yetenekleri (yuva sırasıyla).
    HEROES.forEach((def, k) => {
      const hero = m?.heroes[k] ?? 0;
      if (hero === 0 || !sel.has(hero)) return;
      const heroRank = counts.get(def.unitType)?.rank ?? 1;
      def.abilities.forEach((a, i) => {
        const left = secs((m?.abilityReady[k * 2 + i] ?? 0) - this.tick);
        const locked = heroRank < a.rank;
        const active = a.key === 'elendil' && (m?.elendilUntil ?? 0) > this.tick;
        buttons.push({
          icon: ABILITY_ICON[a.key] ?? 'power',
          label: a.name,
          state: locked ? 'locked' : active ? 'busy' : left > 0 ? 'busy' : 'ready',
          badge: locked ? `R${a.rank}` : undefined,
          progress: !locked && left > 0 ? 1 - left / a.cooldown : undefined,
          cooldown: !locked && left > 0 ? left : undefined,
          tip: {
            title: a.name,
            meta: `${UNIT_LABELS[def.unitType] ?? ''} · bekleme ${a.cooldown} sn${locked ? ` · rütbe ${a.rank} gerekir` : ''}`,
            body: a.desc,
          },
          run: () => {
            this.d.scenario.ability(hero, i);
            this.onAbility?.(a.key, hero);
          },
        });
      });
    });
    buttons.push({
      icon: 'stop',
      label: 'Dur',
      state: 'ready',
      tip: { title: 'Dur (H)', body: 'Seçili taburlar yerinde durur.' },
      run: () => this.d.scenario.stop(sel),
    });
    const summary = types
      .map((t) => `${UNIT_LABELS[t] ?? '?'} ×${counts.get(t)?.battalions.size}`)
      .join(' · ');
    const single = types.length === 1 ? UNIT_LABELS[main] : `${sel.size} tabur`;
    return {
      key: `bat:${[...sel].join(',')}:${Math.round(hp * 40)}:${mc?.rank}:${buttons.map((b) => `${b.state}${b.badge}${b.cooldown ?? ''}`).join(',')}`,
      portrait: UNIT_ICON[main] ?? 'sword',
      title: single ?? '?',
      subtitle: types.length === 1 ? `${mc?.battalions.size ?? 0} tabur · ${men} asker` : summary,
      hp,
      rank: types.length === 1 ? mc?.rank : undefined,
      lines: [
        STAT_HERO.has(main)
          ? 'Kahraman: liderlik aurası — 20 m içindeki taburlara +%25 hasar.'
          : (UNIT_DESC[main] ?? 'Sağ tık: yürü · düşmana sağ tık: saldır.'),
      ],
      buttons,
    };
  }

  private slot(slot: number): CommandContext {
    const def = this.d.def.slots[slot];
    const kinds = def ? (SLOT_BUILDS[def.kind] ?? []) : [];
    const buttons: CommandButton[] = kinds.map((k) => {
      const b = BUILDING_DEFS[k];
      return {
        icon: BUILD_ICON[k],
        label: b.name,
        state: this.gold >= b.cost ? 'ready' : 'off',
        badge: `${b.cost}`,
        tip: { title: b.name, meta: `◆ ${b.cost} · ${b.buildTime} sn`, body: BUILD_DESC[k] },
        run: () => this.d.scenario.build(slot, BUILDING_KINDS.indexOf(k)),
      };
    });
    return {
      key: `slot:${slot}:${buttons.map((b) => b.state).join('')}`,
      portrait: def?.kind === 'building' ? 'hall' : 'tower',
      title: SLOT_NAMES[def?.kind ?? ''] ?? 'Yuva',
      subtitle: def?.id ?? '',
      lines: ['Bir yapı seç: altın yeterliyse inşa hemen başlar.'],
      buttons,
    };
  }

  private building(slot: number): CommandContext {
    const st = this.d.structures.bySlot.get(slot);
    const kind = st ? BUILDING_KINDS[st.kind] : undefined;
    if (!st || !kind) return this.idle();
    const b = BUILDING_DEFS[kind];
    const hp = st.hp / st.max;
    const base = { portrait: BUILD_ICON[kind], title: `${b.name} ${ROMAN[st.level] ?? ''}`, hp };
    if (st.upgrading >= 0) {
      const left = Math.ceil(BUILDING_LEVEL.upgradeTime * (1 - st.upgrading));
      return {
        ...base,
        key: `upg:${slot}:${left}`,
        subtitle: `Seviye ${st.level}'e yükseltiliyor · %${Math.round(st.upgrading * 100)}`,
        lines: ['Yükseltme süresince yapı devre dışıdır.'],
        buttons: [
          {
            icon: 'up',
            label: 'Yükseltiliyor',
            state: 'busy',
            progress: st.upgrading,
            cooldown: left,
            tip: { title: `Seviye ${ROMAN[st.level]}`, meta: `${left} sn kaldı`, body: 'Yükseltme sürüyor.' },
          },
          this.sellButton(st.eid, st.level, kind),
        ],
      };
    }
    if (st.built < 1) {
      const left = Math.ceil(b.buildTime * (1 - st.built));
      return {
        ...base,
        key: `build:${slot}:${left}`,
        subtitle: `İnşa ediliyor · %${Math.round(st.built * 100)}`,
        lines: [BUILD_DESC[kind]],
        buttons: [
          {
            icon: 'repair',
            label: 'İnşa',
            state: 'busy',
            progress: st.built,
            cooldown: left,
            tip: { title: `${b.name} inşa ediliyor`, meta: `${left} sn kaldı`, body: BUILD_DESC[kind] },
          },
          this.sellButton(st.eid, st.level, kind),
        ],
      };
    }
    const upgrades = this.match?.upgrades ?? 0;
    const researching = this.match?.researching ?? 0;
    if (kind === 'arrow_tower' || kind === 'catapult') {
      const fire = (upgrades & 4) !== 0 && kind === 'arrow_tower';
      const a = b.attack;
      const L = st.level;
      const tower = kind === 'arrow_tower';
      const range = (a?.range ?? 0) + (tower ? BUILDING_LEVEL.towerRange * (L - 1) : 0);
      const volley = (a?.volley ?? 1) + (tower ? BUILDING_LEVEL.towerVolley * (L - 1) : 0);
      const dmg = lv(
        a?.damage ?? 0,
        tower ? BUILDING_LEVEL.towerDamagePercent : BUILDING_LEVEL.catapultDamagePercent,
        L,
      );
      const interval = tower
        ? (a?.interval ?? 1)
        : Math.round((a?.interval ?? 1) * (100 - BUILDING_LEVEL.catapultIntervalPercent * (L - 1))) / 100;
      const buttons = [this.upgradeButton(st.eid, L, kind), this.sellButton(st.eid, L, kind)];
      return {
        ...base,
        key: `tower:${slot}:${st.hp}:${fire}:${L}:${buttons.map((x) => x.state).join('')}`,
        subtitle: `Seviye ${L} · ${st.hp} / ${st.max}`,
        lines: [
          `Hasar ${dmg} · menzil ${range} m · ${volley} atış / ${interval} sn${a?.aoe ? ` · alan ${a.aoe} m` : ''}`,
          fire ? 'Ateşli Oklar etkin.' : BUILD_DESC[kind],
        ],
        buttons,
      };
    }
    if (kind === 'forge') {
      const busy = st.queueLen > 0;
      const buttons: CommandButton[] = (b.researches ?? []).map((u) => {
        const def = UPGRADE_DEFS[u];
        const done = (upgrades & (1 << u)) !== 0;
        const running = (researching & (1 << u)) !== 0;
        return {
          icon: UP_ICON[u] ?? 'anvil',
          label: def?.name ?? '',
          state: done ? 'done' : running ? 'busy' : !busy && this.gold >= (def?.cost ?? 0) ? 'ready' : 'off',
          badge: done ? '✓' : running ? `%${Math.round(st.queuePct * 100)}` : `${def?.cost}`,
          progress: running ? st.queuePct : undefined,
          cooldown: running ? Math.ceil((def?.researchTime ?? 0) * (1 - st.queuePct)) : undefined,
          tip: { title: def?.name ?? '', meta: `◆ ${def?.cost} · ${def?.researchTime} sn`, body: def?.desc },
          run: () => this.d.scenario.research(st.eid, u),
        };
      });
      buttons.push(this.sellButton(st.eid, st.level, kind));
      return {
        ...base,
        key: `forge:${slot}:${upgrades}:${researching}:${buttons.map((x) => `${x.state}${x.cooldown ?? ''}`).join('')}`,
        subtitle: `${st.hp} / ${st.max}`,
        lines: ['Yükseltmeler tüm ordunuza uygulanır; aynı anda tek araştırma.'],
        buttons,
      };
    }
    // Kışla
    const full = st.queueLen >= ECONOMY.queueMax;
    const buttons: CommandButton[] = (b.trains ?? []).map((u) => {
      const def = UNIT_DEFS[u];
      const head = st.queueLen > 0 && st.queueUnit === u;
      const train = ((def?.trainTime ?? 0) * (100 - BUILDING_LEVEL.trainTimePercent * (st.level - 1))) / 100;
      return {
        icon: UNIT_ICON[u] ?? 'sword',
        label: UNIT_LABELS[u] ?? '',
        state: !full && this.gold >= (def?.cost ?? 0) ? 'ready' : 'off',
        badge: `${def?.cost}`,
        progress: head ? st.queuePct : undefined,
        cooldown: head ? Math.max(1, Math.ceil(train * (1 - st.queuePct))) : undefined,
        tip: {
          title: UNIT_LABELS[u] ?? '',
          meta: `◆ ${def?.cost} · ${def?.trainTime} sn · ${def?.battalionSize} asker`,
          body: UNIT_DESC[u],
        },
        run: () => this.d.scenario.train(st.eid, u),
      };
    });
    buttons.push(this.upgradeButton(st.eid, st.level, kind), this.sellButton(st.eid, st.level, kind));
    const queue =
      st.queueLen > 0
        ? `Kuyruk: ${st.queueLen} · ${UNIT_LABELS[st.queueUnit] ?? ''} %${Math.round(st.queuePct * 100)}`
        : 'Kuyruk boş';
    return {
      ...base,
      key: `barracks:${slot}:${buttons.map((x) => `${x.state}${x.cooldown ?? ''}`).join('')}:${st.queueLen}:${st.level}`,
      subtitle: `Seviye ${st.level} · ${st.hp} / ${st.max}`,
      lines: [
        queue,
        st.level > 1
          ? `Yetiştirme süresi −%${BUILDING_LEVEL.trainTimePercent * (st.level - 1)} · kuyruk en fazla ${ECONOMY.queueMax}.`
          : `Yetişen taburlar binanın önünde toplanır (kuyruk en fazla ${ECONOMY.queueMax}).`,
      ],
      buttons,
    };
  }

  /** Bina seviye yükseltmesi düğmesi (BFME2: I → II → III). */
  private upgradeButton(eid: number, level: number, kind: BuildingKind): CommandButton {
    const cost = BUILDING_DEFS[kind].levelCosts?.[level - 1];
    const max = cost === undefined || level >= BUILDING_LEVEL.max;
    const what =
      kind === 'arrow_tower'
        ? `+%${BUILDING_LEVEL.towerDamagePercent} hasar, +${BUILDING_LEVEL.towerVolley} ok, +${BUILDING_LEVEL.towerRange} m menzil`
        : kind === 'catapult'
          ? `+%${BUILDING_LEVEL.catapultDamagePercent} hasar, −%${BUILDING_LEVEL.catapultIntervalPercent} atış aralığı`
          : `−%${BUILDING_LEVEL.trainTimePercent} yetiştirme süresi`;
    return {
      icon: 'up',
      label: max ? 'En üst seviye' : `Seviye ${level + 1}`,
      state: max ? 'done' : this.gold >= cost ? 'ready' : 'off',
      badge: max ? '✓' : `${cost}`,
      tip: {
        title: max ? 'En üst seviye' : `Seviye ${ROMAN[level + 1]}'e yükselt`,
        meta: max ? '' : `◆ ${cost} · ${BUILDING_LEVEL.upgradeTime} sn`,
        body: `${what}; +%${BUILDING_LEVEL.hpPercent} dayanıklılık. Yükseltme sırasında yapı çalışmaz.`,
      },
      run: () => this.d.scenario.upgradeBuilding(eid),
    };
  }

  /** Satış düğmesi: yatırılan altının yarısı iade. */
  private sellButton(eid: number, level: number, kind: BuildingKind): CommandButton {
    const def = BUILDING_DEFS[kind];
    const invested = def.cost + (def.levelCosts ?? []).slice(0, level - 1).reduce((a, c) => a + c, 0);
    const refund = Math.floor((invested * BUILDING_LEVEL.sellRefundPercent) / 100);
    return {
      icon: 'coin',
      label: 'Sat',
      state: 'ready',
      badge: `+${refund}`,
      tip: {
        title: 'Yapıyı sat',
        meta: `◆ +${refund}`,
        body: 'Yapı yıkılır, yatırılan altının yarısı geri döner; arsa yeniden inşaya açılır.',
      },
      // Arsa seçili kalır: panel inşa listesine döner.
      run: () => this.d.scenario.sellBuilding(eid),
    };
  }

  private fortress(): CommandContext {
    const m = this.match;
    const def = this.d.def;
    const fortUp = m?.fortUp ?? 0;
    const research = m?.fortResearch ?? -1;
    const buttons: CommandButton[] = FORTRESS_UPGRADES.map((u, i) => {
      const done = (fortUp & (1 << i)) !== 0;
      const running = research === i;
      return {
        icon: FORT_ICON[i] ?? 'castle',
        label: u.name,
        state: done ? 'done' : running ? 'busy' : research < 0 && this.gold >= u.cost ? 'ready' : 'off',
        badge: done ? '✓' : running ? `%${Math.round((m?.fortPct ?? 0) * 100)}` : `${u.cost}`,
        progress: running ? (m?.fortPct ?? 0) : undefined,
        cooldown: running ? Math.max(1, Math.ceil(u.time * (1 - (m?.fortPct ?? 0)))) : undefined,
        tip: { title: u.name, meta: `◆ ${u.cost} · ${u.time} sn`, body: u.desc },
        run: () => this.d.scenario.fortressUpgrade(i),
      };
    });
    // Kahramanlar
    HEROES.forEach((def, k) => {
      const unit = UNIT_DEFS[def.unitType];
      const cost = unit?.cost ?? 0;
      const alive = (m?.heroes[k] ?? 0) !== 0;
      const wait = m ? secs((m.heroReady[k] ?? 0) - this.tick) : 0;
      buttons.push({
        icon: def.icon,
        label: unit?.name ?? '',
        state: alive ? 'done' : wait > 0 ? 'busy' : this.gold >= cost ? 'ready' : 'off',
        badge: alive ? '✓' : `${cost}`,
        cooldown: !alive && wait > 0 ? wait : undefined,
        tip: {
          title: `${unit?.name ?? ''} — çağır`,
          meta: `◆ ${cost}`,
          body: `${HERO_DESC[def.unitType] ?? ''} Kalenin kapısından çıkar; ölürse 45 sn sonra yeniden çağrılabilir.`,
        },
        run: () => this.d.scenario.summonHero(def.unitType),
      });
    });
    // Kapı onarımı
    const repair = this.d.gateRepair();
    (m?.gateHp ?? []).forEach((hp, i) => {
      const g = def.gates[i];
      const max = m?.gateMax[i] ?? 1;
      const busy = (repair[i] ?? 0) > 0;
      buttons.push({
        icon: 'repair',
        label: `${g?.name ?? 'Kapı'} onar`,
        state: busy ? 'busy' : hp > 0 && hp < max && this.gold >= ECONOMY.repairCost ? 'ready' : 'off',
        badge: hp <= 0 ? 'yıkık' : `${Math.round((hp / max) * 100)}%`,
        progress: busy ? 1 - (repair[i] ?? 0) / (ECONOMY.repairTime * 20) : hp / max,
        cooldown: busy ? secs(repair[i] ?? 0) : undefined,
        tip: {
          title: `${g?.name ?? 'Kapı'} onarımı`,
          meta: `◆ ${ECONOMY.repairCost} · ${ECONOMY.repairTime} sn · +%${ECONOMY.repairPercent}`,
          body: hp <= 0 ? 'Bu kapı yıkıldı; düşman içeri akıyor.' : `Can ${hp} / ${max}.`,
        },
        run: () => this.d.scenario.repair(i),
      });
    });
    const f = m?.fortress ?? 0;
    const fs = f ? this.d.structures.fortress : null;
    const hp = fs ? fs.hp / Math.max(1, fs.max) : 1;
    return {
      key: `fort:${fortUp}:${research}:${Math.round((m?.fortPct ?? 0) * 40)}:${Math.round(hp * 50)}:${buttons.map((b) => `${b.state}${b.badge}${b.cooldown ?? ''}`).join(',')}`,
      portrait: 'castle',
      title: def.citadel.name ?? 'Kale',
      subtitle: fs ? `${fs.hp} / ${fs.max}` : '',
      hp,
      lines: [
        def.mode === 'FD'
          ? 'Kale düşerse savaş biter. Yükseltmeler sırayla araştırılır.'
          : 'Üssünüz: kahramanlar buradan çıkar.',
      ],
      buttons,
    };
  }
}
