/** R218 bounded original continuation. Full admission is owned by the chapter engine. */
import type { PublicGameDate } from '../../shared/contracts.js';
import type { StarKeyBottle, StarKeyAcquisitionEvent } from '../star-key/types.js';
import type { PublicCheckResult } from '../../shared/contracts.js';
import type { DoorSource, DoorBudget, DoorFinance } from './source.js';
import type { DoorServiceCommand, DoorServicesState } from './services.js';
import type { DoorEpilogueState, DoorEpilogueCommand } from './epilogue.js';
export type { DoorSource } from './source.js';

export const DOOR_ORIGINAL_IDS = ['star-key-potion-1', 'star-key-potion-2', 'star-key-potion-3'] as const;
export type DoorOriginalId = typeof DOOR_ORIGINAL_IDS[number];
export const DOOR_UNIQUENESS_ID = 'DR0-DOOR-UNIQUENESS-1' as const;
export const DOOR_CARRIER_IDS = ['door-carrier-1', 'door-carrier-2', 'door-carrier-3'] as const;
export type DoorCarrierId = typeof DOOR_CARRIER_IDS[number];
export const DOOR_LABOUR_IDS = ['SEAL_REGISTER', 'CRATE_AUDIT', 'SUPPLY_LIST', 'TRANSIT_RECEIPT', 'DELIVERY_REVIEW'] as const;
export type DoorLabourId = typeof DOOR_LABOUR_IDS[number];
export const DOOR_ABILITY_IDS = ['door.s0.bounded-conceptual-escape', 'door.s0.single-exit-seal'] as const;
export type DoorAbilityId = typeof DOOR_ABILITY_IDS[number];

/** Future S1 bottle extension, never retroactively assigned to independent 4+.
 * The strict S1 acquisition reducer must reconstruct both commands, physical
 * access and costs before this lineage can be admitted by the S0 source gate. */
export type DoorRecoveredBottle = StarKeyBottle;
export interface DoorOriginSnapshot {
  bottles: DoorRecoveredBottle[];
  acquisitionJournal: StarKeyAcquisitionEvent[];
  promotionWeek: number;
  resupply: { requestedWeek: number | null; deliveries: number };
}
export interface DoorOriginalResolution {
  embodiedOriginalBottleId: DoorOriginalId;
  embodiedBottleId: string;
  characteristics: { id: string; originalBottleId: DoorOriginalId; latestBottleId: string;
    holder: 'SUPPLIER' | 'PLAYER' | 'FAILED_REMAINS' | 'EMBODIED'; consumeRevision: number | null }[];
}
export type DoorMaterialCommand =
  | { type: 'MATERIAL_LABOUR'; bottleId: DoorOriginalId; taskId: DoorLabourId }
  | { type: 'ACQUIRE_CHARACTERISTIC' | 'ASK_LEGACY_PERMISSION' | 'INVESTIGATE_LEGACY_REMAINS' | 'SEAL_LEGACY_REMAINS' | 'RECOVER_LEGACY_REMAINS'; bottleId: DoorOriginalId }
  | { type: 'VERIFY_UNIQUENESS'; step: 'CHAIN' | 'VACANCY' }
  | { type: 'ACQUIRE_UNIQUENESS' }
  | { type: 'BUY_COMPOUND' | 'COMPOSE_POTION'; batchId: DoorCarrierId }
  | { type: 'SEAL_REMAINS' | 'RECOVER_SEALED'; compoundId: string };
export type DoorHolder = 'EMBODIED' | 'SUPPLIER' | 'PLAYER' | 'UNLOCATED' | 'LOCATED' | 'LEGACY_SEALED' |
  'UNVERIFIED' | 'CUSTODIAN' | 'COMPOUND' | 'EXPOSED' | 'SEALED' | 'LOST' | 'FUSED';
