/** STATIC CANDIDATE. Owning chapter authenticates source + host, settles once. */
import type { PublicCheckResult, PublicCoreStatKey } from '../../shared/contracts.js';
import type { GlorySiteState } from '../glory/life.js';
export const TWILIGHT_WORKER_IDS = ['TG220-MARA', 'TG220-OSRIC'] as const;
export type TwilightWorkerId = typeof TWILIGHT_WORKER_IDS[number];
export const TWILIGHT_SEGMENTS = ['A', 'B'] as const;
export type TwilightSegment = typeof TWILIGHT_SEGMENTS[number];
export interface TwilightWorksHost {
  actorId: string; sourceDigest: string; location: string; status: 'ACTIVE' | 'DEAD' | 'ENDED'; sequence: number;
  eventId: string; revision: number; week: number; nowSecond: number;
  actions: number; cash: number; health: number; mind: number; spirituality: number;
  coreStats: Record<PublicCoreStatKey, number>; mastery: Record<string, number>; check: PublicCheckResult | null;
}
/** Positive resource debits. Energy belongs to the continuing local body state. */
export interface TwilightWorksEffect {
  actions: number; cashCost: number; cashGain: 0; seconds: number; health: number; mind: number; spirituality: number;
  playerEnergy: number; playerEnergyRecovered: number; toLocation: string | null;
}
export interface TwilightWorker {
  id: TwilightWorkerId; bodyId: string; name: string; age: number; alive: true; health: number; energy: number;
  position: -2 | 2 | 5 | 8; travelledMetres: number; injuries: string[];
  consent: 'UNASKED' | 'GRANTED' | 'WITHDRAWN' | 'CLOSED'; consentWeek: number | null;
  hireEventId: string | null; arrivalEventId: string | null;
}
export interface TwilightSupport {
  id: string; segment: TwilightSegment; paidPennies: 24; boughtEventId: string; installedEventId: string | null;
  holder: 'PLAYER' | 'FITTED' | 'RETIRED'; integrity: number; passagesRemaining: number;
}
export interface TwilightBeam {
  id: 'TG220-BRIDGE-BEAM'; originalBridgeId: 'GL2-BRIDGE'; position: 5;
  /** Original game survey introduces this previously unmodelled component; no earlier integrity is overwritten. */
  introducedEventId: string | null; surveyedIntegrity: 60; integrity: number; version: number;
  restoredOrdinaryCeiling: 70; repairEventIds: string[];
}
export interface TwilightCart {
  id: 'TG220-MARA-HANDCART'; ownerId: 'TG220-MARA'; position: 8; integrity: number;
  axle: { id: 'TG220-MARA-AXLE'; version: number; jammed: boolean; remainingPush: number; strain: number };
}
export interface TwilightPassageReceipt {
  serviceId: 'TG220-PASSAGE-MARA' | 'TG220-PASSAGE-OSRIC'; actorId: string; workerId: TwilightWorkerId;
  bridgeId: 'GL2-BRIDGE'; sourceDigest: string; arrivedEventId: string;
  segments: { segment: TwilightSegment; from: 2 | 5; to: 5 | 8; metres: 3; eventId: string; supportId: string }[];
  crossedEventId: string; safeExitEventId: string; reviewedEventId: string; week: number;
}
export type TwilightWorksCommand =
  | { type: 'SURVEY' | 'WALK_RETURN_ROUTE' | 'REPAIR_BEAM_JOINT' | 'APPROACH' | 'RETREAT' | 'REST_OUTSIDE' | 'REVIEW' }
  | { type: 'ASK_WORKER' | 'WITHDRAW_CONSENT' | 'ARRIVE_WORKER' | 'SAFE_EXIT'; workerId: TwilightWorkerId }
  | { type: 'BUY_SUPPORT' | 'FIT_SUPPORT'; segment: TwilightSegment }
  | { type: 'CROSS_SEGMENT'; workerId: TwilightWorkerId; segment: TwilightSegment };
export interface TwilightWorksOrigin {
  actorId: string; sourceDigest: string; week: number; second: number; revision: number; site: GlorySiteState;
}
export interface TwilightWorksState {
  id: 'TG220-BRIDGE-WORKS'; location: 'GL2-REPAIR-ROOM'; actorId: string; sourceDigest: string;
  origin: TwilightWorksOrigin; lastSecond: number; position: -2 | 2 | 5 | 8; playerEnergy: number; playerTravelMetres: number;
  investigationEventId: string | null; routeEventId: string | null; reviewedEventId: string | null;
  beam: TwilightBeam; cart: TwilightCart; supports: TwilightSupport[]; workers: TwilightWorker[];
  traversals: { workerId: TwilightWorkerId; arrivalEventId: string; segment: TwilightSegment; eventId: string; supportId: string; from: 2 | 5; to: 5 | 8; metres: 3 }[];
  exits: { workerId: TwilightWorkerId; arrivalEventId: string; eventId: string; second: number; from: -2 | 2 | 5 | 8; metres: number; safe: boolean }[];
  journal: { command: TwilightWorksCommand; host: TwilightWorksHost; effect: TwilightWorksEffect; notes: string[] }[];
}
export const emptyTwilightWorksEffect = (): TwilightWorksEffect => ({ actions: 0, cashCost: 0, cashGain: 0, seconds: 0, health: 0, mind: 0, spirituality: 0, playerEnergy: 0, playerEnergyRecovered: 0, toLocation: null });
