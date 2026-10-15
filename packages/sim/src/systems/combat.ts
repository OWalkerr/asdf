import {
  AnimState,
  DAMAGE_TYPES,
  FX_HALF,
  type Fx,
  fxAtan2,
  fxDiv,
  fxFromFloat,
  fxLen,
  fxMul,
  LADDER,
  STANCE_DEFS,
  Upgrade,
} from '@bulwark/shared';
import { addComponent, addEntity, entityExists, hasComponent, query, removeEntity } from 'bitecs';
import { StructureKind } from '../components';
import { cellAt } from '../nav/grid';
import { ARMOR_STRUCTURE, PERCENT, STAT } from '../unitStats';
import type { SimWorld } from '../world';
import { clearLine } from './battalion';
import { attackPercent, defensePercent } from './heroes';
import { forEachMember } from './spatial';

/**
 * Savaş (GDD §6.4):
 * - Çatışan taburun yakın dövüşçüleri en yakın düşman askerini (uzamsal hash, ≤ ACQUIRE)
 *   kademeli olarak seçer (tick başına askerlerin 1/5'i), erişime kadar kovalar, vurur.
 * - Okçular hedef taburdan rastgele bir askere analitik ok atar; isabet impact tick'inde çözülür.
 * - Kapıya yönelmiş düşman taburları, birim hedefi yokken erişimdeki kapıya vurur.
 * Tümü tamsayı; rastgelelik yalnızca world.rng (deterministik sıra).
 */
const DMG_FIRE = DAMAGE_TYPES.indexOf('fire');
const ACQUIRE: Fx = fxFromFloat(6);
/** Savunucunun merdiveni fark edip yıkmaya gittiği mesafe. */
const LADDER_REACH: Fx = fxFromFloat(LADDER.defendReach);
const ACQUIRE_CELLS = 3;
/** Askerin sancaktan bu kadar uzaklaşınca hedefi bırakıp formasyona döndüğü mesafe. */
const LEASH: Fx = fxFromFloat(14);
/** İki gövde yarıçapı toplamı: erişim = silah menzili + gövde. */
const BODY: Fx = fxFromFloat(0.7);
/** Ok hızı: tick başına 2 m (40 m/s). */
const ARROW_STEP: Fx = fxFromFloat(2);
const ARROW_SPREAD: Fx = fxFromFloat(1.2);
const ARROW_HIT_RADIUS: Fx = fxFromFloat(1.3);
/** Taş: tick başına 1.1 m (22 m/s), saçılma 3 m. */
const STONE_STEP: Fx = fxFromFloat(1.1);
const STONE_SPREAD: Fx = fxFromFloat(3);
/** Saldırı animasyonunun süresi (tick); bu sürede yürüme/durma animasyonu araya girmez. */
export const ATTACK_ANIM_TICKS = 14;

const alive = (world: SimWorld, e: number): boolean =>
  e > 0 && entityExists(world, e) && hasComponent(world, e, world.c.Health) && world.c.Dead.at[e] === 0;

export const hasUpgrade = (world: SimWorld, team: number, upgrade: number): boolean =>
  ((world.match.upgrades[team] ?? 0) & (1 << upgrade)) !== 0;

/** Ok hasar tipi: Ateşli Oklar yükseltmesiyle 'fire'. */
export const arrowDmgType = (world: SimWorld, team: number, base: number): number =>
  hasUpgrade(world, team, Upgrade.FireArrows) ? DMG_FIRE : base;

/** Hasar uygular (GDD §6.2 çarpanı, en az 1). Birim veya yapı. */
export const applyDamage = (
  world: SimWorld,
  target: number,
  damage: number,
  dmgType: number,
  source = 0,
): void => {
  const { Structure, Health, Combat } = world.c;
  if (hasComponent(world, target, Structure)) {
    const pct = PERCENT[dmgType]?.[ARMOR_STRUCTURE] ?? 100;
    Structure.hp[target] = Math.max(
      0,
      (Structure.hp[target] as number) - Math.max(1, ((damage * pct) / 100) | 0),
    );
    return;
  }
  if (STAT.invulnerable[world.c.UnitType.id[target] as number] === 1) return;
  let pct = PERCENT[dmgType]?.[Combat.armor[target] as number] ?? 100;
  // Ağır Zırh yükseltmesi: alınan hasar −%25.
  if (hasUpgrade(world, world.c.Team.id[target] as number, Upgrade.HeavyArmor)) pct = (pct * 3) >> 2;
  // Tabur rütbesi dayanıklılığı.
  pct = ((pct * defensePercent(world, target)) / 100) | 0;
  Health.lastBy[target] = source;
  Health.hp[target] = (Health.hp[target] as number) - Math.max(1, ((damage * pct) / 100) | 0);
  Health.lastHit[target] = world.tick + 1;
};

