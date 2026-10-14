/**
 * Harita veri şeması (GDD §10.6). Hem sim hem client tarafından okunur.
 *
 * Koordinatlar metre cinsinden, XZ düzleminde: +X doğu, +Z güney (kamera varsayılan
 * olarak kuzeye bakar). Bunlar *veri tanımıdır*; sim yüklerken Q16.16'ya çevirir
 * (fxFromFloat) ve döngü içinde float kullanmaz.
 *
 * Açılar derece, +X'ten +Z'ye doğru (0 = doğu, 90 = güney, 180 = batı, 270 = kuzey).
 */

export type Vec2 = readonly [x: number, z: number];

export type GameMode = 'TD' | 'FD';

export type SlotKind =
  /** Sur üstü soket: okçu kulesi, mancınık, sıcak yağ (GDD §4.2). */
  | 'wall_socket'
  /** Kale içi bina arsası: kışla, çiftlik, demirci… */
  | 'building'
  /** Bağımsız kule platformu (TD build plot). */
  | 'tower';

export interface SlotDef {
  id: string;
  kind: SlotKind;
  pos: Vec2;
  /** Zeminden yükseklik (sur üstü soketler için sur yüksekliği). 0 = arazi. */
  elevation: number;
  /** İnşa edilebilecek yapı id'leri (data/buildings). Boş = türün varsayılanları. */
  allowed: readonly string[];
}

export interface GateDef {
  id: string;
  pos: Vec2;
  /** Kapının dışa baktığı yön (derece). */
  facing: number;
  width: number;
  hp: number;
}

export interface WallDef {
  id: string;
  /** Sur ekseni çoklu çizgisi. Dış yüz = ilerleme yönünün sağ tarafı. */
  points: readonly Vec2[];
  height: number;
  thickness: number;
  /** Segment başına HP (8 m'lik segmentler, GDD §4.2 gedik mekaniği). */
  segmentHp: number;
}

export interface SpawnDef {
  id: string;
  pos: Vec2;
  /** Bu noktadan çıkan dalgaların izlediği koridor. */
  lane: string;
}

export interface LaneDef {
  id: string;
  /** Spawn'dan hedefe kaba rota (flow field hedef seçimi ve debug çizimi için). */
  points: readonly Vec2[];
  /** Koridorun bittiği savunma hedefi (gate / wall / citadel id). */
  target: string;
}

/** Oynanışı etkileyen arazi şekillendirmeleri (yükseklik + ileride navmesh). */
export interface PlateauDef {
  id: string;
  center: Vec2;
  radius: number;
  height: number;
}

export interface RampDef {
  id: string;
  /** Rampa ekseni: başlangıç → bitiş, yükseklikler uçlarda. */
  from: Vec2;
  to: Vec2;
  fromHeight: number;
  toHeight: number;
  width: number;
}

export interface MapDef {
  id: string;
  name: string;
  mode: GameMode;
  /** Kare harita kenarı (m). Merkez (0,0). */
  size: number;
  seed: number;
  camera: { home: Vec2; yaw: number; distance: number };
  citadel: { id: string; pos: Vec2; radius: number; hp: number };
  gates: readonly GateDef[];
  walls: readonly WallDef[];
  slots: readonly SlotDef[];
  spawns: readonly SpawnDef[];
  lanes: readonly LaneDef[];
  terrain: { plateaus: readonly PlateauDef[]; ramps: readonly RampDef[] };
}

/** Haritanın iç tutarlılığını kontrol eder; hata mesajları listesi döner (boş = geçerli). */
export const validateMap = (map: MapDef): string[] => {
  const errors: string[] = [];
  const half = map.size / 2;
  const inBounds = (p: Vec2) => Math.abs(p[0]) <= half && Math.abs(p[1]) <= half;
  const ids = new Set<string>();
  const unique = (id: string, what: string) => {
    if (ids.has(id)) errors.push(`yinelenen id: ${id} (${what})`);
    ids.add(id);
  };

  unique(map.citadel.id, 'citadel');
  if (!inBounds(map.citadel.pos)) errors.push('citadel harita dışında');
  for (const g of map.gates) {
    unique(g.id, 'gate');
    if (!inBounds(g.pos)) errors.push(`${g.id} harita dışında`);
    if (g.hp <= 0) errors.push(`${g.id} hp > 0 olmalı`);
  }
  for (const w of map.walls) {
    unique(w.id, 'wall');
    if (w.points.length < 2) errors.push(`${w.id} en az 2 nokta içermeli`);
    for (const p of w.points) if (!inBounds(p)) errors.push(`${w.id} noktası harita dışında`);
  }
  for (const s of map.slots) {
    unique(s.id, 'slot');
    if (!inBounds(s.pos)) errors.push(`${s.id} harita dışında`);
    if (s.kind === 'wall_socket' && s.elevation <= 0) errors.push(`${s.id} sur soketi yükseltisiz`);
  }
  const laneIds = new Set(map.lanes.map((l) => l.id));
  for (const l of map.lanes) {
    unique(l.id, 'lane');
    if (l.points.length < 2) errors.push(`${l.id} en az 2 nokta içermeli`);
    for (const p of l.points) if (!inBounds(p)) errors.push(`${l.id} noktası harita dışında`);
    if (!ids.has(l.target)) errors.push(`${l.id} hedefi bilinmiyor: ${l.target}`);
  }
  for (const s of map.spawns) {
    unique(s.id, 'spawn');
    if (!inBounds(s.pos)) errors.push(`${s.id} harita dışında`);
    if (!laneIds.has(s.lane)) errors.push(`${s.id} bilinmeyen koridor: ${s.lane}`);
  }
  if (map.spawns.length === 0) errors.push('en az bir spawn gerekli');
  for (const p of map.terrain.plateaus) {
    unique(p.id, 'plateau');
    if (!inBounds(p.center)) errors.push(`${p.id} harita dışında`);
  }
  for (const r of map.terrain.ramps) {
    unique(r.id, 'ramp');
    if (!inBounds(r.from) || !inBounds(r.to)) errors.push(`${r.id} harita dışında`);
  }
  return errors;
};
