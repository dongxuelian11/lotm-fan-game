import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { HandOfOrderSite, HandOfOrderState } from '../hand-of-order/types.js';
import type { HandOfOrderOperationState, HandOfOrderGuardPlate } from '../hand-of-order/life.js';
import type { JusticiarOriginalId, JusticiarPosition, JusticiarWorkerId, JusticiarSegmentId, JusticiarConsent, JusticiarPlaceId } from './content.js';
export { JUSTICIAR_ORIGINAL_IDS, JUSTICIAR_ABILITY_IDS } from './content.js';
export type { JusticiarOriginalId, JusticiarAbilityId, JusticiarPosition, JusticiarWorkerId, JusticiarSegmentId, JusticiarConsent, JusticiarPlaceId } from './content.js';

export type JusticiarCommand =
  | { type: 'LEARN_GUIDANCE' | 'WORK' | 'REST' | 'CLINIC' | 'NEXT_WEEK' | 'RETURN_ON_FOOT' | 'LEAVE_ORIGINAL_COURT' }
  | { type: 'TRAVEL'; to: JusticiarPlaceId }
  | { type: 'WORK_ORIGINAL' | 'ASK_RECOVERY_PERMISSION' | 'INVESTIGATE_REMAINS' | 'SEAL_ORIGINAL' | 'RECOVER_ORIGINAL'; originalId: JusticiarOriginalId }
  | { type: 'VERIFY_UNIQUENESS' | 'ACQUIRE_UNIQUENESS' | 'BUY_CARRIER' | 'COMPOSE' }
  | { type: 'STABILIZE_PROMOTION' | 'SEAL_REMAINS' | 'RECOVER_REMAINS'; compoundId: string }
  | { type: 'CONSUME'; compoundId: string; confirmed: true }
  | { type: 'ASK_OWNER' | 'WITHDRAW_OWNER' | 'APPROACH' | 'INSPECT_EXIT' | 'INSPECT_DEVICE' | 'BUY_TOOLS' | 'OPEN_EXIT' | 'CLOSE_EXIT' }
  | { type: 'ASK_WORKER' | 'WITHDRAW_WORKER' | 'ARRIVE_WORKER' | 'EXIT_WORKER'; workerId: JusticiarWorkerId }
  | { type: 'INSPECT_SEGMENT' | 'REMOVE_PIN' | 'OPEN_SEGMENT' | 'CLOSE_SEGMENT'; segment: JusticiarSegmentId }
  | { type: 'CROSS'; actorId: 'PLAYER' | JusticiarWorkerId; segment: JusticiarSegmentId }
  | { type: 'REPORT_EVACUATION' | 'START_PRACTICE' | 'CONSTRAIN_GATE' | 'APPLY_CONSTRAINT' | 'MANUAL_INSPECTION' | 'DECLARE_ACTION' | 'PRIORITIZE_ACTION' | 'RESIST_PRIORITY' | 'MOVE_CARGO' | 'SECURE_CARGO' | 'STOP_METHOD' | 'END_CONTACT' | 'WAIT_10' | 'WALK_EXIT' | 'REPORT_RETURN' };
export interface JusticiarBudget {
  week: number; date: PublicGameDate; actions: number; cash: number; health: number; mind: number; spirituality: number; pollution: number;
  injuries: SliceState['injuries']; injuryRisk: number; status: SliceState['status']; sequence: 1 | 0; acting: number;
  mastery: Record<string, number>; coreStats: SliceState['character']['coreStats']; completedSources: string[];
}
export type JusticiarFinance = Pick<SliceState, 'weeklyBudget' | 'wagePaidWeek' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface JusticiarFrame {
  budget: JusticiarBudget; finance: JusticiarFinance; random: SliceState['random']; location: JusticiarPlaceId; nowSecond: number; weekAnchor: number;
}
/** This immutable handoff is taken only after real S1 cases/reflection100.
 * The adapter must use getHandOfOrderCurrentSite and handOfOrder.life.operation. */
