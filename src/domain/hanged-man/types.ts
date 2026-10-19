/** Candidate import paths are for eventual src/domain/hanged-man/. */
import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { DarkAngelSite, DarkAngelState } from '../dark-angel/types.js';
import type { ElderOperationState } from '../elder/life.js';
import type { ThreeHeadedTemplarSpiritId, ThreeHeadedTemplarSpiritMethod, ThreeHeadedTemplarSpirits } from '../three-headed-templar/life.js';
import type { HangedManOriginalId, HangedManPosition, HangedManWorkerId, HangedManSegmentId, HangedManConsent, HangedManPlaceId } from './content.js';
export { HANGED_MAN_ORIGINAL_IDS, HANGED_MAN_ABILITY_IDS } from './content.js';
export type { HangedManOriginalId, HangedManAbilityId, HangedManPosition, HangedManWorkerId, HangedManSegmentId, HangedManConsent, HangedManPlaceId } from './content.js';

export type HangedManCommand =
  | { type: 'LEARN_GUIDANCE' | 'WORK' | 'REST' | 'CLINIC' | 'NEXT_WEEK' | 'RETURN_ON_FOOT' | 'LEAVE_ORIGINAL_COURT' }
  | { type: 'TRAVEL'; to: HangedManPlaceId }
  | { type: 'ASK_RECOVERY_PERMISSION' | 'INVESTIGATE_REMAINS' | 'SEAL_ORIGINAL' | 'RECOVER_ORIGINAL'; originalId: HangedManOriginalId }
  | { type: 'VERIFY_UNIQUENESS' | 'ACQUIRE_UNIQUENESS' | 'BUY_CARRIER' | 'COMPOSE' }
  | { type: 'STABILIZE_PROMOTION' | 'SEAL_REMAINS' | 'RECOVER_REMAINS'; compoundId: string }
  | { type: 'CONSUME'; compoundId: string; confirmed: true }
  | { type: 'ASK_OWNER' | 'WITHDRAW_OWNER' | 'APPROACH' | 'INSPECT_EXIT' | 'INSPECT_DEVICE' | 'BUY_BRACE' | 'BUY_SEAL' | 'USE_WINCH' | 'OPEN_EXIT' | 'CLOSE_EXIT' }
  | { type: 'ASK_WORKER' | 'WITHDRAW_WORKER' | 'ARRIVE_WORKER' | 'EXIT_WORKER'; workerId: HangedManWorkerId }
  | { type: 'INSPECT_SEGMENT' | 'OPEN_SEGMENT' | 'CLOSE_SEGMENT'; segment: HangedManSegmentId }
  | { type: 'CROSS'; actorId: 'PLAYER' | HangedManWorkerId; segment: HangedManSegmentId }
  | { type: 'REPORT_EVACUATION' | 'START_PRACTICE' | 'BEAR_PRESSURE' | 'TEST_PRESSURE' | 'APPLY_SEAL' | 'MANUAL_SEAL' | 'STOP_METHOD' | 'END_CONTACT' | 'WAIT_10' | 'WALK_EXIT' | 'REPORT_RETURN' }
  | { type: 'COOPERATIVE_SEAL'; spiritId: ThreeHeadedTemplarSpiritId };
export interface HangedManBudget {
  week: number; date: PublicGameDate; actions: number; cash: number; health: number; mind: number; spirituality: number; pollution: number;
  injuries: SliceState['injuries']; injuryRisk: number; status: SliceState['status']; sequence: 1 | 0; acting: number;
  mastery: Record<string, number>; coreStats: SliceState['character']['coreStats']; completedSources: string[];
}
export type HangedManFinance = Pick<SliceState, 'weeklyBudget' | 'wagePaidWeek' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface HangedManFrame {
  budget: HangedManBudget; finance: HangedManFinance; random: SliceState['random']; location: HangedManPlaceId; nowSecond: number; weekAnchor: number;
}
/** This immutable handoff is taken only after real S1 cases/reflection100.
 * The adapter must use getDarkAngelCurrentSite and darkAngel.life.operation. */
