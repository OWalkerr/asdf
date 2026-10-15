import {
  ARROW_WIND,
  ATHELAS_RADIUS,
  BANNER,
  DAMAGE_TYPES,
  EAGLES,
  EARTHQUAKE,
  ELENDIL_DURATION,
  EORED,
  FLOOD,
  FX_HALF,
  type Fx,
  factionDef,
  fxDiv,
  fxFromFloat,
  fxLen,
  fxMul,
  HERO,
  HERO_PASSIVE_XP,
  HERO_XP,
  HORDE,
  HORDE_COMBOS,
  KINGS_GLORY_DURATION,
  MAX_ABILITIES,
  MAX_HERO_LEVEL,
  MAX_HEROES,
  MAX_RANK,
  MAX_SPELLS,
  MatchState,
  RALLY_DAMAGE_PERCENT,
  RALLY_DURATION,
  RANK_BONUS_PERCENT,
  RANK_XP,
  SHIELDMAIDEN,
  SLAYER,
  SPELL_DEFS,
  STANCE_DEFS,
  SUMMON_DEAD,
  SUMMON_ELVES,
  SUMMONS,
  SUN_FLARE,
  TRAIN_ARCHERS_RADIUS,
  TRAMPLE,
  UNIT_DEFS,
  UnitTypeId,
  Upgrade,
  VOLLEY,
  WIZARD_BLAST,
  WORD_OF_POWER,
} from '@bulwark/shared';
import { entityExists, hasComponent, query, removeEntity } from 'bitecs';
import { BattalionMode } from '../components';
import { SIM_HZ } from '../constants';
import { cellAt, isBlockedAt } from '../nav/grid';
import { STAT } from '../unitStats';
import { type SimWorld, SpellEffect } from '../world';
import { applyDamage, arrowDmgType, fireProjectile, hasGear, splash } from './combat';
import { orderBattalions, spawnBattalion, spawnBattalionRow } from './commands';
import { fortressDoor } from './fortress';
import { forEachMember } from './spatial';

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

const DMG_MAGIC = DAMAGE_TYPES.indexOf('magic');
const DMG_FIRE = DAMAGE_TYPES.indexOf('fire');

/** Oyuncu tarafının kahraman kadrosu. */
const heroesOf = (world: SimWorld) => factionDef(world.match.faction).heroes;
/** Kahraman tipinin yuvası (taraf kadrosu indeksi; -1 = bu tarafın kahramanı değil). */
export const heroSlot = (world: SimWorld, unitType: number): number =>
  heroesOf(world).findIndex((h) => h.unitType === unitType);
const isHeroType = (world: SimWorld, t: number) => STAT.hero[t] === 1 && heroSlot(world, t) >= 0;

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
  if (melee && hasGear(world, b, Upgrade.ForgedBlades)) pct += 25;
  // Birleşik ordu: yakın dövüş dostlarının önünde nişan alan okçular +%15.
  if (!melee && b !== 0 && Battalion.horde[b]) pct = ((pct * HORDE.dealtPercent) / 100) | 0;
  if (b !== 0 && Battalion.combo[b]) {
    const c = HORDE_COMBOS[(Battalion.combo[b] as number) - 1];
    if (c) pct = ((pct * (Battalion.unitType[b] === c.a ? c.aDealt : c.bDealt)) / 100) | 0;
  }
  if (b !== 0) {
    // Duruş ve Güneş Parlaması zayıflığı.
    pct = ((pct * (STANCE_DEFS[Battalion.stance[b] as number]?.dealt ?? 100)) / 100) | 0;
    if ((Battalion.weakUntil[b] as number) > world.tick) pct = ((pct * SUN_FLARE.dealtPercent) / 100) | 0;
  }
  // Kahraman güçlendirmesi (Elendil'in Kılıcı, Kalkan Kızı): ×2.
  if (b !== 0)
    for (let k = 0; k < MAX_HEROES; k++) {
      const i = team * MAX_HEROES + k;
      if (b === m.heroes[i] && (m.heroBuff[i] as number) > world.tick) pct *= 2;
    }
  return pct;
};

