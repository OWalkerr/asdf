import { DIFFICULTIES, FACTIONS, MAP_DEFS } from '@bulwark/shared';
import type { NetStart } from '../net/NetSession';
import { getLobby, type Lobby as LobbyRoom, type NamedRoom, type Peer, selfPeer } from '../net/room';

/**
 * Çok oyunculu lobi (BFME2 çevrimiçi lobisi gibi): açık oyunlar listesi, oyun kurma, katılma,
 * oyuncu listesi ve kurucunun başlatması. Kurulan oyun lobi presence'ında ilan edilir; oyuncular
 * `bw-<kod>` adlı odada toplanır. Başlatma kurucunun oda presence'ına yazılır (`start`), herkes
 * onu görünce aynı ayarlarla, aynı oyuncu sırasıyla maça girer.
 */
export interface NetChoice {
  mapId: string;
  difficulty: number;
  faction: number;
  net: { room: NamedRoom; start: NetStart };
}

interface GameAd {
  code: string;
  map: string;
  diff: number;
  faction: number;
  n: number;
  max: number;
  started: boolean;
}

const MAX_PLAYERS = 4;
const MAP_IDS = Object.keys(MAP_DEFS);

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
    map: g.map,
    diff: Number(g.diff) || 0,
    faction: Number(g.faction) || 0,
    n: Number(g.n) || 1,
    max: Number(g.max) || MAX_PLAYERS,
    started: g.started === true,
  };
};

const randomCode = (): string => {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
};

const savedNick = (): string => {
  try {
    return localStorage.getItem('bulwark.nick') ?? '';
  } catch {
    return '';
  }
};

