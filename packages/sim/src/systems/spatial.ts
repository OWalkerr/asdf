import { query } from 'bitecs';
import { cellAt } from '../nav/grid';
import type { SimWorld } from '../world';

/**
 * Tick başına uzamsal yapılar (GDD §2.4 katman 3):
 * - Uzamsal hash: nav hücresi (2 m) başına canlı birimlerin bağlı listesi (separation + hedef seçimi).
 * - Tabur üye listeleri: tabur eid'i → canlı askerleri (okçu hedefi, slot düzeni).
 * - Canlı düşman sayısı (zafer koşulu).
 * Ekleme, sorgu sırasıyla yapılır → listeler tüm istemcilerde aynı sırada.
 */
export const spatialSystem = (world: SimWorld): void => {
  const { Position, UnitType, Health, Soldier, Team, Dead } = world.c;
  const grid = world.nav;
  const head = world.hashHead;
  const next = world.hashNext;
  head.fill(-1);
  const mHead = world.memberHead;
  const mNext = world.memberNext;
  mHead.fill(0);
  let enemies = 0;
  for (const e of query(world, [Position, UnitType, Health])) {
    if (Dead.at[e] !== 0) continue;
    const c = cellAt(grid, Position.x[e] as number, Position.z[e] as number);
    if (c >= 0) {
      next[e] = head[c] as number;
      head[c] = e;
    }
    const b = Soldier.battalion[e] as number;
    if (b !== 0) {
      mNext[e] = mHead[b] as number;
      mHead[b] = e;
    }
    if (Team.id[e] === 1) enemies++;
  }
  world.match.enemiesAlive = enemies;
};

/** Taburun canlı askerlerini gezer (spatialSystem'in kurduğu liste). */
export const forEachMember = (world: SimWorld, battalion: number, cb: (soldier: number) => void): void => {
  for (let s = world.memberHead[battalion] as number; s !== 0; s = world.memberNext[s] as number) cb(s);
};
