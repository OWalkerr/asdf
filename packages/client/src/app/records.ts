import { DIFFICULTIES, FACTIONS } from '@bulwark/shared';

/**
 * Maç puanı ve kalıcı rekorlar (BFME2 maç sonu istatistikleri): harita × zorluk × taraf başına en
 * iyi puan, yıldız ve en ileri dalga tarayıcıda (localStorage) saklanır. Depolama yoksa sessizce
 * çalışmaya devam eder.
 */
export interface MatchStats {
  victory: boolean;
  /** Ulaşılan dalga ve toplam dalga. */
  wave: number;
  waves: number;
  kills: number;
  losses: number;
  goldEarned: number;
  /** Maç süresi (sn). */
  seconds: number;
  /** Kale canı (FD) veya kalan can oranı (TD), [0, 1]. */
  health: number;
  difficulty: number;
  faction: number;
}

export interface RecordEntry {
  score: number;
  stars: number;
  wave: number;
  victory: boolean;
  seconds: number;
}

const KEY = 'bulwark.records';
const MULT = [0.75, 1, 1.5];

/** Puan: öldürülen ×2, temizlenen dalga ×100, zaferde 1000 + sağlık ×1000, kayıp −1; zorluk çarpanı. */
export const scoreOf = (s: MatchStats): number => {
  const cleared = s.victory ? s.waves : Math.max(0, s.wave - 1);
  const raw = s.kills * 2 + cleared * 100 - s.losses + (s.victory ? 1000 + Math.round(s.health * 1000) : 0);
  return Math.max(0, Math.round(raw * (MULT[s.difficulty] ?? 1)));
};

/** Yıldız (yalnızca zaferde): 1 + sağlık ≥ %40 + sağlık ≥ %75. */
export const starsOf = (s: MatchStats): number =>
  s.victory ? 1 + (s.health >= 0.4 ? 1 : 0) + (s.health >= 0.75 ? 1 : 0) : 0;

const load = (): Record<string, RecordEntry> => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, RecordEntry>) : {};
  } catch {
    return {};
  }
};

const keyOf = (mapId: string, difficulty: number, faction: number) =>
  `${mapId}:${DIFFICULTIES[difficulty]?.key ?? difficulty}:${FACTIONS[faction]?.key ?? faction}`;

/** Maç sonucunu kaydeder; yeni rekorsa true. */
export const saveRecord = (
  mapId: string,
  s: MatchStats,
): { entry: RecordEntry; best: RecordEntry; isNew: boolean } => {
  const all = load();
  const k = keyOf(mapId, s.difficulty, s.faction);
  const entry: RecordEntry = {
    score: scoreOf(s),
    stars: starsOf(s),
    wave: s.wave,
    victory: s.victory,
    seconds: Math.round(s.seconds),
  };
  const prev = all[k];
  const isNew = !prev || entry.score > prev.score;
  const best: RecordEntry = isNew
    ? { ...entry, stars: Math.max(entry.stars, prev?.stars ?? 0) }
    : { ...prev, stars: Math.max(prev.stars, entry.stars), wave: Math.max(prev.wave, entry.wave) };
  all[k] = best;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* depolama yok */
  }
  return { entry, best, isNew };
};

/** Haritanın tüm zorluk/taraf kayıtları içindeki en iyisi (başlangıç ekranı rozeti). */
export const bestForMap = (mapId: string): RecordEntry | null => {
  let best: RecordEntry | null = null;
  let stars = 0;
  for (const [k, v] of Object.entries(load())) {
    if (!k.startsWith(`${mapId}:`)) continue;
    stars = Math.max(stars, v.stars);
    if (best === null || v.score > best.score) best = v;
  }
  return best === null ? null : { ...(best as RecordEntry), stars };
};

export const starText = (n: number): string => '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n));
