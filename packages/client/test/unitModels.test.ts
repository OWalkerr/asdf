import { UNIT_DEFS } from '@bulwark/shared';
import { describe, expect, it } from 'vitest';
import {
  batteringRam,
  gondorArcher,
  gondorSoldier,
  orcWarrior,
  Part,
  towerGuard,
  UNIT_MODELS,
  urukHai,
} from '../src/render/units/models';

/** GDD §3.2 poligon bütçeleri (LOD0): piyade ≤ 300, elit piyade ≤ 450, kuşatma aracı ≤ 900 üçgen. */
const BUDGET: [string, () => import('three/webgpu').BufferGeometry, number][] = [
  ['Gondor Soldier', gondorSoldier, 300],
  ['Orc Warrior', orcWarrior, 300],
  ['Tower Guard', towerGuard, 450],
  ['Uruk-hai', urukHai, 450],
  ['Gondor Archer', gondorArcher, 300],
  ['Battering Ram', batteringRam, 900],
];

describe('birim modelleri', () => {
  for (const [name, build, budget] of BUDGET) {
    it(`${name}: üçgen bütçesi ≤ ${budget} ve SPA nitelikleri tam`, () => {
      const geo = build();
      const verts = geo.getAttribute('position').count;
      const tris = verts / 3;
      expect(geo.index).toBeNull();
      expect(tris).toBeLessThanOrEqual(budget);
      for (const attr of ['normal', 'uv', 'color', 'aPart', 'aPivot'])
        expect(geo.getAttribute(attr)?.count).toBe(verts);
      // Altı parçanın hepsi kullanılmış olmalı (animasyon her uzvu bulabilsin).
      const parts = new Set(Array.from(geo.getAttribute('aPart').array as Float32Array));
      expect([...parts].sort()).toEqual(Object.values(Part).sort());
      // Ayaklar yerde, model makul boyda.
      geo.computeBoundingBox();
      expect(geo.boundingBox?.min.y).toBeCloseTo(0, 1);
      expect(geo.boundingBox?.max.y).toBeGreaterThan(1.5);
    });
  }

  it('her birim tipi için model kayıtlı', () => {
    expect(Object.keys(UNIT_MODELS).map(Number)).toEqual(UNIT_DEFS.map((d) => d.id));
  });
});
