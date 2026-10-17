import type { PublicResolutionTier } from '../../shared/contracts.js';

/** BLACK EMPEROR S5: finite confusion of existing movement and trajectories. */
export const MENTOR_DISORDER_ABILITY_IDS = ['black-emperor.s5.disorder'] as const;
export type MentorDisorderAbilityId = typeof MENTOR_DISORDER_ABILITY_IDS[number];
export const MENTOR_DISORDER_CASE_IDS = ['paired-trays', 'willing-crossing', 'honest-account'] as const;
export type MentorDisorderCaseId = typeof MENTOR_DISORDER_CASE_IDS[number];
export type MentorDisorderMethod = 'ABILITY' | 'ORDINARY';
export type MentorDisorderAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type MentorDisorderActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: MentorDisorderMethod }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'BUY_GIFTS' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type MentorDisorderCommand = MentorDisorderAcquisitionCommand | MentorDisorderActivityCommand;
export interface MentorDisorderBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface MentorDisorderCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null; method: MentorDisorderMethod | null;
  withdrawals: number;
  outcome: 'NONE' | 'TRAYS_CHECKED' | 'ROUTE_CHECKED' | 'ACCOUNT_CHECKED';
  contactOpen: boolean; closes: number;
}
/** Both original counters, the original route marker and the same written note persist. */
export interface MentorDisorderPractice {
  markers: 'SORTED' | 'MIXED' | 'COLLECTED';
  route: 'READY' | 'MARKED' | 'FREE';
  note: 'BLANK' | 'WRITTEN' | 'HANDED_OVER';
}
export type MentorDisorderPracticeState = MentorDisorderPractice;
export interface MentorDisorderEncounter {
  status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
  startHistoryIndex: number | null;
  attemptWeek: number | null;
}
export interface MentorDisorderState {
  guidanceKnown: boolean;
  bottles: MentorDisorderBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  corruptionBaronActingAtPromotion: number | null;
  cases: Record<string, MentorDisorderCaseState>;
  practice: MentorDisorderPractice;
  reflected: boolean;
  encounter: MentorDisorderEncounter;
}
export interface MentorDisorderAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: MentorDisorderCommand;
}
export interface MentorDisorderCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number;
}
export interface MentorDisorderProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: MentorDisorderAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: MentorDisorderCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: MentorDisorderCaseProjection[];
  insideCase: boolean;
  environment: string;
  practice: MentorDisorderPractice;
  gifts: { held: number; given: number; summary: string };
}
