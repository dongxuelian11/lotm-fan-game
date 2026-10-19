import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { ManipulatorRitualCommand, ManipulatorRitualProjection, ManipulatorRitualState } from './ritual.js';
import type { ManipulatorActivityCommand, ManipulatorLifeProjection, ManipulatorLifeState } from './life.js';
import type { ManipulatorEncounterCommand, ManipulatorEncounterProjection, ManipulatorEncounterState } from './encounter.js';

export const MANIPULATOR_ABILITY_IDS = ['audience.s4.mind-island', 'audience.s4.virtual-persona', 'audience.s4.mental-plague'] as const;
export type ManipulatorAbilityId = typeof MANIPULATOR_ABILITY_IDS[number];
export const MANIPULATOR_DONOR_IDS = ['MP4-D1', 'MP4-D2', 'MP4-D3', 'MP4-D4', 'MP4-D5', 'MP4-D6', 'MP4-D7'] as const;
export type ManipulatorDonorId = typeof MANIPULATOR_DONOR_IDS[number];
export type ManipulatorAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' }
  | { type: 'MATERIAL_WORK' | 'BUY_MATERIALS' | 'BREW'; batchId: string }
  | { type: 'COLLECT_TEAR'; batchId: string; donorId: ManipulatorDonorId }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type ManipulatorCommand = ManipulatorAcquisitionCommand | ManipulatorRitualCommand | ManipulatorActivityCommand | ManipulatorEncounterCommand;
export interface ManipulatorMaterial {
  id: string; kind: 'HEART' | 'DRAGON_BLOOD' | 'GOLDEN_LEAVES'; name: string; quantity: number; unit: string;
  source: string; holder: 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
}
export interface ManipulatorTear {
  id: string; donorId: ManipulatorDonorId; batchId: string; eventId: string; event: string;
  quantity: 1; unit: '滴'; collectedWeek: number; consent: true; holder: 'PLAYER' | 'CONSUMED';
}
export interface ManipulatorBatch {
  id: string; source: string; stockedWeek: number | null; labourSteps: number; acquiredWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'BREWED'; materials: ManipulatorMaterial[]; tears: ManipulatorTear[];
  brewedWeek: number | null; bottleId: string | null;
}
export interface ManipulatorDonor {
  id: ManipulatorDonorId; name: string; age: number; location: string; source: string;
  emotion: string; story: string; willing: boolean; visits: { batchId: string; eventId: string; week: number; tearId: string }[];
}
export interface ManipulatorBottle {
  id: string; batchId: string; sourceItemIds: string[]; brewedWeek: number; status: 'PLAYER' | 'CONSUMED';
  consumedWeek: number | null; outcome: PublicResolutionTier | null; ritualId: string | null; ritualWindowWeek: number | null;
}
export interface ManipulatorState {
  guidanceKnown: boolean; batches: ManipulatorBatch[]; bottles: ManipulatorBottle[];
  donors: Record<ManipulatorDonorId, ManipulatorDonor>;
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; dreamwalkerActingAtPromotion: number | null;
  ritual: ManipulatorRitualState; life: ManipulatorLifeState; encounter: ManipulatorEncounterState;
}
export interface ManipulatorAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ManipulatorCommand;
}
export interface ManipulatorProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: boolean; formula: { name: string; quantity: number; unit: string }[]; formulaAlternatives: string;
  story?: string; supplies: string; actions: ManipulatorAction[];
  batches: { id: string; title: string; source: string; status: string; labourSteps: number; price: number; materials: { id: string; name: string; quantity: number; unit: string; status: string }[]; tears: { id: string; donorId: string; source: string; status: string }[]; bottleId: string | null }[];
  donors: { id: ManipulatorDonorId; name: string; age: number; location: string; emotion: string; story: string; consent: string; willing: boolean; collectedBatchIds: string[] }[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ManipulatorCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  ritual: ManipulatorRitualProjection; life: ManipulatorLifeProjection; encounter: ManipulatorEncounterProjection;
  insideCase: boolean; environment: string;
}
export type ManipulatorPublicView = ManipulatorProjection;
