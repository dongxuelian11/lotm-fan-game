/** Directed cursor equivalence and ownership tests; not natural campaign evidence. */
import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { blockPreparedFool, foolFogHost, replayFool, transitionPreparedFool, previewFool } from '../../src/domain/fool/engine.js';
import { sha256Hex } from '../../src/domain/checksum.js';
import type { FoolCommand, FoolState } from '../../src/domain/fool/types.js';
import { FOOL_SOURCE_MATERIAL_IDS } from '../../src/domain/fool/materials.js';
import { validateFoolState } from '../../src/domain/fool/index.js';
import {
  createFogReplayCursor, createFogState, fogCommandBlock, transitionFog, validateFogState,
  type FogCommand, type FogHostFacts, type FogState, type FogTransition,
} from '../../src/domain/fool/fog.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const same = (left: unknown, right: unknown): void => expect(stableStringify(left)).toBe(stableStringify(right));
const host = (): FogHostFacts => ({
  bodyId: 'cursor-original-body', week: 15971, nowSecond: 0, location: 'base', active: true, sequence: 1,
  health: 90, mind: 95, spirituality: 106, cash: 1000, actions: 100,
  controlPower: 100, activityEpoch: 0, townEpoch: 1, townRegionId: 'town-spirit-region-1',
  townPlot: 'new-alder-clearing', townOperatorAt: 'base',
  townResidents: Array.from({ length: 24 }, (_, i) => ({ bodyId: `town-being-${i + 1}:body`, wormId: `town-worm-${i + 1}`, location: 'new-alder-clearing' as const, controlled: true, health: 100 })),
  externalLiveWormIds: Array.from({ length: 24 }, (_, i) => `town-worm-${i + 1}`),
  cart: { id: 'town-cart-1', hired: true, holder: 'PLAYER', location: 'base', freeCapacityKg: 600 },
  rolls: null, eventId: null,
});
function payAndMove(h: FogHostFacts, result: FogTransition): void {
  h.actions -= result.cost.actions; h.cash -= result.cost.cash;
  h.spirituality -= result.cost.spirituality; h.mind = Math.max(0, h.mind - result.cost.mind);
  h.health = Math.max(0, h.health - result.cost.health); h.nowSecond += result.elapsedSeconds;
  h.location = result.location; h.townOperatorAt = result.location; h.cart.location = result.cartLocation;
  h.rolls = null; h.eventId = null;
}

