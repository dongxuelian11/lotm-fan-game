import type { PublicResolutionTier } from '../../shared/contracts.js';

/** Eloquence and planning are uses of the same sourced S8 deceit ability. */
export const SWINDLER_ABILITY_IDS = ['error.s8.deceit'] as const;
export type SwindlerAbilityId = typeof SWINDLER_ABILITY_IDS[number];
export const SWINDLER_CASE_IDS = ['rehearsed-message', 'false-claim', 'marked-decoy'] as const;
export type SwindlerCaseId = typeof SWINDLER_CASE_IDS[number];

export type SwindlerAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type SwindlerActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'MISDIRECT' | 'PLAIN' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'DISCLOSE'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type SwindlerInheritedCommand = { type: 'RETURN_TOOL' };
export type SwindlerCommand = SwindlerAcquisitionCommand | SwindlerActivityCommand | SwindlerInheritedCommand;

/** Individually sealed S8 finished originals, independent of the existing S9 supply. */
export interface SwindlerBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface SwindlerCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'MISDIRECT' | 'PLAIN' | null;
  withdrawals: number;
  outcome: 'NONE' | 'NOTICE_SHIFTED' | 'CLAIM_RECHECKED' | 'DECOY_RECOGNIZED';
}
export interface SwindlerState {
  guidanceKnown: boolean;
  bottles: SwindlerBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  marauderActingAtPromotion: number | null;
  cases: Record<string, SwindlerCaseState>;
  reflected: boolean;
}
export interface SwindlerAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SwindlerCommand;
}
export interface SwindlerCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
}
export interface SwindlerProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  /** Finished-potion guidance does not reveal an unverified formula. */
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  story?: string;
  supplies: string;
  actions: SwindlerAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: SwindlerCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: SwindlerCaseProjection[];
  environment: string;
}
