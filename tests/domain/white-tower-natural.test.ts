import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applySliceIntent, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createSunState } from '../../src/domain/sun/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { openWhiteTowerRuntimeSession, type WhiteTowerRuntimeSession } from '../../src/domain/white-tower/owned-session.js';
import { WHITE_TOWER_FROZEN_SOURCE_KEYS } from '../../src/domain/white-tower/source.js';
import {
  INPUT_MANIFEST, NEW_COMMANDS, PINS, PREFIX, actualReceipts, assertCaptureFreeze, assertCaptureManifest,
  assertGlobalPublic, assertPublicAction, authenticateInputs, bytes, capturePublic, compactHash, hash, json,
  historicalWhiteTowerPublic, historicalWhiteTowerState, loadCapture, migrateCapturedWhiteTowerState,
  outcome, readAction, same, type Freeze, type HistoricalWhiteTowerState, type LoadedCapture, type Manifest,
} from '../helpers/white-tower-capture.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';

/** Exactly137 new commands, once, in four contiguous disjoint blocks. Original666
 * is byte-authenticated and admitted through strict migration, never replayed as
 * another historical command loop. Every actual action has its own full capture.
 * Guidance uses normal ingress; all later turns use real owned drafts/commits. */
const BLOCKS = [[667, 700, 34], [701, 735, 35], [736, 774, 39], [775, 803, 29]] as const;
let data: LoadedCapture;
beforeAll(() => { data = loadCapture(); }, 180_000);
afterAll(() => { authenticateInputs(); }, 180_000);
const actionAt = (count: number) => readAction(data.rows[count - PREFIX - 1]!);
function preserveOriginal(state: SliceState | HistoricalWhiteTowerState): void {
  const original = data.original;
  expect(state.runId).toBe(original.runId); expect(state.random.seed).toBe(original.random.seed);
  same(state.character, original.character);
  for (const key of [...WHITE_TOWER_FROZEN_SOURCE_KEYS, 'world', 'combatHistory'] as const)
    same(state[key], original[key], `Complete original666 ${key} changed`);
  for (const [id, mastery] of Object.entries(original.progression.mastery)) expect(state.progression.mastery[id], id).toBe(mastery);
  expect(state.combat).toBeNull(); expect(state.activeEvent).toBeNull();
}

