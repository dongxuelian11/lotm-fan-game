import type { PublicCheckResult } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import { stableStringify } from '../canonical.js';
import { validateFoolSource, type FoolSource } from './source.js';
import { FATE_COMMISSIONS, FATE_CONTENT_VERSION, FATE_ORIGIN, FATE_PURSUIT_TABLE } from './fate-content.js';
import {
  createFateRecovery,
  evaluateFate, fateCaseJournalDigest, fateOriginalsDigest, validateFate,
  validateFateRecovery, createFateReplayCursor, createFateRecoveryReplayCursor,
  type FateAuthority, type FateBodyHealth, type FateCommand, type FateConsequence, type FateCost,
  type FateHostReceipt, type FateInitial, type FatePlace, type FatePublicView,
  type FateRecoveryAuthority, type FateRecoveryInitial, type FateRecoveryReceipt,
  type FateRecoveryState, type FateResources, type FateState, type FateTransition,
  type FateWorldFact, type FateReplayCursor, type FateRecoveryReplayCursor,
} from './fate.js';

/** Host-owned introduction event. Obtain from the central immutable world ledger, never incoming save. */
export interface FoolFateOrigin {
  runId: string; actorId: string; worldSourceSecond: number;
  worldSourceReceipt: string; inheritedTerminalReceipt: string;
  independentUniquenessCustodyReceipt: string;
}
export interface FoolFateMaterial {
  id: string; commissionId: FateInitial['commissionId']; kind: 'INSPECTION' | 'PREPARATION';
  pricePennies: 4 | 12; holder: 'MERCHANT' | 'PLAYER' | 'CONSUMED';
  purchasedByReceipt: string | null; consumedByReceipt: string | null;
}
type WithoutId<T> = T extends { id: string } ? Omit<T, 'id'> : never;
export type FoolFateHostCommand =
  | { id: string; type: 'ENTER_FIRST_CASE' }
  | { id: string; type: 'BUY_KIT'; itemId: string }
  | { id: string; type: 'CASE'; action: WithoutId<Exclude<FateCommand, { type: 'ADVANCE_WORLD' }>> }
  | { id: string; type: 'INVESTIGATE_RECOVERY'; commissionId: FateInitial['commissionId'] }
  | { id: string; type: 'VERIFY_RECOVERY'; commissionId: FateInitial['commissionId'] }
  | { id: string; type: 'SYNC_WORLD' };
