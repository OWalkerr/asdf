import {
  DAMAGE_TYPES,
  FORTRESS_UPGRADES,
  FORTRESS_WEAPONS,
  FortressUpgrade,
  type Fx,
  fxFromFloat,
  fxLen,
  MatchState,
  type Vec2,
} from '@bulwark/shared';
import { addComponent, addEntity, query, removeEntity } from 'bitecs';
import { StructureKind } from '../components';
import { SIM_HZ } from '../constants';
import { shapeContains } from '../nav/grid';
import { STAT } from '../unitStats';
import type { SimWorld } from '../world';
import { arrowDmgType, fireProjectile, fireStone } from './combat';
import { forEachMember } from './spatial';

/**
 * Kale (GDD §4.2): FD haritalarında savunulan asıl yapı. Yükseltmeleri sırayla araştırılır;
 * ok mazgalı ve mancınık kendiliğinden ateş eder, şifa sancağı çevreyi iyileştirir, hazine gelir
 * verir. Kapılar kırılınca (gedik) saldıranlara yol açılır ve koridor zinciri bir sonraki
 * kapıya — en sonda kaleye — yönelir. TD'de kale üstür; düşman çıkışa ulaşınca can düşer.
 */
const ticks = (s: number) => Math.round(s * SIM_HZ);
const fxv = (p: Vec2): [number, number] => [fxFromFloat(p[0]), fxFromFloat(p[1])];
const W = FORTRESS_WEAPONS;
const ARROW_RANGE: Fx = fxFromFloat(W.arrows.range);
const CATA_RANGE: Fx = fxFromFloat(W.catapult.range);
const CATA_AOE: Fx = fxFromFloat(W.catapult.aoe);
const HEAL_R: Fx = fxFromFloat(W.healRadius);
const DMG_PIERCE = DAMAGE_TYPES.indexOf('pierce');
const DMG_CRUSH = DAMAGE_TYPES.indexOf('crush');
/** TD: çıkış noktasına bu kadar yaklaşan düşman taburu sızmış sayılır. */
const EXIT_R: Fx = fxFromFloat(7);

const has = (world: SimWorld, team: number, up: number) =>
  ((world.match.fortressUp[team] as number) & (1 << up)) !== 0;

/** Kale yapısını kurar (setupMatch). */
export const setupFortress = (world: SimWorld): void => {
  const map = world.map;
  if (!map) return;
  const { Position, Team, Structure } = world.c;
  const f = addEntity(world);
  for (const comp of [Position, Team, Structure]) addComponent(world, f, comp);
  [Position.x[f], Position.z[f]] = fxv(map.citadel.pos);
  Team.id[f] = 0;
  Structure.kind[f] = StructureKind.Fortress;
  Structure.hp[f] = map.citadel.hp;
  Structure.max[f] = map.citadel.hp;
  Structure.radius[f] = fxFromFloat(map.citadel.radius);
  Structure.gateIndex[f] = 255;
  Structure.slot[f] = -1;
  Structure.buildLeft[f] = 0;
  Structure.cooldown[f] = 0;
  Structure.height[f] = Math.round(((map.citadel.elevation ?? 0) + 14) * 100);
  Structure.qLen[f] = 0;
  world.match.fortress = f;
  world.match.lives = map.mode === 'TD' ? (map.lives ?? 20) : 0;
};

/** Kahraman/birlik çıkış noktası: kale kapısının önü. */
export const fortressDoor = (world: SimWorld): [Fx, Fx] => {
  const c = world.map?.citadel;
  if (!c) return [0, 0];
  return fxv(c.door ?? [c.pos[0], c.pos[1] + c.radius + 4]);
};

