/**
 * Çatışma (BFME2 Skirmish / çok oyunculu karşılaşma) kurulumu: oyuncu yuvaları. Her yuva bir
 * takımdır (0–3); aynı `alliance` numarasındakiler müttefiktir. `ai` ≥ 0 ise yuvayı bilgisayar
 * oynar (AI_LEVELS indeksi), −1 ise insan. `humans[i]` = i. insan oyuncunun (komutlardaki
 * `player`) takımı.
 */
export interface VersusSlot {
  team: number;
  faction: number;
  alliance: number;
  ai: number;
  /** Haritanın başlangıç konumu (MapDef.starts indeksi). */
  start: number;
}

export interface VersusSetup {
  slots: readonly VersusSlot[];
  humans: readonly number[];
  startGold: number;
  /** Komuta puanı tavanının üst sınırı (BFME2 lobi ayarı). */
  cpLimit: number;
}

/** Bilgisayar zorlukları (BFME2: Kolay, Orta, Zor, Acımasız). */
export const AI_LEVELS = [
  { key: 'easy', name: 'Kolay', thinkSec: 4, attackAt: 10, incomePercent: 80 },
  { key: 'medium', name: 'Orta', thinkSec: 3, attackAt: 8, incomePercent: 100 },
  { key: 'hard', name: 'Zor', thinkSec: 2, attackAt: 7, incomePercent: 125 },
  { key: 'brutal', name: 'Acımasız', thinkSec: 1, attackAt: 6, incomePercent: 160 },
] as const;

/** Lobi seçenekleri: başlangıç kaynakları ve komuta puanı sınırı (BFME2). */
export const START_GOLD_OPTIONS = [1000, 2000, 3000, 5000, 10000] as const;
export const CP_LIMIT_OPTIONS = [300, 500, 700, 1000] as const;

/** Oyuncu renkleri (lobi "Renk"): BFME2 paleti. */
export const PLAYER_COLORS = [
  { name: 'Mavi', main: '#2f5fa8' },
  { name: 'Kırmızı', main: '#b0302a' },
  { name: 'Yeşil', main: '#3d8a35' },
  { name: 'Sarı', main: '#d0a830' },
  { name: 'Mor', main: '#7a3ea8' },
  { name: 'Turuncu', main: '#d0702a' },
  { name: 'Turkuaz', main: '#2a9aa0' },
  { name: 'Beyaz', main: '#d8d8d2' },
] as const;