/** Hedefin tabur rütbesine göre alınan hasar yüzdesi (rütbe 3 → 100/120). */
export const defensePercent = (world: SimWorld, target: number): number => {
  const b = world.c.Soldier.battalion[target] as number;
  if (b === 0) return 100;
  const { Battalion } = world.c;
  let pct = ((100 * 100) / (100 + RANK_BONUS_PERCENT * ((Battalion.rank[b] as number) - 1))) | 0;
  pct = ((pct * (STANCE_DEFS[Battalion.stance[b] as number]?.taken ?? 100)) / 100) | 0;
  if ((Battalion.weakUntil[b] as number) > world.tick) pct = ((pct * SUN_FLARE.takenPercent) / 100) | 0;
  // Birleşik ordu: okçularla birlikte duran yakın dövüş taburu daha az hasar alır.
  if (Battalion.horde[b] && STAT.ranged[Battalion.unitType[b] as number] !== 1)
    pct = ((pct * HORDE.takenPercent) / 100) | 0;
  if (Battalion.combo[b]) {
    const c = HORDE_COMBOS[(Battalion.combo[b] as number) - 1];
    if (c) pct = ((pct * (Battalion.unitType[b] === c.a ? c.aTaken : c.bTaken)) / 100) | 0;
  }
  return pct;
};

/** XP ver ve gerekirse rütbe atlat. */
export const awardXp = (world: SimWorld, b: number, xp: number): void => {
  const { Battalion } = world.c;
  if (b <= 0 || !entityExists(world, b) || !hasComponent(world, b, Battalion)) return;
  // Sancaktar: daha hızlı deneyim.
  const gain = Battalion.banner[b] ? ((xp * BANNER.xpPercent) / 100) | 0 : xp;
  const total = (Battalion.xp[b] as number) + gain;
  Battalion.xp[b] = total;
  // Kahramanlar 10 seviyeye kadar (HERO_XP), taburlar 5 rütbeye kadar (RANK_XP).
  const hero = STAT.hero[Battalion.unitType[b] as number] === 1;
  const table = hero ? HERO_XP : RANK_XP;
  const max = hero ? MAX_HERO_LEVEL : MAX_RANK;
  let r = Battalion.rank[b] as number;
  while (r < max && total >= (table[r + 1] as number)) r++;
  Battalion.rank[b] = r;
};

/** Kahraman taburu silindiğinde (ölüm) çağrılır. */
export const onBattalionRemoved = (world: SimWorld, b: number, team: number): void => {
  const m = world.match;
  if (m.hero[team] === b) m.hero[team] = 0;
  for (let k = 0; k < MAX_HEROES; k++) {
    const i = team * MAX_HEROES + k;
    if (m.heroes[i] === b) {
      m.heroes[i] = 0;
      m.heroReady[i] = world.tick + ticks(HERO.reviveTime);
    }
  }
};

