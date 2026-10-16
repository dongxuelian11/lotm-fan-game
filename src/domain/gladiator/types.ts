import type { PublicResolutionTier } from '../../shared/contracts.js';

/** Original G combat-training category, not an additional canonical supernatural power. */
export const GLADIATOR_ABILITY_IDS = ['warrior.s8.combat-skill'] as const;
export type GladiatorAbilityId = typeof GLADIATOR_ABILITY_IDS[number];
export const GLADIATOR_CASE_IDS = ['agreed-stop', 'close-pass', 'interrupted-round'] as const;
export type GladiatorCaseId = typeof GLADIATOR_CASE_IDS[number];

export type GladiatorAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type GladiatorActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'TECHNIQUE' | 'TEAM' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'RELEASE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type GladiatorInheritedCommand = { type: 'RETURN_TOOL' };
export type GladiatorCommand = GladiatorAcquisitionCommand | GladiatorActivityCommand | GladiatorInheritedCommand;

/** Individually sealed S8 finished originals, independent of the existing S9 supply. */
export interface GladiatorBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface GladiatorCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'TECHNIQUE' | 'TEAM' | null;
  withdrawals: number;
  outcome: 'NONE' | 'EXERCISE_ENDED' | 'PASSAGE_CLEARED' | 'ROUND_STOPPED';
  contact: 'NONE' | 'ENGAGED' | 'RELEASED';
}
export interface GladiatorState {
  guidanceKnown: boolean;
  bottles: GladiatorBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  warriorActingAtPromotion: number | null;
  cases: Record<string, GladiatorCaseState>;
  reflected: boolean;
}
export interface GladiatorAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: GladiatorCommand;
}
export interface GladiatorCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string; contact: string;
}
export interface GladiatorProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  /** Finished-potion guidance does not reveal an unverified formula. */
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  story?: string;
  supplies: string;
  actions: GladiatorAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: GladiatorCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: GladiatorCaseProjection[];
  environment: string;
  /** Life projects actual unresolved partner contact; not a separately saved flag. */
  insideCase: boolean;
}
