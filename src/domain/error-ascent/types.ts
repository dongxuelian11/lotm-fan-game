/** R219 source and conserved material types. Full admission is owned by the chapter engine. */
import type { PublicGameDate } from '../../shared/contracts.js';
import type { TimeWormBottle, TimeWormAcquisitionEvent, TimeWormState } from '../time-worm/types.js';
export type { ErrorAscentSource } from './source.js';

export const ERROR_ASCENT_ORIGINAL_IDS = ['time-worm-potion-1', 'time-worm-potion-2', 'time-worm-potion-3'] as const;
export type ErrorAscentOriginalId = typeof ERROR_ASCENT_ORIGINAL_IDS[number];
export const ERROR_ASCENT_UNIQUENESS_ID = 'ER219-ERROR-UNIQUE' as const;
export const ERROR_ASCENT_CARRIER_IDS = ['error-ascent-carrier-1'] as const;
export type ErrorAscentCarrierId = typeof ERROR_ASCENT_CARRIER_IDS[number];
export const ERROR_ASCENT_LABOUR_IDS = ['SEAL_REGISTER', 'CRATE_AUDIT', 'SUPPLY_LIST', 'TRANSIT_RECEIPT', 'DELIVERY_REVIEW'] as const;
export type ErrorAscentLabourId = typeof ERROR_ASCENT_LABOUR_IDS[number];

/** Future S1 bottle extension, never retroactively assigned to independent 4+.
 * The strict S1 acquisition reducer must reconstruct both commands, physical
 * access and costs before this lineage can be admitted by the S0 source gate. */
export type ErrorAscentRecoveredBottle = TimeWormBottle;
export interface ErrorAscentOriginSnapshot {
  bottles: ErrorAscentRecoveredBottle[];
  acquisitionJournal: TimeWormAcquisitionEvent[];
  promotionWeek: number;
  resupply: TimeWormState['resupply'];
}
export interface ErrorAscentOriginalResolution {
  embodiedOriginalBottleId: ErrorAscentOriginalId;
  embodiedBottleId: string;
  characteristics: { id: string; originalBottleId: ErrorAscentOriginalId; latestBottleId: string;
    holder: 'SUPPLIER' | 'PLAYER' | 'FAILED_REMAINS' | 'EMBODIED'; consumeRevision: number | null }[];
}
export type ErrorAscentMaterialCommand =
  | { type: 'MATERIAL_LABOUR'; bottleId: ErrorAscentOriginalId; taskId: ErrorAscentLabourId }
  | { type: 'ACQUIRE_CHARACTERISTIC' | 'ASK_LEGACY_PERMISSION' | 'INVESTIGATE_LEGACY_REMAINS' | 'SEAL_LEGACY_REMAINS' | 'RECOVER_LEGACY_REMAINS'; bottleId: ErrorAscentOriginalId }
  | { type: 'VERIFY_UNIQUENESS'; step: 'CHAIN' | 'VACANCY' }
  | { type: 'ACQUIRE_UNIQUENESS' }
  | { type: 'BUY_COMPOUND' | 'COMPOSE_POTION'; batchId: ErrorAscentCarrierId }
  | { type: 'SEAL_REMAINS' | 'RECOVER_SEALED'; compoundId: string };
export type ErrorAscentHolder = 'EMBODIED' | 'SUPPLIER' | 'PLAYER' | 'UNLOCATED' | 'LOCATED' | 'LEGACY_SEALED' |
  'UNVERIFIED' | 'CUSTODIAN' | 'COMPOUND' | 'EXPOSED' | 'SEALED' | 'FUSED';
