import {
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
import { cellAt, cellCenterX, cellCenterZ, isBlockedAt, nearestOpenCell } from '../nav/grid';
import type { SimWorld } from '../world';

/** Oyuncu → takım eşlemesi (Phase 1: oyuncu N = takım N). Co-op'ta lobi belirleyecek. */
const teamOf = (player: number): number => player;

/** Birim tablosu Q16.16'ya bir kez çevrilir (fxFromFloat = Math.round → deterministik). */
const UNIT_SPEED: readonly Fx[] = UNIT_DEFS.map((d) => fxFromFloat(d.speed));
const UNIT_HP: readonly number[] = UNIT_DEFS.map((d) => d.hp);
const UNIT_SPACING: readonly Fx[] = UNIT_DEFS.map((d) => fxFromFloat(d.spacing));
const UNIT_JITTER: readonly Fx[] = UNIT_DEFS.map((d) => fxFromFloat(d.jitter));
/** Taburlar arası yan boşluk (m). */
const BATTALION_GAP: Fx = fxFromFloat(2);

export const spawnUnit = (world: SimWorld, team: number, unitType: number, x: Fx, z: Fx): number => {
  const { Position, Velocity, Facing, Team, UnitType, Speed, MoveTarget, Health, Anim } = world.c;
  if (!UNIT_SPEED[unitType]) throw new Error(`Bilinmeyen birim tipi: ${unitType}`);
  const eid = addEntity(world);
  for (const comp of [Position, Velocity, Facing, Team, UnitType, Speed, MoveTarget, Health, Anim])
    addComponent(world, eid, comp);
  Position.x[eid] = x;
  Position.z[eid] = z;
  Velocity.x[eid] = 0;
  Velocity.z[eid] = 0;
  // Başlangıçta karşı tarafa bak: takım 0 güneye (+Z), diğerleri kuzeye.
  Facing.angle[eid] = team === 0 ? 16384 : 49152;
  Team.id[eid] = team;
  UnitType.id[eid] = unitType;
  Speed.value[eid] = UNIT_SPEED[unitType] as Fx;
  MoveTarget.active[eid] = 0;
  const hp = UNIT_HP[unitType] as number;
  Health.hp[eid] = hp;
  Health.max[eid] = hp;
  Anim.state[eid] = 0;
  Anim.startTick[eid] = world.tick;
  // Geri dönüştürülmüş eid önceki tabur bağını taşımasın.
  world.c.Soldier.battalion[eid] = 0;
  return eid;
};

/** Konum kapalı hücredeyse en yakın açık hücre merkezine taşı. */
const snapOpen = (world: SimWorld, x: Fx, z: Fx): [Fx, Fx] => {
  const grid = world.nav;
  if (!isBlockedAt(grid, x, z)) return [x, z];
  const c = nearestOpenCell(grid, cellAt(grid, x, z));
  return c < 0 ? [x, z] : [cellCenterX(grid, c), cellCenterZ(grid, c)];
};

/** Tabur genişliği (Fx): dosya × aralık + boşluk. */
const battalionWidth = (unitType: number): Fx => {
  const def = UNIT_DEFS[unitType];
  return ((def?.files ?? 5) * (UNIT_SPACING[unitType] as number) + BATTALION_GAP) | 0;
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
  const [bx, bz] = snapOpen(world, x, z);
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
  Battalion.spacing[b] = UNIT_SPACING[unitType] as Fx;
  // Tabur en yavaş askeri kadar hızlı; askerler yetişebilsin diye biraz daha yavaş.
  Battalion.speed[b] = fxMul(UNIT_SPEED[unitType] as Fx, fxFromFloat(0.92));
  Battalion.active[b] = 0;
  Battalion.lagging[b] = 0;
  const c = fxCos(facing);
  const sn = fxSin(facing);
  Battalion.cos[b] = c;
  Battalion.sin[b] = sn;
  const files = Battalion.files[b] as number;
  const spacing = Battalion.spacing[b] as number;
  const jitter = UNIT_JITTER[unitType] as Fx;
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

/** Kare ızgara ofseti: i. eleman için (dx, dz), merkezlenmiş. Tamamen tamsayı aritmetiği. */
const gridOffset = (i: number, n: number, spacing: Fx): [Fx, Fx] => {
  let cols = 1;
  while (cols * cols < n) cols++;
  const rows = Math.ceil(n / cols);
  const col = i % cols;
  const row = (i / cols) | 0;
  // (col - (cols-1)/2) · spacing  =  (2·col - (cols-1)) · spacing / 2
  return [
    fxMul(fxFromInt(2 * col - (cols - 1)), spacing) >> 1,
    fxMul(fxFromInt(2 * row - (rows - 1)), spacing) >> 1,
  ];
};

/** Komuttaki eid'leri taburlara (asker → kendi taburu) ve serbest birimlere ayırır. */
const splitOwned = (
  world: SimWorld,
  player: number,
  eids: readonly number[],
): { battalions: number[]; free: number[] } => {
  const team = teamOf(player);
  const { Battalion, Soldier, Team } = world.c;
  const battalions = new Set<number>();
  const free: number[] = [];
  for (const eid of eids) {
    if (!Number.isInteger(eid) || eid <= 0 || !entityExists(world, eid) || Team.id[eid] !== team) continue;
    if (hasComponent(world, eid, Battalion)) battalions.add(eid);
    else if (hasComponent(world, eid, Soldier)) battalions.add(Soldier.battalion[eid] as number);
    else free.push(eid);
  }
  return { battalions: [...battalions].sort((a, b) => a - b), free: free.sort((a, b) => a - b) };
};

/**
 * Tabur grubu emri: tüm grup hedefin akış alanını paylaşır; varışta taburlar hedef–grup
 * merkezi doğrultusuna dik bir hatta yan yana dizilir.
 */
const orderBattalions = (world: SimWorld, battalions: readonly number[], x: Fx, z: Fx): void => {
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
    const [gx, gz] = snapOpen(world, (x - fxMul(dz, off)) | 0, (z + fxMul(dx, off)) | 0);
    Battalion.goalX[b] = gx;
    Battalion.goalZ[b] = gz;
    Battalion.fieldX[b] = x;
    Battalion.fieldZ[b] = z;
    Battalion.active[b] = 1;
    Battalion.stall[b] = 0;
  });
  // Alanı emir anında hesapla (önbelleğe girer; tick içinde tekrar hesaplanmaz).
  world.fields.get(x, z);
};

