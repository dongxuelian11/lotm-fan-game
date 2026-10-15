import type { PublicResolutionTier } from '../../shared/contracts.js';

/** S6 sees nearby spirits and can pacify them, without purifying or sealing them. */
export const SOOTHER_ABILITY_IDS = ['darkness.s6.spirit-sight', 'darkness.s6.spirit-pacification'] as const;
export type SootherAbilityId = typeof SOOTHER_ABILITY_IDS[number];
export const SOOTHER_CASE_IDS = ['restless-wolf', 'echo-at-wall', 'remembered-name'] as const;
export type SootherCaseId = typeof SOOTHER_CASE_IDS[number];
export type SootherAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type SootherActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type SootherCommand = SootherAcquisitionCommand | SootherActivityCommand;

/** Individually sealed S6 originals, never converted from earlier Darkness pathway stock. */
export interface SootherBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface SootherCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'WOLF_PACIFIED' | 'WOLF_OBSERVED' | 'ECHO_COMPARED' | 'WINDOW_CHECKED' | 'NAME_PACIFIED' | 'NAME_RECORDED';
  contactOpen: boolean;
  closes: number;
  notes: string[];
  revised: boolean;
}
export interface SootherState {
  guidanceKnown: boolean;
  bottles: SootherBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  nightmareActingAtPromotion: number | null;
  cases: Record<string, SootherCaseState>;
  reflected: boolean;
  encounter: { status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; startHistoryIndex: number | null; attemptWeek: number | null; pressure: 0 | 1 | 2; dreamLocked: boolean };
}
export interface SootherAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SootherCommand;
}
export interface SootherCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string;
  closes: number;
}
export interface SootherProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: SootherAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: SootherCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: SootherCaseProjection[];
  insideCase: boolean;
  environment: string;
}
