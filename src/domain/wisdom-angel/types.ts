import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { WisdomAngelActivityCommand, WisdomAngelLifeProjection, WisdomAngelLifeState } from './life.js';
import type { WisdomAngelEncounterCommand, WisdomAngelEncounterProjection, WisdomAngelEncounterState } from './encounter.js';

export const WISDOM_ANGEL_ABILITY_IDS = ['reader.s2.conditional-synthesis', 'reader.s2.observed-response'] as const;
export type WisdomAngelAbilityId = typeof WISDOM_ANGEL_ABILITY_IDS[number];
export const WISDOM_ANGEL_PREPARATION_IDS = ['VERIFY_SOURCE', 'STATE_CONDITIONS', 'CHECK_LIMITS'] as const;
export type WisdomAngelPreparationId = typeof WISDOM_ANGEL_PREPARATION_IDS[number];
export type WisdomAngelAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: WisdomAngelPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type WisdomAngelCommand = { type: 'MAKE_INHERITED_FLASH' } | WisdomAngelAcquisitionCommand | WisdomAngelActivityCommand | WisdomAngelEncounterCommand;
export interface WisdomAngelBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface WisdomAngelState {
  guidanceKnown: boolean; bottles: WisdomAngelBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; insightScholarActingAtPromotion: number | null;
  preparations: { taskId: WisdomAngelPreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  life: WisdomAngelLifeState; encounter: WisdomAngelEncounterState;
}
export interface WisdomAngelAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: WisdomAngelCommand;
}
export interface WisdomAngelProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: WisdomAngelAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: WisdomAngelAcquisitionCommand }[];
  preparations: { taskId: WisdomAngelPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; inheritedHistory: string[];
  life: WisdomAngelLifeProjection; encounter: WisdomAngelEncounterProjection;
  insideCase: boolean; environment: string;
}
export type WisdomAngelPublicView = WisdomAngelProjection;
