import type { PublicGameDate } from '../../shared/contracts.js';
import { compareGameDates } from '../game-calendar.js';
import { SUN_ORIGINAL_IDS, type SunMaterialPolicy, type SunSuccession } from './types.js';

/** A finite, authored future branch. It does not kill or duplicate a canonical
 * incumbent and does not establish an unknown complete formula or ritual. */
export const SUN_MATERIAL_LOCATIONS = {
  supplier: 'SU0-SUPPLIER', originalRoom: 'SU0-ORIGINAL-ROOM', workshop: 'SU0-WORKSHOP', archive: 'SU0-ARCHIVE', vault: 'SU0-ARCHIVE',
} as const;
export const SUN_FUTURE_BRANCH = {
  id: 'sun-original-future-1352', predecessorId: 'SU0-ALDEN-MORROW', predecessorName: '奥尔登·莫罗',
  custodianId: 'SU0-ELENA-VALE', custodianName: '埃琳娜·维尔',
  terminationDate: { epoch: 'FIFTH_EPOCH', year: 1352, month: 10, day: 8 },
  transferDate: { epoch: 'FIFTH_EPOCH', year: 1352, month: 10, day: 9 },
  story: '原封存档案记载：奥尔登·莫罗于1352年10月8日在旧海岸灯塔封印崩解引发的高位冲突中陨落，太阳神位自此空缺。现场析出的同一件太阳唯一性与三份原序列1特性分别封存。次日，三份特性依原封签交给后来供货的保管处，对应本人已经服用或仍在原处的那三瓶；没有第四份。唯一性由从未容纳过它的埃琳娜·维尔单独保管，至今未由另一人容纳。',
} as const;
// This authored future branch does not load the separate Tyrant branch's
// incumbent Sun. All four original objects leave the former holder before
// actual 1352-11-25 S1 stock guidance; unopened SUPPLIER templates are not stock.
const branch = SUN_FUTURE_BRANCH;
const succession: SunSuccession = {
  branchId: branch.id, uniquenessId: 'SU0-U1', seal: 'SU0-U1-ORIGINAL-SEAL', objectCount: 1,
  predecessorId: branch.predecessorId, predecessorStillEmbodied: false,
  termination: { eventId: 'SU0-TERMINATION-1352-1008', date: { ...branch.terminationDate }, cause: 'ACTUAL_DEATH' },
  separation: { eventId: 'SU0-SEPARATION-1352-1008', date: { ...branch.terminationDate }, objectId: 'SU0-U1' },
  transfer: { eventId: 'SU0-CUSTODY-1352-1009', date: { ...branch.transferDate }, objectId: 'SU0-U1', toActorId: branch.custodianId, custodyOnly: true },
  characteristicCustody: SUN_ORIGINAL_IDS.map((originalBottleId, index) => ({
    originalBottleId, characteristicId: `${originalBottleId}:characteristic`,
    separation: { eventId: `SU0-S1-${index + 1}-SEPARATION-1352-1008`, date: { ...branch.terminationDate } },
    transfer: { eventId: `SU0-S1-${index + 1}-CUSTODY-1352-1009`, date: { ...branch.transferDate }, toActorId: 'SU0-ORIGINAL-SUPPLIER' },
  })),
  incumbentActorId: null, custodianActorId: branch.custodianId, custodianEmbodied: false,
  location: SUN_MATERIAL_LOCATIONS.vault, permission: 'ALLOW', conditionVersion: 1,
};
export const SUN_MATERIAL_POLICY: SunMaterialPolicy = {
  id: 'sun-material-policy-v1', supplierLocation: SUN_MATERIAL_LOCATIONS.supplier,
  workshopLocation: SUN_MATERIAL_LOCATIONS.workshop, archiveLocation: SUN_MATERIAL_LOCATIONS.archive,
  legacyLocation: SUN_MATERIAL_LOCATIONS.originalRoom,
  carrierPrices: { 'sun-carrier-1': 320, 'sun-carrier-2': 360, 'sun-carrier-3': 400 },
  investigateFee: 120, legacyRecoveryFee: 120, uniquenessCheckFee: 60, uniquenessHandoverFee: 120,
  composeFee: 100, sealedRecoveryFee: 120, operationSeconds: 1800, composeSeconds: 3600, sealSeconds: 600,
  recoveredVesselFullPrice: 900, recoveredVesselLabourPrice: 90,
  succession, serviceIds: ['washhouse-heat', 'stair-evacuation'],
};
// Every cold rebuild and owned transition reads the same fixed content policy.
function freeze<T>(v: T): T { if (v && typeof v === 'object') { for (const child of Object.values(v)) freeze(child); Object.freeze(v); } return v; }
freeze(SUN_MATERIAL_POLICY);
export function sunSuccessionAt(date: PublicGameDate): SunSuccession | null {
  return compareGameDates(date, succession.transfer.date) < 0 ? null : structuredClone(succession);
}
export const SUN_CONSUMPTION = { difficulty: 58, bonus: 40, actions: 1, spirituality: 30, successMind: 12,
  failureHealth: 45, failureMind: 40, failurePollution: 35, greatFailureHealth: 110, greatFailureMind: 100, greatFailurePollution: 70 } as const;
export const SUN_STABILITY = { actions: 1, cash: 100, spirituality: 12, mind: 8, seconds: 3600, validSeconds: 604800 } as const;
