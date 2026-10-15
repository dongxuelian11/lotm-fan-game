import type { PublicResolutionTier } from '../../shared/contracts.js';

export const RECORDER_ABILITY_IDS = ['door.s6.recording', 'door.s6.release'] as const;
export type RecorderAbilityId = typeof RECORDER_ABILITY_IDS[number];
export const RECORDER_CASE_IDS = ['flash-screen', 'courage-task', 'missing-source'] as const;
export type RecorderCaseId = typeof RECORDER_CASE_IDS[number];
export const RECORDER_SAMPLE_IDS = ['FLASH', 'COURAGE'] as const;
export type RecorderSampleId = typeof RECORDER_SAMPLE_IDS[number];
export const RECORDER_INSTRUCTOR_IDS = ['NORA', 'SAFF'] as const;
export type RecorderInstructorId = typeof RECORDER_INSTRUCTOR_IDS[number];
export type RecorderAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type RecorderActivityCommand =
  | { type: 'RECORD'; sample: RecorderSampleId }
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type RecorderCommand = RecorderAcquisitionCommand | RecorderActivityCommand;
export interface RecorderBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface RecorderCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'FLASH_RELEASED' | 'SCREEN_CHECKED' | 'COURAGE_RELEASED' | 'TASK_CHECKED' | 'LIMIT_REVIEWED';
  contactOpen: boolean;
  closes: number;
  /** Latest actual release, including failed attempts; never a reservation or copied item. */
  releasedRecordId: string | null;
}
export interface RecorderRecord {
  id: string; sample: RecorderSampleId; sequence: 8 | 9;
  status: 'STORED' | 'RELEASED'; sourceDemoId: string;
  createdWeek: number; releasedWeek: number | null;
}
export interface RecorderDemonstration {
  id: string; sample: RecorderSampleId; actor: RecorderInstructorId;
  week: number; revision: number; success: boolean;
}
export interface RecorderState {
  guidanceKnown: boolean;
  bottles: RecorderBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  astrologerActingAtPromotion: number | null;
  cases: Record<string, RecorderCaseState>;
  reflected: boolean;
  records: RecorderRecord[];
  demonstrations: RecorderDemonstration[];
  lastAttemptWeek: Record<RecorderSampleId, number | null>;
  instructorSpirituality: Record<RecorderInstructorId, { spirituality: number; restWeek: number | null }>;
  encounter: { status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; startHistoryIndex: number | null; attemptWeek: number | null };
}
export interface RecorderAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: RecorderCommand;
}
export interface RecorderCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number;
}
export interface RecorderProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: RecorderAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: RecorderCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: RecorderCaseProjection[]; insideCase: boolean; environment: string;
  records: (RecorderRecord & { label: string; source: string })[];
  demonstrations?: (RecorderDemonstration & { label:string; actorName:string })[];
  capacities: { tier: 'LOW' | 'MID' | 'DIVINE'; label: string; used: number; maximum: number; boundary: string }[];
  samples: { id: RecorderSampleId; label: string; source: string; instructorSpirituality: number; lastAttemptWeek: number | null; stored: number }[];
}
