import {
  cameraPosition,
  dot,
  float,
  max,
  mix,
  normalize,
  positionWorld,
  pow,
  smoothstep,
  uniform,
  vec3,
} from 'three/tsl';
import { BackSide, Color, Mesh, MeshBasicNodeMaterial, SphereGeometry, Vector3 } from 'three/webgpu';
import type { ColorUniform, FloatUniform } from '../tsl-types';

/**
 * Fırtınalı alacakaranlık gökyüzü (GDD §3.5): kameraya bağlı ters yüzlü küre, TSL gradyanı.
 * Ufukta sisle aynı renk (dağlar sise karışır), güneş yönünde sönük turuncu ışıma,
 * zenit koyu çelik mavisi. `flash` şimşekte tüm kubbeyi aydınlatır.
 */
export interface Sky {
  mesh: Mesh;
  horizon: ColorUniform;
  zenith: ColorUniform;
  glow: ColorUniform;
  sunDir: { value: Vector3 };
  flash: FloatUniform;
  update(camPos: Vector3): void;
}

export const createSky = (horizonHex: string, zenithHex: string, glowHex: string): Sky => {
  const horizon = uniform(new Color(horizonHex));
  const zenith = uniform(new Color(zenithHex));
  const glow = uniform(new Color(glowHex));
  const sunDir = uniform(new Vector3(0.4, 0.2, 0.8).normalize());
  const flash = uniform(0);

  const dir = normalize(positionWorld.sub(cameraPosition));
  const h = dir.y;
  // Ufuk altında (dağ arkası) ufuk rengi; yukarı doğru koyulaşan bulut tavanı.
  const base = mix(horizon, zenith, smoothstep(0.0, 0.55, h));
  // Bulut bantları: yüksekliğe bağlı hafif katmanlaşma (doku yok, low-poly ruhuna uygun).
  const bands = smoothstep(0.08, 0.1, h)
    .mul(float(1).sub(smoothstep(0.1, 0.22, h)))
    .mul(0.08);
  const sun = pow(max(dot(dir, sunDir), 0), 6).mul(float(1).sub(smoothstep(0.0, 0.45, h)));
  const color = base
    .add(glow.mul(sun))
    .sub(vec3(bands, bands, bands))
    .add(vec3(0.55, 0.6, 0.75).mul(flash));

  const mat = new MeshBasicNodeMaterial({ side: BackSide, depthWrite: false, fog: false });
  mat.colorNode = color;
  const mesh = new Mesh(new SphereGeometry(900, 32, 16), mat);
  mesh.name = 'sky';
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return {
    mesh,
    horizon,
    zenith,
    glow,
    sunDir,
    flash,
    update(camPos) {
      mesh.position.copy(camPos);
    },
  };
};
