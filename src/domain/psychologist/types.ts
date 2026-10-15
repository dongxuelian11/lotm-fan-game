import type { PublicResolutionTier } from '../../shared/contracts.js';

export const PSYCHOLOGIST_ABILITY_IDS = [
  'audience.s7.awe',
  'audience.s7.frenzy',
  'audience.s7.suggestion',
  'audience.s7.soothe',
  'audience.s7.mental-communication',
] as const;
export type PsychologistAbilityId = typeof PSYCHOLOGIST_ABILITY_IDS[number];
export const PSYCHOLOGIST_CASE_IDS = ['night-watch', 'stage-fright', 'unsettled-letter'] as const;
export type PsychologistCaseId = typeof PSYCHOLOGIST_CASE_IDS[number];
export type PsychologistSupportMethod = 'SOOTHE' | 'SUGGEST' | 'COMMUNICATE';

export type PsychologistAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type PsychologistActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'SUPPORT'; caseId: string; method: PsychologistSupportMethod }
  | { type: 'DISCUSS'; caseId: string }
  | { type: 'REFER'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'OBSERVE_ENCOUNTER' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type PsychologistCommand = PsychologistAcquisitionCommand | PsychologistActivityCommand;

/** Actual S7 finished bottles from a new G supply, independent of S9/S8 stock. */
export interface PsychologistBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface PsychologistCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'SUPPORTED' | 'RESOLVED';
  consent: boolean;
  supportWeek: number | null;
  attemptWeek: number | null;
  method: PsychologistSupportMethod | 'REFER' | null;
  mind: number;
  readSummary: string | null;
}
export interface PsychologistState {
  guidanceKnown: boolean;
  bottles: PsychologistBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  mindreaderActingAtPromotion: number | null;
  cases: Record<string, PsychologistCaseState>;
  reflected: boolean;
  encounter: {
    status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
    observed: boolean;
    attemptWeek: number | null;
    startHistoryIndex: number | null;
  };
}
export interface PsychologistAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: PsychologistCommand;
}
export interface PsychologistSceneProjection {
  id: string; title: string; story: string; observations: string[];
  impression: string | null; status: string; consent: boolean;
}
export interface PsychologistProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  /** A partial canon ingredient record is not a usable full formula. */
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  story?: string;
  supplies: string;
  scenes: PsychologistSceneProjection[];
  environment: string;
  actions: PsychologistAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: PsychologistCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
}