export interface ErrorAscentCharacteristic {
  id: string; originBottleId: ErrorAscentOriginalId; latestBottleId: string; holder: ErrorAscentHolder;
  location: string | null; compoundId: string | null; inheritedLabourSteps: number; recoveredVessel: boolean;
  labour: { taskId: ErrorAscentLabourId; eventId: string; week: number }[]; acquiredEventId: string | null;
}
export interface ErrorAscentLegacyRemains {
  originalBottleId: ErrorAscentOriginalId; latestBottleId: string; consumeRevision: number;
  sceneId: string | null; location: string | null; custodianId: string | null; physicalVersion: number | null;
  investigatedEventId: string | null; sealedEventId: string | null; sealedWeek: number | null;
  sealedSecond: number | null; recoveredEventId: string | null;
}
/** This is private world state, not a certificate accepted in a command. */
export interface ErrorAscentSuccession {
  branchId: string; uniquenessId: typeof ERROR_ASCENT_UNIQUENESS_ID; seal: string; objectCount: 1;
  predecessorId: string; predecessorStillEmbodied: false;
  termination: { eventId: string; date: PublicGameDate; cause: 'ACTUAL_DEATH' };
  separation: { eventId: string; date: PublicGameDate; objectId: typeof ERROR_ASCENT_UNIQUENESS_ID };
  transfer: { eventId: string; date: PublicGameDate; objectId: typeof ERROR_ASCENT_UNIQUENESS_ID; toActorId: string; custodyOnly: true };
  /** Custody references to the same three S1 originals, never extra stock. */
  characteristicCustody: { originalBottleId: ErrorAscentOriginalId; characteristicId: string;
    separation: { eventId: string; date: PublicGameDate };
    transfer: { eventId: string; date: PublicGameDate; toActorId: string } }[];
  incumbentActorId: null; custodianActorId: string; custodianEmbodied: false;
  location: string; permission: 'ALLOW' | 'WITHDRAWN' | 'UNASKED'; conditionVersion: number;
}
export interface ErrorAscentUniqueness {
  id: typeof ERROR_ASCENT_UNIQUENESS_ID; holder: ErrorAscentHolder; location: string | null;
  compoundId: string | null; incumbentActorId: string | null; custodianActorId: string | null;
  succession: ErrorAscentSuccession | null;
  checks: { step: 'CHAIN' | 'VACANCY'; eventId: string; week: number; conditionVersion: number }[];
  acquiredEventId: string | null;
}
export interface ErrorAscentCarrier {
  id: ErrorAscentCarrierId; status: 'SUPPLIER' | 'PLAYER' | 'IN_COMPOUND' | 'SPENT';
  location: string; acquiredEventId: string | null; uses: 0 | 1;
}
/** Derived only from committed private SURVEY acts. One event may perform all
 * three acts. These facts neither create live contact nor certify a candidate. */
export interface ErrorAscentPreparationFacts {
  actorId: string; sourceDigest: string; investigationEventId: string; routeEventId: string; conductorEventId: string;
  conductorId: 'ER219-CONDUCTOR'; routeId: 'ER219-OUTER-STAIR';
  observedConductorVersion: number; currentConductorVersion: number;
  conductorIntact: boolean; ordinaryExitOpen: boolean;
}
export interface ErrorAscentCompound {
  id: string; batchId: ErrorAscentCarrierId; status: 'PREPARED' | 'SUCCESS' | 'FAILED_EXPOSED' | 'FAILED_SEALED' | 'DEATH_EXPOSED' | 'RECOVERED';
  location: string; characteristicIds: string[]; uniquenessId: typeof ERROR_ASCENT_UNIQUENESS_ID;
  preparedEventId: string; preparedWeek: number; consumedWeek: number | null; sealedWeek: number | null;
  sealedSecond: number | null; settlementEventId: string | null; sealedEventId: string | null;
  recoveredEventId: string | null; preparationFacts: ErrorAscentPreparationFacts;
}
/** Unknown new amounts/dates must be supplied by approved chapter content.
 * No zero defaults, imported prices, public host or free replacement stock. */
export interface ErrorAscentMaterialPolicy {
  id: string; supplierLocation: string; workshopLocation: string; archiveLocation: string; legacyLocation: string;
  carrierPrices: Record<ErrorAscentCarrierId, number>;
  investigateFee: number; legacyRecoveryFee: number; uniquenessCheckFee: number; uniquenessHandoverFee: number;
  composeFee: number; sealedRecoveryFee: number;
  operationSeconds: number; composeSeconds: number; sealSeconds: number;
  recoveredVesselFullPrice: number; recoveredVesselLabourPrice: number;
  /** Exact dated original branch, fixed by private content when approved. */
  succession: ErrorAscentSuccession;
}
export interface ErrorAscentMaterialHost {
  eventId: string; revision: number; week: number; date: PublicGameDate; actorId: string;
  sourceDigest: string; location: string; nowSecond: number; weekAnchor: number; sequence: 1 | 0; status: 'ACTIVE' | 'DEAD';
  cash: number; actions: number;
  /** Derived from the private ritual reducer; renderer reports cannot set it. */
  preparationFacts: ErrorAscentPreparationFacts | null;
  /** Actual original scene, including current residue presence and permission. */
  legacyAccess: null | { originalBottleId: ErrorAscentOriginalId; latestBottleId: string; consumeRevision: number;
    sceneId: string; location: string; custodianId: string; custodianPresent: boolean;
    accessible: boolean; residualPresent: boolean; physicalVersion: number;
    investigation: 'ALLOW' | 'WITHDRAWN' | 'UNASKED'; handover: 'ALLOW' | 'WITHDRAWN' | 'UNASKED' };
  succession: ErrorAscentSuccession | null;
}
export interface ErrorAscentMaterialEffect { actions: number; cashCost: number; seconds: number }
export interface ErrorAscentMaterialSettlement {
  eventId: string; week: number; compoundId: string; success: boolean; alive: boolean; location: string;
  residualPresent: boolean;
}
export interface ErrorAscentMaterialsState {
  version: 1; origin: ErrorAscentOriginSnapshot & { actorId: string; sourceDigest: string; inheritanceLocation: string };
  embodiedOriginalBottleId: ErrorAscentOriginalId; characteristics: ErrorAscentCharacteristic[];
  legacyRemains: ErrorAscentLegacyRemains[]; uniqueness: ErrorAscentUniqueness; batches: ErrorAscentCarrier[];
  compounds: ErrorAscentCompound[];
  receipts: { eventId: string; revision: number; week: number; location: string; command: ErrorAscentMaterialCommand; effect: ErrorAscentMaterialEffect }[];
  settlements: ErrorAscentMaterialSettlement[];
  /** Current custody of actual failed original doses, never a public certificate. */
  legacySites: (NonNullable<ErrorAscentMaterialHost['legacyAccess']> & { permissionEventId: string | null; permissionWeek: number | null })[];
}

