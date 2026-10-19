import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { DeathConsulActivityCommand, DeathConsulLifeProjection, DeathConsulLifeState } from './life.js';
import type { DeathConsulEncounterCommand, DeathConsulEncounterProjection, DeathConsulEncounterState } from './encounter.js';

export const DEATH_CONSUL_ABILITY_IDS = ['death.s2.pale-flame', 'death.s2.spirit-passage'] as const;
export type DeathConsulAbilityId = typeof DEATH_CONSUL_ABILITY_IDS[number];
export const DEATH_CONSUL_PREPARATION_IDS = ['CHECK_ANCHORS', 'REVIEW_RESIDUAL', 'PLAN_RETURN'] as const;
export type DeathConsulPreparationId = typeof DEATH_CONSUL_PREPARATION_IDS[number];
export type DeathConsulSourceEra = 'ORIGINAL' | 'POST_CYCLE';
export interface DeathConsulPrices { guidance: number; potion: number; labourCredit: number; labourBalance: number; preparation: number }
export type DeathConsulAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: DeathConsulPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type DeathConsulCommand = DeathConsulAcquisitionCommand | DeathConsulActivityCommand | DeathConsulEncounterCommand;
export interface DeathConsulBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface DeathConsulState {
  guidanceKnown: boolean;
  /** Written exactly once by LEARN_GUIDANCE; this identifies the real professional channel, not a current scene participant. */
  sourceEra: DeathConsulSourceEra | null; sourceWeek: number | null;
  bottles: DeathConsulBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; ferrymanActingAtPromotion: number | null;
  preparations: { taskId: DeathConsulPreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  life: DeathConsulLifeState; encounter: DeathConsulEncounterState;
}
export interface DeathConsulAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: DeathConsulCommand;
}
export interface DeathConsulProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  sourceEra: DeathConsulSourceEra | null; sourceLabel: string; prices: DeathConsulPrices | null;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: DeathConsulAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: DeathConsulAcquisitionCommand }[];
  preparations: { taskId: DeathConsulPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; inheritedHistory: string[];
  life: DeathConsulLifeProjection; encounter: DeathConsulEncounterProjection;
  insideCase: boolean; environment: string;
}
export type DeathConsulPublicView = DeathConsulProjection;
