import type { PublicResolutionTier } from '../../shared/contracts.js';

export const SAILOR_ABILITY_IDS = [
  'tyrant.s9.aquatic-affinity', 'tyrant.s9.physique', 'tyrant.s9.balance',
] as const;
export type SailorAbilityId = typeof SAILOR_ABILITY_IDS[number];
export const SAILOR_CASE_IDS = ['moored-barrel', 'wet-gangway', 'rescue-drill'] as const;
export type SailorCaseId = typeof SAILOR_CASE_IDS[number];
export type SailorAcquisitionCommand =
  | { type: 'DISCOVER' }
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type SailorActivityCommand =
  | { type: 'SURVEY'; caseId: string }
  | { type: 'PREPARE'; caseId: string }
  | { type: 'PERFORM'; caseId: string; method: 'ABILITY' | 'TEAM' }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type SailorCommand = SailorAcquisitionCommand | SailorActivityCommand;

/** Finished, individually sealed originals; no invented ingredient or brewing route. */
export interface SailorBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface SailorCaseState {
  status: 'AVAILABLE' | 'SURVEYED' | 'PREPARED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'TEAM' | null;
  rope: 'OWNER' | 'ANCHORED' | 'RETURNED';
  target: 'WAITING' | 'SAFE';
  withdrawals: number;
}
export interface SailorState {
  discovered: boolean; guidanceKnown: boolean;
  bottles: SailorBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  cases: Record<string, SailorCaseState>;
  reflected: boolean;
}
export interface SailorAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SailorCommand;
}
export interface SailorCaseProjection {
  id: string; title: string; story: string; observations: string[];
  equipment: string[]; result: string | null; status: string;
}
export interface SailorProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: SailorAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: SailorCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: SailorCaseProjection[];
  environment: string;
}
