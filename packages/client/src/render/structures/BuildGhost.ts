import { BUILDING_KINDS } from '@bulwark/shared';
import { Color, InstancedMesh, Matrix4, Quaternion, type Texture, Vector3 } from 'three/webgpu';
import { createToonMaterial, type ToonParams } from '../materials/ToonMaterial';
import { MODELS } from './StructureRenderer';

/**
 * İnşa önizlemesi (BFME2 hayalet bina): işçiyle yer seçerken imleci izleyen yarı saydam yapı.
 * Uygun yerde yeşilimsi, uygunsuz yerde kırmızı. Yapı türü başına tek instance'lık InstancedMesh.
 */
const OK = new Color(0.75, 1.25, 0.8);
const BAD = new Color(1.5, 0.45, 0.4);

export class BuildGhost {
  readonly meshes: InstancedMesh[] = [];
  private shown = -1;
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly up = new Vector3(0, 1, 0);
  private readonly p = new Vector3();
  private readonly s = new Vector3(1, 1, 1);

  constructor(palette: Texture, params: ToonParams) {
    const mat = createToonMaterial(palette, params);
    mat.transparent = true;
    mat.opacity = 0.55;
    mat.depthWrite = false;
    for (const kind of BUILDING_KINDS) {
      const model = MODELS[kind];
      if (!model) continue;
      const mesh = new InstancedMesh(model.build(), mat, 1);
      mesh.name = `ghost:${kind}`;
      mesh.frustumCulled = false;
      mesh.renderOrder = 7;
      mesh.count = 0;
      mesh.setColorAt(0, OK);
      this.meshes.push(mesh);
    }
  }

  show(kind: number, x: number, y: number, z: number, yaw: number, ok: boolean): void {
    if (this.shown !== kind) this.hide();
    const mesh = this.meshes[kind];
    if (!mesh) return;
    this.shown = kind;
    this.q.setFromAxisAngle(this.up, yaw);
    this.m.compose(this.p.set(x, y, z), this.q, this.s);
    mesh.setMatrixAt(0, this.m);
    mesh.setColorAt(0, ok ? OK : BAD);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = 1;
  }

  hide(): void {
    for (const m of this.meshes) m.count = 0;
    this.shown = -1;
  }
}
