/**
 * Sim → render snapshot düzeni (GDD §13.3), sürüm 7.
 *
 * Tek bir Int32Array (SharedArrayBuffer üzerinde veya fallback'te düz ArrayBuffer):
 *
 *   [global header: 4]  activeIndex, publishCount, capacity, projCapacity
 *   [buffer 0: header 48 + capacity × 6 + projCapacity × 7 + SNAP_MAX_STRUCTS × 6]
 *   [buffer 1: aynı]
 *
 * Buffer header: version (seqlock; tek = yazılıyor), tick, count, simMicros, projCount,
 *   matchState, waveIndex, waveCount, nextWaveTick, enemiesAlive, (10–15 boş),
 *   gold (oyuncu 0), structCount, upgrades (bitler; araştırılanlar << 8), PP (onda bir),
 *   açık büyüler, büyü hazır tick'leri ×3, kahraman taburu, kahraman hazır tick'i,
 *   yetenek hazır tick'leri ×2, Elendil bitiş tick'i, Toplanma bitiş tick'i, büyü hazır ×8,
 *   uç bölgedeki düşman taburu (38), gateHp[0..3] (40), gateMax[0..3] (44)
 *
 * Birim kaydı (6 × int32):
 *   0 eid · 1 x (Q16.16) · 2 z (Q16.16) · 3 yaw:16|unitType:8|team:8
 *   4 anim:8|flags:8|hp8:8|animTick:8 · 5 tabur eid'i:24|rütbe:8 (0 = yok/ölü)
 * Ok kaydı (7 × int32):
 *   0 eid · 1 fromX · 2 fromZ · 3 toX · 4 toZ · 5 fireTick:20|flightTicks:12 · 6 yükseklik (cm):16|tür:8 (0 ok, 1 taş)
 * Yapı kaydı (6 × int32) — kapılar da (kind 0, slot = kapı indeksi, 4 = kalan onarım tick'i):
 *   0 eid · 1 seviye:4|kind:8|slot:8|team:8 · 2 hp · 3 max · 4 kalan inşa tick'i · 5 kuyruk (packQueue)
 *
 * Konumlar ham Q16.16 olarak taşınır; float'a çeviri render tarafında (GDD §13.7).
 */
export const SNAP_GLOBAL_INTS = 4;
export const SNAP_HEADER_INTS = 48;
export const SNAP_UNIT_INTS = 6;
export const SNAP_PROJ_INTS = 7;
export const SNAP_STRUCT_INTS = 6;
/** Snapshot'ta taşınan en fazla inşa edilmiş yapı. */
export const SNAP_MAX_STRUCTS = 48;
/** Snapshot'ta taşınan en fazla kapı sayısı. */
export const SNAP_MAX_GATES = 4;

export const G_ACTIVE = 0;
export const G_PUBLISH = 1;
export const G_CAPACITY = 2;
export const G_PROJ_CAPACITY = 3;

export const H_VERSION = 0;
export const H_TICK = 1;
export const H_COUNT = 2;
export const H_SIM_MICROS = 3;
export const H_PROJ_COUNT = 4;
export const H_MATCH_STATE = 5;
export const H_WAVE_INDEX = 6;
export const H_WAVE_COUNT = 7;
export const H_NEXT_WAVE_TICK = 8;
export const H_ENEMIES_ALIVE = 9;
export const H_GATE_HP = 40; // 40–43
export const H_GATE_MAX = 44; // 44–47
/** TD uç bölgesindeki düşman taburu sayısı. */
export const H_ZONE = 38;
export const H_GOLD = 16;
export const H_STRUCT_COUNT = 17;
/** Oyuncu 0'ın tamamlanmış yükseltmeleri (bit maskesi) ve araştırılanlar (<< 8). */
export const H_UPGRADES = 18;
/** Güç Puanı ×10 (oyuncu 0). */
export const H_PP = 19;
/** Açık büyü bitleri (SPELL_DEFS). */
export const H_SPELLS = 20;
/** Kale eid'i, kale yükseltmeleri (bitler | araştırılan+1 << 8 | ilerleme% << 16), TD canı. */
export const H_FORTRESS = 21;
export const H_FORT_UP = 22;
export const H_LIVES = 23;
/** Büyü i'nin hazır tick'i: H_SPELL_READY + i (30–37). */
export const H_SPELL_READY = 30;
export const SNAP_SPELLS = 8;
/** Kahraman taburu eid'i (0 = yok) ve yeniden çağrılabileceği tick. */
export const H_HERO = 24;
export const H_HERO_READY = 25;
/** Kahraman yetenekleri hazır tick'leri (26, 27). */
export const H_ABILITY_READY = 26;
export const H_ELENDIL_UNTIL = 28;
export const H_RALLY_UNTIL = 29;

