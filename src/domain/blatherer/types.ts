import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { BlathererActivityCommand, BlathererLifeProjection, BlathererLifeState } from './life.js';
import type { BlathererEncounterCommand, BlathererEncounterProjection, BlathererEncounterState } from './encounter.js';

export const BLATHERER_ABILITY_IDS = ['abyss.s3.limited-murmur'] as const;
export type BlathererAbilityId = typeof BLATHERER_ABILITY_IDS[number];
export const BLATHERER_PREPARATION_IDS = ['REVIEW_RECORDS', 'CHECK_LIMITS', 'MARK_EXIT'] as const;
export type BlathererPreparationId = typeof BLATHERER_PREPARATION_IDS[number];
export type BlathererAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: BlathererPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type BlathererCommand = BlathererAcquisitionCommand | BlathererActivityCommand | BlathererEncounterCommand;
export interface BlathererBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface BlathererState {
  guidanceKnown: boolean; bottles: BlathererBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; devilActingAtPromotion: number | null;
  preparations: { taskId: BlathererPreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  life: BlathererLifeState; encounter: BlathererEncounterState;
}
export interface BlathererAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: BlathererCommand;
}
export interface BlathererProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: BlathererAction[]; nextStep: string; preferredActionId: string | null;
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: BlathererAcquisitionCommand }[];
  preparations: { taskId: BlathererPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  inheritedHistory: string[]; inheritedTools: string;
  life: BlathererLifeProjection; encounter: BlathererEncounterProjection;
  insideCase: boolean; environment: string;
}
export type BlathererPublicView = BlathererProjection;

export type { BlathererActivityCommand, BlathererLifeProjection, BlathererLifeState } from './life.js';
export type { BlathererEncounterCommand, BlathererEncounterProjection, BlathererEncounterState } from './encounter.js';
