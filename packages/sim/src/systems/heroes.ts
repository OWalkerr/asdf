import {
  ATHELAS_RADIUS,
  DAMAGE_TYPES,
  ELENDIL_DURATION,
  FX_HALF,
  type Fx,
  fxFromFloat,
  fxLen,
  fxMul,
  HERO,
  HERO_ABILITIES,
  MAX_RANK,
  MAX_SPELLS,
  MatchState,
  RALLY_DAMAGE_PERCENT,
  RALLY_DURATION,
  RANK_BONUS_PERCENT,
  RANK_XP,
  SPELL_DEFS,
  SUMMONS,
  TRAMPLE,
  UNIT_DEFS,
  UnitTypeId,
  Upgrade,
  VOLLEY,
} from '@bulwark/shared';
import { entityExists, hasComponent, query, removeEntity } from 'bitecs';
import { BattalionMode } from '../components';
import { SIM_HZ } from '../constants';
import { cellAt } from '../nav/grid';
import { STAT } from '../unitStats';
import type { SimWorld } from '../world';
import { applyDamage, arrowDmgType, fireProjectile, hasUpgrade } from './combat';
import { orderBattalions, spawnBattalion, spawnBattalionRow } from './commands';

/**
 * Phase 3 derinliği (GDD §5.2, §8, §9):
 * - Tabur XP/rütbe: öldüren tabur, ölenin asker başı değeri kadar XP alır; rütbe başına
 *   +%10 hasar ve %10 dayanıklılık.
 * - Kahraman: tek kişilik tabur; liderlik aurası, iki aktif yetenek, ölünce bekleme süresiyle yeniden çağırma.
 * - Spellbook: Güç Puanı (PP) düşman öldürerek ve dalga başlarında kazanılır; büyü bir kez PP ile
 *   açılır, sonra kendi bekleme süresiyle tekrar tekrar kullanılır.
 * Tümü tamsayı / Fx; rastgelelik world.rng.
 */
const AURA_R: Fx = fxFromFloat(HERO.auraRadius);
const ATHELAS_R: Fx = fxFromFloat(ATHELAS_RADIUS);
const ticks = (s: number) => Math.round(s * SIM_HZ);
const DMG_PIERCE = DAMAGE_TYPES.indexOf('pierce');
const DMG_CRUSH = DAMAGE_TYPES.indexOf('crush');
const TRAMPLE_R: Fx = fxFromFloat(TRAMPLE.radius);
/** Ok Yağmuru okları hedefin kuzeyinden (savunucu tarafından), yüksekten gelir. */
const VOLLEY_BACK: Fx = fxFromFloat(36);

const isHeroType = (t: number) => STAT.hero[t] === 1;

/** Saldıran tabura göre hasar yüzdesi: rütbe + aura + Toplanma + (yakın dövüşte) Dövme Kılıçlar; Elendil ×2. */
export const attackPercent = (world: SimWorld, b: number, team: number, melee: boolean): number => {
  const { Battalion } = world.c;
  const m = world.match;
  let pct = 100;
  if (b !== 0) {
    pct += RANK_BONUS_PERCENT * ((Battalion.rank[b] as number) - 1);
    if (Battalion.aura[b]) pct += HERO.auraDamagePercent;
  }
  if ((m.rallyUntil[team] as number) > world.tick) pct += RALLY_DAMAGE_PERCENT;
  if (melee && hasUpgrade(world, team, Upgrade.ForgedBlades)) pct += 25;
  if (b !== 0 && b === m.hero[team] && (m.elendilUntil[team] as number) > world.tick) pct *= 2;
  return pct;
};

/** Hedefin tabur rütbesine göre alınan hasar yüzdesi (rütbe 3 → 100/120). */
export const defensePercent = (world: SimWorld, target: number): number => {
  const b = world.c.Soldier.battalion[target] as number;
  if (b === 0) return 100;
  return ((100 * 100) / (100 + RANK_BONUS_PERCENT * ((world.c.Battalion.rank[b] as number) - 1))) | 0;
};

