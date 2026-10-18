import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applySliceIntent, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { openDarknessRuntimeSession, type DarknessRuntimeSession } from '../../src/domain/darkness/owned-session.js';
import { DARKNESS_FROZEN_SOURCE_KEYS } from '../../src/domain/darkness/source.js';
import {
  INPUT_MANIFEST, NEW_COMMANDS, PINS, PREFIX, actualReceipts, assertCaptureFreeze, assertCaptureManifest,
  assertGlobalPublic, assertPublicAction, authenticateInputs, bytes, capturePublic, compactHash, hash, json,
  historicalDarknessPublic, historicalDarknessState, loadCapture, migrateCapturedDarknessState, outcome, readBoundary, same,
  type Boundary, type HistoricalDarknessState, type Freeze, type LoadedCapture, type Manifest,
} from '../helpers/darkness-capture.js';

/** Exactly155 NEW commands once across four contiguous, disjoint blocks.
 * Original679 and the separate694 death are authenticated, never replayed.
 * Guidance680 uses the public ingress;681..834 use owned drafts/commits.
 * Strict validation occurs at captured block boundaries, not every turn.
 * No producer import, outcome search, fixture editing, RNG mock or test skip. */
const BLOCKS = [[680, 718, 39], [719, 753, 35], [754, 805, 52], [806, 834, 29]] as const;
const BLOCK_BUDGET_MS = 180_000;
let data: LoadedCapture;
beforeAll(() => { data = loadCapture(); }, 180_000);
afterAll(() => { authenticateInputs(); }, 180_000);
function boundaryAt(count: number): Boundary {
  const item = data.checkpoint.boundaries.find(boundary => boundary.commandCount === count);
  expect(item, `Authenticated boundary ${count}`).toBeDefined();
  return readBoundary(item!, data.rows[count - PREFIX - 1]!);
}
function checkedPublic(projection: SliceProjection, state: SliceState) {
  assertGlobalPublic(projection, state); return capturePublic(projection);
}
function preserveOriginal(state: SliceState | HistoricalDarknessState, before: SliceState | HistoricalDarknessState): void {
  const original = data.original;
  expect(state.runId).toBe(original.runId); expect(state.random.seed).toBe(original.random.seed);
  same(state.character, original.character, 'The exact original identity, wages and abilities remain');
  for (const key of [...DARKNESS_FROZEN_SOURCE_KEYS, 'world', 'combatHistory'] as const)
    same(state[key], original[key], `Original679 ${key} changed`);
  for (const [id, mastery] of Object.entries(original.progression.mastery)) expect(state.progression.mastery[id], id).toBe(mastery);
  expect(state.combat).toBeNull(); expect(state.activeEvent).toBeNull();
  if (before.darkness.guidanceKnown) same(state.darkness.source, before.darkness.source, 'The same actual S1 handoff stays sealed');
}

