import type { PublicResolutionTier } from '../../shared/contracts.js';

/** Only the new S5 disease ability is added; all previous identities stay inherited. */
export const PAIN_ABILITY_IDS = ['assassin.s5.disease'] as const;
export type PainAbilityId = typeof PAIN_ABILITY_IDS[number];
export const PAIN_CASE_IDS = ['exit-markers', 'symptom-table', 'care-handoff'] as const;
export type PainCaseId = typeof PAIN_CASE_IDS[number];
export type PainAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type PainActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'BUY_SUPPLIES' }
  | { type: 'PREPARE_MIRROR' }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' }
  | { type: 'ENCOUNTER_AID' };
export type PainCommand = PainAcquisitionCommand | PainActivityCommand;
export interface PainBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface PainCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'EXIT_REHEARSED' | 'TABLE_COMPARED' | 'CARE_HANDED';
  contactOpen: boolean;
  closes: number;
}
/** Actual people and original props in a disease-free, ordinary rehearsal. */
export interface PainPractice {
  playerNode: 'ENTRY' | 'SAFE_MARK';
  companionNode: 'WAITING' | 'SAFE_MARK';
  marker: 'RACK' | 'DOOR_MARK';
  tableRows: number;
  careNote: 'BLANK' | 'WRITTEN' | 'HANDED_OVER';
  simulatedOnly: true;
}
export type PainPracticeState = PainPractice;
export interface PainEncounter {
  status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
  startHistoryIndex: number | null;
  attemptWeek: number | null;
  silkPrepared: boolean;
  boundRound: number | null;
  fieldActive: boolean;
  enemyDisease: number;
  diseaseApplications: number;
  lastDiseaseRound: number | null;
  care: 'NONE' | 'REQUESTED';
  enemyHealth: number;
  enemyStatus: 'NOT_MET' | 'RESISTING' | 'SURRENDERED' | 'DEAD' | 'LEFT';
}
export interface PainState {
  guidanceKnown: boolean;
  bottles: PainBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  pleasureActingAtPromotion: number | null;
  cases: Record<string, PainCaseState>;
  practice: PainPractice;
  reflected: boolean;
  encounter: PainEncounter;
}
export interface PainAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: PainCommand;
}
export interface PainCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number;
}
export interface PainProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string; inheritedTools: string; bodyChange: string;
  actions: PainAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: PainCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: PainCaseProjection[];
  insideCase: boolean;
  environment: string;
  practice: { position: string; records: string; care: string; history: string[] } | null;
  diseaseState: Pick<PainEncounter, 'fieldActive' | 'enemyDisease' | 'diseaseApplications' | 'care' | 'enemyHealth' | 'enemyStatus'>;
}
