import type { PublicResolutionTier } from '../../shared/contracts.js';

export const PYROMANIAC_ABILITY_IDS = [
  'hunter.s7.flame-control',
  'hunter.s7.compressed-fireball',
  'hunter.s7.flame-lance',
  'hunter.s7.fire-raven',
] as const;
export type PyromaniacAbilityId = typeof PYROMANIAC_ABILITY_IDS[number];

export type PyromaniacAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type PyromaniacActivityCommand =
  | { type: 'PRACTICE'; practiceId: string }
  | { type: 'SURVEY_ENCOUNTER' }
  | { type: 'CLEAR_LANE' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' }
  | { type: 'REFLECT' };
export type PyromaniacCommand = PyromaniacAcquisitionCommand | PyromaniacActivityCommand;

/** Actual S7 finished bottles from a new G supply, independent of S9/S8 stock. */
export interface PyromaniacBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface PyromaniacState {
  guidanceKnown: boolean;
  bottles: PyromaniacBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  provokerActingAtPromotion: number | null;
  practices: string[];
  practiceAttempts: Record<string, number>;
  reflected: boolean;
  encounter: {
    status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
    surveyed: boolean;
    safeLane: boolean;
    attemptWeek: number | null;
    startHistoryIndex: number | null;
  };
}
export interface PyromaniacAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: PyromaniacCommand;
}
export interface PyromaniacProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  /** Guidance explains sourced finished bottles; it does not invent the unverified recipe. */
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  story?: string;
  supplies: string;
  practices: { id: string; title: string; story: string; status: string }[];
  environment: string;
  actions: PyromaniacAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: PyromaniacCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
}
