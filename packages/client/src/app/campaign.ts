/**
 * Sefer (kampanya) modu — BFME2'nin İyi ve Kötü seferleri gibi: sırayla açılan görevler, her
 * görevin kendi haritası, tarafı, zorluğu ve hikâye girişi. İlerleme tarayıcıda saklanır; zaferden
 * sonra "Sonraki görev" bir sonraki görevi doğrudan başlatır (sessionStorage aktarımı).
 */
export interface Mission {
  title: string;
  mapId: string;
  /** FACTIONS indeksi. */
  faction: number;
  /** DIFFICULTIES indeksi. */
  difficulty: number;
  /** Görev öncesi anlatı (kısa paragraflar). */
  story: readonly string[];
  goal: string;
}
export interface Campaign {
  id: 'good' | 'evil';
  name: string;
  tagline: string;
  missions: readonly Mission[];
}

export const CAMPAIGNS: readonly Campaign[] = [
  {
    id: 'good',
    name: 'Batı’nın Son İttifakı',
    tagline: 'İyi Sefer · Gondor, Rohan ve Lórien Gölge’ye karşı',
    missions: [
      {
        title: 'Taşkalkan’da İlk Işık',
        mapId: 'stoneshield',
        faction: 0,
        difficulty: 0,
        story: [
          'Doğu sınırındaki Taşkalkan kalesine kara haberler ulaşır: orklar Anduin’i geçti.',
          'Kale komutanı olarak işçilerini topla, sura kuleler kur ve yardım gelene dek dayan.',
        ],
        goal: 'Altı dalgayı püskürt; kale ayakta kalsın.',
      },
      {
        title: 'İkiz Köprüler',
        mapId: 'twin_bridges',
        faction: 1,
        difficulty: 1,
        story: [
          'Isengard’ın Urukları Isen geçitlerine yürüyor. İki köprü düşerse Rohan’ın batısı yanar.',
          'Théoden’in Rohirrim’i köprü başlarını tutmalı: mızrakçıları öne, okçuları arkaya diz.',
        ],
        goal: 'Her iki köprüyü de tut; kale düşmesin.',
      },
      {
        title: 'Yılan Vadisi',
        mapId: 'serpent_vale',
        faction: 2,
        difficulty: 1,
        story: [
          'Lórien’in güneyinde dar bir vadi Altın Orman’a açılır. Haldir sınır muhafızlarıyla bekler.',
          'Yolun iki yanına kuleler ve mancınıklar kur; düşman vadiden çıkmamalı.',
        ],
        goal: 'Sızan düşman sayısını canının altında tut.',
      },
      {
        title: 'Miğfer Dibi',
        mapId: 'helms_deep',
        faction: 1,
        difficulty: 1,
        story: [
          'Rohan halkı Hornburg’a sığındı. Saruman’ın on bin Uruk’u surların önünde, merdivenler ve kuşatma kuleleriyle.',
          'Sabaha kadar dayan: Gandalf beşinci günün şafağında doğudan gelecek.',
        ],
        goal: 'Bütün dalgaları püskürt; kale düşmesin.',
      },
      {
        title: 'Son Savunma',
        mapId: 'fortress_defence',
        faction: 0,
        difficulty: 2,
        story: [
          'Mordor’un bütün gücü Batı’nın son kalesine yürüyor: troller, Balrog ve kanatlı Nazgûl.',
          'Bütün güçlerini, kahramanlarını ve gücü kitabını kullan. Bu, çağın son savaşı.',
        ],
        goal: 'Yirmi dalgayı püskürt.',
      },
    ],
  },
  {
    id: 'evil',
    name: 'Gölge Yükseliyor',
    tagline: 'Kötü Sefer · Isengard ve Mordor Batı’ya karşı',
    missions: [
      {
        title: 'Çatal Yol',
        mapId: 'forked_road',
        faction: 3,
        difficulty: 0,
        story: [
          'Rohan öncüleri Isengard’ın yollarını keşfe çıktı. Saruman hiçbirinin geri dönmesini istemiyor.',
          'Uruk arbaletçilerini yolun kavşaklarına yerleştir; Rohan atlıları buradan geçemesin.',
        ],
        goal: 'Sızan düşman sayısını canının altında tut.',
      },
      {
        title: 'Isen Köprüleri',
        mapId: 'twin_bridges',
        faction: 3,
        difficulty: 1,
        story: [
          'Gondor ve Rohan, Isengard’ın ormanlarına karşı köprülerden saldırıyor.',
          'Lurtz ve Saruman köprü başını tutmalı. Beyaz El geri çekilmez.',
        ],
        goal: 'Kaleyi Batı’nın karşı saldırısına karşı koru.',
      },
      {
        title: 'Kara Kapı Önünde',
        mapId: 'stoneshield',
        faction: 4,
        difficulty: 1,
        story: [
          'Gondor bir öncü kaleyi geri almak için yürüyor. Gothmog, Morannon’un önündeki karakolu tutuyor.',
          'Ork sürülerini kapılara yığ, trolleri yedekte tut. Sauron’un Ağzı gözlerini bu kaleye dikti.',
        ],
        goal: 'Altı dalgayı püskürt.',
      },
      {
        title: 'Kule Savaşları',
        mapId: 'tower_wars',
        faction: 4,
        difficulty: 1,
        story: [
          'Batı’nın orduları Mordor’un yollarına akın ediyor. Cadı Kral yolun her dönemecine kule diktiriyor.',
          'Kuleleri işçilerinle kur; Gölge’nin topraklarına kimse ulaşmamalı.',
        ],
        goal: 'Sızan düşman sayısını canının altında tut.',
      },
      {
        title: 'Barad-dûr’un Kuşatması',
        mapId: 'fortress_defence',
        faction: 4,
        difficulty: 2,
        story: [
          'Batı’nın Kaptanları Kara Kale’nin dibinde. Aragorn’un ordusu, Rohirrim ve elfler son kez saldırıyor.',
          'Gözün bütün gücü senin elinde: Balrog’u uyandır, Nazgûl’ü gönder. Barad-dûr düşmemeli.',
        ],
        goal: 'Yirmi dalgayı püskürt.',
      },
    ],
  },
];

