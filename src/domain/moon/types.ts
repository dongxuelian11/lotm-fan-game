import type { PublicCheckResult } from '../../shared/contracts.js';
import type { MoonSource, MoonBudget, MoonFinance } from './source.js';
import type { MoonServiceCommand, MoonServicesState } from './services.js';
import type { MoonMaterialCommand, MoonMaterialsState } from './materials.js';
import type { MoonEpilogueState, MoonEpilogueCommand } from './epilogue.js';
export type { MoonSource } from './source.js';
export const MOON_ABILITY_IDS = ['moon.s0.moonlit-channel', 'moon.s0.gentle-crossing'] as const;
export type MoonAbilityId = typeof MOON_ABILITY_IDS[number];
export type MoonCommand =
  | { type: 'LEARN_GUIDANCE' | 'WORK' | 'REST' | 'CLINIC' | 'NEXT_WEEK' | 'START_EPILOGUE' | 'RETURN_ON_FOOT' }
  | { type: 'TRAVEL'; to: string }
  | { type: 'SERVICE'; command: MoonServiceCommand }
  | { type: 'MATERIAL'; command: MoonMaterialCommand }
  | { type: 'STABILIZE_PROMOTION'; compoundId: string }
  | { type: 'CONSUME'; compoundId: string; confirmed: true }
  | { type: 'EPILOGUE'; command: MoonEpilogueCommand };
export interface MoonFrame {
  budget: MoonBudget; random: { seed: string; cursor: number };
  finance: MoonFinance; location: string; nowSecond: number; weekAnchor: number;
}
export interface MoonCheckReceipt { kind: 'CHECK'; id: string; check: PublicCheckResult; cursorBefore: number; cursorAfter: number }
export interface MoonEvent {
  id: string; revision: number; command: MoonCommand; before: MoonFrame; after: MoonFrame;
  randomReceipts: MoonCheckReceipt[]; financeReceipts: { title: string; text: string }[];
  notes: string[]; beforeDigest: string; afterDigest: string;
}
/** A paid one-use preparation belongs to one exact original dose and one real
 * completed three-station arrival and seven-day preparation window; losing either invalidates it without refund or retroactivity. */
export interface MoonPromotionPreparation {
  id: string; eventId: string; compoundId: string; actorId: string; sourceDigest: string;
  compoundDigest: string; location: string; week: number; windowId: string; startWeek: number; endWeek: number;
  preparedSecond: number; expiresSecond: number;
  receipts: string[]; status: 'READY' | 'SPENT' | 'INVALIDATED'; spentEventId: string | null; invalidatedEventId: string | null;
}
export interface MoonState {
  version: 1; guidanceKnown: boolean; source: MoonSource | null; frame: MoonFrame | null;
  promotionWeek: number | null; services: MoonServicesState | null; materials: MoonMaterialsState | null;
  epilogue: MoonEpilogueState | null; journal: MoonEvent[];
  promotionStability: { preparations: MoonPromotionPreparation[] };
}
export interface MoonAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: MoonCommand; preferredAction?: boolean }
export interface MoonProjection {
  title: string; guidanceKnown: boolean; promoted: boolean; story: string; nextStep: string; risk: string;
  resources: { health: number; mind: number; spirituality: number; cash: string; actionsRemaining: number };
  abilities: { id: string; label: string; mastery: number; description: string }[];
  actions: MoonAction[]; sections: { id: string; title: string; lines: string[] }[]; insideCase: boolean;
}