/** Birim kaydı flags biti: son birkaç tick içinde hasar aldı (vurulma parıltısı). */
export const FLAG_HIT = 1;

/** Maç durumu (GDD §4): oynanıyor / zafer / yenilgi. */
export const MatchState = { Playing: 0, Victory: 1, Defeat: 2 } as const;
export type MatchState = (typeof MatchState)[keyof typeof MatchState];

const bufferInts = (capacity: number, projCapacity: number) =>
  SNAP_HEADER_INTS +
  capacity * SNAP_UNIT_INTS +
  projCapacity * SNAP_PROJ_INTS +
  SNAP_MAX_STRUCTS * SNAP_STRUCT_INTS;

export const snapshotInts = (capacity: number, projCapacity: number): number =>
  SNAP_GLOBAL_INTS + 2 * bufferInts(capacity, projCapacity);

export const bufferOffset = (view: Int32Array, index: number): number =>
  SNAP_GLOBAL_INTS + index * bufferInts(view[G_CAPACITY] as number, view[G_PROJ_CAPACITY] as number);

/** Buffer içinde ok bölümünün başı (header sonrası birim bölümünden sonra). */
export const projOffset = (view: Int32Array, base: number): number =>
  base + SNAP_HEADER_INTS + (view[G_CAPACITY] as number) * SNAP_UNIT_INTS;

/** Buffer içinde yapı bölümünün başı (ok bölümünden sonra). */
export const structOffset = (view: Int32Array, base: number): number =>
  projOffset(view, base) + (view[G_PROJ_CAPACITY] as number) * SNAP_PROJ_INTS;

/** Kışla kuyruğu: uzunluk (4 bit), şu an yetişen birim tipi (8 bit), ilerleme % (7 bit). */
export const packQueue = (len: number, unit: number, pct: number): number =>
  (len & 0xf) | ((unit & 0xff) << 4) | ((pct & 0x7f) << 12);
export const unpackQueueLen = (v: number): number => v & 0xf;
export const unpackQueueUnit = (v: number): number => (v >>> 4) & 0xff;
export const unpackQueuePct = (v: number): number => (v >>> 12) & 0x7f;

/** Birim kaydı alan 5: tabur eid'i (24 bit) + rütbe (8 bit). */
export const packBattalionRank = (battalion: number, rank: number): number =>
  (battalion & 0xffffff) | ((rank & 0xff) << 24);
export const unpackBattalion = (v: number): number => v & 0xffffff;
export const unpackRank = (v: number): number => (v >>> 24) & 0xff;

export const packStructKind = (kind: number, slot: number, team: number, level = 1): number =>
  ((level & 0x0f) << 24) | ((kind & 0xff) << 16) | ((slot & 0xff) << 8) | (team & 0xff);
export const unpackStructLevel = (v: number): number => Math.max(1, (v >>> 24) & 0x0f);
export const unpackStructKind = (v: number): number => (v >>> 16) & 0xff;
export const unpackStructSlot = (v: number): number => (v >>> 8) & 0xff;

