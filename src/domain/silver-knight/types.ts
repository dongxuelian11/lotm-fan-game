import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { SilverKnightActivityCommand, SilverKnightLifeProjection, SilverKnightLifeState } from './life.js';
import type { SilverKnightEncounterCommand, SilverKnightEncounterProjection, SilverKnightEncounterState } from './encounter.js';
import type { SilverKnightRitualCommand, SilverKnightRitualProjection, SilverKnightRitualState } from './ritual.js';

export const SILVER_KNIGHT_ABILITY_IDS = ['warrior.s3.silver-armor', 'warrior.s3.light-concealment', 'warrior.s3.silver-thrust'] as const;
export type SilverKnightAbilityId = typeof SILVER_KNIGHT_ABILITY_IDS[number];
export const SILVER_KNIGHT_PREPARATION_IDS = ['REVIEW_HUNT', 'RECORD_ANCHOR', 'READ_ALTAR'] as const;
export type SilverKnightPreparationId = typeof SILVER_KNIGHT_PREPARATION_IDS[number];
export type SilverKnightAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: SilverKnightPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type SilverKnightCommand = SilverKnightAcquisitionCommand | SilverKnightActivityCommand | SilverKnightEncounterCommand | SilverKnightRitualCommand;
export interface SilverKnightBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface SilverKnightState {
  guidanceKnown: boolean; bottles: SilverKnightBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; demonHunterActingAtPromotion: number | null;
  preparations: { taskId: SilverKnightPreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  ritual: SilverKnightRitualState; life: SilverKnightLifeState; encounter: SilverKnightEncounterState;
}
export interface SilverKnightAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SilverKnightCommand;
}
export interface SilverKnightProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: SilverKnightAction[]; nextStep: string; preferredActionId: string | null;
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: SilverKnightAcquisitionCommand }[];
  preparations: { taskId: SilverKnightPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; inheritedHistory: string[];
  ritual: SilverKnightRitualProjection; life: SilverKnightLifeProjection; encounter: SilverKnightEncounterProjection;
  insideCase: boolean; environment: string;
}
export type SilverKnightPublicView = SilverKnightProjection;
export type { SilverKnightRitualCommand, SilverKnightRitualProjection, SilverKnightRitualState } from './ritual.js';
export type { SilverKnightActivityCommand, SilverKnightLifeProjection, SilverKnightLifeState } from './life.js';
export type { SilverKnightEncounterCommand, SilverKnightEncounterProjection, SilverKnightEncounterState } from './encounter.js';
