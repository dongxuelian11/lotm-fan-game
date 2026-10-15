import type { PublicResolutionTier } from '../../shared/contracts.js';

export const DAWN_PALADIN_ABILITY_IDS = ['warrior.s6.dawn-light', 'warrior.s6.dawn-armor', 'warrior.s6.dawn-weapon', 'warrior.s6.light-storm'] as const;
export type DawnPaladinAbilityId = typeof DAWN_PALADIN_ABILITY_IDS[number];
export const DAWN_PALADIN_CASE_IDS = ['marked-exit', 'armor-test', 'cleared-storm'] as const;
export type DawnPaladinCaseId = typeof DAWN_PALADIN_CASE_IDS[number];
export type DawnPaladinAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type DawnPaladinActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'RETURN_TOOL' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type DawnPaladinCommand = DawnPaladinAcquisitionCommand | DawnPaladinActivityCommand;
export interface DawnPaladinBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface DawnPaladinCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'ILLUSION_DISPELLED' | 'MARKED_EXIT_USED' | 'ARMOR_TESTED' | 'PROBE_STOPPED' | 'STORM_COMPLETED' | 'TARGET_DISMANTLED';
  contactOpen: boolean;
  closes: number;
}
/** Historical facts about original G training sources and objects; never inventory rewards. */
export interface DawnPaladinPracticeState {
  swordActive: boolean;
  armorActive: boolean;
  illusionCreated: boolean;
  volunteerSpirituality: number;
  illusionDispelled: boolean;
  screenRemoved: boolean;
  armorProbePerformed: boolean;
  armorCracked: boolean;
  stormCleared: boolean;
  instructorOutside: boolean;
  stormTarget: 'INTACT' | 'DESTROYED' | 'DISMANTLED';
  stormFrameScorched: boolean;
  stormSwordDispersed: boolean;
  stormArmorCracked: boolean;
}
export interface DawnPaladinState {
  guidanceKnown: boolean;
  bottles: DawnPaladinBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  weaponmasterActingAtPromotion: number | null;
  cases: Record<string, DawnPaladinCaseState>;
  reflected: boolean;
  practice: DawnPaladinPracticeState;
  encounter: { status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; startHistoryIndex: number | null; attemptWeek: number | null; swordReady: boolean; swordLostRound: number | null; armorReady: boolean; armorExpiresRound: number | null };
}
export interface DawnPaladinAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: DawnPaladinCommand;
}
export interface DawnPaladinCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string;
  closes: number;
}
export interface DawnPaladinProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: DawnPaladinAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: DawnPaladinCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: DawnPaladinCaseProjection[];
  insideCase: boolean;
  environment: string;
  practice: DawnPaladinPracticeState;
  battleEquipment: { swordReady: boolean; swordLostRound: number | null; armorReady: boolean; armorExpiresRound: number | null };
}
