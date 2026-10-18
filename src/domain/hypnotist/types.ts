import type { PublicResolutionTier } from '../../shared/contracts.js';

/** Verified S6 boundaries: limited hypnosis, cognitive omission and scales; never dream manipulation. */
export const HYPNOTIST_ABILITY_IDS = ['audience.s6.hypnosis', 'audience.s6.combat-hypnosis', 'audience.s6.psychological-invisibility', 'audience.s6.scales'] as const;
export type HypnotistAbilityId = typeof HYPNOTIST_ABILITY_IDS[number];
export const HYPNOTIST_CASE_IDS = ['focused-reading', 'protected-choice', 'unnoticed-passage'] as const;
export type HypnotistCaseId = typeof HYPNOTIST_CASE_IDS[number];
export type HypnotistAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type HypnotistActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type HypnotistCommand = HypnotistAcquisitionCommand | HypnotistActivityCommand;

/** Individually sealed S6 originals, never converted from earlier Audience pathway stock. */
export interface HypnotistBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface HypnotistCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'FOCUS_VERIFIED' | 'BOUNDARY_RESPECTED' | 'PASSAGE_COMPARED';
  contactOpen: boolean;
  closes: number;
  notes: string[];
  revised: boolean;
}
export interface HypnotistState {
  guidanceKnown: boolean;
  bottles: HypnotistBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  psychologistActingAtPromotion: number | null;
  cases: Record<string, HypnotistCaseState>;
  reflected: boolean;
  encounter: { status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; startHistoryIndex: number | null; attemptWeek: number | null };
}
export interface HypnotistAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: HypnotistCommand;
}
export interface HypnotistCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string;
  closes: number;
}
export interface HypnotistProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: HypnotistAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: HypnotistCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: HypnotistCaseProjection[];
  insideCase: boolean;
  environment: string;
}