/** Uzamsal hash'te `ACQUIRE` içindeki en yakın canlı düşman (görüş hattı açık); yoksa 0. */
const acquireNearest = (world: SimWorld, s: number, team: number): number => {
  const { Position, Team } = world.c;
  const grid = world.nav;
  const sx = Position.x[s] as number;
  const sz = Position.z[s] as number;
  const c = cellAt(grid, sx, sz);
  if (c < 0) return 0;
  const c0 = c % grid.cols;
  const r0 = (c / grid.cols) | 0;
  let best = 0;
  let bestD = ACQUIRE;
  for (let dr = -ACQUIRE_CELLS; dr <= ACQUIRE_CELLS; dr++) {
    const r = r0 + dr;
    if (r < 0 || r >= grid.rows) continue;
    for (let dc = -ACQUIRE_CELLS; dc <= ACQUIRE_CELLS; dc++) {
      const cc = c0 + dc;
      if (cc < 0 || cc >= grid.cols) continue;
      for (let o = world.hashHead[r * grid.cols + cc] as number; o !== -1; o = world.hashNext[o] as number) {
        if (Team.id[o] === team) continue;
        const d = fxLen(((Position.x[o] as number) - sx) | 0, ((Position.z[o] as number) - sz) | 0);
        if (d < bestD || (d === bestD && o < best)) {
          bestD = d;
          best = o;
        }
      }
    }
  }
  if (best !== 0 && !clearLine(grid, sx, sz, Position.x[best] as number, Position.z[best] as number, team))
    return 0;
  return best;
};

const face = (world: SimWorld, s: number, tx: number, tz: number): void => {
  const { Position, Facing } = world.c;
  Facing.angle[s] = fxAtan2((tz - (Position.z[s] as number)) | 0, (tx - (Position.x[s] as number)) | 0);
};

const startAttackAnim = (world: SimWorld, s: number): void => {
  world.c.Anim.state[s] = AnimState.Attack;
  world.c.Anim.startTick[s] = world.tick;
};

/**
 * Analitik ok: hedefin şimdiki konumuna (küçük sapmayla) nişan alır; uçuş süresi mesafeden.
 * height: çıkış yüksekliği (cm, zeminden) — yalnızca render yayı için.
 */
export const fireProjectile = (
  world: SimWorld,
  fromX: number,
  fromZ: number,
  target: number,
  damage: number,
  dmgType: number,
  height: number,
  source = 0,
): void => {
  const { Position, Projectile } = world.c;
  const tx = (Position.x[target] as number) + fxMul(world.rng.nextFx() - FX_HALF, ARROW_SPREAD);
  const tz = (Position.z[target] as number) + fxMul(world.rng.nextFx() - FX_HALF, ARROW_SPREAD);
  const d = fxLen((tx - fromX) | 0, (tz - fromZ) | 0);
  const p = addEntity(world);
  addComponent(world, p, Projectile);
  Projectile.fromX[p] = fromX;
  Projectile.fromZ[p] = fromZ;
  Projectile.toX[p] = tx | 0;
  Projectile.toZ[p] = tz | 0;
  Projectile.fireTick[p] = world.tick;
  Projectile.flight[p] = Math.max(4, Math.min(4000, (d / ARROW_STEP) | 0));
  Projectile.target[p] = target;
  Projectile.damage[p] = damage;
  Projectile.dmgType[p] = dmgType;
  Projectile.height[p] = height;
  Projectile.source[p] = source;
  Projectile.aoe[p] = 0;
  Projectile.kind[p] = 0;
};

/** Taş/gülle: noktaya atılır (yavaş, yüksek yay), isabette yarıçaptaki tüm düşmanlara hasar. */
export const fireStone = (
  world: SimWorld,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  damage: number,
  dmgType: number,
  height: number,
  aoe: Fx,
  team: number,
  kind = 1,
  source = 0,
): void => {
  const { Projectile } = world.c;
  const tx = (toX + fxMul(world.rng.nextFx() - FX_HALF, STONE_SPREAD)) | 0;
  const tz = (toZ + fxMul(world.rng.nextFx() - FX_HALF, STONE_SPREAD)) | 0;
  const d = fxLen((tx - fromX) | 0, (tz - fromZ) | 0);
  const p = addEntity(world);
  addComponent(world, p, Projectile);
  Projectile.fromX[p] = fromX;
  Projectile.fromZ[p] = fromZ;
  Projectile.toX[p] = tx;
  Projectile.toZ[p] = tz;
  Projectile.fireTick[p] = world.tick;
  Projectile.flight[p] = Math.max(8, Math.min(4000, (d / STONE_STEP) | 0));
  Projectile.target[p] = 0;
  Projectile.damage[p] = damage;
  Projectile.dmgType[p] = dmgType;
  Projectile.height[p] = height;
  Projectile.source[p] = source;
  Projectile.aoe[p] = aoe;
  Projectile.team[p] = team;
  Projectile.kind[p] = kind;
};

