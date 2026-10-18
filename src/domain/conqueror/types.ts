import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { WeatherWarlockState } from '../weather-warlock/types.js';
import type { SliceState } from '../slice/types.js';
import type { ConquerorActivityCommand, ConquerorLifeProjection, ConquerorLifeState } from './life.js';
import type { ConquerorEncounterCommand, ConquerorEncounterProjection, ConquerorEncounterState } from './encounter.js';

export const CONQUEROR_ABILITY_IDS = ['hunter.s1.formation-momentum', 'hunter.s1.focused-flame'] as const;
export type ConquerorAbilityId = typeof CONQUEROR_ABILITY_IDS[number];
export const CONQUEROR_PREPARATION_IDS = ['REVIEW_RECORDS', 'CHECK_LIMITS', 'MARK_EXIT'] as const;
export type ConquerorPreparationId = typeof CONQUEROR_PREPARATION_IDS[number];
export type ConquerorAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: ConquerorPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type ConquerorCommand = ConquerorAcquisitionCommand | ConquerorActivityCommand | ConquerorEncounterCommand;
export interface ConquerorBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
/** Bounded acquisition evidence; inherited people, bodies, effects and inventory stay in their source history. */
export interface ConquerorAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  gender: string; sequence: 2 | 1; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number;
}
export interface ConquerorAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: ConquerorAcquisitionCommand;
  actor: { name: string; gender: string; age: number; sourceTeamDigest: string | null; sourceHistoryDigest: string | null; pathwayId: 'hunter'; weatherWarlockPromotionWeek: number; hunterPromotionWeek: number };
  before: ConquerorAcquisitionBudget; after: ConquerorAcquisitionBudget;
  randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
}
export interface ConquerorState {
  guidanceKnown: boolean; bottles: ConquerorBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; weatherWarlockActingAtPromotion: number | null;
  preparations: { taskId: ConquerorPreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: ConquerorAcquisitionEvent[];
  /** Frozen prior-stage root, captured only by the first actual guidance command. */
  sourceWeatherWarlock: WeatherWarlockState | null;
  life: ConquerorLifeState; encounter: ConquerorEncounterState;
}
export interface ConquerorAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ConquerorCommand; cleanup?: boolean; preferredAction?: boolean;
}
export interface ConquerorProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: ConquerorAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ConquerorAcquisitionCommand }[];
  preparations: { taskId: ConquerorPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  currentGender: string; originalGender: string | null; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  life: ConquerorLifeProjection; encounter: ConquerorEncounterProjection;
  insideCase: boolean; environment: string;
}
export type ConquerorPublicView = ConquerorProjection;
export type { ConquerorActivityCommand, ConquerorLifeProjection, ConquerorLifeState } from './life.js';
export type { ConquerorEncounterCommand, ConquerorEncounterProjection, ConquerorEncounterState } from './encounter.js';
