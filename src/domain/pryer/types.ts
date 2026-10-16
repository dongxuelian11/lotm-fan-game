import type { PublicResolutionTier } from '../../shared/contracts.js';

export const PRYER_ABILITY_IDS = ['hermit.s9.spirit-vision', 'hermit.s9.ritual-lore', 'hermit.s9.occult-study'] as const;
export type PryerAbilityId = typeof PRYER_ABILITY_IDS[number];
export const PRYER_CASE_IDS = ['margin-copy', 'aura-lantern', 'prepared-ritual', 'intrusive-page'] as const;
export type PryerCaseId = typeof PRYER_CASE_IDS[number];
export type PryerAcquisitionCommand =
  | { type: 'DISCOVER' }
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type PryerActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'MYSTIC' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string; claim: 'LIMITED' | 'COMPLETE' }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type PryerCommand = PryerAcquisitionCommand | PryerActivityCommand;

/** Individually sealed finished originals; the complete formula is not verified. */
export interface PryerBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface PryerCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'MYSTIC' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'MARGIN_COMPARED' | 'AURA_NOTED' | 'RITUAL_CHECKED' | 'PAGE_NOTED';
  readingOpen: boolean;
  overclaims: number;
}
export interface PryerState {
  discovered: boolean; guidanceKnown: boolean;
  bottles: PryerBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  cases: Record<string, PryerCaseState>;
  reflected: boolean;
}
export interface PryerAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: PryerCommand;
}
export interface PryerCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  readingOpen: string; overclaims: number;
}
export interface PryerProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: PryerAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: PryerCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: PryerCaseProjection[];
  insideCase: boolean;
  environment: string;
}
