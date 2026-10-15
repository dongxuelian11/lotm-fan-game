import type { PublicResolutionTier } from '../../shared/contracts.js';

/** S5 steals a current intention and immediately executes it; no borrowed power or deferred action. */
export const DREAM_STEALER_ABILITY_IDS = ['error.s5.thought-theft'] as const;
export type DreamStealerAbilityId = typeof DREAM_STEALER_ABILITY_IDS[number];
export const DREAM_STEALER_CASE_IDS = ['announced-seat', 'intended-reach', 'empty-performance'] as const;
export type DreamStealerCaseId = typeof DREAM_STEALER_CASE_IDS[number];
export type DreamStealerAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type DreamStealerActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type DreamStealerCommand = DreamStealerAcquisitionCommand | DreamStealerActivityCommand;
export interface DreamStealerBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface DreamStealerCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'SEAT_CHECKED' | 'REACH_CHECKED' | 'NO_MIND_CHECKED';
  contactOpen: boolean;
  closes: number;
}
/** Actual bodies and the one original DS5-TOKEN-1 disc; successful theft executes immediately. */
export interface DreamStealerPractice {
  playerPose: 'STANDING' | 'SEATED' | 'REACHING';
  targetPaused: boolean;
  targetRecovered: boolean;
  token: 'TARGET_DESK' | 'TARGET_HAND';
  thefts: number;
  executions: number;
  recoveries: number;
  tokenMoves: number;
}
export interface DreamStealerState {
  guidanceKnown: boolean;
  bottles: DreamStealerBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  fireThiefActingAtPromotion: number | null;
  cases: Record<string, DreamStealerCaseState>;
  practice: DreamStealerPractice;
  reflected: boolean;
  encounter: {
    status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
    startHistoryIndex: number | null; attemptWeek: number | null;
  };
}
export interface DreamStealerAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: DreamStealerCommand;
}
export interface DreamStealerCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number;
}
export interface DreamStealerProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: DreamStealerAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: DreamStealerCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: DreamStealerCaseProjection[];
  insideCase: boolean;
  environment: string;
  practice: { pose: string; target: string; token: string; history: string[] } | null;
}
