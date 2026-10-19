import type { PublicResolutionTier } from '../../shared/contracts.js';

/** Observed weaknesses and contingent precision, not unavoidable killing or artifact powers. */
export const REAPER_ABILITY_IDS = ['hunter.s5.weakness-observation', 'hunter.s5.precision-strike'] as const;
export type ReaperAbilityId = typeof REAPER_ABILITY_IDS[number];
export const REAPER_CASE_IDS = ['timber-seam', 'moving-shutter', 'guarded-flame'] as const;
export type ReaperCaseId = typeof REAPER_CASE_IDS[number];
export type ReaperAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type ReaperActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'SIGNAL'; caseId: 'moving-shutter' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type ReaperCommand = ReaperAcquisitionCommand | ReaperActivityCommand;
export interface ReaperBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface ReaperCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'SEAM_CHECKED' | 'WINDOW_CHECKED' | 'FLAME_CHECKED';
  contactOpen: boolean;
  closes: number;
  notes: string[];
  practice: { attempts: number; signals: number; windowOpen: boolean; windowUses: number; siteCleared: boolean };
}
export interface ReaperState {
  guidanceKnown: boolean;
  bottles: ReaperBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  conspiratorActingAtPromotion: number | null;
  cases: Record<string, ReaperCaseState>;
  reflected: boolean;
  encounter: {
    status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
    startHistoryIndex: number | null; attemptWeek: number | null;
    weakness: { sourceRound: number | null; available: boolean; observations: number; uses: number };
  };
}
export interface ReaperAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ReaperCommand;
}
export interface ReaperCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number;
  windowOpen: string; practice: string;
}
export interface ReaperProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: ReaperAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ReaperCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: ReaperCaseProjection[];
  insideCase: boolean;
  environment: string;
}
