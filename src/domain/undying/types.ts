import type { PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { UndyingRitualCommand, UndyingRitualProjection, UndyingRitualState } from './ritual.js';
import type { UndyingActivityCommand, UndyingLifeProjection, UndyingLifeState } from './life.js';
import type { UndyingEncounterCommand, UndyingEncounterProjection, UndyingEncounterState } from './encounter.js';

export const UNDYING_ABILITY_IDS = ['death.s4.underworld-seal'] as const;
export type UndyingAbilityId = typeof UNDYING_ABILITY_IDS[number];
export type UndyingAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type UndyingCommand = UndyingAcquisitionCommand | UndyingRitualCommand | UndyingActivityCommand | UndyingEncounterCommand;
export interface UndyingBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
  ritualId: string | null; ritualWindowWeek: number | null;
}
export interface UndyingLifecycle {
  promotionDate: PublicGameDate | null; expectedCycleDate: PublicGameDate | null;
  experiencedCycles: 0 | 1; status: 'NOT_PROMOTED' | 'REGISTERED_NOT_EXPERIENCED' | 'CYCLE_DEAD' | 'AMNESIAC' | 'PARTIAL_RECOVERY';
}
export interface UndyingLifecycleProjection extends UndyingLifecycle { summary: string; boundary: string }
export interface UndyingState {
  guidanceKnown: boolean; bottles: UndyingBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; gatekeeperActingAtPromotion: number | null;
  lifecycle: UndyingLifecycle; ritual: UndyingRitualState; life: UndyingLifeState; encounter: UndyingEncounterState;
}
export interface UndyingAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: UndyingCommand;
}
export interface UndyingProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: UndyingAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: UndyingCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  lifecycle: UndyingLifecycleProjection; ritual: UndyingRitualProjection; life: UndyingLifeProjection; encounter: UndyingEncounterProjection;
  insideCase: boolean; environment: string;
}
export type UndyingPublicView = UndyingProjection;

export type { UndyingRitualCommand, UndyingRitualProjection, UndyingRitualState } from './ritual.js';
