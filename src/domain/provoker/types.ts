import type { PublicResolutionTier } from '../../shared/contracts.js';

export const PROVOKER_ABILITY_IDS = [
  'hunter.s8.provocation',
  'hunter.s8.hostility-aura',
] as const;
export type ProvokerAbilityId = typeof PROVOKER_ABILITY_IDS[number];
export const PROVOKER_CASE_IDS = ['invoice-claim', 'queue-boast', 'yard-hound'] as const;
export type ProvokerChoice = 'CHALLENGE' | 'DEESCALATE' | 'ATTRACT' | 'WAIT';

export type ProvokerAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type ProvokerAdventureCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'CHOOSE'; caseId: string; choice: ProvokerChoice }
  | { type: 'REFLECT' }
  | { type: 'ENCOUNTER_TALK' }
  | { type: 'ENCOUNTER_FIGHT' };
export type ProvokerCommand = ProvokerAcquisitionCommand | ProvokerAdventureCommand;

/** Original sequence-8 finished bottles from a separate supply, never relabelled sequence-9 stock. */
export interface ProvokerBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface ProvokerCase {
  status: 'AVAILABLE' | 'OBSERVED' | 'COMPLETED';
  attemptWeek: number | null;
  choice: ProvokerChoice | null;
}
export interface ProvokerState {
  guidanceKnown: boolean;
  bottles: ProvokerBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  hunterActingAtPromotion: number | null;
  cases: Record<string, ProvokerCase>;
  reflected: boolean;
  encounter: {
    status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
    attemptWeek: number | null;
    startHistoryIndex: number | null;
    enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  };
}
export interface ProvokerAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ProvokerCommand;
}
export interface ProvokerProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  story?: string;
  cases: { id: string; title: string; story: string }[];
  supplies: string;
  actions: ProvokerAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: ProvokerCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
}
