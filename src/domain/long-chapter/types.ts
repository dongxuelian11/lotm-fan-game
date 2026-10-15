import type { PublicGameDate } from '../../shared/contracts.js';
import type { SliceInjury } from '../slice/types.js';

export const LONG_CHAPTER_SUPPORT_IDS = ['SORT_RECORDS', 'CHECK_CHEST', 'COPY_HANDOVER', 'PREPARE_ROOM'] as const;
export type LongChapterSupportId = typeof LONG_CHAPTER_SUPPORT_IDS[number];
export type LongChapterPhase = 'NONE' | 'PREPARING' | 'RESIDING' | 'CANCELLED' | 'CYCLE_DEAD' | 'AMNESIAC' | 'PARTIAL_RECOVERY';
export type LongChapterCommand =
  | { type: 'REVIEW' } | { type: 'PREPARE_SUPPORT'; taskId: LongChapterSupportId }
  | { type: 'DEADLINE_SUPPORT' } | { type: 'RELEASE_GRAY_FEATHER' }
  | { type: 'BOOK_IN' } | { type: 'BOOK_OUT' } | { type: 'CANCEL' }
  | { type: 'PAY_RESIDENCE'; confirmed: true } | { type: 'LIVE_TO_CYCLE'; confirmed: true }
  | { type: 'AWAIT_REVIVAL' } | { type: 'RECOVER_IDENTITY' } | { type: 'RECOVER_CASE' } | { type: 'RECOVER_WITNESS' }
  | { type: 'WORK' } | { type: 'REST' } | { type: 'NEXT_WEEK' }
  | { type: 'ENTER_RECEPTION' } | { type: 'LEAVE_RECEPTION' } | { type: 'CONTINUE_FERRYMAN' };
export interface LongChapterCustodian {
  id: 'LC-ADA-FENN' | 'LC-MILES-REED' | 'LC-LENA-VOSS'; name: string;
  startedDate: PublicGameDate; ageAtStart: number; endedDate: PublicGameDate | null;
}
export interface LongChapterObject {
  id: string; sourceId: string; label: string;
  disposition: 'PRESERVED' | 'EXPIRED' | 'HISTORICAL_ONLY';
  location: 'CARE_CHEST' | 'PLAYER' | 'OLD_LOCATION'; quantity: number;
}
export interface LongChapterRecovery {
  entryId: string; sourceId: string; objectId: string; date: PublicGameDate;
}
export interface LongChapterHandoff {
  target: 'FERRYMAN'; date: PublicGameDate; week: number;
  cash: number; health: number; mind: number; spirituality: number; actionsRemaining: number;
}
export interface LongChapterState {
  /** Terminal residence balance only. All existing residence records remain historical and unchanged. */
  handoff: LongChapterHandoff | null;
  phase: LongChapterPhase;
  facilityId: 'LC-CARE-HOUSE'; chestId: 'LC-CARE-CHEST-1';
  location: 'OUTSIDE' | 'CARE_ROOM' | 'RECEPTION';
  reviewedDate: PublicGameDate | null;
  supportTasks: LongChapterSupportId[];
  paidPennies: number; paidDate: PublicGameDate | null; cancellations: number;
  /** A single deadline-only budget. It never replenishes ordinary action points. */
  deadlinePreparationGranted: boolean; deadlinePreparationRemaining: number; deadlineSupportCompleted: boolean;
  releasedSpiritDate: PublicGameDate | null;
  bookId: 'UDY4-BOOK-1'; bookDeposits: number; bookWithdrawals: number;
  retainedObjectId: string | null;
  departureDate: PublicGameDate | null; departureWeek: number | null;
  cycleDeathDate: PublicGameDate | null; revivedDate: PublicGameDate | null;
  elapsedDays: number; calendarRemainderDays: number;
  body: { id: string; location: 'LC-CARE-HOUSE' | 'LC-RECEPTION' | 'LC-OUTSIDE'; entryHealth: number; entryMind: number; entrySpirituality: number; entryInjuries: SliceInjury[]; entryInjuryRisk: number; entryCash: number } | null;
  custodians: LongChapterCustodian[];
  people: { id: string; date: PublicGameDate; kind: 'DEATH' | 'RETIRED' | 'UNKNOWN' | 'AGREEMENT_ENDED'; text: string }[];
  objects: LongChapterObject[];
  recoveredSources: LongChapterRecovery[];
  mentallyStable: boolean;
  newLife: { week: number | null; works: number; rests: number; weeks: number; income: number; expenses: number; emergencyWorks: number; emergencyWorkUsed: boolean };
}
export interface LongChapterProjection {
  available: boolean; started: boolean; eraClosed: boolean; locked: boolean; phase: string;
  title: string; summary: string; boundary: string; consequences: string[];
  dates: string[]; body: string; currentIdentity: string; people: string[];
  objects: string[]; memory: string[]; history: string[]; occupation: string;
  actions: { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: LongChapterCommand }[];
}
