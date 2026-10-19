/** One complete new-command replay and one actual terminal-command SQLite fault/retry/reopen.
 * Original841 are integrity-checked only; no historical replay, controlled draw, or extra route. */
import { expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { StoredSlice } from '../../src/application/slice-application.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { openWheelOfFortuneRuntimeSession, type WheelOfFortuneRuntimeSession } from '../../src/domain/wheel-of-fortune/owned-session.js';
import { WHEEL_OF_FORTUNE_ABILITY_IDS, WHEEL_OF_FORTUNE_ORIGINAL_IDS } from '../../src/domain/wheel-of-fortune/content.js';
import { getMercurySnakeCurrentSite } from '../../src/domain/mercury-snake/life.js';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import type { SliceEnvelope, SliceResult } from '../../src/shared/slice-contracts.js';
import {
  WHEEL_OF_FORTUNE226_FROZEN_ROOTS, WHEEL_OF_FORTUNE226_SOURCE_STATE_SHA, assertWheelOfFortuneNaturalRetainedFreeze,
  wheelOfFortuneNaturalHash, wheelOfFortuneNaturalOutcome, wheelOfFortuneNaturalReceipt, wheelOfFortuneNaturalSha,
  readWheelOfFortuneNaturalRows, readWheelOfFortuneNaturalSnapshot, readWheelOfFortuneNaturalSource, readWheelOfFortuneNaturalSummary,
  type WheelOfFortuneNaturalActionRow,
} from '../helpers/wheel-of-fortune-natural-capture.js';

import assert from 'node:assert/strict';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { assertEmptyBlackEmperorState, assertEmptyBlackEmperorPublic } from '../helpers/empty-black-emperor-capture.js';
import { assertEmptyJusticiarState, assertEmptyJusticiarPublic } from '../helpers/empty-justiciar-capture.js';
import { assertEmptyMotherState, assertEmptyMotherPublic } from '../helpers/empty-mother-capture.js';

/** Raw223 captures stay immutable. Only these named, exactly empty later roots
 * and format metadata are removed from detached historical hash views. */
const LATER_EMPTY_ROOTS = ['blackEmperor', 'justiciar', 'mother'] as const;
function historicalNaturalState(state: SliceState, originalKeys: readonly string[]) {
  assert.deepEqual([state.schemaVersion, state.contentVersion], [CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  for (const root of LATER_EMPTY_ROOTS) assert.equal(originalKeys.includes(root), false);
  assert.deepEqual(Object.keys(state).sort(), [...originalKeys, ...LATER_EMPTY_ROOTS].sort());
  assertEmptyBlackEmperorState(state);
  assertEmptyJusticiarState(state);
  assertEmptyMotherState(state);
  const { blackEmperor: _emptyBlackEmperor, justiciar: _emptyJusticiar, mother: _emptyMother, ...originalFields } = state;
  return { ...originalFields, schemaVersion: 223, contentVersion: 'wheel-of-fortune-v223' };
}
function historicalNaturalPublic(view: SliceProjection, state: SliceState, originalKeys: readonly string[]) {
  for (const root of LATER_EMPTY_ROOTS) assert.equal(originalKeys.includes(root), false);
  assert.deepEqual(Object.keys(view).sort(), [...originalKeys, ...LATER_EMPTY_ROOTS].sort());
  assertEmptyBlackEmperorState(state);
  assertEmptyJusticiarState(state);
  assertEmptyMotherState(state);
  assertEmptyBlackEmperorPublic(view, state);
  assertEmptyJusticiarPublic(view, state);
  assertEmptyMotherPublic(view, state);
  const { blackEmperor: _emptyBlackEmperor, justiciar: _emptyJusticiar, mother: _emptyMother, ...originalFields } = view;
  return originalFields;
}
function capturedNaturalAnchor(state: SliceState, view: SliceProjection,
  original: { final: SliceState; public: SliceProjection }) {
  return { revision: state.revision,
    privateStateSha256: wheelOfFortuneNaturalHash(historicalNaturalState(state, Object.keys(original.final))),
    publicStateSha256: wheelOfFortuneNaturalHash(historicalNaturalPublic(view, state, Object.keys(original.public))),
    random: state.random, randomSha256: wheelOfFortuneNaturalHash(state.random) };
}

it('audits current-schema initial and terminal snapshots without replay', () => {
  for (const which of ['initial', 'terminal'] as const) {
    const original = readWheelOfFortuneNaturalSnapshot(which), rawHash = wheelOfFortuneNaturalHash(original);
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
    expect(wheelOfFortuneNaturalHash(historicalNaturalState({ ...state, cash: state.cash + 1 }, stateKeys)))
      .not.toBe(original.anchor.privateStateSha256);
    expect(wheelOfFortuneNaturalHash(historicalNaturalPublic({ ...view, cash: view.cash + 1 }, state, publicKeys)))
      .not.toBe(original.anchor.publicStateSha256);
    expect(wheelOfFortuneNaturalHash(original)).toBe(rawHash);
  }
}, 180_000);

function unwrap<T>(result: SliceResult<T>): T {
  if (!result.ok) throw Error(result.error.code + ': ' + result.error.message);
  return result.value;
}

function verifyLastCommandSave(before: SliceState, state: SliceState, view: SliceProjection, last: WheelOfFortuneNaturalActionRow): void {
  const directory = mkdtempSync(join(tmpdir(), 'lotm-wheel-of-fortune226-natural-')), file = join(directory, 'save.sqlite');
  const importedAt = '2026-10-19T00:00:00.000Z', committedAt = '2026-10-19T00:00:01.000Z';
  const request: SliceEnvelope = { intentId: 'wheel-of-fortune226-natural-last', runId: before.runId,
    expectedRevision: before.revision, payload: last.intent };
  expect(last.commandCount).toBe(929); expect(last.intent).toEqual({ type: 'WHEEL_OF_FORTUNE', command: { type: 'REPORT_RETURN' } });
  const requestHash = wheelOfFortuneNaturalHash(request);
  const inspect = () => {
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      const runs = db.prepare('SELECT * FROM slice_runs ORDER BY id').all();
      const raw = String(runs.find(row => row.id === state.runId)!.current_json);
      const hash = (path: string) => existsSync(path) ? wheelOfFortuneNaturalSha(readFileSync(path)) : null;
      return { raw, stored: JSON.parse(JSON.parse(raw).payload) as StoredSlice,
        durable: wheelOfFortuneNaturalHash({ runs, receipts: db.prepare('SELECT * FROM slice_receipts ORDER BY id').all(),
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
      if (fail) throw Error('Injected last natural WheelOfFortune command write failure');
    } });
    store.repository.transaction(() => {
      store!.repository.put({ state: before, updatedAt: importedAt });
      store!.repository.selectRun('previous-selected-slot');
    });
    publishedRevision = store.repository.ownedHead(before.runId)?.revision ?? null;
    if (before.wheelOfFortune.guidanceKnown) expect(publishedRevision).toBe(before.revision);
    const original = inspect();
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
    expect(wheelOfFortuneNaturalHash(request)).toBe(requestHash);
    expect(store.repository.activeRun()).toBe(before.runId);
    const committed = inspect();
    expect(committed.stored).toEqual({ state, updatedAt: committedAt });
    expect(committed.stored.state.random).toEqual(last.after.random);
    expect(wheelOfFortuneNaturalReceipt(committed.stored.state, before)).toEqual(last.receipt);
    expect(unwrap(store.submitIntent(request))).toEqual({ ...receipt, replayed: true });
    expect(attempts).toBe(2); expect(inspect().raw).toBe(committed.raw);
    store.close(); store = undefined;

    store = new SqliteSliceStore(file, { now: () => committedAt });
    expect(unwrap(store.loadRun(state.runId))).toEqual(view);
    expect(unwrap(store.getBootstrap()).activeState).toEqual(view);
    expect(unwrap(store.submitIntent(request))).toEqual({ ...receipt, replayed: true });
    expect(inspect().raw).toBe(committed.raw);
    expect(inspect().stored).toEqual(committed.stored);
    if (state.wheelOfFortune.guidanceKnown) expect(store.repository.ownedHead(state.runId)?.revision).toBe(state.revision);
  } finally { store?.close(); rmSync(directory, { recursive: true, force: true }); }
}

it('replays only the actual new WheelOfFortune commands with exact private/public/RNG hashes, then faults/retries/reopens the last save', () => {
  const summary = readWheelOfFortuneNaturalSummary(), archive = readWheelOfFortuneNaturalSource(), source = archive.final;
  const initial = readWheelOfFortuneNaturalSnapshot('initial'), rows = readWheelOfFortuneNaturalRows();
  assertWheelOfFortuneNaturalRetainedFreeze(summary);
  expect(rows).toHaveLength(summary.commandCount);
  let previous: string | null = null;
  for (const [index, row] of rows.entries()) {
    const { rowSha256, ...payload } = row;
    expect(rowSha256, `row ${index + 1}`).toBe(wheelOfFortuneNaturalHash(payload));
    expect(row.commandSha256).toBe(wheelOfFortuneNaturalHash(row.intent));
    expect(row.commandCount).toBe(index + 1); expect(row.previousRowSha256).toBe(previous);
    if (index < 841) {
      expect(row.kind).toBe('HISTORICAL_COMMAND'); expect(row.intent).toEqual(archive.commands[index]);
    }
    previous = rowSha256;
  }
  let state = migrateSliceState(structuredClone(source)), view = projectSliceState(state);
  for (const [key, value] of Object.entries(source)) if (!['schemaVersion', 'contentVersion'].includes(key))
    expect(state[key as keyof SliceState], `original migration root ${key}`).toEqual(value);
  expect(historicalNaturalState(state, Object.keys(initial.final))).toEqual(initial.final);
  expect(historicalNaturalPublic(view, state, Object.keys(initial.public))).toEqual(initial.public);
  expect(state.wheelOfFortune.guidanceKnown).toBe(false); expect(state.wheelOfFortune.source).toBeNull(); expect(state.wheelOfFortune.journal).toEqual([]);
  let anchor = capturedNaturalAnchor(state, view, initial), before = state;
  expect(anchor).toEqual(initial.anchor);
  const actions = rows.slice(841) as WheelOfFortuneNaturalActionRow[];
  let session: WheelOfFortuneRuntimeSession | undefined;
  for (const [index, row] of actions.entries()) {
    expect(row.kind).toBe('WHEEL_OF_FORTUNE_ACTION'); expect(row.newCount).toBe(index + 1);
    expect(row.before, `before command ${row.commandCount}`).toEqual(anchor);
    expect(row.after.revision).toBe(842 + row.newCount);
    expect(view.status).toBe('ACTIVE'); expect(view.activeEvent).toBeNull(); expect(view.combat).toBeNull();
    expect(view.wheelOfFortune.actions.filter(action => action.preferredAction)).toEqual([row.publicAction]);
    expect(row.publicAction.enabled).toBe(true); expect(row.intent).toEqual({ type: 'WHEEL_OF_FORTUNE', command: row.publicAction.command });
    before = state;
    if (!session) {
      expect(index).toBe(0); expect(row.intent).toEqual({ type: 'WHEEL_OF_FORTUNE', command: { type: 'LEARN_GUIDANCE' } });
      state = applySliceIntent(state, row.intent); session = openWheelOfFortuneRuntimeSession(state);
    } else {
      const draft = session.prepare(row.intent, state.revision);
      expect(session.inspect().revision).toBe(state.revision);
      session.commit(draft); state = session.snapshot();
    }
    view = session.project();
    expect(row.receipt).toEqual(wheelOfFortuneNaturalReceipt(state, before));
    expect(row.actual).toEqual(wheelOfFortuneNaturalOutcome(state));
    expect(state.random.seed).toBe(source.random.seed); expect(state.random.cursor).toBeGreaterThanOrEqual(before.random.cursor);
    anchor = capturedNaturalAnchor(state, view, initial);
    expect(anchor, `after command ${row.commandCount}`).toEqual(row.after);
  }
  const terminal = readWheelOfFortuneNaturalSnapshot('terminal');
  assertValidSliceState(state);
  expect(historicalNaturalState(state, Object.keys(terminal.final))).toEqual(terminal.final);
  expect(historicalNaturalPublic(view, state, Object.keys(terminal.public))).toEqual(terminal.public);
  expect(state.revision).toBe(summary.revision); expect(wheelOfFortuneNaturalOutcome(state)).toEqual(summary.actual);
  expect(state).toMatchObject({ revision: 930, status: 'ACTIVE', week: 216, health: 95, mind: 68,
    spirituality: 32, cash: 70, actionsRemaining: 0, injuries: [],
    progression: { pathwayId: 'wheel', sequence: 0 }, random: { seed: source.random.seed, cursor: 311 } });
  expect(state.wheelOfFortune.journal.flatMap(event => event.randomReceipts).map(({ check }) => [check.chance, check.roll, check.tier]))
    .toEqual([[40, 52, 'FAILURE'], [40, 33, 'SUCCESS'], [70, 66, 'SUCCESS'],
      [74, 47, 'SUCCESS'], [74, 5, 'GREAT_SUCCESS']]);
  expect(anchor.privateStateSha256).toBe(summary.finalPrivateStateSha256);
  expect(anchor.publicStateSha256).toBe(summary.finalWholePublicSha256);
  for (const key of WHEEL_OF_FORTUNE226_FROZEN_ROOTS) expect(state[key], `original ${key}`).toEqual(source[key]);
  for (const [id, mastery] of Object.entries(source.progression.mastery)) expect(state.progression.mastery[id]).toBe(mastery);
  expect(Object.keys(state.progression.mastery).sort()).toEqual([...Object.keys(source.progression.mastery), ...WHEEL_OF_FORTUNE_ABILITY_IDS].sort());
  for (const id of WHEEL_OF_FORTUNE_ABILITY_IDS) expect(state.progression.mastery[id]).toBe(8);
  expect(state.wheelOfFortune.materials!.originals.map(item => item.originalId).sort()).toEqual([...WHEEL_OF_FORTUNE_ORIGINAL_IDS].sort());
  expect(state.wheelOfFortune.source!.acquisition.bottles).toEqual(source.mercurySnake.bottles);
  expect(summary.stage).toBe('NATURAL_S0_REPORTED_EXIT');
  expect(summary.actual).toMatchObject({ status: 'ACTIVE', promoted: true, reported: true, ordinaryExit: true, returnedHome: true });
  const root = state.wheelOfFortune, scene = root.scene!, materials = root.materials!, inherited = root.source!;
  expect(inherited).toMatchObject({ runId: source.runId, revision: source.revision,
    character: source.character, random: source.random });
  expect(inherited.budget.mastery).toEqual(source.progression.mastery);
  expect(inherited.acquisition).toEqual({ bottles: source.mercurySnake.bottles, resupply: source.mercurySnake.resupply,
    acquisitionJournal: source.mercurySnake.acquisitionJournal, promotionWeek: source.mercurySnake.promotionWeek });
  expect(inherited.originals.site).toEqual(getMercurySnakeCurrentSite(source));
  expect(inherited.originals.operation).toEqual(source.mercurySnake.life.operation);
  expect(inherited.originals.luck).toEqual(source.mercurySnake.luck);
  expect(scene.originalOperation).toEqual(inherited.originals.operation);
  expect(scene.originalLuck).toEqual({ stored: 0, lastAccumulateWeek: 176, accumulated: 14, spent: 14 });
  expect(inherited.originalCharacteristics.characteristics.map(item =>
    [item.originalBottleId, item.characteristicId, item.holder]))
    .toEqual([['mercury-snake-potion-1', 'MS226-CHAR-1', 'FAILED_REMNANT'],
      ['mercury-snake-potion-2', 'MS226-CHAR-2', 'EMBODIED'], ['mercury-snake-potion-3', 'MS226-CHAR-3', 'SUPPLIER']]);
  expect(materials.originals).toHaveLength(3);
  for (const original of materials.originals) {
    const initial = inherited.originalCharacteristics.characteristics.find(item => item.originalBottleId === original.originalId)!;
    expect(original).toMatchObject({ characteristicId: initial.characteristicId, latestBottleId: initial.latestBottleId,
      holder: 'FUSED', location: null, compoundId: 'WF226-COMPOUND-1' });
  }
  expect(materials.uniqueness).toMatchObject({ id: 'WF226-UNIQUENESS', holder: 'FUSED', compoundId: 'WF226-COMPOUND-1' });
  expect(materials.carriers.map(item => item.status)).toEqual(['SPENT', 'SUPPLIER', 'SUPPLIER']);
  expect(materials.compounds).toHaveLength(1);
  expect(materials.compounds[0]).toMatchObject({ id: 'WF226-COMPOUND-1', status: 'SUCCESS', carrierId: 'WF226-CARRIER-1',
    originalIds: ['mercury-snake-potion-1', 'mercury-snake-potion-3'], embodiedOriginalId: 'mercury-snake-potion-2',
    uniquenessId: 'WF226-UNIQUENESS' });
  expect(scene).toMatchObject({ phase: 'PRACTICE', status: 'COMPLETED', playerPosition: 'OUTSIDE', contact: false, window: null,
    impactBufferApplied: true, shortReturnApplied: true, exit: { door: 'CLOSED' },
    device: { loadMethod: 'ABILITY', returnMethod: 'ABILITY' },
    load: { id: 'WF226-ORIGINAL-CRATE', position: 'ENTRY', dropCentimetres: 8, version: 1 },
    rope: { id: 'WF226-ORIGINAL-ROPE', integrity: 99, wear: 1 } });
  expect(scene.commissions).toHaveLength(3);
  const commission = scene.commissions[0]!;
  expect(commission.opportunityWeek).toBe(215); expect(commission.reportEventId).toBeTruthy();
  expect(commission.consumedEventId).toBe(materials.compounds[0]!.consumedEventId);
  expect(commission.workers.map(worker => worker.position)).toEqual(['NORTH_DEPOT', 'SOUTH_DEPOT']);
  for (const worker of commission.workers) {
    expect(worker).toMatchObject({ alive: true, health: 100, energy: 75, walkedMetres: 5, consent: 'CLOSED' });
    expect(worker.decisionEventId).toBeTruthy(); expect(worker.handoverEventId).toBeTruthy(); expect(worker.destinationEventId).toBeTruthy();
    expect(worker.cargo).toMatchObject({ id: `${worker.id}-ORIGINAL-CARGO`, originalOwnerId: worker.id,
      holderId: `WF226-RECIPIENT-${worker.destination}`, position: worker.destination, travelMetres: 5 });
    expect(worker.paper).toMatchObject({ id: `${worker.id}-ORIGINAL-PAPER`, originalOwnerId: worker.id,
      holderId: worker.cargo.holderId, location: 'ENTRY', travelMetres: 2 });
  }
  for (const unused of scene.commissions.slice(1)) {
    expect([unused.reportEventId, unused.opportunityWeek, unused.consumedEventId]).toEqual([null, null, null]);
    for (const worker of unused.workers) expect(worker).toMatchObject({ position: 'OUTSIDE', walkedMetres: 0,
      consent: 'UNASKED', decisionEventId: null, handoverEventId: null, destinationEventId: null });
  }
  expect(view.wheelOfFortune.actions.some(action => action.preferredAction)).toBe(false);
  expect(wheelOfFortuneNaturalHash(source)).toBe(WHEEL_OF_FORTUNE226_SOURCE_STATE_SHA);
  // Reuse this replay's real penultimate state, never regenerate or replay original841.
  verifyLastCommandSave(before, state, view, actions.at(-1)!);
}, 900_000);
