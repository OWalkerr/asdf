/**
 * Sim → render snapshot düzeni (GDD §13.3).
 *
 * Tek bir Int32Array (SharedArrayBuffer üzerinde veya fallback'te düz ArrayBuffer):
 *
 *   [global header: 4]  activeIndex, publishCount, capacity, reserved
 *   [buffer 0: header 8 + capacity × 5]
 *   [buffer 1: header 8 + capacity × 5]
 *
 * Buffer header: version (seqlock; tek = yazılıyor), tick, count, simMicros, …
 * Birim kaydı (6 × int32 = 24 bayt):
 *   0 eid
 *   1 x  (Q16.16)
 *   2 z  (Q16.16)
 *   3 yaw:16 | unitType:8 | team:8
 *   4 anim:8 | flags:8 | hp8:8 | animTick:8
 *   5 tabur eid'i (0 = taburda değil)
 *
 * Konumlar ham Q16.16 olarak taşınır; float'a çeviri render tarafında yapılır
 * (sim paketi float üretmez — GDD §13.7).
 */
export const SNAP_GLOBAL_INTS = 4;
export const SNAP_HEADER_INTS = 8;
export const SNAP_UNIT_INTS = 6;

export const G_ACTIVE = 0;
export const G_PUBLISH = 1;
export const G_CAPACITY = 2;

export const H_VERSION = 0;
export const H_TICK = 1;
export const H_COUNT = 2;
export const H_SIM_MICROS = 3;

export const snapshotInts = (capacity: number): number =>
  SNAP_GLOBAL_INTS + 2 * (SNAP_HEADER_INTS + capacity * SNAP_UNIT_INTS);

export const bufferOffset = (capacity: number, index: number): number =>
  SNAP_GLOBAL_INTS + index * (SNAP_HEADER_INTS + capacity * SNAP_UNIT_INTS);

export const createSnapshotView = (capacity: number, shared: boolean): Int32Array => {
  const bytes = snapshotInts(capacity) * 4;
  const view = new Int32Array(shared ? new SharedArrayBuffer(bytes) : new ArrayBuffer(bytes));
  view[G_CAPACITY] = capacity;
  view[G_ACTIVE] = 0;
  return view;
};

export const packYawTypeTeam = (yaw: number, unitType: number, team: number): number =>
  ((yaw & 0xffff) << 16) | ((unitType & 0xff) << 8) | (team & 0xff);

export const packAnim = (anim: number, flags: number, hp8: number, animTick: number): number =>
  ((anim & 0xff) << 24) | ((flags & 0xff) << 16) | ((hp8 & 0xff) << 8) | (animTick & 0xff);

export const unpackYaw = (v: number): number => (v >>> 16) & 0xffff;
export const unpackUnitType = (v: number): number => (v >>> 8) & 0xff;
export const unpackTeam = (v: number): number => v & 0xff;
export const unpackAnimState = (v: number): number => (v >>> 24) & 0xff;
export const unpackHp8 = (v: number): number => (v >>> 8) & 0xff;
export const unpackAnimTick = (v: number): number => v & 0xff;

/** Okunan tek bir snapshot (render tarafının kendi kopyası). */
export interface SnapshotFrame {
  tick: number;
  count: number;
  simMicros: number;
  /** count × SNAP_UNIT_INTS kayıt. */
  units: Int32Array;
}

export const createFrame = (capacity: number): SnapshotFrame => ({
  tick: -1,
  count: 0,
  simMicros: 0,
  units: new Int32Array(capacity * SNAP_UNIT_INTS),
});

/**
 * En son yayınlanan buffer'ı `out`a kopyalar (seqlock: yazıcı araya girerse tekrar dener).
 * Yeni bir tick yoksa (out.tick aynıysa) false döner.
 */
export const readLatestSnapshot = (view: Int32Array, out: SnapshotFrame): boolean => {
  const capacity = view[G_CAPACITY] as number;
  for (let attempt = 0; attempt < 4; attempt++) {
    const index = Atomics.load(view, G_ACTIVE);
    const base = bufferOffset(capacity, index);
    const v1 = Atomics.load(view, base + H_VERSION);
    if (v1 & 1) continue;
    const tick = view[base + H_TICK] as number;
    if (tick === out.tick) return false;
    const count = Math.min(view[base + H_COUNT] as number, capacity);
    const start = base + SNAP_HEADER_INTS;
    out.units.set(view.subarray(start, start + count * SNAP_UNIT_INTS));
    const simMicros = view[base + H_SIM_MICROS] as number;
    if (Atomics.load(view, base + H_VERSION) !== v1) continue;
    out.tick = tick;
    out.count = count;
    out.simMicros = simMicros;
    return true;
  }
  return false;
};
