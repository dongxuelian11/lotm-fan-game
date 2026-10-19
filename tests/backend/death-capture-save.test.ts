import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SliceEnvelope, SliceReceipt, SliceResult } from '../../src/shared/slice-contracts.js';
import {
  PINS, PREFIX, assertCurrentGlobal, assertGlobalPublic, authenticateInputs, hash,
  historicalDeathState, readAction, readCheckpoint, same, sha, type Row,
} from '../helpers/death-capture.js';

/** Three representative REAL SQLite transitions from natural1141: guidance1039,
 * first natural S0 success1128 (70%, roll62), and final report1141. Each reads
 * the immutable actual capture, without a route producer or RNG control, and
 * exercises both rollback boundaries, identical-envelope retry/dedupe, owned
 * publication and cold recovery of the complete private/RNG/public state.
 * The independent full-boundary audit remains separate; no full route replay. */
let rows: Row[] = [];
beforeAll(() => {
  authenticateInputs(); rows = readCheckpoint().rows;
  expect(PINS.sqliteCommandCounts).toEqual([1039, 1128, 1141]);
}, 120_000);
afterEach(() => { vi.resetAllMocks(); vi.restoreAllMocks(); });
afterAll(() => { authenticateInputs(); rows = []; }, 120_000);
const INITIAL_TIME = '2026-10-18T08:00:00.000Z', COMMIT_TIME = '2026-10-18T08:01:00.000Z';
// The same bounded Sun cases previously took 179s/201s with strict cold reads.
// Retain their 300s per-case budget; Death timings still require an actual run.
const sqliteCaseBudget = 300_000;
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

