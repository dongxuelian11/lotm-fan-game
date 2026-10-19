import type { PublicCheckResult } from '../../shared/contracts.js';
/** Private authoritative host values. Public commands cannot supply these. The
 * central journal reconstructs every host/check during strict replay; the owned
 * runtime creates them from its exclusively held current state. */
export interface MoonHost {
  eventId: string; revision: number; week: number; actorId: string; location: string;
  nowSecond: number; weekAnchor: number; verifiedReceipts: string[]; sequence: 1 | 0; status: 'ACTIVE' | 'DEAD'; cash: number; actions: number;
  health: number; mind: number; spirituality: number;
  check: PublicCheckResult | null;
}
export interface MoonEffect {
  cashCost: number; cashGain: number; actions: number; spirituality: number;
  mind: number; health: number; seconds: number; toLocation: string | null;
}
export const emptyMoonEffect = (): MoonEffect => ({ cashCost: 0, cashGain: 0,
  actions: 0, spirituality: 0, mind: 0, health: 0, seconds: 600, toLocation: null });
export interface MoonModuleResult<T> { state: T; effect: MoonEffect; notes: string[] }
