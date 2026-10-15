import type { PublicResolutionTier } from '../../shared/contracts.js';

export const CULTIVATOR_ABILITY_IDS = ['mother.s9.cultivation-knowledge', 'mother.s9.season-observation', 'mother.s9.careful-practice'] as const;
export type CultivatorAbilityId = typeof CULTIVATOR_ABILITY_IDS[number];
export const CULTIVATOR_CASE_IDS = ['soil-record', 'seed-bed', 'shared-basket'] as const;
export type CultivatorCaseId = typeof CULTIVATOR_CASE_IDS[number];
export type CultivatorAcquisitionCommand =
  | { type: 'DISCOVER' }
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type CultivatorActivityCommand =
  | { type: 'BUY_GARDEN' }
  | { type: 'CARE' }
  | { type: 'HARVEST' }
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type CultivatorCommand = CultivatorAcquisitionCommand | CultivatorActivityCommand;

/** Individually sealed finished originals; the complete formula is not verified. */
export interface CultivatorBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface CultivatorCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'SOIL_RECORDED' | 'GROWTH_RECORDED' | 'PORTION_DELIVERED';
  contactOpen: boolean;
  closes: number;
}
export interface CultivatorGardenState {
  suppliesBought: boolean;
  seeds: number; water: number;
  plantedWeek: number | null; caredWeek: number | null; harvestWeek: number | null;
  produce: number; delivered: number;
}
export interface CultivatorState {
  discovered: boolean; guidanceKnown: boolean;
  bottles: CultivatorBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  cases: Record<string, CultivatorCaseState>;
  reflected: boolean;
  garden: CultivatorGardenState;
}
export interface CultivatorAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: CultivatorCommand;
}
export interface CultivatorCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number;
}
export interface CultivatorProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: CultivatorAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: CultivatorCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: CultivatorCaseProjection[];
  insideCase: boolean;
  environment: string;
  garden: string;
}
