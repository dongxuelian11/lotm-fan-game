import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { SageSiteState } from '../sage/life.js';
import type { ScrollProfessorWorkshop } from '../scroll-professor/types.js';
import type { KnowledgeEmperorActivityCommand, KnowledgeEmperorLifeProjection, KnowledgeEmperorLifeState } from './life.js';
import type { KnowledgeEmperorEncounterCommand, KnowledgeEmperorEncounterProjection, KnowledgeEmperorEncounterState } from './encounter.js';

export const KNOWLEDGE_EMPEROR_ABILITY_IDS = ['hermit.s1.knowledge-power', 'hermit.s1.power-knowledge'] as const;
export type KnowledgeEmperorAbilityId = typeof KNOWLEDGE_EMPEROR_ABILITY_IDS[number];
export const KNOWLEDGE_EMPEROR_PREPARATION_IDS = ['VERIFY_ORIGINALS', 'VERIFY_KNOWLEDGE', 'CHECK_RETURN'] as const;
export type KnowledgeEmperorPreparationId = typeof KNOWLEDGE_EMPEROR_PREPARATION_IDS[number];
export type KnowledgeEmperorAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' | 'PREPARE_PROMOTION' | 'LEAVE_PREPARATION' }
  | { type: 'PREPARE_TASK'; taskId: KnowledgeEmperorPreparationId }
  | { type: 'POTION_WORK' | 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type KnowledgeEmperorCommand = KnowledgeEmperorAcquisitionCommand | KnowledgeEmperorActivityCommand | KnowledgeEmperorEncounterCommand;
export interface KnowledgeEmperorBottle {
  id: string; source: string; stockedWeek: number | null; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null; preparationWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface KnowledgeEmperorPrices { guidance: number; potion: number; labourCredit: number; labourBalance: number; preparation: number; resupply: number }
export type KnowledgeEmperorFinance = Pick<SliceState, 'weeklyBudget' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface KnowledgeEmperorAcquisitionBudget {
  actions: number; health: number; mind: number; spirituality: number; cash: number; pollution: number;
  gender: string; sequence: 2 | 1; acting: number; coreStats: SliceState['character']['coreStats'];
  mastery: Record<string, number>; completedSources: string[]; injuries: SliceState['injuries']; injuryRisk: number;
}
export interface KnowledgeEmperorAcquisitionEvent {
  week: number; date: PublicGameDate; revision: number; command: KnowledgeEmperorAcquisitionCommand;
  actor: { name: string; gender: string; age: number; sourceHistoryDigest: string | null; sourceIdentityDigest: string; pathwayId: 'hermit'; sagePromotionWeek: number; pryerPromotionWeek: number };
  before: KnowledgeEmperorAcquisitionBudget; after: KnowledgeEmperorAcquisitionBudget; finance: KnowledgeEmperorFinance;
  cursorBefore: number; cursorAfter: number; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
}
export const KNOWLEDGE_EMPEROR_SOURCE_KEYS = ['pryer', 'combatScholar', 'wizard', 'scrollProfessor', 'starMystic', 'mystic', 'prophecyMaster', 'sage'] as const;
export type KnowledgeEmperorSourceHistory = Pick<SliceState, typeof KNOWLEDGE_EMPEROR_SOURCE_KEYS[number]>;
export interface KnowledgeEmperorOriginals { site: SageSiteState; workshop: ScrollProfessorWorkshop }
export interface KnowledgeEmperorSourceScene {
  week: number; date: PublicGameDate; revision: number; random: SliceState['random'];
  budget: KnowledgeEmperorAcquisitionBudget; finance: KnowledgeEmperorFinance; identityDigest: string; historyDigest: string;
  character: SliceState['character']; originals: KnowledgeEmperorOriginals;
  combatHistoryLength: number; combatHistoryDigest: string; city: 'BACKLUND';
}
export interface KnowledgeEmperorState {
  guidanceKnown: boolean; sourceWeek: number | null; bottles: KnowledgeEmperorBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; sageActingAtPromotion: number | null;
  preparations: { taskId: KnowledgeEmperorPreparationId; completedWeek: number }[];
  preparedWeek: number | null; acquisitionJournal: KnowledgeEmperorAcquisitionEvent[];
  /** Eight immutable predecessor roots; live people, inventory and body continue in the new root only. */
  sourceHistory: KnowledgeEmperorSourceHistory | null; sourceScene: KnowledgeEmperorSourceScene | null;
  life: KnowledgeEmperorLifeState; encounter: KnowledgeEmperorEncounterState;
}
export interface KnowledgeEmperorAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: KnowledgeEmperorCommand; cleanup?: boolean; preferredAction?: boolean;
}
export interface KnowledgeEmperorProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  sourceLabel: string; prices: KnowledgeEmperorPrices | null;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  story?: string; supplies: string; nextStep: string; preferredActionId: string | null; actions: KnowledgeEmperorAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: KnowledgeEmperorAcquisitionCommand }[];
  preparations: { taskId: KnowledgeEmperorPreparationId; title: string; completedWeek: number | null }[];
  preparedWeek: number | null;
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number } | null;
  injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
  characterName: string; currentGender: string; inheritedHistory: string[]; appearanceRecord: string; inheritedTools: string;
  life: KnowledgeEmperorLifeProjection; encounter: KnowledgeEmperorEncounterProjection;
  insideCase: boolean; environment: string;
}
export type KnowledgeEmperorPublicView = KnowledgeEmperorProjection;
export type { KnowledgeEmperorActivityCommand, KnowledgeEmperorLifeProjection, KnowledgeEmperorLifeState } from './life.js';
export type { KnowledgeEmperorEncounterCommand, KnowledgeEmperorEncounterProjection, KnowledgeEmperorEncounterState } from './encounter.js';
