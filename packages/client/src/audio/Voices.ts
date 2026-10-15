import { UnitTypeId } from '@bulwark/shared';

/**
 * Birim cevapları (BFME2'de seçince ve emir verince konuşan birlikler): tarayıcının konuşma
 * sentezi (Web Speech API) ile Türkçe kısa replikler. Ses dosyası yok; tarayıcıda Türkçe ses
 * yoksa varsayılan sesle okunur. Birim türüne göre perde/hız (trol kalın ve yavaş, elf ince).
 * V ile açılıp kapanır; genel ses kapalıyken susar.
 */
type Kind = 'select' | 'move' | 'attack';
interface VoiceDef {
  select: readonly string[];
  move: readonly string[];
  attack: readonly string[];
  pitch: number;
  rate: number;
}

const GONDOR: VoiceDef = {
  select: ['Emredersiniz.', 'Gondor hazır.', 'Emrinizdeyiz, lordum.'],
  move: ['Hemen!', 'İlerliyoruz.', 'Gidiyoruz.'],
  attack: ['Gondor için!', 'Saldırın!', 'Ak Şehir için!'],
  pitch: 0.9,
  rate: 1.05,
};
const ROHAN: VoiceDef = {
  select: ['Rohan hazır.', 'Emrinizdeyiz.', 'Atlar eyerli.'],
  move: ['İleri!', 'Dörtnala!', 'Hemen.'],
  attack: ['Rohan için!', 'Ölüm!', 'Kral için!'],
  pitch: 0.95,
  rate: 1.08,
};
const ELVES: VoiceDef = {
  select: ['Emrinizdeyiz.', 'Galadhrim hazır.', 'Ormanın gözleri açık.'],
  move: ['Sessizce.', 'Gidiyoruz.', 'Rüzgâr gibi.'],
  attack: ['Lórien için!', 'Okları gerin!', 'Ateş!'],
  pitch: 1.2,
  rate: 1.0,
};
const URUK: VoiceDef = {
  select: ['Beyaz El için.', 'Emrini bekliyoruz.', 'Ne istiyorsun?'],
  move: ['Yürüyün!', 'Hızlanın!', 'Gidiyoruz.'],
  attack: ['Et geri döndü!', 'Öldürün!', 'Beyaz El için!'],
  pitch: 0.6,
  rate: 0.95,
};
const ORC: VoiceDef = {
  select: ['Ne var?', 'Emir mi?', 'Göz izliyor.'],
  move: ['Koşun, kurtçuklar!', 'Tamam, tamam.', 'Gidiyoruz işte!'],
  attack: ['Ezin onları!', 'Kanlarını dökün!', 'Saldırın!'],
  pitch: 0.75,
  rate: 1.2,
};
const TROLL: VoiceDef = {
  select: ['Hrrr.', 'Trol aç.', 'Hımm?'],
  move: ['Trol gider.', 'Hrr, gidiyor.'],
  attack: ['Ezer!', 'Trol vurur!'],
  pitch: 0.2,
  rate: 0.7,
};
const WORKER: VoiceDef = {
  select: ['İş başına!', 'Ne kuralım?', 'Çekicim hazır.'],
  move: ['Hemen geliyorum.', 'Yoldayım.'],
  attack: ['Bu bizim işimiz değil!'],
  pitch: 1.05,
  rate: 1.1,
};
const HERO: Record<number, VoiceDef> = {
  [UnitTypeId.Aragorn]: {
    select: ["Isildur'un varisi burada.", 'Ne istersin?'],
    move: ['Batıya!', 'Gidiyorum.'],
    attack: ['Batının Adamları!', 'Gondor için!'],
    pitch: 0.85,
    rate: 1.0,
  },
  [UnitTypeId.Gandalf]: {
    select: ['Bir büyücü asla geç kalmaz.', 'Evet?'],
    move: ['Gölgefaks, bize hızı göster.', 'Yola!'],
    attack: ['Geçemezsin!', 'Karanlık geri çekilsin!'],
    pitch: 0.7,
    rate: 0.92,
  },
  [UnitTypeId.Legolas]: {
    select: ['Elf gözleri keskindir.', 'Hazırım.'],
    move: ['Gidiyorum.', 'Hafif adımlarla.'],
    attack: ['Ok yağmuru!', 'Hedef bende.'],
    pitch: 1.15,
    rate: 1.05,
  },
  [UnitTypeId.Theoden]: {
    select: ['Mark’ın kralı burada.', 'Söyle.'],
    move: ['Atlanın!', 'İleri!'],
    attack: ['Ölüm! Ölüm!', "Théoden'in atlıları!"],
    pitch: 0.75,
    rate: 0.95,
  },
  [UnitTypeId.Eowyn]: {
    select: ['Kalkanım hazır.', 'Emret.'],
    move: ['Gidiyorum.'],
    attack: ['Ben erkek değilim!', 'Rohan için!'],
    pitch: 1.25,
    rate: 1.05,
  },
  [UnitTypeId.Saruman]: {
    select: ['Saruman konuşur, dünya dinler.', 'Ne istiyorsun?'],
    move: ['Isengard bekler.'],
    attack: ['Ateş!', 'Beyaz Elin gücü!'],
    pitch: 0.65,
    rate: 0.9,
  },
  [UnitTypeId.LurtzHero]: {
    select: ['Av başlasın.', 'Ne var?'],
    move: ['Takip edin!'],
    attack: ['Avlayın onları!', 'Hiçbiri kaçmasın!'],
    pitch: 0.5,
    rate: 0.95,
  },
  [UnitTypeId.WitchKing]: {
    select: ['Beni hiçbir erkek öldüremez.', 'Evet?'],
    move: ['Gölgeler ilerler.'],
    attack: ['Sizi bekleyen ölümdür!', 'Yok edin!'],
    pitch: 0.3,
    rate: 0.8,
  },
  [UnitTypeId.Gorkil]: {
    select: ['Kral burada!', 'Ne istiyorsun?'],
    move: ['Koşun, sürüngenler!', 'Dağdan inin!'],
    attack: ['Parçalayın onları!', 'Hepsi bizim!'],
    pitch: 1.4,
    rate: 1.15,
  },
  [UnitTypeId.Drogoth]: {
    select: ['Alev bekliyor.', 'Söyle.'],
    move: ['Kanatlarım açık.'],
    attack: ['Yanacaklar!', 'Küle dönsünler!'],
    pitch: 0.25,
    rate: 0.75,
  },
  [UnitTypeId.Shelob]: {
    select: ['Ssss…', 'Aç…'],
    move: ['Karanlıkta…'],
    attack: ['Ziyafet!', 'Taze et…'],
    pitch: 0.6,
    rate: 0.7,
  },
  [UnitTypeId.TomBombadil]: {
    select: ['Hey dol! Neşeli dol!', 'Yaşlı Tom burada!'],
    move: ['Tom geliyor, tıngır mıngır!'],
    attack: ['Kaçın bakalım!', 'Hop hop!'],
    pitch: 1.2,
    rate: 1.2,
  },
  [UnitTypeId.Ent]: {
    select: ['Hmm… hom…', 'Acele etme…'],
    move: ['Yürüyoruz…'],
    attack: ['Isengard’ın ateşini söndürün!', 'Hoom!'],
    pitch: 0.2,
    rate: 0.6,
  },
  [UnitTypeId.Gothmog]: {
    select: ['İnsan çağı bitti.', 'Emir ver.'],
    move: ['Yürüyün, köpekler!'],
    attack: ['Ork çağı geldi!', 'Hepsini öldürün!'],
    pitch: 0.45,
    rate: 1.0,
  },
};

