import type { PublicResolutionTier } from '../../shared/contracts.js';

/** One bounded S7 addition; earlier Lawyer and Barbarian abilities are inherited. */
export const BRIBER_ABILITY_IDS = ['black-emperor.s7.bribery-weakening'] as const;
export type BriberAbilityId = typeof BRIBER_ABILITY_IDS[number];
export const BRIBER_CASE_IDS = ['volunteered-test', 'rejected-cup', 'parting-gift'] as const;
export type BriberCaseId = typeof BRIBER_CASE_IDS[number];

export type BriberAcquisitionCommand =
  | { type: 'LEARN_FORMULA' }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' }
  | { type: 'MATERIAL_WORK'; batchId: string }
  | { type: 'BUY_MATERIALS'; batchId: string }
  | { type: 'BREW'; batchId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type BriberActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'BUY_GIFTS' };
export type BriberCommand = BriberAcquisitionCommand | BriberActivityCommand;

export interface BriberMaterial {
  id: string; name: string; quantity: number; unit: string; source: string;
  holder: 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
}
export interface BriberBatch {
  id: string; materials: BriberMaterial[]; labourSteps: number; acquired: boolean; brewed: boolean;
}
export interface BriberBottle {
  id: string; batchId: string; inputIds: string[]; brewedWeek: number;
  status: 'PREPARED' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface BriberCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'TEST_RECORDED' | 'REFUSAL_RECORDED' | 'DEPARTURE_RECORDED';
  contactOpen: boolean;
  closes: number;
}
export interface BriberState {
  formulaKnown: boolean;
  resupply: { requestedWeek: number | null; deliveries: number };
  batches: BriberBatch[];
  bottles: BriberBottle[];
  promotionWeek: number | null;
  barbarianActingAtPromotion: number | null;
  cases: Record<string, BriberCaseState>;
  reflected: boolean;
  gifts: BriberGift[];
  giftPacks: number;
}
export interface BriberGift {
  id: string;
  location: 'PLAYER' | 'GIVEN';
  destination: string | null;
  givenWeek: number | null;
}
export interface BriberAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: BriberCommand;
}
export interface BriberCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number;
}
export interface BriberProjection {
  title: string; discovered: boolean; formulaKnown: boolean; promoted: boolean;
  /** The original gives no quantity for the hemp crystal; the G supply pack uses one portion. */
  formula: { name: string; quantity: number | null; unit: string; note?: string }[];
  story?: string;
  supplies: string;
  actions: BriberAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: BriberCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: BriberCaseProjection[];
  insideCase: boolean;
  environment: string;
  gifts: { held: number; given: number; summary: string };
}
