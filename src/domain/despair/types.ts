import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { DespairActivityCommand, DespairLifeProjection, DespairLifeState } from './life.js';
import type { DespairEncounterCommand, DespairEncounterProjection, DespairEncounterState } from './encounter.js';

export const DESPAIR_ABILITY_IDS = ['assassin.s4.plague'] as const;
export type DespairAbilityId = typeof DESPAIR_ABILITY_IDS[number];
export type DespairAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type DespairCommand = DespairAcquisitionCommand | DespairActivityCommand | DespairEncounterCommand;
export interface DespairBottle {
  id: string;
  source: string;
  labourSteps: number;
  acquiredWeek: number | null;
  consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
  outcome: PublicResolutionTier | null;
}
export interface DespairState {
  guidanceKnown: boolean;
  bottles: DespairBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  painActingAtPromotion: number | null;
  life: DespairLifeState;
  encounter: DespairEncounterState;
}
export interface DespairAction {
  id: string;
  label: string;
  cost: string;
  enabled: boolean;
  reason: string | null;
  command: DespairCommand;
}
export interface DespairProjection extends DespairLifeProjection, DespairEncounterProjection {
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
  actions: DespairAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: DespairCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number;
  digestion: string;
  pollution: number;
  risk: string;
}
export type { DespairActivityCommand, DespairLifeState, DespairLifeProjection } from './life.js';
export type { DespairEncounterCommand, DespairEncounterState, DespairEncounterProjection } from './encounter.js';
