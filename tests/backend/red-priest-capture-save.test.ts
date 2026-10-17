import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { assertFinalUiBoundary, finalUiProof } from '../helpers/red-priest-final-ui-fixture.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import type { RedPriestProjection } from '../../src/domain/red-priest/types.js';
import { storyProof } from '../helpers/red-priest-story-fixture.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { openRedPriestRuntimeSession } from '../../src/domain/red-priest/owned-session.js';
import { projectVisionary } from '../../src/domain/visionary/index.js';
import { projectPerfecter } from '../../src/domain/perfecter/index.js';
import { projectMoon } from '../../src/domain/moon/index.js';
import { projectDarkness } from '../../src/domain/darkness/index.js';
import type { SliceEnvelope, SliceReceipt, SliceResult } from '../../src/shared/slice-contracts.js';
import {
  ROOT, FORK_COUNT, authenticateFixture, captureHash, checkpoint, hash, initialPlanningSeam,
  json, ledger, observed, sha, stable, type BranchRoot, type IndependentRuntimeTransition,
} from '../helpers/red-priest-capture-fixture.js';

/** Exactly one actual new-tail SQLite representative: the first real RNG action
 * after original918, prepared battle937. Only919..937 are reconstructed here.
 * The dedicated verifier owns complete selected-transition coverage and the
 * independent original983 withdrawal. No producer or original795 replay. */
function unwrap<T>(result: SliceResult<T>): T {
  if (!result.ok) throw Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}
/** Capture uses the raw owned chapter projection. SQLite returns the complete
 * player-facing slice. The existing read-only text adapter is their exact
 * bridge, including all prose; commands, costs and action availability remain
 * literal, and neither local projection nor private state may be mutated. */
function assertPlayerProjection(local: RedPriestProjection, global: RedPriestProjection, state: SliceState): void {
  const localHash = hash(local), privateHash = hash(state);
  expect(global).toEqual(projectPlayerText({ redPriest: local }, state.character.name).redPriest);
  expect(hash(local)).toBe(localHash); expect(hash(state)).toBe(privateHash);
  expect(global.actions.map(({ id, command, cost, enabled }) => ({ id, command, cost, enabled })))
    .toEqual(local.actions.map(({ id, command, cost, enabled }) => ({ id, command, cost, enabled })));
  expect(global.resources).toEqual(local.resources);
}
const LATER_CHAPTER_ROOTS = ['visionary', 'perfecter', 'moon', 'darkness'] as const;
/** Independently specified complete empty roots, not a filter for arbitrary
 * current defaults. The 0.209 capture itself uses schema206/red-priest-v206. */
const EMPTY_LATER_CHAPTERS: Pick<SliceState, typeof LATER_CHAPTER_ROOTS[number]> = {
  visionary: { version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
    era: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] } },
  perfecter: { version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
    works: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] } },
  moon: { version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
    services: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] } },
  darkness: { version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
    evacuation: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] } },
};
/** Preserve every historical public field. Only these four explicitly named
 * later chapter roots may be omitted, after checking their complete empty
 * private states and complete inactive player-facing projections. Unknown
 * public fields remain in the historical hash and therefore cannot be hidden. */
function historicalPublicHash(current: SliceProjection, state: SliceState, capturedRoot: SliceState): string {
  expect([capturedRoot.schemaVersion, capturedRoot.contentVersion]).toEqual([206, 'red-priest-v206']);
  expect(state.progression.pathwayId).toBe('hunter');
  expect(Object.keys(state).sort()).toEqual([...Object.keys(capturedRoot), ...LATER_CHAPTER_ROOTS].sort());
  for (const key of LATER_CHAPTER_ROOTS) {
    expect(Object.hasOwn(capturedRoot, key)).toBe(false);
    expect(state[key]).toStrictEqual(EMPTY_LATER_CHAPTERS[key]);
  }
  const fresh = { ...state, ...EMPTY_LATER_CHAPTERS };
  const expected = projectPlayerText({ visionary: projectVisionary(fresh), perfecter: projectPerfecter(fresh),
    moon: projectMoon(fresh), darkness: projectDarkness(fresh) }, state.character.name);
  for (const key of LATER_CHAPTER_ROOTS) {
    expect(Object.hasOwn(current, key)).toBe(true);
    const root = current[key];
    expect(root).toStrictEqual(expected[key]);
    expect(Object.keys(root).sort()).toEqual(['title', 'guidanceKnown', 'promoted', 'story', 'nextStep', 'risk',
      'resources', 'abilities', 'actions', 'sections', 'insideCase'].sort());
    expect([root.guidanceKnown, root.promoted, root.insideCase]).toEqual([false, false, false]);
    expect(root.abilities).toEqual([]); expect(root.sections).toEqual([]);
    expect(root.actions).toHaveLength(1);
    expect(root.actions[0]!.command).toEqual({ type: 'LEARN_GUIDANCE' });
    expect(root.actions[0]!.enabled).toBe(false);
  }
  const { visionary: _visionary, perfecter: _perfecter, moon: _moon, darkness: _darkness, ...historical } = current;
  return hash(historical);
}
function persisted(path: string): string {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return stableStringify({
      runs: db.prepare('SELECT * FROM slice_runs ORDER BY id').all(),
      receipts: db.prepare('SELECT * FROM slice_receipts ORDER BY id').all(),
      meta: db.prepare('SELECT * FROM slice_meta ORDER BY key').all(),
      backup: existsSync(`${path}.bak`) ? sha(readFileSync(`${path}.bak`)) : null,
      sealed: existsSync(`${path}.sealed`) ? readFileSync(`${path}.sealed`, 'utf8') : null,
    });
  } finally { db.close(); }
}

