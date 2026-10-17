/** Directed owned-prefix differential tests. These do not alter or replace the
 * frozen natural capture, and do not claim to be a natural campaign. */
import { beforeAll, describe, expect, it } from 'vitest';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { createFoolReplayOrigin, deriveFoolMaterialHost, type FoolMaterialCommandReplayFrame } from '../../src/domain/fool/material-host.js';
import { createFoolMaterialReplayCursor, applyFoolMaterialCommand } from '../../src/domain/fool/materials.js';
import { createFogReplayCursor, fogProjection, fogActionProjection, fogConsumptionBlock, type FogHostFacts } from '../../src/domain/fool/fog.js';
import { createFoolFateHostReplayCursor, createFoolFateHostState, transitionFoolFateHost, projectFoolFateHost, blockFoolFateHostCommand, evaluateFoolFateRitual, validateFoolFateHost,
  type FoolFateHostAuthority, type FoolFateHostCommand, type FoolFateHostContext, type FoolFateHostReceipt } from '../../src/domain/fool/fate-host.js';
import { createFateReplayCursor, createFateRecoveryReplayCursor, fateCaseJournalDigest, fateOriginalsDigest, type FateReplayCursor } from '../../src/domain/fool/fate.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const same = (a: unknown, b: unknown): void => expect(stableStringify(a)).toBe(stableStringify(b));
let original: SliceState;
let prepared: ReturnType<typeof createFoolReplayOrigin>;
beforeAll(() => {
  original = migrateSliceState(readObjectEntry<unknown>('tests/fixtures/attendant-mysteries-v01860/natural-battle.json', 'final'));
  prepared = createFoolReplayOrigin(original);
}, 60_000);

