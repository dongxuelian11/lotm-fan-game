import type { PublicCheckResult, PublicCoreStatKey, PublicGameDate } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { DemonessSource } from './source.js';
export type { DemonessSource } from './source.js';

export const DEMONESS_ABILITY_IDS = ['assassin.s0.finite-stone-petrification', 'assassin.s0.contact-strut-reshaping'] as const;
export const DEMONESS_ORIGINAL_IDS = ['apocalypse-demoness-potion-1', 'apocalypse-demoness-potion-2', 'apocalypse-demoness-potion-3'] as const;
export type DemonessOriginalId = typeof DEMONESS_ORIGINAL_IDS[number];
export const DEMONESS_RESIDENT_IDS = ['DM221-ENID', 'DM221-ROWAN'] as const;
export type DemonessResidentId = typeof DEMONESS_RESIDENT_IDS[number];
export type DemonessPosition = -2 | 0 | 3 | 6;
export type DemonessPlace = 'DM221-GALLERY-EXIT' | 'DM221-RECEPTION' | 'DM221-ARCH' | 'DM221-SUPPLIER' | 'DM221-VAULT' | 'DM221-WORKSHOP';
export interface DemonessBudget {
  week: number; date: PublicGameDate; actions: number; cash: number; health: number; mind: number;
  spirituality: number; pollution: number; injuries: SliceState['injuries']; injuryRisk: number;
  status: SliceState['status']; sequence: 1 | 0; acting: number; mastery: Record<string, number>;
  coreStats: SliceState['character']['coreStats']; completedSources: string[];
}
export type DemonessFinance = Pick<SliceState, 'weeklyBudget' | 'wagePaidWeek' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface DemonessFrame {
  budget: DemonessBudget; finance: DemonessFinance; random: SliceState['random'];
  location: DemonessPlace; nowSecond: number; weekAnchor: number;
}
export type DemonessPassageCommand =
  | { type: 'SURVEY' | 'WALK_SIDE_PATH' | 'REPORT_PASSAGE' | 'START_RETURN' | 'BUY_RETURN_KIT' | 'OBSERVE_STONE' | 'PETRIFY_STONE' | 'CATCH_STONE' | 'CLEAR_FALLEN_STONE' | 'TOUCH_STRUT' | 'RESHAPE_STRUT' | 'FIT_WEDGE' | 'ORDINARY_SHORE' | 'END_CONTACT' | 'PAUSE_SHIFT' | 'REPORT_RETURN' | 'REST_OUTSIDE' }
  | { type: 'BUY_SUPPORT' | 'FIT_SUPPORT'; segment: 'A' | 'B' }
  | { type: 'ASK_RESIDENT' | 'WITHDRAW_RESIDENT' | 'ARRIVE_RESIDENT' | 'EXIT_RESIDENT' | 'CROSS_RETURN'; residentId: DemonessResidentId }
  | { type: 'CROSS'; residentId: DemonessResidentId; segment: 'A' | 'B' }
  | { type: 'WALK'; to: DemonessPosition };
export type DemonessMaterialCommand =
  | { type: 'LABOUR' | 'ASK_RECOVERY_PERMISSION' | 'INVESTIGATE_REMAINS' | 'SEAL_ORIGINAL' | 'ACQUIRE_CHARACTERISTIC'; originalId: DemonessOriginalId }
  | { type: 'VERIFY_CUSTODY' | 'ACQUIRE_UNIQUENESS' | 'BUY_CARRIER' | 'COMPOSE' }
  | { type: 'SEAL_REMAINS' | 'RECOVER_REMAINS'; compoundId: string };
export type DemonessCommand =
  | { type: 'LEARN_GUIDANCE' | 'WORK' | 'REST' | 'CLINIC' | 'NEXT_WEEK' | 'RETURN_ON_FOOT' }
  | { type: 'TRAVEL'; to: DemonessPlace }
  | { type: 'PASSAGE'; command: DemonessPassageCommand }
  | { type: 'MATERIAL'; command: DemonessMaterialCommand }
  | { type: 'STABILIZE_PROMOTION'; compoundId: string }
  | { type: 'CONSUME'; compoundId: string; confirmed: true };
