/** R220 static candidate. Full cold admission is owned by the chapter engine. */
import type { PublicGameDate } from '../../shared/contracts.js';
import type { DivineHandBottle as DivineHandRecoveredBottle, DivineHandAcquisitionEvent as DivineHandRecoveryAcquisitionEvent, DivineHandState as DivineHandRecoveryState } from '../divine-hand/types.js';
export type { TwilightGiantSource } from './source.js';

export const TWILIGHT_GIANT_ORIGINAL_IDS = ['divine-hand-potion-1', 'divine-hand-potion-2', 'divine-hand-potion-3'] as const;
export type TwilightGiantOriginalId = typeof TWILIGHT_GIANT_ORIGINAL_IDS[number];
export const TWILIGHT_GIANT_UNIQUENESS_ID = 'TG220-TWILIGHT-UNIQUE' as const;
export const TWILIGHT_GIANT_CARRIER_IDS = ['twilight-giant-carrier-1', 'twilight-giant-carrier-2', 'twilight-giant-carrier-3'] as const;
export type TwilightGiantCarrierId = typeof TWILIGHT_GIANT_CARRIER_IDS[number];
export const TWILIGHT_GIANT_LABOUR_IDS = ['SEAL_REGISTER', 'CRATE_AUDIT', 'SUPPLY_LIST', 'TRANSIT_RECEIPT', 'DELIVERY_REVIEW'] as const;
export type TwilightGiantLabourId = typeof TWILIGHT_GIANT_LABOUR_IDS[number];

/** Current S1 bottles are admitted as their actual three original identities.
 * Independent historical fourth stock is not reclassified as recovered stock. */
export type TwilightGiantRecoveredBottle = DivineHandRecoveredBottle;
export interface TwilightGiantOriginSnapshot {
  bottles: TwilightGiantRecoveredBottle[];
  acquisitionJournal: DivineHandRecoveryAcquisitionEvent[];
  promotionWeek: number;
  resupply: DivineHandRecoveryState['resupply'];
}
export interface TwilightGiantOriginalResolution {
  embodiedOriginalBottleId: TwilightGiantOriginalId;
  embodiedBottleId: string;
  characteristics: { id: string; originalBottleId: TwilightGiantOriginalId; latestBottleId: string;
    holder: 'SUPPLIER' | 'PLAYER' | 'FAILED_REMAINS' | 'EMBODIED'; consumeRevision: number | null }[];
}
export type TwilightGiantMaterialCommand =
  | { type: 'MATERIAL_LABOUR'; bottleId: TwilightGiantOriginalId; taskId: TwilightGiantLabourId }
  | { type: 'ACQUIRE_CHARACTERISTIC' | 'ASK_LEGACY_PERMISSION' | 'INVESTIGATE_LEGACY_REMAINS' | 'SEAL_LEGACY_REMAINS' | 'RECOVER_LEGACY_REMAINS'; bottleId: TwilightGiantOriginalId }
  | { type: 'VERIFY_UNIQUENESS'; step: 'CHAIN' | 'VACANCY' }
  | { type: 'ACQUIRE_UNIQUENESS' }
  | { type: 'BUY_COMPOUND' | 'COMPOSE_POTION'; batchId: TwilightGiantCarrierId }
  | { type: 'SEAL_REMAINS' | 'RECOVER_SEALED'; compoundId: string };
export type TwilightGiantHolder = 'EMBODIED' | 'SUPPLIER' | 'PLAYER' | 'UNLOCATED' | 'LOCATED' | 'LEGACY_SEALED' |
  'UNVERIFIED' | 'CUSTODIAN' | 'COMPOUND' | 'EXPOSED' | 'SEALED' | 'FUSED';
