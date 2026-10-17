import type { DarknessMaterialHost, DarknessMaterialEffect } from './material-ports.js';
/** Private authoritative values, reconstructed by strict replay and never
 * accepted from a public intent, certificate, digest or projection. */
export interface DarknessHost extends DarknessMaterialHost { weekAnchor: number }
/** Costs are non-negative debits. The evacuation delta adapter is explicit. */
export interface DarknessEffect extends DarknessMaterialEffect {}
export const emptyDarknessEffect = (): DarknessEffect => ({ cashCost: 0, cashGain: 0,
  actions: 0, spirituality: 0, mind: 0, health: 0, seconds: 600, toLocation: null });
export interface DarknessModuleResult<T> { state: T; effect: DarknessEffect; notes: string[] }
