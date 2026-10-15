import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { SecretsSorcererRitualCommand, SecretsSorcererRitualProjection, SecretsSorcererRitualState } from './ritual.js';
import type { SecretsSorcererActivityCommand, SecretsSorcererLifeProjection, SecretsSorcererLifeState } from './life.js';

export const SECRETS_SORCERER_ABILITY_IDS = ['door.s4.space-hiding', 'door.s4.space-pocket', 'door.s4.banishment'] as const;
export type SecretsSorcererAbilityId = typeof SECRETS_SORCERER_ABILITY_IDS[number];
export type SecretsSorcererAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type SecretsSorcererRecordCommand = { type: 'RECORD_SAMPLE'; sample: 'FLASH' | 'COURAGE' };
export type SecretsSorcererCommand = SecretsSorcererAcquisitionCommand | SecretsSorcererRitualCommand | SecretsSorcererActivityCommand | SecretsSorcererRecordCommand;
export interface SecretsSorcererBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
  ritualAttemptId: string | null;
}
export interface SecretsSorcererState {
  guidanceKnown: boolean; bottles: SecretsSorcererBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; travelerActingAtPromotion: number | null;
  ritual: SecretsSorcererRitualState; life: SecretsSorcererLifeState;
}
export interface SecretsSorcererAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SecretsSorcererCommand;
}
export interface SecretsSorcererProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; actions: SecretsSorcererAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: SecretsSorcererCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  ritual: SecretsSorcererRitualProjection; life: SecretsSorcererLifeProjection;
  insideCase: boolean; environment: string;
}
export type SecretsSorcererPublicView = SecretsSorcererProjection;
export type { SecretsSorcererRitualCommand, SecretsSorcererRitualProjection, SecretsSorcererRitualState } from './ritual.js';
export type { SecretsSorcererActivityCommand, SecretsSorcererLifeProjection, SecretsSorcererLifeState } from './life.js';
