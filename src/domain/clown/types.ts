import type { PublicResolutionTier } from '../../shared/contracts.js';

export const CLOWN_ABILITY_IDS = [
  'diviner.s8.body-control',
  'diviner.s8.balance',
  'diviner.s8.agility',
  'diviner.s8.danger-prediction',
  'diviner.s8.paper-dagger',
] as const;
export type ClownAbilityId = typeof CLOWN_ABILITY_IDS[number];

export type ClownAcquisitionCommand =
  | { type: 'LEARN_FORMULA' }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' }
  | { type: 'MATERIAL_WORK'; batchId: string }
  | { type: 'BUY_MATERIALS'; batchId: string }
  | { type: 'BREW'; batchId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'BUY_PAPER' };
export type ClownCommand = ClownAcquisitionCommand
  | { type: 'PRACTICE'; practiceId: string }
  | { type: 'RESCUE_TALK' }
  | { type: 'RESCUE_FIGHT' };

export interface ClownMaterial {
  id: string; name: string; quantity: number; unit: string; source: string;
  holder: 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
}
export interface ClownBatch {
  id: string; materials: ClownMaterial[]; labourSteps: number; acquired: boolean; brewed: boolean;
}
export interface ClownBottle {
  id: string; batchId: string; inputIds: string[]; brewedWeek: number;
  status: 'PREPARED' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface ClownState {
  formulaKnown: boolean;
  resupply: { requestedWeek: number | null; deliveries: number };
  batches: ClownBatch[];
  bottles: ClownBottle[];
  promotionWeek: number | null;
  seerActingAtPromotion: number | null;
  paperStock: number;
  paperSheets: number;
  paperSpent: number;
  practices: string[];
  trainingAttempts: Record<string, number>;
  rescue: {
    status: 'AVAILABLE' | 'FIGHTING' | 'RESCUED' | 'RETREATED' | 'LOST';
    attemptWeek: number | null;
    startHistoryIndex: number | null;
    enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
    parcelHolder: 'COURIER';
    parcelOwner: 'courier-elsie';
  };
}
export interface ClownAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ClownCommand;
}
export interface ClownProjection {
  title: string; discovered: boolean; formulaKnown: boolean; promoted: boolean;
  story?: string;
  formula: { name: string; quantity: number; unit: string }[];
  actions: ClownAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ClownCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  paperStock: number; paperSheets: number; paperSpent: number;
}
