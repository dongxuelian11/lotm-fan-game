import type { PublicCheckResult } from '../../shared/contracts.js';
/** Private current values supplied by the chapter, never by a player intent.
 * The chapter authenticates this same actor's real living Error S0 promotion. */
export interface ErrorAscentEpilogueHost {
  eventId: string; revision: number; week: number; actorId: string;
  location: string; nowSecond: number; sequence: 1 | 0; status: 'ACTIVE' | 'DEAD';
  cash: number; actions: number; health: number; mind: number; spirituality: number;
  coreStats: { will: number; perception: number };
  check: PublicCheckResult | null;
}
/** Positive debits. Time always advances; no AP, time, healing or item credit. */
export interface ErrorAscentEpilogueEffect {
  cashCost: number; cashGain: number; actions: number; spirituality: number;
  mind: number; health: number; seconds: number; toLocation: string | null;
}
