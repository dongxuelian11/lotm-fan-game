import { resolveTimeWormOriginalsSnapshot, timeWormCharacteristicId } from '../time-worm/index.js';
import { ERROR_ASCENT_ORIGINAL_IDS, type ErrorAscentOriginalId, type ErrorAscentOriginSnapshot, type ErrorAscentOriginalResolution } from './types.js';
export const isErrorAscentOriginal = (id: unknown): id is ErrorAscentOriginalId => ERROR_ASCENT_ORIGINAL_IDS.some(x => x === id);
/** The strict S1 resolver reconstructs every paid recovery and unique lineage.
 * Independent historical fourth originals remain readable there, but are never
 * accepted here as a fourth characteristic or relabelled as recovered stock. */
export function resolveErrorAscentOriginals(snapshot: ErrorAscentOriginSnapshot): ErrorAscentOriginalResolution | null {
  try {
    const result = resolveTimeWormOriginalsSnapshot(snapshot);
    if (!result || !isErrorAscentOriginal(result.embodiedOriginalBottleId) || !result.embodiedBottleId || result.characteristics.length !== 3) return null;
    const characteristics: ErrorAscentOriginalResolution['characteristics'] = [];
    for (const originalBottleId of ERROR_ASCENT_ORIGINAL_IDS) {
      const c = result.characteristics.find(x => x.originalBottleId === originalBottleId);
      if (!c || c.characteristicId !== timeWormCharacteristicId(originalBottleId)) return null;
      const consumed = c.consumptionHistory.filter(x => x.bottleId === c.latestBottleId).at(-1);
      characteristics.push({ id: c.characteristicId, originalBottleId, latestBottleId: c.latestBottleId,
        holder: c.holder === 'FAILED_REMNANT' ? 'FAILED_REMAINS' : c.holder, consumeRevision: consumed?.revision ?? null });
    }
    if (characteristics.filter(c => c.holder === 'EMBODIED').length !== 1 ||
        snapshot.bottles.find(b => b.id === result.embodiedBottleId)?.consumedWeek !== snapshot.promotionWeek) return null;
    return { embodiedOriginalBottleId: result.embodiedOriginalBottleId, embodiedBottleId: result.embodiedBottleId, characteristics };
  } catch { return null; }
}
