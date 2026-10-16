import type { PublicResolutionTier } from '../../shared/contracts.js';

export const ROSE_BISHOP_ABILITY_IDS = ['hanged-man.s6.flesh-shaping', 'hanged-man.s6.self-renewal'] as const;
export type RoseBishopAbilityId = typeof ROSE_BISHOP_ABILITY_IDS[number];
export const ROSE_BISHOP_CASE_IDS = ['ring-release', 'steady-grip', 'reserve-lesson'] as const;
export type RoseBishopCaseId = typeof ROSE_BISHOP_CASE_IDS[number];
export type RoseBishopAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type RoseBishopActivityCommand =
  | { type: 'BUY_RATION' }
  | { type: 'TAKE_RATION'; packetId: string }
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'CLOSE'; caseId: string }
  | { type: 'REPORT'; caseId: string }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type RoseBishopCommand = RoseBishopAcquisitionCommand | RoseBishopActivityCommand;
export interface RoseBishopBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface RoseBishopPacket {
  id: string; acquiredWeek: number; status: 'HELD' | 'CONSUMED'; consumedWeek: number | null;
}
export interface RoseBishopReserve {
  points: number; max: 3; packetsBought: number; lastPurchaseWeek: number | null; packets: RoseBishopPacket[];
}
export interface RoseBishopCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number; outcome: 'NONE' | 'RING_VERIFIED' | 'GRIP_VERIFIED' | 'LESSON_VERIFIED';
  contactOpen: boolean; closes: number;
}
export interface RoseBishopState {
  guidanceKnown: boolean; bottles: RoseBishopBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null; shadowAsceticActingAtPromotion: number | null;
  cases: Record<string, RoseBishopCaseState>; reserve: RoseBishopReserve;
  practice: { shape: 'NORMAL' | 'SLIM_HAND' | 'SUPPORT_PALM' }; reflected: boolean;
  encounter: { status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; startHistoryIndex: number | null; attemptWeek: number | null };
}
export interface RoseBishopAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: RoseBishopCommand;
}
export interface RoseBishopCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string; contactOpen: string; closes: number;
}
export interface RoseBishopProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false; formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string; actions: RoseBishopAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: RoseBishopCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: RoseBishopCaseProjection[]; insideCase: boolean; environment: string;
  reserve: RoseBishopReserve & { summary: string };
  practice: RoseBishopState['practice'];
}