export interface JusticiarSource {
  runId: string; actorId: string; revision: number; character: SliceState['character']; budget: JusticiarBudget;
  finance: JusticiarFinance; random: SliceState['random']; historyDigest: string; originalWorldDigest: string;
  combatHistoryLength: number; combatHistoryDigest: string; originalsDigest: string; acquisitionDigest: string;
  originals: { site: HandOfOrderSite; operation: HandOfOrderOperationState; guardPlate: HandOfOrderGuardPlate };
  acquisition: Pick<HandOfOrderState, 'bottles' | 'resupply' | 'acquisitionJournal'> & { promotionWeek: number };
  /** One ledger entry per fixed original; original bottles and retry carriers remain separate. */
  originalCharacteristics: {
    characteristics: { characteristicId: string; originalBottleId: JusticiarOriginalId; latestBottleId: string; holder: 'SUPPLIER' | 'FAILED_REMNANT' | 'PLAYER' | 'EMBODIED'; consumptionHistory: { bottleId: string; revision: number; week: number; outcome: PublicResolutionTier }[] }[];
    embodiedOriginalBottleId: JusticiarOriginalId | null; embodiedBottleId: string | null;
  };
}
export interface JusticiarOriginal {
  originalId: JusticiarOriginalId; characteristicId: string; labourSteps: number; labourEventIds: string[]; latestBottleId: string; failedConsumptionRevision: number | null;
  holder: 'SUPPLIER' | 'UNLOCATED_REMNANT' | 'LOCATED' | 'SEALED_REMNANT' | 'PLAYER' | 'COMPOUND' | 'EMBODIED' | 'FUSED' | 'DEATH_REMAINS';
  location: JusticiarPlaceId | null; compoundId: string | null;
  permissionEventId: string | null; permissionWeek: number | null; investigationEventId: string | null;
  sealedEventId: string | null; sealedWeek: number | null; sealedSecond: number | null; recoveredEventId: string | null;
}
export interface JusticiarCompound {
  id: string; carrierId: string; status: 'PREPARED' | 'SUCCESS' | 'FAILED_EXPOSED' | 'FAILED_SEALED' | 'RECOVERED' | 'DEATH_REMAINS';
  location: JusticiarPlaceId; originalIds: JusticiarOriginalId[]; embodiedOriginalId: JusticiarOriginalId; uniquenessId: 'JU228-UNIQUENESS';
  preparedEventId: string; consumedEventId: string | null; sealedEventId: string | null;
  sealedWeek: number | null; sealedSecond: number | null; recoveredEventId: string | null;
}
export interface JusticiarMaterials {
  originals: JusticiarOriginal[];
  uniqueness: { id: 'JU228-UNIQUENESS'; holder: 'CUSTODIAN' | 'PLAYER' | 'COMPOUND' | 'EXPOSED' | 'SEALED' | 'FUSED' | 'DEATH_REMAINS'; location: JusticiarPlaceId; compoundId: string | null; verifiedEventId: string | null; acquiredEventId: string | null };
  carriers: { id: string; status: 'SUPPLIER' | 'PLAYER' | 'SPENT'; boughtEventId: string | null }[];
  compounds: JusticiarCompound[];
}
export interface JusticiarWorker {
  id: JusticiarWorkerId; name: string; age: number; alive: boolean; health: number; energy: number;
  position: JusticiarPosition; walkedMetres: number; consent: JusticiarConsent; permissionVersion: number;
  permissionEventId: string | null; paidEventId: string | null; arrivalEventId: string | null;
  passage: { a: string | null; b: string | null; exit: string | null };
}
export interface JusticiarWindow {
  kind: 'GATE_CONSTRAINT' | 'OWN_ACTION_PRIORITY'; actorId: string; startPosition: 'GATE'; targetId: string;
  targetVersion: number; permissionVersion: number; createdAt: number; expiresAt: number; pendingId: string | null;
}
export interface JusticiarCargo {
  id: 'JU228-CARGO-ADA' | 'JU228-CARGO-SIMON' | 'JU228-MAINTENANCE-BOX';
  ownerId: JusticiarWorkerId | 'PLAYER'; carrierId: JusticiarWorkerId | 'PLAYER'; position: JusticiarPosition; travelMetres: number;
  version: number; visible: boolean; secured: boolean; offsetMetres: number; movedEventId: string | null;
  passage: { a: string | null; b: string | null; exit: string | null };
}
export interface JusticiarScene {
  phase: 'PREPARATION' | 'PRACTICE'; status: 'ACTIVE' | 'ABORTED' | 'COMPLETED';
  playerPosition: JusticiarPosition; playerTravelMetres: number; originalDepartureEventId: string | null;
  owner: { id: 'JU228-KEEPER'; name: '路易斯'; age: 42; alive: boolean; position: 'OUTSIDE'; consent: JusticiarConsent; permissionVersion: number; permissionWeek: number | null; permissionEventId: string | null };
  workers: JusticiarWorker[]; cargo: JusticiarCargo[];
  originalOperation: HandOfOrderOperationState; originalGuardPlate: Omit<HandOfOrderGuardPlate, 'location'> & { location: JusticiarPosition };
  segments: Record<JusticiarSegmentId, { inspectedEventId: string | null; open: boolean; pin: { id: string; position: 'INSERTED' | 'PLAYER' | 'BENCH'; location: JusticiarPosition; travelMetres: number; integrity: number; wear: number; version: number; removedEventId: string | null } }>;
  exit: { inspectedEventId: string | null; door: 'CLOSED' | 'OPEN' };
  toolsBoughtEventId: string | null;
  device: { inspectedEventId: string | null; loadFinishedEventId: string | null; cargoFinishedEventId: string | null; loadMethod: 'NONE' | 'ORDINARY' | 'ABILITY'; cargoMethod: 'NONE' | 'ORDINARY' | 'ABILITY' };
  gate: { id: 'JU228-ORIGINAL-GATE-B'; location: 'GATE'; integrity: number; wear: number; version: number; loadEventId: string | null; dropCentimetres: number };
  supportPads: { initial: 2; remaining: number; spentEventIds: string[] };
  pending: { id: string; actorId: string; cargoId: 'JU228-MAINTENANCE-BOX'; cargoVersion: number; position: 'GATE'; createdAt: number; status: 'PENDING' | 'COMPLETED' | 'CANCELLED'; order: 'ORDINARY' | 'PRIORITIZED' | 'RESISTED'; resolvedEventId: string | null } | null;
  contact: boolean; window: JusticiarWindow | null;
  moves: { eventId: string; actorId: 'PLAYER' | JusticiarWorkerId; from: JusticiarPosition; to: JusticiarPosition; metres: number; seconds: number; cargoId: string | null }[];
  receipts: { eventId: string; kind: string; actorId: string; position: JusticiarPosition; targetVersion: number }[];
  evacuationReportEventId: string | null; returnReportEventId: string | null; constraintApplied: boolean; priorityApplied: boolean;
}
export interface JusticiarPreparation {
  id: string; compoundId: string; actorId: string; sourceDigest: string; compoundDigest: string; evacuationReportEventId: string;
  location: JusticiarPlaceId; preparedSecond: number; expiresSecond: number; status: 'READY' | 'SPENT' | 'INVALIDATED'; spentEventId: string | null;
}
export interface JusticiarEvent {
  id: string; revision: number; command: JusticiarCommand; before: JusticiarFrame; after: JusticiarFrame;
  randomReceipts: { id: string; check: PublicCheckResult; cursorBefore: number; cursorAfter: number }[];
  financeReceipts: { title: string; text: string }[]; notes: string[]; beforeDigest: string; afterDigest: string;
}
export interface JusticiarState {
  version: 1; guidanceKnown: boolean; source: JusticiarSource | null; frame: JusticiarFrame | null;
  promotionWeek: number | null; scene: JusticiarScene | null; materials: JusticiarMaterials | null;
  journal: JusticiarEvent[]; promotionStability: { preparations: JusticiarPreparation[] };
}
export interface JusticiarSceneHost {
  eventId: string; revision: number; week: number; second: number; actorId: string; sequence: 1 | 0;
  actions: number; cash: number; health: number; mind: number; spirituality: number;
}
export interface JusticiarEffect { actions: number; cash: number; spirituality: number; mind: number; health: number; seconds: number; mastery?: string[] }
export interface JusticiarAction { id: string; label: string; cost: string; command: JusticiarCommand; enabled: boolean; reason: string | null; preferredAction?: boolean }
export interface JusticiarProjection {
  title: string; guidanceKnown: boolean; promoted: boolean; story: string; nextStep: string; risk: string; insideCase: boolean;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number; weeklyBudget: number };
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  abilities: { id: string; label: string; description: string; mastery: number }[];
  actions: JusticiarAction[]; sections: { id: string; title: string; lines: string[] }[];
}
