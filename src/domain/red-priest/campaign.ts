import {
  RED_PRIEST_CAMPAIGN_VERSION, RED_PRIEST_CAMPAIGN_COALITION, RED_PRIEST_CAMPAIGN_POLITIES,
  RED_PRIEST_CAMPAIGN_LEGIONS, RED_PRIEST_CAMPAIGN_NODES, RED_PRIEST_CAMPAIGN_ROUTES,
  RED_PRIEST_CAMPAIGN_THEATERS, RED_PRIEST_CAMPAIGN_LIMITS as LIMITS, RED_PRIEST_CAMPAIGN_STORY,
  RED_PRIEST_CAMPAIGN_LABOUR_TASKS, type CampaignLabourTaskId,
  type CampaignPolityId, type CampaignCoalitionId, type CampaignLegionId,
  type CampaignNodeId, type CampaignLocation, type CampaignTheaterId,
} from './campaign-content.js';
export type { CampaignPolityId, CampaignCoalitionId, CampaignLegionId, CampaignNodeId, CampaignLocation, CampaignTheaterId } from './campaign-content.js';
export const RED_PRIEST_HEADQUARTERS_REST = {
  weeks: 2, treasury: 120, supply: 4, morale: 20, maximumMorale: 80,
} as const;
export const RED_PRIEST_SUPPLY_ONLY_CONVOY = { treasury: 300, supply: 24, weeks: 2 } as const;
/** Opt-in, bounded game preparation. Every cost below is per original army /
 * its own authorized treasury, in addition to ordinary elapsed-week upkeep. */
export const RED_PRIEST_BATTLE_PLANNING = {
  recon: { treasury: 120, supply: 1, weeks: 1, actions: 1, effectiveBonus: 8 },
  extraSupplies: { supply: 6, effectiveBonus: 12 },
  coordinated: { minimumPersonnel: 1000, minimumMorale: 60, effectiveBonus: 20 },
  protective: { treasury: 60, weeks: 1, actions: 1, effectiveBonus: 18,
    victoryLoss: 120, defeatLoss: 450, victoryDisplaced: 30, defeatDisplaced: 60 },
} as const;
export type RedPriestBattleStance = 'STANDARD' | 'COORDINATED' | 'PROTECTIVE';
interface CampaignPreparationBinding {
  eventId: string; week: number; nodeId: CampaignNodeId; defenderId: CampaignLegionId; battleCount: number;
}
export interface RedPriestCampaignPlanning {
  version: 1; enabledEventId: string; enabledWeek: number;
  recon: CampaignPreparationBinding | null;
  selection: (CampaignPreparationBinding & { stance: RedPriestBattleStance; extraSupplies: boolean }) | null;
}

/** The entire numeric model below is original, finite strategic game abstraction.
 * This module does not import the old thirty people, mutate the host, award S0,
 * mint player money, resolve random rolls, or prescribe real military tactics. */
export type RedPriestCampaignCommand =
  | { type: 'ENABLE_PLANNING' }
  | { type: 'RECONNOITRE' | 'PREPARED_BATTLE'; nodeId: CampaignNodeId }
  | { type: 'SELECT_BATTLE_PLAN'; nodeId: CampaignNodeId; stance: RedPriestBattleStance; extraSupplies: boolean }
  | { type: 'MILITARY_LABOUR'; taskId: CampaignLabourTaskId }
  | { type: 'REQUEST_AUTHORITY'; polityId: CampaignPolityId }
  | { type: 'RELEASE_AUTHORITY' | 'REORGANIZE' | 'SUPPLY_ONLY'; polityId: CampaignCoalitionId }
  | { type: 'MARCH' | 'BATTLE' | 'CONSOLIDATE'; nodeId: CampaignNodeId }
  | { type: 'DECLARE_OFFENSIVE' | 'WAIT' | 'SEEK_ARMISTICE' | 'WITHDRAW_PROTECT' | 'RETURN_TO_HEADQUARTERS' | 'REST_FIELD_ARMIES' };
export interface RedPriestCampaignPlayer {
  alive: boolean; pathwayId: string | null; sequence: number | null;
  cash: number; health: number; mind: number; spirituality: number; actionsRemaining: number;
  campaignLocation: CampaignLocation;
}
/** Only the authoritative host may construct this from an actual resolved check.
 * Renderer commands never carry receipts, outcomes, troop counts or roll data.
 * Binding prevents cross-run/week/action/target reuse. The source journal remains
 * private; the host must retain its underlying normal-check / battle evidence. */
export interface RedPriestCampaignReceipt {
  id: string; campaignId: string; eventId: string; revision: number; week: number;
  kind: 'AUTHORIZATION' | 'BATTLE' | 'ARMISTICE'; targetId: string;
  result: 'GREAT_SUCCESS' | 'SUCCESS' | 'FAILURE' | 'SEVERE_FAILURE';
  source: 'NORMAL_CHECK' | 'BATTLE_RESOLUTION';
}
export interface RedPriestCampaignHost {
  readonly week: number;
  readonly eventId: string;
  readonly player: Readonly<RedPriestCampaignPlayer>;
  readonly receipt?: Readonly<RedPriestCampaignReceipt>;
}
export interface CampaignPolityState {
  id: CampaignPolityId; authority: 'PENDING' | 'GRANTED' | 'REFUSED' | 'RELEASED';
  authorizationEventId: string | null; treasury: number; treasurySpent: number;
  reservePersonnel: number; reservesCommitted: number; supplyReserve: number; suppliesCommitted: number;
  mobilizedPersonnel: number; transportLoads: number; livelihoodLoss: number;
  evacuatedResidents: number; displacedResidents: number; civilianDeaths: number;
}
export interface CampaignLegionState {
  id: CampaignLegionId; polityId: CampaignPolityId; personnel: number;
  killed: number; wounded: number; detached: number; reinforcements: number; supply: number; supplySpent: number;
  supplyDelivered: number; morale: number; mobilized: boolean; retreated: boolean;
  location: CampaignLocation | 'rear';
}
export interface CampaignNodeState {
  id: CampaignNodeId; originalDefenderId: CampaignLegionId; currentDefenderId: CampaignLegionId;
  controller: CampaignPolityId | 'coalition'; enemyAdvanced: boolean;
  facilityIntegrity: number; supplyIntegrity: number; consolidated: boolean;
  battleCount: number; coalitionLosses: number; defenderLosses: number;
  displaced: number; evacuated: number; civilianDeaths: number;
  victory: { eventId: string; receiptId: string; week: number; defenderId: CampaignLegionId } | null;
}
export interface CampaignConvoy {
  id: string; polityId: CampaignCoalitionId; legionId: CampaignLegionId;
  orderedWeek: number; arrivalWeek: number; personnel: number; supply: number;
  status: 'IN_TRANSIT' | 'DELIVERED' | 'RETURNED';
  kind?: 'SUPPLY_ONLY';
}
export interface RedPriestCampaignSettlement {
  /** Positive deductions, atomically paid by the host exactly once. */
  cash: number; cashGain: number; spirituality: number; health: number; mind: number; actions: 0 | 1 | 2;
  weeks: number; travelWeeks: number; fromLocation: CampaignLocation; toLocation: CampaignLocation;
  risk: 'NONE' | 'EXPOSURE' | 'BATTLE'; receiptId: string | null;
}
export interface RedPriestCampaignEvent {
  type: 'PLANNING' | 'RECONNAISSANCE' | 'PREPARATION' | 'AUTHORITY' | 'DECLARATION' | 'MOBILIZATION' | 'MARCH' | 'WAR_STARTED' | 'BATTLE'
    | 'OCCUPATION' | 'CONSOLIDATION' | 'CONVOY_ORDERED' | 'CONVOY_ARRIVED' | 'CONVOY_RETURNED'
    | 'UPKEEP' | 'ATTRITION' | 'RETREAT' | 'ARMISTICE' | 'WITHDRAWAL' | 'WAIT' | 'LABOUR' | 'DETACHMENT' | 'REST';
  week: number; message: string; polityId?: CampaignPolityId; nodeId?: CampaignNodeId;
  legionId?: CampaignLegionId; personnel?: number; treasurySpent?: number; supplySpent?: number;
  from?: CampaignLocation | 'rear'; to?: CampaignLocation | 'rear'; travelWeeks?: number;
  moraleGain?: number;
}
export interface CampaignDetachment {
  id: string; legionId: CampaignLegionId; originalPersonnel: number; location: CampaignLocation;
  status: 'DEPLOYED' | 'RETURNED'; killed: number; wounded: number; returned: number;
}
type CampaignHostOperation =
  | { type: 'HOST_ADVANCE'; toWeek: number }
  | { type: 'DETACHMENT_DISPATCH'; legionId: CampaignLegionId; personnel: number }
  | { type: 'DETACHMENT_SETTLE'; detachmentId: string; killed: number; wounded: number };
interface CampaignJournalEntry {
  command: RedPriestCampaignCommand | CampaignHostOperation; host: RedPriestCampaignHost;
  settlement: RedPriestCampaignSettlement; events: RedPriestCampaignEvent[];
}
export interface RedPriestCampaignState {
  version: typeof RED_PRIEST_CAMPAIGN_VERSION;
  origin: { runId: string; startWeek: number; branchYear: 1353; existingWar: false };
  campaignId: string; revision: number; week: number;
  phase: 'CRISIS' | 'ORDERED' | 'WAR' | 'ARMISTICE' | 'WITHDRAWN';
  location: CampaignLocation; lastSafeLocation: CampaignLocation;
  declaration: { eventId: string; week: number; authorities: CampaignCoalitionId[] } | null;
  firstCrossBorder: { eventId: string; week: number; from: CampaignLocation; to: CampaignNodeId } | null;
  warStarted: { eventId: string; receiptId: string; week: number } | null;
  opponentDisposition: 'REFUSES' | 'MOBILIZED' | 'RETREATING' | 'CEASEFIRE' | 'HOLDING';
  polities: Record<CampaignPolityId, CampaignPolityState>;
  legions: Record<CampaignLegionId, CampaignLegionState>;
  nodes: Record<CampaignNodeId, CampaignNodeState>;
  labour: { lastWeek: number | null; completed: number; earned: number };
  detachments: CampaignDetachment[]; convoys: CampaignConvoy[]; journal: CampaignJournalEntry[];
  /** Deliberately absent from every historical state until the explicit command. */
  planning?: RedPriestCampaignPlanning;
}
export interface RedPriestCampaignBlock { code: string; message: string }
export type RedPriestCampaignResult =
  | { ok: true; state: RedPriestCampaignState; settlement: RedPriestCampaignSettlement; events: RedPriestCampaignEvent[] }
  | { ok: false; block: RedPriestCampaignBlock };

const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const textId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200;
const clone = <T>(v: T): T => structuredClone(v);
const stable = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (record(v)) return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v) ?? 'undefined';
};
const same = (a: unknown, b: unknown) => stable(a) === stable(b);
const block = (code: string, message: string): RedPriestCampaignBlock => ({ code, message });
const ally = (id: unknown): id is CampaignCoalitionId => RED_PRIEST_CAMPAIGN_COALITION.some(x => x === id);
const nodeId = (id: unknown): id is CampaignNodeId => RED_PRIEST_CAMPAIGN_NODES.some(x => x.id === id);
const location = (id: unknown): id is CampaignLocation => id === 'loen-headquarters' || nodeId(id);
const nodeContent = (id: CampaignNodeId) => RED_PRIEST_CAMPAIGN_NODES.find(n => n.id === id)!;
const fieldArmy = (s: RedPriestCampaignState) => RED_PRIEST_CAMPAIGN_LEGIONS.filter(l => l.role === 'FIELD').map(l => s.legions[l.id]);
const fieldFor = (s: RedPriestCampaignState, id: CampaignCoalitionId) => fieldArmy(s).find(l => l.polityId === id)!;
const active = (s: RedPriestCampaignState) => s.phase === 'ORDERED' || s.phase === 'WAR';
const commanded = (s: RedPriestCampaignState) => RED_PRIEST_CAMPAIGN_COALITION.every(id => s.polities[id].authority === 'GRANTED');
const success = (r: RedPriestCampaignReceipt) => r.result === 'SUCCESS' || r.result === 'GREAT_SUCCESS';
const battleCommand = (c: RedPriestCampaignCommand) => c.type === 'BATTLE' || c.type === 'PREPARED_BATTLE';
const validStance = (v: unknown): v is RedPriestBattleStance => v === 'STANDARD' || v === 'COORDINATED' || v === 'PROTECTIVE';
const originalArmiesPresent = (s: RedPriestCampaignState) => commanded(s) && fieldArmy(s).every(l =>
  l.mobilized && !l.retreated && l.personnel > 0 && l.location === s.location);
