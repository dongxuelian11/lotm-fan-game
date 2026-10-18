/** R216 bounded original continuation. Full admission is owned by the chapter engine. */
import type { PublicGameDate } from '../../shared/contracts.js';
import type { PureWhiteAngelBottle, PureWhiteAngelAcquisitionEvent } from '../pure-white-angel/types.js';
import type { PublicCheckResult } from '../../shared/contracts.js';
import type { SunSource, SunBudget, SunFinance } from './source.js';
import type { SunServiceCommand, SunServicesState } from './services.js';
import type { SunEpilogueState, SunEpilogueCommand } from './epilogue.js';
export type { SunSource } from './source.js';

export const SUN_ORIGINAL_IDS = ['pure-white-angel-potion-1', 'pure-white-angel-potion-2', 'pure-white-angel-potion-3'] as const;
export type SunOriginalId = typeof SUN_ORIGINAL_IDS[number];
export const SUN_UNIQUENESS_ID = 'SU0-U1' as const;
export const SUN_CARRIER_IDS = ['sun-carrier-1', 'sun-carrier-2', 'sun-carrier-3'] as const;
export type SunCarrierId = typeof SUN_CARRIER_IDS[number];
export const SUN_LABOUR_IDS = ['SEAL_REGISTER', 'CRATE_AUDIT', 'SUPPLY_LIST', 'TRANSIT_RECEIPT', 'DELIVERY_REVIEW'] as const;
export type SunLabourId = typeof SUN_LABOUR_IDS[number];
export const SUN_ABILITY_IDS = ['sun.s0.directed-solar-radiance', 'sun.s0.bounded-radiance-ward'] as const;
export type SunAbilityId = typeof SUN_ABILITY_IDS[number];

/** Future S1 bottle extension, never retroactively assigned to independent 4+.
 * The strict S1 acquisition reducer must reconstruct both commands, physical
 * access and costs before this lineage can be admitted by the S0 source gate. */
export type SunRecoveredBottle = PureWhiteAngelBottle;
export interface SunOriginSnapshot {
  bottles: SunRecoveredBottle[];
  acquisitionJournal: PureWhiteAngelAcquisitionEvent[];
  promotionWeek: number;
  resupply: { requestedWeek: number | null; deliveries: number };
}
export interface SunOriginalResolution {
  embodiedOriginalBottleId: SunOriginalId;
  embodiedBottleId: string;
  characteristics: { id: string; originalBottleId: SunOriginalId; latestBottleId: string;
    holder: 'SUPPLIER' | 'PLAYER' | 'FAILED_REMAINS' | 'EMBODIED'; consumeRevision: number | null }[];
}
export type SunMaterialCommand =
  | { type: 'MATERIAL_LABOUR'; bottleId: SunOriginalId; taskId: SunLabourId }
  | { type: 'ACQUIRE_CHARACTERISTIC' | 'ASK_LEGACY_PERMISSION' | 'INVESTIGATE_LEGACY_REMAINS' | 'SEAL_LEGACY_REMAINS' | 'RECOVER_LEGACY_REMAINS'; bottleId: SunOriginalId }
  | { type: 'VERIFY_UNIQUENESS'; step: 'CHAIN' | 'VACANCY' }
  | { type: 'ACQUIRE_UNIQUENESS' }
  | { type: 'BUY_COMPOUND' | 'COMPOSE_POTION'; batchId: SunCarrierId }
  | { type: 'SEAL_REMAINS' | 'RECOVER_SEALED'; compoundId: string };
export type SunHolder = 'EMBODIED' | 'SUPPLIER' | 'PLAYER' | 'UNLOCATED' | 'LOCATED' | 'LEGACY_SEALED' |
  'UNVERIFIED' | 'CUSTODIAN' | 'COMPOUND' | 'EXPOSED' | 'SEALED' | 'LOST' | 'FUSED';