/** Alan hasarı: (x, z) çevresinde `radius` içindeki karşı takım birimleri (uzamsal hash). */
export const splash = (
  world: SimWorld,
  x: number,
  z: number,
  radius: Fx,
  team: number,
  damage: number,
  dmgType: number,
  exclude = 0,
  source = 0,
) => {
  const { Position, Team, Dead } = world.c;
  const grid = world.nav;
  const c = cellAt(grid, x, z);
  if (c < 0) return;
  const reach = Math.ceil(radius / grid.cellFx) + 1;
  const c0 = c % grid.cols;
  const r0 = (c / grid.cols) | 0;
  for (let dr = -reach; dr <= reach; dr++) {
    const r = r0 + dr;
    if (r < 0 || r >= grid.rows) continue;
    for (let dc = -reach; dc <= reach; dc++) {
      const cc = c0 + dc;
      if (cc < 0 || cc >= grid.cols) continue;
      for (let o = world.hashHead[r * grid.cols + cc] as number; o !== -1; o = world.hashNext[o] as number) {
        if (Team.id[o] === team || Dead.at[o] !== 0 || o === exclude) continue;
        if (fxLen(((Position.x[o] as number) - x) | 0, ((Position.z[o] as number) - z) | 0) <= radius)
          applyDamage(world, o, damage, dmgType, source);
      }
    }
  }
};

const fireArrow = (world: SimWorld, s: number, target: number): void => {
  const { Position, Combat, Team, Soldier, UnitType } = world.c;
  const team = Team.id[s] as number;
  const b = Soldier.battalion[s] as number;
  const aoe = STAT.breathAoe[UnitType.id[s] as number] as number;
  if (aoe > 0) {
    // Alev püskürtme: hedef noktasına alan hasarlı ateş topu (tür 2).
    fireStone(
      world,
      Position.x[s] as number,
      Position.z[s] as number,
      Position.x[target] as number,
      Position.z[target] as number,
      (((Combat.damage[s] as number) * attackPercent(world, b, team, false)) / 100) | 0,
      Combat.dmgType[s] as number,
      320,
      aoe,
      team,
      2,
      b,
    );
    return;
  }
  fireProjectile(
    world,
    Position.x[s] as number,
    Position.z[s] as number,
    target,
    (((Combat.damage[s] as number) * attackPercent(world, b, team, false)) / 100) | 0,
    arrowDmgType(world, team, Combat.dmgType[s] as number),
    150,
    b,
  );
};

/** İnşa edilmiş binalar (kapı ve kale hariç); tick başına bir kez, kuşatma okçuları için. */
const enemyBuildings = (world: SimWorld): number[] => {
  const { Structure } = world.c;
  const out: number[] = [];
  for (const e of query(world, [Structure])) {
    const kind = Structure.kind[e] as number;
    if (
      kind !== StructureKind.Gate &&
      kind !== StructureKind.Fortress &&
      kind !== StructureKind.Ladder &&
      kind !== StructureKind.SiegeTower
    )
      out.push(e);
  }
  return out;
};

