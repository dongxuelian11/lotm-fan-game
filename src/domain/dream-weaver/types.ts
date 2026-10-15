import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { DreamWeaverActivityCommand, DreamWeaverLifeProjection, DreamWeaverLifeState } from './life.js';
import type { DreamWeaverEncounterCommand, DreamWeaverEncounterProjection, DreamWeaverEncounterState } from './encounter.js';

export const DREAM_WEAVER_ABILITY_IDS = ['audience.s3.external-identity', 'audience.s3.woven-image'] as const;
export type DreamWeaverAbilityId = typeof DREAM_WEAVER_ABILITY_IDS[number];
export const DREAM_WEAVER_PREPARATION_IDS = ['INSPECT_ROUTE', 'CHECK_ORIGINALS', 'PLAN_WITHDRAWAL'] as const;
export type DreamWeaverPreparationId = typeof DREAM_WEAVER_PREPARATION_IDS[number];
export type DreamWeaverAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: DreamWeaverPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type DreamWeaverCommand = DreamWeaverAcquisitionCommand | DreamWeaverActivityCommand | DreamWeaverEncounterCommand;
export interface DreamWeaverBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface DreamWeaverState {
  guidanceKnown: boolean; bottles: DreamWeaverBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; manipulatorActingAtPromotion: number | null;
  preparations: { taskId: DreamWeaverPreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  life: DreamWeaverLifeState; encounter: DreamWeaverEncounterState;
}
export interface DreamWeaverAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: DreamWeaverCommand;
}
export interface DreamWeaverProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: DreamWeaverAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: DreamWeaverAcquisitionCommand }[];
  preparations: { taskId: DreamWeaverPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; inheritedHistory: string[];
  life: DreamWeaverLifeProjection; encounter: DreamWeaverEncounterProjection;
  insideCase: boolean; environment: string;
}
export type DreamWeaverPublicView = DreamWeaverProjection;