describe('Fool owned sequential fog cursor', () => {
  it('starts only from a strict original host and imports no saved-state or skip flag', () => {
    const h = host(), original = structuredClone(h), cursor = createFogReplayCursor(h);
    same(cursor.snapshot(), createFogState(h)); same(h, original);
    expect(Object.isFrozen(cursor)).toBe(true);
    expect(() => createFogReplayCursor(cursor.snapshot() as unknown as FogHostFacts)).toThrow();
    expect(() => createFogReplayCursor({ ...h, skipValidation: true } as unknown as FogHostFacts)).toThrow();
    expect(() => createFogReplayCursor({ ...h, townResidents: h.townResidents.slice(1) })).toThrow();
    h.townResidents[0]!.bodyId = 'changed-caller-body';
    same(cursor.snapshot(), createFogState(original));
  });

  it('matches every full standalone receipt and state including real success/failure rolls', () => {
    const h = host(), cursor = createFogReplayCursor(h); let strict = createFogState(h);
    const commands: FogCommand[] = [
      { type: 'BUY_ANCHOR_KIT', stationId: 'quarry' },
      { type: 'BUY_MAINTENANCE', stationId: 'quarry' },
      { type: 'TRAVEL', to: 'quarry' },
      { type: 'DELIVER_STATION', stationId: 'quarry' },
      { type: 'PREPARE_STATION', stationId: 'quarry' },
    ];
    for (const command of commands) {
      const before = cursor.snapshot(), hostBefore = structuredClone(h);
      expect(cursor.block(command, h)).toBe(fogCommandBlock(strict, command, h));
      same(cursor.snapshot(), before); same(h, hostBefore);
      if (command.type === 'PREPARE_STATION') h.rolls = [1, 100, 1, 100];
      const exactHost = structuredClone(h);
      const expected = transitionFog(strict, command, h), actual = cursor.advance(command, h);
      same(actual, expected); same(h, exactHost); strict = expected.state;
      same(cursor.snapshot(), strict); expect(validateFogState(actual.state)).toBe(true);
      payAndMove(h, expected);
    }
    expect(strict.attempts.some(attempt => attempt.success)).toBe(true);
    expect(strict.attempts.some(attempt => !attempt.success)).toBe(true);
  });

  it('rejects out-of-order original hosts and invalid commands without advancing', () => {
    const h = host(), cursor = createFogReplayCursor(h); h.nowSecond = 10;
    cursor.advance({ type: 'SYNC_HOST' }, h);
    const before = cursor.snapshot();
    for (const bad of [{ ...h, nowSecond: 9 }, { ...h, bodyId: 'different-body' }, { ...h, activityEpoch: -1 }]) {
      expect(cursor.block({ type: 'SYNC_HOST' }, bad)).toBe(fogCommandBlock(before, { type: 'SYNC_HOST' }, bad));
      expect(() => cursor.advance({ type: 'SYNC_HOST' }, bad)).toThrow(); same(cursor.snapshot(), before);
    }
    const forged = { type: 'SYNC_HOST', skipValidation: true } as unknown as FogCommand;
    expect(() => cursor.advance(forged, h)).toThrow(); same(cursor.snapshot(), before);
  });

  it('does not expose owned state through snapshots, transition results, hosts or commands', () => {
    const h = host(), cursor = createFogReplayCursor(h), command: FogCommand = { type: 'BUY_MAINTENANCE', stationId: 'quarry' };
    const result = cursor.advance(command, h), exact = cursor.snapshot();
    result.state.origin.roster[0]!.bodyId = 'forged-result-origin';
    result.state.journal[0]!.host.cash++; result.cost.cash++;
    const snapshot = cursor.snapshot(); snapshot.journal.length = 0; snapshot.items.length = 0;
    h.townResidents[0]!.health = 0; command.stationId = 'rain-ruin';
    same(cursor.snapshot(), exact); expect(cursor.matches(exact)).toBe(true);
    expect(cursor.matches(snapshot)).toBe(false); expect(cursor.matches(result.state)).toBe(false);
  });

  it('forks separate cursors so one branch never advances its parent or sibling', () => {
    const h = host(), parent = createFogReplayCursor(h), original = parent.snapshot();
    const left = parent.fork(), right = parent.fork();
    left.advance({ type: 'BUY_ANCHOR_KIT', stationId: 'quarry' }, h);
    same(parent.snapshot(), original); same(right.snapshot(), original);
    const leftBefore = left.snapshot();
    right.advance({ type: 'BUY_MAINTENANCE', stationId: 'rain-ruin' }, h);
    same(left.snapshot(), leftBefore); same(parent.snapshot(), original);
    expect(right.matches(left.snapshot())).toBe(false);
    same(parent.advance({ type: 'SYNC_HOST' }, h), transitionFog(original, { type: 'SYNC_HOST' }, h));
  });

  it('fresh calls rebuild the original and standalone saved-state APIs reject corruption', () => {
    const h = host(), first = createFogReplayCursor(h); first.advance({ type: 'SYNC_HOST' }, h);
    const second = createFogReplayCursor(h); same(second.snapshot(), createFogState(h));
    expect(second.snapshot().journal).toHaveLength(0);
    const bad: FogState = first.snapshot(); bad.journal[0]!.host.bodyId = 'different-original-body';
    expect(first.matches(bad)).toBe(false); expect(validateFogState(bad)).toBe(false);
    expect(fogCommandBlock(bad, { type: 'SYNC_HOST' }, h)).not.toBeNull();
    expect(() => transitionFog(bad, { type: 'SYNC_HOST' }, h)).toThrow();
    same(second.snapshot(), createFogState(h));
  });
});

