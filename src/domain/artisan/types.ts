import type { PublicResolutionTier } from '../../shared/contracts.js';

/** S6 makes bounded wonders from learned plans and actual materials; no arbitrary high-order copying. */
export const ARTISAN_ABILITY_IDS = ['paragon.s6.mechanical-craft', 'paragon.s6.spiritual-craft', 'paragon.s6.ritual-fixation'] as const;
export type ArtisanAbilityId = typeof ARTISAN_ABILITY_IDS[number];
export const ARTISAN_CASE_IDS = ['reading-diagram', 'limited-fabrication', 'client-handover'] as const;
export type ArtisanCaseId = typeof ARTISAN_CASE_IDS[number];
export type ArtisanAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type ArtisanActivityCommand =
  | { type: 'BUY_KIT' }
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type ArtisanCommand = ArtisanAcquisitionCommand | ArtisanActivityCommand;
export interface ArtisanBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface ArtisanCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'DIAGRAM_UNDERSTOOD' | 'LAMP_FABRICATED' | 'LAMP_VERIFIED';
  contactOpen: boolean;
  closes: number;
}
export interface ArtisanWorkshop {
  kitsBought: number;
  kitStock: number;
  restockAfterWeek: number | null;
  copperShells: number;
  spiritualPortions: number;
  craftFailures: number;
  lamp: null | { id: 'ART6-LAMP-1'; createdWeek: number; charges: number; location: 'PLAYER' | 'CLIENT' };
  tests: 0 | 1;
  delivered: boolean;
}
export interface ArtisanState {
  guidanceKnown: boolean;
  bottles: ArtisanBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  appraiserActingAtPromotion: number | null;
  cases: Record<string, ArtisanCaseState>;
  workshop: ArtisanWorkshop;
  reflected: boolean;
  encounter: { status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; startHistoryIndex: number | null; attemptWeek: number | null };
}
export interface ArtisanAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ArtisanCommand;
}
export interface ArtisanCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number;
}
export interface ArtisanProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: ArtisanAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ArtisanCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: ArtisanCaseProjection[]; insideCase: boolean; environment: string;
  workshop: { summary: string; materials: string; lamp: string | null; remainingUses: number; delivered: boolean };
}
