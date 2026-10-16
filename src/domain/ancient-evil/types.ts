import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { AncientEvilActivityCommand, AncientEvilLifeProjection, AncientEvilLifeState } from './life.js';
import type { AncientEvilEncounterCommand, AncientEvilEncounterProjection, AncientEvilEncounterState } from './encounter.js';

export const ANCIENT_EVIL_ABILITY_IDS = ['chained.s2.enduring-transfiguration', 'chained.s2.curse-guidance'] as const;
export type AncientEvilAbilityId = typeof ANCIENT_EVIL_ABILITY_IDS[number];
export const ANCIENT_EVIL_PREPARATION_IDS = ['REVIEW_RECORDS', 'CHECK_LIMITS', 'MARK_EXIT'] as const;
export type AncientEvilPreparationId = typeof ANCIENT_EVIL_PREPARATION_IDS[number];
export type AncientEvilAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: AncientEvilPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type AncientEvilCommand = AncientEvilAcquisitionCommand | AncientEvilActivityCommand | AncientEvilEncounterCommand;
export interface AncientEvilBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
/** Bounded acquisition evidence; inherited people, bodies, effects and inventory stay in their source history. */
export interface AncientEvilAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  sequence: 3 | 2; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number;
}
export interface AncientEvilAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: AncientEvilAcquisitionCommand;
  actor: { name: string; gender: string; pathwayId: 'chained'; silentDisciplePromotionWeek: number; prisonerPromotionWeek: number };
  before: AncientEvilAcquisitionBudget; after: AncientEvilAcquisitionBudget;
  randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
}
export interface AncientEvilState {
  guidanceKnown: boolean; bottles: AncientEvilBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; silentDiscipleActingAtPromotion: number | null;
  preparations: { taskId: AncientEvilPreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: AncientEvilAcquisitionEvent[];
  life: AncientEvilLifeState; encounter: AncientEvilEncounterState;
}
export interface AncientEvilAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: AncientEvilCommand;
}
export interface AncientEvilProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: AncientEvilAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: AncientEvilAcquisitionCommand }[];
  preparations: { taskId: AncientEvilPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  life: AncientEvilLifeProjection; encounter: AncientEvilEncounterProjection;
  insideCase: boolean; environment: string;
}
export type AncientEvilPublicView = AncientEvilProjection;
export type { AncientEvilActivityCommand, AncientEvilLifeProjection, AncientEvilLifeState } from './life.js';
export type { AncientEvilEncounterCommand, AncientEvilEncounterProjection, AncientEvilEncounterState } from './encounter.js';
