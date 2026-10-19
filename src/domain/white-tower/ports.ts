import type { PublicCheckResult } from '../../shared/contracts.js';
import type { WhiteTowerMaterialHost } from './types.js';
/** Private current values only. A public report, projection or digest is never authority. */
export interface WhiteTowerHost extends WhiteTowerMaterialHost {
  weekAnchor: number; health: number; mind: number; spirituality: number; check: PublicCheckResult | null;
}
/** All resource values are positive debits, never signed healing deltas. */
export interface WhiteTowerEffect {
  cashCost: number; cashGain: number; actions: number; spirituality: number;
  mind: number; health: number; seconds: number; toLocation: string | null;
}
export const emptyWhiteTowerEffect = (): WhiteTowerEffect => ({ cashCost: 0, cashGain: 0,
  actions: 0, spirituality: 0, mind: 0, health: 0, seconds: 600, toLocation: null });
export interface WhiteTowerModuleResult<T> { state: T; effect: WhiteTowerEffect; notes: string[] }