function bindingMatches(s: RedPriestCampaignState, binding: CampaignPreparationBinding | null, target: CampaignNodeId): boolean {
  return binding !== null && active(s) && originalArmiesPresent(s) && s.location === target
    && binding.nodeId === target && binding.defenderId === s.nodes[target].currentDefenderId
    && binding.battleCount === s.nodes[target].battleCount && s.nodes[target].victory === null
    && s.nodes[target].controller === 'feysac' && s.nodes[target].enemyAdvanced
    && s.legions[binding.defenderId].personnel > 0 && !s.legions[binding.defenderId].retreated;
}
function preparationBinding(s: RedPriestCampaignState, id: CampaignNodeId, h: RedPriestCampaignHost): CampaignPreparationBinding {
  return { eventId: h.eventId, week: h.week, nodeId: id, defenderId: s.nodes[id].currentDefenderId, battleCount: s.nodes[id].battleCount };
}
/** Invalidate only live preparation; past journal entries and results stay intact. */
function invalidatePreparation(s: RedPriestCampaignState, events: RedPriestCampaignEvent[], week: number): void {
  if (!s.planning) return;
  let invalidated = false;
  for (const key of ['recon', 'selection'] as const) {
    const binding = s.planning[key];
    if (binding && !bindingMatches(s, binding, binding.nodeId)) { s.planning[key] = null; invalidated = true; }
  }
  if (invalidated) events.push({ type: 'PREPARATION', week,
    message: '本人驻地、原守军或实际委托已改变；先前本节点的侦察与部署不再适用于下一战，已付成本与旧记录保留。' });
}
/** Publicly derivable bounded modifiers. No rolls, receipts or future outcomes. */
export function getRedPriestCampaignPlanPreview(s: RedPriestCampaignState, target: CampaignNodeId) {
  const selection = s.planning?.selection ?? null;
  const hasSelection = bindingMatches(s, selection, target);
  const stance = hasSelection ? selection!.stance : 'STANDARD';
  const extraSupplies = hasSelection && selection!.extraSupplies;
  const reconEffective = bindingMatches(s, s.planning?.recon ?? null, target);
  const coordinated = RED_PRIEST_BATTLE_PLANNING.coordinated;
  const coordinatedEligible = originalArmiesPresent(s) && fieldArmy(s).every(l =>
    l.personnel >= coordinated.minimumPersonnel && l.morale >= coordinated.minimumMorale);
  const protective = stance === 'PROTECTIVE', rules = RED_PRIEST_BATTLE_PLANNING;
  const effectiveBonus = (reconEffective ? rules.recon.effectiveBonus : 0)
    + (extraSupplies ? rules.extraSupplies.effectiveBonus : 0)
    + (protective ? rules.protective.effectiveBonus : stance === 'COORDINATED' && coordinatedEligible ? coordinated.effectiveBonus : 0);
  return { hasSelection, stance, extraSupplies, reconEffective, coordinatedEligible, effectiveBonus,
    battleSupplyPerArmy: LIMITS.battleSupply + (extraSupplies ? rules.extraSupplies.supply : 0),
    victoryLossPerArmy: protective ? rules.protective.victoryLoss : LIMITS.victoryLoss,
    defeatLossPerArmy: protective ? rules.protective.defeatLoss : LIMITS.defeatLoss,
    victoryDisplaced: protective ? rules.protective.victoryDisplaced : 60,
    defeatDisplaced: protective ? rules.protective.defeatDisplaced : 100 };
}
export function getRedPriestCampaignTravelWeeks(from: CampaignLocation, to: CampaignLocation): number {
  if (!location(from) || !location(to)) throw new Error('行军地点无效。');
  return Math.abs(withdrawalWeeks(from) - withdrawalWeeks(to));
}
function withdrawalWeeks(from: CampaignLocation): number {
  if (from === 'loen-headquarters') return 0;
  const index = RED_PRIEST_CAMPAIGN_ROUTES.findIndex(r => r.to === from);
  return RED_PRIEST_CAMPAIGN_ROUTES.slice(0, index + 1).reduce((sum, r) => sum + r.weeks, 0);
}
function route(from: CampaignLocation, to: CampaignNodeId) {
  return RED_PRIEST_CAMPAIGN_ROUTES.find(r => (r.from === from && r.to === to) || (r.from === to && r.to === from));
}
export function validateRedPriestCampaignCommand(value: unknown): value is RedPriestCampaignCommand {
  if (!record(value)) return false;
  switch (value.type) {
    case 'ENABLE_PLANNING': return exact(value, ['type']);
    case 'RECONNOITRE': case 'PREPARED_BATTLE': return exact(value, ['type', 'nodeId']) && nodeId(value.nodeId);
    case 'SELECT_BATTLE_PLAN': return exact(value, ['type', 'nodeId', 'stance', 'extraSupplies'])
      && nodeId(value.nodeId) && validStance(value.stance) && typeof value.extraSupplies === 'boolean';
    case 'MILITARY_LABOUR': return exact(value, ['type', 'taskId']) && RED_PRIEST_CAMPAIGN_LABOUR_TASKS.some(t => t.id === value.taskId);
    case 'REQUEST_AUTHORITY': return exact(value, ['type', 'polityId']) && RED_PRIEST_CAMPAIGN_POLITIES.some(p => p.id === value.polityId);
    case 'RELEASE_AUTHORITY': case 'REORGANIZE': case 'SUPPLY_ONLY': return exact(value, ['type', 'polityId']) && ally(value.polityId);
    case 'MARCH': case 'BATTLE': case 'CONSOLIDATE': return exact(value, ['type', 'nodeId']) && nodeId(value.nodeId);
    case 'DECLARE_OFFENSIVE': case 'WAIT': case 'SEEK_ARMISTICE': case 'WITHDRAW_PROTECT': case 'RETURN_TO_HEADQUARTERS': case 'REST_FIELD_ARMIES': return exact(value, ['type']);
    default: return false;
  }
}
export function createRedPriestCampaign(runId: string, startWeek: number): RedPriestCampaignState {
  if (!textId(runId) || !integer(startWeek)) throw new Error('大陆战役来源无效。');
  const polities = Object.fromEntries(RED_PRIEST_CAMPAIGN_POLITIES.map(p => [p.id, {
    id: p.id, authority: p.id === 'feysac' ? 'REFUSED' : 'PENDING', authorizationEventId: null,
    treasury: p.treasury, treasurySpent: 0, reservePersonnel: p.reserves, reservesCommitted: 0,
    supplyReserve: p.supplyReserve, suppliesCommitted: 0, mobilizedPersonnel: 0,
    transportLoads: 0, livelihoodLoss: 0, evacuatedResidents: 0, displacedResidents: 0, civilianDeaths: 0,
  }])) as Record<CampaignPolityId, CampaignPolityState>;
  const legions = Object.fromEntries(RED_PRIEST_CAMPAIGN_LEGIONS.map(l => [l.id, {
    id: l.id, polityId: l.polityId, personnel: l.personnel, killed: 0, wounded: 0, detached: 0, reinforcements: 0,
    supply: l.supply, supplySpent: 0, supplyDelivered: 0, morale: l.morale,
    mobilized: false, retreated: false,
    location: RED_PRIEST_CAMPAIGN_NODES.find(n => n.originalDefenderId === l.id)?.id ?? 'rear',
  }])) as Record<CampaignLegionId, CampaignLegionState>;
  const nodes = Object.fromEntries(RED_PRIEST_CAMPAIGN_NODES.map(n => [n.id, {
    id: n.id, originalDefenderId: n.originalDefenderId, currentDefenderId: n.originalDefenderId,
    controller: n.owner, enemyAdvanced: n.owner === 'feysac', facilityIntegrity: 100, supplyIntegrity: 100,
    consolidated: false, battleCount: 0, coalitionLosses: 0, defenderLosses: 0,
    displaced: 0, evacuated: 0, civilianDeaths: 0, victory: null,
  }])) as Record<CampaignNodeId, CampaignNodeState>;
  return { version: RED_PRIEST_CAMPAIGN_VERSION, origin: { runId, startWeek, branchYear: 1353, existingWar: false },
    campaignId: `red-priest:${runId}:${startWeek}`, revision: 0, week: startWeek, phase: 'CRISIS',
    location: 'loen-headquarters', lastSafeLocation: 'loen-headquarters', declaration: null, firstCrossBorder: null,
    warStarted: null, opponentDisposition: 'REFUSES', polities, legions, nodes, labour: { lastWeek: null, completed: 0, earned: 0 }, detachments: [], convoys: [], journal: [] };
}
/** Cheap invariants for the engine-owned current state. This is not a load gate:
 * persisted or externally supplied state must pass verifyRedPriestCampaignState. */
