import type { StampedCommand } from '@bulwark/shared';

/** Ana thread ↔ sim worker mesajları. */
export type ToWorker =
  /** mapId: MAP_DEFS anahtarı; null ise mapSize kenarlı açık ızgara (look-dev). */
  | {
      type: 'init';
      seed: number;
      capacity: number;
      view: Int32Array | null;
      mapId: string | null;
      mapSize: number;
      /** DIFFICULTIES indeksi. */
      difficulty: number;
      /** FACTIONS indeksi (0 Gondor, 1 Rohan). */
      faction: number;
      /** Çok oyunculu lockstep oyuncu sayısı (yoksa tek oyunculu). */
      players?: number;
      /** Kahraman Yarat sınıfı (-1 = yok). */
      cah?: number;
    }
  | { type: 'commands'; commands: StampedCommand[] }
  /** Bir oyuncunun bir tur paketi (komutlar o turun ilk tick'ine damgalı). */
  | { type: 'turn'; player: number; turn: number; commands: StampedCommand[] }
  | { type: 'speed'; value: number };

export type FromWorker =
  | { type: 'ready'; shared: boolean }
  /** Yalnızca SharedArrayBuffer yoksa: tek buffer'lık snapshot (transfer edilir). */
  | { type: 'frame'; snap: Int32Array }
  | { type: 'hash'; tick: number; hash: number }
  /** Lockstep: sim bu tick'te eksik tur bekliyor (bekletilen oyuncular). */
  | { type: 'wait'; tick: number; waiting: number[]; missing: { player: number; turn: number }[] }
  | { type: 'error'; message: string };

export const SIM_TICK_MS = 50;
/** Kaç tick'te bir durum hash'i yayınlanır (desync tespiti, GDD §13.6). */
export const HASH_INTERVAL = 10;
