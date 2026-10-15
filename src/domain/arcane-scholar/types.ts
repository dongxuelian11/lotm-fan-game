import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { ArcaneScholarActivityCommand, ArcaneScholarLifeProjection, ArcaneScholarLifeState } from './life.js';
import type { ArcaneScholarEncounterCommand, ArcaneScholarEncounterProjection, ArcaneScholarEncounterState } from './encounter.js';

export const ARCANE_SCHOLAR_ABILITY_IDS = ['paragon.s3.bounded-analysis', 'paragon.s3.construct-coordination'] as const;
export type ArcaneScholarAbilityId = typeof ARCANE_SCHOLAR_ABILITY_IDS[number];
export const ARCANE_SCHOLAR_PREPARATION_IDS = ['INSPECT_RECORDS', 'CHECK_ORIGINALS', 'PLAN_WITHDRAWAL'] as const;
export type ArcaneScholarPreparationId = typeof ARCANE_SCHOLAR_PREPARATION_IDS[number];
export type ArcaneScholarAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: ArcaneScholarPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type ArcaneScholarCommand = ArcaneScholarAcquisitionCommand | ArcaneScholarActivityCommand | ArcaneScholarEncounterCommand;
export interface ArcaneScholarBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface ArcaneScholarState {
  guidanceKnown: boolean; bottles: ArcaneScholarBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; alchemistActingAtPromotion: number | null;
  preparations: { taskId: ArcaneScholarPreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  life: ArcaneScholarLifeState; encounter: ArcaneScholarEncounterState;
}
export interface ArcaneScholarAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ArcaneScholarCommand;
}
export interface ArcaneScholarProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: ArcaneScholarAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ArcaneScholarAcquisitionCommand }[];
  preparations: { taskId: ArcaneScholarPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; inheritedHistory: string[];
  life: ArcaneScholarLifeProjection; encounter: ArcaneScholarEncounterProjection;
  insideCase: boolean; environment: string;
}
export type ArcaneScholarPublicView = ArcaneScholarProjection;
