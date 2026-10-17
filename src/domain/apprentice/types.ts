import type { PublicResolutionTier } from '../../shared/contracts.js';

export const APPRENTICE_ABILITY_IDS = ['door.s9.door-opening'] as const;
export type ApprenticeAbilityId = typeof APPRENTICE_ABILITY_IDS[number];
export const APPRENTICE_CASE_IDS = ['locked-office', 'thick-store', 'waiting-courtyard'] as const;
export type ApprenticeCaseId = typeof APPRENTICE_CASE_IDS[number];
export type ApprenticeAcquisitionCommand =
  | { type: 'DISCOVER' }
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type ApprenticeActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'DOOR' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'RETURN'; caseId: string }
  | { type: 'REPORT'; caseId: string; conclusion: 'LIMITED' | 'CERTAIN' }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type ApprenticeCommand = ApprenticeAcquisitionCommand | ApprenticeActivityCommand;

/** Finished, individually sealed originals; no unverified ingredient or brewing route. */
export interface ApprenticeBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface ApprenticeCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'DOOR' | 'ORDINARY' | null;
  mistakes: number;
  conclusion: 'LIMITED' | 'CERTAIN' | null;
  withdrawals: number;
  position: 'OUTSIDE' | 'INSIDE';
  ordinaryOpen: boolean;
}
export interface ApprenticeState {
  discovered: boolean; guidanceKnown: boolean;
  bottles: ApprenticeBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  cases: Record<string, ApprenticeCaseState>;
  reflected: boolean;
}
export interface ApprenticeAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ApprenticeCommand;
}
export interface ApprenticeCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
}
export interface ApprenticeProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: ApprenticeAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ApprenticeCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: ApprenticeCaseProjection[];
  insideCaseId: string | null;
  environment: string;
}