/** XP ver ve gerekirse rütbe atlat. */
export const awardXp = (world: SimWorld, b: number, xp: number): void => {
  const { Battalion } = world.c;
  if (b <= 0 || !entityExists(world, b) || !hasComponent(world, b, Battalion)) return;
  const total = (Battalion.xp[b] as number) + xp;
  Battalion.xp[b] = total;
  let r = Battalion.rank[b] as number;
  while (r < MAX_RANK && total >= (RANK_XP[r + 1] as number)) r++;
  Battalion.rank[b] = r;
};

/** Kahraman taburu silindiğinde (ölüm) çağrılır. */
export const onBattalionRemoved = (world: SimWorld, b: number, team: number): void => {
  const m = world.match;
  if (m.hero[team] === b) {
    m.hero[team] = 0;
    m.heroReady[team] = world.tick + ticks(HERO.reviveTime);
  }
};

export const summonHero = (world: SimWorld, team: number, unitType: number): boolean => {
  const m = world.match;
  const map = world.map;
  if (!map || m.state !== MatchState.Playing || !isHeroType(unitType)) return false;
  if ((m.hero[team] as number) !== 0 || world.tick < (m.heroReady[team] as number)) return false;
  const cost = UNIT_DEFS[unitType]?.cost ?? 0;
  if ((m.gold[team] as number) < cost) return false;
  m.gold[team] = (m.gold[team] as number) - cost;
  // Hornburg avlusu (plato) — yoksa kale/mağara önü.
  const [px, pz] = map.terrain.plateaus[0]?.center ?? map.citadel.pos;
  const b = spawnBattalion(world, team, unitType, fxFromFloat(px + 6), fxFromFloat(pz + 8), 16384);
  m.hero[team] = b;
  return true;
};

const healArea = (world: SimWorld, team: number, x: Fx, z: Fx, radius: Fx, percent: number): void => {
  const { Health, Position, Team, Dead, Soldier } = world.c;
  for (const e of query(world, [Health, Position, Soldier])) {
    if (Team.id[e] !== team || Dead.at[e] !== 0) continue;
    if (fxLen(((Position.x[e] as number) - x) | 0, ((Position.z[e] as number) - z) | 0) > radius) continue;
    const max = Health.max[e] as number;
    Health.hp[e] = Math.min(max, (Health.hp[e] as number) + (((max * percent) / 100) | 0));
  }
};

export const useAbility = (world: SimWorld, team: number, unit: number, ability: number): boolean => {
  const m = world.match;
  const { Battalion, Position } = world.c;
  const def = HERO_ABILITIES[ability];
  if (!def || m.state !== MatchState.Playing || unit !== m.hero[team] || unit === 0) return false;
  if (!entityExists(world, unit) || (Battalion.rank[unit] as number) < def.rank) return false;
  const slot = team * 2 + ability;
  if (world.tick < (m.abilityReady[slot] as number)) return false;
  m.abilityReady[slot] = world.tick + ticks(def.cooldown);
  if (def.key === 'elendil') m.elendilUntil[team] = world.tick + ticks(ELENDIL_DURATION);
  else healArea(world, team, Position.x[unit] as number, Position.z[unit] as number, ATHELAS_R, 50);
  return true;
};

export const unlockSpell = (world: SimWorld, team: number, spell: number): boolean => {
  const m = world.match;
  const def = SPELL_DEFS[spell];
  if (!def || !Number.isInteger(spell) || m.state !== MatchState.Playing) return false;
  const bits = m.spells[team] as number;
  if (bits & (1 << spell)) return false;
  // Kademe kuralı (GDD §9.1): üst kademe, bir alt kademe büyüsü açılmadan açılamaz.
  if (def.tier > 1 && !SPELL_DEFS.some((s, i) => s.tier === def.tier - 1 && bits & (1 << i))) return false;
  if ((m.pp[team] as number) < def.cost * 10) return false;
  m.pp[team] = (m.pp[team] as number) - def.cost * 10;
  m.spells[team] = bits | (1 << spell);
  return true;
};

