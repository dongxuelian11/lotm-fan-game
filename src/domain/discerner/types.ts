import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { DiscernerActivityCommand, DiscernerLifeProjection, DiscernerLifeState } from './life.js';
import type { DiscernerEncounterCommand, DiscernerEncounterProjection, DiscernerEncounterState } from './encounter.js';

export const DISCERNER_ABILITY_IDS = ['audience.s2.mental-imprint', 'audience.s2.insight-window'] as const;
export type DiscernerAbilityId = typeof DISCERNER_ABILITY_IDS[number];
export const DISCERNER_PREPARATION_IDS = ['INSPECT_ROUTE', 'CHECK_ORIGINALS', 'PLAN_WITHDRAWAL'] as const;
export type DiscernerPreparationId = typeof DISCERNER_PREPARATION_IDS[number];
export type DiscernerAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: DiscernerPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type DiscernerCommand = DiscernerAcquisitionCommand | DiscernerActivityCommand | DiscernerEncounterCommand;
export interface DiscernerBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface DiscernerState {
  guidanceKnown: boolean; bottles: DiscernerBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; dreamWeaverActingAtPromotion: number | null;
  preparations: { taskId: DiscernerPreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  life: DiscernerLifeState; encounter: DiscernerEncounterState;
}
export interface DiscernerAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: DiscernerCommand;
}
export interface DiscernerProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: DiscernerAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: DiscernerAcquisitionCommand }[];
  preparations: { taskId: DiscernerPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; inheritedHistory: string[];
  life: DiscernerLifeProjection; encounter: DiscernerEncounterProjection;
  insideCase: boolean; environment: string;
}
export type DiscernerPublicView = DiscernerProjection;
