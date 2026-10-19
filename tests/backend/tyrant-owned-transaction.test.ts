/** Genuine boundary701 -> paid recovered S1 -> three actual ordinary practices
 * -> explicit controlled S0 branch. No predecessor mocks, resource grants,
 * directly inserted S0 authority, forged success receipts or source relabeling.
 * The ten new S0 d100 controls remain installed for strict cold replay. */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import type { StoredSlice } from '../../src/application/slice-application.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import type { SliceEnvelope, SliceReceipt, SliceResult } from '../../src/shared/slice-contracts.js';
import { TYRANT_FROZEN_SOURCE_KEYS } from '../../src/domain/tyrant/source.js';
import { TYRANT_SAVE_CONSUME, TYRANT_SAVE_SEED, assertUnmodifiedTyrantSaveInput, controlledTyrantSaveFixture,
  installTyrantSaveControl, tyrantSaveHash, type TyrantSaveFixture } from '../helpers/tyrant-save-fixture.js';

const observed = vi.hoisted(() => ({ opens: 0, prepares: 0, commits: 0, discards: 0, revisions: [] as (() => number)[] }));
vi.mock('../../src/domain/tyrant/owned-session.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/domain/tyrant/owned-session.js')>();
  return { ...actual, openTyrantRuntimeSession: (input: unknown) => {
    const session = actual.openTyrantRuntimeSession(input);
    observed.opens++; observed.revisions.push(() => session.inspect().revision);
    return Object.freeze({ ...session,
      prepare: (...args: Parameters<typeof session.prepare>) => { observed.prepares++; return session.prepare(...args); },
      commit: (...args: Parameters<typeof session.commit>) => { session.commit(...args); observed.commits++; },
      discard: (...args: Parameters<typeof session.discard>) => { session.discard(...args); observed.discards++; },
    });
  } };
});

const importedAt = '2026-10-18T02:00:00.000Z', committedAt = '2026-10-18T02:00:01.000Z';
const previousSelection = 'previous-selected-slot', fullHistoryBudget = 360_000;
let control: ReturnType<typeof installTyrantSaveControl>, scenario: TyrantSaveFixture;
let beforeHash: string, successHash: string, beforeProjection: SliceProjection, successProjection: SliceProjection;
const stores: SqliteSliceStore[] = [], directories: string[] = [], restorers: (() => void)[] = [];
function unwrap<T>(result: SliceResult<T>): T { if (!result.ok) throw Error(`${result.error.code}: ${result.error.message}`); return result.value; }
function envelope(intentId: string): SliceEnvelope {
  return { intentId, runId: scenario.beforeConsume.runId, expectedRevision: scenario.beforeConsume.revision,
    payload: structuredClone(TYRANT_SAVE_CONSUME) };
}
function open(file: string, beforeWrite?: () => void): SqliteSliceStore {
  const store = new SqliteSliceStore(file, { now: () => committedAt, ...(beforeWrite ? { beforeWrite } : {}) });
  stores.push(store); return store;
}
function close(store: SqliteSliceStore): void { store.close(); stores.splice(stores.indexOf(store), 1); }
function disk(state: SliceState, beforeWrite?: () => void) {
  const directory = mkdtempSync(join(tmpdir(), 'lotm-tyrant-owned-')); directories.push(directory);
  const file = join(directory, 'save.sqlite'), store = open(file, beforeWrite);
  // Actual command output passes the unmocked strict import gate.
  store.repository.transaction(() => { store.repository.put({ state, updatedAt: importedAt }); store.repository.selectRun(previousSelection); });
  return { file, store };
}
function raw(file: string, runId = scenario.source.runId): string {
  const db = new DatabaseSync(file, { readOnly: true });
  try { return String(db.prepare('SELECT current_json FROM slice_runs WHERE id=?').get(runId)!.current_json); }
  finally { db.close(); }
}
function stored(file: string): StoredSlice { return JSON.parse(JSON.parse(raw(file)).payload) as StoredSlice; }
function fileHash(file: string): string | null { return existsSync(file) ? createHash('sha256').update(readFileSync(file)).digest('hex') : null; }
function persisted(file: string): string {
  const db = new DatabaseSync(file, { readOnly: true });
  try { return stableStringify({ runs: db.prepare('SELECT * FROM slice_runs ORDER BY id').all(),
    receipts: db.prepare('SELECT * FROM slice_receipts ORDER BY id').all(), meta: db.prepare('SELECT * FROM slice_meta ORDER BY key').all(),
    backup: fileHash(`${file}.bak`), sealed: fileHash(`${file}.sealed`), files: readdirSync(dirname(file)).sort() }); }
  finally { db.close(); }
}
function replaceRaw(file: string, state: SliceState): void {
  const payload = stableStringify({ state, updatedAt: importedAt });
  const encoded = JSON.stringify({ format: 1, checksum: createHash('sha256').update(payload).digest('hex'), payload });
  const db = new DatabaseSync(file);
  try { db.prepare('UPDATE slice_runs SET current_json=? WHERE id=?').run(encoded, scenario.source.runId); }
  finally { db.close(); }
}

