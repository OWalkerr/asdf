import {
  DIFFICULTIES,
  fxAtan2,
  fxFromFloat,
  fxLen,
  type MapDef,
  MatchState,
  PP,
  type Vec2,
} from '@bulwark/shared';
import { addComponent, addEntity, query } from 'bitecs';
import { BattalionMode } from '../components';
import { SIM_HZ } from '../constants';
import { STAT } from '../unitStats';
import type { ScheduledGroup, SimWorld } from '../world';
import { orderBattalions, spawnBattalionRow } from './commands';
import { fortressDoor, setupFortress } from './fortress';

/** Saldıran (yapay zekâ) takım. */
export const ENEMY_TEAM = 1;

const fxv = (p: Vec2): [number, number] => [fxFromFloat(p[0]), fxFromFloat(p[1])];

/** Kapı yapıları ve dalga programı (harita yüklenirken bir kez). */
export const setupMatch = (world: SimWorld, map: MapDef): void => {
  const diff = DIFFICULTIES[world.match.difficulty] ?? (DIFFICULTIES[1] as (typeof DIFFICULTIES)[number]);
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
    Structure.kind[g] = 0;
    Structure.slot[g] = -1;
    world.match.gates.push(g);
  });
  setupFortress(world);
  const schedule: ScheduledGroup[] = [];
  map.waves.forEach((wave, wi) => {
    for (const g of wave.groups) {
      schedule.push({
        tick: Math.round(g.atSec * SIM_HZ),
        wave: wi + 1,
        spawn: map.spawns.findIndex((s) => s.id === g.spawn),
        unitType: g.unitType,
        // Zorluk: dalga büyüklüğü (boss ve koçbaşı sayısı değişmez).
        battalions:
          STAT.boss[g.unitType] === 1 || STAT.siegeOnly[g.unitType] === 1
            ? g.battalions
            : Math.max(1, Math.round((g.battalions * diff.waveSizePercent) / 100)),
      });
    }
  });
  // Kararlı sıralama (Array.prototype.sort spec gereği kararlıdır): tick, sonra tanım sırası.
  schedule.sort((a, b) => a.tick - b.tick);
  world.match.schedule = schedule;
  world.match.gold[0] = diff.startGold;
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
    const laneIndex = map.lanes.indexOf(lane);
    const goal = laneGoal(world, laneIndex);
    orderBattalions(world, battalions, goal.x, goal.z, ENEMY_TEAM, BattalionMode.AttackMove);
    for (const b of battalions) {
      world.c.Battalion.targetStructure[b] = goal.structure;
      world.c.Battalion.lane[b] = laneIndex + 1;
    }
    // Boss: takımının liderlik kaynağı (aura) olur.
    if (STAT.boss[g.unitType] === 1 && battalions[0] !== undefined) m.hero[ENEMY_TEAM] = battalions[0];
    // Dalga başı Güç Puanı bonusu (GDD §9.1).
    if (g.wave > m.waveIndex) m.pp[0] = (m.pp[0] as number) + PP.waveBonus * 10;
    m.waveIndex = Math.max(m.waveIndex, g.wave);
  }
};

/** Düşman yapay zekâsının yeniden değerlendirme aralığı (tick). */
const AI_INTERVAL = SIM_HZ;
/** Hedef kapıya bundan uzakta boşta kalan düşman taburu yeniden yola çıkar. */
const REGROUP_DIST = fxFromFloat(10);

/**
 * Koridorun şu anki hedefi (GDD §4.2 kapı zinciri): sıradaki ayakta kapı ve yaklaşma noktası;
 * zincir bittiyse kale (kapısının önü). TD'de çıkış noktası (yapı yok).
 */
export const laneGoal = (world: SimWorld, laneIndex: number): { structure: number; x: number; z: number } => {
  const map = world.map as MapDef;
  const m = world.match;
  const lane = map.lanes[laneIndex] as MapDef['lanes'][number];
  const [ex, ez] = fxv(lane.points[lane.points.length - 1] as Vec2);
  if (map.mode === 'TD') return { structure: 0, x: ex, z: ez };
  const chain = lane.targets ?? [lane.target];
  for (let k = 0; k < chain.length; k++) {
    const gi = map.gates.findIndex((gate) => gate.id === chain[k]);
    const g = m.gates[gi];
    if (g === undefined || (world.c.Structure.hp[g] as number) <= 0) continue;
    const gate = map.gates[gi] as MapDef['gates'][number];
    // İlk hedef: koridorun uç noktası; zincirdeki sonraki kapılar: kendi dış yaklaşma noktası.
    const [ax, az] = k === 0 ? [ex, ez] : fxv(gate.approach ?? gate.pos);
    return { structure: g, x: ax, z: az };
  }
  const [dx, dz] = fortressDoor(world);
  return { structure: m.fortress, x: dx, z: dz };
};

/**
 * Düşman taburu kuşatma inadı: hedef yapısı düşünce (gedik) zincirdeki sıradaki kapıya, en sonda
 * kaleye yönelir; boşta kalıp hedefinden uzaktaysa yeniden "saldırarak ilerle" emri alır.
 * Kalabalıkta veya çatışma sonrası yerleşen taburların ovada sonsuza dek beklemesini önler.
 */
export const enemyAiSystem = (world: SimWorld): void => {
  const map = world.map;
  if (!map || world.match.state !== MatchState.Playing || world.tick % AI_INTERVAL !== 0) return;
  const { Battalion, Position, Team, Structure } = world.c;
  for (const b of query(world, [Battalion, Position])) {
    if (Team.id[b] !== ENEMY_TEAM || Battalion.engaged[b]) continue;
    if ((Battalion.count[b] as number) === 0 || Battalion.mode[b] === BattalionMode.Attack) continue;
    const lane = (Battalion.lane[b] as number) - 1;
    if (lane < 0) continue;
    const goal = laneGoal(world, lane);
    const current = Battalion.targetStructure[b] as number;
    const retarget = goal.structure !== current;
    if (!retarget) {
      if (Battalion.active[b]) continue;
      const bx = Position.x[b] as number;
      const bz = Position.z[b] as number;
      const near =
        goal.structure !== 0
          ? fxLen(
              ((Position.x[goal.structure] as number) - bx) | 0,
              ((Position.z[goal.structure] as number) - bz) | 0,
            ) <=
            (((Structure.radius[goal.structure] as number) + REGROUP_DIST) | 0)
          : fxLen((goal.x - bx) | 0, (goal.z - bz) | 0) <= REGROUP_DIST;
      if (near) continue;
    }
    orderBattalions(world, [b], goal.x, goal.z, ENEMY_TEAM, BattalionMode.AttackMove);
    Battalion.targetStructure[b] = goal.structure;
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

/**
 * Zafer: tüm dalgalar çıktı ve canlı düşman kalmadı. Yenilgi (GDD §4): FD'de kale düştü,
 * TD'de canlar bitti. Kapılar yalnızca engeldir — kırılınca düşman içeri akar.
 */
export const matchSystem = (world: SimWorld): void => {
  const m = world.match;
  const map = world.map;
  if (!map || m.state !== MatchState.Playing) return;
  const fallen =
    map.mode === 'TD' ? m.lives <= 0 : m.fortress !== 0 && (world.c.Structure.hp[m.fortress] as number) <= 0;
  if (fallen) {
    m.state = MatchState.Defeat;
    return;
  }
  if (m.nextGroup >= m.schedule.length && m.enemiesAlive === 0) m.state = MatchState.Victory;
};
