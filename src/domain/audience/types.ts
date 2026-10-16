import type { PublicResolutionTier } from '../../shared/contracts.js';

export const AUDIENCE_ABILITY_IDS = [
  'audience.observation',
  'audience.behavior-analysis',
  'audience.memory-deduction',
] as const;
export type AudienceAbilityId = typeof AUDIENCE_ABILITY_IDS[number];
export const AUDIENCE_CASE_IDS = ['counter-receipt', 'backstage-letter', 'boarding-house', 'night-deposition'] as const;
export type AudienceCaseId = typeof AUDIENCE_CASE_IDS[number];
export type AudienceApproach = 'ASK' | 'VERIFY' | 'ACCUSE';

export type AudienceAcquisitionCommand =
  | { type: 'DISCOVER' }
  | { type: 'LEARN_FORMULA' }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' }
  | { type: 'MATERIAL_WORK'; batchId: string }
  | { type: 'BUY_MATERIALS'; batchId: string }
  | { type: 'BREW'; batchId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type AudienceSocialCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'DISCUSS'; caseId: string; approach: AudienceApproach }
  | { type: 'REFLECT' };
export type AudienceCommand = AudienceAcquisitionCommand | AudienceSocialCommand;

export interface AudienceMaterial {
  id: string; name: string; quantity: number; unit: string; source: string;
  holder: 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
}
export interface AudienceBatch {
  id: string; materials: AudienceMaterial[]; labourSteps: number; acquired: boolean; brewed: boolean;
}
export interface AudienceBottle {
  id: string; batchId: string; inputIds: string[]; brewedWeek: number;
  status: 'PREPARED' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface AudienceCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'RESOLVED';
  attemptWeek: number | null; approach: string | null; verified: boolean;
}
export interface AudienceState {
  discovered: boolean; formulaKnown: boolean;
  resupply: { requestedWeek: number | null; deliveries: number };
  batches: AudienceBatch[]; bottles: AudienceBottle[];
  social: { cases: Record<string, AudienceCaseState>; trust: number; reflected: boolean };
}
export interface AudienceAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: AudienceCommand;
}
export interface AudienceSceneProjection {
  id: string; title: string; story: string; observations: string[]; interpretation: string; status: string;
}
export interface AudienceProjection {
  title: string; discovered: boolean; formulaKnown: boolean; promoted: boolean;
  formula: { name: string; quantity: number; unit: string }[];
  actions: AudienceAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: AudienceCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  scenes: AudienceSceneProjection[]; trust: number;
}
