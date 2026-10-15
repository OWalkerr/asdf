import {
  type AbilityDef,
  BANNER,
  BUILDING_DEFS,
  BUILDING_KINDS,
  BUILDING_LEVEL,
  type BuildingKind,
  COMMAND_POINTS,
  ECONOMY,
  FORTRESS_UPGRADES,
  FREE_BUILD,
  factionDef,
  GEAR_DEFS,
  HERO_XP,
  HORDE_COMBOS,
  MAX_ABILITIES,
  type MapDef,
  type MatchInfo,
  SLOT_BUILDS,
  STANCE_DEFS,
  UNIT_DEFS,
  UnitTypeId,
  UPGRADE_DEFS,
  unitCp,
} from '@bulwark/shared';
import type { SlotMarkers } from '../../render/map/SlotMarkers';
import type { StructureRenderer } from '../../render/structures/StructureRenderer';
import type { UnitRenderer } from '../../render/units/UnitRenderer';
import { SIM_TICK_MS } from '../../sim-host/protocol';
import { roster } from '../cah';
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
  21: 'Rohan Mızrakçıları',
  22: 'Rohan Okçuları',
  23: 'Théoden',
  24: 'Éowyn',
  25: 'Rohirrim',
  26: 'Galadhrim Savaşçıları',
  27: 'Lórien Okçuları',
  28: 'Haldir',
  29: 'Elrond',
  30: 'İşçi',
  31: 'Lurtz',
  32: 'Saruman',
  33: 'Sharku',
  34: 'Uruk Arbaletçileri',
  35: 'Cadı Kral',
  36: 'Gothmog',
  37: "Sauron'un Ağzı",
  41: 'Tom Bombadil',
  42: 'Ent',
  43: 'Goblin Savaşçıları',
  44: 'Goblin Okçuları',
  45: 'Örümcek Biniciler',
  46: 'Gorkil',
  47: 'Drogoth',
  48: 'Shelob',
  49: 'Kılıçlı Kahraman',
  50: 'Okçu Kahraman',
  51: 'Büyücü Kahraman',
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
  21: 'spear',
  22: 'bow',
  23: 'crown',
  24: 'blade',
  25: 'horse',
  26: 'blade',
  27: 'bow',
  28: 'bow',
  29: 'leaf',
  30: 'hammer',
  31: 'club',
  32: 'staff',
  33: 'wolf',
  34: 'bow',
  35: 'crown',
  36: 'club',
  37: 'eye',
  41: 'hero',
  42: 'tree',
  43: 'sword',
  44: 'bow',
  45: 'spider',
  46: 'crown',
  47: 'flame',
  48: 'spider',
  49: 'sword',
  50: 'bow',
  51: 'staff',
};
const GEAR_BODY = [
  'Bu taburun kılıçları dövülür: +%25 yakın dövüş hasarı.',
  'Bu tabur ağır zırh giyer: %25 daha az hasar alır.',
  'Bu okçu taburu ateşli ok atar: Uruk zırhını ve koçbaşını deler.',
];
const STAT_HERO = new Set(UNIT_DEFS.filter((u) => u.hero).map((u) => u.id));
const ABILITY_ICON: Record<string, string> = {
  elendil: 'blade',
  athelas: 'leaf',
  wizard_blast: 'blast',
  word_of_power: 'power',
  arrow_wind: 'volley',
  train_archers: 'bow',
  kings_glory: 'rally',
  eored: 'horse',
  shieldmaiden: 'armor',
  slayer: 'blade',
  summon_dead: 'ghost',
  eagle_call: 'eagle',
  istar_light: 'sun',
  summon_elves: 'leaf',
  flood_call: 'wave',
};
const HERO_DESC: Record<number, string> = {
  6: "Aragorn: liderlik aurası, Elendil'in Kılıcı ve Athelas.",
  14: 'Beyaz Gandalf: Asa Patlaması ve yıkıcı Kudret Sözü.',
  15: 'Legolas: uzun menzilli elf okçusu; Ok Rüzgârı ve Okçu Eğitimi.',
  23: 'Kral Théoden: Kralın Şanı (ordu +%25 hasar) ve Éored Çağır.',
  24: 'Éowyn: Kalkan Kızı (çift hasar, iyileşme) ve boss avcısı "Ben Erkek Değilim!".',
  28: 'Haldir: menzilli kahraman; Lórien Ok Yağmuru ve Galadhrim Öfkesi.',
  29: 'Elrond: Elf Şifası ve Imladris Selleri (30 m, 450 hasar).',
  31: 'Lurtz: Uruk Öfkesi, Kara Ok Yağmuru; 10. seviyede Kral Avcısı.',
  32: 'Saruman: Ateş Topu, Söz Ustalığı (ordu +%25); 10. seviyede Orthanc Yıldırımı.',
  33: 'Sharku: warg binici komutanı; Warg Uluması ve Warg Sürüsü çağırır.',
  35: "Cadı Kral: Morgul Bıçağı, Kara Nefes; 10. seviyede Angmar'ın Gazabı.",
  36: 'Gothmog: Savaşa! (ordu +%25), Ork Takviyesi; 10. seviyede Trolleri Getirin.',
  37: "Sauron'un Ağzı: Sauron'un Sesi, Karanlık Lütuf; 10. seviyede Kanatlı Nazgûl.",
  46: 'Gorkil, Goblin Kralı: Goblin Sürüsü, Kralın Kamçısı (ordu +%25); 10. seviyede Dağın Karanlığı.',
  47: 'Drogoth, Ejder Lordu: uzaktan alev püskürtür; Alev Nefesi, Ejder Öfkesi; 10. seviyede Kızıl Yangın.',
  48: 'Shelob: Zehirli İğne, Yavrular (örümcek binicileri), Ağ; 10. seviyede Zehir Bulutu.',
  49: 'Kendi kahramanın (Savaşçı): Savaş Çılgınlığı, Demir İrade, Savaş Narası; 10. seviyede Ölüm Darbesi.',
  50: 'Kendi kahramanın (Okçu): Ok Fırtınası, Okçu Ustası, Nişancı Atışı; 10. seviyede Gökyüzünü Karart.',
  51: 'Kendi kahramanın (Büyücü): Ateş Patlaması, Şifa Işığı, Kör Edici Işık; 10. seviyede Kudret Sözü.',
};
const UNIT_DESC: Record<number, string> = {
  43: 'Ucuz ve kalabalık goblin sürüsü (20 asker); hızlı koşar, tek tek zayıftır.',
  44: 'Goblin okçuları: ateşli oklarla birlikleri ve binaları vurur.',
  45: 'Dev örümcek sırtında goblin mızrakçılar: hızlı, düşman hattını çiğner.',
  0: 'Kılıç ve kalkanlı çok yönlü piyade. Orklara karşı güçlü.',
  2: 'Ağır zırhlı mızrakçılar; süvari ve Uruk hücumunu karşılar.',
  4: 'Uzun menzilli okçular; zırhsız düşmana etkili.',
  21: 'Mızraklı Rohan piyadesi; süvari ve wargları karşılar, ucuz ve hızlı yetişir.',
  22: 'Hızlı ateş eden Rohan okçuları; zırhsız düşmana etkili.',
  25: 'Ezen süvari: hücumda yoldaki düşmanı çiğner; Ork sürülerine karşı yıkıcı.',
  26: 'Az ama keskin elf piyadesi: yüksek hasar ve dayanıklılık; Uruk saflarını yarar.',
  27: 'En uzun menzilli okçular (38 m); kulelerin ardından düşmanı erkenden avlar.',
  1: 'Ucuz ve kalabalık ork sürüsü: sayıyla boğar, hızlı yetişir.',
  3: 'Ağır zırhlı Uruk-hai: yakın dövüşte güçlü, insan piyadesini ezer.',
  11: 'Ucuz ork okçuları: zırhsız düşmana karşı yaylım.',
  13: 'Dev mağara trolü: vuruşu çevresine yayılır, kapı ve binaları ezer.',
  12: 'Hızlı warg binicileri: okçuları ve kaçan birlikleri avlar.',
  34: 'Ağır cıvatalı Uruk arbaletçileri: zırhı deler, yavaş ama sert vurur.',
  30: 'İşçi: bir yapı seç, haritada uygun yere yerleştir (Shift: art arda). İnşaat işçi başındayken ilerler.',
};
const BUILD_ICON: Record<BuildingKind, string> = {
  arrow_tower: 'tower',
  barracks: 'hall',
  forge: 'anvil',
  catapult: 'catapult',
  farm: 'wheat',
};
const BUILD_DESC: Record<BuildingKind, string> = {
  arrow_tower: 'Menzildeki düşman taburlarına 3 oklu yaylım atar.',
  barracks: 'Tarafının piyade, okçu ve özel birliklerini yetiştirir.',
  forge: 'Yükseltmeleri araştırır; sonra her tabur kendi kılıcını, zırhını, ateşli okunu alır.',
  catapult: 'Uzaktaki düşman kümelerine alan hasarlı taş atar; koçbaşı ve Uruk saflarına etkili.',
  farm: 'Kaynak binası: saniyede +1 altın (seviye başına). Düşman onu hedef alır — koruyun.',
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
  /** FACTIONS indeksi: kahraman kadrosu ve kışla birimleri. */
  faction: number;
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
  /** Render edilmiş birim portreleri (yoksa ikon). */
  portrait?: (unitType: number) => string | undefined;
  /** İşçiyle yerleştirme modunu başlat (BUILDING_KINDS indeksi, seçili işçiler). */
  beginPlacement?: (kind: number, workers: number[]) => void;
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
    if (this.d.def.mode === 'VS')
      return {
        key: `idle:${this.d.def.id}`,
        portrait: 'castle',
        title: this.d.def.name,
        subtitle: 'Çatışma',
        lines: [
          'Kaleni koru, rakiplerin kalesini yık: kalesi düşen oyuncu elenir.',
          'İşçiyle kışla, çiftlik ve kule kur; ordunu seçip sağ tıkla rakip birliğe, binaya ya da kaleye saldır.',
        ],
        buttons: [],
      };
    const fd = this.d.def.mode === 'FD';
    return {
      key: `idle:${this.d.def.id}`,
      portrait: fd ? 'castle' : 'tower',
      title: this.d.def.name,
      subtitle: fd ? 'Kale Savunması' : 'Kule Savunması',
      lines: fd
        ? [
            'Kapıları tut, kaleyi koru. Kale düşerse savaş biter.',
            'İşçini seç, kule ve binaları haritada istediğin uygun yere kur; surdaki halkalara kule koy. Kaleyi (K) yükselt, yeni işçi yetiştir.',
          ]
        : [
            'Düşman yolu izleyip çıkışa yürür; sızan her tabur can götürür.',
            'İşçiyle yolun kenarına istediğin yere okçu kulesi ve mancınık kur.',
          ],
      buttons: [],
    };
  }

  /** Seçili taburların durum satırı: birleşik ordu, donanım, sancak, kamaşma. */
  private battalionStatus(sel: ReadonlySet<number>): string[] {
    const infos = [...sel].map((b) => this.d.units.battalionInfo.get(b)).filter((i) => i !== undefined);
    if (infos.length === 0) return [];
    const parts: string[] = [];
    const horde = infos.filter((i) => i.horde).length;
    if (horde > 0) {
      const ranged = infos.some((i) => i.horde && UNIT_DEFS[i.type]?.ranged);
      parts.push(
        `<b class="ok">Birleşik ordu</b> (${ranged ? 'okçulara +%15 hasar' : ''}${ranged && infos.some((i) => i.horde && !UNIT_DEFS[i.type]?.ranged) ? ', ' : ''}${infos.some((i) => i.horde && !UNIT_DEFS[i.type]?.ranged) ? 'piyadeye −%15 alınan hasar' : ''})`,
      );
    }
    for (const k of new Set(infos.map((i) => i.combo).filter((c) => c > 0))) {
      const c = HORDE_COMBOS[k - 1];
      if (c) parts.push(`<b class="ok">${c.name}</b> (${c.desc})`);
    }
    const gearNames = UPGRADE_DEFS.filter((_d, u) => infos.some((i) => i.gear & (1 << u))).map((d) => d.name);
    if (gearNames.length > 0) parts.push(gearNames.join(', '));
    if (infos.some((i) => i.banner)) parts.push('Sancaktar');
    return parts.length > 0 ? [parts.join(' · ')] : [];
  }

  /** Tek kahraman seçiliyse seviye rozeti ve sonraki seviyeye XP ilerlemesi. */
  private heroLevel(type: number, level: number, single: boolean): { level?: number; xp?: number } {
    if (!single || !STAT_HERO.has(type)) return {};
    const k = roster(this.d.faction).findIndex((h) => h.unitType === type);
    const xp = k >= 0 ? (this.match?.heroXp[k] ?? 0) : 0;
    const lo = HERO_XP[level] ?? 0;
    const hi = HERO_XP[level + 1];
    return { level, xp: hi === undefined ? 1 : Math.max(0, Math.min(1, (xp - lo) / (hi - lo))) };
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
    roster(this.d.faction).forEach((def, k) => {
      const hero = m?.heroes[k] ?? 0;
      if (hero === 0 || !sel.has(hero)) return;
      const heroRank = counts.get(def.unitType)?.rank ?? 1;
      def.abilities.forEach((a, i) => {
        const left = secs((m?.abilityReady[k * MAX_ABILITIES + i] ?? 0) - this.tick);
        const locked = heroRank < a.rank;
        const active = (m?.heroBuff[k] ?? 0) > this.tick;
        buttons.push({
          icon: a.icon ?? ABILITY_ICON[a.key] ?? 'power',
          label: a.name,
          state: locked ? 'locked' : active ? 'busy' : left > 0 ? 'busy' : 'ready',
          badge: locked ? `Sv${a.rank}` : undefined,
          progress: !locked && left > 0 ? 1 - left / a.cooldown : undefined,
          cooldown: !locked && left > 0 ? left : undefined,
          tip: {
            title: a.name,
            meta: `${UNIT_LABELS[def.unitType] ?? ''} · bekleme ${a.cooldown} sn${locked ? ` · ${a.rank}. seviye gerekir` : ''}`,
            body: a.desc,
          },
          run: () => {
            this.d.scenario.ability(hero, i);
            this.onAbility?.(a.key, hero);
          },
        });
      });
    });
    // İşçiler: serbest inşa menüsü (BFME2).
    const workers = [...sel].filter((b) => this.d.units.battalionInfo.get(b)?.type === UnitTypeId.Worker);
    if (workers.length > 0)
      BUILDING_KINDS.forEach((k, ki) => {
        const bd = BUILDING_DEFS[k];
        buttons.push({
          icon: BUILD_ICON[k],
          label: bd.name,
          state: this.gold >= bd.cost ? 'ready' : 'off',
          badge: `${bd.cost}`,
          tip: {
            title: bd.name,
            meta: `◆ ${bd.cost} · ${bd.buildTime} sn (işçiyle)`,
            body: `${BUILD_DESC[k]} Haritada yeri seç: yeşil = uygun. Shift ile art arda kur, sağ tık/Esc iptal.`,
          },
          run: () => this.d.beginPlacement?.(ki, workers),
        });
      });
    // BFME2 duruşları ve sancaktar (kahraman/çağrılmış birlik dışı taburlar).
    const regular = [...sel].filter((b) => {
      const info = this.d.units.battalionInfo.get(b);
      return (
        info && !STAT_HERO.has(info.type) && !UNIT_DEFS[info.type]?.summoned && !UNIT_DEFS[info.type]?.worker
      );
    });
    if (regular.length > 0) {
      const stances = new Set(regular.map((b) => this.d.units.battalionInfo.get(b)?.stance ?? 0));
      const STANCE_ICON = ['army', 'charge', 'armor'];
      STANCE_DEFS.forEach((st, i) => {
        const on = stances.size === 1 && stances.has(i);
        buttons.push({
          icon: STANCE_ICON[i] ?? 'army',
          label: st.name,
          state: on ? 'active' : 'ready',
          tip: { title: st.name, meta: on ? 'etkin' : 'duruş', body: st.desc },
          run: () => this.d.scenario.stance(regular, i),
        });
      });
      // Demirhane donanımı (tabur başına; araştırma açar).
      const researched = this.match?.upgrades ?? 0;
      GEAR_DEFS.forEach((gd, u) => {
        const fits = regular.filter((b) => {
          const t = this.d.units.battalionInfo.get(b)?.type ?? 0;
          const ranged = UNIT_DEFS[t]?.ranged === true;
          return gd.for === 'all' || (gd.for === 'ranged') === ranged;
        });
        if (fits.length === 0) return;
        const def = UPGRADE_DEFS[u];
        const lacking = fits.filter((b) => !((this.d.units.battalionInfo.get(b)?.gear ?? 0) & (1 << u)));
        const open = (researched & (1 << u)) !== 0;
        buttons.push({
          icon: UP_ICON[u] ?? 'anvil',
          label: def?.name ?? '',
          state: !open ? 'locked' : lacking.length === 0 ? 'done' : this.gold >= gd.cost ? 'ready' : 'off',
          badge: !open ? undefined : lacking.length === 0 ? '✓' : `${gd.cost * lacking.length}`,
          tip: {
            title: def?.name ?? '',
            meta: !open
              ? 'Önce demirhanede araştırın'
              : lacking.length === 0
                ? 'alındı'
                : `◆ ${gd.cost} / tabur`,
            body: GEAR_BODY[u],
          },
          run: () => this.d.scenario.buyGear(lacking, u),
        });
      });
      const need = regular.filter((b) => this.d.units.battalionInfo.get(b)?.banner !== 1);
      const cost = BANNER.cost * need.length;
      buttons.push({
        icon: 'banner',
        label: 'Sancaktar',
        state: need.length === 0 ? 'done' : this.gold >= BANNER.cost ? 'ready' : 'off',
        badge: need.length === 0 ? '✓' : `${cost}`,
        tip: {
          title: 'Sancaktar',
          meta: need.length === 0 ? 'alındı' : `◆ ${BANNER.cost} / tabur`,
          body: `Tabura sancak taşıyıcısı katılır: çatışma dışında askerler saniyede %${BANNER.regenPercent} iyileşir, tabur %${BANNER.xpPercent - 100} daha hızlı deneyim kazanır.`,
        },
        run: () => this.d.scenario.buyBanner(need),
      });
    }
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
      key: `bat:${[...sel].join(',')}:${Math.round(hp * 40)}:${mc?.rank}:${Math.round((this.heroLevel(main, mc?.rank ?? 1, types.length === 1).xp ?? 0) * 20)}:${buttons.map((b) => `${b.state}${b.badge}${b.cooldown ?? ''}`).join(',')}`,
      portrait: UNIT_ICON[main] ?? 'sword',
      portraitImg: this.d.portrait?.(main),
      title: single ?? '?',
      subtitle: types.length === 1 ? `${mc?.battalions.size ?? 0} tabur · ${men} asker` : summary,
      hp,
      rank: types.length === 1 ? mc?.rank : undefined,
      ...this.heroLevel(main, mc?.rank ?? 1, types.length === 1),
      lines: [
        STAT_HERO.has(main)
          ? 'Kahraman: liderlik aurası — 20 m içindeki taburlara +%25 hasar.'
          : (UNIT_DESC[main] ?? 'Sağ tık: yürü · düşmana sağ tık: saldır.'),
        ...this.battalionStatus(sel),
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
        lines: st.free
          ? [
              BUILD_DESC[kind],
              'İnşaat yalnızca başında işçi varken ilerler (2 işçi daha hızlı). Boştaki işçiler yardıma gelir.',
            ]
          : [BUILD_DESC[kind]],
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
    if (kind === 'farm') {
      const L = st.level;
      const buttons = [this.upgradeButton(st.eid, L, kind), this.sellButton(st.eid, L, kind)];
      return {
        ...base,
        key: `farm:${slot}:${st.hp}:${L}:${buttons.map((x) => x.state).join('')}`,
        subtitle: `Seviye ${L} · ${st.hp} / ${st.max}`,
        lines: [`Gelir: saniyede +${(b.income ?? 1) * L} altın`, BUILD_DESC[kind]],
        buttons,
      };
    }
    // Kışla
    const full = st.queueLen >= ECONOMY.queueMax;
    const buttons: CommandButton[] = factionDef(this.d.faction).trains.map((u) => {
      const def = UNIT_DEFS[u];
      const cp = def ? unitCp(def) : 0;
      const m = this.match;
      const cpOk = !m || m.cpUsed + cp <= m.cpCap;
      const head = st.queueLen > 0 && st.queueUnit === u;
      const train = ((def?.trainTime ?? 0) * (100 - BUILDING_LEVEL.trainTimePercent * (st.level - 1))) / 100;
      return {
        icon: UNIT_ICON[u] ?? 'sword',
        img: this.d.portrait?.(u),
        label: UNIT_LABELS[u] ?? '',
        state: !full && cpOk && this.gold >= (def?.cost ?? 0) ? 'ready' : 'off',
        badge: `${def?.cost}`,
        progress: head ? st.queuePct : undefined,
        cooldown: head ? Math.max(1, Math.ceil(train * (1 - st.queuePct))) : undefined,
        tip: {
          title: UNIT_LABELS[u] ?? '',
          meta: `◆ ${def?.cost} · ${def?.trainTime} sn · ${def?.battalionSize} asker · ${cp} komuta puanı`,
          body: cpOk
            ? UNIT_DESC[u]
            : `Komuta puanı yetmiyor (${m?.cpUsed}/${m?.cpCap}). Tavanı yükseltmek için çiftlik kur veya yükselt.`,
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
          : kind === 'farm'
            ? `+${BUILDING_DEFS.farm.income ?? 1} altın/sn`
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
    // İşçi yetiştir (BFME2: kale işçi çıkarır).
    {
      const wait = m ? secs(m.workerReady - this.tick) : 0;
      const full = (m?.workers ?? 0) >= FREE_BUILD.maxWorkers;
      buttons.unshift({
        icon: 'hammer',
        img: this.d.portrait?.(UnitTypeId.Worker),
        label: 'İşçi',
        state: full
          ? 'done'
          : wait > 0
            ? 'busy'
            : this.gold >= FREE_BUILD.workerCost && (!m || m.cpUsed + COMMAND_POINTS.worker <= m.cpCap)
              ? 'ready'
              : 'off',
        badge: full ? `${m?.workers}/${FREE_BUILD.maxWorkers}` : `${FREE_BUILD.workerCost}`,
        cooldown: !full && wait > 0 ? wait : undefined,
        progress: !full && wait > 0 ? 1 - wait / FREE_BUILD.workerCooldown : undefined,
        tip: {
          title: 'İşçi yetiştir',
          meta: `◆ ${FREE_BUILD.workerCost} · ${m?.workers ?? 0}/${FREE_BUILD.maxWorkers} işçi`,
          body: 'Kalenin kapısından bir işçi çıkar. İşçiyle kule, kışla, demirhane, mancınık ve çiftliği haritada istediğin uygun yere kurarsın.',
        },
        run: () => this.d.scenario.trainWorker(),
      });
    }
    // Kahramanlar
    roster(this.d.faction).forEach((def, k) => {
      const unit = UNIT_DEFS[def.unitType];
      const cost = unit?.cost ?? 0;
      const alive = (m?.heroes[k] ?? 0) !== 0;
      const wait = m ? secs((m.heroReady[k] ?? 0) - this.tick) : 0;
      buttons.push({
        icon: def.icon,
        img: this.d.portrait?.(def.unitType),
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
