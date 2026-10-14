import {
  BUILDING_DEFS,
  BUILDING_KINDS,
  type BuildingKind,
  ECONOMY,
  type MapDef,
  SLOT_BUILDS,
  UNIT_DEFS,
} from '@bulwark/shared';
import type { SlotMarkers } from '../render/map/SlotMarkers';
import type { StructureRenderer } from '../render/structures/StructureRenderer';
import type { UnitRenderer } from '../render/units/UnitRenderer';
import type { Scenario } from './scenario';

/**
 * Bağlama göre değişen alt komut paneli (GDD §11.1, BFME2 "palantír" paneli):
 *   tabur seçili → birlik özeti + Dur
 *   boş slot     → inşa edilebilir yapılar (maliyet, kısayol)
 *   kışla        → birim yetiştirme + kuyruk
 *   kule         → durum
 * Her zaman: altın. Kısayollar Z X C V (sırayla düğmeler), H (dur).
 */
export const UNIT_LABELS: Record<number, string> = {
  0: 'Gondor Askerleri',
  1: 'Mordor Orkları',
  2: 'Kule Muhafızları',
  3: 'Uruk-hai',
  4: 'Gondor Okçuları',
};

const ICONS: Record<string, string> = {
  sword: '<path d="M17 3l4 0 0 4-9 9-2-2zM6 14l4 4-2 2-1-1-2 2-2-2 2-2-1-1z" fill="currentColor"/>',
  spear: '<path d="M19 2l3 1-1 3-11 11-2-2zM3 13a6 7 0 0 0 8 8l-3-5z" fill="currentColor"/>',
  bow: '<path d="M5 3c9 2 14 7 16 16" stroke="currentColor" stroke-width="2" fill="none"/><path d="M5 3l16 16M3 9l6-6M15 21l6-6" stroke="currentColor" stroke-width="1.4"/>',
  tower: '<path d="M7 22V9H5V3h3v2h2V3h4v2h2V3h3v6h-2v13zM11 14h2v3h-2z" fill="currentColor"/>',
  hall: '<path d="M2 11l10-7 10 7v2H2zM4 13h16v9H4zM10 16h4v6h-4z" fill="currentColor"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor"/>',
};
const UNIT_ICON: Record<number, string> = { 0: 'sword', 1: 'sword', 2: 'spear', 3: 'sword', 4: 'bow' };
const BUILD_ICON: Record<BuildingKind, string> = { arrow_tower: 'tower', barracks: 'hall' };
const BUILD_DESC: Record<BuildingKind, string> = {
  arrow_tower: 'Menzildeki düşman taburlarına 3 oklu yaylım atar.',
  barracks: 'Gondor piyadesi, okçu ve Kule Muhafızı yetiştirir.',
};
const SLOT_NAMES: Record<string, string> = {
  wall_socket: 'Sur soketi',
  tower: 'Kule platformu',
  building: 'Bina arsası',
};
// Q/E ve WASD kameraya ait; panel kısayolları alt sırada.
const HOTKEYS = ['KeyZ', 'KeyX', 'KeyC', 'KeyV'];
const HOTKEY_LABEL = ['Z', 'X', 'C', 'V'];

