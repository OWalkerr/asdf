import { type MapDef, type MatchInfo, MatchState } from '@bulwark/shared';

/**
 * Maç olayları arayüzü (GDD §11.1): dalga duyurusu (koçbaşı/boss uyarısı), boss can çubuğu ve
 * zafer/yenilgi ekranı. Sürekli durum (dalga, kale, kapılar, kaynaklar) TopHud'dadır.
 */
const BOSS_LABEL: Record<number, string> = {
  16: "Balrog · Durin'in Belası, Morgoth'un ateş iblisi",
  18: 'Su Gözcüsü · Moria kapısının göl canavarı',
  19: 'Ateş Ejderi · alev püskürten kanatlı wyrm',
};

export class MatchHud {
  private readonly end: HTMLDivElement;
  private ended = false;
  private readonly banner: HTMLDivElement;
  private readonly boss: HTMLDivElement;
  private lastWave = 0;
  private bannerTimer = 0;
  /** Yeni dalga başladığında (ses vb.). */
  onWave: ((index: number) => void) | null = null;
  /** Maç bitti (zafer/yenilgi). */
  onEnd: ((victory: boolean) => void) | null = null;

  constructor(private readonly def: MapDef) {
    this.end = document.createElement('div');
    this.end.id = 'endscreen';
    this.banner = document.createElement('div');
    this.banner.id = 'wavebanner';
    this.boss = document.createElement('div');
    this.boss.id = 'bossbar';
    this.boss.innerHTML = '<span></span><span class="bar"><i></i></span>';
    document.body.append(this.end, this.banner, this.boss);
  }

  /** Boss can oranı (null = sahada yok) ve birim tipi (7 Lurtz, 16 Balrog, 18 Su Gözcüsü, 19 Ateş Ejderi). */
  setBoss(ratio: number | null, type = 7): void {
    this.boss.classList.toggle('show', ratio !== null);
    this.boss.classList.toggle('balrog', type === 16 || type === 19);
    const label = BOSS_LABEL[type] ?? "Lurtz · Isengard'ın Uruk kaptanı";
    const span = this.boss.querySelector('span') as HTMLElement;
    if (span.textContent !== label) span.textContent = label;
    if (ratio !== null)
      (this.boss.querySelector('i') as HTMLElement).style.width = `${(ratio * 100).toFixed(1)}%`;
  }

  update(info: MatchInfo): void {
    const { waveIndex, waveCount } = info;
    if (waveIndex > this.lastWave) {
      this.lastWave = waveIndex;
      const w = this.def.waves[waveIndex - 1];
      const ram = w?.groups.some((g) => g.unitType === 5);
      const boss = w?.groups.some((g) => g.unitType === 7);
      const balrog = w?.groups.some((g) => g.unitType === 16);
      const ladder = w?.groups.some((g) => g.unitType === 17);
      const watcher = w?.groups.some((g) => g.unitType === 18);
      const wyrm = w?.groups.some((g) => g.unitType === 19);
      const troll = w?.groups.some((g) => g.unitType === 13);
      const warg = w?.groups.some((g) => g.unitType === 12);
      const warn = watcher
        ? '<span>Su Gözcüsü geliyor — dokunaçları geniş alana vurur; yakın dövüşte saflarınızı dağıtın!</span>'
        : wyrm
          ? '<span>Ateş Ejderi! Uzaktan alev püskürtür ve binaları yakar — okçular ve Legolas ile avlayın.</span>'
          : balrog
            ? '<span>Balrog uyandı — ateş aurası yakındakileri yakar; Gandalf ve okçularla uzaktan vurun!</span>'
            : ladder && this.def.mode === 'FD'
              ? '<span>Kuşatma merdivenleri! Sura dayanan merdiveni sur kuleleri iter; askerlerinizle yıkın.</span>'
              : boss
                ? "<span>Lurtz savaşa katılıyor — Uruk'lar onun yanında daha sert vurur!</span>"
                : troll
                  ? '<span>Mağara trolü geliyor — sopası saflarınızı yarar, mızrak ve okla karşılayın!</span>'
                  : warg
                    ? '<span>Warg binicileri hızla yaklaşıyor — okçularınızı koruyun!</span>'
                    : ram
                      ? `<span>Koçbaşı geliyor — ${this.def.mode === 'TD' ? 'mancınıkla durdurun!' : 'piyadeyle kapıyı koruyun!'}</span>`
                      : '';
      this.banner.innerHTML = `<small>Dalga ${waveIndex} / ${waveCount}</small><b>${w?.name ?? ''}</b>${warn}`;
      this.banner.classList.remove('show');
      void this.banner.offsetWidth; // animasyonu yeniden başlat
      this.banner.classList.add('show');
      clearTimeout(this.bannerTimer);
      this.bannerTimer = window.setTimeout(() => this.banner.classList.remove('show'), 4200);
      this.onWave?.(waveIndex);
    }
    if (!this.ended && info.state !== MatchState.Playing) {
      this.ended = true;
      const victory = info.state === MatchState.Victory;
      this.onEnd?.(victory);
      const lost =
        this.def.mode === 'TD' ? 'Düşman sınırı aştı.' : `${this.def.citadel.name ?? 'Kale'} düştü.`;
      this.end.innerHTML = `
        <div class="card ${victory ? 'victory' : 'defeat'}">
          <small>${this.def.name}</small>
          <h1>${victory ? 'Zafer' : 'Yenilgi'}</h1>
          <p>${victory ? `${waveCount} dalga püskürtüldü. ${this.def.citadel.name ?? 'Kale'} ayakta.` : lost}</p>
          <button type="button">Yeniden başlat</button>
        </div>`;
      this.end.querySelector('button')?.addEventListener('click', () => location.reload());
      this.end.classList.add('show');
    }
  }
}