export interface DoorCharacteristic {
  id: string; originBottleId: DoorOriginalId; latestBottleId: string; holder: DoorHolder;
  location: string | null; compoundId: string | null; inheritedLabourSteps: number; recoveredVessel: boolean;
  labour: { taskId: DoorLabourId; eventId: string; week: number }[]; acquiredEventId: string | null;
}
export interface DoorLegacyRemains {
  originalBottleId: DoorOriginalId; latestBottleId: string; consumeRevision: number;
  sceneId: string | null; location: string | null; custodianId: string | null; physicalVersion: number | null;
  investigatedEventId: string | null; sealedEventId: string | null; sealedWeek: number | null;
  sealedSecond: number | null; recoveredEventId: string | null;
}
/** This is private world state, not a certificate accepted in a command. */
export interface DoorSuccession {
  branchId: string; uniquenessId: typeof DOOR_UNIQUENESS_ID; seal: string; objectCount: 1;
  predecessorId: string; predecessorStillEmbodied: false;
  termination: { eventId: string; date: PublicGameDate; cause: 'ACTUAL_DEATH' };
  separation: { eventId: string; date: PublicGameDate; objectId: typeof DOOR_UNIQUENESS_ID };
  transfer: { eventId: string; date: PublicGameDate; objectId: typeof DOOR_UNIQUENESS_ID; toActorId: string; custodyOnly: true };
  /** Custody references to the same three S1 originals, never extra stock. */
  characteristicCustody: { originalBottleId: DoorOriginalId; characteristicId: string;
    separation: { eventId: string; date: PublicGameDate };
    transfer: { eventId: string; date: PublicGameDate; toActorId: string } }[];
  incumbentActorId: null; custodianActorId: string; custodianEmbodied: false;
  location: string; permission: 'ALLOW' | 'WITHDRAWN' | 'UNASKED'; conditionVersion: number;
}
export interface DoorUniqueness {
  id: typeof DOOR_UNIQUENESS_ID; holder: DoorHolder; location: string | null;
  compoundId: string | null; incumbentActorId: string | null; custodianActorId: string | null;
  succession: DoorSuccession | null;
  checks: { step: 'CHAIN' | 'VACANCY'; eventId: string; week: number; conditionVersion: number }[];
  acquiredEventId: string | null;
}
export interface DoorCarrier {
  id: DoorCarrierId; status: 'SUPPLIER' | 'PLAYER' | 'IN_COMPOUND' | 'SPENT';
  location: string; acquiredEventId: string | null; uses: 0 | 1;
}
export interface DoorServiceReceipt {
  serviceId: string; residentId: string; apparatusId: string; passedEventId: string; passedWeek: number;
  reviewedEventId: string; reviewedWeek: number;
}
export interface DoorCompound {
  id: string; batchId: DoorCarrierId; status: 'PREPARED' | 'SUCCESS' | 'FAILED_EXPOSED' | 'FAILED_SEALED' | 'FAILED_LOST' | 'RECOVERED';
  location: string; characteristicIds: string[]; uniquenessId: typeof DOOR_UNIQUENESS_ID;
  preparedEventId: string; preparedWeek: number; consumedWeek: number | null; sealedWeek: number | null;
  sealedSecond: number | null; settlementEventId: string | null; sealedEventId: string | null;
  recoveredEventId: string | null; serviceReceipts: DoorServiceReceipt[];
}
/** Unknown new amounts/dates must be supplied by approved chapter content.
 * No zero defaults, imported prices, public host or free replacement stock. */
