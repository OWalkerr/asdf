import { DEFAULT_DIFFICULTY, DIFFICULTIES, FACTIONS, MAP_DEFS } from '@bulwark/shared';
import { CAMPAIGNS, type Campaign, campaignProgress, takeCampaignTab, takeQueuedMission } from './campaign';
import { bestForMap, starText } from './records';

/**
 * Maç öncesi ekran (GDD §4.4, §11): harita (FD / TD) ve zorluk seçimi. Seçim yapılınca çözülür;
 * harita ve sim seçilen değerlerle kurulur. `?map=…&difficulty=…` ikisi birden verilirse veya
 * otomasyonda (navigator.webdriver; `?intro` ile yine gösterilir) ekran atlanır.
 */
export interface MatchChoice {
  mapId: string;
  difficulty: number;
  /** FACTIONS indeksi (0 Gondor, 1 Rohan, 2 Lórien, 3 Isengard, 4 Mordor). */
  faction: number;
  /** Sefer görevi (yoksa serbest savaş). */
  campaign?: { id: string; index: number };
}

/** Sefer görevi seçimi. */
const missionChoice = (c: Campaign, index: number): MatchChoice => {
  const m = c.missions[index] as Campaign['missions'][number];
  return { mapId: m.mapId, difficulty: m.difficulty, faction: m.faction, campaign: { id: c.id, index } };
};

/** Görev öncesi anlatı ekranı (BFME2 sefer haritası gibi): başlık, hikâye, hedef, taraf ve zorluk. */
const briefing = (c: Campaign, index: number, onStart: () => void, onBack?: () => void): HTMLDivElement => {
  const m = c.missions[index] as Campaign['missions'][number];
  const map = MAP_DEFS[m.mapId];
  const el = document.createElement('div');
  el.className = 'briefing';
  el.innerHTML = `
    <div class="brief-card ${FACTIONS[m.faction]?.evil ? 'evil' : 'good'}">
      <small>${c.name} · Görev ${index + 1} / ${c.missions.length}</small>
      <h2>${m.title}</h2>
      ${m.story.map((p) => `<p>${p}</p>`).join('')}
      <div class="brief-meta">
        <span><i style="background:${FACTIONS[m.faction]?.color.main}"></i>${FACTIONS[m.faction]?.name ?? ''}</span>
        <span>${map?.name ?? m.mapId} · ${map?.mode === 'TD' ? 'Kule Savunması' : 'Kale Savunması'}</span>
        <span>${DIFFICULTIES[m.difficulty]?.name ?? ''}</span>
      </div>
      <p class="goal"><b>Hedef:</b> ${m.goal}</p>
      <div class="brief-actions">
        ${onBack ? '<button type="button" class="back">Geri</button>' : ''}
        <button type="button" class="go">Göreve başla</button>
      </div>
    </div>`;
  el.querySelector('.go')?.addEventListener('click', onStart);
  el.querySelector('.back')?.addEventListener('click', () => onBack?.());
  return el;
};

const MAP_IDS = Object.keys(MAP_DEFS);
const DEFAULT_MAP = MAP_IDS[0] as string;

