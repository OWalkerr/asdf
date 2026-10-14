import { DEFAULT_DIFFICULTY, DIFFICULTIES } from '@bulwark/shared';

/**
 * Maç öncesi ekran (GDD §4.4, §11): harita adı, kısa görev metni ve zorluk seçimi.
 * Seçim yapılınca çözülür; sim seçilen zorlukla başlatılır. `?difficulty=easy|normal|hard`
 * veya otomasyon (navigator.webdriver; `?intro` ile yine gösterilir) ekranı atlar.
 */
export const chooseDifficulty = (mapName: string): Promise<number> => {
  const params = new URLSearchParams(location.search);
  const fromUrl = DIFFICULTIES.findIndex((d) => d.key === params.get('difficulty'));
  if (fromUrl >= 0) return Promise.resolve(fromUrl);
  if (navigator.webdriver && !params.has('intro')) return Promise.resolve(DEFAULT_DIFFICULTY);
  let saved = DEFAULT_DIFFICULTY;
  try {
    const raw = localStorage.getItem('bulwark.difficulty');
    const v = raw === null ? Number.NaN : Number(raw);
    if (Number.isInteger(v) && DIFFICULTIES[v]) saved = v;
  } catch {
    /* depolama yok */
  }
  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.id = 'startscreen';
    root.innerHTML = `
      <div class="card">
        <small>Orta Dünya · Kale Savunması</small>
        <h1>${mapName}</h1>
        <p>Isengard'ın ordusu fırtınalı gecede Deeping Wall'a yürüyor. Kuleler kurun, birlik yetiştirin,
        kapıları koruyun ve beş dalgaya dayanın. Koçbaşlarına dikkat: oklar onları durdurmaz.</p>
        <div class="diffs">
          ${DIFFICULTIES.map(
            (d, i) => `<button type="button" data-i="${i}" class="${i === saved ? 'sel' : ''}">
              <b>${d.name}</b><span>${d.desc}</span>
              <em>Düşman canı %${d.enemyHpPercent} · dalga %${d.waveSizePercent} · ◆${d.startGold}</em>
            </button>`,
          ).join('')}
        </div>
        <button type="button" class="go">Savunmayı başlat</button>
        <p class="keys">Sol tık: seç · Sağ tık: yürü/saldır · WASD/Q/E: kamera · F: Aragorn · 1–6: büyüler · M: ses</p>
      </div>`;
    document.body.appendChild(root);
    let pick = saved;
    root.querySelectorAll<HTMLButtonElement>('.diffs button').forEach((b) => {
      b.addEventListener('click', () => {
        pick = Number(b.dataset.i);
        root.querySelectorAll('.diffs button').forEach((x) => {
          x.classList.toggle('sel', x === b);
        });
      });
      b.addEventListener('dblclick', () => go());
    });
    const go = () => {
      try {
        localStorage.setItem('bulwark.difficulty', String(pick));
      } catch {
        /* depolama yok */
      }
      root.classList.add('out');
      setTimeout(() => root.remove(), 400);
      resolve(pick);
    };
    root.querySelector('.go')?.addEventListener('click', go);
  });
};
