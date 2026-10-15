import { EAGLES, EARTHQUAKE, FLOOD } from '@bulwark/shared';
import {
  AdditiveBlending,
  BoxGeometry,
  type BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicNodeMaterial,
  Quaternion,
  RingGeometry,
  type Texture,
  Vector3,
} from 'three/webgpu';
import { merge, paint, place, verticalShade } from '../geometry/lowpoly';
import { createToonMaterial, type ToonParams } from '../materials/ToonMaterial';

/**
 * Büyük güçlerin sahne gösterileri (BFME2'deki gibi gökten gelen kartallar, yayılan sel dalgası,
 * yarılan toprak, kör eden güneş). Sim'deki zamanlamayla eşlenir (EAGLES/FLOOD/EARTHQUAKE);
 * hasar sim'de, burada yalnızca görsel. Hepsi az sayıda InstancedMesh.
 */
const EAGLE_OFFSETS: readonly [number, number][] = [
  [0, 0],
  [5, 4],
  [-5, -4],
  [4, -5],
];

interface Eagle {
  x: number;
  z: number;
  y: number;
  /** Dalış anı (s, gösterinin başından). */
  hit: number;
  /** Geliş yönü (radyan). */
  dir: number;
}
interface Show {
  kind: 'eagles' | 'flood' | 'quake' | 'flare';
  x: number;
  y: number;
  z: number;
  radius: number;
  age: number;
  life: number;
  eagles?: Eagle[];
  /** Deprem çatlakları: açı, uzunluk, mesafe. */
  cracks?: [number, number, number][];
}

/** Low-poly kartal (Gwaihir): +X ileri; gövde, altın başlı boyun, kanca gaga, kuyruk. Kanatlar ayrı. */
const eagleBody = (): BufferGeometry =>
  verticalShade(
    merge([
      paint(place(new ConeGeometry(0.62, 2.8, 7).rotateZ(-Math.PI / 2), 0.25, 0, 0), 'woodDark'),
      paint(place(new ConeGeometry(0.5, 1.2, 7).rotateZ(-Math.PI / 2), 0.4, -0.18, 0), 'leather'),
      paint(place(new ConeGeometry(0.55, 1.5, 6).rotateZ(Math.PI / 2), -1.55, 0, 0), 'woodDark'),
      paint(place(new IcosahedronGeometry(0.42, 0), 1.65, 0.22, 0), 'gold'),
      paint(place(new ConeGeometry(0.16, 0.55, 4).rotateZ(-Math.PI / 2), 2.12, 0.12, 0), 'ember'),
      // Kuyruk yelpazesi.
      paint(place(new BoxGeometry(1.1, 0.1, 1.4), -2.45, 0, 0), 'leather'),
      paint(place(new BoxGeometry(0.5, 0.08, 1.5), -3.05, 0, 0), 'sootBlack'),
      // Pençeler.
      paint(place(new BoxGeometry(0.18, 0.55, 0.18), 0.35, -0.55, 0.28), 'gold'),
      paint(place(new BoxGeometry(0.18, 0.55, 0.18), 0.35, -0.55, -0.28), 'gold'),
    ]),
    0.8,
    1.15,
  );

/** Tek kanat (+Z yönüne açılır, kök orijinde); diğer kanat aynalanır. */
const eagleWing = (side: 1 | -1): BufferGeometry => {
  const g = merge([
    paint(place(new BoxGeometry(2.0, 0.14, 2.4), 0.1, 0, 1.2), 'woodDark'),
    paint(place(new BoxGeometry(1.2, 0.1, 2.3), 0.45, 0.04, 1.3), 'leather'),
    paint(place(new BoxGeometry(1.7, 0.1, 2.0), -0.15, 0, 3.3, 0.08), 'woodDark'),
    // Uç tüyleri (parmak gibi açılan siyah kalem tüyler).
    paint(place(new BoxGeometry(0.34, 0.07, 1.4), 0.35, 0, 4.85, -0.1), 'sootBlack'),
    paint(place(new BoxGeometry(0.34, 0.07, 1.4), -0.1, 0, 4.9, 0.08), 'sootBlack'),
    paint(place(new BoxGeometry(0.34, 0.07, 1.3), -0.55, 0, 4.75, 0.25), 'sootBlack'),
    paint(place(new BoxGeometry(0.34, 0.07, 1.2), -0.95, 0, 4.5, 0.42), 'sootBlack'),
  ]);
  // Ayna yerine X ekseninde 180° döndürme: üçgen sarımı bozulmaz (yüzler doğru aydınlanır).
  if (side === -1) g.rotateX(Math.PI);
  return verticalShade(g, 0.85, 1.05);
};