function structurallyValid(s: RedPriestCampaignState): boolean {
  try {
    if (!record(s) || s.version !== RED_PRIEST_CAMPAIGN_VERSION || !record(s.origin)
      || !textId(s.origin.runId) || !integer(s.origin.startWeek) || s.origin.branchYear !== 1353 || s.origin.existingWar !== false
      || s.campaignId !== `red-priest:${s.origin.runId}:${s.origin.startWeek}` || !integer(s.week) || s.week < s.origin.startWeek
      || !integer(s.revision) || !Array.isArray(s.journal) || s.revision !== s.journal.length
      || !location(s.location) || !location(s.lastSafeLocation) || !['CRISIS','ORDERED','WAR','ARMISTICE','WITHDRAWN'].includes(s.phase)
      || !['REFUSES','MOBILIZED','RETREATING','CEASEFIRE','HOLDING'].includes(s.opponentDisposition)
      || !record(s.polities) || !exact(s.polities, RED_PRIEST_CAMPAIGN_POLITIES.map(p => p.id))
      || !record(s.legions) || !exact(s.legions, RED_PRIEST_CAMPAIGN_LEGIONS.map(l => l.id))
      || !record(s.nodes) || !exact(s.nodes, RED_PRIEST_CAMPAIGN_NODES.map(n => n.id)) || !Array.isArray(s.convoys)
      || !record(s.labour) || !integer(s.labour.completed) || !integer(s.labour.earned)
      || s.labour.earned !== s.labour.completed * 60 || !(s.labour.lastWeek === null || integer(s.labour.lastWeek))
      || !Array.isArray(s.detachments)) return false;
    if (Object.hasOwn(s, 'planning')) {
      const planning = s.planning;
      if (!record(planning) || !exact(planning, ['version', 'enabledEventId', 'enabledWeek', 'recon', 'selection'])
        || planning.version !== 1 || !textId(planning.enabledEventId) || !integer(planning.enabledWeek)
        || planning.enabledWeek > s.week) return false;
      const enabled = s.journal.find(e => e.host.eventId === planning.enabledEventId);
      if (enabled?.command.type !== 'ENABLE_PLANNING' || enabled.host.week !== planning.enabledWeek
        || (s.declaration !== null && planning.enabledWeek > s.declaration.week)) return false;
      for (const key of ['recon', 'selection'] as const) {
        const binding = planning[key];
        if (binding === null) continue;
        const keys = ['eventId', 'week', 'nodeId', 'defenderId', 'battleCount'];
        if (key === 'selection') keys.push('stance', 'extraSupplies');
        if (!record(binding) || !exact(binding, keys) || !textId(binding.eventId) || !integer(binding.week)
          || binding.week > s.week || !nodeId(binding.nodeId) || !integer(binding.battleCount)
          || !bindingMatches(s, binding, binding.nodeId)) return false;
        if (key === 'selection' && (!validStance(planning.selection!.stance) || typeof planning.selection!.extraSupplies !== 'boolean')) return false;
        const source = s.journal.find(e => e.host.eventId === binding.eventId);
        if (source?.host.week !== binding.week || source.command.type !== (key === 'recon' ? 'RECONNOITRE' : 'SELECT_BATTLE_PLAN')) return false;
      }
    }
    if (s.journal.slice(LIMITS.maxEntries).some(e => !record(e) || !record(e.command)
      || !['WITHDRAW_PROTECT', 'RETURN_TO_HEADQUARTERS', 'WAIT', 'HOST_ADVANCE', 'DETACHMENT_SETTLE'].includes(String(e.command.type)))) return false;
    for (const p of RED_PRIEST_CAMPAIGN_POLITIES) {
      const x = s.polities[p.id];
      if (!record(x) || x.id !== p.id || !['PENDING','GRANTED','REFUSED','RELEASED'].includes(x.authority)
        || (x.authorizationEventId !== null && !textId(x.authorizationEventId))) return false;
      for (const k of ['treasury','treasurySpent','reservePersonnel','reservesCommitted','supplyReserve','suppliesCommitted','mobilizedPersonnel','transportLoads','livelihoodLoss','evacuatedResidents','displacedResidents','civilianDeaths'] as const)
        if (!integer(x[k])) return false;
      if (x.treasury + x.treasurySpent !== p.treasury || x.reservePersonnel + x.reservesCommitted !== p.reserves
        || x.supplyReserve + x.suppliesCommitted !== p.supplyReserve
        || x.displacedResidents + x.evacuatedResidents + x.civilianDeaths > p.residents) return false;
    }
    for (const l of RED_PRIEST_CAMPAIGN_LEGIONS) {
      const x = s.legions[l.id];
      if (!record(x) || x.id !== l.id || x.polityId !== l.polityId || typeof x.mobilized !== 'boolean' || typeof x.retreated !== 'boolean'
        || !(x.location === 'rear' || location(x.location))) return false;
      for (const k of ['personnel','killed','wounded','detached','reinforcements','supply','supplySpent','supplyDelivered','morale'] as const) if (!integer(x[k])) return false;
      if (x.personnel + x.killed + x.wounded + x.detached !== l.personnel + x.reinforcements
        || x.supply + x.supplySpent !== l.supply + x.supplyDelivered || x.morale > 100) return false;
    }
    for (const n of RED_PRIEST_CAMPAIGN_NODES) {
      const x = s.nodes[n.id];
      if (!record(x) || x.id !== n.id || x.originalDefenderId !== n.originalDefenderId
        || !RED_PRIEST_CAMPAIGN_LEGIONS.some(l => l.id === x.currentDefenderId)
        || !(x.controller === 'coalition' || RED_PRIEST_CAMPAIGN_POLITIES.some(p => p.id === x.controller))
        || typeof x.enemyAdvanced !== 'boolean' || typeof x.consolidated !== 'boolean') return false;
      for (const k of ['facilityIntegrity','supplyIntegrity','battleCount','coalitionLosses','defenderLosses','displaced','evacuated','civilianDeaths'] as const) if (!integer(x[k])) return false;
      if (x.facilityIntegrity > 100 || x.supplyIntegrity > 100 || x.displaced + x.evacuated + x.civilianDeaths > n.residents) return false;
      if (x.victory !== null && (!record(x.victory) || !textId(x.victory.eventId) || !textId(x.victory.receiptId)
        || !integer(x.victory.week) || x.victory.week > s.week || x.victory.defenderId !== n.opponentId || x.battleCount === 0)) return false;
      if (x.consolidated && (x.victory === null || x.controller !== 'coalition')) return false;
    }
    if (s.phase === 'CRISIS' && (s.declaration !== null || s.firstCrossBorder !== null || s.warStarted !== null)) return false;
    if (s.declaration !== null && (!textId(s.declaration.eventId) || !integer(s.declaration.week)
      || !same(s.declaration.authorities, [...RED_PRIEST_CAMPAIGN_COALITION]))) return false;
    if (s.firstCrossBorder !== null && (!textId(s.firstCrossBorder.eventId) || !integer(s.firstCrossBorder.week)
      || s.firstCrossBorder.from !== 'loen-headquarters' || s.firstCrossBorder.to !== 'northern-pass' || s.declaration === null)) return false;
    if (s.warStarted !== null && (!textId(s.warStarted.eventId) || !textId(s.warStarted.receiptId)
      || !integer(s.warStarted.week) || s.firstCrossBorder === null || s.declaration === null)) return false;
    if (s.phase === 'WAR' && s.warStarted === null) return false;
    if (new Set(s.journal.map(e => e.host.eventId)).size !== s.journal.length) return false;
    const receiptIds = s.journal.flatMap(e => e.host.receipt ? [e.host.receipt.id] : []);
    if (new Set(receiptIds).size !== receiptIds.length) return false;
    for (const c of s.convoys) {
      if (!record(c) || !textId(c.id) || !ally(c.polityId) || fieldFor(s, c.polityId).id !== c.legionId
        || !integer(c.orderedWeek) || !integer(c.arrivalWeek) || !['IN_TRANSIT','DELIVERED','RETURNED'].includes(c.status)) return false;
      if (c.kind === 'SUPPLY_ONLY') {
        const source = s.journal.find(e => e.host.eventId === c.id);
        if (c.personnel !== 0 || c.supply !== RED_PRIEST_SUPPLY_ONLY_CONVOY.supply
          || c.arrivalWeek !== c.orderedWeek + RED_PRIEST_SUPPLY_ONLY_CONVOY.weeks
          || source?.command.type !== 'SUPPLY_ONLY' || source.command.polityId !== c.polityId
          || source.host.week !== c.orderedWeek || s.convoys.filter(v => v.id === c.id).length !== 1) return false;
      } else if (c.kind !== undefined || c.arrivalWeek !== c.orderedWeek + LIMITS.convoyWeeks
        || c.personnel !== LIMITS.convoyPersonnel || c.supply !== LIMITS.convoySupply) return false;
    }
    for (const d of s.detachments) {
      if (!record(d) || !textId(d.id) || !RED_PRIEST_CAMPAIGN_LEGIONS.some(l => l.id === d.legionId && l.role === 'FIELD')
        || !location(d.location) || !integer(d.originalPersonnel) || d.originalPersonnel < 1 || d.originalPersonnel > 8
        || !integer(d.killed) || !integer(d.wounded) || !integer(d.returned) || !['DEPLOYED','RETURNED'].includes(d.status)
        || (d.status === 'DEPLOYED' ? d.killed + d.wounded + d.returned !== 0 : d.killed + d.wounded + d.returned !== d.originalPersonnel)) return false;
    }
    if (new Set(s.detachments.map(d => d.id)).size !== s.detachments.length) return false;
    for (const l of Object.values(s.legions)) if (l.detached !== s.detachments.filter(d => d.legionId === l.id && d.status === 'DEPLOYED').reduce((sum, d) => sum + d.originalPersonnel, 0)) return false;
    return true;
  } catch { return false; }
}
function validHost(host: RedPriestCampaignHost): boolean {
  return record(host) && integer(host.week) && textId(host.eventId) && record(host.player)
    && typeof host.player.alive === 'boolean' && (host.player.pathwayId === null || typeof host.player.pathwayId === 'string')
    && (host.player.sequence === null || integer(host.player.sequence)) && location(host.player.campaignLocation)
    && ['cash','health','mind','spirituality','actionsRemaining'].every(k => integer(host.player[k as 'cash']));
}
function cost(s: RedPriestCampaignState, c: RedPriestCampaignCommand, h: RedPriestCampaignHost): RedPriestCampaignSettlement {
  const failedBattle = battleCommand(c) && h.receipt !== undefined && !success(h.receipt);
  const retreatWeeks = failedBattle ? getRedPriestCampaignTravelWeeks(s.location, s.lastSafeLocation) : 0;
  const travelWeeks = c.type === 'MARCH' ? (route(s.location, c.nodeId)?.weeks ?? 1) : c.type === 'WITHDRAW_PROTECT' || c.type === 'RETURN_TO_HEADQUARTERS' ? withdrawalWeeks(s.location) : retreatWeeks > 1 ? retreatWeeks : 0;
  const cash = c.type === 'REQUEST_AUTHORITY' ? 60 : c.type === 'DECLARE_OFFENSIVE' ? 80
    : battleCommand(c) ? 40 : c.type === 'CONSOLIDATE' ? 30 : c.type === 'WAIT' || c.type === 'WITHDRAW_PROTECT' || c.type === 'RETURN_TO_HEADQUARTERS' || c.type === 'REST_FIELD_ARMIES' || c.type === 'RELEASE_AUTHORITY' || c.type === 'MILITARY_LABOUR' ? 0 : 20;
  const fighting = battleCommand(c);
  if (c.type === 'ENABLE_PLANNING' || c.type === 'SELECT_BATTLE_PLAN' || c.type === 'RECONNOITRE') {
    const paidPreparation = c.type === 'RECONNOITRE' || c.type === 'SELECT_BATTLE_PLAN' && c.stance === 'PROTECTIVE';
    return { cash: 0, cashGain: 0, spirituality: 0, health: 0, mind: 0, actions: paidPreparation ? 1 : 0,
      weeks: paidPreparation ? 1 : 0, travelWeeks: 0, fromLocation: s.location, toLocation: s.location, risk: 'NONE', receiptId: null };
  }
  const failed = fighting && h.receipt !== undefined && !success(h.receipt);
  return { cash, cashGain: c.type === 'MILITARY_LABOUR' ? 60 : 0, spirituality: fighting ? 6 : 0, health: Math.min(h.player.health, fighting ? (failed ? 10 : 3) : 0),
    mind: Math.min(h.player.mind, fighting ? (failed ? 8 : 2) : 0), actions: c.type === 'MILITARY_LABOUR' ? 2 : 1, weeks: c.type === 'MILITARY_LABOUR' ? 0 : c.type === 'REST_FIELD_ARMIES' ? RED_PRIEST_HEADQUARTERS_REST.weeks : travelWeeks || 1, travelWeeks,
    fromLocation: s.location, toLocation: c.type === 'MARCH' ? c.nodeId : c.type === 'WITHDRAW_PROTECT' || c.type === 'RETURN_TO_HEADQUARTERS' ? 'loen-headquarters' : s.location,
    risk: fighting ? 'BATTLE' : travelWeeks > 0 ? 'EXPOSURE' : 'NONE', receiptId: h.receipt?.id ?? null };
}
/** Exact host deductions / elapsed weeks for previews; no mutation or RNG. */
export function getRedPriestCampaignCost(s: RedPriestCampaignState, c: RedPriestCampaignCommand, h: RedPriestCampaignHost): RedPriestCampaignSettlement {
  return cost(s, c, h);
}
export interface RedPriestCampaignChallenge {
  kind: RedPriestCampaignReceipt['kind']; targetId: string; difficulty: number;
  attackingPersonnel: number; defendingPersonnel: number; effectiveBonus?: number;
}
/** Preview only. The host runs its real resolver and binds the resulting receipt. */
export function getRedPriestCampaignChallenge(s: RedPriestCampaignState, c: RedPriestCampaignCommand): RedPriestCampaignChallenge | null {
  if (c.type === 'REQUEST_AUTHORITY' && ally(c.polityId)) return { kind: 'AUTHORIZATION', targetId: c.polityId, difficulty: 35, attackingPersonnel: 0, defendingPersonnel: 0 };
  if (c.type === 'SEEK_ARMISTICE') return { kind: 'ARMISTICE', targetId: 'feysac', difficulty: 40, attackingPersonnel: 0, defendingPersonnel: 0 };
  if (c.type === 'BATTLE' || c.type === 'PREPARED_BATTLE') {
    const army = fieldArmy(s), defender = s.legions[s.nodes[c.nodeId].currentDefenderId];
    const shortage = Math.max(0, 7800 - army.reduce((n, l) => n + l.personnel, 0));
    return { kind: 'BATTLE', targetId: c.nodeId, difficulty: Math.min(90, nodeContent(c.nodeId).difficulty + Math.floor(shortage / 600)),
      attackingPersonnel: army.reduce((n, l) => n + l.personnel, 0), defendingPersonnel: defender.personnel,
      ...(c.type === 'PREPARED_BATTLE' ? { effectiveBonus: getRedPriestCampaignPlanPreview(s, c.nodeId).effectiveBonus } : {}) };
  }
  return null;
}
export function getRedPriestCampaignBlock(s: RedPriestCampaignState, command: unknown, host: RedPriestCampaignHost): RedPriestCampaignBlock | null {
  if (!validateRedPriestCampaignCommand(command)) return block('INVALID_COMMAND', '只能提交本次行动与明确目标。');
  if (!structurallyValid(s)) return block('INVALID_STATE', '战役记录需要重新核验。');
  if (!validHost(host)) return block('INVALID_HOST', '当前身体、资源或时间记录无效。');
  if (host.week !== s.week) return block('WEEK_MISMATCH', '上次战争行动的时间尚未完成结算。');
  if (host.player.campaignLocation !== s.location) return block('LOCATION_MISMATCH', '本人尚未到达此战役位置。');
  if (!host.player.alive || host.player.health === 0 || host.player.pathwayId !== 'hunter' || host.player.sequence !== 1) return block('INELIGIBLE', '须由仍存活的序列1征服者本人行动。');
  if (s.journal.some(e => e.host.eventId === host.eventId)) return block('REPEATED_EVENT', '这次行动已经结算。');
  if ((s.phase === 'ARMISTICE' || s.phase === 'WITHDRAWN') && command.type !== 'MILITARY_LABOUR') return block('ENDED', '本场有限战争已经结束。');
  if (s.journal.length >= LIMITS.maxEntries && !['WITHDRAW_PROTECT', 'RETURN_TO_HEADQUARTERS', 'WAIT'].includes(command.type))
    return block('ENTRY_LIMIT', '本次扩张行动已到记录上限，仍可沿原路返回、等待或保护撤离。');
  const c = command, settlement = cost(s, c, host);
  if (c.type === 'ENABLE_PLANNING') {
    if (s.planning) return block('PLANNING_ALREADY_ENABLED', '本次战役已明确采用战前筹划。');
    if (s.phase !== 'CRISIS' || s.declaration !== null) return block('PLANNING_CLOSED', '须在签发发动命令前决定是否采用战前筹划，旧战果不能重写。');
  }
  if (c.type === 'BATTLE' && s.planning) return block('PREPARED_BATTLE_REQUIRED', '本次战役须先明确选择方案，再按所选方案执行会战。');
  if ((c.type === 'RECONNOITRE' || c.type === 'SELECT_BATTLE_PLAN' || c.type === 'PREPARED_BATTLE') && !s.planning)
    return block('PLANNING_NOT_ENABLED', '须在发动命令之前明确采用战前筹划。');
  if (host.player.actionsRemaining < settlement.actions) return block('NO_ACTIONS', '本周行动不足。');
  if (host.player.cash < settlement.cash || host.player.spirituality < settlement.spirituality) return block('PLAYER_RESOURCES', '本人现有费用或灵性不足。');
  if (c.type === 'MILITARY_LABOUR') {
    if (s.polities.loen.authority !== 'GRANTED') return block('NO_AUTHORITY', '鲁恩尚未授权本次有限军务劳务。');
    if (s.location !== 'loen-headquarters' && !s.nodes[s.location].consolidated) return block('UNSECURED_WORKPLACE', '本人须在总部或实际巩固的驻地工作。');
    if (s.labour.lastWeek === s.week) return block('LABOUR_DONE_THIS_WEEK', '本周已完成一次实际军务劳务。');
    if (RED_PRIEST_CAMPAIGN_LABOUR_TASKS[s.labour.completed % RED_PRIEST_CAMPAIGN_LABOUR_TASKS.length]!.id !== c.taskId) return block('LABOUR_TASK_ORDER', '请按当前原军务交接事项完成核对。');
    if (s.polities.loen.treasury < 60) return block('TREASURY', '鲁恩国库不足以支付本次劳务报酬。');
  }
  if (c.type === 'REQUEST_AUTHORITY') {
    if (s.phase !== 'CRISIS') return block('AUTHORIZATION_CLOSED', '发动命令签出后不能补盖起战授权。');
    if (s.polities[c.polityId].authority === 'GRANTED') return block('ALREADY_AUTHORIZED', '该方已经明确授予本次指挥权。');
    if (c.polityId === 'feysac' && s.journal.some(e => e.command.type === 'REQUEST_AUTHORITY' && e.command.polityId === 'feysac')) return block('REFUSAL_RECORDED', '弗萨克已经明确拒绝联合指挥。');
  }
  if (c.type === 'RELEASE_AUTHORITY' && s.polities[c.polityId].authority !== 'GRANTED') return block('NO_AUTHORITY', '没有该方可交还的指挥权。');
  if (c.type === 'DECLARE_OFFENSIVE') {
    if (s.phase !== 'CRISIS' || s.declaration !== null) return block('ALREADY_ORDERED', '发动命令不能重复签发。');
    if (!commanded(s)) return block('MISSING_AUTHORITY', '鲁恩、因蒂斯与费内波特须分别真实授权。');
    if (RED_PRIEST_CAMPAIGN_POLITIES.some(p => s.polities[p.id].treasury < LIMITS.mobilizationTreasury)) return block('TREASURY', '有政权无法支付本次动员。');
  }
  if (c.type === 'RETURN_TO_HEADQUARTERS') {
    if (!active(s) || s.declaration === null || s.firstCrossBorder === null) return block('NO_OFFENSIVE', '须由已实际出发的本人和原军团沿原路返回。');
    if (s.location === 'loen-headquarters') return block('ALREADY_AT_HEADQUARTERS', '本人和原军团已经在总部。');
    if (!commanded(s)) return block('AUTHORITY_WITHDRAWN', '有政权已收回指挥委托，不能代其调动原军团。');
    if (fieldArmy(s).some(l => !l.mobilized || l.retreated || l.personnel === 0)) return block('ARMY_UNAVAILABLE', '须由尚在本次动员中的原军团返回。');
    if (fieldArmy(s).some(l => l.location !== s.location)) return block('ARMY_NOT_PRESENT', '本人和原军团须实际同处返程起点。');
  }
  if (c.type === 'REST_FIELD_ARMIES') {
    const rest = RED_PRIEST_HEADQUARTERS_REST, army = fieldArmy(s);
    if (!active(s) || s.declaration === null) return block('NO_OFFENSIVE', '只有已实际动员的原军团可进行总部休整。');
    if (s.location !== 'loen-headquarters') return block('NOT_AT_HEADQUARTERS', '本人须先沿实际路线返回总部。');
    if (!commanded(s)) return block('AUTHORITY_WITHDRAWN', '有政权已收回指挥委托，不能代其安排原军团休整。');
    if (army.some(l => !l.mobilized || l.retreated || l.personnel === 0)) return block('ARMY_UNAVAILABLE', '原军团须仍在本次动员中并保有实际人员。');
    if (army.some(l => l.location !== s.location)) return block('ARMY_NOT_PRESENT', '本人和三支原军团须实际同处总部。');
    if (army.every(l => l.morale >= rest.maximumMorale)) return block('NO_REST_NEEDED', '原军团士气已达到总部休整上限。');
    if (army.some(l => l.supply < rest.supply + rest.weeks * LIMITS.weeklySupply)) return block('SUPPLY', '每支原军团须备足休整补给及两周维持补给。');
    if (RED_PRIEST_CAMPAIGN_COALITION.some(id => {
      const deployed = Object.values(s.legions).filter(l => l.polityId === id && l.mobilized && !l.retreated && l.personnel > 0).length;
      return s.polities[id].treasury < rest.treasury + rest.weeks * LIMITS.weeklyTreasury * deployed;
    })) return block('TREASURY', '各原国库须备足总部休整费用和两周现有动员军费。');
  }
  if (c.type === 'RECONNOITRE' || c.type === 'SELECT_BATTLE_PLAN' || c.type === 'PREPARED_BATTLE') {
    if (!active(s)) return block('NO_OFFENSIVE', '须先取得三方实际委托并签发发动命令。');
    if (!commanded(s)) return block('AUTHORITY_WITHDRAWN', '有政权已收回委托，不能使用其原军团筹划会战。');
    if (!originalArmiesPresent(s)) return block('ARMY_NOT_PRESENT', '三支原军团须仍在动员中，并与本人实际同处当前节点。');
    if (s.location !== c.nodeId) return block('NOT_PRESENT', '须本人和原军团实际抵达所选节点。');
    const n = s.nodes[c.nodeId], defender = s.legions[n.currentDefenderId];
    if (n.victory !== null || n.controller === 'coalition') return block('ALREADY_WON', '此节点已经获胜，不再对过去战果添加准备。');
    if (n.controller !== 'feysac' || !n.enemyAdvanced) return block('NO_ENEMY', '所选节点尚无实际可交战的对方军团。');
    if (defender.personnel === 0 || defender.retreated) return block('NO_DEFENDER', '原守军已经退出，旧侦察与部署不能用于空战场。');
    if (s.firstCrossBorder === null) return block('NO_CROSSING', '须先实际执行首次跨境行军。');
    const preview = getRedPriestCampaignPlanPreview(s, c.nodeId), rules = RED_PRIEST_BATTLE_PLANNING;
    if (c.type === 'RECONNOITRE' && preview.reconEffective) return block('ALREADY_RECONNOITRED', '当前节点与同一守军的侦察仍有效，不能重复付费叠加。');
    if (c.type === 'SELECT_BATTLE_PLAN') {
      const selected = s.planning!.selection;
      if (preview.hasSelection && selected && (selected.stance === 'PROTECTIVE' && c.stance === 'PROTECTIVE'
        || selected.stance === c.stance && selected.extraSupplies === c.extraSupplies))
        return block('PLAN_ALREADY_SELECTED', '这项方案已经准备，不能重复登记；改选其他部署会放弃已付的护持准备。');
      if (c.stance === 'COORDINATED' && !preview.coordinatedEligible)
        return block('COORDINATION_UNAVAILABLE', '协同方案须三支原军团各有至少1000人、士气至少60且实际在场。');
    }
    if (c.type === 'PREPARED_BATTLE') {
      if (!preview.hasSelection) return block('NO_BATTLE_PLAN', '须先为当前节点与同一守军明确选择本次会战方案。');
      if (preview.stance === 'COORDINATED' && !preview.coordinatedEligible)
        return block('COORDINATION_UNAVAILABLE', '当前原军团已不满足协同条件，请依实际现状重新选择方案。');
    }
    if (c.type === 'RECONNOITRE' || c.type === 'SELECT_BATTLE_PLAN' && c.stance === 'PROTECTIVE') {
      const treasury = c.type === 'RECONNOITRE' ? rules.recon.treasury : rules.protective.treasury;
      const supply = c.type === 'RECONNOITRE' ? rules.recon.supply : 0;
      if (fieldArmy(s).some(l => l.supply < supply + LIMITS.weeklySupply))
        return block('SUPPLY', '各支原军团须备足此次准备与真实一周维持补给。');
      if (RED_PRIEST_CAMPAIGN_COALITION.some(id => {
        const deployed = Object.values(s.legions).filter(l => l.polityId === id && l.mobilized && !l.retreated && l.personnel > 0).length;
        return s.polities[id].treasury < treasury + deployed * LIMITS.weeklyTreasury;
      })) return block('TREASURY', '各原国库须备足本次准备费用和一周现有动员军费。');
    }
  }
  if (c.type === 'MARCH' || c.type === 'BATTLE' || c.type === 'PREPARED_BATTLE' || c.type === 'CONSOLIDATE') {
    if (!active(s)) return block('NO_OFFENSIVE', '先取得指挥权并明确签发发动命令。');
    if (!commanded(s)) return block('AUTHORITY_WITHDRAWN', '有政权已收回指挥委托，不能继续联合进攻。');
    const army = fieldArmy(s);
    if (army.some(l => !l.mobilized || l.retreated || l.personnel === 0)) return block('ARMY_UNAVAILABLE', '原军团未完成实际集结或已经退出。');
    const supplies = c.type === 'MARCH' ? LIMITS.marchSupply : c.type === 'PREPARED_BATTLE'
      ? getRedPriestCampaignPlanPreview(s, c.nodeId).battleSupplyPerArmy : c.type === 'BATTLE' ? LIMITS.battleSupply : LIMITS.consolidateSupply;
    // A forced retreat may take longer after an actual loss. Admission must not
    // depend on that outcome: shortages on the additional weeks cause attrition.
    const supplyWeeks = battleCommand(c) ? 1 : settlement.weeks;
    if (army.some(l => l.supply < supplies + supplyWeeks * LIMITS.weeklySupply)) return block('SUPPLY', '军团补给不足，须等待真实补给运输。');
    if (c.type === 'MARCH') {
      if (s.location === c.nodeId || !route(s.location, c.nodeId)) return block('NO_ROUTE', '不能越过未行经的战区或凭空抵达。');
      if (s.location !== 'loen-headquarters' && !s.nodes[s.location].consolidated) return block('UNSECURED_ROUTE', '须先巩固脚下节点，才可继续跨区行军。');
    } else {
      if (s.location !== c.nodeId) return block('NOT_PRESENT', '本人和原军团须实际抵达目标。');
      const n = s.nodes[c.nodeId];
      if (c.type === 'BATTLE' || c.type === 'PREPARED_BATTLE') {
        if (n.victory !== null || n.controller === 'coalition') return block('ALREADY_WON', '该节点已经获胜，不能重复计功。');
        if (n.controller !== 'feysac' || !n.enemyAdvanced) return block('NO_ENEMY', '目标并没有可交战的弗萨克军团。');
        if (s.firstCrossBorder === null) return block('NO_CROSSING', '发动命令尚未经过首次跨境执行。');
        if (army.some(l => l.morale < LIMITS.minimumLegionMorale) || army.reduce((sum, l) => sum + l.personnel, 0) < LIMITS.minimumArmyPersonnel) return block('ARMY_DEPLETED', '原军团需要有限后备与跨周整补。');
        if (s.legions[n.currentDefenderId].personnel === 0 || s.legions[n.currentDefenderId].retreated) return block('NO_DEFENDER', '原守军已不在此，不能以空战场申报胜利。');
      } else if (n.victory === null || n.controller !== 'coalition') return block('NOT_CONTROLLED', '未实际取胜的设施不能登记为己方控制。');
      else if (n.consolidated) return block('ALREADY_CONSOLIDATED', '此节点已经完成巩固。');
    }
  }
  if (c.type === 'REORGANIZE') {
    if (!active(s) || s.polities[c.polityId].authority !== 'GRANTED') return block('NO_AUTHORITY', '只有已获授权的实际动员军团可申请整补。');
    const p = s.polities[c.polityId], l = fieldFor(s, c.polityId);
    if (s.convoys.some(v => v.polityId === c.polityId && v.status === 'IN_TRANSIT')) return block('CONVOY_PENDING', '该方补给仍在途中。');
    if (l.personnel >= RED_PRIEST_CAMPAIGN_LEGIONS.find(x => x.id === l.id)!.personnel && l.supply >= 64 && l.morale >= 70) return block('NO_REPLENISHMENT_NEED', '军团暂无需要动用后备的缺口。');
    if (p.treasury < LIMITS.convoyTreasury || p.reservePersonnel < LIMITS.convoyPersonnel || p.supplyReserve < LIMITS.convoySupply) return block('RESERVE_EXHAUSTED', '本国国库、后备兵员或后备补给不足。');
  }
  if (c.type === 'SUPPLY_ONLY') {
    const p = s.polities[c.polityId], l = fieldFor(s, c.polityId), convoy = RED_PRIEST_SUPPLY_ONLY_CONVOY;
    if (!active(s) || p.authority !== 'GRANTED') return block('NO_AUTHORITY', '只有仍获实际委托的动员军团可申请原库存补给运输。');
    if (!l.mobilized || l.retreated || l.personnel === 0) return block('ARMY_UNAVAILABLE', '原军团已不在本次动员中，不能再申请补给运输。');
    if (l.location !== s.location) return block('ARMY_NOT_PRESENT', '本人须与受补给的原军团实际同处。');
    if (s.convoys.some(v => v.polityId === c.polityId && v.status === 'IN_TRANSIT')) return block('CONVOY_PENDING', '该方运输仍在途中。');
    if (l.supply >= 64) return block('NO_REPLENISHMENT_NEED', '原军团现有补给足够，暂不另开运输。');
    if (p.treasury < convoy.treasury || p.supplyReserve < convoy.supply) return block('RESERVE_EXHAUSTED', '本国现有国库或原库存补给不足以承担运输。');
  }
  if (c.type === 'SEEK_ARMISTICE' && s.warStarted === null) return block('NO_WAR', '尚未发生大陆战争，可直接取消并撤离。');
  return null;
}
function receiptBlock(s: RedPriestCampaignState, c: RedPriestCampaignCommand, h: RedPriestCampaignHost): RedPriestCampaignBlock | null {
  const challenge = getRedPriestCampaignChallenge(s, c), r = h.receipt;
  if (!challenge) return r === undefined ? null : block('UNEXPECTED_RECEIPT', '这次行动不接受额外胜负回执。');
  if (!r || !record(r) || !exact(r, ['id','campaignId','eventId','revision','week','kind','targetId','result','source'])
    || !textId(r.id) || r.campaignId !== s.campaignId || r.eventId !== h.eventId || r.revision !== s.revision
    || r.week !== h.week || r.kind !== challenge.kind || r.targetId !== challenge.targetId
    || !['SUCCESS','GREAT_SUCCESS','FAILURE','SEVERE_FAILURE'].includes(r.result)
    || r.source !== (challenge.kind === 'BATTLE' ? 'BATTLE_RESOLUTION' : 'NORMAL_CHECK')) return block('INVALID_RECEIPT', '须使用主机本次真实检定与目标相符的回执。');
  if (s.journal.some(e => e.host.receipt?.id === r.id)) return block('REPEATED_RECEIPT', '此检定回执已经使用。');
  return null;
}
function spendTreasury(s: RedPriestCampaignState, id: CampaignPolityId, desired: number): number {
  const p = s.polities[id], paid = Math.min(p.treasury, desired); p.treasury -= paid; p.treasurySpent += paid; return paid;
}
function spendSupply(l: CampaignLegionState, desired: number): number {
  const paid = Math.min(l.supply, desired); l.supply -= paid; l.supplySpent += paid; return paid;
}
function losses(l: CampaignLegionState, desired: number): number {
  const actual = Math.min(l.personnel, desired), killed = Math.floor(actual / 4);
  l.personnel -= actual; l.killed += killed; l.wounded += actual - killed; return actual;
}
function displace(s: RedPriestCampaignState, id: CampaignNodeId, desired: number): void {
  const n = s.nodes[id], cfg = nodeContent(id), amount = Math.min(desired, cfg.residents - n.displaced - n.evacuated - n.civilianDeaths);
  n.displaced += amount; s.polities[cfg.owner].displacedResidents += amount;
}
function mobilize(s: RedPriestCampaignState, events: RedPriestCampaignEvent[], week: number): void {
  for (const p of RED_PRIEST_CAMPAIGN_POLITIES) {
    const paid = spendTreasury(s, p.id, LIMITS.mobilizationTreasury);
    for (const cfg of RED_PRIEST_CAMPAIGN_LEGIONS.filter(l => l.polityId === p.id)) {
      const l = s.legions[cfg.id]; l.mobilized = true;
      s.polities[p.id].mobilizedPersonnel += l.personnel;
      if (cfg.role === 'FIELD') l.location = s.location;
    }
    s.polities[p.id].transportLoads += 1;
    events.push({ type: 'MOBILIZATION', week, polityId: p.id, treasurySpent: paid,
      personnel: s.polities[p.id].mobilizedPersonnel, message: `${p.name}调动自己的原有军队，并由本国国库承担动员。` });
  }
}
function pulse(s: RedPriestCampaignState, week: number, events: RedPriestCampaignEvent[]): void {
  for (const convoy of s.convoys.filter(v => v.status === 'IN_TRANSIT' && v.arrivalWeek <= week)) {
    const p = s.polities[convoy.polityId], l = s.legions[convoy.legionId];
    if (!active(s) || p.authority !== 'GRANTED') {
      convoy.status = 'RETURNED'; p.reservePersonnel += convoy.personnel; p.reservesCommitted -= convoy.personnel;
      p.supplyReserve += convoy.supply; p.suppliesCommitted -= convoy.supply;
      events.push({ type: 'CONVOY_RETURNED', week, polityId: p.id, message: '尚未投入的后备随运输队退回原国，已付运输费用不退。' });
    } else {
      convoy.status = 'DELIVERED'; l.personnel += convoy.personnel; l.reinforcements += convoy.personnel;
      l.supply += convoy.supply; l.supplyDelivered += convoy.supply;
      if (convoy.kind !== 'SUPPLY_ONLY') l.morale = Math.min(100, l.morale + LIMITS.convoyMorale);
      events.push({ type: 'CONVOY_ARRIVED', week, polityId: p.id, legionId: l.id, personnel: convoy.personnel,
        message: convoy.kind === 'SUPPLY_ONLY' ? '原国库存补给在实际运输后抵达同一原军团，没有增加人员或恢复士气，旧伤亡继续保留。' : '原国有限后备和补给在实际运输后抵达，旧伤亡没有消失。' });
    }
  }
  if (!active(s)) return;
  for (const cfg of RED_PRIEST_CAMPAIGN_POLITIES) {
    const p = s.polities[cfg.id], deployed = Object.values(s.legions).filter(l => l.polityId === p.id && l.mobilized && !l.retreated && l.personnel > 0);
    if (deployed.length === 0) continue;
    const due = LIMITS.weeklyTreasury * deployed.length, paid = spendTreasury(s, p.id, due);
    p.transportLoads += deployed.length; p.livelihoodLoss += 1;
    for (const l of deployed) {
      const supply = spendSupply(l, LIMITS.weeklySupply);
      if (supply < LIMITS.weeklySupply || paid < due) {
        const actual = losses(l, 12); l.morale = Math.max(0, l.morale - 5);
        events.push({ type: 'ATTRITION', week, polityId: p.id, legionId: l.id, personnel: actual,
          message: '实际断粮或国库不足造成持续减员，等待不会重置军团。' });
      }
    }
    events.push({ type: 'UPKEEP', week, polityId: p.id, treasurySpent: paid, supplySpent: deployed.length,
      message: `${cfg.name}支付本周军费，运输与居民生计继续受影响。` });
  }
  if (s.warStarted === null) return;
  for (const cfg of RED_PRIEST_CAMPAIGN_NODES) {
    const n = s.nodes[cfg.id];
    if (n.enemyAdvanced || cfg.owner === 'feysac' || week - s.warStarted.week < cfg.enemyAdvanceAfter) continue;
    const enemy = s.legions[cfg.opponentId], old = s.legions[cfg.originalDefenderId];
    if (!enemy.mobilized || enemy.retreated || enemy.personnel === 0 || enemy.supply < 6 || s.polities.feysac.treasury < 200) continue;
    const paid = spendTreasury(s, 'feysac', 200); spendSupply(enemy, 6); s.polities.feysac.transportLoads += 1;
    const lost = losses(old, 40); old.retreated = true; old.location = 'rear'; old.morale = Math.max(0, old.morale - 20);
    n.defenderLosses += lost; n.controller = 'feysac'; n.currentDefenderId = enemy.id; n.enemyAdvanced = true;
    n.facilityIntegrity -= 5; n.supplyIntegrity -= 8; enemy.location = cfg.id; displace(s, cfg.id, 40);
    events.push({ type: 'OCCUPATION', week, nodeId: cfg.id, legionId: enemy.id, polityId: 'feysac', treasurySpent: paid,
      from: 'rear', to: cfg.id, message: `${cfg.name}的原守备受损撤离，弗萨克军团实际占据原设施。` });
  }
}
function ceaseMobilization(s: RedPriestCampaignState): void {
  for (const l of Object.values(s.legions)) l.mobilized = false;
}
function apply(s0: RedPriestCampaignState, c: RedPriestCampaignCommand, h: RedPriestCampaignHost): Extract<RedPriestCampaignResult, { ok: true }> {
  const s = clone(s0), settlement = cost(s, c, h), events: RedPriestCampaignEvent[] = [], week = h.week;
  switch (c.type) {
    case 'ENABLE_PLANNING':
      s.planning = { version: 1, enabledEventId: h.eventId, enabledWeek: week, recon: null, selection: null };
      events.push({ type: 'PLANNING', week, message: '你在发动命令之前明确采用战前筹划；侦察、补给与部署只影响之后实际执行的会战。' }); break;
    case 'RECONNOITRE':
      s.planning!.recon = preparationBinding(s, c.nodeId, h);
      for (const l of fieldArmy(s)) {
        const paid = spendTreasury(s, l.polityId, RED_PRIEST_BATTLE_PLANNING.recon.treasury);
        const supplied = spendSupply(l, RED_PRIEST_BATTLE_PLANNING.recon.supply);
        events.push({ type: 'RECONNAISSANCE', week, nodeId: c.nodeId, polityId: l.polityId, legionId: l.id,
          treasurySpent: paid, supplySpent: supplied, message: `${RED_PRIEST_CAMPAIGN_LEGIONS.find(cfg => cfg.id === l.id)!.name}实际参与本节点侦察，原国库支付${paid}、原军补给消耗${supplied}；另经过一周并照常支付军费与补给。` });
      }
      break;
    case 'SELECT_BATTLE_PLAN':
      s.planning!.selection = { ...preparationBinding(s, c.nodeId, h), stance: c.stance, extraSupplies: c.extraSupplies };
      if (c.stance === 'PROTECTIVE') {
        for (const l of fieldArmy(s)) {
          const paid = spendTreasury(s, l.polityId, RED_PRIEST_BATTLE_PLANNING.protective.treasury);
          events.push({ type: 'PREPARATION', week, nodeId: c.nodeId, polityId: l.polityId, legionId: l.id, treasurySpent: paid,
            message: `${RED_PRIEST_CAMPAIGN_LEGIONS.find(cfg => cfg.id === l.id)!.name}由原国库支付${paid}进行护持部署；实际经过一周，另付现有军费与补给，过去伤亡不会恢复。` });
        }
      } else events.push({ type: 'PREPARATION', week, nodeId: c.nodeId,
        message: c.stance === 'COORDINATED' ? '你选择三支原军团协同部署；执行会战前仍须按实际在场兵员与士气重新核验。' : '你选择常规部署，本次不获得协同或护持修正。' });
      events.push({ type: 'PREPARATION', week, nodeId: c.nodeId,
        message: c.extraSupplies ? '你承诺在本次会战额外投入每支原军6份补给；开战时检查并实际扣除，只用于本次。' : '本次会战不额外投入补给。' });
      break;
    case 'MILITARY_LABOUR':
      spendTreasury(s, 'loen', 60); s.labour.lastWeek = week; s.labour.completed += 1; s.labour.earned += 60;
      events.push({ type: 'LABOUR', week, polityId: 'loen', treasurySpent: 60,
        message: `${RED_PRIEST_CAMPAIGN_LABOUR_TASKS.find(t => t.id === c.taskId)!.title}已实际完成；鲁恩支付60便士劳务报酬，个人生活费与旧债仍照常结算。` }); break;
    case 'REQUEST_AUTHORITY': {
      const p = s.polities[c.polityId], granted = ally(c.polityId) && success(h.receipt!);
      p.authority = granted ? 'GRANTED' : 'REFUSED'; p.authorizationEventId = granted ? h.eventId : null;
      events.push({ type: 'AUTHORITY', week, polityId: p.id, message: granted ? '本国正式授予你此次有限战争的军团指挥权。' : '本国拒绝此次委托，不能把接触或旧互助关系当作授权。' }); break;
    }
    case 'RELEASE_AUTHORITY': {
      const p = s.polities[c.polityId]; p.authority = 'RELEASED';
      for (const l of Object.values(s.legions).filter(l => l.polityId === p.id)) { l.mobilized = false; l.retreated = true; l.location = 'rear'; }
      events.push({ type: 'AUTHORITY', week, polityId: p.id, message: '你交还该方指挥权，原军团退出联合行动，过去的损耗仍保留。' }); break;
    }
    case 'DECLARE_OFFENSIVE':
      s.phase = 'ORDERED'; s.declaration = { eventId: h.eventId, week, authorities: [...RED_PRIEST_CAMPAIGN_COALITION] };
      s.opponentDisposition = 'MOBILIZED'; mobilize(s, events, week);
      events.push({ type: 'DECLARATION', week, message: '你以三份实际授权签发发动命令；战争仍须由跨境行动与首次真实交战开始。' }); break;
    case 'MARCH': {
      const from = s.location, to = c.nodeId;
      for (const l of fieldArmy(s)) { spendSupply(l, LIMITS.marchSupply); l.location = to; s.polities[l.polityId].transportLoads += 1; }
      s.location = to;
      if (from === 'loen-headquarters' && to === 'northern-pass' && s.firstCrossBorder === null)
        s.firstCrossBorder = { eventId: h.eventId, week, from, to };
      events.push({ type: 'MARCH', week, nodeId: to, from, to, travelWeeks: settlement.travelWeeks,
        message: `${route(from, to)!.label}：本人和已获授权的原军团实际行军，运输与补给分别扣除。` }); break;
    }
    case 'RETURN_TO_HEADQUARTERS': {
      const from = s.location;
      const returnRoute = [...RED_PRIEST_CAMPAIGN_ROUTES.slice(0, RED_PRIEST_CAMPAIGN_ROUTES.findIndex(r => r.to === from) + 1)
        .reverse().map(r => nodeContent(r.to).name), '鲁恩联合协商处'].join(' → ');
      s.location = 'loen-headquarters'; s.lastSafeLocation = 'loen-headquarters';
      for (const l of fieldArmy(s)) l.location = s.location;
      // The shared elapsed-week pulse below pays each military upkeep exactly
      // once and retains ordinary convoy, attrition and enemy-advance effects.
      events.push({ type: 'MARCH', week, from, to: s.location, travelWeeks: settlement.travelWeeks,
        message: `${returnRoute}：本人和原军团按完整路线返回总部；逐周支付军费与补给，原战争和委托继续保留，个人工资与生活费用仍由正常周结算处理。` }); break;
    }
    case 'REST_FIELD_ARMIES': {
      const rest = RED_PRIEST_HEADQUARTERS_REST;
      for (const l of fieldArmy(s)) {
        const paid = spendTreasury(s, l.polityId, rest.treasury), supplied = spendSupply(l, rest.supply);
        const gain = Math.min(rest.morale, Math.max(0, rest.maximumMorale - l.morale)); l.morale += gain;
        events.push({ type: 'REST', week, polityId: l.polityId, legionId: l.id,
          treasurySpent: paid, supplySpent: supplied, moraleGain: gain,
          message: `${RED_PRIEST_CAMPAIGN_LEGIONS.find(cfg => cfg.id === l.id)!.name}在总部实际休整${rest.weeks}周：原国库支出${paid}、原军补给消耗${supplied}，士气恢复${gain}至${l.morale}；另照常结算两周军费与补给，原伤亡和后备不恢复。` });
      }
      break;
    }
    case 'BATTLE': case 'PREPARED_BATTLE': {
      const preparation = c.type === 'PREPARED_BATTLE' ? getRedPriestCampaignPlanPreview(s, c.nodeId) : null;
      const n = s.nodes[c.nodeId], defender = s.legions[n.currentDefenderId], won = success(h.receipt!);
      if (s.warStarted === null) { s.warStarted = { eventId: h.eventId, receiptId: h.receipt!.id, week }; s.phase = 'WAR';
        events.push({ type: 'WAR_STARTED', week, nodeId: n.id, message: '你签发命令后的首次跨境会战实际发生，危机由此成为大陆战争。' }); }
      n.battleCount += 1;
      for (const l of fieldArmy(s)) { spendSupply(l, preparation?.battleSupplyPerArmy ?? LIMITS.battleSupply); n.coalitionLosses += losses(l, won ? preparation?.victoryLossPerArmy ?? LIMITS.victoryLoss : preparation?.defeatLossPerArmy ?? LIMITS.defeatLoss); l.morale = won ? Math.min(100, l.morale + 2) : Math.max(0, l.morale - 36); }
      n.defenderLosses += losses(defender, won ? 380 : 130); defender.morale = Math.max(0, defender.morale - (won ? 40 : 5));
      n.facilityIntegrity = Math.max(0, n.facilityIntegrity - (won ? 8 : 16)); n.supplyIntegrity = Math.max(0, n.supplyIntegrity - (won ? 10 : 18)); displace(s, n.id, won ? preparation?.victoryDisplaced ?? 60 : preparation?.defeatDisplaced ?? 100);
      if (won) {
        n.controller = 'coalition'; n.victory = { eventId: h.eventId, receiptId: h.receipt!.id, week, defenderId: defender.id };
        defender.retreated = true; defender.location = 'rear';
        events.push({ type: 'RETREAT', week, polityId: 'feysac', legionId: defender.id, nodeId: n.id, from: n.id, to: 'rear', personnel: defender.personnel, message: '原守军余部带着既有伤亡退走，没有复制新的敌军。' });
        if (Object.values(s.nodes).filter(x => x.victory !== null).length >= LIMITS.independentVictories) s.opponentDisposition = 'RETREATING';
      } else {
        settlement.toLocation = s.lastSafeLocation; s.location = s.lastSafeLocation;
        for (const l of fieldArmy(s)) l.location = s.location;
        events.push({ type: 'RETREAT', week, nodeId: n.id, from: n.id, to: s.location,
          ...(settlement.travelWeeks > 1 ? { travelWeeks: settlement.travelWeeks } : {}),
          message: settlement.travelWeeks > 1 ? `会战失利，本人和原军团沿实际退路经过${settlement.travelWeeks}周退回已确保的地点，军费、补给和断粮损耗照常结算，原伤亡和损坏不回滚。` : '会战失利，原军团与本人退回已确保的地点，伤亡和损坏不回滚。' });
      }
      if (s.planning) {
        s.planning.recon = null; s.planning.selection = null;
        events.push({ type: 'PREPARATION', week, nodeId: n.id,
          message: `本次会战已实际使用所选筹划，准备修正${preparation?.effectiveBonus ?? 0}；侦察与部署就此消耗，额外补给不退还，也不带入下一战。` });
      }
      events.push({ type: 'BATTLE', week, nodeId: n.id, message: won ? '本次真实会战取胜；设施尚须实地巩固，才能形成持续控制。' : '本次真实会战失利，有限后备必须由原国库出资并跨周运来。' }); break;
    }
    case 'CONSOLIDATE': {
      const n = s.nodes[c.nodeId]; n.consolidated = true; s.lastSafeLocation = n.id;
      for (const l of fieldArmy(s)) spendSupply(l, LIMITS.consolidateSupply);
      const sheltered = Math.min(80, n.displaced); n.displaced -= sheltered; n.evacuated += sheltered;
      const p = s.polities[nodeContent(n.id).owner]; p.displacedResidents -= sheltered; p.evacuatedResidents += sheltered;
      events.push({ type: 'CONSOLIDATION', week, nodeId: n.id, personnel: sheltered, message: '你确认原设施、补给线与实际驻守，并把已离家的居民转入保护安置；战损不会修复如新。' }); break;
    }
    case 'REORGANIZE': {
      const p = s.polities[c.polityId], l = fieldFor(s, c.polityId);
      const paid = spendTreasury(s, p.id, LIMITS.convoyTreasury); p.reservePersonnel -= LIMITS.convoyPersonnel; p.reservesCommitted += LIMITS.convoyPersonnel;
      p.supplyReserve -= LIMITS.convoySupply; p.suppliesCommitted += LIMITS.convoySupply; p.transportLoads += 1;
      s.convoys.push({ id: h.eventId, polityId: c.polityId, legionId: l.id, orderedWeek: week, arrivalWeek: week + LIMITS.convoyWeeks,
        personnel: LIMITS.convoyPersonnel, supply: LIMITS.convoySupply, status: 'IN_TRANSIT' });
      events.push({ type: 'CONVOY_ORDERED', week, polityId: p.id, legionId: l.id, treasurySpent: paid, personnel: LIMITS.convoyPersonnel,
        message: '本国支付整补运输费用，有限后备和粮秣已经离库，尚未抵达军团。' }); break;
    }
    case 'SUPPLY_ONLY': {
      const p = s.polities[c.polityId], l = fieldFor(s, c.polityId), convoy = RED_PRIEST_SUPPLY_ONLY_CONVOY;
      const paid = spendTreasury(s, p.id, convoy.treasury);
      p.supplyReserve -= convoy.supply; p.suppliesCommitted += convoy.supply; p.transportLoads += 1;
      s.convoys.push({ id: h.eventId, polityId: c.polityId, legionId: l.id, orderedWeek: week,
        arrivalWeek: week + convoy.weeks, personnel: 0, supply: convoy.supply, status: 'IN_TRANSIT', kind: 'SUPPLY_ONLY' });
      events.push({ type: 'CONVOY_ORDERED', week, polityId: p.id, legionId: l.id, treasurySpent: paid, personnel: 0,
        message: `本国支付${paid}军费，将原库存${convoy.supply}份补给装运；${convoy.weeks}周后抵达，不投入后备兵员，也不恢复士气。` }); break;
    }
    case 'SEEK_ARMISTICE':
      if (success(h.receipt!)) { s.phase = 'ARMISTICE'; s.opponentDisposition = 'CEASEFIRE'; ceaseMobilization(s); }
      events.push({ type: 'ARMISTICE', week, polityId: 'feysac', message: success(h.receipt!) ? '弗萨克接受停战，四方停止本次动员；既有控制、损失与居民去向继续保留。' : '停战协商未获接受，已有军团和居民仍承受实际战争后果。' }); break;
    case 'WITHDRAW_PROTECT':
      for (const l of fieldArmy(s).filter(x => x.mobilized)) {
        const paid = spendTreasury(s, l.polityId, LIMITS.weeklyTreasury * settlement.weeks);
        const supplied = spendSupply(l, LIMITS.weeklySupply * settlement.weeks);
        if (supplied < settlement.weeks) losses(l, (settlement.weeks - supplied) * 12);
        s.polities[l.polityId].transportLoads += settlement.weeks;
        events.push({ type: 'UPKEEP', week, polityId: l.polityId, treasurySpent: paid, supplySpent: supplied,
          message: '原军团沿实际返程路线撤护，返程军费与补给继续消耗。' });
      }
      for (const cfg of RED_PRIEST_CAMPAIGN_NODES) {
        const n = s.nodes[cfg.id], people = n.displaced; n.displaced = 0; n.evacuated += people;
        s.polities[cfg.owner].displacedResidents -= people; s.polities[cfg.owner].evacuatedResidents += people;
        if (n.controller === 'coalition') { n.controller = cfg.owner; n.consolidated = false; }
      }
      s.phase = 'WITHDRAWN'; s.opponentDisposition = 'HOLDING'; s.location = 'loen-headquarters'; ceaseMobilization(s);
      for (const l of fieldArmy(s)) { l.retreated = true; l.location = 'rear'; }
      events.push({ type: 'WITHDRAWAL', week, from: settlement.fromLocation, to: s.location, travelWeeks: settlement.travelWeeks,
        message: '你取消继续进攻，组织原军团与已迁离居民撤护；仍保留序列1，旧伤亡和费用不会退回。' }); break;
    case 'WAIT': events.push({ type: 'WAIT', week, message: '实际经过一周，运输、军费与补给按现状继续结算。' }); break;
  }
  for (let elapsed = 1; elapsed <= settlement.weeks; elapsed += 1) pulse(s, week + elapsed, events);
  // An ended operation returns every not-yet-delivered convoy in the same atomic
  // settlement. It cannot arrive later into a terminated army or be duplicated.
  if (!active(s) && (s.phase === 'ARMISTICE' || s.phase === 'WITHDRAWN')) {
    for (const convoy of s.convoys.filter(v => v.status === 'IN_TRANSIT')) {
      convoy.status = 'RETURNED'; const p = s.polities[convoy.polityId];
      p.reservePersonnel += convoy.personnel; p.reservesCommitted -= convoy.personnel;
      p.supplyReserve += convoy.supply; p.suppliesCommitted -= convoy.supply;
      events.push({ type: 'CONVOY_RETURNED', week: week + settlement.weeks, polityId: p.id, message: '未投入的后备随运输队返还原国，已付运输费仍保留。' });
    }
  }
  invalidatePreparation(s, events, week + settlement.weeks);
  s.week = week + settlement.weeks; s.revision += 1;
  s.journal.push({ command: clone(c), host: clone(h), settlement: clone(settlement), events: clone(events) });
  return { ok: true, state: s, settlement, events };
}
/** Host must atomically commit returned state, deductions, elapsed calendar weeks,
 * campaign location and events. On rollback retain the entire previous host and
 * campaign; on success do not also tick an independent campaign clock. */
