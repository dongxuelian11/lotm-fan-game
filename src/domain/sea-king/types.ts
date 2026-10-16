import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { SeaKingActivityCommand, SeaKingLifeProjection, SeaKingLifeState } from './life.js';
import type { SeaKingEncounterCommand, SeaKingEncounterProjection, SeaKingEncounterState } from './encounter.js';

export const SEA_KING_ABILITY_IDS = ['tyrant.s3.sea-domain', 'tyrant.s3.remote-tempest', 'tyrant.s3.water-recollection'] as const;
export type SeaKingAbilityId = typeof SEA_KING_ABILITY_IDS[number];
export const SEA_KING_PREPARATION_IDS = ['CHECK_CHART', 'SET_BOUNDARY', 'PLAN_RETURN'] as const;
export type SeaKingPreparationId = typeof SEA_KING_PREPARATION_IDS[number];
export type SeaKingAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: SeaKingPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type SeaKingCommand = SeaKingAcquisitionCommand | SeaKingActivityCommand | SeaKingEncounterCommand;
export interface SeaKingBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface SeaKingState {
  guidanceKnown: boolean; bottles: SeaKingBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; cataclysmPriestActingAtPromotion: number | null;
  preparations: { taskId: SeaKingPreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  life: SeaKingLifeState; encounter: SeaKingEncounterState;
}
export interface SeaKingAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SeaKingCommand;
}
export interface SeaKingProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: SeaKingAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: SeaKingAcquisitionCommand }[];
  preparations: { taskId: SeaKingPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; inheritedHistory: string[];
  life: SeaKingLifeProjection; encounter: SeaKingEncounterProjection;
  insideCase: boolean; environment: string;
}
export type SeaKingPublicView = SeaKingProjection;
