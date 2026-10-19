/** Isolated Error219 candidate. Imports deliberately point at the existing domain. */
import type { PublicCheckResult, PublicGameDate } from '../../shared/contracts.js';
import type { NormalCheckInput } from '../../resolution/normal-check.js';

export const ERROR_RITUAL_ORIGINALS = ['time-worm-potion-1', 'time-worm-potion-2', 'time-worm-potion-3'] as const;
export type ErrorRitualOriginal = typeof ERROR_RITUAL_ORIGINALS[number];
export const ERROR_RITUAL_UNIQUE = 'ER219-ERROR-UNIQUE' as const;
export type ErrorRitualPosition = 'OUTSIDE' | 'OUTER_CONTACT';
export type RitualBody = { health: number; mental: number; spirituality: number; pollution: number; heavyInjuries: number; cash: number };
export type RitualObject = { id: string; owner: string; holder: string; place: string;
  state: 'EMBODIED' | 'SEALED' | 'VESSEL' | 'FUSED' | 'EXPOSED'; };
export type MemberRange = readonly [number, number];
export type RitualCohort = { id: 'NORTH' | 'EAST' | 'SOUTH'; prefix: string;
  fear: MemberRange[]; obey: MemberRange[]; believe: MemberRange[];
  events: { id: string; kind: 'fear' | 'obey' | 'believe'; ranges: MemberRange[] }[] };
/** Authored past events, not commands or externally accepted qualification claims. */
export type ErrorRitualPastEvent = { id: string; date: PublicGameDate; text: string } & (
  | { kind: 'PREDECESSOR_DIED'; predecessor: 'SUN' | 'TYRANT' }
  | { kind: 'HANDOVER'; objects: readonly string[]; from: string; to: string; owner: string; place: string; price: number }
  | { kind: 'EMBODY_FIRST'; actor: 'SUN' | 'CANDIDATE'; object: string }
  | { kind: 'SUN_ASCENDED' }
  | { kind: 'COHORT'; state: 'fear' | 'obey' | 'believe'; members: readonly MemberRange[] }
  | { kind: 'CHALLENGE'; playerAttack: boolean; candidateHealthLoss: number; candidateSpiritualityCost: number;
      sunHealthLoss: number; sunSpiritualityCost: number; from: number; to: number; seconds: number; breaksContact: boolean }
  | { kind: 'CARE'; price: number; healthGain: number; spiritualityGain: number; restSeconds: number }
  | { kind: 'INTENT' });

export interface ErrorRitualState {
  version: 1; actorId: string; lastSecond: number;
  history: ErrorRitualPastEvent[];
  candidate: RitualBody & { id: string; name: string; sequence: 1 | 0; status: 'ACTIVE' | 'DEAD';
    place: string; intendsAscension: boolean; contact: boolean; seals: number; isolation: number };
  sun: RitualBody & { id: string; sequence: 1 | 0; status: 'ACTIVE' | 'DEAD' };
  predecessors: { sunAlive: boolean; tyrantAlive: boolean };
  objects: RitualObject[]; cohorts: RitualCohort[];
  challenge: { participants: readonly [string, string]; assistingActors: string[]; started: boolean;
    escaped: boolean; position: number; metres: number; healthOnEscape: number | null; exchangeIds: string[] };
  oathRing: { id: 'ER219-OATH-RING'; holder: string; worn: boolean; linked: boolean };
  conductor: { id: string; intact: boolean; condition: number; version: number; originalPrayerLink: true };
  custodian: { id: string; status: 'ACTIVE' | 'DEAD'; canAct: boolean; place: string; pathOpen: boolean;
    cash: number; spirituality: number; chestUses: 0 | 1; recoveryDue: number | null; recoveryObjectIds: string[]; recoveredAt: number | null };
  guard: { id: string; status: 'ACTIVE' | 'DEAD'; positionMetres: number; dispatchedAt: number | null; cutAt: number | null; cut: boolean };
  booking: null | { eventId: string; bookedAt: number; consumeAt: number; date: PublicGameDate; routeSummary: string };
  phase: 'UNBOOKED' | 'BOOKED' | 'ASSEMBLING' | 'CONTACT' | 'CONSUMING' | 'SETTLED' | 'CANCELLED';
  consumedAt: number | null; candidateOutcome: null | 'ASCENDED' | 'FAILED_ALIVE' | 'DEAD' | 'DISPLACED_ALIVE' | 'DISPLACED_DEAD' | 'INELIGIBLE';
  candidateSettledAt: number | null;
  player: { position: ErrorRitualPosition; walkedMetres: number; surveyed: boolean; surveyEventId: string | null; observedConductorVersion: number | null; linePrepared: boolean;
    lineConnected: boolean; lineCondition: number; exposure: number;
    grip: { id: 'ER219-GRIP'; holder: 'MAKER' | 'PLAYER'; boughtEventId: string | null }; attemptedAt: number | null;
    outcome: null | 'ASCENDED' | 'FAILED_ALIVE' | 'DEAD' | 'WITHDRAWN' | 'MISSED' };
  journal: { id: string; second: number; text: string }[];
}

