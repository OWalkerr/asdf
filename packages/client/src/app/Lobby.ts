import { FACTIONS, MAP_DEFS, type MapDef, type VersusSetup } from '@bulwark/shared';
import type { NetStart } from '../net/NetSession';
import { getLobby, type Lobby as LobbyRoom, type NamedRoom, type Peer, selfPeer } from '../net/room';
import { fitSlots, resolveSetup, type SetupSlot, type SetupState, SkirmishSetup } from './menu/SkirmishSetup';
import { loadSettings, saveSettings } from './settings';

/**
 * Çevrimiçi lobi (BFME2 çok oyunculu lobisi): solda açık oyunlar tablosu, sağda lobidekiler ve
 * sohbet; "Oyun Kur" ile oyun odası açılır. Oda = çatışma kurulum ekranı: kurucu harita, ayarlar ve
 * bilgisayar yuvalarını yönetir; her oyuncu kendi satırını (ordu, renk, takım, konum) ve "Hazır"ı
 * seçer. Bütün durum oda presence'ında taşınır: kurucunun `cfg`'si yetkilidir, oyuncular `row`
 * önerir, kurucu birleştirir. Başlatma (`start`) çözülmüş kurulumu ve oyuncu sırasını içerir.
 */
export interface NetChoice {
  mapId: string;
  difficulty: number;
  faction: number;
  versus?: { setup: VersusSetup; me: number; colors: number[]; names: string[] };
  net: { room: NamedRoom; start: NetStart };
}

interface GameAd {
  code: string;
  name: string;
  map: string;
  n: number;
  max: number;
  started: boolean;
}

interface RowReq {
  faction: number;
  color: number;
  team: number;
  start: number;
}

const esc = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );

const nickOf = (p: Peer): string => {
  const n = p.presence.nick;
  return typeof n === 'string' && n.trim() ? n.trim().slice(0, 20) : 'Adsız';
};

const adOf = (p: Peer): GameAd | null => {
  const g = p.presence.game as Partial<GameAd> | undefined;
  if (!g || typeof g.code !== 'string' || !/^[a-z0-9]{5}$/.test(g.code)) return null;
  if (typeof g.map !== 'string' || !MAP_DEFS[g.map]) return null;
  return {
    code: g.code,
    name: typeof g.name === 'string' ? g.name.slice(0, 32) : 'Oyun',
    map: g.map,
    n: Number(g.n) || 1,
    max: Number(g.max) || 4,
    started: g.started === true,
  };
};

const randomCode = (): string => {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
};

const ALL_MAPS = Object.values(MAP_DEFS);
const DEFAULT_MAP = (ALL_MAPS.find((m) => m.mode === 'VS') ?? ALL_MAPS[0]) as MapDef;

const emptySlot = (kind: SetupSlot['kind']): SetupSlot => ({
  kind,
  name: '',
  ai: 1,
  faction: -1,
  color: -1,
  team: -1,
  start: -1,
});

/** Geçerli bir cfg (kurucunun presence'ı) mi; değilse null. */
const cfgOf = (p: Peer | undefined): SetupState | null => {
  const c = p?.presence.cfg as Partial<SetupState> | undefined;
  if (!c || typeof c.mapId !== 'string' || !MAP_DEFS[c.mapId] || !Array.isArray(c.slots)) return null;
  return {
    mapId: c.mapId,
    gold: Number(c.gold) || 2000,
    cp: Number(c.cp) || 1000,
    diff: Number(c.diff) || 1,
    slots: (c.slots as SetupSlot[]).slice(0, 8).map((s) => ({
      kind: (['human', 'ai', 'open', 'closed'] as const).includes(s.kind) ? s.kind : 'closed',
      name: typeof s.name === 'string' ? s.name.slice(0, 20) : '',
      peer: typeof s.peer === 'string' ? s.peer : undefined,
      ai: Number(s.ai) || 0,
      faction: Number.isInteger(s.faction) ? s.faction : -1,
      color: Number.isInteger(s.color) ? s.color : -1,
      team: Number.isInteger(s.team) ? s.team : -1,
      start: Number.isInteger(s.start) ? s.start : -1,
      ready: s.ready === true,
    })),
  };
};

