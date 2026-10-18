/** One actual new-command replay; its actual penultimate state feeds one
 * last-command SQLite fault/retry/idempotence/reopen. No historical replay or RNG seam. */
import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { StoredSlice } from '../../src/application/slice-application.js';
import { applySliceIntent, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { openTwilightGiantRuntimeSession, type TwilightGiantRuntimeSession } from '../../src/domain/twilight-giant/owned-session.js';
import { TWILIGHT_GIANT_ABILITY_IDS } from '../../src/domain/twilight-giant/types.js';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import type { SliceEnvelope, SliceResult } from '../../src/shared/slice-contracts.js';
import {
  TWILIGHT220_FROZEN_ROOTS, TWILIGHT220_SOURCE_STATE_SHA, assertTwilightNaturalRetainedFreeze,
  currentTwilightNaturalAnchor, historicalTwilightNaturalPublic, historicalTwilightNaturalState,
  readTwilightNaturalArchive, readTwilightNaturalRows, readTwilightNaturalSnapshot,
  readTwilightNaturalSource, readTwilightNaturalSummary, readTwilightNaturalSnapshotAt, twilightNaturalHash, twilightNaturalSha,
  type TwilightNaturalActionRow,
} from '../helpers/twilight-giant-natural-capture.js';

function unwrap<T>(result: SliceResult<T>): T {
  if (!result.ok) throw Error(result.error.code + ': ' + result.error.message);
  return result.value;
}
let replay: { before: SliceState; final: SliceState; public: SliceProjection; last: TwilightNaturalActionRow };

function replayCapturedNatural() {
  const summary = readTwilightNaturalSummary(), source = readTwilightNaturalSource();
  const archive = readTwilightNaturalArchive(), initial = readTwilightNaturalSnapshot('initial');
  assertTwilightNaturalRetainedFreeze(summary);
  const rows = readTwilightNaturalRows();
  expect(rows).toHaveLength(summary.commandCount);
  let previous: string | null = null;
  for (const [index, row] of rows.entries()) {
    const { rowSha256, ...payload } = row;
    expect(rowSha256, `row ${index + 1}`).toBe(twilightNaturalHash(payload));
    expect(row.commandSha256).toBe(twilightNaturalHash(row.intent));
    expect(row.commandCount).toBe(index + 1);
    expect(row.previousRowSha256).toBe(previous);
    if (index < 287) {
      expect(row.kind).toBe('HISTORICAL_COMMAND');
      expect(row.intent).toEqual(archive.commands[index]);
    }
    previous = rowSha256;
  }
  let state = migrateSliceState(structuredClone(source)), view = projectSliceState(state);
  expect(historicalTwilightNaturalState(state, Object.keys(initial.final))).toEqual(initial.final);
  expect(historicalTwilightNaturalPublic(view, state, Object.keys(initial.public))).toEqual(initial.public);
  let anchor = currentTwilightNaturalAnchor(state, view, initial), before = state;
  expect(anchor).toEqual(initial.anchor);
  const actions = rows.slice(287) as TwilightNaturalActionRow[];
  let session: TwilightGiantRuntimeSession | undefined;
  for (const [index, row] of actions.entries()) {
    expect(row.kind).toBe('TWILIGHT_GIANT_ACTION');
    expect(row.newCount).toBe(index + 1);
    expect(row.before, `before command ${row.commandCount}`).toEqual(anchor);
    expect(row.after.revision).toBe(729 + row.newCount);
    expect(view.twilightGiant.actions.filter(action => action.preferredAction)).toEqual([row.publicAction]);
    expect(row.publicAction.enabled).toBe(true);
    expect(row.intent).toEqual({ type: 'TWILIGHT_GIANT', command: row.publicAction.command });
    before = state;
    if (!session) {
      expect(index).toBe(0);
      expect(row.intent).toEqual({ type: 'TWILIGHT_GIANT', command: { type: 'LEARN_GUIDANCE' } });
      state = applySliceIntent(state, row.intent);
      expect(row.receipt).toEqual({ id: null, checks: [], finance: [], notes: state.chronicle.slice(before.chronicle.length) });
      session = openTwilightGiantRuntimeSession(state);
    } else {
      const draft = session.prepare(row.intent, state.revision);
      expect(session.inspect().revision).toBe(state.revision);
      session.commit(draft);
      state = session.snapshot();
      const last = state.twilightGiant.journal.at(-1)!;
      expect(row.receipt).toEqual({ id: last.id, checks: last.randomReceipts, finance: last.financeReceipts,
        notes: last.notes, beforeDigest: last.beforeDigest, afterDigest: last.afterDigest });
    }
    view = session.project();
    anchor = currentTwilightNaturalAnchor(state, view, initial);
    expect(anchor, `after command ${row.commandCount}`).toEqual(row.after);
  }
  const terminal = readTwilightNaturalSnapshot('terminal');
  expect(historicalTwilightNaturalState(state, Object.keys(terminal.final))).toEqual(terminal.final);
  expect(historicalTwilightNaturalPublic(view, state, Object.keys(terminal.public))).toEqual(terminal.public);
  for (const key of [...TWILIGHT220_FROZEN_ROOTS, 'world', 'combatHistory'] as const)
    expect(state[key], `original ${key}`).toEqual(source[key]);
  expect(state.twilightGiant.source!.character).toEqual(source.character);
  const character = structuredClone(source.character);
  if (state.progression.sequence === 0) {
    for (const key of Object.keys(character.coreStats) as (keyof typeof character.coreStats)[])
      character.coreStats[key] = Math.min(500, character.coreStats[key] + 1);
  }
  expect(state.character).toEqual(character);
  expect(Object.keys(source.progression.mastery)).toHaveLength(22);
  for (const [id, mastery] of Object.entries(source.progression.mastery)) expect(state.progression.mastery[id]).toBe(mastery);
  expect(Object.keys(state.progression.mastery).sort()).toEqual([...Object.keys(source.progression.mastery),
    ...(state.progression.sequence === 0 ? TWILIGHT_GIANT_ABILITY_IDS : [])].sort());
  expect(summary.actual.giantApplied).toBe(state.twilightGiant.epilogue?.giant.applied ?? false);
  expect(summary.actual.twilightApplied).toBe(state.twilightGiant.epilogue?.twilight.applied ?? false);
  for (const [index, id] of TWILIGHT_GIANT_ABILITY_IDS.entries()) {
    const applied = index === 0 ? summary.actual.giantApplied : summary.actual.twilightApplied;
    expect(state.progression.mastery[id]).toBe(state.progression.sequence === 0 ? applied ? 8 : 0 : undefined);
  }
  expect(twilightNaturalHash(source)).toBe(TWILIGHT220_SOURCE_STATE_SHA);
  replay = { before, final: state, public: view, last: actions.at(-1)! };
}

describe('Twilight220 actual natural terminal', () => {
  it('matches every actual private/public/RNG boundary and the captured outcome without replaying old297', () => {
    replayCapturedNatural();
    const summary = readTwilightNaturalSummary(), { final: state, public: view } = replay;
    expect(state.revision).toBe(summary.revision);
    expect(state.status).toBe(summary.actual.status);
    expect(state.progression.sequence).toBe(summary.actual.sequence);
    expect(state.random.seed).toBe('warrior-natural-v042');
    expect(view.twilightGiant.promoted).toBe(summary.actual.promoted);
    expect(state.twilightGiant.frame!.location).toBe(summary.actual.location);
    if (state.status === 'DEAD') {
      expect(summary.stage).toBe('NATURAL_DEATH');
      expect(state.ending?.kind).toBe('DEATH');
      expect(view.canAct).toBe(false);
    } else {
      expect(summary.stage).toBe('NATURAL_S0_REPORTED_EXIT');
      expect(summary.actual).toMatchObject({ promoted: true, reported: true, ordinaryExit: true,
        returnedHome: false, location: 'GL2-REPAIR-ROOM' });
      expect(state.twilightGiant.epilogue).toMatchObject({ reported: true, position: -2 });
      expect(state.twilightGiant.epilogue!.workers.every(worker => worker.position === -2)).toBe(true);
      expect(view.twilightGiant.actions.some(action => action.preferredAction)).toBe(false);
    }
  }, 300_000);

  it('faults the actual last command once, retries unchanged, then cold reopens the identical terminal and receipt', () => {
    const summary = readTwilightNaturalSummary(), terminal = readTwilightNaturalSnapshot('terminal');
    const penultimate = readTwilightNaturalSnapshotAt(summary.commandCount - 1);
    const before = migrateSliceState(structuredClone(penultimate.final));
    const state = migrateSliceState(structuredClone(terminal.final)), view = projectSliceState(state);
    const last = readTwilightNaturalRows().at(-1)! as TwilightNaturalActionRow;
    expect(currentTwilightNaturalAnchor(before, projectSliceState(before), penultimate)).toEqual(last.before);
    expect(currentTwilightNaturalAnchor(state, view, terminal)).toEqual(last.after);
    const directory = mkdtempSync(join(tmpdir(), 'lotm-twilight220-natural-')), file = join(directory, 'save.sqlite');
    const importedAt = '2026-10-18T22:00:00.000Z', committedAt = '2026-10-18T22:00:01.000Z';
    const request: SliceEnvelope = { intentId: 'twilight220-natural-last', runId: before.runId,
      expectedRevision: before.revision, payload: last.intent };
    const requestHash = twilightNaturalHash(request);
    const inspect = () => {
      const db = new DatabaseSync(file, { readOnly: true });
      try {
        const runs = db.prepare('SELECT * FROM slice_runs ORDER BY id').all();
        const raw = String(runs.find(row => row.id === state.runId)!.current_json);
        const hash = (path: string) => existsSync(path) ? twilightNaturalSha(readFileSync(path)) : null;
        return { raw, stored: JSON.parse(JSON.parse(raw).payload) as StoredSlice,
          durable: twilightNaturalHash({ runs, receipts: db.prepare('SELECT * FROM slice_receipts ORDER BY id').all(),
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
        if (fail) throw Error('Injected last natural Twilight command write failure');
      } });
      store.repository.transaction(() => {
        store!.repository.put({ state: before, updatedAt: importedAt });
        store!.repository.selectRun('previous-selected-slot');
      });
      expect(store.repository.ownedHead(before.runId)?.revision).toBe(before.revision);
      const original = inspect();
      watching = true;
      try { expect(store.submitIntent(request)).toMatchObject({ ok: false, error: { code: 'SAVE_FAILED' } }); }
      finally { watching = false; }
      if (stagedAssertionError) throw stagedAssertionError;
      expect(attempts).toBe(1);
      expect(inspect()).toEqual(original);
      expect(store.repository.receipt(request.intentId)).toBeNull();
      expect(store.repository.activeRun()).toBe('previous-selected-slot');
      expect(store.repository.ownedHead(before.runId)?.revision).toBe(before.revision);

      fail = false; watching = true;
      const receipt = unwrap(store.submitIntent(request));
      watching = false;
      expect(receipt).toMatchObject({ intentId: request.intentId, previousRevision: before.revision,
        newRevision: state.revision, committedAt, replayed: false });
      expect(receipt.state).toEqual(view);
      expect(attempts).toBe(2);
      expect(twilightNaturalHash(request)).toBe(requestHash);
      expect(store.repository.activeRun()).toBe(before.runId);
      const committed = inspect();
      expect(committed.stored).toEqual({ state, updatedAt: committedAt });
      expect(unwrap(store.submitIntent(request))).toEqual({ ...receipt, replayed: true });
      expect(attempts).toBe(2);
      store.close(); store = undefined;

      store = new SqliteSliceStore(file, { now: () => committedAt });
      expect(unwrap(store.loadRun(state.runId))).toEqual(view);
      expect(unwrap(store.getBootstrap()).activeState).toEqual(view);
      expect(unwrap(store.submitIntent(request))).toEqual({ ...receipt, replayed: true });
      if (state.status === 'DEAD') {
        expect(store.submitIntent({ ...request, intentId: 'twilight220-after-death', expectedRevision: state.revision }))
          .toMatchObject({ ok: false, error: { code: 'ARCHIVED' } });
        expect(JSON.parse(readFileSync(file + '.sealed', 'utf8'))).toContain(state.runId);
      }
      expect(inspect().raw).toBe(committed.raw);
      expect(store.repository.ownedHead(state.runId)?.revision).toBe(state.revision);
    } finally { store?.close(); rmSync(directory, { recursive: true, force: true }); }
  }, 180_000);
});
