/** One complete new-command replay and one actual terminal-command SQLite fault/retry/reopen.
 * Original778 are integrity-checked only; no historical replay, controlled draw, or extra route. */
import { expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { StoredSlice } from '../../src/application/slice-application.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { openChainedRuntimeSession, type ChainedRuntimeSession } from '../../src/domain/chained/owned-session.js';
import { CHAINED_ABILITY_IDS, CHAINED_ORIGINAL_IDS } from '../../src/domain/chained/content.js';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import type { SliceEnvelope, SliceResult } from '../../src/shared/slice-contracts.js';
import {
  CHAINED225_FINAL_INTENT, CHAINED225_FROZEN_ROOTS, CHAINED225_NEW_COUNT, CHAINED225_SOURCE_STATE_SHA,
  assertChainedNaturalRetainedFreeze,
  chainedNaturalHash, chainedNaturalOutcome, chainedNaturalReceipt, chainedNaturalSha,
  readChainedNaturalRows, readChainedNaturalSnapshot, readChainedNaturalSource, readChainedNaturalSummary,
  type ChainedNaturalActionRow,
} from '../helpers/chained-natural-capture.js';

import assert from 'node:assert/strict';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { assertEmptyWheelOfFortuneState, assertEmptyWheelOfFortunePublic } from '../helpers/empty-wheel-of-fortune-capture.js';
import { assertEmptyBlackEmperorState, assertEmptyBlackEmperorPublic } from '../helpers/empty-black-emperor-capture.js';
import { assertEmptyJusticiarState, assertEmptyJusticiarPublic } from '../helpers/empty-justiciar-capture.js';
import { assertEmptyMotherState, assertEmptyMotherPublic } from '../helpers/empty-mother-capture.js';

/** Raw222 captures stay immutable. Only these named, exactly empty later roots
 * and format metadata are removed from detached historical hash views. */
const LATER_EMPTY_ROOTS = ['wheelOfFortune', 'blackEmperor', 'justiciar', 'mother'] as const;
function historicalNaturalState(state: SliceState, originalKeys: readonly string[]) {
  assert.deepEqual([state.schemaVersion, state.contentVersion], [CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  for (const root of LATER_EMPTY_ROOTS) assert.equal(originalKeys.includes(root), false);
  assert.deepEqual(Object.keys(state).sort(), [...originalKeys, ...LATER_EMPTY_ROOTS].sort());
  assertEmptyWheelOfFortuneState(state);
  assertEmptyBlackEmperorState(state);
  assertEmptyJusticiarState(state);
  assertEmptyMotherState(state);
  const { wheelOfFortune: _emptyWheelOfFortune, blackEmperor: _emptyBlackEmperor, justiciar: _emptyJusticiar,
    mother: _emptyMother, ...originalFields } = state;
  return { ...originalFields, schemaVersion: 222, contentVersion: 'chained-v222' };
}
function historicalNaturalPublic(view: SliceProjection, state: SliceState, originalKeys: readonly string[]) {
  for (const root of LATER_EMPTY_ROOTS) assert.equal(originalKeys.includes(root), false);
  assert.deepEqual(Object.keys(view).sort(), [...originalKeys, ...LATER_EMPTY_ROOTS].sort());
  assertEmptyWheelOfFortuneState(state);
  assertEmptyBlackEmperorState(state);
  assertEmptyJusticiarState(state);
  assertEmptyMotherState(state);
  assertEmptyWheelOfFortunePublic(view, state);
  assertEmptyBlackEmperorPublic(view, state);
  assertEmptyJusticiarPublic(view, state);
  assertEmptyMotherPublic(view, state);
  const { wheelOfFortune: _emptyWheelOfFortune, blackEmperor: _emptyBlackEmperor, justiciar: _emptyJusticiar,
    mother: _emptyMother, ...originalFields } = view;
  return originalFields;
}
function capturedNaturalAnchor(state: SliceState, view: SliceProjection,
  original: { final: SliceState; public: SliceProjection }) {
  return { revision: state.revision,
    privateStateSha256: chainedNaturalHash(historicalNaturalState(state, Object.keys(original.final))),
    publicStateSha256: chainedNaturalHash(historicalNaturalPublic(view, state, Object.keys(original.public))),
    random: state.random, randomSha256: chainedNaturalHash(state.random) };
}

it('audits current-schema initial and terminal snapshots without replay', () => {
  for (const which of ['initial', 'terminal'] as const) {
    const original = readChainedNaturalSnapshot(which), rawHash = chainedNaturalHash(original);
    const state = migrateSliceState(structuredClone(original.final)), view = projectSliceState(state);
    const stateKeys = Object.keys(original.final), publicKeys = Object.keys(original.public);
    expect(historicalNaturalState(state, stateKeys)).toEqual(original.final);
    expect(historicalNaturalPublic(view, state, publicKeys)).toEqual(original.public);
    expect(capturedNaturalAnchor(state, view, original)).toEqual(original.anchor);
    // Exact-key checks reject unknown roots, even if their value is undefined.
    expect(() => historicalNaturalState(Object.assign({}, state, { unexpectedFutureRoot: undefined }), stateKeys)).toThrow();
    expect(() => historicalNaturalPublic(Object.assign({}, view, { unexpectedFutureRoot: undefined }), state, publicKeys)).toThrow();
    for (const root of LATER_EMPTY_ROOTS) {
      expect(() => historicalNaturalState({ ...state, [root]: { ...state[root], guidanceKnown: true } }, stateKeys)).toThrow();
      expect(() => historicalNaturalPublic({ ...view, [root]: { ...view[root], guidanceKnown: true } }, state, publicKeys)).toThrow();
    }
    expect(chainedNaturalHash(historicalNaturalState({ ...state, cash: state.cash + 1 }, stateKeys)))
      .not.toBe(original.anchor.privateStateSha256);
    expect(chainedNaturalHash(historicalNaturalPublic({ ...view, cash: view.cash + 1 }, state, publicKeys)))
      .not.toBe(original.anchor.publicStateSha256);
    expect(chainedNaturalHash(original)).toBe(rawHash);
  }
}, 180_000);

function unwrap<T>(result: SliceResult<T>): T {
  if (!result.ok) throw Error(result.error.code + ': ' + result.error.message);
  return result.value;
}

function verifyLastCommandSave(before: SliceState, state: SliceState, view: SliceProjection, last: ChainedNaturalActionRow): void {
  const directory = mkdtempSync(join(tmpdir(), 'lotm-chained225-natural-')), file = join(directory, 'save.sqlite');
  const importedAt = '2026-10-19T00:00:00.000Z', committedAt = '2026-10-19T00:00:01.000Z';
  const request: SliceEnvelope = { intentId: 'chained225-natural-last', runId: before.runId,
    expectedRevision: before.revision, payload: last.intent };
  expect(last.commandCount).toBe(778 + CHAINED225_NEW_COUNT); expect(last.intent).toEqual(CHAINED225_FINAL_INTENT);
  expect(before).toMatchObject({ revision: 871, status: 'ACTIVE', health: 100, mind: 80, spirituality: 118,
    cash: 320, actionsRemaining: 2, random: { seed: 'prisoner-natural-v057', cursor: 294 } });
  const requestHash = chainedNaturalHash(request);
  const inspect = () => {
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      const runs = db.prepare('SELECT * FROM slice_runs ORDER BY id').all();
      const raw = String(runs.find(row => row.id === state.runId)!.current_json);
      const hash = (path: string) => existsSync(path) ? chainedNaturalSha(readFileSync(path)) : null;
      return { raw, stored: JSON.parse(JSON.parse(raw).payload) as StoredSlice,
        durable: chainedNaturalHash({ runs, receipts: db.prepare('SELECT * FROM slice_receipts ORDER BY id').all(),
          meta: db.prepare('SELECT * FROM slice_meta ORDER BY key').all(), backup: hash(file + '.bak'),
          sealed: hash(file + '.sealed'), files: readdirSync(dirname(file)).sort() }) };
    } finally { db.close(); }
  };
  let store: SqliteSliceStore | undefined, watching = false, fail = true, attempts = 0;
  let stagedAssertionError: unknown, publishedRevision: number | null = null;
  try {
    store = new SqliteSliceStore(file, { now: () => committedAt, beforeWrite: () => {
      if (!watching) return;
      attempts++;
      try {
        expect(store!.repository.ownedHead(before.runId)?.revision ?? null).toBe(publishedRevision);
        expect(store!.repository.get(before.runId)).toEqual({ state, updatedAt: committedAt });
        expect(store!.repository.receipt(request.intentId)?.receipt.newRevision).toBe(state.revision);
      } catch (error) { stagedAssertionError = error; throw error; }
      if (fail) throw Error('Injected last natural Chained command write failure');
    } });
    store.repository.transaction(() => {
      store!.repository.put({ state: before, updatedAt: importedAt });
      store!.repository.selectRun('previous-selected-slot');
    });
    publishedRevision = store.repository.ownedHead(before.runId)?.revision ?? null;
    if (before.chained.guidanceKnown) expect(publishedRevision).toBe(before.revision);
    const original = inspect();
    expect(existsSync(file + '.sealed')).toBe(false);
    watching = true;
    try { expect(store.submitIntent(request)).toMatchObject({ ok: false, error: { code: 'SAVE_FAILED' } }); }
    finally { watching = false; }
    if (stagedAssertionError) throw stagedAssertionError;
    expect(attempts).toBe(1); expect(inspect()).toEqual(original);
    expect(store.repository.receipt(request.intentId)).toBeNull();
    expect(store.repository.activeRun()).toBe('previous-selected-slot');
    expect(store.repository.ownedHead(before.runId)?.revision ?? null).toBe(publishedRevision);
    expect(inspect().stored.state.random).toEqual(last.before.random);

    fail = false; watching = true;
    const result = store.submitIntent(request);
    watching = false;
    if (stagedAssertionError) throw stagedAssertionError;
    const receipt = unwrap(result);
    expect(receipt).toMatchObject({ intentId: request.intentId, previousRevision: before.revision,
      newRevision: state.revision, committedAt, replayed: false });
    expect(receipt.state).toEqual(view); expect(attempts).toBe(2);
    expect(chainedNaturalHash(request)).toBe(requestHash);
    expect(store.repository.activeRun()).toBe(before.runId);
    const committed = inspect();
    expect(committed.stored).toEqual({ state, updatedAt: committedAt });
    expect(committed.stored.state.random).toEqual(last.after.random);
    expect(chainedNaturalReceipt(committed.stored.state, before)).toEqual(last.receipt);
    expect(JSON.parse(readFileSync(file + '.sealed', 'utf8'))).toContain(state.runId);
    expect(unwrap(store.submitIntent(request))).toEqual({ ...receipt, replayed: true });
    expect(attempts).toBe(2); expect(inspect().raw).toBe(committed.raw);
    store.close(); store = undefined;

    store = new SqliteSliceStore(file, { now: () => committedAt });
    expect(unwrap(store.loadRun(state.runId))).toEqual(view);
    expect(unwrap(store.getBootstrap()).activeState).toEqual(view);
    expect(unwrap(store.submitIntent(request))).toEqual({ ...receipt, replayed: true });
    expect(store.submitIntent({ ...request, intentId: 'chained225-after-death', expectedRevision: state.revision }))
      .toMatchObject({ ok: false, error: { code: 'ARCHIVED' } });
    expect(JSON.parse(readFileSync(file + '.sealed', 'utf8'))).toContain(state.runId);
    expect(inspect().raw).toBe(committed.raw);
    expect(inspect().stored).toEqual(committed.stored);
    if (state.chained.guidanceKnown) expect(store.repository.ownedHead(state.runId)?.revision).toBe(state.revision);
  } finally { store?.close(); rmSync(directory, { recursive: true, force: true }); }
}

it('replays only the actual new Chained commands with exact private/public/RNG hashes, then faults/retries/reopens the last save', () => {
  const summary = readChainedNaturalSummary(), archive = readChainedNaturalSource(), source = archive.final;
  const initial = readChainedNaturalSnapshot('initial'), rows = readChainedNaturalRows();
  assertChainedNaturalRetainedFreeze(summary);
  expect(rows).toHaveLength(summary.commandCount);
  let previous: string | null = null;
  for (const [index, row] of rows.entries()) {
    const { rowSha256, ...payload } = row;
    expect(rowSha256, `row ${index + 1}`).toBe(chainedNaturalHash(payload));
    expect(row.commandSha256).toBe(chainedNaturalHash(row.intent));
    expect(row.commandCount).toBe(index + 1); expect(row.previousRowSha256).toBe(previous);
    if (index < 778) {
      expect(row.kind).toBe('HISTORICAL_COMMAND'); expect(row.intent).toEqual(archive.commands[index]);
    }
    previous = rowSha256;
  }
  let state = migrateSliceState(structuredClone(source)), view = projectSliceState(state);
  for (const [key, value] of Object.entries(source)) if (!['schemaVersion', 'contentVersion'].includes(key))
    expect(state[key as keyof SliceState], `original migration root ${key}`).toEqual(value);
  expect(historicalNaturalState(state, Object.keys(initial.final))).toEqual(initial.final);
  expect(historicalNaturalPublic(view, state, Object.keys(initial.public))).toEqual(initial.public);
  expect(state.chained.guidanceKnown).toBe(false); expect(state.chained.source).toBeNull(); expect(state.chained.journal).toEqual([]);
  let anchor = capturedNaturalAnchor(state, view, initial), before = state;
  expect(anchor).toEqual(initial.anchor);
  const actions = rows.slice(778) as ChainedNaturalActionRow[];
  let session: ChainedRuntimeSession | undefined;
  for (const [index, row] of actions.entries()) {
    expect(row.kind).toBe('CHAINED_ACTION'); expect(row.newCount).toBe(index + 1);
    expect(row.before, `before command ${row.commandCount}`).toEqual(anchor);
    expect(row.after.revision).toBe(779 + row.newCount);
    expect(view.status).toBe('ACTIVE'); expect(view.activeEvent).toBeNull(); expect(view.combat).toBeNull();
    expect(view.chained.actions.filter(action => action.preferredAction)).toEqual([row.publicAction]);
    expect(row.publicAction.enabled).toBe(true); expect(row.intent).toEqual({ type: 'CHAINED', command: row.publicAction.command });
    before = state;
    if (!session) {
      expect(index).toBe(0); expect(row.intent).toEqual({ type: 'CHAINED', command: { type: 'LEARN_GUIDANCE' } });
      state = applySliceIntent(state, row.intent); session = openChainedRuntimeSession(state);
    } else {
      const draft = session.prepare(row.intent, state.revision);
      expect(session.inspect().revision).toBe(state.revision);
      session.commit(draft); state = session.snapshot();
    }
    view = session.project();
    expect(row.receipt).toEqual(chainedNaturalReceipt(state, before));
    expect(row.actual).toEqual(chainedNaturalOutcome(state));
    expect(state.random.seed).toBe(source.random.seed); expect(state.random.cursor).toBeGreaterThanOrEqual(before.random.cursor);
    anchor = capturedNaturalAnchor(state, view, initial);
    expect(anchor, `after command ${row.commandCount}`).toEqual(row.after);
  }
  const terminal = readChainedNaturalSnapshot('terminal');
  assertValidSliceState(state);
  expect(historicalNaturalState(state, Object.keys(terminal.final))).toEqual(terminal.final);
  expect(historicalNaturalPublic(view, state, Object.keys(terminal.public))).toEqual(terminal.public);
  expect(state.revision).toBe(summary.revision); expect(chainedNaturalOutcome(state)).toEqual(summary.actual);
  expect(state).toMatchObject({ revision: 872, status: 'DEAD', week: 191, health: 0, mind: 0,
    spirituality: 88, cash: 320, actionsRemaining: 1, injuryRisk: 2, seer: { pollution: 70 },
    progression: { pathwayId: 'chained', sequence: 1, acting: 100 },
    random: { seed: source.random.seed, cursor: 295 }, ending: { kind: 'DEATH' } });
  expect(state.injuries).toEqual([{ id: 'R225:prisoner-rebuild-natural:872:promotion-injury',
    severity: 'HEAVY', acquiredRevision: 872, treatedRevision: null }]);
  expect(state.lastCheck).toMatchObject({ ability: 'will', chance: 70, roll: 98, tier: 'GREAT_FAILURE' });
  expect(state.chained.journal.flatMap(event => event.randomReceipts).map(({ check, cursorBefore, cursorAfter }) =>
    [check.chance, check.roll, check.tier, cursorBefore, cursorAfter])).toEqual([
    [32, 55, 'FAILURE', 291, 292], [32, 36, 'FAILURE', 292, 293],
    [32, 17, 'SUCCESS', 293, 294], [70, 98, 'GREAT_FAILURE', 294, 295],
  ]);
  expect(anchor.privateStateSha256).toBe(summary.finalPrivateStateSha256);
  expect(anchor.publicStateSha256).toBe(summary.finalWholePublicSha256);
  for (const key of CHAINED225_FROZEN_ROOTS) expect(state[key], `original ${key}`).toEqual(source[key]);
  for (const [id, mastery] of Object.entries(source.progression.mastery)) expect(state.progression.mastery[id]).toBe(mastery);
  expect(state.chained.materials!.originals.map(item => item.originalId).sort()).toEqual([...CHAINED_ORIGINAL_IDS].sort());
  expect(state.chained.source!.acquisition.bottles).toEqual(source.abomination.bottles);
  expect(state.progression.mastery).toEqual(source.progression.mastery);
  for (const id of CHAINED_ABILITY_IDS) expect(state.progression.mastery[id]).toBeUndefined();
  expect(state.chained.promotionWeek).toBeNull();
  expect(state.chained.frame!.location).toBe('CH225-WORKSHOP');
  const materials = state.chained.materials!, scene = state.chained.scene!;
  for (const original of materials.originals) expect(original).toMatchObject({ holder: 'DEATH_REMAINS',
    location: 'CH225-WORKSHOP', compoundId: 'CH225-COMPOUND-1' });
  expect(materials.uniqueness).toMatchObject({ id: 'CH225-UNIQUENESS', holder: 'DEATH_REMAINS',
    location: 'CH225-WORKSHOP', compoundId: 'CH225-COMPOUND-1' });
  expect(materials.compounds).toHaveLength(1);
  expect(materials.compounds[0]).toMatchObject({ id: 'CH225-COMPOUND-1', status: 'DEATH_REMAINS',
    location: 'CH225-WORKSHOP', embodiedOriginalId: 'abomination-potion-2',
    consumedEventId: 'R225:prisoner-rebuild-natural:872', recoveredEventId: null });
  expect([...materials.compounds[0]!.originalIds, materials.compounds[0]!.embodiedOriginalId].sort())
    .toEqual([...CHAINED_ORIGINAL_IDS].sort());
  expect(scene).toMatchObject({ phase: 'PREPARATION', status: 'ABORTED', playerPosition: 'OUTSIDE',
    contact: false, window: null, bindingApplied: false, impactBurdenApplied: false,
    evacuationReportEventId: 'R225:prisoner-rebuild-natural:817', returnReportEventId: null,
    segments: { A: { open: false }, B: { open: false } }, exit: { door: 'CLOSED' },
    device: { loadFinishedEventId: null, cargoFinishedEventId: null, loadMethod: 'NONE', cargoMethod: 'NONE' },
    rope: { loadEventId: null, wear: 0, dropCentimetres: 0 } });
  expect(scene.workers).toHaveLength(2); expect(scene.cargo).toHaveLength(3);
  for (const worker of scene.workers) {
    expect(worker).toMatchObject({ alive: true, health: 100, position: 'OUTSIDE', consent: 'CLOSED', walkedMetres: 16 });
    expect(worker.paidEventId).toBeTruthy();
    expect(worker.passage.a).toBeTruthy(); expect(worker.passage.b).toBeTruthy(); expect(worker.passage.exit).toBeTruthy();
    expect(scene.cargo.find(item => item.carrierId === worker.id)).toMatchObject({ position: 'OUTSIDE',
      travelMetres: 16, secured: true, passage: worker.passage });
  }
  expect(scene.cargo.find(item => item.id === 'CH225-MAINTENANCE-BOX')).toMatchObject({
    position: 'GATE', travelMetres: 0, movedEventId: null, passage: { a: null, b: null, exit: null },
  });
  expect(summary.stage).toBe('NATURAL_DEATH'); expect(view.canAct).toBe(false);
  expect(view.chained.promoted).toBe(false);
  expect(view.chained.actions.some(action => action.enabled || action.preferredAction)).toBe(false);
  expect(chainedNaturalHash(source)).toBe(CHAINED225_SOURCE_STATE_SHA);
  // Reuse this replay's real penultimate state, never regenerate or replay original778.
  verifyLastCommandSave(before, state, view, actions.at(-1)!);
}, 900_000);