// These use the existing exact historical fixture through public legal actions.
// No resource edits, fabricated checks, seed changes, or natural-run writes.
let checkpointCache: SliceState | undefined;
function checkpoint(): SliceState {
  if (!checkpointCache) {
    let state = migrateSliceState(readObjectEntry<unknown>('tests/fixtures/attendant-mysteries-v01860/natural-battle.json', 'final'));
    state = applySliceIntent(state, { type: 'FOOL', command: { type: 'LEARN_GUIDANCE' } });
    for (let i = 0; i < 3; i++) state = applySliceIntent(state, { type: 'FOOL', command: { type: 'RECEPTION_WORK' } });
    checkpointCache = state;
  }
  return structuredClone(checkpointCache);
}
describe('Fool prepared cursor ownership boundary', () => {
  it('explicitly forks repeated previews and prepared commits without touching prepared RNG/state', () => {
    const state = checkpoint(), prepared = replayFool(state, state.fool);
    const rootBefore = structuredClone(prepared.root), fogBefore = prepared.context.fogReplay.snapshot();
    const command = { type: 'RECEPTION_NEXT_WEEK' } as const, revision = state.revision + 1;
    expect(blockPreparedFool(prepared, command, revision)).toBeNull();
    expect(blockPreparedFool(prepared, command, revision)).toBeNull();
    same(prepared.root, rootBefore); same(prepared.context.fogReplay.snapshot(), fogBefore);
    const first = transitionPreparedFool(prepared, command, revision), second = transitionPreparedFool(prepared, command, revision);
    same(first, second); same(prepared.root, rootBefore); same(prepared.context.fogReplay.snapshot(), fogBefore);
    same(first, applySliceIntent(state, { type: 'FOOL', command }).fool);
    same(first.frame!.random, rootBefore.frame!.random);
    first.fog!.journal[0]!.host.cash++;
    same(prepared.context.fogReplay.snapshot(), fogBefore); same(second, applySliceIntent(state, { type: 'FOOL', command }).fool);
  }, 90_000);

  it('rejects a changed prepared fog root rather than overwriting it from the owned cursor', () => {
    const state = checkpoint(), prepared = replayFool(state, state.fool), owned = prepared.context.fogReplay.snapshot();
    prepared.root.fog!.journal[1]!.host.cash++;
    const badBefore = structuredClone(prepared.root), command = { type: 'RECEPTION_NEXT_WEEK' } as const;
    expect(blockPreparedFool(prepared, command, state.revision + 1)).not.toBeNull();
    expect(() => transitionPreparedFool(prepared, command, state.revision + 1)).toThrow();
    same(prepared.root, badBefore); same(prepared.context.fogReplay.snapshot(), owned);
  }, 60_000);

  it('detects a cursor advanced outside its root and rechecks corrupted saves across calls', () => {
    const state = checkpoint(), prepared = replayFool(state, state.fool), rootBefore = structuredClone(prepared.root);
    prepared.context.fogReplay.advance({ type: 'SYNC_HOST' }, foolFogHost(prepared.root));
    expect(blockPreparedFool(prepared, { type: 'RECEPTION_NEXT_WEEK' }, state.revision + 1)).not.toBeNull();
    same(prepared.root, rootBefore);
    const bad = structuredClone(state); bad.fool.fog!.journal[1]!.host.cash++;
    expect(() => replayFool(bad, bad.fool)).toThrow(); expect(validateFoolState(bad)).toBe(false);
    const fresh = replayFool(state, state.fool); same(fresh.root, state.fool);
    expect(fresh.context.fogReplay.matches(fresh.root.fog)).toBe(true);
  }, 60_000);
});


