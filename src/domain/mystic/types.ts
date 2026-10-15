import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { ScrollProfessorProjection } from '../scroll-professor/types.js';
import type { StarMysticWorkshopCommand } from '../star-mystic/types.js';
import type { MysticActivityCommand, MysticLifeProjection, MysticLifeState } from './life.js';
import type { MysticEncounterCommand, MysticEncounterProjection, MysticEncounterState } from './encounter.js';
import type { MysticRitualCommand, MysticRitualProjection, MysticRitualState } from './ritual.js';

export const MYSTIC_ABILITY_IDS = ['hermit.s4.mystical-reenactment', 'hermit.s4.shared-sight'] as const;
export type MysticAbilityId = typeof MYSTIC_ABILITY_IDS[number];
export type MysticAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' }
  | { type: 'BUY_LENSES' }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type MysticWorkshopCommand = StarMysticWorkshopCommand;
export type MysticCommand = MysticAcquisitionCommand | MysticWorkshopCommand | MysticRitualCommand | MysticActivityCommand | MysticEncounterCommand;
export interface MysticBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface MysticState {
  guidanceKnown: boolean; bottles: MysticBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; starMysticActingAtPromotion: number | null;
  ritual: MysticRitualState; life: MysticLifeState; encounter: MysticEncounterState;
}
export interface MysticAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: MysticCommand;
}
export interface MysticProjection extends MysticLifeProjection, MysticEncounterProjection, MysticRitualProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  supplies: string; inheritedTools: string; bodyChange: string; story?: string;
  actions: MysticAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: MysticCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  workshop?: ScrollProfessorProjection['workshop'];
}
export type { MysticActivityCommand, MysticLifeState, MysticLifeProjection } from './life.js';
export type { MysticEncounterCommand, MysticEncounterState, MysticEncounterProjection } from './encounter.js';
export type { MysticRitualCommand, MysticRitualState, MysticRitualProjection } from './ritual.js';