export const fortressUpgrade = (world: SimWorld, team: number, upgrade: number): boolean => {
  const m = world.match;
  const def = FORTRESS_UPGRADES[upgrade];
  if (!def || !Number.isInteger(upgrade) || m.state !== MatchState.Playing || m.fortress === 0) return false;
  if (has(world, team, upgrade) || (m.fortResearch[team] as number) >= 0) return false;
  if ((world.c.Structure.hp[m.fortress] as number) <= 0) return false;
  if ((m.gold[team] as number) < def.cost) return false;
  m.gold[team] = (m.gold[team] as number) - def.cost;
  m.fortResearch[team] = upgrade;
  m.fortProgress[team] = ticks(def.time);
  return true;
};

/** Araştırma ilerlemesi yüzde (snapshot). */
export const fortressPct = (world: SimWorld): number => {
  const m = world.match;
  const r = m.fortResearch[0] as number;
  const def = FORTRESS_UPGRADES[r];
  if (r < 0 || !def) return 0;
  return Math.max(0, Math.min(100, (100 - ((m.fortProgress[0] as number) * 100) / ticks(def.time)) | 0));
};

/** En yakın düşman taburu (sancak) menzilde; yoksa 0. */
const nearestEnemyBattalion = (world: SimWorld, x: number, z: number, team: number, range: Fx): number => {
  const { Battalion, Position, Team } = world.c;
  let best = 0;
  let bestD = range;
  for (const b of query(world, [Battalion, Position])) {
    if (Team.id[b] === team || (Battalion.count[b] as number) === 0) continue;
    const d = fxLen(((Position.x[b] as number) - x) | 0, ((Position.z[b] as number) - z) | 0);
    if (d < bestD || (d === bestD && b < best)) {
      bestD = d;
      best = b;
    }
  }
  return best;
};

export const fortressSystem = (world: SimWorld): void => {
  const m = world.match;
  const f = m.fortress;
  if (!world.map || f === 0 || m.state !== MatchState.Playing) return;
  const { Structure, Position, Health, Team, Dead, Soldier } = world.c;
  const team = 0;
  // Araştırma
  const r = m.fortResearch[team] as number;
  if (r >= 0) {
    const left = (m.fortProgress[team] as number) - 1;
    m.fortProgress[team] = Math.max(0, left);
    if (left <= 0) {
      m.fortressUp[team] = (m.fortressUp[team] as number) | (1 << r);
      m.fortResearch[team] = -1;
      if (r === FortressUpgrade.StoneWalls) {
        const max = ((Structure.max[f] as number) * 3) >> 1;
        Structure.max[f] = max;
        Structure.hp[f] = Math.min(max, (Structure.hp[f] as number) + (max >> 1));
      }
    }
  }
  if ((Structure.hp[f] as number) <= 0) return;
  const x = Position.x[f] as number;
  const z = Position.z[f] as number;
  const h = Structure.height[f] as number;
  // Ok mazgalları: Structure.cooldown
  if (has(world, team, FortressUpgrade.ArrowSlits)) {
    const cd = Structure.cooldown[f] as number;
    if (cd > 0) Structure.cooldown[f] = cd - 1;
    else {
      const target = nearestEnemyBattalion(world, x, z, team, ARROW_RANGE);
      if (target !== 0) {
        const n = world.c.Battalion.count[target] as number;
        for (let v = 0; v < W.arrows.volley; v++) {
          let pick = world.rng.nextInt(n);
          let victim = 0;
          forEachMember(world, target, (mm) => {
            if (pick-- === 0) victim = mm;
          });
          if (victim !== 0)
            fireProjectile(world, x, z, victim, W.arrows.damage, arrowDmgType(world, team, DMG_PIERCE), h);
        }
        Structure.cooldown[f] = ticks(W.arrows.interval) + world.rng.nextInt(4);
      }
    }
  }
  // Mancınık: qProgress kale için mancınık bekleme sayacı olarak kullanılır.
  if (has(world, team, FortressUpgrade.Catapult)) {
    const cd = Structure.qProgress[f] as number;
    if (cd > 0) Structure.qProgress[f] = cd - 1;
    else {
      const target = nearestEnemyBattalion(world, x, z, team, CATA_RANGE);
      if (target !== 0) {
        fireStone(
          world,
          x,
          z,
          Position.x[target] as number,
          Position.z[target] as number,
          W.catapult.damage,
          DMG_CRUSH,
          h + 400,
          CATA_AOE,
          team,
        );
        Structure.qProgress[f] = ticks(W.catapult.interval);
      }
    }
  }
  // Şifa sancağı: saniyede bir.
  if (has(world, team, FortressUpgrade.Healing) && world.tick % SIM_HZ === 0) {
    for (const e of query(world, [Health, Position, Soldier])) {
      if (Team.id[e] !== team || Dead.at[e] !== 0) continue;
      if (fxLen(((Position.x[e] as number) - x) | 0, ((Position.z[e] as number) - z) | 0) > HEAL_R) continue;
      const max = Health.max[e] as number;
      Health.hp[e] = Math.min(
        max,
        (Health.hp[e] as number) + Math.max(1, ((max * W.healPercentPerSec) / 100) | 0),
      );
    }
  }
};

