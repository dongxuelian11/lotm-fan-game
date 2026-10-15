import type { PublicResolutionTier } from '../../shared/contracts.js';

export const CORRUPTION_BARON_ABILITY_IDS = ['black-emperor.s6.distortion'] as const;
export type CorruptionBaronAbilityId = typeof CORRUPTION_BARON_ABILITY_IDS[number];
export const CORRUPTION_BARON_CASE_IDS = ['clause-order', 'rolling-marker', 'agreed-route'] as const;
export type CorruptionBaronCaseId = typeof CORRUPTION_BARON_CASE_IDS[number];
export type CorruptionBaronAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type CorruptionBaronActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'BUY_GIFTS' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type CorruptionBaronCommand = CorruptionBaronAcquisitionCommand | CorruptionBaronActivityCommand;
export interface CorruptionBaronBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface CorruptionBaronCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number; outcome: 'NONE' | 'ORDER_RECORDED' | 'ROLL_RECORDED' | 'ROUTE_RECORDED';
  contactOpen: boolean; closes: number;
}
export interface CorruptionBaronState {
  guidanceKnown: boolean; bottles: CorruptionBaronBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; briberActingAtPromotion: number | null;
  cases: Record<string, CorruptionBaronCaseState>;
  practice: {
    clauseOrder: 'ORIGINAL' | 'PENDING' | 'ADJUSTED' | 'RESTORED';
    marker: 'CRADLED' | 'ROLLING' | 'SIDE_POCKET' | 'STOPPED';
    route: 'READY' | 'MOVING' | 'DIVERTED' | 'FREE';
  };
  reflected: boolean;
  encounter: { status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; startHistoryIndex: number | null; attemptWeek: number | null };
}
export interface CorruptionBaronAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: CorruptionBaronCommand;
}
export interface CorruptionBaronCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string; contactOpen: string; closes: number;
}
export interface CorruptionBaronProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string; actions: CorruptionBaronAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: CorruptionBaronCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: CorruptionBaronCaseProjection[]; insideCase: boolean; environment: string;
  practice: CorruptionBaronState['practice'];
  gifts: { held: number; given: number; summary: string };
}
