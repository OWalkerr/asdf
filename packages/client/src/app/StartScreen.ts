import { DEFAULT_DIFFICULTY, DIFFICULTIES, MAP_DEFS } from '@bulwark/shared';

/**
 * Maç öncesi ekran (GDD §4.4, §11): harita (FD / TD) ve zorluk seçimi. Seçim yapılınca çözülür;
 * harita ve sim seçilen değerlerle kurulur. `?map=…&difficulty=…` ikisi birden verilirse veya
 * otomasyonda (navigator.webdriver; `?intro` ile yine gösterilir) ekran atlanır.
 */
export interface MatchChoice {
  mapId: string;
  difficulty: number;
}

const MAP_IDS = Object.keys(MAP_DEFS);
const DEFAULT_MAP = MAP_IDS[0] as string;

export const chooseMatch = (): Promise<MatchChoice> => {
  const params = new URLSearchParams(location.search);
  const urlMap = params.get('map');
  const fromUrl = DIFFICULTIES.findIndex((d) => d.key === params.get('difficulty'));
  let mapPick = urlMap && MAP_DEFS[urlMap] ? urlMap : DEFAULT_MAP;
  if (!urlMap)
    try {
      const m = localStorage.getItem('bulwark.map');
      if (m && MAP_DEFS[m]) mapPick = m;
    } catch {
      /* depolama yok */
    }
  if (fromUrl >= 0 && urlMap) return Promise.resolve({ mapId: mapPick, difficulty: fromUrl });
  if (navigator.webdriver && !params.has('intro'))
    return Promise.resolve({
      mapId: urlMap && MAP_DEFS[urlMap] ? urlMap : 'helms_deep',
      difficulty: fromUrl >= 0 ? fromUrl : DEFAULT_DIFFICULTY,
    });
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
        <h1>Bulwark</h1>
        <p>Bir harita seç: <b>Kale Savunması</b> haritalarında kapıları tut ve kaleyi koru; kale düşerse savaş biter.
        <b>Kule Savunması</b> haritalarında düşman yolu izler — sızan her tabur can götürür.</p>
        <div class="maps">
          ${MAP_IDS.map((id) => {
            const m = MAP_DEFS[id];
            if (!m) return '';
            return `<button type="button" data-map="${id}" class="${id === mapPick ? 'sel' : ''}">
              <i class="mode ${m.mode}">${m.mode === 'TD' ? 'Kule Savunması' : 'Kale Savunması'}</i>
              <b>${m.name}</b><span>${m.blurb ?? ''}</span>
              <em>${m.waves.length} dalga${m.mode === 'TD' ? ` · ${m.lives ?? 20} can` : ` · ${m.gates.length} kapı`}</em>
            </button>`;
          }).join('')}
        </div>
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
    let pick = fromUrl >= 0 ? fromUrl : saved;
    root.querySelectorAll<HTMLButtonElement>('.maps button').forEach((b) => {
      b.addEventListener('click', () => {
        mapPick = b.dataset.map ?? mapPick;
        root.querySelectorAll('.maps button').forEach((x) => {
          x.classList.toggle('sel', x === b);
        });
      });
      b.addEventListener('dblclick', () => go());
    });
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
        localStorage.setItem('bulwark.map', mapPick);
      } catch {
        /* depolama yok */
      }
      root.classList.add('out');
      setTimeout(() => root.remove(), 400);
      resolve({ mapId: mapPick, difficulty: pick });
    };
    root.querySelector('.go')?.addEventListener('click', go);
  });
};
