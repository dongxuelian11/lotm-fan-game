import type { PublicGameDate } from '../../shared/contracts.js';
import { compareGameDates } from '../game-calendar.js';
import { twilightGiantCharacteristicId } from './originals.js';
import { TWILIGHT_GIANT_ORIGINAL_IDS, TWILIGHT_GIANT_UNIQUENESS_ID, type TwilightGiantMaterialPolicy, type TwilightGiantSuccession } from './types.js';

/** Authored independent branch, not a claim about the novel's incumbent deity.
 * Both dates strictly precede the actual W147 / 1352-04-15 first guidance.
 * No inherited journal, original bottle label or world chronology is rewritten. */
export const TWILIGHT_GIANT_MATERIAL_LOCATIONS = {
  supplier: 'TG220-DIVINE-HAND-SUPPLIER', originalRoom: 'TG220-ORIGINAL-PREPARATION',
  workshop: 'TG220-WORKSHOP', archive: 'TG220-TWILIGHT-ARCHIVE', vault: 'TG220-TWILIGHT-VAULT',
} as const;
export const TWILIGHT_GIANT_FUTURE_BRANCH = {
  id: 'twilight-giant-independent-original-1352', predecessorId: 'TG220-PRIOR-TWILIGHT-GIANT',
  predecessorName: '旧封存档案中的前任', custodianId: 'TG220-HEDA', custodianName: '赫妲·洛恩',
  terminationDate: { epoch: 'FIFTH_EPOCH', year: 1352, month: 4, day: 7 },
  transferDate: { epoch: 'FIFTH_EPOCH', year: 1352, month: 4, day: 8 },
  story: '旧封存档案记载，前任于1352年4月7日实际死亡，同一黄昏巨人唯一性析出，次日交给未容纳它的赫妲·洛恩封存保管。同一次析出的三份神明之手特性分别交给原成品供货方，封签对应原来的三瓶。本人须亲自核对死亡、析出、保管交接与当前原件；实际哪一原份已经融合、哪一份失败或仍在供应方，均以本人的真实履历核定。',
} as const;
const branch = TWILIGHT_GIANT_FUTURE_BRANCH;
const succession: TwilightGiantSuccession = {
  branchId: branch.id, uniquenessId: TWILIGHT_GIANT_UNIQUENESS_ID, seal: 'TG220-TWILIGHT-UNIQUE-ORIGINAL-SEAL', objectCount: 1,
  predecessorId: branch.predecessorId, predecessorStillEmbodied: false,
  termination: { eventId: 'TG220-PRIOR-DEATH', date: { ...branch.terminationDate }, cause: 'ACTUAL_DEATH' },
  separation: { eventId: 'TG220-UNIQUE-SEPARATION', date: { ...branch.terminationDate }, objectId: TWILIGHT_GIANT_UNIQUENESS_ID },
  transfer: { eventId: 'TG220-UNIQUE-CUSTODY', date: { ...branch.transferDate }, objectId: TWILIGHT_GIANT_UNIQUENESS_ID,
    toActorId: branch.custodianId, custodyOnly: true },
  characteristicCustody: TWILIGHT_GIANT_ORIGINAL_IDS.map((originalBottleId, index) => ({
    originalBottleId, characteristicId: twilightGiantCharacteristicId(originalBottleId),
    separation: { eventId: `TG220-DH-${index + 1}-SEPARATION`, date: { ...branch.terminationDate } },
    transfer: { eventId: `TG220-DH-${index + 1}-CUSTODY`, date: { ...branch.transferDate }, toActorId: 'TG220-DIVINE-HAND-SUPPLIER' },
  })),
  incumbentActorId: null, custodianActorId: branch.custodianId, custodianEmbodied: false,
  location: TWILIGHT_GIANT_MATERIAL_LOCATIONS.vault, permission: 'ALLOW', conditionVersion: 1,
};
export const TWILIGHT_GIANT_MATERIAL_POLICY: TwilightGiantMaterialPolicy = {
  id: 'twilight-giant-material-policy-v1', supplierLocation: TWILIGHT_GIANT_MATERIAL_LOCATIONS.supplier,
  workshopLocation: TWILIGHT_GIANT_MATERIAL_LOCATIONS.workshop, archiveLocation: TWILIGHT_GIANT_MATERIAL_LOCATIONS.archive,
  legacyLocation: TWILIGHT_GIANT_MATERIAL_LOCATIONS.originalRoom,
  carrierPrices: { 'twilight-giant-carrier-1': 50, 'twilight-giant-carrier-2': 50, 'twilight-giant-carrier-3': 50 },
  investigateFee: 120, legacyRecoveryFee: 30, uniquenessCheckFee: 100, uniquenessHandoverFee: 150,
  composeFee: 40, sealedRecoveryFee: 60, operationSeconds: 1800, composeSeconds: 3600, sealSeconds: 600,
  recoveredVesselFullPrice: 900, recoveredVesselLabourPrice: 90, succession,
};
function freeze<T>(v: T): T { if (v && typeof v === 'object') { for (const child of Object.values(v)) freeze(child); Object.freeze(v); } return v; }
freeze(TWILIGHT_GIANT_MATERIAL_POLICY);
export function twilightGiantSuccessionAt(date: PublicGameDate): TwilightGiantSuccession | null {
  return compareGameDates(date, succession.transfer.date) < 0 ? null : structuredClone(succession);
}
/** Normal S0 structural requirement only. Exact recipe, auxiliary ingredients
 * and canonical ritual are unknown. The bridge condition is original gameplay. */
export const TWILIGHT_GIANT_MATERIAL_BOUNDARY = {
  title: '黄昏巨人唯一性与三份真实神明之手', totalOriginalCharacteristics: 3, uniquenessCount: 1,
  minimumActualDivineHandWeeks: 12, recipeKnown: false, auxiliaryIngredientsKnown: false,
  canonicalRitualKnown: false, bridgeCondition: 'GAME_ORIGINAL',
} as const;