const voiceFor = (t: number): VoiceDef => {
  const h = HERO[t];
  if (h) return h;
  switch (t) {
    case UnitTypeId.Worker:
      return WORKER;
    case UnitTypeId.RohanSpearman:
    case UnitTypeId.RohanArcher:
    case UnitTypeId.RohanRiders:
    case UnitTypeId.Rohirrim:
      return ROHAN;
    case UnitTypeId.Galadhrim:
    case UnitTypeId.LorienArcher:
    case UnitTypeId.LorienArcherTrained:
    case UnitTypeId.Haldir:
    case UnitTypeId.Elrond:
      return ELVES;
    case UnitTypeId.UrukHai:
    case UnitTypeId.UrukCrossbow:
    case UnitTypeId.Sharku:
      return URUK;
    case UnitTypeId.OrcWarrior:
    case UnitTypeId.OrcArcher:
    case UnitTypeId.WargRider:
    case UnitTypeId.MouthOfSauron:
    case UnitTypeId.GoblinWarrior:
    case UnitTypeId.GoblinArcher:
    case UnitTypeId.SpiderRider:
      return ORC;
    case UnitTypeId.CaveTroll:
      return TROLL;
    default:
      return GONDOR;
  }
};

export class Voices {
  private enabled = true;
  private last = 0;
  private turn = 0;
  private voice: SpeechSynthesisVoice | null = null;
  /** Genel ses kapalı mı (AudioEngine). */
  muted: () => boolean = () => false;

  constructor() {
    try {
      this.enabled = localStorage.getItem('bulwark.voices') !== '0';
    } catch {
      this.enabled = true;
    }
    if (typeof speechSynthesis === 'undefined') return;
    const pick = () => {
      const vs = speechSynthesis.getVoices();
      this.voice = vs.find((v) => v.lang.toLowerCase().startsWith('tr')) ?? null;
    };
    pick();
    speechSynthesis.addEventListener?.('voiceschanged', pick);
  }

  get isOn(): boolean {
    return this.enabled;
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem('bulwark.voices', this.enabled ? '1' : '0');
    } catch {
      /* depolama yok */
    }
    if (!this.enabled && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    return this.enabled;
  }

  /** Birim türü için replik (seçim / hareket / saldırı); art arda gelenleri seyreltir. */
  say(unitType: number, kind: Kind): void {
    if (!this.enabled || this.muted() || typeof speechSynthesis === 'undefined') return;
    const now = performance.now();
    if (now - this.last < (kind === 'select' ? 900 : 1400)) return;
    this.last = now;
    const v = voiceFor(unitType);
    const lines = v[kind];
    const text = lines[this.turn++ % lines.length] as string;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'tr-TR';
    if (this.voice) u.voice = this.voice;
    u.pitch = v.pitch;
    u.rate = v.rate;
    u.volume = 0.85;
    speechSynthesis.speak(u);
  }
}
