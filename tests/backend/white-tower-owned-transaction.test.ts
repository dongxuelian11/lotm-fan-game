/** Authentic 666-command living history -> the complete paid WhiteTower continuation ->
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
import { WHITE_TOWER_FROZEN_SOURCE_KEYS } from '../../src/domain/white-tower/source.js';
import type { SliceEnvelope, SliceReceipt, SliceResult } from '../../src/shared/slice-contracts.js';
import {
  WHITE_TOWER_CONTROLLED_CONSUME, WHITE_TOWER_CONTROLLED_CURSOR, WHITE_TOWER_CONTROLLED_SEED,
  assertUnmodifiedWhiteTowerInput, assertWhiteTowerPublicBoundary, controlledWhiteTowerSuccess, whiteTowerScenarioHash,
  installControlledWhiteTowerPromotion, type ControlledWhiteTowerSuccess,
} from '../helpers/white-tower-scenario.js';

const observed = vi.hoisted(() => ({ opens: 0, prepares: 0, commits: 0, discards: 0,
  revisions: [] as (() => number)[] }));
vi.mock('../../src/domain/white-tower/owned-session.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/domain/white-tower/owned-session.js')>();
  return { ...actual, openWhiteTowerRuntimeSession: (input: unknown) => {
    const session = actual.openWhiteTowerRuntimeSession(input);
    observed.opens++; observed.revisions.push(() => session.inspect().revision);
    return Object.freeze({ ...session,
      prepare: (...args: Parameters<typeof session.prepare>) => { observed.prepares++; return session.prepare(...args); },
      commit: (...args: Parameters<typeof session.commit>) => { session.commit(...args); observed.commits++; },
      discard: (...args: Parameters<typeof session.discard>) => { session.discard(...args); observed.discards++; },
    });
  } };
});

const importedAt = '2026-10-17T21:00:00.000Z', committedAt = '2026-10-17T21:00:01.000Z';
const previousSelection = 'previous-selected-slot';
// One authentic full construction is shared read-only. Each 240s case includes
// strict predecessor replay on genuine SQLite import and/or cold reopening.
const fullHistoryBudget = 240_000;
let seam: ReturnType<typeof installControlledWhiteTowerPromotion>;
let scenario: ControlledWhiteTowerSuccess;
let beforeProjection: SliceProjection, successProjection: SliceProjection;
let beforeHash: string, successHash: string;
const stores: SqliteSliceStore[] = [], directories: string[] = [], restorers: (() => void)[] = [];

function unwrap<T>(value: SliceResult<T>): T {
  if (!value.ok) throw Error(`${value.error.code}: ${value.error.message}`);
  return value.value;
}
function envelope(id: string): SliceEnvelope {
  return { intentId: id, runId: scenario.beforeConsume.runId,
    expectedRevision: scenario.beforeConsume.revision, payload: structuredClone(WHITE_TOWER_CONTROLLED_CONSUME) };
}
function open(file: string, beforeWrite?: () => void): SqliteSliceStore {
  const store = new SqliteSliceStore(file, { now: () => committedAt, ...(beforeWrite ? { beforeWrite } : {}) });
  stores.push(store); return store;
}
function close(store: SqliteSliceStore): void {
  store.close(); stores.splice(stores.indexOf(store), 1);
}
function disk(state: SliceState, beforeWrite?: () => void) {
  const directory = mkdtempSync(join(tmpdir(), 'lotm-white-tower-owned-'));
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
  seam = installControlledWhiteTowerPromotion();
  scenario = controlledWhiteTowerSuccess(seam);
  beforeHash = whiteTowerScenarioHash(scenario.beforeConsume); successHash = whiteTowerScenarioHash(scenario.success);
  beforeProjection = projectSliceState(scenario.beforeConsume); successProjection = projectSliceState(scenario.success);
  expect(scenario.beforeConsume.progression.sequence).toBe(1);
  expect(scenario.success.progression.sequence).toBe(0);
  expect(scenario.success.revision).toBe(scenario.beforeConsume.revision + 1);
  expect(scenario.cursorAdvancement).toMatchObject({ cursorBefore: 230, cursorAfter: 231, chance: 70, roll: 1 });
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
      expect(whiteTowerScenarioHash(scenario.beforeConsume)).toBe(beforeHash);
      expect(whiteTowerScenarioHash(scenario.success)).toBe(successHash);
      expect(seam.substituted.length).toBeGreaterThan(0);
      expect(seam.substituted.every(draw => draw.cursorBefore === 230 && draw.cursorAfter === 231 && draw.controlled === 1)).toBe(true);
    }
    assertUnmodifiedWhiteTowerInput();
  } finally { seam?.restore(); }
}, fullHistoryBudget);

describe('WhiteTower real-history owned S0 transactions with an explicit one-draw control', () => {
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
        expect(whiteTowerScenarioHash(pending.state)).toBe(successHash);
        expect(pending.updatedAt).toBe(committedAt);
        expect(store.repository.receipt(request.intentId)?.receipt.newRevision).toBe(success.revision);
        // Inspect pending rows through this transaction's own connection: a
        // multi-megabyte full history may legitimately trigger cache-spill
        // locks that exclude an unrelated reader until COMMIT or ROLLBACK.
        stagedChecks++;
        if (fail && failure === 'beforeWrite') throw Error('Injected WhiteTower beforeWrite failure after real CONSUME writes');
      };
      const fixture = disk(before, beforeWrite), file = fixture.file;
      let store = fixture.store;
      close(store); store = open(file, beforeWrite);
      expect(store.repository.ownedHead(before.runId)?.revision).toBe(before.revision);
      expect(unwrap(store.loadRun(before.runId))).toEqual(beforeProjection);
      // Loading legitimately selects this run. Re-establish the distinct old
      // selection before the tested transaction, so rollback must preserve it.
      store.repository.transaction(() => store.repository.selectRun(previousSelection));
      expect(store.repository.activeRun()).toBe(previousSelection);
      const request = envelope(`whiteTower-consume-${failure}`), requestBytes = stableStringify(request);
      const originalRaw = raw(file), original = persisted(file), opened = observed.opens;
      const exec = DatabaseSync.prototype.exec;
      const spy = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function (this: DatabaseSync, sql: string) {
        if (watch && sql === 'COMMIT') {
          checkUnpublished(); commitChecks++;
          if (fail && failure === 'commit') throw Error('Injected WhiteTower COMMIT failure before durability');
        }
        const result = exec.call(this, sql);
        if (watch && sql === 'COMMIT') {
          // SQL is now durable; the private session must still be unpublished
          // until the repository returns from this successful COMMIT call.
          expect(observed.commits).toBe(0);
          expect(observed.revisions.at(-1)!()).toBe(before.revision);
          expect(whiteTowerScenarioHash(stored(file).state)).toBe(successHash);
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
      expect(stored(file).state.random).toEqual({ seed: WHITE_TOWER_CONTROLLED_SEED, cursor: WHITE_TOWER_CONTROLLED_CURSOR });

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
      expect(whiteTowerScenarioHash(saved.state)).toBe(successHash);
      assertWhiteTowerPublicBoundary(receipt.state, saved.state);
      expect(saved.state.random).toEqual({ seed: WHITE_TOWER_CONTROLLED_SEED, cursor: WHITE_TOWER_CONTROLLED_CURSOR + 1 });
      expect(saved.state.whiteTower.journal.flatMap(event => event.randomReceipts)).toEqual(success.whiteTower.journal.flatMap(event => event.randomReceipts));
      expect(saved.state.whiteTower.journal.at(-1)!.randomReceipts[0]).toMatchObject({ cursorBefore: 230, cursorAfter: 231, check: { chance: 70, roll: 1 } });
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
      expect(raw(file)).toBe(committed); expect(whiteTowerScenarioHash(stored(file).state)).toBe(successHash);
      for (const key of WHITE_TOWER_FROZEN_SOURCE_KEYS) expect(saved.state[key]).toEqual(scenario.source[key]);
      assertUnmodifiedWhiteTowerInput();
    }, fullHistoryBudget,
  );

  it('rejects checksum-valid bare S0, missing actual consumption and source tampering without retaining authority or overwriting bytes', () => {
    const { file, store } = disk(scenario.success), originalRaw = raw(file);
    expect(store.repository.ownedHead(scenario.success.runId)?.revision).toBe(scenario.success.revision);
    const forgeries: { name: string; base: SliceState; change: (state: SliceState) => void }[] = [
      { name: 'bare S0 on untouched genuine S1', base: scenario.source, change: state => { state.progression.sequence = 0; } },
      { name: 'missing actual CONSUME', base: scenario.success, change: state => { state.whiteTower.journal.pop(); } },
      { name: 'rewritten original source budget', base: scenario.success, change: state => { state.whiteTower.source!.budget.cash++; } },
    ];
    for (const forgery of forgeries) {
      const forged = structuredClone(forgery.base); forgery.change(forged);
      expect(() => store.repository.transaction(() => store.repository.put({ state: forged, updatedAt: importedAt })), forgery.name).toThrow();
      expect(raw(file)).toBe(originalRaw);
      // Negative corruption only: recomputing the disk checksum must never
      // turn an invented S0 or altered private source into admission authority.
      replaceRaw(file, forged);
      const rejectedBytes = raw(file), rejected = persisted(file), databaseHash = fileHash(file);
      expect(store.getBootstrap(), forgery.name).toMatchObject({ ok: false, error: { code: 'SAVE_UNAVAILABLE' } });
      expect(() => store.repository.ownedHead(scenario.success.runId), forgery.name).toThrow();
      expect(store.loadRun(scenario.success.runId), forgery.name).toMatchObject({ ok: false, error: { code: 'SAVE_UNAVAILABLE' } });
      expect(store.submitIntent({ ...envelope('white-tower-forged-consume'), expectedRevision: forged.revision }), forgery.name)
        .toMatchObject({ ok: false, error: { code: 'SAVE_FAILED' } });
      expect(raw(file)).toBe(rejectedBytes); expect(persisted(file)).toBe(rejected); expect(fileHash(file)).toBe(databaseHash);
      expect(store.repository.activeRun()).toBe(previousSelection);
      expect(store.repository.receipt('white-tower-forged-consume')).toBeNull();
      replaceRaw(file, scenario.success);
      const opened = observed.opens;
      expect(store.repository.ownedHead(scenario.success.runId)?.revision).toBe(scenario.success.revision);
      expect(observed.opens).toBe(opened + 1);
      expect(raw(file)).toBe(originalRaw);
      expect(whiteTowerScenarioHash(stored(file).state)).toBe(successHash);
    }
    close(store);
    const reopened = open(file);
    expect(unwrap(reopened.getBootstrap()).activeState).toEqual(successProjection);
    expect(whiteTowerScenarioHash(stored(file).state)).toBe(successHash);
    assertUnmodifiedWhiteTowerInput();
  }, fullHistoryBudget);
});
