import type { PublicResolutionTier } from '../../shared/contracts.js';

/** Original G training category; the verified novel citation confirms only the sequence name. */
export const COMBAT_SCHOLAR_ABILITY_IDS = ['hermit.s8.combat-study'] as const;
export type CombatScholarAbilityId = typeof COMBAT_SCHOLAR_ABILITY_IDS[number];
export const COMBAT_SCHOLAR_CASE_IDS = ['counter-study', 'changed-passage', 'halted-exercise'] as const;
export type CombatScholarCaseId = typeof COMBAT_SCHOLAR_CASE_IDS[number];
export type CombatScholarAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type CombatScholarActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'OBSERVED' | 'MEMORIZED' | 'TEAM' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'STOP'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type CombatScholarCommand = CombatScholarAcquisitionCommand | CombatScholarActivityCommand;

/** Individually sealed S8 originals, independent of the original Pryer bottles. */
export interface CombatScholarBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface CombatScholarCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'OBSERVED' | 'MEMORIZED' | 'TEAM' | null;
  withdrawals: number;
  outcome: 'NONE' | 'CUE_CHECKED' | 'PASSAGE_CHECKED' | 'EXERCISE_CHECKED';
  exerciseOpen: boolean;
}
export interface CombatScholarState {
  guidanceKnown: boolean;
  bottles: CombatScholarBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  pryerActingAtPromotion: number | null;
  cases: Record<string, CombatScholarCaseState>;
  reflected: boolean;
}
export interface CombatScholarAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: CombatScholarCommand;
}
export interface CombatScholarCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  exerciseOpen: string;
}
export interface CombatScholarProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: CombatScholarAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: CombatScholarCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: CombatScholarCaseProjection[];
  insideCase: boolean;
  environment: string;
}
