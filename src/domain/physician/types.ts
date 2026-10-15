import type { PublicResolutionTier } from '../../shared/contracts.js';

/** Physician abilities below are bounded original G; an exact S8 healing table remains unverified. */
export const PHYSICIAN_ABILITY_IDS = ['mother.s8.limited-healing', 'mother.s8.condition-observation'] as const;
export type PhysicianAbilityId = typeof PHYSICIAN_ABILITY_IDS[number];
export const PHYSICIAN_CASE_IDS = ['minor-cut', 'uncertain-fatigue', 'unsafe-whisper'] as const;
export type PhysicianCaseId = typeof PHYSICIAN_CASE_IDS[number];
export type PhysicianAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type PhysicianActivityCommand =
  | { type: 'BUY_KIT' }
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type PhysicianCommand = PhysicianAcquisitionCommand | PhysicianActivityCommand;

/** Individually sealed S8 originals, never converted from earlier Cultivator stock. */
export interface PhysicianBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface PhysicianCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'WOUND_IMPROVED' | 'UNCERTAINTY_RECORDED' | 'REFERRAL_ACCEPTED';
  contactOpen: boolean;
  closes: number;
}
export interface PhysicianClinicState {
  kitsBought: number; dressings: number; usedDressings: number;
  patientHealth: number; treated: boolean; referred: boolean;
}
export interface PhysicianState {
  guidanceKnown: boolean;
  bottles: PhysicianBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  cultivatorActingAtPromotion: number | null;
  cases: Record<string, PhysicianCaseState>;
  reflected: boolean;
  clinic: PhysicianClinicState;
}
export interface PhysicianAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: PhysicianCommand;
}
export interface PhysicianCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string;
  closes: number;
}
export interface PhysicianProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: PhysicianAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: PhysicianCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: PhysicianCaseProjection[];
  insideCase: boolean;
  environment: string;
  clinic: string;
}
