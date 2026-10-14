import {
  DEFAULT_DIFFICULTY,
  DIFFICULTIES,
  FX_ONE,
  fxDiv,
  HASH_SEED,
  hashInt,
  MAX_HEROES,
  MAX_SPELLS,
  type MapDef,
  MatchState,
  Rng,
} from '@bulwark/shared';
import { createWorld, query, type World } from 'bitecs';
import { type Components, createComponents } from './components';
import { MAX_ENTITIES, SIM_HZ } from './constants';
import { FlowFieldCache } from './nav/flowField';
import { createOpenGrid, type NavGrid } from './nav/grid';
import { type LadderSpot, ladderSpots } from './nav/ladders';
import {
  battalionSpacingSystem,
  battalionSystem,
  engagementSystem,
  formationSystem,
} from './systems/battalion';
import { combatSystem, projectileSystem } from './systems/combat';
import { deathSystem } from './systems/death';
import { breachSystem, fortressSystem, tdExitSystem } from './systems/fortress';
import { expireSystem, heroSystem, trampleSystem } from './systems/heroes';
import { ladderSystem } from './systems/ladders';
import { enemyAiSystem, matchSystem, setupMatch, waveSystem } from './systems/match';
import { movementSystem } from './systems/movement';
import { animStateSystem, moveToTargetSystem } from './systems/moveToTarget';
import { separationSystem } from './systems/separation';
import { spatialSystem } from './systems/spatial';
import { economySystem, structureSystem } from './systems/structures';

/** Dalga programının düzleştirilmiş hali (tick sırasına göre). */
export interface ScheduledGroup {
  tick: number;
  wave: number;
  spawn: number;
  unitType: number;
  battalions: number;
}

export interface MatchContext {
  /** DIFFICULTIES indeksi. */
  difficulty: number;
  /** Kale yapısı eid'i (0 = yok), yükseltme bitleri, araştırılan (−1 = yok) ve kalan tick. */
  fortress: number;
  fortressUp: Uint8Array;
  fortResearch: Int8Array;
  fortProgress: Int32Array;
  /** Kırılmış kapılar (bit = kapı indeksi). */
  breached: number;
  /** TD: kalan can. */
  lives: number;
  /** TD uç bölgesindeki düşman taburu (görüntü). */
  zone: number;
  state: number;
  /** Başlamış son dalga (1 tabanlı; 0 = henüz yok). */
  waveIndex: number;
  waveCount: number;
  schedule: ScheduledGroup[];
  nextGroup: number;
  /** MapDef.gates sırasıyla kapı entity'leri. */
  gates: number[];
  /** Dayanmış kuşatma merdivenleri: yapı eid'i, koridor, nokta, açılan hücreler ve eski maskeleri. */
  ladders: { eid: number; lane: number; spot: number; cells: number[]; orig: number[]; at: number }[];
  /** Koridor başına ayakta merdiven sayısı ve merdiven takımı sırası (nokta seçimi). */
  laneLadders: Uint8Array;
  ladderSeq: Uint16Array;
  enemiesAlive: number;
  /** Oyuncu başına altın (GDD §5.1). */
  gold: Int32Array;
  /** Takım başına tamamlanmış (ve araştırılmakta olan) yükseltme bitleri (UPGRADE_DEFS). */
  upgrades: Uint8Array;
  researching: Uint8Array;
  /** Güç Puanı ×10, açık büyü bitleri, büyü hazır tick'leri (takım × 4 + büyü). */
  pp: Int32Array;
  spells: Uint8Array;
  spellReady: Int32Array;
  rallyUntil: Int32Array;
  /** Takım başına lider (aura kaynağı; düşmanda boss) taburu. */
  hero: Int32Array;
  /**
   * Oyuncu kahraman yuvaları (HEROES sırası): [takım × MAX_HEROES + k] tabur (0 = yok),
   * yeniden çağırma tick'i; yetenek hazır tick'leri [(takım × MAX_HEROES + k) × 2 + i].
   */
  heroes: Int32Array;
  heroReady: Int32Array;
  abilityReady: Int32Array;
  elendilUntil: Int32Array;
  /** Bekleyen Ok Yağmuru dalgaları. */
  volleys: { x: number; z: number; team: number; next: number; left: number }[];
  /** MapDef.slots sırasıyla inşa edilmiş yapı eid'i (0 = boş). */
  slots: Int32Array;
}

