import type { PublicResolutionTier } from '../../shared/contracts.js';

export const FIRE_THIEF_ABILITY_IDS = ['error.s6.power-theft', 'error.s6.borrowed-power'] as const;
export type FireThiefAbilityId = typeof FIRE_THIEF_ABILITY_IDS[number];
export const FIRE_THIEF_CASE_IDS = ['borrowed-flash', 'separate-windows', 'unknown-power'] as const;
export type FireThiefCaseId = typeof FIRE_THIEF_CASE_IDS[number];
export const FIRE_THIEF_SAMPLE_IDS = ['FLASH', 'FROST', 'COURAGE'] as const;
export type FireThiefSampleId = typeof FIRE_THIEF_SAMPLE_IDS[number];
export const FIRE_THIEF_INSTRUCTOR_IDS = ['SERE', 'NORTIN'] as const;
export type FireThiefInstructorId = typeof FIRE_THIEF_INSTRUCTOR_IDS[number];
export type FireThiefAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type FireThiefActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'USE'; caseId: string }
  | { type: 'WAIT'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type FireThiefCommand = FireThiefAcquisitionCommand | FireThiefActivityCommand;
export interface FireThiefBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface FireThiefCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'FLASH_USED' | 'FROST_USED' | 'COURAGE_USED' | 'SCREEN_CHECKED' | 'WINDOWS_CHECKED' | 'LIMIT_REVIEWED';
  contactOpen: boolean; closes: number;
  borrowedSample: FireThiefSampleId | null;
  usedCount: number;
  playerExpiredObserved: boolean;
  sourceRestored: boolean;
}
/** Finite G scene periods, not canon hours; one source and one borrower, independent expiry. */
export interface FireThiefLoan {
  caseId: FireThiefCaseId | null; sample: FireThiefSampleId | null;
  playerSteps: number; targetSteps: number; uses: number; elapsedSteps: number;
}
export interface FireThiefDemonstration {
  caseId: 'borrowed-flash' | 'separate-windows';
  actor: FireThiefInstructorId; samples: FireThiefSampleId[]; week: number;
}
export interface FireThiefBattleLoan {
  playerRounds: number; targetRounds: number; startedRound: number | null; uses: number;
}
export interface FireThiefState {
  guidanceKnown: boolean; bottles: FireThiefBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; cryptologistActingAtPromotion: number | null;
  cases: Record<string, FireThiefCaseState>; reflected: boolean;
  demonstrations: FireThiefDemonstration[];
  instructorSpirituality: Record<FireThiefInstructorId, number>;
  loan: FireThiefLoan;
  encounter: {
    status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
    startHistoryIndex: number | null; attemptWeek: number | null;
    enemySpirituality: number; enemyCourageSeen: boolean;
    battleLoan: FireThiefBattleLoan;
  };
}
export interface FireThiefAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: FireThiefCommand;
}
export interface FireThiefCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number;
}
export interface FireThiefProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string; actions: FireThiefAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: FireThiefCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: FireThiefCaseProjection[]; insideCase: boolean; environment: string;
  loan: FireThiefLoan;
  battleLoan: FireThiefBattleLoan; enemyCourageSeen: boolean; enemySpirituality: number;
  samples: { id: FireThiefSampleId; label: string; source: string; instructorSpirituality: number; demonstrated: boolean }[];
}
