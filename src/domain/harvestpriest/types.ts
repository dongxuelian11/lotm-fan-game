import type { PublicResolutionTier } from '../../shared/contracts.js';

/** B3 ch225 verifies the S7 name only; both limited abilities are original G. */
export const HARVESTPRIEST_ABILITY_IDS = ['mother.s7.harvest-care', 'mother.s7.life-support'] as const;
export type HarvestpriestAbilityId = typeof HARVESTPRIEST_ABILITY_IDS[number];
export const HARVESTPRIEST_CASE_IDS = ['wilting-bed', 'shared-yield', 'next-season'] as const;
export type HarvestpriestCaseId = typeof HARVESTPRIEST_CASE_IDS[number];
export type HarvestpriestAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type HarvestpriestActivityCommand =
  | { type: 'BUY_WATER' }
  | { type: 'HARVEST' }
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type HarvestpriestCommand = HarvestpriestAcquisitionCommand | HarvestpriestActivityCommand;

/** Individually sealed S7 originals, never converted from Cultivator or Physician stock. */
export interface HarvestpriestBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface HarvestpriestCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'BED_SUPPORTED' | 'YIELD_SHARED' | 'PLAN_RECORDED';
  contactOpen: boolean;
  closes: number;
}
export interface HarvestpriestPlotState {
  waterPacks: number; water: number; waterUsed: number;
  careWeek: number | null; harvestWeek: number | null;
  produce: number; delivered: number; planRecorded: boolean;
}
export interface HarvestpriestState {
  guidanceKnown: boolean;
  bottles: HarvestpriestBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  physicianActingAtPromotion: number | null;
  cases: Record<string, HarvestpriestCaseState>;
  reflected: boolean;
  plot: HarvestpriestPlotState;
}
export interface HarvestpriestAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: HarvestpriestCommand;
}
export interface HarvestpriestCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string;
  closes: number;
}
export interface HarvestpriestProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: HarvestpriestAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: HarvestpriestCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: HarvestpriestCaseProjection[];
  insideCase: boolean;
  environment: string;
  plot: string;
}
