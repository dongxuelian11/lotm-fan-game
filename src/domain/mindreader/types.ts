import type { PublicResolutionTier } from '../../shared/contracts.js';

export const MINDREADER_ABILITY_IDS = ['audience.mind-reading'] as const;
export type MindreaderAbilityId = typeof MINDREADER_ABILITY_IDS[number];
export const MINDREADER_CASE_IDS = ['lost-key', 'curtain-call', 'harbor-message'] as const;
export type MindreaderCaseId = typeof MINDREADER_CASE_IDS[number];
export type MindreaderApproach = 'ASK' | 'VERIFY';

export type MindreaderAcquisitionCommand =
  | { type: 'LEARN_FORMULA' }
  | { type: 'MATERIAL_WORK'; batchId: string }
  | { type: 'BUY_MATERIALS'; batchId: string }
  | { type: 'BREW'; batchId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type MindreaderSocialCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'READ'; caseId: string }
  | { type: 'DISCUSS'; caseId: string; approach: MindreaderApproach }
  | { type: 'REFLECT' };
export type MindreaderCommand = MindreaderAcquisitionCommand | MindreaderSocialCommand;

export interface MindreaderMaterial {
  id: string; name: string; quantity: number; unit: string; source: string;
  holder: 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
}
export interface MindreaderBatch {
  id: string; materials: MindreaderMaterial[]; labourSteps: number; acquired: boolean; brewed: boolean;
}
export interface MindreaderBottle {
  id: string; batchId: string; inputIds: string[]; brewedWeek: number;
  status: 'PREPARED' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface MindreaderCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'RESOLVED';
  readWeek: number | null; readSucceeded: boolean;
  attemptWeek: number | null; approach: MindreaderApproach | null;
}
export interface MindreaderState {
  formulaKnown: boolean;
  batches: MindreaderBatch[]; bottles: MindreaderBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; audienceActingAtPromotion: number | null;
  cases: Record<string, MindreaderCaseState>;
  reflected: boolean;
}
export interface MindreaderAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: MindreaderCommand;
}
export interface MindreaderSceneProjection {
  id: string; title: string; story: string; observations: string[]; impression: string; status: string; dialogue?: string;
}
export interface MindreaderProjection {
  title: string; discovered: boolean; formulaKnown: boolean; promoted: boolean;
  story?: string;
  formula: { name: string; quantity: number; unit: string }[];
  actions: MindreaderAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: MindreaderCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  scenes: MindreaderSceneProjection[];
}
