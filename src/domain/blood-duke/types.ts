import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { BloodDukeActivityCommand, BloodDukeLifeProjection, BloodDukeLifeState } from './life.js';
import type { BloodDukeEncounterCommand, BloodDukeEncounterProjection, BloodDukeEncounterState } from './encounter.js';

export const BLOOD_DUKE_ABILITY_IDS = ['abyss.s2.self-restraint', 'abyss.s2.emotion-interference'] as const;
export type BloodDukeAbilityId = typeof BLOOD_DUKE_ABILITY_IDS[number];
export const BLOOD_DUKE_PREPARATION_IDS = ['REVIEW_RECORDS', 'CHECK_LIMITS', 'MARK_EXIT'] as const;
export type BloodDukePreparationId = typeof BLOOD_DUKE_PREPARATION_IDS[number];
export type BloodDukeAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: BloodDukePreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type BloodDukeCommand = BloodDukeAcquisitionCommand | BloodDukeActivityCommand | BloodDukeEncounterCommand;
export interface BloodDukeBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
/** Bounded acquisition evidence; inherited people, bodies, effects and inventory stay in their source history. */
export interface BloodDukeAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  sequence: 3 | 2; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number;
}
export interface BloodDukeAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: BloodDukeAcquisitionCommand;
  actor: { name: string; gender: string; pathwayId: 'abyss'; blathererPromotionWeek: number; criminalPromotionWeek: number };
  before: BloodDukeAcquisitionBudget; after: BloodDukeAcquisitionBudget;
  randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
}
export interface BloodDukeState {
  guidanceKnown: boolean; bottles: BloodDukeBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; blathererActingAtPromotion: number | null;
  preparations: { taskId: BloodDukePreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: BloodDukeAcquisitionEvent[];
  life: BloodDukeLifeState; encounter: BloodDukeEncounterState;
}
export interface BloodDukeAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: BloodDukeCommand;
}
export interface BloodDukeProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: BloodDukeAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: BloodDukeAcquisitionCommand }[];
  preparations: { taskId: BloodDukePreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  life: BloodDukeLifeProjection; encounter: BloodDukeEncounterProjection;
  insideCase: boolean; environment: string;
}
export type BloodDukePublicView = BloodDukeProjection;
export type { BloodDukeActivityCommand, BloodDukeLifeProjection, BloodDukeLifeState } from './life.js';
export type { BloodDukeEncounterCommand, BloodDukeEncounterProjection, BloodDukeEncounterState } from './encounter.js';
