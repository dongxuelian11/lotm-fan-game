/** One actual new-action replay; its actual penultimate state feeds one SQLite
 * final-command fault/retry/idempotence/reopen. No old831 replay or RNG seam. */
import { expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { StoredSlice } from '../../src/application/slice-application.js';
import { applySliceIntent, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { openHermitRuntimeSession, type HermitRuntimeSession } from '../../src/domain/hermit/owned-session.js';
import { HERMIT_ABILITY_IDS } from '../../src/domain/hermit/types.js';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import type { SliceEnvelope, SliceResult } from '../../src/shared/slice-contracts.js';
import {
  HERMIT222_FROZEN_ROOTS, HERMIT222_SOURCE_STATE_SHA, assertHermitNaturalRetainedFreeze,
  hermitNaturalHash, hermitNaturalOutcome, hermitNaturalSha, hermitNaturalTerminalPin,
  readHermitNaturalArchive, readHermitNaturalRows, readHermitNaturalSnapshot, readHermitNaturalSource,
  readHermitNaturalSummary, type HermitNaturalActionRow,
} from '../helpers/hermit-natural-capture.js';

import assert from 'node:assert/strict';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { assertEmptyHangedManState, assertEmptyHangedManPublic } from '../helpers/empty-hanged-man-capture.js';
import { assertEmptyAbyssState, assertEmptyAbyssPublic } from '../helpers/empty-abyss-capture.js';
import { assertEmptyChainedState, assertEmptyChainedPublic } from '../helpers/empty-chained-capture.js';
import { assertEmptyWheelOfFortuneState, assertEmptyWheelOfFortunePublic } from '../helpers/empty-wheel-of-fortune-capture.js';
import { assertEmptyBlackEmperorState, assertEmptyBlackEmperorPublic } from '../helpers/empty-black-emperor-capture.js';
import { assertEmptyJusticiarState, assertEmptyJusticiarPublic } from '../helpers/empty-justiciar-capture.js';
import { assertEmptyMotherState, assertEmptyMotherPublic } from '../helpers/empty-mother-capture.js';

/** Raw219 captures stay immutable. Only these named, exactly empty later roots
 * and format metadata are removed from detached historical hash views. */
const LATER_EMPTY_ROOTS = ['hangedMan', 'abyss', 'chained', 'wheelOfFortune', 'blackEmperor', 'justiciar', 'mother'] as const;
function historicalNaturalState(state: SliceState, originalKeys: readonly string[]) {
  assert.deepEqual([state.schemaVersion, state.contentVersion], [CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  for (const root of LATER_EMPTY_ROOTS) assert.equal(originalKeys.includes(root), false);
  assert.deepEqual(Object.keys(state).sort(), [...originalKeys, ...LATER_EMPTY_ROOTS].sort());
  assertEmptyHangedManState(state);
  assertEmptyAbyssState(state);
  assertEmptyChainedState(state);
  assertEmptyWheelOfFortuneState(state);
  assertEmptyBlackEmperorState(state);
  assertEmptyJusticiarState(state);
  assertEmptyMotherState(state);
  const { hangedMan: _emptyHangedMan, abyss: _emptyAbyss, chained: _emptyChained,
    wheelOfFortune: _emptyWheelOfFortune, blackEmperor: _emptyBlackEmperor, justiciar: _emptyJusticiar,
    mother: _emptyMother, ...originalFields } = state;
  return { ...originalFields, schemaVersion: 219, contentVersion: 'hermit-v219' };
}
function historicalNaturalPublic(view: SliceProjection, state: SliceState, originalKeys: readonly string[]) {
  for (const root of LATER_EMPTY_ROOTS) assert.equal(originalKeys.includes(root), false);
  assert.deepEqual(Object.keys(view).sort(), [...originalKeys, ...LATER_EMPTY_ROOTS].sort());
  assertEmptyHangedManState(state);
  assertEmptyAbyssState(state);
  assertEmptyChainedState(state);
  assertEmptyWheelOfFortuneState(state);
  assertEmptyBlackEmperorState(state);
  assertEmptyJusticiarState(state);
  assertEmptyMotherState(state);
  assertEmptyHangedManPublic(view, state);
  assertEmptyAbyssPublic(view, state);
  assertEmptyChainedPublic(view, state);
  assertEmptyWheelOfFortunePublic(view, state);
  assertEmptyBlackEmperorPublic(view, state);
  assertEmptyJusticiarPublic(view, state);
  assertEmptyMotherPublic(view, state);
  const { hangedMan: _emptyHangedMan, abyss: _emptyAbyss, chained: _emptyChained,
    wheelOfFortune: _emptyWheelOfFortune, blackEmperor: _emptyBlackEmperor, justiciar: _emptyJusticiar,
    mother: _emptyMother, ...originalFields } = view;
  return originalFields;
}
function capturedNaturalAnchor(state: SliceState, view: SliceProjection,
  original: { final: SliceState; public: SliceProjection }) {
  return { revision: state.revision,
    privateStateSha256: hermitNaturalHash(historicalNaturalState(state, Object.keys(original.final))),
    publicStateSha256: hermitNaturalHash(historicalNaturalPublic(view, state, Object.keys(original.public))),
    random: state.random, randomSha256: hermitNaturalHash(state.random) };
}

it('audits current-schema initial and terminal snapshots without replay', () => {
  for (const which of ['initial', 'terminal'] as const) {
    const original = readHermitNaturalSnapshot(which), rawHash = hermitNaturalHash(original);
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
    expect(hermitNaturalHash(historicalNaturalState({ ...state, cash: state.cash + 1 }, stateKeys)))
      .not.toBe(original.anchor.privateStateSha256);
    expect(hermitNaturalHash(historicalNaturalPublic({ ...view, cash: view.cash + 1 }, state, publicKeys)))
      .not.toBe(original.anchor.publicStateSha256);
    expect(hermitNaturalHash(original)).toBe(rawHash);
  }
}, 180_000);

function unwrap<T>(result: SliceResult<T>): T {
  if (!result.ok) throw Error(result.error.code + ': ' + result.error.message);
  return result.value;
}
interface Replay { before: SliceState; final: SliceState; public: SliceProjection; last: HermitNaturalActionRow }

function replayCapturedNatural(): Replay {
  const summary = readHermitNaturalSummary(), source = readHermitNaturalSource();
  const archive = readHermitNaturalArchive(), initial = readHermitNaturalSnapshot('initial');
  assertHermitNaturalRetainedFreeze(summary);
  const rows = readHermitNaturalRows();
  expect(rows).toHaveLength(summary.commandCount);
  let previous: string | null = null;
  for (const [index, row] of rows.entries()) {
    const { rowSha256, ...payload } = row;
    expect(rowSha256, `row ${index + 1}`).toBe(hermitNaturalHash(payload));
    expect(row.commandSha256).toBe(hermitNaturalHash(row.intent));
    expect(row.commandCount).toBe(index + 1); expect(row.previousRowSha256).toBe(previous);
    if (index < 827) {
      expect(row.kind).toBe('HISTORICAL_COMMAND'); expect(row.intent).toEqual(archive.commands[index]);
    }
    previous = rowSha256;
  }
  let state = migrateSliceState(structuredClone(source)), view = projectSliceState(state);
  expect(historicalNaturalState(state, Object.keys(initial.final))).toEqual(initial.final);
  expect(historicalNaturalPublic(view, state, Object.keys(initial.public))).toEqual(initial.public);
  for (const [key, value] of Object.entries(source)) if (!['schemaVersion', 'contentVersion'].includes(key))
    expect(state[key as keyof SliceState], `migrated original ${key}`).toEqual(value);
  let anchor = capturedNaturalAnchor(state, view, initial), before = state;
  expect(anchor).toEqual(initial.anchor);
  const actions = rows.slice(827) as HermitNaturalActionRow[];
  let session: HermitRuntimeSession | undefined;
  for (const [index, row] of actions.entries()) {
    expect(row.kind).toBe('HERMIT_ACTION'); expect(row.newCount).toBe(index + 1);
    expect(row.before, `before command ${row.commandCount}`).toEqual(anchor);
    expect(row.after.revision).toBe(828 + row.newCount);
    expect(view.hermit.actions.filter(action => action.preferredAction)).toEqual([row.publicAction]);
    expect(row.publicAction.enabled).toBe(true);
    expect(row.intent).toEqual({ type: 'HERMIT', command: row.publicAction.command });
    before = state;
    if (!session) {
      expect(row.commandCount).toBe(828);
      expect(row.intent).toEqual({ type: 'HERMIT', command: { type: 'LEARN_GUIDANCE' } });
      state = applySliceIntent(state, row.intent);
      expect(row.receipt).toEqual({ id: null, checks: [], finance: [], notes: state.chronicle.slice(before.chronicle.length) });
      session = openHermitRuntimeSession(state);
    } else {
      const draft = session.prepare(row.intent, state.revision);
      expect(session.inspect().revision).toBe(state.revision);
      session.commit(draft); state = session.snapshot();
      const last = state.hermit.journal.at(-1)!;
      expect(row.receipt).toEqual({ id: last.id, checks: last.randomReceipts, finance: last.financeReceipts,
        notes: last.notes, beforeDigest: last.beforeDigest, afterDigest: last.afterDigest });
    }
    view = session.project(); anchor = capturedNaturalAnchor(state, view, initial);
    expect(anchor, `after command ${row.commandCount}`).toEqual(row.after);
    expect(state.random.seed).toBe(source.random.seed);
    expect(state.random.cursor).toBeGreaterThanOrEqual(before.random.cursor);
    expect(hermitNaturalOutcome(state)).toEqual(row.actual);
  }
  const terminal = readHermitNaturalSnapshot('terminal');
  expect(historicalNaturalState(state, Object.keys(terminal.final))).toEqual(terminal.final);
  expect(historicalNaturalPublic(view, state, Object.keys(terminal.public))).toEqual(terminal.public);
  expect(actions.reduce((count, row) => count + row.receipt.checks.length, 0)).toBe(hermitNaturalTerminalPin().checkCount);
  expect(actions.flatMap(row => row.receipt.checks.map(item => ({ command: row.commandCount,
    chance: item.check.chance, roll: item.check.roll, tier: item.check.tier,
    before: item.cursorBefore, after: item.cursorAfter })))).toEqual([
    { command: 869, chance: 40, roll: 30, tier: 'SUCCESS', before: 346, after: 347 },
    { command: 876, chance: 40, roll: 11, tier: 'SUCCESS', before: 347, after: 348 },
    { command: 895, chance: 70, roll: 20, tier: 'SUCCESS', before: 348, after: 349 },
  ]);
  for (const key of [...HERMIT222_FROZEN_ROOTS, 'world', 'combatHistory'] as const)
    expect(state[key], `original ${key}`).toEqual(source[key]);
  // The actual Hermit engine has no S0 core-stat increment.
  expect(state.character).toEqual(source.character); expect(state.hermit.source!.character).toEqual(source.character);
  expect(Object.keys(source.progression.mastery)).toHaveLength(15);
  for (const [id, mastery] of Object.entries(source.progression.mastery)) expect(state.progression.mastery[id]).toBe(mastery);
  expect(Object.keys(state.progression.mastery).sort()).toEqual([...Object.keys(source.progression.mastery),
    ...(state.progression.sequence === 0 ? HERMIT_ABILITY_IDS : [])].sort());
  for (const id of HERMIT_ABILITY_IDS) expect(state.progression.mastery[id]).toBe(8);
  expect(state.progression.mastery['hermit.s1.knowledge-power']).toBe(0);
  expect(state.progression.mastery['hermit.s1.power-knowledge']).toBe(0);
  expect(hermitNaturalHash(source)).toBe(HERMIT222_SOURCE_STATE_SHA);
  expect(hermitNaturalOutcome(state)).toEqual(summary.actual);
  expect(view.hermit.promoted).toBe(summary.actual.promoted); expect(state.revision).toBe(summary.revision);
  expect(state).toMatchObject({ status: 'ACTIVE', revision: 942, week: 205, date: { year: 1353, month: 5, day: 26 },
    health: 100, mind: 79, spirituality: 63, cash: 45, actionsRemaining: 2,
    random: { seed: 'pryer-natural-v048', cursor: 349 }, progression: { pathwayId: 'hermit', sequence: 0 },
    hermit: { promotionWeek: 202, frame: { location: 'HM222-ARCHIVE-OUTSIDE' },
      scene: { phase: 'PRACTICE', status: 'COMPLETED', playerPosition: 'OUTSIDE', body: 'SOLID',
        informationCompleted: true, transferCompleted: true, manualCopyCompleted: false } } });
  expect(view.maxSpirituality).toBe(150);
  if (state.status === 'DEAD') {
    expect(summary.stage).toBe('NATURAL_DEATH'); expect(state.ending?.kind).toBe('DEATH'); expect(view.canAct).toBe(false);
  } else {
    expect(summary.stage).toBe('NATURAL_S0_RETURN_REPORTED');
    expect(summary.actual).toMatchObject({ reported: true, ordinaryExit: true, originalReturned: true, returnedHome: true });
    expect(view.hermit.actions.some(action => action.preferredAction)).toBe(false);
  }
  return { before, final: state, public: view, last: actions.at(-1)! };
}

function assertLastCommandSave({ before, final: state, public: view, last }: Replay): void {
  const initial = readHermitNaturalSnapshot('initial');
  expect(capturedNaturalAnchor(before, projectSliceState(before), initial)).toEqual(last.before);
  expect(capturedNaturalAnchor(state, view, initial)).toEqual(last.after);
  const directory = mkdtempSync(join(tmpdir(), 'lotm-hermit222-natural-')), file = join(directory, 'save.sqlite');
  const importedAt = '2026-10-19T00:00:00.000Z', committedAt = '2026-10-19T00:00:01.000Z';
  const request: SliceEnvelope = { intentId: 'hermit222-natural-last', runId: before.runId,
    expectedRevision: before.revision, payload: last.intent };
  const requestHash = hermitNaturalHash(request);
  const inspect = () => {
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      const runs = db.prepare('SELECT * FROM slice_runs ORDER BY id').all();
      const raw = String(runs.find(row => row.id === state.runId)!.current_json);
      const hash = (path: string) => existsSync(path) ? hermitNaturalSha(readFileSync(path)) : null;
      return { raw, stored: JSON.parse(JSON.parse(raw).payload) as StoredSlice,
        durable: hermitNaturalHash({ runs, receipts: db.prepare('SELECT * FROM slice_receipts ORDER BY id').all(),
          meta: db.prepare('SELECT * FROM slice_meta ORDER BY key').all(), backup: hash(file + '.bak'),
          sealed: hash(file + '.sealed'), files: readdirSync(dirname(file)).sort() }) };
    } finally { db.close(); }
  };
  let store: SqliteSliceStore | undefined, watching = false, fail = true, attempts = 0;
  let stagedAssertionError: unknown;
  try {
    store = new SqliteSliceStore(file, { now: () => committedAt, beforeWrite: () => {
      if (!watching) return;
      attempts++;
      try {
        expect(store!.repository.ownedHead(before.runId)?.revision).toBe(before.revision);
        expect(store!.repository.get(before.runId)).toEqual({ state, updatedAt: committedAt });
        expect(store!.repository.receipt(request.intentId)?.receipt.newRevision).toBe(state.revision);
      } catch (error) { stagedAssertionError = error; throw error; }
      if (fail) throw Error('Injected last natural Hermit command write failure');
    } });
    store.repository.transaction(() => {
      store!.repository.put({ state: before, updatedAt: importedAt }); store!.repository.selectRun('previous-selected-slot');
    });
    expect(store.repository.ownedHead(before.runId)?.revision).toBe(before.revision);
    const original = inspect();
    watching = true;
    try { expect(store.submitIntent(request)).toMatchObject({ ok: false, error: { code: 'SAVE_FAILED' } }); }
    finally { watching = false; }
    if (stagedAssertionError) throw stagedAssertionError;
    expect(attempts).toBe(1); expect(inspect()).toEqual(original);
    expect(store.repository.receipt(request.intentId)).toBeNull();
    expect(store.repository.activeRun()).toBe('previous-selected-slot');
    expect(store.repository.ownedHead(before.runId)?.revision).toBe(before.revision);

    fail = false; watching = true;
    const receipt = unwrap(store.submitIntent(request)); watching = false;
    expect(receipt).toMatchObject({ intentId: request.intentId, previousRevision: before.revision,
      newRevision: state.revision, committedAt, replayed: false });
    expect(receipt.state).toEqual(view); expect(attempts).toBe(2); expect(hermitNaturalHash(request)).toBe(requestHash);
    expect(store.repository.activeRun()).toBe(before.runId);
    const committed = inspect(); expect(committed.stored).toEqual({ state, updatedAt: committedAt });
    expect(unwrap(store.submitIntent(request))).toEqual({ ...receipt, replayed: true }); expect(attempts).toBe(2);
    expect(inspect()).toEqual(committed);
    store.close(); store = undefined;

    store = new SqliteSliceStore(file, { now: () => committedAt });
    expect(unwrap(store.loadRun(state.runId))).toEqual(view); expect(unwrap(store.getBootstrap()).activeState).toEqual(view);
    expect(unwrap(store.submitIntent(request))).toEqual({ ...receipt, replayed: true });
    if (state.status === 'DEAD') {
      expect(store.submitIntent({ ...request, intentId: 'hermit222-after-death', expectedRevision: state.revision }))
        .toMatchObject({ ok: false, error: { code: 'ARCHIVED' } });
      expect(JSON.parse(readFileSync(file + '.sealed', 'utf8'))).toContain(state.runId);
    }
    expect(inspect().raw).toBe(committed.raw); expect(store.repository.ownedHead(state.runId)?.revision).toBe(state.revision);
  } finally { store?.close(); rmSync(directory, { recursive: true, force: true }); }
}

it('replays every actual Hermit command/private/public/RNG boundary once, then faults and reopens the same last command', () => {
  assertLastCommandSave(replayCapturedNatural());
}, 300_000);