export function reduceRedPriestCampaign(s: RedPriestCampaignState, command: unknown, host: RedPriestCampaignHost): RedPriestCampaignResult {
  const reason = getRedPriestCampaignBlock(s, command, host);
  if (reason) return { ok: false, block: reason };
  const c = command as RedPriestCampaignCommand, receiptReason = receiptBlock(s, c, host);
  if (receiptReason) return { ok: false, block: receiptReason };
  const result = apply(s, c, host);
  if (!structurallyValid(result.state)) return { ok: false, block: block('INVALID_TRANSITION', '战役结算未能通过资源与来源检查。') };
  return result;
}
/** Private host bookkeeping, never a renderer command. Ordinary calendar
 * advancement was already paid and applied by the host, so weeks/actions/cash
 * here are zero. This updates only the original military world and its source
 * history; it neither charges nor advances the player's calendar a second time. */
function hostOperationBlock(s: RedPriestCampaignState, h: RedPriestCampaignHost, closingOrElapsed = false): RedPriestCampaignBlock | null {
  if (!structurallyValid(s)) return block('INVALID_STATE', '战役记录需要重新核验。');
  if (!validHost(h) || h.receipt !== undefined) return block('INVALID_HOST', '主机时间或人物来源无效。');
  if (s.journal.some(e => e.host.eventId === h.eventId)) return block('REPEATED_EVENT', '此次主机结算已经登记。');
  if (s.journal.length >= LIMITS.maxEntries && !closingOrElapsed) return block('ENTRY_LIMIT', '战役记录已到上限。');
  return null;
}
function finishHostOperation(s: RedPriestCampaignState, command: CampaignHostOperation, h: RedPriestCampaignHost, events: RedPriestCampaignEvent[]): RedPriestCampaignResult {
  const settlement: RedPriestCampaignSettlement = { cash: 0, cashGain: 0, spirituality: 0, health: 0, mind: 0, actions: 0,
    weeks: 0, travelWeeks: 0, fromLocation: s.location, toLocation: s.location, risk: 'NONE', receiptId: null };
  invalidatePreparation(s, events, h.week);
  s.week = h.week; s.revision += 1;
  s.journal.push({ command: clone(command), host: clone(h), settlement: clone(settlement), events: clone(events) });
  return structurallyValid(s) ? { ok: true, state: s, settlement, events }
    : { ok: false, block: block('INVALID_TRANSITION', '主机军务结算未能通过守恒检查。') };
}
export function advanceRedPriestCampaignToWeek(s0: RedPriestCampaignState, host: RedPriestCampaignHost): RedPriestCampaignResult {
  const reason = hostOperationBlock(s0, host, true); if (reason) return { ok: false, block: reason };
  if (host.week <= s0.week || host.week - s0.week > 260) return { ok: false, block: block('INVALID_TIME_ADVANCE', '须登记实际经过的有限周数，不能倒退或重复登记。') };
  const s = clone(s0), events: RedPriestCampaignEvent[] = [];
  for (let week = s.week + 1; week <= host.week; week += 1) pulse(s, week, events);
  events.push({ type: 'WAIT', week: host.week, message: '普通生活与旅程真实经过的周数已同步到原军团和在途运输。' });
  return finishHostOperation(s, { type: 'HOST_ADVANCE', toWeek: host.week }, host, events);
}
/** Six actual people leave the one existing Loen regiment for the bounded S0
 * rescue. They are held in detached, never cloned into another army. The three
 * existing patients remain in wounded; transporting them does not heal them. */
