import type { PublicResolutionTier } from '../../shared/contracts.js';

export const MAGICIAN_ABILITY_IDS = [
  'diviner.s7.damage-transfer',
  'diviner.s7.flame-jump',
  'diviner.s7.air-bullet',
  'diviner.s7.paper-figurine',
  'diviner.s7.flame-control',
  'diviner.s7.illusion',
  'diviner.s7.underwater-breathing',
  'diviner.s7.bone-softening',
  'diviner.s7.paper-weapon',
] as const;
export type MagicianAbilityId = typeof MAGICIAN_ABILITY_IDS[number];

export type MagicianAcquisitionCommand =
  | { type: 'LEARN_FORMULA' }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' }
  | { type: 'MATERIAL_WORK'; batchId: string }
  | { type: 'BUY_MATERIALS'; batchId: string }
  | { type: 'BREW'; batchId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type MagicianActivityCommand =
  | { type: 'BUY_OIL' }
  | { type: 'PREPARE_LANTERN' }
  | { type: 'PREPARE_FIGURINE' }
  | { type: 'PRACTICE'; practiceId: string }
  | { type: 'TRANSFER_INJURY'; injuryId: string }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' }
  | { type: 'REFLECT' };
export type MagicianCommand = MagicianAcquisitionCommand | MagicianActivityCommand;

export interface MagicianMaterial {
  id: string; name: string; quantity: number; unit: string; source: string;
  holder: 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
}
export interface MagicianBatch {
  id: string; materials: MagicianMaterial[]; labourSteps: number; acquired: boolean; brewed: boolean;
}
export interface MagicianBottle {
  id: string; batchId: string; inputIds: string[]; brewedWeek: number;
  status: 'PREPARED' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface MagicianState {
  formulaKnown: boolean;
  resupply: { requestedWeek: number | null; deliveries: number };
  batches: MagicianBatch[];
  bottles: MagicianBottle[];
  promotionWeek: number | null;
  clownActingAtPromotion: number | null;
  practices: string[];
  practiceAttempts: Record<string, number>;
  figurinesMade: number;
  figurinesHeld: number;
  figurinesUsed: number;
  lantern: { oilStock: number; oilHeld: number; oilSpent: number; prepared: boolean; deliveries: number; lastSupplyWeek: number | null };
  damageTransfers: string[];
  reflected: boolean;
  encounter: { status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; startHistoryIndex: number | null; attemptWeek: number | null };
}
export interface MagicianAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: MagicianCommand;
}
export interface MagicianProjection {
  title: string; discovered: boolean; formulaKnown: boolean; promoted: boolean;
  story?: string;
  formula: { name: string; quantity: number; unit: string }[];
  actions: MagicianAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: MagicianCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  practices: { id: string; title: string; story: string; status: string }[];
  supplies: { figurinesHeld: number; paperSheets: number; oilHeld: number; lanternPrepared: boolean };
}
