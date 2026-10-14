import {
  dot,
  float,
  normalView,
  positionViewDirection,
  pow,
  saturate,
  texture,
  uniform,
  uv,
} from 'three/tsl';
import {
  Color,
  DataTexture,
  MeshToonNodeMaterial,
  NearestFilter,
  RedFormat,
  type Texture,
} from 'three/webgpu';
import { type ColorUniform, type FloatUniform, setEmissiveNode } from '../tsl-types';

/**
 * Stilize low-poly toon materyal (GDD §3.1, §13.5):
 * - Renk: palet atlasından (UV hücre merkezinde) × vertex color (AO / gradient)
 * - Işık: 3 kademeli toon ramp (gradientMap)
 * - Rim light: siluetleri izometrik kamerada arka plandan ayırır
 * Tüm parametreler TSL uniform'u; debug panelinden canlı ayarlanır.
 */
export interface ToonParams {
  rimColor: ColorUniform;
  rimStrength: FloatUniform;
  rimPower: FloatUniform;
  ramp: DataTexture;
  setRamp(shadow: number, mid: number, lit: number): void;
}

const createRamp = (): DataTexture => {
  const ramp = new DataTexture(new Uint8Array([90, 170, 255]), 3, 1, RedFormat);
  ramp.magFilter = NearestFilter;
  ramp.minFilter = NearestFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  return ramp;
};

/** Tüm toon materyallerin paylaştığı parametreler (tek global look). */
export const createToonParams = (): ToonParams => {
  const ramp = createRamp();
  return {
    rimColor: uniform(new Color('#fff1d6')),
    rimStrength: uniform(0.22),
    rimPower: uniform(3.0),
    ramp,
    setRamp(shadow, mid, lit) {
      (ramp.image.data as Uint8Array).set([shadow, mid, lit].map((v) => Math.round(v * 255)));
      ramp.needsUpdate = true;
    },
  };
};

export const createToonMaterial = (palette: Texture, params: ToonParams): MeshToonNodeMaterial => {
  const mat = new MeshToonNodeMaterial();
  mat.gradientMap = params.ramp;
  mat.vertexColors = true;
  mat.colorNode = texture(palette, uv());
  const facing = saturate(dot(normalView, positionViewDirection));
  setEmissiveNode(
    mat,
    params.rimColor.mul(pow(float(1).sub(facing), params.rimPower)).mul(params.rimStrength),
  );
  return mat;
};
