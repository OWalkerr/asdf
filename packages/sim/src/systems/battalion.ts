import {
  ANGLE_HALF,
  angleDelta,
  angleWrap,
  FX_ONE,
  type Fx,
  fxAtan2,
  fxCos,
  fxDiv,
  fxFromFloat,
  fxLen,
  fxMul,
  fxSin,
} from '@bulwark/shared';
import { query } from 'bitecs';
import { COST_INF } from '../nav/flowField';
import { cellAt, cellCenterX, cellCenterZ, isBlockedAt, type NavGrid } from '../nav/grid';
import type { SimWorld } from '../world';

/**
 * Tabur hareketi (GDD §2.4 katman 1–2):
 * - Sancak noktası (tabur entity'si) paylaşılan akış alanını birkaç hücre ileriden izler
 *   (hafif "string pulling"), sınırlı dönüş hızıyla yumuşak kavisler çizer.
 * - Geride kalan asker çoksa yavaşlar; keskin dönüşte yavaşlar.
 * - Varışa yakın kişisel hedefe (yan yana dizilim noktası) doğrudan gider.
 */
const LOOKAHEAD_CELLS = 4;
const DIRECT_RANGE: Fx = fxFromFloat(12);
const ARRIVE: Fx = fxFromFloat(0.6);
/** Grup hedef bölgesinde kişisel noktaya varmak için tanınan süre (tick; 40 = 2 sn). */
const STALL_TICKS = 40;
/** Tick başına en fazla dönüş (uint16 açı; 2000 ≈ 11°). */
const TURN_PER_TICK = 2000;
/** Yuvasına bu kadar uzak asker "geride" sayılır. */
const LAG_DISTANCE: Fx = fxFromFloat(2.5);

/** a → b doğru parçası boyunca yarım hücre aralıklarla örnekler; hiç kapalı hücreye değmiyorsa true. */
export const clearLine = (grid: NavGrid, x0: Fx, z0: Fx, x1: Fx, z1: Fx): boolean => {
  const dx = (x1 - x0) | 0;
  const dz = (z1 - z0) | 0;
  const half = grid.cellFx >> 1;
  const steps = Math.min(64, (Math.max(Math.abs(dx), Math.abs(dz)) / half) | 0) + 1;
  for (let i = 1; i <= steps; i++) {
    if (isBlockedAt(grid, (x0 + Math.trunc((dx * i) / steps)) | 0, (z0 + Math.trunc((dz * i) / steps)) | 0))
      return false;
  }
  return true;
};

const turnToward = (current: number, target: number, maxStep: number): number => {
  const d = angleDelta(current, target);
  if (d > maxStep) return angleWrap(current + maxStep);
  if (d < -maxStep) return angleWrap(current - maxStep);
  return angleWrap(target);
};

