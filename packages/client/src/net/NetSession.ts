import type { Command, StampedCommand } from '@bulwark/shared';
import type { SimHost } from '../sim-host/SimHost';
import { TURN_DELAY, TURN_TICKS, TurnGate } from '../sim-host/turnGate';
import type { NamedRoom, Peer } from './room';

/**
 * Lockstep ağ oturumu (ortak savunma). Her oyuncu her tur için komut paketini kendi
 * presence'ına yazar: `net = { b: ilkTur, l: [tur b komutları, tur b+1 …] }` — son birkaç tur
 * birlikte taşınır, böylece kaçırılan bir güncelleme sonrakiyle telafi edilir. Presence
 * "son değer kazanır" ve yeni gelene/yeniden bağlanana yeniden verildiği için tur kaybolmaz;
 * sim, herkesin turu gelene kadar bekler (TurnGate). Oyuncu sırası = başlatma listesindeki
 * peer sırası (platform damgalı, taklit edilemez).
 */
export interface NetStart {
  /** Başlatma listesi: oyuncu i'nin peer etiketi. */
  order: string[];
  nicks: string[];
  me: number;
}

/** Bir presence güncellemesinde taşınan en fazla tur ve bayt (presence ≤ 4 KiB). */
const WINDOW_TURNS = 16;
const WINDOW_BYTES = 3300;
/** Desync denetimi: kaç tick'te bir hash yayınlanır. */
const HASH_EVERY = 100;

export class NetSession {
  private outbox: Command[] = [];
  private sendTurn = TURN_DELAY;
  private readonly history = new Map<number, Command[]>();
  private readonly recv: TurnGate;
  private readonly hashes = new Map<number, number>();
  private lastHash: [number, number] | null = null;
  private lastWaitAt = 0;
  private waitingFor: number[] = [];
  private readonly timer: ReturnType<typeof setInterval>;
  private readonly unsub: () => void;
  /** Ayrılan oyuncular (peer). */
  readonly gone = new Set<number>();
  desync = false;

  /** Durum değişti (bekleme, ayrılma, desync) — arayüz için. */
  onStatus: (() => void) | null = null;

  constructor(
    private readonly room: NamedRoom,
    private readonly host: SimHost,
    readonly start: NetStart,
  ) {
    this.recv = new TurnGate(start.order.length);
    host.net = (cmd) => this.outbox.push(cmd);
    host.onWait((waiting) => {
      this.lastWaitAt = performance.now();
      this.waitingFor = waiting.filter((p) => p !== start.me);
    });
    host.onHash((tick, hash) => {
      this.hashes.set(tick, hash);
      if (this.hashes.size > 64) this.hashes.delete(this.hashes.keys().next().value as number);
      if (tick % HASH_EVERY === 0) this.lastHash = [tick, hash];
    });
    this.unsub = room.onPeers((c) => {
      for (const p of [...c.joined, ...c.updated]) {
        const i = start.order.indexOf(p.peer);
        if (this.gone.delete(i)) this.onStatus?.();
        this.read(p);
      }
      for (const p of c.left) {
        const i = start.order.indexOf(p.peer);
        if (i >= 0 && i !== start.me) {
          this.gone.add(i);
          this.onStatus?.();
        }
      }
    });
    for (const p of room.peers()) this.read(p);
    this.timer = setInterval(() => this.pump(), 15);
  }

  /** Sim, bir oyuncunun turunu bekliyor mu (son ~0,6 sn)? */
  waiting(): string[] {
    if (performance.now() - this.lastWaitAt > 600) return [];
    return this.waitingFor.map((p) => this.start.nicks[p] ?? `Oyuncu ${p + 1}`);
  }

  private stamp(cmds: readonly Command[], turn: number, player: number): StampedCommand[] {
    return cmds.map((cmd, seq) => ({ tick: turn * TURN_TICKS, player, seq, cmd }));
  }

  /** Sırası gelen kendi turlarını kapat, sim'e ve odaya ver. */
  private pump(): void {
    let sent = false;
    while (this.host.tick >= (this.sendTurn - TURN_DELAY) * TURN_TICKS) {
      const turn = this.sendTurn++;
      const cmds = this.outbox;
      this.outbox = [];
      this.history.set(turn, cmds);
      this.history.delete(turn - 64);
      this.host.postTurn(this.start.me, turn, this.stamp(cmds, turn, this.start.me));
      sent = true;
    }
    if (sent) this.publish();
  }

  private publish(): void {
    const last = this.sendTurn - 1;
    const list: Command[][] = [];
    let bytes = 40;
    let b = last;
    for (let t = last; t >= Math.max(TURN_DELAY, last - WINDOW_TURNS + 1); t--) {
      const cmds = this.history.get(t) ?? [];
      const size = JSON.stringify(cmds).length + 1;
      if (list.length > 0 && bytes + size > WINDOW_BYTES) break;
      list.unshift(cmds);
      bytes += size;
      b = t;
    }
    void this.room.presence({ net: { b, l: list, h: this.lastHash } }).catch(() => {});
  }

  private read(p: Peer): void {
    const player = this.start.order.indexOf(p.peer);
    if (player < 0 || player === this.start.me) return;
    const net = p.presence.net as { b?: unknown; l?: unknown; h?: unknown } | undefined;
    if (!net || typeof net.b !== 'number' || !Array.isArray(net.l)) return;
    const base = net.b;
    net.l.forEach((cmds, i) => {
      if (!Array.isArray(cmds)) return;
      const turn = base + i;
      if (this.recv.receive(player, turn))
        this.host.postTurn(player, turn, this.stamp(cmds as Command[], turn, player));
    });
    if (Array.isArray(net.h) && net.h.length === 2) {
      const [tick, hash] = net.h as [number, number];
      const mine = this.hashes.get(tick);
      if (mine !== undefined && mine !== hash && !this.desync) {
        this.desync = true;
        console.warn('[net] senkron bozuldu, tick', tick);
        this.onStatus?.();
      }
    }
  }

  dispose(): void {
    clearInterval(this.timer);
    this.unsub();
    this.host.net = null;
    void this.room.leave();
  }
}
