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
import { entityExists, hasComponent, query } from 'bitecs';
import { BattalionMode } from '../components';
import { COST_INF } from '../nav/flowField';
import { cellAt, cellCenterX, cellCenterZ, isBlockedAt, type NavGrid } from '../nav/grid';
import { STAT } from '../unitStats';
import type { SimWorld } from '../world';

/**
 * Tabur hareketi ve çatışma kararı (GDD §2.4 katman 1–2, §6):
 * - Sancak noktası paylaşılan akış alanını görüş hattı açık kalan en uzak hücreye kadar
 *   ileriden izler, sınırlı dönüş hızıyla yumuşak kavisler çizer, geride kalanları bekler.
 * - Çatışma kararı tabur seviyesindedir: kip (Idle / Move / AttackMove / Attack) ve en yakın
 *   düşman taburunun uzaklığına göre `engaged` belirlenir; çatışan tabur durur, askerleri
 *   combatSystem'de hedef seçer.
 */
const LOOKAHEAD_CELLS = 4;
const DIRECT_RANGE: Fx = fxFromFloat(12);
const ARRIVE: Fx = fxFromFloat(0.6);
/** Hedefe yakınken ilerlemesiz geçebilecek süre (tick; 40 = 2 sn). */
const STALL_TICKS = 40;
/** Bu kadar iyileşme "ilerleme" sayılır. */
const PROGRESS_EPS: Fx = fxFromFloat(0.05);
/** "Hedefe yakın": grup hedefine akış maliyeti (10 = bir hücre) veya kişisel noktaya mesafe. */
const NEAR_GOAL_COST = 60;
const SETTLE_NEAR: Fx = fxFromFloat(12);
/** Tick başına en fazla dönüş (uint16 açı; 2000 ≈ 11°). */
const TURN_PER_TICK = 2000;
/** Yuvasına bu kadar uzak asker "geride" sayılır. */
const LAG_DISTANCE: Fx = fxFromFloat(2.5);
/** Bu mesafeden uzak yuvalar için görüş hattı kontrol edilir. */
const SLOT_LOS_MIN: Fx = fxFromFloat(1.5);
/** Yakın dövüş taburlarının çatışmaya girdiği sancak-sancak uzaklığı. */
export const MELEE_ENGAGE: Fx = fxFromFloat(14);
/** Saldırı emrinde hedef taburu yakalamış sayılma uzaklığı. */
const ATTACK_REACH: Fx = fxFromFloat(7);
/** Hücum eden sancak düşman sancağına bu kadar yaklaşınca durur (askerler göğüs göğüse). */
const CHARGE_STOP: Fx = fxFromFloat(4);
/** Çatışma kararı bu aralıkla (tick) yeniden değerlendirilir. */
export const ENGAGE_INTERVAL = 5;