beforeAll(() => {
  control = installTyrantSaveControl(); scenario = controlledTyrantSaveFixture();
  beforeHash = tyrantSaveHash(scenario.beforeConsume); successHash = tyrantSaveHash(scenario.success);
  beforeProjection = projectSliceState(scenario.beforeConsume); successProjection = projectSliceState(scenario.success);
  expect(scenario.beforeConsume.progression.sequence).toBe(1); expect(scenario.success.progression.sequence).toBe(0);
  expect(scenario.success.revision).toBe(scenario.beforeConsume.revision + 1);
  expect(scenario.success.tyrant.journal.at(-1)!.randomReceipts[0]).toMatchObject({ cursorBefore: 280, cursorAfter: 281, check: { roll: 30 } });
}, fullHistoryBudget);
beforeEach(() => { observed.opens = 0; observed.prepares = 0; observed.commits = 0; observed.discards = 0; observed.revisions.length = 0; });
afterEach(() => {
  // The declared new-draw seam must survive every strict cold read.
  for (const restore of restorers.splice(0).reverse()) restore();
  for (const store of stores.splice(0)) store.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
  observed.revisions.length = 0;
});
afterAll(() => {
  try {
    if (scenario) {
      expect(tyrantSaveHash(scenario.beforeConsume)).toBe(beforeHash); expect(tyrantSaveHash(scenario.success)).toBe(successHash);
      expect(control.draws.length).toBeGreaterThanOrEqual(10);
      expect(control.draws.every(d => d.cursorBefore >= 271 && d.cursorBefore <= 280 && d.cursorAfter === d.cursorBefore + 1 && d.controlled === 30)).toBe(true);
    }
    assertUnmodifiedTyrantSaveInput();
  } finally { control?.restore(); }
}, fullHistoryBudget);

