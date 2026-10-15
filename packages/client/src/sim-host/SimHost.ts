import {
  type Command,
  createFrame,
  createSnapshotView,
  readLatestSnapshot,
  SNAP_UNIT_INTS,
  type SnapshotFrame,
  type StampedCommand,
} from '@bulwark/shared';
import { MAX_ENTITIES } from '@bulwark/sim';
import { type FromWorker, SIM_TICK_MS, type ToWorker } from './protocol';

/**
 * Ana thread tarafı sim köprüsü (GDD §13.3):
 * - Komutları tick ile damgalar ve worker'a iletir (LocalTransport — solo; Phase 4'te
 *   aynı arayüzü Colyseus transport'u uygulayacak).
 * - Snapshot'ları okur (SharedArrayBuffer veya postMessage fallback) ve iki ardışık
 *   snapshot arasında ara değerleme için durum tutar.
 */
export interface SimHostOptions {
  seed: number;
  capacity: number;
  /** MAP_DEFS anahtarı (null = look-dev, açık ızgara). */
  mapId: string | null;
  mapSize: number;
  /** DIFFICULTIES indeksi (varsayılan Normal). */
  difficulty?: number;
  faction?: number;
  /** Komutun uygulanacağı tick = son görülen tick + inputDelay (lockstep'te ≥ 2). */
  inputDelay?: number;
  /** Çok oyunculu lockstep oyuncu sayısı (yoksa tek oyunculu). */
  players?: number;
}

export class SimHost {
  readonly shared: boolean;
  player = 0;
  inputDelay: number;
  lastHash = { tick: 0, hash: 0 };

  private readonly worker: Worker;
  private readonly view: Int32Array | null;
  private prev: SnapshotFrame;
  private curr: SnapshotFrame;
  private scratch: SnapshotFrame;
  private currAt = 0;
  private seq = 0;
  /** eid → prev frame içindeki kayıt indeksi + 1. */
  private readonly prevIndex = new Int32Array(MAX_ENTITIES);
  private frameListeners: ((frame: SnapshotFrame) => void)[] = [];

  private constructor(worker: Worker, view: Int32Array | null, capacity: number, inputDelay: number) {
    this.worker = worker;
    this.view = view;
    this.shared = view !== null;
    this.inputDelay = inputDelay;
    this.prev = createFrame(capacity);
    this.curr = createFrame(capacity);
    this.scratch = createFrame(capacity);
  }

  static async start(opts: SimHostOptions): Promise<SimHost> {
    const worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module', name: 'sim' });
    // `?nosab`: postMessage yedek yolunu test etmek için SharedArrayBuffer'ı devre dışı bırakır.
    const forceNoSab = new URLSearchParams(location.search).has('nosab');
    const canShare =
      !forceNoSab && typeof SharedArrayBuffer !== 'undefined' && globalThis.crossOriginIsolated === true;
    const view = canShare ? createSnapshotView(opts.capacity, true) : null;
    const host = new SimHost(worker, view, opts.capacity, opts.inputDelay ?? 1);
    await new Promise<void>((resolve, reject) => {
      worker.onerror = (e) => reject(new Error(`Sim worker hatası: ${e.message}`));
      worker.onmessage = (e: MessageEvent<FromWorker>) => {
        const msg = e.data;
        if (msg.type === 'ready') resolve();
        host.onMessage(msg);
      };
      host.post({
        type: 'init',
        seed: opts.seed,
        capacity: opts.capacity,
        view,
        mapId: opts.mapId,
        mapSize: opts.mapSize,
        difficulty: opts.difficulty ?? 1,
        faction: opts.faction ?? 0,
        players: opts.players,
      });
    });
    return host;
  }

  /** Son alınan snapshot'ın tick'i. */
  get tick(): number {
    return this.curr.tick;
  }

  get frame(): SnapshotFrame {
    return this.curr;
  }

  onFrame(cb: (frame: SnapshotFrame) => void): void {
    this.frameListeners.push(cb);
  }

  /** Çok oyunculu: komutlar tur paketine toplanır (NetSession); null = yerel. */
  net: ((cmd: Command) => void) | null = null;

  send(cmd: Command, player = this.player): void {
    if (this.net) {
      this.net(cmd);
      return;
    }
    const stamped: StampedCommand = {
      tick: Math.max(0, this.curr.tick) + this.inputDelay,
      player,
      seq: this.seq++,
      cmd,
    };
    this.post({ type: 'commands', commands: [stamped] });
  }

  /** Lockstep: bir oyuncunun tur paketini worker'a ilet. */
  postTurn(player: number, turn: number, commands: StampedCommand[]): void {
    this.post({ type: 'turn', player, turn, commands });
  }

  private waitListeners: ((waiting: number[]) => void)[] = [];
  private hashListeners: ((tick: number, hash: number) => void)[] = [];

  onWait(cb: (waiting: number[]) => void): void {
    this.waitListeners.push(cb);
  }

  onHash(cb: (tick: number, hash: number) => void): void {
    this.hashListeners.push(cb);
  }

  /** Oyun hızı (0 = duraklat). Ara değerleme tick süresini buna göre ölçekler. */
  speed = 1;

  setSpeed(value: number): void {
    if (this.net) return; // çok oyunculuda hız sabit
    this.speed = value;
    this.post({ type: 'speed', value });
  }

  /** Her render karesinde çağrılır: yeni snapshot varsa alır. */
  poll(now: number): void {
    if (!this.view) return;
    if (readLatestSnapshot(this.view, this.scratch)) this.rotate(now);
  }

  /** prev → curr arası ara değer katsayısı [0, 1]. */
  alpha(now: number): number {
    if (this.speed <= 0) return 1;
    return Math.min(1, Math.max(0, ((now - this.currAt) * this.speed) / SIM_TICK_MS));
  }

  /** Bu eid'in önceki snapshot'taki kaydının başlangıç indeksi, yoksa -1. */
  prevOffset(eid: number): number {
    const i = this.prevIndex[eid] ?? 0;
    return i > 0 ? (i - 1) * SNAP_UNIT_INTS : -1;
  }

  get previous(): SnapshotFrame {
    return this.prev;
  }

  dispose(): void {
    this.worker.terminate();
  }

  private rotate(now: number): void {
    // prev'in indeksini temizle, kaydır, yeni prev'i indeksle.
    const old = this.prev;
    for (let i = 0; i < old.count; i++) this.prevIndex[old.units[i * SNAP_UNIT_INTS] as number] = 0;
    this.prev = this.curr;
    this.curr = this.scratch;
    this.scratch = old;
    for (let i = 0; i < this.prev.count; i++)
      this.prevIndex[this.prev.units[i * SNAP_UNIT_INTS] as number] = i + 1;
    this.currAt = now;
    for (const cb of this.frameListeners) cb(this.curr);
  }

  private onMessage(msg: FromWorker): void {
    switch (msg.type) {
      case 'frame':
        if (readLatestSnapshot(msg.snap, this.scratch)) this.rotate(performance.now());
        break;
      case 'hash':
        this.lastHash = { tick: msg.tick, hash: msg.hash };
        for (const cb of this.hashListeners) cb(msg.tick, msg.hash);
        break;
      case 'wait':
        for (const cb of this.waitListeners) cb(msg.waiting);
        break;
      case 'error':
        console.error('[sim]', msg.message);
        break;
    }
  }

  private post(msg: ToWorker): void {
    this.worker.postMessage(msg);
  }
}
