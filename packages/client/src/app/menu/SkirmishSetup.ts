import {
  AI_LEVELS,
  CP_LIMIT_OPTIONS,
  DIFFICULTIES,
  FACTIONS,
  MAP_DEFS,
  type MapDef,
  PLAYER_COLORS,
  START_GOLD_OPTIONS,
  type VersusSetup,
  type VersusSlot,
} from '@bulwark/shared';
import { drawMapPreview } from './mapPreview';

/**
 * BFME2 Çatışma kurulum ekranı: solda oyuncu yuvaları tablosu (Oyuncu · Ordu · Renk · Takım ·
 * Konum), sağda harita önizlemesi (başlangıç konumları numaralı, tıklanır), harita listesi ve oyun
 * ayarları (Başlangıç Kaynakları, Komuta Puanı Sınırı). Hem tek oyunculu çatışmada hem çevrimiçi
 * oyun odasında kullanılır; kim neyi düzenleyebilir `canEditSlot` / `canEditSettings` belirler.
 */
export type SlotKind = 'human' | 'ai' | 'open' | 'closed';

export interface SetupSlot {
  kind: SlotKind;
  /** İnsan oyuncunun adı. */
  name: string;
  /** Çevrimiçi: oyuncunun peer etiketi. */
  peer?: string;
  /** Bilgisayar zorluğu (AI_LEVELS). */
  ai: number;
  /** FACTIONS indeksi; −1 = Rastgele. */
  faction: number;
  /** PLAYER_COLORS indeksi; −1 = Rastgele. */
  color: number;
  /** Takım (ittifak) 0–3; −1 = takımsız. */
  team: number;
  /** Başlangıç konumu; −1 = Rastgele. */
  start: number;
  /** Çevrimiçi: hazır mı. */
  ready?: boolean;
}

export interface SetupState {
  mapId: string;
  slots: SetupSlot[];
  gold: number;
  cp: number;
  /** Savunma haritalarında zorluk (DIFFICULTIES). */
  diff: number;
}

export interface SetupOptions {
  title: string;
  state: SetupState;
  maps: readonly MapDef[];
  canEditSlot: (i: number) => boolean;
  canEditSettings: boolean;
  /** Bu istemcinin yuvası (konum tıklaması bu yuvaya atanır); −1 = yok. */
  mySlot: number;
  /** Açık yuva seçeneği (çevrimiçi). */
  allowOpen: boolean;
  onChange: (s: SetupState) => void;
  onStart?: () => void;
  startLabel?: string;
  startEnabled?: (s: SetupState) => boolean;
  onBack: () => void;
  /** Sağ altta ek içerik (sohbet, bilgi). */
  footer?: HTMLElement;
}

const esc = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );

/** Haritaya göre yuva sayısını ayarla (VS: başlangıç sayısı; savunma: 4 insan yuvası). */
export const fitSlots = (s: SetupState, def: MapDef, fill: SlotKind = 'ai'): SetupSlot[] => {
  const n = def.mode === 'VS' ? (def.starts?.length ?? 2) : 4;
  const out = s.slots.slice(0, n).map((sl) => ({ ...sl, start: sl.start >= n ? -1 : sl.start }));
  while (out.length < n)
    out.push({
      kind: out.length === 1 && fill === 'ai' ? 'ai' : fill === 'ai' ? 'closed' : fill,
      name: '',
      ai: 1,
      faction: -1,
      color: -1,
      team: -1,
      start: -1,
    });
  return out;
};

export class SkirmishSetup {
  readonly el: HTMLDivElement;
  private state: SetupState;

  constructor(private readonly o: SetupOptions) {
    this.state = o.state;
    this.el = document.createElement('div');
    this.el.className = 'menu-screen skirmish-setup';
    this.el.addEventListener('change', (e) => this.onInput(e.target as HTMLElement));
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.render();
  }

  set(state: SetupState): void {
    this.state = state;
    this.render();
  }

  get value(): SetupState {
    return this.state;
  }

  private emit(): void {
    this.o.onChange(this.state);
    this.render();
  }

