import type { PublicResolutionTier } from '../../shared/contracts.js';

/** One G teaching category, not a claim to a complete canon spell list. */
export const WIZARD_ABILITY_IDS = ['hermit.s7.spellcraft'] as const;
export type WizardAbilityId = typeof WIZARD_ABILITY_IDS[number];
export const WIZARD_SPELL_IDS = ['light-touch', 'brief-ward', 'blur-mark'] as const;
export type WizardSpellId = typeof WIZARD_SPELL_IDS[number];
export const WIZARD_CASE_IDS = ['paper-marker', 'soft-impact', 'veiled-tag'] as const;
export type WizardCaseId = typeof WIZARD_CASE_IDS[number];
export type WizardAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type WizardActivityCommand =
  | { type: 'LEARN_SPELL'; spellId: string }
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'MAGIC' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'END'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type WizardCommand = WizardAcquisitionCommand | WizardActivityCommand;

/** Independently sealed S7 originals, never relabeled S9/S8 bottles. */
export interface WizardBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface WizardLessonState { learned: boolean; attemptWeek: number | null }
export interface WizardCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'MAGIC' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'MARKER_MOVED' | 'WARD_TESTED' | 'TAG_CHECKED';
  effectOpen: boolean;
}
export interface WizardState {
  guidanceKnown: boolean;
  bottles: WizardBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  combatScholarActingAtPromotion: number | null;
  lessons: Record<string, WizardLessonState>;
  cases: Record<string, WizardCaseState>;
  reflected: boolean;
}
export interface WizardAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: WizardCommand;
}
export interface WizardCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  effectOpen: string;
}
export interface WizardProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: WizardAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: WizardCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  lessons: { id: string; label: string; learned: boolean; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: WizardCaseProjection[];
  insideCase: boolean;
  environment: string;
}
