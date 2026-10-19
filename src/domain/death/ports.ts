import type { PublicCheckResult } from '../../shared/contracts.js';
import type { DeathMaterialHost } from './types.js';

/** Constructed only from the private owned head. Public reports cannot set
 * resource values, permissions, material locations, checks or service results. */
export interface DeathHost extends DeathMaterialHost {
  health: number; mind: number; spirituality: number; check: PublicCheckResult | null;
}
/** Positive debits match the Sun module boundary. Ordinary healing, clinic
 * treatment and weekly accounting belong to the chapter engine, not a service. */
export interface DeathEffect {
  cashCost: number; cashGain: number; actions: number; spirituality: number;
  mind: number; health: number; seconds: number; toLocation: string | null;
}
/** A blank result advances no time. Each real operation must explicitly set its duration. */
export const emptyDeathEffect = (): DeathEffect => ({ cashCost: 0, cashGain: 0,
  actions: 0, spirituality: 0, mind: 0, health: 0, seconds: 0, toLocation: null });
export interface DeathModuleResult<T> { state: T; effect: DeathEffect; notes: string[] }
