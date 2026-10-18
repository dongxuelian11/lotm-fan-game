import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { FrenzyMageActivityCommand, FrenzyMageLifeProjection, FrenzyMageLifeState } from './life.js';
import type { FrenzyMageEncounterCommand, FrenzyMageEncounterProjection, FrenzyMageEncounterState } from './encounter.js';

export const FRENZY_MAGE_ABILITY_IDS = ['black-emperor.s3.ordered-deviation'] as const;
export type FrenzyMageAbilityId = typeof FRENZY_MAGE_ABILITY_IDS[number];
export const FRENZY_MAGE_PREPARATION_IDS = ['REVIEW_RECORDS', 'CHECK_LIMITS', 'MARK_EXIT'] as const;
export type FrenzyMagePreparationId = typeof FRENZY_MAGE_PREPARATION_IDS[number];
export type FrenzyMageAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: FrenzyMagePreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type FrenzyMageCommand = FrenzyMageAcquisitionCommand | FrenzyMageActivityCommand | FrenzyMageEncounterCommand;
export interface FrenzyMageBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface FrenzyMageState {
  guidanceKnown: boolean; bottles: FrenzyMageBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; fallenEarlActingAtPromotion: number | null;
  preparations: { taskId: FrenzyMagePreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  life: FrenzyMageLifeState; encounter: FrenzyMageEncounterState;
}
export interface FrenzyMageAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: FrenzyMageCommand;
}
export interface FrenzyMageProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: FrenzyMageAction[]; nextStep: string; preferredActionId: string | null;
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: FrenzyMageAcquisitionCommand }[];
  preparations: { taskId: FrenzyMagePreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  inheritedHistory: string[]; inheritedTools: string;
  life: FrenzyMageLifeProjection; encounter: FrenzyMageEncounterProjection;
  insideCase: boolean; environment: string;
}
export type FrenzyMagePublicView = FrenzyMageProjection;

export type { FrenzyMageActivityCommand, FrenzyMageLifeProjection, FrenzyMageLifeState } from './life.js';
export type { FrenzyMageEncounterCommand, FrenzyMageEncounterProjection, FrenzyMageEncounterState } from './encounter.js';
