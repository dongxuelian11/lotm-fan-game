import type { PublicCheckResult } from '../../shared/contracts.js';
/** Private authoritative host values. Public commands cannot supply these. The
 * central journal reconstructs every host/check during strict replay; the owned
 * runtime creates them from its exclusively held current state. */
export interface VisionaryHost {
  eventId: string; revision: number; week: number; actorId: string; location: string;
  sequence: 1 | 0; status: 'ACTIVE' | 'DEAD'; cash: number; actions: number;
  health: number; mind: number; spirituality: number;
  check: PublicCheckResult | null;
}
export interface VisionaryEffect {
  cashCost: number; cashGain: number; actions: number; spirituality: number;
  mind: number; health: number; weeks: number; toLocation: string | null;
}
export const emptyVisionaryEffect = (): VisionaryEffect => ({ cashCost: 0, cashGain: 0,
  actions: 0, spirituality: 0, mind: 0, health: 0, weeks: 0, toLocation: null });
export interface VisionaryModuleResult<T> { state: T; effect: VisionaryEffect; notes: string[] }
