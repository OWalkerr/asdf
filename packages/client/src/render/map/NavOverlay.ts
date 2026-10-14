import type { NavGrid } from '@bulwark/sim';
import { InstancedMesh, Matrix4, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';

/**
 * Navigasyon ızgarası debug katmanı: açık alana komşu kapalı hücreler (yani yürünebilir
 * alanın sınırı) kırmızı kareler olarak çizilir. Sim ile aynı buildNavGrid çıktısı.
 */
export const buildNavOverlay = (grid: NavGrid, groundY: (x: number, z: number) => number): InstancedMesh => {
  const { cols, rows, blocked, cellSize } = grid;
  const half = (cols * cellSize) / 2;
  const edge: number[] = [];
  for (let r = 1; r < rows - 1; r++)
    for (let c = 1; c < cols - 1; c++) {
      const i = r * cols + c;
      if (!blocked[i]) continue;
      if (!blocked[i - 1] || !blocked[i + 1] || !blocked[i - cols] || !blocked[i + cols]) edge.push(i);
    }
  const geo = new PlaneGeometry(cellSize * 0.9, cellSize * 0.9).rotateX(-Math.PI / 2);
  const mat = new MeshBasicNodeMaterial({
    color: '#ff3b2f',
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    depthTest: false,
  });
  const mesh = new InstancedMesh(geo, mat, Math.max(1, edge.length));
  const m = new Matrix4();
  edge.forEach((i, k) => {
    const x = -half + ((i % cols) + 0.5) * cellSize;
    const z = -half + (((i / cols) | 0) + 0.5) * cellSize;
    m.makeTranslation(x, groundY(x, z) + 0.4, z);
    mesh.setMatrixAt(k, m);
  });
  mesh.count = edge.length;
  mesh.name = 'nav-overlay';
  mesh.renderOrder = 9;
  mesh.visible = false;
  return mesh;
};
