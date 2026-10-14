import type { Color, Node, NodeMaterial, UniformNode } from 'three/webgpu';

/** TSL uniform kısayolları (@types/three generic'leri uzun). */
export type FloatUniform = UniformNode<'float', number>;
export type ColorUniform = UniformNode<'color', Color>;

/**
 * NodeMaterial çalışma zamanında tüm materyallerde `emissiveNode`u destekler
 * (three r186 NodeMaterial.setupLighting), ancak @types/three yalnızca Standard'da tanımlar.
 */
export const setEmissiveNode = (mat: NodeMaterial, node: Node): void => {
  (mat as NodeMaterial & { emissiveNode: Node | null }).emissiveNode = node;
};
