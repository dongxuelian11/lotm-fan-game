import type { PublicCheckResult } from '../../shared/contracts.js';
import type { TyrantSource, TyrantBudget, TyrantFinance } from './source.js';
import type { TyrantCoastCommand, TyrantCoastsState, TyrantSeaVoyage } from './coasts.js';
import type { TyrantChallengeCommand, TyrantChallengeState } from './challenge.js';
import type { TyrantEpilogueCommand, TyrantEpilogueState } from './epilogue.js';
import type { TyrantMaterialCommand, TyrantMaterialsState } from './material-types.js';
export * from './material-types.js';
export type { TyrantSource } from './source.js';
export const TYRANT_ABILITY_IDS = ['tyrant.s0.bounded-storm', 'tyrant.s0.matter-energy'] as const;
export type TyrantAbilityId = typeof TYRANT_ABILITY_IDS[number];
export type TyrantCommand =
  | { type: 'LEARN_GUIDANCE' | 'WORK' | 'REST' | 'CLINIC' | 'NEXT_WEEK' | 'START_EPILOGUE' | 'RETURN_ON_FOOT' }
  | { type: 'TRAVEL'; to: string }
  | { type: 'COAST'; command: TyrantCoastCommand }
  | { type: 'CHALLENGE'; command: TyrantChallengeCommand }
  | { type: 'MATERIAL'; command: TyrantMaterialCommand }
  | { type: 'STABILIZE_PROMOTION'; compoundId: string }
  | { type: 'CONSUME'; compoundId: string; confirmed: true }
  | { type: 'EPILOGUE'; command: TyrantEpilogueCommand };
export interface TyrantFrame {
  budget: TyrantBudget; random: { seed: string; cursor: number }; finance: TyrantFinance;
  location: string; nowSecond: number; weekAnchor: number;
}
export interface TyrantCheckReceipt { kind: 'CHECK'; id: string; check: PublicCheckResult; cursorBefore: number; cursorAfter: number }
export interface TyrantEvent {
  id: string; revision: number; command: TyrantCommand; before: TyrantFrame; after: TyrantFrame;
  randomReceipts: TyrantCheckReceipt[]; financeReceipts: { title: string; text: string }[];
  notes: string[]; beforeDigest: string; afterDigest: string;
}
/** A paid single-dose binding, never a public authorization token. */
export interface TyrantPromotionPreparation {
  id: string; eventId: string; compoundId: string; actorId: string; sourceDigest: string;
  compoundDigest: string; location: string; week: number; gateDigest: string;
  preparedSecond: number; expiresSecond: number; atmosphereEventId: string;
  attendees: { memberId: string; fromMeters: number; toMeters: 0; walkedMeters: number; witnessedFear: true; obeyedAssembly: true; chantedBelief: true }[];
  status: 'READY' | 'SPENT' | 'INVALIDATED'; spentEventId: string | null; invalidatedEventId: string | null;
}
export interface TyrantState {
  version: 1; guidanceKnown: boolean; source: TyrantSource | null; frame: TyrantFrame | null;
  promotionWeek: number | null; coasts: TyrantCoastsState | null; challenge: TyrantChallengeState | null;
  materials: TyrantMaterialsState | null; epilogue: TyrantEpilogueState | null; seaVoyages: TyrantSeaVoyage[];
  journal: TyrantEvent[]; promotionStability: { preparations: TyrantPromotionPreparation[] };
  assembly: { location: string; members: { memberId: string; cohortId: string; memberNumber: number; position: number }[] } | null;
}
export interface TyrantAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: TyrantCommand; preferredAction?: boolean }
export interface TyrantProjection {
  title: string; guidanceKnown: boolean; promoted: boolean; story: string; nextStep: string; risk: string;
  resources: { health: number; mind: number; spirituality: number; cash: string; actionsRemaining: number };
  abilities: { id: string; label: string; mastery: number; description: string }[];
  actions: TyrantAction[]; sections: { id: string; title: string; lines: string[] }[]; insideCase: boolean;
}
