import { fxAtan2, fxFromFloat, type MapDef, MatchState, type Vec2 } from '@bulwark/shared';
import { addComponent, addEntity } from 'bitecs';
import { BattalionMode } from '../components';
import { SIM_HZ } from '../constants';
import type { ScheduledGroup, SimWorld } from '../world';
import { orderBattalions, spawnBattalionRow } from './commands';

/** Saldıran (yapay zekâ) takım. */
export const ENEMY_TEAM = 1;

const fxv = (p: Vec2): [number, number] => [fxFromFloat(p[0]), fxFromFloat(p[1])];

/** Kapı yapıları ve dalga programı (harita yüklenirken bir kez). */
export const setupMatch = (world: SimWorld, map: MapDef): void => {
  const { Position, Team, Structure } = world.c;
  map.gates.forEach((gate, i) => {
    const g = addEntity(world);
    for (const comp of [Position, Team, Structure]) addComponent(world, g, comp);
    [Position.x[g], Position.z[g]] = fxv(gate.pos);
    Team.id[g] = 0;
    Structure.hp[g] = gate.hp;
    Structure.max[g] = gate.hp;
    // Saldırılabilir yarıçap: kapı yarı genişliği + duvar kalınlığı payı (ön sıra erişebilsin).
    Structure.radius[g] = fxFromFloat(gate.width / 2 + 2.5);
    Structure.gateIndex[g] = i;
    world.match.gates.push(g);
  });
  const schedule: ScheduledGroup[] = [];
  map.waves.forEach((wave, wi) => {
    for (const g of wave.groups) {
      schedule.push({
        tick: Math.round(g.atSec * SIM_HZ),
        wave: wi + 1,
        spawn: map.spawns.findIndex((s) => s.id === g.spawn),
        unitType: g.unitType,
        battalions: g.battalions,
      });
    }
  });
  // Kararlı sıralama (Array.prototype.sort spec gereği kararlıdır): tick, sonra tanım sırası.
  schedule.sort((a, b) => a.tick - b.tick);
  world.match.schedule = schedule;
  world.match.waveCount = map.waves.length;
};

/** Zamanı gelen dalga gruplarını oluşturur ve rotalarına "saldırarak ilerle" emriyle yollar. */
export const waveSystem = (world: SimWorld): void => {
  const map = world.map;
  const m = world.match;
  if (!map || m.state !== MatchState.Playing) return;
  while (m.nextGroup < m.schedule.length && (m.schedule[m.nextGroup] as ScheduledGroup).tick <= world.tick) {
    const g = m.schedule[m.nextGroup++] as ScheduledGroup;
    const spawn = map.spawns[g.spawn];
    if (!spawn) continue;
    const lane = map.lanes.find((l) => l.id === spawn.lane);
    if (!lane) continue;
    const [sx, sz] = fxv(spawn.pos);
    const [nx, nz] = fxv(lane.points[1] ?? spawn.pos);
    const facing = fxAtan2((nz - sz) | 0, (nx - sx) | 0);
    const battalions = spawnBattalionRow(world, ENEMY_TEAM, g.unitType, sx, sz, g.battalions, facing);
    const [tx, tz] = fxv(lane.points[lane.points.length - 1] as Vec2);
    orderBattalions(world, battalions, tx, tz, ENEMY_TEAM, BattalionMode.AttackMove);
    const gateIndex = map.gates.findIndex((gate) => gate.id === lane.target);
    const structure = gateIndex >= 0 ? (m.gates[gateIndex] as number) : 0;
    for (const b of battalions) world.c.Battalion.targetStructure[b] = structure;
    m.waveIndex = Math.max(m.waveIndex, g.wave);
  }
};

/** Bir sonraki (henüz başlamamış) dalganın başlama tick'i; yoksa -1. */
export const nextWaveTick = (world: SimWorld): number => {
  const m = world.match;
  for (let i = m.nextGroup; i < m.schedule.length; i++) {
    const g = m.schedule[i] as ScheduledGroup;
    if (g.wave > m.waveIndex) return g.tick;
  }
  return -1;
};

/** Zafer: tüm dalgalar çıktı ve canlı düşman kalmadı. Yenilgi: bir kapı düştü (GDD §4.2). */
export const matchSystem = (world: SimWorld): void => {
  const m = world.match;
  if (!world.map || m.state !== MatchState.Playing) return;
  for (const g of m.gates) {
    if ((world.c.Structure.hp[g] as number) <= 0) {
      m.state = MatchState.Defeat;
      return;
    }
  }
  if (m.nextGroup >= m.schedule.length && m.enemiesAlive === 0) m.state = MatchState.Victory;
};