export const summonHero = (world: SimWorld, team: number, unitType: number): boolean => {
  const m = world.match;
  const map = world.map;
  if (!map || m.state !== MatchState.Playing || !isHeroType(world, unitType)) return false;
  const i = team * MAX_HEROES + heroSlot(world, unitType);
  if ((m.heroes[i] as number) !== 0 || world.tick < (m.heroReady[i] as number)) return false;
  const cost = UNIT_DEFS[unitType]?.cost ?? 0;
  if ((m.gold[team] as number) < cost) return false;
  m.gold[team] = (m.gold[team] as number) - cost;
  // Kahraman kalenin kapısından çıkar (GDD §8.1).
  const [dx, dz] = fortressDoor(world);
  const b = spawnBattalion(world, team, unitType, dx, dz, 16384);
  m.heroes[i] = b;
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

/** (x, z) çevresinde `radius` içindeki canlı düşman askerleri. */
const enemiesNear = (world: SimWorld, team: number, x: Fx, z: Fx, radius: Fx): number[] => {
  const { Health, Position, Team, Dead, Soldier } = world.c;
  const out: number[] = [];
  for (const e of query(world, [Health, Position, Soldier])) {
    if (Team.id[e] === team || Dead.at[e] !== 0) continue;
    if (fxLen(((Position.x[e] as number) - x) | 0, ((Position.z[e] as number) - z) | 0) <= radius)
      out.push(e);
  }
  return out;
};

export const useAbility = (world: SimWorld, team: number, unit: number, ability: number): boolean => {
  const m = world.match;
  const { Battalion, Position, Team, UnitType } = world.c;
  if (m.state !== MatchState.Playing || unit === 0 || !Number.isInteger(ability)) return false;
  let k = -1;
  for (let i = 0; i < MAX_HEROES; i++) if (m.heroes[team * MAX_HEROES + i] === unit) k = i;
  const def = heroesOf(world)[k]?.abilities[ability];
  if (!def || !entityExists(world, unit) || (Battalion.rank[unit] as number) < def.rank) return false;
  const slot = (team * MAX_HEROES + k) * MAX_ABILITIES + ability;
  if (world.tick < (m.abilityReady[slot] as number)) return false;
  m.abilityReady[slot] = world.tick + ticks(def.cooldown);
  const x = Position.x[unit] as number;
  const z = Position.z[unit] as number;
  switch (def.key) {
    case 'elendil':
      m.heroBuff[team * MAX_HEROES + k] = world.tick + ticks(ELENDIL_DURATION);
      break;
    case 'shieldmaiden': {
      m.heroBuff[team * MAX_HEROES + k] = world.tick + ticks(SHIELDMAIDEN.duration);
      const { Health } = world.c;
      forEachMember(world, unit, (s) => {
        const max = Health.max[s] as number;
        Health.hp[s] = Math.min(
          max,
          (Health.hp[s] as number) + (((max * SHIELDMAIDEN.healPercent) / 100) | 0),
        );
      });
      break;
    }
    case 'kings_glory':
      m.rallyUntil[team] = Math.max(m.rallyUntil[team] as number, world.tick + ticks(KINGS_GLORY_DURATION));
      break;
    case 'eored':
      summonAt(
        world,
        team,
        def.unit ?? UnitTypeId.RohanRiders,
        x,
        (z + fxFromFloat(6)) | 0,
        def.count ?? 1,
        EORED.duration,
        16384,
      );
      break;
    case 'summon_dead':
      summonAt(
        world,
        team,
        def.unit ?? UnitTypeId.DeadArmy,
        x,
        (z + fxFromFloat(6)) | 0,
        def.count ?? 2,
        SUMMON_DEAD.duration,
        16384,
      );
      break;
    case 'summon_elves':
      summonAt(
        world,
        team,
        def.unit ?? UnitTypeId.LorienArcher,
        x,
        (z - fxFromFloat(6)) | 0,
        def.count ?? 2,
        SUMMON_ELVES.duration,
        16384,
      );
      break;
    case 'istar_light':
      weakenArea(world, team, x, z, fxFromFloat(def.radius ?? 20), SUN_FLARE.damage);
      break;
    case 'eagle_call':
      m.volleys.push({
        kind: SpellEffect.Eagles,
        x,
        z,
        team,
        next: world.tick + ticks(EAGLES.delay),
        left: EAGLES.dives,
      });
      break;
    case 'flood_call':
      m.volleys.push({ kind: SpellEffect.Flood, x, z, team, next: world.tick + 2, left: FLOOD.rings });
      break;
    case 'slayer': {
      // En güçlü düşman: önce boss, sonra en yüksek azami can.
      let best = 0;
      let score = -1;
      for (const e of enemiesNear(world, team, x, z, fxFromFloat(def.radius ?? SLAYER.radius))) {
        const t = UnitType.id[e] as number;
        const v = (STAT.boss[t] === 1 ? 1_000_000 : 0) + (world.c.Health.max[e] as number);
        if (v > score) {
          score = v;
          best = e;
        }
      }
      if (best !== 0) applyDamage(world, best, def.damage ?? SLAYER.damage, DMG_MAGIC, unit);
      break;
    }
    case 'athelas':
      healArea(world, team, x, z, ATHELAS_R, 50);
      break;
    case 'wizard_blast':
    case 'word_of_power': {
      const p = def.key === 'wizard_blast' ? WIZARD_BLAST : WORD_OF_POWER;
      for (const e of enemiesNear(world, team, x, z, fxFromFloat(def.radius ?? p.radius)))
        applyDamage(world, e, def.damage ?? p.damage, DMG_MAGIC, unit);
      break;
    }
    case 'arrow_wind': {
      const targets = enemiesNear(world, team, x, z, fxFromFloat(def.radius ?? ARROW_WIND.radius));
      if (targets.length === 0) break;
      const dmgType = arrowDmgType(world, team, DMG_PIERCE);
      for (let i = 0; i < (def.count ?? ARROW_WIND.arrows); i++) {
        const t = targets[world.rng.nextInt(targets.length)] as number;
        fireProjectile(world, x, z, t, def.damage ?? ARROW_WIND.damage, dmgType, 180, unit);
      }
      break;
    }
    case 'train_archers': {
      const r = fxFromFloat(TRAIN_ARCHERS_RADIUS);
      for (const b of query(world, [Battalion, Position])) {
        if (Team.id[b] !== team || b === unit || (Battalion.count[b] as number) === 0) continue;
        const t = Battalion.unitType[b] as number;
        if (STAT.ranged[t] !== 1 || STAT.hero[t] === 1) continue;
        if (fxLen(((Position.x[b] as number) - x) | 0, ((Position.z[b] as number) - z) | 0) > r) continue;
        const rank = Battalion.rank[b] as number;
        if (rank >= MAX_RANK) continue;
        awardXp(world, b, Math.max(1, (RANK_XP[rank + 1] as number) - (Battalion.xp[b] as number)));
      }
      break;
    }
  }
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
  // Tarafa özgü çağrılan birim / sayı (Isengard: Uruk takviyesi, warg akını, Balrog).
  const fs = factionDef(m.faction).spells?.[def.key];
  switch (def.key) {
    case 'heal':
      healArea(world, team, x, z, fxFromFloat(def.radius), 60);
      break;
    case 'rally':
      m.rallyUntil[team] = world.tick + ticks(RALLY_DURATION);
      break;
    case 'arrow_volley':
      m.volleys.push({ kind: SpellEffect.Volley, x, z, team, next: world.tick + 4, left: VOLLEY.waves });
      break;
    case 'sun_flare':
      weakenArea(world, team, x, z, FLARE_R, SUN_FLARE.damage);
      break;
    case 'earthquake':
      m.volleys.push({ kind: SpellEffect.Quake, x, z, team, next: world.tick + 2, left: EARTHQUAKE.pulses });
      break;
    case 'eagles':
      m.volleys.push({
        kind: SpellEffect.Eagles,
        x,
        z,
        team,
        next: world.tick + ticks(EAGLES.delay),
        left: EAGLES.dives,
      });
      break;
    case 'flood':
      m.volleys.push({ kind: SpellEffect.Flood, x, z, team, next: world.tick + 2, left: FLOOD.rings });
      break;
    case 'elven_allies':
      summonAt(
        world,
        team,
        fs?.unit ?? UnitTypeId.LorienArcher,
        x,
        z,
        fs?.count ?? SUMMONS.elvenAllies.battalions,
        SUMMONS.elvenAllies.duration,
        16384,
      );
      break;
    case 'army_of_dead':
      summonAt(
        world,
        team,
        fs?.unit ?? UnitTypeId.DeadArmy,
        x,
        z,
        fs?.count ?? SUMMONS.armyOfDead.battalions,
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
        fs?.unit ?? UnitTypeId.Rohirrim,
        sx,
        z,
        fs?.count ?? SUMMONS.rohirrim.battalions,
        SUMMONS.rohirrim.duration,
        32768,
      );
      orderBattalions(world, bs, gx, z, team, BattalionMode.Move);
      break;
    }
  }
  return true;
};

