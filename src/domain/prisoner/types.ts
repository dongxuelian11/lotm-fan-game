import type { PublicResolutionTier } from '../../shared/contracts.js';

export const PRISONER_ABILITY_IDS = ['chained.s9.prisoner-body', 'chained.s9.keen-perception', 'chained.s9.improvised-combat'] as const;
export type PrisonerAbilityId = typeof PRISONER_ABILITY_IDS[number];
export const PRISONER_CASE_IDS = ['jammed-shutter', 'echo-room', 'shared-exit'] as const;
export type PrisonerCaseId = typeof PRISONER_CASE_IDS[number];
export type PrisonerAcquisitionCommand =
  | { type: 'DISCOVER' }
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type PrisonerActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'RETURN'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type PrisonerCommand = PrisonerAcquisitionCommand | PrisonerActivityCommand;

/** Individually sealed finished originals; the complete formula is not verified. */
export interface PrisonerBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface PrisonerCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'SHUTTER_STEADIED' | 'DRAFT_IDENTIFIED' | 'EXIT_SHARED';
  holding: boolean;
  returns: number;
}
export interface PrisonerState {
  discovered: boolean; guidanceKnown: boolean;
  bottles: PrisonerBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  cases: Record<string, PrisonerCaseState>;
  reflected: boolean;
}
export interface PrisonerAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: PrisonerCommand;
}
export interface PrisonerCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  holding: string; returns: number;
}
export interface PrisonerProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: PrisonerAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: PrisonerCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: PrisonerCaseProjection[];
  insideCase: boolean;
  environment: string;
}
