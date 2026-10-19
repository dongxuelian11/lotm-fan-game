import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { DemonHunterActivityCommand, DemonHunterLifeProjection, DemonHunterLifeState } from './life.js';
import type { DemonHunterEncounterCommand, DemonHunterEncounterProjection, DemonHunterEncounterState } from './encounter.js';

export const DEMON_HUNTER_ABILITY_IDS = ['warrior.s4.discern-corruption', 'warrior.s4.targeted-preparation', 'warrior.s4.veil-intent'] as const;
export type DemonHunterAbilityId = typeof DEMON_HUNTER_ABILITY_IDS[number];
export type DemonHunterAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type DemonHunterCommand = DemonHunterAcquisitionCommand | DemonHunterActivityCommand | DemonHunterEncounterCommand;
export interface DemonHunterBottle {
  id: string;
  source: string;
  labourSteps: number;
  acquiredWeek: number | null;
  consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
  outcome: PublicResolutionTier | null;
}
export interface DemonHunterState {
  guidanceKnown: boolean;
  bottles: DemonHunterBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  guardianActingAtPromotion: number | null;
  life: DemonHunterLifeState;
  encounter: DemonHunterEncounterState;
}
export interface DemonHunterAction {
  id: string;
  label: string;
  cost: string;
  enabled: boolean;
  reason: string | null;
  command: DemonHunterCommand;
}
export interface DemonHunterProjection extends DemonHunterLifeProjection, DemonHunterEncounterProjection {
  title: string;
  discovered: boolean;
  guidanceKnown: boolean;
  promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string;
  story?: string;
  actions: DemonHunterAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: DemonHunterCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number;
  digestion: string;
  pollution: number;
  risk: string;
}
export type { DemonHunterActivityCommand, DemonHunterLifeState, DemonHunterLifeProjection } from './life.js';
export type { DemonHunterEncounterCommand, DemonHunterEncounterState, DemonHunterEncounterProjection } from './encounter.js';
