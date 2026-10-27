import type { PublicGameDate } from '../../shared/contracts.js';
import { compareGameDates } from '../game-calendar.js';
import { starKeyCharacteristicId } from '../star-key/index.js';
import { DOOR_ORIGINAL_IDS, DOOR_UNIQUENESS_ID, type DoorMaterialPolicy, type DoorSuccession } from './types.js';

/** Independent authored future branch, never a claim about canonical history.
 * The dates precede actual S1 guidance; discovery is recorded only in new events. */
export const DOOR_MATERIAL_LOCATIONS = {
  supplier: 'DR0-SUPPLIER', originalRoom: 'DR0-ORIGINAL-ROOM', workshop: 'DR0-WORKSHOP', archive: 'DR0-ARCHIVE', vault: 'DR0-ARCHIVE',
} as const;
export const DOOR_FUTURE_BRANCH = {
  id: 'door-independent-original-future-1353', predecessorId: 'DR0-PREDECESSOR', predecessorName: '原封存记录中的前任',
  custodianId: 'DR0-UNIQUENESS-CUSTODIAN', custodianName: '原封存处保管人',
  terminationDate: { epoch: 'FIFTH_EPOCH', year: 1353, month: 4, day: 21 },
  transferDate: { epoch: 'FIFTH_EPOCH', year: 1353, month: 4, day: 22 },
  story: '现存封存档案记载，前任于1353年4月21日实际死亡，同一门唯一性析出后在4月22日转入未容纳它的保管人手中，神位空缺。三份原序列1特性的封签分别对应原供货的三瓶，不另造第四份。你需要亲自调查这条记录，核对当时的损失证据、逐次保管交接，以及当前实物与许可。',
} as const;
const branch = DOOR_FUTURE_BRANCH;
const succession: DoorSuccession = {
  branchId: branch.id, uniquenessId: DOOR_UNIQUENESS_ID, seal: 'DR0-DOOR-UNIQUENESS-1-ORIGINAL-SEAL', objectCount: 1,
  predecessorId: branch.predecessorId, predecessorStillEmbodied: false,
  termination: { eventId: 'DR0-TERMINATION-1353-0421', date: { ...branch.terminationDate }, cause: 'ACTUAL_DEATH' },
  separation: { eventId: 'DR0-SEPARATION-1353-0421', date: { ...branch.terminationDate }, objectId: DOOR_UNIQUENESS_ID },
  transfer: { eventId: 'DR0-CUSTODY-1353-0422', date: { ...branch.transferDate }, objectId: DOOR_UNIQUENESS_ID, toActorId: branch.custodianId, custodyOnly: true },
  characteristicCustody: DOOR_ORIGINAL_IDS.map((originalBottleId, index) => ({ originalBottleId, characteristicId: starKeyCharacteristicId(originalBottleId),
    separation: { eventId: `DR0-S1-${index + 1}-SEPARATION-1353-0421`, date: { ...branch.terminationDate } },
    transfer: { eventId: `DR0-S1-${index + 1}-CUSTODY-1353-0422`, date: { ...branch.transferDate }, toActorId: 'DR0-ORIGINAL-SUPPLIER' },
  })),
  incumbentActorId: null, custodianActorId: branch.custodianId, custodianEmbodied: false,
  location: DOOR_MATERIAL_LOCATIONS.vault, permission: 'ALLOW', conditionVersion: 1,
};
export const DOOR_MATERIAL_POLICY: DoorMaterialPolicy = {
  id: 'door-material-policy-v1', supplierLocation: DOOR_MATERIAL_LOCATIONS.supplier,
  workshopLocation: DOOR_MATERIAL_LOCATIONS.workshop, archiveLocation: DOOR_MATERIAL_LOCATIONS.archive,
  legacyLocation: DOOR_MATERIAL_LOCATIONS.originalRoom,
  carrierPrices: { 'door-carrier-1': 50, 'door-carrier-2': 70, 'door-carrier-3': 90 },
  investigateFee: 120, legacyRecoveryFee: 30, uniquenessCheckFee: 180, uniquenessHandoverFee: 200,
  composeFee: 40, sealedRecoveryFee: 60, operationSeconds: 1800, composeSeconds: 3600, sealSeconds: 600,
  recoveredVesselFullPrice: 900, recoveredVesselLabourPrice: 90,
  succession, serviceIds: ['ledger-threshold', 'courtyard-stair', 'warehouse-gate'],
};
function freeze<T>(v: T): T { if (v && typeof v === 'object') { for (const child of Object.values(v)) freeze(child); Object.freeze(v); } return v; }
freeze(DOOR_MATERIAL_POLICY);
export function doorSuccessionAt(date: PublicGameDate): DoorSuccession | null {
  return compareGameDates(date, succession.transfer.date) < 0 ? null : structuredClone(succession);
}
export const DOOR_CONSUMPTION = { difficulty: 58, bonus: 40, actions: 1, spirituality: 30, successMind: 12,
  failureHealth: 45, failureMind: 40, failurePollution: 35, greatFailureHealth: 110, greatFailureMind: 100, greatFailurePollution: 70 } as const;
export const DOOR_STABILITY = { actions: 1, cash: 150, spirituality: 12, mind: 8, seconds: 3600, validSeconds: 604800 } as const;
