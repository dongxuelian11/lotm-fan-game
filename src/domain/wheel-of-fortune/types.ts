import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { MercurySnakeSite, MercurySnakeState } from '../mercury-snake/types.js';
import type { FateProphetOperationState } from '../fate-prophet/life.js';
import type { WinnerLuck } from '../winner/types.js';
import type { WheelOfFortuneOriginalId, WheelOfFortunePosition, WheelOfFortuneWorkerId, WheelOfFortuneDestination, WheelOfFortuneConsent, WheelOfFortunePlaceId } from './content.js';
export { WHEEL_OF_FORTUNE_ORIGINAL_IDS, WHEEL_OF_FORTUNE_ABILITY_IDS } from './content.js';
export type { WheelOfFortuneOriginalId, WheelOfFortuneAbilityId, WheelOfFortunePosition, WheelOfFortuneWorkerId, WheelOfFortuneDestination, WheelOfFortuneConsent, WheelOfFortunePlaceId } from './content.js';

export type WheelOfFortuneCommand =
 | { type: 'LEARN_GUIDANCE' | 'WORK' | 'REST' | 'CLINIC' | 'NEXT_WEEK' | 'RETURN_ON_FOOT' | 'LEAVE_ORIGINAL_COURT' }
 | { type: 'TRAVEL'; to: WheelOfFortunePlaceId }
 | { type: 'WORK_ORIGINAL' | 'ASK_RECOVERY_PERMISSION' | 'INVESTIGATE_REMAINS' | 'SEAL_ORIGINAL' | 'RECOVER_ORIGINAL'; originalId: WheelOfFortuneOriginalId }
 | { type: 'VERIFY_UNIQUENESS' | 'ACQUIRE_UNIQUENESS' | 'BUY_CARRIER' | 'COMPOSE' }
 | { type: 'STABILIZE_PROMOTION' | 'SEAL_REMAINS' | 'RECOVER_REMAINS'; compoundId: string }
 | { type: 'CONSUME'; compoundId: string; confirmed: true }
 | { type: 'ASK_OWNER' | 'WITHDRAW_OWNER' | 'VERIFY_PAPERS' | 'INSPECT_EXIT' | 'BUY_TOOLS' | 'OPEN_EXIT' | 'CLOSE_EXIT' | 'APPROACH' | 'INSPECT_DEVICE' }
 | { type: 'ASK_WORKER' | 'WITHDRAW_WORKER' | 'ARRIVE_WORKER' | 'HAND_OVER' | 'EXIT_WORKER'; workerId: WheelOfFortuneWorkerId }
 | { type: 'CHOOSE_DESTINATION'; workerId: WheelOfFortuneWorkerId; destination: WheelOfFortuneDestination }
 | { type: 'REPORT_JUNCTION' | 'NEXT_COMMISSION' | 'START_PRACTICE' | 'BUFFER_IMPACT' | 'SECURE_LOAD' | 'RELEASE_LOAD' | 'CAPTURE_RETURN' | 'WALK_THREE' | 'APPLY_RETURN' | 'WALK_BACK' | 'STOP_METHOD' | 'END_CONTACT' | 'WAIT_10' | 'WALK_EXIT' | 'REPORT_RETURN' };
export interface WheelOfFortuneBudget {
  week: number; date: PublicGameDate; actions: number; cash: number; health: number; mind: number; spirituality: number; pollution: number;
  injuries: SliceState['injuries']; injuryRisk: number; status: SliceState['status']; sequence: 1 | 0; acting: number;
  mastery: Record<string, number>; coreStats: SliceState['character']['coreStats']; completedSources: string[];
}
export type WheelOfFortuneFinance = Pick<SliceState, 'weeklyBudget' | 'wagePaidWeek' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface WheelOfFortuneFrame {
  budget: WheelOfFortuneBudget; finance: WheelOfFortuneFinance; random: SliceState['random']; location: WheelOfFortunePlaceId; nowSecond: number; weekAnchor: number;
}
/** This immutable handoff is taken only after real S1 cases/reflection100.
 * The adapter must use getMercurySnakeCurrentSite and mercurySnake.life.operation. */
