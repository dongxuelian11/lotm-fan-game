/** One complete new-route replay, then one actual last-command SQLite fault/retry/reopen.
 * Original688 are integrity-checked only. No controlled draw, old854 route, or extra replay. */
import { expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { StoredSlice } from '../../src/application/slice-application.js';
import { applySliceIntent, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { openDemonessRuntimeSession, type DemonessRuntimeSession } from '../../src/domain/demoness/owned-session.js';
import { DEMONESS_ABILITY_IDS } from '../../src/domain/demoness/types.js';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import type { SliceEnvelope, SliceResult } from '../../src/shared/slice-contracts.js';
import { assertEmptyDemonessState } from '../helpers/empty-demoness-capture.js';
import {
  DEMONESS221_FROZEN_ROOTS, DEMONESS221_SOURCE_STATE_SHA, assertDemonessNaturalRetainedFreeze,
  demonessNaturalArchivedPublic, demonessNaturalHash, demonessNaturalOutcome, demonessNaturalPublicBudget,
  demonessNaturalReceipt, demonessNaturalSha, readDemonessNaturalArchive, readDemonessNaturalRows,
  readDemonessNaturalSnapshot, readDemonessNaturalSource, readDemonessNaturalSummary,
  type DemonessNaturalActionRow, type DemonessNaturalPublic,
} from '../helpers/demoness-natural-capture.js';

import { historicalDemonessNaturalState as historicalNaturalState, historicalDemonessNaturalPublic as historicalNaturalPublic,
  currentDemonessNaturalAnchor as capturedNaturalAnchor } from '../helpers/demoness-natural-capture.js';

const LATER_EMPTY_ROOTS = ['hermit', 'hangedMan', 'abyss', 'chained', 'wheelOfFortune', 'blackEmperor', 'justiciar', 'mother'] as const;

it('audits current-schema initial and terminal snapshots without replay', () => {
  for (const which of ['initial', 'terminal'] as const) {
    const original = readDemonessNaturalSnapshot(which), rawHash = demonessNaturalHash(original);
    const state = migrateSliceState(structuredClone(original.final)), view = projectSliceState(state);
    const stateKeys = Object.keys(original.final), publicKeys = Object.keys(original.public);
    expect(historicalNaturalState(state, stateKeys)).toEqual(original.final);
    expect(historicalNaturalPublic(view, state, publicKeys)).toEqual(original.public);
    expect(capturedNaturalAnchor(state, view, original)).toEqual(original.anchor);
    // Exact-key checks reject unknown roots, even if their value is undefined.
    expect(() => historicalNaturalState(Object.assign({}, state, { unexpectedFutureRoot: undefined }), stateKeys)).toThrow();
    expect(() => historicalNaturalPublic(Object.assign({}, view, { unexpectedFutureRoot: undefined }), state, publicKeys)).toThrow();
    for (const root of LATER_EMPTY_ROOTS) {
      expect(() => historicalNaturalState({ ...state, [root]: { ...state[root], guidanceKnown: true } }, stateKeys)).toThrow();
      expect(() => historicalNaturalPublic({ ...view, [root]: { ...view[root], guidanceKnown: true } }, state, publicKeys)).toThrow();
    }
    expect(demonessNaturalHash(historicalNaturalState({ ...state, cash: state.cash + 1 }, stateKeys)))
      .not.toBe(original.anchor.privateStateSha256);
    expect(demonessNaturalHash(historicalNaturalPublic({ ...view, cash: view.cash + 1 }, state, publicKeys)))
      .not.toBe(original.anchor.publicStateSha256);
    expect(demonessNaturalHash(original)).toBe(rawHash);
  }
}, 180_000);

function unwrap<T>(result: SliceResult<T>): T {
  if (!result.ok) throw Error(result.error.code + ': ' + result.error.message);
  return result.value;
}
function assertPublicControl(view: DemonessNaturalPublic, row: DemonessNaturalActionRow, previous: SliceIntent | null): void {
  expect(view.status).toBe('ACTIVE'); expect(view.activeEvent).toBeNull(); expect(view.combat).toBeNull();
  const action = row.publicAction;
  expect(action.enabled).toBe(true);
  if ('kind' in action) {
    expect(row.intent).toEqual({ type: 'ACTION', action: action.action });
    expect(action.kind).toBe('ORDINARY_RESOURCE'); expect(action.preferredAction).toBe(false);
    expect(view.canAct).toBe(true); expect(view.demoness.guidanceKnown).toBe(false);
    expect(view.apocalypseDemoness.insideCase).toBe(false); expect(view.apocalypseDemoness.preparedWeek).toBeNull();
    expect(action.publicBudget).toEqual(demonessNaturalPublicBudget(view));
    expect(['WORK', 'REST']).toContain(action.action); expect(action.rule.length).toBeGreaterThan(0);
    return;
  }
  const { selectionRule, ...control } = action;
  expect(selectionRule.length).toBeGreaterThan(0);
  if (row.intent.type === 'DEMONESS') {
    expect(view.demoness.actions).toContainEqual(control);
    expect(row.intent.command).toEqual(control.command);
    if (view.demoness.guidanceKnown) {
      expect(selectionRule).toBe('EXACT_PUBLIC_PREFERRED');
      expect(view.demoness.actions.filter(item => item.preferredAction)).toEqual([control]);
    } else {
      expect(row.intent.command).toEqual({ type: 'LEARN_GUIDANCE' });
      expect(selectionRule).toBe('ACTUAL_S1_HANDOFF_TO_S0_GUIDANCE');
      expect(view.apocalypseDemoness.promoted).toBe(true); expect(view.apocalypseDemoness.life.reflected).toBe(true);
    }
  } else {
    expect(row.intent.type).toBe('APOCALYPSE_DEMONESS');
    if (row.intent.type !== 'APOCALYPSE_DEMONESS') throw Error('Unknown natural continuation control');
    expect([...view.apocalypseDemoness.actions, ...view.apocalypseDemoness.life.actions]).toContainEqual(control);
    expect(row.intent.command).toEqual(control.command);
    expect(view.demoness.guidanceKnown).toBe(false);
    expect(['REQUEST_SUPPLY', 'RECEIVE_SUPPLY']).not.toContain(row.intent.command.type);
    if (selectionRule === 'EXACT_PUBLIC_S1_LIFE_PREFERRED')
      expect(view.apocalypseDemoness.life.preferredActionId).toBe(control.id);
    if (row.intent.command.type === 'CONSUME') {
      expect(selectionRule).toBe('PAID_SUPPORTED_SAME_ORIGINAL_CONSUMPTION');
      expect(previous).toEqual({ type: 'APOCALYPSE_DEMONESS', command: {
        type: 'STABILIZE_PROMOTION', bottleId: row.intent.command.bottleId,
      } });
    }
  }
}

function verifyLastCommandSave(before: SliceState, state: SliceState, view: SliceProjection, last: DemonessNaturalActionRow): void {
  const directory = mkdtempSync(join(tmpdir(), 'lotm-demoness221-natural-')), file = join(directory, 'save.sqlite');
  const importedAt = '2026-10-19T00:00:00.000Z', committedAt = '2026-10-19T00:00:01.000Z';
  const request: SliceEnvelope = { intentId: 'demoness221-natural-last', runId: before.runId,
    expectedRevision: before.revision, payload: last.intent };
  const requestHash = demonessNaturalHash(request);
  const inspect = () => {
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      const runs = db.prepare('SELECT * FROM slice_runs ORDER BY id').all();
      const raw = String(runs.find(row => row.id === state.runId)!.current_json);
      const hash = (path: string) => existsSync(path) ? demonessNaturalSha(readFileSync(path)) : null;
      return { raw, stored: JSON.parse(JSON.parse(raw).payload) as StoredSlice,
        durable: demonessNaturalHash({ runs, receipts: db.prepare('SELECT * FROM slice_receipts ORDER BY id').all(),
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
      if (fail) throw Error('Injected last natural Demoness command write failure');
    } });
    store.repository.transaction(() => {
      store!.repository.put({ state: before, updatedAt: importedAt });
      store!.repository.selectRun('previous-selected-slot');
    });
    publishedRevision = store.repository.ownedHead(before.runId)?.revision ?? null;
    if (before.demoness.guidanceKnown) expect(publishedRevision).toBe(before.revision);
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
    expect(demonessNaturalHash(request)).toBe(requestHash);
    expect(store.repository.activeRun()).toBe(before.runId);
    const committed = inspect();
    expect(committed.stored).toEqual({ state, updatedAt: committedAt });
    expect(committed.stored.state.random).toEqual(last.after.random);
    expect(demonessNaturalReceipt(committed.stored.state, before)).toEqual(last.receipt);
    expect(unwrap(store.submitIntent(request))).toEqual({ ...receipt, replayed: true });
    expect(attempts).toBe(2); expect(inspect().raw).toBe(committed.raw);
    store.close(); store = undefined;

    store = new SqliteSliceStore(file, { now: () => committedAt });
    expect(unwrap(store.loadRun(state.runId))).toEqual(view);
    expect(unwrap(store.getBootstrap()).activeState).toEqual(view);
    expect(unwrap(store.submitIntent(request))).toEqual({ ...receipt, replayed: true });
    if (state.status === 'DEAD') {
      expect(store.submitIntent({ ...request, intentId: 'demoness221-after-death', expectedRevision: state.revision }))
        .toMatchObject({ ok: false, error: { code: 'ARCHIVED' } });
      expect(JSON.parse(readFileSync(file + '.sealed', 'utf8'))).toContain(state.runId);
    }
    expect(inspect().raw).toBe(committed.raw);
    expect(inspect().stored).toEqual(committed.stored);
    if (state.demoness.guidanceKnown) expect(store.repository.ownedHead(state.runId)?.revision).toBe(state.revision);
  } finally { store?.close(); rmSync(directory, { recursive: true, force: true }); }
}

it('verifies every actual new private/public/RNG boundary and the real terminal, then faults/retries/reopens its last command once', () => {
  const summary = readDemonessNaturalSummary(), source = readDemonessNaturalSource();
  const archive = readDemonessNaturalArchive(), initial = readDemonessNaturalSnapshot('initial');
  const rows = readDemonessNaturalRows();
  const projectionAudit = assertDemonessNaturalRetainedFreeze(summary, rows);
  expect(rows).toHaveLength(summary.commandCount);
  let previous: string | null = null;
  for (const [index, row] of rows.entries()) {
    const { rowSha256, ...payload } = row;
    expect(rowSha256, `row ${index + 1}`).toBe(demonessNaturalHash(payload));
    expect(row.commandSha256).toBe(demonessNaturalHash(row.intent));
    expect(row.commandCount).toBe(index + 1); expect(row.previousRowSha256).toBe(previous);
    if (index < 688) {
      expect(row.kind).toBe('HISTORICAL_COMMAND'); expect(row.intent).toEqual(archive.commands[index]);
    }
    previous = rowSha256;
  }
  let state = migrateSliceState(structuredClone(source)), view = projectSliceState(state);
  // Explicitly admit the named current default. The raw196 evidence is never rewritten.
  assertEmptyDemonessState(state);
  for (const [key, value] of Object.entries(source)) if (!['schemaVersion', 'contentVersion'].includes(key))
    expect(state[key as keyof SliceState], `original migration root ${key}`).toEqual(value);
  expect(historicalNaturalState(state, Object.keys(initial.final))).toEqual(initial.final);
  expect(historicalNaturalPublic(view, state, Object.keys(initial.public))).toEqual(initial.public);
  let anchor = capturedNaturalAnchor(state, view, initial), before = state;
  expect(anchor).toEqual(initial.anchor);
  let archivedView = demonessNaturalArchivedPublic(historicalNaturalPublic(view, state, Object.keys(initial.public)), 688, projectionAudit);
  const actions = rows.slice(688) as DemonessNaturalActionRow[];
  let session: DemonessRuntimeSession | undefined, previousIntent: SliceIntent | null = null;
  let predecessorFreeze: typeof summary.predecessorFreeze = null;
  for (const [index, row] of actions.entries()) {
    expect(row.kind).toBe('DEMONESS_CONTINUATION_ACTION'); expect(row.newCount).toBe(index + 1);
    expect(row.before, `before command ${row.commandCount}`).toEqual(anchor);
    expect(row.after.revision).toBe(689 + row.newCount);
    // The original195 controls remain evidence of what was actually selected.
    // Their old public view is fully hash-verified with only the three audited
    // recommendation paths restored. Action884 onward must use current controls.
    assertPublicControl(row.commandCount <= projectionAudit.proof.commandCount ? archivedView : view, row, previousIntent);
    before = state;
    if (session) {
      const draft = session.prepare(row.intent, state.revision);
      expect(session.inspect().revision).toBe(state.revision);
      session.commit(draft); state = session.snapshot();
    } else {
      state = applySliceIntent(state, row.intent);
      if (state.demoness.guidanceKnown) {
        expect(row.intent).toEqual({ type: 'DEMONESS', command: { type: 'LEARN_GUIDANCE' } });
        session = openDemonessRuntimeSession(state);
        predecessorFreeze = { revision: state.demoness.source!.revision,
          roots: Object.fromEntries(DEMONESS221_FROZEN_ROOTS.map(key => [key, demonessNaturalHash(state[key])])) };
      }
    }
    view = session ? session.project() : projectSliceState(state);
    expect(row.receipt).toEqual(demonessNaturalReceipt(state, before));
    expect(row.actual).toEqual(demonessNaturalOutcome(state));
    expect(state.random.seed).toBe(source.random.seed); expect(state.random.cursor).toBeGreaterThanOrEqual(before.random.cursor);
    anchor = capturedNaturalAnchor(state, view, initial);
    expect(anchor, `after command ${row.commandCount}`).toEqual(row.after);
    if (row.commandCount <= projectionAudit.proof.commandCount)
      archivedView = demonessNaturalArchivedPublic(historicalNaturalPublic(view, state, Object.keys(initial.public)), row.commandCount, projectionAudit);
    previousIntent = row.intent;
  }
  expect([...projectionAudit.verifiedDifferences].sort((a, b) => a - b))
    .toEqual(projectionAudit.proof.publicDifferences.map(item => item.commandCount).sort((a, b) => a - b));
  const terminal = readDemonessNaturalSnapshot('terminal');
  expect(historicalNaturalState(state, Object.keys(terminal.final))).toEqual(terminal.final);
  expect(historicalNaturalPublic(view, state, Object.keys(terminal.public))).toEqual(terminal.public);
  expect(state.revision).toBe(summary.revision); expect(demonessNaturalOutcome(state)).toEqual(summary.actual);
  expect(predecessorFreeze).toEqual(summary.predecessorFreeze);
  for (const key of [...DEMONESS221_FROZEN_ROOTS.filter(key => key !== 'apocalypseDemoness'), 'world', 'combatHistory'] as const)
    expect(state[key], `original ${key}`).toEqual(source[key]);
  const prior = source.apocalypseDemoness, current = state.apocalypseDemoness;
  expect(current.sourceHistory).toEqual(prior.sourceHistory); expect(current.sourceScene).toEqual(prior.sourceScene);
  expect(current.bottles.slice(0, 3)).toEqual(prior.bottles);
  expect(current.acquisitionJournal.slice(0, prior.acquisitionJournal.length)).toEqual(prior.acquisitionJournal);
  expect(current.life.journal.slice(0, prior.life.journal.length)).toEqual(prior.life.journal);
  if (predecessorFreeze) for (const key of DEMONESS221_FROZEN_ROOTS)
    expect(demonessNaturalHash(state[key]), `post-guidance frozen ${key}`).toBe(predecessorFreeze.roots[key]);
  const character = structuredClone(source.character), promotions = 2 - state.progression.sequence;
  expect([0, 1, 2]).toContain(promotions);
  for (const key of Object.keys(character.coreStats) as (keyof typeof character.coreStats)[])
    character.coreStats[key] = Math.min(500, character.coreStats[key] + promotions);
  expect(state.character).toEqual(character);
  for (const [id, mastery] of Object.entries(source.progression.mastery)) expect(state.progression.mastery[id]).toBe(mastery);
  for (const [index, id] of DEMONESS_ABILITY_IDS.entries()) {
    const applied = index === 0 ? summary.actual.petrificationApplied : summary.actual.reshapingApplied;
    expect(state.progression.mastery[id]).toBe(summary.actual.promoted ? applied ? 8 : 0 : undefined);
  }
  if (state.status === 'DEAD') {
    expect(summary.stage).toBe('NATURAL_DEATH'); expect(state.ending?.kind).toBe('DEATH'); expect(view.canAct).toBe(false);
  } else if (state.status === 'ACTIVE') {
    expect(summary.stage).toBe('NATURAL_S0_REPORTED_EXIT');
    expect(summary.actual).toMatchObject({ s1Promoted: true, s1Reflected: true, promoted: true,
      reported: true, ordinaryExit: true, passagePhase: 'CLOSED' });
    expect(state.demoness.passage).toMatchObject({ phase: 'CLOSED', position: -2, contact: false, window: null });
    expect(state.demoness.passage!.residents).toHaveLength(2);
    for (const resident of state.demoness.passage!.residents) {
      expect(resident.position).toBe(-2); expect(resident.returnPassage?.crossing).toBeTruthy();
      expect(resident.returnPassage?.exit).toBeTruthy();
    }
    expect(view.demoness.actions.some(action => action.preferredAction)).toBe(false);
  } else {
    expect(summary.stage).toBe('NATURAL_TERMINAL'); expect(view.canAct).toBe(false);
  }
  expect(demonessNaturalHash(source)).toBe(DEMONESS221_SOURCE_STATE_SHA);
  // Reuse the penultimate state from this replay, never regenerate it or replay old688.
  verifyLastCommandSave(before, state, view, actions.at(-1)!);
}, 900_000);