  private render(): void {
    const s = this.state;
    const def = MAP_DEFS[s.mapId] as MapDef;
    const vs = def.mode === 'VS';
    const ed = this.o.canEditSettings;
    const opt = (v: number, label: string, sel: number) =>
      `<option value="${v}" ${v === sel ? 'selected' : ''}>${label}</option>`;
    const rows = s.slots
      .map((sl, i) => {
        const can = this.o.canEditSlot(i);
        const hostRow = ed && sl.kind !== 'human';
        const kindSel =
          sl.kind === 'human'
            ? `<span class="pname">${esc(sl.name || 'Oyuncu')}${sl.ready ? ' <em>hazır</em>' : ''}</span>`
            : `<select data-f="kind" data-i="${i}" ${hostRow ? '' : 'disabled'}>
                ${this.o.allowOpen ? `<option value="open" ${sl.kind === 'open' ? 'selected' : ''}>Açık</option>` : ''}
                <option value="closed" ${sl.kind === 'closed' ? 'selected' : ''}>Kapalı</option>
                ${vs ? AI_LEVELS.map((a, k) => `<option value="ai${k}" ${sl.kind === 'ai' && sl.ai === k ? 'selected' : ''}>Bilgisayar (${a.name})</option>`).join('') : ''}
              </select>`;
        const active = sl.kind === 'human' || sl.kind === 'ai';
        const dis = (can || hostRow) && active ? '' : 'disabled';
        const n = def.starts?.length ?? 1;
        return `<tr class="${active ? '' : 'off'}">
          <td>${kindSel}</td>
          <td><select data-f="faction" data-i="${i}" ${dis}>${opt(-1, 'Rastgele', sl.faction)}${FACTIONS.map((f, k) => opt(k, f.name, sl.faction)).join('')}</select></td>
          <td><select data-f="color" data-i="${i}" ${dis} class="color" style="--c:${PLAYER_COLORS[sl.color]?.main ?? 'transparent'}">${opt(-1, 'Rastgele', sl.color)}${PLAYER_COLORS.map((c, k) => opt(k, c.name, sl.color)).join('')}</select></td>
          <td>${vs ? `<select data-f="team" data-i="${i}" ${dis}>${opt(-1, '—', sl.team)}${[0, 1, 2, 3].map((t) => opt(t, String(t + 1), sl.team)).join('')}</select>` : '<span class="dim">Ortak</span>'}</td>
          <td>${vs ? `<select data-f="start" data-i="${i}" ${dis}>${opt(-1, 'Rastgele', sl.start)}${Array.from({ length: n }, (_, k) => opt(k, String(k + 1), sl.start)).join('')}</select>` : ''}</td>
        </tr>`;
      })
      .join('');
    const maps = this.o.maps
      .map(
        (m) =>
          `<option value="${m.id}" ${m.id === s.mapId ? 'selected' : ''}>${esc(m.name)} (${m.mode === 'VS' ? `${m.starts?.length ?? 2} oyuncu` : m.mode === 'TD' ? 'Kule Savunması' : 'Kale Savunması'})</option>`,
      )
      .join('');
    const canStart = this.o.startEnabled ? this.o.startEnabled(s) : true;
    this.el.innerHTML = `
      <h2 class="menu-title">${esc(this.o.title)}</h2>
      <div class="setup-grid">
        <div class="frame players">
          <table>
            <thead><tr><th>Oyuncu</th><th>Ordu</th><th>Renk</th><th>Takım</th><th>Konum</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p class="hint">${vs ? 'Aynı takım numarasındakiler müttefiktir. Haritadaki numaraya tıklayarak başlangıç konumunu seç.' : 'Savunma haritası: bütün oyuncular aynı kaleyi birlikte savunur (ortak altın ve ordu).'}</p>
        </div>
        <div class="frame mapside">
          <canvas class="preview" width="240" height="240"></canvas>
          <label>Harita <select data-f="map" ${ed ? '' : 'disabled'}>${maps}</select></label>
          <p class="blurb">${esc(def.blurb ?? '')}</p>
          <div class="settings">
            ${vs ? '' : `<label>Zorluk <select data-f="diff" ${ed ? '' : 'disabled'}>${DIFFICULTIES.map((d, k) => opt(k, d.name, s.diff)).join('')}</select></label>`}
            <label>Başlangıç Kaynakları <select data-f="gold" ${ed && vs ? '' : 'disabled'}>${START_GOLD_OPTIONS.map((g) => opt(g, g.toLocaleString('tr-TR'), s.gold)).join('')}</select></label>
            <label>Komuta Puanı Sınırı <select data-f="cp" ${ed && vs ? '' : 'disabled'}>${CP_LIMIT_OPTIONS.map((c) => opt(c, String(c), s.cp)).join('')}</select></label>
          </div>
        </div>
      </div>
      <div class="menu-actions">
        <button type="button" class="mbtn back">Geri</button>
        <div class="footer-slot"></div>
        ${this.o.onStart ? `<button type="button" class="mbtn primary start" ${canStart ? '' : 'disabled'}>${esc(this.o.startLabel ?? 'Oyunu Başlat')}</button>` : ''}
      </div>`;
    if (this.o.footer) this.el.querySelector('.footer-slot')?.appendChild(this.o.footer);
    const canvas = this.el.querySelector('canvas') as HTMLCanvasElement;
    const owners = (def.starts ?? [def.citadel]).map((_, k) => {
      const i = s.slots.findIndex((sl) => sl.start === k && (sl.kind === 'human' || sl.kind === 'ai'));
      const sl = s.slots[i];
      return sl ? { color: PLAYER_COLORS[sl.color]?.main ?? '#8a7a5a', label: String(k + 1) } : {};
    });
    const pv = drawMapPreview(canvas, def, owners);
    canvas.onclick = (e) => {
      if (!vs || this.o.mySlot < 0 || !this.o.canEditSlot(this.o.mySlot)) return;
      const r = canvas.getBoundingClientRect();
      const k = pv.hitStart(
        ((e.clientX - r.left) * canvas.width) / r.width,
        ((e.clientY - r.top) * canvas.height) / r.height,
      );
      if (k < 0 || s.slots.some((sl, j) => j !== this.o.mySlot && sl.start === k)) return;
      const me = s.slots[this.o.mySlot];
      if (me) me.start = k;
      this.emit();
    };
  }