export function dispatchRedPriestCampaignDetachment(s0: RedPriestCampaignState, host: RedPriestCampaignHost,
  request: { legionId: CampaignLegionId; personnel: number }): RedPriestCampaignResult {
  const reason = hostOperationBlock(s0, host); if (reason) return { ok: false, block: reason };
  if (host.week !== s0.week) return { ok: false, block: block('WEEK_MISMATCH', '须先同步实际周数。') };
  if (!record(request) || !exact(request, ['legionId','personnel']) || request.legionId !== 'loen-expedition' || request.personnel !== 6)
    return { ok: false, block: block('INVALID_DETACHMENT', '本次救援仅由鲁恩原军团的六人小队承担。') };
  if (!host.player.alive || host.player.health === 0 || host.player.pathwayId !== 'hunter' || host.player.sequence !== 0
    || s0.phase !== 'ARMISTICE' || s0.polities.loen.authority !== 'GRANTED')
    return { ok: false, block: block('DETACHMENT_NOT_AUTHORIZED', '须由存活的红祭司在停战和原委托仍有效时主持此次救援。') };
  const legion = s0.legions[request.legionId];
  if (s0.detachments.length > 0) return { ok: false, block: block('DETACHMENT_ALREADY_USED', '原六人小队已投入过这次有限救援，不能重新生成。') };
  if (host.player.campaignLocation !== s0.location || legion.location !== s0.location || s0.location === 'loen-headquarters'
    || !s0.nodes[s0.location].consolidated) return { ok: false, block: block('DETACHMENT_NOT_PRESENT', '本人和原军团须实际同处已巩固的停战节点。') };
  if (legion.personnel < 6 || legion.wounded < 3 || legion.supply < 2) return { ok: false, block: block('DETACHMENT_RESOURCES', '原团必须尚有六名在役人员、三名原伤员和有限补给。') };
  const s = clone(s0), original = s.legions[request.legionId]; original.personnel -= 6; original.detached += 6; spendSupply(original, 2);
  s.detachments.push({ id: host.eventId, legionId: original.id, originalPersonnel: 6, location: s.location,
    status: 'DEPLOYED', killed: 0, wounded: 0, returned: 0 });
  return finishHostOperation(s, { type: 'DETACHMENT_DISPATCH', legionId: original.id, personnel: 6 }, host,
    [{ type: 'DETACHMENT', week: host.week, legionId: original.id, personnel: 6, supplySpent: 2,
      message: '原军团的六名在役人员实际编入本次救援小队；三名原伤员保留各自原伤，并未新增或治愈。' }]);
}
/** Called only with casualty counts derived from the kernel's actual check and
 * survivor ledger. Death of the player must not skip accounting for these same
 * six people. A public command cannot supply this operation or its casualties. */
