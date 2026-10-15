import type { PublicResolutionTier } from '../../shared/contracts.js';

/** B4 ch178: computation, precise control, improved physical talent and bounded divination. */
export const MACHINE_ABILITY_IDS = ['wheel.s8.calculation-control', 'wheel.s8.divination-guard'] as const;
export type MachineAbilityId = typeof MACHINE_ABILITY_IDS[number];
export const MACHINE_CASE_IDS = ['timing-board', 'steady-pointer', 'private-question'] as const;
export type MachineCaseId = typeof MACHINE_CASE_IDS[number];
export type MachineAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type MachineActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type MachineCommand = MachineAcquisitionCommand | MachineActivityCommand;

/** Individually sealed S8 originals, never converted from earlier Monster stock. */
export interface MachineBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface MachineCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'INTERVAL_RECORDED' | 'POINTER_ALIGNED' | 'QUESTION_BOUNDED';
  contactOpen: boolean;
  closes: number;
}
export interface MachineState {
  guidanceKnown: boolean;
  bottles: MachineBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  monsterActingAtPromotion: number | null;
  cases: Record<string, MachineCaseState>;
  reflected: boolean;
}
export interface MachineAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: MachineCommand;
}
export interface MachineCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string;
  closes: number;
}
export interface MachineProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: MachineAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: MachineCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: MachineCaseProjection[];
  insideCase: boolean;
  environment: string;
}
