import type { PublicResolutionTier } from '../../shared/contracts.js';

export const GRAVEDIGGER_ABILITY_IDS = [
  'death.s8.death-eye', 'death.s8.spirit-contact',
] as const;
export type GravediggerAbilityId = typeof GRAVEDIGGER_ABILITY_IDS[number];
export const GRAVEDIGGER_CASE_IDS = ['bone-watch', 'nearby-echo', 'grave-path'] as const;
export type GravediggerCaseId = typeof GRAVEDIGGER_CASE_IDS[number];
export type GravediggerAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type GravediggerActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'SPIRIT' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'REPORT'; caseId: string; conclusion: 'LIMITED' | 'COMMAND' }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type GravediggerCommand = GravediggerAcquisitionCommand | GravediggerActivityCommand;

/** Finished, individually sealed originals; no invented ingredient or brewing route. */
export interface GravediggerBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface GravediggerCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'SPIRIT' | 'ORDINARY' | null;
  mistakes: number;
  conclusion: 'LIMITED' | 'COMMAND' | null;
  withdrawals: number;
}
export interface GravediggerState {
  guidanceKnown: boolean;
  bottles: GravediggerBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  corpsecollectorActingAtPromotion: number | null;
  cases: Record<string, GravediggerCaseState>;
  reflected: boolean;
}
export interface GravediggerAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: GravediggerCommand;
}
export interface GravediggerCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
}
export interface GravediggerProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: GravediggerAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: GravediggerCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: GravediggerCaseProjection[];
  environment: string;
}
