/// <reference lib="webworker" />
import {
  bufferOffset,
  createSnapshotView,
  G_ACTIVE,
  G_CAPACITY,
  H_COUNT,
  MAP_DEFS,
  SNAP_HEADER_INTS,
  SNAP_UNIT_INTS,
} from '@bulwark/shared';
import { buildNavGrid, createOpenGrid, Simulation } from '@bulwark/sim';
import { type FromWorker, HASH_INTERVAL, SIM_TICK_MS, type ToWorker } from './protocol';

/**
 * Sim worker (GDD §13.3): sabit 20 Hz tick, komut kuyruğu, snapshot yayını.
 * Zamanlama (performance.now) burada, sim paketinin dışında kalır — sim yalnızca tick sayar.
 */
declare const self: DedicatedWorkerGlobalScope;

let sim: Simulation | null = null;
let view: Int32Array | null = null;
let shared = false;
let speed = 1;
let nextAt = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

const post = (msg: FromWorker, transfer: Transferable[] = []) => self.postMessage(msg, transfer);

const tick = () => {
  if (!sim || !view) return;
  const t0 = performance.now();
  sim.step();
  const micros = Math.round((performance.now() - t0) * 1000);
  sim.writeSnapshot(view, micros);
  if (!shared) {
    // Fallback: aktif buffer'ı kompakt kopya olarak gönder (transfer, kopyasız).
    const cap = view[G_CAPACITY] as number;
    const base = bufferOffset(cap, Atomics.load(view, G_ACTIVE));
    const count = view[base + H_COUNT] as number;
    const start = base + SNAP_HEADER_INTS;
    const units = view.slice(start, start + count * SNAP_UNIT_INTS);
    post({ type: 'frame', tick: sim.tick, count, simMicros: micros, units }, [units.buffer]);
  }
  if (sim.tick % HASH_INTERVAL === 0) post({ type: 'hash', tick: sim.tick, hash: sim.hash() });
};

const loop = () => {
  const now = performance.now();
  const interval = SIM_TICK_MS / speed;
  let steps = 0;
  // Gecikmeyi yakala ama spiral of death'e girme (en fazla 5 tick).
  while (now >= nextAt && steps < 5) {
    tick();
    nextAt += interval;
    steps++;
  }
  if (steps === 5) nextAt = now + interval;
  timer = setTimeout(loop, Math.max(0, nextAt - performance.now()));
};

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  try {
    switch (msg.type) {
      case 'init':
        {
          const def = msg.mapId ? MAP_DEFS[msg.mapId] : undefined;
          const nav = def ? buildNavGrid(def) : createOpenGrid(msg.mapSize);
          sim = new Simulation(msg.seed, nav);
        }
        shared = msg.view !== null;
        view = msg.view ?? createSnapshotView(msg.capacity, false);
        nextAt = performance.now();
        if (timer) clearTimeout(timer);
        loop();
        post({ type: 'ready', shared });
        break;
      case 'commands':
        for (const c of msg.commands) sim?.schedule(c);
        break;
      case 'speed':
        speed = Math.max(0.05, Math.min(8, msg.value));
        break;
    }
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
