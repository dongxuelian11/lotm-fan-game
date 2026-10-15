import type { PublicResolutionTier } from '../../shared/contracts.js';

export const NAVIGATOR_ABILITY_IDS = ['tyrant.s7.navigation', 'tyrant.s7.water-control', 'tyrant.s7.water-binding'] as const;
export type NavigatorAbilityId = typeof NAVIGATOR_ABILITY_IDS[number];
export const NAVIGATOR_CASE_IDS = ['tide-crossing', 'harbour-weather', 'waterline-cleanup'] as const;
export type NavigatorCaseId = typeof NAVIGATOR_CASE_IDS[number];
export const NAVIGATOR_PLAN_IDS = {
  'tide-crossing': ['SHORE_GUIDE', 'CROSS_CURRENT'],
  'harbour-weather': ['INSHORE_RETURN', 'OPEN_WATER'],
  'waterline-cleanup': ['WATER_RINSE', 'CLOTH_CLEAN'],
} as const satisfies Record<NavigatorCaseId, readonly string[]>;

export type NavigatorAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type NavigatorActivityCommand =
  | { type: 'SURVEY'; caseId: string }
  | { type: 'PLAN'; caseId: string; planId: string }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type NavigatorCommand = NavigatorAcquisitionCommand | NavigatorActivityCommand;

/** Individually sealed S7 originals, separate from the sailor and rager supplies. */
export interface NavigatorBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface NavigatorCaseState {
  status: 'AVAILABLE' | 'SURVEYED' | 'PLANNED' | 'RESOLVED';
  attemptWeek: number | null;
  planId: string | null;
  mistakes: number;
  withdrawals: number;
}
export interface NavigatorState {
  guidanceKnown: boolean;
  bottles: NavigatorBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  ragerActingAtPromotion: number | null;
  cases: Record<string, NavigatorCaseState>;
  reflected: boolean;
}
export interface NavigatorAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: NavigatorCommand;
}
export interface NavigatorCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
}
export interface NavigatorProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  /** Finished-potion guidance never invents the unverified complete recipe. */
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  story?: string;
  supplies: string;
  actions: NavigatorAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: NavigatorCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: NavigatorCaseProjection[];
  environment: string;
}
