import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { CalamityDemonessActivityCommand, CalamityDemonessLifeProjection, CalamityDemonessLifeState } from './life.js';
import type { CalamityDemonessEncounterCommand, CalamityDemonessEncounterProjection, CalamityDemonessEncounterState } from './encounter.js';

export const CALAMITY_DEMONESS_ABILITY_IDS = ['assassin.s2.mirror-screen', 'assassin.s2.black-flame-channel'] as const;
export type CalamityDemonessAbilityId = typeof CALAMITY_DEMONESS_ABILITY_IDS[number];
export const CALAMITY_DEMONESS_PREPARATION_IDS = ['TRACE_ORIGINAL_MIRRORS', 'PLAN_CONTAINMENT', 'CHECK_RETURN'] as const;
export type CalamityDemonessPreparationId = typeof CALAMITY_DEMONESS_PREPARATION_IDS[number];
export type CalamityDemonessAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: CalamityDemonessPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type CalamityDemonessCommand = CalamityDemonessAcquisitionCommand | CalamityDemonessActivityCommand | CalamityDemonessEncounterCommand;
export interface CalamityDemonessBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
/** Bounded acquisition evidence; inherited people, bodies, mirrors and inventory stay in their source history. */
export interface CalamityDemonessAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  sequence: 3 | 2; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number;
}
export interface CalamityDemonessAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: CalamityDemonessAcquisitionCommand;
  actor: { name: string; gender: string; pathwayId: 'demoness'; unagingDemonessPromotionWeek: number; assassinPromotionWeek: number };
  before: CalamityDemonessAcquisitionBudget; after: CalamityDemonessAcquisitionBudget;
  randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
}
export interface CalamityDemonessState {
  guidanceKnown: boolean; bottles: CalamityDemonessBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; unagingDemonessActingAtPromotion: number | null;
  preparations: { taskId: CalamityDemonessPreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: CalamityDemonessAcquisitionEvent[];
  life: CalamityDemonessLifeState; encounter: CalamityDemonessEncounterState;
}
export interface CalamityDemonessAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: CalamityDemonessCommand;
}
export interface CalamityDemonessProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: CalamityDemonessAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: CalamityDemonessAcquisitionCommand }[];
  preparations: { taskId: CalamityDemonessPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; inheritedHistory: string[]; appearanceRecord: string;
  life: CalamityDemonessLifeProjection; encounter: CalamityDemonessEncounterProjection;
  insideCase: boolean; environment: string;
}
export type CalamityDemonessPublicView = CalamityDemonessProjection;
export type { CalamityDemonessActivityCommand, CalamityDemonessLifeProjection, CalamityDemonessLifeState } from './life.js';
export type { CalamityDemonessEncounterCommand, CalamityDemonessEncounterProjection, CalamityDemonessEncounterState } from './encounter.js';