function preparedReason(prepared: ReturnType<typeof replayFool>, command: FoolCommand, revision: number): string | null {
  try { transitionPreparedFool(prepared, command, revision); return null; }
  catch (error) { return error instanceof Error ? error.message : '当前不能执行。'; }
}
function preparedEvidence(prepared: ReturnType<typeof replayFool>): unknown {
  return { root: prepared.root, frames: prepared.context.materialFrames, fate: prepared.context.fateReceipts,
    escape: prepared.context.escapeFrames, start: prepared.context.escapeStart, fog: prepared.context.fogReplay.snapshot() };
}
let materialCheckpointCache: SliceState | undefined;
function materialCheckpoint(): SliceState {
  if (!materialCheckpointCache) {
    let state = applySliceIntent(checkpoint(), { type: 'FOOL', command: { type: 'RECEPTION_NEXT_WEEK' } });
    for (let step = 0; step < 2; step++) state = applySliceIntent(state, { type: 'FOOL', command: {
      type: 'MATERIAL', command: { type: 'SUPPLIER_WORK', itemId: FOOL_SOURCE_MATERIAL_IDS[2]! },
    } });
    materialCheckpointCache = state;
  }
  return structuredClone(materialCheckpointCache);
}
describe('Fool replay-only material ownership and receipt-free eligibility', () => {
  it('replays exact central events and full material state without returning a material cursor', () => {
    const state = materialCheckpoint(), before = structuredClone(state), prepared = replayFool(state, state.fool);
    same(prepared.root, state.fool); same(state, before); expect(prepared.root.materials!.journal).toHaveLength(2);
    expect(Object.keys(prepared.context).sort()).toEqual(['archived', 'materialFrames', 'fateReceipts', 'escapeStart', 'escapeFrames', 'materialAuthority', 'fogReplay'].sort());
    const command: FoolCommand = { type: 'MATERIAL', command: { type: 'SUPPLIER_WORK', itemId: FOOL_SOURCE_MATERIAL_IDS[2]! } };
    const next = transitionPreparedFool(prepared, command, state.revision + 1), again = transitionPreparedFool(prepared, command, state.revision + 1);
    same(next, again); same(next, applySliceIntent(state, { type: 'FOOL', command }).fool); same(prepared.root, state.fool);
    const canonical = (root: FoolState): string => { const { journal: _journal, ...data } = root; return stableStringify(data); };
    expect(next.journal.at(-1)!.beforeDigest).toBe(sha256Hex(canonical(prepared.root)));
    expect(next.journal.at(-1)!.afterDigest).toBe(sha256Hex(canonical(next)));
  }, 90_000);

  it('matches actual prepared reasons and keeps every isolated effect out of the original', () => {
    const state = materialCheckpoint(), prepared = replayFool(state, state.fool), before = structuredClone(preparedEvidence(prepared));
    const commands: FoolCommand[] = [
      { type: 'RECEPTION_WORK' }, { type: 'RECEPTION_REST' }, { type: 'RECEPTION_NEXT_WEEK' },
      { type: 'ENTER_FATE' }, { type: 'LEAVE_FATE' }, { type: 'START_ESCAPE' },
      { type: 'MATERIAL', command: { type: 'SUPPLIER_WORK', itemId: FOOL_SOURCE_MATERIAL_IDS[2]! } },
      { type: 'MATERIAL', command: { type: 'TRACE_REJECTION', itemId: FOOL_SOURCE_MATERIAL_IDS[0]! } },
      { type: 'FOG', command: { type: 'TRAVEL', to: 'new-alder-clearing' } },
      { type: 'FOG', command: { type: 'PREPARE_STATION', stationId: 'quarry' } },
      { type: 'CONSUME', compoundId: 'missing-compound', confirmed: true },
    ];
    for (const command of commands) {
      const reason = preparedReason(prepared, command, state.revision + 1);
      expect(blockPreparedFool(prepared, command, state.revision + 1)).toBe(reason);
      expect(blockPreparedFool(prepared, command, state.revision + 1)).toBe(reason);
      same(preparedEvidence(prepared), before);
    }
    // A real paid/drawn trace is previewed at its actual inherited failure site.
    const atSite = applySliceIntent(state, { type: 'FOOL', command: { type: 'FOG', command: { type: 'TRAVEL', to: 'new-alder-clearing' } } });
    const traced = replayFool(atSite, atSite.fool), frozen = structuredClone(preparedEvidence(traced));
    const command: FoolCommand = { type: 'MATERIAL', command: { type: 'TRACE_REJECTION', itemId: FOOL_SOURCE_MATERIAL_IDS[0]! } };
    expect(blockPreparedFool(traced, command, atSite.revision + 1)).toBeNull();
    const next = transitionPreparedFool(traced, command, atSite.revision + 1);
    expect(next.frame!.random.cursor).toBe(traced.root.frame!.random.cursor + 1);
    expect(next.frame!.budget.cash).toBe(traced.root.frame!.budget.cash - 60);
    expect(next.frame!.budget.actions).toBe(traced.root.frame!.budget.actions - 1);
    expect(next.journal.at(-1)!.randomReceipts).toHaveLength(1); same(preparedEvidence(traced), frozen);
  }, 90_000);

  it('retains canonical rejection on caller-modified prepared fields with the exact actual reason', () => {
    const state = materialCheckpoint(), pristine = replayFool(state, state.fool);
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, 1n, undefined, new Date(0)]) {
      const prepared = { root: structuredClone(pristine.root), context: pristine.context };
      (prepared.root as unknown as Record<string, unknown>).malformed = value;
      const reason = preparedReason(prepared, { type: 'RECEPTION_NEXT_WEEK' }, state.revision + 1);
      expect(reason).not.toBeNull(); expect(blockPreparedFool(prepared, { type: 'RECEPTION_NEXT_WEEK' }, state.revision + 1)).toBe(reason);
      expect((prepared.root as unknown as Record<string, unknown>).malformed).toEqual(value);
    }
    const uncloneable = { type: 'RECEPTION_WORK', extra: () => true } as unknown as FoolCommand;
    const reason = preparedReason(pristine, uncloneable, state.revision + 1);
    expect(reason).not.toBeNull(); expect(blockPreparedFool(pristine, uncloneable, state.revision + 1)).toBe(reason);
    same(pristine.root, state.fool);
  }, 90_000);

  it('keeps material tamper checks on prepared calls and source/current-host checks across replays', () => {
    const state = materialCheckpoint(), command: FoolCommand = { type: 'MATERIAL', command: { type: 'SUPPLIER_WORK', itemId: FOOL_SOURCE_MATERIAL_IDS[2]! } };
    const changes: Array<(root: FoolState) => void> = [
      root => { root.materials!.journal[0]!.host.resources.cash++; },
      root => { root.materials!.journal[0]!.cost.actions++; },
      root => { root.materials!.items[2]!.supplierWork.length = 0; },
      root => { root.materials!.origin.snapshotDigest += ':forged'; },
    ];
    for (const change of changes) {
      const prepared = replayFool(state, state.fool); change(prepared.root); const before = structuredClone(preparedEvidence(prepared));
      const reason = preparedReason(prepared, command, state.revision + 1); expect(reason).not.toBeNull();
      expect(blockPreparedFool(prepared, command, state.revision + 1)).toBe(reason); same(preparedEvidence(prepared), before);
      const bad = structuredClone(state); change(bad.fool); expect(() => replayFool(bad, bad.fool)).toThrow();
      expect(previewFool(bad, bad.fool, command, bad.revision + 1)).not.toBeNull();
    }
    const wrongHost = structuredClone(state); wrongHost.attendantMysteries.town!.journal.at(-1)!.cost.cash++;
    expect(() => replayFool(wrongHost, wrongHost.fool)).toThrow();
    const wrongSource = structuredClone(state); wrongSource.fool.source!.materialsOrigin.uniquenessCustody[0]!.sealId += ':forged';
    expect(() => replayFool(wrongSource, wrongSource.fool)).toThrow(); same(replayFool(state, state.fool).root, state.fool);
  }, 90_000);
});