export const combatSystem = (world: SimWorld): void => {
  const { Position, Velocity, Combat, Soldier, Battalion, Team, Speed, Structure, Dead, UnitType } = world.c;
  let buildings: number[] | null = null;
  for (const s of query(world, [Soldier, Combat, Position, Velocity])) {
    if (Dead.at[s] !== 0) continue;
    const cd = Combat.cooldown[s] as number;
    if (cd > 0) Combat.cooldown[s] = cd - 1;
    const b = Soldier.battalion[s] as number;
    if (b === 0) continue;
    const team = Team.id[s] as number;
    const sx = Position.x[s] as number;
    const sz = Position.z[s] as number;

    if (Battalion.engaged[b] === 1 && Combat.ranged[s] === 1) {
      // --- Okçu: hedef taburdan rastgele bir askere ok ---
      if ((Combat.cooldown[s] as number) > 0) continue;
      const e = Battalion.enemy[b] as number;
      const n = e > 0 && hasComponent(world, e, Battalion) ? (Battalion.count[e] as number) : 0;
      if (n === 0) continue;
      let pick = world.rng.nextInt(n);
      let target = 0;
      forEachMember(world, e, (m) => {
        if (pick-- === 0) target = m;
      });
      if (target === 0) continue;
      const d = fxLen(((Position.x[target] as number) - sx) | 0, ((Position.z[target] as number) - sz) | 0);
      if (d > (Combat.range[s] as number)) continue;
      fireArrow(world, s, target);
      // Hafif rastgele gecikme: bütün tabur aynı karede ateşlemesin.
      Combat.cooldown[s] = (Combat.interval[s] as number) + world.rng.nextInt(4);
      face(world, s, Position.x[target] as number, Position.z[target] as number);
      startAttackAnim(world, s);
      continue;
    }

    // --- Kuşatma okçusu: çatışmada değilken menzildeki düşman binasına ateşli ok ---
    if (Combat.ranged[s] === 1 && STAT.siegeArcher[UnitType.id[s] as number] === 1) {
      if ((Combat.cooldown[s] as number) > 0) continue;
      buildings ??= enemyBuildings(world);
      let target = 0;
      let best = Combat.range[s] as number;
      for (const e of buildings) {
        if (Team.id[e] === team || (Structure.hp[e] as number) <= 0) continue;
        const d = fxLen(((Position.x[e] as number) - sx) | 0, ((Position.z[e] as number) - sz) | 0);
        if (d < best) {
          best = d;
          target = e;
        }
      }
      if (target !== 0) {
        fireProjectile(world, sx, sz, target, (Combat.damage[s] as number) >> 1, DMG_FIRE, 150, b);
        Combat.cooldown[s] = (Combat.interval[s] as number) + world.rng.nextInt(6);
        face(world, s, Position.x[target] as number, Position.z[target] as number);
        startAttackAnim(world, s);
        continue;
      }
    }

    // --- Yakın dövüş ---
    let t = Combat.target[s] as number;
    if (t !== 0 && (!alive(world, t) || Team.id[t] === team)) t = 0;
    if (Battalion.engaged[b] === 1) {
      if (t === 0 && (s + world.tick) % 5 === 0) t = acquireNearest(world, s, team);
    } else {
      t = 0;
    }
    if (t !== 0) {
      const ax = (Position.x[b] as number) - sx;
      const az = (Position.z[b] as number) - sz;
      // Duruş kovalama mesafesini değiştirir (saldırgan uzağa, mevzi yakına).
      const leash = (((LEASH >> 4) * (STANCE_DEFS[Battalion.stance[b] as number]?.leash ?? 100)) / 100) << 4;
      if (fxLen(ax | 0, az | 0) > leash) t = 0;
    }
    Combat.target[s] = t;
    if (t !== 0) {
      const tx = Position.x[t] as number;
      const tz = Position.z[t] as number;
      const dx = (tx - sx) | 0;
      const dz = (tz - sz) | 0;
      const d = fxLen(dx, dz);
      if (d > (Combat.range[s] as number) + BODY) {
        const speed = Speed.value[s] as number;
        Velocity.x[s] = fxMul(fxDiv(dx, d), speed);
        Velocity.z[s] = fxMul(fxDiv(dz, d), speed);
      } else {
        Velocity.x[s] = 0;
        Velocity.z[s] = 0;
        face(world, s, tx, tz);
        if ((Combat.cooldown[s] as number) === 0) {
          // Rütbe, aura, Toplanma, Dövme Kılıçlar, Elendil.
          const dmg = (((Combat.damage[s] as number) * attackPercent(world, b, team, true)) / 100) | 0;
          applyDamage(world, t, dmg, Combat.dmgType[s] as number, b);
          // Yarma (trol): hedefin çevresindeki düşmanlara yarım hasar.
          const cleave = STAT.cleave[UnitType.id[s] as number] as number;
          if (cleave > 0 && !hasComponent(world, t, Structure))
            splash(world, tx, tz, cleave, team, dmg >> 1, Combat.dmgType[s] as number, t, b);
          Combat.cooldown[s] = Combat.interval[s] as number;
          startAttackAnim(world, s);
        }
      }
      continue;
    }

    // --- Savunucu: yakındaki kuşatma merdivenini yıkar ---
    if (team === 0 && world.match.ladders.length > 0) {
      let lad = 0;
      let bd = LADDER_REACH;
      for (const l of world.match.ladders) {
        const d = fxLen(((Position.x[l.eid] as number) - sx) | 0, ((Position.z[l.eid] as number) - sz) | 0);
        if (d < bd) {
          bd = d;
          lad = l.eid;
        }
      }
      if (
        lad !== 0 &&
        fxLen(((Position.x[b] as number) - sx) | 0, ((Position.z[b] as number) - sz) | 0) <= LEASH
      ) {
        const lx = Position.x[lad] as number;
        const lz = Position.z[lad] as number;
        const dx = (lx - sx) | 0;
        const dz = (lz - sz) | 0;
        if (bd > (Structure.radius[lad] as number) + (Combat.range[s] as number) + BODY) {
          const speed = Speed.value[s] as number;
          Velocity.x[s] = fxMul(fxDiv(dx, bd), speed);
          Velocity.z[s] = fxMul(fxDiv(dz, bd), speed);
        } else {
          Velocity.x[s] = 0;
          Velocity.z[s] = 0;
          face(world, s, lx, lz);
          if ((Combat.cooldown[s] as number) === 0) {
            applyDamage(world, lad, Combat.damage[s] as number, Combat.dmgType[s] as number);
            Combat.cooldown[s] = Combat.interval[s] as number;
            startAttackAnim(world, s);
          }
        }
        continue;
      }
    }

    // --- Kapı: birim hedefi yokken, varmış tabur erişimdeki kapıya vurur ---
    const g = Battalion.targetStructure[b] as number;
    if (
      g !== 0 &&
      Battalion.active[b] === 0 &&
      entityExists(world, g) &&
      hasComponent(world, g, Structure) &&
      (Structure.hp[g] as number) > 0
    ) {
      const gx = Position.x[g] as number;
      const gz = Position.z[g] as number;
      const d = fxLen((gx - sx) | 0, (gz - sz) | 0);
      if (d <= (Structure.radius[g] as number) + (Combat.range[s] as number)) {
        Velocity.x[s] = 0;
        Velocity.z[s] = 0;
        face(world, s, gx, gz);
        if ((Combat.cooldown[s] as number) === 0) {
          applyDamage(world, g, Combat.damage[s] as number, Combat.dmgType[s] as number);
          Combat.cooldown[s] = Combat.interval[s] as number;
          startAttackAnim(world, s);
        }
      }
    }
  }
};

