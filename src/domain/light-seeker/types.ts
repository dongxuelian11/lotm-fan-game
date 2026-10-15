import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { LightSeekerActivityCommand, LightSeekerLifeProjection, LightSeekerLifeState } from './life.js';
import type { LightSeekerEncounterCommand, LightSeekerEncounterProjection, LightSeekerEncounterState } from './encounter.js';

export const LIGHT_SEEKER_ABILITY_IDS = ['sun.s2.guided-radiance', 'sun.s2.limited-light'] as const;
export type LightSeekerAbilityId = typeof LIGHT_SEEKER_ABILITY_IDS[number];
export const LIGHT_SEEKER_PREPARATION_IDS = ['CHECK_LIGHT_PATH', 'REVIEW_EXPOSURE', 'PLAN_RETURN'] as const;
export type LightSeekerPreparationId = typeof LIGHT_SEEKER_PREPARATION_IDS[number];
export type LightSeekerAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: LightSeekerPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type LightSeekerCommand = LightSeekerAcquisitionCommand | LightSeekerActivityCommand | LightSeekerEncounterCommand;
export interface LightSeekerBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface LightSeekerState {
  guidanceKnown: boolean; bottles: LightSeekerBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; justiceMentorActingAtPromotion: number | null;
  preparations: { taskId: LightSeekerPreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  life: LightSeekerLifeState; encounter: LightSeekerEncounterState;
}
export interface LightSeekerAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: LightSeekerCommand;
}
export interface LightSeekerProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: LightSeekerAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: LightSeekerAcquisitionCommand }[];
  preparations: { taskId: LightSeekerPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; inheritedHistory: string[];
  life: LightSeekerLifeProjection; encounter: LightSeekerEncounterProjection;
  insideCase: boolean; environment: string;
}
export type LightSeekerPublicView = LightSeekerProjection;
