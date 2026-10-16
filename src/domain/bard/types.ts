import type { PublicResolutionTier } from '../../shared/contracts.js';

export const BARD_ABILITY_IDS = [
  'sun.s9.praise', 'sun.s9.courage',
] as const;
export type BardAbilityId = typeof BARD_ABILITY_IDS[number];
export const BARD_CASE_IDS = ['newcomer-reading', 'troubled-carrier', 'evening-shift'] as const;
export type BardCaseId = typeof BARD_CASE_IDS[number];
export type BardAcquisitionCommand =
  | { type: 'DISCOVER' }
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type BardActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'AGREE'; caseId: string; mode: 'SONG' | 'TALK' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type BardCommand = BardAcquisitionCommand | BardActivityCommand;

/** Finished, individually sealed originals; no invented ingredient or brewing route. */
export interface BardBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface BardCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'AGREED' | 'RESOLVED';
  attemptWeek: number | null;
  mode: 'SONG' | 'TALK' | null;
  consent: boolean;
  withdrawals: number;
}
export interface BardState {
  discovered: boolean; guidanceKnown: boolean;
  bottles: BardBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  cases: Record<string, BardCaseState>;
  reflected: boolean;
}
export interface BardAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: BardCommand;
}
export interface BardCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
}
export interface BardProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: BardAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: BardCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: BardCaseProjection[];
  environment: string;
}
