import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import type { StoredSlice } from '../../src/application/slice-application.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SliceEnvelope, SliceResult } from '../../src/shared/slice-contracts.js';
import {
  authenticPerfecterBeforeConsume, assertControlledPerfecterPromotion, assertUnmodifiedPerfecterCapture,
  CONTROLLED_CONSUME, controlledHash, installControlledPerfecterPromotion,
} from '../helpers/perfecter-controlled-success.js';

/** Actual SQLite transactions from immutable before919, but explicitly CONTROLLED
 * success: only d100 cursor346 returns declared1. No natural success is claimed.
 * The same test-only seam remains active for strict cold replay after reopening.
 * Nothing writes the source captures, changes their seed/cursor or reruns play. */
const now = '2026-10-17T14:00:00.000Z';
const stores = new Set<SqliteSliceStore>(), dirs: string[] = [];
function unwrap<T>(result: SliceResult<T>): T {
  if (!result.ok) throw Error(result.error.message);
  return result.value;
}
function raw(file: string, runId: string): string {
  const db = new DatabaseSync(file, { readOnly: true });
  try { return String(db.prepare('SELECT current_json FROM slice_runs WHERE id=?').get(runId)!.current_json); }
  finally { db.close(); }
}
function saved(file: string, runId: string): SliceState {
  const value = JSON.parse(JSON.parse(raw(file, runId)).payload) as StoredSlice;
  return value.state;
}
function receiptCount(file: string): number {
  const db = new DatabaseSync(file, { readOnly: true });
  try { return Number(db.prepare('SELECT COUNT(*) AS count FROM slice_receipts').get()!.count); }
  finally { db.close(); }
}
function close(store: SqliteSliceStore): void { store.close(); stores.delete(store); }
afterEach(() => {
  vi.restoreAllMocks();
  for (const store of stores) store.close();
  stores.clear();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('Explicitly controlled Perfecter promotion in real SQLite, separate from natural dead evidence', () => {
  it.each(['beforeWrite', 'COMMIT'] as const)('rolls back %s, retries the exact dose once, and reopens S0 with the same durable receipt', failure => {
    const before = authenticPerfecterBeforeConsume(), beforeHash = controlledHash(before);
    const seam = installControlledPerfecterPromotion();
    const expected = applySliceIntent(before, CONTROLLED_CONSUME), expectedHash = controlledHash(expected);
    assertControlledPerfecterPromotion(before, expected);
    const expectedPublic = projectSliceState(expected);
    const dir = mkdtempSync(join(tmpdir(), 'lotm-perfecter-controlled-promotion-')); dirs.push(dir);
    const file = join(dir, 'save.sqlite');
    let injectFailure = false, faultHits = 0;
    const store = new SqliteSliceStore(file, { now: () => now, beforeWrite: () => {
      if (injectFailure && failure === 'beforeWrite') { faultHits++; throw Error('Explicit controlled test: beforeWrite failure'); }
    } });
    stores.add(store);
    store.repository.transaction(() => {
      store.repository.put({ state: before, updatedAt: now });
      store.repository.selectRun('previous-selected-slot');
    });
    const envelope: SliceEnvelope = { intentId: `controlled-perfecter-dose-${failure}`, runId: before.runId,
      expectedRevision: before.revision, payload: structuredClone(CONTROLLED_CONSUME) };
    const envelopeHash = controlledHash(envelope), bytesBefore = raw(file, before.runId);
    const priorSelection = store.repository.activeRun();
    expect(store.repository.ownedHead(before.runId)?.revision).toBe(919);
    const originalExec = DatabaseSync.prototype.exec;
    const commitSpy = failure === 'COMMIT' ? vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function (this: DatabaseSync, sql: string) {
      if (injectFailure && sql === 'COMMIT') { faultHits++; throw Error('Explicit controlled test: COMMIT failure before disk commit'); }
      return originalExec.call(this, sql);
    }) : null;
    injectFailure = true;
    expect(store.submitIntent(envelope)).toMatchObject({ ok: false, error: { code: 'SAVE_FAILED' } });
    expect(faultHits).toBe(1);
    expect(raw(file, before.runId)).toBe(bytesBefore);
    expect(controlledHash(saved(file, before.runId))).toBe(beforeHash);
    expect(store.repository.ownedHead(before.runId)?.revision).toBe(919);
    expect(store.repository.receipt(envelope.intentId)).toBeNull(); expect(receiptCount(file)).toBe(0);
    expect(store.repository.activeRun()).toBe(priorSelection);

    injectFailure = false; commitSpy?.mockRestore();
    const receipt = unwrap(store.submitIntent(envelope));
    expect(receipt).toMatchObject({ intentId: envelope.intentId, runId: before.runId,
      previousRevision: 919, newRevision: 920, committedAt: now, replayed: false });
    expect(receipt.state).toEqual(expectedPublic);
    expect(controlledHash(envelope)).toBe(envelopeHash);
    const committed = saved(file, before.runId); assertValidSliceState(committed);
    assertControlledPerfecterPromotion(before, committed);
    expect(controlledHash(committed)).toBe(expectedHash);
    expect(store.repository.ownedHead(before.runId)?.revision).toBe(920);
    expect(receiptCount(file)).toBe(1);
    const committedBytes = raw(file, before.runId);
    expect(unwrap(store.submitIntent(envelope))).toEqual({ ...receipt, replayed: true });
    expect(raw(file, before.runId)).toBe(committedBytes); expect(receiptCount(file)).toBe(1);

    close(store);
    const reopened = new SqliteSliceStore(file, { now: () => now }); stores.add(reopened);
    expect(unwrap(reopened.loadRun(before.runId))).toEqual(expectedPublic);
    expect(unwrap(reopened.getBootstrap()).activeState).toEqual(expectedPublic);
    expect(unwrap(reopened.submitIntent(envelope))).toEqual({ ...receipt, replayed: true });
    expect(controlledHash(saved(file, before.runId))).toBe(expectedHash);
    expect(reopened.repository.ownedHead(before.runId)?.revision).toBe(920);
    // A fresh identity cannot re-consume the same already fused originals.
    expect(reopened.submitIntent({ ...envelope, intentId: `${envelope.intentId}-repeat-dose`, expectedRevision: 920 })).toMatchObject({ ok: false });
    expect(raw(file, before.runId)).toBe(committedBytes); expect(receiptCount(file)).toBe(1);
    expect(controlledHash(before)).toBe(beforeHash);
    expect(seam.substituted.length).toBeGreaterThan(0);
    expect(seam.substituted.every(draw => draw.cursorBefore === 346 && draw.cursorAfter === 347 && draw.actual === 81 && draw.controlled === 1)).toBe(true);
    assertUnmodifiedPerfecterCapture();
  }, 60_000);
});
