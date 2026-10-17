import type { PublicResolutionTier } from '../../shared/contracts.js';

/** All limited tricks share this one gameplay mastery group. */
export const TRICKMASTER_ABILITY_IDS = ['door.s8.tricks'] as const;
export type TrickmasterAbilityId = typeof TRICKMASTER_ABILITY_IDS[number];
export const TRICKMASTER_CASE_IDS = ['warm-cup', 'stage-signal', 'clear-walkway'] as const;
export type TrickmasterCaseId = typeof TRICKMASTER_CASE_IDS[number];

export type TrickmasterAcquisitionCommand =
  | { type: 'LEARN_FORMULA' }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' }
  | { type: 'MATERIAL_WORK'; batchId: string }
  | { type: 'BUY_MATERIALS'; batchId: string }
  | { type: 'BREW'; batchId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type TrickmasterActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'TRICK' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type TrickmasterCommand = TrickmasterAcquisitionCommand | TrickmasterActivityCommand;

export interface TrickmasterMaterial {
  id: string; name: string; quantity: number; unit: string; source: string;
  holder: 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
}
export interface TrickmasterBatch {
  id: string; materials: TrickmasterMaterial[]; labourSteps: number; acquired: boolean; brewed: boolean;
}
export interface TrickmasterBottle {
  id: string; batchId: string; inputIds: string[]; brewedWeek: number;
  status: 'PREPARED' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface TrickmasterCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'TRICK' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'CHILLED' | 'SIGNALLED' | 'CLEARED' | 'REFERRED';
}
export interface TrickmasterState {
  formulaKnown: boolean;
  resupply: { requestedWeek: number | null; deliveries: number };
  batches: TrickmasterBatch[];
  bottles: TrickmasterBottle[];
  promotionWeek: number | null;
  apprenticeActingAtPromotion: number | null;
  cases: Record<string, TrickmasterCaseState>;
  reflected: boolean;
  cupSurface: 'WARM' | 'THIN_ICE' | 'COOLED';
  signalUsed: boolean;
  walkwayCleared: boolean;
}
export interface TrickmasterAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: TrickmasterCommand;
}
export interface TrickmasterCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
}
export interface TrickmasterProjection {
  title: string; discovered: boolean; formulaKnown: boolean; promoted: boolean;
  /** The original gives no count or weight for the stomach; the G supply pack uses one portion. */
  formula: { name: string; quantity: number | null; unit: string; note?: string }[];
  story?: string;
  supplies: string;
  actions: TrickmasterAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: TrickmasterCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: TrickmasterCaseProjection[];
  environment: string;
}
