import type { PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { FerrymanActivityCommand, FerrymanLifeProjection, FerrymanLifeState } from './life.js';
import type { FerrymanEncounterCommand, FerrymanEncounterProjection, FerrymanEncounterState } from './encounter.js';
import type { FerrymanEraCommand, FerrymanEraProjection, FerrymanEraState } from './era.js';

export const FERRYMAN_ABILITY_IDS = ['death.s3.bounded-ferry', 'death.s3.departure-ward'] as const;
export type FerrymanAbilityId = typeof FERRYMAN_ABILITY_IDS[number];
export const FERRYMAN_PREPARATION_IDS = ['CHECK_ROUTE', 'REVIEW_IDENTITY', 'PLAN_RETURN'] as const;
export type FerrymanPreparationId = typeof FERRYMAN_PREPARATION_IDS[number];
export type FerrymanChannelId = 'ORIGINAL' | 'POST_CYCLE';
export type FerrymanAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: FerrymanPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type FerrymanCommand = FerrymanAcquisitionCommand | FerrymanActivityCommand | FerrymanEncounterCommand | FerrymanEraCommand;
export interface FerrymanBottle {
  id: string; source: string; stockedWeek: number; stockedDate: PublicGameDate; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  paidPennies: number; expiredDate: PublicGameDate | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED' | 'EXPIRED'; outcome: PublicResolutionTier | null;
}
export interface FerrymanPreparationWindow {
  id: string; preparedWeek: number; preparedDate: PublicGameDate;
  closedWeek: number | null; closedDate: PublicGameDate | null;
  outcome: 'CONSUMED' | 'CANCELLED' | null; bottleId: string | null;
}
export interface FerrymanChannel {
  id: FerrymanChannelId;
  provider: { id: 'FR3-LEWIS' | 'FR3-HANNA'; name: string; ageAtIntroduction: number };
  introducedWeek: number; introducedDate: PublicGameDate; guidancePaid: number;
  agreementClosedDate: PublicGameDate | null;
  bottles: FerrymanBottle[];
  resupply: { requestedWeek: number | null; requestedDate: PublicGameDate | null; cancelledDate: PublicGameDate | null; deliveries: number };
  preparations: { id: string; taskId: FerrymanPreparationId; completedWeek: number; completedDate: PublicGameDate }[];
  preparedWeek: number | null; preparationWindows: FerrymanPreparationWindow[];
}
export interface FerrymanState {
  guidanceKnown: boolean; channels: FerrymanChannel[];
  promotionWeek: number | null; promotionDate: PublicGameDate | null; undyingActingAtPromotion: number | null;
  life: FerrymanLifeState; encounter: FerrymanEncounterState; era: FerrymanEraState;
}
export interface FerrymanAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: FerrymanCommand;
}
export interface FerrymanProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: FerrymanAction[];
  currentChannel: { id: FerrymanChannelId; provider: string; introduced: string; prices: { guidance: number; potion: number; labourCredit: number; preparation: number } } | null;
  channelHistory: string[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: FerrymanAcquisitionCommand }[];
  preparations: { taskId: FerrymanPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  currentGender: string; inheritedHistory: string[];
  life: FerrymanLifeProjection; encounter: FerrymanEncounterProjection; era: FerrymanEraProjection;
  insideCase: boolean; environment: string;
}
export type FerrymanPublicView = FerrymanProjection;
