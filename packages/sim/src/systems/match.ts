import {
  DIFFICULTIES,
  FACTIONS,
  FREE_BUILD,
  type Fx,
  factionDef,
  fxAtan2,
  fxDiv,
  fxFromFloat,
  fxLen,
  fxMul,
  type MapDef,
  MatchState,
  PP,
  UnitTypeId,
  type Vec2,
  type VersusSetup,
} from '@bulwark/shared';
import { addComponent, addEntity, query } from 'bitecs';
import { BattalionMode } from '../components';
import { SIM_HZ } from '../constants';
import { isBlockedAt } from '../nav/grid';
import { allied } from '../team';
import { STAT } from '../unitStats';
import type { ScheduledGroup, SimWorld } from '../world';
import { clearLine } from './battalion';
import { orderBattalions, spawnBattalionRow } from './commands';
import { fortressDoor, setupFortress, setupFortressAt } from './fortress';
import { isLadderType, sendLadderTeam } from './ladders';
import { isBuilding } from './structures';

/** Saldıran (yapay zekâ) takım. */
export const ENEMY_TEAM = 1;

const fxv = (p: Vec2): [number, number] => [fxFromFloat(p[0]), fxFromFloat(p[1])];

/**
 * Çatışma (BFME2 Skirmish): her yuvaya başlangıç konumunda kale, başlangıç altını, Güç Puanı ve
 * işçiler; dalga yok. Bilgisayar yuvaları aiSystem'e bırakılır.
 */
const setupVersus = (world: SimWorld, map: MapDef, setup: VersusSetup): void => {
  const m = world.match;
  m.versus = true;
  m.cpLimit = setup.cpLimit;
  setup.humans.forEach((t, i) => {
    m.playerTeam[i] = t;
  });
  for (const slot of setup.slots) {
    const t = slot.team;
    const start = map.starts?.[slot.start];
    if (t < 0 || t > 3 || !start) continue;
    m.factions[t] = FACTIONS[slot.faction] ? slot.faction : 0;
    // İttifak: lobideki takım (0–3) ya da takımsız (kendi başına, 4 + takım).
    m.alliance[t] = slot.alliance >= 0 && slot.alliance < 4 ? slot.alliance : 4 + t;
    m.ai[t] = slot.ai;
    m.startOf[t] = slot.start;
    m.gold[t] = setup.startGold;
    m.pp[t] = PP.start * 10;
    setupFortressAt(world, t, start);
    const [dx, dz] = fortressDoor(world, t);
    spawnBattalionRow(world, t, UnitTypeId.Worker, dx, dz, FREE_BUILD.startWorkers, 16384);
  }
  m.faction = m.factions[0] as number;
  m.waveCount = 0;
};

