import type { PublicResolutionTier } from '../../shared/contracts.js';

export const NOTARY_ABILITY_IDS = ['sun.s6.notarization', 'sun.s6.signed-contract'] as const;
export type NotaryAbilityId = typeof NOTARY_ABILITY_IDS[number];
export const NOTARY_CASE_IDS = ['limited-light', 'rejected-terms', 'signed-tool'] as const;
export type NotaryCaseId = typeof NOTARY_CASE_IDS[number];
export type NotaryAcquisitionCommand =
  | { type: 'LEARN_FORMULA' }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' }
  | { type: 'MATERIAL_WORK'; batchId: string }
  | { type: 'BUY_MATERIALS'; batchId: string }
  | { type: 'BREW'; batchId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type NotaryActivityCommand =
  | { type: 'OBSERVE'; caseId: NotaryCaseId }
  | { type: 'PREPARE'; caseId: NotaryCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: NotaryCaseId }
  | { type: 'CLOSE'; caseId: NotaryCaseId }
  | { type: 'REPORT'; caseId: NotaryCaseId }
  | { type: 'WITHDRAW'; caseId: NotaryCaseId }
  | { type: 'SIGN'; caseId: 'signed-tool' }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type NotaryCommand = NotaryAcquisitionCommand | NotaryActivityCommand;
export interface NotaryMaterial {
  id: string; name: string; quantity: number; unit: string; source: string;
  holder: 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
}
export interface NotaryBatch {
  id: string; materials: NotaryMaterial[]; labourSteps: number; acquired: boolean; brewed: boolean;
}
export interface NotaryBottle {
  id: string; batchId: string; inputIds: string[]; brewedWeek: number;
  status: 'PREPARED' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface NotaryCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'LIGHT_NOTARIZED' | 'LAMP_COMPARED' | 'NARROW_TASK_NOTARIZED' | 'NARROW_TASK_AGREED' | 'SIGNED_LOAN' | 'ORDINARY_LOAN';
  contactOpen: boolean;
  closes: number;
  /** One actual original refusal; never a renewable consent score. */
  notes: number;
  revised: boolean;
}
export interface NotaryContract {
  signed: boolean; active: boolean; tool: 'TABLE' | 'PLAYER'; fulfilled: boolean;
}
export interface NotaryState {
  formulaKnown: boolean;
  resupply: { requestedWeek: number | null; deliveries: number };
  batches: NotaryBatch[];
  bottles: NotaryBottle[];
  promotionWeek: number | null;
  sunpriestActingAtPromotion: number | null;
  cases: Record<NotaryCaseId, NotaryCaseState>;
  reflected: boolean;
  contract: NotaryContract;
  encounter: { status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; startHistoryIndex: number | null; attemptWeek: number | null };
}
export interface NotaryAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: NotaryCommand;
}
export interface NotaryCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string; contactOpen: string; closes: number;
}
export interface NotaryProjection {
  title: string; discovered: boolean; formulaKnown: boolean; promoted: boolean;
  formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string;
  actions: NotaryAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: NotaryCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: NotaryCaseProjection[]; insideCase: boolean; environment: string; contract: NotaryContract;
}
