import type { PublicResolutionTier } from '../../shared/contracts.js';

export const APPRAISER_ABILITY_IDS = [
  'paragon.s7.appraisal',
  'paragon.s7.hazard-insight',
  'paragon.s7.cautious-use',
] as const;
export type AppraiserAbilityId = typeof APPRAISER_ABILITY_IDS[number];
export const APPRAISER_ITEM_IDS = ['echo-brooch', 'warm-lamp', 'needle-box'] as const;
export type AppraiserItemId = typeof APPRAISER_ITEM_IDS[number];
export type AppraiserMethod = 'TEST' | 'REPORT';

export type AppraiserAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type AppraiserActivityCommand =
  | { type: 'EXAMINE'; itemId: string }
  | { type: 'IDENTIFY'; itemId: string }
  | { type: 'TEST'; itemId: string }
  | { type: 'REPORT'; itemId: string }
  | { type: 'REFLECT' };
export type AppraiserCommand = AppraiserAcquisitionCommand | AppraiserActivityCommand;

/** Actual S7 finished originals, independent of the S9 and S8 potion stock. */
export interface AppraiserBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface AppraiserItemState {
  status: 'AVAILABLE' | 'EXAMINED' | 'IDENTIFIED' | 'RESOLVED';
  attemptWeek: number | null;
  identifiedWeek: number | null;
  method: AppraiserMethod | null;
  uses: number;
}
export interface AppraiserState {
  guidanceKnown: boolean;
  bottles: AppraiserBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  archaeologistActingAtPromotion: number | null;
  cases: Record<AppraiserItemId, AppraiserItemState>;
  reflected: boolean;
}
export interface AppraiserAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: AppraiserCommand;
}
export interface AppraiserItemProjection {
  id: string; title: string; story: string; observations: string[];
  finding: string | null; risk: string | null; status: string;
}
export interface AppraiserProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  /** Finished-potion guidance never supplies an unverified complete formula. */
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  story?: string;
  supplies: string;
  items: AppraiserItemProjection[];
  environment: string;
  actions: AppraiserAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: AppraiserCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
}
