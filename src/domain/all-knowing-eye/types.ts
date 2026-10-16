import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { AllKnowingEyeOriginals, AllKnowingEyeActivityCommand, AllKnowingEyeLifeProjection, AllKnowingEyeLifeState } from './life.js';
import type { AllKnowingEyeEncounterCommand, AllKnowingEyeEncounterProjection, AllKnowingEyeEncounterState } from './encounter.js';

export const ALL_KNOWING_EYE_ABILITY_IDS = ['reader.s1.bounded-insight', 'reader.s1.pending-forecast'] as const;
export type AllKnowingEyeAbilityId = typeof ALL_KNOWING_EYE_ABILITY_IDS[number];
export const ALL_KNOWING_EYE_PREPARATION_IDS = ['VERIFY_ORIGINALS', 'RECORD_CONDITIONS', 'MARK_RETURN'] as const;
export type AllKnowingEyePreparationId = typeof ALL_KNOWING_EYE_PREPARATION_IDS[number];
export type AllKnowingEyeAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: AllKnowingEyePreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type AllKnowingEyeCommand = AllKnowingEyeAcquisitionCommand | AllKnowingEyeActivityCommand | AllKnowingEyeEncounterCommand;
export interface AllKnowingEyeBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
/** Bounded acquisition evidence; inherited people, bodies, effects and inventory stay in their source history. */
export interface AllKnowingEyeAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  gender: string; sequence: 2 | 1; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number;
}
export interface AllKnowingEyeAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: AllKnowingEyeAcquisitionCommand;
  actor: { name: string; gender: string; age: number; sourceHistoryDigest: string | null; sourceIdentityDigest: string; pathwayId: 'white-tower'; wisdomAngelPromotionWeek: number; readerPromotionWeek: number };
  before: AllKnowingEyeAcquisitionBudget; after: AllKnowingEyeAcquisitionBudget;
  cursorBefore: number; cursorAfter: number; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
}
export const ALL_KNOWING_EYE_SOURCE_KEYS = ['reader', 'reasoner', 'detective', 'polymath', 'mysticismMagister', 'prophet', 'insightScholar', 'wisdomAngel'] as const;
export type AllKnowingEyeSourceHistory = Pick<SliceState, typeof ALL_KNOWING_EYE_SOURCE_KEYS[number]>;
export type { AllKnowingEyeOriginals } from './life.js';
export interface AllKnowingEyeSourceScene {
  week: number; date: PublicGameDate; revision: number; random: SliceState['random'];
  budget: AllKnowingEyeAcquisitionBudget; identityDigest: string; historyDigest: string;
  character: SliceState['character']; originals: AllKnowingEyeOriginals;
  combatHistoryLength: number; combatHistoryDigest: string; city: 'BACKLUND';
}
export interface AllKnowingEyeState {
  guidanceKnown: boolean; bottles: AllKnowingEyeBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; wisdomAngelActingAtPromotion: number | null;
  preparations: { taskId: AllKnowingEyePreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: AllKnowingEyeAcquisitionEvent[];
  /** Single frozen eight-root history; only authoritative original resource fields can evolve. */
  sourceHistory: AllKnowingEyeSourceHistory | null; sourceScene: AllKnowingEyeSourceScene | null;
  life: AllKnowingEyeLifeState; encounter: AllKnowingEyeEncounterState;
}
export interface AllKnowingEyeAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: AllKnowingEyeCommand; cleanup?: boolean; preferredAction?: boolean;
}
export interface AllKnowingEyeProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: AllKnowingEyeAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: AllKnowingEyeAcquisitionCommand }[];
  preparations: { taskId: AllKnowingEyePreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  characterName: string; currentGender: string; originalGender: string | null; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  life: AllKnowingEyeLifeProjection; encounter: AllKnowingEyeEncounterProjection;
  insideCase: boolean; environment: string;
}
export type AllKnowingEyePublicView = AllKnowingEyeProjection;
export type { AllKnowingEyeActivityCommand, AllKnowingEyeLifeProjection, AllKnowingEyeLifeState } from './life.js';
export type { AllKnowingEyeEncounterCommand, AllKnowingEyeEncounterProjection, AllKnowingEyeEncounterState } from './encounter.js';