export const createSnapshotView = (capacity: number, shared: boolean, projCapacity = 2048): Int32Array => {
  const bytes = snapshotInts(capacity, projCapacity) * 4;
  const view = new Int32Array(shared ? new SharedArrayBuffer(bytes) : new ArrayBuffer(bytes));
  view[G_CAPACITY] = capacity;
  view[G_PROJ_CAPACITY] = projCapacity;
  view[G_ACTIVE] = 0;
  return view;
};

export const packYawTypeTeam = (yaw: number, unitType: number, team: number): number =>
  ((yaw & 0xffff) << 16) | ((unitType & 0xff) << 8) | (team & 0xff);

export const packAnim = (anim: number, flags: number, hp8: number, animTick: number): number =>
  ((anim & 0xff) << 24) | ((flags & 0xff) << 16) | ((hp8 & 0xff) << 8) | (animTick & 0xff);

export const packFlight = (fireTick: number, flightTicks: number): number =>
  ((fireTick & 0xfffff) << 12) | (flightTicks & 0xfff);

export const unpackYaw = (v: number): number => (v >>> 16) & 0xffff;
export const unpackUnitType = (v: number): number => (v >>> 8) & 0xff;
export const unpackTeam = (v: number): number => v & 0xff;
export const unpackAnimState = (v: number): number => (v >>> 24) & 0xff;
export const unpackFlags = (v: number): number => (v >>> 16) & 0xff;
export const unpackHp8 = (v: number): number => (v >>> 8) & 0xff;
export const unpackAnimTick = (v: number): number => v & 0xff;
export const unpackFireTick = (v: number): number => (v >>> 12) & 0xfffff;
export const unpackFlightTicks = (v: number): number => v & 0xfff;

export interface MatchInfo {
  state: number;
  waveIndex: number;
  waveCount: number;
  nextWaveTick: number;
  enemiesAlive: number;
  gateHp: number[];
  gateMax: number[];
  gold: number;
  /** Tamamlanmış yükseltme bitleri. */
  upgrades: number;
  /** Araştırılmakta olan yükseltme bitleri. */
  researching: number;
  /** Güç Puanı ×10. */
  pp: number;
  spells: number;
  spellReady: number[];
  hero: number;
  heroReady: number;
  abilityReady: number[];
  elendilUntil: number;
  rallyUntil: number;
  fortress: number;
  fortUp: number;
  /** Araştırılan kale yükseltmesi (−1 = yok) ve ilerleme [0, 1]. */
  fortResearch: number;
  fortPct: number;
  lives: number;
  /** TD uç bölgesinde bekleyen düşman taburu. */
  zone: number;
}

/** Okunan tek bir snapshot (render tarafının kendi kopyası). */
export interface SnapshotFrame {
  tick: number;
  count: number;
  simMicros: number;
  /** count × SNAP_UNIT_INTS kayıt. */
  units: Int32Array;
  projCount: number;
  projectiles: Int32Array;
  structCount: number;
  structures: Int32Array;
  match: MatchInfo;
}

export const createFrame = (capacity: number, projCapacity = 2048): SnapshotFrame => ({
  tick: -1,
  count: 0,
  simMicros: 0,
  units: new Int32Array(capacity * SNAP_UNIT_INTS),
  projCount: 0,
  projectiles: new Int32Array(projCapacity * SNAP_PROJ_INTS),
  structCount: 0,
  structures: new Int32Array(SNAP_MAX_STRUCTS * SNAP_STRUCT_INTS),
  match: {
    state: 0,
    waveIndex: 0,
    waveCount: 0,
    nextWaveTick: 0,
    enemiesAlive: 0,
    gateHp: [],
    gateMax: [],
    gold: 0,
    upgrades: 0,
    researching: 0,
    pp: 0,
    spells: 0,
    spellReady: [0, 0, 0, 0, 0, 0, 0, 0],
    hero: 0,
    heroReady: 0,
    abilityReady: [0, 0],
    elendilUntil: 0,
    rallyUntil: 0,
    fortress: 0,
    fortUp: 0,
    fortResearch: -1,
    fortPct: 0,
    lives: 0,
    zone: 0,
  },
});

