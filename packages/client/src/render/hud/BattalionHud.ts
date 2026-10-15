import { UNIT_DEFS } from '@bulwark/shared';
import {
  BoxGeometry,
  type Camera,
  Color,
  ConeGeometry,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  OctahedronGeometry,
  type Texture,
  Vector3,
} from 'three/webgpu';
import { merge, paint, place } from '../geometry/lowpoly';
import { createToonMaterial, type ToonParams } from '../materials/ToonMaterial';
import type { StructInfo } from '../structures/StructureRenderer';
import type { UnitRenderer } from '../units/UnitRenderer';
import { BarRenderer, healthColor } from './BarRenderer';

/**
 * Tabur göstergeleri (BFME2): taburun ortasında süzülen takım sancağı + tabur can çubuğu,
 * yapılar için can/inşa çubuğu. Tabur merkezi, o karede çizilen askerlerden hesaplanır.
 */
const MAX_BATTALIONS = 1024;
export const TEAM_COLORS = ['#3a6fc4', '#b8322a', '#3a8f4a', '#c9a23a'].map((c) => new Color(c));

/** Oyuncu tarafının sancak rengi (Gondor mavi, Rohan yeşil). */
export const setPlayerBannerColor = (hex: string): void => {
  (TEAM_COLORS[0] as Color).set(hex);
};
/** Takım `t` (eşlenmiş) sancak rengi (çatışma). */
export const setTeamBannerColor = (t: number, hex: string): void => {
  TEAM_COLORS[t]?.set(hex);
};
const BUILD_COLOR = new Color('#5aa6e8');
const GOLD = new Color('#ffd34d');

interface Agg {
  x: number;
  y: number;
  z: number;
  maxY: number;
  n: number;
  hp: number;
  team: number;
  type: number;
  rank: number;
}

export class BattalionHud {
  readonly meshes: InstancedMesh[];
  private readonly pole: InstancedMesh;
  private readonly flag: InstancedMesh;
  /** Sancak altındaki donanım işaretleri: kılıç, kalkan, alev; birleşik ordu elması. */
  private readonly pips: InstancedMesh[];
  private readonly bars = new BarRenderer(MAX_BATTALIONS + 64);
  private readonly agg = new Map<number, Agg>();
  private readonly pool: Agg[] = [];
  private readonly m = new Matrix4();
  private readonly c = new Color();
  private readonly v = new Vector3();
  /** Can çubukları: 'auto' = seçili veya hasarlı taburlar. */
  showAllBars = false;

  constructor(palette: Texture, params: ToonParams) {
    const mat = createToonMaterial(palette, params);
    const poleGeo = merge([
      paint(place(new CylinderGeometry(0.05, 0.05, 2.6, 4), 0, 1.3, 0), 'wood'),
      paint(place(new ConeGeometry(0.16, 0.4, 4), 0, 2.8, 0), 'gold'),
      paint(place(new BoxGeometry(1.2, 0.07, 0.07), 0.55, 2.45, 0), 'woodDark'),
    ]);
    // Düşey flama: üstte geniş, altta kırlangıç kuyruğu (çentikli) — beyaz boyanır, takım rengiyle çarpılır.
    const flagGeo = merge([
      paint(place(new BoxGeometry(1.0, 1.1, 0.05), 0.55, 1.85, 0), 'gondorWhite'),
      paint(place(new BoxGeometry(0.4, 0.45, 0.05), 0.25, 1.1, 0), 'gondorWhite'),
      paint(place(new BoxGeometry(0.4, 0.45, 0.05), 0.85, 1.1, 0), 'gondorWhite'),
    ]);
    this.pole = new InstancedMesh(poleGeo, mat, MAX_BATTALIONS);
    this.flag = new InstancedMesh(flagGeo, mat, MAX_BATTALIONS);
    this.flag.setColorAt(0, TEAM_COLORS[0] as Color);
    for (const mesh of [this.pole, this.flag]) {
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.count = 0;
      mesh.name = 'battalion-banners';
    }
    // Donanım işaretleri flama altında yan yana (flama yerel uzayı: x 0.05–1.05).
    const pipGeos = [
      merge([
        paint(place(new BoxGeometry(0.09, 0.42, 0.05), 0.22, 0.78, 0), 'silver'),
        paint(place(new BoxGeometry(0.26, 0.06, 0.06), 0.22, 0.62, 0), 'gold'),
      ]),
      merge([
        paint(place(new BoxGeometry(0.3, 0.34, 0.06), 0.55, 0.74, 0), 'steel'),
        paint(place(new BoxGeometry(0.1, 0.2, 0.07), 0.55, 0.76, 0), 'gold'),
      ]),
      merge([paint(place(new ConeGeometry(0.13, 0.4, 5), 0.88, 0.78, 0), 'fire')]),
      merge([paint(place(new OctahedronGeometry(0.2, 0), -0.32, 2.05, 0), 'gold')]),
    ];
    this.pips = pipGeos.map((g) => {
      const mesh = new InstancedMesh(g, mat, MAX_BATTALIONS);
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.count = 0;
      mesh.name = 'battalion-gear';
      return mesh;
    });
    this.meshes = [this.pole, this.flag, ...this.pips, ...this.bars.meshes];
  }

