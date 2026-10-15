import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { MisfortuneMageActivityCommand, MisfortuneMageLifeProjection, MisfortuneMageLifeState } from './life.js';
import type { MisfortuneMageEncounterCommand, MisfortuneMageEncounterProjection, MisfortuneMageEncounterState } from './encounter.js';

/** Candidate S4 training IDs, explicitly game-original G; no verified original S4 skill list. */
export const MISFORTUNE_MAGE_ABILITY_IDS = ['wheel.s4.precaution-practice', 'wheel.s4.bounded-misfortune'] as const;
export type MisfortuneMageAbilityId = typeof MISFORTUNE_MAGE_ABILITY_IDS[number];
export type MisfortuneMageAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type MisfortuneMageCommand = MisfortuneMageAcquisitionCommand | MisfortuneMageActivityCommand | MisfortuneMageEncounterCommand;
export interface MisfortuneMageBottle {
  id: string;
  source: string;
  labourSteps: number;
  acquiredWeek: number | null;
  consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
  outcome: PublicResolutionTier | null;
}
export interface MisfortuneMageState {
  guidanceKnown: boolean;
  bottles: MisfortuneMageBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  winnerActingAtPromotion: number | null;
  life: MisfortuneMageLifeState;
  encounter: MisfortuneMageEncounterState;
}
export interface MisfortuneMageAction {
  id: string;
  label: string;
  cost: string;
  enabled: boolean;
  reason: string | null;
  command: MisfortuneMageCommand;
}
export interface MisfortuneMageProjection extends MisfortuneMageLifeProjection, MisfortuneMageEncounterProjection {
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
  actions: MisfortuneMageAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: MisfortuneMageCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number;
  digestion: string;
  pollution: number;
  risk: string;
}
export type { MisfortuneMageActivityCommand, MisfortuneMageLifeState, MisfortuneMageLifeProjection } from './life.js';
export type { MisfortuneMageEncounterCommand, MisfortuneMageEncounterState, MisfortuneMageEncounterProjection } from './encounter.js';
