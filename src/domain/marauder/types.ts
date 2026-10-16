import type { PublicResolutionTier } from '../../shared/contracts.js';

/** G training categories within the sourced S9 ability boundary. */
export const MARAUDER_ABILITY_IDS = ['error.s9.agility', 'error.s9.dexterity', 'error.s9.theft'] as const;
export type MarauderAbilityId = typeof MARAUDER_ABILITY_IDS[number];
export const MARAUDER_CASE_IDS = ['training-purse', 'fallen-token', 'sealed-dispatch'] as const;
export type MarauderCaseId = typeof MARAUDER_CASE_IDS[number];
export const MARAUDER_ORIGINAL_IDS = ['training-token', 'brass-token', 'sealed-letter'] as const;
export type MarauderOriginalId = typeof MARAUDER_ORIGINAL_IDS[number];
export type MarauderAcquisitionCommand =
  | { type: 'DISCOVER' }
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type MarauderActivityCommand =
  | { type: 'OBSERVE'; caseId: string }
  | { type: 'PREPARE'; caseId: string; method: 'DEXTERITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: string }
  | { type: 'RETURN'; caseId: string }
  | { type: 'REPORT'; caseId: string; conclusion: 'LIMITED' | 'CERTAIN' }
  | { type: 'WITHDRAW'; caseId: string }
  | { type: 'REFLECT' };
export type MarauderDisputeCommand = {type:'OBSERVE_DISPUTE'}|{type:'PREPARE_DISPUTE'}|{type:'START_DISPUTE'}|{type:'LEAVE_DISPUTE'}|{type:'RETURN_TOOL'};
export type MarauderCommand = MarauderAcquisitionCommand | MarauderActivityCommand | MarauderDisputeCommand;
export interface MarauderDispute {
 stage:'UNSEEN'|'OBSERVED'|'READY'|'ACTIVE'|'RESOLVED';
 weapon:{id:'marauder-simon-club';owner:'塞蒙';custodian:'SIMON'|'PLAYER'|'SCENE'|'DESK';location:'SIMON_HAND'|'PLAYER_HAND'|'GROUND'|'RETURN_DESK';version:number};
 attention:number;outcome:null|'RETREATED'|'ENEMY_DEAD'|'PLAYER_DEAD'|'ENEMY_SURRENDERED';startHistoryIndex:number|null;
}
export interface MarauderDisputeProjection {stage:string;title:string;description:string;weapon:null|{id:string;owner:string;custodian:string;location:string;version:number};attention:number;outcome:string|null;}

/** Individually sealed, finished potions. The complete recipe remains unverified. */
export interface MarauderBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
export interface MarauderCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null;
  method: 'DEXTERITY' | 'ORDINARY' | null;
  mistakes: number;
  conclusion: 'LIMITED' | 'CERTAIN' | null;
  withdrawals: number;
  attention: number;
}
export interface MarauderOriginal {
  id: string;
  owner: string;
  custodian: 'HOLDER' | 'SITE' | 'PLAYER' | 'OWNER';
  location: string;
  version: number;
  sealed: boolean;
}
export interface MarauderState {
  dispute:MarauderDispute;
  discovered: boolean; guidanceKnown: boolean;
  bottles: MarauderBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  cases: Record<string, MarauderCaseState>;
  originals: Record<string, MarauderOriginal>;
  reflected: boolean;
}
export interface MarauderAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: MarauderCommand;
}
export interface MarauderCaseProjection {
  id: string; title: string; story: string; observations: string[];
  preparation: string | null; result: string | null; status: string;
}
export interface MarauderProjection {
  dispute:MarauderDisputeProjection;
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  supplies: string; story?: string;
  actions: MarauderAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: MarauderCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: MarauderCaseProjection[];
  originals: { id: string; label: string; owner: string; custodian: string; location: string; sealed: boolean; version: number }[];
  environment: string;
}
