import type { PublicCheckResult } from '../../shared/contracts.js';
import type { PerfecterSource, PerfecterBudget, PerfecterFinance } from './source.js';
import type { PerfecterWorksCommand, PerfecterWorksState } from './works.js';
import type { PerfecterMaterialCommand, PerfecterMaterialsState } from './materials.js';
import type { PerfecterEpilogueState, PerfecterEpilogueCommand } from './epilogue.js';
export type { PerfecterSource } from './source.js';
export const PERFECTER_ABILITY_IDS = ['paragon.s0.civilization-page', 'paragon.s0.finite-reconstruction'] as const;
export type PerfecterAbilityId = typeof PERFECTER_ABILITY_IDS[number];
export type PerfecterCommand =
  | { type: 'LEARN_GUIDANCE' | 'WORK' | 'REST' | 'CLINIC' | 'NEXT_WEEK' | 'START_EPILOGUE' | 'RETURN_ON_FOOT' }
  | { type: 'TRAVEL'; to: string }
  | { type: 'WORKS'; command: PerfecterWorksCommand }
  | { type: 'MATERIAL'; command: PerfecterMaterialCommand }
  | { type: 'STABILIZE_PROMOTION'; compoundId: string }
  | { type: 'CONSUME'; compoundId: string; confirmed: true }
  | { type: 'EPILOGUE'; command: PerfecterEpilogueCommand };
export interface PerfecterFrame {
  budget: PerfecterBudget; random: { seed: string; cursor: number };
  finance: PerfecterFinance; location: string; nowSecond: number;
}
export interface PerfecterCheckReceipt { kind: 'CHECK'; id: string; check: PublicCheckResult; cursorBefore: number; cursorAfter: number }
export interface PerfecterEvent {
  id: string; revision: number; command: PerfecterCommand; before: PerfecterFrame; after: PerfecterFrame;
  randomReceipts: PerfecterCheckReceipt[]; financeReceipts: { title: string; text: string }[];
  notes: string[]; beforeDigest: string; afterDigest: string;
}
/** A paid one-use preparation belongs to one exact original dose and one real
 * completed workshop mission and short preparation window; losing either invalidates it without refund or retroactivity. */
export interface PerfecterPromotionPreparation {
  id: string; eventId: string; compoundId: string; actorId: string; sourceDigest: string;
  compoundDigest: string; location: string; week: number; windowId: string; startWeek: number; endWeek: number;
  preparedSecond: number; expiresSecond: number;
  receipts: string[]; status: 'READY' | 'SPENT' | 'INVALIDATED'; spentEventId: string | null; invalidatedEventId: string | null;
}
export interface PerfecterState {
  version: 1; guidanceKnown: boolean; source: PerfecterSource | null; frame: PerfecterFrame | null;
  promotionWeek: number | null; works: PerfecterWorksState | null; materials: PerfecterMaterialsState | null;
  epilogue: PerfecterEpilogueState | null; journal: PerfecterEvent[];
  promotionStability: { preparations: PerfecterPromotionPreparation[] };
}
export interface PerfecterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: PerfecterCommand; preferredAction?: boolean }
export interface PerfecterProjection {
  title: string; guidanceKnown: boolean; promoted: boolean; story: string; nextStep: string; risk: string;
  resources: { health: number; mind: number; spirituality: number; cash: string; actionsRemaining: number };
  abilities: { id: string; label: string; mastery: number; description: string }[];
  actions: PerfecterAction[]; sections: { id: string; title: string; lines: string[] }[]; insideCase: boolean;
}
