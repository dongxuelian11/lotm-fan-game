import type { PublicCheckResult } from '../../shared/contracts.js';
import type { DarknessSource, DarknessBudget, DarknessFinance } from './source.js';
import type { DarknessEvacuationCommand, DarknessEvacuationState } from './evacuation.js';
import type { DarknessMaterialCommand, DarknessMaterialsState } from './materials.js';
import type { DarknessEpilogueState, DarknessEpilogueCommand } from './epilogue.js';
export type { DarknessSource } from './source.js';
export const DARKNESS_ABILITY_IDS = ['darkness.s0.short-concealment', 'darkness.s0.bounded-misfortune-diversion'] as const;
export type DarknessAbilityId = typeof DARKNESS_ABILITY_IDS[number];
export type DarknessCommand =
  | { type: 'LEARN_GUIDANCE' | 'WORK' | 'REST' | 'CLINIC' | 'NEXT_WEEK' | 'START_EPILOGUE' | 'RETURN_ON_FOOT' }
  | { type: 'TRAVEL'; to: string }
  | { type: 'EVACUATION'; command: DarknessEvacuationCommand }
  | { type: 'MATERIAL'; command: DarknessMaterialCommand }
  | { type: 'STABILIZE_PROMOTION'; compoundId: string }
  | { type: 'CONSUME'; compoundId: string; confirmed: true }
  | { type: 'EPILOGUE'; command: DarknessEpilogueCommand };
export interface DarknessFrame {
  budget: DarknessBudget; random: { seed: string; cursor: number };
  finance: DarknessFinance; location: string; nowSecond: number; weekAnchor: number;
}
export interface DarknessCheckReceipt { kind: 'CHECK'; id: string; check: PublicCheckResult; cursorBefore: number; cursorAfter: number }
export interface DarknessEvent {
  id: string; revision: number; command: DarknessCommand; before: DarknessFrame; after: DarknessFrame;
  randomReceipts: DarknessCheckReceipt[]; financeReceipts: { title: string; text: string }[];
  notes: string[]; beforeDigest: string; afterDigest: string;
}
/** A paid one-use preparation belongs to one exact original dose and one real
 * completed three-stage evacuation and seven-day preparation window; losing either invalidates it without refund or retroactivity. */
export interface DarknessPromotionPreparation {
  id: string; eventId: string; compoundId: string; actorId: string; sourceDigest: string;
  compoundDigest: string; location: string; week: number; windowId: string; startWeek: number; endWeek: number;
  preparedSecond: number; expiresSecond: number;
  receipts: string[]; status: 'READY' | 'SPENT' | 'INVALIDATED'; spentEventId: string | null; invalidatedEventId: string | null;
}
export interface DarknessState {
  version: 1; guidanceKnown: boolean; source: DarknessSource | null; frame: DarknessFrame | null;
  promotionWeek: number | null; evacuation: DarknessEvacuationState | null; materials: DarknessMaterialsState | null;
  epilogue: DarknessEpilogueState | null; journal: DarknessEvent[];
  promotionStability: { preparations: DarknessPromotionPreparation[] };
}
export interface DarknessAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: DarknessCommand; preferredAction?: boolean }
export interface DarknessProjection {
  title: string; guidanceKnown: boolean; promoted: boolean; story: string; nextStep: string; risk: string;
  resources: { health: number; mind: number; spirituality: number; cash: string; actionsRemaining: number };
  abilities: { id: string; label: string; mastery: number; description: string }[];
  actions: DarknessAction[]; sections: { id: string; title: string; lines: string[] }[]; insideCase: boolean;
}
