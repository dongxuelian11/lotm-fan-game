/** Actual 198 living source after command 287, then the paid bridge route.
 * Only the future S0 d100 at cursor 481 is controlled to 1. This is controlled
 * coverage, never a natural success capture. One failed write, its identical
 * retry and one cold reopen cover the durable private/public boundary. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { StoredSlice } from '../../src/application/slice-application.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import type { SliceEnvelope, SliceResult } from '../../src/shared/slice-contracts.js';
import {
  assertTwilightSourceUnmodified, twilightPublicLeaks, controlledTwilightRolls,
  preparedTwilightScenario, executeTwilight,
} from '../helpers/twilight-giant-scenario.js';

const importedAt = '2026-10-18T22:00:00.000Z', committedAt = '2026-10-18T22:00:01.000Z';
const stores: SqliteSliceStore[] = [], directories: string[] = [];
function unwrap<T>(result: SliceResult<T>): T {
  if (!result.ok) throw Error(result.error.code + ': ' + result.error.message);
  return result.value;
}
function close(store: SqliteSliceStore) {
  store.close(); stores.splice(stores.indexOf(store), 1);
}
function raw(file: string, runId: string): string {
  const db = new DatabaseSync(file, { readOnly: true });
  try { return String(db.prepare('SELECT current_json FROM slice_runs WHERE id=?').get(runId)!.current_json); }
  finally { db.close(); }
}
function stored(file: string, runId: string): StoredSlice {
  return JSON.parse(JSON.parse(raw(file, runId)).payload) as StoredSlice;
}
function persisted(file: string): string {
  const hash = (path: string) => existsSync(path) ? createHash('sha256').update(readFileSync(path)).digest('hex') : null;
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return stableStringify({
      runs: db.prepare('SELECT * FROM slice_runs ORDER BY id').all(),
      receipts: db.prepare('SELECT * FROM slice_receipts ORDER BY id').all(),
      meta: db.prepare('SELECT * FROM slice_meta ORDER BY key').all(),
      backup: hash(file + '.bak'), sealed: hash(file + '.sealed'), files: readdirSync(dirname(file)).sort(),
    });
  } finally { db.close(); }
}
afterEach(() => {
  for (const store of stores.splice(0)) store.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
  vi.resetAllMocks(); vi.restoreAllMocks();
});

describe('Twilight220 controlled real-history SQLite transaction', () => {
  it('rolls back a real consumption write, retries the identical RNG intent, and reopens one equal private/public S0 result', () => {
    const restore = controlledTwilightRolls({ 481: 1 });
    try {
      const route = preparedTwilightScenario(), before = route.beforeConsume, session = route.session;
      const beforeView = session.project();
      const consume = beforeView.twilightGiant.actions.find(action => action.enabled && action.command.type === 'CONSUME')!.command;
      const success = executeTwilight(session, consume), successView = session.project();
      expect(success).toMatchObject({ status: 'ACTIVE', progression: { pathwayId: 'warrior', sequence: 0 },
        random: { seed: 'warrior-natural-v042', cursor: 482 } });
      expect(successView).toMatchObject({ canAct: false, maxSpirituality: 150,
        twilightGiant: { promoted: true, resources: { maxSpirituality: 150 } } });
      expect(twilightPublicLeaks(successView)).toEqual([]);
      const directory = mkdtempSync(join(tmpdir(), 'lotm-twilight-owned-'));
      directories.push(directory);
      const file = join(directory, 'save.sqlite');
      const request: SliceEnvelope = { intentId: 'twilight-controlled-consume-save', runId: before.runId,
        expectedRevision: before.revision, payload: { type: 'TWILIGHT_GIANT', command: consume } };
      const requestBytes = stableStringify(request);
      let watching = false, fail = true, attempts = 0;
      const store = new SqliteSliceStore(file, { now: () => committedAt, beforeWrite: () => {
        if (!watching) return;
        // Inspect staged rows on this connection, avoiding a second reader during
        // SQLite cache-spill locks. The published private head must remain old.
        expect(store.repository.ownedHead(before.runId)?.revision).toBe(before.revision);
        const pending = store.repository.get(before.runId)!;
        expect(pending).toEqual({ state: success, updatedAt: committedAt });
        expect(pending.state.twilightGiant.journal.at(-1)!.randomReceipts)
          .toEqual(success.twilightGiant.journal.at(-1)!.randomReceipts);
        expect(store.repository.receipt(request.intentId)?.receipt.newRevision).toBe(success.revision);
        attempts++;
        if (fail) throw Error('Injected Twilight beforeWrite failure after actual consumption writes');
      } });
      stores.push(store);
      // Strict admission of actual command output, with no synthesized CREATE
      // receipt or direct SQL insertion of invented promotion authority.
      store.repository.transaction(() => {
        store.repository.put({ state: before, updatedAt: importedAt });
        store.repository.selectRun('previous-selected-slot');
      });
      expect(store.repository.ownedHead(before.runId)?.revision).toBe(before.revision);
      const original = persisted(file);
      watching = true;
      try { expect(store.submitIntent(request)).toMatchObject({ ok: false, error: { code: 'SAVE_FAILED' } }); }
      finally { watching = false; }
      expect(attempts).toBe(1);
      expect(persisted(file)).toBe(original);
      expect(store.repository.receipt(request.intentId)).toBeNull();
      expect(store.repository.activeRun()).toBe('previous-selected-slot');
      expect(store.repository.ownedHead(before.runId)?.revision).toBe(before.revision);
      expect(stored(file, before.runId).state).toEqual(before);
      expect(stored(file, before.runId).state.random).toEqual(route.source.random);
      expect(beforeView.twilightGiant.promoted).toBe(false);

      fail = false; watching = true;
      const result = store.submitIntent(request);
      watching = false;
      const receipt = unwrap(result);
      expect(attempts).toBe(2);
      expect(receipt).toMatchObject({ intentId: request.intentId, previousRevision: before.revision,
        newRevision: success.revision, committedAt, replayed: false });
      expect(receipt.state).toEqual(successView);
      expect(stored(file, before.runId)).toEqual({ state: success, updatedAt: committedAt });
      expect(store.repository.ownedHead(before.runId)?.revision).toBe(success.revision);
      expect(store.repository.activeRun()).toBe(before.runId);
      expect(stableStringify(request)).toBe(requestBytes);
      const committed = raw(file, before.runId);
      expect(unwrap(store.submitIntent(request))).toEqual({ ...receipt, replayed: true });
      expect(attempts).toBe(2);
      expect(raw(file, before.runId)).toBe(committed);

      close(store);
      const reopened = new SqliteSliceStore(file, { now: () => committedAt });
      stores.push(reopened);
      expect(unwrap(reopened.loadRun(before.runId))).toEqual(successView);
      expect(unwrap(reopened.getBootstrap()).activeState).toEqual(successView);
      expect(unwrap(reopened.submitIntent(request))).toEqual({ ...receipt, replayed: true });
      expect(stored(file, before.runId)).toEqual({ state: success, updatedAt: committedAt });
      expect(raw(file, before.runId)).toBe(committed);
      expect(success.twilightGiant.journal.at(-1)!.randomReceipts).toMatchObject([{
        cursorBefore: 481, cursorAfter: 482, check: { roll: 1, chance: 70, tier: 'GREAT_SUCCESS' },
      }]);
      assertTwilightSourceUnmodified();
    } finally { restore(); }
  }, 300_000);
});