export interface DoorMaterialPolicy {
  id: string; supplierLocation: string; workshopLocation: string; archiveLocation: string; legacyLocation: string;
  carrierPrices: Record<DoorCarrierId, number>;
  investigateFee: number; legacyRecoveryFee: number; uniquenessCheckFee: number; uniquenessHandoverFee: number;
  composeFee: number; sealedRecoveryFee: number;
  operationSeconds: number; composeSeconds: number; sealSeconds: number;
  recoveredVesselFullPrice: number; recoveredVesselLabourPrice: number;
  /** Exact dated original branch, fixed by private content when approved. */
  succession: DoorSuccession;
  serviceIds: readonly [string, string, string];
}
export interface DoorMaterialHost {
  eventId: string; revision: number; week: number; date: PublicGameDate; actorId: string;
  sourceDigest: string; location: string; nowSecond: number; weekAnchor: number; sequence: 1 | 0; status: 'ACTIVE' | 'DEAD';
  cash: number; actions: number;
  /** Derived from the private services reducer; renderer reports cannot set it. */
  serviceReceipts: DoorServiceReceipt[];
  /** Actual original scene, including current residue presence and permission. */
  legacyAccess: null | { originalBottleId: DoorOriginalId; latestBottleId: string; consumeRevision: number;
    sceneId: string; location: string; custodianId: string; custodianPresent: boolean;
    accessible: boolean; residualPresent: boolean; physicalVersion: number;
    investigation: 'ALLOW' | 'WITHDRAWN' | 'UNASKED'; handover: 'ALLOW' | 'WITHDRAWN' | 'UNASKED' };
  succession: DoorSuccession | null;
}
export interface DoorMaterialEffect { actions: number; cashCost: number; seconds: number }
export interface DoorMaterialSettlement {
  eventId: string; week: number; compoundId: string; success: boolean; alive: boolean; location: string;
  residualPresent: boolean;
}
export interface DoorMaterialsState {
  version: 1; origin: DoorOriginSnapshot & { actorId: string; sourceDigest: string; inheritanceLocation: string };
  embodiedOriginalBottleId: DoorOriginalId; characteristics: DoorCharacteristic[];
  legacyRemains: DoorLegacyRemains[]; uniqueness: DoorUniqueness; batches: DoorCarrier[];
  compounds: DoorCompound[];
  receipts: { eventId: string; revision: number; week: number; location: string; command: DoorMaterialCommand; effect: DoorMaterialEffect }[];
  settlements: DoorMaterialSettlement[];
  /** Current custody of actual failed original doses, never a public certificate. */
  legacySites: (NonNullable<DoorMaterialHost['legacyAccess']> & { permissionEventId: string | null; permissionWeek: number | null })[];
}

export type DoorCommand =
  | { type: 'LEARN_GUIDANCE' | 'WORK' | 'REST' | 'CLINIC' | 'NEXT_WEEK' | 'START_EPILOGUE' | 'RETURN_ON_FOOT' }
  | { type: 'TRAVEL'; to: string }
  | { type: 'SERVICE'; command: DoorServiceCommand }
  | { type: 'MATERIAL'; command: DoorMaterialCommand }
  | { type: 'STABILIZE_PROMOTION'; compoundId: string }
  | { type: 'CONSUME'; compoundId: string; confirmed: true }
  | { type: 'EPILOGUE'; command: DoorEpilogueCommand };
export interface DoorFrame {
  budget: DoorBudget; random: { seed: string; cursor: number };
  finance: DoorFinance; location: string; nowSecond: number; weekAnchor: number;
}
export interface DoorCheckReceipt { kind: 'CHECK'; id: string; check: PublicCheckResult; cursorBefore: number; cursorAfter: number }
export interface DoorEvent {
  id: string; revision: number; command: DoorCommand; before: DoorFrame; after: DoorFrame;
  randomReceipts: DoorCheckReceipt[]; financeReceipts: { title: string; text: string }[];
  notes: string[]; beforeDigest: string; afterDigest: string;
}
/** One paid preparation binds the exact actor, dose, site, actual resident services
 * and verification receipts for seven real days. No retrospective preparation. */
export interface DoorPromotionPreparation {
  id: string; eventId: string; compoundId: string; actorId: string; sourceDigest: string;
  compoundDigest: string; location: string; week: number; windowId: string; startWeek: number; endWeek: number;
  preparedSecond: number; expiresSecond: number;
  receipts: string[]; status: 'READY' | 'SPENT' | 'INVALIDATED'; spentEventId: string | null; invalidatedEventId: string | null;
}
export interface DoorState {
  version: 1; guidanceKnown: boolean; source: DoorSource | null; frame: DoorFrame | null;
  promotionWeek: number | null; services: DoorServicesState | null; materials: DoorMaterialsState | null;
  epilogue: DoorEpilogueState | null; journal: DoorEvent[];
  promotionStability: { preparations: DoorPromotionPreparation[] };
}
export interface DoorAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: DoorCommand; preferredAction?: boolean }
export interface DoorProjection {
  title: string; guidanceKnown: boolean; promoted: boolean; story: string; nextStep: string; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number; weeklyBudget: number };
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  actions: DoorAction[]; sections: { id: string; title: string; lines: string[] }[]; insideCase: boolean;
}
