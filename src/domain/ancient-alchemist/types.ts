import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { AncientAlchemistActivityCommand, AncientAlchemistLifeProjection, AncientAlchemistLifeState } from './life.js';
import type { AncientAlchemistEncounterCommand, AncientAlchemistEncounterProjection, AncientAlchemistEncounterState } from './encounter.js';

/** The S4 name and life-alchemy direction are source-backed; both finite abilities and all mechanics are original G. */
export const ANCIENT_ALCHEMIST_ABILITY_IDS = ['mother.s4.vital-knit', 'mother.s4.living-matrix'] as const;
export type AncientAlchemistAbilityId = typeof ANCIENT_ALCHEMIST_ABILITY_IDS[number];
export type AncientAlchemistAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type AncientAlchemistCommand = AncientAlchemistAcquisitionCommand | AncientAlchemistActivityCommand | AncientAlchemistEncounterCommand;
export interface AncientAlchemistBottle {
  id: string;
  source: string;
  labourSteps: number;
  acquiredWeek: number | null;
  consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
  outcome: PublicResolutionTier | null;
}
export interface AncientAlchemistState {
  guidanceKnown: boolean;
  bottles: AncientAlchemistBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  druidActingAtPromotion: number | null;
  life: AncientAlchemistLifeState;
  encounter: AncientAlchemistEncounterState;
}
export interface AncientAlchemistAction {
  id: string;
  label: string;
  cost: string;
  enabled: boolean;
  reason: string | null;
  command: AncientAlchemistCommand;
}
export interface AncientAlchemistProjection extends AncientAlchemistLifeProjection, AncientAlchemistEncounterProjection {
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
  actions: AncientAlchemistAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: AncientAlchemistCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number;
  digestion: string;
  pollution: number;
  risk: string;
}
export type { AncientAlchemistActivityCommand, AncientAlchemistLifeState, AncientAlchemistLifeProjection } from './life.js';
export type { AncientAlchemistEncounterCommand, AncientAlchemistEncounterState, AncientAlchemistEncounterProjection } from './encounter.js';