export interface TwilightGiantCharacteristic {
  id: string; originBottleId: TwilightGiantOriginalId; latestBottleId: string; holder: TwilightGiantHolder;
  location: string | null; compoundId: string | null; inheritedLabourSteps: number; recoveredVessel: boolean;
  labour: { taskId: TwilightGiantLabourId; eventId: string; week: number }[]; acquiredEventId: string | null;
}
export interface TwilightGiantLegacyRemains {
  originalBottleId: TwilightGiantOriginalId; latestBottleId: string; consumeRevision: number;
  sceneId: string | null; location: string | null; custodianId: string | null; physicalVersion: number | null;
  investigatedEventId: string | null; sealedEventId: string | null; sealedWeek: number | null;
  sealedSecond: number | null; recoveredEventId: string | null;
}
/** This is private world state, not a certificate accepted in a command. */
export interface TwilightGiantSuccession {
  branchId: string; uniquenessId: typeof TWILIGHT_GIANT_UNIQUENESS_ID; seal: string; objectCount: 1;
  predecessorId: string; predecessorStillEmbodied: false;
  termination: { eventId: string; date: PublicGameDate; cause: 'ACTUAL_DEATH' };
  separation: { eventId: string; date: PublicGameDate; objectId: typeof TWILIGHT_GIANT_UNIQUENESS_ID };
  transfer: { eventId: string; date: PublicGameDate; objectId: typeof TWILIGHT_GIANT_UNIQUENESS_ID; toActorId: string; custodyOnly: true };
  /** Custody references to the same three S1 originals, never extra stock. */
  characteristicCustody: { originalBottleId: TwilightGiantOriginalId; characteristicId: string;
    separation: { eventId: string; date: PublicGameDate };
    transfer: { eventId: string; date: PublicGameDate; toActorId: string } }[];
  incumbentActorId: null; custodianActorId: string; custodianEmbodied: false;
  location: string; permission: 'ALLOW' | 'WITHDRAWN' | 'UNASKED'; conditionVersion: number;
}
export interface TwilightGiantUniqueness {
  id: typeof TWILIGHT_GIANT_UNIQUENESS_ID; holder: TwilightGiantHolder; location: string | null;
  compoundId: string | null; incumbentActorId: string | null; custodianActorId: string | null;
  succession: TwilightGiantSuccession | null;
  checks: { step: 'CHAIN' | 'VACANCY'; eventId: string; week: number; conditionVersion: number }[];
  acquiredEventId: string | null;
}
export interface TwilightGiantCarrier {
  id: TwilightGiantCarrierId; status: 'SUPPLIER' | 'PLAYER' | 'IN_COMPOUND' | 'SPENT';
  location: string; acquiredEventId: string | null; uses: 0 | 1;
}
/** Derived only from committed private bridge survey, ordinary route and paid
 * support installation receipts. Composition does not assert safe passage. */
export interface TwilightGiantPreparationFacts {
  actorId: string; sourceDigest: string; investigationEventId: string; routeEventId: string;
  supportEventIds: [string, string]; bridgeId: 'GL2-BRIDGE'; observedBridgeVersion: number;
}
export interface TwilightGiantCompound {
  id: string; batchId: TwilightGiantCarrierId; status: 'PREPARED' | 'SUCCESS' | 'FAILED_EXPOSED' | 'FAILED_SEALED' | 'DEATH_EXPOSED' | 'RECOVERED';
  location: string; characteristicIds: string[]; uniquenessId: typeof TWILIGHT_GIANT_UNIQUENESS_ID;
  preparedEventId: string; preparedWeek: number; consumedWeek: number | null; sealedWeek: number | null;
  sealedSecond: number | null; settlementEventId: string | null; sealedEventId: string | null;
  recoveredEventId: string | null; preparationFacts: TwilightGiantPreparationFacts;
}
/** Unknown new amounts/dates must be supplied by approved chapter content.
 * No zero defaults, imported prices, public host or free replacement stock. */
export interface TwilightGiantMaterialPolicy {
  id: string; supplierLocation: string; workshopLocation: string; archiveLocation: string; legacyLocation: string;
  carrierPrices: Record<TwilightGiantCarrierId, number>;
  investigateFee: number; legacyRecoveryFee: number; uniquenessCheckFee: number; uniquenessHandoverFee: number;
  composeFee: number; sealedRecoveryFee: number;
  operationSeconds: number; composeSeconds: number; sealSeconds: number;
  recoveredVesselFullPrice: number; recoveredVesselLabourPrice: number;
  /** Exact dated original branch, fixed by private content when approved. */
  succession: TwilightGiantSuccession;
}
export interface TwilightGiantMaterialHost {
  eventId: string; revision: number; week: number; date: PublicGameDate; actorId: string;
  sourceDigest: string; location: string; nowSecond: number; weekAnchor: number; sequence: 1 | 0; status: 'ACTIVE' | 'DEAD';
  cash: number; actions: number;
  /** Derived from the private bridge reducer; renderer reports cannot set it. */
  preparationFacts: TwilightGiantPreparationFacts | null;
  /** Actual original scene, including current residue presence and permission. */
  legacyAccess: null | { originalBottleId: TwilightGiantOriginalId; latestBottleId: string; consumeRevision: number;
    sceneId: string; location: string; custodianId: string; custodianPresent: boolean;
    accessible: boolean; residualPresent: boolean; physicalVersion: number;
    investigation: 'ALLOW' | 'WITHDRAWN' | 'UNASKED'; handover: 'ALLOW' | 'WITHDRAWN' | 'UNASKED' };
  succession: TwilightGiantSuccession | null;
}
export interface TwilightGiantMaterialEffect { actions: number; cashCost: number; seconds: number }
export interface TwilightGiantMaterialSettlement {
  eventId: string; week: number; compoundId: string; success: boolean; alive: boolean; location: string;
  residualPresent: boolean;
}
export interface TwilightGiantMaterialsState {
  version: 1; origin: TwilightGiantOriginSnapshot & { actorId: string; sourceDigest: string; inheritanceLocation: string };
  embodiedOriginalBottleId: TwilightGiantOriginalId; characteristics: TwilightGiantCharacteristic[];
  legacyRemains: TwilightGiantLegacyRemains[]; uniqueness: TwilightGiantUniqueness; batches: TwilightGiantCarrier[];
  compounds: TwilightGiantCompound[];
  receipts: { eventId: string; revision: number; week: number; location: string; command: TwilightGiantMaterialCommand; effect: TwilightGiantMaterialEffect }[];
  settlements: TwilightGiantMaterialSettlement[];
  /** Current custody of actual failed original doses, never a public certificate. */
  legacySites: (NonNullable<TwilightGiantMaterialHost['legacyAccess']> & { permissionEventId: string | null; permissionWeek: number | null })[];
}