export interface SunCharacteristic {
  id: string; originBottleId: SunOriginalId; latestBottleId: string; holder: SunHolder;
  location: string | null; compoundId: string | null; inheritedLabourSteps: number; recoveredVessel: boolean;
  labour: { taskId: SunLabourId; eventId: string; week: number }[]; acquiredEventId: string | null;
}
export interface SunLegacyRemains {
  originalBottleId: SunOriginalId; latestBottleId: string; consumeRevision: number;
  sceneId: string | null; location: string | null; custodianId: string | null; physicalVersion: number | null;
  investigatedEventId: string | null; sealedEventId: string | null; sealedWeek: number | null;
  sealedSecond: number | null; recoveredEventId: string | null;
}
/** This is private world state, not a certificate accepted in a command. */
export interface SunSuccession {
  branchId: string; uniquenessId: typeof SUN_UNIQUENESS_ID; seal: string; objectCount: 1;
  predecessorId: string; predecessorStillEmbodied: false;
  termination: { eventId: string; date: PublicGameDate; cause: 'ACTUAL_DEATH' };
  separation: { eventId: string; date: PublicGameDate; objectId: typeof SUN_UNIQUENESS_ID };
  transfer: { eventId: string; date: PublicGameDate; objectId: typeof SUN_UNIQUENESS_ID; toActorId: string; custodyOnly: true };
  /** Custody references to the same three S1 originals, never extra stock. */
  characteristicCustody: { originalBottleId: SunOriginalId; characteristicId: string;
    separation: { eventId: string; date: PublicGameDate };
    transfer: { eventId: string; date: PublicGameDate; toActorId: string } }[];
  incumbentActorId: null; custodianActorId: string; custodianEmbodied: false;
  location: string; permission: 'ALLOW' | 'WITHDRAWN' | 'UNASKED'; conditionVersion: number;
}
export interface SunUniqueness {
  id: typeof SUN_UNIQUENESS_ID; holder: SunHolder; location: string | null;
  compoundId: string | null; incumbentActorId: string | null; custodianActorId: string | null;
  succession: SunSuccession | null;
  checks: { step: 'CHAIN' | 'VACANCY'; eventId: string; week: number; conditionVersion: number }[];
  acquiredEventId: string | null;
}
export interface SunCarrier {
  id: SunCarrierId; status: 'SUPPLIER' | 'PLAYER' | 'IN_COMPOUND' | 'SPENT';
  location: string; acquiredEventId: string | null; uses: 0 | 1;
}
export interface SunServiceReceipt {
  serviceId: string; residentId: string; apparatusId: string; passedEventId: string; passedWeek: number;
  reviewedEventId: string; reviewedWeek: number;
}
export interface SunCompound {
  id: string; batchId: SunCarrierId; status: 'PREPARED' | 'SUCCESS' | 'FAILED_EXPOSED' | 'FAILED_SEALED' | 'FAILED_LOST' | 'RECOVERED';
  location: string; characteristicIds: string[]; uniquenessId: typeof SUN_UNIQUENESS_ID;
  preparedEventId: string; preparedWeek: number; consumedWeek: number | null; sealedWeek: number | null;
  sealedSecond: number | null; settlementEventId: string | null; sealedEventId: string | null;
  recoveredEventId: string | null; serviceReceipts: SunServiceReceipt[];
}
/** Unknown new amounts/dates must be supplied by approved chapter content.
 * No zero defaults, imported prices, public host or free replacement stock. */
