import type { PublicResolutionTier } from '../../shared/contracts.js';

export const APOTHECARY_ABILITY_IDS = [
  'moon.s9.pharmacy',
  'moon.s9.aura-observation',
  'moon.s9.toxin-resistance',
] as const;
export type ApothecaryAbilityId = typeof APOTHECARY_ABILITY_IDS[number];
export const APOTHECARY_CASE_IDS = ['workshop-cut', 'night-fever', 'shaken-courier'] as const;
export type ApothecaryCaseId = typeof APOTHECARY_CASE_IDS[number];

export type ApothecaryAcquisitionCommand =
  | { type: 'DISCOVER' }
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type ApothecaryClinicCommand =
  | { type: 'BUY_SUPPLIES' }
  | { type: 'PREPARE_MEDICINE'; kind: 'HEALING' | 'CALMING' }
  | { type: 'USE_HEALING' }
  | { type: 'EXAMINE'; caseId: string }
  | { type: 'CARE'; caseId: string; choice: 'CARE' | 'REFER' }
  | { type: 'REFLECT' };
export type ApothecaryCommand = ApothecaryAcquisitionCommand | ApothecaryClinicCommand;

/** Individually sealed, already finished promotion potions; never a fabricated brewing recipe. */
export interface ApothecaryBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface ApothecaryCaseState {
  status: 'AVAILABLE' | 'EXAMINED' | 'RESOLVED';
  choice: null | 'CARE' | 'REFER'; health: number; mind: number;
}
export interface ApothecaryState {
  discovered: boolean; guidanceKnown: boolean;
  bottles: ApothecaryBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  clinic: { purchased: number; materials: number; healing: number; calming: number; spent: number; supplyWeek: number | null };
  cases: Record<string, ApothecaryCaseState>;
  reflected: boolean;
}
export interface ApothecaryAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ApothecaryCommand;
}
export interface ApothecaryCaseProjection {
  id: string; title: string; story: string; observations: string[]; result: string | null;
  status: string; health: number | null; mind: number | null;
}
export interface ApothecaryProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  /** Knowing two main ingredients does not imply knowing the full promotion formula. */
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: ApothecaryAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ApothecaryCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  clinic: { materials: number; healing: number; calming: number; spent: number };
  cases: ApothecaryCaseProjection[];
}
