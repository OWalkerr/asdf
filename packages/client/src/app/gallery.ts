import { UNIT_DEFS } from '@bulwark/shared';
import { ANIM_ATTACK, ANIM_DIE, ANIM_IDLE, ANIM_WALK } from '../render/units/UnitMaterial';
import type { UnitRenderer } from '../render/units/UnitRenderer';

/**
 * Birim galerisi (`?gallery`): her birim tipi bir satır, sütunlar
 * [boşta, yürüme, saldırı, ölüm] × [takım 0, takım 1]. Siluet ve animasyon
 * look-dev'i için; simülasyondan bağımsızdır.
 */
const STATES = [ANIM_IDLE, ANIM_WALK, ANIM_ATTACK, ANIM_DIE];
const SPACING_X = 3.2;
const SPACING_Z = 4;

export const GALLERY_CENTER = { x: 0, z: 52 };
/** `?gallery=41`: yalnızca bu id'den başlayan birimler (yeni modellere bakmak için). */
const RANGE = (new URLSearchParams(location.search).get('gallery') ?? '').split('-').map(Number);
const FROM = RANGE[0] || 0;
const TO = RANGE[1] || 255;
const DEFS = UNIT_DEFS.filter((d) => d.id >= FROM && d.id <= TO);

export const updateGallery = (
  units: UnitRenderer,
  timeS: number,
  groundY: (x: number, z: number) => number,
) => {
  units.begin();
  const cols = STATES.length * 2;
  DEFS.forEach((def, row) => {
    for (let c = 0; c < cols; c++) {
      const state = STATES[c % STATES.length] as number;
      const team = c < STATES.length ? 0 : 1;
      const x = GALLERY_CENTER.x + (c - (cols - 1) / 2) * SPACING_X;
      const z = GALLERY_CENTER.z + (row - (DEFS.length - 1) / 2) * SPACING_Z;
      // Ölüm döngüsü 5 sn'de bir baştan; vurulma parıltısı saldırı sütununda periyodik.
      const t = state === ANIM_DIE ? timeS % 5 : timeS + row * 0.3;
      const flash = state === ANIM_ATTACK && timeS % 2 < 0.12 ? 1 : 0;
      // Kameraya (güneye, +Z) dönük yarım çapraz duruş: siluet ve kalkan birlikte görünsün.
      units.push(def.id, x, groundY(x, z), z, Math.PI * 0.35, state, t, flash, team);
    }
  });
  units.end();
};
