import {
  DIFFICULTIES,
  FX_HALF,
  FX_ONE,
  type Fx,
  fxCos,
  fxDiv,
  fxFromFloat,
  fxFromInt,
  fxLen,
  fxMul,
  fxSin,
  type StampedCommand,
  UNIT_DEFS,
} from '@bulwark/shared';
import { addComponent, addEntity, entityExists, hasComponent } from 'bitecs';
import { BattalionMode } from '../components';
import { cellAt, cellCenterX, cellCenterZ, isBlockedAt, nearestOpenCell } from '../nav/grid';
import { isUnitType, STAT } from '../unitStats';
import type { SimWorld } from '../world';
import { fortressUpgrade } from './fortress';
import { castSpell, summonHero, unlockSpell, useAbility } from './heroes';
import { buildStructure, repairGate, researchUpgrade, trainUnit } from './structures';

/** Oyuncu → takım eşlemesi (Phase 1: oyuncu N = takım N). Co-op'ta lobi belirleyecek. */
const teamOf = (player: number): number => player;

/** Taburlar arası yan boşluk (m). */
const BATTALION_GAP: Fx = fxFromFloat(2);

/** Serbest (tabursuz) bir birim oluşturur; tüm savaş/can değerleri birim tablosundan. */
export const spawnUnit = (world: SimWorld, team: number, unitType: number, x: Fx, z: Fx): number => {
  if (!isUnitType(unitType)) throw new Error(`Bilinmeyen birim tipi: ${unitType}`);
  const {
    Position,
    Velocity,
    Facing,
    Team,
    UnitType,
    Speed,
    MoveTarget,
    Health,
    Anim,
    Combat,
    Dead,
    Soldier,
  } = world.c;
  const eid = addEntity(world);
  for (const comp of [Position, Velocity, Facing, Team, UnitType, Speed, MoveTarget, Health, Anim, Combat])
    addComponent(world, eid, comp);
  Position.x[eid] = x;
  Position.z[eid] = z;
  Velocity.x[eid] = 0;
  Velocity.z[eid] = 0;
  // Başlangıçta karşı tarafa bak: takım 0 güneye (+Z), diğerleri kuzeye.
  Facing.angle[eid] = team === 0 ? 16384 : 49152;
  Team.id[eid] = team;
  UnitType.id[eid] = unitType;
  Speed.value[eid] = STAT.speed[unitType] as Fx;
  MoveTarget.active[eid] = 0;
  // Zorluk: düşman canı (harita maçında).
  const hpPct = world.map && team !== 0 ? (DIFFICULTIES[world.match.difficulty]?.enemyHpPercent ?? 100) : 100;
  const hp = Math.max(1, (((STAT.hp[unitType] as number) * hpPct) / 100) | 0);
  Health.hp[eid] = hp;
  Health.max[eid] = hp;
  Health.lastHit[eid] = 0;
  Health.lastBy[eid] = 0;
  Anim.state[eid] = 0;
  Anim.startTick[eid] = world.tick;
  Combat.target[eid] = 0;
  Combat.cooldown[eid] = 0;
  Combat.damage[eid] = STAT.damage[unitType] as number;
  Combat.dmgType[eid] = STAT.dmgType[unitType] as number;
  Combat.armor[eid] = STAT.armor[unitType] as number;
  Combat.interval[eid] = STAT.interval[unitType] as number;
  Combat.range[eid] = STAT.range[unitType] as Fx;
  Combat.ranged[eid] = STAT.ranged[unitType] as number;
  // Geri dönüştürülmüş eid önceki durumları taşımasın.
  Dead.at[eid] = 0;
  Soldier.battalion[eid] = 0;
  return eid;
};

/** Konum takım için kapalı hücredeyse en yakın açık hücre merkezine taşı. */
const snapOpen = (world: SimWorld, x0: Fx, z0: Fx, team: number): [Fx, Fx] => {
  const grid = world.nav;
  // Önce ızgaranın içine kıstır (kalabalık dalga sırası harita kenarını aşabilir).
  const lo = (grid.originFx + grid.cellFx) | 0;
  const hi = (-grid.originFx - grid.cellFx) | 0;
  const x = Math.max(lo, Math.min(hi, x0)) | 0;
  const z = Math.max(lo, Math.min(hi, z0)) | 0;
  if (!isBlockedAt(grid, x, z, team)) return [x, z];
  const c = nearestOpenCell(grid, cellAt(grid, x, z), team);
  return c < 0 ? [x, z] : [cellCenterX(grid, c), cellCenterZ(grid, c)];
};

