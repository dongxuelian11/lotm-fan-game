import type { PublicResolutionTier } from '../../shared/contracts.js';

/** Gameplay mastery groups for the limited sequence-seven abilities. */
export const WITCH_ABILITY_IDS = ['assassin.s7.black-flame', 'assassin.s7.frost', 'assassin.s7.invisibility', 'assassin.s7.substitute', 'assassin.s7.divination-interference', 'assassin.s7.black-magic'] as const;
export type WitchAbilityId = typeof WITCH_ABILITY_IDS[number];
export const WITCH_CASE_IDS = ['shade-test', 'mirror-echo', 'frost-and-flame', 'covered-sign', 'sealed-knot'] as const;
export type WitchCaseId = typeof WITCH_CASE_IDS[number];

export type WitchAcquisitionCommand =
  | { type: 'LEARN_FORMULA' }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' }
  | { type: 'MATERIAL_WORK'; batchId: string }
  | { type: 'BUY_MATERIALS'; batchId: string }
  | { type: 'BREW'; batchId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true; bodyChangeAccepted: true };
export type WitchActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'MAGIC' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'BUY_SUPPLIES' }
  | { type: 'PREPARE_MIRROR' };
export type WitchCommand = WitchAcquisitionCommand | WitchActivityCommand;

export interface WitchMaterial {
  id: string; name: string; quantity: number; unit: string; source: string;
  holder: 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
}
export interface WitchBatch {
  id: string; materials: WitchMaterial[]; labourSteps: number; acquired: boolean; brewed: boolean;
}
export interface WitchBottle {
  id: string; batchId: string; inputIds: string[]; brewedWeek: number;
  status: 'PREPARED' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface WitchCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'MAGIC' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'SHADE_CHECKED' | 'MIRROR_CHECKED' | 'TEMPERATURE_TESTED' | 'SIGN_COMPARED' | 'SEAL_READ';
}
export interface WitchTools {
  kitsBought: number; powderHeld: number; powderUsed: number; mirrorsHeld: number; mirrorsUsed: number;
  lastPurchaseWeek: number | null; mirrorPrepared: boolean;
}
export interface WitchState {
  formulaKnown: boolean;
  resupply: { requestedWeek: number | null; deliveries: number };
  batches: WitchBatch[];
  bottles: WitchBottle[];
  promotionWeek: number | null;
  instigatorActingAtPromotion: number | null;
  cases: Record<string, WitchCaseState>;
  reflected: boolean;
  previousGender: string | null;
  tools: WitchTools;
}
export interface WitchAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: WitchCommand;
}
export interface WitchCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
}
export interface WitchProjection {
  title: string; discovered: boolean; formulaKnown: boolean; promoted: boolean;
  formula: { name: string; quantity: number | null; unit: string; note?: string }[];
  story?: string;
  supplies: string;
  tools: string;
  bodyChange: string;
  previousGender: string | null;
  actions: WitchAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: WitchCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: WitchCaseProjection[];
  environment: string;
}
