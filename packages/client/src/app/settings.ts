/**
 * Oyun seçenekleri (BFME2 Seçenekler ekranı): ses düzeyleri, birim sesleri, kamera kaydırma hızı.
 * Tarayıcıda saklanır; oyun başında ses motoruna ve kameraya uygulanır.
 */
export interface GameSettings {
  /** 0–100 */
  music: number;
  sfx: number;
  /** Birim konuşmaları (konuşma sentezi). */
  voices: boolean;
  /** Kamera kaydırma hızı çarpanı (0.5–2). */
  scroll: number;
  /** Oyuncu adı (çok oyunculu). */
  nick: string;
}

const KEY = 'bulwark.settings';
const DEFAULTS: GameSettings = { music: 70, sfx: 80, voices: true, scroll: 1, nick: '' };

export const loadSettings = (): GameSettings => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<GameSettings> | null;
    if (v && typeof v === 'object') {
      const clamp = (n: unknown, lo: number, hi: number, d: number) =>
        typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
      return {
        music: clamp(v.music, 0, 100, DEFAULTS.music),
        sfx: clamp(v.sfx, 0, 100, DEFAULTS.sfx),
        voices: v.voices !== false,
        scroll: clamp(v.scroll, 0.5, 2, 1),
        nick: typeof v.nick === 'string' ? v.nick.slice(0, 20) : '',
      };
    }
  } catch {
    /* depolama yok */
  }
  let nick = '';
  try {
    nick = localStorage.getItem('bulwark.nick') ?? '';
  } catch {
    /* depolama yok */
  }
  return { ...DEFAULTS, nick };
};

export const saveSettings = (s: GameSettings): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    localStorage.setItem('bulwark.voices', s.voices ? '1' : '0');
    if (s.nick) localStorage.setItem('bulwark.nick', s.nick);
  } catch {
    /* depolama yok */
  }
};
