import type { PublicResolutionTier } from '../../shared/contracts.js';

export const NIGHTMARE_ABILITY_IDS = [
  'darkness.s7.dream-entry',
  'darkness.s7.dream-discernment',
] as const;
export type NightmareAbilityId = typeof NIGHTMARE_ABILITY_IDS[number];
export const NIGHTMARE_CASE_IDS = ['letter-at-window', 'workshop-footsteps', 'old-journey'] as const;
export type NightmareCaseId = typeof NIGHTMARE_CASE_IDS[number];

export type NightmareAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type NightmareActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string }
  | { type: 'SESSION'; caseId: string }
  | { type: 'VERIFY'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'OBSERVE_ENCOUNTER' }
  | { type: 'CLEAR_BYSTANDER' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type NightmareCommand = NightmareAcquisitionCommand | NightmareActivityCommand;

/** Individually sealed S7 originals, independent of existing S9 and S8 supplies. */
export interface NightmareBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface NightmareCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'DREAM_RECORDED' | 'RESOLVED' | 'WITHDRAWN';
  attemptWeek: number | null;
  dreamRecord: string | null;
}
export interface NightmareState {
  guidanceKnown: boolean;
  bottles: NightmareBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  midnightActingAtPromotion: number | null;
  cases: Record<string, NightmareCaseState>;
  reflected: boolean;
  encounter: {
    status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
    observed: boolean; bystanderCleared: boolean;
    attemptWeek: number | null; startHistoryIndex: number | null;
    pressure: 0 | 1 | 2; dreamLocked: boolean;
  };
}
export interface NightmareAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: NightmareCommand;
}
export interface NightmareCaseProjection {
  id: string; title: string; story: string; observations: string[];
  dreamRecord: string | null; result: string | null; status: string;
}
export interface NightmareProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  /** Finished-potion guidance never reveals the unverified full recipe. */
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  story?: string;
  supplies: string;
  actions: NightmareAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: NightmareCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: NightmareCaseProjection[];
  environment: string;
}