export interface SimContext {
  c: Components;
  tick: number;
  /** Bir tick'in saniye cinsinden süresi, Fx. */
  dtFx: number;
  rng: Rng;
  nav: NavGrid;
  fields: FlowFieldCache;
  map: MapDef | null;
  /** Koridor başına kuşatma merdiveni noktaları (haritadan türetilir). */
  ladderSpots: LadderSpot[][];
  match: MatchContext;
  /** Tick başına kurulan uzamsal hash (nav hücresi başına bağlı liste; yalnızca canlı birimler). */
  hashHead: Int32Array;
  hashNext: Int32Array;
  /** Tabur → canlı askerler bağlı listesi (her tick yeniden kurulur). */
  memberHead: Int32Array;
  memberNext: Int32Array;
}

export type SimWorld = World<SimContext>;

/** nav verilmezse 512 m'lik açık ızgara (testler, look-dev). map verilirse kapılar ve dalgalar kurulur. */
export const createSimWorld = (
  seed: number,
  nav: NavGrid = createOpenGrid(512),
  map: MapDef | null = null,
  difficulty = DEFAULT_DIFFICULTY,
): SimWorld => {
  const world = createWorld<SimContext>({
    c: createComponents(),
    tick: 0,
    dtFx: fxDiv(FX_ONE, SIM_HZ * FX_ONE),
    rng: new Rng(seed),
    nav,
    fields: new FlowFieldCache(nav),
    map,
    ladderSpots: map ? ladderSpots(map, nav) : [],
    match: {
      state: MatchState.Playing,
      difficulty: DIFFICULTIES[difficulty] ? difficulty : DEFAULT_DIFFICULTY,
      fortress: 0,
      fortressUp: new Uint8Array(4),
      fortResearch: new Int8Array(4).fill(-1),
      fortProgress: new Int32Array(4),
      breached: 0,
      lives: 0,
      zone: 0,
      waveIndex: 0,
      waveCount: 0,
      schedule: [],
      nextGroup: 0,
      gates: [],
      ladders: [],
      laneLadders: new Uint8Array(map?.lanes.length ?? 0),
      ladderSeq: new Uint16Array(map?.lanes.length ?? 0),
      enemiesAlive: 0,
      gold: new Int32Array(4),
      upgrades: new Uint8Array(4),
      researching: new Uint8Array(4),
      pp: new Int32Array(4),
      spells: new Uint8Array(4),
      spellReady: new Int32Array(4 * MAX_SPELLS),
      rallyUntil: new Int32Array(4),
      hero: new Int32Array(4),
      heroes: new Int32Array(4 * MAX_HEROES),
      heroReady: new Int32Array(4 * MAX_HEROES),
      abilityReady: new Int32Array(4 * MAX_HEROES * 2),
      elendilUntil: new Int32Array(4),
      volleys: [],
      slots: new Int32Array(map?.slots.length ?? 0),
    },
    hashHead: new Int32Array(nav.cols * nav.rows),
    hashNext: new Int32Array(MAX_ENTITIES),
    memberHead: new Int32Array(MAX_ENTITIES),
    memberNext: new Int32Array(MAX_ENTITIES),
  });
  if (map) setupMatch(world, map);
  return world;
};

/**
 * Tick pipeline (GDD §13.4). Sistem sırası sabittir ve deterministiktir.
 * bitECS sorgu sırası (sparse set) aynı işlem dizisi için her istemcide aynıdır.
 */
export const stepWorld = (world: SimWorld): void => {
  waveSystem(world);
  enemyAiSystem(world);
  economySystem(world);
  spatialSystem(world);
  engagementSystem(world);
  battalionSystem(world);
  battalionSpacingSystem(world);
  formationSystem(world);
  combatSystem(world);
  structureSystem(world);
  heroSystem(world);
  fortressSystem(world);
  moveToTargetSystem(world);
  separationSystem(world);
  movementSystem(world);
  trampleSystem(world);
  projectileSystem(world);
  deathSystem(world);
  expireSystem(world);
  breachSystem(world);
  ladderSystem(world);
  tdExitSystem(world);
  animStateSystem(world);
  matchSystem(world);
  world.tick++;
};

