import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { ImperativeMageActivityCommand, ImperativeMageLifeProjection, ImperativeMageLifeState } from './life.js';
import type { ImperativeMageEncounterCommand, ImperativeMageEncounterProjection, ImperativeMageEncounterState } from './encounter.js';

/** Source-backed S4 ability categories; the finite costs, trials and outcomes are game-original G. */
export const IMPERATIVE_MAGE_ABILITY_IDS = ['justiciar.s4.intimidation', 'justiciar.s4.deprivation'] as const;
export type ImperativeMageAbilityId = typeof IMPERATIVE_MAGE_ABILITY_IDS[number];
export type ImperativeMageAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type ImperativeMageCommand = ImperativeMageAcquisitionCommand | ImperativeMageActivityCommand | ImperativeMageEncounterCommand;
export interface ImperativeMageBottle {
  id: string;
  source: string;
  labourSteps: number;
  acquiredWeek: number | null;
  consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
  outcome: PublicResolutionTier | null;
}
export interface ImperativeMageState {
  guidanceKnown: boolean;
  bottles: ImperativeMageBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  punishmentKnightActingAtPromotion: number | null;
  life: ImperativeMageLifeState;
  encounter: ImperativeMageEncounterState;
}
export interface ImperativeMageAction {
  id: string;
  label: string;
  cost: string;
  enabled: boolean;
  reason: string | null;
  command: ImperativeMageCommand;
}
export interface ImperativeMageProjection extends ImperativeMageLifeProjection, ImperativeMageEncounterProjection {
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
  actions: ImperativeMageAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ImperativeMageCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number;
  digestion: string;
  pollution: number;
  risk: string;
}
export type { ImperativeMageActivityCommand, ImperativeMageLifeState, ImperativeMageLifeProjection } from './life.js';
export type { ImperativeMageEncounterCommand, ImperativeMageEncounterState, ImperativeMageEncounterProjection } from './encounter.js';
