import { DIFFICULTIES, FACTIONS, MAP_DEFS } from '@bulwark/shared';
import { describe, expect, it } from 'vitest';
import { CAMPAIGNS } from '../src/app/campaign';

describe('sefer verisi', () => {
  it('iyi ve kötü sefer: her görev geçerli harita, taraf ve zorluk kullanır', () => {
    expect(CAMPAIGNS.map((c) => c.id)).toEqual(['good', 'evil']);
    for (const c of CAMPAIGNS) {
      expect(c.missions.length).toBeGreaterThanOrEqual(4);
      for (const m of c.missions) {
        expect(MAP_DEFS[m.mapId]).toBeDefined();
        expect(FACTIONS[m.faction]).toBeDefined();
        expect(DIFFICULTIES[m.difficulty]).toBeDefined();
        expect(m.story.length).toBeGreaterThan(0);
        // İyi seferde iyi, kötü seferde kötü taraflar.
        expect(FACTIONS[m.faction]?.evil === true).toBe(c.id === 'evil');
      }
    }
  });
});
