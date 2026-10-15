import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { ScrollProfessorActivityCommand, ScrollProfessorProjection } from '../scroll-professor/types.js';

/** HERMIT S5; unrelated to PARAGON's Astronomer and without S4 mystical re-enactment. */
export const STAR_MYSTIC_ABILITY_IDS = ['hermit.s5.mystic-sight', 'hermit.s5.star-cage'] as const;
export type StarMysticAbilityId = typeof STAR_MYSTIC_ABILITY_IDS[number];
export const STAR_MYSTIC_CASE_IDS = ['veiled-marker', 'willing-cage', 'uncertain-chart'] as const;
export type StarMysticCaseId = typeof STAR_MYSTIC_CASE_IDS[number];
export type StarMysticAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
/** These commands keep the same old workshop identities and material/spell rules. */
export type StarMysticWorkshopCommand = Extract<ScrollProfessorActivityCommand, { type: 'LEARN_SPELL' | 'BUY_KIT' | 'CRAFT_SCROLL' | 'AUTHORIZE_SCROLL' }>;
export type StarMysticActivityCommand = StarMysticWorkshopCommand
  | { type: 'BUY_LENSES' }
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type StarMysticCommand = StarMysticAcquisitionCommand | StarMysticActivityCommand;
export interface StarMysticBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface StarMysticCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number;
  outcome: 'NONE' | 'MARKER_CHECKED' | 'CAGE_CHECKED' | 'BOUNDARY_CHECKED' | 'WEATHER_CHECKED';
  contactOpen: boolean; closes: number;
}
/** One original pair of glasses, finite original people/props, and actual walked positions. */
export interface StarMysticPractice {
  lenses: 'SUPPLIER' | 'WORN' | 'HELD';
  screen: 'SHUT' | 'OPEN';
  markerSeen: boolean;
  cageActive: boolean;
  companionNode: 'WAITING' | 'MARK';
  playerNode: 'ROOM' | 'COURTYARD';
  weatherSeen: boolean;
}
export type StarMysticPracticeState = StarMysticPractice;
export interface StarMysticEncounter {
  status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
  startHistoryIndex: number | null;
  attemptWeek: number | null;
  focused: boolean;
  cageReady: boolean;
}
export interface StarMysticState {
  guidanceKnown: boolean;
  bottles: StarMysticBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  scrollProfessorActingAtPromotion: number | null;
  cases: Record<string, StarMysticCaseState>;
  practice: StarMysticPractice;
  reflected: boolean;
  encounter: StarMysticEncounter;
}
export interface StarMysticAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: StarMysticCommand;
}
export interface StarMysticCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
  contactOpen: string; closes: number;
}
export interface StarMysticProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: StarMysticAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: StarMysticCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: StarMysticCaseProjection[];
  insideCase: boolean;
  environment: string;
  practice: { vision: string; cage: string; position: string; history: string[] } | null;
  workshop?: ScrollProfessorProjection['workshop'];
}
