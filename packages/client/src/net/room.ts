/**
 * Tarayıcı odası (artifact `room` yeteneği) için ince arayüz. Lobi = herkesin paylaştığı oda;
 * her maç kendi adlı odasında (`join`). Bütün çok oyunculu veri `presence` üzerinden taşınır:
 * platform onu güvenilir biçimde (son değer kazanır) herkese iletir, yeni gelene verir ve
 * yeniden bağlanınca yeniden yollar; konu (topic) izni gerektirmez — izleyiciler de oynayabilir.
 *
 * `?netlocal`: aynı tarayıcıdaki sekmeler arasında BroadcastChannel ile çalışan yerel oda
 * (geliştirme ve otomatik test için).
 */
export type Json = unknown;

export interface Peer {
  /** Açık belge başına opak etiket (platform damgalar; taklit edilemez). */
  peer: string;
  sameTab: boolean;
  presence: Readonly<Record<string, Json>>;
}

export interface PeersChange {
  peers: readonly Peer[];
  joined: readonly Peer[];
  left: readonly Peer[];
  updated: readonly Peer[];
}

export interface RoomLike {
  presence(patch: Record<string, Json | null>): Promise<void>;
  peers(): readonly Peer[];
  onPeers(handler: (change: PeersChange) => void): () => void;
  connected(): boolean;
}

export interface NamedRoom extends RoomLike {
  readonly name: string;
  leave(): Promise<void>;
}

export interface Lobby extends RoomLike {
  join(name: string): Promise<NamedRoom>;
}

/** Bu belgenin peer etiketi (sameTab kaydından). */
export const selfPeer = (room: RoomLike): string | null => room.peers().find((p) => p.sameTab)?.peer ?? null;

interface ClaudeHost {
  use?: (name: string) => Promise<unknown>;
}

let lobbyPromise: Promise<Lobby | null> | null = null;

/** Lobi odası; bu görünüm odaya bağlanamıyorsa null. */
export const getLobby = (): Promise<Lobby | null> => {
  if (lobbyPromise) return lobbyPromise;
  if (new URLSearchParams(location.search).has('netlocal')) {
    lobbyPromise = Promise.resolve(new LocalRoom('') as Lobby);
    return lobbyPromise;
  }
  const claude = (globalThis as { claude?: ClaudeHost }).claude;
  if (!claude?.use) {
    lobbyPromise = Promise.resolve(null);
    return lobbyPromise;
  }
  lobbyPromise = claude
    .use('room')
    .then((r) => (r ? (r as Lobby) : null))
    .catch(() => null);
  return lobbyPromise;
};

// --- Yerel oda (BroadcastChannel) ------------------------------------------------------

interface LocalMsg {
  room: string;
  peer: string;
  presence: Record<string, Json> | null;
  /** Yeni gelen: herkes durumunu yeniden yollasın. */
  hello?: boolean;
}

const LOCAL_ID = Math.random().toString(36).slice(2, 12);

class LocalRoom implements Lobby, NamedRoom {
  private readonly ch = new BroadcastChannel('bulwark-netlocal');
  private mine: Record<string, Json> = {};
  private others = new Map<string, { presence: Record<string, Json>; seen: number }>();
  private handlers: ((c: PeersChange) => void)[] = [];
  private snapshot: Peer[] = [];
  private pending: { joined: Set<string>; left: Peer[]; updated: Set<string> } = {
    joined: new Set([LOCAL_ID]),
    left: [],
    updated: new Set(),
  };
  private flushQueued = false;
  private readonly beat: ReturnType<typeof setInterval>;
  private closed = false;

  constructor(readonly name: string) {
    this.ch.onmessage = (e: MessageEvent<LocalMsg>) => this.receive(e.data);
    this.post(true);
    this.beat = setInterval(() => {
      this.post(false);
      const now = Date.now();
      for (const [peer, o] of this.others)
        if (now - o.seen > 12000) {
          this.others.delete(peer);
          this.pending.left.push(this.peerOf(peer, o.presence));
          this.queueFlush();
        }
    }, 1000);
    this.rebuild();
    this.queueFlush();
  }

  private peerOf(peer: string, presence: Record<string, Json>): Peer {
    return Object.freeze({ peer, sameTab: peer === LOCAL_ID, presence: Object.freeze({ ...presence }) });
  }

  private post(hello: boolean): void {
    if (this.closed) return;
    const msg: LocalMsg = { room: this.name, peer: LOCAL_ID, presence: this.mine, hello };
    this.ch.postMessage(msg);
  }

  private receive(m: LocalMsg): void {
    if (m.room !== this.name || m.peer === LOCAL_ID || this.closed) return;
    if (m.presence === null) {
      const o = this.others.get(m.peer);
      if (o) {
        this.others.delete(m.peer);
        this.pending.left.push(this.peerOf(m.peer, o.presence));
        this.queueFlush();
      }
      return;
    }
    const o = this.others.get(m.peer);
    if (!o) this.pending.joined.add(m.peer);
    else if (JSON.stringify(o.presence) !== JSON.stringify(m.presence)) this.pending.updated.add(m.peer);
    this.others.set(m.peer, { presence: m.presence, seen: Date.now() });
    if (m.hello) this.post(false);
    this.queueFlush();
  }

  private rebuild(): void {
    this.snapshot = [
      this.peerOf(LOCAL_ID, this.mine),
      ...[...this.others].map(([peer, o]) => this.peerOf(peer, o.presence)),
    ];
  }

  private queueFlush(): void {
    if (this.flushQueued) return;
    this.flushQueued = true;
    setTimeout(() => {
      this.flushQueued = false;
      this.rebuild();
      const by = (ids: Set<string>) => this.snapshot.filter((p) => ids.has(p.peer));
      const change: PeersChange = {
        peers: this.snapshot,
        joined: by(this.pending.joined),
        left: this.pending.left,
        updated: by(this.pending.updated),
      };
      this.pending = { joined: new Set(), left: [], updated: new Set() };
      for (const h of this.handlers) h(change);
    }, 0);
  }

  presence(patch: Record<string, Json | null>): Promise<void> {
    const next: Record<string, Json> = { ...this.mine };
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) delete next[k];
      else next[k] = v;
    }
    this.mine = next;
    // Platform gibi: kendi presence'ın peers()'te hemen görünür.
    this.rebuild();
    this.pending.updated.add(LOCAL_ID);
    this.post(false);
    this.queueFlush();
    return Promise.resolve();
  }

  peers(): readonly Peer[] {
    return this.snapshot;
  }

  onPeers(handler: (change: PeersChange) => void): () => void {
    this.handlers.push(handler);
    // İlk teslim: odadaki herkes "joined".
    setTimeout(() => handler({ peers: this.snapshot, joined: this.snapshot, left: [], updated: [] }), 0);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  connected(): boolean {
    return !this.closed;
  }

  join(name: string): Promise<NamedRoom> {
    return Promise.resolve(new LocalRoom(name));
  }

  leave(): Promise<void> {
    if (!this.closed) {
      this.ch.postMessage({ room: this.name, peer: LOCAL_ID, presence: null } satisfies LocalMsg);
      this.closed = true;
      clearInterval(this.beat);
      this.handlers = [];
      this.ch.close();
    }
    return Promise.resolve();
  }
}
