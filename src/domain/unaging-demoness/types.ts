import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { UnagingDemonessActivityCommand, UnagingDemonessLifeProjection, UnagingDemonessLifeState } from './life.js';
import type { UnagingDemonessEncounterCommand, UnagingDemonessEncounterProjection, UnagingDemonessEncounterState } from './encounter.js';

export const UNAGING_DEMONESS_ABILITY_IDS = ['assassin.s3.mirror-passage'] as const;
export type UnagingDemonessAbilityId = typeof UNAGING_DEMONESS_ABILITY_IDS[number];
export const UNAGING_DEMONESS_PREPARATION_IDS = ['REVIEW_RECORDS', 'TRACE_MIRRORS', 'MARK_RETURN'] as const;
export type UnagingDemonessPreparationId = typeof UNAGING_DEMONESS_PREPARATION_IDS[number];
export type UnagingDemonessAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: UnagingDemonessPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type UnagingDemonessCommand = UnagingDemonessAcquisitionCommand | UnagingDemonessActivityCommand | UnagingDemonessEncounterCommand;
export interface UnagingDemonessBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface UnagingDemonessState {
  guidanceKnown: boolean; bottles: UnagingDemonessBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; despairActingAtPromotion: number | null;
  preparations: { taskId: UnagingDemonessPreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  life: UnagingDemonessLifeState; encounter: UnagingDemonessEncounterState;
}
export interface UnagingDemonessAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: UnagingDemonessCommand;
}
export interface UnagingDemonessProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: UnagingDemonessAction[]; nextStep: string; preferredActionId: string | null;
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: UnagingDemonessAcquisitionCommand }[];
  preparations: { taskId: UnagingDemonessPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; inheritedHistory: string[]; appearanceRecord: string;
  life: UnagingDemonessLifeProjection; encounter: UnagingDemonessEncounterProjection;
  insideCase: boolean; environment: string;
}
export type UnagingDemonessPublicView = UnagingDemonessProjection;

export type { UnagingDemonessActivityCommand, UnagingDemonessLifeProjection, UnagingDemonessLifeState } from './life.js';
export type { UnagingDemonessEncounterCommand, UnagingDemonessEncounterProjection, UnagingDemonessEncounterState } from './encounter.js';
