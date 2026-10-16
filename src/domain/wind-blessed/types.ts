import type { PublicResolutionTier } from '../../shared/contracts.js';

export const WIND_BLESSED_ABILITY_IDS = ['tyrant.s6.wind-control', 'tyrant.s6.wind-blade', 'tyrant.s6.short-flight'] as const;
export type WindBlessedAbilityId = typeof WIND_BLESSED_ABILITY_IDS[number];
export const WIND_BLESSED_CASE_IDS = ['crosswind-screen', 'low-platform', 'cutting-target'] as const;
export type WindBlessedCaseId = typeof WIND_BLESSED_CASE_IDS[number];
export type WindBlessedAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type WindBlessedActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string; returnMethod?: 'STAIRS' | 'FLIGHT' }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type WindBlessedCommand = WindBlessedAcquisitionCommand | WindBlessedActivityCommand;
export interface WindBlessedBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface WindBlessedCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'WIND_STABILIZED' | 'POLES_FIXED' | 'FLOWN_TO_PLATFORM' | 'STAIRS_TO_PLATFORM' | 'WIND_CUT' | 'SAW_CUT';
  contactOpen: boolean;
  closes: number;
}
/** Counts real arrivals and successful returns at this one original low platform, not world coordinates. */
export interface WindBlessedFlightState {
  position: 'GROUND' | 'LOW_PLATFORM';
  ascents: number;
  flightReturns: number;
  stairReturns: number;
}
export interface WindBlessedState {
  guidanceKnown: boolean;
  bottles: WindBlessedBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  navigatorActingAtPromotion: number | null;
  cases: Record<string, WindBlessedCaseState>;
  reflected: boolean;
  flight: WindBlessedFlightState;
  encounter: { status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; startHistoryIndex: number | null; attemptWeek: number | null };
}
export interface WindBlessedAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: WindBlessedCommand;
}
export interface WindBlessedCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string;
  closes: number;
}
export interface WindBlessedProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: WindBlessedAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: WindBlessedCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: WindBlessedCaseProjection[];
  insideCase: boolean;
  environment: string;
  flight: WindBlessedFlightState;
}
