import type { PublicResolutionTier } from '../../shared/contracts.js';

/** Original G practice categories, not additional canonical powers or automatic mastery of every weapon. */
export const WEAPONMASTER_ABILITY_IDS = ['warrior.s7.weapons', 'warrior.s7.weak-point'] as const;
export type WeaponmasterAbilityId = typeof WEAPONMASTER_ABILITY_IDS[number];
export const WEAPONMASTER_CASE_IDS = ['weapon-fit', 'padded-mark', 'watch-handover'] as const;
export type WeaponmasterCaseId = typeof WEAPONMASTER_CASE_IDS[number];

export type WeaponmasterAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type WeaponmasterActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'TECHNIQUE' | 'TEAM' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type WeaponmasterInheritedCommand = { type: 'RETURN_TOOL' } | { type: 'BORROW_TOOL' };
export type WeaponmasterCommand = WeaponmasterAcquisitionCommand | WeaponmasterActivityCommand | WeaponmasterInheritedCommand;

/** Individually sealed S7 finished originals, independent of the existing S9 and S8 supply. */
export interface WeaponmasterBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface WeaponmasterCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'TECHNIQUE' | 'TEAM' | null;
  withdrawals: number;
  outcome: 'NONE' | 'FIT_CHECKED' | 'MARK_RECHECKED' | 'WATCH_ENDED';
}
export interface WeaponmasterState {
  guidanceKnown: boolean;
  bottles: WeaponmasterBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  gladiatorActingAtPromotion: number | null;
  cases: Record<string, WeaponmasterCaseState>;
  reflected: boolean;
}
export interface WeaponmasterAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: WeaponmasterCommand;
}
export interface WeaponmasterCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
}
export interface WeaponmasterProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  /** Finished-potion guidance does not reveal an unverified formula. */
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  story?: string;
  supplies: string;
  actions: WeaponmasterAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: WeaponmasterCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: WeaponmasterCaseProjection[];
  environment: string;
}
