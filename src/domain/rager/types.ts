import type { PublicResolutionTier } from '../../shared/contracts.js';

export const RAGER_ABILITY_IDS = ['tyrant.s8.fury', 'tyrant.s8.impact-resilience'] as const;
export type RagerAbilityId = typeof RAGER_ABILITY_IDS[number];
export const RAGER_CASE_IDS = ['jammed-capstan', 'falling-cargo', 'crowded-quay'] as const;
export type RagerCaseId = typeof RAGER_CASE_IDS[number];

export type RagerAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type RagerActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string }
  | { type: 'PERFORM'; caseId: string; method: 'BURST' | 'TEAM' }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type RagerCommand = RagerAcquisitionCommand | RagerActivityCommand;

/** Individually sealed S8 originals, separate from the sailor supply. */
export interface RagerBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface RagerCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'BURST' | 'TEAM' | null;
  bystandersCleared: boolean;
  damage: boolean;
  withdrawals: number;
}
export interface RagerState {
  guidanceKnown: boolean;
  bottles: RagerBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  sailorActingAtPromotion: number | null;
  cases: Record<string, RagerCaseState>;
  reflected: boolean;
}
export interface RagerAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: RagerCommand;
}
export interface RagerCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
}
export interface RagerProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  /** Finished-potion guidance never invents the unverified complete recipe. */
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  story?: string;
  supplies: string;
  actions: RagerAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: RagerCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: RagerCaseProjection[];
  environment: string;
}
