import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { PlaneswalkerActivityCommand, PlaneswalkerLifeProjection, PlaneswalkerLifeState } from './life.js';
import type { PlaneswalkerEncounterCommand, PlaneswalkerEncounterProjection, PlaneswalkerEncounterState } from './encounter.js';
import type { PlaneswalkerRitualCommand, PlaneswalkerRitualProjection, PlaneswalkerRitualState } from './ritual.js';

export const PLANESWALKER_ABILITY_IDS = ['door.s2.symbolic-transit', 'door.s2.pattern-reproduction'] as const;
export type PlaneswalkerAbilityId = typeof PLANESWALKER_ABILITY_IDS[number];
export const PLANESWALKER_PREPARATION_IDS = ['REVIEW_COORDINATES', 'CHECK_PROTECTION', 'PLAN_RETURN'] as const;
export type PlaneswalkerPreparationId = typeof PLANESWALKER_PREPARATION_IDS[number];
export const PLANESWALKER_AUXILIARY_KINDS = ['STAR_WORM', 'TIME_WORM', 'SPIRIT_WORM'] as const;
export type PlaneswalkerAuxiliaryKind = typeof PLANESWALKER_AUXILIARY_KINDS[number];
export type PlaneswalkerCustody = 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
export interface PlaneswalkerPrices { guidance: number; potion: number; labourCredit: number; labourBalance: number; preparation: number }
export type PlaneswalkerAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: PlaneswalkerPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type PlaneswalkerCommand = PlaneswalkerAcquisitionCommand | PlaneswalkerRitualCommand | PlaneswalkerActivityCommand | PlaneswalkerEncounterCommand;
export interface PlaneswalkerAuxiliaryItem {
  id: string; kind: PlaneswalkerAuxiliaryKind; name: string; quantity: 1;
  donorId: string; donorName: string; donorAge: number; donorPathway: 'door' | 'error' | 'diviner'; donorSequence: 4;
  receiptId: string; source: string; handedOverWeek: number | null; status: PlaneswalkerCustody;
}
export interface PlaneswalkerAuxiliaryKit {
  id: string; sealId: string; status: PlaneswalkerCustody;
  acquiredWeek: number | null; openedWeek: number | null; consumedWeek: number | null;
  /** Every actual paid check remains here, including checks followed by cancellation. */
  checkedWeeks: number[];
  items: PlaneswalkerAuxiliaryItem[];
}
export interface PlaneswalkerBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  /** Most recent real check of this original bottle and its own auxiliary kit; never cleared on leaving. */
  preparationWeek: number | null;
  status: PlaneswalkerCustody; outcome: PublicResolutionTier | null; auxiliaryKit: PlaneswalkerAuxiliaryKit;
}
export interface PlaneswalkerState {
  guidanceKnown: boolean; bottles: PlaneswalkerBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; wandererActingAtPromotion: number | null;
  preparations: { taskId: PlaneswalkerPreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  ritual: PlaneswalkerRitualState; life: PlaneswalkerLifeState; encounter: PlaneswalkerEncounterState;
}
export interface PlaneswalkerAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: PlaneswalkerCommand;
}
export interface PlaneswalkerProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  sourceLabel: string; prices: PlaneswalkerPrices | null;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: PlaneswalkerAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: PlaneswalkerAcquisitionCommand }[];
  preparations: { taskId: PlaneswalkerPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; inheritedHistory: string[];
  ritual: PlaneswalkerRitualProjection; life: PlaneswalkerLifeProjection; encounter: PlaneswalkerEncounterProjection;
  insideCase: boolean; environment: string;
}
export type PlaneswalkerPublicView = PlaneswalkerProjection;
export type { PlaneswalkerRitualCommand, PlaneswalkerRitualProjection, PlaneswalkerRitualState } from './ritual.js';
