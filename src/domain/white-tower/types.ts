/** R214 bounded original continuation. Full admission is owned by the chapter engine. */
import type { PublicGameDate } from '../../shared/contracts.js';
import type { AllKnowingEyeBottle, AllKnowingEyeAcquisitionEvent } from '../all-knowing-eye/types.js';
import type { PublicCheckResult } from '../../shared/contracts.js';
import type { WhiteTowerSource, WhiteTowerBudget, WhiteTowerFinance } from './source.js';
import type { WhiteTowerPassageCommand, WhiteTowerPassagesState } from './passages.js';
import type { WhiteTowerEpilogueState, WhiteTowerEpilogueCommand } from './epilogue.js';
export type { WhiteTowerSource } from './source.js';

export const WHITE_TOWER_ORIGINAL_IDS = ['all-knowing-eye-potion-1', 'all-knowing-eye-potion-2', 'all-knowing-eye-potion-3'] as const;
export type WhiteTowerOriginalId = typeof WHITE_TOWER_ORIGINAL_IDS[number];
export const WHITE_TOWER_UNIQUENESS_ID = 'WT0-U1' as const;
export const WHITE_TOWER_CARRIER_IDS = ['white-tower-carrier-1', 'white-tower-carrier-2', 'white-tower-carrier-3'] as const;
export type WhiteTowerCarrierId = typeof WHITE_TOWER_CARRIER_IDS[number];
export const WHITE_TOWER_LABOUR_IDS = ['SEAL_REGISTER', 'CRATE_AUDIT', 'SUPPLY_LIST', 'TRANSIT_RECEIPT', 'DELIVERY_REVIEW'] as const;
export type WhiteTowerLabourId = typeof WHITE_TOWER_LABOUR_IDS[number];
export const WHITE_TOWER_ABILITY_IDS = ['reader.s0.structural-insight', 'reader.s0.bounded-weak-point'] as const;
export type WhiteTowerAbilityId = typeof WHITE_TOWER_ABILITY_IDS[number];

/** Future S1 bottle extension, never retroactively assigned to independent 4+.
 * The strict S1 acquisition reducer must reconstruct both commands, physical
 * access and costs before this lineage can be admitted by the S0 source gate. */
export type WhiteTowerRecoveredBottle = AllKnowingEyeBottle;
export interface WhiteTowerOriginSnapshot {
  bottles: WhiteTowerRecoveredBottle[];
  acquisitionJournal: AllKnowingEyeAcquisitionEvent[];
  promotionWeek: number;
  resupply: { requestedWeek: number | null; deliveries: number };
}
export interface WhiteTowerOriginalResolution {
  embodiedOriginalBottleId: WhiteTowerOriginalId;
  embodiedBottleId: string;
  characteristics: { id: string; originalBottleId: WhiteTowerOriginalId; latestBottleId: string;
    holder: 'SUPPLIER' | 'PLAYER' | 'FAILED_REMAINS' | 'EMBODIED'; consumeRevision: number | null }[];
}
export type WhiteTowerMaterialCommand =
  | { type: 'MATERIAL_LABOUR'; bottleId: WhiteTowerOriginalId; taskId: WhiteTowerLabourId }
  | { type: 'ACQUIRE_CHARACTERISTIC' | 'ASK_LEGACY_PERMISSION' | 'INVESTIGATE_LEGACY_REMAINS' | 'SEAL_LEGACY_REMAINS' | 'RECOVER_LEGACY_REMAINS'; bottleId: WhiteTowerOriginalId }
  | { type: 'VERIFY_UNIQUENESS'; step: 'CHAIN' | 'VACANCY' }
  | { type: 'ACQUIRE_UNIQUENESS' }
  | { type: 'BUY_COMPOUND' | 'COMPOSE_POTION'; batchId: WhiteTowerCarrierId }
  | { type: 'SEAL_REMAINS' | 'RECOVER_SEALED'; compoundId: string };
export type WhiteTowerHolder = 'EMBODIED' | 'SUPPLIER' | 'PLAYER' | 'UNLOCATED' | 'LOCATED' | 'LEGACY_SEALED' |
  'UNVERIFIED' | 'CUSTODIAN' | 'COMPOUND' | 'EXPOSED' | 'SEALED' | 'LOST' | 'FUSED';