const VOLLEY_R: Fx = fxFromFloat(SPELL_DEFS.find((s) => s.key === 'arrow_volley')?.radius ?? 12);
const QUAKE_R: Fx = fxFromFloat(SPELL_DEFS.find((s) => s.key === 'earthquake')?.radius ?? 16);
const FLARE_R: Fx = fxFromFloat(SPELL_DEFS.find((s) => s.key === 'sun_flare')?.radius ?? 16);
const FLOOD_R = SPELL_DEFS.find((s) => s.key === 'flood')?.radius ?? 20;
const EAGLE_R: Fx = fxFromFloat(EAGLES.radius);

/** Kartal dalışı i'nin hedefe göre ofseti (m) — istemci görseli de aynı deseni kullanır. */
export const eagleDive = (i: number): [number, number] =>
  ((
    [
      [0, 0],
      [5, 4],
      [-5, -4],
      [4, -5],
    ] as const
  )[i % 4] as [number, number]) ?? [0, 0];

const volleyWave = (world: SimWorld, team: number, x: Fx, z: Fx): void => {
  const targets = enemiesNear(world, team, x, z, VOLLEY_R);
  if (targets.length === 0) return;
  const dmgType = arrowDmgType(world, team, DMG_PIERCE);
  for (let i = 0; i < VOLLEY.arrows; i++) {
    const t = targets[world.rng.nextInt(targets.length)] as number;
    const fx = (x + fxMul(world.rng.nextFx() - FX_HALF, VOLLEY_BACK)) | 0;
    const fz = (z - VOLLEY_BACK) | 0;
    fireProjectile(world, fx, fz, t, VOLLEY.damage, dmgType, 2400, 0);
  }
};

