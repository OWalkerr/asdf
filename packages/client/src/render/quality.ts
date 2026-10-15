/**
 * Grafik kalitesi (başlangıç ekranında seçilir, tarayıcıda saklanır). Kasmayı azaltmak için:
 * piksel oranı sınırı, gölge çözünürlüğü / kapalı gölge ve kenar yumuşatma.
 */
export type Quality = 'low' | 'medium' | 'high';
export const QUALITY_NAMES: Record<Quality, string> = { low: 'Düşük', medium: 'Orta', high: 'Yüksek' };

export const getQuality = (): Quality => {
  try {
    const q = localStorage.getItem('bulwark.quality');
    if (q === 'low' || q === 'medium' || q === 'high') return q;
  } catch {
    /* depolama yok */
  }
  // Varsayılan: yüksek DPI ekranda orta, diğerlerinde yüksek.
  return (window.devicePixelRatio || 1) > 1.25 ? 'medium' : 'high';
};

export const setQuality = (q: Quality): void => {
  try {
    localStorage.setItem('bulwark.quality', q);
  } catch {
    /* depolama yok */
  }
};

export const QUALITY = {
  low: { pixelRatio: 1, shadows: false, shadowMap: 1024, antialias: false },
  medium: { pixelRatio: 1.25, shadows: true, shadowMap: 1024, antialias: true },
  high: { pixelRatio: 2, shadows: true, shadowMap: 2048, antialias: true },
} as const;