const icon = (name: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] ?? ''}</svg>`;

interface Button {
  enabled: boolean;
  run: () => void;
}

export interface CommandPanelDeps {
  def: MapDef;
  scenario: Scenario;
  units: UnitRenderer;
  structures: StructureRenderer;
  slots: SlotMarkers;
  selected: Set<number>;
}

export class CommandPanel {
  private readonly root: HTMLDivElement;
  private readonly goldEl: HTMLDivElement;
  private readonly body: HTMLDivElement;
  private buttons: Button[] = [];
  private stopFn: (() => void) | null = null;
  private key = '';
  private gold = 0;

  constructor(private readonly d: CommandPanelDeps) {
    this.root = document.createElement('div');
    this.root.id = 'cmdpanel';
    this.root.innerHTML = '<div class="gold"></div><div class="body"></div>';
    this.goldEl = this.root.querySelector('.gold') as HTMLDivElement;
    this.body = this.root.querySelector('.body') as HTMLDivElement;
    document.body.appendChild(this.root);
    this.body.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest('[data-btn]') as HTMLElement | null;
      if (!el) return;
      const b = this.buttons[Number(el.dataset.btn)];
      if (b?.enabled) b.run();
    });
    // Panele tıklama haritaya geçmesin.
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
    window.addEventListener('keydown', (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const i = HOTKEYS.indexOf(e.code);
      if (i >= 0) {
        const b = this.buttons[i];
        if (b?.enabled) {
          b.run();
          e.preventDefault();
        }
      } else if (e.code === 'KeyH' && this.stopFn) {
        this.stopFn();
        e.preventDefault();
      }
    });
  }

  update(gold: number): void {
    this.gold = gold;
    this.goldEl.innerHTML = `<b>${gold}</b><span>altın · +${ECONOMY.income}/sn</span>`;
    const { selected, slots, structures } = this.d;
    if (selected.size > 0) {
      this.showBattalions();
      return;
    }
    const slot = slots.selectedIndex;
    if (slot >= 0) {
      if (structures.bySlot.has(slot)) this.showStructure(slot);
      else this.showSlot(slot);
      return;
    }
    this.render('idle', () => {
      this.buttons = [];
      this.stopFn = null;
      return `<div class="title">Helm's Deep savunması</div>
        <div class="hint">Tabur seç: tıkla / kutu çiz · Sağ tık: yürü, düşmana saldır<br>
        Surdaki altın halkalara <b>okçu kulesi</b>, vadideki arsalara <b>kışla</b> kur. Düşman ölümleri altın getirir.<br>
        Menfez ve Hornburg kapısı yalnızca sizin birliklerinize açıktır.</div>`;
    });
  }

  /** İçerik yalnızca anahtar değişince yeniden kurulur (her kare DOM üretme). */
  private render(key: string, build: () => string): void {
    if (key === this.key) return;
    this.key = key;
    this.body.innerHTML = build();
  }

  private button(
    i: number,
    enabled: boolean,
    run: () => void,
    inner: string,
    title: string,
    cls = '',
  ): string {
    this.buttons[i] = { enabled, run };
    return `<button type="button" class="cmd ${cls}${enabled ? '' : ' off'}" data-btn="${i}" title="${title}">${inner}<kbd>${HOTKEY_LABEL[i] ?? ''}</kbd></button>`;
  }

  private showBattalions(): void {
    const counts = new Map<number, { battalions: Set<number>; men: number; hp: number }>();
    this.d.units.forEach((_x, _y, _z, b, _team, hp, type) => {
      if (!this.d.selected.has(b)) return;
      let c = counts.get(type);
      if (!c) {
        c = { battalions: new Set(), men: 0, hp: 0 };
        counts.set(type, c);
      }
      c.battalions.add(b);
      c.men++;
      c.hp += hp;
    });
    const parts = [...counts].map(([type, c]) => {
      const size = UNIT_DEFS[type]?.battalionSize ?? 1;
      return {
        type,
        n: c.battalions.size,
        men: c.men,
        hp: Math.round((c.hp / (size * c.battalions.size)) * 100),
      };
    });
    const key = `bat:${parts.map((p) => `${p.type}.${p.n}.${p.men}.${Math.round(p.hp / 5)}`).join(',')}`;
    this.render(key, () => {
      this.buttons = [];
      const sel = this.d.selected;
      this.stopFn = () => this.d.scenario.stop(sel);
      const cards = parts
        .map(
          (
            p,
          ) => `<div class="unitcard">${icon(UNIT_ICON[p.type] ?? 'sword')}<div><b>${UNIT_LABELS[p.type] ?? '?'}</b>
            <span>${p.n} tabur · ${p.men} asker</span><i class="hpbar"><i style="width:${p.hp}%"></i></i></div></div>`,
        )
        .join('');
      return `<div class="title">${sel.size} tabur seçili</div><div class="row">${cards}
        <button type="button" class="cmd stop" data-stop title="Dur (H)">${icon('stop')}<span>Dur</span><kbd>H</kbd></button></div>
        <div class="hint">Sağ tık: yürü · düşmana sağ tık: saldır</div>`;
    });
    const stopBtn = this.body.querySelector('[data-stop]') as HTMLButtonElement | null;
    if (stopBtn && !stopBtn.onclick) stopBtn.onclick = () => this.stopFn?.();
  }

  private showSlot(slot: number): void {
    const def = this.d.def.slots[slot];
    if (!def) return;
    const kinds = SLOT_BUILDS[def.kind] ?? [];
    const key = `slot:${slot}:${kinds.map((k) => (this.gold >= BUILDING_DEFS[k].cost ? 1 : 0)).join('')}`;
    this.render(key, () => {
      this.buttons = [];
      this.stopFn = null;
      const btns = kinds
        .map((k, i) => {
          const b = BUILDING_DEFS[k];
          const ok = this.gold >= b.cost;
          return this.button(
            i,
            ok,
            () => {
              this.d.scenario.build(slot, BUILDING_KINDS.indexOf(k));
              this.key = '';
            },
            `${icon(BUILD_ICON[k])}<span>${b.name}</span><em>${b.cost}</em>`,
            `${b.name} — ${b.cost} altın, ${b.buildTime} sn. ${BUILD_DESC[k]}`,
            'wide',
          );
        })
        .join('');
      return `<div class="title">${SLOT_NAMES[def.kind] ?? def.kind} ${def.id}</div><div class="row">${btns || '<div class="hint">Bu alana şimdilik inşa edilemez.</div>'}</div>
        <div class="hint">${kinds.map((k) => BUILD_DESC[k]).join(' ')}</div>`;
    });
  }

  private showStructure(slot: number): void {
    const st = this.d.structures.bySlot.get(slot);
    const kind = st ? BUILDING_KINDS[st.kind] : undefined;
    if (!st || !kind) return;
    const b = BUILDING_DEFS[kind];
    const hpTxt = `${st.hp}/${st.max}`;
    if (st.built < 1) {
      this.render(`build:${slot}:${Math.round(st.built * 50)}`, () => {
        this.buttons = [];
        this.stopFn = null;
        return `<div class="title">${b.name} inşa ediliyor</div><div class="row"><div class="unitcard">${icon(BUILD_ICON[kind])}<div>
          <b>%${Math.round(st.built * 100)}</b><i class="hpbar build"><i style="width:${st.built * 100}%"></i></i></div></div></div>`;
      });
      return;
    }
    if (kind === 'arrow_tower') {
      this.render(`tower:${slot}:${hpTxt}`, () => {
        this.buttons = [];
        this.stopFn = null;
        const a = b.attack;
        return `<div class="title">${b.name}</div><div class="row"><div class="unitcard">${icon('tower')}<div><b>${hpTxt}</b>
          <span>Menzil ${a?.range} m · ${a?.volley} ok / ${a?.interval} sn</span></div></div></div>
          <div class="hint">${BUILD_DESC.arrow_tower}</div>`;
      });
      return;
    }
    const trains = b.trains ?? [];
    const afford = trains.map((u) => (this.gold >= (UNIT_DEFS[u]?.cost ?? 0) ? 1 : 0)).join('');
    const key = `barracks:${slot}:${afford}:${st.queueLen}:${st.queueUnit}:${Math.round(st.queuePct * 40)}`;
    this.render(key, () => {
      this.buttons = [];
      this.stopFn = null;
      const full = st.queueLen >= ECONOMY.queueMax;
      const btns = trains
        .map((u, i) => {
          const def = UNIT_DEFS[u];
          if (!def) return '';
          const ok = !full && this.gold >= def.cost;
          return this.button(
            i,
            ok,
            () => {
              this.d.scenario.train(st.eid, u);
              this.key = '';
            },
            `${icon(UNIT_ICON[u] ?? 'sword')}<span>${UNIT_LABELS[u] ?? def.name}</span><em>${def.cost}</em>`,
            `${UNIT_LABELS[u] ?? def.name} — ${def.cost} altın, ${def.trainTime} sn, ${def.battalionSize} asker`,
            'wide',
          );
        })
        .join('');
      const queue =
        st.queueLen > 0
          ? `<div class="queue">${Array.from({ length: st.queueLen }, (_, i) => `<span class="q${i === 0 ? ' head' : ''}">${icon(i === 0 ? (UNIT_ICON[st.queueUnit] ?? 'sword') : 'hall')}${i === 0 ? `<i style="width:${st.queuePct * 100}%"></i>` : ''}</span>`).join('')}</div>`
          : '<div class="hint">Kuyruk boş</div>';
      return `<div class="title">${b.name} · ${hpTxt}</div><div class="row">${btns}</div>${queue}`;
    });
  }
}