const additive = (color: string, opacity = 0.85) =>
  new MeshBasicNodeMaterial({
    color: new Color(color),
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });

export class SpellShow {
  readonly meshes: InstancedMesh[];
  private readonly shows: Show[] = [];
  private readonly body: InstancedMesh;
  private readonly wingL: InstancedMesh;
  private readonly wingR: InstancedMesh;
  private readonly wave: InstancedMesh;
  private readonly foam: InstancedMesh;
  private readonly pool: InstancedMesh;
  private readonly crack: InstancedMesh;
  private readonly crackGlow: InstancedMesh;
  private readonly rocks: InstancedMesh;
  private readonly dust: InstancedMesh;
  private readonly flare: InstancedMesh;
  private readonly rays: InstancedMesh;
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly q2 = new Quaternion();
  private readonly p = new Vector3();
  private readonly s = new Vector3();
  private readonly c = new Color();
  private readonly ax = new Vector3(1, 0, 0);
  private readonly ay = new Vector3(0, 1, 0);
  private readonly az = new Vector3(0, 0, 1);
  private flash: HTMLDivElement | null = null;
  /** Kamera sarsıntısı isteği (genlik m, süre s). */
  onShake: ((amp: number, dur: number) => void) | null = null;
  /** Ses olayları. */
  onSound: ((kind: 'eagle' | 'eagleHit' | 'flood' | 'quake' | 'flare') => void) | null = null;

