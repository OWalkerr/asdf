import { fxFromFloat, fxLen, LADDER, MatchState } from '@bulwark/shared';
import { addComponent, addEntity, entityExists, query, removeEntity } from 'bitecs';
import { BattalionMode, StructureKind } from '../components';
import { SIM_HZ } from '../constants';
import { BLOCK_ALL } from '../nav/grid';
import { ladderCells } from '../nav/ladders';
import { STAT } from '../unitStats';
import type { SimWorld } from '../world';
import { orderBattalions } from './commands';

/**
 * Kuşatma merdivenleri (BFME2): merdiven takımı koridorunun merdiven noktasının dış ayağına varınca
 * merdiveni sura dayar (takım sahneden çıkar, yerine yapı kalır). Merdiven ayakta kaldıkça o
 * koridorun düşmanları ilk kapıyı atlar (laneGoal) ve surun üstünden geçer: merdiven kapsülündeki
 * sur hücreleri yalnızca düşmana açılır. Merdiven yıkılınca hücreler eski haline döner.
 */
const DEPLOY_R = fxFromFloat(3.5);
const PUSH_R = fxFromFloat(LADDER.pushReach);
const LIFETIME = LADDER.lifetime * SIM_HZ;
const ENEMY = 1;
const fx2 = (p: readonly [number, number]): [number, number] => [fxFromFloat(p[0]), fxFromFloat(p[1])];

/** Merdiven takımını hedef noktasına yollar (dalga doğduğunda). */
export const sendLadderTeam = (world: SimWorld, b: number, lane: number): void => {
  const spots = world.ladderSpots[lane] ?? [];
  if (spots.length === 0) return;
  const m = world.match;
  const idx = (m.ladderSeq[lane] as number) % spots.length;
  m.ladderSeq[lane] = ((m.ladderSeq[lane] as number) + 1) & 0xffff;
  world.c.Battalion.ladder[b] = idx + 1;
  const [ox, oz] = fx2((spots[idx] as (typeof spots)[number]).o);
  orderBattalions(world, [b], ox, oz, ENEMY, BattalionMode.Move);
  world.c.Battalion.targetStructure[b] = 0;
};

const removeBattalion = (world: SimWorld, b: number): void => {
  const { Soldier } = world.c;
  for (const s of query(world, [Soldier])) if ((Soldier.battalion[s] as number) === b) removeEntity(world, s);
  removeEntity(world, b);
};

export const ladderSystem = (world: SimWorld): void => {
  const map = world.map;
  const m = world.match;
  if (!map || map.mode !== 'FD' || m.state !== MatchState.Playing || world.tick % 5 !== 0) return;
  const { Battalion, Position, Team, Structure } = world.c;
  const grid = world.nav;
  let changed = false;
  // Konuşlanma
  const deploy: number[] = [];
  for (const b of query(world, [Battalion, Position])) {
    const idx = (Battalion.ladder[b] as number) - 1;
    if (idx < 0 || Team.id[b] !== ENEMY || (Battalion.count[b] as number) === 0) continue;
    const lane = (Battalion.lane[b] as number) - 1;
    const spot = world.ladderSpots[lane]?.[idx];
    if (!spot) continue;
    const [ox, oz] = fx2(spot.o);
    if (fxLen(((Position.x[b] as number) - ox) | 0, ((Position.z[b] as number) - oz) | 0) > DEPLOY_R) {
      // Takıldıysa yeniden yola çık.
      if (!Battalion.active[b] && world.tick % 20 === 0)
        orderBattalions(world, [b], ox, oz, ENEMY, BattalionMode.Move);
      continue;
    }
    deploy.push(b);
  }
  for (const b of deploy) {
    const lane = (Battalion.lane[b] as number) - 1;
    const idx = (Battalion.ladder[b] as number) - 1;
    const spot = world.ladderSpots[lane]?.[idx];
    removeBattalion(world, b);
    if (!spot || m.ladders.some((l) => l.lane === lane && l.spot === idx)) continue;
    const e = addEntity(world);
    for (const comp of [Position, Team, Structure]) addComponent(world, e, comp);
    [Position.x[e], Position.z[e]] = fx2(spot.p);
    Team.id[e] = ENEMY;
    Structure.kind[e] = StructureKind.Ladder;
    Structure.hp[e] = LADDER.hp;
    Structure.max[e] = LADDER.hp;
    Structure.radius[e] = fxFromFloat(2.5);
    Structure.gateIndex[e] = 255;
    Structure.slot[e] = lane * 8 + idx;
    Structure.buildLeft[e] = 0;
    Structure.qLen[e] = 0;
    Structure.level[e] = 1;
    const cells = ladderCells(grid, spot).filter((c) => grid.blocked[c] === BLOCK_ALL);
    const orig = cells.map((c) => grid.blocked[c] as number);
    for (const c of cells) grid.blocked[c] = BLOCK_ALL & ~(1 << ENEMY);
    m.ladders.push({ eid: e, lane, spot: idx, cells, orig, at: world.tick });
    m.laneLadders[lane] = (m.laneLadders[lane] as number) + 1;
    changed = true;
  }
  // Sur kuleleri merdiveni iter; süre dolunca merdiven çöker.
  if (world.tick % SIM_HZ === 0)
    for (const l of m.ladders) {
      if (world.tick - l.at >= LIFETIME) {
        Structure.hp[l.eid] = 0;
        continue;
      }
      const lx = Position.x[l.eid] as number;
      const lz = Position.z[l.eid] as number;
      for (const t of m.slots) {
        if (
          t === 0 ||
          Structure.kind[t] !== StructureKind.ArrowTower ||
          (Structure.buildLeft[t] as number) > 0
        )
          continue;
        if (map.slots[Structure.slot[t] as number]?.kind !== 'wall_socket') continue;
        if (fxLen(((Position.x[t] as number) - lx) | 0, ((Position.z[t] as number) - lz) | 0) > PUSH_R)
          continue;
        Structure.hp[l.eid] = Math.max(
          0,
          (Structure.hp[l.eid] as number) - LADDER.pushDamage * Math.max(1, Structure.level[t] as number),
        );
      }
    }
  // Yıkılan merdivenler
  m.ladders = m.ladders.filter((l) => {
    if (entityExists(world, l.eid) && (Structure.hp[l.eid] as number) > 0) return true;
    l.cells.forEach((c, i) => {
      grid.blocked[c] = l.orig[i] as number;
    });
    if (entityExists(world, l.eid)) {
      Structure.kind[l.eid] = 0;
      removeEntity(world, l.eid);
    }
    m.laneLadders[l.lane] = Math.max(0, (m.laneLadders[l.lane] as number) - 1);
    changed = true;
    return false;
  });
  if (changed) world.fields.clear();
};

/** Merdiven takımı mı (dalga sisteminde rotası özel). */
export const isLadderType = (t: number): boolean => STAT.ladder[t] === 1;
