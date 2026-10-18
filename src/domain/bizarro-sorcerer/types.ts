import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { BizarroRitualCommand, BizarroRitualProjection, BizarroRitualState } from './ritual.js';
import type { BizarroActivityCommand, BizarroLifeProjection, BizarroLifeState } from './life.js';

export const BIZARRO_SORCERER_ABILITY_IDS = ['diviner.s4.worm-assignment', 'diviner.s4.puppet-swap'] as const;
export type BizarroSorcererAbilityId = typeof BIZARRO_SORCERER_ABILITY_IDS[number];
export type BizarroSorcererAcquisitionCommand =
  | { type: 'LEARN_FORMULA' } | { type: 'REQUEST_SUPPLY' } | { type: 'RECEIVE_SUPPLY' }
  | { type: 'MATERIAL_WORK'; batchId: string } | { type: 'BUY_MATERIALS'; batchId: string } | { type: 'BREW'; batchId: string }
  | { type: 'CONSUME_FINALE'; bottleId: string; confirmed: true };
export type BizarroSorcererCommand = BizarroSorcererAcquisitionCommand | BizarroRitualCommand | BizarroActivityCommand;
export interface BizarroSorcererMaterial {
  id: string; name: string; quantity: number; unit: string; source: string; holder: 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
}
export interface BizarroSorcererBatch { id: string; materials: BizarroSorcererMaterial[]; labourSteps: number; acquired: boolean; brewed: boolean }
export interface BizarroSorcererBottle {
  id: string; batchId: string; inputIds: string[]; brewedWeek: number;
  status: 'PREPARED' | 'CONSUMED'; outcome: PublicResolutionTier | null;
  consumedWeek: number | null; ritualAttemptId: string | null;
}
export interface BizarroSorcererState {
  formulaKnown: boolean; resupply: { requestedWeek: number | null; deliveries: number };
  batches: BizarroSorcererBatch[]; bottles: BizarroSorcererBottle[];
  promotionWeek: number | null; marionettistActingAtPromotion: number | null;
  ritual: BizarroRitualState; life: BizarroLifeState;
}
export interface BizarroSorcererAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: BizarroSorcererCommand }
export interface BizarroSorcererProjection {
  title: string; discovered: boolean; formulaKnown: boolean; promoted: boolean;
  formula: { name: string; quantity: number | null; unit: string; note?: string }[];
  story?: string; supplies: string; actions: BizarroSorcererAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: BizarroSorcererCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  ritual: BizarroRitualProjection; life: BizarroLifeProjection; insideCase: boolean; environment: string;
}