/** Oklar: impact tick'inde hedef hâlâ isabet noktasının yakınındaysa hasar, sonra mermi silinir. */
export const projectileSystem = (world: SimWorld): void => {
  const { Projectile, Position } = world.c;
  for (const p of query(world, [Projectile])) {
    if (world.tick < (Projectile.fireTick[p] as number) + (Projectile.flight[p] as number)) continue;
    const aoe = Projectile.aoe[p] as number;
    if (aoe > 0) {
      splash(
        world,
        Projectile.toX[p] as number,
        Projectile.toZ[p] as number,
        aoe,
        Projectile.team[p] as number,
        Projectile.damage[p] as number,
        Projectile.dmgType[p] as number,
        0,
        Projectile.source[p] as number,
      );
      // Alan hasarı kuşatma yapılarına (merdiven, kule) da işler.
      const team = Projectile.team[p] as number;
      for (const l of world.match.ladders) {
        if (world.c.Team.id[l.eid] === team) continue;
        const d = fxLen(
          ((Position.x[l.eid] as number) - (Projectile.toX[p] as number)) | 0,
          ((Position.z[l.eid] as number) - (Projectile.toZ[p] as number)) | 0,
        );
        if (d <= aoe + (world.c.Structure.radius[l.eid] as number))
          applyDamage(world, l.eid, Projectile.damage[p] as number, Projectile.dmgType[p] as number);
      }
      removeEntity(world, p);
      continue;
    }
    const t = Projectile.target[p] as number;
    if (t > 0 && entityExists(world, t) && hasComponent(world, t, world.c.Structure)) {
      if ((world.c.Structure.hp[t] as number) > 0)
        applyDamage(world, t, Projectile.damage[p] as number, Projectile.dmgType[p] as number);
    } else if (alive(world, t)) {
      const d = fxLen(
        ((Position.x[t] as number) - (Projectile.toX[p] as number)) | 0,
        ((Position.z[t] as number) - (Projectile.toZ[p] as number)) | 0,
      );
      if (d <= ARROW_HIT_RADIUS)
        applyDamage(
          world,
          t,
          Projectile.damage[p] as number,
          Projectile.dmgType[p] as number,
          Projectile.source[p] as number,
        );
    }
    removeEntity(world, p);
  }
};
