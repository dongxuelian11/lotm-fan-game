import type { PublicResolutionTier } from '../../shared/contracts.js';

/** WHEEL S5: finite accumulated good luck and resistible, limited ill fortune. */
export const WINNER_ABILITY_IDS = ['wheel.s5.luck-reserve', 'wheel.s5.ill-fortune'] as const;
export type WinnerAbilityId = typeof WINNER_ABILITY_IDS[number];
export const WINNER_CASE_IDS = ['falling-counter', 'willing-aim', 'honest-account'] as const;
export type WinnerCaseId = typeof WINNER_CASE_IDS[number];
export type WinnerAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type WinnerActivityCommand =
  | { type: 'ACCUMULATE' }
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type WinnerCommand = WinnerAcquisitionCommand | WinnerActivityCommand;
export interface WinnerBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface WinnerCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'COUNTER_CHECKED' | 'AIM_CHECKED' | 'ACCOUNT_CHECKED';
  contactOpen: boolean; closes: number;
}
/** One original counter, Sella's original ring, and the same written note. */
export interface WinnerPractice {
  counter: 'GUIDE' | 'TRAY' | 'CAUGHT';
  ring: 'OWNER' | 'MAT';
  note: 'BLANK' | 'WRITTEN' | 'HANDED_OVER';
}
export type WinnerPracticeState = WinnerPractice;
export interface WinnerLuck {
  stored: number;
  lastAccumulateWeek: number | null;
  accumulated: number;
  spent: number;
}
export type WinnerLuckPolicy = 'HOLD' | 'SPEND_FIRST';
export interface WinnerEncounter {
  status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
  startHistoryIndex: number | null;
  attemptWeek: number | null;
  lastLuckRound: number | null;
  staggerReady: boolean;
}
export interface WinnerState {
  guidanceKnown: boolean;
  bottles: WinnerBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  calamityPriestActingAtPromotion: number | null;
  cases: Record<string, WinnerCaseState>;
  practice: WinnerPractice;
  luck: WinnerLuck;
  reflected: boolean;
  encounter: WinnerEncounter;
}
export interface WinnerAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: WinnerCommand;
}
export interface WinnerCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number;
}
export interface WinnerProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: WinnerAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: WinnerCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: WinnerCaseProjection[];
  insideCase: boolean;
  environment: string;
  practice: WinnerPractice;
  luck: WinnerLuck & { capacity: 3; summary: string };
  battle?: { stored: number; lastLuckRound: number | null; staggerReady: boolean };
}
