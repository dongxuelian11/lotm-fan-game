import type { PublicResolutionTier } from '../../shared/contracts.js';

export const MONSTER_ABILITY_IDS = ['wheel.s9.spirit-sensitivity', 'wheel.s9.fragmentary-omen', 'wheel.s9.danger-intuition'] as const;
export type MonsterAbilityId = typeof MONSTER_ABILITY_IDS[number];
export const MONSTER_CASE_IDS = ['falling-sign', 'wrong-shadow', 'quiet-door'] as const;
export type MonsterCaseId = typeof MONSTER_CASE_IDS[number];
export type MonsterAcquisitionCommand =
  | { type: 'DISCOVER' }
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type MonsterActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ATTEND' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string; claim: 'LIMITED' | 'CERTAIN' }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type MonsterCommand = MonsterAcquisitionCommand | MonsterActivityCommand;

/** Individually sealed finished originals; the complete formula is not verified. */
export interface MonsterBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface MonsterCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ATTEND' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'FASTENING_CHECKED' | 'SHADOW_RECHECKED' | 'EXIT_RECORDED';
  contactOpen: boolean;
  closes: number;
  overclaims: number;
}
export interface MonsterState {
  discovered: boolean; guidanceKnown: boolean;
  bottles: MonsterBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  cases: Record<string, MonsterCaseState>;
  reflected: boolean;
}
export interface MonsterAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: MonsterCommand;
}
export interface MonsterCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number; overclaims: number;
}
export interface MonsterProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: MonsterAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: MonsterCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: MonsterCaseProjection[];
  insideCase: boolean;
  environment: string;
}
