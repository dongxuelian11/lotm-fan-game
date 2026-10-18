import type { PublicCheckResult } from '../../shared/contracts.js';
import type { TwilightGiantMaterialHost } from './types.js';
/** Private current values only. A public report, projection or digest is never authority. */
export interface TwilightGiantHost extends TwilightGiantMaterialHost {
  coreStats: import('./source.js').TwilightGiantBudget['coreStats']; mastery: Record<string, number>; weekAnchor: number; health: number; mind: number; spirituality: number; check: PublicCheckResult | null;
}
/** All resource values are positive debits, never signed healing deltas. */
export interface TwilightGiantEffect {
  cashCost: number; cashGain: number; actions: number; spirituality: number;
  mind: number; health: number; seconds: number; toLocation: string | null;
}
export const emptyTwilightGiantEffect = (): TwilightGiantEffect => ({ cashCost: 0, cashGain: 0,
  actions: 0, spirituality: 0, mind: 0, health: 0, seconds: 600, toLocation: null });
export interface TwilightGiantModuleResult<T> { state: T; effect: TwilightGiantEffect; notes: string[] }