/** Güneş Parlaması / Beyaz Işık: alandaki düşmanlara hasar ve taburlarına zayıflık. */
const weakenArea = (world: SimWorld, team: number, x: Fx, z: Fx, r: Fx, damage: number): void => {
  const { Soldier, Battalion } = world.c;
  const until = world.tick + ticks(SUN_FLARE.duration);
  for (const e of enemiesNear(world, team, x, z, r)) {
    applyDamage(world, e, damage, DMG_MAGIC);
    const b = Soldier.battalion[e] as number;
    if (b !== 0) Battalion.weakUntil[b] = until;
  }
};

/** Deprem sarsıntısı: askerlere ezme hasarı, düşman yapılarına (merdiven, kuşatma kulesi) ağır hasar. */
const quakePulse = (world: SimWorld, team: number, x: Fx, z: Fx): void => {
  for (const e of enemiesNear(world, team, x, z, QUAKE_R))
    applyDamage(world, e, EARTHQUAKE.damage, DMG_CRUSH);
  const { Structure, Position, Team } = world.c;
  for (const st of query(world, [Structure, Position])) {
    if (Team.id[st] === team || (Structure.hp[st] as number) <= 0) continue;
    const d = fxLen(((Position.x[st] as number) - x) | 0, ((Position.z[st] as number) - z) | 0);
    if (d <= QUAKE_R + (Structure.radius[st] as number))
      applyDamage(world, st, EARTHQUAKE.structureDamage, DMG_CRUSH);
  }
};

