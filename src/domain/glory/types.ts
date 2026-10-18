import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { GloryActivityCommand, GloryLifeProjection, GloryLifeState } from './life.js';
import type { GloryEncounterCommand, GloryEncounterProjection, GloryEncounterState } from './encounter.js';

export const GLORY_ABILITY_IDS = ['warrior.s2.armor-temper', 'warrior.s2.close-guard'] as const;
export type GloryAbilityId = typeof GLORY_ABILITY_IDS[number];
export const GLORY_PREPARATION_IDS = ['TRACE_ARMOR', 'PLAN_LOAD', 'CHECK_EXIT'] as const;
export type GloryPreparationId = typeof GLORY_PREPARATION_IDS[number];
export type GloryAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: GloryPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type GloryCommand = GloryAcquisitionCommand | GloryActivityCommand | GloryEncounterCommand;
export interface GloryBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
/** A bounded budget snapshot, never a second body, armor, inventory or inherited scene. */
export interface GloryAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  sequence: 3 | 2; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number;
}
export interface GloryAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: GloryAcquisitionCommand;
  actor: { name: string; gender: string; pathwayId: 'warrior'; silverKnightPromotionWeek: number; warriorPromotionWeek: number };
  before: GloryAcquisitionBudget; after: GloryAcquisitionBudget;
  randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
}
export interface GloryState {
  guidanceKnown: boolean; bottles: GloryBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; silverKnightActingAtPromotion: number | null;
  preparations: { taskId: GloryPreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: GloryAcquisitionEvent[];
  life: GloryLifeState; encounter: GloryEncounterState;
}
export interface GloryAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: GloryCommand;
}
export interface GloryProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: GloryAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: GloryAcquisitionCommand }[];
  preparations: { taskId: GloryPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; inheritedHistory: string[];
  life: GloryLifeProjection; encounter: GloryEncounterProjection;
  insideCase: boolean; environment: string;
}
export type GloryPublicView = GloryProjection;
