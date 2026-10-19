import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { AlchemistRitualCommand, AlchemistRitualProjection, AlchemistRitualState } from './ritual.js';
import type { AlchemistActivityCommand, AlchemistLifeProjection, AlchemistLifeState } from './life.js';
import type { AlchemistEncounterCommand, AlchemistEncounterProjection, AlchemistEncounterState } from './encounter.js';

export const ALCHEMIST_ABILITY_IDS = ['paragon.s4.animate-made-object', 'paragon.s4.direct-creation'] as const;
export type AlchemistAbilityId = typeof ALCHEMIST_ABILITY_IDS[number];
export type AlchemistAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' } | { type: 'REQUEST_SUPPLY' } | { type: 'RECEIVE_SUPPLY' }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type AlchemistCommand = AlchemistAcquisitionCommand | AlchemistRitualCommand | AlchemistActivityCommand | AlchemistEncounterCommand;
export interface AlchemistBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
  ritualId: string | null; ritualWindowWeek: number | null;
}
export interface AlchemistState {
  guidanceKnown: boolean; bottles: AlchemistBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; astronomerActingAtPromotion: number | null;
  ritual: AlchemistRitualState; life: AlchemistLifeState; encounter: AlchemistEncounterState;
}
export interface AlchemistAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: AlchemistCommand;
}
export interface AlchemistProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: AlchemistAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: AlchemistCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  ritual: AlchemistRitualProjection; life: AlchemistLifeProjection; encounter: AlchemistEncounterProjection;
  insideCase: boolean; environment: string;
}
export type AlchemistPublicView = AlchemistProjection;
