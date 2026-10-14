import { Color, DirectionalLight, Fog, HemisphereLight, MathUtils, type Scene } from 'three/webgpu';

/**
 * Stilize aydınlatma (GDD §3.1): tek directional güneş + hemisphere ambient + mesafe sisi.
 * Gölge kamerası harita sınırına sabit ortho — cascade yok (performans).
 */
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
  const sky = new Color('#b9cbe0');
  scene.background = sky;
  const fog = new Fog(sky.clone(), 170, 430);
  scene.fog = fog;

  const hemi = new HemisphereLight('#cfe0f5', '#6b5a45', 1.1);
  scene.add(hemi);

  const sun = new DirectionalLight('#ffe4bd', 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
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
    azimuth: 118,
    elevation: 46,
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
