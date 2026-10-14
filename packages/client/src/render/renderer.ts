import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { emissive, mrt, output, pass, uniform } from 'three/tsl';
import {
  ACESFilmicToneMapping,
  type Camera,
  PCFShadowMap,
  RenderPipeline,
  type Scene,
  WebGPURenderer,
} from 'three/webgpu';
import type { FloatUniform } from './tsl-types';

export type Backend = 'webgpu' | 'webgl2';

export interface RenderContext {
  renderer: WebGPURenderer;
  backend: Backend;
  pipeline: RenderPipeline;
  /** Seçici bloom: yalnızca emissive kanalı parlar (GDD §3.5). */
  bloomStrength: FloatUniform;
  usePost: boolean;
  render(): void;
  resize(width: number, height: number): void;
}

/**
 * WebGPURenderer: WebGPU yoksa otomatik WebGL2 backend'e düşer (GDD §2.1).
 * `?webgl` query parametresi WebGL2'yi zorlar (iki backend'i de test etmek için).
 */
export const createRenderContext = async (
  canvas: HTMLCanvasElement,
  scene: Scene,
  camera: Camera,
): Promise<RenderContext> => {
  // `?webgl` veya sayfanın koyduğu `BULWARK_FORCE_WEBGL` bayrağı (adres parametresi taşımayan
  // gömülü/barındırılan sürümler için) WebGL2'yi zorlar.
  const forceWebGL =
    new URLSearchParams(location.search).has('webgl') ||
    (globalThis as { BULWARK_FORCE_WEBGL?: boolean }).BULWARK_FORCE_WEBGL === true;
  const renderer = new WebGPURenderer({
    canvas,
    antialias: true,
    forceWebGL,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap; // r186: PCFSoft kaldırıldı, PCF zaten yumuşak filtreli
  // WebGPU sürücü/tarayıcı uyumsuzluğunda sayfayı WebGL2 ile yeniden aç. İki belirti var:
  // cihaz kaybı (onDeviceLost) ve kısmi WebGPU desteğinde her karede fırlayan istisnalar.
  const fallbackToWebGL = (reason: string) => {
    console.error(`WebGPU kullanılamıyor (${reason}), WebGL2 ile yeniden başlatılıyor.`);
    if (forceWebGL) return;
    const url = new URL(location.href);
    url.searchParams.set('webgl', '1');
    location.replace(url);
  };
  renderer.onDeviceLost = (info) => fallbackToWebGL(info.message);
  await renderer.init();

  const backend: Backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend
    ? 'webgpu'
    : 'webgl2';

  // Post-process: sahne pass'ı (renk + emissive MRT) → seçici bloom → tonemap.
  const scenePass = pass(scene, camera);
  scenePass.setMRT(mrt({ output, emissive }));
  const sceneColor = scenePass.getTextureNode('output');
  const sceneEmissive = scenePass.getTextureNode('emissive');
  const bloomStrength = uniform(0.6);
  const bloomPass = bloom(sceneEmissive, 1, 0.4, 0);
  bloomPass.strength = bloomStrength;
  const pipeline = new RenderPipeline(renderer);
  pipeline.outputNode = sceneColor.add(bloomPass);

  // Üst üste bu kadar kare hata verirse WebGPU backend'i bozuk kabul edilir.
  const MAX_RENDER_ERRORS = 5;
  let consecutiveErrors = 0;
  const ctx: RenderContext = {
    renderer,
    backend,
    pipeline,
    bloomStrength,
    usePost: true,
    render() {
      try {
        if (ctx.usePost) pipeline.render();
        else renderer.render(scene, camera);
        consecutiveErrors = 0;
      } catch (err) {
        consecutiveErrors++;
        if (consecutiveErrors === 1) console.error(err);
        if (backend === 'webgpu' && consecutiveErrors >= MAX_RENDER_ERRORS) {
          fallbackToWebGL(err instanceof Error ? err.message : String(err));
        }
      }
    },
    resize(width, height) {
      renderer.setSize(width, height, false);
    },
  };
  return ctx;
};
