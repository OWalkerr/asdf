import { MAX_ENTITIES } from '../constants';

/**
 * Struct-of-Arrays bileşenler (GDD §13.4). Tüm alanlar TypedArray; konum/hız Q16.16.
 * Dünya başına ayrı oluşturulur: sunucu aynı süreçte birden fazla maçı headless çalıştırabilir.
 */
export const createComponents = (capacity = MAX_ENTITIES) => ({
  Position: { x: new Int32Array(capacity), z: new Int32Array(capacity) },
  Velocity: { x: new Int32Array(capacity), z: new Int32Array(capacity) },
  /** uint16 binary angle (0..65535 = 0..2π). */
  Facing: { angle: new Uint16Array(capacity) },
  Team: { id: new Uint8Array(capacity) },
});

export type Components = ReturnType<typeof createComponents>;
