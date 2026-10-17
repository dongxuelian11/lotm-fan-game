import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { FateTrojanActivityCommand, FateTrojanLifeProjection, FateTrojanLifeState } from './life.js';
import type { FateTrojanEncounterCommand, FateTrojanEncounterProjection, FateTrojanEncounterState } from './encounter.js';

export const FATE_TROJAN_ABILITY_IDS = ['error.s2.identity-link', 'error.s2.fate-assumption'] as const;
export type FateTrojanAbilityId = typeof FATE_TROJAN_ABILITY_IDS[number];
export const FATE_TROJAN_PREPARATION_IDS = ['VERIFY_PERSON', 'TRACE_LINK', 'PLAN_RETURN'] as const;
export type FateTrojanPreparationId = typeof FATE_TROJAN_PREPARATION_IDS[number];
export type FateTrojanAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: FateTrojanPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type FateTrojanCommand = FateTrojanAcquisitionCommand | FateTrojanActivityCommand | FateTrojanEncounterCommand;
export interface FateTrojanBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface FateTrojanState {
  guidanceKnown: boolean; bottles: FateTrojanBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; deceitMentorActingAtPromotion: number | null;
  preparations: { taskId: FateTrojanPreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  life: FateTrojanLifeState; encounter: FateTrojanEncounterState;
}
export interface FateTrojanAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: FateTrojanCommand;
}
export interface FateTrojanProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: FateTrojanAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: FateTrojanAcquisitionCommand }[];
  preparations: { taskId: FateTrojanPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; inheritedHistory: string[];
  life: FateTrojanLifeProjection; encounter: FateTrojanEncounterProjection;
  insideCase: boolean; environment: string;
}
export type FateTrojanPublicView = FateTrojanProjection;
