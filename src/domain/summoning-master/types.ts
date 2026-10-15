import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { SummoningMasterActivityCommand, SummoningMasterLifeProjection, SummoningMasterLifeState } from './life.js';
import type { SummoningMasterEncounterCommand, SummoningMasterEncounterProjection, SummoningMasterEncounterState } from './encounter.js';

export const SUMMONING_MASTER_ABILITY_IDS = ['moon.s3.bounded-summoning', 'moon.s3.guest-cooperation'] as const;
export type SummoningMasterAbilityId = typeof SUMMONING_MASTER_ABILITY_IDS[number];
export const SUMMONING_MASTER_PREPARATION_IDS = ['INSPECT_SOURCE', 'CHECK_RETURN', 'PLAN_WITHDRAWAL'] as const;
export type SummoningMasterPreparationId = typeof SUMMONING_MASTER_PREPARATION_IDS[number];
export type SummoningMasterAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: SummoningMasterPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type SummoningMasterCommand = SummoningMasterAcquisitionCommand | SummoningMasterActivityCommand | SummoningMasterEncounterCommand;
export interface SummoningMasterBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface SummoningMasterState {
  guidanceKnown: boolean; bottles: SummoningMasterBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; witchKingActingAtPromotion: number | null;
  preparations: { taskId: SummoningMasterPreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  life: SummoningMasterLifeState; encounter: SummoningMasterEncounterState;
}
export interface SummoningMasterAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SummoningMasterCommand;
}
export interface SummoningMasterProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: SummoningMasterAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: SummoningMasterAcquisitionCommand }[];
  preparations: { taskId: SummoningMasterPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; inheritedHistory: string[];
  life: SummoningMasterLifeProjection; encounter: SummoningMasterEncounterProjection;
  insideCase: boolean; environment: string;
}
export type SummoningMasterPublicView = SummoningMasterProjection;
