import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { WandererActivityCommand, WandererLifeProjection, WandererLifeState } from './life.js';
import type { WandererEncounterCommand, WandererEncounterProjection, WandererEncounterState } from './encounter.js';

export const WANDERER_ABILITY_IDS = ['door.s3.star-wandering', 'door.s3.astral-positioning'] as const;
export type WandererAbilityId = typeof WANDERER_ABILITY_IDS[number];
export const WANDERER_PREPARATION_IDS = ['VERIFY_DESTINATION', 'CHECK_PROTECTION', 'PLAN_RETURN'] as const;
export type WandererPreparationId = typeof WANDERER_PREPARATION_IDS[number];
export type WandererAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: WandererPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type WandererCommand = WandererAcquisitionCommand | WandererActivityCommand | WandererEncounterCommand;
export interface WandererBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface WandererState {
  guidanceKnown: boolean; bottles: WandererBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; secretsSorcererActingAtPromotion: number | null;
  preparations: { taskId: WandererPreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  life: WandererLifeState; encounter: WandererEncounterState;
}
export interface WandererAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: WandererCommand;
}
export interface WandererProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: WandererAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: WandererAcquisitionCommand }[];
  preparations: { taskId: WandererPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; inheritedHistory: string[];
  life: WandererLifeProjection; encounter: WandererEncounterProjection;
  insideCase: boolean; environment: string;
}
export type WandererPublicView = WandererProjection;
