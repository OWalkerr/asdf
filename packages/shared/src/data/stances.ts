/**
 * BFME2 tabur duruşları ve tabur başına yükseltmeler.
 * - Saldırgan: daha çok hasar verir, daha çok hasar alır; çatışmada daha uzağa kovalar.
 * - Normal: dengeli (varsayılan).
 * - Mevzi Tut: kalkanlar kenetlenir; daha az hasar alır, daha az verir, yerinden kopmaz.
 * Sancaktar: tabura bir sancak taşıyıcısı katılır; çatışma dışındayken askerler iyileşir,
 * tabur daha hızlı deneyim kazanır (BFME2'deki sancak yükseltmesi).
 */
export const Stance = { Normal: 0, Aggressive: 1, Hold: 2 } as const;
export type Stance = (typeof Stance)[keyof typeof Stance];

export interface StanceDef {
  key: 'normal' | 'aggressive' | 'hold';
  name: string;
  /** Verilen ve alınan hasar yüzdesi. */
  dealt: number;
  taken: number;
  /** Kovalama mesafesi çarpanı (%). */
  leash: number;
  desc: string;
}

/** Stance sırasıyla. */
export const STANCE_DEFS: readonly StanceDef[] = [
  {
    key: 'normal',
    name: 'Normal Duruş',
    dealt: 100,
    taken: 100,
    leash: 100,
    desc: 'Dengeli saldırı ve savunma.',
  },
  {
    key: 'aggressive',
    name: 'Saldırgan Duruş',
    dealt: 125,
    taken: 125,
    leash: 160,
    desc: '+%25 hasar verir, +%25 hasar alır; düşmanı daha uzağa kovalar.',
  },
  {
    key: 'hold',
    name: 'Mevzi Tut',
    dealt: 85,
    taken: 65,
    leash: 50,
    desc: 'Kalkan duvarı: %35 daha az hasar alır, %15 daha az verir; yerinden kopmaz.',
  },
];

export const BANNER = {
  /** Altın maliyeti. */
  cost: 150,
  /** Çatışma dışında saniyede iyileşme (azami canın %'si) ve iyileşmeden önceki sakin süre (s). */
  regenPercent: 3,
  calm: 3,
  /** Kazanılan XP çarpanı (%). */
  xpPercent: 150,
} as const;

/**
 * Tabur başına demirhane yükseltmeleri (BFME2): demirhanede araştırma yükseltmeyi AÇAR, sonra her
 * tabur kendi donanımını altınla alır. Bit = 1 << UPGRADE_DEFS indeksi.
 * - Dövme Kılıçlar: yalnızca yakın dövüş taburları, +%25 yakın dövüş hasarı.
 * - Ağır Zırh: her tabur, %25 daha az hasar.
 * - Ateşli Oklar: yalnızca okçular, oklar ateş hasarı verir. (Kuleler araştırmayla doğrudan alır.)
 */
export interface GearDef {
  cost: number;
  /** Kimler alabilir. */
  for: 'melee' | 'ranged' | 'all';
}
export const GEAR_DEFS: readonly GearDef[] = [
  { cost: 120, for: 'melee' },
  { cost: 120, for: 'all' },
  { cost: 100, for: 'ranged' },
];

/**
 * Birleşik ordu (BFME2 sürü bonusu): yakın dövüş taburu yakınında dost okçu taburu varsa
 * kalkan duvarı arkasından korunur (%15 daha az hasar alır); okçu taburu yakınında dost yakın
 * dövüş taburu varsa rahat nişan alır (+%15 hasar). Kahramanlar ve çağrılmış birlikler sayılmaz.
 */
export const HORDE = { radius: 18, takenPercent: 85, dealtPercent: 115 } as const;
