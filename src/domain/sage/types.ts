import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { SageActivityCommand, SageLifeProjection, SageLifeState } from './life.js';
import type { SageRitualCommand, SageRitualProjection, SageRitualState } from './ritual.js';
import type { SageEncounterCommand, SageEncounterProjection, SageEncounterState } from './encounter.js';

export const SAGE_ABILITY_IDS = ['hermit.s2.information-form', 'hermit.s2.information-sift'] as const;
export type SageAbilityId = typeof SAGE_ABILITY_IDS[number];
export const SAGE_PREPARATION_IDS = ['REVIEW_DISASTER', 'CHECK_IDENTITY', 'CHECK_RETURN'] as const;
export type SagePreparationId = typeof SAGE_PREPARATION_IDS[number];
export type SageAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: SagePreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type SageCommand = SageAcquisitionCommand | SageRitualCommand | SageActivityCommand | SageEncounterCommand;
export interface SageBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
/** Bounded acquisition evidence; inherited people, bodies, scrolls and inventory stay in their source history. */
export interface SageAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  sequence: 3 | 2; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number;
}
export interface SageAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: SageAcquisitionCommand;
  actor: { name: string; gender: string; pathwayId: 'hermit'; prophecyMasterPromotionWeek: number; pryerPromotionWeek: number };
  before: SageAcquisitionBudget; after: SageAcquisitionBudget;
  ritualEvents: number; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
}
export interface SageState {
  guidanceKnown: boolean; bottles: SageBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; prophecyMasterActingAtPromotion: number | null;
  preparations: { taskId: SagePreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: SageAcquisitionEvent[];
  ritual: SageRitualState; life: SageLifeState; encounter: SageEncounterState;
}
export interface SageAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SageCommand;
}
export interface SageProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: SageAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: SageAcquisitionCommand }[];
  preparations: { taskId: SagePreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  ritual: SageRitualProjection; life: SageLifeProjection; encounter: SageEncounterProjection;
  insideCase: boolean; environment: string;
}
export type SagePublicView = SageProjection;
export type { SageActivityCommand, SageLifeProjection, SageLifeState } from './life.js';
export type { SageEncounterCommand, SageEncounterProjection, SageEncounterState } from './encounter.js';

export type { SageRitualCommand, SageRitualState, SageRitualProjection } from './ritual.js';
