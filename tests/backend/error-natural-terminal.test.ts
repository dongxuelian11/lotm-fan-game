/** One ordered 74-action natural replay and one final SQLite import/reopen.
 * No RNG seam, historical656 replay, per-action databases, or retry retest. */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { StoredSlice } from '../../src/application/slice-application.js';
import { applySliceIntent, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { openErrorAscentRuntimeSession, type ErrorAscentRuntimeSession } from '../../src/domain/error-ascent/owned-session.js';
import { ERROR_ASCENT_ABILITY_IDS } from '../../src/domain/error-ascent/types.js';
import { ERROR_ASCENT_HOME } from '../../src/domain/error-ascent/content.js';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import type { SliceResult } from '../../src/shared/slice-contracts.js';
import {
  ERROR219_FINAL_PRIVATE_SHA, ERROR219_FINAL_PUBLIC_SHA, errorNaturalAnchor, errorNaturalHash,
  readErrorNaturalRows, readErrorNaturalSnapshot, readErrorNaturalSource, type ErrorNaturalActionRow,
} from '../helpers/error-natural-capture.js';

function unwrap<T>(result: SliceResult<T>): T {
  if (!result.ok) throw Error(result.error.code + ': ' + result.error.message);
  return result.value;
}

describe('Error219 completed natural route', () => {
  it('replays the actual74 once from the original656 initial key with exact private/public/RNG anchors', () => {
    const source = readErrorNaturalSource(), initial = readErrorNaturalSnapshot('initial');
    expect(source.commands).toHaveLength(656);
    expect(errorNaturalHash(source.final)).toBe('abfce49e9f21e1599f4b9abb1c2e34e15afeb8a2fbe177e2926b3ac4f2d49191');
    expect(migrateSliceState(structuredClone(source.final))).toEqual(initial.final);
    const rows = readErrorNaturalRows();
    expect(rows).toHaveLength(730);
    let previous: string | null = null;
    for (const [index, row] of rows.entries()) {
      const { rowSha256, ...payload } = row;
      expect(rowSha256, `row ${index + 1}`).toBe(errorNaturalHash(payload));
      expect(row.commandSha256).toBe(errorNaturalHash(row.intent));
      expect(row.commandCount).toBe(index + 1);
      expect(row.previousRowSha256).toBe(previous);
      if (index < 656) {
        expect(row.kind).toBe('HISTORICAL_COMMAND');
        expect(row.intent).toEqual(source.commands[index]);
      }
      previous = rowSha256;
    }

    let state = initial.final, view = projectSliceState(state), anchor = errorNaturalAnchor(state, view);
    expect(view).toEqual(initial.public);
    let session: ErrorAscentRuntimeSession | undefined;
    const actions = rows.slice(656) as ErrorNaturalActionRow[];
    for (const [index, row] of actions.entries()) {
      expect(row.kind).toBe('ERROR_ASCENT_ACTION');
      expect(row.newCount).toBe(index + 1);
      expect(row.before, `before command ${row.commandCount}`).toEqual(anchor);
      expect(view.errorAscent.actions.filter(action => action.preferredAction)).toEqual([row.publicAction]);
      expect(row.publicAction.enabled).toBe(true);
      expect(row.intent).toEqual({ type: 'ERROR_ASCENT', command: row.publicAction.command });
      if (!session) {
        // Guidance is the real public entry into the owned session, as captured.
        expect(index).toBe(0);
        expect(row.intent).toEqual({ type: 'ERROR_ASCENT', command: { type: 'LEARN_GUIDANCE' } });
        const before = state;
        state = applySliceIntent(state, row.intent);
        expect(row.receipt).toEqual({ id: null, checks: [], finance: [], notes: state.chronicle.slice(before.chronicle.length) });
        session = openErrorAscentRuntimeSession(state);
      } else {
        const draft = session.prepare(row.intent, state.revision);
        expect(session.inspect().revision).toBe(state.revision);
        session.commit(draft);
        state = session.snapshot();
        const last = state.errorAscent.journal.at(-1)!;
        expect(row.receipt).toEqual({ id: last.id, checks: last.randomReceipts, finance: last.financeReceipts,
          notes: last.notes, beforeDigest: last.beforeDigest, afterDigest: last.afterDigest });
      }
      view = session.project();
      anchor = errorNaturalAnchor(state, view);
      expect(anchor, `after command ${row.commandCount}`).toEqual(row.after);
      if (row.commandCount === 723) expect(state.lastCheck).toMatchObject({ chance: 68, roll: 8, tier: 'SUCCESS' });
      if (row.commandCount === 727) expect(state.lastCheck).toMatchObject({ chance: 72, roll: 99, tier: 'GREAT_FAILURE' });
    }
    const terminal = readErrorNaturalSnapshot('terminal');
    expect(state).toEqual(terminal.final);
    expect(view).toEqual(terminal.public);
    expect(state).toMatchObject({ revision: 731, status: 'ACTIVE', week: 165, health: 86, mind: 78,
      spirituality: 64, cash: 127, actionsRemaining: 1, progression: { pathwayId: 'error', sequence: 0 },
      random: { seed: source.final.random.seed, cursor: 399 }, errorAscent: {
        frame: { location: ERROR_ASCENT_HOME }, ritual: { candidateOutcome: 'DISPLACED_ALIVE', player: { outcome: 'ASCENDED' } },
        epilogue: { status: 'WITHDRAWN', reported: true, player: { route: 'OUTSIDE_SIDE', travelledMetres: 25 },
          theft: { attempted: true, passed: false, applied: false }, diversion: { attempted: false } },
      } });
    for (const [id, mastery] of Object.entries(source.final.progression.mastery)) expect(state.progression.mastery[id]).toBe(mastery);
    for (const id of ERROR_ASCENT_ABILITY_IDS) expect(state.progression.mastery[id]).toBe(0);
    expect(state.errorAscent.journal.flatMap(entry => entry.randomReceipts)).toHaveLength(2);
    expect(errorNaturalHash(readErrorNaturalSource().final)).toBe(errorNaturalHash(source.final));
  }, 180_000);

  it('imports actual730 through strict SQLite admission and cold reopens one equal private/public terminal', () => {
    const terminal = readErrorNaturalSnapshot('terminal'), state = terminal.final;
    const directory = mkdtempSync(join(tmpdir(), 'lotm-error219-natural-')), file = join(directory, 'save.sqlite');
    const updatedAt = '2026-10-18T22:00:00.000Z';
    let store: SqliteSliceStore | undefined;
    const readPrivate = () => {
      const db = new DatabaseSync(file, { readOnly: true });
      try {
        const raw = String(db.prepare('SELECT current_json FROM slice_runs WHERE id=?').get(state.runId)!.current_json);
        const value = JSON.parse(JSON.parse(raw).payload) as StoredSlice;
        expect(db.prepare('SELECT COUNT(*) AS count FROM slice_receipts').get()!.count).toBe(0);
        return { raw, value };
      } finally { db.close(); }
    };
    try {
      store = new SqliteSliceStore(file, { now: () => updatedAt });
      store.repository.transaction(() => {
        store!.repository.put({ state, updatedAt });
        store!.repository.selectRun(state.runId);
      });
      expect(store.repository.ownedHead(state.runId)?.revision).toBe(731);
      const imported = readPrivate();
      expect(imported.value).toEqual({ state, updatedAt });
      expect(errorNaturalHash(imported.value.state)).toBe(ERROR219_FINAL_PRIVATE_SHA);
      store.close(); store = undefined;

      store = new SqliteSliceStore(file, { now: () => updatedAt });
      const loaded = unwrap(store.loadRun(state.runId));
      expect(loaded).toEqual(terminal.public);
      expect(errorNaturalHash(loaded)).toBe(ERROR219_FINAL_PUBLIC_SHA);
      expect(unwrap(store.getBootstrap()).activeState).toEqual(terminal.public);
      expect(store.repository.ownedHead(state.runId)?.revision).toBe(731);
      expect(readPrivate()).toEqual(imported);
    } finally { store?.close(); rmSync(directory, { recursive: true, force: true }); }
  }, 60_000);
});
