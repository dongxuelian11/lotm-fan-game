import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { AbominationSite, AbominationState } from '../abomination/types.js';
import type { AncientEvilOperationState } from '../ancient-evil/life.js';
import type { ChainedOriginalId, ChainedPosition, ChainedWorkerId, ChainedSegmentId, ChainedConsent, ChainedPlaceId } from './content.js';
export { CHAINED_ORIGINAL_IDS, CHAINED_ABILITY_IDS } from './content.js';
export type { ChainedOriginalId, ChainedAbilityId, ChainedPosition, ChainedWorkerId, ChainedSegmentId, ChainedConsent, ChainedPlaceId } from './content.js';

export type ChainedCommand =
  | { type: 'LEARN_GUIDANCE' | 'WORK' | 'REST' | 'CLINIC' | 'NEXT_WEEK' | 'RETURN_ON_FOOT' | 'LEAVE_ORIGINAL_COURT' }
  | { type: 'TRAVEL'; to: ChainedPlaceId }
  | { type: 'WORK_ORIGINAL' | 'ASK_RECOVERY_PERMISSION' | 'INVESTIGATE_REMAINS' | 'SEAL_ORIGINAL' | 'RECOVER_ORIGINAL'; originalId: ChainedOriginalId }
  | { type: 'VERIFY_UNIQUENESS' | 'ACQUIRE_UNIQUENESS' | 'BUY_CARRIER' | 'COMPOSE' }
  | { type: 'STABILIZE_PROMOTION' | 'SEAL_REMAINS' | 'RECOVER_REMAINS'; compoundId: string }
  | { type: 'CONSUME'; compoundId: string; confirmed: true }
  | { type: 'ASK_OWNER' | 'WITHDRAW_OWNER' | 'APPROACH' | 'INSPECT_EXIT' | 'INSPECT_DEVICE' | 'BUY_TOOLS' | 'OPEN_EXIT' | 'CLOSE_EXIT' }
  | { type: 'ASK_WORKER' | 'WITHDRAW_WORKER' | 'ARRIVE_WORKER' | 'EXIT_WORKER'; workerId: ChainedWorkerId }
  | { type: 'INSPECT_SEGMENT' | 'REMOVE_PIN' | 'OPEN_SEGMENT' | 'CLOSE_SEGMENT'; segment: ChainedSegmentId }
  | { type: 'CROSS'; actorId: 'PLAYER' | ChainedWorkerId; segment: ChainedSegmentId }
  | { type: 'REPORT_EVACUATION' | 'START_PRACTICE' | 'BIND_ROPE' | 'APPLY_BINDING' | 'MANUAL_INSPECTION' | 'BEAR_IMPACT' | 'MOVE_CARGO' | 'SECURE_CARGO' | 'STOP_METHOD' | 'END_CONTACT' | 'WAIT_10' | 'WALK_EXIT' | 'REPORT_RETURN' };
export interface ChainedBudget {
  week: number; date: PublicGameDate; actions: number; cash: number; health: number; mind: number; spirituality: number; pollution: number;
  injuries: SliceState['injuries']; injuryRisk: number; status: SliceState['status']; sequence: 1 | 0; acting: number;
  mastery: Record<string, number>; coreStats: SliceState['character']['coreStats']; completedSources: string[];
}
export type ChainedFinance = Pick<SliceState, 'weeklyBudget' | 'wagePaidWeek' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface ChainedFrame {
  budget: ChainedBudget; finance: ChainedFinance; random: SliceState['random']; location: ChainedPlaceId; nowSecond: number; weekAnchor: number;
}
/** This immutable handoff is taken only after real S1 cases/reflection100.
 * The adapter must use getAbominationCurrentSite and abomination.life.operation. */