  update(
    units: UnitRenderer,
    camera: Camera,
    selected: ReadonlySet<number>,
    structures: Iterable<StructInfo>,
    selectedSlot: number,
  ): void {
    for (const a of this.agg.values()) this.pool.push(a);
    this.agg.clear();
    units.forEach((x, y, z, battalion, team, hp, type, rank) => {
      if (battalion === 0) return;
      let a = this.agg.get(battalion);
      if (!a) {
        a = this.pool.pop() ?? { x: 0, y: 0, z: 0, maxY: 0, n: 0, hp: 0, team: 0, type: 0, rank: 1 };
        a.x = a.y = a.z = a.hp = a.n = 0;
        a.maxY = -1e9;
        a.team = team;
        a.type = type;
        a.rank = rank;
        this.agg.set(battalion, a);
      }
      a.x += x;
      a.y += y;
      a.z += z;
      a.maxY = Math.max(a.maxY, y);
      a.hp += hp;
      a.n++;
    });

    // Kamera yönüne dik flama: sancak her zaman yandan okunur.
    const yaw = Math.atan2(
      camera.matrixWorld.elements[8] as number,
      camera.matrixWorld.elements[10] as number,
    );
    let i = 0;
    const pipN = [0, 0, 0, 0];
    this.bars.begin(camera);
    for (const [b, a] of this.agg) {
      if (i >= MAX_BATTALIONS) break;
      const cx = a.x / a.n;
      const cz = a.z / a.n;
      const cy = a.maxY;
      const size = UNIT_DEFS[a.type]?.battalionSize ?? 12;
      const sel = selected.has(b);
      const s = sel ? 1.25 : 1;
      this.m.makeRotationY(yaw).scale(this.v.setScalar(s));
      this.m.setPosition(cx, cy + 2.6, cz);
      this.pole.setMatrixAt(i, this.m);
      this.flag.setMatrixAt(i, this.m);
      // Rütbe 3+: sancak altına döner (GDD §5.2), rütbe 5'te parlak altın.
      const base = TEAM_COLORS[a.team] ?? (TEAM_COLORS[0] as Color);
      const gold = a.rank >= 5 ? 1 : a.rank >= 3 ? 0.55 : 0;
      this.flag.setColorAt(i, gold > 0 ? this.c.copy(base).lerp(GOLD, gold) : base);
      const info = units.battalionInfo.get(b);
      if (info) {
        const bits = info.gear | (info.horde ? 8 : 0);
        for (let k = 0; k < 4; k++)
          if (bits & (1 << k)) (this.pips[k] as InstancedMesh).setMatrixAt((pipN[k] as number)++, this.m);
      }
      i++;
      const ratio = a.hp / size;
      if (sel || this.showAllBars || ratio < 0.999)
        this.bars.push(cx, cy + 6.1 * s, cz, sel ? 3.4 : 2.6, ratio, healthColor(ratio, this.c));
    }
    this.pole.count = i;
    this.flag.count = i;
    this.pole.instanceMatrix.needsUpdate = true;
    this.flag.instanceMatrix.needsUpdate = true;
    this.pips.forEach((p, k) => {
      p.count = pipN[k] as number;
      if (p.count > 0) p.instanceMatrix.needsUpdate = true;
    });
    if (this.flag.instanceColor) this.flag.instanceColor.needsUpdate = true;

    for (const st of structures) {
      if (st.built < 1) this.bars.push(st.x, st.top + 1.6, st.z, 5, st.built, BUILD_COLOR);
      else if (st.hp < st.max || st.slot === selectedSlot)
        this.bars.push(st.x, st.top + 1.6, st.z, 5, st.hp / st.max, healthColor(st.hp / st.max, this.c));
    }
    this.bars.end();
  }
}
