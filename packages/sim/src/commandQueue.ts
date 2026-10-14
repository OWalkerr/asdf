import { compareStamped, type StampedCommand } from '@bulwark/shared';

/**
 * Tick'e göre bekleyen komutlar. Geç gelen komut (tick < mevcut) bir sonraki
 * tick'te uygulanır — yalnızca yerel modda olur; MP'de sunucu turn'ü kapatır.
 */
export class CommandQueue {
  private pending: StampedCommand[] = [];

  push(cmd: StampedCommand): void {
    this.pending.push(cmd);
  }

  /** `tick` ve öncesine ait komutları deterministik sırayla çıkarır. */
  take(tick: number): StampedCommand[] {
    if (this.pending.length === 0) return [];
    const due: StampedCommand[] = [];
    const rest: StampedCommand[] = [];
    for (const c of this.pending) (c.tick <= tick ? due : rest).push(c);
    this.pending = rest;
    return due.sort(compareStamped);
  }

  get size(): number {
    return this.pending.length;
  }
}
