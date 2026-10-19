import { ARBITER_ABILITY_IDS } from '../arbiter/types.js';
import { SHERIFF_ABILITY_IDS } from '../sheriff/types.js';
import { INTERROGATOR_ABILITY_IDS } from '../interrogator/types.js';
import { JUDGE_ABILITY_IDS } from '../judge/types.js';
import { PUNISHMENT_KNIGHT_ABILITY_IDS } from '../punishment-knight/types.js';
import { IMPERATIVE_MAGE_ABILITY_IDS } from '../imperative-mage/types.js';
import { CHAOS_HUNTER_ABILITY_IDS } from '../chaos-hunter/types.js';
import { BALANCER_ABILITY_IDS } from '../balancer/types.js';
import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { ChaosHunterLifeState } from '../chaos-hunter/life.js';
import type { BalancerOperationState, BalancerGuardPlate } from '../balancer/life.js';
import type { HandOfOrderSite } from './life.js';
export type { HandOfOrderSite } from './life.js';
import type { HandOfOrderActivityCommand, HandOfOrderLifeProjection, HandOfOrderLifeState } from './life.js';
import type { HandOfOrderEncounterCommand, HandOfOrderEncounterProjection, HandOfOrderEncounterState } from './encounter.js';

export const HAND_OF_ORDER_ABILITY_IDS = ['justiciar.s1.battlefield-division', 'justiciar.s1.aftermath-control'] as const;
export const HAND_OF_ORDER_INHERITED_ABILITY_IDS = [...ARBITER_ABILITY_IDS, ...SHERIFF_ABILITY_IDS, ...INTERROGATOR_ABILITY_IDS, ...JUDGE_ABILITY_IDS, ...PUNISHMENT_KNIGHT_ABILITY_IDS, ...IMPERATIVE_MAGE_ABILITY_IDS, ...CHAOS_HUNTER_ABILITY_IDS, ...BALANCER_ABILITY_IDS] as const;
export type HandOfOrderAbilityId = typeof HAND_OF_ORDER_ABILITY_IDS[number];
export const HAND_OF_ORDER_PREPARATION_IDS = ['VERIFY_ORIGINALS', 'CHECK_LIMITS', 'CHECK_RETURN'] as const;
export type HandOfOrderPreparationId = typeof HAND_OF_ORDER_PREPARATION_IDS[number];
export type HandOfOrderAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: HandOfOrderPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION' | 'REQUEST_RECOVERY_V1' | 'RECOVER_CHARACTERISTIC_V1' | 'STABILIZE_PROMOTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type HandOfOrderCommand = HandOfOrderAcquisitionCommand | HandOfOrderActivityCommand | HandOfOrderEncounterCommand;
export type HandOfOrderOriginalBottleId = 'hand-of-order-potion-1' | 'hand-of-order-potion-2' | 'hand-of-order-potion-3';
/** The vessel may change; the three finite original characteristics do not. */
export interface HandOfOrderRecoveryRequest {
  version: 1; sourceBottleId: string; originalBottleId: string; characteristicId: string; requestedWeek: number; sourceReceiptRevision: number;
  siteId: 'BACKLUND_ORIGINAL_HAND_OF_ORDER_PREPARATION'; custodian: 'JU228-HAND-OF-ORDER-SUPPLIER';
}
export interface HandOfOrderRecovery extends HandOfOrderRecoveryRequest { recoveredWeek: number }
/** A contemporaneous supplier permission and physical inspection. It is never inferred from old consent. */
export interface HandOfOrderRecoverySite {
  siteId: 'BACKLUND_ORIGINAL_HAND_OF_ORDER_PREPARATION'; originals: HandOfOrderOriginals;
  permission: { personId: 'JU228-HAND-OF-ORDER-SUPPLIER'; week: number; revision: number; purpose: 'INVESTIGATE' | 'RECOVER' };
  originalBottleId: string; sourceBottleId: string; characteristicId: string; sourceReceiptRevision: number;
  custodyBefore: 'FAILED_REMNANT' | 'SEALED_WITH_CUSTODIAN'; custodyAfter: 'SEALED_WITH_CUSTODIAN' | 'SUPPLIER';
}
export interface HandOfOrderOriginalCharacteristic {
  characteristicId: string; originalBottleId: HandOfOrderOriginalBottleId; latestBottleId: string;
  holder: 'SUPPLIER' | 'PLAYER' | 'FAILED_REMNANT' | 'EMBODIED';
  consumptionHistory: { bottleId: string; revision: number; week: number; outcome: PublicResolutionTier }[];
}
export interface HandOfOrderOriginalCharacteristics {
  characteristics: HandOfOrderOriginalCharacteristic[];
  embodiedOriginalBottleId: HandOfOrderOriginalBottleId | null; embodiedBottleId: string | null;
}
export interface HandOfOrderBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
  recovery?: HandOfOrderRecovery;
}
export interface HandOfOrderPrices { guidance: number; potion: number; labourCredit: number; labourBalance: number; preparation: number; resupply: number }
export type HandOfOrderFinance = Pick<SliceState, 'weeklyBudget' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface HandOfOrderAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  gender: string; sequence: 2 | 1; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number;
}
export interface HandOfOrderAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: HandOfOrderAcquisitionCommand;
  actor: { name: string; gender: string; age: number; sourceHistoryDigest: string | null; sourceIdentityDigest: string; pathwayId: 'justiciar'; balancerPromotionWeek: number; arbiterPromotionWeek: number };
  before: HandOfOrderAcquisitionBudget; after: HandOfOrderAcquisitionBudget; finance: HandOfOrderFinance;
  cursorBefore: number; cursorAfter: number; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
  recoverySite?: HandOfOrderRecoverySite;
}
export const HAND_OF_ORDER_SOURCE_KEYS = ['arbiter', 'sheriff', 'interrogator', 'judge', 'punishmentKnight', 'imperativeMage', 'chaosHunter', 'balancer'] as const;
export type HandOfOrderSourceHistory = Pick<SliceState, typeof HAND_OF_ORDER_SOURCE_KEYS[number]>;
/** Evidence only. Mutable continuations live in the new life and encounter roots. */
export interface HandOfOrderOriginals {
  site: ChaosHunterLifeState; operation: BalancerOperationState; guardPlate: BalancerGuardPlate;
}
export type HandOfOrderSourceOriginals = HandOfOrderOriginals;
export interface HandOfOrderSourceScene {
  week: number; date: PublicGameDate; revision: number; random: SliceState['random'];
  budget: HandOfOrderAcquisitionBudget; finance: HandOfOrderFinance; identityDigest: string; historyDigest: string;
  character: SliceState['character']; originals: HandOfOrderOriginals;
  combatHistoryLength: number; combatHistoryDigest: string; city: 'BACKLUND';
}
export interface HandOfOrderState {
  guidanceKnown: boolean; sourceWeek: number | null; bottles: HandOfOrderBottle[];
  resupply: { requestedWeek: number | null; deliveries: number; recovery?: HandOfOrderRecoveryRequest };
  promotionWeek: number | null; balancerActingAtPromotion: number | null;
  preparations: { taskId: HandOfOrderPreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: HandOfOrderAcquisitionEvent[];
  /** Eight immutable predecessor roots; live people, inventory and body continue in the new root only. */
  sourceHistory: HandOfOrderSourceHistory | null; sourceScene: HandOfOrderSourceScene | null;
  life: HandOfOrderLifeState; encounter: HandOfOrderEncounterState;
}
export interface HandOfOrderAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: HandOfOrderCommand; cleanup?: boolean; preferredAction?: boolean;
}
export interface HandOfOrderProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  sourceLabel: string; prices: HandOfOrderPrices | null;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: HandOfOrderAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: HandOfOrderAcquisitionCommand }[];
  preparations: { taskId: HandOfOrderPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  characterName: string; currentGender: string; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  life: HandOfOrderLifeProjection; encounter: HandOfOrderEncounterProjection;
  insideCase: boolean; environment: string;
}
export type HandOfOrderPublicView = HandOfOrderProjection;
export type { HandOfOrderActivityCommand, HandOfOrderLifeProjection, HandOfOrderLifeState } from './life.js';
export type { HandOfOrderEncounterCommand, HandOfOrderEncounterProjection, HandOfOrderEncounterState } from './encounter.js';
