import { Color, DirectionalLight, Fog, HemisphereLight, MathUtils, type Scene } from 'three/webgpu';
import { getQuality, QUALITY } from './quality';

/**
 * Stilize aydınlatma (GDD §3.1): tek directional güneş + hemisphere ambient + mesafe sisi.
 * Güneş yönü `sunDirection` ile gökyüzü ışımasına da aktarılır.
 * Gölge kamerası harita sınırına sabit ortho — cascade yok (performans).
 */
/** Ufuk/sis rengi (gökyüzü kubbesi aynı rengi kullanır). */
export const FOG_COLOR = '#76808f';

export interface LightingRig {
  sun: DirectionalLight;
  hemi: HemisphereLight;
  fog: Fog;
  /** Güneş açıları (derece). */
  azimuth: number;
  elevation: number;
  applySun(): void;
}

export const createLighting = (scene: Scene, mapHalfSize: number): LightingRig => {
  // Fırtınalı alacakaranlık (Helm's Deep gecesine doğru): soğuk ambient, alçak sıcak güneş.
  // Sis rengi gökyüzü ufkuyla aynıdır (sky.ts) — uzak dağlar fırtınaya karışır.
  const horizon = new Color(FOG_COLOR);
  scene.background = horizon;
  const fog = new Fog(horizon.clone(), 160, 470);
  scene.fog = fog;

  const hemi = new HemisphereLight('#8a9cbc', '#3a342c', 0.95);
  scene.add(hemi);

  const sun = new DirectionalLight('#ffd2a6', 1.75);
  sun.castShadow = true;
  const sm = QUALITY[getQuality()].shadowMap;
  sun.shadow.mapSize.set(sm, sm);
  const cam = sun.shadow.camera;
  cam.left = -mapHalfSize;
  cam.right = mapHalfSize;
  cam.top = mapHalfSize;
  cam.bottom = -mapHalfSize;
  cam.near = 1;
  cam.far = mapHalfSize * 4;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);

  const rig: LightingRig = {
    sun,
    hemi,
    fog,
    azimuth: 128,
    elevation: 34,
    applySun() {
      const az = MathUtils.degToRad(rig.azimuth);
      const el = MathUtils.degToRad(rig.elevation);
      const d = mapHalfSize * 2;
      sun.position.set(Math.cos(el) * Math.cos(az) * d, Math.sin(el) * d, Math.cos(el) * Math.sin(az) * d);
      sun.target.position.set(0, 0, 0);
      sun.shadow.camera.updateProjectionMatrix();
    },
  };
  rig.applySun();
  return rig;
};
