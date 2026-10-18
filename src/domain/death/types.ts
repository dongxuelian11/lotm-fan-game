/** R217 finite Death contracts. Historical receipts are evidence, never admission bypasses. */
import type { PublicCheckResult, PublicGameDate } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { DeathEffect } from './ports.js';

export const DEATH_ORIGINAL_IDS = ['pale-emperor-potion-1', 'pale-emperor-potion-2', 'pale-emperor-potion-3'] as const;
export type DeathOriginalId = typeof DEATH_ORIGINAL_IDS[number];
export type DeathCharacteristicId = `${DeathOriginalId}:characteristic`;
export const DEATH_UNIQUENESS_ID = 'DE0-U1' as const;
export const DEATH_CARRIER_IDS = ['death-carrier-1', 'death-carrier-2', 'death-carrier-3'] as const;
export type DeathCarrierId = typeof DEATH_CARRIER_IDS[number];
export const DEATH_LABOUR_IDS = ['SEAL_REGISTER', 'CRATE_AUDIT', 'SUPPLY_LIST', 'TRANSIT_RECEIPT', 'DELIVERY_REVIEW'] as const;
export type DeathLabourId = typeof DEATH_LABOUR_IDS[number];
export const DEATH_ABILITY_IDS = ['death.s0.partial-spirit-passage', 'death.s0.residual-propagation-barrier'] as const;
export type DeathAbilityId = typeof DEATH_ABILITY_IDS[number];
export const DEATH_FROZEN_SOURCE_KEYS = ['corpsecollector', 'gravedigger', 'spiritmedium', 'spiritGuide', 'gatekeeper', 'undying', 'ferryman', 'deathConsul', 'longChapter', 'paleEmperor'] as const;
export type DeathFrozenHistory = Pick<SliceState, typeof DEATH_FROZEN_SOURCE_KEYS[number]>;
export type DeathSourceEra = NonNullable<SliceState['paleEmperor']['sourceEra']>;
export type DeathFinance = Pick<SliceState, 'weeklyBudget' | 'wagePaidWeek' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface DeathBudget {
  week: number; date: PublicGameDate; actions: number; cash: number; health: number; mind: number;
  spirituality: number; pollution: number; injuries: SliceState['injuries']; injuryRisk: number;
  status: SliceState['status']; sequence: 1 | 0; acting: number; mastery: Record<string, number>;
  coreStats: SliceState['character']['coreStats']; completedSources: string[];
}
/** Captured history remains intact. These current counters begin from the same
 * actual era handoff, especially emergencyWorkUsed; never from a new allowance. */
