import type { PublicGameDate } from '../../shared/contracts.js';
import { compareGameDates } from '../game-calendar.js';
import type { WhiteTowerMaterialPolicy, WhiteTowerSuccession } from './types.js';

/** A finite, authored future branch. It does not kill or duplicate a canonical
 * incumbent and does not establish an unknown complete formula or ritual. */
export const WHITE_TOWER_MATERIAL_LOCATIONS = {
  supplier: 'WT0-SUPPLIER', originalRoom: 'WT0-ORIGINAL-ROOM', workshop: 'WT0-WORKSHOP', archive: 'WT0-ARCHIVE', vault: 'WT0-ARCHIVE',
} as const;
export const WHITE_TOWER_FUTURE_BRANCH = {
  id: 'white-tower-original-future-1352', predecessorId: 'WT0-EVELYN-LORNE', predecessorName: '伊芙琳·洛恩',
  custodianId: 'WT0-OSCAR-RAINE', custodianName: '奥斯卡·雷恩',
  terminationDate: { epoch: 'FIFTH_EPOCH', year: 1352, month: 7, day: 8 },
  transferDate: { epoch: 'FIFTH_EPOCH', year: 1352, month: 7, day: 9 },
  story: '档案中的原保管链记载：伊芙琳·洛恩于1352年7月8日在旧观测塔坍塌时实际死亡，容纳随身体死亡终止；现场只析出同一件白塔唯一性。次日由成年见证人核对同一封签，交给从未容纳过它的奥斯卡·雷恩保管。奥斯卡只保管这件原物，没有容纳。',
} as const;
const branch = WHITE_TOWER_FUTURE_BRANCH;
const succession: WhiteTowerSuccession = {
  branchId: branch.id, uniquenessId: 'WT0-U1', seal: 'WT0-U1-ORIGINAL-SEAL', objectCount: 1,
  predecessorId: branch.predecessorId, predecessorStillEmbodied: false,
  termination: { eventId: 'WT0-TERMINATION-1352-0708', date: { ...branch.terminationDate }, cause: 'ACTUAL_DEATH' },
  separation: { eventId: 'WT0-SEPARATION-1352-0708', date: { ...branch.terminationDate }, objectId: 'WT0-U1' },
  transfer: { eventId: 'WT0-CUSTODY-1352-0709', date: { ...branch.transferDate }, objectId: 'WT0-U1', toActorId: branch.custodianId, custodyOnly: true },
  incumbentActorId: null, custodianActorId: branch.custodianId, custodianEmbodied: false,
  location: WHITE_TOWER_MATERIAL_LOCATIONS.vault, permission: 'ALLOW', conditionVersion: 1,
};
export const WHITE_TOWER_MATERIAL_POLICY: WhiteTowerMaterialPolicy = {
  id: 'white-tower-material-policy-v1', supplierLocation: WHITE_TOWER_MATERIAL_LOCATIONS.supplier,
  workshopLocation: WHITE_TOWER_MATERIAL_LOCATIONS.workshop, archiveLocation: WHITE_TOWER_MATERIAL_LOCATIONS.archive,
  legacyLocation: WHITE_TOWER_MATERIAL_LOCATIONS.originalRoom,
  carrierPrices: { 'white-tower-carrier-1': 320, 'white-tower-carrier-2': 360, 'white-tower-carrier-3': 400 },
  investigateFee: 120, legacyRecoveryFee: 120, uniquenessCheckFee: 60, uniquenessHandoverFee: 120,
  composeFee: 100, sealedRecoveryFee: 120, operationSeconds: 1800, composeSeconds: 3600, sealSeconds: 600,
  recoveredVesselFullPrice: 6600, recoveredVesselLabourPrice: 1100,
  succession, passageIds: ['market-steps', 'canal-gallery', 'apartment-alley'],
};
// Every cold rebuild and owned transition reads the same fixed content policy.
function freeze<T>(v: T): T { if (v && typeof v === 'object') { for (const child of Object.values(v)) freeze(child); Object.freeze(v); } return v; }
freeze(WHITE_TOWER_MATERIAL_POLICY);
export function whiteTowerSuccessionAt(date: PublicGameDate): WhiteTowerSuccession | null {
  return compareGameDates(date, succession.transfer.date) < 0 ? null : structuredClone(succession);
}
export const WHITE_TOWER_CONSUMPTION = { difficulty: 58, bonus: 40, actions: 1, spirituality: 30, successMind: 12,
  failureHealth: 45, failureMind: 40, failurePollution: 35, greatFailureHealth: 110, greatFailureMind: 100, greatFailurePollution: 70 } as const;
export const WHITE_TOWER_STABILITY = { actions: 1, cash: 100, spirituality: 12, mind: 8, seconds: 3600, validSeconds: 604800 } as const;
