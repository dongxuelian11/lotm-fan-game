import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import { openDarknessRuntimeSession } from '../../src/domain/darkness/owned-session.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import type { SliceEnvelope, SliceReceipt, SliceResult } from '../../src/shared/slice-contracts.js';
import {
  PINS, PREFIX, actualReceipts, assertGlobalPublic, assertPublicAction, authenticateInputs, capturePublic, hash,
  historicalDarknessPublic, historicalDarknessState, loadCapture, migrateCapturedDarknessState, outcome, readBoundary, same, sha, type LoadedCapture,
} from '../helpers/darkness-capture.js';

/** Complete immutable input integrity plus exactly THREE actual captured
 * transitions: guidance680, natural promotion814 and final report834.
 * Each case injects beforeWrite and pre-COMMIT failures, then retries the SAME
 * intent and cold-reopens one durable result. No old679 or full155 replay here.
 * The independent stage-save verifier owns all22 selected SQLite boundaries;
 * this representative Vitest file does not claim that complete audit. */
let data: LoadedCapture | undefined;
beforeAll(() => { data = loadCapture(); }, 180_000);
afterAll(() => { if (data) authenticateInputs(); }, 180_000);
const INITIAL_TIME = '2026-10-17T00:00:00.000Z', COMMIT_TIME = '2026-10-17T00:00:01.000Z';
function unwrap<T>(result: SliceResult<T>): T {
  if (!result.ok) throw Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}
function persisted(path: string): string {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return stableStringify({
      runs: db.prepare('SELECT * FROM slice_runs ORDER BY id').all(),
      receipts: db.prepare('SELECT * FROM slice_receipts ORDER BY id').all(),
      meta: db.prepare('SELECT * FROM slice_meta ORDER BY key').all(),
      backup: existsSync(`${path}.bak`) ? sha(readFileSync(`${path}.bak`)) : null,
      sealed: existsSync(`${path}.sealed`) ? sha(readFileSync(`${path}.sealed`)) : null,
    });
  } finally { db.close(); }
}
function publicState(state: SliceState): SliceProjection {
  const direct = projectSliceState(state); assertGlobalPublic(direct, state);
  if (!state.darkness.guidanceKnown) return direct;
  const session = openDarknessRuntimeSession(state);
  same(session.snapshot(), state); same(session.project(), direct);
  const authored = session.projectDarkness(), before = hash(authored);
  expect(direct.darkness).toEqual(projectPlayerText(structuredClone(authored), state.character.name));
  expect(hash(authored)).toBe(before); return direct;
}
const head = (state: SliceState) => state.darkness.guidanceKnown ? { runId: state.runId, revision: state.revision, status: state.status } : null;

