/** Authentic living679 history -> the complete paid Darkness continuation ->
 * real SQLite import and application CONSUME. This is an explicitly controlled
 * S0 branch, never a natural success capture. The one new d100 control remains
 * installed throughout cold validation, saving and reopening; transaction
 * faults only interrupt persistence and never manufacture domain authority. */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import type { StoredSlice } from '../../src/application/slice-application.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { openDarknessRuntimeSession } from '../../src/domain/darkness/owned-session.js';
import { DARKNESS_FROZEN_SOURCE_KEYS } from '../../src/domain/darkness/source.js';
import type { SliceEnvelope, SliceReceipt, SliceResult } from '../../src/shared/slice-contracts.js';
import {
  DARKNESS_CONTROLLED_CONSUME, DARKNESS_CONTROLLED_CURSOR, DARKNESS_CONTROLLED_SEED,
  assertUnmodifiedDarknessInputs, controlledDarknessSuccess, darknessScenarioHash,
  installControlledDarknessPromotion, type ControlledDarknessSuccess,
} from '../helpers/darkness-scenario.js';

const observed = vi.hoisted(() => ({ opens: 0, prepares: 0, commits: 0, discards: 0,
  revisions: [] as (() => number)[] }));
vi.mock('../../src/domain/darkness/owned-session.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/domain/darkness/owned-session.js')>();
  return { ...actual, openDarknessRuntimeSession: (input: unknown) => {
    const session = actual.openDarknessRuntimeSession(input);
    observed.opens++; observed.revisions.push(() => session.inspect().revision);
    return Object.freeze({ ...session,
      prepare: (...args: Parameters<typeof session.prepare>) => { observed.prepares++; return session.prepare(...args); },
      commit: (...args: Parameters<typeof session.commit>) => { session.commit(...args); observed.commits++; },
      discard: (...args: Parameters<typeof session.discard>) => { session.discard(...args); observed.discards++; },
    });
  } };
});

const importedAt = '2026-10-17T19:00:00.000Z', committedAt = '2026-10-17T19:00:01.000Z';
const previousSelection = 'previous-selected-slot';
// One authentic full construction is shared read-only. Each 180s case includes
// strict predecessor replay on genuine SQLite import and/or cold reopening.
const fullHistoryBudget = 180_000;
let seam: ReturnType<typeof installControlledDarknessPromotion>;
let scenario: ControlledDarknessSuccess;
let beforeProjection: SliceProjection, successProjection: SliceProjection;
let beforeHash: string, successHash: string;
const stores: SqliteSliceStore[] = [], directories: string[] = [], restorers: (() => void)[] = [];

function unwrap<T>(value: SliceResult<T>): T {
  if (!value.ok) throw Error(`${value.error.code}: ${value.error.message}`);
  return value.value;
}
function envelope(id: string): SliceEnvelope {
  return { intentId: id, runId: scenario.beforeConsume.runId,
    expectedRevision: scenario.beforeConsume.revision, payload: structuredClone(DARKNESS_CONTROLLED_CONSUME) };
}
function open(file: string, beforeWrite?: () => void): SqliteSliceStore {
  const store = new SqliteSliceStore(file, { now: () => committedAt, ...(beforeWrite ? { beforeWrite } : {}) });
  stores.push(store); return store;
}
function close(store: SqliteSliceStore): void {
  store.close(); stores.splice(stores.indexOf(store), 1);
}
function disk(state: SliceState, beforeWrite?: () => void) {
  const directory = mkdtempSync(join(tmpdir(), 'lotm-darkness-owned-'));
  directories.push(directory);
  const file = join(directory, 'save.sqlite'), store = open(file, beforeWrite);
  // Import the unedited output of actual commands through the real strict
  // repository gate. No synthetic CREATE receipt or directly inserted S0 row.
  store.repository.transaction(() => {
    store.repository.put({ state, updatedAt: importedAt });
    store.repository.selectRun(previousSelection);
  });
  return { file, store };
}
function raw(file: string): string {
  const db = new DatabaseSync(file, { readOnly: true });
  try { return String(db.prepare('SELECT current_json FROM slice_runs WHERE id=?').get(scenario.source.runId)!.current_json); }
  finally { db.close(); }
}
function stored(file: string): StoredSlice { return JSON.parse(JSON.parse(raw(file)).payload) as StoredSlice; }
function fileHash(file: string): string | null {
  return existsSync(file) ? createHash('sha256').update(readFileSync(file)).digest('hex') : null;
}
function persisted(file: string): string {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return stableStringify({
      runs: db.prepare('SELECT * FROM slice_runs ORDER BY id').all(),
      receipts: db.prepare('SELECT * FROM slice_receipts ORDER BY id').all(),
      meta: db.prepare('SELECT * FROM slice_meta ORDER BY key').all(),
      backup: fileHash(`${file}.bak`), sealed: fileHash(`${file}.sealed`),
      files: readdirSync(dirname(file)).sort(),
    });
  } finally { db.close(); }
}
function replaceRaw(file: string, state: SliceState): void {
  const payload = stableStringify({ state, updatedAt: importedAt });
  const encoded = JSON.stringify({ format: 1, checksum: createHash('sha256').update(payload).digest('hex'), payload });
  const db = new DatabaseSync(file);
  try { db.prepare('UPDATE slice_runs SET current_json=? WHERE id=?').run(encoded, scenario.source.runId); }
  finally { db.close(); }
}

