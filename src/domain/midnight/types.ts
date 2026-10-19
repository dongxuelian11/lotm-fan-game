import type { PublicResolutionTier } from '../../shared/contracts.js';

export const MIDNIGHT_ABILITY_IDS = [
  'darkness.s8.poetry',
  'darkness.s8.physical-training',
] as const;
export type MidnightAbilityId = typeof MIDNIGHT_ABILITY_IDS[number];
export const MIDNIGHT_CASE_IDS = ['sleepless-patient', 'nervous-courier', 'noisy-lodging'] as const;
export type MidnightCaseId = typeof MIDNIGHT_CASE_IDS[number];

export type MidnightAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type MidnightActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string }
  | { type: 'PERFORM'; caseId: string; method: 'POEM' | 'TALK' }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'OBSERVE_ENCOUNTER' }
  | { type: 'CLEAR_BYSTANDER' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type MidnightCommand = MidnightAcquisitionCommand | MidnightActivityCommand;

/** Individually sealed S8 originals, independent of the existing S9 supply. */
export interface MidnightBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface MidnightCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'RESOLVED' | 'WITHDRAWN';
  attemptWeek: number | null;
  method: 'POEM' | 'TALK' | null;
}
export interface MidnightState {
  guidanceKnown: boolean;
  bottles: MidnightBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  sleeplessActingAtPromotion: number | null;
  cases: Record<string, MidnightCaseState>;
  reflected: boolean;
  encounter: {
    status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
    observed: boolean; bystanderCleared: boolean;
    attemptWeek: number | null; startHistoryIndex: number | null;
  };
}
export interface MidnightAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: MidnightCommand;
}
export interface MidnightCaseProjection {
  id: string; title: string; story: string; observations: string[]; result: string | null; status: string;
}
export interface MidnightProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  /** Finished-potion guidance does not reveal an unverified formula. */
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  story?: string;
  supplies: string;
  actions: MidnightAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: MidnightCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: MidnightCaseProjection[];
  environment: string;
}