/** Lobi panelini `pane` içine kurar; maç başlayınca `onStart` çağrılır. */
export const mountLobby = (pane: HTMLElement, onStart: (c: NetChoice) => void): void => {
  pane.innerHTML = '<p class="net-msg">Odaya bağlanılıyor…</p>';
  let lobby: LobbyRoom | null = null;
  let game: {
    room: NamedRoom;
    code: string;
    hostPeer: string;
    isHost: boolean;
    sawHost: boolean;
    unsub: () => void;
  } | null = null;
  let setup = { map: MAP_IDS[0] as string, diff: 1, faction: 0 };
  let nick = savedNick() || `Savunucu${Math.floor(Math.random() * 900 + 100)}`;
  let started = false;

  const renderList = () => {
    if (!lobby || game) return;
    const me = selfPeer(lobby);
    const ads = lobby.peers().flatMap((p) => {
      const ad = adOf(p);
      return ad && p.peer !== me ? [{ p, ad }] : [];
    });
    const gamesHtml =
      ads.length === 0
        ? '<p class="empty">Açık oyun yok — ilk oyunu sen kur.</p>'
        : ads
            .map(
              ({
                p,
                ad,
              }) => `<button type="button" class="game" data-peer="${esc(p.peer)}" ${ad.started || ad.n >= ad.max ? 'disabled' : ''}>
              <b>${esc(nickOf(p))}</b><span>${esc(MAP_DEFS[ad.map]?.name ?? ad.map)} · ${FACTIONS[ad.faction]?.name ?? ''} · ${DIFFICULTIES[ad.diff]?.name ?? ''}</span>
              <em>${ad.started ? 'Oyunda' : `${ad.n} / ${ad.max} oyuncu`}</em></button>`,
            )
            .join('');
    const list = pane.querySelector<HTMLDivElement>('.games');
    if (list) {
      if (list.innerHTML !== gamesHtml) list.innerHTML = gamesHtml;
      return;
    }
    pane.innerHTML = `
      <div class="net-head">
        <label>Takma ad <input class="nick" maxlength="20" value="${esc(nick)}"></label>
        <button type="button" class="host">Oyun kur</button>
      </div>
      <p class="net-msg">Ortak savunma: 2–${MAX_PLAYERS} oyuncu aynı kaleyi birlikte savunur — altın, ordu ve güçler ortaktır.
      Bu sayfayı açan herkes lobidedir; bağlantıyı paylaşarak arkadaşlarını çağır.</p>
      <div class="games"></div>`;
    const input = pane.querySelector<HTMLInputElement>('.nick');
    input?.addEventListener('change', () => {
      nick = input.value.trim().slice(0, 20) || nick;
      try {
        localStorage.setItem('bulwark.nick', nick);
      } catch {
        /* depolama yok */
      }
      void lobby?.presence({ nick });
    });
    pane.querySelector('.host')?.addEventListener('click', () => void enter(randomCode(), null));
    pane.querySelector('.games')?.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.game');
      const p = b && lobby?.peers().find((x) => x.peer === b.dataset.peer);
      const ad = p ? adOf(p) : null;
      if (p && ad) void enter(ad.code, p);
    });
    renderList();
  };

  /** Oyun odasına gir (host = null ise kurucu sensin). */
  const enter = async (code: string, host: Peer | null) => {
    if (!lobby) return;
    const input = pane.querySelector<HTMLInputElement>('.nick');
    if (input?.value.trim()) nick = input.value.trim().slice(0, 20);
    pane.innerHTML = '<p class="net-msg">Oyuna katılınıyor…</p>';
    let room: NamedRoom;
    try {
      room = await lobby.join(`bw-${code}`);
    } catch {
      pane.innerHTML = '<p class="net-msg">Oyun odasına girilemedi. Biraz sonra yeniden dene.</p>';
      setTimeout(renderList, 2500);
      return;
    }
    const me = selfPeer(lobby) ?? '';
    const isHost = host === null;
    if (host) {
      const ad = adOf(host);
      if (ad) setup = { map: ad.map, diff: ad.diff, faction: ad.faction };
    }
    await room.presence({ nick, at: Date.now() });
    if (isHost) advertise(code, 1, false);
    const unsub = room.onPeers(() => renderGame());
    game = { room, code, hostPeer: isHost ? me : (host?.peer ?? ''), isHost, sawHost: isHost, unsub };
    renderGame();
  };

  const advertise = (code: string, n: number, isStarted: boolean) => {
    void lobby?.presence({
      nick,
      game: {
        code,
        map: setup.map,
        diff: setup.diff,
        faction: setup.faction,
        n,
        max: MAX_PLAYERS,
        started: isStarted,
      },
    });
  };

  const leaveGame = () => {
    if (!game) return;
    game.unsub();
    void game.room.leave();
    game = null;
    void lobby?.presence({ game: null });
    renderList();
  };

  /** Odadaki oyuncular: kurucu önce, sonra katılma sırası. */
  const roster = (): Peer[] => {
    if (!game || !lobby) return [];
    const hostPeer = game.hostPeer;
    const ps = game.room.peers().filter((p) => typeof p.presence.nick === 'string');
    return ps.sort((a, b) => {
      if (a.peer === hostPeer) return -1;
      if (b.peer === hostPeer) return 1;
      return Number(a.presence.at) - Number(b.presence.at) || (a.peer < b.peer ? -1 : 1);
    });
  };

  const renderGame = () => {
    if (!game || !lobby || started) return;
    const g = game;
    const me = selfPeer(lobby) ?? '';
    const players = roster();
    const hostHere = players.some((p) => p.peer === g.hostPeer);
    // Başlatma: kurucunun oda presence'ında.
    const hostP = g.room.peers().find((p) => p.peer === g.hostPeer);
    const st = hostP?.presence.start as
      | { map?: string; diff?: number; faction?: number; order?: string[]; nicks?: string[] }
      | undefined;
    if (st && Array.isArray(st.order) && typeof st.map === 'string' && MAP_DEFS[st.map]) {
      const idx = st.order.indexOf(me);
      if (idx < 0) {
        pane.innerHTML = '<p class="net-msg">Bu oyun sensiz başladı.</p>';
        setTimeout(leaveGame, 2500);
        return;
      }
      started = true;
      g.unsub();
      onStart({
        mapId: st.map,
        difficulty: Number(st.diff) || 0,
        faction: Number(st.faction) || 0,
        net: {
          room: g.room,
          start: {
            order: st.order,
            nicks: Array.isArray(st.nicks) ? st.nicks.map(String) : st.order.map((_, i) => `Oyuncu ${i + 1}`),
            me: idx,
          },
        },
      });
      return;
    }
    if (hostHere) g.sawHost = true;
    if (g.isHost) advertise(g.code, players.length, false);
    else if (!hostHere && g.sawHost) {
      pane.innerHTML = '<p class="net-msg">Kurucu oyundan ayrıldı.</p>';
      setTimeout(leaveGame, 2000);
      return;
    }
    if (!g.isHost && hostP) {
      // Kurucunun güncel ayarları lobi ilanında.
      const ad = lobby.peers().find((p) => p.peer === g.hostPeer);
      const a = ad ? adOf(ad) : null;
      if (a) setup = { map: a.map, diff: a.diff, faction: a.faction };
    }
    const opt = <T>(list: readonly T[], sel: number, label: (x: T, i: number) => string) =>
      list
        .map((x, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${label(x, i)}</option>`)
        .join('');
    pane.innerHTML = `
      <div class="lobby-room">
        <h3>Oyun <code>${g.code}</code> ${g.isHost ? '<small>(kurucu sensin)</small>' : ''}</h3>
        <ol class="roster">${players
          .map(
            (p, i) =>
              `<li><i style="background:${['#4a8fe0', '#e0c34a', '#59c06a', '#d0604a'][i] ?? '#999'}"></i>${esc(nickOf(p))}${p.peer === g.hostPeer ? ' <em>kurucu</em>' : ''}${p.peer === me ? ' <em>sen</em>' : ''}</li>`,
          )
          .join('')}</ol>
        <div class="setup">
          <label>Harita <select class="s-map" ${g.isHost ? '' : 'disabled'}>${opt(MAP_IDS, MAP_IDS.indexOf(setup.map), (id) => esc(MAP_DEFS[id]?.name ?? id))}</select></label>
          <label>Taraf <select class="s-fac" ${g.isHost ? '' : 'disabled'}>${opt(FACTIONS, setup.faction, (f) => f.name)}</select></label>
          <label>Zorluk <select class="s-diff" ${g.isHost ? '' : 'disabled'}>${opt(DIFFICULTIES, setup.diff, (d) => d.name)}</select></label>
        </div>
        <p class="net-msg">${g.isHost ? (players.length < 2 ? 'Arkadaşların lobide bu oyunu görüp katılabilir.' : 'Herkes hazırsa başlat.') : 'Kurucunun başlatması bekleniyor…'}</p>
        <div class="lobby-actions">
          <button type="button" class="leave">Ayrıl</button>
          ${g.isHost ? `<button type="button" class="start" ${players.length < 2 ? 'disabled' : ''}>Başlat (${players.length})</button>` : ''}
        </div>
      </div>`;
    pane.querySelector('.leave')?.addEventListener('click', leaveGame);
    const bind = (cls: string, set: (v: number) => void) =>
      pane.querySelector<HTMLSelectElement>(cls)?.addEventListener('change', (e) => {
        set(Number((e.target as HTMLSelectElement).value));
        advertise(g.code, players.length, false);
        renderGame();
      });
    bind('.s-map', (v) => {
      setup.map = MAP_IDS[v] ?? setup.map;
    });
    bind('.s-fac', (v) => {
      setup.faction = v;
    });
    bind('.s-diff', (v) => {
      setup.diff = v;
    });
    pane.querySelector('.start')?.addEventListener('click', () => {
      const ps = roster().slice(0, MAX_PLAYERS);
      advertise(g.code, ps.length, true);
      void g.room.presence({
        start: {
          map: setup.map,
          diff: setup.diff,
          faction: setup.faction,
          order: ps.map((p) => p.peer),
          nicks: ps.map(nickOf),
        },
      });
    });
  };

  void getLobby().then((l) => {
    if (!l) {
      pane.innerHTML = `<p class="net-msg">Çok oyunculu bu görünümde kullanılamıyor. Oyunu claude.ai'de oturum açmış olarak
        aç; birlikte oynayacağın kişilerin de bu sayfaya erişimi olmalı (paylaş menüsünden davet et).</p>`;
      return;
    }
    lobby = l;
    void l.presence({ nick });
    l.onPeers(() => renderList());
    renderList();
  });
};
