import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { PureWhiteAngelActivityCommand, PureWhiteAngelLifeProjection, PureWhiteAngelLifeState } from './life.js';
import type { PureWhiteAngelEncounterCommand, PureWhiteAngelEncounterProjection, PureWhiteAngelEncounterState } from './encounter.js';

export const PURE_WHITE_ANGEL_ABILITY_IDS = ['sun.s1.focused-purification', 'sun.s1.warm-radiance-guard'] as const;
export type PureWhiteAngelAbilityId = typeof PURE_WHITE_ANGEL_ABILITY_IDS[number];
export const PURE_WHITE_ANGEL_PREPARATION_IDS = ['VERIFY_ORIGINALS', 'VERIFY_TARGET', 'PLAN_RETURN'] as const;
export type PureWhiteAngelPreparationId = typeof PURE_WHITE_ANGEL_PREPARATION_IDS[number];
export type PureWhiteAngelAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: PureWhiteAngelPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION' | 'REQUEST_RECOVERY_V1' | 'RECOVER_CHARACTERISTIC_V1'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type PureWhiteAngelCommand = PureWhiteAngelAcquisitionCommand | PureWhiteAngelActivityCommand | PureWhiteAngelEncounterCommand;
/** The vessel may change; the three finite original characteristics do not. */
export interface PureWhiteAngelRecoveryRequest {
  version: 1; sourceBottleId: string; originalBottleId: string; characteristicId: string; requestedWeek: number; sourceReceiptRevision: number;
  siteId: 'BACKLUND_ORIGINAL_GALLERY_ENTRY'; custodian: 'LS2-MARA';
}
export interface PureWhiteAngelRecovery extends PureWhiteAngelRecoveryRequest { recoveredWeek: number }
/** A contemporaneous, named permission and physical inspection. It is never inferred from old consent. */
export interface PureWhiteAngelRecoverySite {
  siteId: 'BACKLUND_ORIGINAL_GALLERY_ENTRY'; originals: PureWhiteAngelOriginals;
  permission: { personId: 'LS2-MARA'; week: number; revision: number; purpose: 'INVESTIGATE' | 'RECOVER' };
  originalBottleId: string; sourceBottleId: string; characteristicId: string; sourceReceiptRevision: number;
  custodyBefore: 'FAILED_REMNANT'; custodyAfter: 'FAILED_REMNANT' | 'SUPPLIER';
}
export interface PureWhiteAngelOriginalCharacteristic {
  characteristicId: string; originalBottleId: string; latestBottleId: string;
  holder: 'SUPPLIER' | 'PLAYER' | 'FAILED_REMNANT' | 'EMBODIED';
  consumptionHistory: { bottleId: string; revision: number; week: number; outcome: PublicResolutionTier }[];
}
export interface PureWhiteAngelOriginalCharacteristics {
  characteristics: PureWhiteAngelOriginalCharacteristic[];
  embodiedOriginalBottleId: string | null; embodiedBottleId: string | null;
}
export interface PureWhiteAngelBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
  recovery?: PureWhiteAngelRecovery;
}
/** Bounded acquisition evidence; inherited people, bodies, effects and inventory stay in their source history. */
export interface PureWhiteAngelAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  gender: string; sequence: 2 | 1; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number;
}
export interface PureWhiteAngelAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: PureWhiteAngelAcquisitionCommand;
  actor: { name: string; gender: string; age: number; sourceHistoryDigest: string | null; sourceIdentityDigest: string; pathwayId: 'sun'; lightSeekerPromotionWeek: number; bardPromotionWeek: number };
  before: PureWhiteAngelAcquisitionBudget; after: PureWhiteAngelAcquisitionBudget;
  cursorBefore: number; cursorAfter: number; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
  recoverySite?: PureWhiteAngelRecoverySite;
}
export const PURE_WHITE_ANGEL_SOURCE_KEYS = ['bard', 'lightprayer', 'sunpriest', 'notary', 'priestOfLight', 'unshadowed', 'justiceMentor', 'lightSeeker'] as const;
export type PureWhiteAngelSourceHistory = Pick<SliceState, typeof PURE_WHITE_ANGEL_SOURCE_KEYS[number]>;
export type PureWhiteAngelOriginals = SliceState['lightSeeker']['life']['site'];
export interface PureWhiteAngelSourceScene {
  week: number; date: PublicGameDate; revision: number; random: SliceState['random'];
  budget: PureWhiteAngelAcquisitionBudget; identityDigest: string; historyDigest: string;
  character: SliceState['character']; originals: PureWhiteAngelOriginals;
  combatHistoryLength: number; combatHistoryDigest: string; city: 'BACKLUND';
}
export interface PureWhiteAngelState {
  guidanceKnown: boolean; bottles: PureWhiteAngelBottle[];
  resupply: { requestedWeek: number | null; deliveries: number; recovery?: PureWhiteAngelRecoveryRequest };
  promotionWeek: number | null; lightSeekerActingAtPromotion: number | null;
  preparations: { taskId: PureWhiteAngelPreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: PureWhiteAngelAcquisitionEvent[];
  /** Single frozen eight-root history; only authoritative original resource fields can evolve. */
  sourceHistory: PureWhiteAngelSourceHistory | null; sourceScene: PureWhiteAngelSourceScene | null;
  life: PureWhiteAngelLifeState; encounter: PureWhiteAngelEncounterState;
}
export interface PureWhiteAngelAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: PureWhiteAngelCommand; cleanup?: boolean; preferredAction?: boolean;
}
export interface PureWhiteAngelProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: PureWhiteAngelAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: PureWhiteAngelAcquisitionCommand }[];
  preparations: { taskId: PureWhiteAngelPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  characterName: string; currentGender: string; originalGender: string | null; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  life: PureWhiteAngelLifeProjection; encounter: PureWhiteAngelEncounterProjection;
  insideCase: boolean; environment: string;
}
export type PureWhiteAngelPublicView = PureWhiteAngelProjection;
export type { PureWhiteAngelActivityCommand, PureWhiteAngelLifeProjection, PureWhiteAngelLifeState } from './life.js';
export type { PureWhiteAngelEncounterCommand, PureWhiteAngelEncounterProjection, PureWhiteAngelEncounterState } from './encounter.js';
