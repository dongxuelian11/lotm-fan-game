import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { BalancerActivityCommand, BalancerLifeProjection, BalancerLifeState } from './life.js';
import type { BalancerEncounterCommand, BalancerEncounterProjection, BalancerEncounterState } from './encounter.js';

export const BALANCER_ABILITY_IDS = ['justiciar.s2.imbalance-sensing', 'justiciar.s2.measured-resistance'] as const;
export type BalancerAbilityId = typeof BALANCER_ABILITY_IDS[number];
export const BALANCER_PREPARATION_IDS = ['REVIEW_RECORDS', 'CHECK_LIMITS', 'MARK_EXIT'] as const;
export type BalancerPreparationId = typeof BALANCER_PREPARATION_IDS[number];
export type BalancerAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: BalancerPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type BalancerCommand = BalancerAcquisitionCommand | BalancerActivityCommand | BalancerEncounterCommand;
export interface BalancerBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
/** Bounded acquisition evidence; inherited people, bodies, effects and inventory stay in their source history. */
export interface BalancerAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  sequence: 3 | 2; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number;
}
export interface BalancerAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: BalancerAcquisitionCommand;
  actor: { name: string; gender: string; age: number; sourceHistoryDigest: string | null; pathwayId: 'justiciar'; chaosHunterPromotionWeek: number; arbiterPromotionWeek: number };
  before: BalancerAcquisitionBudget; after: BalancerAcquisitionBudget;
  randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
}
export interface BalancerState {
  guidanceKnown: boolean; bottles: BalancerBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; chaosHunterActingAtPromotion: number | null;
  preparations: { taskId: BalancerPreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: BalancerAcquisitionEvent[];
  life: BalancerLifeState; encounter: BalancerEncounterState;
}
export interface BalancerAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: BalancerCommand; cleanup?: boolean; preferredAction?: boolean;
}
export interface BalancerProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: BalancerAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: BalancerAcquisitionCommand }[];
  preparations: { taskId: BalancerPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  currentGender: string; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  life: BalancerLifeProjection; encounter: BalancerEncounterProjection;
  insideCase: boolean; environment: string;
}
export type BalancerPublicView = BalancerProjection;
export type { BalancerActivityCommand, BalancerLifeProjection, BalancerLifeState } from './life.js';
export type { BalancerEncounterCommand, BalancerEncounterProjection, BalancerEncounterState } from './encounter.js';
