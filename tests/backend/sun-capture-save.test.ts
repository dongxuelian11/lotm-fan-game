import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SliceEnvelope, SliceReceipt, SliceResult } from '../../src/shared/slice-contracts.js';
import {
  PINS, PREFIX, assertCurrentGlobal, assertGlobalPublic, authenticateInputs, hash,
  migrateCapturedSunState, readAction, readCheckpoint, same, sha, type Row,
} from '../helpers/sun-capture.js';

/** Two representative REAL SQLite transitions: promotion923 and final report934.
 * They cover the reviewed150 public maximum, complete private/RNG rollback,
 * identical-envelope retry, receipt dedupe and cold reopen. The independent
 * full34-boundary audit remains separate; neither suite replays original853. */
let rows: Row[] = [];
beforeAll(() => { authenticateInputs(); rows = readCheckpoint().rows; }, 120_000);
afterEach(() => { vi.resetAllMocks(); vi.restoreAllMocks(); });
afterAll(() => { authenticateInputs(); rows = []; }, 120_000);
const INITIAL_TIME = '2026-10-18T05:23:00.000Z', COMMIT_TIME = '2026-10-18T05:30:00.000Z';
function unwrap<T>(result: SliceResult<T>): T {
  if (!result.ok) throw Error(`${result.error.code}: ${result.error.message}`); return result.value;
}
function persisted(path: string): string {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return stableStringify({ runs: db.prepare('SELECT * FROM slice_runs ORDER BY id').all(),
      receipts: db.prepare('SELECT * FROM slice_receipts ORDER BY id').all(),
      meta: db.prepare('SELECT * FROM slice_meta ORDER BY key').all(),
      backup: existsSync(`${path}.bak`) ? sha(readFileSync(`${path}.bak`)) : null,
      sealed: existsSync(`${path}.sealed`) ? sha(readFileSync(`${path}.sealed`)) : null });
  } finally { db.close(); }
}

