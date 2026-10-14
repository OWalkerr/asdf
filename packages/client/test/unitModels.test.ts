import { UNIT_DEFS } from '@bulwark/shared';
import { describe, expect, it } from 'vitest';
import {
  aragorn,
  balrog,
  batteringRam,
  caveTroll,
  elrond,
  eowyn,
  galadhrim,
  gandalf,
  gondorArcher,
  gondorSoldier,
  haldir,
  ladderTeam,
  legolas,
  lorienArcher,
  lurtz,
  orcArcher,
  orcWarrior,
  Part,
  rohanArcher,
  rohanSpearman,
  rohirrim,
  siegeTower,
  theoden,
  towerGuard,
  UNIT_MODELS,
  urukHai,
  wargRider,
  watcher,
  wyrm,
} from '../src/render/units/models';

/** GDD §3.2 poligon bütçeleri (LOD0): piyade ≤ 400 (arma detayları), elit piyade ≤ 450, kahraman ≤ 450, kuşatma aracı ≤ 900 üçgen. */
const BUDGET: [string, () => import('three/webgpu').BufferGeometry, number][] = [
  ['Gondor Soldier', gondorSoldier, 400],
  ['Orc Warrior', orcWarrior, 400],
  ['Tower Guard', towerGuard, 450],
  ['Uruk-hai', urukHai, 450],
  ['Gondor Archer', gondorArcher, 400],
  ['Battering Ram', batteringRam, 900],
  ['Aragorn', aragorn, 450],
  ['Lurtz', lurtz, 450],
  ['Lórien Archer', lorienArcher, 400],
  ['Rohirrim', rohirrim, 600],
  ['Ork okçusu', orcArcher, 400],
  ['Warg binicisi', wargRider, 600],
  ['Mağara trolü', caveTroll, 600],
  ['Gandalf', gandalf, 450],
  ['Legolas', legolas, 450],
  ['Balrog', balrog, 900],
  ['Merdiven takımı', ladderTeam, 900],
  ['Su Gözcüsü', watcher, 900],
  ['Ateş Ejderi', wyrm, 900],
  ['Kuşatma kulesi', siegeTower, 900],
  ['Rohan mızrakçısı', rohanSpearman, 400],
  ['Rohan okçusu', rohanArcher, 400],
  ['Théoden', theoden, 450],
  ['Éowyn', eowyn, 450],
  ['Galadhrim', galadhrim, 400],
  ['Haldir', haldir, 450],
  ['Elrond', elrond, 450],
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
