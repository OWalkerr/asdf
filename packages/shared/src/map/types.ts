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
  /** Arayüzde görünen ad. */
  name?: string;
  pos: Vec2;
  /** Kapının dışa baktığı yön (derece). */
  facing: number;
  width: number;
  hp: number;
  /**
   * Kapı kırılınca saldıranlara açılan hücreler (genelde kapının arka kapı `block` şekli).
   * Verilmezse kapı kırılsa da yol açılmaz.
   */
  breach?: NavShape;
  /** Saldıranların kapıya yaklaşırken toplandığı dış nokta (zincirdeki iç kapılar için gerekli). */
  approach?: Vec2;
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
  /**
   * Koridorun ilk savunma hedefi (gate / citadel id; TD'de 'exit' = çıkış noktası).
   * `targets` verilirse sırayla kırılacak kapı zinciri (ilki = target); hepsi düşünce kale.
   */
  target: string;
  targets?: readonly string[];
}

/**
 * Kale (Citadel/Fortress, GDD §4.2): FD'de savunulan asıl yapı — düşerse yenilgi. Kahramanlar
 * kapısından çıkar; yükseltmeleri (surlar, mazgallar, mancınık, şifa, hazine) satın alınır.
 * TD'de oyuncunun üssüdür (çıkışın yanında), saldırılmaz.
 */
export interface CitadelDef {
  id: string;
  name?: string;
  pos: Vec2;
  /** Saldırılabilir yarıçap (m). */
  radius: number;
  hp: number;
  /** Kahraman/birlik çıkış noktası (kapı önü). Verilmezse pos'un güneyi. */
  door?: Vec2;
  /** Kalenin ön yüzünün baktığı yön (derece). */
  facing?: number;
  /** Zemin yüksekliği üstüne oturduğu taban (m, render). */
  elevation?: number;
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

/** Genel harita oluşturucunun arazi tanımı (render; oynanış nav'dan gelir). */
export interface TerrainDef {
  plateaus: readonly PlateauDef[];
  ramps: readonly RampDef[];
  /** Yürünebilir alanın dışını dağ/tepe olarak yükselten sınır çokgenleri (genel oluşturucu). */
  basins?: readonly (readonly Vec2[])[];
  /** Nehirler: eksen çoklu çizgisi ve genişlik (su yüzeyi + yatak). */
  rivers?: readonly { points: readonly Vec2[]; width: number }[];
  /** Köprüler: nehir yatağını oyulmaktan korur ve üstüne taş güverte çizilir (a → b ekseni). */
  bridges?: readonly { a: Vec2; b: Vec2; width: number }[];
  /** Yollar (toprak boya, düzleştirme): TD yolları ve kale yolları. */
  roads?: readonly { points: readonly Vec2[]; width: number }[];
  /** Taban arazi renk teması. */
  theme?: 'meadow' | 'autumn' | 'dark' | 'snow';
}

/**
 * Navigasyon ızgarası şekli (GDD §2.4). Işlemler sırayla uygulanır: başlangıçta her hücre
 * kapalıdır; `open` yürünebilir yapar, `block` kapatır. Sim bu listeyi yalnızca temel
 * aritmetikle (trigonometri yok) hücrelere çizer → tüm istemcilerde aynı ızgara.
 */
export type NavShape =
  | { type: 'polygon'; points: readonly Vec2[] }
  | { type: 'circle'; center: Vec2; radius: number }
  | { type: 'ring'; center: Vec2; inner: number; outer: number }
  /** a–b doğru parçası etrafında halfWidth kalınlığında kapsül. */
  | { type: 'capsule'; a: Vec2; b: Vec2; halfWidth: number };

export interface NavOp {
  op: 'open' | 'block';
  shape: NavShape;
  /**
   * Yalnızca `block` için: bu takımlar için kapat (diğerleri geçebilir). Verilmezse herkes.
   * Arka kapı (postern, GDD §4.2): savunucu çıkar, düşman giremez.
   */
  teams?: readonly number[];
  /** Debug / test için açıklama. */
  label?: string;
}

export interface NavDef {
  /** Hücre kenarı (m, tamsayı). */
  cellSize: number;
  ops: readonly NavOp[];
}

/** Bir dalga grubu (GDD §4.1): `atSec` saniyesinde spawn noktasından tabur(lar). */
export interface WaveGroupDef {
  atSec: number;
  spawn: string;
  unitType: number;
  battalions: number;
}

export interface WaveDef {
  name: string;
  groups: readonly WaveGroupDef[];
}

export interface MapDef {
  id: string;
  name: string;
  mode: GameMode;
  /** Kare harita kenarı (m). Merkez (0,0). */
  size: number;
  seed: number;
  camera: { home: Vec2; yaw: number; distance: number };
  citadel: CitadelDef;
  /** TD: sızan düşman başına can kaybı sayacı (başlangıç canı). */
  lives?: number;
  /**
   * TD uç bölgesi (Tower Wars): çıkışa varan düşman yok olmaz, bölgede bekler. Bölge her
   * `strikeEvery` saniyede güç vuruşuyla içindekilere max(strikeDamage, azami canın
   * strikePercent'i) hasar verir; içeride kalan her tabur her `drainEvery` saniyede 1 can
   * götürür. Yoksa çıkışa varan tabur anında (lifeCost) can götürüp kaybolur.
   */
  endZone?: {
    radius: number;
    strikeDamage: number;
    strikePercent: number;
    strikeEvery: number;
    drainEvery: number;
  };
  /** Her dalga başında verilen altın: base + perWave × (dalga − 1). */
  waveGold?: { base: number; perWave: number };
  /** Harita seçim ekranı için kısa açıklama. */
  blurb?: string;
  /** Başlangıç garnizonu (oyuncu tabakları; istemci maç başında spawn komutu yollar). */
  garrison?: readonly { unitType: number; pos: Vec2; count: number }[];
  gates: readonly GateDef[];
  walls: readonly WallDef[];
  slots: readonly SlotDef[];
  spawns: readonly SpawnDef[];
  lanes: readonly LaneDef[];
  terrain: TerrainDef;
  nav: NavDef;
  /** Düşman dalgaları (sırayla); savunan takım 0, saldıran takım 1. */
  waves: readonly WaveDef[];
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
    for (const t of l.targets ?? [l.target])
      if (!(map.mode === 'TD' && t === 'exit') && !ids.has(t)) errors.push(`${l.id} hedefi bilinmiyor: ${t}`);
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
  if (!Number.isInteger(map.nav.cellSize) || map.nav.cellSize < 1)
    errors.push('nav.cellSize pozitif tamsayı olmalı');
  if (map.size % map.nav.cellSize !== 0) errors.push('harita boyu nav.cellSize katı olmalı');
  const spawnIds = new Set(map.spawns.map((s) => s.id));
  map.waves.forEach((w, i) => {
    if (w.groups.length === 0) errors.push(`dalga ${i + 1} boş`);
    for (const g of w.groups) {
      if (!spawnIds.has(g.spawn)) errors.push(`dalga ${i + 1}: bilinmeyen spawn ${g.spawn}`);
      if (g.battalions < 1) errors.push(`dalga ${i + 1}: tabur sayısı ≥ 1 olmalı`);
    }
  });
  for (const r of map.terrain.ramps) {
    unique(r.id, 'ramp');
    if (!inBounds(r.from) || !inBounds(r.to)) errors.push(`${r.id} harita dışında`);
  }
  return errors;
};
