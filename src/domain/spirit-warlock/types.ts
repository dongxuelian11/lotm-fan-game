import type { PublicResolutionTier } from '../../shared/contracts.js';

/** S5 shelters separately acquired actual spirits; it never grants a ready-made spirit collection. */
export const SPIRIT_WARLOCK_ABILITY_IDS = ['darkness.s5.spirit-shelter', 'darkness.s5.spirit-assistance', 'darkness.s5.spirit-coordination'] as const;
export type SpiritWarlockAbilityId = typeof SPIRIT_WARLOCK_ABILITY_IDS[number];
export const SPIRIT_WARLOCK_CASE_IDS = ['listening-leaves', 'original-message', 'quiet-coordination'] as const;
export type SpiritWarlockCaseId = typeof SPIRIT_WARLOCK_CASE_IDS[number];
export type SpiritWarlockAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type SpiritWarlockActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'INVITE_SPIRIT' }
  | { type: 'RELEASE_SPIRIT' }
  | { type: 'RECALL_SPIRIT' }
  | { type: 'RETRIEVE_NOTE' }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type SpiritWarlockCommand = SpiritWarlockAcquisitionCommand | SpiritWarlockActivityCommand;
export interface SpiritWarlockBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface SpiritWarlockCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'LEAVES_CHECKED' | 'MESSAGE_CHECKED' | 'COORDINATION_CHECKED';
  contactOpen: boolean;
  closes: number;
}
export interface SpiritWarlockCompanion {
  status: 'UNMET' | 'AVAILABLE' | 'SEALED' | 'DEPLOYED' | 'RELEASED';
  invitedWeek: number | null;
  acquiredWeek: number | null;
  releases: number;
  deployments: number;
  recalls: number;
  source: 'SW5-LEAF-1';
}
export interface SpiritWarlockPractice {
  note: 'TABLE' | 'RECIPIENT';
  dreamOpen: boolean;
  deliveries: number;
  returns: number;
  coordinationChecks: number;
}
export interface SpiritWarlockState {
  guidanceKnown: boolean;
  bottles: SpiritWarlockBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  sootherActingAtPromotion: number | null;
  cases: Record<string, SpiritWarlockCaseState>;
  companion: SpiritWarlockCompanion;
  practice: SpiritWarlockPractice;
  reflected: boolean;
  encounter: {
    status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
    startHistoryIndex: number | null; attemptWeek: number | null;
    pressure: 0 | 1 | 2; dreamLocked: boolean;
  };
}
export interface SpiritWarlockAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SpiritWarlockCommand;
}
export interface SpiritWarlockCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number;
}
export interface SpiritWarlockProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: SpiritWarlockAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: SpiritWarlockCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: SpiritWarlockCaseProjection[];
  insideCase: boolean;
  environment: string;
  companion: { name: string; source: string; status: string; history: string[] } | null;
  practice: { note: string; dream: string; summary: string } | null;
}
