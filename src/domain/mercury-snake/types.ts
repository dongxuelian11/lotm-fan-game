import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { FateProphetOperationState } from '../fate-prophet/life.js';
import type { ChaosWalkerLifeState } from '../chaos-walker/life.js';
import type { WinnerLuck } from '../winner/types.js';
import type { MercurySnakeActivityCommand, MercurySnakeLifeProjection, MercurySnakeLifeState } from './life.js';
import type { MercurySnakeEncounterCommand, MercurySnakeEncounterProjection, MercurySnakeEncounterState } from './encounter.js';

export const MERCURY_SNAKE_ABILITY_IDS = ['wheel.s1.local-restart', 'wheel.s1.moment-anchor'] as const;
export type MercurySnakeAbilityId = typeof MERCURY_SNAKE_ABILITY_IDS[number];
export const MERCURY_SNAKE_PREPARATION_IDS = ['VERIFY_ORIGINALS', 'CHECK_LIMITS', 'CHECK_RETURN'] as const;
export type MercurySnakePreparationId = typeof MERCURY_SNAKE_PREPARATION_IDS[number];
export type MercurySnakeAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: MercurySnakePreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type MercurySnakeCommand = MercurySnakeAcquisitionCommand | MercurySnakeActivityCommand | MercurySnakeEncounterCommand;
export interface MercurySnakeBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface MercurySnakePrices { guidance: number; potion: number; labourCredit: number; labourBalance: number; preparation: number; resupply: number }
export type MercurySnakeFinance = Pick<SliceState, 'weeklyBudget' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface MercurySnakeAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  gender: string; sequence: 2 | 1; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number; luck: WinnerLuck;
}
export interface MercurySnakeAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: MercurySnakeAcquisitionCommand;
  actor: { name: string; gender: string; age: number; sourceHistoryDigest: string | null; sourceIdentityDigest: string; pathwayId: 'wheel'; fateProphetPromotionWeek: number; monsterPromotionWeek: number };
  before: MercurySnakeAcquisitionBudget; after: MercurySnakeAcquisitionBudget; finance: MercurySnakeFinance;
  cursorBefore: number; cursorAfter: number; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
}
export const MERCURY_SNAKE_SOURCE_KEYS = ['monster', 'machine', 'lucky', 'calamityPriest', 'winner', 'misfortuneMage', 'chaosWalker', 'fateProphet'] as const;
export type MercurySnakeSourceHistory = Pick<SliceState, typeof MERCURY_SNAKE_SOURCE_KEYS[number]>;
/** The real workshop continues once. Historical snapshots never become live objects. */
export type MercurySnakeSite = Omit<ChaosWalkerLifeState, 'playerLocation' | 'volunteer' | 'parcel'> & {
  playerLocation: 'START' | 'A' | 'B' | 'C' | 'YARD' | 'OUTSIDE';
  volunteer: Omit<ChaosWalkerLifeState['volunteer'], 'mind' | 'location'> & { mind: number; location: 'START' | 'A' | 'OUTSIDE' };
  parcel: Omit<ChaosWalkerLifeState['parcel'], 'location'> & { location: 'CW3-CART' | 'A' | 'B' | 'VERA' | 'OUTSIDE' };
};
/** Evidence only. Mutable continuations live in the new life and encounter roots. */
export interface MercurySnakeOriginals {
  site: MercurySnakeSite; operation: FateProphetOperationState; luck: WinnerLuck;
}
export type MercurySnakeSourceOriginals = MercurySnakeOriginals;
export interface MercurySnakeSourceScene {
  week: number; date: PublicGameDate; revision: number; random: SliceState['random'];
  budget: MercurySnakeAcquisitionBudget; finance: MercurySnakeFinance; identityDigest: string; historyDigest: string;
  character: SliceState['character']; originals: MercurySnakeOriginals;
  combatHistoryLength: number; combatHistoryDigest: string; city: 'BACKLUND';
}
export interface MercurySnakeState {
  guidanceKnown: boolean; sourceWeek: number | null; bottles: MercurySnakeBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; fateProphetActingAtPromotion: number | null;
  preparations: { taskId: MercurySnakePreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: MercurySnakeAcquisitionEvent[];
  /** Eight immutable predecessor roots; live people, inventory and body continue in the new root only. */
  sourceHistory: MercurySnakeSourceHistory | null; sourceScene: MercurySnakeSourceScene | null;
  /** Sole spendable continuation after guidance; all predecessor luck copies are evidence. */
  luck: WinnerLuck;
  life: MercurySnakeLifeState; encounter: MercurySnakeEncounterState;
}
export interface MercurySnakeAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: MercurySnakeCommand; cleanup?: boolean; preferredAction?: boolean;
}
export interface MercurySnakeProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  sourceLabel: string; prices: MercurySnakePrices | null;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: MercurySnakeAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: MercurySnakeAcquisitionCommand }[];
  preparations: { taskId: MercurySnakePreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  luck: WinnerLuck & { capacity: 3 };
  characterName: string; currentGender: string; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  life: MercurySnakeLifeProjection; encounter: MercurySnakeEncounterProjection;
  insideCase: boolean; environment: string;
}
export type MercurySnakePublicView = MercurySnakeProjection;
export type { MercurySnakeActivityCommand, MercurySnakeLifeProjection, MercurySnakeLifeState } from './life.js';
export type { MercurySnakeEncounterCommand, MercurySnakeEncounterProjection, MercurySnakeEncounterState } from './encounter.js';