/** Header'daki maç alanlarını frame'e kopyalar. */
export const readMatchHeader = (view: Int32Array, base: number, out: MatchInfo): void => {
  out.state = view[base + H_MATCH_STATE] as number;
  out.waveIndex = view[base + H_WAVE_INDEX] as number;
  out.waveCount = view[base + H_WAVE_COUNT] as number;
  out.nextWaveTick = view[base + H_NEXT_WAVE_TICK] as number;
  out.enemiesAlive = view[base + H_ENEMIES_ALIVE] as number;
  out.gold = view[base + H_GOLD] as number;
  const up = view[base + H_UPGRADES] as number;
  out.upgrades = up & 0xff;
  out.researching = (up >>> 8) & 0xff;
  out.pp = view[base + H_PP] as number;
  out.spells = view[base + H_SPELLS] as number;
  for (let i = 0; i < SNAP_SPELLS; i++) out.spellReady[i] = view[base + H_SPELL_READY + i] as number;
  out.hero = view[base + H_HERO] as number;
  out.heroReady = view[base + H_HERO_READY] as number;
  for (let i = 0; i < 2; i++) out.abilityReady[i] = view[base + H_ABILITY_READY + i] as number;
  out.elendilUntil = view[base + H_ELENDIL_UNTIL] as number;
  out.rallyUntil = view[base + H_RALLY_UNTIL] as number;
  out.fortress = view[base + H_FORTRESS] as number;
  const fu = view[base + H_FORT_UP] as number;
  out.fortUp = fu & 0xff;
  out.fortResearch = ((fu >>> 8) & 0xff) - 1;
  out.fortPct = ((fu >>> 16) & 0x7f) / 100;
  out.lives = view[base + H_LIVES] as number;
  out.zone = view[base + H_ZONE] as number;
  out.gateHp.length = 0;
  out.gateMax.length = 0;
  for (let g = 0; g < SNAP_MAX_GATES; g++) {
    const max = view[base + H_GATE_MAX + g] as number;
    if (max <= 0) break;
    out.gateMax.push(max);
    out.gateHp.push(view[base + H_GATE_HP + g] as number);
  }
};

/**
 * En son yayınlanan buffer'ı `out`a kopyalar (seqlock: yazıcı araya girerse tekrar dener).
 * Yeni bir tick yoksa (out.tick aynıysa) false döner.
 */
export const readLatestSnapshot = (view: Int32Array, out: SnapshotFrame): boolean => {
  const capacity = view[G_CAPACITY] as number;
  const projCapacity = view[G_PROJ_CAPACITY] as number;
  for (let attempt = 0; attempt < 4; attempt++) {
    const index = Atomics.load(view, G_ACTIVE);
    const base = bufferOffset(view, index);
    const v1 = Atomics.load(view, base + H_VERSION);
    if (v1 & 1) continue;
    const tick = view[base + H_TICK] as number;
    if (tick === out.tick) return false;
    const count = Math.min(view[base + H_COUNT] as number, capacity);
    const start = base + SNAP_HEADER_INTS;
    out.units.set(view.subarray(start, start + count * SNAP_UNIT_INTS));
    const projCount = Math.min(view[base + H_PROJ_COUNT] as number, projCapacity);
    const pStart = projOffset(view, base);
    out.projectiles.set(view.subarray(pStart, pStart + projCount * SNAP_PROJ_INTS));
    const structCount = Math.min(view[base + H_STRUCT_COUNT] as number, SNAP_MAX_STRUCTS);
    const sStart = structOffset(view, base);
    out.structures.set(view.subarray(sStart, sStart + structCount * SNAP_STRUCT_INTS));
    const simMicros = view[base + H_SIM_MICROS] as number;
    readMatchHeader(view, base, out.match);
    if (Atomics.load(view, base + H_VERSION) !== v1) continue;
    out.tick = tick;
    out.count = count;
    out.projCount = projCount;
    out.structCount = structCount;
    out.simMicros = simMicros;
    return true;
  }
  return false;
};
