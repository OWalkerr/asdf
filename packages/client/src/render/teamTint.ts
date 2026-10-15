import type { BufferGeometry } from 'three/webgpu';
import { PALETTE_SIZE } from './palette';

/**
 * Takım satırındaki (palet satırı 12: team0*) renkleri `team` satırına kaydırır: aynı model rakip
 * takımların renginde çizilir (çatışmada rakip kaleleri ve binaları). Geometri yerinde değişir.
 */
export const retintTeam = (geo: BufferGeometry, team: number): BufferGeometry => {
  if (team <= 0) return geo;
  const uv = geo.getAttribute('uv');
  if (!uv) return geo;
  const row = 1 / PALETTE_SIZE;
  for (let i = 0; i < uv.count; i++) {
    const v = uv.getY(i);
    if (v >= 12 * row && v < 13 * row) uv.setY(i, v + team * row);
  }
  uv.needsUpdate = true;
  return geo;
};