export const applyCommand = (world: SimWorld, sc: StampedCommand): void => {
  const { cmd } = sc;
  const { MoveTarget, Velocity } = world.c;
  switch (cmd.type) {
    case 'spawn': {
      // Geçersiz komutlar her istemcide aynı şekilde yok sayılır (worker'ı çökertmez).
      if (UNIT_SPEED[cmd.unitType] === undefined || cmd.team < 0 || cmd.team > 3) break;
      const n = Math.min(cmd.count, 2000);
      for (let i = 0; i < n; i++) {
        const [dx, dz] = gridOffset(i, n, cmd.spacing);
        spawnUnit(world, cmd.team, cmd.unitType, (cmd.x + dx) | 0, (cmd.z + dz) | 0);
      }
      break;
    }
    case 'spawnBattalion': {
      if (UNIT_SPEED[cmd.unitType] === undefined || cmd.team < 0 || cmd.team > 3) break;
      const n = Math.min(cmd.count, 64);
      const width = battalionWidth(cmd.unitType);
      // Taburları bakış yönüne dik bir hatta diz: sağ = (−sin, cos).
      const rx = -fxSin(cmd.facing);
      const rz = fxCos(cmd.facing);
      for (let k = 0; k < n; k++) {
        const off = fxMul(((2 * k - (n - 1)) * FX_ONE) >> 1, width);
        spawnBattalion(
          world,
          cmd.team,
          cmd.unitType,
          (cmd.x + fxMul(rx, off)) | 0,
          (cmd.z + fxMul(rz, off)) | 0,
          cmd.facing,
        );
      }
      break;
    }
    case 'move': {
      const split = splitOwned(world, sc.player, cmd.units);
      orderBattalions(world, split.battalions, cmd.x, cmd.z);
      const units = split.free;
      units.forEach((eid, i) => {
        const [dx, dz] = gridOffset(i, units.length, cmd.spacing);
        MoveTarget.x[eid] = (cmd.x + dx) | 0;
        MoveTarget.z[eid] = (cmd.z + dz) | 0;
        MoveTarget.active[eid] = 1;
      });
      break;
    }
    case 'stop': {
      const split = splitOwned(world, sc.player, cmd.units);
      for (const b of split.battalions) world.c.Battalion.active[b] = 0;
      for (const eid of split.free) {
        MoveTarget.active[eid] = 0;
        Velocity.x[eid] = 0;
        Velocity.z[eid] = 0;
      }
      break;
    }
  }
};