export const battalionSystem = (world: SimWorld): void => {
  const { Position, Facing, Battalion } = world.c;
  const grid = world.nav;
  const dt = world.dtFx;
  for (const b of query(world, [Battalion, Position, Facing])) {
    if (Battalion.active[b]) {
      const x = Position.x[b] as number;
      const z = Position.z[b] as number;
      const gx = Battalion.goalX[b] as number;
      const gz = Battalion.goalZ[b] as number;
      const toGoal = fxLen((gx - x) | 0, (gz - z) | 0);
      // Grup hedef bölgesinde: kişisel dizilim noktasına düz yol yoksa hemen, varsa en fazla
      // STALL_TICKS boyunca dener (dar kapı önünde sonsuza kadar itişmesin).
      const here = cellAt(grid, x, z);
      const inGoalRegion =
        here >= 0 &&
        world.fields.get(Battalion.fieldX[b] as number, Battalion.fieldZ[b] as number)?.cost[here] === 0;
      if (inGoalRegion) Battalion.stall[b] = Math.min(255, (Battalion.stall[b] as number) + 1);
      const atGroupGoal =
        inGoalRegion && ((Battalion.stall[b] as number) > STALL_TICKS || !clearLine(grid, x, z, gx, gz));
      if (toGoal <= ARRIVE || atGroupGoal) {
        Battalion.active[b] = 0;
      } else {
        // Nişan noktası: yakındaysa kişisel hedef, değilse akış alanında birkaç hücre ileri.
        let ax = gx;
        let az = gz;
        if (toGoal > DIRECT_RANGE || !clearLine(grid, x, z, gx, gz)) {
          const field = world.fields.get(Battalion.fieldX[b] as number, Battalion.fieldZ[b] as number);
          const cell = cellAt(grid, x, z);
          if (field && cell >= 0 && field.cost[cell] !== COST_INF && field.cost[cell] !== 0) {
            // İleri bakış: zincirde, düz çizgisi açık kalan en uzak hücreye kadar ilerle.
            let c = cell;
            let aim = -1;
            for (let k = 0; k < LOOKAHEAD_CELLS; k++) {
              const n = field.next[c] as number;
              if (n < 0 || n === c) break;
              if (aim >= 0 && !clearLine(grid, x, z, cellCenterX(grid, n), cellCenterZ(grid, n))) break;
              aim = n;
              c = n;
            }
            if (aim >= 0) {
              ax = cellCenterX(grid, aim);
              az = cellCenterZ(grid, aim);
            }
          }
        }
        const desired = fxAtan2((az - z) | 0, (ax - x) | 0);
        const facing = turnToward(Facing.angle[b] as number, desired, TURN_PER_TICK);
        Facing.angle[b] = facing;
        let speed = Battalion.speed[b] as number;
        if ((Battalion.lagging[b] as number) * 3 > (Battalion.count[b] as number)) speed >>= 2;
        if (Math.abs(angleDelta(facing, desired)) > ANGLE_HALF >> 2) speed >>= 1;
        const step = fxMul(speed, dt);
        const nx = (x + fxMul(fxCos(facing), step)) | 0;
        const nz = (z + fxMul(fxSin(facing), step)) | 0;
        // Duvara çarpınca eksen boyunca kay; o da olmazsa doğrudan nişan noktasına yönel
        // (nişan noktası zincirdeki açık bir komşu hücre olduğundan her zaman ilerleme vardır).
        if (!isBlockedAt(grid, nx, nz)) {
          Position.x[b] = nx;
          Position.z[b] = nz;
        } else if (!isBlockedAt(grid, nx, z)) {
          Position.x[b] = nx;
        } else if (!isBlockedAt(grid, x, nz)) {
          Position.z[b] = nz;
        } else {
          const d = fxLen((ax - x) | 0, (az - z) | 0);
          if (d > 0) {
            const sx = (x + fxMul(fxDiv((ax - x) | 0, d), step)) | 0;
            const sz = (z + fxMul(fxDiv((az - z) | 0, d), step)) | 0;
            if (!isBlockedAt(grid, sx, sz)) {
              Position.x[b] = sx;
              Position.z[b] = sz;
              Facing.angle[b] = desired;
            }
          }
        }
      }
    }
    Battalion.cos[b] = fxCos(Facing.angle[b] as number);
    Battalion.sin[b] = fxSin(Facing.angle[b] as number);
  }
};

/**
 * Formasyon (GDD §6.1): her asker kendi yuvasına "arrive" ile gider. Yuva = sancak noktası
 * + ileri·(-sıra·aralık) + sağ·(dosya ofseti) + sabit sapma. Dar geçitte dosya sayısı azalır,
 * sıra sayısı artar (kolon formasyonu).
 */
