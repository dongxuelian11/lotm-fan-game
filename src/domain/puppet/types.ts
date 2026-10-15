import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { PuppetActivityCommand, PuppetLifeProjection, PuppetLifeState } from './life.js';
import type { PuppetEncounterCommand, PuppetEncounterProjection, PuppetEncounterState } from './encounter.js';

/** Source-backed S4 ability categories; the finite costs, trials and outcomes are game-original G. */
export const PUPPET_ABILITY_IDS = ['chained.s4.object-motion', 'chained.s4.cursed-form', 'chained.s4.curse-link'] as const;
export type PuppetAbilityId = typeof PUPPET_ABILITY_IDS[number];
export type PuppetAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type PuppetCommand = PuppetAcquisitionCommand | PuppetActivityCommand | PuppetEncounterCommand;
export interface PuppetBottle {
  id: string;
  source: string;
  labourSteps: number;
  acquiredWeek: number | null;
  consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
  outcome: PublicResolutionTier | null;
}
export interface PuppetState {
  guidanceKnown: boolean;
  bottles: PuppetBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  wraithActingAtPromotion: number | null;
  life: PuppetLifeState;
  encounter: PuppetEncounterState;
}
export interface PuppetAction {
  id: string;
  label: string;
  cost: string;
  enabled: boolean;
  reason: string | null;
  command: PuppetCommand;
}
export interface PuppetProjection extends PuppetLifeProjection, PuppetEncounterProjection {
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
  actions: PuppetAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: PuppetCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number;
  digestion: string;
  pollution: number;
  risk: string;
}
export type { PuppetActivityCommand, PuppetLifeState, PuppetLifeProjection } from './life.js';
export type { PuppetEncounterCommand, PuppetEncounterState, PuppetEncounterProjection } from './encounter.js';
