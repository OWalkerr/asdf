import { describe, expect, it } from 'vitest';
import { type MatchStats, scoreOf, starsOf } from '../src/app/records';

const base: MatchStats = {
  victory: true,
  wave: 6,
  waves: 6,
  kills: 500,
  losses: 40,
  goldEarned: 5000,
  seconds: 600,
  health: 0.8,
  difficulty: 1,
  faction: 0,
};

describe('maç puanı', () => {
  it('zafer: öldürme, dalga, sağlık; zorluk çarpanı', () => {
    expect(scoreOf(base)).toBe(500 * 2 + 6 * 100 - 40 + 1000 + 800);
    expect(scoreOf({ ...base, difficulty: 2 })).toBe(Math.round(scoreOf(base) * 1.5));
  });
  it('yıldızlar sağlığa göre; yenilgide yıldız yok', () => {
    expect(starsOf(base)).toBe(3);
    expect(starsOf({ ...base, health: 0.5 })).toBe(2);
    expect(starsOf({ ...base, health: 0.1 })).toBe(1);
    expect(starsOf({ ...base, victory: false })).toBe(0);
    expect(scoreOf({ ...base, victory: false, wave: 3 })).toBe(500 * 2 + 2 * 100 - 40);
  });
});
