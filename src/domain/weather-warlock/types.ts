import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { WeatherWarlockActivityCommand, WeatherWarlockLifeProjection, WeatherWarlockLifeState } from './life.js';
import type { WeatherWarlockEncounterCommand, WeatherWarlockEncounterProjection, WeatherWarlockEncounterState } from './encounter.js';

export const WEATHER_WARLOCK_ABILITY_IDS = ['hunter.s2.battle-fog', 'hunter.s2.frost', 'hunter.s2.storm'] as const;
export type WeatherWarlockAbilityId = typeof WEATHER_WARLOCK_ABILITY_IDS[number];
export const WEATHER_WARLOCK_PREPARATION_IDS = ['INSPECT_ROUTE', 'CHECK_EQUIPMENT', 'PLAN_SUPPORT'] as const;
export type WeatherWarlockPreparationId = typeof WEATHER_WARLOCK_PREPARATION_IDS[number];
export type WeatherWarlockAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: WeatherWarlockPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type WeatherWarlockTeamCommand = { type: 'REST_TEAM' | 'RECOVER_TEAM' };
export type WeatherWarlockCommand = WeatherWarlockAcquisitionCommand | WeatherWarlockTeamCommand | WeatherWarlockActivityCommand | WeatherWarlockEncounterCommand;
export interface WeatherWarlockBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface WeatherWarlockState {
  guidanceKnown: boolean; bottles: WeatherWarlockBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; warBishopActingAtPromotion: number | null;
  preparations: { taskId: WeatherWarlockPreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  /** Original member health, energy, willingness and presence remain solely in ironBloodKnight.team.members. */
  life: WeatherWarlockLifeState; encounter: WeatherWarlockEncounterState;
}
export interface WeatherWarlockAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: WeatherWarlockCommand;
}
export interface WeatherWarlockProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: WeatherWarlockAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: WeatherWarlockAcquisitionCommand }[];
  preparations: { taskId: WeatherWarlockPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; originalGender: string | null; inheritedHistory: string[];
  life: WeatherWarlockLifeProjection; encounter: WeatherWarlockEncounterProjection;
  insideCase: boolean; environment: string;
}
export type WeatherWarlockPublicView = WeatherWarlockProjection;
