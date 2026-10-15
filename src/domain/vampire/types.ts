import type { PublicResolutionTier } from '../../shared/contracts.js';

export const VAMPIRE_ABILITY_IDS = [
  'moon.s7.blood-scent',
  'moon.s7.abyss-shackles',
  'moon.s7.dark-wings',
  'moon.s7.regeneration',
] as const;
export type VampireAbilityId = typeof VAMPIRE_ABILITY_IDS[number];
export const VAMPIRE_PRACTICE_IDS = ['blood-samples', 'shaded-route', 'wing-step', 'chain-release'] as const;
export type VampirePracticeId = typeof VAMPIRE_PRACTICE_IDS[number];

export type VampireAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type VampireActivityCommand =
  | { type: 'BUY_BLOOD' }
  | { type: 'FEED' }
  | { type: 'REGENERATE' }
  | { type: 'PRACTICE'; practiceId: string }
  | { type: 'REFLECT' }
  | { type: 'OBSERVE_ENCOUNTER' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type VampireCommand = VampireAcquisitionCommand | VampireActivityCommand;

/** Actual S7 finished originals; separate from all S9/S8 bottles and blood provisions. */
export interface VampireBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface VampireState {
  guidanceKnown: boolean;
  bottles: VampireBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  tamerActingAtPromotion: number | null;
  practices: string[];
  practiceAttempts: Record<string, number>;
  reflected: boolean;
  blood: {
    held: number; bought: number; consumed: number;
    lastPurchaseWeek: number | null; purchasedThisWeek: number; lastFedWeek: number | null;
  };
  regenerationWeek: number | null;
  encounter: {
    status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
    observed: boolean;
    attemptWeek: number | null;
    startHistoryIndex: number | null;
  };
}
export interface VampireAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: VampireCommand;
}
export interface VampireProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  /** One verified main ingredient is not a complete recipe. */
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  story?: string;
  supplies: string;
  practices: { id: string; title: string; story: string; status: string }[];
  environment: string;
  bloodSummary: string;
  actions: VampireAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: VampireCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
}