describe('Sun216 actual natural934 representative SQLite captures', () => {
  it.each(PINS.sqliteCommandCounts)('rolls back both write boundaries, retries once and cold-reopens actual command%i', count => {
    const row = rows[count - PREFIX - 1]!, action = readAction(row);
    const before = migrateCapturedSunState(action.beforeLast), after = migrateCapturedSunState(action.final);
    const beforeHash = hash(before), afterHash = hash(after), publicBefore = projectSliceState(before), publicAfter = projectSliceState(after);
    assertCurrentGlobal(publicBefore, action, 'before'); assertCurrentGlobal(publicAfter, action, 'after');
    assertGlobalPublic(publicBefore, before); assertGlobalPublic(publicAfter, after);
    expect(publicAfter.maxSpirituality).toBe(150); expect(after.status).toBe('ACTIVE'); expect(after.progression.sequence).toBe(0);
    if (count === 923) expect(after.lastCheck).toMatchObject({ chance: 74, roll: 57, tier: 'SUCCESS' });
    else {
      expect(after).toMatchObject({ health: 92, mind: 64, spirituality: 38, cash: 36, lastCheck: null,
        injuries: [{ severity: 'LIGHT', treatedRevision: null }], injuryRisk: 1, actionsRemaining: 0 });
      expect(after.random).toEqual(before.random);
      expect(after.sun.epilogue).toMatchObject({ status: 'RESOLVED', reported: true,
        resident: { health: 100, position: 0 }, ward: { attempted: true, passed: false, applied: false } });
    }
    const envelope: SliceEnvelope = { intentId: `sun216-actual:${count}`, runId: before.runId,
      expectedRevision: before.revision, payload: structuredClone(action.lastIntent) };
    const fingerprint = stableStringify(envelope);
    const receipt: SliceReceipt = { intentId: envelope.intentId, runId: after.runId, previousRevision: before.revision,
      newRevision: after.revision, committedAt: COMMIT_TIME, replayed: false, state: publicAfter };
    const directory = mkdtempSync(join(tmpdir(), 'sun216-capture-save-')), path = join(directory, 'save.sqlite');
    let store: SqliteSliceStore | undefined, injection: 'beforeWrite' | 'COMMIT' | null = null, injections = 0, hooks = 0;
    const exact = (wanted: SliceState, committed: boolean): void => {
      const saved = store!.repository.get(wanted.runId)!;
      same(saved.state, wanted); expect(hash(saved.state)).toBe(committed ? afterHash : beforeHash);
      expect(saved.state.random).toEqual(wanted.random); expect(saved.updatedAt).toBe(committed ? COMMIT_TIME : INITIAL_TIME);
      expect(store!.repository.activeRun()).toBe(wanted.runId);
      expect(store!.repository.receipt(envelope.intentId)).toEqual(committed ? { fingerprint, receipt } : null);
      expect(existsSync(`${path}.sealed`)).toBe(false);
    };
    const head = (wanted: SliceState): void => {
      expect(store!.repository.ownedHead(wanted.runId)).toEqual({ runId: wanted.runId, revision: wanted.revision, status: wanted.status });
      same(store!.repository.projectFoolRun(wanted.runId), wanted.revision === before.revision ? publicBefore : publicAfter);
    };
    const fault = (): never => {
      // Candidate + receipt are in the SQLite transaction, but the owned head
      // must remain the predecessor until real COMMIT succeeds.
      exact(after, true); head(before); injections++; throw Error(`Injected Sun ${injection} after actual writes`);
    };
    const open = () => new SqliteSliceStore(path, { now: () => COMMIT_TIME,
      beforeWrite: () => { hooks++; if (injection === 'beforeWrite') fault(); } });
    const reopen = (): void => { store!.close(); store = undefined; store = open(); };
    const bootstrap = (committed: boolean): void => {
      const snapshot = persisted(path), oldHooks = hooks, projection = committed ? publicAfter : publicBefore;
      const value = unwrap(store!.getBootstrap()); same(value.activeState, projection);
      expect(value.runs).toHaveLength(1); expect(value.runs[0]).toMatchObject({ runId: projection.runId, revision: projection.revision, status: 'ACTIVE' });
      expect(hooks).toBe(oldHooks); expect(persisted(path)).toBe(snapshot);
    };
    const originalExec = DatabaseSync.prototype.exec;
    const spy = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function (this: DatabaseSync, sql: string) {
      if (injection === 'COMMIT' && sql === 'COMMIT') fault(); return originalExec.call(this, sql);
    });
    try {
      store = open();
      store.repository.transaction(() => { store!.repository.put({ state: before, updatedAt: INITIAL_TIME }); store!.repository.selectRun(before.runId); });
      reopen(); exact(before, false); head(before); bootstrap(false); const untouched = persisted(path);
      for (const mode of ['beforeWrite', 'COMMIT'] as const) {
        injections = 0; injection = mode;
        try { expect(store!.submitIntent(envelope)).toMatchObject({ ok: false, error: { code: 'SAVE_FAILED' } }); }
        finally { injection = null; }
        expect(injections).toBe(1); exact(before, false); head(before); expect(persisted(path)).toBe(untouched);
        reopen(); exact(before, false); head(before); bootstrap(false); expect(persisted(path)).toBe(untouched);
      }
      expect(unwrap(store!.submitIntent(envelope))).toEqual(receipt); exact(after, true); head(after);
      expect(stableStringify(envelope)).toBe(fingerprint); const committed = persisted(path);
      reopen(); exact(after, true); head(after); bootstrap(true);
      same(unwrap(store!.loadRun(after.runId)), publicAfter); expect(persisted(path)).toBe(committed);
      expect(unwrap(store!.submitIntent(envelope))).toEqual({ ...receipt, replayed: true });
      exact(after, true); head(after); expect(persisted(path)).toBe(committed);
      reopen(); exact(after, true); head(after); bootstrap(true); expect(persisted(path)).toBe(committed);
      expect(hash(before)).toBe(beforeHash); expect(hash(after)).toBe(afterHash);
      expect(hash(action.beforeLast)).toBe(row.beforeStateSha256); expect(hash(action.final)).toBe(row.afterStateSha256);
    } finally { injection = null; spy.mockRestore(); store?.close(); rmSync(directory, { recursive: true, force: true }); }
  }, 300_000);
});
