import { resolveStarKeyOriginalsSnapshot, starKeyCharacteristicId } from '../star-key/index.js';
import { DOOR_ORIGINAL_IDS, type DoorOriginalId, type DoorOriginSnapshot, type DoorOriginalResolution } from './types.js';
export const isDoorOriginal = (id: unknown): id is DoorOriginalId => DOOR_ORIGINAL_IDS.some(x => x === id);
/** The strict S1 resolver reconstructs every paid recovery and unique lineage.
 * Independent historical fourth originals remain readable there, but are never
 * accepted here as a fourth characteristic or relabelled as recovered stock. */
export function resolveDoorOriginals(snapshot: DoorOriginSnapshot): DoorOriginalResolution | null {
  try {
    const result = resolveStarKeyOriginalsSnapshot(snapshot);
    if (!result || !isDoorOriginal(result.embodiedOriginalBottleId) || !result.embodiedBottleId || result.characteristics.length !== 3) return null;
    const characteristics: DoorOriginalResolution['characteristics'] = [];
    for (const originalBottleId of DOOR_ORIGINAL_IDS) {
      const c = result.characteristics.find(x => x.originalBottleId === originalBottleId);
      if (!c || c.characteristicId !== starKeyCharacteristicId(originalBottleId)) return null;
      const consumed = c.consumptionHistory.filter(x => x.bottleId === c.latestBottleId).at(-1);
      characteristics.push({ id: c.characteristicId, originalBottleId, latestBottleId: c.latestBottleId,
        holder: c.holder === 'FAILED_REMNANT' ? 'FAILED_REMAINS' : c.holder, consumeRevision: consumed?.revision ?? null });
    }
    if (characteristics.filter(c => c.holder === 'EMBODIED').length !== 1 ||
        snapshot.bottles.find(b => b.id === result.embodiedBottleId)?.consumedWeek !== snapshot.promotionWeek) return null;
    return { embodiedOriginalBottleId: result.embodiedOriginalBottleId, embodiedBottleId: result.embodiedBottleId, characteristics };
  } catch { return null; }
}
