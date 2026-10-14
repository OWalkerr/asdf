import { describe, expect, it } from 'vitest';
import { HELMS_DEEP } from '../src/data/maps/helmsDeep';
import { type MapDef, validateMap } from '../src/map/types';

describe("Helm's Deep harita verisi", () => {
  it('şema doğrulamasından geçer', () => {
    expect(validateMap(HELMS_DEEP)).toEqual([]);
  });

  it('FD için gerekli öğeleri içerir', () => {
    expect(HELMS_DEEP.mode).toBe('FD');
    expect(HELMS_DEEP.slots.filter((s) => s.kind === 'wall_socket').length).toBeGreaterThanOrEqual(6);
    expect(HELMS_DEEP.slots.filter((s) => s.kind === 'building').length).toBeGreaterThanOrEqual(4);
    expect(HELMS_DEEP.spawns.length).toBe(3);
  });

  it('her koridor kendi spawn noktasından başlar', () => {
    for (const s of HELMS_DEEP.spawns) {
      const lane = HELMS_DEEP.lanes.find((l) => l.id === s.lane);
      expect(lane?.points[0]).toEqual(s.pos);
    }
  });

  it('sur soketleri sur ekseni üzerinde', () => {
    const wall = HELMS_DEEP.walls[0];
    if (!wall) throw new Error('sur yok');
    const [[x0, z0], [x1]] = wall.points as [[number, number], [number, number]];
    for (const s of HELMS_DEEP.slots.filter((s) => s.kind === 'wall_socket')) {
      expect(s.pos[1]).toBe(z0);
      expect(s.pos[0]).toBeGreaterThan(x0);
      expect(s.pos[0]).toBeLessThan(x1);
    }
  });
});

describe('validateMap', () => {
  it('hatalı haritayı yakalar', () => {
    const broken: MapDef = {
      ...HELMS_DEEP,
      slots: [
        ...HELMS_DEEP.slots,
        { id: 'W1', kind: 'wall_socket', pos: [999, 0], elevation: 0, allowed: [] },
      ],
      spawns: [{ id: 'S_x', pos: [0, 0], lane: 'yok' }],
    };
    const errors = validateMap(broken);
    expect(errors).toContain('yinelenen id: W1 (slot)');
    expect(errors).toContain('W1 harita dışında');
    expect(errors).toContain('W1 sur soketi yükseltisiz');
    expect(errors).toContain('S_x bilinmeyen koridor: yok');
  });
});