describe('Darkness213 complete immutable natural capture', () => {
  it('authenticates all34 files, all22 indexed boundaries, original679 and independent694 death', () => {
    const { checkpoint: cp, original, archived, rows } = data;
    expect(cp.commandCount).toBe(834); expect(rows).toHaveLength(155); expect(cp.boundaries).toHaveLength(22);
    expect(cp.pending).toBeNull(); expect(cp.terminal).toEqual({ stage: PINS.stage, reason: PINS.reason });
    expect([original.status, original.revision, original.random.cursor]).toEqual(['ACTIVE', 680, 348]);
    expect([archived.final.status, archived.final.revision, archived.final.random.cursor]).toEqual(['DEAD', 695, 444]);
    expect(original.misfortuneKnight.bottles.map(b => [b.id, b.status, b.outcome])).toEqual([1, 2, 3].map(n =>
      [`misfortune-knight-potion-${n}`, 'CONSUMED', n === 3 ? 'SUCCESS' : 'FAILURE']));
    expect(original.misfortuneKnight.acquisitionJournal.filter(event => event.command.type === 'CONSUME')
      .map(event => [event.check!.chance, event.check!.roll, event.check!.tier])).toEqual([[50, 75, 'FAILURE'], [50, 56, 'FAILURE'], [50, 37, 'SUCCESS']]);
    expect(Object.keys(original.progression.mastery)).toHaveLength(20);
    const counts = BLOCKS.flatMap(([first, last, size]) => {
      expect(last - first + 1).toBe(size); return Array.from({ length: size }, (_, index) => first + index);
    });
    expect(counts).toEqual(rows.map(row => row.commandCount)); expect(new Set(counts).size).toBe(NEW_COMMANDS);
  });

  it('removes Death only after exact private and public default verification', () => {
    const state = data.initial, expected = historicalDarknessState(state);
    const { death: _missingDeath, ...missing } = state;
    expect(() => historicalDarknessState(missing as SliceState)).toThrow();
    for (const death of [null, { ...state.death, guidanceKnown: true },
      { ...state.death, unexpectedField: undefined }])
      expect(() => historicalDarknessState({ ...state, death } as SliceState)).toThrow();
    expect(() => migrateCapturedDarknessState({ ...expected, death: state.death } as HistoricalDarknessState)).toThrow();
    expect(hash(historicalDarknessState({ ...state, unknownRoot: null } as SliceState))).not.toBe(hash(expected));
    const projection = projectSliceState(state), historical = historicalDarknessPublic(projection, state);
    expect(Object.hasOwn(historical, 'death')).toBe(false);
    const { death: _missingDeathPublic, ...missingPublic } = projection;
    expect(() => historicalDarknessPublic(missingPublic as SliceProjection, state)).toThrow();
    for (const death of [null, { ...projection.death, promoted: true },
      { ...projection.death, unexpectedField: undefined }])
      expect(() => historicalDarknessPublic({ ...projection, death } as SliceProjection, state)).toThrow();
    expect(hash(historicalDarknessPublic({ ...projection, unknownRoot: null } as SliceProjection, state)))
      .not.toBe(hash(historical));
  });

  it('rejects missing, additional or rewritten historical evidence without modifying inputs', () => {
    const manifest = JSON.parse(bytes(INPUT_MANIFEST).toString('utf8')) as Manifest;
    const names = manifest.files.map(item => item.file), beforeManifest = hash(manifest);
    expect(() => assertCaptureManifest(manifest, names)).not.toThrow();
    expect(() => assertCaptureManifest(manifest, names.slice(1))).toThrow();
    expect(() => assertCaptureManifest(manifest, [...names, 'replacement.json'])).toThrow();
    const omitted = structuredClone(manifest); omitted.files.shift();
    expect(() => assertCaptureManifest(omitted, names)).toThrow();
    const duplicate = structuredClone(manifest); duplicate.files[1] = structuredClone(duplicate.files[0]!);
    expect(() => assertCaptureManifest(duplicate, names)).toThrow();
    const freeze = json<Freeze>('runtime-freeze.json'), beforeFreeze = hash(freeze), changed = structuredClone(freeze);
    changed.files[0]!.sha256 = '0'.repeat(64); expect(() => assertCaptureFreeze(changed)).toThrow();
    changed.sha256 = compactHash(changed.files); expect(() => assertCaptureFreeze(changed)).toThrow();
    expect(hash(manifest)).toBe(beforeManifest); expect(hash(freeze)).toBe(beforeFreeze);
  });

  it.each(BLOCKS)('replays only recorded commands %i..%i (%i actions), retaining every complete private/RNG/chapter/global hash', (first, last, size) => {
    let state = first === PREFIX + 1 ? structuredClone(data.initial) : migrateCapturedDarknessState(boundaryAt(first - 1).final);
    // The owned constructor is the strict current ingress for later blocks.
    let session: DarknessRuntimeSession | null = state.darkness.guidanceKnown ? openDarknessRuntimeSession(state) : null;
    let global = session ? session.project() : projectSliceState(state);
    let view = checkedPublic(global, state);
    const rows = data.rows.filter(row => row.commandCount >= first && row.commandCount <= last);
    expect(rows).toHaveLength(size); let prepared = 0, committed = 0;
    for (const row of rows) {
      const before = state;
      expect(hash(historicalDarknessState(before)), `Private before ${row.commandCount}`).toBe(row.beforeStateSha256);
      expect(before.random).toEqual(row.randomBefore); expect(hash(before.random)).toBe(row.randomBeforeSha256);
      expect(hash(view), `Chapter before ${row.commandCount}`).toBe(row.publicBeforeSha256);
      expect(hash(historicalDarknessPublic(global, before)), `Global before ${row.commandCount}`).toBe(row.globalPublicBeforeSha256);
      expect(before.status).toBe('ACTIVE'); expect(validateSlicePayload(row.intent)).toBe(true); assertPublicAction(view, row);
      if (session) {
        const draft = session.prepare(row.intent, before.revision); prepared++;
        state = session.snapshotDraft(draft); global = session.projectDraft(draft); view = checkedPublic(global, state);
        expect(session.inspect()).toEqual({ runId: before.runId, revision: before.revision, status: before.status });
        expect(hash(historicalDarknessState(before)), 'Preparing cannot mutate its predecessor').toBe(row.beforeStateSha256);
        expect(hash(historicalDarknessState(state))).toBe(row.afterStateSha256); expect(hash(historicalDarknessPublic(global, state))).toBe(row.globalPublicAfterSha256);
        session.commit(draft); committed++;
        expect(session.inspect()).toEqual({ runId: state.runId, revision: state.revision, status: state.status });
      } else {
        expect(row.commandCount).toBe(680); expect(row.intent).toEqual({ type: 'DARKNESS', command: { type: 'LEARN_GUIDANCE' } });
        state = applySliceIntent(before, row.intent); session = openDarknessRuntimeSession(state);
        global = session.project(); view = checkedPublic(global, state);
      }
      expect(hash(historicalDarknessState(before)), 'Committing cannot rewrite its predecessor').toBe(row.beforeStateSha256);
      expect(hash(historicalDarknessState(state)), `Private after ${row.commandCount}`).toBe(row.afterStateSha256);
      expect(state.random).toEqual(row.randomAfter); expect(hash(state.random)).toBe(row.randomAfterSha256);
      expect(hash(view), `Chapter after ${row.commandCount}`).toBe(row.publicAfterSha256);
      expect(hash(historicalDarknessPublic(global, state)), `Global after ${row.commandCount}`).toBe(row.globalPublicAfterSha256);
      expect([state.revision, state.week]).toEqual([row.revision, row.week]); expect(state.revision).toBe(before.revision + 1);
      expect(outcome(view)).toEqual(row.selectionOutcome); same(actualReceipts(state, before), row.receipts); preserveOriginal(state, before);
      const item = data.checkpoint.boundaries.find(item => item.commandCount === row.commandCount);
      if (item) { const recorded = readBoundary(item, row); same(recorded.beforeLast, historicalDarknessState(before)); same(recorded.final, historicalDarknessState(state)); same(recorded.public, view); }
    }
    expect(prepared).toBe(size - (first === 680 ? 1 : 0)); expect(committed).toBe(prepared);
    same(session!.snapshot(), state); same(session!.project(), global);
    // One complete strict current ingress at each block end, with exact hashes.
    same(migrateSliceState(state), state);
    const end = boundaryAt(last); same(historicalDarknessState(state), end.final); same(view, end.public);
    if (last === 834) {
      same(historicalDarknessState(state), data.checkpoint.state); same(view, data.summary.public);
      expect(hash(historicalDarknessState(state))).toBe(PINS.finalStateSha256); expect(hash(historicalDarknessPublic(global, state))).toBe(PINS.finalGlobalPublicSha256);
      expect(hash(state.random)).toBe(PINS.finalRandomSha256);
    }
  }, BLOCK_BUDGET_MS);

  it('records the actual first S0 dose, finite failed diversion, ordinary exit, retained injury and zero new mastery', () => {
    const cp = data.checkpoint, initial = data.initial, promoted = boundaryAt(814), final = cp.state;
    const doses = data.rows.filter(row => row.intent.type === 'DARKNESS' && row.intent.command.type === 'CONSUME');
    expect(doses).toHaveLength(1); expect(doses[0]!.commandCount).toBe(814); expect(cp.policy.doses).toBe(1);
    expect(doses[0]!.receipts.checks).toMatchObject([{ cursorBefore: 348, cursorAfter: 349, check: { chance: 70, roll: 50, tier: 'SUCCESS' } }]);
    expect([promoted.beforeLast.progression.sequence, promoted.final.progression.sequence]).toEqual([1, 0]);
    expect(promoted.beforeLast.darkness.promotionStability.preparations).toMatchObject([{ compoundId: 'darkness-compound-1', status: 'READY', week: 189 }]);
    expect(promoted.final.darkness.promotionStability.preparations).toMatchObject([{ compoundId: 'darkness-compound-1', status: 'SPENT', spentEventId: 'R213:sleepless-rebuild-natural:815' }]);
    expect(promoted.final.mind).toBe(promoted.beforeLast.mind - 12);
    expect(final.darkness.materials!.characteristics.map(c => [c.originBottleId, c.latestBottleId, c.holder, c.compoundId])).toEqual([1, 2, 3].map(n =>
      [`misfortune-knight-potion-${n}`, `misfortune-knight-potion-${n}`, 'FUSED', 'darkness-compound-1']));
    expect(final.darkness.materials!.uniqueness).toMatchObject({ id: 'DN0-UNIQUENESS-1', seal: 'DN0-ONE-ORIGINAL-SEAL', holder: 'FUSED', compoundId: 'darkness-compound-1' });
    expect(final.darkness.materials!.compounds).toHaveLength(1);
    expect(final.darkness.materials!.batches.map(b => [b.id, b.status, b.uses])).toEqual([
      ['darkness-carrier-1', 'SPENT', 1], ['darkness-carrier-2', 'SUPPLIER', 0], ['darkness-carrier-3', 'SUPPLIER', 0],
    ]);
    const evacuated = boundaryAt(753).final.darkness.evacuation!;
    same(final.darkness.evacuation, evacuated, 'Later incident cannot reset the original night evacuation');
    expect(evacuated.residents.map(p => [p.id, p.position, p.consent, p.arrival?.eventId])).toEqual([
      ['DN-LENA', 110, 'ACCEPT', 'R213:sleepless-rebuild-natural:719'], ['DN-JONAH', 110, 'ACCEPT', 'R213:sleepless-rebuild-natural:732'],
      ['DN-ADA', 110, 'ACCEPT', 'R213:sleepless-rebuild-natural:743'], ['DN-NOAH', 110, 'ACCEPT', 'R213:sleepless-rebuild-natural:752'],
    ]);
    const epilogue = final.darkness.epilogue!;
    expect(epilogue).toMatchObject({ status: 'RESOLVED', reported: true, position: 0,
      concealment: { attempted: true, passed: true, applied: false, expiresSecond: null },
      diversion: { attempted: true, passed: false, applied: false, expiresSecond: null },
      load: { id: 'DN-LATE-LOOSE-SHUTTER', secured: true, condition: 65, landed: 'NOT_RELEASED' } });
    expect(epilogue.residents.map(p => [p.id, p.position, p.originalArrivalId])).toEqual([
      ['DN-LENA', 0, 'R213:sleepless-rebuild-natural:719'], ['DN-NOAH', 0, 'R213:sleepless-rebuild-natural:752'],
    ]);
    expect(epilogue.journal.map(e => e.command.type)).toEqual(['GO_SHELTER', 'INVITE_RETURN', 'RETURN_RESIDENTS', 'OBSERVE',
      'SHORT_CONCEALMENT', 'BOUNDED_MISFORTUNE_DIVERSION', 'SECURE_LOAD', 'ORDINARY_SIDE_EXIT', 'REPORT']);
    expect(epilogue.journal.filter(e => e.check).map(e => [e.check!.chance, e.check!.roll, e.check!.tier])).toEqual([[82, 31, 'SUCCESS'], [82, 85, 'FAILURE']]);
    const injury = { id: 'R213:sleepless-rebuild-natural:832:darkness-strain', severity: 'LIGHT', acquiredRevision: 832, treatedRevision: null };
    expect(final.injuries).toEqual([injury]); expect([final.health, final.mind, final.spirituality, final.cash, final.injuryRisk]).toEqual([92, 83, 128, 752, 1]);
    expect(boundaryAt(831).final.injuries).toEqual([injury]);
    for (const id of ['darkness.s0.short-concealment', 'darkness.s0.bounded-misfortune-diversion']) {
      expect(Object.hasOwn(initial.progression.mastery, id)).toBe(false);
      expect(promoted.final.progression.mastery[id]).toBe(0); expect(final.progression.mastery[id]).toBe(0);
    }
    expect(final.darkness.journal.flatMap(row => row.randomReceipts).map(r => [r.cursorBefore, r.cursorAfter, r.check.roll])).toEqual([[348, 349, 50], [349, 350, 31], [350, 351, 85]]);
    preserveOriginal(final, promoted.final);
  });
});
