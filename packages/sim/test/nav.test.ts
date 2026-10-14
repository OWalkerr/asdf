import { fxFromFloat, HELMS_DEEP, type NavOp, type Vec2 } from '@bulwark/shared';
import { describe, expect, it } from 'vitest';
import {
  BLOCK_ALL,
  blockedFor,
  buildNavGrid,
  COST_INF,
  cellAt,
  computeFlowField,
  FlowFieldCache,
  goalCellsAround,
} from '../src';

const at = (p: Vec2) => [fxFromFloat(p[0]), fxFromFloat(p[1])] as const;
const grid = buildNavGrid(HELMS_DEEP);
const cell = (p: Vec2) => cellAt(grid, ...at(p));
/** Düşman (takım 1) için kapalı mı. */
const blocked = (p: Vec2, team = 1) => blockedFor(grid, cell(p), team);
const field = (target: Vec2, team = 1) => {
  const f = new FlowFieldCache(grid).get(...at(target), team);
  if (!f) throw new Error('alan yok');
  return f;
};

describe("Helm's Deep navigasyon ızgarası", () => {
  it('temel bölgeler doğru açık/kapalı', () => {
    for (const s of HELMS_DEEP.spawns) expect(blocked(s.pos), s.id).toBe(false);
    expect(grid.blocked[cell([40, -24])]).toBe(BLOCK_ALL); // Deeping Wall herkese kapalı
    expect(blocked([15, -60])).toBe(false); // Deeping-coomb
    expect(blocked(HELMS_DEEP.citadel.pos)).toBe(false);
    expect(blocked([-62, -30])).toBe(false); // Hornburg avlusu
    // Arka kapılar: Hornburg kapısı ve menfez düşmana kapalı, savunucuya açık.
    for (const g of HELMS_DEEP.gates) {
      expect(blocked(g.pos, 1), `${g.id} düşman`).toBe(true);
      expect(blocked(g.pos, 0), `${g.id} savunucu`).toBe(false);
    }
    expect(blocked([-170, 0])).toBe(true); // dağ
    expect(blocked([10, 30])).toBe(false); // causeway üstü
  });

  it('savunucu arka kapılardan dışarı çıkabilir (menfez + Hornburg kapısı)', () => {
    const f = field(HELMS_DEEP.citadel.pos, 0);
    for (const s of HELMS_DEEP.spawns) expect(f.cost[cell(s.pos)], s.id).toBeLessThan(COST_INF);
    expect(f.cost[cell([-62, -30])]).toBeLessThan(COST_INF);
  });

  it('sur ve kapalı kapı vadiyi mühürler: güneyden Citadel’e yol yok', () => {
    const f = field(HELMS_DEEP.citadel.pos);
    for (const s of HELMS_DEEP.spawns) expect(f.cost[cell(s.pos)], s.id).toBe(COST_INF);
    expect(f.cost[cell([15, -60])]).toBeLessThan(COST_INF);
    // Hornburg avlusu da vadiden ayrı (yalnızca kapıdan girilir).
    expect(f.cost[cell([-62, -30])]).toBe(COST_INF);
  });

  it('her koridorun hedefi kendi spawn noktasından ulaşılabilir', () => {
    for (const s of HELMS_DEEP.spawns) {
      const lane = HELMS_DEEP.lanes.find((l) => l.id === s.lane);
      const target = lane?.points[lane.points.length - 1] as Vec2;
      const f = field(target);
      expect(f.cost[cell(s.pos)], `${s.id} → ${lane?.id}`).toBeLessThan(COST_INF);
      // next zinciri hedefe varır ve hiç kapalı hücreden geçmez.
      let c = cell(s.pos);
      for (let i = 0; i < 2000 && f.cost[c] !== 0; i++) {
        expect(blockedFor(grid, c, 1)).toBe(false);
        c = f.next[c] as number;
      }
      expect(f.cost[c]).toBe(0);
    }
  });

  it('akış alanı makul sürede hesaplanır', () => {
    const t0 = performance.now();
    computeFlowField(grid, goalCellsAround(grid, ...at(HELMS_DEEP.citadel.pos), 1), 1);
    expect(performance.now() - t0).toBeLessThan(150);
  });
});

describe('akış alanı (küçük ızgara)', () => {
  // 40×40 m, ortada kuzey-güney duvarı; yalnızca güney ucunda geçit.
  const ops: NavOp[] = [
    {
      op: 'open',
      shape: {
        type: 'polygon',
        points: [
          [-19, -19],
          [19, -19],
          [19, 19],
          [-19, 19],
        ],
      },
    },
    { op: 'block', shape: { type: 'capsule', a: [0, -20], b: [0, 12], halfWidth: 1 } },
  ];
  const g = buildNavGrid({ size: 40, nav: { cellSize: 2, ops } });

  it('engelin etrafından dolaşır, köşe kesmez', () => {
    const f = computeFlowField(g, goalCellsAround(g, fxFromFloat(10), fxFromFloat(-10), 0, 0), 0);
    let c = cellAt(g, fxFromFloat(-10), fxFromFloat(-10));
    let steps = 0;
    let wentSouth = false;
    while (f.cost[c] !== 0 && steps++ < 200) {
      const n = f.next[c] as number;
      expect(g.blocked[n]).toBe(0);
      const dc = (n % g.cols) - (c % g.cols);
      const dr = ((n / g.cols) | 0) - ((c / g.cols) | 0);
      if (dc !== 0 && dr !== 0) {
        expect(g.blocked[(((c / g.cols) | 0) + dr) * g.cols + (c % g.cols)]).toBe(0);
        expect(g.blocked[((c / g.cols) | 0) * g.cols + (c % g.cols) + dc]).toBe(0);
      }
      if (((n / g.cols) | 0) * 2 - 20 + 1 > 12) wentSouth = true; // hücre merkezi z
      c = n;
    }
    expect(f.cost[c]).toBe(0);
    expect(wentSouth).toBe(true);
  });

  it('deterministik: iki hesap birebir aynı', () => {
    const goals = goalCellsAround(g, fxFromFloat(10), fxFromFloat(-10), 0);
    const a = computeFlowField(g, goals, 0);
    const b = computeFlowField(g, goals, 0);
    expect(a.cost).toEqual(b.cost);
    expect(a.next).toEqual(b.next);
  });
});
