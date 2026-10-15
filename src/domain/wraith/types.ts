import type { PublicResolutionTier } from '../../shared/contracts.js';

/** CHAINED S5: actual reflective endpoints and finite, resistible possession. */
export const WRAITH_ABILITY_IDS = ['chained.s5.reflection-step', 'chained.s5.spirit-possession'] as const;
export type WraithAbilityId = typeof WRAITH_ABILITY_IDS[number];
export const WRAITH_CASE_IDS = ['reflected-room', 'willing-signal', 'honest-account'] as const;
export type WraithCaseId = typeof WRAITH_CASE_IDS[number];
export type WraithAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type WraithActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'HANDLE_MOON'; method: 'GUARDED' | 'ALONE' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type WraithCommand = WraithAcquisitionCommand | WraithActivityCommand;
export interface WraithBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface WraithCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'ROUTE_CHECKED' | 'SIGNAL_CHECKED' | 'ACCOUNT_CHECKED';
  contactOpen: boolean; closes: number;
}
/** These are the same person, two fixed mirrors, one original flag and one original note. */
export interface WraithPractice {
  form: 'HUMAN' | 'WRAITH';
  node: 'ROOM' | 'ALCOVE';
  mirror: 'COVERED' | 'OPEN';
  host: 'SELF' | 'NOLAN';
  flag: 'TABLE' | 'RAISED';
  note: 'BLANK' | 'WRITTEN' | 'HANDED_OVER';
}
export type WraithPracticeState = WraithPractice;
export interface WraithMoonHistory { week: number; method: 'GUARDED' | 'ALONE'; mentalCost: number }
export interface WraithEncounter {
  status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
  startHistoryIndex: number | null;
  attemptWeek: number | null;
  lastPossessionRound: number | null;
  staggerReady: boolean;
}
export interface WraithState {
  guidanceKnown: boolean;
  bottles: WraithBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  zombieActingAtPromotion: number | null;
  cases: Record<string, WraithCaseState>;
  practice: WraithPractice;
  moon: { pendingWeek: number | null; history: WraithMoonHistory[] };
  reflected: boolean;
  encounter: WraithEncounter;
}
export interface WraithAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: WraithCommand;
}
export interface WraithCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number;
}
export interface WraithProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: WraithAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: WraithCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: WraithCaseProjection[];
  insideCase: boolean;
  environment: string;
  practice: WraithPractice;
  moon: { pending: boolean; summary: string; history: WraithMoonHistory[] };
  battle?: { lastPossessionRound: number | null; staggerReady: boolean };
}
