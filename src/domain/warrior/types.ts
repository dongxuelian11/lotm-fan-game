import type { PublicResolutionTier } from '../../shared/contracts.js';

/** Original G training categories, not three additional canonical powers. */
export const WARRIOR_ABILITY_IDS = ['warrior.s9.physique', 'warrior.s9.arms', 'warrior.s9.restraint'] as const;
export type WarriorAbilityId = typeof WARRIOR_ABILITY_IDS[number];
export const WARRIOR_CASE_IDS = ['yard-gate', 'staff-drill', 'loaded-trolley'] as const;
export type WarriorCaseId = typeof WARRIOR_CASE_IDS[number];
export type WarriorAcquisitionCommand =
  | { type: 'DISCOVER' }
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type WarriorActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'POWER' | 'TEAM' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'RETURN_TOOL' };
export type WarriorCommand = WarriorAcquisitionCommand | WarriorActivityCommand;

/** Individually sealed originals; the complete potion recipe is not verified. */
export interface WarriorBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface WarriorCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'WORKED' | 'RESOLVED';
  method: 'POWER' | 'TEAM' | null;
  attemptWeek: number | null;
  withdrawals: number;
  outcome: 'NONE' | 'GATE_SECURED' | 'CONTROLLED_STRIKE' | 'TROLLEY_DELIVERED';
}
export interface WarriorPracticeClub {
  id: 'warrior-training-club';
  owner: '奥斯温·布莱克特';
  custodian: 'MENTOR' | 'PLAYER';
  location: 'training-rack' | 'player:hand';
  version: number;
}
export interface WarriorState {
  discovered: boolean; guidanceKnown: boolean;
  bottles: WarriorBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  cases: Record<string, WarriorCaseState>;
  reflected: boolean;
  practiceClub: WarriorPracticeClub;
}
export interface WarriorAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: WarriorCommand;
}
export interface WarriorCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
}
export interface WarriorProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: WarriorAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: WarriorCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: WarriorCaseProjection[];
  tool: { id: string; owner: string; custodian: string; location: string; version: number } | null;
  environment: string;
}
