import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { BriberGift } from '../briber/types.js';
import type { SliceState } from '../slice/types.js';
import type { EntropyDukeActivityCommand, EntropyDukeLifeProjection, EntropyDukeLifeState } from './life.js';
import type { EntropyDukeEncounterCommand, EntropyDukeEncounterProjection, EntropyDukeEncounterState } from './encounter.js';

export const ENTROPY_DUKE_ABILITY_IDS = ['black-emperor.s2.action-amplification', 'black-emperor.s2.effect-prolongation'] as const;
export type EntropyDukeAbilityId = typeof ENTROPY_DUKE_ABILITY_IDS[number];
export const ENTROPY_DUKE_PREPARATION_IDS = ['REVIEW_RECORDS', 'CHECK_LIMITS', 'MARK_EXIT'] as const;
export type EntropyDukePreparationId = typeof ENTROPY_DUKE_PREPARATION_IDS[number];
export type EntropyDukeAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: EntropyDukePreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type EntropyDukeCommand = EntropyDukeAcquisitionCommand | EntropyDukeActivityCommand | EntropyDukeEncounterCommand;
export interface EntropyDukeBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
/** Bounded acquisition evidence; inherited people, bodies, effects and inventory stay in their source history. */
export interface EntropyDukeAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  sequence: 3 | 2; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number; gifts: BriberGift[];
}
export interface EntropyDukeAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: EntropyDukeAcquisitionCommand;
  actor: { name: string; gender: string; pathwayId: 'black-emperor'; frenzyMagePromotionWeek: number; lawyerPromotionWeek: number };
  before: EntropyDukeAcquisitionBudget; after: EntropyDukeAcquisitionBudget;
  randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
}
export interface EntropyDukeState {
  guidanceKnown: boolean; bottles: EntropyDukeBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; frenzyMageActingAtPromotion: number | null;
  preparations: { taskId: EntropyDukePreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: EntropyDukeAcquisitionEvent[];
  life: EntropyDukeLifeState; encounter: EntropyDukeEncounterState;
}
export interface EntropyDukeAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: EntropyDukeCommand;
}
export interface EntropyDukeProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: EntropyDukeAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: EntropyDukeAcquisitionCommand }[];
  preparations: { taskId: EntropyDukePreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  currentGender: string; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  life: EntropyDukeLifeProjection; encounter: EntropyDukeEncounterProjection;
  insideCase: boolean; environment: string;
}
export type EntropyDukePublicView = EntropyDukeProjection;
export type { EntropyDukeActivityCommand, EntropyDukeLifeProjection, EntropyDukeLifeState } from './life.js';
export type { EntropyDukeEncounterCommand, EntropyDukeEncounterProjection, EntropyDukeEncounterState } from './encounter.js';
