import { COMMAND_POINTS, UNIT_DEFS, unitCp } from '@bulwark/shared';
import { query } from 'bitecs';
import { QUEUE_STRIDE, StructureKind } from '../components';
import type { SimWorld } from '../world';

export const CP_OF = UNIT_DEFS.map(unitCp);

/** Takımın kullandığı komuta puanı (kuyruktakiler dahil) ve tavanı (çiftlik seviyeleriyle artar). */
export const commandPoints = (world: SimWorld, team: number): { used: number; cap: number } => {
  const { Battalion, Structure, Team } = world.c;
  let used = 0;
  for (const b of query(world, [Battalion]))
    if (Team.id[b] === team && (Battalion.count[b] as number) > 0)
      used += CP_OF[Battalion.unitType[b] as number] ?? 0;
  let farms = 0;
  for (const e of query(world, [Structure])) {
    if (Team.id[e] !== team || (Structure.hp[e] as number) <= 0) continue;
    const kind = Structure.kind[e] as number;
    if (kind === StructureKind.Barracks)
      for (let i = 0; i < (Structure.qLen[e] as number); i++)
        used += CP_OF[Structure.queue[e * QUEUE_STRIDE + i] as number] ?? 0;
    else if (kind === StructureKind.Farm && (Structure.buildLeft[e] as number) <= 0)
      farms += (Structure.level[e] as number) + 1;
  }
  return {
    used,
    cap: Math.min(COMMAND_POINTS.max, COMMAND_POINTS.base + farms * COMMAND_POINTS.perFarmLevel),
  };
};