/** Tabur genişliği (Fx): dosya × aralık + boşluk. */
const battalionWidth = (unitType: number): Fx => {
  const def = UNIT_DEFS[unitType];
  return ((def?.files ?? 5) * (STAT.spacing[unitType] as number) + BATTALION_GAP) | 0;
};

/** Sancak noktası + askerleri oluşturur. Askerler doğrudan yuvalarında doğar. */
export const spawnBattalion = (
  world: SimWorld,
  team: number,
  unitType: number,
  x: Fx,
  z: Fx,
  facing: number,
): number => {
  const def = UNIT_DEFS[unitType];
  if (!def) throw new Error(`Bilinmeyen birim tipi: ${unitType}`);
  const { Position, Facing, Team, Battalion, Soldier } = world.c;
  const [bx, bz] = snapOpen(world, x, z, team);
  const b = addEntity(world);
  for (const comp of [Position, Facing, Team, Battalion]) addComponent(world, b, comp);
  Position.x[b] = bx;
  Position.z[b] = bz;
  Facing.angle[b] = facing & 0xffff;
  Team.id[b] = team;
  Battalion.unitType[b] = unitType;
  Battalion.count[b] = def.battalionSize;
  Battalion.prefFiles[b] = def.files;
  Battalion.files[b] = Math.min(def.files, def.battalionSize);
  Battalion.spacing[b] = STAT.spacing[unitType] as Fx;
  // Tabur en yavaş askeri kadar hızlı; askerler yetişebilsin diye biraz daha yavaş.
  Battalion.speed[b] = fxMul(STAT.speed[unitType] as Fx, fxFromFloat(0.92));
  Battalion.active[b] = 0;
  Battalion.lagging[b] = 0;
  Battalion.stall[b] = 0;
  Battalion.mode[b] = BattalionMode.Idle;
  Battalion.targetBattalion[b] = 0;
  Battalion.targetStructure[b] = 0;
  Battalion.engaged[b] = 0;
  Battalion.enemy[b] = 0;
  Battalion.xp[b] = 0;
  Battalion.rank[b] = 1;
  Battalion.aura[b] = 0;
  Battalion.expires[b] = 0;
  const c = fxCos(facing);
  const sn = fxSin(facing);
  Battalion.cos[b] = c;
  Battalion.sin[b] = sn;
  const files = Battalion.files[b] as number;
  const spacing = Battalion.spacing[b] as number;
  const jitter = STAT.jitter[unitType] as Fx;
  for (let slot = 0; slot < def.battalionSize; slot++) {
    const jx = fxMul(((world.rng.nextFx() - FX_HALF) * 2) | 0, jitter);
    const jz = fxMul(((world.rng.nextFx() - FX_HALF) * 2) | 0, jitter);
    const file = slot % files;
    const rank = (slot / files) | 0;
    const lateral = ((fxMul((2 * file - (files - 1)) * FX_ONE, spacing) >> 1) + jz) | 0;
    const back = (rank * spacing + jx) | 0;
    const [sx, sz] = snapOpen(
      world,
      (bx - fxMul(c, back) - fxMul(sn, lateral)) | 0,
      (bz - fxMul(sn, back) + fxMul(c, lateral)) | 0,
      team,
    );
    const s = spawnUnit(world, team, unitType, sx, sz);
    addComponent(world, s, Soldier);
    Soldier.battalion[s] = b;
    Soldier.slot[s] = slot;
    Soldier.jx[s] = jx;
    Soldier.jz[s] = jz;
    Facing.angle[s] = facing & 0xffff;
  }
  return b;
};

/** `count` taburu bakış yönüne dik bir hatta yan yana oluşturur. */
export const spawnBattalionRow = (
  world: SimWorld,
  team: number,
  unitType: number,
  x: Fx,
  z: Fx,
  count: number,
  facing: number,
): number[] => {
  const n = Math.min(count, 64);
  const width = battalionWidth(unitType);
  // sağ = (−sin, cos)
  const rx = -fxSin(facing);
  const rz = fxCos(facing);
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const off = fxMul(((2 * k - (n - 1)) * FX_ONE) >> 1, width);
    out.push(
      spawnBattalion(world, team, unitType, (x + fxMul(rx, off)) | 0, (z + fxMul(rz, off)) | 0, facing),
    );
  }
  return out;
};

