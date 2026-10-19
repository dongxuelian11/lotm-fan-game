import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { BriberGift } from '../briber/types.js';
import type { EntropyDukeOperationState } from '../entropy-duke/life.js';
import type { PrinceOfAbolitionSite } from './life.js';
export type { PrinceOfAbolitionSite } from './life.js';
import type { PrinceOfAbolitionActivityCommand, PrinceOfAbolitionLifeProjection, PrinceOfAbolitionLifeState } from './life.js';
import type { PrinceOfAbolitionEncounterCommand, PrinceOfAbolitionEncounterProjection, PrinceOfAbolitionEncounterState } from './encounter.js';

export const PRINCE_OF_ABOLITION_ABILITY_IDS = ['black-emperor.s1.directed-amplification', 'black-emperor.s1.effect-maintenance'] as const;
export type PrinceOfAbolitionAbilityId = typeof PRINCE_OF_ABOLITION_ABILITY_IDS[number];
export const PRINCE_OF_ABOLITION_PREPARATION_IDS = ['VERIFY_ORIGINALS', 'CHECK_LIMITS', 'CHECK_RETURN'] as const;
export type PrinceOfAbolitionPreparationId = typeof PRINCE_OF_ABOLITION_PREPARATION_IDS[number];
export type PrinceOfAbolitionAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: PrinceOfAbolitionPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION' | 'REQUEST_RECOVERY_V1' | 'RECOVER_CHARACTERISTIC_V1'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type PrinceOfAbolitionCommand = PrinceOfAbolitionAcquisitionCommand | PrinceOfAbolitionActivityCommand | PrinceOfAbolitionEncounterCommand;
export type PrinceOfAbolitionOriginalBottleId = 'prince-of-abolition-potion-1' | 'prince-of-abolition-potion-2' | 'prince-of-abolition-potion-3';
/** The vessel may change; the three finite original characteristics do not. */
export interface PrinceOfAbolitionRecoveryRequest {
  version: 1; sourceBottleId: string; originalBottleId: string; characteristicId: string; requestedWeek: number; sourceReceiptRevision: number;
  siteId: 'BACKLUND_ORIGINAL_PRINCE_OF_ABOLITION_PREPARATION'; custodian: 'BE227-PRINCE_OF_ABOLITION-SUPPLIER';
}
export interface PrinceOfAbolitionRecovery extends PrinceOfAbolitionRecoveryRequest { recoveredWeek: number }
/** A contemporaneous supplier permission and physical inspection. It is never inferred from old consent. */
export interface PrinceOfAbolitionRecoverySite {
  siteId: 'BACKLUND_ORIGINAL_PRINCE_OF_ABOLITION_PREPARATION'; originals: PrinceOfAbolitionOriginals;
  permission: { personId: 'BE227-PRINCE_OF_ABOLITION-SUPPLIER'; week: number; revision: number; purpose: 'INVESTIGATE' | 'RECOVER' };
  originalBottleId: string; sourceBottleId: string; characteristicId: string; sourceReceiptRevision: number;
  custodyBefore: 'FAILED_REMNANT' | 'SEALED_WITH_CUSTODIAN'; custodyAfter: 'SEALED_WITH_CUSTODIAN' | 'SUPPLIER';
}
export interface PrinceOfAbolitionOriginalCharacteristic {
  characteristicId: string; originalBottleId: PrinceOfAbolitionOriginalBottleId; latestBottleId: string;
  holder: 'SUPPLIER' | 'PLAYER' | 'FAILED_REMNANT' | 'EMBODIED';
  consumptionHistory: { bottleId: string; revision: number; week: number; outcome: PublicResolutionTier }[];
}
export interface PrinceOfAbolitionOriginalCharacteristics {
  characteristics: PrinceOfAbolitionOriginalCharacteristic[];
  embodiedOriginalBottleId: PrinceOfAbolitionOriginalBottleId | null; embodiedBottleId: string | null;
}
export interface PrinceOfAbolitionBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
  recovery?: PrinceOfAbolitionRecovery;
}
export interface PrinceOfAbolitionPrices { guidance: number; potion: number; labourCredit: number; labourBalance: number; preparation: number; resupply: number }
export type PrinceOfAbolitionFinance = Pick<SliceState, 'weeklyBudget' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface PrinceOfAbolitionAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  gender: string; sequence: 2 | 1; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number; gifts: BriberGift[];
}
export interface PrinceOfAbolitionAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: PrinceOfAbolitionAcquisitionCommand;
  actor: { name: string; gender: string; age: number; sourceHistoryDigest: string | null; sourceIdentityDigest: string; pathwayId: 'black-emperor'; entropyDukePromotionWeek: number; lawyerPromotionWeek: number };
  before: PrinceOfAbolitionAcquisitionBudget; after: PrinceOfAbolitionAcquisitionBudget; finance: PrinceOfAbolitionFinance;
  cursorBefore: number; cursorAfter: number; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
  recoverySite?: PrinceOfAbolitionRecoverySite;
}
export const PRINCE_OF_ABOLITION_SOURCE_KEYS = ['lawyer', 'barbarian', 'briber', 'corruptionBaron', 'mentorDisorder', 'fallenEarl', 'frenzyMage', 'entropyDuke'] as const;
export type PrinceOfAbolitionSourceHistory = Pick<SliceState, typeof PRINCE_OF_ABOLITION_SOURCE_KEYS[number]>;
/** Evidence only. Mutable continuations live in the new life and encounter roots. */
export interface PrinceOfAbolitionOriginals {
  site: PrinceOfAbolitionSite; operation: EntropyDukeOperationState; gifts: BriberGift[];
}
export type PrinceOfAbolitionSourceOriginals = PrinceOfAbolitionOriginals;
export interface PrinceOfAbolitionSourceScene {
  week: number; date: PublicGameDate; revision: number; random: SliceState['random'];
  budget: PrinceOfAbolitionAcquisitionBudget; finance: PrinceOfAbolitionFinance; identityDigest: string; historyDigest: string;
  character: SliceState['character']; originals: PrinceOfAbolitionOriginals;
  combatHistoryLength: number; combatHistoryDigest: string; city: 'BACKLUND';
}
export interface PrinceOfAbolitionState {
  guidanceKnown: boolean; sourceWeek: number | null; bottles: PrinceOfAbolitionBottle[];
  resupply: { requestedWeek: number | null; deliveries: number; recovery?: PrinceOfAbolitionRecoveryRequest };
  promotionWeek: number | null; entropyDukeActingAtPromotion: number | null;
  preparations: { taskId: PrinceOfAbolitionPreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: PrinceOfAbolitionAcquisitionEvent[];
  /** Eight immutable predecessor roots; live people, inventory and body continue in the new root only. */
  sourceHistory: PrinceOfAbolitionSourceHistory | null; sourceScene: PrinceOfAbolitionSourceScene | null;
  /** Sole live gift stock after guidance. Source originals and eight predecessor roots never mutate. */
  gifts: BriberGift[];
  life: PrinceOfAbolitionLifeState; encounter: PrinceOfAbolitionEncounterState;
}
export interface PrinceOfAbolitionAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: PrinceOfAbolitionCommand; cleanup?: boolean; preferredAction?: boolean;
}
export interface PrinceOfAbolitionProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  sourceLabel: string; prices: PrinceOfAbolitionPrices | null;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: PrinceOfAbolitionAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: PrinceOfAbolitionAcquisitionCommand }[];
  preparations: { taskId: PrinceOfAbolitionPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  gifts: { held: number; given: number; items: { id: string; location: 'PLAYER' | 'GIVEN'; destination: string | null; givenWeek: number | null }[] };
  characterName: string; currentGender: string; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  life: PrinceOfAbolitionLifeProjection; encounter: PrinceOfAbolitionEncounterProjection;
  insideCase: boolean; environment: string;
}
export type PrinceOfAbolitionPublicView = PrinceOfAbolitionProjection;
export type { PrinceOfAbolitionActivityCommand, PrinceOfAbolitionLifeProjection, PrinceOfAbolitionLifeState } from './life.js';
export type { PrinceOfAbolitionEncounterCommand, PrinceOfAbolitionEncounterProjection, PrinceOfAbolitionEncounterState } from './encounter.js';