export interface DeathEconomy {
  era: 'POST_CYCLE'; sourceEra: DeathSourceEra;
  works: number; rests: number; treatments: number; weeksAdvanced: number;
  income: number; expenses: number; emergencyWorks: number; emergencyWorkUsed: boolean;
  travelledMetres: number; elapsedSeconds: number; livingArrears: number;
}
export interface DeathPermission {
  personId: string; actorId: string; purpose: 'INVESTIGATE' | 'HANDOVER' | 'SERVICE' | 'PASSAGE' | 'BARRIER';
  status: 'ALLOW' | 'REFUSED' | 'WITHDRAWN'; eventId: string; week: number; revision: number;
  location: string; conditionVersion: number;
}
/** Optional future S1 extension. Never retrofit independent historical 4+ stock. */
export interface DeathRecoveryRequest {
  version: 1; sourceBottleId: string; originalBottleId: DeathOriginalId; characteristicId: DeathCharacteristicId;
  sourceReceiptRevision: number; requestedWeek: number; siteId: string; custodianId: string;
  sourceEra: DeathSourceEra;
}
export type DeathRecoveredBottle = SliceState['paleEmperor']['bottles'][number] & {
  recovery?: DeathRecoveryRequest & { recoveredWeek: number };
};
export interface DeathRecoverySiteReceipt {
  siteId: string; sourceReceiptRevision: number; physicalVersion: number; originalBottleId: DeathOriginalId;
  sourceBottleId: string; characteristicId: DeathCharacteristicId; permission: DeathPermission;
  custodyBefore: string; custodyAfter: string;
  /** Explicit replacement of a paid old pending request, without erasing/refunding it. */
  supersededLegacyRequestRevision?: number;
}
export type DeathS1RecoveryCommand = { type: 'REQUEST_RECOVERY_V1' | 'RECOVER_CHARACTERISTIC_V1'; bottleId: string };
export type DeathAcquisitionEvent = Omit<SliceState['paleEmperor']['acquisitionJournal'][number], 'command'> & {
  command: SliceState['paleEmperor']['acquisitionJournal'][number]['command'] | DeathS1RecoveryCommand;
  recoverySite?: DeathRecoverySiteReceipt;
};
export interface DeathOriginSnapshot {
  sourceEra: DeathSourceEra; bottles: DeathRecoveredBottle[]; acquisitionJournal: DeathAcquisitionEvent[];
  promotionWeek: number;
  resupply: { requestedWeek: number | null; deliveries: number; recovery?: DeathRecoveryRequest };
}
export interface DeathOriginalResolution {
  embodiedOriginalBottleId: DeathOriginalId; embodiedBottleId: string; promotionReceiptRevision: number;
  characteristics: { id: DeathCharacteristicId; originalBottleId: DeathOriginalId; latestBottleId: string;
    holder: 'SUPPLIER' | 'PLAYER' | 'FAILED_REMAINS' | 'EMBODIED'; consumeRevision: number | null }[];
}
/** Full old roots remain frozen in the enclosing SliceState. Validation must
 * replay them and compare actual people/objects; digests are not credentials. */
export interface DeathSource {
  runId: string; actorId: string; revision: number; budget: DeathBudget; character: SliceState['character'];
  finance: DeathFinance; random: SliceState['random']; historyDigest: string; originalWorldDigest: string;
  combatHistoryLength: number; combatHistoryDigest: string;
  era: SliceState['ferryman']['era'];
  originals: { chambers: SliceState['deathConsul']['life']['site'];
    life: SliceState['paleEmperor']['life']; encounter: SliceState['paleEmperor']['encounter'] };
  originalsDigest: string; acquisition: DeathOriginSnapshot; acquisitionDigest: string;
  originalCharacteristics: DeathOriginalResolution;
}
export interface DeathFrame {
  budget: DeathBudget; finance: DeathFinance; random: SliceState['random']; economy: DeathEconomy;
  location: string; nowSecond: number; weekAnchor: number;
}
export type DeathHolder = 'EMBODIED' | 'SUPPLIER' | 'PLAYER' | 'UNLOCATED' | 'LOCATED' | 'LEGACY_SEALED' |
  'UNVERIFIED' | 'CUSTODIAN' | 'COMPOUND' | 'EXPOSED' | 'SEALED' | 'LOST' | 'FUSED';
export interface DeathCharacteristic {
  id: DeathCharacteristicId; originBottleId: DeathOriginalId; latestBottleId: string; holder: DeathHolder;
  location: string | null; compoundId: string | null; inheritedLabourSteps: number; recoveredVessel: boolean;
  labour: { taskId: DeathLabourId; eventId: string; week: number }[];
  /** One 8p discount per failed original, never income or supplier labour. */
  legacyLabour: { eventId: string; week: number; credit: 8; spentEventId: string | null } | null;
  acquiredEventId: string | null;
}
/** A failed receipt establishes lineage only. Null physical fields remain
 * unknown until a current, permitted visit actually locates this exact residue. */
