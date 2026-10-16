import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { BarrenMatriarchActivityCommand, BarrenMatriarchLifeProjection, BarrenMatriarchLifeState } from './life.js';
import type { BarrenMatriarchEncounterCommand, BarrenMatriarchEncounterProjection, BarrenMatriarchEncounterState } from './encounter.js';

export const BARREN_MATRIARCH_ABILITY_IDS = ['mother.s2.bounded-dormancy', 'mother.s2.root-buffer'] as const;
export type BarrenMatriarchAbilityId = typeof BARREN_MATRIARCH_ABILITY_IDS[number];
export const BARREN_MATRIARCH_PREPARATION_IDS = ['REVIEW_RECORDS', 'CHECK_LIMITS', 'MARK_EXIT'] as const;
export type BarrenMatriarchPreparationId = typeof BARREN_MATRIARCH_PREPARATION_IDS[number];
export type BarrenMatriarchAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: BarrenMatriarchPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true; acceptFeminization: true };
export type BarrenMatriarchCommand = BarrenMatriarchAcquisitionCommand | BarrenMatriarchActivityCommand | BarrenMatriarchEncounterCommand;
export interface BarrenMatriarchBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
/** Bounded acquisition evidence; inherited people, bodies, effects and inventory stay in their source history. */
export interface BarrenMatriarchAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  gender: string; sequence: 3 | 2; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number;
}
export interface BarrenMatriarchAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: BarrenMatriarchAcquisitionCommand;
  actor: { name: string; gender: string; age: number; sourceHistoryDigest: string | null; pathwayId: 'mother'; coffinBearerPromotionWeek: number; cultivatorPromotionWeek: number };
  before: BarrenMatriarchAcquisitionBudget; after: BarrenMatriarchAcquisitionBudget;
  randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
}
export interface BarrenMatriarchState {
  guidanceKnown: boolean; bottles: BarrenMatriarchBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; coffinBearerActingAtPromotion: number | null;
  preparations: { taskId: BarrenMatriarchPreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: BarrenMatriarchAcquisitionEvent[];
  life: BarrenMatriarchLifeState; encounter: BarrenMatriarchEncounterState;
}
export interface BarrenMatriarchAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: BarrenMatriarchCommand; cleanup?: boolean; preferredAction?: boolean;
}
export interface BarrenMatriarchProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: BarrenMatriarchAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: BarrenMatriarchAcquisitionCommand }[];
  preparations: { taskId: BarrenMatriarchPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  currentGender: string; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  life: BarrenMatriarchLifeProjection; encounter: BarrenMatriarchEncounterProjection;
  insideCase: boolean; environment: string;
}
export type BarrenMatriarchPublicView = BarrenMatriarchProjection;
export type { BarrenMatriarchActivityCommand, BarrenMatriarchLifeProjection, BarrenMatriarchLifeState } from './life.js';
export type { BarrenMatriarchEncounterCommand, BarrenMatriarchEncounterProjection, BarrenMatriarchEncounterState } from './encounter.js';
