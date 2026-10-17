import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { ElderActivityCommand, ElderLifeProjection, ElderLifeState } from './life.js';
import type { ElderEncounterCommand, ElderEncounterProjection, ElderEncounterState } from './encounter.js';

export const ELDER_ABILITY_IDS = ['hanged-man.s2.low-whisper', 'hanged-man.s2.focused-chorus'] as const;
export type ElderAbilityId = typeof ELDER_ABILITY_IDS[number];
export const ELDER_PREPARATION_IDS = ['REVIEW_RECORDS', 'CHECK_LIMITS', 'MARK_EXIT'] as const;
export type ElderPreparationId = typeof ELDER_PREPARATION_IDS[number];
export type ElderAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: ElderPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type ElderCommand = ElderAcquisitionCommand | ElderActivityCommand | ElderEncounterCommand;
export interface ElderBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
/** Bounded acquisition evidence; inherited people, bodies, spirits and inventory stay in their source history. */
export interface ElderAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  sequence: 3 | 2; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number;
}
export interface ElderAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: ElderAcquisitionCommand;
  actor: { name: string; gender: string; pathwayId: 'hanged-man'; threeHeadedTemplarPromotionWeek: number; secretSupplicantPromotionWeek: number };
  before: ElderAcquisitionBudget; after: ElderAcquisitionBudget;
  randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
}
export interface ElderState {
  guidanceKnown: boolean; bottles: ElderBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; threeHeadedTemplarActingAtPromotion: number | null;
  preparations: { taskId: ElderPreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: ElderAcquisitionEvent[];
  life: ElderLifeState; encounter: ElderEncounterState;
}
export interface ElderAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ElderCommand;
}
export interface ElderProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: ElderAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ElderAcquisitionCommand }[];
  preparations: { taskId: ElderPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  life: ElderLifeProjection; encounter: ElderEncounterProjection;
  insideCase: boolean; environment: string;
}
export type ElderPublicView = ElderProjection;
export type { ElderActivityCommand, ElderLifeProjection, ElderLifeState } from './life.js';
export type { ElderEncounterCommand, ElderEncounterProjection, ElderEncounterState } from './encounter.js';