const KEY = (id: string) => `bulwark.campaign.${id}`;

/** Tamamlanan görev sayısı (0 = yalnızca ilk görev açık). */
export const campaignProgress = (id: string): number => {
  try {
    const v = Number(localStorage.getItem(KEY(id)));
    return Number.isInteger(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
};

/** Görev kazanıldı: ilerlemeyi kaydet (geri gitmez). */
export const completeMission = (id: string, index: number): void => {
  try {
    if (index + 1 > campaignProgress(id)) localStorage.setItem(KEY(id), String(index + 1));
  } catch {
    /* depolama yok */
  }
};

/** Sonraki açılışta doğrudan başlatılacak görev (maç sonu "Sonraki görev"). */
export const queueMission = (id: string, index: number): void => {
  try {
    sessionStorage.setItem('bulwark.queued', JSON.stringify({ id, index }));
  } catch {
    /* depolama yok */
  }
};

export const takeQueuedMission = (): { id: string; index: number } | null => {
  try {
    const raw = sessionStorage.getItem('bulwark.queued');
    sessionStorage.removeItem('bulwark.queued');
    if (!raw) return null;
    const v = JSON.parse(raw) as { id: string; index: number };
    return CAMPAIGNS.some((c) => c.id === v.id) ? v : null;
  } catch {
    return null;
  }
};

/** Başlangıç ekranını sefer sekmesinde aç. */
export const openCampaignTab = (): void => {
  try {
    sessionStorage.setItem('bulwark.tab', 'campaign');
  } catch {
    /* depolama yok */
  }
};
export const takeCampaignTab = (): boolean => {
  try {
    const v = sessionStorage.getItem('bulwark.tab') === 'campaign';
    sessionStorage.removeItem('bulwark.tab');
    return v;
  } catch {
    return false;
  }
};
