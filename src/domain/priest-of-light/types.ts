import type { PublicResolutionTier } from '../../shared/contracts.js';

export const PRIEST_OF_LIGHT_ABILITY_IDS = ['sun.s5.holy-light', 'sun.s5.purification-aura'] as const;
export type PriestOfLightAbilityId = typeof PRIEST_OF_LIGHT_ABILITY_IDS[number];
export const PRIEST_OF_LIGHT_CASE_IDS = ['darkened-walk', 'bounded-cleansing', 'mixed-company'] as const;
export type PriestOfLightCaseId = typeof PRIEST_OF_LIGHT_CASE_IDS[number];
export type PriestOfLightAcquisitionCommand =
  | { type: 'LEARN_FORMULA' } | { type: 'REQUEST_SUPPLY' } | { type: 'RECEIVE_SUPPLY' }
  | { type: 'MATERIAL_WORK'; batchId: string } | { type: 'BUY_MATERIALS'; batchId: string } | { type: 'BREW'; batchId: string }
  | { type: 'REQUEST_RITUAL' } | { type: 'GO_RITUAL' } | { type: 'BEGIN_RITUAL' } | { type: 'END_RITUAL' } | { type: 'RETURN_GUIDE' }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };
export type PriestOfLightActivityCommand =
  | { type: 'OBSERVE'; caseId: PriestOfLightCaseId }
  | { type: 'PREPARE'; caseId: PriestOfLightCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: PriestOfLightCaseId } | { type: 'CLOSE'; caseId: PriestOfLightCaseId }
  | { type: 'REPORT'; caseId: PriestOfLightCaseId } | { type: 'WITHDRAW'; caseId: PriestOfLightCaseId }
  | { type: 'MOVE_LANTERN' } | { type: 'RETURN_LANTERN' } | { type: 'CLEAR_SPIRIT' }
  | { type: 'REFLECT' } | { type: 'ENCOUNTER_TALK' } | { type: 'ENCOUNTER_FIGHT' };
export type PriestOfLightCommand = PriestOfLightAcquisitionCommand | PriestOfLightActivityCommand;
export interface PriestOfLightMaterial {
  id: string; name: string; quantity: number; unit: string; source: string; holder: 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
}
export interface PriestOfLightBatch { id: string; materials: PriestOfLightMaterial[]; labourSteps: number; acquired: boolean; brewed: boolean }
export interface PriestOfLightBottle {
  id: string; batchId: string; inputIds: string[]; brewedWeek: number;
  status: 'PREPARED' | 'CONSUMED'; outcome: PublicResolutionTier | null;
  consumedWeek: number | null; ritualVisit: number | null;
}
/** Original sealed professional stock PL5-ICE-1 is a fixture, never a player-created inventory reward. */
export interface PriestOfLightRitual {
  requestedWeek: number | null; visitWeek: number | null; location: 'GUIDE' | 'CHAMBER' | 'ICE';
  helperPresent: boolean; darkness: boolean; nonMeltingIce: boolean;
  visits: number; consumptions: number;
  history: { number: number; requestedWeek: number; visitWeek: number; entered: boolean; returned: boolean; consumedBottleId: string | null }[];
}
export interface PriestOfLightCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  attemptWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  withdrawals: number; outcome: 'NONE' | 'LIGHT_CHECKED' | 'LAMP_COMPARED' | 'TRACE_REDUCED' | 'TRACE_SEALED' | 'SPIRIT_SHELTERED' | 'RADIUS_CHECKED';
  contactOpen: boolean; closes: number;
}
export interface PriestOfLightPractice {
  lanternPosition: 'NEAR' | 'SHELTER'; auraOpen: boolean; spiritDistressed: boolean;
  lightChecks: number; trace: 'PRESENT' | 'REDUCED' | 'SEALED'; auraChecks: number;
}
export interface PriestOfLightState {
  formulaKnown: boolean; resupply: { requestedWeek: number | null; deliveries: number };
  batches: PriestOfLightBatch[]; bottles: PriestOfLightBottle[];
  promotionWeek: number | null; notaryActingAtPromotion: number | null;
  practice: PriestOfLightPractice; ritual: PriestOfLightRitual;
  cases: Record<PriestOfLightCaseId, PriestOfLightCaseState>; reflected: boolean;
  encounter: { status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; startHistoryIndex: number | null; attemptWeek: number | null };
}
export interface PriestOfLightAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: PriestOfLightCommand }
export interface PriestOfLightCaseProjection {
  id: string; title: string; story: string; observations: string[]; preparation: string | null; result: string | null;
  status: string; contactOpen: string; closes: number;
}
export interface PriestOfLightProjection {
  title: string; discovered: boolean; formulaKnown: boolean; promoted: boolean;
  formula: { name: string; quantity: number | null; unit: string; note?: string }[];
  story?: string; supplies: string; actions: PriestOfLightAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: PriestOfLightCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
  cases: PriestOfLightCaseProjection[]; insideCase: boolean; environment: string;
  practice: { lanternPosition: string; aura: string; distressed: string; history: string[] } | null;
  ritual: { location: 'GUIDE' | 'CHAMBER' | 'ICE'; status: string; source: string; summary: string; darkness: boolean; nonMeltingIce: boolean; helperPresent: boolean; visits: number; consumptions: number };
}