beforeAll(() => {
  seam = installControlledDarknessPromotion();
  scenario = controlledDarknessSuccess(seam);
  beforeHash = darknessScenarioHash(scenario.beforeConsume); successHash = darknessScenarioHash(scenario.success);
  beforeProjection = projectSliceState(scenario.beforeConsume); successProjection = projectSliceState(scenario.success);
  expect(scenario.beforeConsume.progression.sequence).toBe(1);
  expect(scenario.success.progression.sequence).toBe(0);
  expect(scenario.success.revision).toBe(scenario.beforeConsume.revision + 1);
  expect(scenario.cursorAdvancement).toMatchObject({ cursorBefore: 348, cursorAfter: 349, chance: 70, roll: 1 });
}, fullHistoryBudget);
beforeEach(() => {
  observed.opens = 0; observed.prepares = 0; observed.commits = 0; observed.discards = 0; observed.revisions.length = 0;
});
afterEach(() => {
  // Do not restoreAllMocks here: strict cold reads still need the declared RNG
  // seam. Restore only persistence spies, then close every isolated database.
  for (const restore of restorers.splice(0).reverse()) restore();
  for (const store of stores.splice(0)) store.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
  observed.revisions.length = 0;
});
afterAll(() => {
  try {
    if (scenario) {
      expect(darknessScenarioHash(scenario.beforeConsume)).toBe(beforeHash);
      expect(darknessScenarioHash(scenario.success)).toBe(successHash);
      expect(seam.substituted.length).toBeGreaterThan(0);
      expect(seam.substituted.every(draw => draw.cursorBefore === 348 && draw.cursorAfter === 349 && draw.controlled === 1)).toBe(true);
    }
    assertUnmodifiedDarknessInputs();
  } finally { seam?.restore(); }
}, fullHistoryBudget);

