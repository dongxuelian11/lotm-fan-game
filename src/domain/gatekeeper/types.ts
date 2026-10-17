import type { PublicResolutionTier } from '../../shared/contracts.js';

/** S5 grants a finite body-bound inner underworld, never an automatic spirit collection. */
export const GATEKEEPER_ABILITY_IDS = ['death.s5.inner-underworld', 'death.s5.underworld-door'] as const;
export type GatekeeperAbilityId = typeof GATEKEEPER_ABILITY_IDS[number];
export const GATEKEEPER_CASE_IDS = ['resting-place', 'shared-task', 'controlled-threshold'] as const;
export type GatekeeperCaseId = typeof GATEKEEPER_CASE_IDS[number];
export type GatekeeperAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type GatekeeperActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'INVITE_SPIRIT' }
  | { type: 'RELEASE_SPIRIT' }
  | { type: 'RECALL_SPIRIT' }
  | { type: 'RETRIEVE_MARKER' }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type GatekeeperCommand = GatekeeperAcquisitionCommand | GatekeeperActivityCommand;
export interface GatekeeperBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface GatekeeperCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'RESTING_CHECKED' | 'TASK_CHECKED' | 'THRESHOLD_CHECKED';
  contactOpen: boolean;
  closes: number;
}
/** The same original gray-feather spirit, requiring a separate voluntary S5 agreement. */
export interface GatekeeperCompanion {
  source: 'SG6-GRAY-FEATHER';
  status: 'OUTSIDE' | 'INSIDE' | 'DEPLOYED';
  agreementWeek: number | null;
  entries: number;
  releases: number;
  deployments: number;
  recalls: number;
  feePaid: number;
}
export interface GatekeeperPractice {
  marker: 'DESK' | 'RECIPIENT';
  gateOpen: boolean;
  deliveries: number;
  returns: number;
  gateTests: number;
}
export interface GatekeeperState {
  guidanceKnown: boolean;
  bottles: GatekeeperBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  spiritGuideActingAtPromotion: number | null;
  inviteAttemptWeek: number | null;
  cases: Record<string, GatekeeperCaseState>;
  companion: GatekeeperCompanion;
  practice: GatekeeperPractice;
  reflected: boolean;
  encounter: {
    status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
    startHistoryIndex: number | null; attemptWeek: number | null;
  };
}
export interface GatekeeperAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: GatekeeperCommand;
}
export interface GatekeeperCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number;
}
export interface GatekeeperProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: GatekeeperAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: GatekeeperCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: GatekeeperCaseProjection[];
  insideCase: boolean;
  environment: string;
  companion: { name: string; source: string; status: string; history: string[] } | null;
  practice: { marker: string; gate: string; summary: string } | null;
}
