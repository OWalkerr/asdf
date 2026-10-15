import { DEFAULT_DIFFICULTY, type MapDef, type StampedCommand } from '@bulwark/shared';
import { CommandQueue } from './commandQueue';
import type { NavGrid } from './nav/grid';
import { writeSnapshot } from './snapshot';
import { applyCommand } from './systems/commands';
import { createSimWorld, hashWorld, type SimWorld, stepWorld } from './world';

/**
 * Simülasyonun dış API'si: komut kuyruğu + sabit adımlı tick + snapshot.
 * Worker (tarayıcı), Node (sunucu doğrulaması) ve testlerde aynı şekilde kullanılır.
 */
export class Simulation {
  readonly world: SimWorld;
  readonly queue = new CommandQueue();

  /**
   * nav: haritanın navigasyon ızgarası (buildNavGrid); verilmezse açık ızgara.
   * map: verilirse kapılar ve dalga programı kurulur (FD maçı).
   * difficulty: DIFFICULTIES indeksi (varsayılan Normal); faction: FACTIONS indeksi (0 Gondor, 1 Rohan).
   * cah: Kahraman Yarat sınıfı (-1 = yok).
   */
  constructor(
    seed: number,
    nav?: NavGrid,
    map?: MapDef,
    difficulty = DEFAULT_DIFFICULTY,
    faction = 0,
    cah = -1,
  ) {
    this.world = createSimWorld(seed, nav, map ?? null, difficulty, faction, cah);
  }

  get tick(): number {
    return this.world.tick;
  }

  schedule(cmd: StampedCommand): void {
    this.queue.push(cmd);
  }

  /** Bir tick ilerlet: önce bu tick'in komutları, sonra sistem pipeline'ı. */
  step(): void {
    for (const sc of this.queue.take(this.world.tick)) applyCommand(this.world, sc);
    stepWorld(this.world);
  }

  hash(): number {
    return hashWorld(this.world);
  }

  writeSnapshot(view: Int32Array, simMicros = 0): number {
    return writeSnapshot(this.world, view, simMicros);
  }
}
