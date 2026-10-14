import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { BufferAttribute, type BufferGeometry, Matrix4, Vector3 } from 'three/webgpu';
import { type Swatch, swatchUV } from '../palette';

/**
 * Low-poly geometri yardımcıları (GDD §3.1).
 * Tüm statik/birim geometrileri aynı attribute setine sahip olmalıdır (BatchedMesh şartı):
 *   position, normal (flat), uv (palet hücresi), color (vertex AO/gradient)
 * ve index içermez (flat shading için her üçgen kendi köşelerine sahiptir).
 */

/** Geometriyi tek palet rengine boyar ve standart forma getirir. */
export const paint = (geo: BufferGeometry, swatch: Swatch, shade = 1): BufferGeometry => {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('normal');
  const count = g.getAttribute('position').count;
  const [u, v] = swatchUV(swatch);
  const uvs = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }
  g.setAttribute('uv', new BufferAttribute(uvs, 2));
  g.setAttribute('color', new BufferAttribute(new Float32Array(count * 3).fill(shade), 3));
  g.computeVertexNormals(); // index yok → yüz normali = flat shading
  return g;
};

/** Boyanmış parçaları tek geometride birleştirir. */
export const merge = (parts: BufferGeometry[]): BufferGeometry => {
  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error('merge: uyumsuz attribute seti');
  for (const p of parts) p.dispose();
  return merged;
};

/** Parçayı yerinde dönüştürür (zincirleme için geometriyi döner). */
export const place = (
  geo: BufferGeometry,
  x = 0,
  y = 0,
  z = 0,
  rotY = 0,
  sx = 1,
  sy = sx,
  sz = sx,
): BufferGeometry => {
  geo.applyMatrix4(
    new Matrix4()
      .makeRotationY(rotY)
      .scale(new Vector3(sx, sy, sz))
      .setPosition(x, y, z),
  );
  return geo;
};

/**
 * Köşeleri rastgele iter (kaya, ağaç tepesi gibi organik formlar için).
 * Önce köşeler birleştirilir ki yüzeyde çatlak oluşmasın.
 */
export const jitter = (geo: BufferGeometry, amount: number, rand: () => number): BufferGeometry => {
  // uv/normal dikişleri köşe birleştirmeyi engeller; yalnızca pozisyonla birleştir.
  for (const name of Object.keys(geo.attributes)) if (name !== 'position') geo.deleteAttribute(name);
  const g = mergeVertices(geo, 1e-4);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      pos.getX(i) + (rand() - 0.5) * amount,
      pos.getY(i) + (rand() - 0.5) * amount,
      pos.getZ(i) + (rand() - 0.5) * amount,
    );
  }
  return g;
};

/** Y ekseninde dikey vertex-color gradyanı (altta koyu → "fake AO"). */
export const verticalShade = (geo: BufferGeometry, bottom = 0.7, top = 1.0): BufferGeometry => {
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  if (!box) return geo;
  const pos = geo.getAttribute('position');
  const col = geo.getAttribute('color');
  const h = Math.max(1e-4, box.max.y - box.min.y);
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - box.min.y) / h;
    const s = bottom + (top - bottom) * t;
    col.setXYZ(i, col.getX(i) * s, col.getY(i) * s, col.getZ(i) * s);
  }
  return geo;
};
