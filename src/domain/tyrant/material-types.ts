import type { PublicGameDate } from '../../shared/contracts.js';
import type { ThunderGodBottle, ThunderGodAcquisitionEvent } from '../thunder-god/types.js';
export const TYRANT_ORIGINAL_IDS = ['thunder-god-potion-1', 'thunder-god-potion-2', 'thunder-god-potion-3'] as const;
export type TyrantOriginalId = typeof TYRANT_ORIGINAL_IDS[number];
export const TYRANT_UNIQUENESS_ID = 'TY0-U1' as const;
export const TYRANT_CARRIER_IDS = ['tyrant-carrier-1', 'tyrant-carrier-2', 'tyrant-carrier-3'] as const;
export type TyrantCarrierId = typeof TYRANT_CARRIER_IDS[number];
export const TYRANT_LABOUR_IDS = ['SEAL_REGISTER', 'CRATE_AUDIT', 'SUPPLY_LIST', 'TRANSIT_RECEIPT', 'DELIVERY_REVIEW'] as const;
export type TyrantLabourId = typeof TYRANT_LABOUR_IDS[number];

/** Future S1 bottle extension, never retroactively assigned to independent 4+.
 * The strict S1 acquisition reducer must reconstruct both commands, physical
 * access and costs before this lineage can be admitted by the S0 source gate. */
export type TyrantRecoveredBottle = ThunderGodBottle;
export interface TyrantOriginSnapshot {
  bottles: TyrantRecoveredBottle[];
  acquisitionJournal: ThunderGodAcquisitionEvent[];
  promotionWeek: number;
  resupply: import('../thunder-god/types.js').ThunderGodState['resupply'];
  promotionStability?: NonNullable<import('../thunder-god/types.js').ThunderGodState['promotionStability']>;
}
export interface TyrantOriginalResolution {
  embodiedOriginalBottleId: TyrantOriginalId;
  embodiedBottleId: string;
  characteristics: { id: string; originalBottleId: TyrantOriginalId; latestBottleId: string;
    holder: 'SUPPLIER' | 'PLAYER' | 'FAILED_REMAINS' | 'EMBODIED'; consumeRevision: number | null }[];
}
export type TyrantMaterialCommand =
  | { type: 'MATERIAL_LABOUR'; bottleId: TyrantOriginalId; taskId: TyrantLabourId }
  | { type: 'ACQUIRE_CHARACTERISTIC' | 'ASK_LEGACY_PERMISSION' | 'INVESTIGATE_LEGACY_REMAINS' | 'SEAL_LEGACY_REMAINS' | 'RECOVER_LEGACY_REMAINS'; bottleId: TyrantOriginalId }
  | { type: 'VERIFY_UNIQUENESS'; step: 'CHAIN' | 'VACANCY' }
  | { type: 'ACQUIRE_UNIQUENESS' }
  | { type: 'BUY_COMPOUND' | 'COMPOSE_POTION'; batchId: TyrantCarrierId }
  | { type: 'SEAL_REMAINS' | 'RECOVER_SEALED'; compoundId: string };
export type TyrantHolder = 'EMBODIED' | 'SUPPLIER' | 'PLAYER' | 'UNLOCATED' | 'LOCATED' | 'LEGACY_SEALED' |
  'UNVERIFIED' | 'CUSTODIAN' | 'COMPOUND' | 'EXPOSED' | 'SEALED' | 'UNAVAILABLE' | 'FUSED';
