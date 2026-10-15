import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { DevilActivityCommand, DevilLifeProjection, DevilLifeState } from './life.js';
import type { DevilEncounterCommand, DevilEncounterProjection, DevilEncounterState } from './encounter.js';

/** These S4 training labels and strengthened inherited mechanics are game-original G. */
export const DEVIL_ABILITY_IDS = ['abyss.s4.desire-focus', 'abyss.s4.catalytic-pressure'] as const;
export type DevilAbilityId = typeof DEVIL_ABILITY_IDS[number];
export type DevilAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type DevilCommand = DevilAcquisitionCommand | DevilActivityCommand | DevilEncounterCommand;
export interface DevilBottle {
  id: string;
  source: string;
  labourSteps: number;
  acquiredWeek: number | null;
  consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
  outcome: PublicResolutionTier | null;
}
export interface DevilState {
  guidanceKnown: boolean;
  bottles: DevilBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  desireApostleActingAtPromotion: number | null;
  life: DevilLifeState;
  encounter: DevilEncounterState;
}
export interface DevilAction {
  id: string;
  label: string;
  cost: string;
  enabled: boolean;
  reason: string | null;
  command: DevilCommand;
}
export interface DevilProjection extends DevilLifeProjection, DevilEncounterProjection {
  title: string;
  discovered: boolean;
  guidanceKnown: boolean;
  promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string;
  inheritedTools: string;
  strain: number;
  bodyChange: string;
  story?: string;
  actions: DevilAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: DevilCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number;
  digestion: string;
  pollution: number;
  risk: string;
}
export type { DevilActivityCommand, DevilLifeState, DevilLifeProjection } from './life.js';
export type { DevilEncounterCommand, DevilEncounterState, DevilEncounterProjection } from './encounter.js';
