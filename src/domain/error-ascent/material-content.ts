import type { PublicGameDate } from '../../shared/contracts.js';
import { compareGameDates } from '../game-calendar.js';
import { timeWormCharacteristicId } from '../time-worm/index.js';
import { ERROR_ASCENT_ORIGINAL_IDS, ERROR_ASCENT_UNIQUENESS_ID, type ErrorAscentMaterialPolicy, type ErrorAscentSuccession } from './types.js';

/** Approved independent authored Error branch. These events precede the actual
 * first TimeWorm guidance; discovery never rewrites inherited source journals.
 * Rival Thunder God/Tyrant stock belongs exclusively to the ritual reducer. */
export const ERROR_ASCENT_MATERIAL_LOCATIONS = {
  supplier: 'ER219-TIME-WORM-SUPPLIER', originalRoom: 'ER219-ORIGINAL-PREPARATION',
  workshop: 'ER219-WORKSHOP', archive: 'ER219-ERROR-ARCHIVE', vault: 'ER219-ERROR-VAULT',
} as const;
export const ERROR_ASCENT_FUTURE_BRANCH = {
  id: 'error-independent-original-future-1351', predecessorId: 'ER219-PRIOR-ERROR', predecessorName: '旧封存档案中的前任',
  custodianId: 'ER219-ERROR-CUSTODIAN', custodianName: '玛拉·芬',
  terminationDate: { epoch: 'FIFTH_EPOCH', year: 1351, month: 12, day: 10 },
  transferDate: { epoch: 'FIFTH_EPOCH', year: 1351, month: 12, day: 11 },
  story: '封存档案记载，错误前任于1351年12月10日实际死亡，同一错误唯一性析出后于12月11日交给未容纳它的玛拉·芬保管；同一次析出的三份时之虫特性分别交给原时之虫供货人，封签对应原来的三瓶。本人须亲自核对死亡、析出、逐次保管交接与当前原物。对方的雷神特性与暴君唯一性不属于本人材料。',
} as const;
const branch = ERROR_ASCENT_FUTURE_BRANCH;
const succession: ErrorAscentSuccession = {
  branchId: branch.id, uniquenessId: ERROR_ASCENT_UNIQUENESS_ID, seal: 'ER219-ERROR-UNIQUE-ORIGINAL-SEAL', objectCount: 1,
  predecessorId: branch.predecessorId, predecessorStillEmbodied: false,
  termination: { eventId: 'ER219-ERROR-DEATH', date: { ...branch.terminationDate }, cause: 'ACTUAL_DEATH' },
  separation: { eventId: 'ER219-ERROR-SEPARATION', date: { ...branch.terminationDate }, objectId: ERROR_ASCENT_UNIQUENESS_ID },
  transfer: { eventId: 'ER219-ERROR-CUSTODY', date: { ...branch.transferDate }, objectId: ERROR_ASCENT_UNIQUENESS_ID,
    toActorId: branch.custodianId, custodyOnly: true },
  characteristicCustody: ERROR_ASCENT_ORIGINAL_IDS.map((originalBottleId, index) => ({
    originalBottleId, characteristicId: timeWormCharacteristicId(originalBottleId),
    separation: { eventId: `ER219-TW-${index + 1}-SEPARATION`, date: { ...branch.terminationDate } },
    transfer: { eventId: `ER219-TW-${index + 1}-CUSTODY`, date: { ...branch.transferDate }, toActorId: 'ER0-TIME-WORM-SUPPLIER' },
  })),
  incumbentActorId: null, custodianActorId: branch.custodianId, custodianEmbodied: false,
  location: ERROR_ASCENT_MATERIAL_LOCATIONS.vault, permission: 'ALLOW', conditionVersion: 1,
};
export const ERROR_ASCENT_MATERIAL_POLICY: ErrorAscentMaterialPolicy = {
  id: 'error-ascent-material-policy-v1', supplierLocation: ERROR_ASCENT_MATERIAL_LOCATIONS.supplier,
  workshopLocation: ERROR_ASCENT_MATERIAL_LOCATIONS.workshop, archiveLocation: ERROR_ASCENT_MATERIAL_LOCATIONS.archive,
  legacyLocation: ERROR_ASCENT_MATERIAL_LOCATIONS.originalRoom,
  carrierPrices: { 'error-ascent-carrier-1': 50 },
  investigateFee: 120, legacyRecoveryFee: 30, uniquenessCheckFee: 100, uniquenessHandoverFee: 150,
  composeFee: 40, sealedRecoveryFee: 60, operationSeconds: 1800, composeSeconds: 3600, sealSeconds: 600,
  recoveredVesselFullPrice: 900, recoveredVesselLabourPrice: 90, succession,
};
function freeze<T>(v: T): T { if (v && typeof v === 'object') { for (const child of Object.values(v)) freeze(child); Object.freeze(v); } return v; }
freeze(ERROR_ASCENT_MATERIAL_POLICY);
export function errorAscentSuccessionAt(date: PublicGameDate): ErrorAscentSuccession | null {
  return compareGameDates(date, succession.transfer.date) < 0 ? null : structuredClone(succession);
}
/** One actual opposed replacement consumes the player's own compound. The
 * normal-check resistance comes from the live ritual, never a fixed success. */
export const ERROR_ASCENT_CONSUMPTION = { actions: 1, spirituality: 30, mind: 8, seconds: 4,
  failureHealth: 45, failureMind: 40, failurePollution: 35,
  greatFailureHealth: 110, greatFailureMind: 100, greatFailurePollution: 70 } as const;
export const ERROR_ASCENT_STABILITY = { actions: 1, cash: 150, spirituality: 12, mind: 8, seconds: 3600, validSeconds: 604800 } as const;
