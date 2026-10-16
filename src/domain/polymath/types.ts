import type { PublicResolutionTier } from '../../shared/contracts.js';

/** S6 analyses actually observed powers and may achieve a weaker, bounded imitation. */
export const POLYMATH_ABILITY_IDS = ['reader.s6.analysis', 'reader.s6.limited-imitation'] as const;
export type PolymathAbilityId = typeof POLYMATH_ABILITY_IDS[number];
export const POLYMATH_CASE_IDS = ['flash-study', 'thin-frost', 'willing-chorus'] as const;
export type PolymathCaseId = typeof POLYMATH_CASE_IDS[number];
export type PolymathAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type PolymathActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'ANALYSE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type PolymathCommand = PolymathAcquisitionCommand | PolymathActivityCommand;

/** Individually sealed S6 originals, separate from earlier Reader pathway stock. */
export interface PolymathBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface PolymathCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'FLASH_IMITATED' | 'FLASH_COMPARED' | 'FROST_IMITATED' | 'WATER_COMPARED' | 'COURAGE_IMITATED' | 'WORDS_COMPARED';
  contactOpen: boolean;
  closes: number;
}
export const POLYMATH_SAMPLE_IDS = ['FLASH', 'FROST', 'COURAGE'] as const;
export type PolymathSampleId = typeof POLYMATH_SAMPLE_IDS[number];
export interface PolymathSampleState {
  observedWeek: number | null;
  understoodWeek: number | null;
  learnedWeek: number | null;
  analysisAttemptWeek: number | null;
}
export interface PolymathState {
  guidanceKnown: boolean;
  bottles: PolymathBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  detectiveActingAtPromotion: number | null;
  cases: Record<string, PolymathCaseState>;
  samples: Record<PolymathSampleId, PolymathSampleState>;
  reflected: boolean;
  encounter: { status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; startHistoryIndex: number | null; attemptWeek: number | null };
}
export interface PolymathAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: PolymathCommand;
}
export interface PolymathCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string;
  closes: number;
}
export interface PolymathProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: PolymathAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: PolymathCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: PolymathCaseProjection[];
  insideCase: boolean;
  environment: string;
  samples: { id: PolymathSampleId; label: string; observed: boolean; understood: boolean; learned: boolean; source: string; boundary: string }[];
}
