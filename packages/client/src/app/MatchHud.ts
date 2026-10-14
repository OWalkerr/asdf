import { type MapDef, type MatchInfo, MatchState } from '@bulwark/shared';
import { SIM_TICK_MS } from '../sim-host/protocol';

/**
 * Maç HUD'u (GDD §11.1 üst şerit): dalga, geri sayım, düşman sayısı, kapı canları;
 * maç bitince zafer/yenilgi ekranı. Solid.js arayüzü gelene kadar düz DOM.
 */
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

  constructor(private readonly def: MapDef) {
    this.root = document.createElement('div');
    this.root.id = 'matchbar';
    this.wave = document.createElement('div');
    this.wave.className = 'wave';
    this.root.appendChild(this.wave);
    for (const g of def.gates) {
      const el = document.createElement('div');
      el.className = 'gate';
      el.innerHTML = `<span class="name">${g.id === 'hornburg_gate' ? 'Hornburg Kapısı' : g.id === 'culvert' ? 'Menfez' : g.id}</span><span class="bar"><i></i></span><span class="hp"></span>`;
      this.root.appendChild(el);
      this.gates.push(el);
    }
    document.body.appendChild(this.root);
    this.end = document.createElement('div');
    this.end.id = 'endscreen';
    document.body.appendChild(this.end);
  }

  update(info: MatchInfo, tick: number): void {
    const { waveIndex, waveCount, nextWaveTick, enemiesAlive } = info;
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
      (el.querySelector('.hp') as HTMLElement).textContent = `${hp}`;
    });
    if (!this.ended && info.state !== MatchState.Playing) {
      this.ended = true;
      const victory = info.state === MatchState.Victory;
      const fallen = this.def.gates[info.gateHp.findIndex((hp) => hp <= 0)];
      this.end.innerHTML = `
        <div class="card ${victory ? 'victory' : 'defeat'}">
          <h1>${victory ? 'ZAFER' : 'YENİLGİ'}</h1>
          <p>${victory ? `${this.def.name} tutuldu. ${waveCount} dalga püskürtüldü.` : `${fallen?.id === 'culvert' ? 'Menfez' : 'Hornburg Kapısı'} düştü.`}</p>
          <button type="button">Yeniden başlat</button>
        </div>`;
      this.end.querySelector('button')?.addEventListener('click', () => location.reload());
      this.end.classList.add('show');
    }
  }
}
