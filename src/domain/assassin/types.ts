import type { PublicResolutionTier } from '../../shared/contracts.js';

export const ASSASSIN_ABILITY_IDS = ['assassin.s9.lightness', 'assassin.s9.vision', 'assassin.s9.shadow', 'assassin.s9.burst'] as const;
export type AssassinAbilityId = typeof ASSASSIN_ABILITY_IDS[number];
export const ASSASSIN_CASE_IDS = ['dim-sign', 'upper-draft', 'shadow-cross', 'padded-burst'] as const;
export type AssassinCaseId = typeof ASSASSIN_CASE_IDS[number];
export type AssassinAcquisitionCommand =
  | { type: 'DISCOVER' }
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type AssassinActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'SKILL' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'RETURN'; caseId: string; route: 'LIGHTNESS' | 'STAIRS' }
  | { type: 'REFLECT' };
export type AssassinCommand = AssassinAcquisitionCommand | AssassinActivityCommand;

/** Sealed finished originals; complete recipe and ingredients remain unverified. */
export interface AssassinBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface AssassinCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'SKILL' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'SIGN_CHECKED' | 'DRAFT_RETRIEVED' | 'SHADOW_TESTED' | 'BURST_STOPPED';
  position: 'START' | 'UPPER';
}
export interface AssassinOriginalDraft {
  id: 'assassin-original-draft';
  owner: '诺艾拉·温瑟';
  custodian: 'NOAELA' | 'PLAYER';
  location: 'upper-tray' | 'player:hand' | 'author-desk';
  version: number;
}
export interface AssassinState {
  discovered: boolean; guidanceKnown: boolean;
  bottles: AssassinBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  cases: Record<string, AssassinCaseState>;
  reflected: boolean;
  draft: AssassinOriginalDraft;
}
export interface AssassinAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: AssassinCommand;
}
export interface AssassinCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string; position: string;
}
export interface AssassinProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: AssassinAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: AssassinCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: AssassinCaseProjection[];
  insideCase: boolean;
  draft: { id: string; owner: string; custodian: string; location: string; version: number } | null;
  environment: string;
}