export interface HangedManSource {
  runId: string; actorId: string; revision: number; character: SliceState['character']; budget: HangedManBudget;
  finance: HangedManFinance; random: SliceState['random']; historyDigest: string; originalWorldDigest: string;
  combatHistoryLength: number; combatHistoryDigest: string; originalsDigest: string; acquisitionDigest: string;
  originals: { site: DarkAngelSite; operation: ElderOperationState; grazing: SliceState['shepherd']['grazing']; reserve: SliceState['roseBishop']['reserve'] };
  acquisition: Pick<DarkAngelState, 'bottles' | 'resupply' | 'acquisitionJournal'> & { promotionWeek: number };
  /** One ledger entry per fixed original; original bottles and retry carriers remain separate. */
  originalCharacteristics: {
    characteristics: { characteristicId: string; originalBottleId: HangedManOriginalId; latestBottleId: string; holder: 'SUPPLIER' | 'FAILED_REMNANT' | 'PLAYER' | 'EMBODIED'; consumptionHistory: { bottleId: string; revision: number; week: number; outcome: PublicResolutionTier }[] }[];
    embodiedOriginalBottleId: HangedManOriginalId | null; embodiedBottleId: string | null;
  };
}
export interface HangedManOriginal {
  originalId: HangedManOriginalId; latestBottleId: string; failedConsumptionRevision: number | null;
  holder: 'SUPPLIER' | 'UNLOCATED_REMNANT' | 'LOCATED' | 'SEALED_REMNANT' | 'PLAYER' | 'COMPOUND' | 'EMBODIED' | 'FUSED' | 'DEATH_REMAINS';
  location: HangedManPlaceId | null; compoundId: string | null;
  permissionEventId: string | null; permissionWeek: number | null; investigationEventId: string | null;
  sealedEventId: string | null; sealedWeek: number | null; sealedSecond: number | null; recoveredEventId: string | null;
}
export interface HangedManCompound {
  id: string; carrierId: string; status: 'PREPARED' | 'SUCCESS' | 'FAILED_EXPOSED' | 'FAILED_SEALED' | 'RECOVERED' | 'DEATH_REMAINS';
  location: HangedManPlaceId; originalIds: HangedManOriginalId[]; embodiedOriginalId: HangedManOriginalId; uniquenessId: 'HM223-UNIQUENESS';
  preparedEventId: string; consumedEventId: string | null; sealedEventId: string | null;
  sealedWeek: number | null; sealedSecond: number | null; recoveredEventId: string | null;
}
export interface HangedManMaterials {
  originals: HangedManOriginal[];
  uniqueness: { id: 'HM223-UNIQUENESS'; holder: 'CUSTODIAN' | 'PLAYER' | 'COMPOUND' | 'EXPOSED' | 'SEALED' | 'FUSED' | 'DEATH_REMAINS'; location: HangedManPlaceId; compoundId: string | null; verifiedEventId: string | null; acquiredEventId: string | null };
  carriers: { id: string; status: 'SUPPLIER' | 'PLAYER' | 'SPENT'; boughtEventId: string | null }[];
  compounds: HangedManCompound[];
}
export interface HangedManWorker {
  id: HangedManWorkerId; name: string; age: number; alive: boolean; health: number; energy: number;
  position: HangedManPosition; walkedMetres: number; consent: HangedManConsent; permissionVersion: number;
  permissionEventId: string | null; paidEventId: string | null; arrivalEventId: string | null;
  passage: { a: string | null; b: string | null; exit: string | null };
}
export interface HangedManWindow {
  kind: 'PRESSURE_BEARING' | 'COOPERATIVE_SEAL'; actorId: string; startPosition: 'GATE'; targetId: 'HM223-LOCAL-LATCH';
  targetVersion: number; permissionVersion: number; createdAt: number; expiresAt: number;
  spiritId: ThreeHeadedTemplarSpiritId | null; spiritDigest: string | null; selectedMethod: ThreeHeadedTemplarSpiritMethod | null;
  sealId: string | null; applicationEventId: string | null;
}
export interface HangedManScene {
  phase: 'PREPARATION' | 'PRACTICE'; status: 'ACTIVE' | 'ABORTED' | 'COMPLETED';
  playerPosition: HangedManPosition; playerTravelMetres: number; originalDepartureEventId: string | null;
  owner: { id: 'THT3-MARA'; alive: boolean; position: 'OUTSIDE'; consent: HangedManConsent; permissionVersion: number; permissionWeek: number | null; permissionEventId: string | null };
  workers: HangedManWorker[];
  /** These are the sole mutable continued spirits; frozen predecessor copies are evidence. */
  spirits: ThreeHeadedTemplarSpirits;
  /** Old contained pressure3/material wear is preserved, never used as the new device. */
  originalOperation: ElderOperationState;
  segments: Record<HangedManSegmentId, { inspectedEventId: string | null; open: boolean }>;
  exit: { inspectedEventId: string | null; door: 'CLOSED' | 'OPEN'; winch: 'UNINSPECTED' | 'READY' | 'LOCKED' };
  device: { id: 'HM223-LOCAL-LATCH'; revision: number; inspectedEventId: string | null; contained: true; sourcePressure: 3; braceBoughtEventId: string | null; braced: boolean; testEventId: string | null; testMethod: 'NONE' | 'ORDINARY' | 'ABILITY'; sealedEventId: string | null };
  seals: { id: string; status: 'BLANK' | 'APPLIED' | 'SPENT'; charges: 0 | 1; boughtEventId: string; appliedEventId: string | null; targetVersion: number | null }[];
  contact: boolean; window: HangedManWindow | null;
  moves: { eventId: string; actorId: 'PLAYER' | HangedManWorkerId; from: HangedManPosition; to: HangedManPosition; metres: number; seconds: number }[];
  receipts: { eventId: string; kind: string; actorId: string; position: HangedManPosition; targetVersion: number }[];
  evacuationReportEventId: string | null; returnReportEventId: string | null; pressureApplied: boolean; cooperativeSealApplied: boolean;
}
export interface HangedManPreparation {
  id: string; compoundId: string; actorId: string; sourceDigest: string; compoundDigest: string; evacuationReportEventId: string;
  location: HangedManPlaceId; preparedSecond: number; expiresSecond: number; status: 'READY' | 'SPENT' | 'INVALIDATED'; spentEventId: string | null;
}
export interface HangedManEvent {
  id: string; revision: number; command: HangedManCommand; before: HangedManFrame; after: HangedManFrame;
  randomReceipts: { id: string; check: PublicCheckResult; cursorBefore: number; cursorAfter: number }[];
  financeReceipts: { title: string; text: string }[]; notes: string[]; beforeDigest: string; afterDigest: string;
}
export interface HangedManState {
  version: 1; guidanceKnown: boolean; source: HangedManSource | null; frame: HangedManFrame | null;
  promotionWeek: number | null; scene: HangedManScene | null; materials: HangedManMaterials | null;
  journal: HangedManEvent[]; promotionStability: { preparations: HangedManPreparation[] };
}
export interface HangedManSceneHost {
  eventId: string; revision: number; week: number; second: number; actorId: string; sequence: 1 | 0;
  actions: number; cash: number; health: number; mind: number; spirituality: number;
}
export interface HangedManEffect { actions: number; cash: number; spirituality: number; mind: number; health: number; seconds: number; mastery?: string[] }
export interface HangedManAction { id: string; label: string; cost: string; command: HangedManCommand; enabled: boolean; reason: string | null; preferredAction?: boolean }
export interface HangedManProjection {
  title: string; guidanceKnown: boolean; promoted: boolean; story: string; nextStep: string; risk: string; insideCase: boolean;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number; weeklyBudget: number };
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  abilities: { id: string; label: string; description: string; mastery: number }[];
  actions: HangedManAction[]; sections: { id: string; title: string; lines: string[] }[];
}
