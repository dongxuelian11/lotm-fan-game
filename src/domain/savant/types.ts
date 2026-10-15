import type { PublicResolutionTier } from '../../shared/contracts.js';

export const SAVANT_ABILITY_IDS = [
  'paragon.s9.memory',
  'paragon.s9.learning',
  'paragon.s9.practice',
] as const;
export type SavantAbilityId = typeof SAVANT_ABILITY_IDS[number];
export const SAVANT_PROJECT_IDS = ['shelf-repair', 'handcart-wheel', 'lamp-shutter', 'dispatch-tray'] as const;
export type SavantProjectId = typeof SAVANT_PROJECT_IDS[number];

export type SavantAcquisitionCommand =
  | { type: 'DISCOVER' }
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type SavantCraftCommand =
  | { type: 'STUDY'; projectId: string }
  | { type: 'PREPARE'; projectId: string }
  | { type: 'CRAFT'; projectId: string }
  | { type: 'DELIVER'; projectId: string }
  | { type: 'RETURN_TOOLS'; projectId: string }
  | { type: 'REFLECT' };
export type SavantCommand = SavantAcquisitionCommand | SavantCraftCommand;

/** Individually sealed, already finished potions. This is not a recipe or brewing route. */
export interface SavantBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface SavantProjectState {
  status: 'UNREAD' | 'LEARNED' | 'READY' | 'DELIVERED';
  attemptWeek: number | null;
  materials: 'SUPPLIER' | 'WORKBENCH' | 'CONSUMED';
  tool: 'WORKSHOP' | 'PLAYER';
}
export interface SavantState {
  discovered: boolean; guidanceKnown: boolean;
  bottles: SavantBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  projects: Record<string, SavantProjectState>;
  reflected: boolean;
}
export interface SavantAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SavantCommand;
}
export interface SavantProjectProjection {
  id: string; title: string; story: string; plan: string; status: string; materials: string; tool: string;
}
export interface SavantProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  /** Guidance for finished potions never implies knowledge of an unverified formula. */
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: SavantAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: SavantCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  projects: SavantProjectProjection[];
}
