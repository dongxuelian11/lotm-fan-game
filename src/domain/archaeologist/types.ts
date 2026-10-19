import type { PublicResolutionTier } from '../../shared/contracts.js';

export const ARCHAEOLOGIST_ABILITY_IDS = [
  'paragon.s8.ancient-history',
  'paragon.s8.wilderness',
  'paragon.s8.ruin-caution',
] as const;
export type ArchaeologistAbilityId = typeof ARCHAEOLOGIST_ABILITY_IDS[number];
export const ARCHAEOLOGIST_SITE_IDS = ['cellar-arch', 'old-waypost', 'sealed-store'] as const;
export type ArchaeologistSiteId = typeof ARCHAEOLOGIST_SITE_IDS[number];
export type ArchaeologistApproach = 'COMPARE' | 'CAREFUL';

export type ArchaeologistAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type ArchaeologistActivityCommand =
  | { type: 'SURVEY'; siteId: string }
  | { type: 'EXPLORE'; siteId: string; approach: ArchaeologistApproach }
  | { type: 'REFLECT' };
export type ArchaeologistCommand = ArchaeologistAcquisitionCommand | ArchaeologistActivityCommand;

/** Original S8 finished bottles, independent of the workshop's S9 supply. */
export interface ArchaeologistBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface ArchaeologistSiteState {
  status: 'AVAILABLE' | 'SURVEYED' | 'RESOLVED';
  attemptWeek: number | null;
  approach: ArchaeologistApproach | null;
}
export interface ArchaeologistState {
  guidanceKnown: boolean;
  bottles: ArchaeologistBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  savantActingAtPromotion: number | null;
  sites: Record<string, ArchaeologistSiteState>;
  reflected: boolean;
}
export interface ArchaeologistAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ArchaeologistCommand;
}
export interface ArchaeologistSiteProjection {
  id: string; title: string; story: string; observations: string[]; result: string | null; status: string;
}
export interface ArchaeologistProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  /** Finished-potion guidance does not reveal an unverified formula. */
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  story?: string;
  sites: ArchaeologistSiteProjection[];
  supplies: string;
  actions: ArchaeologistAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ArchaeologistCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
}
