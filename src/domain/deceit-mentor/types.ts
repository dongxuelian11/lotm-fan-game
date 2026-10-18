import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { DeceitMentorActivityCommand, DeceitMentorLifeProjection, DeceitMentorLifeState } from './life.js';
import type { DeceitMentorEncounterCommand, DeceitMentorEncounterProjection, DeceitMentorEncounterState } from './encounter.js';

export const DECEIT_MENTOR_ABILITY_IDS = ['error.s3.law-deceit', 'error.s3.deep-deception'] as const;
export type DeceitMentorAbilityId = typeof DECEIT_MENTOR_ABILITY_IDS[number];
export const DECEIT_MENTOR_PREPARATION_IDS = ['CHECK_SOURCE', 'BOUND_EFFECT', 'PLAN_RESTITUTION'] as const;
export type DeceitMentorPreparationId = typeof DECEIT_MENTOR_PREPARATION_IDS[number];
export type DeceitMentorAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: DeceitMentorPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type DeceitMentorCommand = DeceitMentorAcquisitionCommand | DeceitMentorActivityCommand | DeceitMentorEncounterCommand;
export interface DeceitMentorBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface DeceitMentorState {
  guidanceKnown: boolean; bottles: DeceitMentorBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; parasiteActingAtPromotion: number | null;
  preparations: { taskId: DeceitMentorPreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  life: DeceitMentorLifeState; encounter: DeceitMentorEncounterState;
}
export interface DeceitMentorAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: DeceitMentorCommand;
}
export interface DeceitMentorProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: DeceitMentorAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: DeceitMentorAcquisitionCommand }[];
  preparations: { taskId: DeceitMentorPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; inheritedHistory: string[];
  life: DeceitMentorLifeProjection; encounter: DeceitMentorEncounterProjection;
  insideCase: boolean; environment: string;
}
export type DeceitMentorPublicView = DeceitMentorProjection;
