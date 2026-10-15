import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { KnowledgeMentorActivityCommand, KnowledgeMentorLifeProjection, KnowledgeMentorLifeState } from './life.js';
import type { KnowledgeMentorEncounterCommand, KnowledgeMentorEncounterProjection, KnowledgeMentorEncounterState } from './encounter.js';

export const KNOWLEDGE_MENTOR_ABILITY_IDS = ['paragon.s2.protocol-binding', 'paragon.s2.bounded-calibration'] as const;
export type KnowledgeMentorAbilityId = typeof KNOWLEDGE_MENTOR_ABILITY_IDS[number];
export const KNOWLEDGE_MENTOR_PREPARATION_IDS = ['INSPECT_RECORDS', 'CHECK_ORIGINALS', 'PLAN_WITHDRAWAL'] as const;
export type KnowledgeMentorPreparationId = typeof KNOWLEDGE_MENTOR_PREPARATION_IDS[number];
export type KnowledgeMentorAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: KnowledgeMentorPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type KnowledgeMentorCommand = KnowledgeMentorAcquisitionCommand | KnowledgeMentorActivityCommand | KnowledgeMentorEncounterCommand;
export interface KnowledgeMentorBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface KnowledgeMentorState {
  guidanceKnown: boolean; bottles: KnowledgeMentorBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; arcaneScholarActingAtPromotion: number | null;
  preparations: { taskId: KnowledgeMentorPreparationId; completedWeek: number }[];
  preparedWeek: number | null;
  life: KnowledgeMentorLifeState; encounter: KnowledgeMentorEncounterState;
}
export interface KnowledgeMentorAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: KnowledgeMentorCommand;
}
export interface KnowledgeMentorProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: KnowledgeMentorAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: KnowledgeMentorAcquisitionCommand }[];
  preparations: { taskId: KnowledgeMentorPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; inheritedHistory: string[];
  life: KnowledgeMentorLifeProjection; encounter: KnowledgeMentorEncounterProjection;
  insideCase: boolean; environment: string;
}
export type KnowledgeMentorPublicView = KnowledgeMentorProjection;
