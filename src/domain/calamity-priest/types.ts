import type { PublicResolutionTier } from '../../shared/contracts.js';

export const CALAMITY_PRIEST_ABILITY_IDS = ['wheel.s6.disaster-awareness', 'wheel.s6.disaster-attraction', 'wheel.s6.mental-storm'] as const;
export type CalamityPriestAbilityId = typeof CALAMITY_PRIEST_ABILITY_IDS[number];
export const CALAMITY_PRIEST_CASE_IDS = ['rain-rack', 'isolated-board', 'willing-focus'] as const;
export type CalamityPriestCaseId = typeof CALAMITY_PRIEST_CASE_IDS[number];
export type CalamityPriestAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type CalamityPriestActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type CalamityPriestCommand = CalamityPriestAcquisitionCommand | CalamityPriestActivityCommand;
export interface CalamityPriestBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface CalamityPriestCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number; outcome: 'NONE' | 'RACK_SECURED' | 'BOARD_RECORDED' | 'FOCUS_RECORDED';
  contactOpen: boolean; closes: number;
}
export interface CalamityPriestState {
  guidanceKnown: boolean; bottles: CalamityPriestBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; luckyActingAtPromotion: number | null;
  cases: Record<string, CalamityPriestCaseState>;
  practice: { hazard: 'UNASSESSED' | 'NOTICED' | 'SECURED'; board: 'RESTING' | 'UNSTABLE' | 'FALLEN' | 'SECURED'; contact: 'NONE' | 'FOCUSED' | 'RELEASED' };
  reflected: boolean;
  encounter: { status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; startHistoryIndex: number | null; attemptWeek: number | null };
}
export interface CalamityPriestAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: CalamityPriestCommand;
}
export interface CalamityPriestCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string; contactOpen: string; closes: number;
}
export interface CalamityPriestProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string; actions: CalamityPriestAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: CalamityPriestCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: CalamityPriestCaseProjection[]; insideCase: boolean; environment: string;
  practice: CalamityPriestState['practice'];
}
