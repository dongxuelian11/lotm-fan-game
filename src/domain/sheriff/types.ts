import type { PublicResolutionTier } from '../../shared/contracts.js';

/** B4 ch31/126; B5 ch53: image reconstruction and bounded sensing/tracking. */
export const SHERIFF_ABILITY_IDS = ['justiciar.s8.trace-sensing', 'justiciar.s8.image-reconstruction'] as const;
export type SheriffAbilityId = typeof SHERIFF_ABILITY_IDS[number];
export const SHERIFF_CASE_IDS = ['remembered-face', 'shielded-box', 'known-route'] as const;
export type SheriffCaseId = typeof SHERIFF_CASE_IDS[number];
export type SheriffAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type SheriffActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type SheriffCommand = SheriffAcquisitionCommand | SheriffActivityCommand;

/** Individually sealed S8 originals, never converted from earlier Arbiter stock. */
export interface SheriffBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface SheriffCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'PORTRAIT_RECORDED' | 'LIMIT_RECORDED' | 'ROUTE_RECHECKED';
  contactOpen: boolean;
  closes: number;
}
export interface SheriffState {
  guidanceKnown: boolean;
  bottles: SheriffBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  arbiterActingAtPromotion: number | null;
  cases: Record<string, SheriffCaseState>;
  reflected: boolean;
}
export interface SheriffAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SheriffCommand;
}
export interface SheriffCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string;
  closes: number;
}
export interface SheriffProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: SheriffAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: SheriffCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: SheriffCaseProjection[];
  insideCase: boolean;
  environment: string;
}