  private onInput(t: HTMLElement): void {
    const f = t.dataset.f;
    if (!f || !(t instanceof HTMLSelectElement)) return;
    const s = this.state;
    if (f === 'map') {
      s.mapId = t.value;
      const def = MAP_DEFS[s.mapId] as MapDef;
      s.slots = fitSlots(s, def, this.o.allowOpen ? 'open' : 'ai');
      this.emit();
      return;
    }
    if (f === 'gold' || f === 'cp' || f === 'diff') {
      s[f] = Number(t.value);
      this.emit();
      return;
    }
    const i = Number(t.dataset.i);
    const sl = s.slots[i];
    if (!sl) return;
    if (f === 'kind') {
      if (t.value.startsWith('ai')) {
        sl.kind = 'ai';
        sl.ai = Number(t.value.slice(2));
      } else sl.kind = t.value as SlotKind;
    } else {
      const v = Number(t.value);
      // Konum ve renk yuvalar arasında benzersiz.
      if ((f === 'start' || f === 'color') && v >= 0)
        for (const o of s.slots) if (o !== sl && o[f] === v) o[f] = -1;
      (sl as unknown as Record<string, number>)[f] = v;
    }
    this.emit();
  }

  private onClick(e: MouseEvent): void {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.classList.contains('back')) this.o.onBack();
    else if (b.classList.contains('start') && !b.hasAttribute('disabled')) this.o.onStart?.();
  }
}

/** Rastgele seçimleri çöz: etkin yuvalar → çatışma kurulumu, takım renkleri ve adlar. */
export const resolveSetup = (
  s: SetupState,
  /** Etkin insan yuvalarının (yuva indeksi) çevrimiçi oyuncu sırası; yerelde [insan yuvası]. */
  humanOrder: readonly number[],
): { setup: VersusSetup; colors: number[]; names: string[]; teamOfSlot: number[] } => {
  const def = MAP_DEFS[s.mapId] as MapDef;
  const nStarts = def.starts?.length ?? 1;
  const active = s.slots
    .map((sl, i) => ({ sl, i }))
    .filter(({ sl }) => sl.kind === 'human' || sl.kind === 'ai');
  const teamOfSlot = s.slots.map(() => -1);
  active.forEach(({ i }, t) => {
    teamOfSlot[i] = t;
  });
  const rnd = (n: number) => Math.floor(Math.random() * n);
  const usedStarts = new Set(active.map(({ sl }) => sl.start).filter((v) => v >= 0));
  const usedColors = new Set(active.map(({ sl }) => sl.color).filter((v) => v >= 0));
  const slots: VersusSlot[] = [];
  const colors: number[] = [];
  const names: string[] = [];
  for (const { sl, i } of active) {
    let start = sl.start;
    if (start < 0) {
      const free = Array.from({ length: nStarts }, (_, k) => k).filter((k) => !usedStarts.has(k));
      start = free[rnd(free.length)] ?? 0;
      usedStarts.add(start);
    }
    let color = sl.color;
    if (color < 0) {
      const free = PLAYER_COLORS.map((_, k) => k).filter((k) => !usedColors.has(k));
      color = free[0] ?? 0;
      usedColors.add(color);
    }
    const faction = sl.faction >= 0 ? sl.faction : rnd(FACTIONS.length);
    slots.push({
      team: teamOfSlot[i] as number,
      faction,
      alliance: sl.team,
      ai: sl.kind === 'ai' ? sl.ai : -1,
      start,
    });
    colors.push(color);
    names.push(sl.kind === 'ai' ? `Bilgisayar (${AI_LEVELS[sl.ai]?.name ?? ''})` : sl.name || 'Oyuncu');
  }
  return {
    setup: {
      slots,
      humans: humanOrder.map((i) => teamOfSlot[i] as number),
      startGold: s.gold,
      cpLimit: s.cp,
    },
    colors,
    names,
    teamOfSlot,
  };
};
