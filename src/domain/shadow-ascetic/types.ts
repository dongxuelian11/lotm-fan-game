import type { PublicResolutionTier } from '../../shared/contracts.js';

/** B3 ch183 supports shadow concealment, while spirit-body threads remain detectable. */
export const SHADOW_ASCETIC_ABILITY_IDS = ['hanged-man.s7.shadow-concealment'] as const;
export type ShadowAsceticAbilityId = typeof SHADOW_ASCETIC_ABILITY_IDS[number];
export const SHADOW_ASCETIC_CASE_IDS = ['lamp-shift', 'blocked-alcove', 'agreed-watch'] as const;
export type ShadowAsceticCaseId = typeof SHADOW_ASCETIC_CASE_IDS[number];
export type ShadowAsceticAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type ShadowAsceticActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'SHADOW' | 'ORDINARY' | 'BLOCKED_ROUTE' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'REVEAL'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type ShadowAsceticCommand = ShadowAsceticAcquisitionCommand | ShadowAsceticActivityCommand;

/** Independently sealed S7 originals, never relabeled S9/S8 bottles. */
export interface ShadowAsceticBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface ShadowAsceticCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'SHADOW' | 'ORDINARY' | 'BLOCKED_ROUTE' | null;
  withdrawals: number;
  outcome: 'NONE' | 'LIGHT_CHECKED' | 'ROUTE_CHECKED' | 'WATCH_CHECKED';
  shadowOpen: boolean;
  hidden: boolean;
}
export interface ShadowAsceticState {
  guidanceKnown: boolean;
  bottles: ShadowAsceticBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  listenerActingAtPromotion: number | null;
  cases: Record<string, ShadowAsceticCaseState>;
  reflected: boolean;
}
export interface ShadowAsceticAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ShadowAsceticCommand;
}
export interface ShadowAsceticCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  shadowOpen: string;
  hidden: boolean;
}
export interface ShadowAsceticProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: ShadowAsceticAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ShadowAsceticCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: ShadowAsceticCaseProjection[];
  insideCase: boolean;
  environment: string;
}
