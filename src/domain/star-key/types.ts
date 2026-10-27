import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { StarKeyOriginals, StarKeyActivityCommand, StarKeyLifeProjection, StarKeyLifeState } from './life.js';
import type { StarKeyEncounterCommand, StarKeyEncounterProjection, StarKeyEncounterState } from './encounter.js';

export const STAR_KEY_ABILITY_IDS = ['door.s1.endpoint-location', 'door.s1.anchor-maintenance'] as const;
export type StarKeyAbilityId = typeof STAR_KEY_ABILITY_IDS[number];
export const STAR_KEY_PREPARATION_IDS = ['VERIFY_ORIGINALS', 'RECORD_ENDPOINTS', 'MARK_RETURN'] as const;
export type StarKeyPreparationId = typeof STAR_KEY_PREPARATION_IDS[number];
export type StarKeyAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: StarKeyPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION' | 'REQUEST_RECOVERY_V1' | 'RECOVER_CHARACTERISTIC_V1'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type StarKeyCommand = StarKeyAcquisitionCommand | StarKeyActivityCommand | StarKeyEncounterCommand;
/** The vessel may change; the three finite original characteristics do not. */
export interface StarKeyRecoveryRequest {
  version: 1; sourceBottleId: string; originalBottleId: string; characteristicId: string; requestedWeek: number; sourceReceiptRevision: number;
  siteId: 'BACKLUND_ORIGINAL_STAR_KEY_PREPARATION'; custodian: 'DR0-HURST';
}
export interface StarKeyRecovery extends StarKeyRecoveryRequest { recoveredWeek: number }
/** A contemporaneous, named permission and physical inspection. It is never inferred from old consent. */
export interface StarKeyRecoverySite {
  siteId: 'BACKLUND_ORIGINAL_STAR_KEY_PREPARATION'; originals: StarKeyOriginals;
  permission: { personId: 'DR0-HURST'; week: number; revision: number; purpose: 'INVESTIGATE' | 'RECOVER' };
  originalBottleId: string; sourceBottleId: string; characteristicId: string; sourceReceiptRevision: number;
  custodyBefore: 'FAILED_REMNANT' | 'SEALED_WITH_CUSTODIAN'; custodyAfter: 'SEALED_WITH_CUSTODIAN' | 'SUPPLIER';
}
export interface StarKeyOriginalCharacteristic {
  characteristicId: string; originalBottleId: string; latestBottleId: string;
  holder: 'SUPPLIER' | 'PLAYER' | 'FAILED_REMNANT' | 'EMBODIED';
  consumptionHistory: { bottleId: string; revision: number; week: number; outcome: PublicResolutionTier }[];
}
export interface StarKeyOriginalCharacteristics {
  characteristics: StarKeyOriginalCharacteristic[];
  embodiedOriginalBottleId: string | null; embodiedBottleId: string | null;
}
export interface StarKeyBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
  recovery?: StarKeyRecovery;
}
/** Bounded acquisition evidence; inherited people, bodies, effects and inventory stay in their source history. */
export interface StarKeyAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  gender: string; sequence: 2 | 1; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number;
}
export type StarKeyFinanceSnapshot = Pick<SliceState, 'weeklyBudget' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface StarKeyAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: StarKeyAcquisitionCommand;
  actor: { name: string; gender: string; age: number; sourceHistoryDigest: string | null; sourceIdentityDigest: string; pathwayId: 'door'; planeswalkerPromotionWeek: number; apprenticePromotionWeek: number };
  before: StarKeyAcquisitionBudget; after: StarKeyAcquisitionBudget; finance: StarKeyFinanceSnapshot;
  cursorBefore: number; cursorAfter: number; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
  recoverySite?: StarKeyRecoverySite;
}
export const STAR_KEY_SOURCE_KEYS = ['apprentice', 'trickmaster', 'astrologer', 'recorder', 'traveler', 'secretsSorcerer', 'wanderer', 'planeswalker'] as const;
export type StarKeySourceHistory = Pick<SliceState, typeof STAR_KEY_SOURCE_KEYS[number]>;
export type { StarKeyOriginals } from './life.js';
export interface StarKeySourceScene {
  week: number; date: PublicGameDate; revision: number; random: SliceState['random'];
  budget: StarKeyAcquisitionBudget; finance: StarKeyFinanceSnapshot; identityDigest: string; historyDigest: string;
  character: SliceState['character']; originals: StarKeyOriginals;
  combatHistoryLength: number; combatHistoryDigest: string; city: 'BACKLUND';
}
export interface StarKeyState {
  guidanceKnown: boolean; bottles: StarKeyBottle[];
  resupply: { requestedWeek: number | null; deliveries: number; recovery?: StarKeyRecoveryRequest };
  promotionWeek: number | null; planeswalkerActingAtPromotion: number | null;
  preparations: { taskId: StarKeyPreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: StarKeyAcquisitionEvent[];
  /** Single frozen eight-root history; only authoritative original resource fields can evolve. */
  sourceHistory: StarKeySourceHistory | null; sourceScene: StarKeySourceScene | null;
  life: StarKeyLifeState; encounter: StarKeyEncounterState;
}
export interface StarKeyAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: StarKeyCommand; cleanup?: boolean; preferredAction?: boolean;
}
export interface StarKeyProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: StarKeyAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: StarKeyAcquisitionCommand }[];
  preparations: { taskId: StarKeyPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  characterName: string; currentGender: string; originalGender: string | null; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  life: StarKeyLifeProjection; encounter: StarKeyEncounterProjection;
  insideCase: boolean; environment: string;
}
export type StarKeyPublicView = StarKeyProjection;
export type { StarKeyActivityCommand, StarKeyLifeProjection, StarKeyLifeState } from './life.js';
export type { StarKeyEncounterCommand, StarKeyEncounterProjection, StarKeyEncounterState } from './encounter.js';
