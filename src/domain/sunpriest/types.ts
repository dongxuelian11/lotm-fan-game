import type { PublicResolutionTier } from '../../shared/contracts.js';

/** Four gameplay mastery groups, not a claim that the source lists four powers. */
export const SUNPRIEST_ABILITY_IDS = ['sun.s7.holy-light', 'sun.s7.sacred-oath', 'sun.s7.sun-aura', 'sun.s7.holy-water'] as const;
export type SunpriestAbilityId = typeof SUNPRIEST_ABILITY_IDS[number];
export const SUNPRIEST_CASE_IDS = ['water-preparation', 'voluntary-oath', 'isolation-cleanup'] as const;
export type SunpriestCaseId = typeof SUNPRIEST_CASE_IDS[number];

export type SunpriestAcquisitionCommand =
  | { type: 'LEARN_FORMULA' }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' }
  | { type: 'MATERIAL_WORK'; batchId: string }
  | { type: 'BUY_MATERIALS'; batchId: string }
  | { type: 'BREW'; batchId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type SunpriestActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'LIGHT' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type SunpriestCommand = SunpriestAcquisitionCommand | SunpriestActivityCommand;

export interface SunpriestMaterial {
  id: string; name: string; quantity: number; unit: string; source: string;
  holder: 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
}
export interface SunpriestBatch {
  id: string; materials: SunpriestMaterial[]; labourSteps: number; acquired: boolean; brewed: boolean;
}
export interface SunpriestBottle {
  id: string; batchId: string; inputIds: string[]; brewedWeek: number;
  status: 'PREPARED' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface SunpriestCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'LIGHT' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'PREPARED' | 'SUPPORTED' | 'QUIET' | 'REFERRED';
}
export interface SunpriestState {
  formulaKnown: boolean;
  resupply: { requestedWeek: number | null; deliveries: number };
  batches: SunpriestBatch[];
  bottles: SunpriestBottle[];
  promotionWeek: number | null;
  lightprayerActingAtPromotion: number | null;
  cases: Record<string, SunpriestCaseState>;
  reflected: boolean;
  holyWater: { prepared: number; held: number; used: number };
}
export interface SunpriestAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SunpriestCommand;
}
export interface SunpriestCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
}
export interface SunpriestProjection {
  title: string; discovered: boolean; formulaKnown: boolean; promoted: boolean;
  formula: { name: string; quantity: number; unit: string }[];
  story?: string;
  supplies: string;
  actions: SunpriestAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: SunpriestCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: SunpriestCaseProjection[];
  environment: string;
}
