import {
  AI_LEVELS,
  CAH_CLASSES,
  DEFAULT_DIFFICULTY,
  DIFFICULTIES,
  FACTIONS,
  MAP_DEFS,
  type MapDef,
  type VersusSetup,
} from '@bulwark/shared';
import type { NetStart } from '../net/NetSession';
import type { NamedRoom } from '../net/room';
import { getQuality, QUALITY_NAMES, type Quality, setQuality } from '../render/quality';
import { loadCah, saveCah } from './cah';
import { CAMPAIGNS, type Campaign, campaignProgress, takeCampaignTab, takeQueuedMission } from './campaign';
import { mountLobby } from './Lobby';
import { fitSlots, resolveSetup, type SetupState, SkirmishSetup } from './menu/SkirmishSetup';
import { bestForMap, starText } from './records';
import { loadSettings, saveSettings } from './settings';

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
  /** Kahraman Yarat sınıfı ve adı (serbest savaş). */
  cah?: number;
  cahName?: string;
  /**
   * Çatışma (VS): kurulum, yerel oyuncunun takımı, takım başına renk (PLAYER_COLORS) ve ad.
   */
  versus?: { setup: VersusSetup; me: number; colors: number[]; names: string[] };
  /** Çok oyunculu ortak savunma (lobi başlattı). */
  net?: { room: NamedRoom; start: NetStart };
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
  const cahPick = () => {
    const c = loadCah();
    return c.on ? { cah: c.cls, cahName: c.name } : {};
  };
  // `?vs=<harita>`: doğrudan çatışma (sen + bilgisayar rakipler; test ve hızlı oyun).
  const vsMap = params.get('vs');
  if (vsMap && MAP_DEFS[vsMap]?.mode === 'VS') {
    const n = MAP_DEFS[vsMap]?.starts?.length ?? 2;
    const ai = Math.max(
      0,
      AI_LEVELS.findIndex((a) => a.key === params.get('ai')),
    );
    const slots = Array.from({ length: n }, (_, t) => ({
      team: t,
      faction: t === 0 ? faction : ([4, 3, 5, 1][t - 1] ?? 4),
      alliance: -1,
      ai: t === 0 ? -1 : ai,
      start: t,
    }));
    return Promise.resolve({
      mapId: vsMap,
      difficulty: 1,
      faction,
      versus: {
        setup: { slots, humans: [0], startGold: 2000, cpLimit: 1000 },
        me: 0,
        colors: slots.map((_, t) => t),
        names: slots.map((_, t) => (t === 0 ? 'Sen' : `Bilgisayar ${t}`)),
      },
    });
  }
  if (fromUrl >= 0 && urlMap)
    return Promise.resolve({ mapId: mapPick, difficulty: fromUrl, faction, ...cahPick() });
  if (navigator.webdriver && !params.has('intro'))
    return Promise.resolve({
      mapId: urlMap && MAP_DEFS[urlMap] ? urlMap : 'helms_deep',
      difficulty: fromUrl >= 0 ? fromUrl : DEFAULT_DIFFICULTY,
      faction,
      ...cahPick(),
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
  return showMainMenu({
    campaignTab,
    mapPick,
    faction,
    difficulty: fromUrl >= 0 ? fromUrl : saved,
    tab: params.get('tab'),
  });
};

const esc = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );

/**
 * Ana menü (BFME2 düzeni): solda oyun adı, sağda dikey taş düğmeler. Tek Oyunculu → Sefer,
 * Çatışma (bilgisayara karşı), Savunma Haritaları; Çok Oyunculu → çevrimiçi lobi; Kahraman Yarat;
 * Seçenekler (grafik, ses, oyun); Jenerik. Alt ekranlar aynı arka plan üstünde açılır, "Geri" ile
 * bir önceki ekrana dönülür.
 */