function fateHarness(cursor = createFoolFateHostReplayCursor(prepared.source, prepared.archived)) {
  const source = prepared.source;
  const origin = { runId: source.runId, actorId: source.actorId, worldSourceSecond: 0, worldSourceReceipt: `F208-RELIC-WORLD:${source.worldDigest}`,
    inheritedTerminalReceipt: `F208-S1:${source.sourceHistoryDigest}`, independentUniquenessCustodyReceipt: source.materialsOrigin.uniquenessCustody.at(-1)!.id };
  const history = new Map<string, FoolFateHostReceipt>();
  const authority: FoolFateHostAuthority = { origin, committedReceiptCount: 0, originIsAuthentic: value => stableStringify(value) === stableStringify(origin), receiptIsAuthentic: value => history.has(value.context.receiptId) && stableStringify(value) === stableStringify(history.get(value.context.receiptId)) };
  let state = createFoolFateHostState(authority), at = 604800, serial = 0, week = source.budget.week;
  let health = { actor: 100, crew: Object.fromEntries(state.registry.commissions.flatMap(c => c.crew).map(p => [p.id, 100])) };
  let actions = 30, cash = 200, spirituality = 50, mental = 40;
  const context = (changes: Partial<FoolFateHostContext> = {}): FoolFateHostContext => ({ receiptId: `cursor-receipt-${++serial}`, ledgerRevision: `cursor-central-${serial}`, expectedRevision: state.receipts.length,
    at, week, actorId: origin.actorId, actorAlive: health.actor > 0, actorConscious: health.actor > 0, bodyHealth: structuredClone(health), actionPoints: actions,
    spirituality, mental, pennies: cash, access: state.currentCaseId ? 'AT_CURRENT_CASE' : 'CANAL_APPROACH', otherComplexGraftActive: false, worldFacts: [], ...changes });
  type WithoutId<T> = T extends { id: string } ? Omit<T, 'id'> : never;
  const perform = (action: WithoutId<FoolFateHostCommand>, changes: Partial<FoolFateHostContext> = {}) => {
    const c = context(changes), command = { ...action, id: `cursor-command-${serial}` } as FoolFateHostCommand;
    if (command.type === 'CASE' && command.action.type === 'GRAFT') c.check = { id: `cursor-check-${serial}`, result: resolveNormalCheck({ ability: 'knowledge', baseAbility: 20, difficulty: 20, modifiers: [], roll: 10 }), rngBeforeRef: `cursor-before-${serial}`, rngAfterRef: `cursor-after-${serial}` };
    const before = cursor.snapshot();
    expect(cursor.block(command, c, authority)).toBe(blockFoolFateHostCommand(state, command, c, authority));
    same(cursor.snapshot(), before);
    history.set(c.receiptId, structuredClone({ command, context: c }));
    const expected = transitionFoolFateHost(state, command, c, authority), actual = cursor.advance(command, c, authority);
    same(actual, expected);
    if (actual.ok) {
      state = expected.state; authority.committedReceiptCount = state.receipts.length; at = state.now; week = c.week;
      actions = c.actionPoints - actual.cost.actionPoints; cash = c.pennies - actual.cost.pennies; spirituality = c.spirituality - actual.cost.spirituality; mental = c.mental - actual.cost.mental;
      health = structuredClone(c.bodyHealth) as typeof health;
      for (const injury of actual.consequences) { if (injury.subjectId === origin.actorId) health.actor = injury.healthAfter; else health.crew[injury.subjectId] = injury.healthAfter; }
    }
    same(cursor.snapshot(), state);
    const projectionContext = context();
    same(cursor.project(projectionContext), projectFoolFateHost(state, projectionContext, authority));
    same(cursor.evaluateRitual(), evaluateFoolFateRitual(state, authority));
    return { actual, c, command };
  };
  const current = () => state.cases[state.currentCaseId!]!.state;
  const enterAndPrepare = () => {
    expect(perform({ type: 'ENTER_FIRST_CASE' }).actual.ok).toBe(true);
    for (const kind of ['INSPECTION', 'PREPARATION'] as const) {
      const item = state.inventory.find(i => i.commissionId === current().instance.initial.commissionId && i.kind === kind && i.holder === 'MERCHANT')!;
      expect(perform({ type: 'BUY_KIT', itemId: item.id }).actual.ok).toBe(true);
      expect(perform({ type: 'CASE', action: kind === 'INSPECTION' ? { type: 'INSPECT_CONSTRAINT', branch: 'SHIELD_MAIN', kitId: item.id } : { type: 'PREPARE_ENDPOINTS', kitId: item.id } }).actual.ok).toBe(true);
    }
    expect(perform({ type: 'CASE', action: { type: 'TRANSIT', route: 'MAIN' } }).actual.ok).toBe(true);
  };
  return { cursor, authority, history, context, perform, current, enterAndPrepare, get state() { return state; }, get at() { return at; } };
}

