import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { ApocalypseDemonessOriginals, ApocalypseDemonessActivityCommand, ApocalypseDemonessLifeProjection, ApocalypseDemonessLifeState } from './life.js';
import type { ApocalypseDemonessEncounterCommand, ApocalypseDemonessEncounterProjection, ApocalypseDemonessEncounterState } from './encounter.js';

export const APOCALYPSE_DEMONESS_ABILITY_IDS = ['assassin.s1.pulse-containment', 'assassin.s1.mirror-buffer'] as const;
export type ApocalypseDemonessAbilityId = typeof APOCALYPSE_DEMONESS_ABILITY_IDS[number];
export const APOCALYPSE_DEMONESS_PREPARATION_IDS = ['VERIFY_ORIGINALS', 'PLAN_CONTAINMENT', 'CHECK_RETURN'] as const;
export type ApocalypseDemonessPreparationId = typeof APOCALYPSE_DEMONESS_PREPARATION_IDS[number];
export type ApocalypseDemonessAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: ApocalypseDemonessPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type ApocalypseDemonessCommand = ApocalypseDemonessAcquisitionCommand | ApocalypseDemonessActivityCommand | ApocalypseDemonessEncounterCommand;
export interface ApocalypseDemonessBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
/** Bounded acquisition evidence; inherited people, bodies, effects and inventory stay in their source history. */
export interface ApocalypseDemonessAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  gender: string; sequence: 2 | 1; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number;
}
export type ApocalypseDemonessFinanceSnapshot = Pick<SliceState, 'weeklyBudget' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface ApocalypseDemonessAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: ApocalypseDemonessAcquisitionCommand;
  actor: { name: string; gender: string; age: number; sourceHistoryDigest: string | null; sourceIdentityDigest: string; pathwayId: 'demoness'; calamityDemonessPromotionWeek: number; assassinPromotionWeek: number };
  before: ApocalypseDemonessAcquisitionBudget; after: ApocalypseDemonessAcquisitionBudget; finance: ApocalypseDemonessFinanceSnapshot;
  cursorBefore: number; cursorAfter: number; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
}
export const APOCALYPSE_DEMONESS_SOURCE_KEYS = ['assassin', 'instigator', 'witch', 'pleasure', 'pain', 'despair', 'unagingDemoness', 'calamityDemoness'] as const;
export type ApocalypseDemonessSourceHistory = Pick<SliceState, typeof APOCALYPSE_DEMONESS_SOURCE_KEYS[number]>;
export type { ApocalypseDemonessOriginals } from './life.js';
export interface ApocalypseDemonessSourceScene {
  week: number; date: PublicGameDate; revision: number; random: SliceState['random'];
  budget: ApocalypseDemonessAcquisitionBudget; finance: ApocalypseDemonessFinanceSnapshot; identityDigest: string; historyDigest: string;
  character: SliceState['character']; originals: ApocalypseDemonessOriginals;
  combatHistoryLength: number; combatHistoryDigest: string; city: 'BACKLUND';
}
export interface ApocalypseDemonessState {
  guidanceKnown: boolean; bottles: ApocalypseDemonessBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; calamityDemonessActingAtPromotion: number | null;
  preparations: { taskId: ApocalypseDemonessPreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: ApocalypseDemonessAcquisitionEvent[];
  /** Single frozen eight-root history. The new life owns the sole continuing live scene; these roots never evolve. */
  sourceHistory: ApocalypseDemonessSourceHistory | null; sourceScene: ApocalypseDemonessSourceScene | null;
  life: ApocalypseDemonessLifeState; encounter: ApocalypseDemonessEncounterState;
}
export interface ApocalypseDemonessAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ApocalypseDemonessCommand; cleanup?: boolean; preferredAction?: boolean;
}
export interface ApocalypseDemonessProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: ApocalypseDemonessAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ApocalypseDemonessAcquisitionCommand }[];
  preparations: { taskId: ApocalypseDemonessPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  characterName: string; currentGender: string; originalGender: string | null; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  life: ApocalypseDemonessLifeProjection; encounter: ApocalypseDemonessEncounterProjection;
  insideCase: boolean; environment: string;
}
export type ApocalypseDemonessPublicView = ApocalypseDemonessProjection;
export type { ApocalypseDemonessActivityCommand, ApocalypseDemonessLifeProjection, ApocalypseDemonessLifeState } from './life.js';
export type { ApocalypseDemonessEncounterCommand, ApocalypseDemonessEncounterProjection, ApocalypseDemonessEncounterState } from './encounter.js';