/** Kapı yapıları ve dalga programı (harita yüklenirken bir kez). */
export const setupMatch = (world: SimWorld, map: MapDef, versus: VersusSetup | null = null): void => {
  if (map.mode === 'VS' && versus) {
    setupVersus(world, map, versus);
    return;
  }
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
  // Kötü taraf oynanıyorsa dalgalar iyi tarafların karşılık birimleriyle gelir.
  const enemyMap = factionDef(world.match.faction).enemyMap ?? {};
  map.waves.forEach((wave, wi) => {
    for (const g0 of wave.groups) {
      const g = { ...g0, unitType: enemyMap[g0.unitType] ?? g0.unitType };
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
  // Başlangıç Güç Puanı: ilk kademe güçlerden biri hemen açılabilsin.
  world.match.pp[0] = PP.start * 10;
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
      if (isLadderType(g.unitType)) sendLadderTeam(world, b, laneIndex);
    }
    // Boss: takımının liderlik kaynağı (aura) olur.
    if (STAT.boss[g.unitType] === 1 && battalions[0] !== undefined) m.hero[ENEMY_TEAM] = battalions[0];
    // Dalga başı Güç Puanı bonusu (GDD §9.1).
    if (g.wave > m.waveIndex) {
      m.pp[0] = (m.pp[0] as number) + PP.waveBonus * 10;
      // Tower Wars: dalga başı gelir.
      if (map.waveGold) {
        const bonus = map.waveGold.base + map.waveGold.perWave * (g.wave - 1);
        m.gold[0] = (m.gold[0] as number) + bonus;
        m.goldEarned[0] = (m.goldEarned[0] as number) + bonus;
      }
    }
    m.waveIndex = Math.max(m.waveIndex, g.wave);
  }
};

/** FD: yakın dövüş taburu bu mesafedeki (ulaşılabilir) oyuncu binasına sapar. */
const BUILDING_AGGRO: Fx = fxFromFloat(14);

/**
 * Taburun yakınındaki, ulaşılabilir (yapı arsası; sur üstü değil) en yakın düşman binası ve
 * yaklaşma noktası; yoksa null.
 */
const nearbyBuilding = (world: SimWorld, b: number): { e: number; x: Fx; z: Fx } | null => {
  const map = world.map as MapDef;
  const { Structure, Position, Team } = world.c;
  const bx = Position.x[b] as number;
  const bz = Position.z[b] as number;
  const team = Team.id[b] as number;
  let best: { e: number; x: Fx; z: Fx } | null = null;
  let bestD = BUILDING_AGGRO;
  for (const e of world.match.slots) {
    if (
      e === 0 ||
      !isBuilding(world, e) ||
      allied(world, Team.id[e] as number, team) ||
      (Structure.hp[e] as number) <= 0
    )
      continue;
    if (map.slots[Structure.slot[e] as number]?.kind !== 'building') continue;
    const ex = Position.x[e] as number;
    const ez = Position.z[e] as number;
    const d = fxLen((bx - ex) | 0, (bz - ez) | 0);
    if (d >= bestD || d === 0) continue;
    // Yaklaşma noktası: binanın tabura bakan yüzü.
    const r = Structure.radius[e] as number;
    const ax = (ex + fxMul(fxDiv((bx - ex) | 0, d), r)) | 0;
    const az = (ez + fxMul(fxDiv((bz - ez) | 0, d), r)) | 0;
    if (isBlockedAt(world.nav, ax, az, team) || !clearLine(world.nav, bx, bz, ax, az, team)) continue;
    bestD = d;
    best = { e, x: ax, z: az };
  }
  return best;
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
  // Ayakta merdiven varsa koridorun ilk kapısı atlanır: düşman surun üstünden geçer.
  for (let k = (m.laneLadders[laneIndex] as number) > 0 ? 1 : 0; k < chain.length; k++) {
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
    if ((Battalion.ladder[b] as number) > 0) continue; // ladderSystem yönetir
    const lane = (Battalion.lane[b] as number) - 1;
    if (lane < 0) continue;
    const current = Battalion.targetStructure[b] as number;
    // Bina saldırısı sürüyor: yıkılana kadar inat.
    if (current !== 0 && isBuilding(world, current) && (Structure.hp[current] as number) > 0) {
      if (Battalion.active[b]) continue;
      const d = fxLen(
        ((Position.x[current] as number) - (Position.x[b] as number)) | 0,
        ((Position.z[current] as number) - (Position.z[b] as number)) | 0,
      );
      // Takıldıysa binayı bırakıp koridora döner.
      if (d <= (((Structure.radius[current] as number) + REGROUP_DIST) | 0)) continue;
    }
    if (map.mode === 'FD' && STAT.siegeOnly[Battalion.unitType[b] as number] !== 1) {
      const t = nearbyBuilding(world, b);
      if (t) {
        orderBattalions(world, [b], t.x, t.z, ENEMY_TEAM, BattalionMode.AttackMove);
        Battalion.targetStructure[b] = t.e;
        continue;
      }
    }
    const goal = laneGoal(world, lane);
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

/**
 * Çatışma sonucu: kalesi düşen takım elenir (birlikleri dağılır, yapıları yıkılır). Ayakta tek
 * ittifak kalınca kalanlar kazanır.
 */
const versusOutcome = (world: SimWorld): void => {
  const m = world.match;
  const { Structure } = world.c;
  for (let t = 0; t < 4; t++) {
    if (!m.alive[t]) continue;
    const f = m.fortresses[t] as number;
    if (f !== 0 && (Structure.hp[f] as number) > 0) continue;
    m.alive[t] = 0;
    m.teamState[t] = MatchState.Defeat;
    eliminate(world, t);
  }
  const alliances = new Set<number>();
  for (let t = 0; t < 4; t++) if (m.alive[t]) alliances.add(m.alliance[t] as number);
  if (alliances.size > 1) return;
  for (let t = 0; t < 4; t++) if (m.alive[t]) m.teamState[t] = MatchState.Victory;
  m.state = MatchState.Victory;
};

/** Elenen takımın askerleri ölür, yapıları yıkılır (BFME2: yenilen oyuncu haritadan silinir). */
const eliminate = (world: SimWorld, team: number): void => {
  const { Health, Structure, Team, Dead, Soldier } = world.c;
  for (const e of query(world, [Health, Soldier])) {
    if (Team.id[e] !== team || Dead.at[e] !== 0) continue;
    Health.hp[e] = 0;
  }
  for (const e of query(world, [Structure])) if (Team.id[e] === team) Structure.hp[e] = 0;
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
  if (m.versus) {
    versusOutcome(world);
    return;
  }
  const fallen =
    map.mode === 'TD' ? m.lives <= 0 : m.fortress !== 0 && (world.c.Structure.hp[m.fortress] as number) <= 0;
  if (fallen) {
    m.state = MatchState.Defeat;
    return;
  }
  if (m.nextGroup >= m.schedule.length && m.enemiesAlive === 0) m.state = MatchState.Victory;
};