export function settleRedPriestCampaignDetachment(s0: RedPriestCampaignState, host: RedPriestCampaignHost,
  request: { detachmentId: string; killed: number; wounded: number }): RedPriestCampaignResult {
  const reason = hostOperationBlock(s0, host, true); if (reason) return { ok: false, block: reason };
  if (host.week !== s0.week) return { ok: false, block: block('WEEK_MISMATCH', '须先同步实际周数。') };
  if (!record(request) || !exact(request, ['detachmentId','killed','wounded']) || !textId(request.detachmentId)
    || !integer(request.killed) || !integer(request.wounded)) return { ok: false, block: block('INVALID_DETACHMENT_SETTLEMENT', '小队伤亡须来自本次实际结算。') };
  const found = s0.detachments.find(d => d.id === request.detachmentId);
  if (!found || found.status !== 'DEPLOYED' || request.killed + request.wounded > found.originalPersonnel)
    return { ok: false, block: block('INVALID_DETACHMENT_SETTLEMENT', '不能增加人员、重复归队或超过原小队人数。') };
  const s = clone(s0), d = s.detachments.find(x => x.id === found.id)!, l = s.legions[d.legionId];
  d.killed = request.killed; d.wounded = request.wounded; d.returned = d.originalPersonnel - d.killed - d.wounded; d.status = 'RETURNED';
  l.detached -= d.originalPersonnel; l.personnel += d.returned; l.killed += d.killed; l.wounded += d.wounded;
  return finishHostOperation(s, { type: 'DETACHMENT_SETTLE', ...request }, host,
    [{ type: 'DETACHMENT', week: host.week, legionId: l.id, personnel: d.returned,
      message: `原小队结算：${d.returned}人归队，${d.wounded}人负伤，${d.killed}人死亡；原团总账已记录，伤亡不能在重试中复原。` }]);
}

