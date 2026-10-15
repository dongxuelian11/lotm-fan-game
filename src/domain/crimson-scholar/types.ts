import type { PublicResolutionTier } from '../../shared/contracts.js';

/** Book 5 chapter 63 supports these new S5 powers; exact costs and ranges are original G. */
export const CRIMSON_SCHOLAR_ABILITY_IDS = ['moon.s5.regional-moon', 'moon.s5.moonlight-step', 'moon.s5.moonlight-reassembly'] as const;
export type CrimsonScholarAbilityId = typeof CRIMSON_SCHOLAR_ABILITY_IDS[number];
export const CRIMSON_SCHOLAR_CASE_IDS = ['full-moon', 'hidden-moon', 'moonlight-route'] as const;
export type CrimsonScholarCaseId = typeof CRIMSON_SCHOLAR_CASE_IDS[number];
export type CrimsonScholarAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' }
  | { type: 'REQUEST_RITUAL' }
  | { type: 'BEGIN_RITUAL' }
  | { type: 'END_RITUAL' }
  | { type: 'CANCEL_RITUAL' };
export type CrimsonScholarActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'RETURN' }
  | { type: 'REASSEMBLE' }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type CrimsonScholarCommand = CrimsonScholarAcquisitionCommand | CrimsonScholarActivityCommand;
export interface CrimsonScholarBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface CrimsonScholarCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'FULL_MOON_CHECKED' | 'HIDDEN_MOON_CHECKED' | 'ROUTE_CHECKED';
  contactOpen: boolean;
  closes: number;
}
export interface CrimsonScholarPractice {
  field: 'NONE' | 'FULL' | 'HIDDEN';
  location: 'START' | 'END';
  outboundTrips: number;
  returns: number;
  reassemblies: number;
  reassembledWeek: number | null;
}
export interface CrimsonScholarMoonAnnouncement { id: string; week: number; source: string }
export interface CrimsonScholarRitualVisit {
  id: number; eventId: string; week: number; kitId: string;
  consumedBottleId: string | null; endedWeek: number | null;
}
export interface CrimsonScholarRitual {
  announcements: CrimsonScholarMoonAnnouncement[];
  reservedEventId: string | null;
  activeVisitId: number | null;
  visits: CrimsonScholarRitualVisit[];
}
export interface CrimsonScholarState {
  guidanceKnown: boolean;
  bottles: CrimsonScholarBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  potionProfessorActingAtPromotion: number | null;
  cases: Record<string, CrimsonScholarCaseState>;
  practice: CrimsonScholarPractice;
  ritual: CrimsonScholarRitual;
  reflected: boolean;
  encounter: {
    status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
    startHistoryIndex: number | null; attemptWeek: number | null; reassemblyRound: number | null;
  };
}
export interface CrimsonScholarAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: CrimsonScholarCommand;
}
export interface CrimsonScholarCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number;
}
export interface CrimsonScholarProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: CrimsonScholarAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: CrimsonScholarCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: CrimsonScholarCaseProjection[];
  insideCase: boolean;
  environment: string;
  practice: CrimsonScholarPractice | null;
  ritual: { summary: string; announcements: string[]; reservation: string; activeVisit: string; history: string[] };
}
