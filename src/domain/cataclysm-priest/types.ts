import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { CataclysmPriestRitualCommand, CataclysmPriestRitualProjection, CataclysmPriestRitualState } from './ritual.js';
import type { CataclysmPriestActivityCommand, CataclysmPriestLifeProjection, CataclysmPriestLifeState } from './life.js';
import type { CataclysmPriestEncounterCommand, CataclysmPriestEncounterProjection, CataclysmPriestEncounterState } from './encounter.js';

export const CATACLYSM_PRIEST_ABILITY_IDS = ['tyrant.s4.sea-tornado', 'tyrant.s4.surge-control', 'tyrant.s4.great-lightning'] as const;
export type CataclysmPriestAbilityId = typeof CATACLYSM_PRIEST_ABILITY_IDS[number];
export type CataclysmPriestAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type CataclysmPriestCommand = CataclysmPriestAcquisitionCommand | CataclysmPriestRitualCommand | CataclysmPriestActivityCommand | CataclysmPriestEncounterCommand;
export interface CataclysmPriestBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
  ritualId: string | null; ritualWindowWeek: number | null;
}
export interface CataclysmPriestState {
  guidanceKnown: boolean; bottles: CataclysmPriestBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; oceanSingerActingAtPromotion: number | null;
  ritual: CataclysmPriestRitualState; life: CataclysmPriestLifeState; encounter: CataclysmPriestEncounterState;
}
export interface CataclysmPriestAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: CataclysmPriestCommand;
}
export interface CataclysmPriestProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: CataclysmPriestAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: CataclysmPriestCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  ritual: CataclysmPriestRitualProjection; life: CataclysmPriestLifeProjection; encounter: CataclysmPriestEncounterProjection;
  insideCase: boolean; environment: string;
}
export type CataclysmPriestPublicView = CataclysmPriestProjection;

export type { CataclysmPriestRitualCommand, CataclysmPriestRitualProjection, CataclysmPriestRitualState } from './ritual.js';
