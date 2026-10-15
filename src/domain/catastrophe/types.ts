import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { CatastropheActivityCommand, CatastropheLifeProjection, CatastropheLifeState } from './life.js';
import type { CatastropheEncounterCommand, CatastropheEncounterProjection, CatastropheEncounterState } from './encounter.js';

export const CATASTROPHE_ABILITY_IDS = ['tyrant.s2.storm-field', 'tyrant.s2.water-pressure'] as const;
export type CatastropheAbilityId = typeof CATASTROPHE_ABILITY_IDS[number];
export const CATASTROPHE_PREPARATION_IDS = ['VERIFY_WATER', 'AGREE_BOUNDARY', 'PLAN_RETURN'] as const;
export type CatastrophePreparationId = typeof CATASTROPHE_PREPARATION_IDS[number];
export type CatastropheAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: CatastrophePreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type CatastropheCommand = CatastropheAcquisitionCommand | CatastropheActivityCommand | CatastropheEncounterCommand;
export interface CatastropheBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface CatastropheState {
  guidanceKnown: boolean; bottles: CatastropheBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; seaKingActingAtPromotion: number | null;
  preparations: { taskId: CatastrophePreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  life: CatastropheLifeState; encounter: CatastropheEncounterState;
}
export interface CatastropheAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: CatastropheCommand;
}
export interface CatastropheProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: CatastropheAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: CatastropheAcquisitionCommand }[];
  preparations: { taskId: CatastrophePreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; inheritedHistory: string[];
  life: CatastropheLifeProjection; encounter: CatastropheEncounterProjection;
  insideCase: boolean; environment: string;
}
export type CatastrophePublicView = CatastropheProjection;
