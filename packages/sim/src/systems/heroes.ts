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
  MatchState,
  RALLY_DAMAGE_PERCENT,
  RALLY_DURATION,
  RANK_BONUS_PERCENT,
  RANK_XP,
  SPELL_DEFS,
  UNIT_DEFS,
  Upgrade,
  VOLLEY,
} from '@bulwark/shared';
import { entityExists, hasComponent, query } from 'bitecs';
import { SIM_HZ } from '../constants';
import { STAT } from '../unitStats';
import type { SimWorld } from '../world';
import { arrowDmgType, fireProjectile, hasUpgrade } from './combat';
import { spawnBattalion } from './commands';

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
  const slot = team * 4 + spell;
  if (world.tick < (m.spellReady[slot] as number)) return false;
  m.spellReady[slot] = world.tick + ticks(def.cooldown);
  if (def.key === 'heal') healArea(world, team, x, z, fxFromFloat(def.radius), 60);
  else if (def.key === 'rally') m.rallyUntil[team] = world.tick + ticks(RALLY_DURATION);
  else m.volleys.push({ x, z, team, next: world.tick + 4, left: VOLLEY.waves });
  return true;
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
