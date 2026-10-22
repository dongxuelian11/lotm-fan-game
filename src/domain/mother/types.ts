import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { NatureWalkerSite, NatureWalkerState } from '../nature-walker/types.js';
import type { NatureWalkerOperationState, NatureWalkerRootPad } from '../nature-walker/life.js';
import type { MotherOriginalId, MotherPosition, MotherPersonId, MotherSampleId, MotherConsent, MotherPlaceId } from './content.js';
export { MOTHER_ORIGINAL_IDS, MOTHER_ABILITY_IDS } from './content.js';
export type { MotherOriginalId, MotherAbilityId, MotherPosition, MotherPersonId, MotherSampleId, MotherConsent, MotherPlaceId } from './content.js';

export type MotherCommand =
 | { type: 'LEARN_GUIDANCE' | 'WORK' | 'REST' | 'CLINIC' | 'NEXT_WEEK' | 'RETURN_ON_FOOT' | 'LEAVE_ORIGINAL_NURSERY' }
 | { type: 'TRAVEL'; to: MotherPlaceId }
 | { type: 'WORK_ORIGINAL' | 'ASK_RECOVERY_PERMISSION' | 'INVESTIGATE_REMAINS' | 'SEAL_ORIGINAL' | 'RECOVER_ORIGINAL'; originalId: MotherOriginalId }
 | { type: 'VERIFY_UNIQUENESS' | 'ACQUIRE_UNIQUENESS' | 'BUY_CARRIER' | 'COMPOSE' }
 | { type: 'STABILIZE_PROMOTION' | 'SEAL_REMAINS' | 'RECOVER_REMAINS'; compoundId: string }
 | { type: 'CONSUME'; compoundId: string; confirmed: true }
 | { type: 'ASK_OWNER' | 'WITHDRAW_PERMISSION'; personId: MotherPersonId }
 | { type: 'INSPECT_GREENHOUSE' | 'REPAIR_GREENHOUSE' | 'BUY_SUPPLIES' | 'REPORT_GREENHOUSE' | 'START_PRACTICE' | 'STOP_METHOD' | 'END_CONTACT' | 'WAIT_10' | 'WALK_EXIT' | 'ENTER_GREENHOUSE' | 'REPORT_RETURN' }
 | { type: 'TAKE_PLANT' | 'PLACE_PLANT' | 'RETURN_PLANT' | 'WATER_PLANT' | 'SUPPORT_PLANT' | 'MAINTAIN_VITALITY' | 'APPLY_MAINTENANCE' | 'ORDINARY_MAINTENANCE' | 'TOUCH_BRANCH' | 'SUPPORT_BRANCH' | 'APPLY_BRANCH_SUPPORT'; sampleId: MotherSampleId }
 | { type: 'CARRY_PLANT'; sampleId: MotherSampleId; to: 'OUTSIDE' | 'GREENHOUSE' };
export interface MotherBudget {
  week: number; date: PublicGameDate; actions: number; cash: number; health: number; mind: number; spirituality: number; pollution: number;
  injuries: SliceState['injuries']; injuryRisk: number; status: SliceState['status']; sequence: 1 | 0; acting: number;
  mastery: Record<string, number>; coreStats: SliceState['character']['coreStats']; completedSources: string[];
}
export type MotherFinance = Pick<SliceState, 'weeklyBudget' | 'wagePaidWeek' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface MotherFrame {
  budget: MotherBudget; finance: MotherFinance; random: SliceState['random']; location: MotherPlaceId; nowSecond: number; weekAnchor: number;
}
/** This immutable handoff is taken only after real S1 cases/reflection100.
 * The adapter must use getNatureWalkerCurrentSite and natureWalker.life.operation. */
