import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { UncleanMonarchSite, UncleanMonarchState } from '../unclean-monarch/types.js';
import type { BloodDukeOperationState } from '../blood-duke/life.js';
import type { AbyssOriginalId, AbyssPosition, AbyssWorkerId, AbyssSegmentId, AbyssConsent, AbyssPlaceId } from './content.js';
export { ABYSS_ORIGINAL_IDS, ABYSS_ABILITY_IDS } from './content.js';
export type { AbyssOriginalId, AbyssAbilityId, AbyssPosition, AbyssWorkerId, AbyssSegmentId, AbyssConsent, AbyssPlaceId } from './content.js';

export type AbyssCommand =
  | { type: 'LEARN_GUIDANCE' | 'WORK' | 'REST' | 'CLINIC' | 'NEXT_WEEK' | 'RETURN_ON_FOOT' | 'LEAVE_ORIGINAL_COURT' }
  | { type: 'TRAVEL'; to: AbyssPlaceId }
  | { type: 'WORK_ORIGINAL' | 'ASK_RECOVERY_PERMISSION' | 'INVESTIGATE_REMAINS' | 'SEAL_ORIGINAL' | 'RECOVER_ORIGINAL'; originalId: AbyssOriginalId }
  | { type: 'VERIFY_UNIQUENESS' | 'ACQUIRE_UNIQUENESS' | 'BUY_CARRIER' | 'COMPOSE' }
  | { type: 'STABILIZE_PROMOTION' | 'SEAL_REMAINS' | 'RECOVER_REMAINS'; compoundId: string }
  | { type: 'CONSUME'; compoundId: string; confirmed: true }
  | { type: 'ASK_OWNER' | 'WITHDRAW_OWNER' | 'APPROACH' | 'INSPECT_EXIT' | 'INSPECT_DEVICE' | 'BUY_TOOLS' | 'OPEN_EXIT' | 'CLOSE_EXIT' }
  | { type: 'ASK_WORKER' | 'WITHDRAW_WORKER' | 'ARRIVE_WORKER' | 'EXIT_WORKER'; workerId: AbyssWorkerId }
  | { type: 'INSPECT_SEGMENT' | 'REMOVE_PIN' | 'OPEN_SEGMENT' | 'CLOSE_SEGMENT'; segment: AbyssSegmentId }
  | { type: 'CROSS'; actorId: 'PLAYER' | AbyssWorkerId; segment: AbyssSegmentId }
  | { type: 'REPORT_EVACUATION' | 'START_PRACTICE' | 'CORRODE_PIN' | 'APPLY_CORROSION' | 'MANUAL_INSPECTION' | 'SENSE_DANGER' | 'MOVE_CARGO' | 'SECURE_CARGO' | 'STOP_METHOD' | 'END_CONTACT' | 'WAIT_10' | 'WALK_EXIT' | 'REPORT_RETURN' };
export interface AbyssBudget {
  week: number; date: PublicGameDate; actions: number; cash: number; health: number; mind: number; spirituality: number; pollution: number;
  injuries: SliceState['injuries']; injuryRisk: number; status: SliceState['status']; sequence: 1 | 0; acting: number;
  mastery: Record<string, number>; coreStats: SliceState['character']['coreStats']; completedSources: string[];
}
export type AbyssFinance = Pick<SliceState, 'weeklyBudget' | 'wagePaidWeek' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface AbyssFrame {
  budget: AbyssBudget; finance: AbyssFinance; random: SliceState['random']; location: AbyssPlaceId; nowSecond: number; weekAnchor: number;
}
/** This immutable handoff is taken only after real S1 cases/reflection100.
 * The adapter must use getUncleanMonarchCurrentSite and uncleanMonarch.life.operation. */
