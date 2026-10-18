import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import { openTyrantRuntimeSession } from '../../src/domain/tyrant/owned-session.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import type { SliceEnvelope, SliceReceipt, SliceResult } from '../../src/shared/slice-contracts.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import {
  PINS, PREFIX, actualReceipts, assertGlobalPublic, assertPublicAction, authenticateInputs, capturePublic, hash,
  expectedCurrentGlobal, loadCapture, migrateCapturedTyrantState, outcome, readAction, same, sha, type LoadedCapture,
} from '../helpers/tyrant-capture.js';

/** NEW215 natural864: exactly FOUR representative actual SQLite transitions,
 * supported S1 promotion717, guidance780, failed east-coast830 and terminal death864. Both beforeWrite and
 * pre-COMMIT faults must roll back the complete private state, RNG and receipt;
 * retry uses the identical intent. This does not replay all original701/new163
 * commands or replace the independent full28-boundary SQLite audit. No RNG seam,
 * controlled S0 success, rewritten capture or continuation from death is used. */
let data: LoadedCapture | undefined;
beforeAll(() => { data = loadCapture(); }, 180_000);
afterEach(() => { vi.resetAllMocks(); vi.restoreAllMocks(); });
afterAll(() => { if (data) authenticateInputs(); data = undefined; }, 180_000);
const INITIAL_TIME = '2026-10-18T03:00:00.000Z', COMMIT_TIME = '2026-10-18T03:00:01.000Z';
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
  if (!state.tyrant.guidanceKnown) return direct;
  const session = openTyrantRuntimeSession(state);
  same(session.snapshot(), state); same(session.project(), direct);
  const authored = session.projectTyrant(), before = hash(authored);
  expect(direct.tyrant).toEqual(projectPlayerText(structuredClone(authored), state.character.name));
  expect(hash(authored)).toBe(before); return direct;
}
const head = (state: SliceState) => state.tyrant.guidanceKnown
  ? { runId: state.runId, revision: state.revision, status: state.status } : null;

