import { resolveThunderGodOriginalsSnapshot } from '../thunder-god/index.js';
import { TYRANT_ORIGINAL_IDS, type TyrantOriginalId, type TyrantOriginSnapshot, type TyrantOriginalResolution } from './material-types.js';
export const isTyrantOriginal = (id: unknown): id is TyrantOriginalId => TYRANT_ORIGINAL_IDS.some(x => x === id);
/** The strict S1 resolver reconstructs every paid recovery and unique lineage.
 * Independent historical fourth originals remain readable there, but are never
 * accepted here as a fourth characteristic or relabelled as recovered stock. */
export function resolveTyrantOriginals(snapshot: TyrantOriginSnapshot): TyrantOriginalResolution | null {
  try {
    const result = resolveThunderGodOriginalsSnapshot({ bottles: snapshot.bottles, acquisitionJournal: snapshot.acquisitionJournal, resupply: snapshot.resupply,
      ...(snapshot.promotionStability ? { promotionStability: snapshot.promotionStability } : {}) });
    if (!result || !isTyrantOriginal(result.embodiedOriginalBottleId) || !result.embodiedBottleId || result.characteristics.length !== 3) return null;
    const characteristics: TyrantOriginalResolution['characteristics'] = [];
    for (const originalBottleId of TYRANT_ORIGINAL_IDS) {
      const c = result.characteristics.find(x => x.originalBottleId === originalBottleId);
      if (!c || c.characteristicId !== `${originalBottleId}:characteristic`) return null;
      const consumed = c.consumptionHistory.filter(x => x.bottleId === c.latestBottleId).at(-1);
      characteristics.push({ id: c.characteristicId, originalBottleId, latestBottleId: c.latestBottleId,
        holder: c.holder === 'FAILED_REMNANT' ? 'FAILED_REMAINS' : c.holder, consumeRevision: consumed?.revision ?? null });
    }
    if (characteristics.filter(c => c.holder === 'EMBODIED').length !== 1 ||
        snapshot.bottles.find(b => b.id === result.embodiedBottleId)?.consumedWeek !== snapshot.promotionWeek) return null;
    return { embodiedOriginalBottleId: result.embodiedOriginalBottleId, embodiedBottleId: result.embodiedBottleId, characteristics };
  } catch { return null; }
}
