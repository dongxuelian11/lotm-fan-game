import type { PublicResolutionTier } from '../../shared/contracts.js';

export const SPIRIT_GUIDE_ABILITY_IDS = ['death.s6.spirit-recruitment', 'death.s6.dead-words'] as const;
export type SpiritGuideAbilityId = typeof SPIRIT_GUIDE_ABILITY_IDS[number];
export const SPIRIT_GUIDE_CASE_IDS = ['messenger-terms', 'short-delivery', 'restless-echo'] as const;
export type SpiritGuideCaseId = typeof SPIRIT_GUIDE_CASE_IDS[number];
export type SpiritGuideAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type SpiritGuideActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type SpiritGuideCommand = SpiritGuideAcquisitionCommand | SpiritGuideActivityCommand;
export interface SpiritGuideBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface SpiritGuideCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'MESSENGER_RECRUITED' | 'TERMS_REVIEWED' | 'MESSENGER_DELIVERED' | 'HAND_DELIVERED' | 'ECHO_QUIETED' | 'BARRIER_RECORDED';
  contactOpen: boolean;
  closes: number;
}
/** One named spirit's accepted local agreement and one original sealed letter; never a free inventory companion. */
export interface SpiritGuideMessengerState {
  recruited: boolean;
  deliveries: number;
  letter: 'DESK' | 'RECIPIENT';
  replyReceived: boolean;
  feePaid: number;
}
export interface SpiritGuideState {
  guidanceKnown: boolean;
  bottles: SpiritGuideBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  spiritmediumActingAtPromotion: number | null;
  cases: Record<string, SpiritGuideCaseState>;
  reflected: boolean;
  messenger: SpiritGuideMessengerState;
  encounter: { status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; startHistoryIndex: number | null; attemptWeek: number | null };
}
export interface SpiritGuideAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SpiritGuideCommand;
}
export interface SpiritGuideCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string;
  closes: number;
}
export interface SpiritGuideProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: SpiritGuideAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: SpiritGuideCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: SpiritGuideCaseProjection[];
  insideCase: boolean;
  environment: string;
  messenger: SpiritGuideMessengerState;
}
