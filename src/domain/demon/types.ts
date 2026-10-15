import type { PublicResolutionTier } from '../../shared/contracts.js';

export const DEMON_ABILITY_IDS = ['abyss.s6.danger-premonition', 'abyss.s6.demonic-body', 'abyss.s6.flame-hex'] as const;
export type DemonAbilityId = typeof DEMON_ABILITY_IDS[number];
export const DEMON_CASE_IDS = ['loading-lane', 'wide-door', 'cold-brazier'] as const;
export type DemonCaseId = typeof DEMON_CASE_IDS[number];
export type DemonAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type DemonActivityCommand =
  | { type: 'COMPOSE' }
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'VERIFY'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type DemonCommand = DemonAcquisitionCommand | DemonActivityCommand;
export interface DemonBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface DemonCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number; outcome: 'NONE' | 'LANE_CLUE' | 'VERIFY_FAILED' | 'LANE_VERIFIED' | 'BODY_VERIFIED' | 'FLAME_VERIFIED';
  contactOpen: boolean; closes: number;
}
export interface DemonState {
  guidanceKnown: boolean; bottles: DemonBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; serialKillerActingAtPromotion: number | null;
  cases: Record<string, DemonCaseState>;
  practice: { body: 'NORMAL' | 'ENLARGED'; flame: 'NONE' | 'LIT' | 'EXTINGUISHED' };
  strain: number;
  threat: { active: boolean; noticed: boolean; verified: boolean; avoided: boolean };
  reflected: boolean;
  encounter: { status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; startHistoryIndex: number | null; attemptWeek: number | null };
}
export interface DemonAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: DemonCommand;
}
export interface DemonCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string; contactOpen: string; closes: number;
}
export interface DemonProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string; actions: DemonAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: DemonCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: DemonCaseProjection[]; insideCase: boolean; environment: string;
  strain: number;
  practice: DemonState['practice'];
}