describe('Fool nested owned cursor isolation', () => {
  it('projects fog from its real owned prefix without accepting mutated exports', () => {
    const h: FogHostFacts = { bodyId: prepared.source.actorId, week: prepared.source.budget.week, nowSecond: 604800, location: 'base', active: true, sequence: 1,
      health: 100, mind: 100, spirituality: 100, cash: 1000, actions: 100, controlPower: 100, activityEpoch: 0,
      ...structuredClone(prepared.source.town), townOperatorAt: 'base', rolls: null, eventId: null };
    const cursor = createFogReplayCursor(h), c = { type: 'BUY_MAINTENANCE', stationId: 'quarry' } as const;
    cursor.advance(c, h); const state = cursor.snapshot();
    same(cursor.project(h), fogProjection(state, h)); same(cursor.actionProjection(c, h, 'buy'), fogActionProjection(state, c, h, 'buy'));
    expect(cursor.consumptionBlock(h)).toBe(fogConsumptionBlock(state, h)); expect(() => cursor.consumptionEvidence(h)).toThrow();
    const projection = cursor.project(h); projection.stations.length = 0;
    state.items.length = 0; same(cursor.project(h), fogProjection(cursor.snapshot(), h));
  });

  it('forks the actual material ledger and detaches all transition results', () => {
    const parent = createFoolMaterialReplayCursor(prepared.source.materialsOrigin, prepared.materialAuthority([]));
    const before = parent.snapshot(), left = parent.fork(), right = parent.fork();
    const item = before.items.find(i => i.disposition === 'SUPPLIER')!;
    const frame: FoolMaterialCommandReplayFrame = { kind: 'MATERIAL_COMMAND', eventId: 'nested-work', witnessId: 'nested-host', revision: prepared.source.revision + 1,
      locationId: 'base', before: structuredClone(prepared.source.budget), materialsBefore: before, randomBefore: prepared.source.random.cursor, randomAfter: prepared.source.random.cursor,
      command: { type: 'SUPPLIER_WORK', itemId: item.id, proofId: 'nested-proof' }, check: null };
    const host = deriveFoolMaterialHost(prepared.source, frame), authority = prepared.materialAuthority([frame]);
    const next = left.command(frame.command, host, authority); same(next, applyFoolMaterialCommand(before, frame.command, host, authority));
    same(parent.snapshot(), before); same(right.snapshot(), before); const exact = left.snapshot();
    next.state.items.length = 0; next.event.host.resources.cash++; frame.command.proofId = 'changed'; host.resources.cash++;
    same(left.snapshot(), exact); same(parent.snapshot(), before);
  });

  it('strictly verifies the Fate source and rejects a supplied saved state or skip flag', () => {
    const source = structuredClone(prepared.source), archived = structuredClone(prepared.archived);
    const cursor = createFoolFateHostReplayCursor(source, archived), before = cursor.snapshot();
    source.worldDigest += '-changed'; archived.attendantMysteries.town!.journal.at(-1)!.cost.cash++;
    same(cursor.snapshot(), before);
    expect(() => createFoolFateHostReplayCursor(source, prepared.archived)).toThrow('F208_HOST_SOURCE_REPLAY_REQUIRED');
    expect(() => createFoolFateHostReplayCursor({ ...prepared.source, skipReplay: true } as typeof source, prepared.archived)).toThrow('F208_HOST_SOURCE_REPLAY_REQUIRED');
    expect(() => createFoolFateHostReplayCursor(before as unknown as typeof source, prepared.archived)).toThrow();
    expect(Object.isFrozen(cursor)).toBe(true);
  }, 60_000);

  it('matches strict receipts, costs, injuries and projections through a successful Fate case', () => {
    const h = fateHarness(); h.enterAndPrepare();
    for (const person of h.current().scene.crew) expect(h.perform({ type: 'CASE', action: { type: 'RESCUE', crewId: person.id } }).actual.ok).toBe(true);
    h.perform({ type: 'CASE', action: { type: 'WAIT', seconds: h.current().scene.departureAt! + 150 - h.at } });
    h.perform({ type: 'CASE', action: { type: 'GRAFT' } });
    h.perform({ type: 'CASE', action: { type: 'WAIT', seconds: h.current().scene.thirdBellAt! - h.at } });
    h.perform({ type: 'CASE', action: { type: 'ARRIVE_AND_VERIFY' } });
    expect(h.cursor.evaluateRitual()?.verdict).toBe('VERIFIED_DEVIATION');
    expect(validateFoolFateHost(h.state, h.authority).valid).toBe(true);
  }, 60_000);

  it('keeps parent and siblings unchanged on previews, rejection and successful child drafts', () => {
    const h = fateHarness(), before = h.cursor.snapshot(), left = h.cursor.fork(), right = h.cursor.fork();
    const c = h.context(), command: FoolFateHostCommand = { id: 'fork-entry', type: 'ENTER_FIRST_CASE' };
    h.history.set(c.receiptId, structuredClone({ command, context: c }));
    expect(left.block(command, c, h.authority)).toBeNull(); same(left.snapshot(), before);
    const result = left.advance(command, c, h.authority); expect(result.ok).toBe(true);
    same(h.cursor.snapshot(), before); same(right.snapshot(), before);
    const exact = left.snapshot(); result.state.cases[result.state.currentCaseId!]!.state.journal.length = 0; c.bodyHealth.actor = 0; command.id = 'mutated';
    same(left.snapshot(), exact);
    expect(left.advance(command, c, { ...h.authority, committedReceiptCount: exact.receipts.length }).ok).toBe(false);
    same(left.snapshot(), exact);
    expect(left.matches(exact)).toBe(true); expect(left.matches(result.state)).toBe(false);
  }, 60_000);

  it('retains real failed cases and verifies finite recovery without replaying nested prefixes', () => {
    const h = fateHarness(); h.enterAndPrepare();
    h.perform({ type: 'CASE', action: { type: 'WAIT', seconds: h.current().scene.thirdBellAt! - h.at } });
    expect(h.perform({ type: 'CASE', action: { type: 'WITHDRAW' } }).actual.ok).toBe(true);
    expect(h.cursor.evaluateRitual()).toBeNull();
    const target = h.state.registry.commissions[1]!;
    const investigation = h.perform({ type: 'INVESTIGATE_RECOVERY', commissionId: target.commissionId }); expect(investigation.actual.ok).toBe(true);
    const at = h.at + 604800, week = investigation.c.week + 1;
    const result = h.perform({ type: 'VERIFY_RECOVERY', commissionId: target.commissionId }, { at, week, recoveryChecks: {
      registerReceipt: target.originals.commercialRegisterReceipt, boatContinuityReceipt: target.originals.boatContinuityReceipt, crateContinuityReceipt: target.originals.crateContinuityReceipt,
      originReceipt: target.binding.originReceipt, originalsDigest: fateOriginalsDigest(target), inspectedAt: at + 60,
    } });
    expect(result.actual.ok).toBe(true); expect(h.state.currentCaseId).toBe(target.instanceId); expect(Object.keys(h.state.cases)).toHaveLength(2);
    expect(validateFoolFateHost(h.state, h.authority).valid).toBe(true);
  }, 60_000);

  it('requires genuine case cursor membership for owned recovery evidence', () => {
    const host = fateHarness(), initial = host.state.registry.commissions[0]!;
    const caseAuthority = { initial, entryAt: 604800, instanceAlreadyRegistered: false, receiptIsAuthentic: () => false };
    const cursor = createFateReplayCursor(initial, caseAuthority), recovery = createFateRecoveryReplayCursor(host.state.registry, { initial: host.state.registry, receiptIsAuthentic: () => false, priorCases: [] });
    const receipt = { id: 'forged-recovery', type: 'INVESTIGATE' as const, targetCommissionId: host.state.registry.commissions[1]!.commissionId,
      week: prepared.source.budget.week, now: 604900, actorId: prepared.source.actorId, actorAlive: true, penniesAvailable: 100, previousCaseId: initial.instanceId, previousCaseJournalDigest: fateCaseJournalDigest(cursor.snapshot()) };
    const authority = { initial: host.state.registry, receiptIsAuthentic: () => false };
    expect(() => recovery.advance(receipt, authority, [{ ...cursor } as FateReplayCursor])).toThrow('AUTHENTIC_ORIGINAL_CASE_CURSOR_REQUIRED');
    expect(recovery.snapshot().journal).toEqual([]);
    const projection = cursor.project({ now: 604800, actorId: prepared.source.actorId, actorAlive: true, actorConscious: true,
      bodyHealth: { actor: 100, crew: Object.fromEntries(initial.crew.map(p => [p.id, 100])) }, resources: { actionPoints: 10, spirituality: 20, mental: 20, pennies: 100, inspectionKits: [], preparationKits: [] }, otherComplexGraftActive: false });
    projection.crew.length = 0; expect(cursor.snapshot().scene.crew).toHaveLength(2);
  }, 60_000);
});