export const chooseMatch = (): Promise<MatchChoice> => {
  const params = new URLSearchParams(location.search);
  const urlMap = params.get('map');
  const fromUrl = DIFFICULTIES.findIndex((d) => d.key === params.get('difficulty'));
  const urlFaction = FACTIONS.findIndex((f) => f.key === params.get('faction'));
  let faction = urlFaction >= 0 ? urlFaction : 0;
  if (urlFaction < 0)
    try {
      const f = Number(localStorage.getItem('bulwark.faction'));
      if (Number.isInteger(f) && FACTIONS[f]) faction = f;
    } catch {
      /* depolama yok */
    }
  let mapPick = urlMap && MAP_DEFS[urlMap] ? urlMap : DEFAULT_MAP;
  if (!urlMap)
    try {
      const m = localStorage.getItem('bulwark.map');
      if (m && MAP_DEFS[m]) mapPick = m;
    } catch {
      /* depolama yok */
    }
  if (fromUrl >= 0 && urlMap) return Promise.resolve({ mapId: mapPick, difficulty: fromUrl, faction });
  if (navigator.webdriver && !params.has('intro'))
    return Promise.resolve({
      mapId: urlMap && MAP_DEFS[urlMap] ? urlMap : 'helms_deep',
      difficulty: fromUrl >= 0 ? fromUrl : DEFAULT_DIFFICULTY,
      faction,
    });
  // Maç sonu "Sonraki görev": anlatı ekranıyla doğrudan sefer görevine.
  const queued = takeQueuedMission();
  const qc = queued ? CAMPAIGNS.find((c) => c.id === queued.id) : undefined;
  if (queued && qc?.missions[queued.index])
    return new Promise((resolve) => {
      const root = document.createElement('div');
      root.id = 'startscreen';
      const b = briefing(qc, queued.index, () => {
        root.classList.add('out');
        setTimeout(() => root.remove(), 400);
        resolve(missionChoice(qc, queued.index));
      });
      root.appendChild(b);
      document.body.appendChild(root);
    });
  const campaignTab = takeCampaignTab();
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
        <div class="tabs">
          <button type="button" data-tab="skirmish" class="${campaignTab ? '' : 'sel'}">Serbest Savaş</button>
          <button type="button" data-tab="campaign" class="${campaignTab ? 'sel' : ''}">Sefer</button>
        </div>
        <div class="pane campaign ${campaignTab ? 'on' : ''}">
          ${CAMPAIGNS.map((c) => {
            const done = campaignProgress(c.id);
            return `<div class="camp ${c.id}">
              <b>${c.name}</b><span>${c.tagline}</span>
              <ol>${c.missions
                .map((m, i) => {
                  const state = i < done ? 'done' : i === done ? 'open' : 'locked';
                  const rec = bestForMap(m.mapId);
                  return `<li><button type="button" class="${state}" data-c="${c.id}" data-m="${i}" ${state === 'locked' ? 'disabled' : ''}>
                    <i>${i + 1}</i><b>${m.title}</b><em>${FACTIONS[m.faction]?.name ?? ''} · ${MAP_DEFS[m.mapId]?.name ?? ''} · ${DIFFICULTIES[m.difficulty]?.name ?? ''}</em>
                    <span>${state === 'done' ? `✓ ${rec ? starText(rec.stars) : ''}` : state === 'locked' ? '🔒' : 'Yeni'}</span>
                  </button></li>`;
                })
                .join('')}</ol>
              <small>${done} / ${c.missions.length} görev</small>
            </div>`;
          }).join('')}
        </div>
        <div class="pane skirmish ${campaignTab ? '' : 'on'}">
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
              ${(() => {
                const r = bestForMap(id);
                return r
                  ? `<i class="rec"><b>${starText(r.stars)}</b> ${r.score.toLocaleString('tr-TR')}${r.victory ? '' : ` · dalga ${r.wave}`}</i>`
                  : '';
              })()}
            </button>`;
          }).join('')}
        </div>
        <div class="factions">
          ${FACTIONS.map(
            (f, i) => `<button type="button" data-f="${i}" class="${f.key} ${i === faction ? 'sel' : ''}">
              <i style="background:${f.color.main}"></i><b>${f.name}</b><span>${f.desc}</span>
            </button>`,
          ).join('')}
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
        </div>
        <p class="keys">Sol tık: seç · Sağ tık: yürü/saldır · WASD/Q/E: kamera · F/G/J: kahramanlar · P: duraklat · 1–0: güçler · M: ses · F7/F8: müzik / birim sesleri</p>
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
    root.querySelectorAll<HTMLButtonElement>('.factions button').forEach((b) => {
      b.addEventListener('click', () => {
        faction = Number(b.dataset.f);
        root.querySelectorAll('.factions button').forEach((x) => {
          x.classList.toggle('sel', x === b);
        });
      });
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
    // Sekmeler ve sefer görevleri.
    root.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((b) => {
      b.addEventListener('click', () => {
        root.querySelectorAll('.tabs button').forEach((x) => {
          x.classList.toggle('sel', x === b);
        });
        root.querySelectorAll('.pane').forEach((p) => {
          p.classList.toggle('on', p.classList.contains(b.dataset.tab ?? ''));
        });
      });
    });
    root.querySelectorAll<HTMLButtonElement>('.camp button').forEach((b) => {
      b.addEventListener('click', () => {
        const c = CAMPAIGNS.find((x) => x.id === b.dataset.c);
        const i = Number(b.dataset.m);
        if (!c || !c.missions[i]) return;
        const brief = briefing(
          c,
          i,
          () => {
            root.classList.add('out');
            setTimeout(() => root.remove(), 400);
            resolve(missionChoice(c, i));
          },
          () => brief.remove(),
        );
        root.appendChild(brief);
      });
    });
    const go = () => {
      try {
        localStorage.setItem('bulwark.difficulty', String(pick));
        localStorage.setItem('bulwark.map', mapPick);
        localStorage.setItem('bulwark.faction', String(faction));
      } catch {
        /* depolama yok */
      }
      root.classList.add('out');
      setTimeout(() => root.remove(), 400);
      resolve({ mapId: mapPick, difficulty: pick, faction });
    };
    root.querySelector('.go')?.addEventListener('click', go);
  });
};