/** Komuttaki eid'leri taburlara (asker → kendi taburu) ve serbest birimlere ayırır. */
const splitOwned = (
  world: SimWorld,
  player: number,
  eids: readonly number[],
): { battalions: number[]; free: number[] } => {
  const team = teamOf(player);
  const { Battalion, Soldier, Team, Dead, UnitType } = world.c;
  const battalions = new Set<number>();
  const free: number[] = [];
  for (const eid of eids) {
    if (!Number.isInteger(eid) || eid <= 0 || !entityExists(world, eid) || Team.id[eid] !== team) continue;
    if (hasComponent(world, eid, Battalion)) battalions.add(eid);
    else if (hasComponent(world, eid, Soldier) && (Soldier.battalion[eid] as number) !== 0)
      battalions.add(Soldier.battalion[eid] as number);
    else if (hasComponent(world, eid, UnitType) && Dead.at[eid] === 0) free.push(eid);
  }
  return { battalions: [...battalions].sort((a, b) => a - b), free: free.sort((a, b) => a - b) };
};

/**
 * Tabur grubu emri: tüm grup hedefin akış alanını paylaşır; varışta taburlar hedef–grup
 * merkezi doğrultusuna dik bir hatta, mevcut yanal sıralarıyla yan yana dizilir.
 */
export const orderBattalions = (
  world: SimWorld,
  battalions: readonly number[],
  x: Fx,
  z: Fx,
  team: number,
  mode: number,
): void => {
  const { Position, Battalion } = world.c;
  const n = battalions.length;
  if (n === 0) return;
  let cx = 0;
  let cz = 0;
  let width = 0;
  for (const b of battalions) {
    cx += (Position.x[b] as number) / n;
    cz += (Position.z[b] as number) / n;
    width = Math.max(width, battalionWidth(Battalion.unitType[b] as number));
  }
  let dx = (x - Math.trunc(cx)) | 0;
  let dz = (z - Math.trunc(cz)) | 0;
  const len = fxLen(dx, dz);
  if (len === 0) {
    dx = FX_ONE;
    dz = 0;
  } else {
    dx = fxDiv(dx, len);
    dz = fxDiv(dz, len);
  }
  // Dik yön (sağ): (−dz, dx). Taburlar bu eksendeki mevcut sıralarına göre dizilir;
  // böylece yolları kesişmez (soldaki sola, sağdaki sağa). Eşitlikte eid.
  const lateralOf = (b: number) =>
    fxMul((Position.x[b] as number) - Math.trunc(cx), -dz) +
    fxMul((Position.z[b] as number) - Math.trunc(cz), dx);
  const ordered = [...battalions].sort((a, b) => lateralOf(a) - lateralOf(b) || a - b);
  ordered.forEach((b, k) => {
    const off = fxMul(((2 * k - (n - 1)) * FX_ONE) >> 1, width);
    const [gx, gz] = snapOpen(world, (x - fxMul(dz, off)) | 0, (z + fxMul(dx, off)) | 0, team);
    Battalion.goalX[b] = gx;
    Battalion.goalZ[b] = gz;
    Battalion.fieldX[b] = x;
    Battalion.fieldZ[b] = z;
    Battalion.active[b] = 1;
    Battalion.stall[b] = 0;
    Battalion.bestDist[b] = 0x7fffffff;
    Battalion.mode[b] = mode;
    Battalion.targetBattalion[b] = 0;
    Battalion.engaged[b] = 0;
  });
  // Alanı emir anında hesapla (önbelleğe girer; tick içinde tekrar hesaplanmaz).
  world.fields.get(x, z, team);
};

/** Kare ızgara ofseti (serbest birimler için): i. eleman için (dx, dz), merkezlenmiş. */
const gridOffset = (i: number, n: number, spacing: Fx): [Fx, Fx] => {
  let cols = 1;
  while (cols * cols < n) cols++;
  const rows = Math.ceil(n / cols);
  const col = i % cols;
  const row = (i / cols) | 0;
  return [
    fxMul(fxFromInt(2 * col - (cols - 1)), spacing) >> 1,
    fxMul(fxFromInt(2 * row - (rows - 1)), spacing) >> 1,
  ];
};

