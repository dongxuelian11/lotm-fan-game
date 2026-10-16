import type { PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import type { AncientScholarLifeState, AncientScholarLifeProjection, AncientScholarActivityCommand } from './life.js';
import type { AncientScholarEncounterState, AncientScholarEncounterProjection, AncientScholarEncounterCommand } from './encounter.js';

export const ANCIENT_SCHOLAR_ABILITY_IDS = ['diviner.s3.borrow-past', 'diviner.s3.historical-projection', 'diviner.s3.history-shelter'] as const;
export type AncientScholarAbilityId = typeof ANCIENT_SCHOLAR_ABILITY_IDS[number];
export const ANCIENT_SCHOLAR_RECORD_IDS = ['AS3-RECORD-145', 'AS3-RECORD-170', 'AS3-RECORD-230'] as const;
export type AncientScholarRecordId = typeof ANCIENT_SCHOLAR_RECORD_IDS[number];
export const ANCIENT_SCHOLAR_PREPARATION_IDS = ['CHECK_CONTAINER', 'CHECK_LOCAL_CLOCK', 'REGISTER_SEALS'] as const;
export type AncientScholarPreparationId = typeof ANCIENT_SCHOLAR_PREPARATION_IDS[number];
export type AncientScholarAcquisitionCommand =
  | { type: 'LEARN_FORMULA' | 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' }
  | { type: 'MATERIAL_WORK' | 'BUY_MATERIALS' | 'BREW'; batchId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type AncientScholarRitualCommand =
  | { type: 'REVIEW_SECLUSION' | 'HAND_OVER_BELL' | 'FACILITY_WORK' | 'PAY_FACILITY' | 'VERIFY_CONTINUITY' | 'ADVANCE_FIRST_150' | 'ADVANCE_SECOND_150' | 'ADVANCE_REASSESSMENT' | 'ISOLATION_REST' | 'EXIT_SECLUSION' | 'REASSESS_HISTORY' | 'ENTER_RECEPTION' | 'LEAVE_RECEPTION' | 'WORK' | 'REST' | 'NEXT_WEEK' | 'CANCEL_PREPARATION' }
  | { type: 'OBTAIN_RECORD' | 'VERIFY_RECORD'; recordId: AncientScholarRecordId }
  | { type: 'PREPARE_FACILITY'; taskId: AncientScholarPreparationId }
  | { type: 'ENTER_SECLUSION' | 'EXIT_EARLY'; confirmed: true };
export type AncientScholarCommand = AncientScholarAcquisitionCommand | AncientScholarRitualCommand | AncientScholarActivityCommand | AncientScholarEncounterCommand;
export interface AncientScholarMaterial { id: string; name: string; quantity: number | null; unit: string; source: string; holder: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; recordIds: AncientScholarRecordId[] }
export interface AncientScholarBatch { id: string; stockedWeek: number | null; labourSteps: number; acquiredWeek: number | null; brewedWeek: number | null; materials: AncientScholarMaterial[] }
export interface AncientScholarBottle { id: string; batchId: string; inputIds: string[]; brewedWeek: number; status: 'PREPARED' | 'CONSUMED'; consumedWeek: number | null; outcome: PublicResolutionTier | null; visitId: string | null }
export interface AncientScholarRecord { id: AncientScholarRecordId; title: string; source: string; historicalYear: number | null; obtainedDate: PublicGameDate | null; verifiedDate: PublicGameDate | null; originalLocation: 'ARCHIVE' | 'PLAYER' | 'VAULT'; copyId: string | null; verification: string | null }
export interface AncientScholarIsolationVisit {
  id: string; mode: 'THREE_CENTURIES' | 'G_REASSESSMENT'; facilityId: 'AS3-STASIS-1'; bodyId: string;
  enteredDate: PublicGameDate; exitedDate: PublicGameDate | null; targetDate: PublicGameDate;
  elapsedDays: number; milestones: { id: string; date: PublicGameDate; elapsedDays: number; bodyId: string; facilityId: 'AS3-STASIS-1'; communication: 'NONE' }[];
  registeredBottleIds: string[]; registeredRecordIds: AncientScholarRecordId[]; retainedObjectIds: string[];
  entryHealth: number; entryMind: number; entrySpirituality: number;
  qualifiedDate: PublicGameDate | null; verifiedDate: PublicGameDate | null; result: 'SEALED' | 'EARLY_EXIT' | 'QUALIFIED' | 'PROMOTED' | 'LEFT_QUALIFIED';
  recoveryUses: number; recoveryAllowance: 3; reassessedVisitId: string | null;
}
export interface AncientScholarRitualState {
  phase: 'NONE' | 'PREPARING' | 'SEALED' | 'QUALIFIED' | 'RETURNED'; location: 'OUTSIDE' | 'VAULT' | 'RECEPTION';
  facilityId: 'AS3-STASIS-1'; vaultId: 'AS3-VAULT'; custodianId: 'AS3-MARA'; successorId: string | null;
  reviewedDate: PublicGameDate | null; preparationTasks: AncientScholarPreparationId[]; labourSteps: number; paidPennies: number; paidDate: PublicGameDate | null;
  bellHandover: { bellId: string; receiverId: 'AS3-IVO'; receiptId: string; date: PublicGameDate; paidPennies: 60 } | null;
  records: AncientScholarRecord[]; visits: AncientScholarIsolationVisit[]; currentVisitId: string | null;
  eraClosedDate: PublicGameDate | null; calendarRemainderDays: number; completed300VisitId: string | null; reassessedVisitId: string | null;
  people: { id: string; date: PublicGameDate; kind: 'DEATH' | 'UNKNOWN' | 'AGREEMENT_ENDED'; text: string }[];
  objects: { id: string; source: string; disposition: 'PRESERVED' | 'EXPIRED' | 'HISTORICAL_ONLY'; text: string }[];
  newLife: { week: number | null; works: number; rests: number; weeks: number; income: number; expenses: number; emergencyWorkUsed: boolean };
}
export interface AncientScholarRitualProjection {
  title: string; phase: string; eraClosed: boolean; locked: boolean; insideIsolation: boolean; location: string;
  summary: string; boundary: string; facility: string; body: string; dates: string[]; consequences: string[];
  records: { id: string; title: string; source: string; status: string; verification: string }[];
  people: string[]; objects: string[]; history: string[]; qualification: string; ordinaryLife: string;
}
export interface AncientScholarState {
  formulaKnown: boolean; batches: AncientScholarBatch[]; bottles: AncientScholarBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; bizarroActingAtPromotion: number | null;
  ritual: AncientScholarRitualState; life: AncientScholarLifeState; encounter: AncientScholarEncounterState;
}
export interface AncientScholarAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: AncientScholarCommand }
export interface AncientScholarProjection {
  title: string; discovered: boolean; formulaKnown: boolean; promoted: boolean;
  formula: { name: string; quantity: number | null; unit: string; note?: string }[];
  story: string; supplies: string; actions: AncientScholarAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: AncientScholarCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  eraClosed: boolean; locked: boolean; insideIsolation: boolean; insideCase: boolean; environment: string;
  ritual: AncientScholarRitualProjection; life: AncientScholarLifeProjection; encounter: AncientScholarEncounterProjection;
}
