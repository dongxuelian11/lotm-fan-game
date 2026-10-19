import type { PublicResolutionTier } from '../../shared/contracts.js';

export const ASTROLOGER_ABILITY_IDS = [
  'door.s7.astrology', 'door.s7.divination-interference',
] as const;
export type AstrologerAbilityId = typeof ASTROLOGER_ABILITY_IDS[number];
export const ASTROLOGER_CASE_IDS = ['portrait-pair', 'short-route', 'willing-probe'] as const;
export type AstrologerCaseId = typeof ASTROLOGER_CASE_IDS[number];
export type AstrologerAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type AstrologerActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'STAR' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type AstrologerCommand = AstrologerAcquisitionCommand | AstrologerActivityCommand;

/** Finished, individually sealed originals; no invented ingredient or brewing route. */
export interface AstrologerBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface AstrologerCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'STAR' | 'ORDINARY' | null;
  outcome: 'NONE' | 'CORRELATED' | 'CAUTIOUS' | 'TESTED';
  withdrawals: number;
}
export interface AstrologerState {
  guidanceKnown: boolean;
  bottles: AstrologerBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  trickmasterActingAtPromotion: number | null;
  cases: Record<string, AstrologerCaseState>;
  reflected: boolean;
  /** Original consenting NPC's independent low-intensity check; activities own resolution. */
  probe: {
    spirituality: number;
    roll: number | null;
    chance: number | null;
    tier: PublicResolutionTier | null;
    interferenceApplied: boolean;
  };
}
export interface AstrologerAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: AstrologerCommand;
}
export interface AstrologerCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
}
export interface AstrologerProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: AstrologerAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: AstrologerCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: AstrologerCaseProjection[];
  environment: string;
}
