import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { DiscernerState } from '../discerner/types.js';
import type { SliceState } from '../slice/types.js';
import type { WriterActivityCommand, WriterLifeProjection, WriterLifeState } from './life.js';
import type { WriterEncounterCommand, WriterEncounterProjection, WriterEncounterState } from './encounter.js';

export const WRITER_ABILITY_IDS = ['audience.s1.reciprocal-insight', 'audience.s1.plausible-arrangement'] as const;
export type WriterAbilityId = typeof WRITER_ABILITY_IDS[number];
export const WRITER_PREPARATION_IDS = ['REVIEW_RECORDS', 'CHECK_LIMITS', 'MARK_EXIT'] as const;
export type WriterPreparationId = typeof WRITER_PREPARATION_IDS[number];
export type WriterAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: WriterPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION' | 'REQUEST_RECOVERY_V1' | 'RECOVER_CHARACTERISTIC_V1'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type WriterCommand = WriterAcquisitionCommand | WriterActivityCommand | WriterEncounterCommand;
/** A later drug vessel carries the same finite original; its attempt ID is not a new characteristic. */
export interface WriterRecoveryRequest {
  version: 1; sourceBottleId: string; originalBottleId: string; characteristicId: string; requestedWeek: number;
}
export interface WriterRecovery extends WriterRecoveryRequest { recoveredWeek: number }
export interface WriterOriginalCharacteristic {
  characteristicId: string; originalBottleId: string; latestBottleId: string;
  holder: 'SUPPLIER' | 'PLAYER' | 'FAILED_REMAINS' | 'EMBODIED';
}
export interface WriterOriginalCharacteristics {
  characteristics: WriterOriginalCharacteristic[];
  embodiedOriginalBottleId: string | null; embodiedBottleId: string | null;
}
export interface WriterBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
  recovery?: WriterRecovery;
}
/** Bounded acquisition evidence; inherited people, bodies, effects and inventory stay in their source history. */
export interface WriterAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  gender: string; sequence: 2 | 1; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number;
}
export interface WriterAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: WriterAcquisitionCommand;
  actor: { name: string; gender: string; age: number; sourceHistoryDigest: string | null; sourceIdentityDigest: string; pathwayId: 'audience'; discernerPromotionWeek: number; audiencePromotionWeek: number };
  before: WriterAcquisitionBudget; after: WriterAcquisitionBudget;
  randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
}
export interface WriterState {
  guidanceKnown: boolean; bottles: WriterBottle[];
  resupply: { requestedWeek: number | null; deliveries: number; recovery?: WriterRecoveryRequest };
  promotionWeek: number | null; discernerActingAtPromotion: number | null;
  preparations: { taskId: WriterPreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: WriterAcquisitionEvent[];
  /** Frozen prior-stage root, captured only by the first actual guidance command. */
  sourceDiscerner: DiscernerState | null;
  life: WriterLifeState; encounter: WriterEncounterState;
}
export interface WriterAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: WriterCommand; cleanup?: boolean; preferredAction?: boolean;
}
export interface WriterProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: WriterAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: WriterAcquisitionCommand }[];
  preparations: { taskId: WriterPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  characterName: string; currentGender: string; originalGender: string | null; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  life: WriterLifeProjection; encounter: WriterEncounterProjection;
  insideCase: boolean; environment: string;
}
export type WriterPublicView = WriterProjection;
export type { WriterActivityCommand, WriterLifeProjection, WriterLifeState } from './life.js';
export type { WriterEncounterCommand, WriterEncounterProjection, WriterEncounterState } from './encounter.js';
