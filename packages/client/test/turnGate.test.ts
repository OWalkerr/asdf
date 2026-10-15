import { describe, expect, it } from 'vitest';
import { TURN_DELAY, TURN_TICKS, TurnGate } from '../src/sim-host/turnGate';

describe('lockstep tur kapısı', () => {
  it('ilk gecikme turları serbest; sonra en geride kalan oyuncu sınırı belirler', () => {
    const g = new TurnGate(2);
    expect(g.limit()).toBe(TURN_DELAY * TURN_TICKS);
    g.receive(0, TURN_DELAY);
    expect(g.limit()).toBe(TURN_DELAY * TURN_TICKS);
    g.receive(1, TURN_DELAY);
    expect(g.limit()).toBe((TURN_DELAY + 1) * TURN_TICKS);
    expect(g.laggards()).toEqual([0, 1]);
  });

  it('sıra dışı ve tekrar gelen turlar doğru birleşir', () => {
    const g = new TurnGate(1);
    expect(g.receive(0, TURN_DELAY + 2)).toBe(true);
    expect(g.limit()).toBe(TURN_DELAY * TURN_TICKS);
    expect(g.receive(0, TURN_DELAY)).toBe(true);
    expect(g.receive(0, TURN_DELAY)).toBe(false);
    expect(g.nextOf(0)).toBe(TURN_DELAY + 1);
    g.receive(0, TURN_DELAY + 1);
    expect(g.nextOf(0)).toBe(TURN_DELAY + 3);
  });
});