/** Sel halkası k (0 tabanlı): [k, k+1] × R / halka aralığındaki düşmanlar hasar alır ve dışa sürüklenir. */
const floodRing = (world: SimWorld, team: number, x: Fx, z: Fx, k: number): void => {
  const { Position, Health, Team, Dead, Soldier } = world.c;
  const r0 = fxFromFloat((FLOOD_R * k) / FLOOD.rings);
  const r1 = fxFromFloat((FLOOD_R * (k + 1)) / FLOOD.rings);
  const push = fxFromFloat(FLOOD.push);
  for (const e of query(world, [Health, Position, Soldier])) {
    if (Team.id[e] === team || Dead.at[e] !== 0) continue;
    const dx = ((Position.x[e] as number) - x) | 0;
    const dz = ((Position.z[e] as number) - z) | 0;
    const d = fxLen(dx, dz);
    if (d < r0 || d > r1) continue;
    applyDamage(world, e, FLOOD.damage, DMG_MAGIC);
    if (d === 0 || STAT.boss[world.c.UnitType.id[e] as number] === 1) continue;
    const nx = ((Position.x[e] as number) + fxMul(fxDiv(dx, d), push)) | 0;
    const nz = ((Position.z[e] as number) + fxMul(fxDiv(dz, d), push)) | 0;
    if (!isBlockedAt(world.nav, nx, nz, Team.id[e] as number)) {
      Position.x[e] = nx;
      Position.z[e] = nz;
    }
  }
};