export interface DeathLegacyRemains {
  originalBottleId: DeathOriginalId; latestBottleId: string; characteristicId: DeathCharacteristicId;
  consumeRevision: number; physicalId: string | null; sceneId: string | null; location: string | null;
  custodianId: string | null; physicalVersion: number | null; residualPresent: boolean | null;
  accessible: boolean | null; currentPermission: DeathPermission | null;
  investigatedEventId: string | null; sealedEventId: string | null; sealedWeek: number | null;
  sealedSecond: number | null; recoveredEventId: string | null;
}
export interface DeathSuccession {
  branchId: 'death-original-future-1412'; uniquenessId: typeof DEATH_UNIQUENESS_ID; seal: string; objectCount: 1;
  predecessorId: 'DE0-PREDECESSOR-1412'; predecessorStillEmbodied: false;
  termination: { eventId: string; date: PublicGameDate; cause: 'ACTUAL_DEATH'; status: 'DEAD'; health: 0 };
  separation: { eventId: string; date: PublicGameDate; objectId: typeof DEATH_UNIQUENESS_ID };
  transfer: { eventId: string; date: PublicGameDate; objectId: typeof DEATH_UNIQUENESS_ID; toActorId: string; custodyOnly: true };
  characteristicCustody: { originalBottleId: DeathOriginalId; characteristicId: DeathCharacteristicId;
    separation: { eventId: string; date: PublicGameDate };
    transfer: { eventId: string; date: PublicGameDate; toActorId: string } }[];
  incumbentActorId: null; custodianActorId: 'DE0-UNIQUENESS-CUSTODIAN'; custodianEmbodied: false;
  location: string; permission: DeathPermission | null; conditionVersion: number;
}
export interface DeathUniqueness {
  id: typeof DEATH_UNIQUENESS_ID; holder: DeathHolder; location: string | null; compoundId: string | null;
  incumbentActorId: string | null; custodianActorId: string | null; succession: DeathSuccession | null;
  checks: { step: 'CHAIN' | 'VACANCY'; eventId: string; week: number; conditionVersion: number }[];
  acquiredEventId: string | null;
}
export interface DeathCarrier {
  id: DeathCarrierId; status: 'SUPPLIER' | 'PLAYER' | 'IN_COMPOUND' | 'SPENT'; location: string;
  acquiredEventId: string | null; uses: 0 | 1;
  stopper: { id: `${DeathCarrierId}:stopper`; status: 'SUPPLIER' | 'PLAYER' | 'USED'; usedEventId: string | null };
}
export const DEATH_SERVICE_IDS = ['residue-sealing', 'old-wharf-exit'] as const;
export type DeathServiceId = typeof DEATH_SERVICE_IDS[number];
export interface DeathServiceReceipt {
  serviceId: DeathServiceId; residentIds: string[]; apparatusIds: string[]; passedEventId: string; passedWeek: number;
  reviewedEventId: string; reviewedWeek: number; conditionVersions: Record<string, number>;
}
export interface DeathCompound {
  id: string; batchId: DeathCarrierId;
  status: 'PREPARED' | 'SUCCESS' | 'FAILED_EXPOSED' | 'FAILED_SEALED' | 'FAILED_LOST' | 'RECOVERED';
  location: string; characteristicIds: [DeathCharacteristicId, DeathCharacteristicId]; uniquenessId: typeof DEATH_UNIQUENESS_ID;
  preparedEventId: string; preparedWeek: number; consumedWeek: number | null; sealedWeek: number | null;
  sealedSecond: number | null; settlementEventId: string | null; sealedEventId: string | null;
  recoveredEventId: string | null; residualPresent: boolean; physicalVersion: number;
  stopperId: `${DeathCarrierId}:stopper`; serviceReceipts: DeathServiceReceipt[];
}
export type DeathMaterialCommand =
  | { type: 'MATERIAL_LABOUR'; bottleId: DeathOriginalId; taskId: DeathLabourId }
  | { type: 'ACQUIRE_CHARACTERISTIC' | 'ASK_LEGACY_PERMISSION' | 'INVESTIGATE_LEGACY_REMAINS' |
      'SEAL_LEGACY_REMAINS' | 'LEGACY_LABOUR' | 'RECOVER_LEGACY_REMAINS'; bottleId: DeathOriginalId }
  | { type: 'VERIFY_UNIQUENESS'; step: 'CHAIN' | 'VACANCY' }
  | { type: 'ASK_UNIQUENESS_PERMISSION' }
  | { type: 'ACQUIRE_UNIQUENESS' }
  | { type: 'BUY_COMPOUND' | 'COMPOSE_POTION'; batchId: DeathCarrierId }
  | { type: 'SEAL_REMAINS' | 'ASK_RECOVERY_PERMISSION' | 'RECOVER_SEALED'; compoundId: string };