describe('Red Priest209 planned captured transition through SQLite', () => {
  it('rejects changed later roots and keeps every historical or unknown public field in the audit hash', () => {
    const root = checkpoint<BranchRoot>('fork/original-918-checkpoint.json'), rawHash = hash(root.state);
    const state = migrateSliceState(root.state), current = openRedPriestRuntimeSession(state).project();
    const stateHash = hash(state), publicHash = hash(current), historical = historicalPublicHash(current, state, root.state);
    expect(historical).toBe(finalUiProof().replay.rows[0]!.publicSliceBeforeSha256);
    for (const key of LATER_CHAPTER_ROOTS) {
      expect(() => historicalPublicHash(current, { ...state, [key]: { ...state[key], guidanceKnown: true } }, root.state)).toThrow();
      expect(() => historicalPublicHash(current, { ...state, [key]: { ...state[key], privateProbe: true } }, root.state)).toThrow();
      expect(() => historicalPublicHash({ ...current, [key]: { ...current[key], story: 'changed' } }, state, root.state)).toThrow();
      expect(() => historicalPublicHash({ ...current, [key]: { ...current[key], publicProbe: true } }, state, root.state)).toThrow();
      expect(() => historicalPublicHash(current, state, { ...root.state, [key]: state[key] })).toThrow();
    }
    expect(historicalPublicHash({ ...current, week: current.week + 1 }, state, root.state)).not.toBe(historical);
    const unknownPublicRoot = { ...current, unexpectedPublicRoot: { value: true } };
    expect(historicalPublicHash(unknownPublicRoot, state, root.state)).not.toBe(historical);
    expect(hash(root.state)).toBe(rawHash); expect(hash(state)).toBe(stateHash); expect(hash(current)).toBe(publicHash);
  }, 120_000);
  it('rolls back actual prepared battle937, retries its identical envelope, reopens and returns one durable receipt', () => {
    authenticateFixture();
    const expected = observed().sqlite, rows = ledger(), story = storyProof(), finalUi = finalUiProof();
    expect(sha(readFileSync(join(ROOT, 'planned/commands.ndjson')))).toBe(expected.ledgerSha256);
    const selected = rows.find(row => row.randomAfter.cursor > row.randomBefore.cursor)!;
    expect(selected).toBeDefined(); expect(selected.commandCount).toBe(expected.commandCount);
    expect(selected.commandCount).toBe(937);
    expect(selected.intent).toEqual({ type: 'RED_PRIEST', command: { type: 'CAMPAIGN', command: { type: 'PREPARED_BATTLE', nodeId: 'northern-pass' } } });
    expect(selected.beforeStateSha256).toBe('178ca5e8195cd12ff832491616d45c73b3771bcf16145bb760440835ea39e1ed');
    expect(selected.afterStateSha256).toBe('6014760221772a6a60f5da5ad31ec43d09de4cde6b4189eaf9de4c0f86176aeb');
    expect(selected.beforeStateSha256).toBe(expected.beforeStateSha256); expect(selected.afterStateSha256).toBe(expected.afterStateSha256);
    const root = checkpoint<BranchRoot>('fork/original-918-checkpoint.json'), rawHash = hash(root.state);
    let state = migrateSliceState(root.state);
    expect(hash(root.state), 'Explicit migration preserves raw original918').toBe(rawHash);
    expect(captureHash(state, root.state)).toBe(root.finalStateSha256);
    const session = openRedPriestRuntimeSession(state);
    initialPlanningSeam(session.projectRedPriest(), json<IndependentRuntimeTransition>('planned/runtime-transition.json'));
    let before = state, after = state, publicBefore = session.project(), publicAfter = publicBefore;
    let replayed = 0;
    for (const row of rows) {
      expect(row.commandCount).toBe(FORK_COUNT + ++replayed);
      expect(captureHash(state, root.state)).toBe(row.beforeStateSha256); expect(state.random).toEqual(row.randomBefore);
      before = state; publicBefore = session.project();
      const localBefore = session.projectRedPriest();
      assertFinalUiBoundary(localBefore, state, row, finalUi.replay.rows[replayed - 1]!, story.replay.rows[replayed - 1]!, 'Before');
      expect(historicalPublicHash(publicBefore, state, root.state)).toBe(finalUi.replay.rows[replayed - 1]!.publicSliceBeforeSha256);
      assertPlayerProjection(localBefore, publicBefore.redPriest, state);
      if (row.intent.type !== 'RED_PRIEST') throw Error('Only actual Red Priest intents belong to the planned capture');
      const command = row.intent.command;
      const offered = localBefore.actions.filter(a => stable(a.command) === stable(command));
      expect(offered).toHaveLength(1); expect(offered[0]!.enabled).toBe(true); expect(offered[0]!.label).toBe(row.publicLabel);
      const draft = session.prepare(row.intent, state.revision);
      state = session.snapshotDraft(draft);
      const localAfter = session.projectDraftRedPriest(draft);
      publicAfter = session.projectDraft(draft); session.commit(draft);
      expect(captureHash(before, root.state), 'Draft leaves predecessor intact').toBe(row.beforeStateSha256);
      expect(captureHash(state, root.state)).toBe(row.afterStateSha256); expect(state.random).toEqual(row.randomAfter);
      assertFinalUiBoundary(localAfter, state, row, finalUi.replay.rows[replayed - 1]!, story.replay.rows[replayed - 1]!, 'After');
      expect(historicalPublicHash(publicAfter, state, root.state)).toBe(finalUi.replay.rows[replayed - 1]!.publicSliceSha256);
      assertPlayerProjection(localAfter, publicAfter.redPriest, state);
      if (row.commandCount === selected.commandCount) { after = state; break; }
    }
    expect(replayed).toBe(19);
    expect(captureHash(before, root.state)).toBe(expected.beforeStateSha256); expect(captureHash(after, root.state)).toBe(expected.afterStateSha256);
    expect(after.random.cursor).toBe(before.random.cursor + 1);
    expect(after.redPriest.journal.at(-1)!.randomReceipts).toHaveLength(1);
    const initialTime = '2026-10-17T00:00:00.000Z', now = '2026-10-17T00:00:01.000Z';
    const envelope: SliceEnvelope = { intentId: `red-priest209-natural:${selected.commandCount}`, runId: before.runId,
      expectedRevision: before.revision, payload: selected.intent };
    const receipt: SliceReceipt = { intentId: envelope.intentId, runId: after.runId, previousRevision: before.revision,
      newRevision: after.revision, committedAt: now, replayed: false, state: publicAfter };
    const directory = mkdtempSync(join(tmpdir(), 'red-priest-natural-save-')), path = join(directory, 'save.sqlite');
    let store: SqliteSliceStore | undefined, inject = false, injections = 0;
    const exact = (wanted: SliceState, updatedAt: string, committed: boolean): void => {
      const saved = store!.repository.get(wanted.runId)!;
      expect(hash(saved.state)).toBe(hash(wanted)); expect(saved.state.random).toEqual(wanted.random);
      expect(saved.updatedAt).toBe(updatedAt); expect(store!.repository.activeRun()).toBe(wanted.runId);
      expect(store!.repository.receipt(envelope.intentId)).toEqual(committed ? { fingerprint: stableStringify(envelope), receipt } : null);
    };
    const open = (): SqliteSliceStore => new SqliteSliceStore(path, { now: () => now, beforeWrite: () => {
      if (inject) {
        exact(after, now, true); injections++;
        throw Error('Injected after real private state, RNG and receipt application, before durable COMMIT');
      }
    } });
    const reopen = (): void => { store!.close(); store = undefined; store = open(); };
    try {
      store = open();
      store.repository.transaction(() => { store!.repository.put({ state: before, updatedAt: initialTime }); store!.repository.selectRun(before.runId); });
      reopen(); exact(before, initialTime, false); expect(unwrap(store!.getBootstrap()).activeState).toEqual(publicBefore);
      const untouched = persisted(path);
      inject = true; expect(store!.submitIntent(envelope)).toMatchObject({ ok: false, error: { code: 'SAVE_FAILED' } }); inject = false;
      expect(injections).toBe(1); exact(before, initialTime, false); expect(persisted(path)).toBe(untouched);
      reopen(); exact(before, initialTime, false); expect(persisted(path)).toBe(untouched);
      expect(unwrap(store!.submitIntent(envelope))).toEqual(receipt); exact(after, now, true);
      const committed = persisted(path); reopen(); exact(after, now, true);
      expect(unwrap(store!.getBootstrap()).activeState).toEqual(publicAfter); expect(persisted(path)).toBe(committed);
      expect(unwrap(store!.submitIntent(envelope))).toEqual({ ...receipt, replayed: true });
      exact(after, now, true); expect(persisted(path)).toBe(committed);
      if (after.status === 'DEAD') {
        expect(JSON.parse(readFileSync(`${path}.sealed`, 'utf8'))).toEqual([after.runId]);
        expect(publicAfter.canAct).toBe(false);
      } else expect(existsSync(`${path}.sealed`)).toBe(false);
      reopen(); exact(after, now, true); expect(persisted(path)).toBe(committed);
    } finally {
      store?.close(); rmSync(directory, { recursive: true, force: true });
      authenticateFixture();
    }
  }, 120_000);
});
