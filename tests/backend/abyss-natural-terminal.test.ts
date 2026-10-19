/** One complete new-command replay and one actual terminal-command SQLite fault/retry/reopen.
 * Original821 are integrity-checked only; no historical replay, controlled draw, or extra route. */
import { expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { StoredSlice } from '../../src/application/slice-application.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { openAbyssRuntimeSession, type AbyssRuntimeSession } from '../../src/domain/abyss/owned-session.js';
import { ABYSS_ABILITY_IDS, ABYSS_ORIGINAL_IDS } from '../../src/domain/abyss/content.js';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import type { SliceEnvelope, SliceResult } from '../../src/shared/slice-contracts.js';
import {
  ABYSS224_FROZEN_ROOTS, ABYSS224_SOURCE_STATE_SHA, assertAbyssNaturalRetainedFreeze,
  abyssNaturalAnchor, abyssNaturalHash, abyssNaturalOutcome, abyssNaturalReceipt, abyssNaturalSha,
  readAbyssNaturalRows, readAbyssNaturalSnapshot, readAbyssNaturalSource, readAbyssNaturalSummary,
  type AbyssNaturalActionRow,
} from '../helpers/abyss-natural-capture.js';

function unwrap<T>(result: SliceResult<T>): T {
  if (!result.ok) throw Error(result.error.code + ': ' + result.error.message);
  return result.value;
}

function verifyLastCommandSave(before: SliceState, state: SliceState, view: SliceProjection, last: AbyssNaturalActionRow): void {
  const directory = mkdtempSync(join(tmpdir(), 'lotm-abyss224-natural-')), file = join(directory, 'save.sqlite');
  const importedAt = '2026-10-19T00:00:00.000Z', committedAt = '2026-10-19T00:00:01.000Z';
  const request: SliceEnvelope = { intentId: 'abyss224-natural-last', runId: before.runId,
    expectedRevision: before.revision, payload: last.intent };
  expect(last.commandCount).toBe(964); expect(last.intent).toEqual({ type: 'ABYSS', command: { type: 'REST' } });
  const requestHash = abyssNaturalHash(request);
  const inspect = () => {
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      const runs = db.prepare('SELECT * FROM slice_runs ORDER BY id').all();
      const raw = String(runs.find(row => row.id === state.runId)!.current_json);
      const hash = (path: string) => existsSync(path) ? abyssNaturalSha(readFileSync(path)) : null;
      return { raw, stored: JSON.parse(JSON.parse(raw).payload) as StoredSlice,
        durable: abyssNaturalHash({ runs, receipts: db.prepare('SELECT * FROM slice_receipts ORDER BY id').all(),
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
      if (fail) throw Error('Injected last natural Abyss command write failure');
    } });
    store.repository.transaction(() => {
      store!.repository.put({ state: before, updatedAt: importedAt });
      store!.repository.selectRun('previous-selected-slot');
    });
    publishedRevision = store.repository.ownedHead(before.runId)?.revision ?? null;
    if (before.abyss.guidanceKnown) expect(publishedRevision).toBe(before.revision);
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
    expect(abyssNaturalHash(request)).toBe(requestHash);
    expect(store.repository.activeRun()).toBe(before.runId);
    const committed = inspect();
    expect(committed.stored).toEqual({ state, updatedAt: committedAt });
    expect(committed.stored.state.random).toEqual(last.after.random);
    expect(abyssNaturalReceipt(committed.stored.state, before)).toEqual(last.receipt);
    expect(unwrap(store.submitIntent(request))).toEqual({ ...receipt, replayed: true });
    expect(attempts).toBe(2); expect(inspect().raw).toBe(committed.raw);
    store.close(); store = undefined;

    store = new SqliteSliceStore(file, { now: () => committedAt });
    expect(unwrap(store.loadRun(state.runId))).toEqual(view);
    expect(unwrap(store.getBootstrap()).activeState).toEqual(view);
    expect(unwrap(store.submitIntent(request))).toEqual({ ...receipt, replayed: true });
    expect(inspect().raw).toBe(committed.raw);
    expect(inspect().stored).toEqual(committed.stored);
    if (state.abyss.guidanceKnown) expect(store.repository.ownedHead(state.runId)?.revision).toBe(state.revision);
  } finally { store?.close(); rmSync(directory, { recursive: true, force: true }); }
}

it('replays only the actual new Abyss commands with exact private/public/RNG hashes, then faults/retries/reopens the last save', () => {
  const summary = readAbyssNaturalSummary(), archive = readAbyssNaturalSource(), source = archive.final;
  const initial = readAbyssNaturalSnapshot('initial'), rows = readAbyssNaturalRows();
  assertAbyssNaturalRetainedFreeze(summary);
  expect(rows).toHaveLength(summary.commandCount);
  let previous: string | null = null;
  for (const [index, row] of rows.entries()) {
    const { rowSha256, ...payload } = row;
    expect(rowSha256, `row ${index + 1}`).toBe(abyssNaturalHash(payload));
    expect(row.commandSha256).toBe(abyssNaturalHash(row.intent));
    expect(row.commandCount).toBe(index + 1); expect(row.previousRowSha256).toBe(previous);
    if (index < 821) {
      expect(row.kind).toBe('HISTORICAL_COMMAND'); expect(row.intent).toEqual(archive.commands[index]);
    }
    previous = rowSha256;
  }
  let state = migrateSliceState(structuredClone(source)), view = projectSliceState(state);
  for (const [key, value] of Object.entries(source)) if (!['schemaVersion', 'contentVersion'].includes(key))
    expect(state[key as keyof SliceState], `original migration root ${key}`).toEqual(value);
  expect(state).toEqual(initial.final); expect(view).toEqual(initial.public);
  expect(state.abyss.guidanceKnown).toBe(false); expect(state.abyss.source).toBeNull(); expect(state.abyss.journal).toEqual([]);
  let anchor = abyssNaturalAnchor(state, view), before = state;
  expect(anchor).toEqual(initial.anchor);
  const actions = rows.slice(821) as AbyssNaturalActionRow[];
  let session: AbyssRuntimeSession | undefined;
  for (const [index, row] of actions.entries()) {
    expect(row.kind).toBe('ABYSS_ACTION'); expect(row.newCount).toBe(index + 1);
    expect(row.before, `before command ${row.commandCount}`).toEqual(anchor);
    expect(row.after.revision).toBe(822 + row.newCount);
    expect(view.status).toBe('ACTIVE'); expect(view.activeEvent).toBeNull(); expect(view.combat).toBeNull();
    expect(view.abyss.actions.filter(action => action.preferredAction)).toEqual([row.publicAction]);
    expect(row.publicAction.enabled).toBe(true); expect(row.intent).toEqual({ type: 'ABYSS', command: row.publicAction.command });
    before = state;
    if (!session) {
      expect(index).toBe(0); expect(row.intent).toEqual({ type: 'ABYSS', command: { type: 'LEARN_GUIDANCE' } });
      state = applySliceIntent(state, row.intent); session = openAbyssRuntimeSession(state);
    } else {
      const draft = session.prepare(row.intent, state.revision);
      expect(session.inspect().revision).toBe(state.revision);
      session.commit(draft); state = session.snapshot();
    }
    view = session.project();
    expect(row.receipt).toEqual(abyssNaturalReceipt(state, before));
    expect(row.actual).toEqual(abyssNaturalOutcome(state));
    expect(state.random.seed).toBe(source.random.seed); expect(state.random.cursor).toBeGreaterThanOrEqual(before.random.cursor);
    anchor = abyssNaturalAnchor(state, view);
    expect(anchor, `after command ${row.commandCount}`).toEqual(row.after);
    if (row.commandCount === 916) expect(state.lastCheck).toMatchObject({ chance: 70, roll: 73, tier: 'FAILURE' });
    if (row.commandCount === 941) expect(state.lastCheck).toMatchObject({ chance: 70, roll: 30, tier: 'SUCCESS' });
  }
  const terminal = readAbyssNaturalSnapshot('terminal');
  assertValidSliceState(state);
  expect(state).toEqual(terminal.final); expect(view).toEqual(terminal.public);
  expect(state.revision).toBe(summary.revision); expect(abyssNaturalOutcome(state)).toEqual(summary.actual);
  expect(state).toMatchObject({ revision: 965, status: 'ACTIVE', week: 227, health: 100, mind: 84,
    spirituality: 92, cash: 600, actionsRemaining: 2, injuries: [],
    progression: { pathwayId: 'abyss', sequence: 0 }, random: { seed: source.random.seed, cursor: 149 } });
  expect(state.abyss.journal.flatMap(event => event.randomReceipts).map(({ check }) => [check.chance, check.roll, check.tier]))
    .toEqual([[70, 73, 'FAILURE'], [70, 30, 'SUCCESS'], [74, 11, 'SUCCESS'], [74, 68, 'SUCCESS']]);
  expect(anchor.privateStateSha256).toBe(summary.finalPrivateStateSha256);
  expect(anchor.publicStateSha256).toBe(summary.finalWholePublicSha256);
  for (const key of ABYSS224_FROZEN_ROOTS) expect(state[key], `original ${key}`).toEqual(source[key]);
  for (const [id, mastery] of Object.entries(source.progression.mastery)) expect(state.progression.mastery[id]).toBe(mastery);
  expect(Object.keys(state.progression.mastery).sort()).toEqual([...Object.keys(source.progression.mastery), ...ABYSS_ABILITY_IDS].sort());
  for (const id of ABYSS_ABILITY_IDS) expect(state.progression.mastery[id]).toBe(8);
  expect(state.abyss.materials!.originals.map(item => item.originalId).sort()).toEqual([...ABYSS_ORIGINAL_IDS].sort());
  expect(state.abyss.source!.acquisition.bottles).toEqual(source.uncleanMonarch.bottles);
  expect(summary.stage).toBe('NATURAL_S0_REPORTED_EXIT');
  expect(summary.actual).toMatchObject({ status: 'ACTIVE', promoted: true, reported: true, ordinaryExit: true, returnedHome: true });
  expect(state.abyss.scene).toMatchObject({ status: 'COMPLETED', playerPosition: 'OUTSIDE', contact: false, window: null,
    corrosionApplied: true, dangerSenseApplied: true,
    segments: { A: { open: false }, B: { open: false } }, exit: { door: 'CLOSED' } });
  expect(state.abyss.scene!.workers).toHaveLength(2);
  for (const worker of state.abyss.scene!.workers) {
    expect(worker.position).toBe('OUTSIDE');
    expect(worker.passage.a).toBeTruthy(); expect(worker.passage.b).toBeTruthy(); expect(worker.passage.exit).toBeTruthy();
  }
  expect(view.abyss.actions.some(action => action.preferredAction)).toBe(false);
  expect(abyssNaturalHash(source)).toBe(ABYSS224_SOURCE_STATE_SHA);
  // Reuse this replay's real penultimate state, never regenerate or replay original821.
  verifyLastCommandSave(before, state, view, actions.at(-1)!);
}, 900_000);
