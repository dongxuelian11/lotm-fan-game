import type { PublicResolutionTier } from '../../shared/contracts.js';

export const TRAVELER_ABILITY_IDS = ['door.s5.travel', 'door.s5.invisible-hand'] as const;
export type TravelerAbilityId = typeof TRAVELER_ABILITY_IDS[number];
export const TRAVELER_CASE_IDS = ['known-landing', 'offered-card', 'willing-companion'] as const;
export type TravelerCaseId = typeof TRAVELER_CASE_IDS[number];
export const TRAVELER_RITUAL_SITE_IDS = ['BRONZE_STEPS', 'INVERTED_REEF', 'ASH_GARDEN', 'ECHO_WELL'] as const;
export type TravelerRitualSiteId = typeof TRAVELER_RITUAL_SITE_IDS[number];
export type TravelerAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' }
  | { type: 'RITUAL_DEPART'; site: TravelerRitualSiteId }
  | { type: 'PLACE_COORDINATE' }
  | { type: 'RITUAL_RETURN' };
export type TravelerActivityCommand =
  | { type: 'RECORD_SAMPLE'; sample: 'FLASH' | 'COURAGE' }
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type TravelerCommand = TravelerAcquisitionCommand | TravelerActivityCommand;
export interface TravelerBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface TravelerCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'LANDING_CHECKED' | 'CARD_TAKEN' | 'COMPANION_RETURNED';
  contactOpen: boolean;
  closes: number;
}
export interface TravelerRitual {
  coordinates: Record<TravelerRitualSiteId, { placedWeek: number | null }>;
  at: 'HOME' | TravelerRitualSiteId;
  escortSpirituality: number;
  escortRestWeek: number | null;
  journeys: number;
  returns: number;
  feePaid: number;
  drifts: number;
}
export interface TravelerPractice {
  position: 'ENTRY' | 'LANDING';
  card: 'DESK' | 'PLAYER';
  companionPosition: 'ENTRY' | 'LANDING';
  consent: boolean;
  journeys: number;
  returns: number;
  cardTakes: number;
  cardReturns: number;
  companionTrips: number;
}
export interface TravelerState {
  guidanceKnown: boolean;
  bottles: TravelerBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  recorderActingAtPromotion: number | null;
  ritual: TravelerRitual;
  cases: Record<string, TravelerCaseState>;
  practice: TravelerPractice;
  reflected: boolean;
  encounter: {
    status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
    startHistoryIndex: number | null; attemptWeek: number | null;
  };
}
export interface TravelerAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: TravelerCommand;
}
export interface TravelerCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number;
}
export interface TravelerRitualProjection {
  at: string;
  coordinates: { id: TravelerRitualSiteId; label: string; status: string }[];
  escortSpirituality: number;
  history: string[];
}
export interface TravelerProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: TravelerAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: TravelerCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: TravelerCaseProjection[];
  insideCase: boolean;
  environment: string;
  ritual: TravelerRitualProjection | null;
  practice: { position: string; card: string; companion: string; history: string[] } | null;
}
