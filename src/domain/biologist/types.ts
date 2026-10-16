import type { PublicResolutionTier } from '../../shared/contracts.js';

export const BIOLOGIST_ABILITY_IDS = ['mother.s6.specimen-study', 'mother.s6.controlled-trial'] as const;
export type BiologistAbilityId = typeof BIOLOGIST_ABILITY_IDS[number];
export const BIOLOGIST_CASE_IDS = ['sample-record', 'paired-seedling', 'safe-return'] as const;
export type BiologistCaseId = typeof BIOLOGIST_CASE_IDS[number];
export type BiologistAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type BiologistActivityCommand =
  | { type: 'BUY_WATER' }
  | { type: 'VERIFY'; caseId: string }
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type BiologistCommand = BiologistAcquisitionCommand | BiologistActivityCommand;
export interface BiologistBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface BiologistCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number; outcome: 'NONE' | 'SAMPLE_RECORDED' | 'TRIAL_RECORDED' | 'RETURN_RECORDED';
  contactOpen: boolean; closes: number;
}
export interface BiologistState {
  guidanceKnown: boolean; bottles: BiologistBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; harvestpriestActingAtPromotion: number | null;
  cases: Record<string, BiologistCaseState>;
  practice: { sampleRecorded: boolean; warningsRecorded: boolean };
  trial: { careWeek: number | null; verifiedWeek: number | null; waterUsed: number; location: 'BENCH' | 'OWNER'; status: 'IDLE' | 'WAITING' | 'VERIFIED' | 'RETURNED' };
  reflected: boolean;
  encounter: { status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; startHistoryIndex: number | null; attemptWeek: number | null };
}
export interface BiologistAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: BiologistCommand;
}
export interface BiologistCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string; contactOpen: string; closes: number;
}
export interface BiologistProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string; actions: BiologistAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: BiologistCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: BiologistCaseProjection[]; insideCase: boolean; environment: string;
  practice: BiologistState['practice'];
  trial: BiologistState['trial'];
  water: { held: number; used: number; summary: string };
}
