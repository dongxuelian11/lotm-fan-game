import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { SilentDiscipleActivityCommand, SilentDiscipleLifeProjection, SilentDiscipleLifeState } from './life.js';
import type { SilentDiscipleEncounterCommand, SilentDiscipleEncounterProjection, SilentDiscipleEncounterState } from './encounter.js';

export const SILENT_DISCIPLE_ABILITY_IDS = ['chained.s3.short-transfiguration', 'chained.s3.measured-curse'] as const;
export type SilentDiscipleAbilityId = typeof SILENT_DISCIPLE_ABILITY_IDS[number];
export const SILENT_DISCIPLE_PREPARATION_IDS = ['REVIEW_RECORDS', 'CHECK_LIMITS', 'MARK_EXIT'] as const;
export type SilentDisciplePreparationId = typeof SILENT_DISCIPLE_PREPARATION_IDS[number];
export type SilentDiscipleAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: SilentDisciplePreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type SilentDiscipleCommand = SilentDiscipleAcquisitionCommand | SilentDiscipleActivityCommand | SilentDiscipleEncounterCommand;
export interface SilentDiscipleBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface SilentDiscipleState {
  guidanceKnown: boolean; bottles: SilentDiscipleBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; puppetActingAtPromotion: number | null;
  preparations: { taskId: SilentDisciplePreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  life: SilentDiscipleLifeState; encounter: SilentDiscipleEncounterState;
}
export interface SilentDiscipleAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SilentDiscipleCommand;
}
export interface SilentDiscipleProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: SilentDiscipleAction[]; nextStep: string; preferredActionId: string | null;
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: SilentDiscipleAcquisitionCommand }[];
  preparations: { taskId: SilentDisciplePreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  inheritedHistory: string[]; inheritedTools: string;
  life: SilentDiscipleLifeProjection; encounter: SilentDiscipleEncounterProjection;
  insideCase: boolean; environment: string;
}
export type SilentDisciplePublicView = SilentDiscipleProjection;

export type { SilentDiscipleActivityCommand, SilentDiscipleLifeProjection, SilentDiscipleLifeState } from './life.js';
export type { SilentDiscipleEncounterCommand, SilentDiscipleEncounterProjection, SilentDiscipleEncounterState } from './encounter.js';
