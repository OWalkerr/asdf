import GUI from 'lil-gui';
import Stats from 'stats-gl';
import type { Object3D, WebGPURenderer } from 'three/webgpu';
import type { RTSCamera } from '../render/camera/RTSCamera';
import type { LightingRig } from '../render/lighting';
import type { ToonParams } from '../render/materials/ToonMaterial';
import type { RenderContext } from '../render/renderer';

/** lil-gui tweak paneli + stats-gl (CPU/GPU frame süresi). `?debug=0` ile gizlenir. */
export interface DebugHooks {
  ctx: RenderContext;
  cam: RTSCamera;
  light: LightingRig;
  toon: ToonParams;
  flameIntensity: { value: number };
  /** Harita debug katmanı (koridorlar, spawn'lar). */
  overlay?: Object3D | undefined;
  navOverlay?: Object3D | undefined;
  sim?: { speed: number; setSpeed(v: number): void; actions: Record<string, () => void> };
}

export const createDebugPanel = async (renderer: WebGPURenderer, hooks: DebugHooks) => {
  const visible = new URLSearchParams(location.search).get('debug') !== '0';
  const stats = new Stats({ trackGPU: true, horizontal: true });
  await stats.init(renderer);
  if (visible) document.body.appendChild(stats.dom);

  const gui = new GUI({ title: 'Bulwark · Look-dev' });
  if (!visible) gui.hide();
  const { ctx, cam, light, toon } = hooks;

  const r = gui.addFolder('Render');
  r.add(ctx, 'usePost').name('Post-process');
  r.add(ctx.bloomStrength, 'value', 0, 2, 0.01).name('Bloom gücü');
  r.add(ctx.renderer, 'toneMappingExposure', 0.4, 2, 0.01).name('Pozlama');
  r.add(hooks.flameIntensity, 'value', 0, 10, 0.1).name('Alev emissive');
  if (hooks.overlay) r.add(hooks.overlay, 'visible').name('Koridor/spawn katmanı');
  if (hooks.navOverlay) r.add(hooks.navOverlay, 'visible').name('Nav ızgarası sınırı');

  const l = gui.addFolder('Işık');
  l.add(light, 'azimuth', 0, 360, 1).name('Güneş azimut').onChange(light.applySun);
  l.add(light, 'elevation', 5, 89, 1).name('Güneş yükseklik').onChange(light.applySun);
  l.add(light.sun, 'intensity', 0, 6, 0.05).name('Güneş şiddeti');
  l.addColor(light.sun, 'color').name('Güneş rengi');
  l.add(light.hemi, 'intensity', 0, 3, 0.05).name('Ambient şiddeti');
  l.addColor(light.hemi, 'color').name('Gökyüzü');
  l.addColor(light.hemi, 'groundColor').name('Zemin yansıma');
  l.add(light.sun, 'castShadow').name('Gölgeler');
  l.add(light.fog, 'near', 0, 500, 1).name('Sis başlangıç');
  l.add(light.fog, 'far', 50, 1000, 1).name('Sis bitiş');

  const t = gui.addFolder('Toon shader');
  const ramp = { shadow: 90 / 255, mid: 170 / 255, lit: 1 };
  const applyRamp = () => toon.setRamp(ramp.shadow, ramp.mid, ramp.lit);
  t.add(ramp, 'shadow', 0, 1, 0.01).name('Ramp gölge').onChange(applyRamp);
  t.add(ramp, 'mid', 0, 1, 0.01).name('Ramp orta').onChange(applyRamp);
  t.add(ramp, 'lit', 0, 1, 0.01).name('Ramp aydınlık').onChange(applyRamp);
  t.add(toon.rimStrength, 'value', 0, 1, 0.01).name('Rim gücü');
  t.add(toon.rimPower, 'value', 0.5, 8, 0.1).name('Rim keskinlik');
  t.addColor(toon.rimColor, 'value').name('Rim rengi');

  if (hooks.sim) {
    const simHooks = hooks.sim;
    const sf = gui.addFolder('Simülasyon');
    sf.add(simHooks, 'speed', 0.1, 4, 0.1)
      .name('Hız ×')
      .onChange((v: number) => simHooks.setSpeed(v));
    for (const [label, fn] of Object.entries(simHooks.actions)) sf.add({ [label]: fn }, label);
  }

  const c = gui.addFolder('Kamera');
  c.add(cam, 'panSpeed', 0.2, 3, 0.05).name('Kaydırma hızı');
  c.add(cam, 'rotateSpeed', 0.2, 4, 0.05).name('Dönüş hızı');
  c.add(cam, 'damping', 2, 30, 0.5).name('Yumuşatma');
  c.add(cam, 'edgePan').name('Kenar kaydırma');
  c.add(cam.opts, 'pitchNear', 15, 80, 1).name('Pitch (yakın)');
  c.add(cam.opts, 'pitchFar', 15, 89, 1).name('Pitch (uzak)');
  c.add(cam.camera, 'fov', 20, 70, 1)
    .name('FOV')
    .onChange(() => cam.camera.updateProjectionMatrix());
  c.close();

  return {
    stats,
    gui,
    update() {
      stats.update();
    },
  };
};
