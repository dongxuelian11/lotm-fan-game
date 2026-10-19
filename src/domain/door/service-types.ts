/** The three bounded original ordinary services; no earlier chapter state. */
export const DOOR_JOB_IDS = ['ledger-threshold', 'courtyard-stair', 'warehouse-gate'] as const;
export type DoorJobId = typeof DOOR_JOB_IDS[number];
export type DoorEnd = 'FROM' | 'TO';
export type DoorRole = 'OWNER' | 'RECEIVER' | 'TRAVELLER';
export type DoorRepair = 'FIT_THRESHOLD' | 'CLEAR_STAIR' | 'REFIT_GATE';
export type DoorTransfer = 'CARRY_LEDGER' | 'ESCORT_PORTER' | 'CARRY_TOOL_CHEST';

export interface DoorPerson {
  id: string; bodyId: string; name: string; age: number;
  status: 'ACTIVE' | 'DEAD'; health: number; energy: number; injuries: string[];
  position: DoorEnd | 'AWAY'; willingness: 'ALLOW' | 'REFUSED' | 'WITHDRAWN';
  version: number; travelledMetres: number;
}
export interface DoorJobDefinition {
  id: DoorJobId; title: string; location: string;
  ends: Record<DoorEnd, { id: string; name: string }>;
  owner: { id: string; bodyId: string; name: string; age: number };
  receiver: { id: string; bodyId: string; name: string; age: number };
  payload: { kind: 'CARGO'; id: string; name: string; ownerId: string }
    | { kind: 'PERSON'; id: string; bodyId: string; name: string; age: number };
  apparatusId: string; oldPartId: string; supplyId: string; supplyName: string;
  directMetres: number; bypassId: string; bypassMetres: number;
  pricePennies: number; repair: DoorRepair; transfer: DoorTransfer;
  repairSeconds: number; handlingSeconds: number; initialCondition: number;
  defect: string; repairedDescription: string;
}
export interface DoorPermission {
  eventId: string; visitId: string; personId: string; personVersion: number;
  endVersions: Record<DoorEnd, number>; response: DoorPerson['willingness'];
}
export interface DoorSurvey {
  eventId: string; visitId: string; endVersion: number; routeVersion: number;
  bypassId: string; bypassVersion: number;
}
export interface DoorArrival {
  eventId: string; subjectId: string; fromId: string; toId: string;
  week: number; second: number; metres: number; seconds: number;
  routeVersion: number; endVersions: Record<DoorEnd, number>;
}
export interface DoorJobState {
  id: DoorJobId; visitId: string | null; stopped: boolean;
  ends: Record<DoorEnd, { id: string; access: 'OPEN' | 'CLOSED'; version: number }>;
  owner: DoorPerson; receiver: DoorPerson;
  payload: { kind: 'CARGO'; id: string; ownerId: string; units: 1;
    position: DoorEnd; holderId: string; version: number }
    | { kind: 'PERSON'; person: DoorPerson };
  permission: Record<DoorRole, DoorPermission | null>;
  surveyed: Record<DoorEnd, DoorSurvey | null>;
  route: { id: string; version: number; condition: number; repaired: boolean;
    passable: boolean; oldPartId: string; oldPartPosition: 'BLOCKING' | 'ASIDE';
    repairEventId: string | null };
  bypass: { id: string; version: number; open: true; metres: number };
  supply: { id: string; units: 0 | 1; holder: 'SUPPLIER' | 'PLAYER' | 'INSTALLED';
    position: 'FROM'; version: number; boughtEventId: string | null; usedEventId: string | null };
  arrivals: DoorArrival[];
  review: { eventId: string; arrivalEventId: string; receiverId: string;
    subjectId: string; endVersions: Record<DoorEnd, number>; week: number; second: number } | null;
}
export type DoorServiceCommand =
  | { type: 'ENTER' | 'BUY_SUPPLIES' | 'VERIFY_ARRIVAL' | 'STOP' | 'RETURN_ON_FOOT' | 'LEAVE'; jobId: DoorJobId }
  | { type: 'WALK_BYPASS' | 'SURVEY_END'; jobId: DoorJobId; end: DoorEnd }
  | { type: 'ASK_PERSON'; jobId: DoorJobId; role: DoorRole }
  | { type: 'FIT_THRESHOLD' | 'CARRY_LEDGER'; jobId: 'ledger-threshold' }
  | { type: 'CLEAR_STAIR' | 'ESCORT_PORTER'; jobId: 'courtyard-stair' }
  | { type: 'REFIT_GATE' | 'CARRY_TOOL_CHEST'; jobId: 'warehouse-gate' };
/** Internal world facts only; never expose this union as a player intent. */
export type DoorSiteChange =
  | { type: 'END_CHANGED'; jobId: DoorJobId; end: DoorEnd; access: 'OPEN' | 'CLOSED' }
  | { type: 'PERSON_DECISION'; jobId: DoorJobId; role: DoorRole; response: DoorPerson['willingness'] }
  | { type: 'DIRECT_ROUTE_BLOCKED'; jobId: DoorJobId };
/** Private snapshot built only from the chapter host, never a player command. */
export interface DoorServiceHost {
  runId: string; actorId: string; eventId: string; revision: number;
  status: 'ACTIVE' | 'DEAD'; sequence: number; location: string;
  week: number; nowSecond: number; secondsIntoWeek: number;
  cash: number; actions: number; health: number; mind: number; spirituality: number;
}
export interface DoorServiceEffect {
  cashCost: number; cashGain: 0; actions: number; seconds: number;
  health: 0; mind: 0; spirituality: 0; randomDraws: 0;
}
export interface DoorMovement {
  subjectId: string; fromId: string; toId: string;
  routeId: string; metres: number; seconds: number; carriedWithActor: boolean;
}
export interface DoorServiceEvent {
  id: string; revision: number; command: DoorServiceCommand | DoorSiteChange;
  kind: 'PLAYER' | 'WORLD'; week: number; endWeek: number;
  beforeSecond: number; afterSecond: number; host: DoorServiceHost;
  effect: DoorServiceEffect; movements: DoorMovement[];
  consumedIds: string[]; permission: DoorPermission | null; notes: string[];
}
export interface DoorServicesState {
  version: 1; runId: string; actorId: string;
  startWeek: number; startSecond: number; lastSecond: number;
  activeJobId: DoorJobId | null; playerPosition: DoorEnd | 'OUTSIDE';
  jobs: Record<DoorJobId, DoorJobState>; journal: DoorServiceEvent[];
}
export interface DoorServiceResult {
  state: DoorServicesState; effect: DoorServiceEffect; event: DoorServiceEvent;
}
