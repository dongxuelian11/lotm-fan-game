import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { TimeWormOriginals, TimeWormActivityCommand, TimeWormLifeProjection, TimeWormLifeState } from './life.js';
import type { TimeWormEncounterCommand, TimeWormEncounterProjection, TimeWormEncounterState } from './encounter.js';

export const TIME_WORM_ABILITY_IDS = ['error.s1.short-time-theft', 'error.s1.time-release'] as const;
export type TimeWormAbilityId = typeof TIME_WORM_ABILITY_IDS[number];
export const TIME_WORM_PREPARATION_IDS = ['VERIFY_ORIGINALS', 'DECLARE_PENDING_ACTION', 'PLAN_RETURN'] as const;
export type TimeWormPreparationId = typeof TIME_WORM_PREPARATION_IDS[number];
export type TimeWormAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: TimeWormPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION' | 'REQUEST_RECOVERY_V1' | 'RECOVER_CHARACTERISTIC_V1'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type TimeWormCommand = TimeWormAcquisitionCommand | TimeWormActivityCommand | TimeWormEncounterCommand;
/** The vessel may change; the three finite original characteristics do not. */
export interface TimeWormRecoveryRequest {
  version: 1; sourceBottleId: string; originalBottleId: string; characteristicId: string; requestedWeek: number; sourceReceiptRevision: number;
  siteId: 'BACKLUND_ORIGINAL_TIME_WORM_PREPARATION'; custodian: 'ER0-TIME-WORM-SUPPLIER';
}
export interface TimeWormRecovery extends TimeWormRecoveryRequest { recoveredWeek: number }
/** A contemporaneous supplier permission and physical inspection. It is never inferred from old consent. */
export interface TimeWormRecoverySite {
  siteId: 'BACKLUND_ORIGINAL_TIME_WORM_PREPARATION'; originals: TimeWormOriginals;
  permission: { personId: 'ER0-TIME-WORM-SUPPLIER'; week: number; revision: number; purpose: 'INVESTIGATE' | 'RECOVER' };
  originalBottleId: string; sourceBottleId: string; characteristicId: string; sourceReceiptRevision: number;
  custodyBefore: 'FAILED_REMNANT' | 'SEALED_WITH_CUSTODIAN'; custodyAfter: 'SEALED_WITH_CUSTODIAN' | 'SUPPLIER';
}
export interface TimeWormOriginalCharacteristic {
  characteristicId: string; originalBottleId: string; latestBottleId: string;
  holder: 'SUPPLIER' | 'PLAYER' | 'FAILED_REMNANT' | 'EMBODIED';
  consumptionHistory: { bottleId: string; revision: number; week: number; outcome: PublicResolutionTier }[];
}
export interface TimeWormOriginalCharacteristics {
  characteristics: TimeWormOriginalCharacteristic[];
  embodiedOriginalBottleId: string | null; embodiedBottleId: string | null;
}
export interface TimeWormBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
  recovery?: TimeWormRecovery;
}
/** Bounded acquisition evidence; inherited people, bodies, effects and inventory stay in their source history. */
export interface TimeWormAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  gender: string; sequence: 2 | 1; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number;
}
export type TimeWormFinanceSnapshot = Pick<SliceState, 'weeklyBudget' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface TimeWormAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: TimeWormAcquisitionCommand;
  actor: { name: string; gender: string; age: number; sourceHistoryDigest: string | null; sourceIdentityDigest: string; pathwayId: 'error'; fateTrojanPromotionWeek: number; marauderPromotionWeek: number };
  before: TimeWormAcquisitionBudget; after: TimeWormAcquisitionBudget; finance: TimeWormFinanceSnapshot;
  cursorBefore: number; cursorAfter: number; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
  recoverySite?: TimeWormRecoverySite;
}
export const TIME_WORM_SOURCE_KEYS = ['marauder', 'swindler', 'cryptologist', 'fireThief', 'dreamStealer', 'parasite', 'deceitMentor', 'fateTrojan'] as const;
export type TimeWormSourceHistory = Pick<SliceState, typeof TIME_WORM_SOURCE_KEYS[number]>;
export type { TimeWormOriginals } from './life.js';
export interface TimeWormSourceScene {
  week: number; date: PublicGameDate; revision: number; random: SliceState['random'];
  budget: TimeWormAcquisitionBudget; finance: TimeWormFinanceSnapshot; identityDigest: string; historyDigest: string;
  character: SliceState['character']; originals: TimeWormOriginals;
  combatHistoryLength: number; combatHistoryDigest: string; city: 'BACKLUND';
}
export interface TimeWormState {
  guidanceKnown: boolean; bottles: TimeWormBottle[];
  resupply: { requestedWeek: number | null; deliveries: number; recovery?: TimeWormRecoveryRequest };
  promotionWeek: number | null; fateTrojanActingAtPromotion: number | null;
  preparations: { taskId: TimeWormPreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: TimeWormAcquisitionEvent[];
  /** Single frozen eight-root history; only authoritative original resource fields can evolve. */
  sourceHistory: TimeWormSourceHistory | null; sourceScene: TimeWormSourceScene | null;
  life: TimeWormLifeState; encounter: TimeWormEncounterState;
}
export interface TimeWormAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: TimeWormCommand; cleanup?: boolean; preferredAction?: boolean;
}
export interface TimeWormProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: TimeWormAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: TimeWormAcquisitionCommand }[];
  preparations: { taskId: TimeWormPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  characterName: string; currentGender: string; originalGender: string | null; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  life: TimeWormLifeProjection; encounter: TimeWormEncounterProjection;
  insideCase: boolean; environment: string;
}
export type TimeWormPublicView = TimeWormProjection;
export type { TimeWormActivityCommand, TimeWormLifeProjection, TimeWormLifeState } from './life.js';
export type { TimeWormEncounterCommand, TimeWormEncounterProjection, TimeWormEncounterState } from './encounter.js';
