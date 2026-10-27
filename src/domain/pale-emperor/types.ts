import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { FerrymanEraState, FerrymanEraCommand } from '../ferryman/era.js';
import type { SliceState } from '../slice/types.js';
import type { PaleEmperorActivityCommand, PaleEmperorLifeProjection, PaleEmperorLifeState } from './life.js';
import type { PaleEmperorEncounterCommand, PaleEmperorEncounterProjection, PaleEmperorEncounterState } from './encounter.js';

export const PALE_EMPEROR_ABILITY_IDS = ['death.s1.residual-quieting', 'death.s1.spiritual-interdiction'] as const;
export type PaleEmperorAbilityId = typeof PALE_EMPEROR_ABILITY_IDS[number];
export const PALE_EMPEROR_PREPARATION_IDS = ['VERIFY_PROVENANCE', 'VERIFY_RESIDUAL', 'PLAN_RETURN'] as const;
export type PaleEmperorPreparationId = typeof PALE_EMPEROR_PREPARATION_IDS[number];
export type PaleEmperorAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: PaleEmperorPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION' | 'REQUEST_RECOVERY_V1' | 'RECOVER_CHARACTERISTIC_V1'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type PaleEmperorCommand = PaleEmperorAcquisitionCommand | PaleEmperorActivityCommand | PaleEmperorEncounterCommand;
export interface PaleEmperorBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
  recovery?: PaleEmperorRecoveryRequest & { recoveredWeek: number };
}
/** Bounded acquisition evidence; inherited people, bodies, effects and inventory stay in their source history. */
export type PaleEmperorSourceEra = 'ORIGINAL' | 'POST_CYCLE';
export type PaleEmperorOriginalId = 'pale-emperor-potion-1' | 'pale-emperor-potion-2' | 'pale-emperor-potion-3';
export type PaleEmperorCharacteristicId = `${PaleEmperorOriginalId}:characteristic`;
export interface PaleEmperorRecoveryRequest {
  version: 1; sourceBottleId: string; originalBottleId: PaleEmperorOriginalId; characteristicId: PaleEmperorCharacteristicId;
  sourceReceiptRevision: number; requestedWeek: number; siteId: string; custodianId: string; sourceEra: PaleEmperorSourceEra;
}
/** New present-day inventory, created only by the first actual investigation.
 * None of these fields is backfilled into an old bottle or old failure receipt. */
