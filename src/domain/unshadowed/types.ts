import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { UnshadowedRitualCommand, UnshadowedRitualProjection, UnshadowedRitualState } from './ritual.js';
import type { UnshadowedActivityCommand, UnshadowedLifeProjection, UnshadowedLifeState } from './life.js';
import type { UnshadowedEncounterCommand, UnshadowedEncounterProjection, UnshadowedEncounterState } from './encounter.js';

export const UNSHADOWED_ABILITY_IDS = ['sun.s4.unshadowed-domain', 'sun.s4.purification', 'sun.s4.sunflare'] as const;
export type UnshadowedAbilityId = typeof UNSHADOWED_ABILITY_IDS[number];
export type UnshadowedAcquisitionCommand =
  | { type: 'LEARN_FORMULA' } | { type: 'REQUEST_SUPPLY' } | { type: 'RECEIVE_SUPPLY' }
  | { type: 'POTION_WORK'; batchId: string } | { type: 'BUY_MATERIALS'; batchId: string } | { type: 'BREW'; batchId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type UnshadowedCommand = UnshadowedAcquisitionCommand | UnshadowedRitualCommand | UnshadowedActivityCommand | UnshadowedEncounterCommand;
export interface UnshadowedMaterial { id: string; name: string; quantity: number; unit: string; source: string; holder: 'SUPPLIER' | 'PLAYER' | 'CONSUMED' }
export interface UnshadowedBatch { id: string; materials: UnshadowedMaterial[]; stockedWeek: number | null; labourSteps: number; acquired: boolean; acquiredWeek: number | null; brewed: boolean }
export interface UnshadowedBottle { id: string; batchId: string; inputIds: string[]; brewedWeek: number; status: 'PREPARED' | 'CONSUMED'; outcome: PublicResolutionTier | null; consumedWeek: number | null; ritualId: string | null }
export interface UnshadowedState {
  formulaKnown: boolean; batches: UnshadowedBatch[]; bottles: UnshadowedBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; priestOfLightActingAtPromotion: number | null;
  ritual: UnshadowedRitualState; life: UnshadowedLifeState; encounter: UnshadowedEncounterState;
}
export interface UnshadowedAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: UnshadowedCommand }
export interface UnshadowedProjection {
  title: string; discovered: boolean; formulaKnown: boolean; promoted: boolean;
  formula: { name: string; quantity: number; unit: string; note?: string }[];
  story?: string; supplies: string; actions: UnshadowedAction[];
  batches: { id: string; title: string; status: string; labourSteps: number; materials: UnshadowedMaterial[] }[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: UnshadowedCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  ritual: UnshadowedRitualProjection; life: UnshadowedLifeProjection; encounter: UnshadowedEncounterProjection;
  insideCase: boolean; environment: string;
}
export type UnshadowedPublicView = UnshadowedProjection;
export type { UnshadowedRitualCommand, UnshadowedRitualProjection, UnshadowedRitualState } from './ritual.js';
