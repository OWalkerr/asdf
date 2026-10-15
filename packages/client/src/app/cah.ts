import { CAH_CLASSES, type HeroDef, heroRoster, UnitTypeId } from '@bulwark/shared';

/**
 * Kahraman Yarat (BFME2 Create-a-Hero) ayarı: sınıf, ad ve kullanım. Tarayıcıda saklanır; maç
 * başında `activeCah` ile sim'e ve arayüze verilir (seçilirse tarafın 3. kahramanının yerini alır).
 */
export interface CahSetting {
  on: boolean;
  cls: number;
  name: string;
}

const KEY = 'bulwark.cah';
const DEFAULT_NAMES = ['Kılıçlı Kahraman', 'Okçu Kahraman', 'Büyücü Kahraman'];
export const CAH_UNITS = [UnitTypeId.CahWarrior, UnitTypeId.CahArcher, UnitTypeId.CahWizard];

export const loadCah = (): CahSetting => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<CahSetting> | null;
    if (v && typeof v === 'object') {
      const cls = Number(v.cls);
      return {
        on: v.on === true,
        cls: CAH_CLASSES[cls] ? cls : 0,
        name: typeof v.name === 'string' ? v.name.slice(0, 24) : '',
      };
    }
  } catch {
    /* depolama yok */
  }
  return { on: false, cls: 0, name: '' };
};

export const saveCah = (c: CahSetting): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* depolama yok */
  }
};

let active = -1;
let activeName = '';

/** Maçta kullanılan sınıf (-1 = yok) ve ad. */
export const setActiveCah = (cls: number, name: string): void => {
  active = cls;
  activeName = name;
};
export const activeCah = (): number => active;

/** Özel kahramanın görünen adı (sınıf birimi değilse null). */
export const cahName = (unitType: number): string | null => {
  const i = CAH_UNITS.indexOf(unitType as (typeof CAH_UNITS)[number]);
  if (i < 0) return null;
  return i === active && activeName.trim() ? activeName.trim() : (DEFAULT_NAMES[i] ?? '');
};

/** Arayüz için tarafın kahraman kadrosu (Kahraman Yarat dahil). */
export const roster = (faction: number): readonly HeroDef[] => heroRoster(faction, active);
