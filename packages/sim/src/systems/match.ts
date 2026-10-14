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
    const [tx, tz] = fxv(lane.points[lane.points.length - 1] as Vec2);
    orderBattalions(world, battalions, tx, tz, ENEMY_TEAM, BattalionMode.AttackMove);
    const gateIndex = map.gates.findIndex((gate) => gate.id === lane.target);
    const structure = gateIndex >= 0 ? (m.gates[gateIndex] as number) : 0;
    for (const b of battalions) world.c.Battalion.targetStructure[b] = structure;
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
 * Düşman taburu kuşatma inadı: hedef kapısı ayaktayken boşta (varmış/yerleşmiş, çatışmada değil)
 * ve kapıdan uzaktaysa, kendi koridorunun kapı ucuna yeniden "saldırarak ilerle" emri alır.
 * Kalabalıkta veya çatışma sonrası yerleşen taburların ovada sonsuza dek beklemesini önler.
 */
export const enemyAiSystem = (world: SimWorld): void => {
  const map = world.map;
  if (!map || world.match.state !== MatchState.Playing || world.tick % AI_INTERVAL !== 0) return;
  const { Battalion, Position, Team, Structure } = world.c;
  for (const b of query(world, [Battalion, Position])) {
    if (Team.id[b] !== ENEMY_TEAM || Battalion.active[b] || Battalion.engaged[b]) continue;
    if ((Battalion.count[b] as number) === 0 || Battalion.mode[b] === BattalionMode.Attack) continue;
    const g = Battalion.targetStructure[b] as number;
    if (g === 0 || (Structure.hp[g] as number) <= 0) continue;
    const bx = Position.x[b] as number;
    const bz = Position.z[b] as number;
    const reach = ((Structure.radius[g] as number) + REGROUP_DIST) | 0;
    if (fxLen(((Position.x[g] as number) - bx) | 0, ((Position.z[g] as number) - bz) | 0) <= reach) continue;
    // Bu kapıya giden koridorlardan uç noktası en yakın olanı.
    const gateId = map.gates[Structure.gateIndex[g] as number]?.id;
    let best: [number, number] | null = null;
    let bestD = 0x7fffffff;
    for (const lane of map.lanes) {
      if (lane.target !== gateId) continue;
      const [ex, ez] = fxv(lane.points[lane.points.length - 1] as Vec2);
      const d = fxLen((ex - bx) | 0, (ez - bz) | 0);
      if (d < bestD) {
        bestD = d;
        best = [ex, ez];
      }
    }
    if (!best) continue;
    orderBattalions(world, [b], best[0], best[1], ENEMY_TEAM, BattalionMode.AttackMove);
    Battalion.targetStructure[b] = g;
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
