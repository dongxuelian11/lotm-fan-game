import type { PublicResolutionTier } from '../../shared/contracts.js';

/** Only this new S6 mastery; the underlying original G spells must already be learned. */
export const SCROLL_PROFESSOR_ABILITY_IDS = ['hermit.s6.scrollcraft'] as const;
export type ScrollProfessorAbilityId = typeof SCROLL_PROFESSOR_ABILITY_IDS[number];
export const SCROLL_PROFESSOR_CASE_IDS = ['paper-target', 'soft-ward', 'willing-reader'] as const;
export type ScrollProfessorCaseId = typeof SCROLL_PROFESSOR_CASE_IDS[number];
export const SCROLL_PROFESSOR_SCROLL_KINDS = ['IMPACT', 'WARD'] as const;
export type ScrollProfessorScrollKind = typeof SCROLL_PROFESSOR_SCROLL_KINDS[number];
export type ScrollProfessorAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type ScrollProfessorActivityCommand =
  | { type: 'LEARN_SPELL'; spellId: string }
  | { type: 'BUY_KIT' }
  | { type: 'CRAFT_SCROLL'; kind: ScrollProfessorScrollKind }
  | { type: 'AUTHORIZE_SCROLL'; scrollId: string; authorized: boolean }
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type ScrollProfessorCommand = ScrollProfessorAcquisitionCommand | ScrollProfessorActivityCommand;
export interface ScrollProfessorBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface ScrollProfessorMaterial {
  id: string; acquiredWeek: number; status: 'HELD' | 'SPENT'; spentWeek: number | null;
}
/** Persistent physical original. Maker/mastery/material are fixed at inscription. */
export interface ScrollProfessorScroll {
  id: string; kind: ScrollProfessorScrollKind; makerSequence: 6 | 5 | 4 | 3 | 2; inscriptionMastery: number;
  materialId: string; createdWeek: number; status: 'HELD' | 'USED'; usedWeek: number | null; authorized: boolean;
}
export interface ScrollProfessorWorkshop {
  kitsBought: number; lastKitWeek: number | null; materials: ScrollProfessorMaterial[];
  craftAttempts: number; craftFailures: number; scrolls: ScrollProfessorScroll[];
}
export interface ScrollProfessorCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number; outcome: 'NONE' | 'PAPER_VERIFIED' | 'WARD_VERIFIED' | 'LESSON_VERIFIED';
  contactOpen: boolean; closes: number; usedScrollIds: string[];
}
export interface ScrollProfessorState {
  guidanceKnown: boolean; bottles: ScrollProfessorBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; wizardActingAtPromotion: number | null;
  cases: Record<string, ScrollProfessorCaseState>; workshop: ScrollProfessorWorkshop; reflected: boolean;
  encounter: { status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; startHistoryIndex: number | null; attemptWeek: number | null };
}
export interface ScrollProfessorAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ScrollProfessorCommand;
}
export interface ScrollProfessorCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string; contactOpen: string; closes: number;
}
export interface ScrollProfessorProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string; actions: ScrollProfessorAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ScrollProfessorCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: ScrollProfessorCaseProjection[]; insideCase: boolean; environment: string;
  workshop: {
    summary: string; materials: ScrollProfessorMaterial[];
    lessons: { id: string; label: string; learned: boolean; description: string }[];
    scrolls: (ScrollProfessorScroll & { title: string; source: string })[];
  };
}
