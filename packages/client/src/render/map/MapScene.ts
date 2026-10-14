import type { MapDef } from '@bulwark/shared';
import type { BufferGeometry, Group, Object3D } from 'three/webgpu';
import type { FloatUniform } from '../tsl-types';
import type { SlotMarkers } from './SlotMarkers';
import type { HeightFn } from './terrain';

/** Render tarafında yüklenmiş bir harita. Tüm haritalar (look-dev dahil) bu arayüzü döner. */
export interface MapScene {
  name: string;
  root: Group;
  heightAt: HeightFn;
  /** Kare harita kenarı (m). */
  size: number;
  /** Picking için dünya uzayında birleşik çarpışma geometrisi (arazi + yapılar). */
  collider: BufferGeometry;
  home: { x: number; z: number; yaw: number; distance: number };
  stats: { instances: number; batches: number };
  flameIntensity: FloatUniform;
  def?: MapDef;
  slots?: SlotMarkers;
  /** Koridor / spawn debug çizimi (varsayılan gizli). */
  debugOverlay?: Object3D;
}
