import type { PublicResolutionTier } from '../../shared/contracts.js';

/** S6 prepares separate limited assistance potions from actual G teaching materials. */
export const POTION_PROFESSOR_ABILITY_IDS = ['moon.s6.support-potions', 'moon.s6.potion-teaching'] as const;
export type PotionProfessorAbilityId = typeof POTION_PROFESSOR_ABILITY_IDS[number];
export const POTION_PROFESSOR_CASE_IDS = ['quiet-passage', 'separate-signals', 'willing-student'] as const;
export type PotionProfessorCaseId = typeof POTION_PROFESSOR_CASE_IDS[number];
export type PotionProfessorAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type PotionProfessorActivityCommand =
  | { type: 'BUY_KIT' }
  | { type: 'BREW_ASSISTANCE'; kind: PotionProfessorAssistanceKind }
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type PotionProfessorCommand = PotionProfessorAcquisitionCommand | PotionProfessorActivityCommand;
export interface PotionProfessorBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface PotionProfessorCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'QUIET_STEP_VERIFIED' | 'SIGNALS_VERIFIED' | 'LESSON_VERIFIED';
  contactOpen: boolean;
  closes: number;
}
export const POTION_PROFESSOR_ASSISTANCE_KINDS = ['QUIET_STEP', 'ODOR_VEIL', 'BODY_VEIL', 'CLOTH_VEIL'] as const;
export type PotionProfessorAssistanceKind = typeof POTION_PROFESSOR_ASSISTANCE_KINDS[number];
export interface PotionProfessorAssistancePotion {
  id: string;
  kind: PotionProfessorAssistanceKind;
  source: string;
  brewedWeek: number;
  status: 'PLAYER' | 'USED';
  usedWeek: number | null;
}
export interface PotionProfessorEffects {
  quietStep: boolean;
  odorVeil: boolean;
  bodyVeil: boolean;
  clothVeil: boolean;
}
export interface PotionProfessorLaboratory {
  kitsBought: number;
  kitStock: number;
  restockAfterWeek: number | null;
  materials: number;
  brewAttempts: number;
  brewFailures: number;
  potions: PotionProfessorAssistancePotion[];
  effects: PotionProfessorEffects;
}
export interface PotionProfessorState {
  guidanceKnown: boolean;
  bottles: PotionProfessorBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  vampireActingAtPromotion: number | null;
  cases: Record<string, PotionProfessorCaseState>;
  laboratory: PotionProfessorLaboratory;
  reflected: boolean;
  encounter: { status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; startHistoryIndex: number | null; attemptWeek: number | null };
}
export interface PotionProfessorAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: PotionProfessorCommand;
}
export interface PotionProfessorCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number;
}
export interface PotionProfessorProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: PotionProfessorAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: PotionProfessorCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: PotionProfessorCaseProjection[]; insideCase: boolean; environment: string;
  laboratory: {
    summary: string;
    materials: string;
    potions: { id: string; kind: PotionProfessorAssistanceKind; title: string; source: string; status: string; brewedWeek: number; usedWeek: number | null }[];
    effects: PotionProfessorEffects;
  };
}