/** Full deterministic load-boundary verification. No public skip/verified flag.
 * Supply actual host receipts to additionally authenticate the journal against
 * the host's own resolver history. Replay verifies state provenance, not a
 * cryptographic signature; private host evidence is the trust root. */
export function verifyRedPriestCampaignState(value: unknown, authoritativeReceipts?: readonly RedPriestCampaignReceipt[]): value is RedPriestCampaignState {
  if (!record(value) || !structurallyValid(value as unknown as RedPriestCampaignState)) return false;
  const s = value as unknown as RedPriestCampaignState;
  try {
    let rebuilt = createRedPriestCampaign(s.origin.runId, s.origin.startWeek);
    for (const entry of s.journal) {
      if (!record(entry) || !exact(entry, ['command','host','settlement','events'])) return false;
      if (entry.host.receipt && authoritativeReceipts && !authoritativeReceipts.some(r => same(r, entry.host.receipt))) return false;
      let result: RedPriestCampaignResult;
      switch (entry.command.type) {
        case 'HOST_ADVANCE':
          if (entry.command.toWeek !== entry.host.week) return false;
          result = advanceRedPriestCampaignToWeek(rebuilt, entry.host); break;
        case 'DETACHMENT_DISPATCH': result = dispatchRedPriestCampaignDetachment(rebuilt, entry.host, { legionId: entry.command.legionId, personnel: entry.command.personnel }); break;
        case 'DETACHMENT_SETTLE': result = settleRedPriestCampaignDetachment(rebuilt, entry.host, { detachmentId: entry.command.detachmentId, killed: entry.command.killed, wounded: entry.command.wounded }); break;
        default: result = reduceRedPriestCampaign(rebuilt, entry.command, entry.host);
      }
      if (!result.ok || !same(result.settlement, entry.settlement) || !same(result.events, entry.events)) return false;
      rebuilt = result.state;
    }
    return same(rebuilt, s);
  } catch { return false; }
}
export function deriveRedPriestCampaignAchievement(s: RedPriestCampaignState) {
  const victories = RED_PRIEST_CAMPAIGN_NODES.filter(n => s.nodes[n.id].victory !== null).map(n => n.id);
  const controlledTheaters = RED_PRIEST_CAMPAIGN_THEATERS.filter(t => RED_PRIEST_CAMPAIGN_NODES.some(n => n.theaterId === t.id && s.nodes[n.id].victory !== null && s.nodes[n.id].consolidated && s.nodes[n.id].controller === 'coalition')).map(t => t.id);
  const engagedTheaters = RED_PRIEST_CAMPAIGN_THEATERS.filter(t => RED_PRIEST_CAMPAIGN_NODES.some(n => n.theaterId === t.id && s.nodes[n.id].battleCount > 0)).map(t => t.id);
  const participatingPolities = RED_PRIEST_CAMPAIGN_POLITIES.filter(p => s.polities[p.id].mobilizedPersonnel > 0 && s.polities[p.id].treasurySpent > 0 && s.polities[p.id].transportLoads > 0 && s.polities[p.id].livelihoodLoss > 0).map(p => p.id);
  const withdrawalEvidence = Object.values(s.nodes).filter(n => n.victory !== null && s.legions[n.victory.defenderId].retreated).map(n => n.victory!.defenderId);
  const achieved = s.declaration !== null && s.firstCrossBorder !== null && s.warStarted !== null
    && victories.length >= LIMITS.independentVictories && controlledTheaters.length === LIMITS.requiredTheaters
    && engagedTheaters.length === LIMITS.requiredTheaters && participatingPolities.length === 4
    && withdrawalEvidence.length >= LIMITS.independentVictories && s.phase !== 'WITHDRAWN'
    && (s.opponentDisposition === 'RETREATING' || s.opponentDisposition === 'CEASEFIRE');
  return { achieved, independentVictories: victories, controlledTheaters, engagedTheaters, participatingPolities,
    withdrawalEvidence, declaredByPlayer: s.declaration !== null, firstCrossBorderExecuted: s.firstCrossBorder !== null,
    firstBattleExecuted: s.warStarted !== null, ceased: s.phase === 'ARMISTICE' };
}
/** Deliberately omits private receipts, host budgets, journal, difficulty and
 * hidden source markers. Player prose never exposes implementation labels. */
