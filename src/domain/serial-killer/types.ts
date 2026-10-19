import type { PublicResolutionTier } from '../../shared/contracts.js';

/** B2 ch45 supports demonic knowledge and rituals, not a verified S7 combat spell list. */
export const SERIAL_KILLER_ABILITY_IDS = ['abyss.s7.demonic-lore', 'abyss.s7.ritual-practice'] as const;
export type SerialKillerAbilityId = typeof SERIAL_KILLER_ABILITY_IDS[number];
export const SERIAL_KILLER_CASE_IDS = ['sealed-index', 'empty-circle', 'false-dedication'] as const;
export type SerialKillerCaseId = typeof SERIAL_KILLER_CASE_IDS[number];
export type SerialKillerAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type SerialKillerActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'RITUAL' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string; claim: 'LIMITED' | 'CERTAIN' }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type SerialKillerCommand = SerialKillerAcquisitionCommand | SerialKillerActivityCommand;

/** Independent S7 originals; no S9 or S8 bottle is renamed or reused. */
export interface SerialKillerBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface SerialKillerCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'RITUAL' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'CATALOGUED' | 'CIRCLE_CLOSED' | 'DEDICATION_CORRECTED';
  contactOpen: boolean;
  closures: number;
  overclaims: number;
}
export interface SerialKillerState {
  guidanceKnown: boolean;
  bottles: SerialKillerBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  unwingedActingAtPromotion: number | null;
  cases: Record<string, SerialKillerCaseState>;
  reflected: boolean;
}
export interface SerialKillerAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SerialKillerCommand;
}
export interface SerialKillerCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string;
  closures: number;
  overclaims: number;
}
export interface SerialKillerProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: SerialKillerAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: SerialKillerCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: SerialKillerCaseProjection[];
  insideCase: boolean;
  environment: string;
}
