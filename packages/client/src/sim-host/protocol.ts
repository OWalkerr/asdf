import type { StampedCommand } from '@bulwark/shared';

/** Ana thread ↔ sim worker mesajları. */
export type ToWorker =
  | { type: 'init'; seed: number; capacity: number; view: Int32Array | null }
  | { type: 'commands'; commands: StampedCommand[] }
  | { type: 'speed'; value: number };

export type FromWorker =
  | { type: 'ready'; shared: boolean }
  /** Yalnızca SharedArrayBuffer yoksa: kompakt snapshot (transfer edilir). */
  | { type: 'frame'; tick: number; count: number; simMicros: number; units: Int32Array }
  | { type: 'hash'; tick: number; hash: number }
  | { type: 'error'; message: string };

export const SIM_TICK_MS = 50;
/** Kaç tick'te bir durum hash'i yayınlanır (desync tespiti, GDD §13.6). */
export const HASH_INTERVAL = 10;