export interface WhiteTowerCharacteristic {
  id: string; originBottleId: WhiteTowerOriginalId; latestBottleId: string; holder: WhiteTowerHolder;
  location: string | null; compoundId: string | null; inheritedLabourSteps: number; recoveredVessel: boolean;
  labour: { taskId: WhiteTowerLabourId; eventId: string; week: number }[]; acquiredEventId: string | null;
}
export interface WhiteTowerLegacyRemains {
  originalBottleId: WhiteTowerOriginalId; latestBottleId: string; consumeRevision: number;
  sceneId: string | null; location: string | null; custodianId: string | null; physicalVersion: number | null;
  investigatedEventId: string | null; sealedEventId: string | null; sealedWeek: number | null;
  sealedSecond: number | null; recoveredEventId: string | null;
}
/** This is private world state, not a certificate accepted in a command. */
export interface WhiteTowerSuccession {
  branchId: string; uniquenessId: typeof WHITE_TOWER_UNIQUENESS_ID; seal: string; objectCount: 1;
  predecessorId: string; predecessorStillEmbodied: false;
  termination: { eventId: string; date: PublicGameDate; cause: 'ACTUAL_DEATH' };
  separation: { eventId: string; date: PublicGameDate; objectId: typeof WHITE_TOWER_UNIQUENESS_ID };
  transfer: { eventId: string; date: PublicGameDate; objectId: typeof WHITE_TOWER_UNIQUENESS_ID; toActorId: string; custodyOnly: true };
  incumbentActorId: null; custodianActorId: string; custodianEmbodied: false;
  location: string; permission: 'ALLOW' | 'WITHDRAWN' | 'UNASKED'; conditionVersion: number;
}
export interface WhiteTowerUniqueness {
  id: typeof WHITE_TOWER_UNIQUENESS_ID; holder: WhiteTowerHolder; location: string | null;
  compoundId: string | null; incumbentActorId: string | null; custodianActorId: string | null;
  succession: WhiteTowerSuccession | null;
  checks: { step: 'CHAIN' | 'VACANCY'; eventId: string; week: number; conditionVersion: number }[];
  acquiredEventId: string | null;
}
export interface WhiteTowerCarrier {
  id: WhiteTowerCarrierId; status: 'SUPPLIER' | 'PLAYER' | 'IN_COMPOUND' | 'SPENT';
  location: string; acquiredEventId: string | null; uses: 0 | 1;
}
export interface WhiteTowerPassageReceipt {
  passageId: string; residentId: string; apparatusId: string; passedEventId: string; passedWeek: number;
  reviewedEventId: string; reviewedWeek: number;
}
export interface WhiteTowerCompound {
  id: string; batchId: WhiteTowerCarrierId; status: 'PREPARED' | 'SUCCESS' | 'FAILED_EXPOSED' | 'FAILED_SEALED' | 'FAILED_LOST' | 'RECOVERED';
  location: string; characteristicIds: string[]; uniquenessId: typeof WHITE_TOWER_UNIQUENESS_ID;
  preparedEventId: string; preparedWeek: number; consumedWeek: number | null; sealedWeek: number | null;
  sealedSecond: number | null; settlementEventId: string | null; sealedEventId: string | null;
  recoveredEventId: string | null; passageReceipts: WhiteTowerPassageReceipt[];
}
/** Unknown new amounts/dates must be supplied by approved chapter content.
 * No zero defaults, imported prices, public host or free replacement stock. */
