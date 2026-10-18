import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { ThunderGodActivityCommand, ThunderGodLifeProjection, ThunderGodLifeState } from './life.js';
import type { ThunderGodEncounterCommand, ThunderGodEncounterProjection, ThunderGodEncounterState } from './encounter.js';

export const THUNDER_GOD_ABILITY_IDS = ['tyrant.s1.guided-thunder', 'tyrant.s1.storm-brace'] as const;
export type ThunderGodAbilityId = typeof THUNDER_GOD_ABILITY_IDS[number];
export const THUNDER_GOD_PREPARATION_IDS = ['VERIFY_ORIGINALS', 'LOCATE_TARGET', 'MARK_RETURN'] as const;
export type ThunderGodPreparationId = typeof THUNDER_GOD_PREPARATION_IDS[number];
export type ThunderGodAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: ThunderGodPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION' | 'REQUEST_RECOVERY_V1' | 'RECOVER_CHARACTERISTIC_V1' | 'STABILIZE_PROMOTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type ThunderGodCommand = ThunderGodAcquisitionCommand | ThunderGodActivityCommand | ThunderGodEncounterCommand;
/** The vessel may change; the three finite original characteristics do not. */
export interface ThunderGodRecoveryRequest {
  version: 1; sourceBottleId: string; originalBottleId: string; characteristicId: string; requestedWeek: number; sourceReceiptRevision: number;
  siteId: 'BACKLUND_ORIGINAL_COVE_EXIT'; custodian: 'CT2-NORA';
}
export interface ThunderGodRecovery extends ThunderGodRecoveryRequest { recoveredWeek: number }
/** A contemporaneous, named permission and physical inspection. It is never inferred from old consent. */
export interface ThunderGodRecoverySite {
  siteId: 'BACKLUND_ORIGINAL_COVE_EXIT'; originals: ThunderGodOriginals;
  permission: { personId: 'CT2-NORA'; week: number; revision: number; purpose: 'INVESTIGATE' | 'RECOVER' };
  originalBottleId: string; sourceBottleId: string; characteristicId: string; sourceReceiptRevision: number;
  custodyBefore: 'FAILED_REMNANT'; custodyAfter: 'FAILED_REMNANT' | 'SUPPLIER';
}
export interface ThunderGodOriginalCharacteristic {
  characteristicId: string; originalBottleId: string; latestBottleId: string;
  holder: 'SUPPLIER' | 'PLAYER' | 'FAILED_REMNANT' | 'EMBODIED';
  consumptionHistory: { bottleId: string; revision: number; week: number; outcome: PublicResolutionTier }[];
}
export interface ThunderGodOriginalCharacteristics {
  characteristics: ThunderGodOriginalCharacteristic[];
  embodiedOriginalBottleId: string | null; embodiedBottleId: string | null;
}
export interface ThunderGodBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
  recovery?: ThunderGodRecovery;
}
/** Bounded acquisition evidence; inherited people, bodies, effects and inventory stay in their source history. */
export interface ThunderGodAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  gender: string; sequence: 2 | 1; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number;
}
export interface ThunderGodAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: ThunderGodAcquisitionCommand;
  actor: { name: string; gender: string; age: number; sourceHistoryDigest: string | null; sourceIdentityDigest: string; pathwayId: 'tyrant'; catastrophePromotionWeek: number; sailorPromotionWeek: number };
  before: ThunderGodAcquisitionBudget; after: ThunderGodAcquisitionBudget;
  cursorBefore: number; cursorAfter: number; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
  recoverySite?: ThunderGodRecoverySite;
}
export const THUNDER_GOD_SOURCE_KEYS = ['sailor', 'rager', 'navigator', 'windBlessed', 'oceanSinger', 'cataclysmPriest', 'seaKing', 'catastrophe'] as const;
export type ThunderGodSourceHistory = Pick<SliceState, typeof THUNDER_GOD_SOURCE_KEYS[number]>;
export type ThunderGodOriginals = SliceState['catastrophe']['life']['site'];
export interface ThunderGodSourceScene {
  week: number; date: PublicGameDate; revision: number; random: SliceState['random'];
  budget: ThunderGodAcquisitionBudget; identityDigest: string; historyDigest: string;
  character: SliceState['character']; originals: ThunderGodOriginals;
  combatHistoryLength: number; combatHistoryDigest: string; city: 'BACKLUND';
}
export interface ThunderGodState {
  guidanceKnown: boolean; bottles: ThunderGodBottle[];
  resupply: { requestedWeek: number | null; deliveries: number; recovery?: ThunderGodRecoveryRequest };
  promotionWeek: number | null; catastropheActingAtPromotion: number | null;
  preparations: { taskId: ThunderGodPreparationId; completedWeek: number }[];
  promotionStability?: { preparations: ThunderGodPromotionStability[] };
  preparedWeek: number | null; acquisitionJournal: ThunderGodAcquisitionEvent[];
  /** Single frozen eight-root history; only authoritative original resource fields can evolve. */
  sourceHistory: ThunderGodSourceHistory | null; sourceScene: ThunderGodSourceScene | null;
  life: ThunderGodLifeState; encounter: ThunderGodEncounterState;
}
export interface ThunderGodAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ThunderGodCommand; cleanup?: boolean; preferredAction?: boolean;
}
export interface ThunderGodProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: ThunderGodAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ThunderGodAcquisitionCommand }[];
  preparations: { taskId: ThunderGodPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  characterName: string; currentGender: string; originalGender: string | null; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  life: ThunderGodLifeProjection; encounter: ThunderGodEncounterProjection;
  insideCase: boolean; environment: string;
}
export type ThunderGodPublicView = ThunderGodProjection;
export type { ThunderGodActivityCommand, ThunderGodLifeProjection, ThunderGodLifeState } from './life.js';
export type { ThunderGodEncounterCommand, ThunderGodEncounterProjection, ThunderGodEncounterState } from './encounter.js';

/** Future-only paid support bound to the exact vessel and original site. */
export interface ThunderGodPromotionStability {
  id: string; bottleId: string; week: number; revision: number; actorDigest: string; sourceDigest: string;
  location: 'BACKLUND_ORIGINAL_COVE_EXIT'; status: 'READY' | 'SPENT' | 'INVALIDATED';
}
