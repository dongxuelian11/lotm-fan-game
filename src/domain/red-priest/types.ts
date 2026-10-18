import type { PublicCheckResult } from '../../shared/contracts.js';
import type { RedPriestSource, RedPriestBudget, RedPriestFinance } from './source.js';
import type { RedPriestCampaignCommand, RedPriestCampaignState, RedPriestCampaignHost } from './campaign.js';
import type { RedPriestMaterialCommand, RedPriestMaterialsState, RedPriestMaterialEvent } from './materials.js';
import type { RedPriestEpilogueState, RedPriestEpilogueCommand } from './epilogue.js';
export type { RedPriestSource } from './source.js';
export const RED_PRIEST_ABILITY_IDS = ['hunter.s0.shared-standard', 'hunter.s0.bounded-flame'] as const;
export type RedPriestAbilityId = typeof RED_PRIEST_ABILITY_IDS[number];
export type RedPriestCommand =
  | { type: 'LEARN_GUIDANCE' | 'WORK' | 'REST' | 'CLINIC' | 'NEXT_WEEK' | 'START_EPILOGUE' | 'START_PREPARED_EPILOGUE' | 'RETURN_ON_FOOT' }
  | { type: 'TRAVEL'; to: string }
  | { type: 'CAMPAIGN'; command: RedPriestCampaignCommand }
  | { type: 'MATERIAL'; command: RedPriestMaterialCommand }
  | { type: 'STABILIZE_PROMOTION'; compoundId: string }
  | { type: 'CONSUME'; compoundId: string; confirmed: true }
  | { type: 'EPILOGUE'; command: RedPriestEpilogueCommand };
export interface RedPriestFrame {
  budget: RedPriestBudget; random: { seed: string; cursor: number };
  finance: RedPriestFinance; location: string; nowSecond: number;
}
export interface RedPriestCheckReceipt {
  kind: 'CHECK'; id: string; check: PublicCheckResult; cursorBefore: number; cursorAfter: number;
}
export interface RedPriestEvent {
  id: string; revision: number; command: RedPriestCommand; before: RedPriestFrame; after: RedPriestFrame;
  randomReceipts: RedPriestCheckReceipt[]; campaignHost: RedPriestCampaignHost | null;
  materialReceipt: RedPriestMaterialEvent | null;
  financeReceipts: { title: string; text: string }[]; notes: string[];
  beforeDigest: string; afterDigest: string;
}
export interface RedPriestPromotionWitness {
  polityId: import('./campaign-content.js').CampaignCoalitionId;
  authorizationEventId: string; authorizationReceiptId: string;
  legionId: import('./campaign-content.js').CampaignLegionId; personnel: number;
}
/** Created only by the paid command. No default field is added to legacy roots. */
export interface RedPriestPromotionPreparation {
  id: string; eventId: string; compoundId: string; actorId: string;
  originDigest: string; supplyReceiptId: string; locationId: string;
  startedWeek: number; completedWeek: number; campaignId: string; warStartedEventId: string;
  victoryReceiptIds: string[]; witnesses: RedPriestPromotionWitness[];
  originals: { itemId: string; sourceEventId: string }[];
  status: 'READY' | 'SPENT' | 'INVALIDATED'; spentEventId: string | null; invalidatedEventId: string | null;
}
export interface RedPriestState {
  version: 1; guidanceKnown: boolean; source: RedPriestSource | null; frame: RedPriestFrame | null;
  promotionWeek: number | null; campaign: RedPriestCampaignState | null; materials: RedPriestMaterialsState | null;
  epilogue: RedPriestEpilogueState | null; journal: RedPriestEvent[];
  promotionStability?: { version: 1; preparations: RedPriestPromotionPreparation[] };
}
export interface RedPriestAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null;
  command: RedPriestCommand; preferredAction?: boolean;
}
export interface RedPriestProjection {
  title: string; guidanceKnown: boolean; promoted: boolean; story: string; nextStep: string; risk: string;
  resources: { health: number; mind: number; spirituality: number; cash: string; actionsRemaining: number };
  abilities: { id: string; label: string; mastery: number; description: string }[];
  actions: RedPriestAction[]; sections: { id: string; title: string; lines: string[] }[]; insideCase: boolean;
}
