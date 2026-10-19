import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { ParasiteActivityCommand, ParasiteLifeProjection, ParasiteLifeState } from './life.js';
import type { ParasiteEncounterCommand, ParasiteEncounterProjection, ParasiteEncounterState } from './encounter.js';

export const PARASITE_ABILITY_IDS = ['error.s4.parasitism', 'error.s4.deferred-thought'] as const;
export type ParasiteAbilityId = typeof PARASITE_ABILITY_IDS[number];
export type ParasiteAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type ParasiteCommand = ParasiteAcquisitionCommand | ParasiteActivityCommand | ParasiteEncounterCommand;
export interface ParasiteBottle {
  id: string;
  source: string;
  labourSteps: number;
  acquiredWeek: number | null;
  consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
  outcome: PublicResolutionTier | null;
}
export interface ParasiteState {
  guidanceKnown: boolean;
  bottles: ParasiteBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  dreamStealerActingAtPromotion: number | null;
  life: ParasiteLifeState;
  encounter: ParasiteEncounterState;
}
export interface ParasiteAction {
  id: string;
  label: string;
  cost: string;
  enabled: boolean;
  reason: string | null;
  command: ParasiteCommand;
}
export interface ParasiteProjection extends ParasiteLifeProjection, ParasiteEncounterProjection {
  title: string;
  discovered: boolean;
  guidanceKnown: boolean;
  promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string;
  story?: string;
  actions: ParasiteAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ParasiteCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number;
  digestion: string;
  pollution: number;
  risk: string;
}
export type { ParasiteActivityCommand, ParasiteLifeState, ParasiteLifeProjection } from './life.js';
export type { ParasiteEncounterCommand, ParasiteEncounterState, ParasiteEncounterProjection } from './encounter.js';
