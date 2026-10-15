import type { PublicResolutionTier } from '../../shared/contracts.js';

export const HUNTER_ABILITY_IDS = [
  'hunter.s9.tracking',
  'hunter.s9.trapcraft',
  'hunter.s9.physical-enhancement',
  'hunter.s9.hunting-instinct',
] as const;
export type HunterAbilityId = typeof HUNTER_ABILITY_IDS[number];

export type HunterAcquisitionCommand =
  | { type: 'DISCOVER' }
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' }
  | { type: 'BUY_TRAP_KIT' };
export type HunterCommand = HunterAcquisitionCommand
  | { type: 'PRACTICE'; practiceId: string }
  | { type: 'SET_TRAP'; location: 'HUNTER_CARGO' }
  | { type: 'RECOVER_TRAP' }
  | { type: 'CARGO_TALK' }
  | { type: 'CARGO_FIGHT' }
  | { type: 'REFLECT' };

/** Existing originals received in three-bottle batches; no recipe or manufacturing claim. */
export interface HunterBottle {
  id: string;
  source: string;
  labourSteps: number;
  acquiredWeek: number | null;
  consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
  outcome: PublicResolutionTier | null;
}
export interface HunterState {
  discovered: boolean;
  guidanceKnown: boolean;
  bottles: HunterBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  observations: string[];
  practiceAttempts: Record<string, number>;
  trapStock: number;
  trapHeld: number;
  trapDeployed: number;
  trapSpent: number;
  trapLocation: null | 'FIRST_CASE' | 'HUNTER_CARGO';
  cargo: {
    status: 'AVAILABLE' | 'FIGHTING' | 'RESCUED' | 'RETREATED' | 'LOST';
    attemptWeek: number | null;
    startHistoryIndex: number | null;
    enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
    originalId: 'milo-copper-crate';
    owner: 'cargo-owner-milo';
    holder: 'OWNER';
  };
}
export interface HunterAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: HunterCommand;
}
export interface HunterProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  /** Kept explicitly false for shared pathway panels; guidance is not a formula. */
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  story?: string;
  supplies: string;
  actions: HunterAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: HunterCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  trapStock: number; trapHeld: number; trapDeployed: number; trapSpent: number;
}
