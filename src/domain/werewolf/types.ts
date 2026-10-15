import type { PublicResolutionTier } from '../../shared/contracts.js';

/** B2 ch118 supports body, regeneration and toxic claws; unnamed spells are not invented. */
export const WEREWOLF_ABILITY_IDS = ['chained.s7.werewolf-body', 'chained.s7.regeneration', 'chained.s7.toxic-claws'] as const;
export type WerewolfAbilityId = typeof WEREWOLF_ABILITY_IDS[number];
export const WEREWOLF_CASE_IDS = ['existing-wound', 'claw-mark', 'night-route'] as const;
export type WerewolfCaseId = typeof WEREWOLF_CASE_IDS[number];
export type WerewolfAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type WerewolfActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'RETURN'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'HANDLE_MOON'; method: 'GUARDED' | 'ALONE' };
export type WerewolfCommand = WerewolfAcquisitionCommand | WerewolfActivityCommand;

/** Independent S7 originals, never renamed from earlier Prisoner or Madman stock. */
export interface WerewolfBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface WerewolfCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'RECOVERY_RECORDED' | 'MARK_CONTAINED' | 'ROUTE_CHECKED';
  sceneOpen: boolean;
  returns: number;
}
export interface WerewolfMoonHistory {
  week: number; method: 'GUARDED' | 'ALONE'; mentalCost: number;
}
export interface WerewolfState {
  guidanceKnown: boolean;
  bottles: WerewolfBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  madmanActingAtPromotion: number | null;
  cases: Record<string, WerewolfCaseState>;
  reflected: boolean;
  moon: { pendingWeek: number | null; history: WerewolfMoonHistory[] };
}
export interface WerewolfAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: WerewolfCommand;
}
export interface WerewolfCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  sceneOpen: string;
  returns: number;
}
export interface WerewolfProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: WerewolfAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: WerewolfCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: WerewolfCaseProjection[];
  insideCase: boolean;
  environment: string;
  moon: { pending: boolean; summary: string; history: WerewolfMoonHistory[] };
}