export const formationSystem = (world: SimWorld): void => {
  const { Position, Velocity, Facing, Battalion, Soldier, Speed } = world.c;
  const grid = world.nav;
  for (const b of query(world, [Battalion, Position])) {
    const cell = cellAt(grid, Position.x[b] as number, Position.z[b] as number);
    const clearance = cell >= 0 ? (grid.clearance[cell] as number) : 0;
    // Kullanılabilir genişlik ≈ (2·boşluk − 1) hücre.
    const widthFx = Math.max(1, clearance * 2 - 1) * grid.cellFx;
    const fit = Math.max(1, (widthFx / (Battalion.spacing[b] as number)) | 0);
    const pref = Battalion.prefFiles[b] as number;
    Battalion.files[b] = Math.max(2, Math.min(pref, fit, Battalion.count[b] as number));
    Battalion.lagging[b] = 0;
  }
  for (const s of query(world, [Soldier, Position, Velocity])) {
    const b = Soldier.battalion[s] as number;
    const files = Battalion.files[b] as number;
    if (files === 0) continue;
    const slot = Soldier.slot[s] as number;
    const spacing = Battalion.spacing[b] as number;
    const file = slot % files;
    const rank = (slot / files) | 0;
    const lateral =
      ((fxMul((2 * file - (files - 1)) * FX_ONE, spacing) >> 1) + (Soldier.jz[s] as number)) | 0;
    const back = (rank * spacing + (Soldier.jx[s] as number)) | 0;
    const c = Battalion.cos[b] as number;
    const sn = Battalion.sin[b] as number;
    // ileri = (cos, sin), sağ = (−sin, cos)
    let tx = ((Position.x[b] as number) - fxMul(c, back) - fxMul(sn, lateral)) | 0;
    let tz = ((Position.z[b] as number) - fxMul(sn, back) + fxMul(c, lateral)) | 0;
    if (isBlockedAt(grid, tx, tz)) {
      // Yuva duvarın içinde: sancak noktasına doğru sıkış.
      tx = Position.x[b] as number;
      tz = Position.z[b] as number;
    }
    const dx = (tx - (Position.x[s] as number)) | 0;
    const dz = (tz - (Position.z[s] as number)) | 0;
    const dist = fxLen(dx, dz);
    if (dist > LAG_DISTANCE) Battalion.lagging[b] = ((Battalion.lagging[b] as number) + 1) & 0xffff;
    if (dist < fxFromFloat(0.12)) {
      Velocity.x[s] = 0;
      Velocity.z[s] = 0;
      // Yerindeyken taburun baktığı yöne dön.
      Facing.angle[s] = turnToward(Facing.angle[s] as number, Facing.angle[b] as number, 3000);
      continue;
    }
    // Arrive: uzaktayken %25 hızlı (yetişmek için), yaklaştıkça yavaşla.
    const maxSpeed = (Speed.value[s] as number) + ((Speed.value[s] as number) >> 2);
    const speed = Math.min(maxSpeed, dist * 4);
    Velocity.x[s] = fxMul(fxDiv(dx, dist), speed);
    Velocity.z[s] = fxMul(fxDiv(dz, dist), speed);
  }
};

/** Aynı takımın sancak noktaları bu mesafeden (m) yakınsa birbirini iter. */
const ANCHOR_SPACING: Fx = fxFromFloat(6);

/**
 * Taburlar arası itme: aynı yolu izleyen taburlar üst üste binmesin (her biri kendi
 * formasyonunu korusun). O(B²) ama B ≤ birkaç yüz; mesafe kontrolü ucuz kutu testiyle başlar.
 */
export const battalionSpacingSystem = (world: SimWorld): void => {
  const { Position, Battalion, Team } = world.c;
  const grid = world.nav;
  const list = query(world, [Battalion, Position]);
  for (let i = 0; i < list.length; i++) {
    const a = list[i] as number;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j] as number;
      if (Team.id[a] !== Team.id[b]) continue;
      // Yalnızca hareket eden taburlar itilir; yerleşmiş tabur yerinde kalır.
      const moveA = Battalion.active[a] === 1;
      const moveB = Battalion.active[b] === 1;
      if (!moveA && !moveB) continue;
      const dx = ((Position.x[b] as number) - (Position.x[a] as number)) | 0;
      const dz = ((Position.z[b] as number) - (Position.z[a] as number)) | 0;
      if (dx >= ANCHOR_SPACING || dx <= -ANCHOR_SPACING || dz >= ANCHOR_SPACING || dz <= -ANCHOR_SPACING)
        continue;
      const d = fxLen(dx, dz);
      if (d >= ANCHOR_SPACING) continue;
      // Tick başına örtüşmenin %10'u kadar it; tam üst üste ise eid'den türetilen yön.
      const push = ((ANCHOR_SPACING - d) / 10) | 0;
      const nx = d > 0 ? fxDiv(dx, d) : FX_ONE;
      const nz = d > 0 ? fxDiv(dz, d) : 0;
      const px = fxMul(nx, push);
      const pz = fxMul(nz, push);
      const ax = ((Position.x[a] as number) - px) | 0;
      const az = ((Position.z[a] as number) - pz) | 0;
      const bx = ((Position.x[b] as number) + px) | 0;
      const bz = ((Position.z[b] as number) + pz) | 0;
      if (moveA && !isBlockedAt(grid, ax, az)) {
        Position.x[a] = ax;
        Position.z[a] = az;
      }
      if (moveB && !isBlockedAt(grid, bx, bz)) {
        Position.x[b] = bx;
        Position.z[b] = bz;
      }
    }
  }
};
