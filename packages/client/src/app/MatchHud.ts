import { ECONOMY, type MapDef, type MatchInfo, MatchState } from '@bulwark/shared';
import { SIM_TICK_MS } from '../sim-host/protocol';

/**
 * Maç HUD'u (GDD §11.1 üst şerit): dalga, geri sayım, düşman sayısı, kapı canları;
 * maç bitince zafer/yenilgi ekranı. Solid.js arayüzü gelene kadar düz DOM.
 */
const GATE_NAMES: Record<string, string> = {
  hornburg_gate: 'Hornburg Kapısı',
  culvert: 'Menfez',
  hornburg_postern: 'Arka Kapı',
};

const fmtTime = (ticks: number) => {
  const s = Math.max(0, Math.ceil((ticks * SIM_TICK_MS) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export class MatchHud {
  private readonly root: HTMLDivElement;
  private readonly wave: HTMLDivElement;
  private readonly gates: HTMLDivElement[] = [];
  private readonly end: HTMLDivElement;
  private ended = false;
  private readonly banner: HTMLDivElement;
  private readonly boss: HTMLDivElement;
  private lastWave = 0;
  private bannerTimer = 0;
  /** Kapı onarımı isteği (kapı indeksi). */
  onRepair: ((gate: number) => void) | null = null;
  /** Yeni dalga başladığında (ses vb.). */
  onWave: ((index: number) => void) | null = null;
  /** Maç bitti (zafer/yenilgi). */
  onEnd: ((victory: boolean) => void) | null = null;

  constructor(private readonly def: MapDef) {
    this.root = document.createElement('div');
    this.root.id = 'matchbar';
    this.wave = document.createElement('div');
    this.wave.className = 'wave';
    this.root.appendChild(this.wave);
    for (const g of def.gates) {
      const el = document.createElement('div');
      el.className = 'gate';
      el.innerHTML = `<span class="name">${g.name ?? GATE_NAMES[g.id] ?? g.id}</span><span class="bar"><i></i></span><span class="hp"></span><button type="button" class="repair" title="Kapıyı onar: ${ECONOMY.repairCost} altın, ${ECONOMY.repairTime} sn'de +%${ECONOMY.repairPercent}">Onar ◆${ECONOMY.repairCost}</button>`;
      const index = this.gates.length;
      el.querySelector('button')?.addEventListener('click', () => this.onRepair?.(index));
      this.root.appendChild(el);
      this.gates.push(el);
    }
    document.body.appendChild(this.root);
    this.end = document.createElement('div');
    this.end.id = 'endscreen';
    document.body.appendChild(this.end);
    this.banner = document.createElement('div');
    this.banner.id = 'wavebanner';
    document.body.appendChild(this.banner);
    this.boss = document.createElement('div');
    this.boss.id = 'bossbar';
    this.boss.innerHTML = '<span>Lurtz · Isengard\'ın Uruk kaptanı</span><span class="bar"><i></i></span>';
    document.body.appendChild(this.boss);
  }

  /** Boss can oranı (null = sahada yok). */
  setBoss(ratio: number | null): void {
    this.boss.classList.toggle('show', ratio !== null);
    if (ratio !== null)
      (this.boss.querySelector('i') as HTMLElement).style.width = `${(ratio * 100).toFixed(1)}%`;
  }

  update(info: MatchInfo, tick: number, gateRepair: readonly number[] = []): void {
    const { waveIndex, waveCount, nextWaveTick, enemiesAlive } = info;
    if (waveIndex > this.lastWave) {
      this.lastWave = waveIndex;
      const w = this.def.waves[waveIndex - 1];
      const ram = w?.groups.some((g) => g.unitType === 5);
      const boss = w?.groups.some((g) => g.unitType === 7);
      const warn = boss
        ? "<span>Lurtz savaşa katılıyor — Uruk'lar onun yanında daha sert vurur!</span>"
        : ram
          ? '<span>Koçbaşı geliyor — piyadeyle kapıyı koruyun!</span>'
          : '';
      this.banner.innerHTML = `<small>Dalga ${waveIndex} / ${waveCount}</small><b>${w?.name ?? ''}</b>${warn}`;
      this.banner.classList.remove('show');
      void this.banner.offsetWidth; // animasyonu yeniden başlat
      this.banner.classList.add('show');
      clearTimeout(this.bannerTimer);
      this.bannerTimer = window.setTimeout(() => this.banner.classList.remove('show'), 4200);
      this.onWave?.(waveIndex);
    }
    const name = waveIndex > 0 ? this.def.waves[waveIndex - 1]?.name : undefined;
    const next = nextWaveTick >= 0 ? ` · sonraki dalga ${fmtTime(nextWaveTick - tick)}` : '';
    this.wave.textContent =
      waveIndex === 0
        ? `İlk dalgaya ${fmtTime(nextWaveTick - tick)} · savunmayı hazırla`
        : `Dalga ${waveIndex}/${waveCount} — ${name ?? ''} · ${enemiesAlive} düşman${next}`;
    info.gateHp.forEach((hp, i) => {
      const el = this.gates[i];
      const max = info.gateMax[i] ?? 1;
      if (!el) return;
      const ratio = Math.max(0, hp / max);
      (el.querySelector('i') as HTMLElement).style.width = `${(ratio * 100).toFixed(1)}%`;
      el.classList.toggle('danger', ratio < 0.35);
      const repairing = (gateRepair[i] ?? 0) > 0;
      el.classList.toggle('repairing', repairing);
      (el.querySelector('.hp') as HTMLElement).textContent = `${hp}`;
      const btn = el.querySelector('button') as HTMLButtonElement;
      btn.disabled =
        repairing ||
        hp >= max ||
        hp <= 0 ||
        info.gold < ECONOMY.repairCost ||
        info.state !== MatchState.Playing;
      btn.textContent = repairing ? 'Onarılıyor…' : `Onar ◆${ECONOMY.repairCost}`;
    });
    if (!this.ended && info.state !== MatchState.Playing) {
      this.ended = true;
      const victory = info.state === MatchState.Victory;
      this.onEnd?.(victory);

      this.end.innerHTML = `
        <div class="card ${victory ? 'victory' : 'defeat'}">
          <h1>${victory ? 'ZAFER' : 'YENİLGİ'}</h1>
          <p>${victory ? `${this.def.name} tutuldu. ${waveCount} dalga püskürtüldü.` : this.def.mode === 'TD' ? 'Düşman sınırı aştı.' : `${this.def.citadel.name ?? 'Kale'} düştü.`}</p>
          <button type="button">Yeniden başlat</button>
        </div>`;
      this.end.querySelector('button')?.addEventListener('click', () => location.reload());
      this.end.classList.add('show');
    }
  }
}
