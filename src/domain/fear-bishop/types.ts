import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { FearBishopActivityCommand, FearBishopLifeProjection, FearBishopLifeState } from './life.js';
import type { FearBishopEncounterCommand, FearBishopEncounterProjection, FearBishopEncounterState } from './encounter.js';

export const FEAR_BISHOP_ABILITY_IDS = ['darkness.s3.dark-dissolution', 'darkness.s3.sleep-fear'] as const;
export type FearBishopAbilityId = typeof FEAR_BISHOP_ABILITY_IDS[number];
export const FEAR_BISHOP_PREPARATION_IDS = ['CHECK_RESIDUE', 'AGREE_STOP', 'PLAN_EXIT'] as const;
export type FearBishopPreparationId = typeof FEAR_BISHOP_PREPARATION_IDS[number];
export type FearBishopAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: FearBishopPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type FearBishopCommand = FearBishopAcquisitionCommand | FearBishopActivityCommand | FearBishopEncounterCommand;
export interface FearBishopBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface FearBishopState {
  guidanceKnown: boolean; bottles: FearBishopBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; nightwatcherActingAtPromotion: number | null;
  preparations: { taskId: FearBishopPreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  life: FearBishopLifeState; encounter: FearBishopEncounterState;
}
export interface FearBishopAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: FearBishopCommand;
}
export interface FearBishopProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: FearBishopAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: FearBishopAcquisitionCommand }[];
  preparations: { taskId: FearBishopPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; inheritedHistory: string[];
  life: FearBishopLifeProjection; encounter: FearBishopEncounterProjection;
  insideCase: boolean; environment: string;
}
export type FearBishopPublicView = FearBishopProjection;
