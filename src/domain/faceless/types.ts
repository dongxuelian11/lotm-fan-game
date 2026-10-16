import type { PublicResolutionTier } from '../../shared/contracts.js';

export const FACELESS_ABILITY_IDS = [
  'diviner.s6.appearance-change', 'diviner.s6.voice-imitation', 'diviner.s6.self-anchor',
] as const;
export type FacelessAbilityId = typeof FACELESS_ABILITY_IDS[number];
export const FACELESS_CASE_IDS = ['stage-double', 'familiar-manner', 'remember-self'] as const;
export type FacelessCaseId = typeof FACELESS_CASE_IDS[number];
export const FACELESS_TEMPLATE_IDS = ['SELF', 'STAGE_DOUBLE', 'PORTER_PART'] as const;
export type FacelessTemplateId = typeof FACELESS_TEMPLATE_IDS[number];

export type FacelessAcquisitionCommand =
  | { type: 'LEARN_FORMULA' }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' }
  | { type: 'MATERIAL_WORK'; batchId: string }
  | { type: 'BUY_MATERIALS'; batchId: string }
  | { type: 'BREW'; batchId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type FacelessActivityCommand =
  | { type: 'OBSERVE'; caseId: FacelessCaseId }
  | { type: 'PREPARE'; caseId: FacelessCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: FacelessCaseId }
  | { type: 'CLOSE'; caseId: FacelessCaseId }
  | { type: 'REPORT'; caseId: FacelessCaseId }
  | { type: 'WITHDRAW'; caseId: FacelessCaseId }
  | { type: 'BORROW_OUTFIT'; caseId: FacelessCaseId }
  | { type: 'RETURN_OUTFIT' }
  | { type: 'CHANGE_APPEARANCE'; templateId: Exclude<FacelessTemplateId, 'SELF'> }
  | { type: 'RESTORE_SELF' }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type FacelessCommand = FacelessAcquisitionCommand | FacelessActivityCommand;
export interface FacelessMaterial {
  id: string; name: string; quantity: number; unit: string; source: string;
  holder: 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
}
export interface FacelessBatch {
  id: string; materials: FacelessMaterial[]; labourSteps: number; acquired: boolean; brewed: boolean;
}
export interface FacelessBottle {
  id: string; batchId: string; inputIds: string[]; brewedWeek: number;
  status: 'PREPARED' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface FacelessCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  observedWeek: number | null;
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'DOUBLE_RECORDED' | 'MANNER_RECOGNIZED' | 'SELF_REMEMBERED';
  contactOpen: boolean;
  closes: number;
  appearanceAtPerformance: FacelessTemplateId | null;
  restoresAtPerformance: number | null;
  outfitLoanAtPerformance: number | null;
  voiceImitated: boolean;
}
/** Only presentation changes. Never overwrite the character's name, identity or physiology. */
export interface FacelessAppearance {
  templateId: FacelessTemplateId;
  sourceCaseId: FacelessCaseId | null;
  changedWeek: number | null;
  changes: number;
  restores: number;
}
/** One original costume; explicit borrowing and return preserve its identity and history. */
export interface FacelessOutfit {
  id: 'FC6-PROP-COAT-1';
  source: 'ORIGINAL_REHEARSAL_WARDROBE';
  location: 'WARDROBE' | 'PLAYER';
  caseId: FacelessCaseId | null;
  loans: number;
  returns: number;
}
export interface FacelessState {
  formulaKnown: boolean;
  resupply: { requestedWeek: number | null; deliveries: number };
  batches: FacelessBatch[];
  bottles: FacelessBottle[];
  promotionWeek: number | null;
  magicianActingAtPromotion: number | null;
  cases: Record<FacelessCaseId, FacelessCaseState>;
  reflected: boolean;
  appearance: FacelessAppearance;
  outfit: FacelessOutfit;
  encounter: { status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; startHistoryIndex: number | null; attemptWeek: number | null };
}
export interface FacelessAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: FacelessCommand;
}
export interface FacelessCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number;
}
export interface FacelessProjection {
  title: string; discovered: boolean; formulaKnown: boolean; promoted: boolean;
  formula: { name: string; quantity: number | null; unit: string; note?: string }[];
  story?: string; supplies: string;
  actions: FacelessAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: FacelessCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: FacelessCaseProjection[]; insideCase: boolean; environment: string;
  appearance: { templateId: FacelessTemplateId; label: string; summary: string; source: string; voice: string; heightOffsetCm: number; persistent: boolean };
  outfit: { id: string; label: string; location: string; summary: string };
}