const showMainMenu = (init: {
  campaignTab: boolean;
  mapPick: string;
  faction: number;
  difficulty: number;
  tab: string | null;
}): Promise<MatchChoice> =>
  new Promise((resolve) => {
    const root = document.createElement('div');
    root.id = 'startscreen';
    root.className = 'mainmenu';
    root.innerHTML = `
      <div class="mm-bg"><i class="mm-sun"></i><i class="mm-hills far"></i><i class="mm-hills near"></i><i class="mm-tower"></i><i class="mm-embers"></i></div>
      <div class="mm-logo"><small>Orta Dünya Savaşları</small><h1>Bulwark</h1><span>Kale ve Çatışma</span></div>
      <div class="mm-stage"></div>
      <div class="mm-version">Sürüm 2.0 · tarayıcıda çalışır</div>`;
    document.body.appendChild(root);
    const stage = root.querySelector('.mm-stage') as HTMLDivElement;
    const finish = (c: MatchChoice) => {
      root.classList.add('out');
      setTimeout(() => root.remove(), 400);
      resolve(c);
    };
    const stack: (() => void)[] = [];
    const show = (render: () => void, push = true) => {
      if (push) stack.push(render);
      stage.innerHTML = '';
      stage.className = 'mm-stage';
      render();
    };
    const back = () => {
      stack.pop();
      const prev = stack[stack.length - 1];
      if (prev) show(prev, false);
    };
    const menu = (title: string, items: [string, string, () => void][], withBack: boolean) => {
      stage.classList.add('column');
      stage.innerHTML = `<div class="mm-menu">${title ? `<h2>${title}</h2>` : ''}${items
        .map(
          ([label, desc], i) =>
            `<button type="button" class="mm-btn" data-i="${i}"><b>${label}</b><span>${desc}</span></button>`,
        )
        .join('')}${withBack ? '<button type="button" class="mm-btn back"><b>Geri</b></button>' : ''}</div>`;
      stage.querySelectorAll<HTMLButtonElement>('.mm-btn').forEach((b) =>
        b.addEventListener('click', () => {
          if (b.classList.contains('back')) back();
          else items[Number(b.dataset.i)]?.[2]();
        }),
      );
    };

    // --- Ana ekran --------------------------------------------------------------------
    const main = () =>
      menu(
        '',
        [
          ['Tek Oyunculu', 'Sefer, bilgisayara karşı çatışma, savunma haritaları', () => show(solo)],
          [
            'Çok Oyunculu',
            'Çevrimiçi lobi: oyun kur, katıl, arkadaşlarına karşı ya da birlikte',
            () => show(multi),
          ],
          ['Kahraman Yarat', 'Kendi kahramanını yarat', () => show(cah)],
          ['Seçenekler', 'Grafik, ses ve oyun ayarları', () => show(options)],
          ['Jenerik', 'Yapımcılar', () => show(credits)],
        ],
        false,
      );
    const solo = () =>
      menu(
        'Tek Oyunculu',
        [
          ['Sefer', 'İyi ve kötü seferlerin görevleri', () => show(campaign)],
          ['Çatışma', 'Bilgisayar rakiplere karşı (BFME2 Skirmish)', () => show(skirmish)],
          ['Savunma Haritaları', 'Kale ve kule savunması: dalgaları püskürt', () => show(defense)],
        ],
        true,
      );

    // --- Sefer -------------------------------------------------------------------------
    const campaign = () => {
      stage.innerHTML = `<div class="menu-screen"><h2 class="menu-title">Sefer</h2><div class="campaigns">${CAMPAIGNS.map(
        (c) => {
          const done = campaignProgress(c.id);
          return `<div class="camp ${c.id}"><b>${c.name}</b><span>${c.tagline}</span><ol>${c.missions
            .map((m, i) => {
              const state = i < done ? 'done' : i === done ? 'open' : 'locked';
              const rec = bestForMap(m.mapId);
              return `<li><button type="button" class="${state}" data-c="${c.id}" data-m="${i}" ${state === 'locked' ? 'disabled' : ''}>
                <i>${i + 1}</i><b>${m.title}</b><em>${FACTIONS[m.faction]?.name ?? ''} · ${MAP_DEFS[m.mapId]?.name ?? ''} · ${DIFFICULTIES[m.difficulty]?.name ?? ''}</em>
                <span>${state === 'done' ? `✓ ${rec ? starText(rec.stars) : ''}` : state === 'locked' ? '🔒' : 'Yeni'}</span></button></li>`;
            })
            .join('')}</ol><small>${done} / ${c.missions.length} görev</small></div>`;
        },
      ).join(
        '',
      )}</div><div class="menu-actions"><button type="button" class="mbtn back">Geri</button></div></div>`;
      stage.querySelector('.back')?.addEventListener('click', back);
      stage.querySelectorAll<HTMLButtonElement>('.camp button').forEach((b) =>
        b.addEventListener('click', () => {
          const c = CAMPAIGNS.find((x) => x.id === b.dataset.c);
          const i = Number(b.dataset.m);
          if (!c || !c.missions[i]) return;
          const brief = briefing(
            c,
            i,
            () => finish(missionChoice(c, i)),
            () => brief.remove(),
          );
          root.appendChild(brief);
        }),
      );
    };

    // --- Çatışma (bilgisayara karşı) ----------------------------------------------------
    const vsMaps = Object.values(MAP_DEFS).filter((m) => m.mode === 'VS');
    const skirmish = () => {
      const def = vsMaps[0] as MapDef;
      const settings = loadSettings();
      let state: SetupState = {
        mapId: def.id,
        gold: 2000,
        cp: 1000,
        diff: 1,
        slots: [
          {
            kind: 'human',
            name: settings.nick || 'Sen',
            ai: 1,
            faction: init.faction,
            color: 0,
            team: -1,
            start: -1,
          },
        ],
      };
      state.slots = fitSlots(state, def, 'ai');
      const setup = new SkirmishSetup({
        title: 'Çatışma',
        state,
        maps: vsMaps,
        mySlot: 0,
        allowOpen: false,
        canEditSlot: () => true,
        canEditSettings: true,
        onChange: (s) => {
          state = s;
        },
        startEnabled: (s) => s.slots.filter((sl) => sl.kind === 'ai').length > 0,
        onStart: () => {
          const r = resolveSetup(state, [0]);
          const me = r.teamOfSlot[0] as number;
          finish({
            mapId: state.mapId,
            difficulty: 1,
            faction: r.setup.slots.find((x) => x.team === me)?.faction ?? 0,
            versus: { setup: r.setup, me, colors: r.colors, names: r.names },
          });
        },
        onBack: back,
      });
      stage.appendChild(setup.el);
    };

    // --- Savunma haritaları (eski serbest savaş) ----------------------------------------
    const defense = () => {
      let mapPick = MAP_DEFS[init.mapPick]?.mode === 'VS' ? 'fortress_defence' : init.mapPick;
      let faction = init.faction;
      let pick = init.difficulty;
      const ids = Object.keys(MAP_DEFS).filter((id) => MAP_DEFS[id]?.mode !== 'VS');
      stage.innerHTML = `<div class="menu-screen defense"><h2 class="menu-title">Savunma Haritaları</h2>
        <p class="lead"><b>Kale Savunması</b>: kapıları tut, kaleyi koru; kale düşerse savaş biter. <b>Kule Savunması</b>: düşman yolu izler, sızan her tabur can götürür.</p>
        <div class="maps">${ids
          .map((id) => {
            const m = MAP_DEFS[id] as MapDef;
            const r = bestForMap(id);
            return `<button type="button" data-map="${id}" class="${id === mapPick ? 'sel' : ''}">
              <i class="mode ${m.mode}">${m.mode === 'TD' ? 'Kule Savunması' : 'Kale Savunması'}</i>
              <b>${m.name}</b><span>${m.blurb ?? ''}</span>
              <em>${m.waves.length} dalga${m.mode === 'TD' ? ` · ${m.lives ?? 20} can` : ` · ${m.gates.length} kapı`}</em>
              ${r ? `<i class="rec"><b>${starText(r.stars)}</b> ${r.score.toLocaleString('tr-TR')}</i>` : ''}
            </button>`;
          })
          .join('')}</div>
        <div class="factions">${FACTIONS.map(
          (f, i) => `<button type="button" data-f="${i}" class="${f.key} ${i === faction ? 'sel' : ''}">
            <i style="background:${f.color.main}"></i><b>${f.name}</b><span>${f.desc}</span></button>`,
        ).join('')}</div>
        <div class="diffs">${DIFFICULTIES.map(
          (d, i) => `<button type="button" data-i="${i}" class="${i === pick ? 'sel' : ''}">
            <b>${d.name}</b><span>${d.desc}</span><em>Düşman canı %${d.enemyHpPercent} · dalga %${d.waveSizePercent} · ◆${d.startGold}</em></button>`,
        ).join('')}</div>
        <div class="menu-actions"><button type="button" class="mbtn back">Geri</button><button type="button" class="mbtn primary go">Savunmayı Başlat</button></div></div>`;
      const sel = (cls: string, b: HTMLButtonElement) =>
        stage.querySelectorAll(`.${cls} button`).forEach((x) => {
          x.classList.toggle('sel', x === b);
        });
      const go = () => {
        try {
          localStorage.setItem('bulwark.difficulty', String(pick));
          localStorage.setItem('bulwark.map', mapPick);
          localStorage.setItem('bulwark.faction', String(faction));
        } catch {
          /* depolama yok */
        }
        const c = loadCah();
        finish({
          mapId: mapPick,
          difficulty: pick,
          faction,
          ...(c.on ? { cah: c.cls, cahName: c.name } : {}),
        });
      };
      stage.querySelectorAll<HTMLButtonElement>('.maps button').forEach((b) => {
        b.addEventListener('click', () => {
          mapPick = b.dataset.map ?? mapPick;
          sel('maps', b);
        });
        b.addEventListener('dblclick', go);
      });
      stage.querySelectorAll<HTMLButtonElement>('.factions button').forEach((b) =>
        b.addEventListener('click', () => {
          faction = Number(b.dataset.f);
          sel('factions', b);
        }),
      );
      stage.querySelectorAll<HTMLButtonElement>('.diffs button').forEach((b) =>
        b.addEventListener('click', () => {
          pick = Number(b.dataset.i);
          sel('diffs', b);
        }),
      );
      stage.querySelector('.go')?.addEventListener('click', go);
      stage.querySelector('.back')?.addEventListener('click', back);
    };

    // --- Çok oyunculu -------------------------------------------------------------------
    const multi = () => mountLobby(stage, (c) => finish(c), back);

    // --- Kahraman Yarat -----------------------------------------------------------------
    const cah = () => {
      const c = loadCah();
      stage.innerHTML = `<div class="menu-screen cah-screen"><h2 class="menu-title">Kahraman Yarat</h2>
        <div class="frame cah ${c.on ? 'on' : ''}">
          <label class="cah-toggle"><input type="checkbox" class="cah-on" ${c.on ? 'checked' : ''}> <b>Kahramanımı savunma maçlarında kullan</b></label>
          <label>Adı <input class="cah-name" maxlength="24" placeholder="Kahramanının adı" value="${esc(c.name)}"></label>
          <div class="cah-cls">${CAH_CLASSES.map(
            (k, i) =>
              `<button type="button" data-c="${i}" class="${i === c.cls ? 'sel' : ''}"><b>${k.name}</b><span>${k.desc}</span></button>`,
          ).join('')}</div>
          <small>Kahramanın tarafının 3. kahramanının (J) yerini alır: 10 seviye, 4 yetenek.</small>
        </div>
        <div class="menu-actions"><button type="button" class="mbtn back">Geri</button></div></div>`;
      const box = stage.querySelector('.cah') as HTMLDivElement;
      stage.querySelector<HTMLInputElement>('.cah-on')?.addEventListener('change', (e) => {
        c.on = (e.target as HTMLInputElement).checked;
        box.classList.toggle('on', c.on);
        saveCah(c);
      });
      stage.querySelector<HTMLInputElement>('.cah-name')?.addEventListener('input', (e) => {
        c.name = (e.target as HTMLInputElement).value.slice(0, 24);
        saveCah(c);
      });
      stage.querySelectorAll<HTMLButtonElement>('.cah-cls button').forEach((b) =>
        b.addEventListener('click', () => {
          c.cls = Number(b.dataset.c);
          stage.querySelectorAll('.cah-cls button').forEach((x) => {
            x.classList.toggle('sel', x === b);
          });
          saveCah(c);
        }),
      );
      stage.querySelector('.back')?.addEventListener('click', back);
    };

    // --- Seçenekler ---------------------------------------------------------------------
    const options = () => {
      const st = loadSettings();
      const q = getQuality();
      stage.innerHTML = `<div class="menu-screen options"><h2 class="menu-title">Seçenekler</h2>
        <div class="opt-grid">
          <div class="frame"><h3>Görüntü</h3>
            <div class="quality">${(['low', 'medium', 'high'] as const)
              .map(
                (k) =>
                  `<button type="button" data-q="${k}" class="${k === q ? 'sel' : ''}">${QUALITY_NAMES[k]}</button>`,
              )
              .join('')}</div>
            <p class="dim">Kasma olursa Düşük ya da Orta seç (piksel oranı, gölgeler, kenar yumuşatma).</p></div>
          <div class="frame"><h3>Ses</h3>
            <label>Müzik <input type="range" min="0" max="100" data-k="music" value="${st.music}"></label>
            <label>Efektler <input type="range" min="0" max="100" data-k="sfx" value="${st.sfx}"></label>
            <label class="check"><input type="checkbox" data-k="voices" ${st.voices ? 'checked' : ''}> Birim konuşmaları</label></div>
          <div class="frame"><h3>Oyun</h3>
            <label>Kaydırma hızı <input type="range" min="50" max="200" data-k="scroll" value="${Math.round(st.scroll * 100)}"></label>
            <label>Oyuncu adı <input class="nick" maxlength="20" data-k="nick" value="${esc(st.nick)}"></label></div>
          <div class="frame keys"><h3>Tuşlar</h3>
            <p>Sol tık: seç · Sağ tık: yürü / saldır · WASD, Q/E: kamera · F/G/J: kahramanlar · K: kale · 1–0, -, =: güçler · P: duraklat · M: ses · F7/F8: müzik / birim sesleri</p></div>
        </div>
        <div class="menu-actions"><button type="button" class="mbtn back">Geri</button></div></div>`;
      stage.querySelectorAll<HTMLButtonElement>('.quality button').forEach((b) =>
        b.addEventListener('click', () => {
          setQuality(b.dataset.q as Quality);
          stage.querySelectorAll('.quality button').forEach((x) => {
            x.classList.toggle('sel', x === b);
          });
        }),
      );
      stage.addEventListener('input', (e) => {
        const t = e.target as HTMLInputElement;
        const k = t.dataset.k;
        if (k === 'music' || k === 'sfx') st[k] = Number(t.value);
        else if (k === 'scroll') st.scroll = Number(t.value) / 100;
        else if (k === 'voices') st.voices = t.checked;
        else if (k === 'nick') st.nick = t.value.trim().slice(0, 20);
        saveSettings(st);
      });
      stage.querySelector('.back')?.addEventListener('click', back);
    };

    const credits = () => {
      stage.innerHTML = `<div class="menu-screen credits"><h2 class="menu-title">Jenerik</h2>
        <div class="frame"><p><b>Bulwark</b> — The Battle for Middle-earth II'den esinlenen, tarayıcıda çalışan low-poly
        kale savunması ve çatışma oyunu.</p><p>Three.js (WebGPU) · TypeScript · bitECS · deterministik lockstep simülasyon.</p>
        <p>Modeller, sesler ve müzik kodla üretilmiştir. Orta Dünya J. R. R. Tolkien'in eseridir; bu bir hayran projesidir.</p></div>
        <div class="menu-actions"><button type="button" class="mbtn back">Geri</button></div></div>`;
      stage.querySelector('.back')?.addEventListener('click', back);
    };

    show(main);
    if (init.campaignTab) {
      show(solo);
      show(campaign);
    } else if (init.tab === 'multi') show(multi);
    else if (init.tab === 'skirmish') {
      show(solo);
      show(skirmish);
    }
  });