import type { PublicCheckResult } from '../../shared/contracts.js';
import type { ErrorAscentBudget, ErrorAscentFinance, ErrorAscentSource } from './source.js';
import type { ErrorRitualCommand, ErrorRitualState } from './ritual-types.js';
import type { ErrorAscentEpilogueCommand, ErrorAscentEpilogueState } from './epilogue.js';
export const ERROR_ASCENT_ABILITY_IDS = ['error.s0.short-motion-theft', 'error.s0.linked-release-error'] as const;
export type ErrorAscentCommand =
 | {type:'LEARN_GUIDANCE'|'WORK'|'REST'|'CLINIC'|'NEXT_WEEK'|'WAIT_FOR_PREPARATION'|'START_EPILOGUE'|'RETURN_ON_FOOT'}
 | {type:'TRAVEL';to:string}
 | {type:'RITUAL';command:ErrorRitualCommand}
 | {type:'MATERIAL';command:ErrorAscentMaterialCommand}
 | {type:'STABILIZE_PROMOTION';compoundId:string}
 | {type:'EPILOGUE';command:ErrorAscentEpilogueCommand};
export interface ErrorAscentFrame { budget:ErrorAscentBudget;finance:ErrorAscentFinance;random:{seed:string;cursor:number};location:string;nowSecond:number;weekAnchor:number }
export interface ErrorAscentCheckReceipt {kind:'CHECK';id:string;check:PublicCheckResult;cursorBefore:number;cursorAfter:number}
export interface ErrorAscentEvent { id:string;revision:number;command:ErrorAscentCommand;before:ErrorAscentFrame;after:ErrorAscentFrame;randomReceipts:ErrorAscentCheckReceipt[];financeReceipts:{title:string;text:string}[];notes:string[];beforeDigest:string;afterDigest:string }
export interface ErrorAscentPromotionPreparation {id:string;eventId:string;compoundId:string;actorId:string;sourceDigest:string;compoundDigest:string;preparedSecond:number;expiresSecond:number;status:'READY'|'SPENT'|'INVALIDATED';spentEventId:string|null;invalidatedEventId:string|null}
export interface ErrorAscentState { version:1;guidanceKnown:boolean;source:ErrorAscentSource|null;frame:ErrorAscentFrame|null;promotionWeek:number|null;ritual:ErrorRitualState|null;materials:ErrorAscentMaterialsState|null;epilogue:ErrorAscentEpilogueState|null;journal:ErrorAscentEvent[];promotionStability:{preparations:ErrorAscentPromotionPreparation[]} }
export interface ErrorAscentAction { id:string;label:string;cost:string;enabled:boolean;reason:string|null;command:ErrorAscentCommand;preferredAction?:boolean }
export interface ErrorAscentProjection { title:string;guidanceKnown:boolean;promoted:boolean;story:string;nextStep:string;risk:string;resources:{health:number;maxHealth:number;mind:number;maxMind:number;spirituality:number;maxSpirituality:number;cash:string;actionsRemaining:number;weeklyBudget:number};injuries:{id:string;severity:'LIGHT'|'HEAVY';treated:boolean}[];injuryRisk:number;abilities:{id:string;label:string;description:string;mastery:number}[];actions:ErrorAscentAction[];sections:{id:string;title:string;lines:string[]}[];insideCase:boolean }
