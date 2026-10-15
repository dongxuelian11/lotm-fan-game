import type { PublicResolutionTier } from '../../shared/contracts.js';

/** Limited decryption is one S7 ability; it reveals no unexperienced past or stolen power. */
export const CRYPTOLOGIST_ABILITY_IDS = ['error.s7.decryption'] as const;
export type CryptologistAbilityId = typeof CRYPTOLOGIST_ABILITY_IDS[number];
export const CRYPTOLOGIST_CASE_IDS = ['ledger-sequence', 'stage-corridor', 'marked-rubbing'] as const;
export type CryptologistCaseId = typeof CRYPTOLOGIST_CASE_IDS[number];

export type CryptologistAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type CryptologistActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'DECRYPT' | 'PLAIN' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'REPORT'; caseId: string; conclusion: 'LIMITED' | 'CERTAIN' }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type CryptologistInheritedCommand = { type: 'RETURN_TOOL' };
export type CryptologistCommand = CryptologistAcquisitionCommand | CryptologistActivityCommand | CryptologistInheritedCommand;

/** Individually sealed S7 finished originals, independent of the existing S9 and S8 supply. */
export interface CryptologistBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface CryptologistCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'DECRYPT' | 'PLAIN' | null;
  withdrawals: number;
  outcome: 'NONE' | 'ORDER_CORRECTED' | 'FALSE_PASSAGE' | 'LIMIT_RECORDED';
}
export interface CryptologistState {
  guidanceKnown: boolean;
  bottles: CryptologistBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  swindlerActingAtPromotion: number | null;
  cases: Record<string, CryptologistCaseState>;
  reflected: boolean;
}
export interface CryptologistAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: CryptologistCommand;
}
export interface CryptologistCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
}
export interface CryptologistProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  /** Finished-potion guidance does not reveal an unverified formula. */
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  story?: string;
  supplies: string;
  actions: CryptologistAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: CryptologistCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: CryptologistCaseProjection[];
  environment: string;
}
