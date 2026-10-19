import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { FallenEarlActivityCommand, FallenEarlLifeProjection, FallenEarlLifeState } from './life.js';
import type { FallenEarlEncounterCommand, FallenEarlEncounterProjection, FallenEarlEncounterState } from './encounter.js';

/** Source-backed S4 ability categories; the finite costs, trials and outcomes are game-original G. */
export const FALLEN_EARL_ABILITY_IDS = ['black-emperor.s4.bestow', 'black-emperor.s4.magnify', 'black-emperor.s4.exploit'] as const;
export type FallenEarlAbilityId = typeof FALLEN_EARL_ABILITY_IDS[number];
export type FallenEarlAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type FallenEarlCommand = FallenEarlAcquisitionCommand | FallenEarlActivityCommand | FallenEarlEncounterCommand;
export interface FallenEarlBottle {
  id: string;
  source: string;
  labourSteps: number;
  acquiredWeek: number | null;
  consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
  outcome: PublicResolutionTier | null;
}
export interface FallenEarlState {
  guidanceKnown: boolean;
  bottles: FallenEarlBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  mentorDisorderActingAtPromotion: number | null;
  life: FallenEarlLifeState;
  encounter: FallenEarlEncounterState;
}
export interface FallenEarlAction {
  id: string;
  label: string;
  cost: string;
  enabled: boolean;
  reason: string | null;
  command: FallenEarlCommand;
}
export interface FallenEarlProjection extends FallenEarlLifeProjection, FallenEarlEncounterProjection {
  title: string;
  discovered: boolean;
  guidanceKnown: boolean;
  promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string;
  inheritedTools: string;
  bodyChange: string;
  story?: string;
  actions: FallenEarlAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: FallenEarlCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number;
  digestion: string;
  pollution: number;
  risk: string;
}
export type { FallenEarlActivityCommand, FallenEarlLifeState, FallenEarlLifeProjection } from './life.js';
export type { FallenEarlEncounterCommand, FallenEarlEncounterState, FallenEarlEncounterProjection } from './encounter.js';
