/**
 * Sim → render snapshot düzeni (GDD §13.3), sürüm 3.
 *
 * Tek bir Int32Array (SharedArrayBuffer üzerinde veya fallback'te düz ArrayBuffer):
 *
 *   [global header: 4]  activeIndex, publishCount, capacity, projCapacity
 *   [buffer 0: header 16 + capacity × 6 + projCapacity × 6]
 *   [buffer 1: aynı]
 *
 * Buffer header: version (seqlock; tek = yazılıyor), tick, count, simMicros, projCount,
 *   matchState, waveIndex, waveCount, nextWaveTick, enemiesAlive, gateHp[0..2], gateMax[0..2]
 *
 * Birim kaydı (6 × int32):
 *   0 eid · 1 x (Q16.16) · 2 z (Q16.16) · 3 yaw:16|unitType:8|team:8
 *   4 anim:8|flags:8|hp8:8|animTick:8 · 5 tabur eid'i (0 = yok/ölü)
 * Ok kaydı (6 × int32):
 *   0 eid · 1 fromX · 2 fromZ · 3 toX · 4 toZ · 5 fireTick:20|flightTicks:12
 *
 * Konumlar ham Q16.16 olarak taşınır; float'a çeviri render tarafında (GDD §13.7).
 */
export const SNAP_GLOBAL_INTS = 4;
export const SNAP_HEADER_INTS = 16;
export const SNAP_UNIT_INTS = 6;
export const SNAP_PROJ_INTS = 6;
/** Snapshot'ta taşınan en fazla kapı sayısı. */
export const SNAP_MAX_GATES = 3;

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
export const H_GATE_HP = 10; // 10, 11, 12
export const H_GATE_MAX = 13; // 13, 14, 15

/** Birim kaydı flags biti: son birkaç tick içinde hasar aldı (vurulma parıltısı). */
export const FLAG_HIT = 1;

/** Maç durumu (GDD §4): oynanıyor / zafer / yenilgi. */
export const MatchState = { Playing: 0, Victory: 1, Defeat: 2 } as const;
export type MatchState = (typeof MatchState)[keyof typeof MatchState];

const bufferInts = (capacity: number, projCapacity: number) =>
  SNAP_HEADER_INTS + capacity * SNAP_UNIT_INTS + projCapacity * SNAP_PROJ_INTS;

export const snapshotInts = (capacity: number, projCapacity: number): number =>
  SNAP_GLOBAL_INTS + 2 * bufferInts(capacity, projCapacity);

export const bufferOffset = (view: Int32Array, index: number): number =>
  SNAP_GLOBAL_INTS + index * bufferInts(view[G_CAPACITY] as number, view[G_PROJ_CAPACITY] as number);

/** Buffer içinde ok bölümünün başı (header sonrası birim bölümünden sonra). */
export const projOffset = (view: Int32Array, base: number): number =>
  base + SNAP_HEADER_INTS + (view[G_CAPACITY] as number) * SNAP_UNIT_INTS;

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
  match: MatchInfo;
}

export const createFrame = (capacity: number, projCapacity = 2048): SnapshotFrame => ({
  tick: -1,
  count: 0,
  simMicros: 0,
  units: new Int32Array(capacity * SNAP_UNIT_INTS),
  projCount: 0,
  projectiles: new Int32Array(projCapacity * SNAP_PROJ_INTS),
  match: { state: 0, waveIndex: 0, waveCount: 0, nextWaveTick: 0, enemiesAlive: 0, gateHp: [], gateMax: [] },
});

/** Header'daki maç alanlarını frame'e kopyalar. */
export const readMatchHeader = (view: Int32Array, base: number, out: MatchInfo): void => {
  out.state = view[base + H_MATCH_STATE] as number;
  out.waveIndex = view[base + H_WAVE_INDEX] as number;
  out.waveCount = view[base + H_WAVE_COUNT] as number;
  out.nextWaveTick = view[base + H_NEXT_WAVE_TICK] as number;
  out.enemiesAlive = view[base + H_ENEMIES_ALIVE] as number;
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
    const simMicros = view[base + H_SIM_MICROS] as number;
    readMatchHeader(view, base, out.match);
    if (Atomics.load(view, base + H_VERSION) !== v1) continue;
    out.tick = tick;
    out.count = count;
    out.projCount = projCount;
    out.simMicros = simMicros;
    return true;
  }
  return false;
};
