import { float, positionWorld, sin, texture, time, uniform, uv } from 'three/tsl';
import { MeshToonNodeMaterial, type Texture } from 'three/webgpu';
import { type FloatUniform, setEmissiveNode } from '../tsl-types';

/**
 * Alev/büyü gibi parlayan yüzeyler için materyal (GDD §3.5 seçici bloom).
 * Emissive > 1 → bloom pass'ına girer. Dünya konumuna göre faz kaydırmalı titreşim.
 */
export const createFlameMaterial = (
  palette: Texture,
): { material: MeshToonNodeMaterial; intensity: FloatUniform } => {
  const intensity = uniform(4.0);
  const material = new MeshToonNodeMaterial();
  const base = texture(palette, uv());
  material.colorNode = base;
  const flicker = sin(time.mul(11).add(positionWorld.x.mul(3.1)).add(positionWorld.z))
    .mul(0.18)
    .add(float(1));
  setEmissiveNode(material, base.rgb.mul(intensity).mul(flicker));
  return { material, intensity };
};