export type ErrorRitualCommand = { type: 'BRIEF' | 'SURVEY' | 'PREPARE_LINE' | 'ENTER' | 'WAIT_FOR_CHANT' | 'RETREAT' }
  | { type: 'REPLACE'; confirmed: true };
/** Private chapter host only. Never deserialize these fields from an intent. */
export interface ErrorRitualHost {
  actorId: string; eventId: string; revision: number; week: number; date: PublicGameDate; nowSecond: number;
  location: string; status: 'ACTIVE' | 'DEAD'; sequence: 1 | 0;
  health: number; mental: number; spirituality: number; pollution: number; cash: number; actionPoints: number;
  will: number; injuries: readonly { severity: 'LIGHT' | 'HEAVY'; treatedRevision: number | null }[];
  compound: null | { id: string; status: 'PREPARED'; location: string; carrierId: string;
    embodiedOriginalId: ErrorRitualOriginal; externalOriginalIds: ErrorRitualOriginal[]; uniquenessId: typeof ERROR_RITUAL_UNIQUE };
  preparation: null | { id: string; compoundId: string; actorId: string; status: 'READY'; expiresSecond: number };
  /** Host calculates a concrete feasible remaining route including income, bills,
   * AP, owned materials and transport. This is not a public deadline parameter. */
  bookingPlan: null | { leadSeconds: number; consumeDate?: PublicGameDate; routeSummary: string };
  check: PublicCheckResult | null;
}
export interface ErrorRitualEffect {
  cashCost: number; actions: number; spirituality: number; mental: number; health: number; pollution: number;
  seconds: number; heavyInjuries: number; promoted: boolean; died: boolean;
}
/** Apply atomically to the chapter's exact original material ledger. No rewards,
 * rival objects or replacement stock are ever returned by this module. */
export interface ErrorRitualMaterialSettlement {
  eventId: string; compoundId: string; carrierId: string; preparationId: string;
  carrierSpent: true; preparationSpent: true; atSecond: number; place: string; position: 'OUTER_CONTACT';
  embodiedOriginalId: ErrorRitualOriginal; externalOriginalIds: ErrorRitualOriginal[];
  uniquenessId: typeof ERROR_RITUAL_UNIQUE;
  outcome: 'FUSED' | 'EXPOSED_ALIVE' | 'DEATH_RESIDUE';
}
export interface ErrorRitualResult {
  state: ErrorRitualState; effect: ErrorRitualEffect; notes: string[];
  settlement: ErrorRitualMaterialSettlement | null;
}
export type ErrorRitualCheckInput = NormalCheckInput;
/** Internal, dated world changes only, never player commands. */
export type ErrorRitualWorldChange =
  | { type: 'COHORT_DEPARTURE'; cohort: RitualCohort['id']; members: MemberRange; reason: string }
  | { type: 'CONDUCTOR_BROKEN' }
  | { type: 'CANDIDATE_HURT'; health: number; mental: number; pollution: number }
  | { type: 'CUSTODIAN_PATH_BLOCKED' };
