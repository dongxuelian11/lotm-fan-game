/** Actual single natural terminal. One actual706 continuation replay and one actual terminal-command
 * SQLite fault/retry/idempotency/cold reopen, reusing its real penultimate state.
 * No original706/old801 replay, controlled RNG, extra route, or DB matrix. */
import { expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { StoredSlice } from '../../src/application/slice-application.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { openJusticiarRuntimeSession, type JusticiarRuntimeSession } from '../../src/domain/justiciar/owned-session.js';
import { createJusticiarSource, JUSTICIAR_FROZEN_SOURCE_KEYS } from '../../src/domain/justiciar/source.js';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import type { SliceEnvelope, SliceResult } from '../../src/shared/slice-contracts.js';
import {
  JUSTICIAR228_PREFIX_COUNT, JUSTICIAR228_SOURCE_REVISION, JUSTICIAR228_SOURCE_STATE_SHA,
  assertJusticiarNaturalPublic, justiciarNaturalAnchor, justiciarNaturalHash, justiciarNaturalOutcome,
  justiciarNaturalPins, justiciarNaturalReceipt, justiciarNaturalRolls, justiciarNaturalSha, justiciarNaturalStateFacts,
  loadJusticiarNaturalPolicy, readJusticiarNaturalRows, readJusticiarNaturalSnapshot, readJusticiarNaturalSource,
  readJusticiarNaturalSummary, type JusticiarNaturalActionRow,
} from '../helpers/justiciar-natural-capture.js';

function unwrap<T>(result: SliceResult<T>): T {
  if (!result.ok) throw Error(result.error.code + ': ' + result.error.message);
  return result.value;
}

function verifyLastCommandSave(before: SliceState, state: SliceState, view: SliceProjection, last: JusticiarNaturalActionRow): void {
  const directory = mkdtempSync(join(tmpdir(), 'lotm-justiciar228-natural-')), file = join(directory, 'save.sqlite');
  const importedAt = '2026-10-19T00:00:00.000Z', committedAt = '2026-10-19T00:00:01.000Z';
  const request: SliceEnvelope = { intentId: 'justiciar228-natural-last', runId: before.runId,
    expectedRevision: before.revision, payload: last.intent };
  expect(last.after.revision).toBe(state.revision); expect(last.before.revision).toBe(before.revision);
  expect(last.commandCount).toBe(justiciarNaturalPins().commandCount);
  expect(last.intent).toEqual(justiciarNaturalPins().lastIntent);
  const requestHash = justiciarNaturalHash(request);
  const inspect = () => {
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      const runs = db.prepare('SELECT * FROM slice_runs ORDER BY id').all();
      const raw = String(runs.find(row => row.id === state.runId)!.current_json);
      const hash = (path: string) => existsSync(path) ? justiciarNaturalSha(readFileSync(path)) : null;
      return { raw, stored: JSON.parse(JSON.parse(raw).payload) as StoredSlice,
        durable: justiciarNaturalHash({ runs, receipts: db.prepare('SELECT * FROM slice_receipts ORDER BY id').all(),
          meta: db.prepare('SELECT * FROM slice_meta ORDER BY key').all(), backup: hash(file + '.bak'),
          sealed: hash(file + '.sealed'), files: readdirSync(dirname(file)).sort() }) };
    } finally { db.close(); }
  };
  let store: SqliteSliceStore | undefined, watching = false, fail = true, attempts = 0;
  let stagedAssertionError: unknown, publishedRevision: number | null = null;
  try {
    store = new SqliteSliceStore(file, { now: () => committedAt, beforeWrite: () => {
      if (!watching) return;
      attempts++;
      try {
        expect(store!.repository.ownedHead(before.runId)?.revision ?? null).toBe(publishedRevision);
        expect(store!.repository.get(before.runId)).toEqual({ state, updatedAt: committedAt });
        expect(store!.repository.receipt(request.intentId)?.receipt.newRevision).toBe(state.revision);
      } catch (error) { stagedAssertionError = error; throw error; }
      if (fail) throw Error('Injected last natural Justiciar command write failure');
    } });
    store.repository.transaction(() => {
      store!.repository.put({ state: before, updatedAt: importedAt });
      store!.repository.selectRun('previous-selected-slot');
    });
    publishedRevision = store.repository.ownedHead(before.runId)?.revision ?? null;
    if (before.justiciar.guidanceKnown) expect(publishedRevision).toBe(before.revision);
    const original = inspect();
    watching = true;
    try { expect(store.submitIntent(request)).toMatchObject({ ok: false, error: { code: 'SAVE_FAILED' } }); }
    finally { watching = false; }
    if (stagedAssertionError) throw stagedAssertionError;
    expect(attempts).toBe(1); expect(inspect()).toEqual(original);
    expect(store.repository.receipt(request.intentId)).toBeNull();
    expect(store.repository.activeRun()).toBe('previous-selected-slot');
    expect(store.repository.ownedHead(before.runId)?.revision ?? null).toBe(publishedRevision);
    expect(inspect().stored.state.random).toEqual(last.before.random);

    fail = false; watching = true;
    const result = store.submitIntent(request);
    watching = false;
    if (stagedAssertionError) throw stagedAssertionError;
    const receipt = unwrap(result);
    expect(receipt).toMatchObject({ intentId: request.intentId, previousRevision: before.revision,
      newRevision: state.revision, committedAt, replayed: false });
    expect(receipt.state).toEqual(view); expect(attempts).toBe(2);
    expect(justiciarNaturalHash(request)).toBe(requestHash);
    expect(store.repository.activeRun()).toBe(before.runId);
    const committed = inspect();
    expect(committed.stored).toEqual({ state, updatedAt: committedAt });
    expect(committed.stored.state.random).toEqual(last.after.random);
    expect(justiciarNaturalReceipt(committed.stored.state, before)).toEqual(last.receipt);
    expect(unwrap(store.submitIntent(request))).toEqual({ ...receipt, replayed: true });
    expect(attempts).toBe(2); expect(inspect().raw).toBe(committed.raw);
    store.close(); store = undefined;

    store = new SqliteSliceStore(file, { now: () => committedAt });
    expect(unwrap(store.loadRun(state.runId))).toEqual(view);
    expect(unwrap(store.getBootstrap()).activeState).toEqual(view);
    expect(unwrap(store.submitIntent(request))).toEqual({ ...receipt, replayed: true });
    expect(inspect().raw).toBe(committed.raw);
    expect(inspect().stored).toEqual(committed.stored);
    if (state.justiciar.guidanceKnown) expect(store.repository.ownedHead(state.runId)?.revision).toBe(state.revision);
  } finally { store?.close(); rmSync(directory, { recursive: true, force: true }); }
}