/** Lobi ekranını `host` içine kurar; maç başlayınca `onStart`, geri dönünce `onBack`. */
export const mountLobby = (host: HTMLElement, onStart: (c: NetChoice) => void, onBack: () => void): void => {
  const settings = loadSettings();
  let nick = settings.nick || `Savunucu${Math.floor(Math.random() * 900 + 100)}`;
  let lobby: LobbyRoom | null = null;
  const chat: { who: string; text: string; at: number }[] = [];
  const seenSay = new Map<string, number>();
  let started = false;
  /** Kurucu başlattı (lobi ilanında "Oyunda"). */
  let adStarted = false;
  let room: {
    r: NamedRoom;
    code: string;
    hostPeer: string;
    isHost: boolean;
    sawHost: boolean;
    unsub: () => void;
    setup: SkirmishSetup | null;
    cfg: SetupState | null;
  } | null = null;

  const screen = document.createElement('div');
  screen.className = 'menu-screen online-lobby';
  host.appendChild(screen);
  screen.innerHTML = '<h2 class="menu-title">Çevrimiçi</h2><p class="net-msg">Lobiye bağlanılıyor…</p>';

  // --- Lobi (oyun listesi + sohbet) ------------------------------------------------------
  const renderLobby = () => {
    if (!lobby || room) return;
    const me = selfPeer(lobby);
    const peers = lobby.peers();
    const ads = peers.flatMap((p) => {
      const ad = adOf(p);
      return ad ? [{ p, ad }] : [];
    });
    const rows =
      ads.length === 0
        ? '<tr class="empty"><td colspan="4">Açık oyun yok — ilk oyunu sen kur.</td></tr>'
        : ads
            .map(
              ({ p, ad }) =>
                `<tr class="game ${ad.started || ad.n >= ad.max ? 'full' : ''}" data-peer="${esc(p.peer)}"><td>${esc(ad.name)}</td><td>${esc(MAP_DEFS[ad.map]?.name ?? '')}</td><td>${ad.n} / ${ad.max}</td><td>${ad.started ? 'Oyunda' : p.peer === me ? 'Senin' : 'Bekliyor'}</td></tr>`,
            )
            .join('');
    const list = screen.querySelector('.games tbody');
    if (list) {
      if (list.innerHTML !== rows) list.innerHTML = rows;
      const who = screen.querySelector('.who');
      if (who)
        who.innerHTML = peers
          .map((p) => `<li>${esc(nickOf(p))}${p.sameTab ? ' <em>(sen)</em>' : ''}</li>`)
          .join('');
      renderChat();
      return;
    }
    screen.innerHTML = `
      <h2 class="menu-title">Çevrimiçi Lobi</h2>
      <div class="lobby-grid">
        <div class="frame">
          <h3>Oyunlar</h3>
          <table class="games"><thead><tr><th>Oyun</th><th>Harita</th><th>Oyuncular</th><th>Durum</th></tr></thead><tbody>${rows}</tbody></table>
        </div>
        <div class="frame side">
          <label class="nickrow">Adın <input class="nick" maxlength="20" value="${esc(nick)}"></label>
          <h3>Lobidekiler</h3>
          <ul class="who"></ul>
          <h3>Sohbet</h3>
          <div class="chatlog"></div>
          <input class="say" maxlength="120" placeholder="Mesaj yaz, Enter">
        </div>
      </div>
      <div class="menu-actions">
        <button type="button" class="mbtn back">Geri</button>
        <span class="net-msg">Bu sayfayı açan herkes lobidedir. Arkadaşlarını davet etmek için sayfayı paylaş.</span>
        <button type="button" class="mbtn primary host">Oyun Kur</button>
      </div>`;
    renderLobby();
  };

  const renderChat = () => {
    const log = screen.querySelector('.chatlog');
    if (!log) return;
    const html = chat
      .slice(-40)
      .map((m) => `<p><b>${esc(m.who)}:</b> ${esc(m.text)}</p>`)
      .join('');
    if (log.innerHTML !== html) {
      log.innerHTML = html;
      log.scrollTop = log.scrollHeight;
    }
  };

  /** Sohbet: her oyuncunun presence'ındaki son mesaj (zaman damgalı); yenileri günlüğe eklenir. */
  const collectChat = (peers: readonly Peer[]) => {
    for (const p of peers) {
      const say = p.presence.say as { t?: unknown; text?: unknown } | undefined;
      if (!say || typeof say.t !== 'number' || typeof say.text !== 'string') continue;
      if ((seenSay.get(p.peer) ?? 0) >= say.t) continue;
      seenSay.set(p.peer, say.t);
      chat.push({ who: nickOf(p), text: say.text.slice(0, 120), at: say.t });
    }
    chat.sort((a, b) => a.at - b.at);
  };

  screen.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.classList.contains('nick')) {
      nick = t.value.trim().slice(0, 20) || nick;
      saveSettings({ ...loadSettings(), nick });
      void lobby?.presence({ nick });
    }
  });
  screen.addEventListener('keydown', (e) => {
    const t = e.target as HTMLInputElement;
    if (e.key === 'Enter' && t.classList.contains('say') && t.value.trim()) {
      void lobby?.presence({ say: { t: Date.now(), text: t.value.trim().slice(0, 120) } });
      t.value = '';
    }
  });
  screen.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    if (el.closest('.back') && !room) {
      screen.remove();
      onBack();
      return;
    }
    if (el.closest('.host')) {
      void enter(randomCode(), null);
      return;
    }
    const row = el.closest<HTMLTableRowElement>('tr.game');
    if (row && !row.classList.contains('full')) {
      const p = lobby?.peers().find((x) => x.peer === row.dataset.peer);
      const ad = p ? adOf(p) : null;
      if (p && ad && !p.sameTab) void enter(ad.code, p);
    }
  });

  // --- Oyun odası -------------------------------------------------------------------------
  let lastCfg = '';
  let lastAd = '';
  const advertise = () => {
    if (!room?.isHost || !room.cfg) return;
    const s = room.cfg;
    const n = s.slots.filter((x) => x.kind === 'human').length;
    const max = s.slots.filter((x) => x.kind === 'human' || x.kind === 'open').length;
    const game = { code: room.code, name: `${nick} oyunu`, map: s.mapId, n, max, started: adStarted };
    const json = JSON.stringify(game);
    if (json === lastAd) return;
    lastAd = json;
    void lobby?.presence({ nick, game });
  };

  const enter = async (code: string, hostPeer: Peer | null) => {
    if (!lobby) return;
    screen.innerHTML = '<h2 class="menu-title">Oyun Odası</h2><p class="net-msg">Odaya giriliyor…</p>';
    let r: NamedRoom;
    try {
      r = await lobby.join(`bw-${code}`);
    } catch {
      screen.innerHTML = '<h2 class="menu-title">Oyun Odası</h2><p class="net-msg">Odaya girilemedi.</p>';
      setTimeout(() => {
        screen.innerHTML = '';
        renderLobby();
      }, 2000);
      return;
    }
    const me = selfPeer(lobby) ?? '';
    const isHost = hostPeer === null;
    room = {
      r,
      code,
      hostPeer: isHost ? me : (hostPeer?.peer ?? ''),
      isHost,
      sawHost: isHost,
      unsub: () => {},
      setup: null,
      cfg: null,
    };
    if (isHost) {
      // Kurucu: kendisi 1. yuva, ikinci yuva açık (VS haritasında), kalanı kapalı.
      const base: SetupState = {
        mapId: DEFAULT_MAP.id,
        gold: 2000,
        cp: 1000,
        diff: 1,
        slots: [{ ...emptySlot('human'), name: nick, peer: me, faction: 0, ready: true }],
      };
      base.slots = fitSlots(base, DEFAULT_MAP, 'open');
      room.cfg = base;
    }
    await r.presence({ nick, at: Date.now(), row: null, ready: isHost });
    room.unsub = r.onPeers(() => syncRoom());
    syncRoom();
  };

  const leaveRoom = () => {
    if (!room) return;
    room.unsub();
    void room.r.leave();
    room = null;
    lastCfg = '';
    lastAd = '';
    shownCfg = '';
    screen.classList.remove('bare');
    void lobby?.presence({ game: null });
    screen.innerHTML = '';
    renderLobby();
  };

  /** Kurucu: odadaki oyuncuları yuvalara yerleştir, satır isteklerini birleştir, cfg'yi yayınla. */
  const hostMerge = () => {
    if (!room?.cfg) return;
    const s = room.cfg;
    const peers = room.r.peers().filter((p) => typeof p.presence.nick === 'string');
    const here = new Set(peers.map((p) => p.peer));
    // Ayrılanların yuvası açılır.
    for (const sl of s.slots)
      if (sl.kind === 'human' && sl.peer && sl.peer !== room.hostPeer && !here.has(sl.peer))
        Object.assign(sl, emptySlot('open'));
    // Yeni gelenler ilk açık yuvaya.
    for (const p of peers.sort((a, b) => Number(a.presence.at) - Number(b.presence.at))) {
      if (s.slots.some((sl) => sl.peer === p.peer)) continue;
      const open = s.slots.find((sl) => sl.kind === 'open');
      if (!open) continue;
      Object.assign(open, emptySlot('human'), { name: nickOf(p), peer: p.peer });
    }
    // Satır istekleri (ordu, renk, takım, konum) ve hazır.
    for (const sl of s.slots) {
      if (sl.kind !== 'human' || !sl.peer) continue;
      const p = peers.find((x) => x.peer === sl.peer);
      if (!p) continue;
      sl.name = nickOf(p);
      if (p.peer === room.hostPeer) {
        sl.ready = true;
        continue;
      }
      sl.ready = p.presence.ready === true;
      const req = p.presence.row as Partial<RowReq> | null | undefined;
      if (!req) continue;
      const take = (k: keyof RowReq, max: number) => {
        const v = Number(req[k]);
        if (!Number.isInteger(v) || v < -1 || v >= max) return;
        if ((k === 'start' || k === 'color') && v >= 0 && s.slots.some((o) => o !== sl && o[k] === v)) return;
        sl[k] = v;
      };
      take('faction', FACTIONS.length);
      take('color', 8);
      take('team', 4);
      take('start', 8);
    }
    // Yalnızca değişince yayınla (her presence güncellemesi yeniden birleştirme tetikler).
    const json = JSON.stringify(s);
    if (json !== lastCfg) {
      lastCfg = json;
      void room.r.presence({ cfg: JSON.parse(json) as Record<string, unknown> });
    }
    advertise();
  };

  let shownCfg = '';
  const syncRoom = () => {
    if (!room || !lobby || started) return;
    const g = room;
    const me = selfPeer(lobby) ?? '';
    const hostP = g.r.peers().find((p) => p.peer === g.hostPeer);
    if (hostP) g.sawHost = true;
    else if (g.sawHost && !g.isHost) {
      screen.innerHTML =
        '<h2 class="menu-title">Oyun Odası</h2><p class="net-msg">Kurucu oyundan ayrıldı.</p>';
      setTimeout(leaveRoom, 1800);
      return;
    }
    // Başlatıldı mı?
    const st = hostP?.presence.start as StartMsg | undefined;
    if (st && Array.isArray(st.order) && MAP_DEFS[st.map]) {
      begin(st, me);
      return;
    }
    if (g.isHost) hostMerge();
    else g.cfg = cfgOf(hostP) ?? g.cfg;
    if (!g.cfg) return;
    const mySlot = g.cfg.slots.findIndex((sl) => sl.peer === me);
    if (!g.setup) {
      g.setup = new SkirmishSetup({
        title: `Oyun Odası · ${g.code}`,
        state: structuredClone(g.cfg),
        maps: ALL_MAPS,
        mySlot,
        allowOpen: true,
        canEditSettings: g.isHost,
        canEditSlot: (i) => i === (room?.cfg?.slots.findIndex((sl) => sl.peer === me) ?? -1),
        onChange: (s) => {
          if (!room) return;
          const mine = s.slots.find((sl) => sl.peer === me);
          if (room.isHost) {
            room.cfg = s;
            hostMerge();
          } else if (mine) {
            void room.r.presence({
              row: { faction: mine.faction, color: mine.color, team: mine.team, start: mine.start },
            });
          }
        },
        onStart: () => (room?.isHost ? hostStart() : toggleReady()),
        startLabel: g.isHost ? 'Oyunu Başlat' : 'Hazır',
        startEnabled: (s) =>
          !g.isHost ||
          (s.slots.filter((sl) => sl.kind === 'human' || sl.kind === 'ai').length >=
            (MAP_DEFS[s.mapId]?.mode === 'VS' ? 2 : 1) &&
            s.slots.every((sl) => sl.kind !== 'human' || sl.ready)),
        onBack: leaveRoom,
      });
      screen.innerHTML = '';
      screen.classList.add('bare');
      screen.appendChild(g.setup.el);
    } else {
      const json = JSON.stringify(g.cfg);
      if (json !== shownCfg) g.setup.set(structuredClone(g.cfg));
      shownCfg = json;
    }
  };

  const toggleReady = () => {
    if (!room) return;
    const me = selfPeer(lobby as LobbyRoom) ?? '';
    const p = room.r.peers().find((x) => x.peer === me);
    void room.r.presence({ ready: p?.presence.ready !== true });
  };

  interface StartMsg {
    map: string;
    mode: 'vs' | 'coop';
    diff: number;
    faction: number;
    order: string[];
    nicks: string[];
    setup?: VersusSetup;
    colors?: number[];
    names?: string[];
    /** Her oyuncunun (order sırası) takımı. */
    teams?: number[];
  }

  const hostStart = () => {
    if (!room?.cfg) return;
    const s = room.cfg;
    const def = MAP_DEFS[s.mapId] as MapDef;
    const humanSlots = s.slots.map((sl, i) => ({ sl, i })).filter(({ sl }) => sl.kind === 'human');
    const order = humanSlots.map(({ sl }) => sl.peer ?? '');
    const nicks = humanSlots.map(({ sl }) => sl.name);
    let msg: StartMsg;
    if (def.mode === 'VS') {
      const r = resolveSetup(
        s,
        humanSlots.map(({ i }) => i),
      );
      msg = {
        map: s.mapId,
        mode: 'vs',
        diff: 1,
        faction: 0,
        order,
        nicks,
        setup: r.setup,
        colors: r.colors,
        names: r.names,
        teams: r.setup.humans.slice(),
      };
    } else {
      // Savunma (ortak): kurucunun ordusu bütün oyuncuların ortak ordusudur.
      const f = s.slots[0]?.faction ?? 0;
      msg = {
        map: s.mapId,
        mode: 'coop',
        diff: s.diff,
        faction: f >= 0 ? f : Math.floor(Math.random() * FACTIONS.length),
        order,
        nicks,
      };
    }
    adStarted = true;
    advertise();
    void room.r.presence({ start: msg as unknown as Record<string, unknown> });
  };

  const begin = (st: StartMsg, me: string) => {
    if (!room) return;
    const idx = st.order.indexOf(me);
    if (idx < 0) {
      screen.innerHTML =
        '<h2 class="menu-title">Oyun Odası</h2><p class="net-msg">Bu oyun sensiz başladı.</p>';
      setTimeout(leaveRoom, 2000);
      return;
    }
    started = true;
    room.unsub();
    const net = { room: room.r, start: { order: st.order, nicks: st.nicks, me: idx } };
    screen.remove();
    if (st.mode === 'vs' && st.setup && st.colors && st.names && st.teams) {
      const team = st.teams[idx] as number;
      const slot = st.setup.slots.find((s) => s.team === team);
      onStart({
        mapId: st.map,
        difficulty: 1,
        faction: slot?.faction ?? 0,
        versus: { setup: st.setup, me: team, colors: st.colors, names: st.names },
        net,
      });
    } else onStart({ mapId: st.map, difficulty: st.diff, faction: st.faction, net });
  };

  void getLobby().then((l) => {
    if (!l) {
      screen.innerHTML = `<h2 class="menu-title">Çevrimiçi</h2>
        <div class="frame"><p class="net-msg">Çevrimiçi oyun bu görünümde kullanılamıyor. Oyunu claude.ai'de oturum açmış olarak aç;
        birlikte oynayacağın kişilerin de bu sayfaya erişimi olmalı (paylaş menüsünden davet et).</p></div>
        <div class="menu-actions"><button type="button" class="mbtn back">Geri</button></div>`;
      return;
    }
    lobby = l;
    void l.presence({ nick });
    l.onPeers((c) => {
      collectChat(c.peers);
      renderLobby();
    });
    renderLobby();
  });
};