/** Desync tespiti için tüm simülasyon durumunun hash'i (GDD §13.6). */
export const hashWorld = (world: SimWorld): number => {
  const {
    Position,
    Velocity,
    Facing,
    Team,
    MoveTarget,
    Health,
    Anim,
    Battalion,
    Soldier,
    Combat,
    Structure,
  } = world.c;
  let h = hashInt(HASH_SEED, world.tick);
  for (const eid of query(world, [Position])) {
    h = hashInt(h, eid);
    h = hashInt(h, Position.x[eid] as number);
    h = hashInt(h, Position.z[eid] as number);
    h = hashInt(h, Velocity.x[eid] as number);
    h = hashInt(h, Velocity.z[eid] as number);
    h = hashInt(h, Facing.angle[eid] as number);
    h = hashInt(h, Team.id[eid] as number);
    h = hashInt(h, MoveTarget.active[eid] as number);
    h = hashInt(h, Health.hp[eid] as number);
    h = hashInt(h, Anim.state[eid] as number);
    h = hashInt(h, Combat.target[eid] as number);
    h = hashInt(h, Combat.cooldown[eid] as number);
  }
  for (const eid of query(world, [Battalion])) {
    h = hashInt(h, eid);
    h = hashInt(h, Battalion.active[eid] as number);
    h = hashInt(h, Battalion.goalX[eid] as number);
    h = hashInt(h, Battalion.goalZ[eid] as number);
    h = hashInt(h, Battalion.files[eid] as number);
    h = hashInt(h, Battalion.count[eid] as number);
    h = hashInt(h, Battalion.mode[eid] as number);
    h = hashInt(h, Battalion.engaged[eid] as number);
    h = hashInt(h, Battalion.xp[eid] as number);
    h = hashInt(h, Battalion.rank[eid] as number);
    h = hashInt(h, Battalion.aura[eid] as number);
    h = hashInt(h, Battalion.expires[eid] as number);
  }
  for (const eid of query(world, [Soldier])) {
    h = hashInt(h, Soldier.battalion[eid] as number);
    h = hashInt(h, Soldier.slot[eid] as number);
  }
  for (const eid of query(world, [Structure])) {
    h = hashInt(h, eid);
    h = hashInt(h, Structure.hp[eid] as number);
    h = hashInt(h, Structure.kind[eid] as number);
    h = hashInt(h, Structure.buildLeft[eid] as number);
    h = hashInt(h, Structure.qLen[eid] as number);
    h = hashInt(h, Structure.qProgress[eid] as number);
  }
  for (const g of world.match.gold) h = hashInt(h, g);
  h = hashInt(h, world.match.fortress);
  for (const v of world.match.fortressUp) h = hashInt(h, v);
  for (const v of world.match.fortResearch) h = hashInt(h, v);
  for (const v of world.match.fortProgress) h = hashInt(h, v);
  h = hashInt(h, world.match.breached);
  for (const l of world.match.ladders) h = hashInt(h, l.eid);
  for (const v of world.match.laneLadders) h = hashInt(h, v);
  for (const v of world.match.ladderSeq) h = hashInt(h, v);
  h = hashInt(h, world.match.lives);
  h = hashInt(h, world.match.zone);
  for (const u of world.match.upgrades) h = hashInt(h, u);
  for (const u of world.match.researching) h = hashInt(h, u);
  const m = world.match;
  for (const arr of [
    m.pp,
    m.spells,
    m.spellReady,
    m.rallyUntil,
    m.hero,
    m.heroes,
    m.heroReady,
    m.abilityReady,
    m.elendilUntil,
  ])
    for (const v of arr) h = hashInt(h, v);
  for (const v of m.volleys) {
    h = hashInt(h, v.x);
    h = hashInt(h, v.z);
    h = hashInt(h, v.next);
    h = hashInt(h, v.left);
  }
  h = hashInt(h, world.match.state);
  h = hashInt(h, world.match.difficulty);
  h = hashInt(h, world.match.nextGroup);
  for (const s of world.rng.getState()) h = hashInt(h, s);
  return h;
};