export const castSpell = (world: SimWorld, team: number, spell: number, x: number, z: number): boolean => {
  const m = world.match;
  const def = SPELL_DEFS[spell];
  if (!def || m.state !== MatchState.Playing || !Number.isInteger(x) || !Number.isInteger(z)) return false;
  if (!((m.spells[team] as number) & (1 << spell))) return false;
  const slot = team * MAX_SPELLS + spell;
  if (world.tick < (m.spellReady[slot] as number)) return false;
  m.spellReady[slot] = world.tick + ticks(def.cooldown);
  switch (def.key) {
    case 'heal':
      healArea(world, team, x, z, fxFromFloat(def.radius), 60);
      break;
    case 'rally':
      m.rallyUntil[team] = world.tick + ticks(RALLY_DURATION);
      break;
    case 'arrow_volley':
      m.volleys.push({ x, z, team, next: world.tick + 4, left: VOLLEY.waves });
      break;
    case 'elven_allies':
      summonAt(
        world,
        team,
        UnitTypeId.LorienArcher,
        x,
        z,
        SUMMONS.elvenAllies.battalions,
        SUMMONS.elvenAllies.duration,
        16384,
      );
      break;
    case 'army_of_dead':
      summonAt(
        world,
        team,
        UnitTypeId.DeadArmy,
        x,
        z,
        SUMMONS.armyOfDead.battalions,
        SUMMONS.armyOfDead.duration,
        16384,
      );
      break;
    case 'rohirrim': {
      // Doğudan batıya hat halinde dörtnal: hedefin `distance` doğusunda belirir, batısına geçer.
      const d = fxFromFloat(SUMMONS.rohirrim.distance);
      const half = fxFromFloat((world.map?.size ?? 384) / 2 - 12);
      const sx = Math.min(half, x + d) | 0;
      const gx = Math.max(-half, x - d) | 0;
      const bs = summonAt(
        world,
        team,
        UnitTypeId.Rohirrim,
        sx,
        z,
        SUMMONS.rohirrim.battalions,
        SUMMONS.rohirrim.duration,
        32768,
      );
      orderBattalions(world, bs, gx, z, team, BattalionMode.Move);
      break;
    }
  }
  return true;
};

/** Hedef noktaya yan yana `count` tabur çağırır; `duration` sn sonra yok olurlar. */
const summonAt = (
  world: SimWorld,
  team: number,
  unitType: number,
  x: Fx,
  z: Fx,
  count: number,
  duration: number,
  facing: number,
): number[] => {
  const bs = spawnBattalionRow(world, team, unitType, x, z, count, facing);
  for (const b of bs) world.c.Battalion.expires[b] = world.tick + ticks(duration);
  return bs;
};

/** Süresi dolan (veya hücumunu bitiren süvari) çağrılmış taburları sahneden kaldırır. */
export const expireSystem = (world: SimWorld): void => {
  const { Battalion, Soldier } = world.c;
  const gone: number[] = [];
  for (const b of query(world, [Battalion])) {
    const exp = Battalion.expires[b] as number;
    if (exp === 0) continue;
    const chargeDone = STAT.charger[Battalion.unitType[b] as number] === 1 && Battalion.active[b] === 0;
    if (world.tick >= exp || chargeDone) gone.push(b);
  }
  if (gone.length === 0) return;
  for (const s of query(world, [Soldier])) {
    const b = Soldier.battalion[s] as number;
    if (b !== 0 && gone.includes(b)) removeEntity(world, s);
  }
  for (const b of gone) removeEntity(world, b);
};

