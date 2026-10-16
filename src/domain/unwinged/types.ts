import type { PublicResolutionTier } from '../../shared/contracts.js';

/** B2 ch45 supports further inhuman physical change; named S8 spells remain unverified. */
export const UNWINGED_ABILITY_IDS = ['abyss.s8.inhuman-body'] as const;
export type UnwingedAbilityId = typeof UNWINGED_ABILITY_IDS[number];
export const UNWINGED_CASE_IDS = ['cold-grip', 'refused-price', 'false-claim'] as const;
export type UnwingedCaseId = typeof UNWINGED_CASE_IDS[number];
export type UnwingedAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true; acceptedChange: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type UnwingedActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'BODY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'STAND_DOWN'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type UnwingedCommand = UnwingedAcquisitionCommand | UnwingedActivityCommand;

/** Individually sealed S8 originals, never converted from earlier Criminal stock. */
export interface UnwingedBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface UnwingedCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'BODY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'GRIP_RELEASED' | 'REFUSAL_ACCEPTED' | 'CLAIM_CORRECTED';
  urgeOpen: boolean;
  restraints: number;
}
export interface UnwingedState {
  guidanceKnown: boolean;
  bottles: UnwingedBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  criminalActingAtPromotion: number | null;
  conscienceLost: boolean;
  cases: Record<string, UnwingedCaseState>;
  reflected: boolean;
}
export interface UnwingedAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: UnwingedCommand;
}
export interface UnwingedCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  urgeOpen: string;
  restraints: number;
}
export interface UnwingedProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  conscienceLost: boolean;
  changeWarning: string;
  actions: UnwingedAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: UnwingedCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: UnwingedCaseProjection[];
  insideCase: boolean;
  environment: string;
}
