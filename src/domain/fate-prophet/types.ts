import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { FateProphetActivityCommand, FateProphetLifeProjection, FateProphetLifeState } from './life.js';
import type { FateProphetEncounterCommand, FateProphetEncounterProjection, FateProphetEncounterState } from './encounter.js';

export const FATE_PROPHET_ABILITY_IDS = ['wheel.s2.event-foresight', 'wheel.s2.hazard-adjustment'] as const;
export type FateProphetAbilityId = typeof FATE_PROPHET_ABILITY_IDS[number];
export const FATE_PROPHET_PREPARATION_IDS = ['REVIEW_RECORDS', 'CHECK_LIMITS', 'MARK_EXIT'] as const;
export type FateProphetPreparationId = typeof FATE_PROPHET_PREPARATION_IDS[number];
export type FateProphetAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: FateProphetPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type FateProphetCommand = FateProphetAcquisitionCommand | FateProphetActivityCommand | FateProphetEncounterCommand;
export interface FateProphetBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
/** Bounded acquisition evidence; inherited people, bodies, effects and inventory stay in their source history. */
export interface FateProphetAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  sequence: 3 | 2; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number; luck: SliceState['winner']['luck'];
}
export interface FateProphetAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: FateProphetAcquisitionCommand;
  actor: { name: string; gender: string; pathwayId: 'wheel'; chaosWalkerPromotionWeek: number; monsterPromotionWeek: number };
  before: FateProphetAcquisitionBudget; after: FateProphetAcquisitionBudget;
  randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
  source: { seed: string; cursorBefore: number; cursorAfter: number };
}
export interface FateProphetState {
  guidanceKnown: boolean; bottles: FateProphetBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; chaosWalkerActingAtPromotion: number | null;
  preparations: { taskId: FateProphetPreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: FateProphetAcquisitionEvent[];
  life: FateProphetLifeState; encounter: FateProphetEncounterState;
}
export interface FateProphetAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: FateProphetCommand;
}
export interface FateProphetProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: FateProphetAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: FateProphetAcquisitionCommand }[];
  preparations: { taskId: FateProphetPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number; luck: { stored: number; capacity: 3; accumulated: number; spent: number; lastAccumulateWeek: number | null };
  currentGender: string; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  life: FateProphetLifeProjection; encounter: FateProphetEncounterProjection;
  insideCase: boolean; environment: string;
}
export type FateProphetPublicView = FateProphetProjection;
export type { FateProphetActivityCommand, FateProphetLifeProjection, FateProphetLifeState } from './life.js';
export type { FateProphetEncounterCommand, FateProphetEncounterProjection, FateProphetEncounterState } from './encounter.js';