export interface DeathMaterialPolicy {
  id: string; supplierLocation: string; workshopLocation: string; archiveLocation: string; legacyLocation: string;
  carrierPrices: Record<DeathCarrierId, number>; investigateFee: number; legacyRecoveryFee: number;
  legacyLabourCredit: 8; uniquenessCheckFee: number; uniquenessHandoverFee: number;
  composeFee: number; sealedRecoveryFee: number; sealSeconds: 600;
  succession: DeathSuccession; serviceIds: readonly [DeathServiceId, DeathServiceId];
}
export interface DeathLegacyAccess {
  originalBottleId: DeathOriginalId; latestBottleId: string; characteristicId: DeathCharacteristicId;
  consumeRevision: number; physicalId: string; sceneId: string; location: string; custodianId: string;
  custodianPresent: boolean; accessible: boolean; residualPresent: boolean; physicalVersion: number;
  investigation: DeathPermission | null; handover: DeathPermission | null;
}
export interface DeathMaterialHost {
  eventId: string; revision: number; week: number; date: PublicGameDate; actorId: string;
  sourceDigest: string; sourceEra: DeathSourceEra; location: string; nowSecond: number; weekAnchor: number;
  sequence: 1 | 0; status: 'ACTIVE' | 'DEAD'; cash: number; actions: number;
  serviceReceipts: DeathServiceReceipt[]; legacyAccess: DeathLegacyAccess | null;
  succession: DeathSuccession | null; uniquenessCustodianPresent: boolean;
  recoveryPermission: DeathPermission | null;
}
export interface DeathMaterialEffect { actions: number; cashCost: number; seconds: number }
export interface DeathMaterialSettlement {
  eventId: string; week: number; compoundId: string; success: boolean; alive: boolean; location: string;
  residualPresent: boolean; physicalVersion: number;
}
export interface DeathCompoundAccess {
  compoundId: string; physicalId: string; sceneId: string; location: string;
  characteristicIds: DeathCompound['characteristicIds']; uniquenessId: typeof DEATH_UNIQUENESS_ID;
  custodianId: string; custodianPresent: boolean; accessible: boolean; residualPresent: boolean;
  physicalVersion: number; sealed: boolean; handover: DeathPermission | null;
}

export interface DeathMaterialScene {
  version: 1;
  receivingTray: { id: 'DE0-WORKSHOP-RECEIVING-TRAY'; location: string; present: boolean; accessible: boolean; conditionVersion: number };
  legacy: { custodianId: string; adult: true; location: string; custodianPresent: boolean; accessible: boolean;
    conditionVersion: number; response: 'ALLOW' | 'REFUSED' | 'WITHDRAWN' };
  uniqueness: { objectId: 'DE0-U1'; seal: string; objectCount: 1; location: string;
    custodianId: 'DE0-UNIQUENESS-CUSTODIAN'; adult: true; custodianPresent: boolean; accessible: boolean;
    present: boolean; physicalVersion: number; incumbentActorId: string | null;
    predecessorStillEmbodied: boolean; custodianEmbodied: boolean;
    response: 'ALLOW' | 'REFUSED' | 'WITHDRAWN'; permission: DeathPermission | null };
  workshop: { custodianId: string; adult: true; location: string; custodianPresent: boolean; accessible: boolean;
    conditionVersion: number; response: 'ALLOW' | 'REFUSED' | 'WITHDRAWN'; permission: DeathPermission | null };
}