export interface DemonessResident {
  id: DemonessResidentId; name: string; age: number; alive: boolean; health: number; energy: number;
  position: DemonessPosition; walkedMetres: number; consent: 'UNASKED' | 'GRANTED' | 'WITHDRAWN'; consentWeek: number | null;
  permissionEventId: string | null; arrivalEventId: string | null; services: string[];
  passage: { arrivalEventId: string; a: string | null; b: string | null; exit: string | null } | null;
  returnPassage: { arrivalEventId: string; crossing: string | null; exit: string | null } | null;
}
export interface DemonessWindow {
  kind: 'PETRIFICATION' | 'RESHAPING'; targetId: string; version: number; createdAt: number; expiresAt: number;
  permissionEventIds: string[]; playerPosition: DemonessPosition;
}
export interface DemonessPassage {
  id: 'DM221-DAMAGED-ARCH'; phase: 'PREPARATION' | 'PREPARED' | 'RETURN' | 'CLOSED';
  position: DemonessPosition; playerEnergy: number; playerWalkedMetres: number;
  surveyEventId: string | null; sidePathEventId: string | null; passageReportEventId: string | null; returnReportEventId: string | null;
  residents: DemonessResident[];
  supports: { id: string; segment: 'A' | 'B'; boughtEventId: string; fittedEventId: string | null; passagesRemaining: number }[];
  strut: { id: 'DM221-ORIGINAL-STRUT'; version: number; integrity: number; resistance: number; scarred: true; reshaped: boolean };
  stone: { id: 'DM221-ORIGINAL-STONE'; version: number; massKg: 2; resistance: number; state: 'LOOSE' | 'FALLING' | 'CAUGHT' | 'LANDED' | 'CLEARED'; fallingUntil: number | null; observedAt: number | null; petrified: boolean };
  returnKit: { boughtEventId: string; catcherUses: 0 | 1; wedgeUses: 0 | 1; fittedEventId: string | null; usedReshaping: boolean; appliedEventId: string | null } | null;
  contact: boolean; window: DemonessWindow | null; petrificationAttempts: number; reshapingAttempts: number;
  petrificationAppliedEventId: string | null; reshapingAppliedEventId: string | null;
}
export type DemonessHolder = 'SUPPLIER' | 'PLAYER' | 'FAILED_REMNANT' | 'LOCATED' | 'SEALED_ORIGINAL' | 'EMBODIED' | 'COMPOUND' | 'EXPOSED' | 'SEALED' | 'FUSED';
export interface DemonessCharacteristic {
  id: string; originalId: DemonessOriginalId; latestBottleId: string; holder: DemonessHolder; location: DemonessPlace | null;
  labourSteps: number; newLabourEventIds: string[]; acquiredEventId: string | null;
  failedConsumptionRevision: number | null; recoveryPermissionEventId: string | null; permissionWeek: number | null;
  investigatedEventId: string | null; sealedEventId: string | null; sealedWeek: number | null;
}
export interface DemonessSuccession {
  branchId: string; formerOwnerId: string; formerOwnerAlive: false;
  death: { id: string; date: PublicGameDate }; separation: { id: string; date: PublicGameDate };
  custody: { id: string; date: PublicGameDate; custodianId: DemonessResidentId; custodyOnly: true };
  originalIds: DemonessOriginalId[]; uniquenessId: 'DM221-ORIGINAL-UNIQUENESS'; objectCount: 1;
  currentIncumbent: null;
}
export interface DemonessCompound {
  id: string; carrierId: string; status: 'PREPARED' | 'SUCCESS' | 'FAILED_EXPOSED' | 'FAILED_SEALED' | 'RECOVERED' | 'DEATH_EXPOSED';
  location: DemonessPlace; characteristicIds: string[]; uniquenessId: 'DM221-ORIGINAL-UNIQUENESS';
  preparedEventId: string; passageReportEventId: string; consumedEventId: string | null;
  sealedEventId: string | null; sealedWeek: number | null; recoveredEventId: string | null;
}
export interface DemonessMaterials {
  characteristics: DemonessCharacteristic[]; succession: DemonessSuccession;
  uniqueness: { id: 'DM221-ORIGINAL-UNIQUENESS'; holder: 'CUSTODIAN' | 'PLAYER' | 'COMPOUND' | 'EXPOSED' | 'SEALED' | 'FUSED'; location: DemonessPlace | null; verifiedEventId: string | null; verifiedWeek: number | null; acquiredEventId: string | null };
  carriers: { id: string; status: 'SUPPLIER' | 'PLAYER' | 'SPENT'; boughtEventId: string | null }[];
  compounds: DemonessCompound[];
}
export interface DemonessPreparation {
  id: string; compoundId: string; actorId: string; sourceDigest: string; compoundDigest: string; passageReportEventId: string;
  location: DemonessPlace; preparedSecond: number; expiresSecond: number; status: 'READY' | 'SPENT' | 'INVALIDATED'; changedEventId: string | null;
}
export interface DemonessEvent {
  id: string; revision: number; command: DemonessCommand; before: DemonessFrame; after: DemonessFrame;
  checks: { check: PublicCheckResult; cursorBefore: number; cursorAfter: number }[];
  financeReceipts: { title: string; text: string }[]; notes: string[]; beforeDigest: string; afterDigest: string;
}
export interface DemonessState {
  version: 1; guidanceKnown: boolean; source: DemonessSource | null; frame: DemonessFrame | null; promotionWeek: number | null;
  passage: DemonessPassage | null; materials: DemonessMaterials | null; preparations: DemonessPreparation[]; journal: DemonessEvent[];
}
/** Candidate-only adapter: the parent owns the eventual central SliceState root. */
export type DemonessSlice = SliceState & { demoness: DemonessState };
export interface DemonessHost {
  eventId: string; revision: number; actorId: string; sourceDigest: string; week: number; nowSecond: number;
  location: DemonessPlace; budget: DemonessBudget; check: PublicCheckResult | null;
}
export interface DemonessEffect {
  actions: number; cash: number; spirituality: number; mind: number; health: number; seconds: number;
  mastery: Partial<Record<typeof DEMONESS_ABILITY_IDS[number], number>>; injury: 'LIGHT' | 'HEAVY' | null;
}
export interface DemonessAction { id: string; label: string; cost: string; command: DemonessCommand; enabled: boolean; reason: string | null; preferredAction?: boolean }
export interface DemonessProjection {
  title: string; available: boolean; guidanceKnown: boolean; promoted: boolean; story: string; nextStep: string; risk: string; insideCase: boolean;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number; weeklyBudget: number };
  abilities: { id: string; label: string; description: string; mastery: number }[];
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  sections: { id: string; title: string; lines: string[] }[]; actions: DemonessAction[];
}
export interface DemonessCheckSpec { ability: PublicCoreStatKey; difficulty: number; modifiers: { source: string; value: number }[] }
