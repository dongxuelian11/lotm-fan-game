import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { ProphecyMasterActivityCommand, ProphecyMasterLifeProjection, ProphecyMasterLifeState } from './life.js';
import type { ProphecyMasterEncounterCommand, ProphecyMasterEncounterProjection, ProphecyMasterEncounterState } from './encounter.js';

export const PROPHECY_MASTER_ABILITY_IDS = ['hermit.s3.prophetic-glimpse'] as const;
export type ProphecyMasterAbilityId = typeof PROPHECY_MASTER_ABILITY_IDS[number];
export const PROPHECY_MASTER_PREPARATION_IDS = ['REVIEW_RECORDS', 'CHECK_LIMITS', 'MARK_EXIT'] as const;
export type ProphecyMasterPreparationId = typeof PROPHECY_MASTER_PREPARATION_IDS[number];
export type ProphecyMasterAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: ProphecyMasterPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type ProphecyMasterCommand = ProphecyMasterAcquisitionCommand | ProphecyMasterActivityCommand | ProphecyMasterEncounterCommand;
export interface ProphecyMasterBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface ProphecyMasterState {
  guidanceKnown: boolean; bottles: ProphecyMasterBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; mysticActingAtPromotion: number | null;
  preparations: { taskId: ProphecyMasterPreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  life: ProphecyMasterLifeState; encounter: ProphecyMasterEncounterState;
}
export interface ProphecyMasterAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ProphecyMasterCommand;
}
export interface ProphecyMasterProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: ProphecyMasterAction[]; nextStep: string; preferredActionId: string | null;
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ProphecyMasterAcquisitionCommand }[];
  preparations: { taskId: ProphecyMasterPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  inheritedHistory: string[]; inheritedTools: string;
  life: ProphecyMasterLifeProjection; encounter: ProphecyMasterEncounterProjection;
  insideCase: boolean; environment: string;
}
export type ProphecyMasterPublicView = ProphecyMasterProjection;

export type { ProphecyMasterActivityCommand, ProphecyMasterLifeProjection, ProphecyMasterLifeState } from './life.js';
export type { ProphecyMasterEncounterCommand, ProphecyMasterEncounterProjection, ProphecyMasterEncounterState } from './encounter.js';
