import type { PublicResolutionTier } from '../../shared/contracts.js';

/** Canon abilities are bounded by actual original bodies, finite scenes and explicit G costs. */
export const OCEAN_SINGER_ABILITY_IDS = ['tyrant.s5.sea-song', 'tyrant.s5.shallow-lightning', 'tyrant.s5.deep-water-activity'] as const;
export type OceanSingerAbilityId = typeof OCEAN_SINGER_ABILITY_IDS[number];
export const OCEAN_SINGER_CASE_IDS = ['warned-rehearsal', 'lightning-target', 'tidal-observation'] as const;
export type OceanSingerCaseId = typeof OCEAN_SINGER_CASE_IDS[number];
export type OceanSingerAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' }
  | { type: 'REQUEST_RITUAL' }
  | { type: 'GO_RITUAL' }
  | { type: 'ENTER_RITUAL' }
  | { type: 'EXIT_RITUAL' }
  | { type: 'RETURN_DOCK' };
export type OceanSingerActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'MOVE_ALLY' }
  | { type: 'RETURN_ALLY' }
  | { type: 'CLEAR_ALLY' }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type OceanSingerCommand = OceanSingerAcquisitionCommand | OceanSingerActivityCommand;
export interface OceanSingerBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; ritualVisit: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface OceanSingerCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'ALLY_SHELTERED' | 'SIGNAL_CHECKED' | 'TARGET_CHECKED' | 'TIDE_CHECKED';
  contactOpen: boolean;
  closes: number;
}
export interface OceanSingerPractice {
  allyPosition: 'NEAR' | 'SHELTER';
  songOpen: boolean;
  allyAffected: boolean;
  songChecks: number;
  lightningMarks: number;
  tideObservedWeek: number | null;
  tideVerified: boolean;
}
/** This one paid coastal route and original living creature are an explicit G arrangement. */
export interface OceanSingerRitual {
  requestedWeek: number | null;
  visitWeek: number | null;
  location: 'DOCK' | 'COAST' | 'BELLY';
  crewPresent: boolean;
  beastPresent: boolean;
  waterFilm: boolean;
  visits: number;
  consumptions: number;
  history: { number: number; requestedWeek: number; visitWeek: number; entered: boolean; returned: boolean; consumedBottleId: string | null }[];
}
export interface OceanSingerState {
  guidanceKnown: boolean;
  bottles: OceanSingerBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  windBlessedActingAtPromotion: number | null;
  cases: Record<string, OceanSingerCaseState>;
  practice: OceanSingerPractice;
  ritual: OceanSingerRitual;
  reflected: boolean;
  encounter: {
    status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
    startHistoryIndex: number | null; attemptWeek: number | null;
  };
}
export interface OceanSingerAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: OceanSingerCommand;
}
export interface OceanSingerCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number;
}
export interface OceanSingerProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: OceanSingerAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: OceanSingerCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: OceanSingerCaseProjection[];
  insideCase: boolean;
  environment: string;
  ritual: { location: 'DOCK' | 'COAST' | 'BELLY'; status: string; source: string; summary: string; waterFilm: boolean; visits: number; consumptions: number };
  practice: { allyPosition: string; song: string; affected: string; history: string[] } | null;
}