describe('Death217 actual natural1141 representative SQLite captures', () => {
  it.each(PINS.sqliteCommandCounts)('rolls back both write boundaries, retries once and cold-reopens actual command%i', count => {
    const row = rows[count - PREFIX - 1]!, action = readAction(row);
    const before = migrateSliceState(action.beforeLast), after = migrateSliceState(action.final);
    same(historicalDeathState(before), action.beforeLast); same(historicalDeathState(after), action.final);
    expect(Object.keys(before).sort()).toEqual([...Object.keys(action.beforeLast), 'door', 'errorAscent', 'twilightGiant', 'demoness',
      'hermit', 'hangedMan', 'abyss', 'chained', 'wheelOfFortune', 'blackEmperor', 'justiciar', 'mother'].sort());
    expect(Object.keys(after).sort()).toEqual([...Object.keys(action.final), 'door', 'errorAscent', 'twilightGiant', 'demoness',
      'hermit', 'hangedMan', 'abyss', 'chained', 'wheelOfFortune', 'blackEmperor', 'justiciar', 'mother'].sort());
    const beforeHash = hash(before), afterHash = hash(after), publicBefore = projectSliceState(before), publicAfter = projectSliceState(after);
    assertCurrentGlobal(publicBefore, action, 'before'); assertCurrentGlobal(publicAfter, action, 'after');
    assertGlobalPublic(publicBefore, before); assertGlobalPublic(publicAfter, after);
    expect(after.status).toBe('ACTIVE'); expect(publicAfter.canAct).toBe(false);
    expect(publicAfter.maxSpirituality).toBe(count === 1039 ? 120 : 150);
    expect(after.progression.sequence).toBe(count === 1039 ? 1 : 0);
    if (count === 1039) {
      expect(action.lastIntent).toEqual({ type: 'DEATH', command: { type: 'LEARN_GUIDANCE' } });
      expect(before.death.guidanceKnown).toBe(false); expect(before.death.source).toBeNull();
      expect(after.death.guidanceKnown).toBe(true);
      expect(after.death.source).toMatchObject({ runId: before.runId, revision: before.revision });
      expect(after.cash).toBe(before.cash - 12); expect(after.actionsRemaining).toBe(before.actionsRemaining - 1);
      expect(after.random).toEqual(before.random); expect(after.injuries).toEqual(before.injuries);
    } else if (count === 1128) {
      expect(action.lastIntent).toEqual({ type: 'DEATH', command: { type: 'CONSUME', compoundId: 'death-compound-1', confirmed: true } });
      expect(before.progression.sequence).toBe(1); expect(before.random.cursor).toBe(490);
      expect(after).toMatchObject({ health: 80, mind: 80, spirituality: 78, cash: 12,
        injuries: [], injuryRisk: 0, actionsRemaining: 0, lastCheck: { chance: 70, roll: 62, tier: 'SUCCESS' } });
      expect(after.random).toEqual({ seed: before.random.seed, cursor: 491 });
      expect(after.death.journal.at(-1)!.randomReceipts).toMatchObject([
        { cursorBefore: 490, cursorAfter: 491, check: { chance: 70, roll: 62, tier: 'SUCCESS' } },
      ]);
      expect(after.spirituality).toBe(before.spirituality - 30);
    } else {
      expect(action.lastIntent).toEqual({ type: 'DEATH', command: { type: 'EPILOGUE', command: { type: 'REPORT' } } });
      expect(after).toMatchObject({ revision: 1142, week: 3331, date: { year: 1413, month: 4, day: 28 },
        health: 80, mind: 71, spirituality: 60, cash: 12, lastCheck: null,
        injuries: [], injuryRisk: 0, actionsRemaining: 0 });
      expect(after.random).toEqual(before.random); expect(after.random.cursor).toBe(493);
      expect(after.death.epilogue).toMatchObject({ status: 'RESOLVED', reported: true,
        passage: { window: { attempted: true, passed: true, applied: true } },
        barrier: { window: { attempted: true, passed: true, applied: true } } });
      expect(after.progression.mastery).toMatchObject({ 'death.s0.partial-spirit-passage': 8, 'death.s0.residual-propagation-barrier': 8 });
      expect(after.death.journal.at(-1)!.randomReceipts).toEqual([]);
    }
    const envelope: SliceEnvelope = { intentId: `death217-actual:${count}`, runId: before.runId,
      expectedRevision: before.revision, payload: structuredClone(action.lastIntent) };
    const fingerprint = stableStringify(envelope);
    const receipt: SliceReceipt = { intentId: envelope.intentId, runId: after.runId, previousRevision: before.revision,
      newRevision: after.revision, committedAt: COMMIT_TIME, replayed: false, state: publicAfter };
    const directory = mkdtempSync(join(tmpdir(), 'death217-capture-save-')), path = join(directory, 'save.sqlite');
    let store: SqliteSliceStore | undefined, injection: 'beforeWrite' | 'COMMIT' | null = null, injections = 0, hooks = 0;
    let publishing = false, durableCommits = 0;
    const exact = (wanted: SliceState, committed: boolean): void => {
      const saved = store!.repository.get(wanted.runId)!;
      same(saved.state, wanted); expect(hash(saved.state)).toBe(committed ? afterHash : beforeHash);
      expect(saved.state.random).toEqual(wanted.random); expect(saved.updatedAt).toBe(committed ? COMMIT_TIME : INITIAL_TIME);
      expect(store!.repository.activeRun()).toBe(wanted.runId);
      expect(store!.repository.receipt(envelope.intentId)).toEqual(committed ? { fingerprint, receipt } : null);
      expect(existsSync(`${path}.sealed`)).toBe(false);
    };
    const head = (wanted: SliceState): void => {
      if (!wanted.death.guidanceKnown) {
        // First guidance must not publish a new owned session from pending SQL.
        expect(store!.repository.ownedHead(wanted.runId)).toBeNull();
        expect(store!.repository.projectFoolRun(wanted.runId)).toBeNull();
      } else {
        expect(store!.repository.ownedHead(wanted.runId)).toEqual({ runId: wanted.runId, revision: wanted.revision, status: wanted.status });
        same(store!.repository.projectFoolRun(wanted.runId), wanted.revision === before.revision ? publicBefore : publicAfter);
      }
    };
    const fault = (): never => {
      // Read through this transaction's own connection: candidate + receipt
      // really exist, but the owned head must remain unpublished until COMMIT.
      exact(after, true); head(before); injections++; throw Error(`Injected Death ${injection} after actual writes`);
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
      if (injection === 'COMMIT' && sql === 'COMMIT') fault();
      if (publishing && sql === 'COMMIT') head(before);
      const result = originalExec.call(this, sql);
      if (publishing && sql === 'COMMIT') {
        // SQLite has committed, but publication still waits for exec to return.
        head(before); durableCommits++;
      }
      return result;
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
      publishing = true;
      try { expect(unwrap(store!.submitIntent(envelope))).toEqual(receipt); }
      finally { publishing = false; }
      expect(durableCommits).toBe(1); exact(after, true); head(after);
      expect(stableStringify(envelope)).toBe(fingerprint); const committed = persisted(path);
      reopen(); exact(after, true); head(after); bootstrap(true);
      same(unwrap(store!.loadRun(after.runId)), publicAfter); expect(persisted(path)).toBe(committed);
      expect(unwrap(store!.submitIntent(envelope))).toEqual({ ...receipt, replayed: true });
      exact(after, true); head(after); expect(persisted(path)).toBe(committed);
      reopen(); exact(after, true); head(after); bootstrap(true); expect(persisted(path)).toBe(committed);
      expect(hash(before)).toBe(beforeHash); expect(hash(after)).toBe(afterHash);
      expect(hash(action.beforeLast)).toBe(row.beforeStateSha256); expect(hash(action.final)).toBe(row.afterStateSha256);
    } finally { injection = null; publishing = false; spy.mockRestore(); store?.close(); rmSync(directory, { recursive: true, force: true }); }
  }, sqliteCaseBudget);
});
