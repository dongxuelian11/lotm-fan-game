import type { PublicResolutionTier } from '../../shared/contracts.js';

/** ABYSS S5: strong current emotion is a prerequisite, not a result of selecting a target. */
export const DESIRE_APOSTLE_ABILITY_IDS = ['abyss.s5.emotion-seed', 'abyss.s5.catalysis'] as const;
export type DesireApostleAbilityId = typeof DESIRE_APOSTLE_ABILITY_IDS[number];
export const DESIRE_APOSTLE_CASE_IDS = ['calm-boundary', 'eager-rehearsal', 'honest-account'] as const;
export type DesireApostleCaseId = typeof DESIRE_APOSTLE_CASE_IDS[number];
export type DesireApostleAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type DesireApostleActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CATALYZE'; caseId: 'eager-rehearsal' }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type DesireApostleCommand = DesireApostleAcquisitionCommand | DesireApostleActivityCommand;
export interface DesireApostleBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface DesireApostleCaseState {
  /** PREPARED can also be the explicitly validated, paid PLANTED rehearsal phase. */
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'CALM_CHECKED' | 'CATALYSIS_CHECKED' | 'TALK_CHECKED' | 'ACCOUNT_CHECKED';
  contactOpen: boolean; closes: number;
}
/** One original ledger and note; the finite adult rehearsal has a separately paid seed and catalyst. */
export interface DesireApostlePractice {
  emotion: 'CALM' | 'STRONG';
  seed: 'NONE' | 'PLANTED' | 'SPENT' | 'EXPIRED';
  pauseObserved: boolean;
  ledger: 'GUIDE' | 'PLAYER';
  note: 'BLANK' | 'WRITTEN' | 'HANDED_OVER';
}
export type DesireApostlePracticeState = DesireApostlePractice;
export interface DesireApostleEncounter {
  status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
  startHistoryIndex: number | null;
  attemptWeek: number | null;
  emotion: 'STRONG' | 'CALM';
  seedPlanted: boolean;
  lastSeedRound: number | null;
  staggerReady: boolean;
}
export interface DesireApostleState {
  guidanceKnown: boolean;
  bottles: DesireApostleBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  demonActingAtPromotion: number | null;
  cases: Record<string, DesireApostleCaseState>;
  practice: DesireApostlePractice;
  reflected: boolean;
  encounter: DesireApostleEncounter;
}
export interface DesireApostleAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: DesireApostleCommand;
}
export interface DesireApostleCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number;
}
export interface DesireApostleProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: DesireApostleAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: DesireApostleCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: DesireApostleCaseProjection[];
  insideCase: boolean;
  environment: string;
  practice: { emotion: string; seed: string; records: string; history: string[] } | null;
  battle?: { emotion: 'STRONG' | 'CALM'; seedPlanted: boolean; seedRound: number | null; staggerReady: boolean };
}
