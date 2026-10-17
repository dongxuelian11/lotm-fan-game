import type { PublicResolutionTier } from '../../shared/contracts.js';

/** The sole new S5 move is an explicitly original G use of finite personal concentration. */
export const ASTRONOMER_ABILITY_IDS = ['paragon.s5.precision-focus'] as const;
export type AstronomerAbilityId = typeof ASTRONOMER_ABILITY_IDS[number];
export const ASTRONOMER_CASE_IDS = ['catalogue-check', 'instrument-drift', 'night-measurement'] as const;
export type AstronomerCaseId = typeof ASTRONOMER_CASE_IDS[number];
export type AstronomerAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type AstronomerActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type AstronomerCommand = AstronomerAcquisitionCommand | AstronomerActivityCommand;
export interface AstronomerBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface AstronomerCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'CATALOGUE_CHECKED' | 'INSTRUMENT_ALIGNED' | 'MEASUREMENT_CHECKED';
  contactOpen: boolean;
  closes: number;
}
export interface AstronomerPractice {
  instrumentOffset: 0 | 2;
  calibratedWeek: number | null;
  observedWeek: number | null;
  measurements: number;
}
export interface AstronomerState {
  guidanceKnown: boolean;
  bottles: AstronomerBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  artisanActingAtPromotion: number | null;
  cases: Record<string, AstronomerCaseState>;
  practice: AstronomerPractice;
  reflected: boolean;
  encounter: {
    status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
    startHistoryIndex: number | null; attemptWeek: number | null;
  };
}
export interface AstronomerAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: AstronomerCommand;
}
export interface AstronomerCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number;
}
export interface AstronomerProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: AstronomerAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: AstronomerCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: AstronomerCaseProjection[];
  insideCase: boolean;
  environment: string;
  practice: AstronomerPractice | null;
}
