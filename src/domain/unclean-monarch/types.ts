import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { BloodDukeOperationState } from '../blood-duke/life.js';
import type { BlathererLifeState } from '../blatherer/life.js';
import type { UncleanMonarchActivityCommand, UncleanMonarchLifeProjection, UncleanMonarchLifeState } from './life.js';
import type { UncleanMonarchEncounterCommand, UncleanMonarchEncounterProjection, UncleanMonarchEncounterState } from './encounter.js';

export const UNCLEAN_MONARCH_ABILITY_IDS = ['abyss.s1.impulse-binding', 'abyss.s1.focused-interference'] as const;
export type UncleanMonarchAbilityId = typeof UNCLEAN_MONARCH_ABILITY_IDS[number];
export const UNCLEAN_MONARCH_PREPARATION_IDS = ['VERIFY_ORIGINALS', 'CHECK_LIMITS', 'CHECK_RETURN'] as const;
export type UncleanMonarchPreparationId = typeof UNCLEAN_MONARCH_PREPARATION_IDS[number];
export type UncleanMonarchAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: UncleanMonarchPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type UncleanMonarchCommand = UncleanMonarchAcquisitionCommand | UncleanMonarchActivityCommand | UncleanMonarchEncounterCommand;
export interface UncleanMonarchBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface UncleanMonarchPrices { guidance: number; potion: number; labourCredit: number; labourBalance: number; preparation: number; resupply: number }
export type UncleanMonarchFinance = Pick<SliceState, 'weeklyBudget' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface UncleanMonarchAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  gender: string; sequence: 2 | 1; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number;
}
export interface UncleanMonarchAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: UncleanMonarchAcquisitionCommand;
  actor: { name: string; gender: string; age: number; sourceHistoryDigest: string | null; sourceIdentityDigest: string; pathwayId: 'abyss'; bloodDukePromotionWeek: number; criminalPromotionWeek: number };
  before: UncleanMonarchAcquisitionBudget; after: UncleanMonarchAcquisitionBudget; finance: UncleanMonarchFinance;
  cursorBefore: number; cursorAfter: number; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
}
export const UNCLEAN_MONARCH_SOURCE_KEYS = ['criminal', 'unwinged', 'serialKiller', 'demon', 'desireApostle', 'devil', 'blatherer', 'bloodDuke'] as const;
export type UncleanMonarchSourceHistory = Pick<SliceState, typeof UNCLEAN_MONARCH_SOURCE_KEYS[number]>;
/** One original quiet room; new locations extend its route without duplicating people or objects. */
export type UncleanMonarchSite = Omit<BlathererLifeState, 'playerLocation'> & { playerLocation: 'START' | 'A' | 'B' | 'YARD' | 'OUTSIDE' };
/** Evidence only. Mutable continuations live in the new life and encounter roots. */
export interface UncleanMonarchOriginals {
  site: BlathererLifeState; operation: BloodDukeOperationState; strain: number;
}
export type UncleanMonarchSourceOriginals = UncleanMonarchOriginals;
export interface UncleanMonarchSourceScene {
  week: number; date: PublicGameDate; revision: number; random: SliceState['random'];
  budget: UncleanMonarchAcquisitionBudget; finance: UncleanMonarchFinance; identityDigest: string; historyDigest: string;
  character: SliceState['character']; originals: UncleanMonarchOriginals;
  combatHistoryLength: number; combatHistoryDigest: string; city: 'BACKLUND';
}
export interface UncleanMonarchState {
  guidanceKnown: boolean; sourceWeek: number | null; bottles: UncleanMonarchBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; bloodDukeActingAtPromotion: number | null;
  preparations: { taskId: UncleanMonarchPreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: UncleanMonarchAcquisitionEvent[];
  /** Eight immutable predecessor roots; live people, inventory and body continue in the new root only. */
  sourceHistory: UncleanMonarchSourceHistory | null; sourceScene: UncleanMonarchSourceScene | null;
  life: UncleanMonarchLifeState; encounter: UncleanMonarchEncounterState;
}
export interface UncleanMonarchAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: UncleanMonarchCommand; cleanup?: boolean; preferredAction?: boolean;
}
export interface UncleanMonarchProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  sourceLabel: string; prices: UncleanMonarchPrices | null;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: UncleanMonarchAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: UncleanMonarchAcquisitionCommand }[];
  preparations: { taskId: UncleanMonarchPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  characterName: string; currentGender: string; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  life: UncleanMonarchLifeProjection; encounter: UncleanMonarchEncounterProjection;
  insideCase: boolean; environment: string;
}
export type UncleanMonarchPublicView = UncleanMonarchProjection;
export type { UncleanMonarchActivityCommand, UncleanMonarchLifeProjection, UncleanMonarchLifeState } from './life.js';
export type { UncleanMonarchEncounterCommand, UncleanMonarchEncounterProjection, UncleanMonarchEncounterState } from './encounter.js';