describe('Tyrant215 rebuilt actual natural864 representative SQLite captures', () => {
  it.each([0, 1, 2, 3] as const)('rolls back, retries, cold-reopens and deduplicates actual boundary %i', sample => {
    const { checkpoint, rows, original } = data!;
    expect(PINS.sqliteCommandCounts).toEqual([717, 780, 830, 864]);
    const count = PINS.sqliteCommandCounts[sample], row = rows[count - PREFIX - 1]!;
    expect(checkpoint.boundaries.some(item => item.commandCount === count)).toBe(true);
    expect(row.commandCount).toBe(count);
    const boundary = readAction(row);
    expect(hash(boundary.beforeLast)).toBe(row.beforeStateSha256); expect(hash(boundary.final)).toBe(row.afterStateSha256);
    const before = migrateCapturedTyrantState(boundary.beforeLast), after = migrateCapturedTyrantState(boundary.final);
    expect([before.schemaVersion, before.contentVersion, after.schemaVersion, after.contentVersion])
      .toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    const beforeHash = hash(before), afterHash = hash(after);
    expect(before.status).toBe('ACTIVE'); expect(after.status).toBe(count === 864 ? 'DEAD' : 'ACTIVE');
    expect(after.progression.sequence).toBe(1); expect(after.tyrant.promotionWeek).toBeNull();
    same(before.thunderGod.bottles.slice(0, 3), original.thunderGod.bottles);
    same(after.thunderGod.bottles.slice(0, 3), original.thunderGod.bottles);
    expect(after.thunderGod.bottles.map(bottle => bottle.outcome)).toEqual(['FAILURE', 'FAILURE', 'FAILURE', 'SUCCESS']);
    const publicBefore = publicState(before), publicAfter = publicState(after);
    same(publicBefore, projectPlayerText(expectedCurrentGlobal(boundary, 'before'), before.character.name));
    same(publicAfter, projectPlayerText(expectedCurrentGlobal(boundary, 'after'), after.character.name));
    same(capturePublic(publicAfter), boundary.public); expect(outcome(boundary.public)).toEqual(row.selectionOutcome);
    assertPublicAction(capturePublic(publicBefore), row); same(actualReceipts(after, before), row.receipts);
    if (count === 717) {
      expect(after.lastCheck).toMatchObject({ chance: 44, roll: 36 });
      expect(publicAfter.lastCheck).toMatchObject({ chance: 70, roll: 36, effectiveAbility: 40 });
      expect(publicAfter.lastCheck).toEqual(after.thunderGod.acquisitionJournal.at(-1)!.check);
    }
    if (count === 830) expect(after.lastCheck).toMatchObject({ chance: 72, roll: 74, tier: 'FAILURE' });
    if (count === 864) {
      expect(after).toMatchObject({ status: 'DEAD', week: 195, health: 0, actionsRemaining: 0,
        random: { seed: 'sailor-natural-v026', cursor: 284 }, ending: { kind: 'DEATH' } });
      expect(after.tyrant.challenge).toMatchObject({ status: 'DEAD', position: 60, escape: null,
        opponent: { status: 'ACTIVE', pursuitCount: 9 } });
      expect(after.tyrant.challenge!.exchanges).toHaveLength(9);
      expect(after.injuries.map(injury => injury.severity)).toEqual(['HEAVY', 'LIGHT', 'LIGHT', 'LIGHT', 'HEAVY']);
    }
    const envelope: SliceEnvelope = { intentId: `tyrant215-captured:${count}`, runId: before.runId,
      expectedRevision: before.revision, payload: structuredClone(boundary.lastIntent) };
    const envelopeBytes = stableStringify(envelope);
    const receipt: SliceReceipt = { intentId: envelope.intentId, runId: after.runId, previousRevision: before.revision,
      newRevision: after.revision, committedAt: COMMIT_TIME, replayed: false, state: publicAfter };
    const directory = mkdtempSync(join(tmpdir(), 'tyrant215-capture-save-')), path = join(directory, 'save.sqlite');
    let store: SqliteSliceStore | undefined, injection: 'beforeWrite' | 'COMMIT' | null = null, injections = 0, hooks = 0;
    const exact = (wanted: SliceState, committed: boolean): void => {
      const saved = store!.repository.get(wanted.runId)!;
      expect(hash(saved.state)).toBe(committed ? afterHash : beforeHash); same(saved.state, wanted);
      expect(saved.state.random).toEqual(wanted.random);
      expect(saved.updatedAt).toBe(committed ? COMMIT_TIME : INITIAL_TIME);
      expect(store!.repository.activeRun()).toBe(wanted.runId);
      expect(store!.repository.receipt(envelope.intentId)).toEqual(committed ? { fingerprint: envelopeBytes, receipt } : null);
      expect(existsSync(`${path}.sealed`)).toBe(wanted.status === 'DEAD');
    };
    const checkHead = (wanted: SliceState): void => {
      expect(store!.repository.ownedHead(wanted.runId)).toEqual(head(wanted));
      if (wanted.tyrant.guidanceKnown)
        expect(store!.repository.projectFoolRun(wanted.runId)).toEqual(wanted.revision === before.revision ? publicBefore : publicAfter);
    };
    const fault = (): never => {
      // SQLite contains the complete candidate and receipt, including the real
      // death seal, while the owned runtime has not published that candidate.
      exact(after, true); checkHead(before); injections++;
      throw Error(`Injected actual Tyrant ${injection} failure after real writes`);
    };
    const open = (): SqliteSliceStore => new SqliteSliceStore(path, {
      now: () => COMMIT_TIME, beforeWrite: () => { hooks++; if (injection === 'beforeWrite') fault(); },
    });
    const reopen = (): void => { store!.close(); store = undefined; store = open(); };
    const bootstrap = (projection: SliceProjection): void => {
      const oldHooks = hooks, oldRows = persisted(path), view = unwrap(store!.getBootstrap());
      expect(view.activeState).toEqual(projection);
      expect(view.runs).toHaveLength(1);
      expect(view.runs.filter(run => run.status !== 'DEAD')).toHaveLength(projection.status === 'DEAD' ? 0 : 1);
      expect(view.runs[0]).toMatchObject({ runId: projection.runId, status: projection.status, revision: projection.revision });
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
        expect(JSON.parse(readFileSync(`${path}.sealed`, 'utf8'))).toEqual([after.runId]);
        const db = new DatabaseSync(path, { readOnly: true });
        try {
          const saved = db.prepare('SELECT terminal, current_json, backup_json FROM slice_runs WHERE id=?').get(after.runId)!;
          expect(saved.terminal).toBe(1); expect(saved.backup_json).toBe(saved.current_json);
        } finally { db.close(); }
        expect(store!.submitIntent({ ...envelope, intentId: `${envelope.intentId}:after-death`, expectedRevision: after.revision }))
          .toMatchObject({ ok: false, error: { code: 'ARCHIVED' } });
        expect(store!.repository.receipt(`${envelope.intentId}:after-death`)).toBeNull();
        expect(persisted(path)).toBe(committed);
      }
      reopen(); exact(after, true); checkHead(after); bootstrap(publicAfter); expect(persisted(path)).toBe(committed);
      expect(hash(before)).toBe(beforeHash); expect(hash(after)).toBe(afterHash);
      expect(hash(boundary.beforeLast)).toBe(row.beforeStateSha256); expect(hash(boundary.final)).toBe(row.afterStateSha256);
    } finally {
      injection = null; spy.mockRestore(); store?.close(); rmSync(directory, { recursive: true, force: true });
    }
  }, 300_000);
});