/** Hazine geliri: tick başına tamsayı birikim (economySystem çağırır). */
export const treasuryIncome = (world: SimWorld): void => {
  if (!has(world, 0, FortressUpgrade.Treasury)) return;
  const every = Math.max(1, Math.round(SIM_HZ / W.treasuryIncome));
  if (world.tick % every === 0) world.match.gold[0] = (world.match.gold[0] as number) + 1;
};

/**
 * Gedik: kırılan kapının `breach` şeklindeki, yalnızca saldıran takıma kapalı hücreler açılır
 * (başka engellerle — sur, uçurum — çakışan hücrelere dokunulmaz) ve akış alanları yenilenir.
 */
export const breachSystem = (world: SimWorld): void => {
  const map = world.map;
  const m = world.match;
  if (!map) return;
  const { Structure } = world.c;
  m.gates.forEach((g, i) => {
    if ((m.breached & (1 << i)) !== 0 || (Structure.hp[g] as number) > 0) return;
    m.breached |= 1 << i;
    const shape = map.gates[i]?.breach;
    if (!shape) return;
    const grid = world.nav;
    const half = map.size / 2;
    const enemyBit = 1 << 1;
    for (let r = 0; r < grid.rows; r++) {
      const cz = -half + (r + 0.5) * grid.cellSize;
      for (let c = 0; c < grid.cols; c++) {
        const idx = r * grid.cols + c;
        if (grid.blocked[idx] !== enemyBit) continue;
        if (shapeContains(shape, -half + (c + 0.5) * grid.cellSize, cz)) grid.blocked[idx] = 0;
      }
    }
    world.fields.clear();
  });
};

/** TD: koridorunun çıkışına ulaşan düşman taburu sahneden çıkar, can düşer. */
export const tdExitSystem = (world: SimWorld): void => {
  const map = world.map;
  const m = world.match;
  if (!map || map.mode !== 'TD' || m.state !== MatchState.Playing || world.tick % 5 !== 0) return;
  const { Battalion, Position, Team, Soldier } = world.c;
  const gone: number[] = [];
  for (const b of query(world, [Battalion, Position])) {
    if (Team.id[b] === 0) continue;
    const lane = map.lanes[(Battalion.lane[b] as number) - 1];
    if (!lane) continue;
    const [ex, ez] = fxv(lane.points[lane.points.length - 1] as Vec2);
    if (fxLen(((Position.x[b] as number) - ex) | 0, ((Position.z[b] as number) - ez) | 0) > EXIT_R) continue;
    gone.push(b);
    m.lives = Math.max(0, m.lives - (STAT.lifeCost[Battalion.unitType[b] as number] as number));
  }
  if (gone.length === 0) return;
  for (const s of query(world, [Soldier])) {
    const b = Soldier.battalion[s] as number;
    if (b !== 0 && gone.includes(b)) removeEntity(world, s);
  }
  for (const b of gone) {
    if (m.hero[1] === b) m.hero[1] = 0;
    removeEntity(world, b);
  }
};