export interface SunMaterialPolicy {
  id: string; supplierLocation: string; workshopLocation: string; archiveLocation: string; legacyLocation: string;
  carrierPrices: Record<SunCarrierId, number>;
  investigateFee: number; legacyRecoveryFee: number; uniquenessCheckFee: number; uniquenessHandoverFee: number;
  composeFee: number; sealedRecoveryFee: number;
  operationSeconds: number; composeSeconds: number; sealSeconds: number;
  recoveredVesselFullPrice: number; recoveredVesselLabourPrice: number;
  /** Exact dated original branch, fixed by private content when approved. */
  succession: SunSuccession;
  serviceIds: readonly [string, string];
}
export interface SunMaterialHost {
  eventId: string; revision: number; week: number; date: PublicGameDate; actorId: string;
  sourceDigest: string; location: string; nowSecond: number; weekAnchor: number; sequence: 1 | 0; status: 'ACTIVE' | 'DEAD';
  cash: number; actions: number;
  /** Derived from the private services reducer; renderer reports cannot set it. */
  serviceReceipts: SunServiceReceipt[];
  /** Actual original scene, including current residue presence and permission. */
  legacyAccess: null | { originalBottleId: SunOriginalId; latestBottleId: string; consumeRevision: number;
    sceneId: string; location: string; custodianId: string; custodianPresent: boolean;
    accessible: boolean; residualPresent: boolean; physicalVersion: number;
    investigation: 'ALLOW' | 'WITHDRAWN' | 'UNASKED'; handover: 'ALLOW' | 'WITHDRAWN' | 'UNASKED' };
  succession: SunSuccession | null;
}
export interface SunMaterialEffect { actions: number; cashCost: number; seconds: number }
export interface SunMaterialSettlement {
  eventId: string; week: number; compoundId: string; success: boolean; alive: boolean; location: string;
  residualPresent: boolean;
}
export interface SunMaterialsState {
  version: 1; origin: SunOriginSnapshot & { actorId: string; sourceDigest: string; inheritanceLocation: string };
  embodiedOriginalBottleId: SunOriginalId; characteristics: SunCharacteristic[];
  legacyRemains: SunLegacyRemains[]; uniqueness: SunUniqueness; batches: SunCarrier[];
  compounds: SunCompound[];
  receipts: { eventId: string; revision: number; week: number; location: string; command: SunMaterialCommand; effect: SunMaterialEffect }[];
  settlements: SunMaterialSettlement[];
  /** Current custody of actual failed original doses, never a public certificate. */
  legacySites: (NonNullable<SunMaterialHost['legacyAccess']> & { permissionEventId: string | null; permissionWeek: number | null })[];
}

export type SunCommand =
  | { type: 'LEARN_GUIDANCE' | 'WORK' | 'REST' | 'CLINIC' | 'NEXT_WEEK' | 'START_EPILOGUE' | 'RETURN_ON_FOOT' }
  | { type: 'TRAVEL'; to: string }
  | { type: 'SERVICE'; command: SunServiceCommand }
  | { type: 'MATERIAL'; command: SunMaterialCommand }
  | { type: 'STABILIZE_PROMOTION'; compoundId: string }
  | { type: 'CONSUME'; compoundId: string; confirmed: true }
  | { type: 'EPILOGUE'; command: SunEpilogueCommand };
export interface SunFrame {
  budget: SunBudget; random: { seed: string; cursor: number };
  finance: SunFinance; location: string; nowSecond: number; weekAnchor: number;
}
export interface SunCheckReceipt { kind: 'CHECK'; id: string; check: PublicCheckResult; cursorBefore: number; cursorAfter: number }
export interface SunEvent {
  id: string; revision: number; command: SunCommand; before: SunFrame; after: SunFrame;
  randomReceipts: SunCheckReceipt[]; financeReceipts: { title: string; text: string }[];
  notes: string[]; beforeDigest: string; afterDigest: string;
}
/** One paid preparation binds the exact actor, dose, site, actual resident services
 * and verification receipts for seven real days. No retrospective preparation. */
export interface SunPromotionPreparation {
  id: string; eventId: string; compoundId: string; actorId: string; sourceDigest: string;
  compoundDigest: string; location: string; week: number; windowId: string; startWeek: number; endWeek: number;
  preparedSecond: number; expiresSecond: number;
  receipts: string[]; status: 'READY' | 'SPENT' | 'INVALIDATED'; spentEventId: string | null; invalidatedEventId: string | null;
}
export interface SunState {
  version: 1; guidanceKnown: boolean; source: SunSource | null; frame: SunFrame | null;
  promotionWeek: number | null; services: SunServicesState | null; materials: SunMaterialsState | null;
  epilogue: SunEpilogueState | null; journal: SunEvent[];
  promotionStability: { preparations: SunPromotionPreparation[] };
}
export interface SunAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SunCommand; preferredAction?: boolean }
export interface SunProjection {
  title: string; guidanceKnown: boolean; promoted: boolean; story: string; nextStep: string; risk: string;
  resources: { health: number; mind: number; spirituality: number; cash: string; actionsRemaining: number };
  abilities: { id: string; label: string; mastery: number; description: string }[];
  actions: SunAction[]; sections: { id: string; title: string; lines: string[] }[]; insideCase: boolean;
}
