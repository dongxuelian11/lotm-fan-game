import type { PublicResolutionTier } from '../../shared/contracts.js';

export const SLEEPLESS_ABILITY_IDS = [
  'darkness.s9.night-vision',
  'darkness.s9.night-vigor',
  'darkness.s9.danger-sense',
] as const;
export type SleeplessAbilityId = typeof SLEEPLESS_ABILITY_IDS[number];
export const SLEEPLESS_WATCH_IDS = ['quiet-warehouse', 'lost-lamplighter', 'dark-stair'] as const;
export type SleeplessWatchId = typeof SLEEPLESS_WATCH_IDS[number];

export type SleeplessAcquisitionCommand =
  | { type: 'DISCOVER' }
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type SleeplessWatchCommand =
  | { type: 'SURVEY'; watchId: string }
  | { type: 'WATCH'; watchId: string; approach: 'OBSERVE' | 'REPORT' }
  | { type: 'REFLECT' }
  | { type: 'OBSERVE_ENCOUNTER' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type SleeplessCommand = SleeplessAcquisitionCommand | SleeplessWatchCommand;

/** Individually sealed finished originals; no unverified recipe or brewing route. */
export interface SleeplessBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface SleeplessWatchState {
  status: 'AVAILABLE' | 'SURVEYED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'OBSERVE' | 'REPORT' | null;
}
export interface SleeplessState {
  discovered: boolean; guidanceKnown: boolean;
  bottles: SleeplessBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  watches: Record<SleeplessWatchId, SleeplessWatchState>;
  reflected: boolean;
  encounter: {
    status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
    observed: boolean; night: boolean;
    attemptWeek: number | null; startHistoryIndex: number | null;
  };
}
export interface SleeplessAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SleeplessCommand;
}
export interface SleeplessWatchProjection {
  id: string; title: string; story: string; observations: string[]; result: string | null; status: string;
}
export interface SleeplessProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  /** Guidance for finished potions never reveals an unverified formula. */
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: SleeplessAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: SleeplessCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  watches: SleeplessWatchProjection[];
  environment: string;
}
