import type { PublicResolutionTier } from '../../shared/contracts.js';

/** S8 bodily strength and bounded mental resistance; neither grants immunity. */
export const BARBARIAN_ABILITY_IDS = ['black-emperor.s8.enhanced-body', 'black-emperor.s8.mental-resistance'] as const;
export type BarbarianAbilityId = typeof BARBARIAN_ABILITY_IDS[number];
export const BARBARIAN_CASE_IDS = ['wedged-cart', 'heavy-archive', 'spoken-pressure'] as const;
export type BarbarianCaseId = typeof BARBARIAN_CASE_IDS[number];

export type BarbarianAcquisitionCommand =
  | { type: 'LEARN_FORMULA' }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' }
  | { type: 'MATERIAL_WORK'; batchId: string }
  | { type: 'BUY_MATERIALS'; batchId: string }
  | { type: 'BREW'; batchId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type BarbarianActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type BarbarianCommand = BarbarianAcquisitionCommand | BarbarianActivityCommand;

export interface BarbarianMaterial {
  id: string; name: string; quantity: number; unit: string; source: string;
  holder: 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
}
export interface BarbarianBatch {
  id: string; materials: BarbarianMaterial[]; labourSteps: number; acquired: boolean; brewed: boolean;
}
export interface BarbarianBottle {
  id: string; batchId: string; inputIds: string[]; brewedWeek: number;
  status: 'PREPARED' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface BarbarianCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'CART_SECURED' | 'BOX_PLACED' | 'PRESSURE_ENDED';
  contactOpen: boolean;
  closes: number;
}
export interface BarbarianState {
  formulaKnown: boolean;
  resupply: { requestedWeek: number | null; deliveries: number };
  batches: BarbarianBatch[];
  bottles: BarbarianBottle[];
  promotionWeek: number | null;
  lawyerActingAtPromotion: number | null;
  cases: Record<string, BarbarianCaseState>;
  reflected: boolean;
}
export interface BarbarianAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: BarbarianCommand;
}
export interface BarbarianCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number;
}
export interface BarbarianProjection {
  title: string; discovered: boolean; formulaKnown: boolean; promoted: boolean;
  /** The original gives no quantity for the horn crystal; the G supply pack uses one portion. */
  formula: { name: string; quantity: number | null; unit: string; note?: string }[];
  story?: string;
  supplies: string;
  actions: BarbarianAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: BarbarianCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: BarbarianCaseProjection[];
  insideCase: boolean;
  environment: string;
}
