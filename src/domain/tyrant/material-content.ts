import type { PublicGameDate } from '../../shared/contracts.js';
import { compareGameDates } from '../game-calendar.js';
import type { TyrantMaterialPolicy, TyrantSuccession } from './material-types.js';

/** Original future branch. Vacant sealed custody is not embodied ownership.
 * The independent Sun challenger never transfers a characteristic or uniqueness. */
export const TYRANT_MATERIAL_LOCATIONS = {
  supplier: 'TY0-SUPPLIER', originalCove: 'TY0-ORIGINAL-COVE', originalRoom: 'TY0-ORIGINAL-COVE',
  workshop: 'TY0-WORKSHOP', archive: 'TY0-ARCHIVE', vault: 'TY0-VAULT',
} as const;
export const TYRANT_FUTURE_BRANCH = {
  id: 'tyrant-original-future-1352', custodianId: 'TY0-CUSTODIAN', custodianName: '伊诺·格雷',
  vacancyDate: { epoch: 'FIFTH_EPOCH', year: 1352, month: 7, day: 8 },
  transferDate: { epoch: 'FIFTH_EPOCH', year: 1352, month: 7, day: 9 },
  story: '本原创未来分支中的暴君空位与TY0-U1原封签须实际核验。同一暴君唯一性封存在保管室，成年保管人伊诺·格雷仅保管原物，没有容纳。太阳真神拥有自己独立的完整材料，挑战不会移交、击杀复制或借用其原件。',
} as const;
const branch = TYRANT_FUTURE_BRANCH;
const succession: TyrantSuccession = {
  branchId: branch.id, uniquenessId: 'TY0-U1', seal: 'TY0-U1-ORIGINAL-SEAL', objectCount: 1,
  vacancy: { eventId: 'TY0-VACANCY-1352-0708', date: { ...branch.vacancyDate }, verifiedVacant: true },
  transfer: { eventId: 'TY0-CUSTODY-1352-0709', date: { ...branch.transferDate }, objectId: 'TY0-U1', toActorId: branch.custodianId, custodyOnly: true },
  incumbentActorId: null, custodianActorId: branch.custodianId, custodianEmbodied: false,
  location: TYRANT_MATERIAL_LOCATIONS.vault, permission: 'ALLOW', conditionVersion: 1,
};
export const TYRANT_MATERIAL_POLICY: TyrantMaterialPolicy = {
  id: 'tyrant-material-policy-v1', supplierLocation: TYRANT_MATERIAL_LOCATIONS.supplier,
  workshopLocation: TYRANT_MATERIAL_LOCATIONS.workshop, archiveLocation: TYRANT_MATERIAL_LOCATIONS.archive,
  legacyLocation: TYRANT_MATERIAL_LOCATIONS.originalCove,
  carrierPrices: { 'tyrant-carrier-1': 320, 'tyrant-carrier-2': 360, 'tyrant-carrier-3': 400 },
  investigateFee: 120, legacyRecoveryFee: 120, uniquenessCheckFee: 60, uniquenessHandoverFee: 120,
  composeFee: 100, sealedRecoveryFee: 120, operationSeconds: 1800, composeSeconds: 3600, sealSeconds: 600,
  recoveredVesselFullPrice: 900, recoveredVesselLabourPrice: 90, succession,
};
function freeze<T>(v: T): T { if (v && typeof v === 'object') { for (const child of Object.values(v)) freeze(child); Object.freeze(v); } return v; }
freeze(TYRANT_MATERIAL_POLICY);
export function tyrantSuccessionAt(date: PublicGameDate): TyrantSuccession | null {
  return compareGameDates(date, succession.transfer.date) < 0 ? null : structuredClone(succession);
}
export const TYRANT_CONSUMPTION = { difficulty: 30, bonus: 13, actions: 0, spirituality: 0, successMind: 12,
  failureHealth: 45, failureMind: 40, failurePollution: 35, greatFailureHealth: 110, greatFailureMind: 100, greatFailurePollution: 70 } as const;
export const TYRANT_STABILITY = { actions: 1, cash: 150, spirituality: 10, mind: 8, seconds: 600, validSeconds: 604800 } as const;
