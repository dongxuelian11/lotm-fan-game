import type { PublicResolutionTier } from '../../shared/contracts.js';

/** Verified S6 boundaries: evidence-based planning and persuasion that can still fail. */
export const CONSPIRATOR_ABILITY_IDS = ['hunter.s6.reasoning-plan', 'hunter.s6.targeted-persuasion'] as const;
export type ConspiratorAbilityId = typeof CONSPIRATOR_ABILITY_IDS[number];
export const CONSPIRATOR_CASE_IDS = ['warehouse-rosters', 'rejected-detour', 'urgent-handover'] as const;
export type ConspiratorCaseId = typeof CONSPIRATOR_CASE_IDS[number];
export type ConspiratorAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type ConspiratorActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type ConspiratorCommand = ConspiratorAcquisitionCommand | ConspiratorActivityCommand;

/** Individually sealed S6 originals, never converted from earlier Hunter pathway stock. */
export interface ConspiratorBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface ConspiratorCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'ROSTERS_CHECKED' | 'DETOUR_REVISED' | 'BACKUP_USED';
  contactOpen: boolean;
  closes: number;
  notes: string[];
  revised: boolean;
}
export interface ConspiratorState {
  guidanceKnown: boolean;
  bottles: ConspiratorBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  pyromaniacActingAtPromotion: number | null;
  cases: Record<string, ConspiratorCaseState>;
  reflected: boolean;
  encounter: { status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; startHistoryIndex: number | null; attemptWeek: number | null };
}
export interface ConspiratorAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ConspiratorCommand;
}
export interface ConspiratorCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string;
  closes: number;
}
export interface ConspiratorProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: ConspiratorAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ConspiratorCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: ConspiratorCaseProjection[];
  insideCase: boolean;
  environment: string;
}
