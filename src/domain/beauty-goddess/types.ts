import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { BeautyGoddessActivityCommand, BeautyGoddessLifeProjection, BeautyGoddessLifeState } from './life.js';
import type { BeautyGoddessEncounterCommand, BeautyGoddessEncounterProjection, BeautyGoddessEncounterState } from './encounter.js';

export const BEAUTY_GODDESS_ABILITY_IDS = ['moon.s1.self-poise', 'moon.s1.bounded-moonform'] as const;
export type BeautyGoddessAbilityId = typeof BEAUTY_GODDESS_ABILITY_IDS[number];
export const BEAUTY_GODDESS_PREPARATION_IDS = ['REVIEW_RECORDS', 'CHECK_LIMITS', 'MARK_EXIT'] as const;
export type BeautyGoddessPreparationId = typeof BEAUTY_GODDESS_PREPARATION_IDS[number];
export type BeautyGoddessAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: BeautyGoddessPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONFIRM_TRANSFORMATION'; confirmed: true }
  | { type: 'DECLINE_TRANSFORMATION' }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type BeautyGoddessCommand = BeautyGoddessAcquisitionCommand | BeautyGoddessActivityCommand | BeautyGoddessEncounterCommand;
export interface BeautyGoddessBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
/** Bounded acquisition evidence; inherited people, bodies, effects and inventory stay in their source history. */
export interface BeautyGoddessAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  gender: string; sequence: 2 | 1; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number;
}
export interface BeautyGoddessAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: BeautyGoddessAcquisitionCommand;
  actor: { name: string; gender: string; age: number; sourceHistoryDigest: string | null; sourceIdentityDigest: string; pathwayId: 'moon'; lifeGiverPromotionWeek: number; apothecaryPromotionWeek: number };
  before: BeautyGoddessAcquisitionBudget; after: BeautyGoddessAcquisitionBudget;
  cursorBefore: number; cursorAfter: number; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
}
export const BEAUTY_GODDESS_SOURCE_KEYS = ['apothecary', 'tamer', 'vampire', 'potionProfessor', 'crimsonScholar', 'witchKing', 'summoningMaster', 'lifeGiver'] as const;
export type BeautyGoddessSourceHistory = Pick<SliceState, typeof BEAUTY_GODDESS_SOURCE_KEYS[number]>;
export interface BeautyGoddessSourceScene {
  week: number; date: PublicGameDate; revision: number; random: SliceState['random'];
  budget: BeautyGoddessAcquisitionBudget; identityDigest: string; historyDigest: string;
  character: SliceState['character']; partner: SliceState['summoningMaster']['life']['partner'];
  papers: SliceState['witchKing']['life']['papers']; combatHistoryLength: number; combatHistoryDigest: string; city: 'BACKLUND';
}
export interface BeautyGoddessTransformation {
  originalGender: string | null; decision: 'UNDECIDED' | 'ACCEPTED' | 'DECLINED'; acknowledgedWeek: number | null; outcome: 'FEMALE' | null;
}
export interface BeautyGoddessState {
  transformation: BeautyGoddessTransformation;
  guidanceKnown: boolean; bottles: BeautyGoddessBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; lifeGiverActingAtPromotion: number | null;
  preparations: { taskId: BeautyGoddessPreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: BeautyGoddessAcquisitionEvent[];
  /** Single frozen eight-root history; only authoritative original resource fields can evolve. */
  sourceHistory: BeautyGoddessSourceHistory | null; sourceScene: BeautyGoddessSourceScene | null;
  life: BeautyGoddessLifeState; encounter: BeautyGoddessEncounterState;
}
export interface BeautyGoddessAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: BeautyGoddessCommand; cleanup?: boolean; preferredAction?: boolean;
}
export interface BeautyGoddessProjection {
  transformation: BeautyGoddessTransformation;
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: BeautyGoddessAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: BeautyGoddessAcquisitionCommand }[];
  preparations: { taskId: BeautyGoddessPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  characterName: string; currentGender: string; originalGender: string | null; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  life: BeautyGoddessLifeProjection; encounter: BeautyGoddessEncounterProjection;
  insideCase: boolean; environment: string;
}
export type BeautyGoddessPublicView = BeautyGoddessProjection;
export type { BeautyGoddessActivityCommand, BeautyGoddessLifeProjection, BeautyGoddessLifeState } from './life.js';
export type { BeautyGoddessEncounterCommand, BeautyGoddessEncounterProjection, BeautyGoddessEncounterState } from './encounter.js';
