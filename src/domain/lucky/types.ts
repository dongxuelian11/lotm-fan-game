import type { PublicResolutionTier } from '../../shared/contracts.js';

/** B4 ch178: passive, fluctuating luck, without deliberate control or a stored luck pool. */
export const LUCKY_ABILITY_IDS = ['wheel.s7.passive-luck'] as const;
export type LuckyAbilityId = typeof LUCKY_ABILITY_IDS[number];
export const LUCKY_CASE_IDS = ['next-carriage', 'loose-receipt', 'closed-path'] as const;
export type LuckyCaseId = typeof LUCKY_CASE_IDS[number];
export type LuckyAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type LuckyActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'CAREFUL' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type LuckyCommand = LuckyAcquisitionCommand | LuckyActivityCommand;

/** Individually sealed S7 originals, never converted from Monster or Machine stock. */
export interface LuckyBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface LuckyCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'CAREFUL' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'NEXT_ROUTE_CONFIRMED' | 'RECEIPT_RECORDED' | 'DETOUR_RECORDED';
  contactOpen: boolean;
  closes: number;
  /** Latest committed actual PERFORM draw, never a preview, reroll request or saved resource. */
  luckRoll: number | null;
}
export interface LuckyState {
  guidanceKnown: boolean;
  bottles: LuckyBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  machineActingAtPromotion: number | null;
  cases: Record<string, LuckyCaseState>;
  reflected: boolean;
}
export interface LuckyAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: LuckyCommand;
}
export interface LuckyCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string;
  closes: number;
  luck: string;
}
export interface LuckyProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: LuckyAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: LuckyCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: LuckyCaseProjection[];
  insideCase: boolean;
  environment: string;
}
