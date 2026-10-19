import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { PrinceOfAbolitionSite, PrinceOfAbolitionState } from '../prince-of-abolition/types.js';
import type { EntropyDukeOperationState } from '../entropy-duke/life.js';
import type { BriberGift } from '../briber/types.js';
import type { BlackEmperorOriginalId, BlackEmperorPosition, BlackEmperorCityId, BlackEmperorConsent, BlackEmperorPlaceId } from './content.js';
export { BLACK_EMPEROR_ORIGINAL_IDS, BLACK_EMPEROR_ABILITY_IDS } from './content.js';
export type { BlackEmperorOriginalId, BlackEmperorAbilityId, BlackEmperorPosition, BlackEmperorCityId, BlackEmperorConsent, BlackEmperorPlaceId } from './content.js';

export type BlackEmperorCommand =
 | { type: 'LEARN_GUIDANCE' | 'WORK' | 'REST' | 'CLINIC' | 'NEXT_WEEK' | 'RETURN_ON_FOOT' | 'LEAVE_ORIGINAL_COURT' }
 | { type: 'TRAVEL'; to: BlackEmperorPlaceId }
 | { type: 'WORK_ORIGINAL' | 'ASK_RECOVERY_PERMISSION' | 'INVESTIGATE_REMAINS' | 'SEAL_ORIGINAL' | 'RECOVER_ORIGINAL'; originalId: BlackEmperorOriginalId }
 | { type: 'VERIFY_UNIQUENESS' | 'ACQUIRE_UNIQUENESS' | 'BUY_CARRIER' | 'COMPOSE' }
 | { type: 'STABILIZE_PROMOTION' | 'SEAL_REMAINS' | 'RECOVER_REMAINS'; compoundId: string }
 | { type: 'CONSUME'; compoundId: string; confirmed: true }
 | { type: 'SOLVE_CITY_TASK' | 'IMPLEMENT_ORDERS' | 'NEXT_CONSTRUCTION'; cityId: BlackEmperorCityId }
 | { type: 'REPAIR_TOMB'; tombId: string }
 | { type: 'ENTER_MAUSOLEUM'; tombId: string }
 | { type: 'INSPECT_EXIT' | 'FOUND_REALM' | 'PREPARE_FESTIVAL' | 'HOLD_FESTIVAL' | 'LEAVE_MAUSOLEUM' }
 | { type: 'START_PRACTICE' | 'ASK_WORKERS' | 'WITHDRAW_WORKERS' | 'EXIT_WORKERS' | 'INSPECT_DEVICE' | 'BUY_TOOLS' | 'APPROACH' | 'DISTORT_ORDER' | 'RELEASE_LOAD' | 'ARM_IMPACT' | 'DELAY_IMPACT' | 'WAIT_10' | 'SECURE_LOAD' | 'STOP_MECHANISM' | 'STOP_METHOD' | 'END_CONTACT' | 'WALK_EXIT' | 'CLOSE_EXIT' | 'REPORT_RETURN' };
export interface BlackEmperorBudget {
  week: number; date: PublicGameDate; actions: number; cash: number; health: number; mind: number; spirituality: number; pollution: number;
  injuries: SliceState['injuries']; injuryRisk: number; status: SliceState['status']; sequence: 1 | 0; acting: number;
  mastery: Record<string, number>; coreStats: SliceState['character']['coreStats']; completedSources: string[];
}
export type BlackEmperorFinance = Pick<SliceState, 'weeklyBudget' | 'wagePaidWeek' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface BlackEmperorFrame {
  budget: BlackEmperorBudget; finance: BlackEmperorFinance; random: SliceState['random']; location: BlackEmperorPlaceId; nowSecond: number; weekAnchor: number;
}
/** This immutable handoff is taken only after real S1 cases/reflection100.
 * The adapter must use getPrinceOfAbolitionCurrentSite and princeOfAbolition.life.operation. */
