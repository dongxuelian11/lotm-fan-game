import { resolveDivineHandOriginalsSnapshot, divineHandCharacteristicId } from '../divine-hand/index.js';
import { TWILIGHT_GIANT_ORIGINAL_IDS, type TwilightGiantOriginalId, type TwilightGiantOriginSnapshot, type TwilightGiantOriginalResolution } from './types.js';
export const isTwilightGiantOriginal = (id: unknown): id is TwilightGiantOriginalId => TWILIGHT_GIANT_ORIGINAL_IDS.some(x => x === id);
export const twilightGiantCharacteristicId = divineHandCharacteristicId;
/** Three conserved identities, independent of which legal attempt succeeded.
 * The caller separately authenticates the complete predecessor state and RNG.
 * Historical independent potion-4+ is rejected, never relabelled as recovery. */
export function resolveTwilightGiantOriginals(snapshot: TwilightGiantOriginSnapshot): TwilightGiantOriginalResolution | null {
  try {
    const result = resolveDivineHandOriginalsSnapshot(snapshot);
    if (!result || !isTwilightGiantOriginal(result.embodiedOriginalBottleId) || !result.embodiedBottleId || result.characteristics.length !== 3) return null;
    const characteristics: TwilightGiantOriginalResolution['characteristics'] = [];
    for (const originalBottleId of TWILIGHT_GIANT_ORIGINAL_IDS) {
      const c = result.characteristics.find(x => x.originalBottleId === originalBottleId);
      if (!c || c.characteristicId !== twilightGiantCharacteristicId(originalBottleId)) return null;
      const consumed = c.consumptionHistory.filter(x => x.bottleId === c.latestBottleId).at(-1);
      characteristics.push({ id: c.characteristicId, originalBottleId, latestBottleId: c.latestBottleId,
        holder: c.holder === 'FAILED_REMNANT' ? 'FAILED_REMAINS' : c.holder, consumeRevision: consumed?.revision ?? null });
    }
    if (characteristics.filter(c => c.holder === 'EMBODIED').length !== 1 ||
        snapshot.bottles.find(b => b.id === result.embodiedBottleId)?.consumedWeek !== snapshot.promotionWeek) return null;
    return { embodiedOriginalBottleId: result.embodiedOriginalBottleId, embodiedBottleId: result.embodiedBottleId, characteristics };
  } catch { return null; }
}
