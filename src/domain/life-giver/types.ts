import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { LifeGiverActivityCommand, LifeGiverLifeProjection, LifeGiverLifeState } from './life.js';
import type { LifeGiverEncounterCommand, LifeGiverEncounterProjection, LifeGiverEncounterState } from './encounter.js';

export const LIFE_GIVER_ABILITY_IDS = ['moon.s2.bounded-vitality', 'moon.s2.shared-shelter'] as const;
export type LifeGiverAbilityId = typeof LIFE_GIVER_ABILITY_IDS[number];
export const LIFE_GIVER_PREPARATION_IDS = ['INSPECT_SOURCE', 'CHECK_ORIGINAL', 'PLAN_WITHDRAWAL'] as const;
export type LifeGiverPreparationId = typeof LIFE_GIVER_PREPARATION_IDS[number];
export type LifeGiverAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: LifeGiverPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type LifeGiverCommand = LifeGiverAcquisitionCommand | LifeGiverActivityCommand | LifeGiverEncounterCommand;
export interface LifeGiverBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface LifeGiverState {
  guidanceKnown: boolean; bottles: LifeGiverBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; summoningMasterActingAtPromotion: number | null;
  preparations: { taskId: LifeGiverPreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  life: LifeGiverLifeState; encounter: LifeGiverEncounterState;
}
export interface LifeGiverAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: LifeGiverCommand;
}
export interface LifeGiverProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: LifeGiverAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: LifeGiverAcquisitionCommand }[];
  preparations: { taskId: LifeGiverPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; inheritedHistory: string[];
  life: LifeGiverLifeProjection; encounter: LifeGiverEncounterProjection;
  insideCase: boolean; environment: string;
}
export type LifeGiverPublicView = LifeGiverProjection;
