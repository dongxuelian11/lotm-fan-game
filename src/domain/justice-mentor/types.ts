import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { JusticeMentorActivityCommand, JusticeMentorLifeProjection, JusticeMentorLifeState } from './life.js';
import type { JusticeMentorEncounterCommand, JusticeMentorEncounterProjection, JusticeMentorEncounterState } from './encounter.js';

export const JUSTICE_MENTOR_ABILITY_IDS = ['sun.s3.shared-radiance', 'sun.s3.clarity-mark'] as const;
export type JusticeMentorAbilityId = typeof JUSTICE_MENTOR_ABILITY_IDS[number];
export const JUSTICE_MENTOR_PREPARATION_IDS = ['CHECK_TERMS', 'REVIEW_BOUNDARIES', 'PLAN_RETURN'] as const;
export type JusticeMentorPreparationId = typeof JUSTICE_MENTOR_PREPARATION_IDS[number];
export type JusticeMentorAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: JusticeMentorPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type JusticeMentorCommand = JusticeMentorAcquisitionCommand | JusticeMentorActivityCommand | JusticeMentorEncounterCommand;
export interface JusticeMentorBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface JusticeMentorState {
  guidanceKnown: boolean; bottles: JusticeMentorBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; unshadowedActingAtPromotion: number | null;
  preparations: { taskId: JusticeMentorPreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  life: JusticeMentorLifeState; encounter: JusticeMentorEncounterState;
}
export interface JusticeMentorAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: JusticeMentorCommand;
}
export interface JusticeMentorProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: JusticeMentorAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: JusticeMentorAcquisitionCommand }[];
  preparations: { taskId: JusticeMentorPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; inheritedHistory: string[];
  life: JusticeMentorLifeProjection; encounter: JusticeMentorEncounterProjection;
  insideCase: boolean; environment: string;
}
export type JusticeMentorPublicView = JusticeMentorProjection;