export interface MotherSource {
  runId: string; actorId: string; revision: number; character: SliceState['character']; budget: MotherBudget;
  finance: MotherFinance; random: SliceState['random']; historyDigest: string; originalWorldDigest: string;
  combatHistoryLength: number; combatHistoryDigest: string; originalsDigest: string; acquisitionDigest: string;
  originals: { site: NatureWalkerSite; operation: NatureWalkerOperationState; rootPad: NatureWalkerRootPad };
  acquisition: Pick<NatureWalkerState, 'bottles' | 'resupply' | 'acquisitionJournal'> & { promotionWeek: number; promotionDate: PublicGameDate };
  /** One ledger entry per fixed original; original bottles and retry carriers remain separate. */
  originalCharacteristics: {
    characteristics: { characteristicId: string; originalBottleId: MotherOriginalId; latestBottleId: string; holder: 'SUPPLIER' | 'FAILED_REMNANT' | 'PLAYER' | 'EMBODIED'; consumptionHistory: { bottleId: string; revision: number; week: number; outcome: PublicResolutionTier }[] }[];
    embodiedOriginalBottleId: MotherOriginalId | null; embodiedBottleId: string | null;
  };
}
export interface MotherOriginal {
  originalId: MotherOriginalId; characteristicId: string; labourSteps: number; labourEventIds: string[]; latestBottleId: string; failedConsumptionRevision: number | null;
  holder: 'SUPPLIER' | 'UNLOCATED_REMNANT' | 'LOCATED' | 'SEALED_REMNANT' | 'PLAYER' | 'COMPOUND' | 'EMBODIED' | 'FUSED' | 'DEATH_REMAINS';
  location: MotherPlaceId | null; compoundId: string | null;
  permissionEventId: string | null; permissionWeek: number | null; investigationEventId: string | null;
  sealedEventId: string | null; sealedWeek: number | null; sealedSecond: number | null; recoveredEventId: string | null;
}
export interface MotherCompound {
  id: string; carrierId: string; status: 'PREPARED' | 'SUCCESS' | 'FAILED_EXPOSED' | 'FAILED_SEALED' | 'RECOVERED' | 'DEATH_REMAINS';
  location: MotherPlaceId; originalIds: MotherOriginalId[]; embodiedOriginalId: MotherOriginalId; uniquenessId: 'MO229-UNIQUENESS';
  preparedEventId: string; consumedEventId: string | null; sealedEventId: string | null;
  sealedWeek: number | null; sealedSecond: number | null; recoveredEventId: string | null;
}
export interface MotherMaterials {
  originals: MotherOriginal[];
  uniqueness: { id: 'MO229-UNIQUENESS'; holder: 'CUSTODIAN' | 'PLAYER' | 'COMPOUND' | 'EXPOSED' | 'SEALED' | 'FUSED' | 'DEATH_REMAINS'; location: MotherPlaceId; compoundId: string | null; verifiedEventId: string | null; acquiredEventId: string | null };
  carriers: { id: string; status: 'SUPPLIER' | 'PLAYER' | 'SPENT'; boughtEventId: string | null }[];
  compounds: MotherCompound[];
}
export interface MotherPlant extends Omit<NatureWalkerSite['samples'][number], 'holder' | 'location'> {
 holder: 'OWNER' | 'RECIPIENT' | 'PLAYER' | 'BED'; location: MotherPosition; version: number; travelMetres: number;
 originalHolder: 'OWNER' | 'RECIPIENT'; checkedEventId: string | null; placedEventId: string | null; wateredEventId: string | null;
 supportedEventId: string | null; returnedEventId: string | null; maintenanceEventId: string | null; branchEventId: string | null;
 branch: { id: string; exists: true; growthCount: 0; version: number; deflectionMillimetres: number; supportMethod: 'NONE' | 'WEDGE' | 'ABILITY' };
}
export interface MotherWindow {
 kind: 'VITALITY_MAINTENANCE' | 'LIVING_BRANCH_SUPPORT'; actorId: string; sampleId: MotherSampleId; branchId: string | null;
 targetVersion: number; permissionVersion: string; createdAt: number; expiresAt: number;
}
export interface MotherScene {
 phase: 'PREPARATION' | 'PRACTICE'; status: 'ACTIVE' | 'ABORTED' | 'COMPLETED'; playerPosition: MotherPosition;
 playerTravelMetres: number; originalDepartureEventId: string | null;
 originalSite: NatureWalkerSite; originalOperation: NatureWalkerOperationState; originalRootPad: NatureWalkerRootPad;
 plants: MotherPlant[];
 permissions: Record<MotherPersonId, { consent: MotherConsent; version: number; eventId: string | null; phase: 'PREPARATION' | 'PRACTICE' }>;
 greenhouse: { id: 'MO229-WIND-DAMAGED-GREENHOUSE'; ownerId: 'CB3-ADA'; inspectedEventId: string | null; repairEventId: string | null; integrity: number; exitOpen: true };
 supplies: { boughtEventId: string | null; waterInitial: number; waterRemaining: number; wedgesInitial: number; wedgesRemaining: number; spent: { eventId: string; sampleId: MotherSampleId; water: number; wedges: number }[] };
 contactSampleId: MotherSampleId | null; window: MotherWindow | null;
 moves: { eventId: string; from: MotherPosition; to: MotherPosition; metres: number; seconds: number; sampleId: MotherSampleId | null }[];
 receipts: { eventId: string; kind: string; sampleId: MotherSampleId | null; beforeVitality: number | null; afterVitality: number | null }[];
 greenhouseReportEventId: string | null; returnReportEventId: string | null; maintenanceApplied: boolean; branchApplied: boolean;
}
export interface MotherPreparation {
  id: string; compoundId: string; actorId: string; sourceDigest: string; compoundDigest: string; greenhouseReportEventId: string;
  location: MotherPlaceId; preparedSecond: number; expiresSecond: number; status: 'READY' | 'SPENT' | 'INVALIDATED'; spentEventId: string | null;
}
export interface MotherEvent {
  id: string; revision: number; command: MotherCommand; before: MotherFrame; after: MotherFrame;
  randomReceipts: { id: string; check: PublicCheckResult; cursorBefore: number; cursorAfter: number }[];
  financeReceipts: { title: string; text: string }[]; notes: string[]; beforeDigest: string; afterDigest: string;
}
export interface MotherState {
  version: 1; guidanceKnown: boolean; source: MotherSource | null; frame: MotherFrame | null;
  promotionWeek: number | null; scene: MotherScene | null; materials: MotherMaterials | null;
  journal: MotherEvent[]; promotionStability: { preparations: MotherPreparation[] };
}
export interface MotherSceneHost {
  eventId: string; revision: number; week: number; second: number; actorId: string; sequence: 1 | 0;
  actions: number; cash: number; health: number; mind: number; spirituality: number;
}
export interface MotherEffect { actions: number; cash: number; spirituality: number; mind: number; health: number; seconds: number; mastery?: string[] }
export interface MotherAction { id: string; label: string; cost: string; command: MotherCommand; enabled: boolean; reason: string | null; preferredAction?: boolean }
export interface MotherProjection {
  title: string; guidanceKnown: boolean; promoted: boolean; story: string; nextStep: string; risk: string; insideCase: boolean;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number; weeklyBudget: number };
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  abilities: { id: string; label: string; description: string; mastery: number }[];
  actions: MotherAction[]; sections: { id: string; title: string; lines: string[] }[];
}
