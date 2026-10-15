import type { MarionettistPuppetState, MarionettistPuppetCommand, MarionettistPuppetProjection } from './puppet.js';
import type { PublicResolutionTier } from '../../shared/contracts.js';

export const MARIONETTIST_ABILITY_IDS = ['diviner.s5.spirit-threads', 'diviner.s5.marionette-control'] as const;
export type MarionettistAbilityId = typeof MARIONETTIST_ABILITY_IDS[number];
export const MARIONETTIST_CASE_IDS = ['living-lines', 'controlled-release', 'break-contact'] as const;
export type MarionettistCaseId = typeof MARIONETTIST_CASE_IDS[number];
export type MarionettistAcquisitionCommand =
  | { type: 'LEARN_FORMULA' } | { type: 'REQUEST_SUPPLY' } | { type: 'RECEIVE_SUPPLY' }
  | { type: 'MATERIAL_WORK'; batchId: string } | { type: 'BUY_MATERIALS'; batchId: string } | { type: 'BREW'; batchId: string }
  | { type: 'REQUEST_RITUAL' } | { type: 'GO_RITUAL' } | { type: 'BEGIN_SONG' } | { type: 'END_SONG' } | { type: 'RETURN_CLUB' }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type MarionettistActivityCommand =
  | { type: 'OBSERVE'; caseId: MarionettistCaseId }
  | { type: 'PREPARE'; caseId: MarionettistCaseId; method: 'ABILITY' }
  | { type: 'PERFORM'; caseId: MarionettistCaseId } | { type: 'CLOSE'; caseId: MarionettistCaseId }
  | { type: 'REPORT'; caseId: MarionettistCaseId } | { type: 'WITHDRAW'; caseId: MarionettistCaseId }
  | MarionettistPuppetCommand
  | { type: 'REFLECT' } | { type: 'ENCOUNTER_TALK' } | { type: 'ENCOUNTER_FIGHT' };
export type MarionettistCommand = MarionettistAcquisitionCommand | MarionettistActivityCommand;
export interface MarionettistMaterial {
  id: string; name: string; quantity: number; unit: string; source: string; holder: 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
}
export interface MarionettistBatch { id: string; materials: MarionettistMaterial[]; labourSteps: number; acquired: boolean; brewed: boolean }
export interface MarionettistBottle {
  id: string; batchId: string; inputIds: string[]; brewedWeek: number;
  status: 'PREPARED' | 'CONSUMED'; outcome: PublicResolutionTier | null;
  consumedWeek: number | null; ritualVisit: number | null;
}
export interface MarionettistRitual {
  requestedWeek: number | null; visitWeek: number | null; location: 'CLUB' | 'COAST';
  singerPresent: boolean; singerWilling: boolean; singerHealthy: boolean; singing: boolean;
  visits: number; consumptions: number;
  history: { number: number; requestedWeek: number; visitWeek: number; returned: boolean; consumedBottleId: string | null }[];
}
export interface MarionettistCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  observedWeek: number | null; attemptWeek: number | null; method: 'ABILITY' | null;
  withdrawals: number; outcome: 'NONE' | 'LINES_RECORDED' | 'RELEASE_RECORDED' | 'INTERRUPTION_RECORDED';
  contactOpen: boolean; closes: number;
  linesObserved: boolean; initialControl: boolean; interrupted: boolean; autonomyVerified: boolean;
}
export interface MarionettistState {
  formulaKnown: boolean; resupply: { requestedWeek: number | null; deliveries: number };
  batches: MarionettistBatch[]; bottles: MarionettistBottle[];
  promotionWeek: number | null; facelessActingAtPromotion: number | null;
  puppet: MarionettistPuppetState;
  ritual: MarionettistRitual; cases: Record<MarionettistCaseId, MarionettistCaseState>; reflected: boolean;
  encounter: { status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; startHistoryIndex: number | null; attemptWeek: number | null };
}
export interface MarionettistAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: MarionettistCommand }
export interface MarionettistCaseProjection {
  id: string; title: string; story: string; observations: string[]; preparation: string | null; result: string | null;
  status: string; contactOpen: string; closes: number;
}
export interface MarionettistProjection {
  title: string; discovered: boolean; formulaKnown: boolean; promoted: boolean;
  formula: { name: string; quantity: number | null; unit: string; note?: string }[];
  story?: string; supplies: string; actions: MarionettistAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: MarionettistCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: MarionettistCaseProjection[]; insideCase: boolean; environment: string;
  puppet: MarionettistPuppetProjection;
  ritual: { location: 'CLUB' | 'COAST'; status: string; source: string; summary: string; singing: boolean; visits: number; consumptions: number };
}
