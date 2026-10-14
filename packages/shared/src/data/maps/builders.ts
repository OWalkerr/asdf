import type { NavOp, NavShape, Vec2, WaveDef, WaveGroupDef } from '../../map/types';
import { UnitTypeId } from '../units';

/**
 * Harita verisi yardımcıları: nav işlemlerini ve dalga programlarını yalnızca dört işlemle
 * üretir (trigonometri yok → her istemcide aynı veri).
 */

/** Sur çoklu çizgisinin her segmenti için herkese kapalı kapsül. */
export const wallBlocks = (label: string, points: readonly Vec2[], halfWidth: number): NavOp[] =>
  points.slice(1).map((b, i) => ({
    op: 'block' as const,
    label: `${label} ${i + 1}`,
    shape: { type: 'capsule' as const, a: points[i] as Vec2, b, halfWidth },
  }));

/** Kapı: sur boyunca açılan geçit + saldırana kapalı kanatlar (arka kapı). */
export const gateOps = (label: string, shape: NavShape): NavOp[] => [
  { op: 'open', label, shape },
  { op: 'block', label: `${label} (düşman)`, teams: [1], shape },
];

/** Çoklu çizgi boyunca açık koridor (TD yolları, köprüler). */
export const pathOpens = (label: string, points: readonly Vec2[], halfWidth: number): NavOp[] =>
  points.slice(1).map((b, i) => ({
    op: 'open' as const,
    label: `${label} ${i + 1}`,
    shape: { type: 'capsule' as const, a: points[i] as Vec2, b, halfWidth },
  }));

const name = (i: number, names: readonly string[]) => names[i] ?? `Dalga ${i + 1}`;

/**
 * Kale savunması dalgaları: her dalgada spawn noktaları sırayla Ork/Uruk tabur grupları;
 * 3. dalgadan itibaren koçbaşı, son dalgada Lurtz. Dalga arası `gap` saniye.
 */
export const fdWaves = (
  spawns: readonly string[],
  count: number,
  names: readonly string[],
  first = 30,
  gap = 75,
): WaveDef[] =>
  Array.from({ length: count }, (_, w) => {
    const t0 = first + w * gap;
    const groups: WaveGroupDef[] = [];
    spawns.forEach((spawn, k) => {
      // Yeni düşman türleri (2. dalgadan) Ork sayısının bir kısmının yerini alır.
      const orcs = 2 + Math.floor((w * 3) / 2) - (k === 0 ? 0 : 1) - (w >= 2 ? 1 : 0);
      if (orcs > 0)
        groups.push({ atSec: t0 + k * 6, spawn, unitType: UnitTypeId.OrcWarrior, battalions: orcs });
      const uruks = w >= 1 ? Math.floor((w + k) / 2) : 0;
      if (uruks > 0)
        groups.push({ atSec: t0 + 10 + k * 6, spawn, unitType: UnitTypeId.UrukHai, battalions: uruks });
    });
    // Ork okçuları (binalara ateşli ok), Warg akıncıları (ilk ulaşan), Mağara trolü.
    if (w >= 1)
      groups.push({
        atSec: t0 + 14,
        spawn: spawns[(w + 1) % spawns.length] as string,
        unitType: UnitTypeId.OrcArcher,
        battalions: 1 + Math.floor(w / 3),
      });
    if (w >= 2)
      groups.push({
        atSec: t0 + 2,
        spawn: spawns[(w + 2) % spawns.length] as string,
        unitType: UnitTypeId.WargRider,
        battalions: 1,
      });
    if (w >= 3)
      groups.push({
        atSec: t0 + 30,
        spawn: spawns[w % spawns.length] as string,
        unitType: UnitTypeId.CaveTroll,
        battalions: 1,
      });
    // Kuşatma merdivenleri (sur noktası olan haritalarda sura dayanır).
    if (w >= 1)
      groups.push({
        atSec: t0 + 18,
        spawn: spawns[(w + 1) % spawns.length] as string,
        unitType: UnitTypeId.LadderTeam,
        battalions: w >= 3 ? 2 : 1,
      });
    if (w >= 2)
      groups.push({
        atSec: t0 + 24,
        spawn: spawns[w % spawns.length] as string,
        unitType: UnitTypeId.BatteringRam,
        battalions: w >= 4 ? 2 : 1,
      });
    if (w === count - 1)
      groups.push({ atSec: t0 + 20, spawn: spawns[0] as string, unitType: UnitTypeId.Lurtz, battalions: 1 });
    return { name: name(w, names), groups };
  });

/**
 * Tower Defense dalgaları: sık ve kısa; Ork akını, 4. dalgadan Uruk, 6/9/12'de koçbaşı,
 * son dalgada Lurtz. Gruplar spawn noktaları arasında dönüşümlü.
 */
export const tdWaves = (
  spawns: readonly string[],
  count: number,
  names: readonly string[],
  first = 25,
  gap = 42,
): WaveDef[] =>
  Array.from({ length: count }, (_, w) => {
    const t0 = first + w * gap;
    const groups: WaveGroupDef[] = [];
    const s = (k: number) => spawns[(w + k) % spawns.length] as string;
    groups.push({
      atSec: t0,
      spawn: s(0),
      unitType: UnitTypeId.OrcWarrior,
      // Okçulu dalgalarda bir Ork taburu eksik (okçular yerini alır).
      battalions: 1 + Math.floor(w / 2) - (w >= 2 && w % 2 === 0 ? 1 : 0),
    });
    // İkinci grup: tek dalgalarda (5.'den) Warg akıncıları, diğerlerinde Ork.
    if (spawns.length > 1 && w >= 1)
      groups.push(
        w >= 4 && w % 2 === 1
          ? { atSec: t0 + 4, spawn: s(1), unitType: UnitTypeId.WargRider, battalions: 1 }
          : {
              atSec: t0 + 8,
              spawn: s(1),
              unitType: UnitTypeId.OrcWarrior,
              battalions: 1 + Math.floor(w / 3),
            },
      );
    if (w >= 3)
      groups.push({
        atSec: t0 + 14,
        spawn: s(0),
        unitType: UnitTypeId.UrukHai,
        battalions: Math.floor((w - 1) / 2),
      });
    if (w >= 2 && w % 2 === 0)
      groups.push({ atSec: t0 + 10, spawn: s(1), unitType: UnitTypeId.OrcArcher, battalions: 1 });
    if (w >= 7 && w % 3 === 1)
      groups.push({ atSec: t0 + 18, spawn: s(0), unitType: UnitTypeId.CaveTroll, battalions: 1 });
    if (w % 3 === 2 && w >= 5)
      groups.push({ atSec: t0 + 20, spawn: s(1), unitType: UnitTypeId.BatteringRam, battalions: 1 });
    if (w === count - 1)
      groups.push({ atSec: t0 + 24, spawn: s(0), unitType: UnitTypeId.Lurtz, battalions: 1 });
    return { name: name(w, names), groups };
  });
