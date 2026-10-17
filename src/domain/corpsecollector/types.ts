import type { PublicResolutionTier } from '../../shared/contracts.js';

export const CORPSECOLLECTOR_ABILITY_IDS = [
  'death.s9.corpse-physique', 'death.s9.spiritual-sight', 'death.s9.undead-knowledge',
] as const;
export type CorpsecollectorAbilityId = typeof CORPSECOLLECTOR_ABILITY_IDS[number];
export const CORPSECOLLECTOR_CASE_IDS = ['unclaimed-body', 'cold-storage', 'quiet-passage'] as const;
export type CorpsecollectorCaseId = typeof CORPSECOLLECTOR_CASE_IDS[number];
export type CorpsecollectorAcquisitionCommand =
  | { type: 'DISCOVER' }
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type CorpsecollectorActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'SIGHT' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'REPORT'; caseId: string; conclusion: 'LIMITED' | 'CERTAIN' }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type CorpsecollectorCommand = CorpsecollectorAcquisitionCommand | CorpsecollectorActivityCommand;

/** Finished, individually sealed originals; no invented ingredient or brewing route. */
export interface CorpsecollectorBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface CorpsecollectorCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'SIGHT' | 'ORDINARY' | null;
  mistakes: number;
  conclusion: 'LIMITED' | 'CERTAIN' | null;
  withdrawals: number;
}
export interface CorpsecollectorState {
  discovered: boolean; guidanceKnown: boolean;
  bottles: CorpsecollectorBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  cases: Record<string, CorpsecollectorCaseState>;
  reflected: boolean;
}
export interface CorpsecollectorAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: CorpsecollectorCommand;
}
export interface CorpsecollectorCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
}
export interface CorpsecollectorProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: CorpsecollectorAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: CorpsecollectorCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: CorpsecollectorCaseProjection[];
  environment: string;
}
