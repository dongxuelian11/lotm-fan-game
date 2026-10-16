import type { AttendantMysteriesReceptionState, AttendantMysteriesReceptionCommand, AttendantMysteriesReceptionProjection } from './reception.js';
import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { TownState, TownCommand, HostFacts, Cost } from './town.js';
import type { AttendantMysteriesActivityCommand, AttendantMysteriesLifeState, AttendantMysteriesLifeProjection } from './life.js';
import type { AttendantMysteriesEncounterCommand, AttendantMysteriesEncounterState, AttendantMysteriesEncounterProjection } from './encounter.js';

export const ATTENDANT_MYSTERIES_ABILITY_IDS = ['diviner.s1.thread-regeneration', 'diviner.s1.bounded-grafting', 'diviner.s1.mysterious-realm'] as const;
export type AttendantMysteriesAbilityId = typeof ATTENDANT_MYSTERIES_ABILITY_IDS[number];
export type AttendantMysteriesAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'LEAVE_PREPARATION' }
  | { type: 'MATERIAL_WORK' | 'BUY_MATERIALS' | 'BREW'; batchId: string }
  | { type: 'PREPARE_PROMOTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type AttendantMysteriesTownCommand = { type: 'TOWN'; command: TownCommand };
export type AttendantMysteriesCommand = AttendantMysteriesReceptionCommand | AttendantMysteriesAcquisitionCommand | AttendantMysteriesTownCommand | AttendantMysteriesActivityCommand | AttendantMysteriesEncounterCommand;
export interface AttendantMysteriesMaterial { id: string; name: string; quantity: number; unit: string; source: string; holder: 'SUPPLIER' | 'PLAYER' | 'CONSUMED' }
export interface AttendantMysteriesBatch { id: string; stockedWeek: number | null; labourSteps: number; acquiredWeek: number | null; brewedWeek: number | null; materials: AttendantMysteriesMaterial[] }
export interface AttendantMysteriesBottle { id: string; batchId: string; inputIds: string[]; brewedWeek: number; status: 'PREPARED' | 'CONSUMED'; consumedWeek: number | null; outcome: PublicResolutionTier | null; regionId: string | null }
export interface AttendantMysteriesBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  sequence: 2 | 1; acting: number; coreStats: SliceState['character']['coreStats']; mastery: Record<string, number>;
  completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number;
}
export interface AttendantMysteriesAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: AttendantMysteriesAcquisitionCommand;
  actor: { name: string; gender: string; age: number; pathwayId: 'diviner'; miracleWorkerPromotionWeek: number; sourceHistoryDigest: string };
  before: AttendantMysteriesBudget; after: AttendantMysteriesBudget;
  randomBefore: number; randomAfter: number; check: PublicCheckResult | null;
  townEvidence: TownState | null;
}
export interface AttendantMysteriesTownEvent {
  week: number; date: PublicGameDate; revision: number; command: TownCommand;
  actor: { name: string; pathwayId: 'diviner'; sourceHistoryDigest: string };
  before: AttendantMysteriesBudget; after: AttendantMysteriesBudget; host: HostFacts; paid: Cost;
  randomBefore: number; randomAfter: number; journalIndex: number;
}
export interface AttendantMysteriesPreparation { week: number; bottleId: string; regionId: string; epoch: number; townJournalLength: number; evidenceDigest: string }
export interface AttendantMysteriesState {
  guidanceKnown: boolean; guidanceWeek: number | null; sourceHistoryDigest: string | null;
  batches: AttendantMysteriesBatch[]; bottles: AttendantMysteriesBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; miracleWorkerActingAtPromotion: number | null;
  preparation: AttendantMysteriesPreparation | null; acquisitionJournal: AttendantMysteriesAcquisitionEvent[];
  town: TownState | null; townJournal: AttendantMysteriesTownEvent[];
  reception: AttendantMysteriesReceptionState;
  life: AttendantMysteriesLifeState; encounter: AttendantMysteriesEncounterState;
}
export interface AttendantMysteriesAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: AttendantMysteriesCommand; cleanup?: boolean; preferredAction?: boolean; irreversible?: boolean }
export interface AttendantMysteriesTownProjection {
  title: string; summary: string; location: string; nextStep: string; preferredActionId: string | null;
  residents: { id: string; name: string; source: string; bodyId: string; alive: boolean; status: string; location: string; facility: string; worm: string; fateCount: number }[];
  facilities: { id: string; label: string; built: boolean; staffed: number; condition: number; output: number }[];
  visitors: { id: string; label: string; location: string; consent: string; completed: number }[];
  ledger: string[]; requirements: { label: string; complete: boolean; detail: string }[];
  region: string; ready: boolean; actions: AttendantMysteriesAction[];
}
export interface AttendantMysteriesProjection {
  title: string; discovered: boolean; promoted: boolean; guidanceKnown: boolean; formulaKnown: boolean;
  formula: { name: string; quantity: number; unit: string; note?: string }[];
  story: string; boundary: string; risk: string; supplies: string; nextStep: string; preferredActionId: string | null;
  actions: AttendantMysteriesAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: AttendantMysteriesAcquisitionCommand }[];
  abilities: { id: string; label: string; description: string; mastery: number }[];
  acting: number; digestion: string; pollution: number;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  inheritedHistory: string[]; insideCase: boolean; environment: string;
  reception: AttendantMysteriesReceptionProjection;
  town: AttendantMysteriesTownProjection; life: AttendantMysteriesLifeProjection; encounter: AttendantMysteriesEncounterProjection;
}
export type AttendantMysteriesPublicView = AttendantMysteriesProjection;