export interface PaleEmperorRecoveryScene {
  version: 1; siteId: string; sourceEra: PaleEmperorSourceEra; location: string; actorId: string; actorLocation: string;
  custodian: { id: string; name: string; age: number; present: boolean; location: string; investigation: 'ALLOW' | 'REFUSED' | 'WITHDRAWN'; handover: 'ALLOW' | 'REFUSED' | 'WITHDRAWN' };
  remnants: { originalBottleId: PaleEmperorOriginalId; characteristicId: PaleEmperorCharacteristicId; sourceBottleId: string;
    sourceReceiptRevision: number; physicalId: string; physicalVersion: number; location: string; custodianId: string;
    residualPresent: boolean; accessible: boolean; custody: 'FAILED_REMAINS' | 'SUPPLIER' | 'PLAYER' | 'EMBODIED' }[];
}
export interface PaleEmperorRecoverySite {
  siteId: string; sourceReceiptRevision: number; physicalVersion: number; originalBottleId: PaleEmperorOriginalId;
  sourceBottleId: string; characteristicId: PaleEmperorCharacteristicId;
  permission: { personId: string; actorId: string; purpose: 'INVESTIGATE' | 'HANDOVER'; status: 'ALLOW' | 'REFUSED' | 'WITHDRAWN'; eventId: string;
    week: number; revision: number; location: string; conditionVersion: number };
  custodyBefore: 'FAILED_REMAINS'; custodyAfter: 'FAILED_REMAINS' | 'SUPPLIER'; supersededLegacyRequestRevision?: number;
  observation: { physicalId: string; location: string; custodianId: string; custodianPresent: boolean; actorId: string;
    actorLocation: string; residualPresent: boolean; accessible: boolean; sourceEra: PaleEmperorSourceEra };
  placement: { physicalId: string; physicalVersion: number; custody: 'FAILED_REMAINS' | 'SUPPLIER'; bottleId: string | null };
}
export interface PaleEmperorPrices { guidance: number; potion: number; labourCredit: number; labourBalance: number; preparation: number; resupply: number }
export interface PaleEmperorAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  gender: string; sequence: 2 | 1; acting: number; coreStats: SliceState['character']['coreStats'];
  era: FerrymanEraState; mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number;
}
export interface PaleEmperorAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: PaleEmperorAcquisitionCommand;
  actor: { name: string; gender: string; age: number; sourceHistoryDigest: string | null; sourceIdentityDigest: string; pathwayId: 'death'; deathConsulPromotionWeek: number; corpsecollectorPromotionWeek: number };
  before: PaleEmperorAcquisitionBudget; after: PaleEmperorAcquisitionBudget;
  cursorBefore: number; cursorAfter: number; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
  recoverySite?: PaleEmperorRecoverySite;
}
export const PALE_EMPEROR_SOURCE_KEYS = ['corpsecollector', 'gravedigger', 'spiritmedium', 'spiritGuide', 'gatekeeper', 'undying', 'ferryman', 'deathConsul', 'longChapter'] as const;
export type PaleEmperorSourceHistory = Pick<SliceState, typeof PALE_EMPEROR_SOURCE_KEYS[number]>;
export type PaleEmperorOriginals = SliceState['deathConsul']['life']['site'];
export interface PaleEmperorSourceScene {
  week: number; date: PublicGameDate; revision: number; random: SliceState['random'];
  budget: PaleEmperorAcquisitionBudget; identityDigest: string; historyDigest: string;
  character: SliceState['character']; originals: PaleEmperorOriginals;
  combatHistoryLength: number; combatHistoryDigest: string; city: 'BACKLUND';
}
export interface PaleEmperorEraEvent {
  week: number; date: PublicGameDate; revision: number; command: FerrymanEraCommand; randomCursor: number;
  before: PaleEmperorAcquisitionBudget; after: PaleEmperorAcquisitionBudget; afterWeek: number; afterDate: PublicGameDate;
}
export interface PaleEmperorState {
  guidanceKnown: boolean; sourceEra: PaleEmperorSourceEra | null; sourceWeek: number | null; bottles: PaleEmperorBottle[];
  resupply: { requestedWeek: number | null; deliveries: number; recovery?: PaleEmperorRecoveryRequest };
  recoveryScene?: PaleEmperorRecoveryScene;
  promotionWeek: number | null; deathConsulActingAtPromotion: number | null;
  preparations: { taskId: PaleEmperorPreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: PaleEmperorAcquisitionEvent[]; eraJournal: PaleEmperorEraEvent[];
  /** Frozen eight-stage and long-chapter history; only the separate current-era economy may evolve. */
  sourceHistory: PaleEmperorSourceHistory | null; sourceScene: PaleEmperorSourceScene | null;
  life: PaleEmperorLifeState; encounter: PaleEmperorEncounterState;
}
export interface PaleEmperorAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: PaleEmperorCommand; cleanup?: boolean; preferredAction?: boolean;
}
export interface PaleEmperorProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  sourceEra: PaleEmperorSourceEra | null; sourceLabel: string; prices: PaleEmperorPrices | null;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: PaleEmperorAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: PaleEmperorAcquisitionCommand }[];
  preparations: { taskId: PaleEmperorPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  characterName: string; currentGender: string; originalGender: string | null; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  life: PaleEmperorLifeProjection; encounter: PaleEmperorEncounterProjection;
  insideCase: boolean; environment: string;
}
export type PaleEmperorPublicView = PaleEmperorProjection;
export type { PaleEmperorActivityCommand, PaleEmperorLifeProjection, PaleEmperorLifeState } from './life.js';
export type { PaleEmperorEncounterCommand, PaleEmperorEncounterProjection, PaleEmperorEncounterState } from './encounter.js';
