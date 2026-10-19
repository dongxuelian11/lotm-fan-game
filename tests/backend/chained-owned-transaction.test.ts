/** Actual living Abomination fixture, then the paid Chained route.
 * Only future d100 rolls at/after cursor291 are controlled; real advancement
 * includes the paid investigations. Keep the same seam through cold validation.
 * One failed write, identical retry and reopen test the durable boundary. */
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
  assertChainedSourceUnmodified, chainedPublicLeaks, controlledChainedRolls,
  preparedChainedScenario, executeChained,
} from '../helpers/chained-scenario.js';

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

describe('Chained225 controlled real-history SQLite transaction', () => {
  it('rolls back a real consumption write, retries the identical RNG intent, and reopens one equal private/public S0 result', () => {
    const restore = controlledChainedRolls({});
    try {
      const route = preparedChainedScenario(), before = route.beforeConsume, session = route.session;
      const beforeView = session.project();
      const consume = beforeView.chained.actions.find(action => action.enabled && action.command.type === 'CONSUME')!.command;
      const success = executeChained(session, consume), successView = session.project();
      expect(success).toMatchObject({ status: 'ACTIVE', progression: { pathwayId: 'chained', sequence: 0 },
        random: { seed: before.random.seed, cursor: before.random.cursor + 1 } });
      expect(successView).toMatchObject({ canAct: false, maxSpirituality: 150,
        chained: { promoted: true, resources: { maxSpirituality: 150 } } });
      expect(chainedPublicLeaks(successView)).toEqual([]);
      const directory = mkdtempSync(join(tmpdir(), 'lotm-chained-owned-'));
      directories.push(directory);
      const file = join(directory, 'save.sqlite');
      const request: SliceEnvelope = { intentId: 'chained-controlled-consume-save', runId: before.runId,
        expectedRevision: before.revision, payload: { type: 'CHAINED', command: consume } };
      const requestBytes = stableStringify(request);
      let watching = false, fail = true, attempts = 0;
      const store = new SqliteSliceStore(file, { now: () => committedAt, beforeWrite: () => {
        if (!watching) return;
        // Inspect staged rows on this connection, avoiding a second reader during
        // SQLite cache-spill locks. The published private head must remain old.
        expect(store.repository.ownedHead(before.runId)?.revision).toBe(before.revision);
        const pending = store.repository.get(before.runId)!;
        expect(pending).toEqual({ state: success, updatedAt: committedAt });
        expect(pending.state.chained.journal.at(-1)!.randomReceipts)
          .toEqual(success.chained.journal.at(-1)!.randomReceipts);
        expect(store.repository.receipt(request.intentId)?.receipt.newRevision).toBe(success.revision);
        attempts++;
        if (fail) throw Error('Injected Chained beforeWrite failure after actual consumption writes');
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
      expect(stored(file, before.runId).state.random).toEqual(before.random);
      expect(before.random.seed).toBe(route.source.random.seed);
      // The paid investigation of failed original1 already consumed one real draw.
      const preparationDraws = before.chained.journal.filter(event => event.randomReceipts.length);
      expect(preparationDraws).toHaveLength(1);
      expect(preparationDraws[0]!.command).toEqual({ type: 'INVESTIGATE_REMAINS', originalId: 'abomination-potion-1' });
      expect(preparationDraws[0]!.randomReceipts).toMatchObject([{
        cursorBefore: route.source.random.cursor, cursorAfter: route.source.random.cursor + 1,
      }]);
      expect(before.random).toEqual({ ...route.source.random, cursor: route.source.random.cursor + 1 });
      expect(beforeView.chained.promoted).toBe(false);

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
      expect(success.chained.journal.at(-1)!.randomReceipts).toMatchObject([{
        cursorBefore: before.random.cursor, cursorAfter: before.random.cursor + 1, check: { roll: 1, chance: 70, tier: 'GREAT_SUCCESS' },
      }]);
      assertChainedSourceUnmodified();
    } finally { restore(); }
  }, 300_000);
});