  constructor(palette: Texture, params: ToonParams) {
    const toon = createToonMaterial(palette, params);
    this.body = new InstancedMesh(eagleBody(), toon, 8);
    this.wingL = new InstancedMesh(eagleWing(1), toon, 8);
    this.wingR = new InstancedMesh(eagleWing(-1), toon, 8);
    // Sel: açık silindir duvar (köpüklü dalga cephesi) + üstte beyaz köpük halkası.
    const waveMat = new MeshBasicNodeMaterial({
      color: new Color('#3f8fc8'),
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      side: DoubleSide,
    });
    this.wave = new InstancedMesh(
      new CylinderGeometry(1, 1.04, 1, 48, 1, true).translate(0, 0.5, 0),
      waveMat,
      4,
    );
    this.pool = new InstancedMesh(
      new RingGeometry(0, 1, 48).rotateX(-Math.PI / 2),
      new MeshBasicNodeMaterial({
        color: new Color('#2f78b0'),
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
      4,
    );
    this.foam = new InstancedMesh(
      new RingGeometry(0.93, 1.06, 48).rotateX(-Math.PI / 2),
      additive('#cfefff', 0.9),
      4,
    );
    // Deprem: zeminde koyu çatlak şeritleri + toz halkaları.
    const crackMat = new MeshBasicNodeMaterial({
      color: new Color('#1a0f08'),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.crack = new InstancedMesh(new BoxGeometry(1, 0.06, 1), crackMat, 64);
    // Çatlakların içinden sızan kızıl ışık ve sarsıntıyla fırlayan kaya parçaları.
    this.crackGlow = new InstancedMesh(new BoxGeometry(1, 0.08, 0.35), additive('#ff7a2a', 0.8), 64);
    this.rocks = new InstancedMesh(
      verticalShade(paint(new IcosahedronGeometry(0.45, 0), 'rock'), 0.7, 1.1),
      toon,
      48,
    );
    this.rocks.castShadow = true;
    const dustMat = new MeshBasicNodeMaterial({
      color: new Color('#a08a68'),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: DoubleSide,
    });
    this.dust = new InstancedMesh(
      new CylinderGeometry(1, 1.15, 1, 24, 1, true).translate(0, 0.5, 0),
      dustMat,
      16,
    );
    // Güneş Parlaması: parlak kubbe + gökten inen ışık sütunu ve ışınlar.
    this.flare = new InstancedMesh(new IcosahedronGeometry(1, 4), additive('#ffe7a0', 0.4), 4);
    this.rays = new InstancedMesh(
      new ConeGeometry(1, 1, 24, 1, true).translate(0, -0.5, 0),
      additive('#fff2c0', 0.16),
      4,
    );
    this.meshes = [
      this.body,
      this.wingL,
      this.wingR,
      this.pool,
      this.wave,
      this.foam,
      this.crack,
      this.crackGlow,
      this.rocks,
      this.dust,
      this.flare,
      this.rays,
    ];
    for (const mesh of this.meshes) {
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.name = 'spell-show';
    }
    for (const mesh of [this.body, this.wingL, this.wingR]) mesh.castShadow = true;
    for (const mesh of [
      this.pool,
      this.wave,
      this.foam,
      this.crack,
      this.crackGlow,
      this.dust,
      this.flare,
      this.rays,
    ])
      mesh.setColorAt(0, new Color(1, 1, 1));
    for (const mesh of [
      this.pool,
      this.wave,
      this.foam,
      this.crack,
      this.crackGlow,
      this.dust,
      this.flare,
      this.rays,
    ])
      mesh.renderOrder = 5;
  }

  /** Güç kullanıldı: gösteriyi başlat. key = SpellDef.key. */
  cast(key: string, x: number, y: number, z: number, radius: number): void {
    if (key === 'eagles') {
      const dir = Math.atan2(-z, -x) + Math.PI * 0.15;
      const eagles = Array.from({ length: EAGLES.dives }, (_, i) => {
        const [ox, oz] = EAGLE_OFFSETS[i % 4] as [number, number];
        return { x: x + ox, z: z + oz, y, hit: EAGLES.delay + i * EAGLES.gap, dir: dir + (i - 1) * 0.5 };
      });
      this.shows.push({
        kind: 'eagles',
        x,
        y,
        z,
        radius,
        age: 0,
        life: EAGLES.delay + EAGLES.dives * EAGLES.gap + 2,
        eagles,
      });
      this.onSound?.('eagle');
    } else if (key === 'flood') {
      this.shows.push({ kind: 'flood', x, y, z, radius, age: 0, life: FLOOD.rings * FLOOD.gap + 0.9 });
      this.onSound?.('flood');
    } else if (key === 'earthquake') {
      const cracks: [number, number, number][] = [];
      for (let i = 0; i < 14; i++)
        cracks.push([
          (i / 14) * Math.PI * 2 + Math.random() * 0.4,
          3 + Math.random() * 5,
          Math.random() * radius * 0.6,
        ]);
      this.shows.push({
        kind: 'quake',
        x,
        y,
        z,
        radius,
        age: 0,
        life: EARTHQUAKE.pulses * EARTHQUAKE.gap + 1.5,
        cracks,
      });
      this.onShake?.(0.9, EARTHQUAKE.pulses * EARTHQUAKE.gap + 0.4);
      this.onSound?.('quake');
    } else if (key === 'sun_flare') {
      this.shows.push({ kind: 'flare', x, y, z, radius, age: 0, life: 2.2 });
      this.screenFlash();
      this.onSound?.('flare');
    }
  }

  private screenFlash(): void {
    if (typeof document === 'undefined') return;
    if (!this.flash) {
      this.flash = document.createElement('div');
      this.flash.id = 'flare-flash';
      document.body.appendChild(this.flash);
    }
    const f = this.flash;
    f.classList.remove('on');
    void f.offsetWidth;
    f.classList.add('on');
  }

  update(dt: number): void {
    let nb = 0;
    let nw = 0;
    let nc = 0;
    let nd = 0;
    let nf = 0;
    let nr = 0;
    let keep = 0;
    for (const sh of this.shows) {
      const prev = sh.age;
      sh.age += dt;
      if (sh.age >= sh.life) continue;
      this.shows[keep++] = sh;
      const t = sh.age;
      if (sh.kind === 'eagles' && sh.eagles) {
        for (const e of sh.eagles) {
          // Yol: uzaktan ve yüksekten süzülüş → hedefe dalış → tırmanarak uzaklaşma.
          const u = t - e.hit;
          if (u < -2.2 || u > 2.4) continue;
          const dist = u < 0 ? -u * 30 : u * 26;
          const alt = u < 0 ? 2.5 + u * u * 9 : 2.5 + u * u * 7 + u * 4;
          const sgn = u < 0 ? -1 : 1;
          const px = e.x + Math.cos(e.dir) * dist * sgn;
          const pz = e.z + Math.sin(e.dir) * dist * sgn;
          // Uçuş yönü: dalışta hedefe doğru (geliş tersi), sonra aynı yönde devam; burun dalışta
          // aşağı, tırmanışta yukarı.
          const fwd = u < 0 ? e.dir + Math.PI : e.dir;
          const pitch = u < 0 ? -0.45 * Math.min(1, -u) : 0.4 * Math.min(1, u * 1.5);
          this.q.setFromAxisAngle(this.ay, -fwd);
          this.q2.setFromAxisAngle(this.az, pitch);
          this.q.multiply(this.q2);
          this.m.compose(this.p.set(px, e.y + alt, pz), this.q, this.s.set(2, 2, 2));
          this.body.setMatrixAt(nb, this.m);
          // Kanat çırpışı: dalışta kanatlar toplanır, sonra güçlü çırpış.
          const flap = Math.abs(u) < 0.3 ? 0.75 : 0.1 + Math.sin(t * (u < 0 ? 4 : 8)) * 0.5;
          this.q2.setFromAxisAngle(this.ax, -flap);
          this.m.compose(this.p, this.q.clone().multiply(this.q2), this.s);
          this.wingL.setMatrixAt(nb, this.m);
          this.q2.setFromAxisAngle(this.ax, flap);
          this.m.compose(this.p, this.q.clone().multiply(this.q2), this.s);
          this.wingR.setMatrixAt(nb, this.m);
          nb++;
          // Darbe anı: toz halkası + sarsıntı.
          if (prev < e.hit && t >= e.hit) {
            this.onShake?.(0.5, 0.4);
            this.onSound?.('eagleHit');
          }
          if (u >= 0 && u < 0.8 && nd < 16) {
            const k = u / 0.8;
            this.m.compose(
              this.p.set(e.x, e.y, e.z),
              this.q.identity(),
              this.s.set(2 + k * EAGLES.radius, 1.2 + k * 1.5, 2 + k * EAGLES.radius),
            );
            this.dust.setMatrixAt(nd, this.m);
            this.dust.setColorAt(nd, this.c.set('#b8a07a').multiplyScalar(1 - k));
            nd++;
          }
        }
      } else if (sh.kind === 'flood') {
        const total = FLOOD.rings * FLOOD.gap;
        const k = Math.min(1, t / total);
        const r = 1 + sh.radius * k;
        const fade = t > total ? 1 - (t - total) / (sh.life - total) : 1;
        const h = (2.6 - 1.4 * k) * fade;
        this.m.compose(
          this.p.set(sh.x, sh.y - 0.2, sh.z),
          this.q.identity(),
          this.s.set(r, Math.max(0.05, h), r),
        );
        this.wave.setMatrixAt(nw, this.m);
        this.wave.setColorAt(nw, this.c.set('#4a9ad4').multiplyScalar(0.6 + 0.4 * fade));
        this.m.compose(this.p.set(sh.x, sh.y - 0.2 + h, sh.z), this.q.identity(), this.s.set(r, 1, r));
        this.foam.setMatrixAt(nw, this.m);
        this.foam.setColorAt(nw, this.c.set('#d8f2ff').multiplyScalar(fade));
        // Dalganın ardında kalan sığ su örtüsü.
        this.m.compose(
          this.p.set(sh.x, sh.y + 0.25, sh.z),
          this.q.identity(),
          this.s.set(r * 0.98, 1, r * 0.98),
        );
        this.pool.setMatrixAt(nw, this.m);
        this.pool.setColorAt(nw, this.c.set('#ffffff').multiplyScalar(0.4 + 0.6 * fade));
        nw++;
      } else if (sh.kind === 'quake' && sh.cracks) {
        const grow = Math.min(1, t / 1.2);
        const fade = Math.min(1, (sh.life - t) / 1.0);
        for (const [a, len, d0] of sh.cracks) {
          if (nc >= 64) break;
          const l = len * grow;
          const cx = sh.x + Math.cos(a) * (d0 + l / 2);
          const cz = sh.z + Math.sin(a) * (d0 + l / 2);
          this.q.setFromAxisAngle(this.ay, -a);
          this.m.compose(this.p.set(cx, sh.y + 0.1, cz), this.q, this.s.set(Math.max(0.01, l), 1, 0.9));
          this.crack.setMatrixAt(nc, this.m);
          this.crack.setColorAt(nc, this.c.setRGB(fade, fade, fade));
          this.m.compose(this.p.set(cx, sh.y + 0.16, cz), this.q, this.s.set(Math.max(0.01, l * 0.9), 1, 1));
          this.crackGlow.setMatrixAt(nc, this.m);
          const ember = fade * (0.6 + 0.4 * Math.sin(t * 9 + a * 3));
          this.crackGlow.setColorAt(nc, this.c.set('#ff7a2a').multiplyScalar(ember));
          nc++;
        }
        // Her sarsıntıda bir toz halkası ve fırlayan kayalar.
        const shaking = t < EARTHQUAKE.pulses * EARTHQUAKE.gap;
        const pulse = Math.floor(t / EARTHQUAKE.gap);
        const phase = (t % EARTHQUAKE.gap) / EARTHQUAKE.gap;
        if (shaking && nd < 16) {
          const r = sh.radius * (0.3 + 0.7 * phase);
          this.m.compose(
            this.p.set(sh.x, sh.y - 0.1, sh.z),
            this.q.identity(),
            this.s.set(r, 2.6 * (1 - phase) + 0.1, r),
          );
          this.dust.setMatrixAt(nd, this.m);
          this.dust.setColorAt(nd, this.c.set('#c8b48e'));
          nd++;
        }
        if (shaking)
          for (let k = 0; k < 8 && nr < 48; k++) {
            // Kaya k'nın bu sarsıntıdaki yolu (sözde-rastgele, sabit tohumla).
            const h = Math.sin((pulse * 8 + k) * 12.9898 + sh.x * 0.37) * 43758.5453;
            const r1 = h - Math.floor(h);
            const r2 = (h * 7.13) % 1;
            const ang = r1 * Math.PI * 2;
            const dist = Math.abs(r2) * sh.radius * 0.8;
            const up = 4 + 5 * r1;
            const yy = sh.y + up * 4 * phase * (1 - phase);
            const rx = sh.x + Math.cos(ang) * (dist + phase * 1.5);
            const rz = sh.z + Math.sin(ang) * (dist + phase * 1.5);
            this.q.setFromAxisAngle(this.ax, phase * 6 + k);
            const sc = 0.6 + r1 * 0.9;
            this.m.compose(this.p.set(rx, yy, rz), this.q, this.s.set(sc, sc, sc));
            this.rocks.setMatrixAt(nr++, this.m);
          }
      } else if (sh.kind === 'flare') {
        const k = t / sh.life;
        const pop = k < 0.15 ? k / 0.15 : 1;
        const fade = 1 - k;
        const r = sh.radius * (0.4 + 0.6 * pop);
        this.m.compose(this.p.set(sh.x, sh.y, sh.z), this.q.identity(), this.s.set(r, r * 0.55, r));
        this.flare.setMatrixAt(nf, this.m);
        this.flare.setColorAt(nf, this.c.set('#ffe7a0').multiplyScalar(fade * 1.6));
        this.m.compose(
          this.p.set(sh.x, sh.y + 70, sh.z),
          this.q.identity(),
          this.s.set(r * 0.55, 70, r * 0.55),
        );
        this.rays.setMatrixAt(nf, this.m);
        this.rays.setColorAt(nf, this.c.set('#fff2c0').multiplyScalar(fade));
        nf++;
      }
    }
    this.shows.length = keep;
    const set = (mesh: InstancedMesh, n: number) => {
      mesh.count = n;
      if (n === 0) return;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    set(this.body, nb);
    set(this.wingL, nb);
    set(this.wingR, nb);
    set(this.wave, nw);
    set(this.pool, nw);
    set(this.foam, nw);
    set(this.crack, nc);
    set(this.crackGlow, nc);
    set(this.rocks, nr);
    set(this.dust, nd);
    set(this.flare, nf);
    set(this.rays, nf);
  }
}