describe('Darkness real-history owned S0 transactions with an explicit one-draw control', () => {
  it.each(['beforeWrite', 'commit'] as const)(
    'rolls back %s after actual CONSUME writes, retries the identical RNG intent and strictly reopens one durable result', failure => {
      const before = scenario.beforeConsume, success = scenario.success;
      let fail = false, watch = false, stagedChecks = 0, commitChecks = 0;
      const checkUnpublished = (): void => {
        expect(observed.commits).toBe(0);
        expect(observed.revisions.at(-1)!()).toBe(before.revision);
        expect(store.repository.ownedHead(before.runId)?.revision).toBe(before.revision);
      };
      const beforeWrite = (): void => {
        if (!watch) return;
        checkUnpublished();
        const pending = store.repository.get(before.runId)!;
        expect(darknessScenarioHash(pending.state)).toBe(successHash);
        expect(pending.updatedAt).toBe(committedAt);
        expect(store.repository.receipt(request.intentId)?.receipt.newRevision).toBe(success.revision);
        // Inspect pending rows through this transaction's own connection: a
        // multi-megabyte full history may legitimately trigger cache-spill
        // locks that exclude an unrelated reader until COMMIT or ROLLBACK.
        stagedChecks++;
        if (fail && failure === 'beforeWrite') throw Error('Injected Darkness beforeWrite failure after real CONSUME writes');
      };
      const fixture = disk(before, beforeWrite), file = fixture.file;
      let store = fixture.store;
      close(store); store = open(file, beforeWrite);
      expect(store.repository.ownedHead(before.runId)?.revision).toBe(before.revision);
      const request = envelope(`darkness-consume-${failure}`), requestBytes = stableStringify(request);
      const originalRaw = raw(file), original = persisted(file), opened = observed.opens;
      const exec = DatabaseSync.prototype.exec;
      const spy = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function (this: DatabaseSync, sql: string) {
        if (watch && sql === 'COMMIT') {
          checkUnpublished(); commitChecks++;
          if (fail && failure === 'commit') throw Error('Injected Darkness COMMIT failure before durability');
        }
        const result = exec.call(this, sql);
        if (watch && sql === 'COMMIT') {
          // SQL is now durable; the private session must still be unpublished
          // until the repository returns from this successful COMMIT call.
          expect(observed.commits).toBe(0);
          expect(observed.revisions.at(-1)!()).toBe(before.revision);
          expect(darknessScenarioHash(stored(file).state)).toBe(successHash);
        }
        return result;
      });
      restorers.push(() => spy.mockRestore());
      fail = true; watch = true;
      try { expect(store.submitIntent(request)).toMatchObject({ ok: false, error: { code: 'SAVE_FAILED' } }); }
      finally { watch = false; }
      expect(stagedChecks).toBe(1); expect(observed.prepares).toBe(1); expect(observed.discards).toBe(1);
      expect(observed.commits).toBe(0); expect(observed.opens).toBe(opened);
      expect(persisted(file)).toBe(original); expect(raw(file)).toBe(originalRaw);
      expect(store.repository.receipt(request.intentId)).toBeNull();
      expect(store.repository.activeRun()).toBe(previousSelection);
      expect(store.repository.ownedHead(before.runId)?.revision).toBe(before.revision);
      expect(stored(file).state.random).toEqual({ seed: DARKNESS_CONTROLLED_SEED, cursor: DARKNESS_CONTROLLED_CURSOR });

      fail = false; watch = true;
      let receipt!: SliceReceipt;
      try { receipt = unwrap(store.submitIntent(request)); }
      finally { watch = false; }
      spy.mockRestore();
      expect(stagedChecks).toBe(2); expect(commitChecks).toBe(failure === 'commit' ? 2 : 1);
      expect(observed.opens).toBe(opened); expect(observed.prepares).toBe(2); expect(observed.commits).toBe(1);
      expect(receipt).toMatchObject({ intentId: request.intentId, previousRevision: before.revision,
        newRevision: success.revision, committedAt, replayed: false });
      expect(receipt.state).toEqual(successProjection);
      const saved = stored(file);
      expect(darknessScenarioHash(saved.state)).toBe(successHash);
      expect(saved.state.random).toEqual({ seed: DARKNESS_CONTROLLED_SEED, cursor: DARKNESS_CONTROLLED_CURSOR + 1 });
      expect(saved.state.darkness.journal.flatMap(event => event.randomReceipts)).toEqual(success.darkness.journal.at(-1)!.randomReceipts);
      expect(saved.state.darkness.journal.at(-1)!.randomReceipts[0]).toMatchObject({ cursorBefore: 348, cursorAfter: 349, check: { chance: 70, roll: 1 } });
      expect(store.repository.ownedHead(before.runId)?.revision).toBe(success.revision);
      expect(store.repository.activeRun()).toBe(before.runId);
      expect(stableStringify(request)).toBe(requestBytes);
      const committed = raw(file);
      expect(unwrap(store.submitIntent(request))).toEqual({ ...receipt, replayed: true });
      expect(observed.prepares).toBe(2); expect(observed.commits).toBe(1); expect(raw(file)).toBe(committed);
      close(store); store = open(file);
      expect(unwrap(store.loadRun(before.runId))).toEqual(successProjection);
      expect(unwrap(store.getBootstrap()).activeState).toEqual(successProjection);
      expect(unwrap(store.submitIntent(request))).toEqual({ ...receipt, replayed: true });
      expect(store.repository.ownedHead(before.runId)?.revision).toBe(success.revision);
      expect(observed.prepares).toBe(2); expect(observed.commits).toBe(1);
      expect(raw(file)).toBe(committed); expect(darknessScenarioHash(stored(file).state)).toBe(successHash);
      for (const key of DARKNESS_FROZEN_SOURCE_KEYS) expect(saved.state[key]).toEqual(scenario.source[key]);
      assertUnmodifiedDarknessInputs();
    }, fullHistoryBudget,
  );

  it('keeps bootstrap read-only through a lost COMMIT acknowledgement and never publishes its failed candidate', () => {
    let failWrites = false;
    const beforeWrite = vi.fn(() => { if (failWrites) throw Error('Writes unavailable during Darkness bootstrap'); });
    const { file, store } = disk(scenario.success, beforeWrite);
    failWrites = true; beforeWrite.mockClear();
    const before = persisted(file), databaseHash = fileHash(file), opened = observed.opens;
    const exec = DatabaseSync.prototype.exec, statements: string[] = [];
    const spy = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function (this: DatabaseSync, sql: string) {
      statements.push(sql);
      const result = exec.call(this, sql);
      if (sql === 'COMMIT') throw Error('Lost read-only Darkness bootstrap COMMIT acknowledgement');
      return result;
    });
    restorers.push(() => spy.mockRestore());
    expect(store.getBootstrap()).toMatchObject({ ok: false, error: { code: 'SAVE_UNAVAILABLE' } });
    spy.mockRestore();
    expect(statements).toEqual(['BEGIN', 'COMMIT']);
    expect(observed.opens).toBe(opened + 1); expect(observed.commits).toBe(0);
    expect(beforeWrite).not.toHaveBeenCalled();
    expect(persisted(file)).toBe(before); expect(fileHash(file)).toBe(databaseHash);
    expect(store.repository.activeRun()).toBe(previousSelection);
    expect(store.repository.ownedHead(scenario.success.runId)?.revision).toBe(scenario.success.revision);
    expect(observed.opens).toBe(opened + 2); // Failed read candidate conveyed no authority.
    expect(unwrap(store.getBootstrap()).activeState).toEqual(successProjection);
    expect(beforeWrite).not.toHaveBeenCalled();
    expect(store.repository.activeRun()).toBe(previousSelection);
    expect(persisted(file)).toBe(before); expect(fileHash(file)).toBe(databaseHash);
    expect(darknessScenarioHash(stored(file).state)).toBe(successHash);
  }, fullHistoryBudget);

  it('keeps detached Darkness snapshots, copied drafts and another session from granting commit authority', () => {
    const first = openDarknessRuntimeSession(scenario.beforeConsume), second = openDarknessRuntimeSession(scenario.beforeConsume);
    const snapshot = first.snapshot(); snapshot.revision++; snapshot.darkness.source!.budget.cash++;
    expect(darknessScenarioHash(first.snapshot())).toBe(beforeHash);
    const cancelled = first.prepare(DARKNESS_CONTROLLED_CONSUME, scenario.beforeConsume.revision);
    first.discard(cancelled); expect(() => first.commit(cancelled)).toThrow();
    const draft = first.prepare(DARKNESS_CONTROLLED_CONSUME, scenario.beforeConsume.revision);
    const sibling = first.prepare(DARKNESS_CONTROLLED_CONSUME, scenario.beforeConsume.revision);
    expect(darknessScenarioHash(first.snapshotDraft(draft))).toBe(successHash);
    expect(first.projectDraft(draft)).toEqual(successProjection);
    const detached = first.snapshotDraft(draft); detached.random.cursor++; detached.darkness.journal.pop();
    expect(darknessScenarioHash(first.snapshotDraft(draft))).toBe(successHash);
    expect(() => second.commit(draft)).toThrow(); expect(() => first.commit({ ...draft })).toThrow();
    expect(() => first.prepare(DARKNESS_CONTROLLED_CONSUME, scenario.beforeConsume.revision + 1)).toThrow();
    expect(darknessScenarioHash(first.snapshot())).toBe(beforeHash);
    first.commit(draft);
    expect(first.inspect().revision).toBe(scenario.success.revision);
    expect(() => first.commit(draft)).toThrow(); expect(() => first.commit(sibling)).toThrow();
    expect(() => first.prepare({ type: 'MOON', command: { type: 'REST' } }, scenario.success.revision)).toThrow();
    expect(darknessScenarioHash(first.snapshot())).toBe(successHash);
    expect(first.project()).toEqual(successProjection); expect(second.project()).toEqual(beforeProjection);
    for (const field of ['source', 'frame', 'journal', 'engine', 'draft']) expect(first.projectDarkness()).not.toHaveProperty(field);
  }, fullHistoryBudget);

  it('rejects checksum-valid bare S0 and missing CONSUME history without overwriting the original database or retaining trust', () => {
    const { file, store } = disk(scenario.success), originalRaw = raw(file), originalHash = successHash;
    expect(store.repository.ownedHead(scenario.success.runId)?.revision).toBe(scenario.success.revision);
    const forgeries: { name: string; base: SliceState; change: (state: SliceState) => void }[] = [
      { name: 'bare S0 on untouched living S1', base: scenario.source, change: state => { state.progression.sequence = 0; } },
      { name: 'S0 missing its actual CONSUME event', base: scenario.success, change: state => { state.darkness.journal.pop(); } },
    ];
    for (const forgery of forgeries) {
      const forged = structuredClone(forgery.base); forgery.change(forged);
      expect(() => store.repository.transaction(() => store.repository.put({ state: forged, updatedAt: importedAt })), forgery.name).toThrow();
      expect(raw(file)).toBe(originalRaw);
      replaceRaw(file, forged);
      const rejectedBytes = raw(file), rejected = persisted(file), databaseHash = fileHash(file);
      expect(store.getBootstrap(), forgery.name).toMatchObject({ ok: false, error: { code: 'SAVE_UNAVAILABLE' } });
      expect(() => store.repository.ownedHead(scenario.success.runId), forgery.name).toThrow();
      expect(store.loadRun(scenario.success.runId), forgery.name).toMatchObject({ ok: false, error: { code: 'SAVE_UNAVAILABLE' } });
      expect(store.submitIntent({ ...envelope('darkness-forged-consume'), expectedRevision: forged.revision }), forgery.name)
        .toMatchObject({ ok: false, error: { code: 'SAVE_FAILED' } });
      expect(raw(file)).toBe(rejectedBytes); expect(persisted(file)).toBe(rejected); expect(fileHash(file)).toBe(databaseHash);
      expect(store.repository.activeRun()).toBe(previousSelection);
      expect(store.repository.receipt('darkness-forged-consume')).toBeNull();
      replaceRaw(file, scenario.success);
      const opened = observed.opens;
      expect(store.repository.ownedHead(scenario.success.runId)?.revision).toBe(scenario.success.revision);
      expect(observed.opens).toBe(opened + 1); // Restored bytes must strictly reopen.
      expect(raw(file)).toBe(originalRaw);
      expect(darknessScenarioHash(stored(file).state)).toBe(originalHash);
    }
    close(store);
    const reopened = open(file);
    expect(unwrap(reopened.getBootstrap()).activeState).toEqual(successProjection);
    expect(darknessScenarioHash(stored(file).state)).toBe(originalHash);
    assertUnmodifiedDarknessInputs();
  }, fullHistoryBudget);
});
