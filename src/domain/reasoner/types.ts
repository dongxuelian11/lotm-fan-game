import type { PublicResolutionTier } from '../../shared/contracts.js';

export const REASONER_ABILITY_IDS = [
  'reader.s8.observation',
  'reader.s8.deduction',
  'reader.s8.ritual-specialism',
] as const;
export type ReasonerAbilityId = typeof REASONER_ABILITY_IDS[number];
export const REASONER_CASE_IDS = ['stair-footprints', 'swapped-invoice', 'broken-window'] as const;
export type ReasonerCaseId = typeof REASONER_CASE_IDS[number];

export type ReasonerAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type ReasonerActivityCommand =
  | { type: 'EXAMINE'; caseId: string }
  | { type: 'TEST'; caseId: string; testId: string }
  | { type: 'CONCLUDE'; caseId: string; conclusion: string }
  | { type: 'REFLECT' };
export type ReasonerCommand = ReasonerAcquisitionCommand | ReasonerActivityCommand;

/** Individually sealed S8 originals, independent of existing reader supply. */
export interface ReasonerBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface ReasonerCaseState {
  status: 'AVAILABLE' | 'EXAMINED' | 'TESTED' | 'RESOLVED';
  attemptWeek: number | null;
  testId: string | null;
  conclusion: string | null;
  mistakes: number;
}
export interface ReasonerState {
  guidanceKnown: boolean;
  bottles: ReasonerBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  readerActingAtPromotion: number | null;
  cases: Record<string, ReasonerCaseState>;
  reflected: boolean;
}
export interface ReasonerAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ReasonerCommand;
}
export interface ReasonerCaseProjection {
  id: string; title: string; story: string; observations: string[]; hypotheses: string[];
  testResult: string | null; result: string | null; status: string;
}
export interface ReasonerProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  /** Finished-potion guidance does not reveal an unverified formula. */
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  story?: string;
  supplies: string;
  actions: ReasonerAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ReasonerCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: ReasonerCaseProjection[];
  environment: string;
}
