import type { ShepherdProjection } from '../shepherd/types.js';
import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { BlackKnightActivityCommand, BlackKnightLifeProjection, BlackKnightLifeState } from './life.js';
import type { BlackKnightEncounterCommand, BlackKnightEncounterProjection, BlackKnightEncounterState } from './encounter.js';

export const BLACK_KNIGHT_ABILITY_IDS = ['hanged-man.s4.flesh-soul-blade', 'hanged-man.s4.shadow-command', 'hanged-man.s4.fallen-shadow'] as const;
export type BlackKnightAbilityId = typeof BLACK_KNIGHT_ABILITY_IDS[number];
export type BlackKnightAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type BlackKnightCommand = BlackKnightAcquisitionCommand | BlackKnightActivityCommand | BlackKnightEncounterCommand;
export interface BlackKnightBottle {
  id: string;
  source: string;
  labourSteps: number;
  acquiredWeek: number | null;
  consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
  outcome: PublicResolutionTier | null;
}
export interface BlackKnightState {
  guidanceKnown: boolean;
  bottles: BlackKnightBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  shepherdActingAtPromotion: number | null;
  life: BlackKnightLifeState;
  encounter: BlackKnightEncounterState;
}
export interface BlackKnightAction {
  id: string;
  label: string;
  cost: string;
  enabled: boolean;
  reason: string | null;
  command: BlackKnightCommand;
}
export interface BlackKnightProjection extends BlackKnightLifeProjection, BlackKnightEncounterProjection {
  title: string;
  discovered: boolean;
  guidanceKnown: boolean;
  promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string;
  inheritedTools: string;
  grazing: ShepherdProjection['grazing'];
  reserve?: ShepherdProjection['reserve'];
  bodyChange: string;
  story?: string;
  actions: BlackKnightAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: BlackKnightCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number;
  digestion: string;
  pollution: number;
  risk: string;
}
export type { BlackKnightActivityCommand, BlackKnightLifeState, BlackKnightLifeProjection } from './life.js';
export type { BlackKnightEncounterCommand, BlackKnightEncounterState, BlackKnightEncounterProjection } from './encounter.js';
