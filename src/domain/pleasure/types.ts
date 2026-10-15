import type { PublicResolutionTier } from '../../shared/contracts.js';

export const PLEASURE_ABILITY_IDS = ['assassin.s6.silk-binding', 'assassin.s6.charm'] as const;
export type PleasureAbilityId = typeof PLEASURE_ABILITY_IDS[number];
export const PLEASURE_CASE_IDS = ['silk-release', 'refused-invitation', 'fire-break'] as const;
export type PleasureCaseId = typeof PLEASURE_CASE_IDS[number];
export type PleasureAcquisitionCommand =
  | { type: 'LEARN_FORMULA' }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' }
  | { type: 'MATERIAL_WORK'; batchId: string }
  | { type: 'BUY_MATERIALS'; batchId: string }
  | { type: 'BREW'; batchId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type PleasureActivityCommand =
  | { type: 'OBSERVE'; caseId: PleasureCaseId }
  | { type: 'PREPARE'; caseId: PleasureCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: PleasureCaseId }
  | { type: 'CLOSE'; caseId: PleasureCaseId }
  | { type: 'REPORT'; caseId: PleasureCaseId }
  | { type: 'WITHDRAW'; caseId: PleasureCaseId }
  | { type: 'SPIN_SILK'; caseId: 'fire-break' }
  | { type: 'BUY_SUPPLIES' }
  | { type: 'PREPARE_MIRROR' }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type PleasureCommand = PleasureAcquisitionCommand | PleasureActivityCommand;
export interface PleasureMaterial {
  id: string; name: string; quantity: number; unit: string; source: string;
  holder: 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
}
export interface PleasureBatch {
  id: string; materials: PleasureMaterial[]; labourSteps: number; acquired: boolean; brewed: boolean;
}
export interface PleasureBottle {
  id: string; batchId: string; inputIds: string[]; brewedWeek: number;
  status: 'PREPARED' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface PleasureCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'SILK_BOUND' | 'CORD_TIED' | 'WILLING_CONVERSATION' | 'ORDINARY_CONVERSATION' | 'FLAME_BROKEN' | 'SCISSORS_CUT';
  contactOpen: boolean;
  closes: number;
  /** One actual original refusal; never a renewable consent score. */
  notes: number;
  revised: boolean;
}
export interface PleasurePractice {
  wrist: 'FREE' | 'SILK' | 'CORD';
  wristConsent: boolean;
  invitationWilling: boolean;
  fireSilk: 'NONE' | 'ON_FRAME' | 'BROKEN' | 'CLEARED';
  fireBreak: 'NONE' | 'BLACK_FLAME' | 'SCISSORS';
}
export interface PleasureState {
  formulaKnown: boolean;
  resupply: { requestedWeek: number | null; deliveries: number };
  batches: PleasureBatch[];
  bottles: PleasureBottle[];
  promotionWeek: number | null;
  witchActingAtPromotion: number | null;
  cases: Record<PleasureCaseId, PleasureCaseState>;
  reflected: boolean;
  practice: PleasurePractice;
  encounter: { status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; startHistoryIndex: number | null; attemptWeek: number | null; silkPrepared: boolean; boundRound: number | null };
}
export interface PleasureAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: PleasureCommand;
}
export interface PleasureCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string; contactOpen: string; closes: number;
}
export interface PleasureProjection {
  title: string; discovered: boolean; formulaKnown: boolean; promoted: boolean;
  formula: { name: string; quantity: number | null; unit: string; note?: string }[];
  story?: string; supplies: string; inheritedTools: string; bodyChange: string;
  actions: PleasureAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: PleasureCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: PleasureCaseProjection[]; insideCase: boolean; environment: string; practice: PleasurePractice;
}