export interface DeathMaterialsState {
  version: 1; recoverySites: DeathCompoundAccess[]; origin: DeathOriginSnapshot & { actorId: string; sourceDigest: string; inheritanceLocation: string };
  embodiedOriginalBottleId: DeathOriginalId; characteristics: DeathCharacteristic[]; legacyRemains: DeathLegacyRemains[];
  uniqueness: DeathUniqueness; batches: DeathCarrier[]; compounds: DeathCompound[]; legacySites: DeathLegacyAccess[];
  receipts: { eventId: string; revision: number; week: number; location: string;
    command: DeathMaterialCommand; effect: DeathMaterialEffect }[];
  settlements: DeathMaterialSettlement[];
}

export const DEATH_WORKER_IDS = ['DE0-WHARF-WORKER-1', 'DE0-WHARF-WORKER-2'] as const;
export type DeathWorkerId = typeof DEATH_WORKER_IDS[number];
export interface DeathServiceVisit { visitId: string | null; accessVersion: number; stopped: boolean; surveyVisitId: string | null }
export interface DeathServiceStockChange {
  objectId: string; stockBefore: number; stockAfter: number; holderBefore: string; holderAfter: string;
  versionBefore: number; versionAfter: number;
}
export interface DeathResident {
  willingness: 'ALLOW' | 'REFUSED' | 'WITHDRAWN'; conditionVersion: number;
  id: string; name: string; age: number; bodyId: string; status: 'ACTIVE' | 'DEAD';
  health: number; energy: number; injuries: string[]; location: string; position: number;
  consent: DeathPermission | null; travelledMetres: number; elapsedSeconds: number;
}
export interface DeathServiceCompletion {
  eventId: string; week: number; second: number; conditionVersions: Record<string, number>;
}
export interface DeathFiniteResidue {
  id: string; intelligent: false; total: number; exposed: number; contained: number; dissipated: number;
  /** The same finite material: exposed + contained + dissipated always equals total. */
  containerId: string; location: string; conditionVersion: number;
}
export interface DeathResidueSite extends DeathServiceVisit {
  observedEventId: string | null; observedVisitId: string | null;
  id: 'residue-sealing'; location: 'DE0-RESIDUE-ROOM'; playerPosition: number; custodian: DeathResident;
  residue: DeathFiniteResidue;
  apparatus: { containerId: string; lidId: string; screenId: string; lid: 'OPEN' | 'CLOSED';
    screen: 'ASIDE' | 'SHIELDING'; seal: 'NONE' | 'INTACT' | 'BROKEN'; location: string; version: number;
    containerPosition: number; lidPosition: number; screenPosition: number; ownerId: string; containerHolder: string;
    returnedEventId: string | null; containerVersion: number; lidVersion: number; screenVersion: number };
  propagation: { id: string; from: string; to: string; visible: boolean; blocked: boolean; version: number };
  supply: { id: 'DE0-RESIDUE-SEAL-1'; stock: 0 | 1; boughtEventId: string | null; usedEventId: string | null;
    holder: 'SUPPLIER' | 'PLAYER' | 'USED'; version: number; location: 'DE0-RESIDUE-ROOM'; position: number };
  survey: DeathServiceCompletion | null; shielded: DeathServiceCompletion | null;
  completion: DeathServiceCompletion | null; review: DeathServiceCompletion | null; ordinaryExit: 'OPEN' | 'BLOCKED';
}
export interface DeathWharfSite extends DeathServiceVisit {
  retreat: { id: 'DE0-WHARF-SHORE-FOOTPATH'; open: true; metres: 18; version: number };
  id: 'old-wharf-exit'; location: 'DE0-OLD-WHARF'; playerPosition: number;
  workers: [DeathResident & { id: 'DE0-WHARF-WORKER-1' }, DeathResident & { id: 'DE0-WHARF-WORKER-2' }];
  bridge: { id: 'DE0-WHARF-BRIDGE'; condition: number; version: number; supported: boolean; passable: boolean };
  rope: { id: 'DE0-WHARF-ROPE-1'; stock: 0 | 1; condition: number; version: number;
    boughtEventId: string | null; installedEventId: string | null; spentMetres: number;
    holder: 'SUPPLIER' | 'PLAYER' | 'INSTALLED'; location: 'DE0-OLD-WHARF'; position: number | null;
    installedSpan: { from: 0; to: 12; metres: 16 } | null };
  endpoints: { unsafeId: string; safeId: string; unsafePosition: number; safePosition: number;
    surveyedEventId: string | null; routeMetres: number; routeSeconds: number };
  ordinaryExit: 'OPEN' | 'BLOCKED'; fallback: 'STOP_AND_RETREAT'; survey: DeathServiceCompletion | null;
  arrivals: { workerId: DeathWorkerId; eventId: string; week: number; second: number;
    route: 'BRIDGE_ROPE'; from: number; to: number; metres: number; seconds: number; energyCost: number;
    ropeConditionBefore: number; ropeConditionAfter: number }[];
  completion: DeathServiceCompletion | null; review: DeathServiceCompletion | null;
}
export type DeathServiceCommand =
  | { type: 'ASK_PERMISSION' | 'SURVEY' | 'BUY_SUPPLIES' | 'VERIFY_SERVICE' | 'STOP_SERVICE' | 'RETURN_ON_FOOT'; serviceId: DeathServiceId }
  | { type: 'OBSERVE_PROPAGATION' | 'POSITION_SCREEN' | 'CLOSE_LID' | 'SEAL_CONTAINER' | 'RETURN_CONTAINER'; serviceId: 'residue-sealing' }
  | { type: 'LAY_ROPE' | 'SUPPORT_BRIDGE'; serviceId: 'old-wharf-exit' }
  | { type: 'ESCORT_WORKER'; serviceId: 'old-wharf-exit'; workerId: DeathWorkerId };
