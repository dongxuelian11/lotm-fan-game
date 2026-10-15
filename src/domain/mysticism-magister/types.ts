import type { PublicResolutionTier } from '../../shared/contracts.js';

/** Rituals need a real link; manufactured imitation needs actual knowledge and consumed supernatural material. */
export const MYSTICISM_MAGISTER_ABILITY_IDS = ['reader.s5.secret-ritual', 'reader.s5.material-imitation'] as const;
export type MysticismMagisterAbilityId = typeof MYSTICISM_MAGISTER_ABILITY_IDS[number];
export const MYSTICISM_MAGISTER_CASE_IDS = ['linked-dream', 'modest-craft', 'careful-teaching'] as const;
export type MysticismMagisterCaseId = typeof MYSTICISM_MAGISTER_CASE_IDS[number];
export type MysticismMagisterAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type MysticismMagisterActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'RETURN_TOKEN' }
  | { type: 'VERIFY_DREAM' }
  | { type: 'MAKE_TOKEN' }
  | { type: 'TEST_TOKEN'; itemId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type MysticismMagisterCommand = MysticismMagisterAcquisitionCommand | MysticismMagisterActivityCommand;
export interface MysticismMagisterBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface MysticismMagisterCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'DREAM_VERIFIED' | 'CRAFT_TESTED' | 'LESSON_CHECKED';
  contactOpen: boolean;
  closes: number;
}
export interface MysticismMagisterPractice {
  token: 'OWNER' | 'PLAYER';
  dreamOpen: boolean;
  dreamResult: 'NONE' | 'CLAIM' | 'VERIFIED';
  dreamAttempts: number;
  kitsUsed: number;
  teachingChecks: number;
}
export interface MysticismMagisterCraft {
  id: string;
  sourceKitId: string;
  createdWeek: number;
  usedWeek: number | null;
  status: 'PLAYER' | 'CONSUMED';
  power: number;
}
export interface MysticismMagisterState {
  guidanceKnown: boolean;
  bottles: MysticismMagisterBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  polymathActingAtPromotion: number | null;
  cases: Record<string, MysticismMagisterCaseState>;
  practice: MysticismMagisterPractice;
  crafts: MysticismMagisterCraft[];
  craftAttemptWeek: number | null;
  reflected: boolean;
  encounter: {
    status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
    startHistoryIndex: number | null; attemptWeek: number | null;
  };
}
export interface MysticismMagisterAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: MysticismMagisterCommand;
}
export interface MysticismMagisterCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number;
}
export interface MysticismMagisterProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: MysticismMagisterAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: MysticismMagisterCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: MysticismMagisterCaseProjection[];
  insideCase: boolean;
  environment: string;
  practice: { token: string; dream: string; summary: string } | null;
  crafts: { id: string; source: string; status: string; power: string }[];
}
