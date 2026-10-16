import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { ConcealmentServantActivityCommand, ConcealmentServantLifeProjection, ConcealmentServantLifeState } from './life.js';
import type { ConcealmentServantEncounterCommand, ConcealmentServantEncounterProjection, ConcealmentServantEncounterState } from './encounter.js';

export const CONCEALMENT_SERVANT_ABILITY_IDS = ['darkness.s2.bounded-concealment', 'darkness.s2.trace-veil'] as const;
export type ConcealmentServantAbilityId = typeof CONCEALMENT_SERVANT_ABILITY_IDS[number];
export const CONCEALMENT_SERVANT_PREPARATION_IDS = ['CHECK_BOUNDARY', 'AGREE_RETURN', 'TRACE_LIMIT'] as const;
export type ConcealmentServantPreparationId = typeof CONCEALMENT_SERVANT_PREPARATION_IDS[number];
export type ConcealmentServantAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: ConcealmentServantPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type ConcealmentServantCommand = ConcealmentServantAcquisitionCommand | ConcealmentServantActivityCommand | ConcealmentServantEncounterCommand;
export interface ConcealmentServantBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface ConcealmentServantState {
  guidanceKnown: boolean; bottles: ConcealmentServantBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; fearBishopActingAtPromotion: number | null;
  preparations: { taskId: ConcealmentServantPreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  life: ConcealmentServantLifeState; encounter: ConcealmentServantEncounterState;
}
export interface ConcealmentServantAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ConcealmentServantCommand;
}
export interface ConcealmentServantProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: ConcealmentServantAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ConcealmentServantAcquisitionCommand }[];
  preparations: { taskId: ConcealmentServantPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; inheritedHistory: string[];
  life: ConcealmentServantLifeProjection; encounter: ConcealmentServantEncounterProjection;
  insideCase: boolean; environment: string;
}
export type ConcealmentServantPublicView = ConcealmentServantProjection;