/** Süvari çiğnemesi: hareket eden her atlı, aralıkla yarıçapındaki düşmanlara ezme hasarı verir. */
export const trampleSystem = (world: SimWorld): void => {
  const { Soldier, Position, Team, UnitType, Dead, Health } = world.c;
  const grid = world.nav;
  for (const s of query(world, [Soldier, Position, Health])) {
    if (STAT.charger[UnitType.id[s] as number] !== 1 || Dead.at[s] !== 0) continue;
    if ((s + world.tick) % TRAMPLE.interval !== 0) continue;
    const b = Soldier.battalion[s] as number;
    if (b === 0) continue;
    const team = Team.id[s] as number;
    const sx = Position.x[s] as number;
    const sz = Position.z[s] as number;
    const c = cellAt(grid, sx, sz);
    if (c < 0) continue;
    const c0 = c % grid.cols;
    const r0 = (c / grid.cols) | 0;
    for (let dr = -2; dr <= 2; dr++) {
      const r = r0 + dr;
      if (r < 0 || r >= grid.rows) continue;
      for (let dc = -2; dc <= 2; dc++) {
        const cc = c0 + dc;
        if (cc < 0 || cc >= grid.cols) continue;
        for (
          let o = world.hashHead[r * grid.cols + cc] as number;
          o !== -1;
          o = world.hashNext[o] as number
        ) {
          if (Team.id[o] === team || Dead.at[o] !== 0) continue;
          const d = fxLen(((Position.x[o] as number) - sx) | 0, ((Position.z[o] as number) - sz) | 0);
          if (d <= TRAMPLE_R) applyDamage(world, o, TRAMPLE.damage, DMG_CRUSH, b);
        }
      }
    }
  }
};

/** Kahraman aurası (her 5 tick) ve Ok Yağmuru dalgaları. */
export const heroSystem = (world: SimWorld): void => {
  const m = world.match;
  const { Battalion, Position, Team, Health, Dead, Soldier } = world.c;
  if (world.tick % 5 === 0) {
    for (const b of query(world, [Battalion, Position])) {
      const team = Team.id[b] as number;
      const h = m.hero[team] as number;
      let inAura = 0;
      if (h !== 0 && h !== b && entityExists(world, h)) {
        const d = fxLen(
          ((Position.x[h] as number) - (Position.x[b] as number)) | 0,
          ((Position.z[h] as number) - (Position.z[b] as number)) | 0,
        );
        inAura = d <= AURA_R ? 1 : 0;
      }
      Battalion.aura[b] = inAura;
    }
  }
  if (m.volleys.length === 0) return;
  const radiusOf = fxFromFloat(SPELL_DEFS.find((s) => s.key === 'arrow_volley')?.radius ?? 12);
  for (const v of m.volleys) {
    if (world.tick < v.next) continue;
    v.left--;
    v.next = world.tick + ticks(VOLLEY.gap);
    const targets: number[] = [];
    for (const e of query(world, [Health, Position, Soldier])) {
      if (Team.id[e] === v.team || Dead.at[e] !== 0) continue;
      if (fxLen(((Position.x[e] as number) - v.x) | 0, ((Position.z[e] as number) - v.z) | 0) <= radiusOf)
        targets.push(e);
    }
    if (targets.length === 0) continue;
    const dmgType = arrowDmgType(world, v.team, DMG_PIERCE);
    for (let i = 0; i < VOLLEY.arrows; i++) {
      const t = targets[world.rng.nextInt(targets.length)] as number;
      const fx = (v.x + fxMul(world.rng.nextFx() - FX_HALF, VOLLEY_BACK)) | 0;
      const fz = (v.z - VOLLEY_BACK) | 0;
      fireProjectile(world, fx, fz, t, VOLLEY.damage, dmgType, 2400, 0);
    }
  }
  m.volleys = m.volleys.filter((v) => v.left > 0);
};
