import type { PublicCheckResult } from '../../shared/contracts.js';
import type { VisionarySource, VisionaryBudget, VisionaryFinance } from './source.js';
import type { VisionaryEraCommand, VisionaryEraState } from './era.js';
import type { VisionaryMaterialCommand, VisionaryMaterialsState } from './materials.js';
import type { VisionaryEpilogueState, VisionaryEpilogueCommand } from './epilogue.js';
export type { VisionarySource } from './source.js';
export const VISIONARY_ABILITY_IDS = ['audience.s0.bounded-support', 'audience.s0.finite-guidance'] as const;
export type VisionaryAbilityId = typeof VISIONARY_ABILITY_IDS[number];
export type VisionaryCommand =
  | { type: 'LEARN_GUIDANCE' | 'WORK' | 'REST' | 'CLINIC' | 'NEXT_WEEK' | 'START_EPILOGUE' | 'RETURN_ON_FOOT' }
  | { type: 'TRAVEL'; to: string }
  | { type: 'ERA'; command: VisionaryEraCommand }
  | { type: 'MATERIAL'; command: VisionaryMaterialCommand }
  | { type: 'STABILIZE_PROMOTION'; compoundId: string }
  | { type: 'CONSUME'; compoundId: string; confirmed: true }
  | { type: 'EPILOGUE'; command: VisionaryEpilogueCommand };
export interface VisionaryFrame {
  budget: VisionaryBudget; random: { seed: string; cursor: number };
  finance: VisionaryFinance; location: string; nowSecond: number;
}
export interface VisionaryCheckReceipt { kind: 'CHECK'; id: string; check: PublicCheckResult; cursorBefore: number; cursorAfter: number }
export interface VisionaryEvent {
  id: string; revision: number; command: VisionaryCommand; before: VisionaryFrame; after: VisionaryFrame;
  randomReceipts: VisionaryCheckReceipt[]; financeReceipts: { title: string; text: string }[];
  notes: string[]; beforeDigest: string; afterDigest: string;
}
/** A paid one-use preparation belongs to one exact original dose and one real
 * quarterly window; losing either invalidates it without refund or retroactivity. */
export interface VisionaryPromotionPreparation {
  id: string; eventId: string; compoundId: string; actorId: string; sourceDigest: string;
  compoundDigest: string; location: string; week: number; windowId: string; startWeek: number; endWeek: number;
  receipts: string[]; status: 'READY' | 'SPENT' | 'INVALIDATED'; spentEventId: string | null; invalidatedEventId: string | null;
}
export interface VisionaryState {
  version: 1; guidanceKnown: boolean; source: VisionarySource | null; frame: VisionaryFrame | null;
  promotionWeek: number | null; era: VisionaryEraState | null; materials: VisionaryMaterialsState | null;
  epilogue: VisionaryEpilogueState | null; journal: VisionaryEvent[];
  promotionStability: { preparations: VisionaryPromotionPreparation[] };
}
export interface VisionaryAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: VisionaryCommand; preferredAction?: boolean }
export interface VisionaryProjection {
  title: string; guidanceKnown: boolean; promoted: boolean; story: string; nextStep: string; risk: string;
  resources: { health: number; mind: number; spirituality: number; cash: string; actionsRemaining: number };
  abilities: { id: string; label: string; mastery: number; description: string }[];
  actions: VisionaryAction[]; sections: { id: string; title: string; lines: string[] }[]; insideCase: boolean;
}
