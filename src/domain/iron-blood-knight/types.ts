import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { IronBloodTeamCommand, IronBloodTeamProjection, IronBloodTeamState } from './team.js';
import type { IronBloodActivityCommand, IronBloodLifeProjection, IronBloodLifeState } from './life.js';
import type { IronBloodEncounterCommand, IronBloodEncounterProjection, IronBloodEncounterState } from './encounter.js';

export const IRON_BLOOD_KNIGHT_ABILITY_IDS = ['hunter.s4.flame-steel', 'hunter.s4.comrade-link'] as const;
export type IronBloodKnightAbilityId = typeof IRON_BLOOD_KNIGHT_ABILITY_IDS[number];
export type IronBloodKnightAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' } | { type: 'REQUEST_SUPPLY' } | { type: 'RECEIVE_SUPPLY' }
  | { type: 'POTION_WORK'; bottleId: string } | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true; acceptBodyChange: true };
export type IronBloodKnightCommand = IronBloodKnightAcquisitionCommand | IronBloodTeamCommand | IronBloodActivityCommand | IronBloodEncounterCommand;

export interface IronBloodKnightBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
  ritualId: string | null; ritualParticipantIds: string[]; ritualArrivalWeek: number | null;
}
export interface IronBloodKnightState {
  guidanceKnown: boolean; bottles: IronBloodKnightBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; reaperActingAtPromotion: number | null;
  /** The body's actual gender immediately before its first real attempt; never a creation rewrite. */
  originalGender: string | null;
  team: IronBloodTeamState; life: IronBloodLifeState; encounter: IronBloodEncounterState;
}
export interface IronBloodKnightAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: IronBloodKnightCommand;
}
export interface IronBloodKnightProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: IronBloodKnightAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: IronBloodKnightCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  bodyChange: string; originalGender: string | null; currentGender: string;
  team: IronBloodTeamProjection; life: IronBloodLifeProjection; encounter: IronBloodEncounterProjection;
  insideCase: boolean; environment: string;
}
export type IronBloodKnightPublicView = IronBloodKnightProjection;