/** A narrow projection of existing SliceState. It is not another character/resource ledger. */
export interface FoolFateHostContext {
  receiptId: string; ledgerRevision: string; expectedRevision: number;
  at: number; week: number;
  actorId: string; actorAlive: boolean; actorConscious: boolean;
  bodyHealth: FateBodyHealth;
  actionPoints: number; spirituality: number; mental: number; pennies: number;
  /** Central movement system verifies access; never infer access from opening a panel. */
  access: 'CANAL_APPROACH' | 'AT_CURRENT_CASE' | 'ELSEWHERE';
  otherComplexGraftActive: boolean;
  /** Exact standard ctx.check('knowledge', 20) result and real cursor references. */
  check?: { id: string; result: PublicCheckResult; rngBeforeRef: string; rngAfterRef: string };
  worldFacts: readonly FateWorldFact[];
  /** Real original checks completed at at+60; no NPC assertion or UI checkbox. */
  recoveryChecks?: FateRecoveryReceipt['checks'];
}
export interface FoolFateHostReceipt { command: FoolFateHostCommand; context: FoolFateHostContext; }
export interface FoolFateHostState {
  version: 1;
  registry: FateRecoveryInitial;
  cases: Record<string, { entryAt: number; state: FateState }>;
  currentCaseId: string | null;
  recovery: FateRecoveryState;
  inventory: FoolFateMaterial[];
  receipts: FoolFateHostReceipt[];
  /** Last synchronized absolute world second, not an independently ticking clock. */
  now: number;
}
export interface FoolFateHostAuthority {
  origin: FoolFateOrigin;
  /** Count from central committed history, never from the incoming state's own length. */
  committedReceiptCount: number;
  originIsAuthentic: (origin: FoolFateOrigin) => boolean;
  /** Exact central historical/pending command+context bytes; never simply `() => true`. */
  receiptIsAuthentic: (receipt: FoolFateHostReceipt) => boolean;
}
export interface FoolFateHostTransition {
  ok: boolean; state: FoolFateHostState; blockedReason?: string;
  cost: FateCost; elapsedSeconds: number; caughtUpSeconds: number;
  consequences: FateConsequence[];
  positions?: FateTransition['positions'];
  enteredCaseId?: string;
}
interface ReplayEnvironment {
  domain: Map<string, FateHostReceipt>;
  recovery: Map<string, FateRecoveryReceipt>;
  cases: Map<string, FateReplayCursor>;
  recoveryCursor: FateRecoveryReplayCursor;
}
function createReplayEnvironment(state: FoolFateHostState): ReplayEnvironment {
  return { domain: new Map(), recovery: new Map(), cases: new Map(),
    recoveryCursor: createFateRecoveryReplayCursor(state.registry, { initial: state.registry, receiptIsAuthentic: () => false, priorCases: [] }) };
}
function forkReplayEnvironment(env: ReplayEnvironment): ReplayEnvironment {
  return { domain: new Map([...env.domain].map(([id, receipt]) => [id, clone(receipt)])),
    recovery: new Map([...env.recovery].map(([id, receipt]) => [id, clone(receipt)])),
    cases: new Map([...env.cases].map(([id, cursor]) => [id, cursor.fork()])), recoveryCursor: env.recoveryCursor.fork() };
}
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const canonical = (v: unknown): string => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  const record = v as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(k => `${JSON.stringify(k)}:${canonical(record[k])}`).join(',')}}`;
};
const equal = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);
const integer = (n: number): boolean => Number.isSafeInteger(n);
const emptyCost = (): FateCost => ({ actionPoints: 0, spirituality: 0, mental: 0, pennies: 0, consumedItemIds: [] });
const fail = (s: FoolFateHostState, reason: string): FoolFateHostTransition => ({ ok: false, state: s, blockedReason: reason, cost: emptyCost(), elapsedSeconds: 0, caughtUpSeconds: 0, consequences: [] });

/** The only registry constructor. Three authored originals derive from one trusted occurrence anchor. */
export function buildFoolFateRegistry(origin: FoolFateOrigin): FateRecoveryInitial {
  if (!integer(origin.worldSourceSecond) || origin.worldSourceSecond < 0 || [origin.runId, origin.actorId, origin.worldSourceReceipt, origin.inheritedTerminalReceipt, origin.independentUniquenessCustodyReceipt].some(s => typeof s !== 'string' || !s.trim())) throw new Error('F208_HOST_INVALID_ORIGIN');
  const id = (suffix: string): string => `${origin.runId}:${suffix}`;
  const commissions: FateInitial[] = FATE_COMMISSIONS.map((c, index): FateInitial => {
    const serial = index + 1;
    return {
      version: FATE_CONTENT_VERSION, runId: origin.runId, commissionId: c.id, instanceId: id(c.id), actorId: origin.actorId,
      availableAt: origin.worldSourceSecond + 300,
      originals: {
        boatId: id(c.boat), crateId: id(c.crate), ownerId: id(c.owner), saddleId: id(c.saddle), wellId: id(c.well),
        sealId: id(`F208-SEAL-${serial}`), cargoIds: [id(`F208-CARGO-${serial}-A`), id(`F208-CARGO-${serial}-B`)],
        commercialRegisterReceipt: `${origin.worldSourceReceipt}/${c.commissionSource}`,
        boatContinuityReceipt: `${origin.worldSourceReceipt}/original-boat-${serial}`,
        crateContinuityReceipt: `${origin.worldSourceReceipt}/original-crate-${serial}`,
      },
      crew: [
        { id: id(`F208-CREW-${serial}-A`), bodyId: id(`F208-BODY-${serial}-A`), adult: true, willingToEvacuate: true },
        { id: id(`F208-CREW-${serial}-B`), bodyId: id(`F208-BODY-${serial}-B`), adult: true, willingToEvacuate: true },
      ],
      binding: {
        id: id(c.binding), createdAt: origin.worldSourceSecond + 10 + index * 10,
        originReceipt: `${origin.worldSourceReceipt}/high-order-binding-${serial}`,
        artifactId: FATE_ORIGIN.artifactId, mechanism: FATE_ORIGIN.mechanism, provenanceKind: FATE_ORIGIN.provenanceKind,
        chainVersion: FATE_ORIGIN.chainVersion, channelId: id(`F208-CHANNEL-${serial}`),
        boatId: id(c.boat), crateId: id(c.crate), saddleId: id(c.saddle),
        clockRule: 'FIRST_REAL_DEPARTURE_PLUS_180_SECONDS', lockedOutcome: 'ORIGINAL_STRUCTURE_BROKEN',
        contribution: 40, structuralFailureAt: 35, pursuitTable: clone(FATE_PURSUIT_TABLE),
      },
      preexistingTrace: { receipt: `${origin.worldSourceReceipt}/physical-trace-${serial}`, recordedAt: origin.worldSourceSecond + 12 + index * 10, saddleId: id(c.saddle), measuredLoad: 4, tetherId: id(`F208-INBOARD-TETHER-${serial}`) },
      well: { capacity: 40, integrity: 'SOUND', occupants: [] },
      independentUniquenessCustodyReceipt: origin.independentUniquenessCustodyReceipt,
    };
  });
  return { runId: origin.runId, registeredAt: origin.worldSourceSecond + 120, commissions };
}
function baseState(authority: FoolFateHostAuthority): FoolFateHostState {
  if (!authority.originIsAuthentic(authority.origin)) throw new Error('F208_HOST_UNAUTHENTIC_ORIGIN');
  const registry = buildFoolFateRegistry(authority.origin);
  const recoveryAuthority: FateRecoveryAuthority = { initial: registry, receiptIsAuthentic: () => false, priorCases: [] };
  const inventory: FoolFateMaterial[] = [];
  for (const c of registry.commissions) for (const kind of ['INSPECTION', 'PREPARATION'] as const) for (const serial of [1, 2]) inventory.push({
    id: `${c.instanceId}:${kind}-KIT-${serial}`, commissionId: c.commissionId, kind,
    pricePennies: kind === 'INSPECTION' ? 4 : 12, holder: 'MERCHANT', purchasedByReceipt: null, consumedByReceipt: null,
  });
  return { version: 1, registry, cases: {}, currentCaseId: null, recovery: createFateRecovery(registry, recoveryAuthority), inventory, receipts: [], now: registry.registeredAt };
}
export function createFoolFateHostState(authority: FoolFateHostAuthority): FoolFateHostState {
  if (authority.committedReceiptCount !== 0) throw new Error('F208_HOST_ALREADY_HAS_COMMITTED_HISTORY');
  return baseState(authority);
}
function domainAuthority(s: FoolFateHostState, caseId: string, env: ReplayEnvironment): FateAuthority {
  const initial = s.registry.commissions.find(i => i.instanceId === caseId);
  const entry = s.cases[caseId];
  if (!initial || !entry) throw new Error('F208_HOST_UNKNOWN_ORIGINAL_CASE');
  return { initial, entryAt: entry.entryAt, instanceAlreadyRegistered: true, receiptIsAuthentic: r => equal(env.domain.get(r.id), r) };
}
function recoveryAuthority(s: FoolFateHostState, env: ReplayEnvironment): FateRecoveryAuthority {
  return { initial: s.registry, receiptIsAuthentic: r => equal(env.recovery.get(r.id), r), priorCases: Object.entries(s.cases).map(([id, entry]) => ({ state: entry.state, authority: domainAuthority(s, id, env) })) };
}
function resources(s: FoolFateHostState, c: FoolFateHostContext): FateResources {
  const initial = s.currentCaseId ? s.registry.commissions.find(i => i.instanceId === s.currentCaseId) : undefined;
  const owned = s.inventory.filter(i => i.holder === 'PLAYER' && i.commissionId === initial?.commissionId);
  return { actionPoints: c.actionPoints, spirituality: c.spirituality, mental: c.mental, pennies: c.pennies,
    inspectionKits: owned.filter(i => i.kind === 'INSPECTION').map(i => i.id), preparationKits: owned.filter(i => i.kind === 'PREPARATION').map(i => i.id) };
}
function makeDomainReceipt(s: FoolFateHostState, c: FoolFateHostContext, command: FateCommand, suffix: string, facts: readonly FateWorldFact[]): FateHostReceipt {
  const entry = s.currentCaseId ? s.cases[s.currentCaseId] : undefined;
  if (!entry) throw new Error('F208_HOST_NO_CURRENT_CASE');
  return { id: `${c.receiptId}:${suffix}`, ledgerRevision: c.ledgerRevision, commandId: command.id, command: clone(command), expectedRevision: entry.state.journal.length,
    now: entry.state.scene.now, actorId: c.actorId, actorAlive: c.actorAlive, actorConscious: c.actorConscious,
    bodyHealth: clone(c.bodyHealth), resources: resources(s, c), otherComplexGraftActive: c.otherComplexGraftActive, worldFacts: clone(facts),
    ...(command.type === 'GRAFT' && c.check ? { check: { id: c.check.id, actorId: c.actorId, ability: 'S1_PHYSICAL_GRAFT' as const, skill: 'KNOWLEDGE' as const, result: clone(c.check.result), rngBeforeRef: c.check.rngBeforeRef, rngAfterRef: c.check.rngAfterRef } } : {}),
  };
}
function domainStep(s: FoolFateHostState, c: FoolFateHostContext, command: FateCommand, suffix: string, facts: readonly FateWorldFact[], env: ReplayEnvironment): FateTransition {
  const id = s.currentCaseId!;
  const receipt = makeDomainReceipt(s, c, command, suffix, facts);
  env.domain.set(receipt.id, clone(receipt));
  const result = env.cases.get(id)!.advance(command, receipt, domainAuthority(s, id, env));
  if (result.ok) { s.cases[id]!.state = result.state; s.now = result.state.scene.now; }
  return result;
}
function enter(s: FoolFateHostState, initial: FateInitial, at: number, env: ReplayEnvironment): void {
  if (s.cases[initial.instanceId]) throw new Error('F208_HOST_ORIGINAL_CASE_ALREADY_REGISTERED');
  const authority: FateAuthority = { initial, entryAt: at, instanceAlreadyRegistered: false, receiptIsAuthentic: r => equal(env.domain.get(r.id), r) };
  const cursor = createFateReplayCursor(initial, authority); env.cases.set(initial.instanceId, cursor);
  s.cases[initial.instanceId] = { entryAt: at, state: cursor.snapshot() };
  s.currentCaseId = initial.instanceId; s.now = at;
}
function basicBlock(s: FoolFateHostState, command: FoolFateHostCommand, c: FoolFateHostContext, origin: FoolFateOrigin): string | null {
  if (!command.id || !c.receiptId || !c.ledgerRevision || c.expectedRevision !== s.receipts.length || c.actorId !== origin.actorId || !integer(c.at) || c.at < s.now || !integer(c.week)) return 'HOST_CONTEXT_OR_REVISION_MISMATCH';
  if (!c.bodyHealth || !integer(c.bodyHealth.actor) || c.bodyHealth.actor < 0 || c.bodyHealth.actor > 100 || !c.bodyHealth.crew ||
    !s.registry.commissions.flatMap(i => i.crew).every(p => integer(c.bodyHealth.crew[p.id]!) && c.bodyHealth.crew[p.id]! >= 0 && c.bodyHealth.crew[p.id]! <= 100) ||
    c.actorAlive !== (c.bodyHealth.actor > 0)) return 'AUTHENTIC_CENTRAL_BODY_HEALTH_REQUIRED';
  if (![c.actionPoints, c.spirituality, c.mental, c.pennies].every(v => integer(v) && v >= 0)) return 'INVALID_ORIGINAL_RESOURCE_SNAPSHOT';
  if (s.receipts.some(r => r.command.id === command.id || r.context.receiptId === c.receiptId)) return 'HOST_COMMAND_ALREADY_COMMITTED';
  if (command.type !== 'SYNC_WORLD' && (!c.actorAlive || !c.actorConscious)) return 'ORIGINAL_PLAYER_CANNOT_ACT';
  if (command.type !== 'SYNC_WORLD' && c.access === 'ELSEWHERE') return 'ACTUAL_CANAL_ACCESS_REQUIRED';
  if (command.type === 'ENTER_FIRST_CASE' && c.access !== 'CANAL_APPROACH') return 'CONFIRMED_FOG_BASE_APPROACH_REQUIRED';
  const current = s.currentCaseId ? s.cases[s.currentCaseId]!.state : null;
  if (command.type !== 'SYNC_WORLD' && current && !(current.phase === 'CLOSED' && (current.scene.bellOccurred || !current.scene.departed)) && c.at !== s.now) return 'SYNC_WORLD_BEFORE_PLAYER_ACTION';
  if (command.type === 'ENTER_FIRST_CASE' && (s.currentCaseId || Object.keys(s.cases).length)) return 'ORIGINAL_FIRST_CASE_ALREADY_EXISTS';
  if (command.type !== 'ENTER_FIRST_CASE' && command.type !== 'SYNC_WORLD' && !s.currentCaseId) return 'ENTER_ORIGINAL_FIRST_CASE_FIRST';
  return null;
}
function reduce(s0: FoolFateHostState, command: FoolFateHostCommand, c: FoolFateHostContext, env: ReplayEnvironment, authority: FoolFateHostAuthority, preview = false): FoolFateHostTransition {
  const blocked = basicBlock(s0, command, c, authority.origin); if (blocked) return fail(s0, blocked);
  const s = clone(s0), cost = emptyCost(), consequences: FateConsequence[] = [];
  let positions: FateTransition['positions'] | undefined;
  const caughtUpSeconds = c.at - s.now;
  const pending = s.currentCaseId ? s.cases[s.currentCaseId]!.state : null;
  const beforeFacts = c.worldFacts.filter(f => f.at <= c.at);
  const actionFacts = c.worldFacts.filter(f => f.at > c.at);
  if (pending && !(pending.phase === 'CLOSED' && (pending.scene.bellOccurred || !pending.scene.departed))) {
    const delta = c.at - pending.scene.now;
    if (delta < 0) return fail(s0, 'WORLD_CLOCK_CANNOT_REWIND');
    if (delta || beforeFacts.length) {
      const tick: FateCommand = { id: `${command.id}:catch-up`, type: 'ADVANCE_WORLD', seconds: delta };
      const r = domainStep(s, c, tick, 'catch-up', beforeFacts, env);
      if (!r.ok) return fail(s0, r.blockedReason ?? 'CATCH_UP_BLOCKED');
      consequences.push(...r.consequences); positions = r.positions;
    }
  } else if (beforeFacts.length) return fail(s0, 'CLOSED_CASE_FACTS_BELONG_IN_CENTRAL_POSTCASE_LEDGER');
  s.now = c.at;
  let elapsedSeconds = 0, enteredCaseId: string | undefined;
  const active = s.currentCaseId ? s.cases[s.currentCaseId]!.state : null;
  if (command.type === 'ENTER_FIRST_CASE') {
    if (c.worldFacts.length) return fail(s0, 'ENTER_FIRST_THEN_RECORD_ACTUAL_SCENE_FACTS');
    const first = s.registry.commissions[0]!;
    if (c.at < first.availableAt) return fail(s0, 'ORIGINAL_COMMERCIAL_REGISTER_NOT_YET_AVAILABLE');
    elapsedSeconds = 20; enter(s, first, c.at + 20, env); enteredCaseId = first.instanceId;
  }
  if (command.type === 'BUY_KIT') {
    if (!active || active.scene.departed || active.scene.actorPlace !== 'BERTH') return fail(s0, 'BUY_REAL_KITS_AT_BERTH_BEFORE_DEPARTURE');
    const item = s.inventory.find(i => i.id === command.itemId);
    if (!item || item.holder !== 'MERCHANT' || item.commissionId !== active.instance.initial.commissionId) return fail(s0, 'NO_SUCH_UNSPENT_MERCHANT_ITEM');
    if (c.pennies < item.pricePennies) return fail(s0, 'INSUFFICIENT_CASH_FOR_REAL_KIT');
    cost.pennies = item.pricePennies; elapsedSeconds = 10;
    item.holder = 'PLAYER'; item.purchasedByReceipt = c.receiptId;
    const paidContext = { ...c, pennies: c.pennies - cost.pennies };
    const r = domainStep(s, paidContext, { id: `${command.id}:purchase-time`, type: 'ADVANCE_WORLD', seconds: 10 }, 'purchase-time', actionFacts, env);
    if (!r.ok) return fail(s0, r.blockedReason ?? 'PURCHASE_TIME_BLOCKED');
    consequences.push(...r.consequences); positions = r.positions;
  }
  if (command.type === 'CASE') {
    if (!active || c.access !== 'AT_CURRENT_CASE') return fail(s0, 'ACTUAL_CURRENT_CASE_ACCESS_REQUIRED');
    if ((command.action as { type: string }).type === 'ADVANCE_WORLD') return fail(s0, 'INTERNAL_WORLD_ADVANCE_IS_NOT_A_PLAYER_ACTION');
    const inner = { ...command.action, id: `${command.id}:case-action` } as FateCommand;
    const receipt = makeDomainReceipt(s, c, inner, 'case-action', actionFacts);
    const reason = env.cases.get(s.currentCaseId!)!.block(inner, receipt);
    if (reason) return fail(s0, reason);
    if (preview) return { ok: true, state: s0, cost, elapsedSeconds: 0, caughtUpSeconds, consequences: [] };
    const r = domainStep(s, c, inner, 'case-action', actionFacts, env);
    if (!r.ok) return fail(s0, r.blockedReason ?? 'CASE_ACTION_BLOCKED');
    Object.assign(cost, r.cost); elapsedSeconds = r.elapsedSeconds; consequences.push(...r.consequences); positions = r.positions;
    for (const id of r.cost.consumedItemIds) {
      const item = s.inventory.find(i => i.id === id);
      if (!item || item.holder !== 'PLAYER') return fail(s0, 'REAL_MATERIAL_NOT_OWNED_OR_ALREADY_CONSUMED');
      item.holder = 'CONSUMED'; item.consumedByReceipt = c.receiptId;
    }
  }
  if (command.type === 'INVESTIGATE_RECOVERY' || command.type === 'VERIFY_RECOVERY') {
    if (!active || active.phase !== 'CLOSED' || !active.scene.bellOccurred) return fail(s0, 'SETTLE_AND_LEAVE_ORIGINAL_CASE_BEFORE_RECOVERY');
    if (actionFacts.length) return fail(s0, 'NEW_RECOVERY_FACTS_REQUIRE_THE_NEW_ORIGINAL_CASE');
    const target = s.registry.commissions.find(i => i.commissionId === command.commissionId);
    if (!target) return fail(s0, 'NO_FOURTH_OR_GENERATED_COMMISSION');
    elapsedSeconds = 60;
    const r: FateRecoveryReceipt = {
      id: `${c.receiptId}:recovery`, type: command.type === 'INVESTIGATE_RECOVERY' ? 'INVESTIGATE' : 'VERIFY', targetCommissionId: command.commissionId,
      week: c.week, now: c.at + elapsedSeconds, actorId: c.actorId, actorAlive: c.actorAlive, penniesAvailable: c.pennies,
      previousCaseId: active.instance.id, previousCaseJournalDigest: fateCaseJournalDigest(active),
      ...(command.type === 'VERIFY_RECOVERY' && c.recoveryChecks ? { checks: clone(c.recoveryChecks) } : {}),
    };
    if (preview && command.type === 'VERIFY_RECOVERY' && !r.checks) r.checks = { registerReceipt: target.originals.commercialRegisterReceipt, boatContinuityReceipt: target.originals.boatContinuityReceipt, crateContinuityReceipt: target.originals.crateContinuityReceipt, originReceipt: target.binding.originReceipt, originalsDigest: fateOriginalsDigest(target), inspectedAt: c.at + 60 };
    env.recovery.set(r.id, clone(r));
    const result = env.recoveryCursor.advance(r, { initial: s.registry, receiptIsAuthentic: receipt => equal(env.recovery.get(receipt.id), receipt) }, [...env.cases.values()]);
    if (!result.ok) return fail(s0, result.blockedReason ?? 'RECOVERY_BLOCKED');
    s.recovery = result.state; cost.pennies = result.penniesSpent;
    if (result.eligibleInitial && result.eligibleEntryAt !== undefined) { enter(s, result.eligibleInitial, result.eligibleEntryAt, env); enteredCaseId = result.eligibleInitial.instanceId; }
  }
  if (command.type === 'SYNC_WORLD' && actionFacts.length) return fail(s0, 'WORLD_SYNC_CANNOT_COMMIT_UNREACHED_FUTURE_FACTS');
  s.now = c.at + elapsedSeconds;
  s.receipts.push({ command: clone(command), context: clone(c) });
  if (!positions && s.currentCaseId) {
    const scene = s.cases[s.currentCaseId]!.state.scene, initial = s.cases[s.currentCaseId]!.state.instance.initial;
    positions = { actor: scene.actorPlace, boat: scene.boatPlace, crate: { boatId: initial.originals.boatId, slot: scene.crateSlot }, crew: scene.crew.map(x => ({ id: x.id, place: x.place })) };
  }
  return { ok: true, state: s, cost, elapsedSeconds, caughtUpSeconds, consequences, ...(positions ? { positions } : {}), ...(enteredCaseId ? { enteredCaseId } : {}) };
}
function rebuild(input: FoolFateHostState, authority: FoolFateHostAuthority): { state: FoolFateHostState; env: ReplayEnvironment } {
  if (!integer(authority.committedReceiptCount) || input.receipts.length !== authority.committedReceiptCount) throw new Error('F208_HOST_CENTRAL_HISTORY_TRUNCATED_OR_EXTENDED');
  let state = baseState(authority);
  const env = createReplayEnvironment(state);
  for (const receipt of input.receipts) {
    if (!authority.receiptIsAuthentic(receipt)) throw new Error('F208_HOST_UNAUTHENTIC_CENTRAL_HISTORY');
    const r = reduce(state, receipt.command, receipt.context, env, authority);
    if (!r.ok) throw new Error(`F208_HOST_ILLEGAL_REPLAY:${r.blockedReason}`);
    state = r.state;
  }
  if (!equal(state, input)) throw new Error('F208_HOST_REGISTRY_INVENTORY_OR_CASE_CACHE_CHANGED');
  return { state, env };
}
export function validateFoolFateHost(input: FoolFateHostState, authority: FoolFateHostAuthority): { valid: boolean; errors: string[] } {
  try {
    const rebuilt = rebuild(input, authority);
    for (const [id, entry] of Object.entries(rebuilt.state.cases)) if (!validateFate(entry.state, domainAuthority(rebuilt.state, id, rebuilt.env)).valid) throw new Error('F208_HOST_INVALID_CASE');
    const recovery = validateFateRecovery(rebuilt.state.recovery, recoveryAuthority(rebuilt.state, rebuilt.env));
    if (!recovery.valid) throw new Error(recovery.errors.join(','));
    return { valid: true, errors: [] };
  } catch (error) { return { valid: false, errors: [error instanceof Error ? error.message : 'F208_HOST_INVALID_STATE'] }; }
}
/** Internal consumption authority: full host/recovery replay, then exact original case evidence. */
export function evaluateFoolFateRitual(input: FoolFateHostState, authority: FoolFateHostAuthority): {
  caseId: string; verdict: 'VERIFIED_DEVIATION'; evidence: number[]; caseJournalDigest: string;
} | null {
  try {
    const { state, env } = rebuild(input, authority);
    if (!validateFateRecovery(state.recovery, recoveryAuthority(state, env)).valid) return null;
    for (const original of state.registry.commissions) {
      const entry = state.cases[original.instanceId];
      if (!entry) continue;
      const proof = evaluateFate(entry.state, domainAuthority(state, original.instanceId, env));
      if (proof.verdict === 'VERIFIED_DEVIATION') return { caseId: original.instanceId, verdict: proof.verdict, evidence: [...proof.evidence], caseJournalDigest: fateCaseJournalDigest(entry.state) };
    }
    return null;
  } catch { return null; }
}
export function blockFoolFateHostCommand(state: FoolFateHostState, command: FoolFateHostCommand, context: FoolFateHostContext, authority: FoolFateHostAuthority): string | null {
  try { const r = rebuild(state, authority); const result = reduce(r.state, command, context, r.env, authority, true); return result.ok ? null : result.blockedReason ?? 'F208_HOST_BLOCKED'; }
  catch (error) { return error instanceof Error ? error.message : 'F208_HOST_INVALID_STATE'; }
}
export function transitionFoolFateHost(state: FoolFateHostState, command: FoolFateHostCommand, context: FoolFateHostContext, authority: FoolFateHostAuthority): FoolFateHostTransition {
  try {
    const rebuilt = rebuild(state, authority);
    if (!authority.receiptIsAuthentic({ command, context })) return fail(state, 'F208_HOST_UNAUTHENTIC_CURRENT_TRANSACTION');
    return reduce(rebuilt.state, command, context, rebuilt.env, authority);
  } catch (error) { return fail(state, error instanceof Error ? error.message : 'F208_HOST_INVALID_STATE'); }
}
export interface FoolFateHostPublicAction { command: FoolFateHostCommand; label: string; recommended: boolean; enabled: boolean; reason?: string; seconds: number; costText: string; }
export interface FoolFateHostPublicView {
  actions: FoolFateHostPublicAction[];
  /** Central movement must spend these real seconds before changing fog location back to base. */
  returnToBase: { from: FatePlace; seconds: 20 } | null;
  currentCase: FatePublicView | null;
  availablePurchases: { id: string; label: string; pennies: number; enabled: boolean }[];
  recovery: { commissionId: FateInitial['commissionId']; label: string; investigationPaid: boolean; canVerifyFromWeek: number | null; used: boolean }[];
  previousResults: { title: string; verdict: string; originalDamageRetained: boolean }[];
  entry: { label: string; enabled: boolean; seconds: 20 } | null;
}
export function projectFoolFateHost(input: FoolFateHostState, context: FoolFateHostContext, authority: FoolFateHostAuthority): FoolFateHostPublicView {
  const { state, env } = rebuild(input, authority);
  return projectOwnedFoolFateHost(state, env, context, authority);
}
function projectOwnedFoolFateHost(s: FoolFateHostState, env: ReplayEnvironment, context: FoolFateHostContext, authority: FoolFateHostAuthority): FoolFateHostPublicView {
  const current = s.currentCaseId ? s.cases[s.currentCaseId]!.state : null;
  if (current && !(current.phase === 'CLOSED' && (current.scene.bellOccurred || !current.scene.departed)) && context.at !== s.now) throw new Error('SYNC_WORLD_BEFORE_PUBLIC_PROJECTION');
  const currentCase = current ? env.cases.get(s.currentCaseId!)!.project({ now: current.scene.now, actorId: context.actorId, actorAlive: context.actorAlive, actorConscious: context.actorConscious, bodyHealth: context.bodyHealth, resources: resources(s, context), otherComplexGraftActive: context.otherComplexGraftActive }) : null;
  const actions: FoolFateHostPublicAction[] = [];
  const actionId = (suffix: string): string => `F208-HOST:${s.receipts.length}:${suffix}`;
  if (!current) actions.push({ command: { id: actionId('enter'), type: 'ENTER_FIRST_CASE' }, label: '前往原商运泊位', recommended: true, enabled: context.actorAlive && context.actorConscious && context.access === 'CANAL_APPROACH' && context.at >= s.registry.commissions[0]!.availableAt, seconds: 20, costText: '步行20秒，不花行动' });
  else if (currentCase && current.phase !== 'CLOSED') {
    for (const a of currentCase.actions) {
      let action: WithoutId<Exclude<FateCommand, { type: 'ADVANCE_WORLD' }>>;
      if (a.type === 'INSPECT_CONSTRAINT' || a.type === 'PREPARE_ENDPOINTS') {
        const kind = a.type === 'INSPECT_CONSTRAINT' ? 'INSPECTION' : 'PREPARATION';
        const item = s.inventory.find(i => i.commissionId === current.instance.initial.commissionId && i.kind === kind && i.holder === 'PLAYER');
        const buy = s.inventory.find(i => i.commissionId === current.instance.initial.commissionId && i.kind === kind && i.holder === 'MERCHANT');
        if (!item && buy && a.recommended) { actions.push({ command: { id: actionId('buy'), type: 'BUY_KIT', itemId: buy.id }, label: kind === 'INSPECTION' ? '购买勘验耗材' : '购买两端定位耗材', recommended: true, enabled: context.pennies >= buy.pricePennies && context.actorAlive && context.actorConscious, seconds: 10, costText: `${buy.pricePennies}便士，10秒` }); continue; }
        action = a.type === 'INSPECT_CONSTRAINT' ? { type: 'INSPECT_CONSTRAINT', branch: 'SHIELD_MAIN', kitId: item?.id ?? '' } : { type: 'PREPARE_ENDPOINTS', kitId: item?.id ?? '' };
      } else if (a.type === 'TRANSIT') action = { type: 'TRANSIT', route: 'MAIN' };
      else if (a.type === 'RESCUE') action = { type: 'RESCUE', crewId: a.crewId! };
      else if (a.type === 'WAIT') action = { type: 'WAIT', seconds: a.seconds };
      else action = { type: a.type };
      actions.push({ command: { id: actionId(a.type), type: 'CASE', action }, label: a.label, recommended: a.recommended, enabled: a.enabled && context.access === 'AT_CURRENT_CASE', ...(a.blockedReason ? { reason: a.blockedReason } : {}), seconds: a.seconds, costText: a.type === 'GRAFT' ? '1行动，8灵性；成功2精神／失败4精神，施术前至少4精神' : `${a.cost.actionPoints}行动，${a.seconds}秒` });
    }
    currentCase.actions = []; // Render the merged action list once, not duplicate panels of buttons.
  } else if (current && env.cases.get(s.currentCaseId!)!.evaluate().verdict !== 'VERIFIED_DEVIATION' && current.scene.actorAlive) {
    const target = s.registry.commissions.slice(1).find(i => !s.cases[i.instanceId]);
    if (target) {
      const paid = s.recovery.journal.find(r => r.type === 'INVESTIGATE' && r.targetCommissionId === target.commissionId);
      const command: FoolFateHostCommand = { id: actionId('recovery'), type: paid ? 'VERIFY_RECOVERY' : 'INVESTIGATE_RECOVERY', commissionId: target.commissionId };
      const reason = blockOwnedFoolFateHost(s, env, command, context, authority);
      actions.push({ command, label: paid ? '核实另一份原商运委托' : '付费调查另一份原委托', recommended: true, enabled: reason === null, ...(reason ? { reason: paid && context.week < paid.week + 1 ? '至少隔一游戏周才能独立核实。' : '尚缺真实资源、旧案结算或原物核验条件。' } : {}), seconds: 60, costText: paid ? '60秒，原船箱与货主须实地核实' : '18便士，60秒；隔周再核实' });
    }
  }
  return {
    actions: actions.slice(0, 3),
    returnToBase: context.actorAlive && context.actorConscious && current && (!current.scene.departed || current.scene.bellOccurred) && ['BERTH', 'REFUGE', 'DOCK'].includes(current.scene.actorPlace) ? { from: current.scene.actorPlace, seconds: 20 } : null,
    currentCase,
    availablePurchases: s.inventory.filter(i => i.holder === 'MERCHANT' && i.commissionId === current?.instance.initial.commissionId).map(i => ({ id: i.id, label: i.kind === 'INSPECTION' ? '购买勘验耗材' : '购买两端定位耗材', pennies: i.pricePennies, enabled: !!current && !current.scene.departed && current.scene.actorPlace === 'BERTH' && context.pennies >= i.pricePennies })),
    recovery: s.registry.commissions.slice(1).map(i => {
      const investigation = s.recovery.journal.find(r => r.type === 'INVESTIGATE' && r.targetCommissionId === i.commissionId);
      return { commissionId: i.commissionId, label: FATE_COMMISSIONS.find(c => c.id === i.commissionId)!.label, investigationPaid: !!investigation, canVerifyFromWeek: investigation ? investigation.week + 1 : null, used: !!s.cases[i.instanceId] };
    }),
    previousResults: Object.entries(s.cases).filter(([id]) => id !== s.currentCaseId).map(([id, entry]) => ({ title: FATE_COMMISSIONS.find(c => c.id === entry.state.instance.initial.commissionId)!.label, verdict: env.cases.get(id)!.evaluate().verdict, originalDamageRetained: entry.state.scene.everDamaged })),
    entry: current ? null : { label: '前往原商运泊位', enabled: context.actorAlive && context.actorConscious && context.access === 'CANAL_APPROACH' && context.at >= s.registry.commissions[0]!.availableAt, seconds: 20 },
  };
}

/** Retains only source-verified original state and real sequential reductions.
 * The source is checked independently here; no caller-supplied prepared state or
 * authority callback can mint the host cursor. Every draft owns forked maps and
 * nested cursors, so failed catch-up, preview, and recovery cannot leak changes. */
export interface FoolFateHostReplayCursor {
  snapshot(): FoolFateHostState;
  matches(candidate: unknown): boolean;
  fork(): FoolFateHostReplayCursor;
  block(command: FoolFateHostCommand, context: FoolFateHostContext, authority: FoolFateHostAuthority): string | null;
  advance(command: FoolFateHostCommand, context: FoolFateHostContext, authority: FoolFateHostAuthority): FoolFateHostTransition;
  project(context: FoolFateHostContext): FoolFateHostPublicView;
  evaluateRitual(): ReturnType<typeof evaluateFoolFateRitual>;
}
export function createFoolFateHostReplayCursor(source: FoolSource, archivedS1: SliceState): FoolFateHostReplayCursor {
  try { stableStringify(source); stableStringify(archivedS1); } catch { throw new Error('F208_HOST_SOURCE_REPLAY_REQUIRED'); }
  const original = structuredClone(source), archived = structuredClone(archivedS1);
  if (!validateFoolSource(archived, original)) throw new Error('F208_HOST_SOURCE_REPLAY_REQUIRED');
  const origin: FoolFateOrigin = { runId: original.runId, actorId: original.actorId, worldSourceSecond: 0,
    worldSourceReceipt: `F208-RELIC-WORLD:${original.worldDigest}`, inheritedTerminalReceipt: `F208-S1:${original.sourceHistoryDigest}`,
    independentUniquenessCustodyReceipt: original.materialsOrigin.uniquenessCustody.at(-1)!.id };
  const authority = ownedHostAuthority(origin, []), state = createFoolFateHostState(authority);
  return ownFoolFateHostReplayCursor(origin, state, createReplayEnvironment(state));
}
function ownedHostAuthority(origin: FoolFateOrigin, receipts: readonly FoolFateHostReceipt[]): FoolFateHostAuthority {
  const values = new Map(receipts.map(receipt => [receipt.context.receiptId, receipt]));
  return { origin: clone(origin), committedReceiptCount: receipts.length, originIsAuthentic: candidate => equal(candidate, origin),
    receiptIsAuthentic: receipt => equal(values.get(receipt.context.receiptId), receipt) };
}
function blockOwnedFoolFateHost(state: FoolFateHostState, env: ReplayEnvironment, command: FoolFateHostCommand, context: FoolFateHostContext, authority: FoolFateHostAuthority): string | null {
  try { const result = reduce(state, clone(command), clone(context), forkReplayEnvironment(env), authority, true); return result.ok ? null : result.blockedReason ?? 'F208_HOST_BLOCKED'; }
  catch (error) { return error instanceof Error ? error.message : 'F208_HOST_INVALID_STATE'; }
}
function ownFoolFateHostReplayCursor(original: FoolFateOrigin, initial: FoolFateHostState, environment: ReplayEnvironment): FoolFateHostReplayCursor {
  const origin = clone(original); let state = initial, env = environment;
  const requireAuthority = (authority: FoolFateHostAuthority): void => {
    if (!equal(authority.origin, origin) || !authority.originIsAuthentic(clone(origin))) throw new Error('F208_HOST_UNAUTHENTIC_ORIGIN');
    if (!integer(authority.committedReceiptCount) || authority.committedReceiptCount !== state.receipts.length) throw new Error('F208_HOST_CENTRAL_HISTORY_TRUNCATED_OR_EXTENDED');
  };
  return Object.freeze({
    snapshot: () => clone(state),
    matches: (candidate: unknown) => { try { return equal(state, candidate); } catch { return false; } },
    fork: () => ownFoolFateHostReplayCursor(origin, clone(state), forkReplayEnvironment(env)),
    block: (command: FoolFateHostCommand, context: FoolFateHostContext, authority: FoolFateHostAuthority): string | null => {
      try { requireAuthority(authority); return blockOwnedFoolFateHost(state, env, command, context, authority); }
      catch (error) { return error instanceof Error ? error.message : 'F208_HOST_INVALID_STATE'; }
    },
    advance: (command: FoolFateHostCommand, context: FoolFateHostContext, authority: FoolFateHostAuthority): FoolFateHostTransition => {
      try {
        requireAuthority(authority); const c = clone(command), h = clone(context);
        if (!authority.receiptIsAuthentic({ command: clone(c), context: clone(h) })) return clone(fail(state, 'F208_HOST_UNAUTHENTIC_CURRENT_TRANSACTION'));
        const candidateEnv = forkReplayEnvironment(env), next = reduce(state, c, h, candidateEnv, authority), result = clone(next);
        if (next.ok) { state = next.state; env = candidateEnv; }
        return result;
      } catch (error) { return clone(fail(state, error instanceof Error ? error.message : 'F208_HOST_INVALID_STATE')); }
    },
    project: (context: FoolFateHostContext) => clone(projectOwnedFoolFateHost(state, env, clone(context), ownedHostAuthority(origin, state.receipts))),
    evaluateRitual: (): ReturnType<typeof evaluateFoolFateRitual> => {
      for (const original of state.registry.commissions) {
        const cursor = env.cases.get(original.instanceId); if (!cursor) continue;
        const proof = cursor.evaluate();
        if (proof.verdict === 'VERIFIED_DEVIATION') return { caseId: original.instanceId, verdict: proof.verdict, evidence: [...proof.evidence], caseJournalDigest: fateCaseJournalDigest(state.cases[original.instanceId]!.state) };
      }
      return null;
    },
  });
}
