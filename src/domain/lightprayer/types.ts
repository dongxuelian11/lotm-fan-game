import type { PublicResolutionTier } from '../../shared/contracts.js';

export const LIGHTPRAYER_ABILITY_IDS = ['sun.s8.light', 'sun.s8.solar-flame', 'sun.s8.ritual'] as const;
export type LightprayerAbilityId = typeof LIGHTPRAYER_ABILITY_IDS[number];
export const LIGHTPRAYER_CASE_IDS = ['shaded-label', 'wick-lighting', 'storehouse-echo'] as const;
export type LightprayerCaseId = typeof LIGHTPRAYER_CASE_IDS[number];

export type LightprayerAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type LightprayerActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'LIGHT' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type LightprayerCommand = LightprayerAcquisitionCommand | LightprayerActivityCommand;

/** Individually sealed S8 originals, separate from the bard supply. */
export interface LightprayerBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface LightprayerCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'LIGHT' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'VERIFIED' | 'LIT' | 'QUIET' | 'REFERRED';
}
export interface LightprayerState {
  guidanceKnown: boolean;
  bottles: LightprayerBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  bardActingAtPromotion: number | null;
  cases: Record<string, LightprayerCaseState>;
  reflected: boolean;
}
export interface LightprayerAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: LightprayerCommand;
}
export interface LightprayerCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
}
export interface LightprayerProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  /** Finished-potion guidance never invents the unverified complete recipe. */
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  story?: string;
  supplies: string;
  actions: LightprayerAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: LightprayerCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: LightprayerCaseProjection[];
  environment: string;
}
