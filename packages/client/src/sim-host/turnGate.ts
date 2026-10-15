/**
 * Lockstep tur kapısı (çok oyunculu, GDD §13.6). Zaman TURN_TICKS'lik turlara bölünür; her oyuncu
 * her tur için (boş da olsa) bir komut paketi yollar. Bir oyuncunun k. tur paketi, o turun ilk
 * tick'inde (k × TURN_TICKS) uygulanacak komutları taşır. Sim, tick t'yi ancak bütün oyuncuların
 * ⌊t / TURN_TICKS⌋. turunu aldıktan sonra işleyebilir. İlk TURN_DELAY tur herkes için boş sayılır
 * (giriş gecikmesi: komut verildiği andan ~TURN_DELAY tur sonra uygulanır).
 */
export const TURN_TICKS = 4;
export const TURN_DELAY = 3;

export class TurnGate {
  /** Oyuncu başına: alınmış (sıra dışı gelmiş) turlar ve sıradaki eksik tur. */
  private readonly got: Set<number>[];
  private readonly next: number[];

  constructor(
    readonly players: number,
    delay = TURN_DELAY,
  ) {
    this.got = Array.from({ length: players }, () => new Set<number>());
    this.next = Array.from({ length: players }, () => delay);
  }

  /** Oyuncunun bir turunu kaydet; yeni bilgiyse true. */
  receive(player: number, turn: number): boolean {
    const got = this.got[player];
    const nx = this.next[player];
    if (!got || nx === undefined || turn < nx || got.has(turn)) return false;
    got.add(turn);
    let n = nx;
    while (got.has(n)) {
      got.delete(n);
      n++;
    }
    this.next[player] = n;
    return true;
  }

  /** İşlenebilecek ilk OLMAYAN tick (bu tick'ten küçükler serbest). */
  limit(): number {
    return Math.min(...this.next) * TURN_TICKS;
  }

  /** Oyuncunun sıradaki eksik turu. */
  nextOf(player: number): number {
    return this.next[player] ?? 0;
  }

  /** Bekletilen (en geride kalan) oyuncular. */
  laggards(): number[] {
    const lo = Math.min(...this.next);
    return this.next.flatMap((n, p) => (n === lo ? [p] : []));
  }
}