export interface TyrantCharacteristic {
  id: string; originBottleId: TyrantOriginalId; latestBottleId: string; holder: TyrantHolder;
  location: string | null; compoundId: string | null; inheritedLabourSteps: number; recoveredVessel: boolean;
  labour: { taskId: TyrantLabourId; eventId: string; week: number }[]; acquiredEventId: string | null;
}
export interface TyrantLegacyRemains {
  originalBottleId: TyrantOriginalId; latestBottleId: string; consumeRevision: number;
  sceneId: string | null; location: string | null; custodianId: string | null; physicalVersion: number | null;
  investigatedEventId: string | null; sealedEventId: string | null; sealedWeek: number | null;
  sealedSecond: number | null; recoveredEventId: string | null;
}
/** This is private world state, not a certificate accepted in a command. */
export interface TyrantSuccession {
  branchId: string; uniquenessId: typeof TYRANT_UNIQUENESS_ID; seal: string; objectCount: 1;
  vacancy: { eventId: string; date: PublicGameDate; verifiedVacant: true };
  transfer: { eventId: string; date: PublicGameDate; objectId: typeof TYRANT_UNIQUENESS_ID; toActorId: string; custodyOnly: true };
  incumbentActorId: null; custodianActorId: string; custodianEmbodied: false;
  location: string; permission: 'ALLOW' | 'WITHDRAWN' | 'UNASKED'; conditionVersion: number;
}
export interface TyrantUniqueness {
  id: typeof TYRANT_UNIQUENESS_ID; holder: TyrantHolder; location: string | null;
  compoundId: string | null; incumbentActorId: string | null; custodianActorId: string | null;
  succession: TyrantSuccession | null;
  checks: { step: 'CHAIN' | 'VACANCY'; eventId: string; week: number; conditionVersion: number }[];
  acquiredEventId: string | null;
}
export interface TyrantCarrier {
  id: TyrantCarrierId; status: 'SUPPLIER' | 'PLAYER' | 'IN_COMPOUND' | 'SPENT';
  location: string; acquiredEventId: string | null; uses: 0 | 1;
}
export interface TyrantRitualReceipt {
  kind: 'COASTS' | 'CHALLENGE' | 'ATMOSPHERE'; eventId: string; week: number; actorId: string; conditionVersion: number;
}
export interface TyrantCompound {
  id: string; batchId: TyrantCarrierId; status: 'PREPARED' | 'SUCCESS' | 'FAILED_EXPOSED' | 'FAILED_SEALED' | 'FAILED_UNAVAILABLE' | 'RECOVERED';
  location: string; characteristicIds: string[]; uniquenessId: typeof TYRANT_UNIQUENESS_ID;
  preparedEventId: string; preparedWeek: number; consumedWeek: number | null; sealedWeek: number | null;
  sealedSecond: number | null; settlementEventId: string | null; sealedEventId: string | null;
  recoveredEventId: string | null; ritualReceipts: TyrantRitualReceipt[];
}
/** Unknown new amounts/dates must be supplied by approved chapter content.
 * No zero defaults, imported prices, public host or free replacement stock. */
export interface TyrantMaterialPolicy {
  id: string; supplierLocation: string; workshopLocation: string; archiveLocation: string; legacyLocation: string;
  carrierPrices: Record<TyrantCarrierId, number>;
  investigateFee: number; legacyRecoveryFee: number; uniquenessCheckFee: number; uniquenessHandoverFee: number;
  composeFee: number; sealedRecoveryFee: number;
  operationSeconds: number; composeSeconds: number; sealSeconds: number;
  recoveredVesselFullPrice: number; recoveredVesselLabourPrice: number;
  /** Exact dated original branch, fixed by private content when approved. */
  succession: TyrantSuccession;
}
export interface TyrantMaterialHost {
  eventId: string; revision: number; week: number; date: PublicGameDate; actorId: string;
  sourceDigest: string; location: string; nowSecond: number; weekAnchor: number; sequence: 1 | 0; status: 'ACTIVE' | 'DEAD';
  cash: number; actions: number;
  /** Derived from the private passages reducer; renderer reports cannot set it. */
  ritualReceipts: TyrantRitualReceipt[];
  /** Actual original scene, including current residue presence and permission. */
  legacyAccess: null | { originalBottleId: TyrantOriginalId; latestBottleId: string; consumeRevision: number;
    sceneId: string; location: string; custodianId: string; custodianPresent: boolean;
    accessible: boolean; residualPresent: boolean; physicalVersion: number;
    investigation: 'ALLOW' | 'WITHDRAWN' | 'UNASKED'; handover: 'ALLOW' | 'WITHDRAWN' | 'UNASKED' };
  succession: TyrantSuccession | null;
}
export interface TyrantMaterialEffect { actions: number; cashCost: number; seconds: number }
export interface TyrantMaterialSettlement {
  eventId: string; week: number; compoundId: string; success: boolean; alive: boolean; location: string;
  residualPresent: boolean;
}
export interface TyrantMaterialDeathInput { eventId: string; week: number; location: string }
/** Current physical disposition after actual actor death; previous compounds
 * and successful promotion remain immutable historical records. */
export interface TyrantMaterialDeath extends TyrantMaterialDeathInput {
  previousIncumbentActorId: string | null;
  dispositions: { id: string; holder: TyrantHolder; location: string | null; compoundId: string | null }[];
}
export interface TyrantMaterialsState {
  version: 1; origin: TyrantOriginSnapshot & { actorId: string; sourceDigest: string; inheritanceLocation: string };
  embodiedOriginalBottleId: TyrantOriginalId; characteristics: TyrantCharacteristic[];
  legacyRemains: TyrantLegacyRemains[]; uniqueness: TyrantUniqueness; batches: TyrantCarrier[];
  compounds: TyrantCompound[];
  death?: TyrantMaterialDeath;
  receipts: { eventId: string; revision: number; week: number; location: string; command: TyrantMaterialCommand; effect: TyrantMaterialEffect }[];
  settlements: TyrantMaterialSettlement[];
  /** Current custody of actual failed original doses, never a public certificate. */
  legacySites: (NonNullable<TyrantMaterialHost['legacyAccess']> & { permissionEventId: string | null; permissionWeek: number | null })[];
}
