import type { PublicResolutionTier } from '../../shared/contracts.js';

export const ARBITER_ABILITY_IDS = ['justiciar.s9.authority', 'justiciar.s9.persuasive-charisma', 'justiciar.s9.combat-training'] as const;
export type ArbiterAbilityId = typeof ARBITER_ABILITY_IDS[number];
export const ARBITER_CASE_IDS = ['shared-yard', 'noisy-work', 'exit-dispute'] as const;
export type ArbiterCaseId = typeof ARBITER_CASE_IDS[number];
export type ArbiterAcquisitionCommand =
  | { type: 'DISCOVER' }
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type ArbiterActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'AUTHORITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type ArbiterCommand = ArbiterAcquisitionCommand | ArbiterActivityCommand;

/** Individually sealed finished originals; the complete formula is not verified. */
export interface ArbiterBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface ArbiterCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'AUTHORITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'TURN_AGREED' | 'VOLUME_AGREED' | 'PASSAGE_AGREED';
  contactOpen: boolean;
  closes: number;
}
export interface ArbiterState {
  discovered: boolean; guidanceKnown: boolean;
  bottles: ArbiterBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  cases: Record<string, ArbiterCaseState>;
  reflected: boolean;
}
export interface ArbiterAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ArbiterCommand;
}
export interface ArbiterCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number;
}
export interface ArbiterProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: ArbiterAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ArbiterCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: ArbiterCaseProjection[];
  insideCase: boolean;
  environment: string;
}
