import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { CoffinBearerActivityCommand, CoffinBearerLifeProjection, CoffinBearerLifeState } from './life.js';
import type { CoffinBearerEncounterCommand, CoffinBearerEncounterProjection, CoffinBearerEncounterState } from './encounter.js';

export const COFFIN_BEARER_ABILITY_IDS = ['mother.s3.finite-preservation'] as const;
export type CoffinBearerAbilityId = typeof COFFIN_BEARER_ABILITY_IDS[number];
export const COFFIN_BEARER_PREPARATION_IDS = ['REVIEW_RECORDS', 'CHECK_LIMITS', 'MARK_EXIT'] as const;
export type CoffinBearerPreparationId = typeof COFFIN_BEARER_PREPARATION_IDS[number];
export type CoffinBearerAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: CoffinBearerPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type CoffinBearerCommand = CoffinBearerAcquisitionCommand | CoffinBearerActivityCommand | CoffinBearerEncounterCommand;
export interface CoffinBearerBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface CoffinBearerState {
  guidanceKnown: boolean; bottles: CoffinBearerBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; ancientAlchemistActingAtPromotion: number | null;
  preparations: { taskId: CoffinBearerPreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  life: CoffinBearerLifeState; encounter: CoffinBearerEncounterState;
}
export interface CoffinBearerAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: CoffinBearerCommand;
}
export interface CoffinBearerProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: CoffinBearerAction[]; nextStep: string; preferredActionId: string | null;
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: CoffinBearerAcquisitionCommand }[];
  preparations: { taskId: CoffinBearerPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  inheritedHistory: string[]; inheritedTools: string;
  life: CoffinBearerLifeProjection; encounter: CoffinBearerEncounterProjection;
  insideCase: boolean; environment: string;
}
export type CoffinBearerPublicView = CoffinBearerProjection;

export type { CoffinBearerActivityCommand, CoffinBearerLifeProjection, CoffinBearerLifeState } from './life.js';
export type { CoffinBearerEncounterCommand, CoffinBearerEncounterProjection, CoffinBearerEncounterState } from './encounter.js';