export function projectRedPriestCampaign(s: RedPriestCampaignState) {
  const achievement = deriveRedPriestCampaignAchievement(s);
  return { title: '北大陆有限战争', story: RED_PRIEST_CAMPAIGN_STORY, phase: s.phase,
    week: s.week, elapsedWeeks: s.week - s.origin.startWeek,
    mobilizationWeeks: s.declaration === null ? 0 : s.week - s.declaration.week,
    mobilizationReview: active(s) && s.declaration !== null && s.week - s.declaration.week >= LIMITS.reviewAfterWeeks,
    mobilizationNotice: active(s) && s.declaration !== null && s.week - s.declaration.week >= LIMITS.reviewAfterWeeks
      ? '动员已持续很久，须按现有国库、兵员与补给决定整补、停战或撤护；旧损失不会恢复。' : null,
    location: s.location,
    ...(s.planning ? { planning: { enabled: true as const,
      recon: s.planning.recon ? { nodeId: s.planning.recon.nodeId,
        defenderName: RED_PRIEST_CAMPAIGN_LEGIONS.find(l => l.id === s.planning!.recon!.defenderId)!.name, week: s.planning.recon.week } : null,
      selection: s.planning.selection ? { nodeId: s.planning.selection.nodeId, stance: s.planning.selection.stance,
        extraSupplies: s.planning.selection.extraSupplies, week: s.planning.selection.week } : null } } : {}),
    locationName: s.location === 'loen-headquarters' ? '鲁恩联合协商处' : nodeContent(s.location).name,
    opponentDisposition: s.opponentDisposition,
    polities: RED_PRIEST_CAMPAIGN_POLITIES.map(p => {
      const { authorizationEventId: _privateSource, ...visible } = s.polities[p.id];
      return { name: p.name, direction: p.direction, residents: p.residents, ...clone(visible) };
    }),
    legions: RED_PRIEST_CAMPAIGN_LEGIONS.map(l => ({ name: l.name, role: l.role, ...clone(s.legions[l.id]) })),
    theaters: RED_PRIEST_CAMPAIGN_THEATERS.map(t => ({ id: t.id, name: t.name, geography: t.geography,
      engaged: achievement.engagedTheaters.includes(t.id), controlled: achievement.controlledTheaters.includes(t.id),
      nodes: RED_PRIEST_CAMPAIGN_NODES.filter(n => n.theaterId === t.id).map(n => ({ id: n.id, name: n.name, owner: n.owner, facility: n.facility,
        originalDefender: RED_PRIEST_CAMPAIGN_LEGIONS.find(l => l.id === n.originalDefenderId)!.name,
        controller: s.nodes[n.id].controller, consolidated: s.nodes[n.id].consolidated, won: s.nodes[n.id].victory !== null,
        facilityIntegrity: s.nodes[n.id].facilityIntegrity, supplyIntegrity: s.nodes[n.id].supplyIntegrity,
        battles: s.nodes[n.id].battleCount, coalitionLosses: s.nodes[n.id].coalitionLosses, defenderLosses: s.nodes[n.id].defenderLosses,
        displaced: s.nodes[n.id].displaced, evacuated: s.nodes[n.id].evacuated, civilianDeaths: s.nodes[n.id].civilianDeaths })) })),
    labour: { lastWeek: s.labour.lastWeek, completed: s.labour.completed, earned: s.labour.earned,
      nextTask: RED_PRIEST_CAMPAIGN_LABOUR_TASKS[s.labour.completed % RED_PRIEST_CAMPAIGN_LABOUR_TASKS.length]! },
    detachments: clone(s.detachments),
    convoys: s.convoys.map(c => ({ polityId: c.polityId, arrivalWeek: c.arrivalWeek, personnel: c.personnel, supply: c.supply, status: c.status })),
    achievement: { achieved: achievement.achieved, victories: achievement.independentVictories.length,
      requiredVictories: LIMITS.independentVictories, controlledTheaters: achievement.controlledTheaters.length,
      engagedTheaters: achievement.engagedTheaters.length, participatingPolities: achievement.participatingPolities.length,
      initiated: achievement.declaredByPlayer && achievement.firstCrossBorderExecuted && achievement.firstBattleExecuted,
      ceased: achievement.ceased },
    lastEvents: s.journal.at(-1)?.events.map(e => e.message) ?? [],
    nextStep: s.phase === 'CRISIS' ? '分别取得三方委托，再明确签发发动命令。'
      : s.phase === 'ORDERED' ? '亲自带领原军团跨境，并执行第一次真实会战。'
      : s.phase === 'ARMISTICE' || s.phase === 'WITHDRAWN' ? '战事已停，原有损失和经历继续保留。'
      : achievement.achieved ? '三战区实际战争已经留下完整经历，可选择停战并保留结果。'
      : '沿实际路线行军、会战与巩固；兵员不足时动用有限后备，随时可保护撤离。',
  };
}
export type RedPriestCampaignProjection = ReturnType<typeof projectRedPriestCampaign>;
