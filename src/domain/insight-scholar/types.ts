import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { InsightScholarActivityCommand, InsightScholarLifeProjection, InsightScholarLifeState } from './life.js';
import type { InsightScholarEncounterCommand, InsightScholarEncounterProjection, InsightScholarEncounterState } from './encounter.js';

export const INSIGHT_SCHOLAR_ABILITY_IDS = ['reader.s3.evidence-link', 'reader.s3.method-analysis'] as const;
export type InsightScholarAbilityId = typeof INSIGHT_SCHOLAR_ABILITY_IDS[number];
export const INSIGHT_SCHOLAR_PREPARATION_IDS = ['CHECK_RECORDS', 'COMPARE_METHODS', 'PLAN_EXIT'] as const;
export type InsightScholarPreparationId = typeof INSIGHT_SCHOLAR_PREPARATION_IDS[number];
export type InsightScholarAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: InsightScholarPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type InsightScholarCommand = InsightScholarAcquisitionCommand | InsightScholarActivityCommand | InsightScholarEncounterCommand | { type: 'MAKE_INHERITED_FLASH' };
export interface InsightScholarBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface InsightScholarState {
  guidanceKnown: boolean; bottles: InsightScholarBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; prophetActingAtPromotion: number | null;
  preparations: { taskId: InsightScholarPreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  life: InsightScholarLifeState; encounter: InsightScholarEncounterState;
}
export interface InsightScholarAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: InsightScholarCommand;
}
export interface InsightScholarProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: InsightScholarAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: InsightScholarAcquisitionCommand }[];
  preparations: { taskId: InsightScholarPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; inheritedHistory: string[];
  life: InsightScholarLifeProjection; encounter: InsightScholarEncounterProjection;
  insideCase: boolean; environment: string;
}
export type InsightScholarPublicView = InsightScholarProjection;