export interface DeathMovementReceipt {
  actorId: string; from: string; to: string; metres: number; seconds: number; energyCost: number;
}
export interface DeathServiceEvent {
  week: number; endWeek: number; permissionEvents: DeathPermission[]; stockChanges: DeathServiceStockChange[];
  id: string; revision: number; command: DeathServiceCommand; beforeSecond: number; afterSecond: number;
  conditionVersionsBefore: Record<string, number>; conditionVersionsAfter: Record<string, number>;
  movements: DeathMovementReceipt[]; consumedIds: string[]; effect: DeathEffect; notes: string[];
}
export interface DeathServicesState {
  version: 1; runId: string; actorId: string; startWeek: number; startSecond: number; lastSecond: number;
  residue: DeathResidueSite; wharf: DeathWharfSite; journal: DeathServiceEvent[];
}

/** One fixed current target, not a summon, an arbitrary destination or an NPC copy. */
export interface DeathWindow {
  abilityId: DeathAbilityId; attempted: boolean; passed: boolean; applied: boolean;
  targetId: string | null; openedEventId: string | null; appliedEventId: string | null;
  conditionVersion: number | null; permissionEventId: string | null;
  openedSecond: number | null; expiresSecond: number | null;
  counter: 'NONE' | 'OCCLUDED' | 'ANCHOR_MOVED' | 'PERMISSION_WITHDRAWN' | 'EXPIRED' | 'STOPPED';
}
export type DeathEpilogueCommand =
  | { type: 'OBSERVE' | 'ASK_PASSAGE_PERMISSION' | 'ASK_BARRIER_PERMISSION' | 'SURVEY_ENDPOINTS' |
      'OBSERVE_PROPAGATION' | 'PARTIAL_SPIRIT_PASSAGE' | 'TRAVERSE_PASSAGE' | 'PROPAGATION_BARRIER' |
      'APPLY_BARRIER' | 'LOWER_SCREEN' | 'STOP_EFFECTS' | 'MANUAL_SEAL' | 'ORDINARY_EXIT' | 'WITHDRAW' | 'REPORT' };
