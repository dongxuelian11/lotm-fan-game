import type { PublicResolutionTier } from '../../shared/contracts.js';

export const DRUID_ABILITY_IDS = ['mother.s5.ground-passage'] as const;
export type DruidAbilityId = typeof DRUID_ABILITY_IDS[number];
export const DRUID_CASE_IDS = ['known-soil', 'paired-growth', 'honest-record'] as const;
export type DruidCaseId = typeof DRUID_CASE_IDS[number];
export const DRUID_STUDY_SOURCE_IDS = ['ordinary-animals', 'lava-octopus', 'grey-goat', 'six-winged-gargoyle'] as const;
export type DruidStudySourceId = typeof DRUID_STUDY_SOURCE_IDS[number];
export type DruidMethod = 'ABILITY' | 'ORDINARY';
export type DruidAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'STUDY'; sourceId: DruidStudySourceId }
  | { type: 'WRITE_RECORD' }
  | { type: 'PREPARE_RITE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type DruidActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: DruidMethod }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'RETURN'; caseId: 'known-soil'; method: DruidMethod }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type DruidCommand = DruidAcquisitionCommand | DruidActivityCommand;
export interface DruidBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface DruidStudyState { attemptWeek: number | null; completedWeek: number | null }
export interface DruidRitual {
  studies: Record<DruidStudySourceId, DruidStudyState>;
  recordAttemptWeek: number | null;
  recordWrittenWeek: number | null;
  readyWeek: number | null;
  attempts: number;
}
export interface DruidCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null; method: DruidMethod | null;
  withdrawals: number;
  outcome: 'NONE' | 'PASSAGE_CHECKED' | 'GROWTH_CHECKED' | 'RECORD_CHECKED';
  contactOpen: boolean; closes: number;
}
export interface DruidPractice {
  position: 'NEAR' | 'FAR';
  soil: 'SETTLED' | 'SOFTENED';
  marker: 'BOX' | 'NEAR' | 'FAR';
  seedlings: 'RESTING' | 'OBSERVED';
  note: 'BLANK' | 'WRITTEN' | 'HANDED_OVER';
  returnAttempted: boolean;
}
export type DruidPracticeState = DruidPractice;
export function freshDruidPractice(): DruidPractice {
  return { position: 'NEAR', soil: 'SETTLED', marker: 'BOX', seedlings: 'RESTING', note: 'BLANK', returnAttempted: false };
}
export interface DruidEncounter {
  status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
  startHistoryIndex: number | null;
  attemptWeek: number | null;
}
export interface DruidState {
  guidanceKnown: boolean; bottles: DruidBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; biologistActingAtPromotion: number | null;
  ritual: DruidRitual;
  cases: Record<string, DruidCaseState>;
  practice: DruidPractice;
  reflected: boolean;
  encounter: DruidEncounter;
}
export interface DruidAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: DruidCommand;
}
export interface DruidCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string; contactOpen: string; closes: number;
}
export interface DruidStudyProjection {
  id: DruidStudySourceId; title: string; source: string; creatures: string[];
  status: string; completed: boolean; action: DruidAction;
}
export interface DruidProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string; actions: DruidAction[];
  studies: DruidStudyProjection[];
  ritual: { notebook: string; recordStatus: string; readyStatus: string; attempts: number; summary: string };
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: DruidCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: DruidCaseProjection[]; insideCase: boolean; environment: string;
  practice: DruidPractice;
}
