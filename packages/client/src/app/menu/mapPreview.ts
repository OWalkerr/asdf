import type { MapDef, Vec2 } from '@bulwark/shared';

/**
 * Lobi harita önizlemesi (BFME2 harita seçimi): arazi, nehir, yol, sur ve başlangıç konumları
 * (numaralı; sahibinin renginde). `onStart(i)` verilirse konuma tıklanabilir.
 */
const THEME_BG: Record<string, string> = {
  meadow: '#4d6a34',
  autumn: '#7a6a36',
  dark: '#3a4030',
  snow: '#c8ccd0',
};

export interface PreviewStart {
  /** Konumun sahibinin rengi (yoksa boş). */
  color?: string;
  label?: string;
}

export const drawMapPreview = (
  canvas: HTMLCanvasElement,
  def: MapDef,
  starts: readonly PreviewStart[] = [],
): { hitStart: (px: number, py: number) => number } => {
  const g = canvas.getContext('2d');
  const size = canvas.width;
  const k = size / def.size;
  const to = (p: Vec2): [number, number] => [(p[0] + def.size / 2) * k, (p[1] + def.size / 2) * k];
  if (!g) return { hitStart: () => -1 };
  // Dağlar (yürünemez kenar) ve ova.
  g.fillStyle = '#2b2721';
  g.fillRect(0, 0, size, size);
  g.fillStyle = THEME_BG[def.terrain.theme ?? 'meadow'] ?? '#4d6a34';
  for (const basin of def.terrain.basins ?? []) {
    g.beginPath();
    basin.forEach((p, i) => {
      const [x, y] = to(p);
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    });
    g.closePath();
    g.fill();
  }
  if (!def.terrain.basins?.length) g.fillRect(size * 0.04, size * 0.04, size * 0.92, size * 0.92);
  // Tepeler
  for (const p of def.terrain.plateaus) {
    const [x, y] = to(p.center);
    g.fillStyle = p.height > 6 ? 'rgba(40,36,30,0.75)' : 'rgba(255,255,255,0.08)';
    g.beginPath();
    g.arc(x, y, p.radius * k, 0, Math.PI * 2);
    g.fill();
  }
  const line = (pts: readonly Vec2[], width: number, color: string) => {
    g.strokeStyle = color;
    g.lineWidth = Math.max(1, width * k);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    pts.forEach((p, i) => {
      const [x, y] = to(p);
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    });
    g.stroke();
  };
  for (const r of def.terrain.roads ?? []) line(r.points, r.width, 'rgba(120,88,52,0.9)');
  for (const r of def.terrain.rivers ?? []) line(r.points, r.width, '#3a78b8');
  for (const b of def.terrain.bridges ?? []) line([b.a, b.b], b.width * 0.8, '#a89880');
  for (const w of def.walls) line(w.points, 3, '#cfc6b2');
  // Başlangıç konumları (VS) ya da kale (savunma).
  const spots = def.starts ?? [def.citadel];
  const r = Math.max(9, size * 0.045);
  spots.forEach((c, i) => {
    const [x, y] = to(c.pos);
    const s = starts[i];
    g.fillStyle = s?.color ?? 'rgba(20,16,10,0.85)';
    g.strokeStyle = '#f3d77a';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#fff3c4';
    g.font = `bold ${Math.round(r * 1.1)}px Georgia, serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(s?.label ?? String(i + 1), x, y + 1);
  });
  return {
    hitStart: (px, py) =>
      spots.findIndex((c) => {
        const [x, y] = to(c.pos);
        return Math.hypot(px - x, py - y) <= r + 4;
      }),
  };
};