export interface ChainedSource {
  runId: string; actorId: string; revision: number; character: SliceState['character']; budget: ChainedBudget;
  finance: ChainedFinance; random: SliceState['random']; historyDigest: string; originalWorldDigest: string;
  combatHistoryLength: number; combatHistoryDigest: string; originalsDigest: string; acquisitionDigest: string;
  originals: { site: AbominationSite; operation: AncientEvilOperationState; blocks: SliceState['abomination']['encounter']['blocks'] };
  acquisition: Pick<AbominationState, 'bottles' | 'resupply' | 'acquisitionJournal'> & { promotionWeek: number };
  /** One ledger entry per fixed original; original bottles and retry carriers remain separate. */
  originalCharacteristics: {
    characteristics: { characteristicId: string; originalBottleId: ChainedOriginalId; latestBottleId: string; holder: 'SUPPLIER' | 'FAILED_REMNANT' | 'PLAYER' | 'EMBODIED'; consumptionHistory: { bottleId: string; revision: number; week: number; outcome: PublicResolutionTier }[] }[];
    embodiedOriginalBottleId: ChainedOriginalId | null; embodiedBottleId: string | null;
  };
}
export interface ChainedOriginal {
  originalId: ChainedOriginalId; characteristicId: string; labourSteps: number; labourEventIds: string[]; latestBottleId: string; failedConsumptionRevision: number | null;
  holder: 'SUPPLIER' | 'UNLOCATED_REMNANT' | 'LOCATED' | 'SEALED_REMNANT' | 'PLAYER' | 'COMPOUND' | 'EMBODIED' | 'FUSED' | 'DEATH_REMAINS';
  location: ChainedPlaceId | null; compoundId: string | null;
  permissionEventId: string | null; permissionWeek: number | null; investigationEventId: string | null;
  sealedEventId: string | null; sealedWeek: number | null; sealedSecond: number | null; recoveredEventId: string | null;
}
export interface ChainedCompound {
  id: string; carrierId: string; status: 'PREPARED' | 'SUCCESS' | 'FAILED_EXPOSED' | 'FAILED_SEALED' | 'RECOVERED' | 'DEATH_REMAINS';
  location: ChainedPlaceId; originalIds: ChainedOriginalId[]; embodiedOriginalId: ChainedOriginalId; uniquenessId: 'CH225-UNIQUENESS';
  preparedEventId: string; consumedEventId: string | null; sealedEventId: string | null;
  sealedWeek: number | null; sealedSecond: number | null; recoveredEventId: string | null;
}
export interface ChainedMaterials {
  originals: ChainedOriginal[];
  uniqueness: { id: 'CH225-UNIQUENESS'; holder: 'CUSTODIAN' | 'PLAYER' | 'COMPOUND' | 'EXPOSED' | 'SEALED' | 'FUSED' | 'DEATH_REMAINS'; location: ChainedPlaceId; compoundId: string | null; verifiedEventId: string | null; acquiredEventId: string | null };
  carriers: { id: string; status: 'SUPPLIER' | 'PLAYER' | 'SPENT'; boughtEventId: string | null }[];
  compounds: ChainedCompound[];
}
export interface ChainedWorker {
  id: ChainedWorkerId; name: string; age: number; alive: boolean; health: number; energy: number;
  position: ChainedPosition; walkedMetres: number; consent: ChainedConsent; permissionVersion: number;
  permissionEventId: string | null; paidEventId: string | null; arrivalEventId: string | null;
  passage: { a: string | null; b: string | null; exit: string | null };
}
export interface ChainedWindow {
  kind: 'LOCAL_BINDING' | 'IMPACT_BURDEN'; actorId: string; startPosition: 'GATE'; targetId: string;
  targetVersion: number; permissionVersion: number; createdAt: number; expiresAt: number;
}
export interface ChainedCargo {
  id: 'CH225-CARGO-VERA' | 'CH225-CARGO-EDWIN' | 'CH225-MAINTENANCE-BOX';
  carrierId: ChainedWorkerId | 'PLAYER'; position: ChainedPosition; travelMetres: number;
  version: number; visible: boolean; secured: boolean; offsetMetres: number; movedEventId: string | null;
  passage: { a: string | null; b: string | null; exit: string | null };
}
export interface ChainedScene {
  phase: 'PREPARATION' | 'PRACTICE'; status: 'ACTIVE' | 'ABORTED' | 'COMPLETED';
  playerPosition: ChainedPosition; playerTravelMetres: number; originalDepartureEventId: string | null;
  owner: { id: 'CH225-KEEPER'; name: '伯纳德'; age: 42; alive: boolean; position: 'OUTSIDE'; consent: ChainedConsent; permissionVersion: number; permissionWeek: number | null; permissionEventId: string | null };
  workers: ChainedWorker[]; cargo: ChainedCargo[];
  originalOperation: AncientEvilOperationState; originalBlocks: SliceState['abomination']['encounter']['blocks'];
  segments: Record<ChainedSegmentId, { inspectedEventId: string | null; open: boolean; pin: { id: string; position: 'INSERTED' | 'PLAYER' | 'BENCH'; location: ChainedPosition; travelMetres: number; integrity: number; wear: number; version: number; removedEventId: string | null } }>;
  exit: { inspectedEventId: string | null; door: 'CLOSED' | 'OPEN' };
  toolsBoughtEventId: string | null;
  device: { inspectedEventId: string | null; loadFinishedEventId: string | null; cargoFinishedEventId: string | null; loadMethod: 'NONE' | 'ORDINARY' | 'ABILITY'; cargoMethod: 'NONE' | 'ORDINARY' | 'ABILITY' };
  rope: { id: 'CH225-ORIGINAL-ROPE-B'; location: 'GATE'; integrity: number; wear: number; version: number; loadEventId: string | null; dropCentimetres: number };
  contact: boolean; window: ChainedWindow | null;
  moves: { eventId: string; actorId: 'PLAYER' | ChainedWorkerId; from: ChainedPosition; to: ChainedPosition; metres: number; seconds: number; cargoId: string | null }[];
  receipts: { eventId: string; kind: string; actorId: string; position: ChainedPosition; targetVersion: number }[];
  evacuationReportEventId: string | null; returnReportEventId: string | null; bindingApplied: boolean; impactBurdenApplied: boolean;
}
export interface ChainedPreparation {
  id: string; compoundId: string; actorId: string; sourceDigest: string; compoundDigest: string; evacuationReportEventId: string;
  location: ChainedPlaceId; preparedSecond: number; expiresSecond: number; status: 'READY' | 'SPENT' | 'INVALIDATED'; spentEventId: string | null;
}
export interface ChainedEvent {
  id: string; revision: number; command: ChainedCommand; before: ChainedFrame; after: ChainedFrame;
  randomReceipts: { id: string; check: PublicCheckResult; cursorBefore: number; cursorAfter: number }[];
  financeReceipts: { title: string; text: string }[]; notes: string[]; beforeDigest: string; afterDigest: string;
}
export interface ChainedState {
  version: 1; guidanceKnown: boolean; source: ChainedSource | null; frame: ChainedFrame | null;
  promotionWeek: number | null; scene: ChainedScene | null; materials: ChainedMaterials | null;
  journal: ChainedEvent[]; promotionStability: { preparations: ChainedPreparation[] };
}
export interface ChainedSceneHost {
  eventId: string; revision: number; week: number; second: number; actorId: string; sequence: 1 | 0;
  actions: number; cash: number; health: number; mind: number; spirituality: number;
}
export interface ChainedEffect { actions: number; cash: number; spirituality: number; mind: number; health: number; seconds: number; mastery?: string[] }
export interface ChainedAction { id: string; label: string; cost: string; command: ChainedCommand; enabled: boolean; reason: string | null; preferredAction?: boolean }
export interface ChainedProjection {
  title: string; guidanceKnown: boolean; promoted: boolean; story: string; nextStep: string; risk: string; insideCase: boolean;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number; weeklyBudget: number };
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  abilities: { id: string; label: string; description: string; mastery: number }[];
  actions: ChainedAction[]; sections: { id: string; title: string; lines: string[] }[];
}
