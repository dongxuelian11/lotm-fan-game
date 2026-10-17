import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { ThreeHeadedTemplarActivityCommand, ThreeHeadedTemplarLifeProjection, ThreeHeadedTemplarLifeState } from './life.js';
import type { ThreeHeadedTemplarEncounterCommand, ThreeHeadedTemplarEncounterProjection, ThreeHeadedTemplarEncounterState } from './encounter.js';

export const THREE_HEADED_TEMPLAR_ABILITY_IDS = ['hanged-man.s3.multiple-release'] as const;
export type ThreeHeadedTemplarAbilityId = typeof THREE_HEADED_TEMPLAR_ABILITY_IDS[number];
export const THREE_HEADED_TEMPLAR_PREPARATION_IDS = ['REVIEW_RECORDS', 'CHECK_LIMITS', 'MARK_EXIT'] as const;
export type ThreeHeadedTemplarPreparationId = typeof THREE_HEADED_TEMPLAR_PREPARATION_IDS[number];
export type ThreeHeadedTemplarAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: ThreeHeadedTemplarPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type ThreeHeadedTemplarCommand = ThreeHeadedTemplarAcquisitionCommand | ThreeHeadedTemplarActivityCommand | ThreeHeadedTemplarEncounterCommand;
export interface ThreeHeadedTemplarBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface ThreeHeadedTemplarState {
  guidanceKnown: boolean; bottles: ThreeHeadedTemplarBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; blackKnightActingAtPromotion: number | null;
  preparations: { taskId: ThreeHeadedTemplarPreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  life: ThreeHeadedTemplarLifeState; encounter: ThreeHeadedTemplarEncounterState;
}
export interface ThreeHeadedTemplarAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ThreeHeadedTemplarCommand;
}
export interface ThreeHeadedTemplarProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: ThreeHeadedTemplarAction[]; nextStep: string; preferredActionId: string | null;
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ThreeHeadedTemplarAcquisitionCommand }[];
  preparations: { taskId: ThreeHeadedTemplarPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  inheritedHistory: string[]; inheritedTools: string;
  life: ThreeHeadedTemplarLifeProjection; encounter: ThreeHeadedTemplarEncounterProjection;
  insideCase: boolean; environment: string;
}
export type ThreeHeadedTemplarPublicView = ThreeHeadedTemplarProjection;

export type { ThreeHeadedTemplarActivityCommand, ThreeHeadedTemplarLifeProjection, ThreeHeadedTemplarLifeState } from './life.js';
export type { ThreeHeadedTemplarEncounterCommand, ThreeHeadedTemplarEncounterProjection, ThreeHeadedTemplarEncounterState } from './encounter.js';
