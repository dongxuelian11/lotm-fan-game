import type { PublicResolutionTier } from '../../shared/contracts.js';

/** B1 ch105 supports direct hearing of corresponding hidden entities; outcomes remain source-bound. */
export const LISTENER_ABILITY_IDS = ['hanged-man.s8.whisper-listening'] as const;
export type ListenerAbilityId = typeof LISTENER_ABILITY_IDS[number];
export const LISTENER_CASE_IDS = ['wall-knock', 'broken-phrase', 'room-exit'] as const;
export type ListenerCaseId = typeof LISTENER_CASE_IDS[number];
export type ListenerAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type ListenerActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'LISTEN' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'LEAVE'; caseId: string }
  | { type: 'VERIFY'; caseId: string }
  | { type: 'REPORT'; caseId: string; claim: 'LIMITED' | 'CERTAIN' }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type ListenerCommand = ListenerAcquisitionCommand | ListenerActivityCommand;

/** Individually sealed S8 originals, independent of the original Secret Supplicant bottles. */
export interface ListenerBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface ListenerCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'LISTEN' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'KNOCK_CHECKED' | 'FRAGMENT_RETAINED' | 'DISTANCE_CHECKED';
  contactOpen: boolean;
  verified: boolean;
  overclaims: number;
}
export interface ListenerState {
  guidanceKnown: boolean;
  bottles: ListenerBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  secretSupplicantActingAtPromotion: number | null;
  cases: Record<string, ListenerCaseState>;
  reflected: boolean;
}
export interface ListenerAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ListenerCommand;
}
export interface ListenerCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string;
  verified: boolean;
  overclaims: number;
}
export interface ListenerProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: ListenerAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ListenerCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: ListenerCaseProjection[];
  insideCase: boolean;
  environment: string;
}