const HORDE_R: Fx = fxFromFloat(HORDE.radius);
/** (a türü × 256 + b türü) → kombinasyon indeksi; iki yön de. */
const COMBO_OF = new Map<number, number>(
  HORDE_COMBOS.flatMap((c, k) => [
    [c.a * 256 + c.b, k],
    [c.b * 256 + c.a, k],
  ]),
);
/** Birleşik ordu: taburun yakınında karşıt türden (yakın dövüş ↔ okçu) dost tabur var mı. */
const hordeSystem = (world: SimWorld): void => {
  const { Battalion, Position, Team } = world.c;
  const list: number[] = [];
  for (const b of query(world, [Battalion, Position])) {
    Battalion.horde[b] = 0;
    const t = Battalion.unitType[b] as number;
    if (
      STAT.hero[t] === 1 ||
      STAT.summoned[t] === 1 ||
      STAT.worker[t] === 1 ||
      (Battalion.count[b] as number) === 0
    )
      continue;
    list.push(b);
  }
  for (const b of list) Battalion.combo[b] = 0;
  for (let i = 0; i < list.length; i++) {
    const a = list[i] as number;
    const ta = Battalion.unitType[a] as number;
    const ra = STAT.ranged[ta];
    for (let j = i + 1; j < list.length; j++) {
      const c = list[j] as number;
      // Oyuncu tarafı (dalgalar mevcut dengeyle kalsın).
      if (Team.id[a] !== 0 || Team.id[c] !== 0) continue;
      const tc = Battalion.unitType[c] as number;
      const k = COMBO_OF.get(ta * 256 + tc);
      if (k === undefined || (Battalion.combo[a] && Battalion.combo[c])) continue;
      const d = fxLen(
        ((Position.x[a] as number) - (Position.x[c] as number)) | 0,
        ((Position.z[a] as number) - (Position.z[c] as number)) | 0,
      );
      if (d <= HORDE_R) {
        Battalion.combo[a] = k + 1;
        Battalion.combo[c] = k + 1;
      }
    }
    for (let j = i + 1; j < list.length; j++) {
      const c = list[j] as number;
      if (Team.id[a] !== Team.id[c] || STAT.ranged[Battalion.unitType[c] as number] === ra) continue;
      if (Battalion.horde[a] && Battalion.horde[c]) continue;
      const d = fxLen(
        ((Position.x[a] as number) - (Position.x[c] as number)) | 0,
        ((Position.z[a] as number) - (Position.z[c] as number)) | 0,
      );
      if (d <= HORDE_R) {
        Battalion.horde[a] = 1;
        Battalion.horde[c] = 1;
      }
    }
  }
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
    const t = Battalion.unitType[b] as number;
    // Hücum eden çağrılmış süvari (Rohirrim büyüsü) hücumu bitince çekilir.
    const chargeDone = STAT.charger[t] === 1 && STAT.summoned[t] === 1 && Battalion.active[b] === 0;
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
      let inAura = 0;
      // Liderler: takımın kahramanları ve (düşmanda) boss.
      for (let k = -1; k < MAX_HEROES && !inAura; k++) {
        const h = (k < 0 ? m.hero[team] : m.heroes[team * MAX_HEROES + k]) as number;
        if (h === 0 || h === b || !entityExists(world, h)) continue;
        const d = fxLen(
          ((Position.x[h] as number) - (Position.x[b] as number)) | 0,
          ((Position.z[h] as number) - (Position.z[b] as number)) | 0,
        );
        inAura = d <= AURA_R ? 1 : 0;
      }
      Battalion.aura[b] = inAura;
    }
    hordeSystem(world);
  }
  // Ateş aurası (Balrog): her saniye çevresini yakar.
  if (world.tick % SIM_HZ === 0)
    for (const s of query(world, [Soldier, Position])) {
      const t = world.c.UnitType.id[s] as number;
      const r = STAT.fireAuraR[t] as number;
      if (r === 0 || Dead.at[s] !== 0) continue;
      splash(
        world,
        Position.x[s] as number,
        Position.z[s] as number,
        r,
        Team.id[s] as number,
        STAT.fireAuraDmg[t] as number,
        DMG_FIRE,
        0,
        Soldier.battalion[s] as number,
      );
    }
  // Sancaktar: çatışma dışındaki ve bir süredir vurulmayan askerler iyileşir.
  if (world.tick % SIM_HZ === 0) {
    // Kahramanlar savaş alanında kaldıkça pasif deneyim kazanır.
    for (let i = 0; i < m.heroes.length; i++) {
      const h = m.heroes[i] as number;
      if (h !== 0 && entityExists(world, h)) awardXp(world, h, HERO_PASSIVE_XP);
    }
    const calm = ticks(BANNER.calm);
    for (const b of query(world, [Battalion])) {
      if (Battalion.banner[b] !== 1 || Battalion.engaged[b] === 1) continue;
      forEachMember(world, b, (s) => {
        if (Dead.at[s] !== 0) return;
        const last = Health.lastHit[s] as number;
        if (last !== 0 && world.tick - (last - 1) < calm) return;
        const max = Health.max[s] as number;
        Health.hp[s] = Math.min(
          max,
          (Health.hp[s] as number) + Math.max(1, ((max * BANNER.regenPercent) / 100) | 0),
        );
      });
    }
  }
  if (m.volleys.length === 0) return;
  for (const v of m.volleys) {
    if (world.tick < v.next) continue;
    v.left--;
    switch (v.kind) {
      case SpellEffect.Volley:
        v.next = world.tick + ticks(VOLLEY.gap);
        volleyWave(world, v.team, v.x, v.z);
        break;
      case SpellEffect.Quake:
        v.next = world.tick + ticks(EARTHQUAKE.gap);
        quakePulse(world, v.team, v.x, v.z);
        break;
      case SpellEffect.Eagles: {
        v.next = world.tick + ticks(EAGLES.gap);
        const [ox, oz] = eagleDive(EAGLES.dives - 1 - v.left);
        const dx = (v.x + fxFromFloat(ox)) | 0;
        const dz = (v.z + fxFromFloat(oz)) | 0;
        for (const e of enemiesNear(world, v.team, dx, dz, EAGLE_R))
          applyDamage(world, e, EAGLES.damage, DMG_CRUSH);
        break;
      }
      case SpellEffect.Flood:
        v.next = world.tick + ticks(FLOOD.gap);
        floodRing(world, v.team, v.x, v.z, FLOOD.rings - v.left);
        break;
    }
  }
  m.volleys = m.volleys.filter((v) => v.left > 0);
};
