import type { PublicResolutionTier } from '../../shared/contracts.js';

export const LAWYER_ABILITY_IDS = ['black-emperor.s9.rule-analysis', 'black-emperor.s9.persuasive-argument', 'black-emperor.s9.weak-point-insight'] as const;
export type LawyerAbilityId = typeof LAWYER_ABILITY_IDS[number];
export const LAWYER_CASE_IDS = ['ambiguous-delivery', 'duplicated-receipt', 'closing-counter'] as const;
export type LawyerCaseId = typeof LAWYER_CASE_IDS[number];
export type LawyerAcquisitionCommand =
  | { type: 'DISCOVER' }
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type LawyerActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ARGUMENT' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type LawyerCommand = LawyerAcquisitionCommand | LawyerActivityCommand;

/** Individually sealed finished originals; the complete formula is not verified. */
export interface LawyerBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface LawyerCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ARGUMENT' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'TERMS_COMPARED' | 'RECEIPT_MATCHED' | 'EXIT_AGREED';
  contactOpen: boolean;
  closes: number;
}
export interface LawyerState {
  discovered: boolean; guidanceKnown: boolean;
  bottles: LawyerBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  cases: Record<string, LawyerCaseState>;
  reflected: boolean;
}
export interface LawyerAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: LawyerCommand;
}
export interface LawyerCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number;
}
export interface LawyerProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: LawyerAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: LawyerCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: LawyerCaseProjection[];
  insideCase: boolean;
  environment: string;
}
