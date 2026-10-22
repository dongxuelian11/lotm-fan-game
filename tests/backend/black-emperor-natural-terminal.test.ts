/** One complete new-command replay and one actual terminal-command SQLite fault/retry/reopen.
 * Original924 are integrity-checked only; no historical replay, controlled draw, or extra route. */
import { expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { StoredSlice } from '../../src/application/slice-application.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { openBlackEmperorRuntimeSession, type BlackEmperorRuntimeSession } from '../../src/domain/black-emperor/owned-session.js';
import { BLACK_EMPEROR_ABILITY_IDS, BLACK_EMPEROR_ORIGINAL_IDS } from '../../src/domain/black-emperor/content.js';
import { getPrinceOfAbolitionCurrentSite } from '../../src/domain/prince-of-abolition/life.js';
import { createBlackEmperorState } from '../../src/domain/black-emperor/index.js';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import type { SliceEnvelope, SliceResult } from '../../src/shared/slice-contracts.js';
import {
  BLACK_EMPEROR227_FROZEN_ROOTS, BLACK_EMPEROR227_PREFIX_COUNT, BLACK_EMPEROR227_SOURCE_REVISION, BLACK_EMPEROR227_SOURCE_STATE_SHA, assertBlackEmperorNaturalRetainedFreeze, assertBlackEmperorNaturalPublic,
  blackEmperorNaturalHash, blackEmperorNaturalOutcome, blackEmperorNaturalReceipt, blackEmperorNaturalSha,
  readBlackEmperorNaturalRows, readBlackEmperorNaturalSnapshot, readBlackEmperorNaturalSource, readBlackEmperorNaturalSummary,
  type BlackEmperorNaturalActionRow,
} from '../helpers/black-emperor-natural-capture.js';

import assert from 'node:assert/strict';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { assertEmptyJusticiarState, assertEmptyJusticiarPublic } from '../helpers/empty-justiciar-capture.js';
import { assertEmptyMotherState, assertEmptyMotherPublic } from '../helpers/empty-mother-capture.js';

/** Raw224 captures stay immutable. Only these named, exactly empty later roots
 * and format metadata are removed from detached historical hash views. */
const LATER_EMPTY_ROOTS = ['justiciar', 'mother'] as const;
function historicalNaturalState(state: SliceState, originalKeys: readonly string[]) {
  assert.deepEqual([state.schemaVersion, state.contentVersion], [CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  for (const root of LATER_EMPTY_ROOTS) assert.equal(originalKeys.includes(root), false);
  assert.deepEqual(Object.keys(state).sort(), [...originalKeys, ...LATER_EMPTY_ROOTS].sort());
  assertEmptyJusticiarState(state);
  assertEmptyMotherState(state);
  const { justiciar: _emptyJusticiar, mother: _emptyMother, ...originalFields } = state;
  return { ...originalFields, schemaVersion: 224, contentVersion: 'black-emperor-v224' };
}
function historicalNaturalPublic(view: SliceProjection, state: SliceState, originalKeys: readonly string[]) {
  for (const root of LATER_EMPTY_ROOTS) assert.equal(originalKeys.includes(root), false);
  assert.deepEqual(Object.keys(view).sort(), [...originalKeys, ...LATER_EMPTY_ROOTS].sort());
  assertEmptyJusticiarState(state);
  assertEmptyMotherState(state);
  assertEmptyJusticiarPublic(view, state);
  assertEmptyMotherPublic(view, state);
  const { justiciar: _emptyJusticiar, mother: _emptyMother, ...originalFields } = view;
  return originalFields;
}
function capturedNaturalAnchor(state: SliceState, view: SliceProjection,
  original: { final: SliceState; public: SliceProjection }) {
  return { revision: state.revision, week: state.week,
    privateStateSha256: blackEmperorNaturalHash(historicalNaturalState(state, Object.keys(original.final))),
    publicStateSha256: blackEmperorNaturalHash(historicalNaturalPublic(view, state, Object.keys(original.public))),
    random: state.random, randomSha256: blackEmperorNaturalHash(state.random) };
}

it('audits current-schema initial and terminal snapshots without replay', () => {
  for (const which of ['initial', 'terminal'] as const) {
    const original = readBlackEmperorNaturalSnapshot(which), rawHash = blackEmperorNaturalHash(original);
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
    expect(blackEmperorNaturalHash(historicalNaturalState({ ...state, cash: state.cash + 1 }, stateKeys)))
      .not.toBe(original.anchor.privateStateSha256);
    expect(blackEmperorNaturalHash(historicalNaturalPublic({ ...view, cash: view.cash + 1 }, state, publicKeys)))
      .not.toBe(original.anchor.publicStateSha256);
    expect(blackEmperorNaturalHash(original)).toBe(rawHash);
  }
}, 180_000);

function unwrap<T>(result: SliceResult<T>): T {
  if (!result.ok) throw Error(result.error.code + ': ' + result.error.message);
  return result.value;
}

function verifyLastCommandSave(before: SliceState, state: SliceState, view: SliceProjection, last: BlackEmperorNaturalActionRow): void {
  const directory = mkdtempSync(join(tmpdir(), 'lotm-black-emperor227-natural-')), file = join(directory, 'save.sqlite');
  const importedAt = '2026-10-19T00:00:00.000Z', committedAt = '2026-10-19T00:00:01.000Z';
  const request: SliceEnvelope = { intentId: 'black-emperor227-natural-last', runId: before.runId,
    expectedRevision: before.revision, payload: last.intent };
  expect(last.after.revision).toBe(state.revision); expect(last.before.revision).toBe(before.revision);
  expect(last.commandCount).toBe(1014);
  expect(last.intent).toEqual({ type: 'BLACK_EMPEROR', command: { type: 'REPORT_RETURN' } });
  const requestHash = blackEmperorNaturalHash(request);
  const inspect = () => {
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      const runs = db.prepare('SELECT * FROM slice_runs ORDER BY id').all();
      const raw = String(runs.find(row => row.id === state.runId)!.current_json);
      const hash = (path: string) => existsSync(path) ? blackEmperorNaturalSha(readFileSync(path)) : null;
      return { raw, stored: JSON.parse(JSON.parse(raw).payload) as StoredSlice,
        durable: blackEmperorNaturalHash({ runs, receipts: db.prepare('SELECT * FROM slice_receipts ORDER BY id').all(),
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
      if (fail) throw Error('Injected last natural BlackEmperor command write failure');
    } });
    store.repository.transaction(() => {
      store!.repository.put({ state: before, updatedAt: importedAt });
      store!.repository.selectRun('previous-selected-slot');
    });
    publishedRevision = store.repository.ownedHead(before.runId)?.revision ?? null;
    if (before.blackEmperor.guidanceKnown) expect(publishedRevision).toBe(before.revision);
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
    expect(blackEmperorNaturalHash(request)).toBe(requestHash);
    expect(store.repository.activeRun()).toBe(before.runId);
    const committed = inspect();
    expect(committed.stored).toEqual({ state, updatedAt: committedAt });
    expect(committed.stored.state.random).toEqual(last.after.random);
    expect(blackEmperorNaturalReceipt(committed.stored.state, before)).toEqual(last.receipt);
    expect(unwrap(store.submitIntent(request))).toEqual({ ...receipt, replayed: true });
    expect(attempts).toBe(2); expect(inspect().raw).toBe(committed.raw);
    store.close(); store = undefined;

    store = new SqliteSliceStore(file, { now: () => committedAt });
    expect(unwrap(store.loadRun(state.runId))).toEqual(view);
    expect(unwrap(store.getBootstrap()).activeState).toEqual(view);
    expect(unwrap(store.submitIntent(request))).toEqual({ ...receipt, replayed: true });
    expect(inspect().raw).toBe(committed.raw);
    expect(inspect().stored).toEqual(committed.stored);
    if (state.blackEmperor.guidanceKnown) expect(store.repository.ownedHead(state.runId)?.revision).toBe(state.revision);
  } finally { store?.close(); rmSync(directory, { recursive: true, force: true }); }
}

it('replays only actual new BlackEmperor commands with exact private/public/RNG hashes, then faults/retries/reopens the last save', () => {
  const summary = readBlackEmperorNaturalSummary(), archive = readBlackEmperorNaturalSource(), source = archive.final;
  const initial = readBlackEmperorNaturalSnapshot('initial'), rows = readBlackEmperorNaturalRows();
  assertBlackEmperorNaturalRetainedFreeze(summary);
  expect(rows).toHaveLength(summary.commandCount);
  let previous: string | null = null;
  for (const [index, row] of rows.entries()) {
    const { rowSha256, ...payload } = row;
    expect(rowSha256, `row ${index + 1}`).toBe(blackEmperorNaturalHash(payload));
    expect(row.commandSha256).toBe(blackEmperorNaturalHash(row.intent));
    expect(row.commandCount).toBe(index + 1); expect(row.previousRowSha256).toBe(previous);
    if (index < BLACK_EMPEROR227_PREFIX_COUNT) {
      expect(row.kind).toBe('HISTORICAL_COMMAND'); expect(row.intent).toEqual(archive.commands[index]);
    }
    previous = rowSha256;
  }
  let state = migrateSliceState(structuredClone(source)), view = projectSliceState(state);
  for (const [key, value] of Object.entries(source)) if (!['schemaVersion', 'contentVersion'].includes(key))
    expect(state[key as keyof SliceState], `original migration root ${key}`).toEqual(value);
  expect(historicalNaturalState(state, Object.keys(initial.final))).toEqual(initial.final);
  expect(historicalNaturalPublic(view, state, Object.keys(initial.public))).toEqual(initial.public);
  expect(state.blackEmperor).toEqual(createBlackEmperorState());
  let anchor = capturedNaturalAnchor(state, view, initial), before = state;
  expect(anchor).toEqual(initial.anchor);
  const actions = rows.slice(BLACK_EMPEROR227_PREFIX_COUNT) as BlackEmperorNaturalActionRow[];
  expect(actions).toHaveLength(summary.newCount);
  let session: BlackEmperorRuntimeSession | undefined;
  for (const [index, row] of actions.entries()) {
    expect(row.kind).toBe('BLACK_EMPEROR_ACTION'); expect(row.newCount).toBe(index + 1);
    expect(row.before, `before command ${row.commandCount}`).toEqual(anchor);
    expect(row.after.revision).toBe(BLACK_EMPEROR227_SOURCE_REVISION + row.newCount);
    expect(view.status).toBe('ACTIVE'); expect(view.activeEvent).toBeNull(); expect(view.combat).toBeNull();
    expect(view.blackEmperor.actions.filter(action => action.preferredAction)).toEqual([row.publicAction]);
    expect(row.publicAction.enabled).toBe(true); expect(row.intent).toEqual({ type: 'BLACK_EMPEROR', command: row.publicAction.command });
    before = state;
    if (!session) {
      expect(index).toBe(0); expect(row.intent).toEqual({ type: 'BLACK_EMPEROR', command: { type: 'LEARN_GUIDANCE' } });
      state = applySliceIntent(state, row.intent); session = openBlackEmperorRuntimeSession(state);
    } else {
      const draft = session.prepare(row.intent, state.revision);
      expect(session.inspect().revision).toBe(state.revision);
      session.commit(draft); state = session.snapshot();
    }
    view = session.project();
    expect(row.receipt).toEqual(blackEmperorNaturalReceipt(state, before));
    expect(row.actual).toEqual(blackEmperorNaturalOutcome(state));
    expect(Number.isSafeInteger(row.elapsedWeeks)).toBe(true); expect(row.elapsedWeeks).toBeGreaterThanOrEqual(0);
    expect(row.elapsedWeeks).toBe(state.week - before.week);
    expect(state.random.seed).toBe(source.random.seed); expect(state.random.cursor).toBeGreaterThanOrEqual(before.random.cursor);
    anchor = capturedNaturalAnchor(state, view, initial);
    expect(anchor, `after command ${row.commandCount}`).toEqual(row.after);
  }
  const terminal = readBlackEmperorNaturalSnapshot('terminal');
  assertValidSliceState(state);
  expect(historicalNaturalState(state, Object.keys(terminal.final))).toEqual(terminal.final);
  expect(historicalNaturalPublic(view, state, Object.keys(terminal.public))).toEqual(terminal.public);
  expect(state.revision).toBe(summary.revision); expect(blackEmperorNaturalOutcome(state)).toEqual(summary.actual);
  // Observations pinned after completion, never preselected natural outcomes.
  expect(state).toMatchObject({ revision: 1015, status: 'ACTIVE', week: 261, health: 88, mind: 51,
    spirituality: 43, cash: 30, actionsRemaining: 0, injuries: [],
    progression: { pathwayId: 'black-emperor', sequence: 0 }, random: { seed: source.random.seed, cursor: 330 } });
  expect(summary.actual).toMatchObject({ phase: 'PRACTICE', sceneStatus: 'COMPLETED', originalDepartureRecorded: false,
    realmFounded: true, population: 90000, completedTombs: 9, festivalCities: 3, festivalParticipants: 72000,
    constructionBatches: 9, constructionWeeks: 27, orderDistortionApplied: true, delayedImpactApplied: true });
  expect(state.blackEmperor.journal.flatMap(event => event.randomReceipts
    .map(({ check }) => [event.revision - 1, check.chance, check.roll, check.tier])))
    .toEqual([[944, 38, 47, 'FAILURE'], [947, 38, 28, 'SUCCESS'], [955, 38, 9, 'SUCCESS'],
      [961, 82, 42, 'SUCCESS'], [977, 82, 23, 'SUCCESS'], [979, 82, 99, 'GREAT_FAILURE'],
      [981, 82, 18, 'SUCCESS'], [983, 82, 61, 'SUCCESS'], [984, 82, 80, 'SUCCESS'],
      [986, 82, 23, 'SUCCESS'], [987, 82, 42, 'SUCCESS'], [989, 82, 85, 'FAILURE'],
      [997, 70, 4, 'GREAT_SUCCESS'], [1007, 70, 51, 'SUCCESS'], [1009, 70, 70, 'SUCCESS']]);
  assertBlackEmperorNaturalPublic(view);
  const publicText = JSON.stringify(view);
  for (const secret of [state.random.seed, state.blackEmperor.source!.actorId, state.blackEmperor.source!.historyDigest,
    ...state.blackEmperor.scene!.realm.cities.flatMap(city => city.tombs.map(tomb => tomb.privateSite))])
    expect(publicText).not.toContain(secret);
  expect(anchor.privateStateSha256).toBe(summary.finalPrivateStateSha256);
  expect(anchor.publicStateSha256).toBe(summary.finalWholePublicSha256);
  for (const key of BLACK_EMPEROR227_FROZEN_ROOTS) expect(state[key], `original ${key}`).toEqual(source[key]);
  for (const [id, mastery] of Object.entries(source.progression.mastery)) expect(state.progression.mastery[id]).toBe(mastery);
  const root = state.blackEmperor, inherited = root.source!;
  expect(inherited).toMatchObject({ runId: source.runId, revision: source.revision,
    character: source.character, random: source.random });
  expect(inherited.budget.mastery).toEqual(source.progression.mastery);
  expect(inherited.acquisition).toEqual({ bottles: source.princeOfAbolition.bottles, resupply: source.princeOfAbolition.resupply,
    acquisitionJournal: source.princeOfAbolition.acquisitionJournal, promotionWeek: source.princeOfAbolition.promotionWeek });
  expect(inherited.originals.site).toEqual(getPrinceOfAbolitionCurrentSite(source));
  expect(inherited.originals.operation).toEqual(source.princeOfAbolition.life.operation);
  if (root.materials) {
    expect(root.materials.originals.map(item => item.originalId).sort()).toEqual([...BLACK_EMPEROR_ORIGINAL_IDS].sort());
    for (const original of root.materials.originals) {
      const prior = inherited.originalCharacteristics.characteristics.find(item => item.originalBottleId === original.originalId)!;
      expect(original.characteristicId).toBe(prior.characteristicId); expect(original.latestBottleId).toBe(prior.latestBottleId);
    }
  }
  expect(state.progression.pathwayId).toBe('black-emperor');
  expect(state.progression.sequence).toBe(summary.actual.sequence);
  if (summary.actual.promoted) {
    expect(Object.keys(state.progression.mastery).sort())
      .toEqual([...Object.keys(source.progression.mastery), ...BLACK_EMPEROR_ABILITY_IDS].sort());
    expect(root.materials?.compounds.some(item => item.status === 'SUCCESS')).toBe(true);
    for (const id of BLACK_EMPEROR_ABILITY_IDS) expect(state.progression.mastery[id]).toBe(8);
  } else expect(Object.keys(state.progression.mastery).sort()).toEqual(Object.keys(source.progression.mastery).sort());
  if (state.status === 'DEAD') {
    expect(summary.stage).toBe('NATURAL_DEATH'); expect(state.ending?.kind).toBe('DEATH');
    expect(view.canAct).toBe(false); expect(view.blackEmperor.actions.every(action => !action.enabled)).toBe(true);
  } else {
    expect(state.status).toBe('ACTIVE'); expect(state.ending).toBeNull();
    expect(summary.actual).toMatchObject({ reported: true, ordinaryExit: true, exitClosed: true });
    expect(root.scene).toMatchObject({ playerPosition: 'OUTSIDE', contact: false, window: null, exit: { door: 'CLOSED' } });
    expect(view.blackEmperor.actions.some(action => action.preferredAction)).toBe(false);
  }
  const scene = root.scene!, tombs = scene.realm.cities.flatMap(city => city.tombs);
  expect(scene.constructionReceipts).toHaveLength(9);
  expect(scene.constructionReceipts.filter(item => item.damagedTombId).map(item => item.damagedTombId))
    .toEqual(['BE227-NORTH-TOMB-1', 'BE227-SOUTH-TOMB-1']);
  for (const batch of scene.constructionReceipts) {
    expect(batch.endWeek - batch.startWeek).toBe(3); expect(batch.weeks).toBe(3);
    expect(batch).toMatchObject({ personalCost: 90, treasury: 450, stone: 180, timber: 90, labourDays: 2160 });
  }
  expect(tombs).toHaveLength(9); expect(tombs.filter(tomb => tomb.repairEvents.length)).toHaveLength(2);
  for (const tomb of tombs) expect(tomb).toMatchObject({ stage: 3, integrity: 100,
    structure: 'PYRAMIDAL', access: 'CLOSED_CONSTRUCTION', publicCoordinatesDisclosed: false });
  expect(scene.facility).toMatchObject({ currentPath: 'SIDE', pendingLoad: false, pendingImpact: false,
    stopped: true, loadSecured: true, contestingLatch: 'LOCKED', delayApplied: true, impactDamage: 0 });
  for (const worker of scene.workers) {
    expect(worker).toMatchObject({ health: 100, position: 'OUTSIDE', consent: 'CLOSED' });
    expect(worker.exitEventId).toBeTruthy();
  }
  expect(blackEmperorNaturalHash(source)).toBe(BLACK_EMPEROR227_SOURCE_STATE_SHA);
  // Reuse this replay's real penultimate state. No original924 replay or extra route.
  verifyLastCommandSave(before, state, view, actions.at(-1)!);
}, 900_000);