describe('WhiteTower214 complete immutable natural803 capture', () => {
  it('authenticates all147 members and complete137 actual captures, retaining original666 and exact current212 ingress', () => {
    expect(data.rows).toHaveLength(NEW_COMMANDS); expect(data.checkpoint.boundaries).toHaveLength(26);
    expect(data.checkpoint.pending).toBeNull(); expect(data.checkpoint.terminal).toEqual({ stage: PINS.stage, reason: PINS.reason });
    expect(data.original).toMatchObject({ revision: 667, status: 'ACTIVE', week: 146, health: 70, mind: 86,
      spirituality: 120, cash: 1390, actionsRemaining: 3, random: { seed: 'reader-natural-v023', cursor: 227 },
      progression: { pathwayId: 'white-tower', sequence: 1, acting: 100 } });
    expect(data.original.injuries).toEqual([{ id: 'reader-rebuild-natural:combat:2:PLAYER:664:0',
      severity: 'HEAVY', acquiredRevision: 664, treatedRevision: null }]);
    expect(Object.keys(data.original.progression.mastery)).toHaveLength(21);
    expect(Object.values(data.original.progression.mastery).filter(value => value === 0)).toHaveLength(6);
    expect([data.initial.schemaVersion, data.initial.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    const counts = BLOCKS.flatMap(([first, last, size]) => {
      expect(last - first + 1).toBe(size); return Array.from({ length: size }, (_, index) => first + index);
    });
    expect(counts).toEqual(data.rows.map(row => row.commandCount)); expect(new Set(counts).size).toBe(137);
  });

  it('admits only the exact empty Tyrant and Sun additions while retaining every raw211 private and public field', () => {
    const current = data.initial, raw = actionAt(667).beforeLast, originalHash = hash(raw), currentHash = hash(current);
    same(historicalWhiteTowerState(current), raw);
    expect(Object.keys(current).sort()).toEqual([...Object.keys(raw), 'tyrant', 'sun'].sort());
    expect(current.sun).toStrictEqual(createSunState());
    expect(Object.hasOwn(raw, 'sun')).toBe(false);
    expect(Object.hasOwn(raw, 'tyrant')).toBe(false);
    expect(() => migrateCapturedWhiteTowerState({ ...raw, tyrant: current.tyrant } as HistoricalWhiteTowerState)).toThrow();
    expect(() => migrateCapturedWhiteTowerState({ ...raw, unexpectedRoot: null } as HistoricalWhiteTowerState)).toThrow();
    const { tyrant: _missing, ...missing } = current;
    expect(() => historicalWhiteTowerState(missing as SliceState)).toThrow();
    for (const tyrant of [null, { ...current.tyrant, guidanceKnown: true }, { ...current.tyrant, unexpectedField: undefined },
      { ...current.tyrant, promotionStability: { preparations: [], unexpectedField: undefined } }]) {
      expect(() => historicalWhiteTowerState({ ...current, tyrant } as SliceState)).toThrow();
    }
    expect(hash(historicalWhiteTowerState({ ...current, unexpectedRoot: null } as SliceState))).not.toBe(originalHash);
    expect(hash(historicalWhiteTowerState({ ...current, cash: current.cash + 1 }))).not.toBe(originalHash);
    const publicValue = projectSliceState(current), publicHash = hash(publicValue);
    expect(hash(historicalWhiteTowerPublic(publicValue, current))).toBe(PINS.initialGlobalPublicSha256);
    expect(() => historicalWhiteTowerPublic({ ...publicValue, tyrant: null } as unknown as typeof publicValue, current)).toThrow();
    const { tyrant: _missingPublic, ...missingPublic } = publicValue;
    expect(() => historicalWhiteTowerPublic(missingPublic as typeof publicValue, current)).toThrow();
    for (const actions of [[], [{ ...publicValue.tyrant.actions[0]!, enabled: true }],
      [{ ...publicValue.tyrant.actions[0]!, reason: null }], [{ ...publicValue.tyrant.actions[0]!, privateProbe: undefined }],
      [{ ...publicValue.tyrant.actions[0]!, command: { type: 'LEARN_GUIDANCE' as const, privateProbe: undefined } }]]) {
      expect(() => historicalWhiteTowerPublic({ ...publicValue, tyrant: { ...publicValue.tyrant, actions } }, current)).toThrow();
    }
    expect(() => historicalWhiteTowerPublic({ ...publicValue, tyrant: { ...publicValue.tyrant,
      resources: { ...publicValue.tyrant.resources, cash: '0便士' } } }, current)).toThrow();
    expect(hash(historicalWhiteTowerPublic({ ...publicValue, unexpectedRoot: null } as typeof publicValue, current)))
      .not.toBe(PINS.initialGlobalPublicSha256);
    const missingOldPublic = { ...publicValue }; Reflect.deleteProperty(missingOldPublic, 'whiteTower');
    expect(hash(historicalWhiteTowerPublic(missingOldPublic, current))).not.toBe(PINS.initialGlobalPublicSha256);
    expect(hash(raw)).toBe(originalHash); expect(hash(current)).toBe(currentHash); expect(hash(publicValue)).toBe(publicHash);
  });

  it('rejects missing, extra, duplicated or rewritten evidence without modifying any capture', () => {
    const manifest = JSON.parse(bytes(INPUT_MANIFEST).toString('utf8')) as Manifest;
    const names = manifest.files.map(row => row.file), before = hash(manifest);
    expect(() => assertCaptureManifest(manifest, names)).not.toThrow();
    expect(() => assertCaptureManifest(manifest, names.filter(name => name !== 'action-700.json.gz'))).toThrow();
    expect(() => assertCaptureManifest(manifest, [...names, 'replacement.json'])).toThrow();
    const changed = structuredClone(manifest); changed.files[1] = structuredClone(changed.files[0]!);
    expect(() => assertCaptureManifest(changed, names)).toThrow();
    const freeze = json<Freeze>('runtime-freeze.json'), frozenHash = hash(freeze), rewritten = structuredClone(freeze);
    rewritten.files[0]!.sha256 = '0'.repeat(64); expect(() => assertCaptureFreeze(rewritten)).toThrow();
    rewritten.sha256 = compactHash(rewritten.files); expect(() => assertCaptureFreeze(rewritten)).toThrow();
    expect(hash(manifest)).toBe(before); expect(hash(freeze)).toBe(frozenHash);
  });

  it.each(BLOCKS)('replays only recorded %i..%i (%i commands) with every complete private/RNG/chapter/global boundary', (first, last, size) => {
    let state = first === PREFIX + 1 ? structuredClone(data.initial) : migrateCapturedWhiteTowerState(actionAt(first).beforeLast);
    let session: WhiteTowerRuntimeSession | null = state.whiteTower.guidanceKnown ? openWhiteTowerRuntimeSession(state) : null;
    let global = session ? session.project() : projectSliceState(state), view = capturePublic(global);
    const rows = data.rows.filter(row => row.commandCount >= first && row.commandCount <= last);
    expect(rows).toHaveLength(size); let prepared = 0, committed = 0;
    for (const row of rows) {
      const before = state, recorded = readAction(row);
      expect(hash(historicalWhiteTowerState(before)), `Private before ${row.commandCount}`).toBe(row.beforeStateSha256);
      expect(hash(historicalWhiteTowerPublic(global, before)), `Global before ${row.commandCount}`).toBe(row.globalPublicBeforeSha256);
      expect(hash(view), `Chapter before ${row.commandCount}`).toBe(row.publicBeforeSha256);
      expect(before.random).toEqual(recorded.randomBefore); expect(hash(before.random)).toBe(row.randomBeforeSha256);
      assertGlobalPublic(global, before); assertPublicAction(view, row); expect(validateSlicePayload(row.intent)).toBe(true);
      expect(before.status).toBe('ACTIVE');
      if (session) {
        const draft = session.prepare(row.intent, before.revision); prepared++;
        state = session.snapshotDraft(draft); global = session.projectDraft(draft);
        expect(session.inspect()).toEqual({ runId: before.runId, revision: before.revision, status: before.status });
        expect(hash(historicalWhiteTowerState(before)), 'Prepare cannot mutate predecessor').toBe(row.beforeStateSha256);
        expect(hash(historicalWhiteTowerState(state))).toBe(row.afterStateSha256);
        expect(hash(historicalWhiteTowerPublic(global, state))).toBe(row.globalPublicAfterSha256);
        session.commit(draft); committed++;
        expect(session.inspect()).toEqual({ runId: state.runId, revision: state.revision, status: state.status });
      } else {
        expect(row.commandCount).toBe(667); expect(row.intent).toEqual({ type: 'WHITE_TOWER', command: { type: 'LEARN_GUIDANCE' } });
        state = applySliceIntent(before, row.intent); session = openWhiteTowerRuntimeSession(state); global = session.project();
      }
      view = capturePublic(global); assertGlobalPublic(global, state);
      expect(hash(historicalWhiteTowerState(before)), 'Commit cannot rewrite predecessor').toBe(row.beforeStateSha256);
      expect(hash(historicalWhiteTowerState(state)), `Private after ${row.commandCount}`).toBe(row.afterStateSha256);
      expect(hash(historicalWhiteTowerPublic(global, state)), `Global after ${row.commandCount}`).toBe(row.globalPublicAfterSha256);
      expect(hash(view), `Chapter after ${row.commandCount}`).toBe(row.publicAfterSha256);
      expect(state.random).toEqual(recorded.randomAfter); expect(hash(state.random)).toBe(row.randomAfterSha256);
      expect([state.revision, state.week]).toEqual([row.revision, row.week]); expect(state.revision).toBe(before.revision + 1);
      expect(outcome(view)).toEqual(row.selectionOutcome); same(actualReceipts(state, before), row.receipts);
      if (before.whiteTower.guidanceKnown) same(state.whiteTower.source, before.whiteTower.source);
    }
    expect(prepared).toBe(size - (first === 667 ? 1 : 0)); expect(committed).toBe(prepared);
    same(session!.snapshot(), state); same(session!.project(), global);
    same(migrateSliceState(state), state); preserveOriginal(state);
    const end = actionAt(last); same(historicalWhiteTowerState(state), end.final); same(view, end.public);
    same(historicalWhiteTowerPublic(global, state), end.globalPublic);
    if (last === 803) {
      same(historicalWhiteTowerState(state), data.checkpoint.state); same(view, data.summary.public);
      expect(hash(historicalWhiteTowerState(state))).toBe(PINS.finalStateSha256);
      expect(hash(historicalWhiteTowerPublic(global, state))).toBe(PINS.finalGlobalPublicSha256);
    }
  }, 180_000);

  it('retains actual construction100 failure, paid repair, promotion34 and the six original consecutive draws', () => {
    const final = data.checkpoint.state, promoted = actionAt(775), failedBuild = actionAt(704);
    expect(final.whiteTower.journal.flatMap(event => event.randomReceipts)
      .map(receipt => [receipt.cursorBefore, receipt.cursorAfter, receipt.check.chance, receipt.check.roll, receipt.check.tier]))
      .toEqual([[227, 228, 84, 6, 'SUCCESS'], [228, 229, 84, 81, 'SUCCESS'], [229, 230, 84, 100, 'GREAT_FAILURE'],
        [230, 231, 70, 34, 'SUCCESS'], [231, 232, 76, 15, 'SUCCESS'], [232, 233, 70, 96, 'GREAT_FAILURE']]);
    expect(failedBuild.final.lastCheck).toMatchObject({ chance: 84, roll: 100, tier: 'GREAT_FAILURE' });
    expect(actionAt(711).lastIntent).toEqual({ type: 'WHITE_TOWER', command: { type: 'PASSAGE', command: { type: 'REPAIR', passageId: 'apartment-alley' } } });
    expect(data.checkpoint.policy.doses).toBe(1); expect(data.checkpoint.policy.carriers).toEqual(['white-tower-carrier-1']);
    expect(promoted.final.lastCheck).toMatchObject({ chance: 70, roll: 34, tier: 'SUCCESS' });
    expect([promoted.beforeLast.progression.sequence, promoted.final.progression.sequence]).toEqual([1, 0]);
    expect([promoted.beforeLast.mind - promoted.final.mind, promoted.beforeLast.spirituality - promoted.final.spirituality,
      promoted.beforeLast.actionsRemaining - promoted.final.actionsRemaining]).toEqual([12, 30, 1]);
    expect(final.whiteTower.materials!.characteristics.map(item => [item.originBottleId, item.latestBottleId, item.holder, item.compoundId]))
      .toEqual([1, 2, 3].map(n => [`all-knowing-eye-potion-${n}`, `all-knowing-eye-potion-${n}`, 'FUSED', 'white-tower-compound-1']));
    expect(final.whiteTower.materials!.uniqueness).toMatchObject({ id: 'WT0-U1', holder: 'FUSED', compoundId: 'white-tower-compound-1' });
    expect(final.whiteTower.materials!.batches.map(item => [item.id, item.status, item.uses])).toEqual([
      ['white-tower-carrier-1', 'SPENT', 1], ['white-tower-carrier-2', 'SUPPLIER', 0], ['white-tower-carrier-3', 'SUPPLIER', 0],
    ]);
    expect(outcome(data.summary.public)).toEqual({ status: 'ACTIVE', promoted: true, passages: 3, reviews: 3 });
    preserveOriginal(final);
  });

  it('records actual insight application, great-failure injury, renewed consent and ordinary twelve-metre return without inventing mastery', () => {
    const final = data.checkpoint.state, attempted = actionAt(789).final, applied = actionAt(790).final, failed = actionAt(795), epilogue = final.whiteTower.epilogue!;
    expect(attempted.progression.mastery['reader.s0.structural-insight']).toBe(0);
    expect(applied.progression.mastery['reader.s0.structural-insight']).toBe(8);
    expect(final.progression.mastery['reader.s0.structural-insight']).toBe(8);
    expect(final.progression.mastery['reader.s0.bounded-weak-point']).toBe(0);
    expect(epilogue).toMatchObject({ status: 'RESOLVED', position: 12, reported: true,
      insight: { attempted: true, passed: true, applied: true, expiresSecond: null },
      weakness: { attempted: true, passed: false, applied: false, expiresSecond: null },
      gate: { id: 'WT0-GATE-1', condition: 74, version: 4, open: true, locked: true, strut: { loaded: false } },
      resident: { id: 'WT0-SERA', age: 39, position: 12, consent: 'ACCEPT', routePermission: 'GATE_AND_SIDE', arrival: { route: 'GATE_THEN_SIDE' } },
      opponent: { position: 6, toolCondition: 66, reconstruction: { fromVersion: 1, toVersion: 2 } } });
    expect(failed.final.lastCheck).toMatchObject({ chance: 70, roll: 96, tier: 'GREAT_FAILURE' });
    expect([failed.beforeLast.health - failed.final.health, failed.beforeLast.mind - failed.final.mind,
      failed.beforeLast.spirituality - failed.final.spirituality, failed.beforeLast.actionsRemaining - failed.final.actionsRemaining]).toEqual([16, 15, 16, 1]);
    expect(failed.final.whiteTower.epilogue!.resident).toMatchObject({ position: 0, consent: 'WITHDRAWN', routePermission: 'NONE' });
    expect(epilogue.resident.permissionHistory.map(item => item.answer)).toEqual(['ACCEPT', 'WITHDRAWN', 'ACCEPT', 'WITHDRAWN', 'ACCEPT']);
    expect(epilogue.resident.injuries).toEqual(['原连接杆回震飞出碎屑，在入口造成一次擦伤']);
    expect(epilogue.journal.slice(-5).map(event => event.command.type)).toEqual(['SECURE_GATE', 'OBSERVE', 'CROSS', 'ORDINARY_SIDE_EXIT', 'REPORT']);
    expect(epilogue.journal.slice(-3).map(event => [event.walkedMeters, event.residentFrom, event.residentTo])).toEqual([[8, 0, 8], [4, 8, 12], [0, 12, 12]]);
    expect(final).toMatchObject({ revision: 804, week: 174, health: 84, mind: 77, spirituality: 122, cash: 0,
      actionsRemaining: 1, injuryRisk: 2, lastCheck: null, ending: null });
    expect(final.injuries).toEqual([{ id: 'R214:reader-rebuild-natural:796:structural-strain', severity: 'HEAVY', acquiredRevision: 796, treatedRevision: null }]);
    same(final.injuries, failed.final.injuries); expect(data.summary.public.debtTotal).toBe(80);
  });
});