export interface BlackEmperorSource {
  runId: string; actorId: string; revision: number; character: SliceState['character']; budget: BlackEmperorBudget;
  finance: BlackEmperorFinance; random: SliceState['random']; historyDigest: string; originalWorldDigest: string;
  combatHistoryLength: number; combatHistoryDigest: string; originalsDigest: string; acquisitionDigest: string;
  originals: { site: PrinceOfAbolitionSite; operation: EntropyDukeOperationState; gifts: BriberGift[] };
  acquisition: Pick<PrinceOfAbolitionState, 'bottles' | 'resupply' | 'acquisitionJournal'> & { promotionWeek: number };
  /** One ledger entry per fixed original; original bottles and retry carriers remain separate. */
  originalCharacteristics: {
    characteristics: { characteristicId: string; originalBottleId: BlackEmperorOriginalId; latestBottleId: string; holder: 'SUPPLIER' | 'FAILED_REMNANT' | 'PLAYER' | 'EMBODIED'; consumptionHistory: { bottleId: string; revision: number; week: number; outcome: PublicResolutionTier }[] }[];
    embodiedOriginalBottleId: BlackEmperorOriginalId | null; embodiedBottleId: string | null;
  };
}
export interface BlackEmperorOriginal {
  originalId: BlackEmperorOriginalId; characteristicId: string; labourSteps: number; labourEventIds: string[]; latestBottleId: string; failedConsumptionRevision: number | null;
  holder: 'SUPPLIER' | 'UNLOCATED_REMNANT' | 'LOCATED' | 'SEALED_REMNANT' | 'PLAYER' | 'COMPOUND' | 'EMBODIED' | 'FUSED' | 'DEATH_REMAINS';
  location: BlackEmperorPlaceId | null; compoundId: string | null;
  permissionEventId: string | null; permissionWeek: number | null; investigationEventId: string | null;
  sealedEventId: string | null; sealedWeek: number | null; sealedSecond: number | null; recoveredEventId: string | null;
}
export interface BlackEmperorCompound {
  id: string; carrierId: string; status: 'PREPARED' | 'SUCCESS' | 'FAILED_EXPOSED' | 'FAILED_SEALED' | 'RECOVERED' | 'DEATH_REMAINS';
  location: BlackEmperorPlaceId; originalIds: BlackEmperorOriginalId[]; embodiedOriginalId: BlackEmperorOriginalId; uniquenessId: 'BE227-UNIQUENESS';
  preparedEventId: string; consumedEventId: string | null; sealedEventId: string | null;
  sealedWeek: number | null; sealedSecond: number | null; recoveredEventId: string | null;
}
export interface BlackEmperorMaterials {
  originals: BlackEmperorOriginal[];
  uniqueness: { id: 'BE227-UNIQUENESS'; holder: 'CUSTODIAN' | 'PLAYER' | 'COMPOUND' | 'EXPOSED' | 'SEALED' | 'FUSED' | 'DEATH_REMAINS'; location: BlackEmperorPlaceId; compoundId: string | null; verifiedEventId: string | null; acquiredEventId: string | null };
  carriers: { id: string; status: 'SUPPLIER' | 'PLAYER' | 'SPENT'; boughtEventId: string | null }[];
  compounds: BlackEmperorCompound[];
}
export interface BlackEmperorStocks { cash: number; stone: number; timber: number; food: number; labourDays: number }
export interface BlackEmperorTomb {
 id: string; cityId: BlackEmperorCityId; title: string; structure: 'PYRAMIDAL'; privateSite: string;
 stage: 0 | 1 | 2 | 3; integrity: number; workers: number; labourDaysSpent: number;
 stoneSpent: number; timberSpent: number; wagesPaid: number;
 confidentialPermitEventId: string | null; access: 'CLOSED_CONSTRUCTION'; publicCoordinatesDisclosed: false;
 stageEvents: { eventId: string; stage: number; completedWeek: number; workers: number; labourDays: number }[];
 repairEvents: string[];
}
export interface BlackEmperorCity {
 id: BlackEmperorCityId; name: string; population: number; adultWorkers: number;
 initialStocks: BlackEmperorStocks; stocks: BlackEmperorStocks; taskEventId: string | null; mandateEventId: string | null; ownershipEventId: string | null;
 task: { kind: 'SUPPLY' | 'ROAD' | 'ADJUDICATION'; beneficiaries: number; deliveredFood: number; roadMetres: number; settledClaims: number; eventId: string | null };
 orderEvents: { eventId: string; clauseId: string; clause: string; participants: number; building: string | null; stone: number; timber: number; wages: number }[];
 nameProclamation: { eventId: string; actualName: string; title: '皇帝'; heardCount: number; witnessedCount: number; publicNoticeCount: number } | null;
 knowNameCount: number; knowEmperorCount: number; tombs: BlackEmperorTomb[];
}
export interface BlackEmperorFestival {
 id: string; preparedEventId: string; heldEventId: string | null; preparedWeek: number; opportunityWeek: number | null; expiresSecond: number | null; consumedEventId: string | null;
 cityPreparations: { cityId: BlackEmperorCityId; cash: number; food: number; labourDays: number; capacity: number }[];
 participation: { cityId: BlackEmperorCityId; population: number; participants: number; actualName: string; emperorAcknowledged: true; eventId: string }[];
}
export interface BlackEmperorScene {
 phase: 'REALM' | 'PRACTICE'; status: 'ACTIVE' | 'ABORTED' | 'COMPLETED'; playerPosition: BlackEmperorPosition; playerTravelMetres: number; originalDepartureEventId: string | null;
 originalOperation: EntropyDukeOperationState; originalGifts: BriberGift[];
 realm: { id: 'BE227-REALM'; ownerId: string | null; ownerName: string | null; charterEventId: string | null; totalPopulation: 90000; establishedWeek: number | null; cities: BlackEmperorCity[] };
 constructionReceipts: { eventId: string; cityId: BlackEmperorCityId; startWeek: number; endWeek: number; weeks: 3; personalCost: number; treasury: number; stone: number; timber: number; labourDays: number; tombIds: string[]; damagedTombId: string | null }[];
 festivals: BlackEmperorFestival[]; activeFestivalId: string | null; enteredTombId: string | null; tombEntryEventId: string | null;
 exit: { inspectedEventId: string | null; door: 'CLOSED' | 'OPEN' }; toolsBoughtEventId: string | null;
 facility: { id: 'BE227-MUNICIPAL-HOIST'; inspectedEventId: string | null; originalPath: 'MAIN'; currentPath: 'MAIN' | 'SIDE'; pendingLoad: boolean; pendingImpact: boolean; loadReleasedEventId: string | null; impactStartedEventId: string | null; impactResolvedEventId: string | null; ordinaryStopEventId: string | null; stopped: boolean; loadSecured: boolean; contestingLatch: 'ENGAGED' | 'BYPASSED' | 'LOCKED'; version: number; impactDueSecond: number | null; delayApplied: boolean; impactDamage: number };
 workers: { id: string; name: string; age: number; health: number; position: 'OUTSIDE' | 'WORKPLACE'; consent: BlackEmperorConsent; permissionVersion: number; consentEventId: string | null; exitEventId: string | null }[];
 window: { kind: 'ORDER_DISTORTION'; targetId: string; targetVersion: number; permissionVersion: number; createdAt: number; expiresAt: number } | null;
 contact: boolean; orderDistortionApplied: boolean; delayedImpactApplied: boolean;
 receipts: { eventId: string; kind: string; actorId: string; position: BlackEmperorPosition; targetVersion: number }[];
 moves: { eventId: string; actorId: string; from: BlackEmperorPosition; to: BlackEmperorPosition; metres: number; seconds: number }[];
 returnReportEventId: string | null;
}
export interface BlackEmperorPreparation {
  id: string; compoundId: string; actorId: string; sourceDigest: string; compoundDigest: string; festivalId: string;
  location: BlackEmperorPlaceId; preparedSecond: number; expiresSecond: number; status: 'READY' | 'SPENT' | 'INVALIDATED'; spentEventId: string | null;
}
export interface BlackEmperorEvent {
  id: string; revision: number; command: BlackEmperorCommand; before: BlackEmperorFrame; after: BlackEmperorFrame;
  randomReceipts: { id: string; check: PublicCheckResult; cursorBefore: number; cursorAfter: number }[];
  financeReceipts: { title: string; text: string }[]; notes: string[]; beforeDigest: string; afterDigest: string;
}
export interface BlackEmperorState {
  version: 1; guidanceKnown: boolean; source: BlackEmperorSource | null; frame: BlackEmperorFrame | null;
  promotionWeek: number | null; scene: BlackEmperorScene | null; materials: BlackEmperorMaterials | null;
  journal: BlackEmperorEvent[]; promotionStability: { preparations: BlackEmperorPreparation[] };
}
export interface BlackEmperorSceneHost {
  eventId: string; revision: number; week: number; second: number; actorId: string; sequence: 1 | 0;
  actions: number; cash: number; health: number; mind: number; spirituality: number; dosePrepared: boolean; mature: boolean; actualName: string; constructionPersonalCost: number;
}
export interface BlackEmperorEffect { actions: number; cash: number; spirituality: number; mind: number; health: number; seconds: number; mastery?: string[] }
export interface BlackEmperorAction { id: string; label: string; cost: string; command: BlackEmperorCommand; enabled: boolean; reason: string | null; preferredAction?: boolean }
export interface BlackEmperorProjection {
  title: string; guidanceKnown: boolean; promoted: boolean; story: string; nextStep: string; risk: string; insideCase: boolean;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number; weeklyBudget: number };
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  abilities: { id: string; label: string; description: string; mastery: number }[];
  actions: BlackEmperorAction[]; sections: { id: string; title: string; lines: string[] }[];
}
