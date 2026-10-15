import type { PublicResolutionTier } from '../../shared/contracts.js';

/** B2 ch118: chosen sacrifice of current reason, and resistance to some mental interference. */
export const MADMAN_ABILITY_IDS = ['chained.s8.reason-sacrifice', 'chained.s8.mental-resistance'] as const;
export type MadmanAbilityId = typeof MADMAN_ABILITY_IDS[number];
export const MADMAN_CASE_IDS = ['stop-bell', 'weighted-gate', 'taunting-note'] as const;
export type MadmanCaseId = typeof MADMAN_CASE_IDS[number];
export type MadmanAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type MadmanActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'BURST' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'STOP'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type MadmanCommand = MadmanAcquisitionCommand | MadmanActivityCommand;

/** Individually sealed S8 originals, never converted from earlier Prisoner stock. */
export interface MadmanBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface MadmanCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'BURST' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'STOP_HEEDED' | 'GATE_RELEASED' | 'NOTE_SET_ASIDE';
  burstOpen: boolean;
  stops: number;
  burstUses: number;
}
export interface MadmanState {
  guidanceKnown: boolean;
  bottles: MadmanBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  prisonerActingAtPromotion: number | null;
  cases: Record<string, MadmanCaseState>;
  reflected: boolean;
}
export interface MadmanAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: MadmanCommand;
}
export interface MadmanCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  burstOpen: string;
  stops: number;
  burstUses: number;
}
export interface MadmanProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: MadmanAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: MadmanCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: MadmanCaseProjection[];
  insideCase: boolean;
  environment: string;
}
