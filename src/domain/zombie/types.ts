import type { PublicResolutionTier } from '../../shared/contracts.js';

export const ZOMBIE_ABILITY_IDS = ['chained.s6.steel-body', 'chained.s6.death-craft'] as const;
export type ZombieAbilityId = typeof ZOMBIE_ABILITY_IDS[number];
export const ZOMBIE_CASE_IDS = ['narrow-load', 'cold-tray', 'willing-spirit'] as const;
export type ZombieCaseId = typeof ZOMBIE_CASE_IDS[number];
export type ZombieAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type ZombieActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'HANDLE_MOON'; method: 'GUARDED' | 'ALONE' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type ZombieCommand = ZombieAcquisitionCommand | ZombieActivityCommand;
export interface ZombieBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface ZombieCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number; outcome: 'NONE' | 'LOAD_HANDLED' | 'COLD_RECORDED' | 'MARK_CORROBORATED';
  contactOpen: boolean; closes: number;
}
export interface ZombieMoonHistory { week: number; method: 'GUARDED' | 'ALONE'; mentalCost: number }
export interface ZombieState {
  guidanceKnown: boolean; bottles: ZombieBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; werewolfActingAtPromotion: number | null;
  cases: Record<string, ZombieCaseState>;
  practice: { body: 'NORMAL' | 'BRACED'; cold: 'NONE' | 'ICED' | 'THAWED'; spirit: 'ABSENT' | 'PRESENT' | 'RELEASED' };
  moon: { pendingWeek: number | null; history: ZombieMoonHistory[] };
  reflected: boolean;
  encounter: { status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; startHistoryIndex: number | null; attemptWeek: number | null };
}
export interface ZombieAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ZombieCommand;
}
export interface ZombieCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string; contactOpen: string; closes: number;
}
export interface ZombieProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string; actions: ZombieAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ZombieCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: ZombieCaseProjection[]; insideCase: boolean; environment: string;
  practice: ZombieState['practice'];
  moon: { pending: boolean; summary: string; history: ZombieMoonHistory[] };
}
