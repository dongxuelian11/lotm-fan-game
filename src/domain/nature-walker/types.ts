import { CULTIVATOR_ABILITY_IDS } from '../cultivator/types.js';
import { PHYSICIAN_ABILITY_IDS } from '../physician/types.js';
import { HARVESTPRIEST_ABILITY_IDS } from '../harvestpriest/types.js';
import { BIOLOGIST_ABILITY_IDS } from '../biologist/types.js';
import { DRUID_ABILITY_IDS } from '../druid/types.js';
import { ANCIENT_ALCHEMIST_ABILITY_IDS } from '../ancient-alchemist/types.js';
import { COFFIN_BEARER_ABILITY_IDS } from '../coffin-bearer/types.js';
import { BARREN_MATRIARCH_ABILITY_IDS } from '../barren-matriarch/types.js';
import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { BarrenMatriarchSceneRoot, BarrenMatriarchOperationState, BarrenMatriarchRootPad } from '../barren-matriarch/life.js';
import type { NatureWalkerSite } from './life.js';
export type { NatureWalkerSite } from './life.js';
import type { NatureWalkerActivityCommand, NatureWalkerLifeProjection, NatureWalkerLifeState } from './life.js';
import type { NatureWalkerEncounterCommand, NatureWalkerEncounterProjection, NatureWalkerEncounterState } from './encounter.js';

export const NATURE_WALKER_ABILITY_IDS = ['mother.s1.living-response', 'mother.s1.root-bearing'] as const;
export const NATURE_WALKER_INHERITED_ABILITY_IDS = [...CULTIVATOR_ABILITY_IDS, ...PHYSICIAN_ABILITY_IDS, ...HARVESTPRIEST_ABILITY_IDS, ...BIOLOGIST_ABILITY_IDS, ...DRUID_ABILITY_IDS, ...ANCIENT_ALCHEMIST_ABILITY_IDS, ...COFFIN_BEARER_ABILITY_IDS, ...BARREN_MATRIARCH_ABILITY_IDS] as const;
export type NatureWalkerAbilityId = typeof NATURE_WALKER_ABILITY_IDS[number];
export const NATURE_WALKER_PREPARATION_IDS = ['VERIFY_ORIGINALS', 'CHECK_LIMITS', 'CHECK_RETURN'] as const;
export type NatureWalkerPreparationId = typeof NATURE_WALKER_PREPARATION_IDS[number];
export type NatureWalkerAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: NatureWalkerPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type NatureWalkerCommand = NatureWalkerAcquisitionCommand | NatureWalkerActivityCommand | NatureWalkerEncounterCommand;
export interface NatureWalkerBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface NatureWalkerPrices { guidance: number; potion: number; labourCredit: number; labourBalance: number; preparation: number; resupply: number }
export type NatureWalkerFinance = Pick<SliceState, 'weeklyBudget' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface NatureWalkerAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  gender: string; sequence: 2 | 1; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number;
}
export interface NatureWalkerAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: NatureWalkerAcquisitionCommand;
  actor: { name: string; gender: string; age: number; sourceHistoryDigest: string | null; sourceIdentityDigest: string; pathwayId: 'mother'; barrenMatriarchPromotionWeek: number; cultivatorPromotionWeek: number };
  before: NatureWalkerAcquisitionBudget; after: NatureWalkerAcquisitionBudget; finance: NatureWalkerFinance;
  cursorBefore: number; cursorAfter: number; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
}
export const NATURE_WALKER_SOURCE_KEYS = ['cultivator', 'physician', 'harvestpriest', 'biologist', 'druid', 'ancientAlchemist', 'coffinBearer', 'barrenMatriarch'] as const;
export type NatureWalkerSourceHistory = Pick<SliceState, typeof NATURE_WALKER_SOURCE_KEYS[number]>;
/** Evidence only. Mutable continuations live in the new life and encounter roots. */
export interface NatureWalkerOriginals {
  site: BarrenMatriarchSceneRoot; operation: BarrenMatriarchOperationState; rootPad: BarrenMatriarchRootPad;
}
export type NatureWalkerSourceOriginals = NatureWalkerOriginals;
export interface NatureWalkerSourceScene {
  week: number; date: PublicGameDate; revision: number; random: SliceState['random'];
  budget: NatureWalkerAcquisitionBudget; finance: NatureWalkerFinance; identityDigest: string; historyDigest: string;
  character: SliceState['character']; originals: NatureWalkerOriginals;
  combatHistoryLength: number; combatHistoryDigest: string; city: 'BACKLUND';
}
export interface NatureWalkerState {
  guidanceKnown: boolean; sourceWeek: number | null; bottles: NatureWalkerBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; barrenMatriarchActingAtPromotion: number | null;
  preparations: { taskId: NatureWalkerPreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: NatureWalkerAcquisitionEvent[];
  /** Eight immutable predecessor roots; live people, inventory and body continue in the new root only. */
  sourceHistory: NatureWalkerSourceHistory | null; sourceScene: NatureWalkerSourceScene | null;
  life: NatureWalkerLifeState; encounter: NatureWalkerEncounterState;
}
export interface NatureWalkerAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: NatureWalkerCommand; cleanup?: boolean; preferredAction?: boolean;
}
export interface NatureWalkerProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  sourceLabel: string; prices: NatureWalkerPrices | null;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: NatureWalkerAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: NatureWalkerAcquisitionCommand }[];
  preparations: { taskId: NatureWalkerPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  characterName: string; currentGender: string; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  life: NatureWalkerLifeProjection; encounter: NatureWalkerEncounterProjection;
  insideCase: boolean; environment: string;
}
export type NatureWalkerPublicView = NatureWalkerProjection;
export type { NatureWalkerActivityCommand, NatureWalkerLifeProjection, NatureWalkerLifeState } from './life.js';
export type { NatureWalkerEncounterCommand, NatureWalkerEncounterProjection, NatureWalkerEncounterState } from './encounter.js';
