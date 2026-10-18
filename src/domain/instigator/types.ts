import type { PublicResolutionTier } from '../../shared/contracts.js';

/** B1 ch65: limited instigation of existing desires and conflict, never absolute control. */
export const INSTIGATOR_ABILITY_IDS = ['assassin.s8.instigation'] as const;
export type InstigatorAbilityId = typeof INSTIGATOR_ABILITY_IDS[number];
export const INSTIGATOR_CASE_IDS = ['queue-grievance', 'two-notices', 'stage-rivalry'] as const;
export type InstigatorCaseId = typeof INSTIGATOR_CASE_IDS[number];

export type InstigatorAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type InstigatorActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'INCITE' | 'PLAIN' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'SETTLE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type InstigatorCommand = InstigatorAcquisitionCommand | InstigatorActivityCommand;

/** Individually sealed S8 finished originals, independent of the existing S9 supply. */
export interface InstigatorBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface InstigatorCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'INCITE' | 'PLAIN' | null;
  withdrawals: number;
  outcome: 'NONE' | 'QUEUE_HEARD' | 'NOTICES_COMPARED' | 'REHEARSAL_STOPPED';
  tension: 'CALM' | 'HEATED' | 'SETTLED';
}
export interface InstigatorState {
  guidanceKnown: boolean;
  bottles: InstigatorBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  assassinActingAtPromotion: number | null;
  cases: Record<string, InstigatorCaseState>;
  reflected: boolean;
}
export interface InstigatorAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: InstigatorCommand;
}
export interface InstigatorCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string; tension: string;
}
export interface InstigatorProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  /** Finished-potion guidance does not reveal an unverified formula. */
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  story?: string;
  supplies: string;
  actions: InstigatorAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: InstigatorCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: InstigatorCaseProjection[];
  environment: string;
  /** Life projects actual unresolved heated consequences; not a separately saved flag. */
  insideCase: boolean;
}
