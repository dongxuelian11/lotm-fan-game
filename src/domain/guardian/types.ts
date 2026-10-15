import type { PublicResolutionTier } from '../../shared/contracts.js';

/** S5 defensive posture and sharing require actual actions and nearby consenting companions. */
export const GUARDIAN_ABILITY_IDS = ['warrior.s5.guard-state', 'warrior.s5.damage-sharing'] as const;
export type GuardianAbilityId = typeof GUARDIAN_ABILITY_IDS[number];
export const GUARDIAN_CASE_IDS = ['guarded-load', 'lowered-guard', 'nearby-companion'] as const;
export type GuardianCaseId = typeof GUARDIAN_CASE_IDS[number];
export type GuardianAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type GuardianActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type GuardianCommand = GuardianAcquisitionCommand | GuardianActivityCommand;
export interface GuardianBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface GuardianCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'GUARD_TESTED' | 'ATTACK_TESTED' | 'SHARE_TESTED' | 'PROBE_REMOVED' | 'TARGET_DISMANTLED' | 'BOTH_WITHDRAWN';
  contactOpen: boolean;
  closes: number;
}
/** Actual injuries, guard posture and the one original GD5-TARGET-1 paper target. */
export interface GuardianPractice {
  guardActive: boolean;
  playerAttacked: boolean;
  probes: number;
  playerDamageTaken: number;
  allyPresent: boolean;
  allyDistance: number | null;
  allyHealth: number;
  allyDamageTaken: number;
  sharedDamage: number;
  target: 'INTACT' | 'MARKED' | 'DISMANTLED';
}
export type GuardianPracticeState = GuardianPractice;
export interface GuardianState {
  guidanceKnown: boolean;
  bottles: GuardianBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  dawnPaladinActingAtPromotion: number | null;
  cases: Record<string, GuardianCaseState>;
  practice: GuardianPractice;
  reflected: boolean;
  encounter: {
    status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
    startHistoryIndex: number | null; attemptWeek: number | null;
    swordReady: boolean; swordLostRound: number | null;
    armorReady: boolean; armorExpiresRound: number | null;
  };
}
export interface GuardianAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: GuardianCommand;
}
export interface GuardianCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number;
}
export interface GuardianProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: GuardianAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: GuardianCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: GuardianCaseProjection[];
  insideCase: boolean;
  environment: string;
  practice: { guard: string; target: string; companion: string; history: string[] } | null;
  battleEquipment: { swordReady: boolean; swordLostRound: number | null; armorReady: boolean; armorExpiresRound: number | null };
}
