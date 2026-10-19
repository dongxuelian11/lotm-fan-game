import type { PublicResolutionTier } from '../../shared/contracts.js';

export const JUDGE_ABILITY_IDS = ['justiciar.s6.authority', 'justiciar.s6.prohibition'] as const;
export type JudgeAbilityId = typeof JUDGE_ABILITY_IDS[number];
export const JUDGE_CASE_IDS = ['calm-room', 'marked-line', 'shared-token'] as const;
export type JudgeCaseId = typeof JUDGE_CASE_IDS[number];
export type JudgeAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type JudgeActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type JudgeCommand = JudgeAcquisitionCommand | JudgeActivityCommand;
export interface JudgeBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface JudgeCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number; outcome: 'NONE' | 'ATTENTION_RECORDED' | 'BOUNDARY_RECORDED' | 'TOKEN_RECORDED';
  contactOpen: boolean; closes: number;
}
export interface JudgeState {
  guidanceKnown: boolean; bottles: JudgeBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; interrogatorActingAtPromotion: number | null;
  cases: Record<string, JudgeCaseState>;
  practice: {
    audience: 'READY' | 'ADDRESSED' | 'ATTENTIVE' | 'FREE';
    boundary: 'CLEAR' | 'ATTEMPTED' | 'HELD' | 'RELEASED';
    token: 'ON_TABLE' | 'OUTSIDE_TABLE' | 'HELD_ON_TABLE' | 'RETURNED';
    lineTestedBy: 'NONE' | 'BOTH';
    tokenTestedBy: 'NONE' | 'BOTH';
  };
  reflected: boolean;
  encounter: { status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; startHistoryIndex: number | null; attemptWeek: number | null };
}
export interface JudgeAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: JudgeCommand;
}
export interface JudgeCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string; contactOpen: string; closes: number;
}
export interface JudgeProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string; actions: JudgeAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: JudgeCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: JudgeCaseProjection[]; insideCase: boolean; environment: string;
  practice: JudgeState['practice'];
}