describe('Darkness213 compressed captured transitions through real SQLite', () => {
  it.each([0, 1, 2] as const)('rolls back, retries, reopens and deduplicates reviewed actual representative %i', sample => {
    const { checkpoint: cp, rows } = data!;
    const count = PINS.sqliteCommandCounts[sample], selected = cp.boundaries.find(item => item.commandCount === count)!;
    const row = rows[count - PREFIX - 1]!;
    expect(selected).toBeDefined(); expect(row).toBeDefined();
    const boundary = readBoundary(selected, row);
    expect(hash(boundary.beforeLast)).toBe(row.beforeStateSha256); expect(hash(boundary.final)).toBe(row.afterStateSha256);
    const before = migrateCapturedDarknessState(boundary.beforeLast), after = migrateCapturedDarknessState(boundary.final);
    expect(before.status).toBe('ACTIVE');
    expect(hash(historicalDarknessState(before))).toBe(row.beforeStateSha256); expect(hash(historicalDarknessState(after))).toBe(row.afterStateSha256);
    const publicBefore = publicState(before), publicAfter = publicState(after);
    expect(hash(historicalDarknessPublic(publicBefore, before))).toBe(row.globalPublicBeforeSha256);
    expect(hash(historicalDarknessPublic(publicAfter, after))).toBe(row.globalPublicAfterSha256);
    expect(hash(capturePublic(publicBefore))).toBe(row.publicBeforeSha256);
    expect(hash(capturePublic(publicAfter))).toBe(row.publicAfterSha256);
    same(capturePublic(publicAfter), boundary.public); expect(outcome(boundary.public)).toEqual(row.selectionOutcome);
    assertPublicAction(capturePublic(publicBefore), row); same(actualReceipts(after, before), row.receipts);
    const envelope: SliceEnvelope = { intentId: `darkness213-captured:${count}`, runId: before.runId,
      expectedRevision: before.revision, payload: structuredClone(boundary.lastIntent) };
    const envelopeBytes = stableStringify(envelope);
    const receipt: SliceReceipt = { intentId: envelope.intentId, runId: after.runId, previousRevision: before.revision,
      newRevision: after.revision, committedAt: COMMIT_TIME, replayed: false, state: publicAfter };
    const directory = mkdtempSync(join(tmpdir(), 'darkness213-capture-save-')), path = join(directory, 'save.sqlite');
    let store: SqliteSliceStore | undefined, injection: 'beforeWrite' | 'COMMIT' | null = null, injections = 0, hooks = 0;
    const exact = (wanted: SliceState, committed: boolean): void => {
      const saved = store!.repository.get(wanted.runId)!;
      expect(hash(saved.state)).toBe(hash(wanted)); expect(saved.state.random).toEqual(wanted.random);
      expect(saved.updatedAt).toBe(committed ? COMMIT_TIME : INITIAL_TIME);
      expect(store!.repository.activeRun()).toBe(wanted.runId);
      expect(store!.repository.receipt(envelope.intentId)).toEqual(committed ? { fingerprint: envelopeBytes, receipt } : null);
    };
    const checkHead = (wanted: SliceState): void => {
      expect(store!.repository.ownedHead(wanted.runId)).toEqual(head(wanted));
      if (wanted.darkness.guidanceKnown) expect(store!.repository.projectFoolRun(wanted.runId)).toEqual(wanted.revision === before.revision ? publicBefore : publicAfter);
    };
    const fault = (): never => {
      // Private state and receipt have really been applied inside this SQLite
      // transaction, but the authoritative runtime head is still the old one.
      exact(after, true); checkHead(before); injections++;
      throw Error(`Injected captured ${injection} failure after real state/RNG/receipt writes`);
    };
    const open = (): SqliteSliceStore => new SqliteSliceStore(path, {
      now: () => COMMIT_TIME, beforeWrite: () => { hooks++; if (injection === 'beforeWrite') fault(); },
    });
    const reopen = (): void => { store!.close(); store = undefined; store = open(); };
    const bootstrap = (projection: SliceProjection): void => {
      const oldHooks = hooks, oldRows = persisted(path);
      expect(unwrap(store!.getBootstrap()).activeState).toEqual(projection);
      expect(hooks).toBe(oldHooks); expect(persisted(path)).toBe(oldRows);
    };
    const originalExec = DatabaseSync.prototype.exec;
    const spy = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function (this: DatabaseSync, sql: string) {
      if (injection === 'COMMIT' && sql === 'COMMIT') fault();
      return originalExec.call(this, sql);
    });
    try {
      store = open();
      store.repository.transaction(() => { store!.repository.put({ state: before, updatedAt: INITIAL_TIME }); store!.repository.selectRun(before.runId); });
      reopen(); exact(before, false); checkHead(before); bootstrap(publicBefore);
      const untouched = persisted(path);
      for (const mode of ['beforeWrite', 'COMMIT'] as const) {
        injections = 0; injection = mode;
        try { expect(store!.submitIntent(envelope)).toMatchObject({ ok: false, error: { code: 'SAVE_FAILED' } }); }
        finally { injection = null; }
        expect(injections).toBe(1); exact(before, false); checkHead(before); expect(persisted(path)).toBe(untouched);
        reopen(); exact(before, false); checkHead(before); bootstrap(publicBefore); expect(persisted(path)).toBe(untouched);
      }
      expect(unwrap(store!.submitIntent(envelope))).toEqual(receipt); exact(after, true); checkHead(after);
      expect(stableStringify(envelope)).toBe(envelopeBytes);
      const committed = persisted(path);
      reopen(); exact(after, true); checkHead(after); bootstrap(publicAfter);
      expect(unwrap(store!.loadRun(after.runId))).toEqual(publicAfter); expect(persisted(path)).toBe(committed);
      expect(unwrap(store!.submitIntent(envelope))).toEqual({ ...receipt, replayed: true });
      exact(after, true); checkHead(after); expect(persisted(path)).toBe(committed);
      expect(after.status).toBe('ACTIVE'); expect(existsSync(`${path}.sealed`)).toBe(false);
      reopen(); exact(after, true); checkHead(after); bootstrap(publicAfter); expect(persisted(path)).toBe(committed);
    } finally {
      injection = null; spy.mockRestore(); store?.close(); rmSync(directory, { recursive: true, force: true });
    }
  }, 240_000);
});
