import type { PublicResolutionTier } from '../../shared/contracts.js';

export const CRIMINAL_ABILITY_IDS = ['abyss.s9.brute-force', 'abyss.s9.alertness', 'abyss.s9.illicit-insight'] as const;
export type CriminalAbilityId = typeof CRIMINAL_ABILITY_IDS[number];
export const CRIMINAL_CASE_IDS = ['found-pay', 'hasty-job', 'jammed-cart'] as const;
export type CriminalCaseId = typeof CRIMINAL_CASE_IDS[number];
export type CriminalAcquisitionCommand =
  | { type: 'DISCOVER' }
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type CriminalActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' | 'TAKE' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'RETURN'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type CriminalCommand = CriminalAcquisitionCommand | CriminalActivityCommand;

/** Individually sealed finished originals; the complete formula is not verified. */
export interface CriminalBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface CriminalCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | 'TAKE' | null;
  withdrawals: number;
  outcome: 'NONE' | 'PAY_RETURNED' | 'JOB_DECLINED' | 'CART_CLEARED';
  holding: boolean;
  tookOriginal: boolean;
  returns: number;
}
export interface CriminalState {
  discovered: boolean; guidanceKnown: boolean;
  bottles: CriminalBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  cases: Record<string, CriminalCaseState>;
  reflected: boolean;
}
export interface CriminalAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: CriminalCommand;
}
export interface CriminalCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  holding: string; tookOriginal: boolean; returns: number;
}
export interface CriminalProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: CriminalAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: CriminalCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: CriminalCaseProjection[];
  insideCase: boolean;
  environment: string;
}