export const applyCommand = (world: SimWorld, sc: StampedCommand): void => {
  const { cmd } = sc;
  const team = teamOf(sc.player);
  const { MoveTarget, Velocity, Battalion, Position, Team } = world.c;
  switch (cmd.type) {
    case 'spawn': {
      // Geçersiz komutlar her istemcide aynı şekilde yok sayılır (worker'ı çökertmez).
      if (!isUnitType(cmd.unitType) || cmd.team < 0 || cmd.team > 3) break;
      const n = Math.min(cmd.count, 2000);
      for (let i = 0; i < n; i++) {
        const [dx, dz] = gridOffset(i, n, cmd.spacing);
        spawnUnit(world, cmd.team, cmd.unitType, (cmd.x + dx) | 0, (cmd.z + dz) | 0);
      }
      break;
    }
    case 'spawnBattalion': {
      if (!isUnitType(cmd.unitType) || cmd.team < 0 || cmd.team > 3) break;
      spawnBattalionRow(world, cmd.team, cmd.unitType, cmd.x, cmd.z, cmd.count, cmd.facing);
      break;
    }
    case 'move': {
      const split = splitOwned(world, sc.player, cmd.units);
      orderBattalions(world, split.battalions, cmd.x, cmd.z, team, BattalionMode.Move);
      split.free.forEach((eid, i) => {
        const [dx, dz] = gridOffset(i, split.free.length, cmd.spacing);
        MoveTarget.x[eid] = (cmd.x + dx) | 0;
        MoveTarget.z[eid] = (cmd.z + dz) | 0;
        MoveTarget.active[eid] = 1;
      });
      break;
    }
    case 'attack': {
      const t = cmd.target;
      if (
        !Number.isInteger(t) ||
        t <= 0 ||
        !entityExists(world, t) ||
        !hasComponent(world, t, Battalion) ||
        Team.id[t] === team ||
        (Battalion.count[t] as number) === 0
      )
        break;
      const split = splitOwned(world, sc.player, cmd.units);
      for (const b of split.battalions) {
        Battalion.mode[b] = BattalionMode.Attack;
        Battalion.targetBattalion[b] = t;
        Battalion.goalX[b] = Position.x[t] as number;
        Battalion.goalZ[b] = Position.z[t] as number;
        Battalion.fieldX[b] = Position.x[t] as number;
        Battalion.fieldZ[b] = Position.z[t] as number;
        Battalion.active[b] = 1;
        Battalion.stall[b] = 0;
        Battalion.bestDist[b] = 0x7fffffff;
        Battalion.engaged[b] = 0;
      }
      world.fields.get(Position.x[t] as number, Position.z[t] as number, team);
      break;
    }
    case 'build': {
      buildStructure(world, team, cmd.slot, cmd.kind);
      break;
    }
    case 'train': {
      trainUnit(world, team, cmd.building, cmd.unitType);
      break;
    }
    case 'research': {
      researchUpgrade(world, team, cmd.building, cmd.upgrade);
      break;
    }
    case 'repair': {
      repairGate(world, team, cmd.gate);
      break;
    }
    case 'summonHero': {
      summonHero(world, team, cmd.unitType);
      break;
    }
    case 'ability': {
      useAbility(world, team, cmd.unit, cmd.ability);
      break;
    }
    case 'unlockSpell': {
      unlockSpell(world, team, cmd.spell);
      break;
    }
    case 'castSpell': {
      castSpell(world, team, cmd.spell, cmd.x, cmd.z);
      break;
    }
    case 'fortressUpgrade': {
      fortressUpgrade(world, team, cmd.upgrade);
      break;
    }
    case 'stop': {
      const split = splitOwned(world, sc.player, cmd.units);
      for (const b of split.battalions) {
        Battalion.active[b] = 0;
        Battalion.mode[b] = BattalionMode.Idle;
      }
      for (const eid of split.free) {
        MoveTarget.active[eid] = 0;
        Velocity.x[eid] = 0;
        Velocity.z[eid] = 0;
      }
      break;
    }
  }
};
