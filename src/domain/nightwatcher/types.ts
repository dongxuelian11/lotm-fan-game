import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { NightwatcherRitualCommand, NightwatcherRitualProjection, NightwatcherRitualState } from './ritual.js';
import type { NightwatcherActivityCommand, NightwatcherLifeProjection, NightwatcherLifeState } from './life.js';
import type { NightwatcherEncounterCommand, NightwatcherEncounterProjection, NightwatcherEncounterState } from './encounter.js';

export const NIGHTWATCHER_ABILITY_IDS = ['darkness.s4.limited-misfortune', 'darkness.s4.area-dream'] as const;
export type NightwatcherAbilityId = typeof NIGHTWATCHER_ABILITY_IDS[number];
export type NightwatcherAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' } | { type: 'REQUEST_SUPPLY' } | { type: 'RECEIVE_SUPPLY' }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type NightwatcherCommand = NightwatcherAcquisitionCommand | NightwatcherRitualCommand | NightwatcherActivityCommand | NightwatcherEncounterCommand;
export interface NightwatcherBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
  ritualId: string | null; ritualWindowWeek: number | null;
}
export interface NightwatcherState {
  guidanceKnown: boolean; bottles: NightwatcherBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; spiritWarlockActingAtPromotion: number | null;
  ritual: NightwatcherRitualState; life: NightwatcherLifeState; encounter: NightwatcherEncounterState;
}
export interface NightwatcherAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: NightwatcherCommand;
}
export interface NightwatcherProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: NightwatcherAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: NightwatcherCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  ritual: NightwatcherRitualProjection; life: NightwatcherLifeProjection; encounter: NightwatcherEncounterProjection;
  insideCase: boolean; environment: string;
}
export type NightwatcherPublicView = NightwatcherProjection;

export type { NightwatcherRitualCommand, NightwatcherRitualProjection, NightwatcherRitualState } from './ritual.js';
