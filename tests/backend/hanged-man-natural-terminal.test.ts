/** One complete new-route replay, then one actual last-command SQLite fault/retry/reopen.
 * Original723 are integrity-checked only. No controlled draw, old824 route, or extra replay. */
import { expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { StoredSlice } from '../../src/application/slice-application.js';
import { applySliceIntent, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { openHangedManRuntimeSession, type HangedManRuntimeSession } from '../../src/domain/hanged-man/owned-session.js';
import { HANGED_MAN_ABILITY_IDS } from '../../src/domain/hanged-man/types.js';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import type { SliceEnvelope, SliceResult } from '../../src/shared/slice-contracts.js';
import { getDarkAngelCurrentSite, DARK_ANGEL_CASE_IDS } from '../../src/domain/dark-angel/life.js';
import { resolveDarkAngelOriginalsSnapshot } from '../../src/domain/dark-angel/index.js';
import { DARK_ANGEL_ABILITY_IDS } from '../../src/domain/dark-angel/types.js';
import {
  HANGED_MAN223_FROZEN_ROOTS, HANGED_MAN223_SOURCE_STATE_SHA, assertHangedManNaturalRetainedFreeze,
  hangedManNaturalHash, hangedManNaturalOutcome, hangedManNaturalPublicBudget,
  hangedManNaturalReceipt, hangedManNaturalSha, readHangedManNaturalArchive, readHangedManNaturalRows,
  readHangedManNaturalSnapshot, readHangedManNaturalSource, readHangedManNaturalSummary,
  type HangedManNaturalActionRow,
} from '../helpers/hanged-man-natural-capture.js';

import assert from 'node:assert/strict';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { assertEmptyAbyssState, assertEmptyAbyssPublic } from '../helpers/empty-abyss-capture.js';
import { assertEmptyChainedState, assertEmptyChainedPublic } from '../helpers/empty-chained-capture.js';
import { assertEmptyWheelOfFortuneState, assertEmptyWheelOfFortunePublic } from '../helpers/empty-wheel-of-fortune-capture.js';
import { assertEmptyBlackEmperorState, assertEmptyBlackEmperorPublic } from '../helpers/empty-black-emperor-capture.js';
import { assertEmptyJusticiarState, assertEmptyJusticiarPublic } from '../helpers/empty-justiciar-capture.js';
import { assertEmptyMotherState, assertEmptyMotherPublic } from '../helpers/empty-mother-capture.js';

/** Raw220 captures stay immutable. Only these named, exactly empty later roots
 * and format metadata are removed from detached historical hash views. */
const LATER_EMPTY_ROOTS = ['abyss', 'chained', 'wheelOfFortune', 'blackEmperor', 'justiciar', 'mother'] as const;
function historicalNaturalState(state: SliceState, originalKeys: readonly string[]) {
  assert.deepEqual([state.schemaVersion, state.contentVersion], [CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  for (const root of LATER_EMPTY_ROOTS) assert.equal(originalKeys.includes(root), false);
  assert.deepEqual(Object.keys(state).sort(), [...originalKeys, ...LATER_EMPTY_ROOTS].sort());
  assertEmptyAbyssState(state);
  assertEmptyChainedState(state);
  assertEmptyWheelOfFortuneState(state);
  assertEmptyBlackEmperorState(state);
  assertEmptyJusticiarState(state);
  assertEmptyMotherState(state);
  const { abyss: _emptyAbyss, chained: _emptyChained, wheelOfFortune: _emptyWheelOfFortune,
    blackEmperor: _emptyBlackEmperor, justiciar: _emptyJusticiar, mother: _emptyMother, ...originalFields } = state;
  return { ...originalFields, schemaVersion: 220, contentVersion: 'hanged-man-v220' };
}
function historicalNaturalPublic(view: SliceProjection, state: SliceState, originalKeys: readonly string[]) {
  for (const root of LATER_EMPTY_ROOTS) assert.equal(originalKeys.includes(root), false);
  assert.deepEqual(Object.keys(view).sort(), [...originalKeys, ...LATER_EMPTY_ROOTS].sort());
  assertEmptyAbyssState(state);
  assertEmptyChainedState(state);
  assertEmptyWheelOfFortuneState(state);
  assertEmptyBlackEmperorState(state);
  assertEmptyJusticiarState(state);
  assertEmptyMotherState(state);
  assertEmptyAbyssPublic(view, state);
  assertEmptyChainedPublic(view, state);
  assertEmptyWheelOfFortunePublic(view, state);
  assertEmptyBlackEmperorPublic(view, state);
  assertEmptyJusticiarPublic(view, state);
  assertEmptyMotherPublic(view, state);
  const { abyss: _emptyAbyss, chained: _emptyChained, wheelOfFortune: _emptyWheelOfFortune,
    blackEmperor: _emptyBlackEmperor, justiciar: _emptyJusticiar, mother: _emptyMother, ...originalFields } = view;
  return originalFields;
}
function capturedNaturalAnchor(state: SliceState, view: SliceProjection,
  original: { final: SliceState; public: SliceProjection }) {
  return { revision: state.revision,
    privateStateSha256: hangedManNaturalHash(historicalNaturalState(state, Object.keys(original.final))),
    publicStateSha256: hangedManNaturalHash(historicalNaturalPublic(view, state, Object.keys(original.public))),
    random: state.random, randomSha256: hangedManNaturalHash(state.random) };
}

it('audits current-schema initial and terminal snapshots without replay', () => {
  for (const which of ['initial', 'terminal'] as const) {
    const original = readHangedManNaturalSnapshot(which), rawHash = hangedManNaturalHash(original);
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
    expect(hangedManNaturalHash(historicalNaturalState({ ...state, cash: state.cash + 1 }, stateKeys)))
      .not.toBe(original.anchor.privateStateSha256);
    expect(hangedManNaturalHash(historicalNaturalPublic({ ...view, cash: view.cash + 1 }, state, publicKeys)))
      .not.toBe(original.anchor.publicStateSha256);
    expect(hangedManNaturalHash(original)).toBe(rawHash);
  }
}, 180_000);

function unwrap<T>(result: SliceResult<T>): T {
  if (!result.ok) throw Error(result.error.code + ': ' + result.error.message);
  return result.value;
}
function assertPublicControl(view: SliceProjection, row: HangedManNaturalActionRow, previous: SliceIntent | null): void {
  expect(view.status).toBe('ACTIVE'); expect(view.activeEvent).toBeNull(); expect(view.combat).toBeNull();
  const action = row.publicAction;
  expect(action.enabled).toBe(true);
  if ('kind' in action) {
    expect(row.intent).toEqual({ type: 'ACTION', action: action.action });
    expect(action.kind).toBe('ORDINARY_RESOURCE'); expect(action.preferredAction).toBe(false);
    expect(view.canAct).toBe(true); expect(view.hangedMan.guidanceKnown).toBe(false);
    expect(view.darkAngel.insideCase).toBe(false); expect(view.darkAngel.preparedWeek).toBeNull();
    expect(action.publicBudget).toEqual(hangedManNaturalPublicBudget(view));
    expect(['WORK', 'REST']).toContain(action.action); expect(action.rule.length).toBeGreaterThan(0);
    return;
  }
  const { selectionRule, ...control } = action;
  expect(selectionRule.length).toBeGreaterThan(0);
  if (row.intent.type === 'HANGED_MAN') {
    expect(view.hangedMan.actions).toContainEqual(control);
    expect(row.intent.command).toEqual(control.command);
    if (view.hangedMan.guidanceKnown) {
      expect(selectionRule).toBe('EXACT_PUBLIC_PREFERRED');
      expect(view.hangedMan.actions.filter(item => item.preferredAction)).toEqual([control]);
    } else {
      expect(row.intent.command).toEqual({ type: 'LEARN_GUIDANCE' });
      expect(selectionRule).toBe('ACTUAL_S1_HANDOFF_TO_S0_GUIDANCE');
      expect(view.darkAngel.promoted).toBe(true); expect(view.darkAngel.life.reflected).toBe(true);
    }
  } else {
    expect(row.intent.type).toBe('DARK_ANGEL');
    if (row.intent.type !== 'DARK_ANGEL') throw Error('Unknown natural continuation control');
    expect([...view.darkAngel.actions, ...view.darkAngel.life.actions]).toContainEqual(control);
    expect(row.intent.command).toEqual(control.command);
    expect(view.hangedMan.guidanceKnown).toBe(false);
    expect(['REQUEST_SUPPLY', 'RECEIVE_SUPPLY']).not.toContain(row.intent.command.type);
    if (selectionRule === 'EXACT_PUBLIC_S1_LIFE_PREFERRED')
      expect(view.darkAngel.life.preferredActionId).toBe(control.id);
    if (row.intent.command.type === 'CONSUME') {
      expect(selectionRule).toBe('PAID_SUPPORTED_SAME_ORIGINAL_CONSUMPTION');
      expect(view.darkAngel.preparedWeek).toBe(view.week);
      expect(previous).toEqual({ type: 'DARK_ANGEL', command: {
        type: 'STABILIZE_PROMOTION', bottleId: row.intent.command.bottleId,
      } });
    }
  }
}

function verifyLastCommandSave(before: SliceState, state: SliceState, view: SliceProjection, last: HangedManNaturalActionRow): void {
  const directory = mkdtempSync(join(tmpdir(), 'lotm-hanged-man223-natural-')), file = join(directory, 'save.sqlite');
  const importedAt = '2026-10-19T00:00:00.000Z', committedAt = '2026-10-19T00:00:01.000Z';
  const request: SliceEnvelope = { intentId: 'hanged-man223-natural-last', runId: before.runId,
    expectedRevision: before.revision, payload: last.intent };
  const requestHash = hangedManNaturalHash(request);
  const inspect = () => {
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      const runs = db.prepare('SELECT * FROM slice_runs ORDER BY id').all();
      const raw = String(runs.find(row => row.id === state.runId)!.current_json);
      const hash = (path: string) => existsSync(path) ? hangedManNaturalSha(readFileSync(path)) : null;
      return { raw, stored: JSON.parse(JSON.parse(raw).payload) as StoredSlice,
        durable: hangedManNaturalHash({ runs, receipts: db.prepare('SELECT * FROM slice_receipts ORDER BY id').all(),
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
      if (fail) throw Error('Injected last natural HangedMan command write failure');
    } });
    store.repository.transaction(() => {
      store!.repository.put({ state: before, updatedAt: importedAt });
      store!.repository.selectRun('previous-selected-slot');
    });
    publishedRevision = store.repository.ownedHead(before.runId)?.revision ?? null;
    if (before.hangedMan.guidanceKnown) expect(publishedRevision).toBe(before.revision);
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
    expect(hangedManNaturalHash(request)).toBe(requestHash);
    expect(store.repository.activeRun()).toBe(before.runId);
    const committed = inspect();
    expect(committed.stored).toEqual({ state, updatedAt: committedAt });
    expect(committed.stored.state.random).toEqual(last.after.random);
    expect(hangedManNaturalReceipt(committed.stored.state, before)).toEqual(last.receipt);
    expect(unwrap(store.submitIntent(request))).toEqual({ ...receipt, replayed: true });
    expect(attempts).toBe(2); expect(inspect().raw).toBe(committed.raw);
    store.close(); store = undefined;

    store = new SqliteSliceStore(file, { now: () => committedAt });
    expect(unwrap(store.loadRun(state.runId))).toEqual(view);
    expect(unwrap(store.getBootstrap()).activeState).toEqual(view);
    expect(unwrap(store.submitIntent(request))).toEqual({ ...receipt, replayed: true });
    if (state.status === 'DEAD') {
      expect(store.submitIntent({ ...request, intentId: 'hanged-man223-after-death', expectedRevision: state.revision }))
        .toMatchObject({ ok: false, error: { code: 'ARCHIVED' } });
      expect(JSON.parse(readFileSync(file + '.sealed', 'utf8'))).toContain(state.runId);
    }
    expect(inspect().raw).toBe(committed.raw);
    expect(inspect().stored).toEqual(committed.stored);
    if (state.hangedMan.guidanceKnown) expect(store.repository.ownedHead(state.runId)?.revision).toBe(state.revision);
  } finally { store?.close(); rmSync(directory, { recursive: true, force: true }); }
}

it('verifies every actual new private/public/RNG boundary and the real terminal, then faults/retries/reopens its last command once', () => {
  const summary = readHangedManNaturalSummary(), source = readHangedManNaturalSource();
  const archive = readHangedManNaturalArchive(), initial = readHangedManNaturalSnapshot('initial');
  const rows = readHangedManNaturalRows();
  assertHangedManNaturalRetainedFreeze(summary);
  expect(rows).toHaveLength(summary.commandCount);
  let previous: string | null = null;
  for (const [index, row] of rows.entries()) {
    const { rowSha256, ...payload } = row;
    expect(rowSha256, `row ${index + 1}`).toBe(hangedManNaturalHash(payload));
    expect(row.commandSha256).toBe(hangedManNaturalHash(row.intent));
    expect(row.commandCount).toBe(index + 1); expect(row.previousRowSha256).toBe(previous);
    if (index < 723) {
      expect(row.kind).toBe('HISTORICAL_COMMAND'); expect(row.intent).toEqual(archive.commands[index]);
    }
    previous = rowSha256;
  }
  let state = migrateSliceState(structuredClone(source)), view = projectSliceState(state);
  expect(state.hangedMan.guidanceKnown).toBe(false);
  expect(state.hangedMan.source).toBeNull(); expect(state.hangedMan.journal).toEqual([]);
  for (const [key, value] of Object.entries(source)) if (!['schemaVersion', 'contentVersion'].includes(key))
    expect(state[key as keyof SliceState], `original migration root ${key}`).toEqual(value);
  expect(historicalNaturalState(state, Object.keys(initial.final))).toEqual(initial.final);
  expect(historicalNaturalPublic(view, state, Object.keys(initial.public))).toEqual(initial.public);
  let anchor = capturedNaturalAnchor(state, view, initial), before = state;
  expect(anchor).toEqual(initial.anchor);
  const actions = rows.slice(723) as HangedManNaturalActionRow[];
  let session: HangedManRuntimeSession | undefined, previousIntent: SliceIntent | null = null;
  let predecessorFreeze: typeof summary.predecessorFreeze = null;
  for (const [index, row] of actions.entries()) {
    expect(row.kind).toBe('HANGED_MAN_CONTINUATION_ACTION'); expect(row.newCount).toBe(index + 1);
    expect(row.before, `before command ${row.commandCount}`).toEqual(anchor);
    expect(row.after.revision).toBe(724 + row.newCount);
    assertPublicControl(view, row, previousIntent);
    before = state;
    if (session) {
      const draft = session.prepare(row.intent, state.revision);
      expect(session.inspect().revision).toBe(state.revision);
      session.commit(draft); state = session.snapshot();
    } else {
      state = applySliceIntent(state, row.intent);
      if (state.hangedMan.guidanceKnown) {
        expect(row.intent).toEqual({ type: 'HANGED_MAN', command: { type: 'LEARN_GUIDANCE' } });
        session = openHangedManRuntimeSession(state);
        predecessorFreeze = { revision: state.hangedMan.source!.revision,
          roots: Object.fromEntries(HANGED_MAN223_FROZEN_ROOTS.map(key => [key, hangedManNaturalHash(state[key])])) };
      }
    }
    view = session ? session.project() : projectSliceState(state);
    expect(row.receipt).toEqual(hangedManNaturalReceipt(state, before));
    expect(row.actual).toEqual(hangedManNaturalOutcome(state));
    expect(state.random.seed).toBe(source.random.seed); expect(state.random.cursor).toBeGreaterThanOrEqual(before.random.cursor);
    anchor = capturedNaturalAnchor(state, view, initial);
    expect(anchor, `after command ${row.commandCount}`).toEqual(row.after);
    previousIntent = row.intent;
  }
  const terminal = readHangedManNaturalSnapshot('terminal');
  expect(historicalNaturalState(state, Object.keys(terminal.final))).toEqual(terminal.final);
  expect(historicalNaturalPublic(view, state, Object.keys(terminal.public))).toEqual(terminal.public);
  expect(state.revision).toBe(summary.revision); expect(hangedManNaturalOutcome(state)).toEqual(summary.actual);
  expect(predecessorFreeze).toEqual(summary.predecessorFreeze);
  for (const key of [...HANGED_MAN223_FROZEN_ROOTS.filter(key => key !== 'darkAngel'), 'world', 'combatHistory'] as const)
    expect(state[key], `original ${key}`).toEqual(source[key]);
  const prior = source.darkAngel, current = state.darkAngel;
  expect(current.sourceHistory).toEqual(prior.sourceHistory); expect(current.sourceScene).toEqual(prior.sourceScene);
  expect(current.bottles.slice(0, 3)).toEqual(prior.bottles);
  for (const bottle of current.bottles.slice(3)) expect(bottle.recovery?.originalBottleId).toBe('dark-angel-potion-3');
  const originals = resolveDarkAngelOriginalsSnapshot(current);
  expect(originals).not.toBeNull();
  expect(originals!.characteristics.map(item => item.originalBottleId).sort()).toEqual([
    'dark-angel-potion-1', 'dark-angel-potion-2', 'dark-angel-potion-3',
  ]);
  expect(new Set(originals!.characteristics.map(item => item.characteristicId)).size).toBe(3);
  if (summary.actual.s1Promoted) expect(originals!.embodiedOriginalBottleId).toBe('dark-angel-potion-3');
  if (state.hangedMan.guidanceKnown) {
    expect(state.hangedMan.source!.originalCharacteristics).toEqual(originals);
    expect(state.hangedMan.source!.originals.site).toEqual(getDarkAngelCurrentSite(state));
    expect(state.hangedMan.source!.originals.operation).toEqual(current.life.operation);
    expect(state.hangedMan.materials!.originals.map(item => item.originalId).sort()).toEqual([
      'dark-angel-potion-1', 'dark-angel-potion-2', 'dark-angel-potion-3',
    ]);
    expect(current.life.reflected).toBe(true);
    for (const caseId of DARK_ANGEL_CASE_IDS) {
      expect(current.life.cases[caseId]).toMatchObject({ status: 'RESOLVED', returned: true, contactOpen: false });
      expect(current.life.journal.some(event => event.command.type === 'REPORT' && event.command.caseId === caseId)).toBe(true);
    }
    expect(current.life.journal.some(event => event.command.type === 'REFLECT')).toBe(true);
  }
  expect(current.acquisitionJournal.slice(0, prior.acquisitionJournal.length)).toEqual(prior.acquisitionJournal);
  expect(current.life.journal.slice(0, prior.life.journal.length)).toEqual(prior.life.journal);
  if (predecessorFreeze) for (const key of HANGED_MAN223_FROZEN_ROOTS)
    expect(hangedManNaturalHash(state[key]), `post-guidance frozen ${key}`).toBe(predecessorFreeze.roots[key]);
  expect([0, 1, 2]).toContain(state.progression.sequence);
  // S1 adds the actual +1; this S0 engine does not add another increment.
  const character = structuredClone(source.character), promotions = state.progression.sequence < 2 ? 1 : 0;
  for (const key of Object.keys(character.coreStats) as (keyof typeof character.coreStats)[])
    character.coreStats[key] = Math.min(500, character.coreStats[key] + promotions);
  expect(state.character).toEqual(character);
  for (const [id, mastery] of Object.entries(source.progression.mastery)) expect(state.progression.mastery[id]).toBe(mastery);
  expect(Object.keys(state.progression.mastery).sort()).toEqual([...Object.keys(source.progression.mastery),
    ...(summary.actual.s1Promoted ? DARK_ANGEL_ABILITY_IDS : []), ...(summary.actual.promoted ? HANGED_MAN_ABILITY_IDS : [])].sort());
  for (const [index, id] of HANGED_MAN_ABILITY_IDS.entries()) {
    const applied = index === 0 ? summary.actual.pressureApplied : summary.actual.cooperativeSealApplied;
    expect(state.progression.mastery[id]).toBe(summary.actual.promoted ? applied ? 8 : 0 : undefined);
  }
  if (state.status === 'DEAD') {
    expect(summary.stage).toBe('NATURAL_DEATH'); expect(state.ending?.kind).toBe('DEATH'); expect(view.canAct).toBe(false);
  } else {
    expect(state.status).toBe('ACTIVE');
    expect(summary.stage).toBe('NATURAL_S0_RETURN_REPORTED');
    expect(summary.actual).toMatchObject({ s1Promoted: true, s1Reflected: true, promoted: true,
      reported: true, ordinaryExit: true, returnedHome: true, scenePhase: 'PRACTICE' });
    expect(state.hangedMan.scene).toMatchObject({ playerPosition: 'OUTSIDE', contact: false, window: null,
      segments: { A: { open: false }, B: { open: false } }, exit: { door: 'CLOSED' } });
    expect(state.hangedMan.scene!.workers).toHaveLength(2);
    for (const worker of state.hangedMan.scene!.workers) {
      expect(worker.position).toBe('OUTSIDE');
      expect(worker.passage.a).toBeTruthy(); expect(worker.passage.b).toBeTruthy(); expect(worker.passage.exit).toBeTruthy();
    }
    expect(view.hangedMan.actions.some(action => action.preferredAction)).toBe(false);
  }
  expect(hangedManNaturalHash(source)).toBe(HANGED_MAN223_SOURCE_STATE_SHA);
  // Reuse the penultimate state from this replay, never regenerate it or replay old723.
  verifyLastCommandSave(before, state, view, actions.at(-1)!);
}, 900_000);
