import type { PublicResolutionTier } from '../../shared/contracts.js';

export const READER_ABILITY_IDS = [
  'reader.s9.memory',
  'reader.s9.understanding',
  'reader.s9.ritual-procedure',
] as const;
export type ReaderAbilityId = typeof READER_ABILITY_IDS[number];
export const READER_CASE_IDS = ['shift-ledger', 'parcel-copy', 'ritual-margin'] as const;
export type ReaderCaseId = typeof READER_CASE_IDS[number];

export type ReaderAcquisitionCommand =
  | { type: 'DISCOVER' }
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type ReaderActivityCommand =
  | { type: 'READ'; caseId: string }
  | { type: 'ANALYZE'; caseId: string }
  | { type: 'SUBMIT'; caseId: string; conclusion: 'LIMITED' | 'CERTAIN' }
  | { type: 'REFLECT' };
export type ReaderCommand = ReaderAcquisitionCommand | ReaderActivityCommand;

/** Individually sealed finished originals, without an invented recipe or brewing route. */
export interface ReaderBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface ReaderCaseState {
  status: 'AVAILABLE' | 'READ' | 'ANALYZED' | 'RESOLVED';
  attemptWeek: number | null;
  mistakes: number;
  conclusion: 'LIMITED' | 'CERTAIN' | null;
}
export interface ReaderState {
  discovered: boolean; guidanceKnown: boolean;
  bottles: ReaderBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  cases: Record<string, ReaderCaseState>;
  reflected: boolean;
}
export interface ReaderAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ReaderCommand;
}
export interface ReaderCaseProjection {
  id: string; title: string; story: string; documents: string[];
  analysis: string | null; result: string | null; status: string;
}
export interface ReaderProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  /** Finished-potion guidance never claims to supply an independently verified formula. */
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: ReaderAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ReaderCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: ReaderCaseProjection[];
  environment: string;
}
