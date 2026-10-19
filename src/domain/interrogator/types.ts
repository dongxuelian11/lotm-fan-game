import type { PublicResolutionTier } from '../../shared/contracts.js';

/** B2 ch17, B5 ch4 and B3 ch100: mental pressure and resistible, dodgeable mental puncture. */
export const INTERROGATOR_ABILITY_IDS = ['justiciar.s7.mental-puncture', 'justiciar.s7.mental-pressure'] as const;
export type InterrogatorAbilityId = typeof INTERROGATOR_ABILITY_IDS[number];
export const INTERROGATOR_CASE_IDS = ['fragment-account', 'conflicting-delivery', 'withdrawn-interview'] as const;
export type InterrogatorCaseId = typeof INTERROGATOR_CASE_IDS[number];
export type InterrogatorAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type InterrogatorActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type InterrogatorCommand = InterrogatorAcquisitionCommand | InterrogatorActivityCommand;

/** Individually sealed S7 originals, never converted from Arbiter or Sheriff stock. */
export interface InterrogatorBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface InterrogatorCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'ACCOUNT_BOUNDED' | 'CONTRADICTION_RECHECKED' | 'WITHDRAWAL_RESPECTED';
  contactOpen: boolean;
  closes: number;
}
export interface InterrogatorState {
  guidanceKnown: boolean;
  bottles: InterrogatorBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  sheriffActingAtPromotion: number | null;
  cases: Record<string, InterrogatorCaseState>;
  reflected: boolean;
}
export interface InterrogatorAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: InterrogatorCommand;
}
export interface InterrogatorCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string;
  closes: number;
}
export interface InterrogatorProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: InterrogatorAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: InterrogatorCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: InterrogatorCaseProjection[];
  insideCase: boolean;
  environment: string;
}
