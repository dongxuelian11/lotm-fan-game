import type { PublicResolutionTier } from '../../shared/contracts.js';

export const DREAMWALKER_ABILITY_IDS = ['audience.s5.dream-guidance', 'audience.s5.dream-modification', 'audience.s5.dream-travel'] as const;
export type DreamwalkerAbilityId = typeof DREAMWALKER_ABILITY_IDS[number];
export const DREAMWALKER_CASE_IDS = ['dream-evidence', 'repeated-garden', 'paired-dream'] as const;
export type DreamwalkerCaseId = typeof DREAMWALKER_CASE_IDS[number];
export type DreamwalkerAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' }
  | { type: 'REQUEST_RITUAL' }
  | { type: 'BEGIN_RITUAL' }
  | { type: 'END_RITUAL' };
export type DreamwalkerActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'RETURN' }
  | { type: 'VERIFY'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type DreamwalkerCommand = DreamwalkerAcquisitionCommand | DreamwalkerActivityCommand;
export interface DreamwalkerBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface DreamwalkerCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number; outcome: 'NONE' | 'EVIDENCE_CHECKED' | 'REFLECTION_CHECKED' | 'TRAVEL_CHECKED';
  contactOpen: boolean; closes: number; notes: string[];
  sessions: number; sessionWeeks: number[]; verified: boolean;
}
/** One existing professional contact, one continuing agreement, one physical original feather. */
export interface DreamwalkerRitualVisit {
  id: number; requestedWeek: number; startedWeek: number; endedWeek: number | null;
  contractConfirmed: boolean; participantPresent: boolean; emotionPrepared: boolean;
  featherReturned: boolean; consumedBottleId: string | null; awakened: boolean;
}
export interface DreamwalkerState {
  guidanceKnown: boolean; bottles: DreamwalkerBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; hypnotistActingAtPromotion: number | null;
  ritual: {
    requestedWeek: number | null; contractAcceptedWeek: number | null;
    featherHolder: 'LINGWEI' | 'PLAYER'; activeVisitId: number | null;
    visits: DreamwalkerRitualVisit[];
  };
  cases: Record<string, DreamwalkerCaseState>;
  practice: { location: 'SOURCE_ROOM' | 'TARGET_ROOM'; dream: 'NONE' | 'NOEL' | 'AMINA'; outboundTrips: number; returns: number; wakingChecks: number };
  reflected: boolean;
  encounter: { status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; startHistoryIndex: number | null; attemptWeek: number | null };
}
export interface DreamwalkerAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: DreamwalkerCommand;
}
export interface DreamwalkerCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number; sessions: number; sessionWeeks: number[]; verified: boolean;
}
export interface DreamwalkerProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string; actions: DreamwalkerAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: DreamwalkerCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: DreamwalkerCaseProjection[]; insideCase: boolean; environment: string;
  practice: DreamwalkerState['practice'] | null;
  ritual: { title: string; status: string; participant: string; contract: string; feather: string; emotion: string; appointment: string; visits: { id: number; summary: string }[] };
}
