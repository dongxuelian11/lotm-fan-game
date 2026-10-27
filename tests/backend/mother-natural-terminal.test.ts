/** One actual new-command replay and one actual final-command SQLite rollback,
 * identical-intent retry/idempotency and cold reopen. Original955 are checked
 * only as ordered bytes, never executed; no controlled RNG, route or DB matrix. */
import { expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { StoredSlice } from '../../src/application/slice-application.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { openMotherRuntimeSession, type MotherRuntimeSession } from '../../src/domain/mother/owned-session.js';
import { MOTHER_ABILITY_IDS, MOTHER_ORIGINAL_IDS } from '../../src/domain/mother/content.js';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import type { SliceEnvelope, SliceResult } from '../../src/shared/slice-contracts.js';
import {
  MOTHER229_PREFIX_COUNT, MOTHER229_SOURCE_REVISION, MOTHER229_SOURCE_STATE_SHA, MOTHER229_FROZEN_ROOTS,
  assertMotherNaturalPublic, assertMotherNaturalRetainedFreeze, motherNaturalAnchor, motherNaturalHash, motherNaturalOutcome,
  motherNaturalPins, motherNaturalReceipt, motherNaturalRolls, motherNaturalSha, motherNaturalStateFacts,
  readMotherNaturalRows, readMotherNaturalSnapshot, readMotherNaturalSource,
  readMotherNaturalSummary, type MotherNaturalActionRow,
} from '../helpers/mother-natural-capture.js';

function unwrap<T>(result: SliceResult<T>): T {
  if (!result.ok) throw Error(result.error.code + ': ' + result.error.message);
  return result.value;
}

function verifyLastCommandSave(before: SliceState, state: SliceState, view: SliceProjection, last: MotherNaturalActionRow): void {
  const directory = mkdtempSync(join(tmpdir(), 'lotm-mother229-natural-')), file = join(directory, 'save.sqlite');
  const importedAt = '2026-10-19T00:00:00.000Z', committedAt = '2026-10-19T00:00:01.000Z';
  const request: SliceEnvelope = { intentId: 'mother229-natural-last', runId: before.runId,
    expectedRevision: before.revision, payload: last.intent };
  expect(last.after.revision).toBe(state.revision); expect(last.before.revision).toBe(before.revision);
  expect(last.commandCount).toBe(motherNaturalPins().commandCount);
  expect(last.intent).toEqual(motherNaturalPins().lastIntent);
  const requestHash = motherNaturalHash(request);
  const inspect = () => {
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      const runs = db.prepare('SELECT * FROM slice_runs ORDER BY id').all();
      const raw = String(runs.find(row => row.id === state.runId)!.current_json);
      const hash = (path: string) => existsSync(path) ? motherNaturalSha(readFileSync(path)) : null;
      return { raw, stored: JSON.parse(JSON.parse(raw).payload) as StoredSlice,
        durable: motherNaturalHash({ runs, receipts: db.prepare('SELECT * FROM slice_receipts ORDER BY id').all(),
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
      if (fail) throw Error('Injected last natural Mother command write failure');
    } });
    store.repository.transaction(() => {
      store!.repository.put({ state: before, updatedAt: importedAt });
      store!.repository.selectRun('previous-selected-slot');
    });
    publishedRevision = store.repository.ownedHead(before.runId)?.revision ?? null;
    if (before.mother.guidanceKnown) expect(publishedRevision).toBe(before.revision);
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
    expect(motherNaturalHash(request)).toBe(requestHash);
    expect(store.repository.activeRun()).toBe(before.runId);
    const committed = inspect();
    expect(committed.stored).toEqual({ state, updatedAt: committedAt });
    expect(committed.stored.state.random).toEqual(last.after.random);
    expect(motherNaturalReceipt(committed.stored.state, before)).toEqual(last.receipt);
    expect(unwrap(store.submitIntent(request))).toEqual({ ...receipt, replayed: true });
    expect(attempts).toBe(2); expect(inspect().raw).toBe(committed.raw);
    store.close(); store = undefined;

    store = new SqliteSliceStore(file, { now: () => committedAt });
    expect(unwrap(store.loadRun(state.runId))).toEqual(view);
    expect(unwrap(store.getBootstrap()).activeState).toEqual(view);
    expect(unwrap(store.submitIntent(request))).toEqual({ ...receipt, replayed: true });
    expect(inspect().raw).toBe(committed.raw);
    expect(inspect().stored).toEqual(committed.stored);
    if (state.mother.guidanceKnown) expect(store.repository.ownedHead(state.runId)?.revision).toBe(state.revision);
  } finally { store?.close(); rmSync(directory, { recursive: true, force: true }); }
}

it('replays only the actual new Mother commands with exact private/public/RNG hashes and recovers its final SQLite save', () => {
  const pins = motherNaturalPins(), summary = readMotherNaturalSummary(), archive = readMotherNaturalSource(), source = archive.final;
  const initial = readMotherNaturalSnapshot('initial'), rows = readMotherNaturalRows();
  assertMotherNaturalRetainedFreeze(summary); expect(rows).toHaveLength(summary.commandCount);
  let previous: string | null = null;
  for (const [index, row] of rows.entries()) {
    const { rowSha256, ...payload } = row;
    expect(rowSha256, `row ${index + 1}`).toBe(motherNaturalHash(payload));
    expect(row.commandSha256).toBe(motherNaturalHash(row.intent));
    expect(row.commandCount).toBe(index + 1); expect(row.previousRowSha256).toBe(previous);
    if (index < MOTHER229_PREFIX_COUNT) {
      expect(row.kind).toBe('HISTORICAL_COMMAND'); expect(row.intent).toEqual(archive.commands[index]);
    }
    previous = rowSha256;
  }
  let state = migrateSliceState(structuredClone(source)), view = projectSliceState(state);
  for (const [key, value] of Object.entries(source)) if (!['schemaVersion', 'contentVersion'].includes(key))
    expect(state[key as keyof SliceState], `original migration root ${key}`).toEqual(value);
  expect(state).toEqual(initial.final); expect(view).toEqual(initial.public);
  expect(state.mother.guidanceKnown).toBe(false); expect(state.mother.source).toBeNull(); expect(state.mother.journal).toEqual([]);
  let anchor = motherNaturalAnchor(state, view), before = state;
  expect(anchor).toEqual(initial.anchor); assertMotherNaturalPublic(view, state);
  const actions = rows.slice(MOTHER229_PREFIX_COUNT) as MotherNaturalActionRow[];
  expect(actions).toHaveLength(summary.newCount);
  let session: MotherRuntimeSession | undefined;
  for (const [index, row] of actions.entries()) {
    expect(row.kind).toBe('MOTHER_ACTION'); expect(row.newCount).toBe(index + 1);
    expect(row.before, `before command ${row.commandCount}`).toEqual(anchor);
    expect(row.after.revision).toBe(MOTHER229_SOURCE_REVISION + row.newCount);
    expect(view.status).toBe('ACTIVE'); expect(view.activeEvent).toBeNull(); expect(view.combat).toBeNull();
    expect(view.mother.actions.filter(action => action.preferredAction)).toEqual([row.publicAction]);
    expect(row.publicAction.enabled).toBe(true); expect(row.intent).toEqual({ type: 'MOTHER', command: row.publicAction.command });
    before = state;
    if (!session) {
      expect(index).toBe(0); expect(row.intent).toEqual({ type: 'MOTHER', command: { type: 'LEARN_GUIDANCE' } });
      state = applySliceIntent(state, row.intent); session = openMotherRuntimeSession(state);
    } else {
      const draft = session.prepare(row.intent, state.revision);
      expect(session.inspect().revision).toBe(state.revision);
      session.commit(draft); state = session.snapshot();
    }
    view = session.project(); assertMotherNaturalPublic(view, state);
    expect(row.receipt).toEqual(motherNaturalReceipt(state, before));
    expect(row.actual).toEqual(motherNaturalOutcome(state));
    expect(state.random.seed).toBe(source.random.seed); expect(state.random.cursor).toBeGreaterThanOrEqual(before.random.cursor);
    anchor = motherNaturalAnchor(state, view);
    expect(anchor, `after command ${row.commandCount}`).toEqual(row.after);
  }
  const terminal = readMotherNaturalSnapshot('terminal');
  assertValidSliceState(state);
  expect(state).toEqual(terminal.final); expect(view).toEqual(terminal.public);
  expect(motherNaturalStateFacts(state)).toEqual(pins.state); expect(motherNaturalOutcome(state)).toEqual(pins.actual);
  expect(motherNaturalRolls(state)).toEqual(pins.rolls);
  expect(state.mother.source ? motherNaturalHash(state.mother.source) : null).toBe(pins.handoffSourceSha256);
  expect(state.revision).toBe(summary.revision);
  expect(anchor.privateStateSha256).toBe(pins.finalPrivateStateSha256);
  expect(anchor.publicStateSha256).toBe(pins.finalWholePublicSha256);
  for (const key of MOTHER229_FROZEN_ROOTS) expect(state[key], `preserved original ${key}`).toEqual(source[key]);
  for (const [id, mastery] of Object.entries(source.progression.mastery)) expect(state.progression.mastery[id], id).toBe(mastery);
  if (state.mother.source) {
    const inherited = state.mother.source;
    expect(inherited).toMatchObject({ runId: source.runId, revision: source.revision, character: source.character, random: source.random });
    expect(inherited.budget.mastery).toEqual(source.progression.mastery);
    expect(inherited.originals).toEqual({ site: source.natureWalker.life.site, operation: source.natureWalker.life.operation,
      rootPad: source.natureWalker.life.rootPad });
    expect(inherited.originals.rootPad.integrity).toBe(5);
    expect(inherited.originals.site.guard.segments.every(segment => segment.status === 'SPENT')).toBe(true);
    expect(inherited.acquisition.bottles).toEqual(source.natureWalker.bottles);
    expect(inherited.acquisition.acquisitionJournal).toEqual(source.natureWalker.acquisitionJournal);
    expect(state.mother.materials!.originals.map(item => item.originalId).sort()).toEqual([...MOTHER_ORIGINAL_IDS].sort());
  }
  if (state.progression.sequence === 0) {
    expect(Object.keys(state.progression.mastery).sort()).toEqual([...Object.keys(source.progression.mastery), ...MOTHER_ABILITY_IDS].sort());
    // Exact mastery and both ability outcomes come from independent terminal pins;
    // never require a successful cast or change an ordinary method into success.
    expect(state.mother.promotionWeek).not.toBeNull();
  }
  if (state.status === 'DEAD') {
    expect(summary.stage).toBe('NATURAL_DEATH'); expect(state.ending?.kind).toBe('DEATH'); expect(view.canAct).toBe(false);
    expect(view.mother.actions.every(action => !action.enabled)).toBe(true);
  } else {
    expect(state.status).toBe('ACTIVE'); expect(state.ending).toBeNull();
    expect(summary.actual).toMatchObject({ ordinaryExit: true, returnedHome: true, exitOpen: true, allOriginalsReturned: true });
    expect(state.mother.scene).toMatchObject({ playerPosition: 'OUTSIDE', contactSampleId: null, window: null, greenhouse: { exitOpen: true } });
    const plants = state.mother.scene!.plants;
    expect(plants.map(plant => plant.id).sort()).toEqual(['CB3-LIVE-1', 'CB3-LIVE-2']);
    for (const plant of plants) {
      expect(plant.holder).toBe(plant.originalHolder); expect(plant.location).toBe('OUTSIDE'); expect(plant.returnedEventId).toBeTruthy();
      expect(plant.branch.growthCount).toBe(0);
    }
    expect(view.mother.actions.some(action => action.preferredAction)).toBe(false);
  }
  expect(motherNaturalHash(source)).toBe(MOTHER229_SOURCE_STATE_SHA);
  // Reuse the replay's actual last before/after pair, even if that action kills.
  verifyLastCommandSave(before, state, view, actions.at(-1)!);
}, 900_000);
