import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { WitchKingRitualCommand, WitchKingRitualProjection, WitchKingRitualState } from './ritual.js';
import type { WitchKingActivityCommand, WitchKingLifeProjection, WitchKingLifeState } from './life.js';
import type { WitchKingEncounterCommand, WitchKingEncounterProjection, WitchKingEncounterState } from './encounter.js';

export const WITCH_KING_ABILITY_IDS = ['moon.s4.moon-paper-substitute', 'moon.s4.blood-moon-arrow'] as const;
export type WitchKingAbilityId = typeof WITCH_KING_ABILITY_IDS[number];
export type WitchKingAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' } | { type: 'REQUEST_SUPPLY' } | { type: 'RECEIVE_SUPPLY' }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type WitchKingCommand = WitchKingAcquisitionCommand | WitchKingRitualCommand | WitchKingActivityCommand | WitchKingEncounterCommand;
export interface WitchKingBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
  ritualId: string | null; ritualWindowWeek: number | null;
}
export interface WitchKingState {
  guidanceKnown: boolean; bottles: WitchKingBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; crimsonScholarActingAtPromotion: number | null;
  ritual: WitchKingRitualState; life: WitchKingLifeState; encounter: WitchKingEncounterState;
}
export interface WitchKingAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: WitchKingCommand;
}
export interface WitchKingProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: WitchKingAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: WitchKingCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  ritual: WitchKingRitualProjection; life: WitchKingLifeProjection; encounter: WitchKingEncounterProjection;
  insideCase: boolean; environment: string;
}
export type WitchKingPublicView = WitchKingProjection;