export interface DeathEpiloguePhase {
  kind: 'ASK_RECEIVER' | 'WALK_TO_KEEPER' | 'ASK_KEEPER' | 'LOAD_ORIGINAL' | 'CARRY_ORIGINAL' |
    'RETURN_EMPTY' | 'HANDOVER_ORIGINAL' | 'TIDE_INCIDENT';
  startedSecond: number; endedSecond: number; location: string;
  permission: DeathPermission | null; movements: DeathMovementReceipt[]; notes: string[];
}
export interface DeathEpilogueObjectChange {
  objectId: string; before: string | number; after: string | number; cause: string;
}
export interface DeathEpilogueState {
  playerLocation: string;
  /** This is the sole live vessel location/custody. The keeper and room screen
   * remain in their real room; neither is carried or remotely borrowed. */
  vessel: { keeper: DeathResident; roomScreen: { id: string; location: string; position: number; version: number };
    ownerId: string; holderId: string;
    location: string; position: number; delivered: boolean; lid: 'CLOSED' | 'TILTED';
    seal: 'INTACT' | 'BROKEN'; sealId: string; sealVersion: number; version: number; keeperPermission: DeathPermission | null;
    receiverPermission: DeathPermission | null; manuallyContainedEventId: string | null };
  introduction: { phases: DeathEpiloguePhase[]; effect: DeathEffect; movements: DeathMovementReceipt[];
    objectChanges: DeathEpilogueObjectChange[]; incidentOccurred: boolean };
  pulse: { dueSecond: number | null; settledSecond: number | null; outcome: 'PENDING' | 'BLOCKED' | 'CONTAINED' | 'HIT' | 'MISSED' | 'NONE';
    targetBodyId: string; targetPosition: number; healthLost: number };
  observedPropagationEventId: string | null;
  journeys: { eventId: string; actorId: string; route: 'PARTIAL_SPIRIT' | 'SHORE_ROAD' | 'CITY_ROAD';
    from: string; to: string; metres: number; seconds: number; energyCost: number }[];
  stopped: boolean;
  id: 'death-original-wharf-aftershock'; actorId: string; location: 'DE0-OLD-WHARF';
  startedWeek: number; startedSecond: number; lastSecond: number; status: 'ACTIVE' | 'RESOLVED' | 'WITHDRAWN';
  position: number; observed: boolean; reported: boolean; conditionVersion: number;
  /** Immutable end-of-service snapshot. Current copies below are the sole
   * continuation; creation must record the new accident, never reset either job. */
  origin: { wharf: DeathWharfSite; residue: DeathResidueSite; receipts: DeathServiceReceipt[] };
  wharf: DeathWharfSite;
  incident: { eventId: string; cause: string; happenedSecond: number; objectId: string;
    conditionBefore: number; conditionAfter: number; movements: DeathMovementReceipt[] };
  /** Sole live continuation of the completed service's same four finite portions. */
  residue: DeathFiniteResidue;
  propagation: { id: string; from: string; to: string; visible: boolean; remainingPulses: 0 | 1;
    blockedPulses: 0 | 1; version: number };
  passage: { targetWorkerId: DeathWorkerId; from: string; to: string; distanceMetres: number; traverseSeconds: number;
    endpointsVerifiedEventId: string | null; permission: DeathPermission | null; window: DeathWindow };
  barrier: { permission: DeathPermission | null; window: DeathWindow };
  screen: { id: string; opaque: true; lowered: boolean; condition: number; version: number };
  arrivals: { workerId: DeathWorkerId; eventId: string; second: number; route: 'PARTIAL_SPIRIT' | 'BRIDGE_ROPE';
    metres: number; seconds: number; energyCost: number }[];
  journal: { week: number; endWeek: number; permissionEvents: DeathPermission[]; objectChanges: DeathEpilogueObjectChange[];
    eventId: string; revision: number; command: DeathEpilogueCommand; beforeSecond: number;
    afterSecond: number; effect: DeathEffect; check: PublicCheckResult | null;
    movements: DeathMovementReceipt[]; masteryGains: Partial<Record<DeathAbilityId, number>>; notes: string[] }[];
}
/** Exact unapproved skill numbers are deliberately required rather than copied
 * from Sun. Author/freeze the finite incident policy before implementing it. */
