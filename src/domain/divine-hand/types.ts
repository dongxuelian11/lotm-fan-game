import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { DivineHandOriginals, DivineHandActivityCommand, DivineHandLifeProjection, DivineHandLifeState } from './life.js';
import type { DivineHandEncounterCommand, DivineHandEncounterProjection, DivineHandEncounterState } from './encounter.js';

export const DIVINE_HAND_ABILITY_IDS = ['warrior.s1.beam-stabilize', 'warrior.s1.armor-convergence'] as const;
export type DivineHandAbilityId = typeof DIVINE_HAND_ABILITY_IDS[number];
export const DIVINE_HAND_PREPARATION_IDS = ['VERIFY_ORIGINALS', 'PLAN_FINITE_LOAD', 'CHECK_RETURN'] as const;
export type DivineHandPreparationId = typeof DIVINE_HAND_PREPARATION_IDS[number];
export type DivineHandAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: DivineHandPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION' | 'REQUEST_RECOVERY_V1' | 'RECOVER_CHARACTERISTIC_V1'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type DivineHandCommand = DivineHandAcquisitionCommand | DivineHandActivityCommand | DivineHandEncounterCommand;
/** The vessel may change; the three finite original characteristics do not. */
export interface DivineHandRecoveryRequest {
  version: 1; sourceBottleId: string; originalBottleId: string; characteristicId: string; requestedWeek: number; sourceReceiptRevision: number;
  siteId: 'BACKLUND_ORIGINAL_DIVINE_HAND_PREPARATION'; custodian: 'TG220-DIVINE-HAND-SUPPLIER';
}
export interface DivineHandRecovery extends DivineHandRecoveryRequest { recoveredWeek: number }
/** A contemporaneous supplier permission and physical inspection. It is never inferred from old consent. */
export interface DivineHandRecoverySite {
  siteId: 'BACKLUND_ORIGINAL_DIVINE_HAND_PREPARATION'; originals: DivineHandOriginals;
  permission: { personId: 'TG220-DIVINE-HAND-SUPPLIER'; week: number; revision: number; purpose: 'INVESTIGATE' | 'RECOVER' };
  originalBottleId: string; sourceBottleId: string; characteristicId: string; sourceReceiptRevision: number;
  custodyBefore: 'FAILED_REMNANT' | 'SEALED_WITH_CUSTODIAN'; custodyAfter: 'SEALED_WITH_CUSTODIAN' | 'SUPPLIER';
}
export interface DivineHandOriginalCharacteristic {
  characteristicId: string; originalBottleId: string; latestBottleId: string;
  holder: 'SUPPLIER' | 'PLAYER' | 'FAILED_REMNANT' | 'EMBODIED';
  consumptionHistory: { bottleId: string; revision: number; week: number; outcome: PublicResolutionTier }[];
}
export interface DivineHandOriginalCharacteristics {
  characteristics: DivineHandOriginalCharacteristic[];
  embodiedOriginalBottleId: string | null; embodiedBottleId: string | null;
}
export interface DivineHandBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
  recovery?: DivineHandRecovery;
}
/** Bounded acquisition evidence; inherited people, bodies, effects and inventory stay in their source history. */
export interface DivineHandAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  gender: string; sequence: 2 | 1; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number;
}
export type DivineHandFinanceSnapshot = Pick<SliceState, 'weeklyBudget' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface DivineHandAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: DivineHandAcquisitionCommand;
  actor: { name: string; gender: string; age: number; sourceHistoryDigest: string | null; sourceIdentityDigest: string; pathwayId: 'warrior'; gloryPromotionWeek: number; warriorPromotionWeek: number };
  before: DivineHandAcquisitionBudget; after: DivineHandAcquisitionBudget; finance: DivineHandFinanceSnapshot;
  cursorBefore: number; cursorAfter: number; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
  recoverySite?: DivineHandRecoverySite;
}
export const DIVINE_HAND_SOURCE_KEYS = ['warrior', 'gladiator', 'weaponmaster', 'dawnPaladin', 'guardian', 'demonHunter', 'silverKnight', 'glory'] as const;
export type DivineHandSourceHistory = Pick<SliceState, typeof DIVINE_HAND_SOURCE_KEYS[number]>;
export type { DivineHandOriginals } from './life.js';
export interface DivineHandSourceScene {
  week: number; date: PublicGameDate; revision: number; random: SliceState['random'];
  budget: DivineHandAcquisitionBudget; finance: DivineHandFinanceSnapshot; identityDigest: string; historyDigest: string;
  character: SliceState['character']; originals: DivineHandOriginals;
  combatHistoryLength: number; combatHistoryDigest: string; city: 'BACKLUND';
}
export interface DivineHandState {
  guidanceKnown: boolean; bottles: DivineHandBottle[];
  resupply: { requestedWeek: number | null; deliveries: number; recovery?: DivineHandRecoveryRequest };
  promotionWeek: number | null; gloryActingAtPromotion: number | null;
  preparations: { taskId: DivineHandPreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: DivineHandAcquisitionEvent[];
  /** Single frozen eight-root history; only authoritative original resource fields can evolve. */
  sourceHistory: DivineHandSourceHistory | null; sourceScene: DivineHandSourceScene | null;
  life: DivineHandLifeState; encounter: DivineHandEncounterState;
}
export interface DivineHandAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: DivineHandCommand; cleanup?: boolean; preferredAction?: boolean;
}
export interface DivineHandProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: DivineHandAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: DivineHandAcquisitionCommand }[];
  preparations: { taskId: DivineHandPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  characterName: string; currentGender: string; originalGender: string | null; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  life: DivineHandLifeProjection; encounter: DivineHandEncounterProjection;
  insideCase: boolean; environment: string;
}
export type DivineHandPublicView = DivineHandProjection;
export type { DivineHandActivityCommand, DivineHandLifeProjection, DivineHandLifeState } from './life.js';
export type { DivineHandEncounterCommand, DivineHandEncounterProjection, DivineHandEncounterState } from './encounter.js';
