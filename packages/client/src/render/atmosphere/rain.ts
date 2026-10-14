import { attribute, float, fract, time, uniform, vec3 } from 'three/tsl';
import {
  BufferGeometry,
  Float32BufferAttribute,
  LineBasicNodeMaterial,
  LineSegments,
  Vector3,
} from 'three/webgpu';

/**
 * Yağmur (GDD §3.5 hava durumu): tek LineSegments, tüm hareket GPU'da (TSL).
 * Damla başına sabit tohum; konum = kamera hedefi çevresinde sarmalanan kutu, y = zamanla düşen
 * fract. CPU her karede yalnızca hedef konumunu (uniform) günceller.
 */
export interface Rain {
  mesh: LineSegments;
  center: { value: Vector3 };
  update(target: { x: number; z: number }, y?: number): void;
}

export const createRain = (count = 5000, box = new Vector3(180, 70, 180)): Rain => {
  const seeds = new Float32Array(count * 2 * 3);
  const ends = new Float32Array(count * 2);
  let s = 0x2545f491;
  const rnd = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const a = rnd();
    const b = rnd();
    const c = rnd();
    for (let k = 0; k < 2; k++) {
      seeds.set([a, b, c], (i * 2 + k) * 3);
      ends[i * 2 + k] = k;
    }
  }
  const geo = new BufferGeometry();
  // position zorunlu; gerçek konum positionNode'da hesaplanır.
  geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(count * 2 * 3), 3));
  geo.setAttribute('aSeed', new Float32BufferAttribute(seeds, 3));
  geo.setAttribute('aEnd', new Float32BufferAttribute(ends, 1));

  const center = uniform(new Vector3());
  const size = vec3(box.x, box.y, box.z);
  const seed = attribute('aSeed', 'vec3');
  const end = attribute('aEnd', 'float');
  const fall = float(46); // m/s
  const wind = vec3(-5, 0, 3);
  const t = time;
  // Düşen y: [0,1) tohum, zamanla azalır; rüzgâr x/z'de sürükler.
  const fy = fract(seed.y.sub(t.mul(fall).div(box.y)));
  const drift = wind.mul(float(1).sub(fy)).mul(box.y / 46);
  // Kamera hedefine göre sarmalama: dünya sabit damla ızgarası, kutu kamerayla kayar.
  const wx = fract(seed.x.add(drift.x.sub(center.x).div(size.x)))
    .sub(0.5)
    .mul(size.x)
    .add(center.x);
  const wz = fract(seed.z.add(drift.z.sub(center.z).div(size.z)))
    .sub(0.5)
    .mul(size.z)
    .add(center.z);
  const wy = fy.mul(size.y).add(center.y).sub(6);
  const streak = vec3(wind.x, fall.negate(), wind.z).normalize().mul(1.6).mul(end);

  const mat = new LineBasicNodeMaterial({ transparent: true, depthWrite: false, fog: true });
  mat.positionNode = vec3(wx, wy, wz).add(streak);
  mat.colorNode = vec3(0.72, 0.78, 0.88);
  mat.opacityNode = float(0.22).mul(float(0.4).add(end.mul(0.6)));
  const mesh = new LineSegments(geo, mat);
  mesh.name = 'rain';
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  return {
    mesh,
    center,
    update(target, y = 0) {
      center.value.set(target.x, y, target.z);
    },
  };
};