it('replays the sole natural actual706 continuation and faults/retries/reopens its actual terminal save', async () => {
  const pins = justiciarNaturalPins(), summary = readJusticiarNaturalSummary(), archive = readJusticiarNaturalSource();
  const { source, prefixCommands } = archive, policy = await loadJusticiarNaturalPolicy(summary);
  const provenance = policy.verifySourceProvenance(archive.wrapper, archive.archive);
  expect(provenance.prefixCommands).toEqual(prefixCommands); expect(provenance.provenance).toEqual(summary.provenance);
  expect(summary.frozenSourceKeys).toEqual([...JUSTICIAR_FROZEN_SOURCE_KEYS]);
  const rows = readJusticiarNaturalRows(); expect(rows).toHaveLength(summary.commandCount);
  let previous: string | null = null;
  for (const [index, row] of rows.entries()) {
    const { rowSha256, ...payload } = row;
    expect(rowSha256, `row ${index + 1}`).toBe(justiciarNaturalHash(payload));
    expect(row.commandSha256).toBe(justiciarNaturalHash(row.intent));
    expect(row.commandCount).toBe(index + 1); expect(row.previousRowSha256).toBe(previous);
    if (index < JUSTICIAR228_PREFIX_COUNT) {
      expect(row.kind).toBe('HISTORICAL_COMMAND'); expect(row.intent).toEqual(prefixCommands[index]);
    }
    previous = rowSha256;
  }
  const initial = readJusticiarNaturalSnapshot('initial');
  let state = migrateSliceState(structuredClone(source)), view = projectSliceState(state), before = state;
  for (const [key, value] of Object.entries(source)) if (!['schemaVersion', 'contentVersion'].includes(key))
    expect(state[key as keyof SliceState], `migration root ${key}`).toEqual(value);
  expect(state).toEqual(initial.final); expect(view).toEqual(initial.public);
  expect(state.justiciar).toMatchObject({ guidanceKnown: false, source: null, journal: [] });
  let anchor = justiciarNaturalAnchor(state, view), freeze: ReturnType<typeof policy.freezePredecessors> | null = null;
  expect(anchor).toEqual(initial.anchor); policy.assertOriginalRoots(state, source, JUSTICIAR_FROZEN_SOURCE_KEYS, freeze);
  const actions = rows.slice(JUSTICIAR228_PREFIX_COUNT) as JusticiarNaturalActionRow[];
  expect(actions).toHaveLength(summary.newCount);
  let session: JusticiarRuntimeSession | undefined;
  for (const [index, row] of actions.entries()) {
    expect(row.kind).toBe('JUSTICIAR_CONTINUATION_ACTION'); expect(row.newCount).toBe(index + 1);
    expect(row.before, `before command ${row.commandCount}`).toEqual(anchor);
    expect(row.after.revision).toBe(JUSTICIAR228_SOURCE_REVISION + row.newCount);
    expect(view.status).toBe('ACTIVE'); expect(view.activeEvent).toBeNull(); expect(view.combat).toBeNull();
    // The retained authenticated selector uses only the current public view and
    // last committed intent. No private budget, future draw, or alternate policy.
    const decision = policy.chooseAction(view, actions[index - 1]?.intent ?? null);
    if ('stop' in decision) throw Error(`Replay action ${row.commandCount} unexpectedly stopped: ${decision.reason}`);
    expect(decision).toEqual({ intent: row.intent, publicAction: row.publicAction });
    expect(row.publicAction.enabled).toBe(true);
    if (view.justiciar.guidanceKnown) {
      expect(row.intent.type).toBe('JUSTICIAR'); expect(row.publicAction.preferredAction).toBe(true);
      expect(view.justiciar.actions.filter(a => a.preferredAction)).toHaveLength(1);
    }
    before = state;
    if (session) {
      const draft = session.prepare(row.intent, state.revision);
      expect(session.inspect().revision).toBe(state.revision);
      state = session.snapshotDraft(draft); view = session.projectDraft(draft); session.commit(draft);
    } else {
      state = applySliceIntent(state, row.intent);
      if (state.justiciar.guidanceKnown) {
        expect(row.intent).toEqual({ type: 'JUSTICIAR', command: { type: 'LEARN_GUIDANCE' } });
        expect(state.justiciar.source).toEqual(createJusticiarSource(before));
        freeze = policy.freezePredecessors(state, JUSTICIAR_FROZEN_SOURCE_KEYS);
        policy.assertOriginalRoots(state, source, JUSTICIAR_FROZEN_SOURCE_KEYS, freeze);
        session = openJusticiarRuntimeSession(state);
      }
      view = session ? session.project() : projectSliceState(state);
    }
    expect(row.receipt).toEqual(justiciarNaturalReceipt(state, before));
    expect(row.actual).toEqual(justiciarNaturalOutcome(state));
    expect(Number.isSafeInteger(row.elapsedWeeks)).toBe(true); expect(row.elapsedWeeks).toBeGreaterThanOrEqual(0);
    expect(row.elapsedWeeks).toBe(state.week - before.week);
    expect(state.random.seed).toBe(source.random.seed); expect(state.random.cursor).toBeGreaterThanOrEqual(before.random.cursor);
    assertJusticiarNaturalPublic(view); policy.auditPublic(view, state);
    anchor = justiciarNaturalAnchor(state, view); expect(anchor, `after command ${row.commandCount}`).toEqual(row.after);
  }
  const terminal = readJusticiarNaturalSnapshot('terminal');
  assertValidSliceState(state); expect(state).toEqual(terminal.final); expect(view).toEqual(terminal.public);
  expect(justiciarNaturalStateFacts(state)).toEqual(pins.state);
  expect(justiciarNaturalOutcome(state)).toEqual(pins.actual); expect(justiciarNaturalRolls(state, source)).toEqual(pins.rolls);
  expect(state.justiciar.source ? justiciarNaturalHash(state.justiciar.source) : null).toBe(pins.handoffSourceSha256);
  expect(state.revision).toBe(summary.revision); expect(policy.terminal(state)?.stage).toBe(summary.stage);
  expect(anchor.privateStateSha256).toBe(pins.finalPrivateStateSha256);
  expect(anchor.publicStateSha256).toBe(pins.finalWholePublicSha256);
  expect(freeze).toEqual(summary.predecessorFreeze);
  policy.assertOriginalRoots(state, source, JUSTICIAR_FROZEN_SOURCE_KEYS, freeze);
  if (state.status === 'DEAD') {
    expect(state.ending?.kind).toBe('DEATH'); expect(view.canAct).toBe(false);
    expect(view.justiciar.actions.every(action => !action.enabled)).toBe(true);
  } else {
    expect(state.status).toBe('ACTIVE'); expect(state.ending).toBeNull();
    expect(summary.actual).toMatchObject({ reported: true, ordinaryExit: true, cargoDelivered: true, returnedHome: true });
    // Practice methods and their success/failure are pinned from the actual capture.
    // A normal or stopped practice is never rewritten into an ability success.
    expect(state.justiciar.scene).toMatchObject({ playerPosition: 'OUTSIDE', contact: false, window: null,
      segments: { A: { open: false }, B: { open: false } }, exit: { door: 'CLOSED' } });
    expect(view.justiciar.actions.some(action => action.preferredAction)).toBe(false);
  }
  expect(justiciarNaturalHash(source)).toBe(JUSTICIAR228_SOURCE_STATE_SHA);
  // Reuse this replay's true last before/after pair, even if it is an S1 death.
  verifyLastCommandSave(before, state, view, actions.at(-1)!);
}, 900_000);
