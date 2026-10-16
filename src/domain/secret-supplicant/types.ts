import type { PublicResolutionTier } from '../../shared/contracts.js';

export const SECRET_SUPPLICANT_ABILITY_IDS = ['hanged-man.s9.secret-sense', 'hanged-man.s9.sacrificial-lore', 'hanged-man.s9.ritual-practice'] as const;
export type SecretSupplicantAbilityId = typeof SECRET_SUPPLICANT_ABILITY_IDS[number];
export const SECRET_SUPPLICANT_CASE_IDS = ['ritual-ledger', 'empty-bowl', 'covered-token'] as const;
export type SecretSupplicantCaseId = typeof SECRET_SUPPLICANT_CASE_IDS[number];
export type SecretSupplicantAcquisitionCommand =
  | { type: 'DISCOVER' }
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type SecretSupplicantActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'MYSTIC' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'COVER'; caseId: string }
  | { type: 'REPORT'; caseId: string; claim: 'LIMITED' | 'CERTAIN' }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type SecretSupplicantCommand = SecretSupplicantAcquisitionCommand | SecretSupplicantActivityCommand;

/** Individually sealed finished originals; the complete formula is not verified. */
export interface SecretSupplicantBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface SecretSupplicantCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'MYSTIC' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'LEDGER_CHECKED' | 'NO_REPLY' | 'PRESENCE_NOTED';
  contactOpen: boolean;
  overclaims: number;
}
export interface SecretSupplicantState {
  discovered: boolean; guidanceKnown: boolean;
  bottles: SecretSupplicantBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  cases: Record<string, SecretSupplicantCaseState>;
  reflected: boolean;
}
export interface SecretSupplicantAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SecretSupplicantCommand;
}
export interface SecretSupplicantCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; overclaims: number;
}
export interface SecretSupplicantProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: SecretSupplicantAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: SecretSupplicantCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: SecretSupplicantCaseProjection[];
  insideCase: boolean;
  environment: string;
}
