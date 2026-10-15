import type { PublicResolutionTier } from '../../shared/contracts.js';

export const DETECTIVE_ABILITY_IDS = [
  'reader.s7.reconstruction',
  'reader.s7.combat-training',
  'reader.s7.agility',
] as const;
export type DetectiveAbilityId = typeof DETECTIVE_ABILITY_IDS[number];
export const DETECTIVE_CASE_IDS = ['fallen-shelf', 'courtyard-route', 'quay-collision'] as const;
export type DetectiveCaseId = typeof DETECTIVE_CASE_IDS[number];

export type DetectiveAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type DetectiveActivityCommand =
  | { type: 'SURVEY'; caseId: string }
  | { type: 'RECONSTRUCT'; caseId: string; plan: string }
  | { type: 'REPORT'; caseId: string; conclusion: string }
  | { type: 'REFLECT' };
export type DetectiveCommand = DetectiveAcquisitionCommand | DetectiveActivityCommand;

/** Individually sealed S7 originals, independent of existing reader and reasoner supplies. */
export interface DetectiveBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface DetectiveCaseState {
  status: 'AVAILABLE' | 'SURVEYED' | 'RECONSTRUCTED' | 'RESOLVED';
  attemptWeek: number | null;
  plan: string | null;
  conclusion: string | null;
  mistakes: number;
}
export interface DetectiveState {
  guidanceKnown: boolean;
  bottles: DetectiveBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  reasonerActingAtPromotion: number | null;
  cases: Record<string, DetectiveCaseState>;
  reflected: boolean;
}
export interface DetectiveAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: DetectiveCommand;
}
export interface DetectiveCaseProjection {
  id: string; title: string; story: string; traces: string[]; gaps: string[];
  reconstruction: string | null; result: string | null; status: string;
}
export interface DetectiveProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  /** Finished-potion guidance does not reveal an unverified formula. */
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  story?: string;
  supplies: string;
  actions: DetectiveAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: DetectiveCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: DetectiveCaseProjection[];
  environment: string;
}
