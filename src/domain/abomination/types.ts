import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { AncientEvilBlock } from '../ancient-evil/encounter.js';
import type { AncientEvilOperationState } from '../ancient-evil/life.js';
import type { SilentDiscipleLifeState } from '../silent-disciple/life.js';
import type { AbominationActivityCommand, AbominationLifeProjection, AbominationLifeState } from './life.js';
import type { AbominationEncounterCommand, AbominationEncounterProjection, AbominationEncounterState } from './encounter.js';

export const ABOMINATION_ABILITY_IDS = ['chained.s1.spirit-barrier', 'chained.s1.brief-cry'] as const;
export type AbominationAbilityId = typeof ABOMINATION_ABILITY_IDS[number];
export const ABOMINATION_PREPARATION_IDS = ['VERIFY_ORIGINALS', 'CHECK_LIMITS', 'CHECK_RETURN'] as const;
export type AbominationPreparationId = typeof ABOMINATION_PREPARATION_IDS[number];
export type AbominationAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: AbominationPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type AbominationCommand = AbominationAcquisitionCommand | AbominationActivityCommand | AbominationEncounterCommand;
export interface AbominationBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface AbominationPrices { guidance: number; potion: number; labourCredit: number; labourBalance: number; preparation: number; resupply: number }
export type AbominationFinance = Pick<SliceState, 'weeklyBudget' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface AbominationAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  gender: string; sequence: 2 | 1; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number;
}
export interface AbominationAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: AbominationAcquisitionCommand;
  actor: { name: string; gender: string; age: number; sourceHistoryDigest: string | null; sourceIdentityDigest: string; pathwayId: 'chained'; ancientEvilPromotionWeek: number; prisonerPromotionWeek: number };
  before: AbominationAcquisitionBudget; after: AbominationAcquisitionBudget; finance: AbominationFinance;
  cursorBefore: number; cursorAfter: number; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
}
export const ABOMINATION_SOURCE_KEYS = ['prisoner', 'madman', 'werewolf', 'zombie', 'wraith', 'puppet', 'silentDisciple', 'ancientEvil'] as const;
export type AbominationSourceHistory = Pick<SliceState, typeof ABOMINATION_SOURCE_KEYS[number]>;
/** One original quiet room; new locations extend its route without duplicating people or objects. */
export type AbominationSite = Omit<SilentDiscipleLifeState, 'playerLocation'> & { playerLocation: 'START' | 'A' | 'B' | 'YARD' | 'OUTSIDE' };
/** Evidence only. Mutable continuations live in the new life and encounter roots. */
export interface AbominationOriginals {
  site: AbominationSite; operation: AncientEvilOperationState; blocks: AncientEvilBlock[];
}
export type AbominationSourceOriginals = AbominationOriginals;
export interface AbominationSourceScene {
  week: number; date: PublicGameDate; revision: number; random: SliceState['random'];
  budget: AbominationAcquisitionBudget; finance: AbominationFinance; identityDigest: string; historyDigest: string;
  character: SliceState['character']; originals: AbominationOriginals;
  combatHistoryLength: number; combatHistoryDigest: string; city: 'BACKLUND';
}
export interface AbominationState {
  guidanceKnown: boolean; sourceWeek: number | null; bottles: AbominationBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; ancientEvilActingAtPromotion: number | null;
  preparations: { taskId: AbominationPreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: AbominationAcquisitionEvent[];
  /** Eight immutable predecessor roots; live people, inventory and body continue in the new root only. */
  sourceHistory: AbominationSourceHistory | null; sourceScene: AbominationSourceScene | null;
  life: AbominationLifeState; encounter: AbominationEncounterState;
}
export interface AbominationAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: AbominationCommand; cleanup?: boolean; preferredAction?: boolean;
}
export interface AbominationProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  sourceLabel: string; prices: AbominationPrices | null;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: AbominationAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: AbominationAcquisitionCommand }[];
  preparations: { taskId: AbominationPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  characterName: string; currentGender: string; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  life: AbominationLifeProjection; encounter: AbominationEncounterProjection;
  insideCase: boolean; environment: string;
}
export type AbominationPublicView = AbominationProjection;
export type { AbominationActivityCommand, AbominationLifeProjection, AbominationLifeState } from './life.js';
export type { AbominationEncounterCommand, AbominationEncounterProjection, AbominationEncounterState } from './encounter.js';
