import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { WarBishopActivityCommand, WarBishopLifeProjection, WarBishopLifeState } from './life.js';
import type { WarBishopEncounterCommand, WarBishopEncounterProjection, WarBishopEncounterState } from './encounter.js';

export const WAR_BISHOP_ABILITY_IDS = ['hunter.s3.formation-link', 'hunter.s3.coordinated-action'] as const;
export type WarBishopAbilityId = typeof WAR_BISHOP_ABILITY_IDS[number];
export const WAR_BISHOP_PREPARATION_IDS = ['INSPECT_ROUTE', 'CHECK_EQUIPMENT', 'PLAN_SUPPORT'] as const;
export type WarBishopPreparationId = typeof WAR_BISHOP_PREPARATION_IDS[number];
export type WarBishopAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: WarBishopPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type WarBishopTeamCommand = { type: 'REST_TEAM' | 'RECOVER_TEAM' };
export type WarBishopCommand = WarBishopAcquisitionCommand | WarBishopTeamCommand | WarBishopActivityCommand | WarBishopEncounterCommand;
export interface WarBishopBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface WarBishopState {
  guidanceKnown: boolean; bottles: WarBishopBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; ironBloodActingAtPromotion: number | null;
  preparations: { taskId: WarBishopPreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  /** Original member health, energy, willingness and presence remain solely in ironBloodKnight.team.members. */
  life: WarBishopLifeState; encounter: WarBishopEncounterState;
}
export interface WarBishopAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: WarBishopCommand;
}
export interface WarBishopProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: WarBishopAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: WarBishopAcquisitionCommand }[];
  preparations: { taskId: WarBishopPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; originalGender: string | null; inheritedHistory: string[];
  life: WarBishopLifeProjection; encounter: WarBishopEncounterProjection;
  insideCase: boolean; environment: string;
}
export type WarBishopPublicView = WarBishopProjection;
