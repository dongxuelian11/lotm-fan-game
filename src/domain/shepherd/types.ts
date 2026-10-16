import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { RoseBishopActivityCommand, RoseBishopProjection } from '../rose-bishop/types.js';

export const SHEPHERD_ABILITY_IDS = ['hanged-man.s5.grazing', 'hanged-man.s5.borrowed-arts'] as const;
export type ShepherdAbilityId = typeof SHEPHERD_ABILITY_IDS[number];
export const SHEPHERD_CASE_IDS = ['paper-guidance', 'willing-chorus', 'limited-account'] as const;
export type ShepherdCaseId = typeof SHEPHERD_CASE_IDS[number];
export const SHEPHERD_SPIRIT_IDS = ['SH5-IRIS-1', 'SH5-CEDRIC-1'] as const;
export type ShepherdSpiritId = typeof SHEPHERD_SPIRIT_IDS[number];
export const SHEPHERD_CAPACITY = 7;
export const SHEPHERD_MAX_SELECTED_ABILITIES = 3;
export type ShepherdAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
/** Original S6 packets and reserve remain authoritative. */
export type ShepherdRationCommand = Extract<RoseBishopActivityCommand, { type: 'BUY_RATION' | 'TAKE_RATION' }>;
export type ShepherdActivityCommand = ShepherdRationCommand
  | { type: 'MEET_SPIRITS' }
  | { type: 'GRAZE'; spiritId: string; abilityIds: string[] }
  | { type: 'ACTIVATE_SPIRIT'; spiritId: string | null }
  | { type: 'RELEASE_SPIRIT'; spiritId: string; confirmed: true }
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type ShepherdCommand = ShepherdAcquisitionCommand | ShepherdActivityCommand;
export interface ShepherdBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface ShepherdSpiritState {
  id: string; status: 'UNMET' | 'AVAILABLE' | 'GRAZED' | 'RELEASED';
  attemptWeek: number | null; acquiredWeek: number | null; releasedWeek: number | null;
  selectedAbilities: string[];
}
export interface ShepherdGrazing {
  met: boolean; activeSpiritId: string | null; spirits: ShepherdSpiritState[];
}
export interface ShepherdBorrowedAbility { id: string; label: string; description: string }
export interface ShepherdSpiritSource {
  id: ShepherdSpiritId; name: string; pathwayId: 'hermit' | 'sun'; sequence: 7 | 9;
  source: string; knownAbilities: ShepherdBorrowedAbility[];
}
export interface ShepherdCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'PAPER_CHECKED' | 'CHORUS_CHECKED' | 'TALK_CHECKED' | 'ACCOUNT_CHECKED';
  contactOpen: boolean; closes: number;
}
export interface ShepherdPractice {
  paper: 'TABLE' | 'MARK'; chorusOpen: boolean;
  note: 'BLANK' | 'WRITTEN' | 'HANDED_OVER'; playerNode: 'DESK' | 'MARK';
}
export type ShepherdPracticeState = ShepherdPractice;
export interface ShepherdEncounter {
  status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
  startHistoryIndex: number | null; attemptWeek: number | null; blurReady: boolean;
}
export interface ShepherdState {
  guidanceKnown: boolean; bottles: ShepherdBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; roseBishopActingAtPromotion: number | null;
  grazing: ShepherdGrazing; cases: Record<string, ShepherdCaseState>;
  practice: ShepherdPractice; reflected: boolean; encounter: ShepherdEncounter;
}
export interface ShepherdAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ShepherdCommand;
}
export interface ShepherdCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string; contactOpen: string; closes: number;
}
export interface ShepherdGrazingProjection {
  met: boolean; capacity: 7; activeSpiritId: string | null; summary: string;
  spirits: { id: string; name: string; source: string; status: string; selectedAbilities: string[];
    knownAbilities: ShepherdBorrowedAbility[]; attemptWeek: number | null; acquiredWeek: number | null; releasedWeek: number | null }[];
}
export interface ShepherdProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string; actions: ShepherdAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ShepherdCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: ShepherdCaseProjection[]; insideCase: boolean; environment: string;
  practice: { paper: string; chorus: string; position: string; note: string; history: string[] } | null;
  grazing: ShepherdGrazingProjection | null;
  reserve?: RoseBishopProjection['reserve'];
}