export interface AbyssSource {
  runId: string; actorId: string; revision: number; character: SliceState['character']; budget: AbyssBudget;
  finance: AbyssFinance; random: SliceState['random']; historyDigest: string; originalWorldDigest: string;
  combatHistoryLength: number; combatHistoryDigest: string; originalsDigest: string; acquisitionDigest: string;
  originals: { site: UncleanMonarchSite; operation: BloodDukeOperationState; strain: number };
  acquisition: Pick<UncleanMonarchState, 'bottles' | 'resupply' | 'acquisitionJournal'> & { promotionWeek: number };
  /** One ledger entry per fixed original; original bottles and retry carriers remain separate. */
  originalCharacteristics: {
    characteristics: { characteristicId: string; originalBottleId: AbyssOriginalId; latestBottleId: string; holder: 'SUPPLIER' | 'FAILED_REMNANT' | 'PLAYER' | 'EMBODIED'; consumptionHistory: { bottleId: string; revision: number; week: number; outcome: PublicResolutionTier }[] }[];
    embodiedOriginalBottleId: AbyssOriginalId | null; embodiedBottleId: string | null;
  };
}
export interface AbyssOriginal {
  originalId: AbyssOriginalId; labourSteps: number; labourEventIds: string[]; latestBottleId: string; failedConsumptionRevision: number | null;
  holder: 'SUPPLIER' | 'UNLOCATED_REMNANT' | 'LOCATED' | 'SEALED_REMNANT' | 'PLAYER' | 'COMPOUND' | 'EMBODIED' | 'FUSED' | 'DEATH_REMAINS';
  location: AbyssPlaceId | null; compoundId: string | null;
  permissionEventId: string | null; permissionWeek: number | null; investigationEventId: string | null;
  sealedEventId: string | null; sealedWeek: number | null; sealedSecond: number | null; recoveredEventId: string | null;
}
export interface AbyssCompound {
  id: string; carrierId: string; status: 'PREPARED' | 'SUCCESS' | 'FAILED_EXPOSED' | 'FAILED_SEALED' | 'RECOVERED' | 'DEATH_REMAINS';
  location: AbyssPlaceId; originalIds: AbyssOriginalId[]; embodiedOriginalId: AbyssOriginalId; uniquenessId: 'AB224-UNIQUENESS';
  preparedEventId: string; consumedEventId: string | null; sealedEventId: string | null;
  sealedWeek: number | null; sealedSecond: number | null; recoveredEventId: string | null;
}
export interface AbyssMaterials {
  originals: AbyssOriginal[];
  uniqueness: { id: 'AB224-UNIQUENESS'; holder: 'CUSTODIAN' | 'PLAYER' | 'COMPOUND' | 'EXPOSED' | 'SEALED' | 'FUSED' | 'DEATH_REMAINS'; location: AbyssPlaceId; compoundId: string | null; verifiedEventId: string | null; acquiredEventId: string | null };
  carriers: { id: string; status: 'SUPPLIER' | 'PLAYER' | 'SPENT'; boughtEventId: string | null }[];
  compounds: AbyssCompound[];
}
export interface AbyssWorker {
  id: AbyssWorkerId; name: string; age: number; alive: boolean; health: number; energy: number;
  position: AbyssPosition; walkedMetres: number; consent: AbyssConsent; permissionVersion: number;
  permissionEventId: string | null; paidEventId: string | null; arrivalEventId: string | null;
  passage: { a: string | null; b: string | null; exit: string | null };
}
export interface AbyssWindow {
  kind: 'CONTACT_CORROSION' | 'DANGER_SENSE'; actorId: string; startPosition: 'GATE'; targetId: string;
  targetVersion: number; permissionVersion: number; createdAt: number; expiresAt: number;
}
export interface AbyssCargo {
  id: 'AB224-CARGO-CORA' | 'AB224-CARGO-OSWALD' | 'AB224-MAINTENANCE-BOX';
  carrierId: AbyssWorkerId | 'PLAYER'; position: AbyssPosition; travelMetres: number;
  version: number; visible: boolean; secured: boolean; offsetMetres: number; movedEventId: string | null;
  passage: { a: string | null; b: string | null; exit: string | null };
}
export interface AbyssScene {
  phase: 'PREPARATION' | 'PRACTICE'; status: 'ACTIVE' | 'ABORTED' | 'COMPLETED';
  playerPosition: AbyssPosition; playerTravelMetres: number; originalDepartureEventId: string | null;
  owner: { id: 'AB224-KEEPER'; name: '伊文'; age: 42; alive: boolean; position: 'OUTSIDE'; consent: AbyssConsent; permissionVersion: number; permissionWeek: number | null; permissionEventId: string | null };
  workers: AbyssWorker[]; cargo: AbyssCargo[];
  originalOperation: BloodDukeOperationState; originalStrain: number;
  segments: Record<AbyssSegmentId, { inspectedEventId: string | null; open: boolean; pin: { id: string; position: 'INSERTED' | 'PLAYER' | 'BENCH'; location: AbyssPosition; travelMetres: number; integrity: number; wear: number; version: number; removedEventId: string | null } }>;
  exit: { inspectedEventId: string | null; door: 'CLOSED' | 'OPEN' };
  toolsBoughtEventId: string | null;
  device: { inspectedEventId: string | null; pinFinishedEventId: string | null; cargoFinishedEventId: string | null; pinMethod: 'NONE' | 'ORDINARY' | 'ABILITY'; cargoMethod: 'NONE' | 'ORDINARY' | 'ABILITY' };
  contact: boolean; window: AbyssWindow | null;
  moves: { eventId: string; actorId: 'PLAYER' | AbyssWorkerId; from: AbyssPosition; to: AbyssPosition; metres: number; seconds: number; cargoId: string | null }[];
  receipts: { eventId: string; kind: string; actorId: string; position: AbyssPosition; targetVersion: number }[];
  evacuationReportEventId: string | null; returnReportEventId: string | null; corrosionApplied: boolean; dangerSenseApplied: boolean;
}
export interface AbyssPreparation {
  id: string; compoundId: string; actorId: string; sourceDigest: string; compoundDigest: string; evacuationReportEventId: string;
  location: AbyssPlaceId; preparedSecond: number; expiresSecond: number; status: 'READY' | 'SPENT' | 'INVALIDATED'; spentEventId: string | null;
}
export interface AbyssEvent {
  id: string; revision: number; command: AbyssCommand; before: AbyssFrame; after: AbyssFrame;
  randomReceipts: { id: string; check: PublicCheckResult; cursorBefore: number; cursorAfter: number }[];
  financeReceipts: { title: string; text: string }[]; notes: string[]; beforeDigest: string; afterDigest: string;
}
export interface AbyssState {
  version: 1; guidanceKnown: boolean; source: AbyssSource | null; frame: AbyssFrame | null;
  promotionWeek: number | null; scene: AbyssScene | null; materials: AbyssMaterials | null;
  journal: AbyssEvent[]; promotionStability: { preparations: AbyssPreparation[] };
}
export interface AbyssSceneHost {
  eventId: string; revision: number; week: number; second: number; actorId: string; sequence: 1 | 0;
  actions: number; cash: number; health: number; mind: number; spirituality: number;
}
export interface AbyssEffect { actions: number; cash: number; spirituality: number; mind: number; health: number; seconds: number; mastery?: string[] }
export interface AbyssAction { id: string; label: string; cost: string; command: AbyssCommand; enabled: boolean; reason: string | null; preferredAction?: boolean }
export interface AbyssProjection {
  title: string; guidanceKnown: boolean; promoted: boolean; story: string; nextStep: string; risk: string; insideCase: boolean;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number; weeklyBudget: number };
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  abilities: { id: string; label: string; description: string; mastery: number }[];
  actions: AbyssAction[]; sections: { id: string; title: string; lines: string[] }[];
}