export interface WheelOfFortuneSource {
  runId: string; actorId: string; revision: number; character: SliceState['character']; budget: WheelOfFortuneBudget;
  finance: WheelOfFortuneFinance; random: SliceState['random']; historyDigest: string; originalWorldDigest: string;
  combatHistoryLength: number; combatHistoryDigest: string; originalsDigest: string; acquisitionDigest: string;
  originals: { site: MercurySnakeSite; operation: FateProphetOperationState; luck: WinnerLuck };
  acquisition: Pick<MercurySnakeState, 'bottles' | 'resupply' | 'acquisitionJournal'> & { promotionWeek: number };
  /** One ledger entry per fixed original; original bottles and retry carriers remain separate. */
  originalCharacteristics: {
    characteristics: { characteristicId: string; originalBottleId: WheelOfFortuneOriginalId; latestBottleId: string; holder: 'SUPPLIER' | 'FAILED_REMNANT' | 'PLAYER' | 'EMBODIED'; consumptionHistory: { bottleId: string; revision: number; week: number; outcome: PublicResolutionTier }[] }[];
    embodiedOriginalBottleId: WheelOfFortuneOriginalId | null; embodiedBottleId: string | null;
  };
}
export interface WheelOfFortuneOriginal {
  originalId: WheelOfFortuneOriginalId; characteristicId: string; labourSteps: number; labourEventIds: string[]; latestBottleId: string; failedConsumptionRevision: number | null;
  holder: 'SUPPLIER' | 'UNLOCATED_REMNANT' | 'LOCATED' | 'SEALED_REMNANT' | 'PLAYER' | 'COMPOUND' | 'EMBODIED' | 'FUSED' | 'DEATH_REMAINS';
  location: WheelOfFortunePlaceId | null; compoundId: string | null;
  permissionEventId: string | null; permissionWeek: number | null; investigationEventId: string | null;
  sealedEventId: string | null; sealedWeek: number | null; sealedSecond: number | null; recoveredEventId: string | null;
}
export interface WheelOfFortuneCompound {
  id: string; carrierId: string; status: 'PREPARED' | 'SUCCESS' | 'FAILED_EXPOSED' | 'FAILED_SEALED' | 'RECOVERED' | 'DEATH_REMAINS';
  location: WheelOfFortunePlaceId; originalIds: WheelOfFortuneOriginalId[]; embodiedOriginalId: WheelOfFortuneOriginalId; uniquenessId: 'WF226-UNIQUENESS';
  preparedEventId: string; consumedEventId: string | null; sealedEventId: string | null;
  sealedWeek: number | null; sealedSecond: number | null; recoveredEventId: string | null;
}
export interface WheelOfFortuneMaterials {
  originals: WheelOfFortuneOriginal[];
  uniqueness: { id: 'WF226-UNIQUENESS'; holder: 'CUSTODIAN' | 'PLAYER' | 'COMPOUND' | 'EXPOSED' | 'SEALED' | 'FUSED' | 'DEATH_REMAINS'; location: WheelOfFortunePlaceId; compoundId: string | null; verifiedEventId: string | null; acquiredEventId: string | null };
  carriers: { id: string; status: 'SUPPLIER' | 'PLAYER' | 'SPENT'; boughtEventId: string | null }[];
  compounds: WheelOfFortuneCompound[];
}
export interface WheelOfFortuneWorker {
 id: WheelOfFortuneWorkerId; name: string; age: number; purpose: string; alive: boolean; health: number; energy: number;
 position: WheelOfFortunePosition; walkedMetres: number; consent: WheelOfFortuneConsent; permissionVersion: number;
 permissionEventId: string | null; paidEventId: string | null; arrivalEventId: string | null;
 destination: WheelOfFortuneDestination | null; decisionEventId: string | null; handoverEventId: string | null; destinationEventId: string | null;
 paper: { id: string; originalOwnerId: WheelOfFortuneWorkerId; holderId: string; location: WheelOfFortunePosition; signedEventId: string | null; travelMetres: number };
 cargo: { id: string; originalOwnerId: WheelOfFortuneWorkerId; holderId: string; position: WheelOfFortunePosition; travelMetres: number; version: number };
}
export interface WheelOfFortuneCommission {
 id: string; title: string; registeredWeek: number; workers: WheelOfFortuneWorker[]; papersVerifiedEventId: string | null;
 reportEventId: string | null; opportunityWeek: number | null; consumedEventId: string | null;
}
export interface WheelOfFortuneWindow {
 kind: 'IMPACT_BUFFER' | 'SHORT_RETURN'; actorId: string; recordedPosition: 'ENTRY'; targetId: string;
 targetVersion: number; permissionVersion: number; createdAt: number; expiresAt: number; movedEventId: string | null;
}
export interface WheelOfFortuneScene {
 phase: 'PREPARATION' | 'PRACTICE'; status: 'ACTIVE' | 'ABORTED' | 'COMPLETED';
 playerPosition: WheelOfFortunePosition; playerTravelMetres: number; originalDepartureEventId: string | null;
 owner: { id: 'WF226-KEEPER'; name: '伯纳德'; age: 42; alive: boolean; position: 'OUTSIDE'; consent: WheelOfFortuneConsent; permissionVersion: number; permissionWeek: number | null; permissionEventId: string | null };
 commissions: WheelOfFortuneCommission[]; commissionIndex: number;
 originalOperation: FateProphetOperationState; originalLuck: WinnerLuck;
 exit: { inspectedEventId: string | null; door: 'CLOSED' | 'OPEN' }; toolsBoughtEventId: string | null;
 device: { inspectedEventId: string | null; loadFinishedEventId: string | null; returnFinishedEventId: string | null; loadMethod: 'NONE' | 'ORDINARY' | 'ABILITY'; returnMethod: 'NONE' | 'ORDINARY' | 'ABILITY' };
 load: { id: 'WF226-ORIGINAL-CRATE'; position: 'ENTRY'; visible: boolean; secured: boolean; releasedEventId: string | null; dropCentimetres: number; version: number };
 rope: { id: 'WF226-ORIGINAL-ROPE'; integrity: number; wear: number; supportUsedEventId: string | null };
 returnWalkEventId: string | null; contact: boolean; window: WheelOfFortuneWindow | null;
 moves: { eventId: string; actorId: 'PLAYER' | WheelOfFortuneWorkerId; from: WheelOfFortunePosition; to: WheelOfFortunePosition; metres: number; seconds: number; cargoId: string | null; mode: 'WALK' | 'RETURN' }[];
 receipts: { eventId: string; kind: string; actorId: string; position: WheelOfFortunePosition; targetVersion: number }[];
 evacuationReportEventId: string | null; returnReportEventId: string | null; impactBufferApplied: boolean; shortReturnApplied: boolean;
}
export interface WheelOfFortunePreparation {
  id: string; compoundId: string; actorId: string; sourceDigest: string; compoundDigest: string; commissionId: string;
  location: WheelOfFortunePlaceId; preparedSecond: number; expiresSecond: number; status: 'READY' | 'SPENT' | 'INVALIDATED'; spentEventId: string | null;
}
export interface WheelOfFortuneEvent {
  id: string; revision: number; command: WheelOfFortuneCommand; before: WheelOfFortuneFrame; after: WheelOfFortuneFrame;
  randomReceipts: { id: string; check: PublicCheckResult; cursorBefore: number; cursorAfter: number }[];
  financeReceipts: { title: string; text: string }[]; notes: string[]; beforeDigest: string; afterDigest: string;
}
export interface WheelOfFortuneState {
  version: 1; guidanceKnown: boolean; source: WheelOfFortuneSource | null; frame: WheelOfFortuneFrame | null;
  promotionWeek: number | null; scene: WheelOfFortuneScene | null; materials: WheelOfFortuneMaterials | null;
  journal: WheelOfFortuneEvent[]; promotionStability: { preparations: WheelOfFortunePreparation[] };
}
export interface WheelOfFortuneSceneHost {
  eventId: string; revision: number; week: number; second: number; actorId: string; sequence: 1 | 0;
  actions: number; cash: number; health: number; mind: number; spirituality: number; dosePrepared: boolean; mature: boolean;
}
export interface WheelOfFortuneEffect { actions: number; cash: number; spirituality: number; mind: number; health: number; seconds: number; mastery?: string[] }
export interface WheelOfFortuneAction { id: string; label: string; cost: string; command: WheelOfFortuneCommand; enabled: boolean; reason: string | null; preferredAction?: boolean }
export interface WheelOfFortuneProjection {
  title: string; guidanceKnown: boolean; promoted: boolean; story: string; nextStep: string; risk: string; insideCase: boolean;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number; weeklyBudget: number };
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  abilities: { id: string; label: string; description: string; mastery: number }[];
  actions: WheelOfFortuneAction[]; sections: { id: string; title: string; lines: string[] }[];
}
