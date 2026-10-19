import type { PublicCheckResult, PublicGameDate } from '../../shared/contracts.js';
import type { DarknessSuccessionFacts } from './material-content.js';

/** Candidate adapter boundary, to be merged into the chapter's single Host.
 * All values come from the private current engine and are reconstructed on cold
 * replay. A renderer, marker, digest or receipt list cannot construct authority. */
export interface DarknessMaterialHost {
  eventId: string; revision: number; week: number; date: PublicGameDate; actorId: string; location: string;
  nowSecond: number; sourceDigest: string; verifiedReceipts: string[];
  sequence: 1 | 0; status: 'ACTIVE' | 'DEAD'; cash: number; actions: number;
  health: number; mind: number; spirituality: number; check: PublicCheckResult | null;
  /** Derived from the current original room and the authored Celine scene.
   * A closed door, absent custodian, unverified permission or refusal blocks. */
  legacyAccess: { siteId: string; roomAccessible: boolean; custodianId: string; custodianAtSite: boolean;
    investigation: 'ALLOW' | 'REFUSE' | 'UNVERIFIED'; handover: 'ALLOW' | 'REFUSE' | 'UNVERIFIED' } | null;
  succession: DarknessSuccessionFacts | null;
}
export interface DarknessMaterialEffect {
  cashCost: number; cashGain: number; actions: number; spirituality: number;
  mind: number; health: number; seconds: number; toLocation: string | null;
}
export const emptyDarknessMaterialEffect = (): DarknessMaterialEffect => ({ cashCost: 0, cashGain: 0,
  actions: 0, spirituality: 0, mind: 0, health: 0, seconds: 600, toLocation: null });
export interface DarknessMaterialResult<T> { state: T; effect: DarknessMaterialEffect; notes: string[] }
