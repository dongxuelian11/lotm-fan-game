import type { PublicResolutionTier } from '../../shared/contracts.js';

export const SPIRITMEDIUM_ABILITY_IDS = [
  'death.s7.spirit-ritual', 'death.s7.spirit-communication', 'death.s7.spirit-borrowing',
] as const;
export type SpiritmediumAbilityId = typeof SPIRITMEDIUM_ABILITY_IDS[number];
export const SPIRITMEDIUM_CASE_IDS = ['lamp-spirit', 'memento-question', 'wind-assistance'] as const;
export type SpiritmediumCaseId = typeof SPIRITMEDIUM_CASE_IDS[number];
export type SpiritmediumAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type SpiritmediumActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'RITUAL' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'REPORT'; caseId: string; conclusion: 'LIMITED' | 'COMPLETE' }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type SpiritmediumCommand = SpiritmediumAcquisitionCommand | SpiritmediumActivityCommand;

/** Finished, individually sealed originals; no invented ingredient or brewing route. */
export interface SpiritmediumBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface SpiritmediumCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'RITUAL' | 'ORDINARY' | null;
  mistakes: number;
  conclusion: 'LIMITED' | 'COMPLETE' | null;
  withdrawals: number;
}
export interface SpiritmediumState {
  guidanceKnown: boolean;
  bottles: SpiritmediumBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  gravediggerActingAtPromotion: number | null;
  cases: Record<string, SpiritmediumCaseState>;
  reflected: boolean;
  /** Original paper card stays in the room; activities own its actual move. */
  cardLocation: 'TABLE' | 'TRAY';
}
export interface SpiritmediumAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SpiritmediumCommand;
}
export interface SpiritmediumCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
}
export interface SpiritmediumProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: SpiritmediumAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: SpiritmediumCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: SpiritmediumCaseProjection[];
  environment: string;
}
