import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { ElderOperationState } from '../elder/life.js';
import type { ThreeHeadedTemplarLifeState } from '../three-headed-templar/life.js';
import type { ShepherdGrazing } from '../shepherd/types.js';
import type { RoseBishopReserve } from '../rose-bishop/types.js';
import type { DarkAngelActivityCommand, DarkAngelLifeProjection, DarkAngelLifeState } from './life.js';
import type { DarkAngelEncounterCommand, DarkAngelEncounterProjection, DarkAngelEncounterState } from './encounter.js';

export const DARK_ANGEL_ABILITY_IDS = ['hanged-man.s1.single-spirit-guidance', 'hanged-man.s1.single-spirit-shelter'] as const;
export type DarkAngelAbilityId = typeof DARK_ANGEL_ABILITY_IDS[number];
export const DARK_ANGEL_PREPARATION_IDS = ['VERIFY_ORIGINALS', 'CHECK_SPIRITS', 'CHECK_RETURN'] as const;
export type DarkAngelPreparationId = typeof DARK_ANGEL_PREPARATION_IDS[number];
export type DarkAngelAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: DarkAngelPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type DarkAngelCommand = DarkAngelAcquisitionCommand | DarkAngelActivityCommand | DarkAngelEncounterCommand;
export interface DarkAngelBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface DarkAngelPrices { guidance: number; potion: number; labourCredit: number; labourBalance: number; preparation: number; resupply: number }
export type DarkAngelFinance = Pick<SliceState, 'weeklyBudget' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface DarkAngelAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  gender: string; sequence: 2 | 1; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number;
}
export interface DarkAngelAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: DarkAngelAcquisitionCommand;
  actor: { name: string; gender: string; age: number; sourceHistoryDigest: string | null; sourceIdentityDigest: string; pathwayId: 'hanged-man'; elderPromotionWeek: number; secretSupplicantPromotionWeek: number };
  before: DarkAngelAcquisitionBudget; after: DarkAngelAcquisitionBudget; finance: DarkAngelFinance;
  cursorBefore: number; cursorAfter: number; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
}
export const DARK_ANGEL_SOURCE_KEYS = ['secretSupplicant', 'listener', 'shadowAscetic', 'roseBishop', 'shepherd', 'blackKnight', 'threeHeadedTemplar', 'elder'] as const;
export type DarkAngelSourceHistory = Pick<SliceState, typeof DARK_ANGEL_SOURCE_KEYS[number]>;
/** One original court; new locations extend its route without duplicating people or objects. */
export type DarkAngelSite = Omit<ThreeHeadedTemplarLifeState, 'playerLocation'> & { playerLocation: 'START' | 'A' | 'B' | 'YARD' | 'OUTSIDE' };
/** Evidence only. Mutable continuations live in the new life and encounter roots. */
export interface DarkAngelOriginals {
  site: ThreeHeadedTemplarLifeState; operation: ElderOperationState; grazing: ShepherdGrazing;
  reserve: RoseBishopReserve; shepherdPromotionWeek: number | null;
}
export interface DarkAngelSourceScene {
  week: number; date: PublicGameDate; revision: number; random: SliceState['random'];
  budget: DarkAngelAcquisitionBudget; finance: DarkAngelFinance; identityDigest: string; historyDigest: string;
  character: SliceState['character']; originals: DarkAngelOriginals;
  combatHistoryLength: number; combatHistoryDigest: string; city: 'BACKLUND';
}
export interface DarkAngelState {
  guidanceKnown: boolean; sourceWeek: number | null; bottles: DarkAngelBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; elderActingAtPromotion: number | null;
  preparations: { taskId: DarkAngelPreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: DarkAngelAcquisitionEvent[];
  /** Eight immutable predecessor roots; live people, inventory and body continue in the new root only. */
  sourceHistory: DarkAngelSourceHistory | null; sourceScene: DarkAngelSourceScene | null;
  life: DarkAngelLifeState; encounter: DarkAngelEncounterState;
}
export interface DarkAngelAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: DarkAngelCommand; cleanup?: boolean; preferredAction?: boolean;
}
export interface DarkAngelProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  sourceLabel: string; prices: DarkAngelPrices | null;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: DarkAngelAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: DarkAngelAcquisitionCommand }[];
  preparations: { taskId: DarkAngelPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  characterName: string; currentGender: string; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  life: DarkAngelLifeProjection; encounter: DarkAngelEncounterProjection;
  insideCase: boolean; environment: string;
}
export type DarkAngelPublicView = DarkAngelProjection;
export type { DarkAngelActivityCommand, DarkAngelLifeProjection, DarkAngelLifeState } from './life.js';
export type { DarkAngelEncounterCommand, DarkAngelEncounterProjection, DarkAngelEncounterState } from './encounter.js';
