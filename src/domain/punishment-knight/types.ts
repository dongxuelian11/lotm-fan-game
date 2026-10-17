import type { PublicResolutionTier } from '../../shared/contracts.js';

/** JUSTICIAR S5: bounded punishment, confinement and an existing-wound verdict. */
export const PUNISHMENT_KNIGHT_ABILITY_IDS = ['justiciar.s5.punishment', 'justiciar.s5.confinement', 'justiciar.s5.wound-verdict'] as const;
export type PunishmentKnightAbilityId = typeof PUNISHMENT_KNIGHT_ABILITY_IDS[number];
export const PUNISHMENT_KNIGHT_CASE_IDS = ['breach-and-pad', 'willing-pause', 'wound-record'] as const;
export type PunishmentKnightCaseId = typeof PUNISHMENT_KNIGHT_CASE_IDS[number];
export type PunishmentKnightMethod = 'ABILITY' | 'ORDINARY';
export type PunishmentKnightAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type PunishmentKnightActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: PunishmentKnightMethod }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type PunishmentKnightCommand = PunishmentKnightAcquisitionCommand | PunishmentKnightActivityCommand;
export interface PunishmentKnightBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface PunishmentKnightCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null; method: PunishmentKnightMethod | null;
  withdrawals: number;
  outcome: 'NONE' | 'PUNISHMENT_CHECKED' | 'PAUSE_CHECKED' | 'RECORD_CHECKED';
  contactOpen: boolean; closes: number;
}
/** Same original pad, floor line, adult participant and written note throughout each trial. */
export interface PunishmentKnightPractice {
  pad: 'STAND' | 'MAT';
  partner: 'FREE' | 'HELD';
  rule: 'NONE' | 'DECLARED' | 'BREACHED';
  note: 'BLANK' | 'WRITTEN' | 'HANDED_OVER';
}
export type PunishmentKnightPracticeState = PunishmentKnightPractice;
export interface PunishmentKnightEncounter {
  status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
  startHistoryIndex: number | null;
  attemptWeek: number | null;
}
export interface PunishmentKnightState {
  guidanceKnown: boolean;
  bottles: PunishmentKnightBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  judgeActingAtPromotion: number | null;
  cases: Record<string, PunishmentKnightCaseState>;
  practice: PunishmentKnightPractice;
  reflected: boolean;
  encounter: PunishmentKnightEncounter;
}
export interface PunishmentKnightAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: PunishmentKnightCommand;
}
export interface PunishmentKnightCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number;
}
export interface PunishmentKnightProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: PunishmentKnightAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: PunishmentKnightCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: PunishmentKnightCaseProjection[];
  insideCase: boolean;
  environment: string;
  practice: PunishmentKnightPractice;
}