export interface WhiteTowerMaterialPolicy {
  id: string; supplierLocation: string; workshopLocation: string; archiveLocation: string; legacyLocation: string;
  carrierPrices: Record<WhiteTowerCarrierId, number>;
  investigateFee: number; legacyRecoveryFee: number; uniquenessCheckFee: number; uniquenessHandoverFee: number;
  composeFee: number; sealedRecoveryFee: number;
  operationSeconds: number; composeSeconds: number; sealSeconds: number;
  recoveredVesselFullPrice: number; recoveredVesselLabourPrice: number;
  /** Exact dated original branch, fixed by private content when approved. */
  succession: WhiteTowerSuccession;
  passageIds: readonly [string, string, string];
}
export interface WhiteTowerMaterialHost {
  eventId: string; revision: number; week: number; date: PublicGameDate; actorId: string;
  sourceDigest: string; location: string; nowSecond: number; weekAnchor: number; sequence: 1 | 0; status: 'ACTIVE' | 'DEAD';
  cash: number; actions: number;
  /** Derived from the private passages reducer; renderer reports cannot set it. */
  passageReceipts: WhiteTowerPassageReceipt[];
  /** Actual original scene, including current residue presence and permission. */
  legacyAccess: null | { originalBottleId: WhiteTowerOriginalId; latestBottleId: string; consumeRevision: number;
    sceneId: string; location: string; custodianId: string; custodianPresent: boolean;
    accessible: boolean; residualPresent: boolean; physicalVersion: number;
    investigation: 'ALLOW' | 'WITHDRAWN' | 'UNASKED'; handover: 'ALLOW' | 'WITHDRAWN' | 'UNASKED' };
  succession: WhiteTowerSuccession | null;
}
export interface WhiteTowerMaterialEffect { actions: number; cashCost: number; seconds: number }
export interface WhiteTowerMaterialSettlement {
  eventId: string; week: number; compoundId: string; success: boolean; alive: boolean; location: string;
  residualPresent: boolean;
}
export interface WhiteTowerMaterialsState {
  version: 1; origin: WhiteTowerOriginSnapshot & { actorId: string; sourceDigest: string; inheritanceLocation: string };
  embodiedOriginalBottleId: WhiteTowerOriginalId; characteristics: WhiteTowerCharacteristic[];
  legacyRemains: WhiteTowerLegacyRemains[]; uniqueness: WhiteTowerUniqueness; batches: WhiteTowerCarrier[];
  compounds: WhiteTowerCompound[];
  receipts: { eventId: string; revision: number; week: number; location: string; command: WhiteTowerMaterialCommand; effect: WhiteTowerMaterialEffect }[];
  settlements: WhiteTowerMaterialSettlement[];
  /** Current custody of actual failed original doses, never a public certificate. */
  legacySites: (NonNullable<WhiteTowerMaterialHost['legacyAccess']> & { permissionEventId: string | null; permissionWeek: number | null })[];
}

export type WhiteTowerCommand =
  | { type: 'LEARN_GUIDANCE' | 'WORK' | 'REST' | 'CLINIC' | 'NEXT_WEEK' | 'START_EPILOGUE' | 'RETURN_ON_FOOT' }
  | { type: 'TRAVEL'; to: string }
  | { type: 'PASSAGE'; command: WhiteTowerPassageCommand }
  | { type: 'MATERIAL'; command: WhiteTowerMaterialCommand }
  | { type: 'STABILIZE_PROMOTION'; compoundId: string }
  | { type: 'CONSUME'; compoundId: string; confirmed: true }
  | { type: 'EPILOGUE'; command: WhiteTowerEpilogueCommand };
export interface WhiteTowerFrame {
  budget: WhiteTowerBudget; random: { seed: string; cursor: number };
  finance: WhiteTowerFinance; location: string; nowSecond: number; weekAnchor: number;
}
export interface WhiteTowerCheckReceipt { kind: 'CHECK'; id: string; check: PublicCheckResult; cursorBefore: number; cursorAfter: number }
export interface WhiteTowerEvent {
  id: string; revision: number; command: WhiteTowerCommand; before: WhiteTowerFrame; after: WhiteTowerFrame;
  randomReceipts: WhiteTowerCheckReceipt[]; financeReceipts: { title: string; text: string }[];
  notes: string[]; beforeDigest: string; afterDigest: string;
}
/** One paid preparation binds the exact actor, dose, site, original crossings
 * and review receipts for seven real days. No retrospective preparation. */
export interface WhiteTowerPromotionPreparation {
  id: string; eventId: string; compoundId: string; actorId: string; sourceDigest: string;
  compoundDigest: string; location: string; week: number; windowId: string; startWeek: number; endWeek: number;
  preparedSecond: number; expiresSecond: number;
  receipts: string[]; status: 'READY' | 'SPENT' | 'INVALIDATED'; spentEventId: string | null; invalidatedEventId: string | null;
}
export interface WhiteTowerState {
  version: 1; guidanceKnown: boolean; source: WhiteTowerSource | null; frame: WhiteTowerFrame | null;
  promotionWeek: number | null; passages: WhiteTowerPassagesState | null; materials: WhiteTowerMaterialsState | null;
  epilogue: WhiteTowerEpilogueState | null; journal: WhiteTowerEvent[];
  promotionStability: { preparations: WhiteTowerPromotionPreparation[] };
}
export interface WhiteTowerAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: WhiteTowerCommand; preferredAction?: boolean }
export interface WhiteTowerProjection {
  title: string; guidanceKnown: boolean; promoted: boolean; story: string; nextStep: string; risk: string;
  resources: { health: number; mind: number; spirituality: number; cash: string; actionsRemaining: number };
  abilities: { id: string; label: string; mastery: number; description: string }[];
  actions: WhiteTowerAction[]; sections: { id: string; title: string; lines: string[] }[]; insideCase: boolean;
}
