import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { ChaosHunterActivityCommand, ChaosHunterLifeProjection, ChaosHunterLifeState } from './life.js';
import type { ChaosHunterEncounterCommand, ChaosHunterEncounterProjection, ChaosHunterEncounterState } from './encounter.js';

export const CHAOS_HUNTER_ABILITY_IDS = ['justiciar.s3.bounded-order'] as const;
export type ChaosHunterAbilityId = typeof CHAOS_HUNTER_ABILITY_IDS[number];
export const CHAOS_HUNTER_PREPARATION_IDS = ['REVIEW_RECORDS', 'CHECK_LIMITS', 'MARK_EXIT'] as const;
export type ChaosHunterPreparationId = typeof CHAOS_HUNTER_PREPARATION_IDS[number];
export type ChaosHunterAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: ChaosHunterPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type ChaosHunterCommand = ChaosHunterAcquisitionCommand | ChaosHunterActivityCommand | ChaosHunterEncounterCommand;
export interface ChaosHunterBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface ChaosHunterState {
  guidanceKnown: boolean; bottles: ChaosHunterBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; imperativeMageActingAtPromotion: number | null;
  preparations: { taskId: ChaosHunterPreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  life: ChaosHunterLifeState; encounter: ChaosHunterEncounterState;
}
export interface ChaosHunterAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ChaosHunterCommand;
}
export interface ChaosHunterProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: ChaosHunterAction[]; nextStep: string; preferredActionId: string | null;
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ChaosHunterAcquisitionCommand }[];
  preparations: { taskId: ChaosHunterPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  inheritedHistory: string[]; inheritedTools: string;
  life: ChaosHunterLifeProjection; encounter: ChaosHunterEncounterProjection;
  insideCase: boolean; environment: string;
}
export type ChaosHunterPublicView = ChaosHunterProjection;

export type { ChaosHunterActivityCommand, ChaosHunterLifeProjection, ChaosHunterLifeState } from './life.js';
export type { ChaosHunterEncounterCommand, ChaosHunterEncounterProjection, ChaosHunterEncounterState } from './encounter.js';