/** a → b doğru parçası boyunca yarım hücre aralıklarla örnekler; hiç kapalı hücreye değmiyorsa true. */
export const clearLine = (grid: NavGrid, x0: Fx, z0: Fx, x1: Fx, z1: Fx, team: number): boolean => {
  const dx = (x1 - x0) | 0;
  const dz = (z1 - z0) | 0;
  const half = grid.cellFx >> 1;
  const steps = Math.min(64, (Math.max(Math.abs(dx), Math.abs(dz)) / half) | 0) + 1;
  for (let i = 1; i <= steps; i++) {
    if (
      isBlockedAt(
        grid,
        (x0 + Math.trunc((dx * i) / steps)) | 0,
        (z0 + Math.trunc((dz * i) / steps)) | 0,
        team,
      )
    )
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

/** Geçerli (yaşayan, karşı takım) bir tabur mu. */
const isEnemyBattalion = (world: SimWorld, b: number, team: number): boolean =>
  b > 0 &&
  entityExists(world, b) &&
  hasComponent(world, b, world.c.Battalion) &&
  (world.c.Battalion.count[b] as number) > 0 &&
  world.c.Team.id[b] !== team;

/**
 * Çatışma kararı (her ENGAGE_INTERVAL tick'te): en yakın düşman taburu ve kipe göre engaged.
 * Saldırı emrinde hedefin konumu varış noktası olarak güncellenir.
 */
export const engagementSystem = (world: SimWorld): void => {
  if (world.tick % ENGAGE_INTERVAL !== 0) return;
  const { Position, Battalion, Team } = world.c;
  const list = query(world, [Battalion, Position]);
  for (const b of list) {
    const team = Team.id[b] as number;
    const type = Battalion.unitType[b] as number;
    const ranged = STAT.ranged[type] === 1;
    const range = ranged ? (STAT.range[type] as number) : MELEE_ENGAGE;
    let nearest = 0;
    let nearestD = 0x7fffffff;
    for (const o of list) {
      if (Team.id[o] === team || (Battalion.count[o] as number) === 0) continue;
      const d = fxLen(
        ((Position.x[o] as number) - (Position.x[b] as number)) | 0,
        ((Position.z[o] as number) - (Position.z[b] as number)) | 0,
      );
      if (d < nearestD || (d === nearestD && o < nearest)) {
        nearestD = d;
        nearest = o;
      }
    }
    const mode = Battalion.mode[b] as number;
    if (mode === BattalionMode.Attack) {
      const t = Battalion.targetBattalion[b] as number;
      if (!isEnemyBattalion(world, t, team)) {
        Battalion.mode[b] = BattalionMode.Idle;
        Battalion.active[b] = 0;
        Battalion.engaged[b] = 0;
        continue;
      }
      const d = fxLen(
        ((Position.x[t] as number) - (Position.x[b] as number)) | 0,
        ((Position.z[t] as number) - (Position.z[b] as number)) | 0,
      );
      Battalion.enemy[b] = t;
      Battalion.engaged[b] = d <= (ranged ? range : ATTACK_REACH) ? 1 : 0;
      // Hedefi izle: varış noktası = hedefin sancağı.
      Battalion.goalX[b] = Position.x[t] as number;
      Battalion.goalZ[b] = Position.z[t] as number;
      Battalion.fieldX[b] = Position.x[t] as number;
      Battalion.fieldZ[b] = Position.z[t] as number;
      Battalion.active[b] = Battalion.engaged[b] ? 0 : 1;
      continue;
    }
    Battalion.enemy[b] = nearest;
    Battalion.engaged[b] = mode !== BattalionMode.Move && nearest !== 0 && nearestD <= range ? 1 : 0;
  }
};

export const battalionSystem = (world: SimWorld): void => {
  const { Position, Facing, Battalion, Team } = world.c;
  const grid = world.nav;
  const dt = world.dtFx;
  for (const b of query(world, [Battalion, Position, Facing])) {
    const team = Team.id[b] as number;
    // Çatışan tabur yerinde durur (Move kipi hariç: oyuncu hareket emri çatışmayı yok sayar).
    const holding = Battalion.engaged[b] === 1 && Battalion.mode[b] !== BattalionMode.Move;
    if (Battalion.active[b] && !holding) {
      const x = Position.x[b] as number;
      const z = Position.z[b] as number;
      const gx = Battalion.goalX[b] as number;
      const gz = Battalion.goalZ[b] as number;
      const fieldX = Battalion.fieldX[b] as number;
      const fieldZ = Battalion.fieldZ[b] as number;
      const toGoal = fxLen((gx - x) | 0, (gz - z) | 0);
      // Sabır: kişisel hedefe olan mesafe iyileşmiyorsa sayaç artar. Hedefe yakınken (grup hedef
      // bölgesi çevresi veya kişisel noktaya < SETTLE_NEAR) 2 sn ilerleyemeyen tabur yerleşir —
      // dar kapı önünde ya da ulaşılamaz bir dizilim noktasında sonsuza kadar itişmez.
      const here = cellAt(grid, x, z);
      const field = world.fields.get(fieldX, fieldZ, team);
      const cost = here >= 0 && field ? (field.cost[here] as number) : COST_INF;
      if (toGoal + PROGRESS_EPS < (Battalion.bestDist[b] as number)) {
        Battalion.bestDist[b] = toGoal;
        Battalion.stall[b] = 0;
      } else {
        Battalion.stall[b] = Math.min(255, (Battalion.stall[b] as number) + 1);
      }
      const near = cost <= NEAR_GOAL_COST || toGoal <= SETTLE_NEAR;
      const atGroupGoal =
        (cost === 0 && !clearLine(grid, x, z, gx, gz, team)) ||
        (near && (Battalion.stall[b] as number) > STALL_TICKS);
      if (toGoal <= ARRIVE || atGroupGoal) {
        Battalion.active[b] = 0;
        // Hareket ve saldırarak ilerleme emirleri varışta beklemeye döner.
        if (Battalion.mode[b] !== BattalionMode.Attack) Battalion.mode[b] = BattalionMode.Idle;
      } else {
        // Nişan noktası: yakındaysa ve yol açıksa kişisel hedef, değilse akış alanında ileri.
        let ax = gx;
        let az = gz;
        if (toGoal > DIRECT_RANGE || !clearLine(grid, x, z, gx, gz, team)) {
          if (field && here >= 0 && field.cost[here] !== COST_INF && field.cost[here] !== 0) {
            let c = here;
            let aim = -1;
            for (let k = 0; k < LOOKAHEAD_CELLS; k++) {
              const n = field.next[c] as number;
              if (n < 0 || n === c) break;
              if (aim >= 0 && !clearLine(grid, x, z, cellCenterX(grid, n), cellCenterZ(grid, n), team)) break;
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
        // Duvara çarpınca eksen boyunca kay; o da olmazsa doğrudan nişan noktasına yönel.
        if (!isBlockedAt(grid, nx, nz, team)) {
          Position.x[b] = nx;
          Position.z[b] = nz;
        } else if (!isBlockedAt(grid, nx, z, team)) {
          Position.x[b] = nx;
        } else if (!isBlockedAt(grid, x, nz, team)) {
          Position.z[b] = nz;
        } else {
          const d = fxLen((ax - x) | 0, (az - z) | 0);
          if (d > 0) {
            const sx = (x + fxMul(fxDiv((ax - x) | 0, d), step)) | 0;
            const sz = (z + fxMul(fxDiv((az - z) | 0, d), step)) | 0;
            if (!isBlockedAt(grid, sx, sz, team)) {
              Position.x[b] = sx;
              Position.z[b] = sz;
              Facing.angle[b] = desired;
            }
          }
        }
      }
    } else if (holding) {
      // Çatışmada sancak düşmana döner (formasyon cephesi düşmana baksın). Yakın dövüş taburu
      // görüş hattı açıksa düşman sancağına hücum eder (askerlerin hedef menziline girene dek).
      const e = Battalion.enemy[b] as number;
      if (e > 0 && entityExists(world, e)) {
        const x = Position.x[b] as number;
        const z = Position.z[b] as number;
        const ex = Position.x[e] as number;
        const ez = Position.z[e] as number;
        const desired = fxAtan2((ez - z) | 0, (ex - x) | 0);
        Facing.angle[b] = turnToward(Facing.angle[b] as number, desired, TURN_PER_TICK >> 1);
        const d = fxLen((ex - x) | 0, (ez - z) | 0);
        if (
          STAT.ranged[Battalion.unitType[b] as number] === 0 &&
          d > CHARGE_STOP &&
          clearLine(grid, x, z, ex, ez, team)
        ) {
          const step = fxMul(Battalion.speed[b] as number, dt);
          const nx = (x + fxMul(fxDiv((ex - x) | 0, d), step)) | 0;
          const nz = (z + fxMul(fxDiv((ez - z) | 0, d), step)) | 0;
          if (!isBlockedAt(grid, nx, nz, team)) {
            Position.x[b] = nx;
            Position.z[b] = nz;
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
 * sıra sayısı artar (kolon formasyonu). Hedefle dövüşen askerleri combatSystem yönetir.
 */
export const formationSystem = (world: SimWorld): void => {
  const { Position, Velocity, Facing, Battalion, Soldier, Speed, Team, Dead } = world.c;
  const grid = world.nav;
  for (const b of query(world, [Battalion, Position])) {
    const cell = cellAt(grid, Position.x[b] as number, Position.z[b] as number);
    const clearance = cell >= 0 ? (grid.clearance[cell] as number) : 0;
    // Kullanılabilir genişlik ≈ (2·boşluk − 1) hücre.
    const widthFx = Math.max(1, clearance * 2 - 1) * grid.cellFx;
    const fit = Math.max(1, (widthFx / (Battalion.spacing[b] as number)) | 0);
    const pref = Battalion.prefFiles[b] as number;
    Battalion.files[b] = Math.max(1, Math.min(pref, fit, Battalion.count[b] as number));
    Battalion.lagging[b] = 0;
  }
  for (const s of query(world, [Soldier, Position, Velocity])) {
    if (Dead.at[s] !== 0) continue;
    const b = Soldier.battalion[s] as number;
    const files = Battalion.files[b] as number;
    if (b === 0 || files === 0) continue;
    const team = Team.id[s] as number;
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
    if (isBlockedAt(grid, tx, tz, team)) {
      // Yuva duvarın içinde: sancak noktasına doğru sıkış.
      tx = Position.x[b] as number;
      tz = Position.z[b] as number;
    }
    const sx = Position.x[s] as number;
    const sz = Position.z[s] as number;
    let dx = (tx - sx) | 0;
    let dz = (tz - sz) | 0;
    const dist = fxLen(dx, dz);
    // Yuvayı göremeyen (köşenin arkasında kalan) asker taburun akış alanını kendi hücresinden
    // izler: sancakla aynı yoldan gelir, duvara yüklenip takılmaz.
    if (dist > SLOT_LOS_MIN && !clearLine(grid, sx, sz, tx, tz, team)) {
      const field = world.fields.get(Battalion.fieldX[b] as number, Battalion.fieldZ[b] as number, team);
      const cell = cellAt(grid, sx, sz);
      if (field && cell >= 0 && field.cost[cell] !== COST_INF) {
        let c = cell;
        let aim = -1;
        for (let k = 0; k < 2; k++) {
          const n = field.next[c] as number;
          if (n < 0 || n === c) break;
          if (aim >= 0 && !clearLine(grid, sx, sz, cellCenterX(grid, n), cellCenterZ(grid, n), team)) break;
          aim = n;
          c = n;
        }
        if (aim >= 0) {
          dx = (cellCenterX(grid, aim) - sx) | 0;
          dz = (cellCenterZ(grid, aim) - sz) | 0;
        }
      }
    }
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
    const len = fxLen(dx, dz);
    if (len === 0) continue;
    Velocity.x[s] = fxMul(fxDiv(dx, len), speed);
    Velocity.z[s] = fxMul(fxDiv(dz, len), speed);
  }
};

/** Aynı takımın sancak noktaları bu mesafeden (m) yakınsa birbirini iter. */
const ANCHOR_SPACING: Fx = fxFromFloat(6);

/**
 * Taburlar arası itme: aynı yolu izleyen taburlar üst üste binmesin. Yalnızca hareket eden
 * taburlar itilir; yerleşmiş tabur yerinde kalır. O(B²) ama B ≤ birkaç yüz.
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
      const moveA = Battalion.active[a] === 1;
      const moveB = Battalion.active[b] === 1;
      if (!moveA && !moveB) continue;
      const dx = ((Position.x[b] as number) - (Position.x[a] as number)) | 0;
      const dz = ((Position.z[b] as number) - (Position.z[a] as number)) | 0;
      if (dx >= ANCHOR_SPACING || dx <= -ANCHOR_SPACING || dz >= ANCHOR_SPACING || dz <= -ANCHOR_SPACING)
        continue;
      const d = fxLen(dx, dz);
      if (d >= ANCHOR_SPACING) continue;
      const push = ((ANCHOR_SPACING - d) / 10) | 0;
      const nx = d > 0 ? fxDiv(dx, d) : FX_ONE;
      const nz = d > 0 ? fxDiv(dz, d) : 0;
      const px = fxMul(nx, push);
      const pz = fxMul(nz, push);
      const team = Team.id[a] as number;
      const ax = ((Position.x[a] as number) - px) | 0;
      const az = ((Position.z[a] as number) - pz) | 0;
      const bx = ((Position.x[b] as number) + px) | 0;
      const bz = ((Position.z[b] as number) + pz) | 0;
      if (moveA && !isBlockedAt(grid, ax, az, team)) {
        Position.x[a] = ax;
        Position.z[a] = az;
      }
      if (moveB && !isBlockedAt(grid, bx, bz, team)) {
        Position.x[b] = bx;
        Position.z[b] = bz;
      }
    }
  }
};