import type { PublicCheckResult } from '../../shared/contracts.js';
import type { TwilightGiantSource, TwilightGiantBudget, TwilightGiantFinance } from './source.js';
import type { TwilightWorksState, TwilightWorksCommand } from './works-types.js';
import type { TwilightEpilogueState, TwilightEpilogueCommand } from './epilogue.js';
export const TWILIGHT_GIANT_ABILITY_IDS = ['warrior.s0.giant-contact-hold', 'warrior.s0.twilight-axle-easing'] as const;
export type TwilightGiantCommand =
  | { type: 'LEARN_GUIDANCE' | 'WORK' | 'REST' | 'CLINIC' | 'NEXT_WEEK' | 'START_EPILOGUE' | 'RETURN_ON_FOOT' }
  | { type: 'TRAVEL'; to: string }
  | { type: 'WORKS'; command: TwilightWorksCommand }
  | { type: 'MATERIAL'; command: TwilightGiantMaterialCommand }
  | { type: 'STABILIZE_PROMOTION'; compoundId: string }
  | { type: 'CONSUME'; compoundId: string; confirmed: true }
  | { type: 'EPILOGUE'; command: TwilightEpilogueCommand };
export interface TwilightGiantFrame {
  budget: TwilightGiantBudget; random: { seed: string; cursor: number };
  finance: TwilightGiantFinance; location: string; nowSecond: number; weekAnchor: number;
}
export interface TwilightGiantCheckReceipt { kind: 'CHECK'; id: string; check: PublicCheckResult; cursorBefore: number; cursorAfter: number }
export interface TwilightGiantEvent {
  id: string; revision: number; command: TwilightGiantCommand; before: TwilightGiantFrame; after: TwilightGiantFrame;
  randomReceipts: TwilightGiantCheckReceipt[]; financeReceipts: { title: string; text: string }[];
  notes: string[]; beforeDigest: string; afterDigest: string;
}
/** One paid preparation binds the exact actor, dose, site, actual resident services
 * and verification receipts for seven real days. No retrospective preparation. */
export interface TwilightGiantPromotionPreparation {
  id: string; eventId: string; compoundId: string; actorId: string; sourceDigest: string;
  compoundDigest: string; location: string; week: number; windowId: string; startWeek: number; endWeek: number;
  preparedSecond: number; expiresSecond: number;
  receipts: string[]; status: 'READY' | 'SPENT' | 'INVALIDATED'; spentEventId: string | null; invalidatedEventId: string | null;
}
export interface TwilightGiantState {
  version: 1; guidanceKnown: boolean; source: TwilightGiantSource | null; frame: TwilightGiantFrame | null;
  promotionWeek: number | null; works: TwilightWorksState | null; materials: TwilightGiantMaterialsState | null;
  epilogue: TwilightEpilogueState | null; journal: TwilightGiantEvent[];
  promotionStability: { preparations: TwilightGiantPromotionPreparation[] };
}
export interface TwilightGiantAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: TwilightGiantCommand; preferredAction?: boolean }
export interface TwilightGiantProjection {
  title: string; guidanceKnown: boolean; promoted: boolean; story: string; nextStep: string; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number; weeklyBudget: number };
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  actions: TwilightGiantAction[]; sections: { id: string; title: string; lines: string[] }[]; insideCase: boolean;
}