describe('Tyrant genuine-history owned S0 persistence with an explicit controlled continuation', () => {
  it.each(['beforeWrite', 'commit'] as const)('rolls back %s, retries the same intent and RNG, and strictly reopens exactly one durable S0', failure => {
    const before = scenario.beforeConsume, success = scenario.success;
    let fail = false, watch = false, stagedChecks = 0, commitChecks = 0;
    const unpublished = (): void => {
      expect(observed.commits).toBe(0); expect(observed.revisions.at(-1)!()).toBe(before.revision);
      expect(store.repository.ownedHead(before.runId)?.revision).toBe(before.revision);
    };
    const beforeWrite = (): void => {
      if (!watch) return;
      unpublished();
      expect(tyrantSaveHash(store.repository.get(before.runId)!.state)).toBe(successHash);
      expect(store.repository.receipt(request.intentId)?.receipt.newRevision).toBe(success.revision);
      stagedChecks++;
      if (fail && failure === 'beforeWrite') throw Error('Injected Tyrant beforeWrite failure after actual writes');
    };
    const fixture = disk(before, beforeWrite), file = fixture.file;
    let store = fixture.store; close(store); store = open(file, beforeWrite);
    expect(unwrap(store.loadRun(before.runId))).toEqual(beforeProjection);
    store.repository.transaction(() => store.repository.selectRun(previousSelection));
    const request = envelope(`tyrant-consume-${failure}`), requestBytes = stableStringify(request);
    const originalRaw = raw(file), original = persisted(file), opened = observed.opens;
    const exec = DatabaseSync.prototype.exec;
    const spy = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function (this: DatabaseSync, sql: string) {
      if (watch && sql === 'COMMIT') {
        unpublished(); commitChecks++;
        if (fail && failure === 'commit') throw Error('Injected Tyrant COMMIT failure before durability');
      }
      const result = exec.call(this, sql);
      if (watch && sql === 'COMMIT') {
        expect(observed.commits).toBe(0); expect(observed.revisions.at(-1)!()).toBe(before.revision);
        expect(tyrantSaveHash(stored(file).state)).toBe(successHash);
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
    expect(store.repository.receipt(request.intentId)).toBeNull(); expect(store.repository.activeRun()).toBe(previousSelection);
    expect(store.repository.ownedHead(before.runId)?.revision).toBe(before.revision);
    expect(stored(file).state.random).toEqual({ seed: TYRANT_SAVE_SEED, cursor: 280 });

    fail = false; watch = true; let receipt!: SliceReceipt;
    try { receipt = unwrap(store.submitIntent(request)); } finally { watch = false; }
    spy.mockRestore();
    expect(stagedChecks).toBe(2); expect(commitChecks).toBe(failure === 'commit' ? 2 : 1);
    expect(observed.opens).toBe(opened); expect(observed.prepares).toBe(2); expect(observed.commits).toBe(1);
    expect(receipt).toMatchObject({ intentId: request.intentId, previousRevision: before.revision, newRevision: success.revision, committedAt, replayed: false });
    expect(receipt.state).toEqual(successProjection); expect(stableStringify(request)).toBe(requestBytes);
    const saved = stored(file).state;
    expect(tyrantSaveHash(saved)).toBe(successHash); expect(saved.random).toEqual({ seed: TYRANT_SAVE_SEED, cursor: 281 });
    expect(saved.tyrant.journal.flatMap(e => e.randomReceipts)).toEqual(success.tyrant.journal.flatMap(e => e.randomReceipts));
    expect(saved.thunderGod.bottles.slice(0, 3)).toEqual(scenario.source.thunderGod.bottles);
    for (const key of TYRANT_FROZEN_SOURCE_KEYS) expect(saved[key]).toEqual(scenario.predecessor[key]);
    expect(JSON.stringify(receipt.state)).not.toContain(saved.random.seed);
    expect(JSON.stringify(receipt.state)).not.toContain(saved.tyrant.source!.historyDigest);
    const committed = raw(file);
    expect(unwrap(store.submitIntent(request))).toEqual({ ...receipt, replayed: true });
    expect(observed.prepares).toBe(2); expect(raw(file)).toBe(committed);
    close(store); store = open(file);
    expect(unwrap(store.loadRun(before.runId))).toEqual(successProjection);
    expect(unwrap(store.getBootstrap()).activeState).toEqual(successProjection);
    expect(unwrap(store.submitIntent(request))).toEqual({ ...receipt, replayed: true });
    expect(store.repository.ownedHead(before.runId)?.revision).toBe(success.revision);
    expect(observed.prepares).toBe(2); expect(observed.commits).toBe(1); expect(raw(file)).toBe(committed);
  }, fullHistoryBudget);

  it('rejects checksum-valid invented S0, missing consumption and rewritten predecessor without replacing bytes or retaining authority', () => {
    const { file, store } = disk(scenario.success), originalRaw = raw(file);
    const forgeries: { name: string; base: SliceState; change: (state: SliceState) => void }[] = [
      { name: 'bare S0 on genuine practiced S1', base: scenario.predecessor, change: s => { s.progression.sequence = 0; } },
      { name: 'missing actual consumption', base: scenario.success, change: s => { s.tyrant.journal.pop(); } },
      { name: 'rewritten source budget', base: scenario.success, change: s => { s.tyrant.source!.budget.cash++; } },
    ];
    for (const forgery of forgeries) {
      const forged = structuredClone(forgery.base); forgery.change(forged);
      expect(() => store.repository.transaction(() => store.repository.put({ state: forged, updatedAt: importedAt })), forgery.name).toThrow();
      expect(raw(file)).toBe(originalRaw);
      replaceRaw(file, forged); const bytes = raw(file), before = persisted(file), databaseHash = fileHash(file);
      expect(store.getBootstrap(), forgery.name).toMatchObject({ ok: false, error: { code: 'SAVE_UNAVAILABLE' } });
      expect(() => store.repository.ownedHead(scenario.success.runId), forgery.name).toThrow();
      expect(store.loadRun(scenario.success.runId), forgery.name).toMatchObject({ ok: false, error: { code: 'SAVE_UNAVAILABLE' } });
      expect(store.submitIntent({ ...envelope('tyrant-forged-consume'), expectedRevision: forged.revision }), forgery.name)
        .toMatchObject({ ok: false, error: { code: 'SAVE_FAILED' } });
      expect(raw(file)).toBe(bytes); expect(persisted(file)).toBe(before); expect(fileHash(file)).toBe(databaseHash);
      expect(store.repository.activeRun()).toBe(previousSelection); expect(store.repository.receipt('tyrant-forged-consume')).toBeNull();
      replaceRaw(file, scenario.success); const opened = observed.opens;
      expect(store.repository.ownedHead(scenario.success.runId)?.revision).toBe(scenario.success.revision);
      expect(observed.opens).toBe(opened + 1); expect(raw(file)).toBe(originalRaw);
    }
  }, fullHistoryBudget);

  it('keeps another genuine run unchanged and binds the committed intent receipt to its original run', () => {
    const { file, store } = disk(scenario.beforeConsume);
    const other = createSliceRun('tyrant-isolation-ordinary', sliceDefaultCreationSelection, 'tyrant-isolation-other-seed');
    store.repository.transaction(() => store.repository.put({ state: other, updatedAt: importedAt }));
    const otherBytes = raw(file, other.runId), otherProjection = projectSliceState(other);
    const request = envelope('tyrant-cross-run-consume'), receipt = unwrap(store.submitIntent(request));
    expect(raw(file, other.runId)).toBe(otherBytes); expect(unwrap(store.loadRun(other.runId))).toEqual(otherProjection);
    const beforeConflict = persisted(file);
    expect(store.submitIntent({ ...request, runId: other.runId, expectedRevision: other.revision }))
      .toMatchObject({ ok: false, error: { code: 'DUPLICATE_INTENT_CONFLICT' } });
    expect(persisted(file)).toBe(beforeConflict); expect(raw(file, other.runId)).toBe(otherBytes);
    close(store); const reopened = open(file);
    expect(unwrap(reopened.loadRun(other.runId))).toEqual(otherProjection);
    expect(unwrap(reopened.loadRun(scenario.success.runId))).toEqual(successProjection);
    expect(unwrap(reopened.submitIntent(request))).toEqual({ ...receipt, replayed: true });
    expect(raw(file, other.runId)).toBe(otherBytes);
  }, fullHistoryBudget);
});