export interface DeathEpiloguePolicy {
  windowSeconds: 20; maximumCompanions: 1; maximumPropagationLines: 1; attemptsPerAbility: 1;
  passage: { actions: number; cash: number; spirituality: number; mind: number; seconds: number;
    difficulty: number; distanceMetres: number; traverseSeconds: number; energyCost: number; masteryGain: number };
  barrier: { actions: number; cash: number; spirituality: number; mind: number; seconds: number;
    difficulty: number; propagationHealthCost: number; masteryGain: number };
  ordinaryExit: { actions: 0; cash: 0; metres: number; seconds: number; energyCost: number };
}
export type DeathCommand =
  | { type: 'LEARN_GUIDANCE' | 'WORK' | 'REST' | 'CLINIC' | 'NEXT_WEEK' | 'START_EPILOGUE' | 'RETURN_ON_FOOT' }
  | { type: 'TRAVEL'; to: string }
  | { type: 'SERVICE'; command: DeathServiceCommand }
  | { type: 'MATERIAL'; command: DeathMaterialCommand }
  | { type: 'STABILIZE_PROMOTION'; compoundId: string }
  | { type: 'CONSUME'; compoundId: string; confirmed: true }
  | { type: 'EPILOGUE'; command: DeathEpilogueCommand };
export interface DeathCheckReceipt {
  kind: 'CHECK'; id: string; check: PublicCheckResult; cursorBefore: number; cursorAfter: number;
}
export interface DeathEvent {
  id: string; revision: number; command: DeathCommand; before: DeathFrame; after: DeathFrame;
  randomReceipts: DeathCheckReceipt[]; financeReceipts: { title: string; text: string }[];
  notes: string[]; beforeDigest: string; afterDigest: string;
}
export interface DeathPromotionPreparation {
  id: string; eventId: string; compoundId: string; actorId: string; sourceDigest: string; compoundDigest: string;
  location: string; week: number; preparedSecond: number; expiresSecond: number;
  serviceReceiptIds: string[]; uniquenessVerificationIds: string[]; conditionVersions: Record<string, number>;
  status: 'READY' | 'SPENT' | 'INVALIDATED'; spentEventId: string | null; invalidatedEventId: string | null;
}
export interface DeathState {
  version: 1; guidanceKnown: boolean; source: DeathSource | null; frame: DeathFrame | null;
  promotionWeek: number | null; services: DeathServicesState | null; materials: DeathMaterialsState | null;
  materialScene: DeathMaterialScene | null;
  epilogue: DeathEpilogueState | null; journal: DeathEvent[];
  promotionStability: { preparations: DeathPromotionPreparation[] };
}
export interface DeathAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null;
  command: DeathCommand; preferredAction?: boolean;
}
/** Explicit public whitelist. No seed/cursor, raw source, internal ritual,
 * full journal, arbitrary host object or source/condition digests. */
export interface DeathProjection {
  title: string; guidanceKnown: boolean; promoted: boolean; story: string; nextStep: string; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number;
    maxSpirituality: number; cash: string; actionsRemaining: number; weeklyBudget: number };
  abilities: { id: string; label: string; mastery: number; description: string }[];
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  actions: DeathAction[]; sections: { id: string; title: string; lines: string[] }[]; insideCase: boolean;
}
