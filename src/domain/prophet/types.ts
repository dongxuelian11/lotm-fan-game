import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { ProphetRitualCommand, ProphetRitualProjection, ProphetRitualState } from './ritual.js';
import type { ProphetActivityCommand, ProphetLifeProjection, ProphetLifeState } from './life.js';
import type { ProphetEncounterCommand, ProphetEncounterProjection, ProphetEncounterState } from './encounter.js';

export const PROPHET_ABILITY_IDS = ['reader.s4.fragmentary-foresight', 'reader.s4.symbolic-interpretation'] as const;
export type ProphetAbilityId = typeof PROPHET_ABILITY_IDS[number];
export type ProphetAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type ProphetCommand = ProphetAcquisitionCommand | ProphetRitualCommand | ProphetActivityCommand | ProphetEncounterCommand;
export interface ProphetBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
  ritualId: string | null; ritualWindowWeek: number | null;
}
export interface ProphetState {
  guidanceKnown: boolean; bottles: ProphetBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; mysticismMagisterActingAtPromotion: number | null;
  ritual: ProphetRitualState; life: ProphetLifeState; encounter: ProphetEncounterState;
}
export interface ProphetAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ProphetCommand;
}
export interface ProphetProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: ProphetAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ProphetCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  ritual: ProphetRitualProjection; life: ProphetLifeProjection; encounter: ProphetEncounterProjection;
  insideCase: boolean; environment: string;
}
export type ProphetPublicView = ProphetProjection;

export type { ProphetRitualCommand, ProphetRitualProjection, ProphetRitualState } from './ritual.js';
