import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { ChaosWalkerActivityCommand, ChaosWalkerLifeProjection, ChaosWalkerLifeState } from './life.js';
import type { ChaosWalkerEncounterCommand, ChaosWalkerEncounterProjection, ChaosWalkerEncounterState } from './encounter.js';

export const CHAOS_WALKER_ABILITY_IDS = ['wheel.s3.deviation-buffer', 'wheel.s3.future-impediment'] as const;
export type ChaosWalkerAbilityId = typeof CHAOS_WALKER_ABILITY_IDS[number];
export const CHAOS_WALKER_PREPARATION_IDS = ['REVIEW_RECORDS', 'CHECK_LIMITS', 'MARK_EXIT'] as const;
export type ChaosWalkerPreparationId = typeof CHAOS_WALKER_PREPARATION_IDS[number];
export type ChaosWalkerAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: ChaosWalkerPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type ChaosWalkerCommand = ChaosWalkerAcquisitionCommand | ChaosWalkerActivityCommand | ChaosWalkerEncounterCommand;
export interface ChaosWalkerBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface ChaosWalkerState {
  guidanceKnown: boolean; bottles: ChaosWalkerBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; misfortuneMageActingAtPromotion: number | null;
  preparations: { taskId: ChaosWalkerPreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  life: ChaosWalkerLifeState; encounter: ChaosWalkerEncounterState;
}
export interface ChaosWalkerAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ChaosWalkerCommand;
}
export interface ChaosWalkerProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: ChaosWalkerAction[]; nextStep: string; preferredActionId: string | null;
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ChaosWalkerAcquisitionCommand }[];
  preparations: { taskId: ChaosWalkerPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  inheritedHistory: string[]; inheritedTools: string;
  life: ChaosWalkerLifeProjection; encounter: ChaosWalkerEncounterProjection;
  insideCase: boolean; environment: string;
}
export type ChaosWalkerPublicView = ChaosWalkerProjection;

export type { ChaosWalkerActivityCommand, ChaosWalkerLifeProjection, ChaosWalkerLifeState } from './life.js';
export type { ChaosWalkerEncounterCommand, ChaosWalkerEncounterProjection, ChaosWalkerEncounterState } from './encounter.js';
