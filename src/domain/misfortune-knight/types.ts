import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { MisfortuneKnightActivityCommand, MisfortuneKnightLifeProjection, MisfortuneKnightLifeState } from './life.js';
import type { MisfortuneKnightEncounterCommand, MisfortuneKnightEncounterProjection, MisfortuneKnightEncounterState } from './encounter.js';

export const MISFORTUNE_KNIGHT_ABILITY_IDS = ['darkness.s1.guided-mishap', 'darkness.s1.bounded-night-guard'] as const;
export type MisfortuneKnightAbilityId = typeof MISFORTUNE_KNIGHT_ABILITY_IDS[number];
export const MISFORTUNE_KNIGHT_PREPARATION_IDS = ['REVIEW_RECORDS', 'CHECK_LIMITS', 'MARK_EXIT'] as const;
export type MisfortuneKnightPreparationId = typeof MISFORTUNE_KNIGHT_PREPARATION_IDS[number];
export type MisfortuneKnightAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: MisfortuneKnightPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION' | 'REQUEST_RECOVERY_V1' | 'RECOVER_CHARACTERISTIC_V1'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type MisfortuneKnightCommand = MisfortuneKnightAcquisitionCommand | MisfortuneKnightActivityCommand | MisfortuneKnightEncounterCommand;
/** A later drug vessel carries the same finite original; its attempt ID is not a new characteristic. */
export interface MisfortuneKnightRecoveryRequest {
  version: 1; sourceBottleId: string; originalBottleId: string; characteristicId: string; requestedWeek: number; sourceReceiptRevision: number;
  siteId: 'BACKLUND_ORIGINAL_ROOM_HANDOVER'; custodian: string;
}
export interface MisfortuneKnightRecovery extends MisfortuneKnightRecoveryRequest { recoveredWeek: number }
export interface MisfortuneKnightOriginalCharacteristic {
  characteristicId: string; originalBottleId: string; latestBottleId: string;
  holder: 'SUPPLIER' | 'PLAYER' | 'FAILED_REMAINS' | 'EMBODIED';
}
export interface MisfortuneKnightOriginalCharacteristics {
  characteristics: MisfortuneKnightOriginalCharacteristic[];
  embodiedOriginalBottleId: string | null; embodiedBottleId: string | null;
}
export interface MisfortuneKnightBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
  recovery?: MisfortuneKnightRecovery;
}
/** Bounded acquisition evidence; inherited people, bodies, effects and inventory stay in their source history. */
export interface MisfortuneKnightAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  gender: string; sequence: 2 | 1; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number;
}
export interface MisfortuneKnightAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: MisfortuneKnightAcquisitionCommand;
  actor: { name: string; gender: string; age: number; sourceHistoryDigest: string | null; sourceIdentityDigest: string; pathwayId: 'darkness'; concealmentServantPromotionWeek: number; sleeplessPromotionWeek: number };
  before: MisfortuneKnightAcquisitionBudget; after: MisfortuneKnightAcquisitionBudget;
  cursorBefore: number; cursorAfter: number; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
}
export const MISFORTUNE_KNIGHT_SOURCE_KEYS = ['sleepless', 'midnight', 'nightmare', 'soother', 'spiritWarlock', 'nightwatcher', 'fearBishop', 'concealmentServant'] as const;
export type MisfortuneKnightSourceHistory = Pick<SliceState, typeof MISFORTUNE_KNIGHT_SOURCE_KEYS[number]>;
export type MisfortuneKnightOriginals = Pick<SliceState['concealmentServant']['life'], 'playerLocation' | 'playerTravelMetres' | 'clockSeconds' | 'erin' | 'room' | 'box' | 'page' | 'trace' | 'anchorLight'>;
export interface MisfortuneKnightSourceScene {
  week: number; date: PublicGameDate; revision: number; random: SliceState['random'];
  budget: MisfortuneKnightAcquisitionBudget; identityDigest: string; historyDigest: string;
  character: SliceState['character']; originals: MisfortuneKnightOriginals;
  companion: SliceState['spiritWarlock']['companion']; combatHistoryLength: number; combatHistoryDigest: string; city: 'BACKLUND';
}
export interface MisfortuneKnightState {
  guidanceKnown: boolean; bottles: MisfortuneKnightBottle[];
  resupply: { requestedWeek: number | null; deliveries: number; recovery?: MisfortuneKnightRecoveryRequest };
  promotionWeek: number | null; concealmentServantActingAtPromotion: number | null;
  preparations: { taskId: MisfortuneKnightPreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: MisfortuneKnightAcquisitionEvent[];
  /** Single frozen eight-root history; only authoritative original resource fields can evolve. */
  sourceHistory: MisfortuneKnightSourceHistory | null; sourceScene: MisfortuneKnightSourceScene | null;
  life: MisfortuneKnightLifeState; encounter: MisfortuneKnightEncounterState;
}
export interface MisfortuneKnightAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: MisfortuneKnightCommand; cleanup?: boolean; preferredAction?: boolean;
}
export interface MisfortuneKnightProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: MisfortuneKnightAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: MisfortuneKnightAcquisitionCommand }[];
  preparations: { taskId: MisfortuneKnightPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  characterName: string; currentGender: string; originalGender: string | null; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  life: MisfortuneKnightLifeProjection; encounter: MisfortuneKnightEncounterProjection;
  insideCase: boolean; environment: string;
}
export type MisfortuneKnightPublicView = MisfortuneKnightProjection;
export type { MisfortuneKnightActivityCommand, MisfortuneKnightLifeProjection, MisfortuneKnightLifeState } from './life.js';
export type { MisfortuneKnightEncounterCommand, MisfortuneKnightEncounterProjection, MisfortuneKnightEncounterState } from './encounter.js';
