import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { CivilizationEnlightenerActivityCommand, CivilizationEnlightenerLifeProjection, CivilizationEnlightenerLifeState } from './life.js';
import type { CivilizationEnlightenerEncounterCommand, CivilizationEnlightenerEncounterProjection, CivilizationEnlightenerEncounterState } from './encounter.js';

export const CIVILIZATION_ENLIGHTENER_ABILITY_IDS = ['paragon.s1.process-analysis', 'paragon.s1.operational-guidance'] as const;
export type CivilizationEnlightenerAbilityId = typeof CIVILIZATION_ENLIGHTENER_ABILITY_IDS[number];
export const CIVILIZATION_ENLIGHTENER_PREPARATION_IDS = ['REVIEW_RECORDS', 'CHECK_LIMITS', 'MARK_EXIT'] as const;
export type CivilizationEnlightenerPreparationId = typeof CIVILIZATION_ENLIGHTENER_PREPARATION_IDS[number];
export type CivilizationEnlightenerAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: CivilizationEnlightenerPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type CivilizationEnlightenerCommand = CivilizationEnlightenerAcquisitionCommand | CivilizationEnlightenerActivityCommand | CivilizationEnlightenerEncounterCommand;
export interface CivilizationEnlightenerBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
/** Bounded acquisition evidence; inherited people, bodies, effects and inventory stay in their source history. */
export interface CivilizationEnlightenerAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  gender: string; sequence: 2 | 1; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number;
}
export interface CivilizationEnlightenerAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: CivilizationEnlightenerAcquisitionCommand;
  actor: { name: string; gender: string; age: number; sourceHistoryDigest: string | null; sourceIdentityDigest: string; pathwayId: 'paragon'; knowledgeMentorPromotionWeek: number; savantPromotionWeek: number };
  before: CivilizationEnlightenerAcquisitionBudget; after: CivilizationEnlightenerAcquisitionBudget;
  cursorBefore: number; cursorAfter: number; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
}
export const CIVILIZATION_ENLIGHTENER_SOURCE_KEYS = ['savant', 'archaeologist', 'appraiser', 'artisan', 'astronomer', 'alchemist', 'arcaneScholar', 'knowledgeMentor'] as const;
export type CivilizationEnlightenerSourceHistory = Pick<SliceState, typeof CIVILIZATION_ENLIGHTENER_SOURCE_KEYS[number]>;
export interface CivilizationEnlightenerSourceScene {
  week: number; date: PublicGameDate; revision: number; random: SliceState['random'];
  budget: CivilizationEnlightenerAcquisitionBudget; identityDigest: string; historyDigest: string;
  creations: SliceState['alchemist']['life']['creations']; combatHistoryLength: number; combatHistoryDigest: string; city: 'BACKLUND';
}
export interface CivilizationEnlightenerState {
  guidanceKnown: boolean; bottles: CivilizationEnlightenerBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; knowledgeMentorActingAtPromotion: number | null;
  preparations: { taskId: CivilizationEnlightenerPreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: CivilizationEnlightenerAcquisitionEvent[];
  /** Single frozen eight-root history; only authoritative original resource fields can evolve. */
  sourceHistory: CivilizationEnlightenerSourceHistory | null; sourceScene: CivilizationEnlightenerSourceScene | null;
  life: CivilizationEnlightenerLifeState; encounter: CivilizationEnlightenerEncounterState;
}
export interface CivilizationEnlightenerAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: CivilizationEnlightenerCommand; cleanup?: boolean; preferredAction?: boolean;
}
export interface CivilizationEnlightenerProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: CivilizationEnlightenerAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: CivilizationEnlightenerAcquisitionCommand }[];
  preparations: { taskId: CivilizationEnlightenerPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  characterName: string; currentGender: string; originalGender: string | null; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  life: CivilizationEnlightenerLifeProjection; encounter: CivilizationEnlightenerEncounterProjection;
  insideCase: boolean; environment: string;
}
export type CivilizationEnlightenerPublicView = CivilizationEnlightenerProjection;
export type { CivilizationEnlightenerActivityCommand, CivilizationEnlightenerLifeProjection, CivilizationEnlightenerLifeState } from './life.js';
export type { CivilizationEnlightenerEncounterCommand, CivilizationEnlightenerEncounterProjection, CivilizationEnlightenerEncounterState } from './encounter.js';
