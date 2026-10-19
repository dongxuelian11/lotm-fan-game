import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { openMoonRuntimeSession } from '../../src/domain/moon/owned-session.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import type { SliceEnvelope, SliceReceipt, SliceResult } from '../../src/shared/slice-contracts.js';
import {
  PREFIX, actualReceipts, assertGlobalPublic, assertPublicAction, authenticateInputs, capturePublic, hash,
  historicalMoonState, loadCapture, migrateCapturedMoonState, outcome, readBoundary, same, sha, type LoadedCapture,
} from '../helpers/moon-capture.js';

/** Whole-input integrity plus exactly THREE reviewed, genuine captured SQLite
 * transitions. Does not replay original670 or the unselected continuation.
 * scripts/verify/moon-stage-saves.mjs separately owns all-selected-boundary
 * durable audit evidence; these three tests never stand in for that report. */
let data: LoadedCapture | undefined;
beforeAll(() => { data = loadCapture(); }, 180_000);
afterAll(() => { if (data) authenticateInputs(data.pins); }, 180_000);
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
  assertValidSliceState(state);
  const direct = projectSliceState(state); assertGlobalPublic(direct, state);
  if (!state.moon.guidanceKnown) return direct;
  const session = openMoonRuntimeSession(state);
  same(session.snapshot(), state); same(session.project(), direct);
  const authored = session.projectMoon(), before = hash(authored);
  expect(direct.moon).toEqual(projectPlayerText(structuredClone(authored), state.character.name));
  expect(hash(authored)).toBe(before); return direct;
}
const head = (state: SliceState) => state.moon.guidanceKnown ? { runId: state.runId, revision: state.revision, status: state.status } : null;

describe('Moon212 compressed captured transitions through real SQLite', () => {
  for (const sample of [0, 1, 2] as const) it(`rolls back, retries, reopens and deduplicates reviewed actual representative ${sample}`, () => {
    const { checkpoint: cp, rows, pins } = data!;
    const count = pins.sqliteCommandCounts[sample], selected = cp.boundaries.find(item => item.commandCount === count)!;
    const row = rows[count - PREFIX - 1]!;
    expect(selected).toBeDefined(); expect(row).toBeDefined();
    const boundary = readBoundary(selected, row);
    expect(hash(boundary.beforeLast)).toBe(row.beforeStateSha256); expect(hash(boundary.final)).toBe(row.afterStateSha256);
    const before = migrateCapturedMoonState(boundary.beforeLast), after = migrateCapturedMoonState(boundary.final);
    expect(before.status).toBe('ACTIVE');
    expect(hash(historicalMoonState(before))).toBe(row.beforeStateSha256); expect(hash(historicalMoonState(after))).toBe(row.afterStateSha256);
    const publicBefore = publicState(before), publicAfter = publicState(after);
    expect(hash(capturePublic(publicBefore, before))).toBe(row.publicBeforeSha256);
    expect(hash(capturePublic(publicAfter, after))).toBe(row.publicAfterSha256);
    same(capturePublic(publicAfter, after), boundary.public); expect(outcome(boundary.public)).toEqual(row.selectionOutcome);
    assertPublicAction(capturePublic(publicBefore, before), row); same(actualReceipts(after, before), row.receipts);
    const envelope: SliceEnvelope = { intentId: `moon212-captured:${count}`, runId: before.runId,
      expectedRevision: before.revision, payload: structuredClone(boundary.lastIntent) };
    const envelopeBytes = stableStringify(envelope);
    const receipt: SliceReceipt = { intentId: envelope.intentId, runId: after.runId, previousRevision: before.revision,
      newRevision: after.revision, committedAt: COMMIT_TIME, replayed: false, state: publicAfter };
    const directory = mkdtempSync(join(tmpdir(), 'moon212-capture-save-')), path = join(directory, 'save.sqlite');
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
      if (wanted.moon.guidanceKnown) expect(store!.repository.projectFoolRun(wanted.runId)).toEqual(wanted.revision === before.revision ? publicBefore : publicAfter);
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
      if (after.status === 'DEAD') {
        expect(JSON.parse(readFileSync(`${path}.sealed`, 'utf8'))).toEqual([after.runId]); expect(publicAfter.canAct).toBe(false);
        const blocked = store!.submitIntent({ ...envelope, intentId: `${envelope.intentId}:sealed`, expectedRevision: after.revision,
          payload: after.moon.guidanceKnown ? { type: 'MOON', command: { type: 'REST' } } : { type: 'ACTION', action: 'REST' } });
        expect(blocked).toMatchObject({ ok: false, error: { code: 'ARCHIVED' } }); expect(persisted(path)).toBe(committed);
      } else {
        expect(existsSync(`${path}.sealed`)).toBe(false);
        if (after.status === 'SLICE_COMPLETE') expect(publicAfter.canAct).toBe(false);
      }
      reopen(); exact(after, true); checkHead(after); bootstrap(publicAfter); expect(persisted(path)).toBe(committed);
    } finally {
      injection = null; spy.mockRestore(); store?.close(); rmSync(directory, { recursive: true, force: true });
    }
  }, sample === 2 ? 300_000 : 180_000);
});
