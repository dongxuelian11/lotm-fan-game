import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applySliceIntent, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { openDoorRuntimeSession, type DoorRuntimeSession } from '../../src/domain/door/owned-session.js';
import { DOOR_ABILITY_IDS, DOOR_ORIGINAL_IDS } from '../../src/domain/door/types.js';
import {
  FINAL_COMMAND, NEW_COMMANDS, PINS, PREFIX, SOURCE_REVISION, revisionAt, actualReceipts, assertCurrentGlobal, assertGlobalPublic,
  assertPublicAction, assertPublicOnly, authenticateInputs, capturePublic, hash, historicalDoorState, historicalDoorPublic, loadCapture, outcome, readAction, same,
  type LoadedCapture,
} from '../helpers/door-capture.js';

/** Original823 is authenticated historical evidence, NEVER replayed. All105
 * new commands execute once in five disjoint continuous blocks of21.
 * Only one compressed action is inflated per iteration. Strict session opening
 * is bounded to block ingress, never repeated for each incremental action. */
const BLOCKS = [[824, 844], [845, 865], [866, 886], [887, 907], [908, 928]] as const;
let data: LoadedCapture;
beforeAll(() => { data = loadCapture(); }, 300_000);
afterAll(() => { authenticateInputs(); }, 300_000);
const actionAt = (count: number) => readAction(data.rows[count - PREFIX - 1]!);
function preserveOriginal(state: SliceState): void {
  expect(state.runId).toBe(data.original.runId); expect(state.random.seed).toBe(data.original.random.seed);
  for (const key of ['apprentice', 'trickmaster', 'astrologer', 'recorder', 'traveler', 'secretsSorcerer',
    'wanderer', 'planeswalker', 'starKey', 'world', 'combatHistory', 'character'] as const)
    same(state[key], data.original[key], `Original823 ${key}`);
  for (const [id, mastery] of Object.entries(data.original.progression.mastery)) expect(state.progression.mastery[id], id).toBe(mastery);
  expect(Object.keys(state.progression.mastery).sort()).toEqual([...Object.keys(data.original.progression.mastery),
    ...(state.progression.sequence === 0 ? DOOR_ABILITY_IDS : [])].sort());
  expect(state.activeEvent).toBeNull(); expect(state.combat).toBeNull(); expect(state.eventQueue).toEqual([]); expect(state.pulse).toBe('NONE');
}

describe('Door218 actual natural928 from unchanged original196 living823', () => {
  it('authenticates all117 members, original823, exact migration, all105 action pins and63 selected boundaries', () => {
    expect(data.rows).toHaveLength(NEW_COMMANDS); expect(data.checkpoint.commands).toHaveLength(105);
    expect(data.checkpoint.boundaries.map(row => row.commandCount)).toEqual([...PINS.boundaryCommandCounts]);
    expect(BLOCKS.flatMap(([first, last]) => Array.from({ length: last - first + 1 }, (_, index) => first + index)))
      .toEqual(data.rows.map(row => row.commandCount));
    expect(data.original).toMatchObject({ schemaVersion: 193, contentVersion: 'star-key-v193', revision: SOURCE_REVISION,
      status: 'ACTIVE', week: 218, date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 8, day: 25 },
      health: 80, mind: 98, spirituality: 120, cash: 3900, actionsRemaining: 3, injuryRisk: 1,
      random: { seed: 'secrets-sorcerer-directed-24', cursor: 205 }, progression: { pathwayId: 'door', sequence: 1, acting: 100 } });
    expect(data.original.injuries.map(({ severity, treatedRevision }) => ({ severity, treatedRevision }))).toEqual([
      { severity: 'LIGHT', treatedRevision: null }, { severity: 'LIGHT', treatedRevision: null },
    ]);
    expect(data.original.starKey.bottles.map(bottle => [bottle.status, bottle.outcome]))
      .toEqual([['CONSUMED', 'FAILURE'], ['CONSUMED', 'SUCCESS'], ['SUPPLIER', null]]);
    expect(data.original.starKey).toMatchObject({ promotionWeek: 208, life: { reflected: true }, encounter: { enemyStatus: 'DEAD' } });
    expect(data.original.combatHistory).toHaveLength(30);
    expect(Object.keys(data.original.progression.mastery)).toHaveLength(17);
    expect(Object.values(data.original.progression.mastery).filter(value => value === 0)).toHaveLength(8);
    const originalHash = hash(data.original), migrated = migrateSliceState(data.original);
    same(historicalDoorState(migrated), data.initial, 'Current migration retains every exact193->215 captured field');
    expect(Object.keys(migrated).sort()).toEqual(Object.keys(data.initial).sort());
    expect(hash(data.original)).toBe(originalHash); expect(originalHash).toBe(PINS.originalStateSha256);
    const global = projectSliceState(migrated); same(historicalDoorPublic(global, migrated), data.initialPublic); assertGlobalPublic(global, migrated);
    expect(hash(historicalDoorPublic(global, migrated))).toBe(PINS.initialGlobalPublicSha256); expect(hash(capturePublic(global))).toBe(PINS.initialPublicSha256);
    expect(data.checkpoint.pending).toBeNull(); expect(data.checkpoint.terminal).toEqual({ stage: PINS.stage, reason: PINS.reason });
    expect(data.checkpoint.policy).toMatchObject({ doses: 1, carriers: ['door-carrier-1'], consumedCompounds: ['door-compound-1'],
      epilogueAttempted: ['CONCEPTUAL_ESCAPE', 'SEAL_EXIT'], reported: true });
  }, 300_000);

  it.each(BLOCKS)('replays actual %i..%i with complete private/RNG/chapter/global equivalence', (first, last) => {
    let state = migrateSliceState(first === PREFIX + 1 ? data.initial : actionAt(first).beforeLast);
    let session: DoorRuntimeSession | null = state.door.guidanceKnown ? openDoorRuntimeSession(state) : null;
    let global = session ? session.project() : projectSliceState(state), prepared = 0, committed = 0, ingress = 0;
    for (const row of data.rows.filter(item => item.commandCount >= first && item.commandCount <= last)) {
      const recorded = readAction(row), before = state, beforeHash = hash(before);
      expect(hash(historicalDoorState(before))).toBe(row.beforeStateSha256); same(historicalDoorState(before), recorded.beforeLast, `Complete private before ${row.commandCount}`);
      assertCurrentGlobal(global, recorded, 'before'); assertPublicAction(capturePublic(global), row);
      expect(validateSlicePayload(row.intent)).toBe(true); expect(before.random).toEqual(recorded.randomBefore);
      expect(hash(before.random)).toBe(row.randomBeforeSha256); expect(before.status).toBe('ACTIVE');
      if (session) {
        const draft = session.prepare(row.intent, before.revision); prepared++;
        state = session.snapshotDraft(draft); global = session.projectDraft(draft);
        expect(session.inspect()).toEqual({ runId: before.runId, revision: before.revision, status: before.status });
        expect(hash(before), 'Preparing cannot mutate predecessor').toBe(beforeHash);
        same(historicalDoorState(state), recorded.final); assertCurrentGlobal(global, recorded, 'after');
        session.commit(draft); committed++;
        expect(session.inspect()).toEqual({ runId: state.runId, revision: state.revision, status: state.status });
      } else {
        expect(row.commandCount).toBe(PREFIX + 1); expect(row.intent).toEqual({ type: 'DOOR', command: { type: 'LEARN_GUIDANCE' } });
        state = applySliceIntent(before, row.intent); ingress++;
        expect(state.door.guidanceKnown).toBe(true); session = openDoorRuntimeSession(state); global = session.project();
      }
      expect(hash(before), 'Committing cannot mutate predecessor').toBe(beforeHash);
      same(historicalDoorState(state), recorded.final, `Complete private after ${row.commandCount}`); expect(hash(historicalDoorState(state))).toBe(row.afterStateSha256);
      assertCurrentGlobal(global, recorded, 'after'); expect(hash(historicalDoorPublic(global, state))).toBe(row.globalPublicAfterSha256);
      expect(hash(capturePublic(global))).toBe(row.publicAfterSha256);
      expect(state.random).toEqual(recorded.randomAfter); expect(hash(state.random)).toBe(row.randomAfterSha256);
      expect(state.random.seed).toBe(data.original.random.seed); expect(state.revision).toBe(before.revision + 1);
      expect(state.revision).toBe(revisionAt(row.commandCount, 'after'));
      expect([state.revision, state.week]).toEqual([row.revision, row.week]);
      expect(outcome(capturePublic(global))).toEqual(row.selectionOutcome); same(actualReceipts(state, before), row.receipts);
      if (before.door.guidanceKnown) same(state.door.source, before.door.source, 'Owned source remains exact');
    }
    expect(prepared + ingress).toBe(last - first + 1); expect(committed).toBe(prepared);
    expect(session).not.toBeNull(); same(session!.snapshot(), state); same(session!.project(), global); preserveOriginal(state);
    if (last === FINAL_COMMAND) {
      same(historicalDoorState(state), data.checkpoint.state); expect(hash(historicalDoorState(state))).toBe(PINS.finalStateSha256);
      expect(hash(historicalDoorPublic(global, state))).toBe(PINS.finalGlobalPublicSha256);
    }
  }, 300_000);

  it('retains all three actual draws and same-original promotion916 at70% roll2 with paid costs and no refill', () => {
    const draws = data.rows.filter(row => row.randomBefore.cursor !== row.randomAfter.cursor);
    expect(draws.map(row => [row.commandCount, row.randomBefore.cursor, row.randomAfter.cursor]))
      .toEqual([[916, 205, 206], [923, 206, 207], [926, 207, 208]]);
    const receipts = data.checkpoint.state.door.journal.filter(row => row.randomReceipts.length).map(row => row.randomReceipts);
    expect(draws.map(row => row.receipts.checks)).toEqual(receipts);
    expect(receipts.flat().map(row => [row.check.chance, row.check.roll, row.check.tier]))
      .toEqual([[70, 2, 'GREAT_SUCCESS'], [66, 45, 'SUCCESS'], [68, 64, 'SUCCESS']]);
    expect(data.rows.filter(row => row.intent.type === 'DOOR' && row.intent.command.type === 'CONSUME').map(row => row.commandCount)).toEqual([916]);
    const action = actionAt(916), before = action.beforeLast, state = action.final, materials = state.door.materials!;
    expect(action.lastIntent).toEqual({ type: 'DOOR', command: { type: 'CONSUME', compoundId: 'door-compound-1', confirmed: true } });
    expect(state.lastCheck).toEqual({ ability: 'will', baseAbility: 28, modifiers: [{ source: '本瓶本次实际稳定准备', value: 40 }],
      effectiveAbility: 68, difficulty: 58, chance: 70, roll: 2, tier: 'GREAT_SUCCESS' });
    expect([before.progression.sequence, state.progression.sequence]).toEqual([1, 0]);
    expect([before.mind - state.mind, before.spirituality - state.spirituality, before.actionsRemaining - state.actionsRemaining]).toEqual([12, 30, 1]);
    expect([action.globalPublicBefore.maxSpirituality, action.globalPublic.maxSpirituality]).toEqual([120, 150]);
    expect([action.globalPublicBefore.spirituality, action.globalPublic.spirituality]).toEqual([108, 78]);
    expect(state.spirituality).toBeLessThan(action.globalPublic.maxSpirituality);
    expect(state.door.promotionWeek).toBe(228); expect(state.door.epilogue).toBeNull();
    expect(DOOR_ABILITY_IDS.map(id => state.progression.mastery[id])).toEqual([0, 0]);
    expect(materials.characteristics.map(row => [row.id, row.originBottleId, row.latestBottleId, row.holder]))
      .toEqual(DOOR_ORIGINAL_IDS.map((id, index) => [`DR0-SK-CHAR-${index + 1}`, id, id, 'FUSED']));
    expect(materials.uniqueness).toMatchObject({ id: 'DR0-DOOR-UNIQUENESS-1', holder: 'FUSED', compoundId: 'door-compound-1' });
    expect(materials.compounds).toHaveLength(1);
    expect(materials.compounds[0]).toMatchObject({ id: 'door-compound-1', status: 'SUCCESS', consumedWeek: 228,
      characteristicIds: ['DR0-SK-CHAR-1', 'DR0-SK-CHAR-2', 'DR0-SK-CHAR-3'], uniquenessId: 'DR0-DOOR-UNIQUENESS-1' });
    expect(materials.compounds[0]!.serviceReceipts.map(row => row.serviceId)).toEqual(['ledger-threshold', 'courtyard-stair', 'warehouse-gate']);
    expect(materials.batches.map(row => [row.id, row.status, row.uses])).toEqual([
      ['door-carrier-1', 'SPENT', 1], ['door-carrier-2', 'SUPPLIER', 0], ['door-carrier-3', 'SUPPLIER', 0],
    ]);
    preserveOriginal(state);
  }, 300_000);

  it('grants each finite mastery only on the actual specified impact and reports928 with original damage retained', () => {
    for (const [castCount, applyCount, window, impact, ability, chance, roll, cashCost, mindCost, spiritCost, result] of [
      [923, 924, 'escape', 'spring', DOOR_ABILITY_IDS[0], 66, 45, 8, 8, 14, 'AVOIDED'],
      [926, 927, 'seal', 'exit', DOOR_ABILITY_IDS[1], 68, 64, 6, 6, 12, 'HELD'],
    ] as const) {
      const cast = actionAt(castCount), applied = actionAt(applyCount), before = cast.beforeLast;
      expect(cast.final.lastCheck).toMatchObject({ chance, roll, tier: 'SUCCESS' });
      expect([before.cash - cast.final.cash, before.mind - cast.final.mind, before.spirituality - cast.final.spirituality,
        before.actionsRemaining - cast.final.actionsRemaining]).toEqual([cashCost, mindCost, spiritCost, 1]);
      expect(cast.final.door.epilogue![window]).toMatchObject({ attempted: true, passed: true, applied: false });
      expect(cast.final.progression.mastery[ability]).toBe(0);
      same(applied.beforeLast, cast.final); expect(applied.final.lastCheck).toBeNull(); same(applied.randomBefore, applied.randomAfter);
      const scene = applied.final.door.epilogue!, w = scene[window], actual = scene.impacts[impact];
      expect(w).toMatchObject({ attempted: true, passed: true, applied: true, endedReason: 'USED', expiresSecond: null });
      expect(actual).toMatchObject({ status: result, resolvedEventId: w.appliedEventId, resolvedSecond: w.appliedSecond,
        playerHealthLoss: 0, workerHealthLoss: 0, trolleyWear: 0 });
      expect(actual.resolvedSecond).toBe(actual.dueSecond);
      expect(applied.final.progression.mastery[ability]).toBe(8);
      expect(scene.journal.at(-1)?.masteryGains).toEqual({ [ability]: 8 });
    }
    const final = data.checkpoint.state, incident = final.door.epilogue!, report = actionAt(928);
    expect(final).toMatchObject({ revision: 1236, status: 'ACTIVE', week: 229, date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 11, day: 10 },
      health: 88, mind: 66, spirituality: 52, cash: 1742, actionsRemaining: 0, injuries: [], injuryRisk: 0, ending: null, lastCheck: null,
      random: { seed: 'secrets-sorcerer-directed-24', cursor: 208 }, progression: { pathwayId: 'door', sequence: 0, acting: 0 } });
    expect(final.door.frame!.budget.pollution).toBe(0);
    expect(incident).toMatchObject({ status: 'RESOLVED', reported: true, playerPosition: 0, playerMetres: 32,
      worker: { id: 'DR0-SHED-ADA-WREN', health: 96, position: 0, trapped: false, travelledMetres: 24,
        injuries: ['本次卡滞留下的手臂挫伤，尚未处理'] },
      trolley: { id: 'DR0-SHED-TOOL-TROLLEY', ownerId: 'DR0-SHED-ADA-WREN', holderId: 'DR0-SHED-ADA-WREN', condition: 84,
        position: 0, travelledMetres: 24, quantity: 1 },
      exit: { condition: 76, closed: true }, brake: { condition: 76, applied: false },
      counterweight: { quantity: 1, energy: 'SPENT' }, playerInjuries: [] });
    expect(incident.arrival).toMatchObject({ routeId: 'DR0-SHED-SIDE-PASSAGE', workerId: 'DR0-SHED-ADA-WREN',
      trolleyId: 'DR0-SHED-TOOL-TROLLEY', metres: 24 });
    expect(DOOR_ABILITY_IDS.map(id => final.progression.mastery[id])).toEqual([8, 8]);
    for (const [cast, apply, ability] of [
      ['CONCEPTUAL_ESCAPE', 'FREE_WORKER', DOOR_ABILITY_IDS[0]], ['SEAL_EXIT', 'GUIDE_SIDE_EXIT', DOOR_ABILITY_IDS[1]],
    ] as const) {
      expect(incident.journal.filter(event => event.command.type === cast)).toHaveLength(1);
      const gains = incident.journal.filter(event => (event.masteryGains[ability] ?? 0) > 0);
      expect(gains).toHaveLength(1); expect(gains[0]!.command.type).toBe(apply); expect(gains[0]!.masteryGains[ability]).toBe(8);
    }
    expect(report.lastIntent).toEqual({ type: 'DOOR', command: { type: 'EPILOGUE', command: { type: 'REPORT' } } });
    same(report.randomBefore, report.randomAfter); same(report.final, final); preserveOriginal(final);
  }, 300_000);

  it('rejects altered evidence, unknown roots, wrong revision offsets, forged input and private leakage', () => {
    const action = actionAt(916), original = hash(action), expected = action.globalPublic;
    assertCurrentGlobal(expected, action, 'after');
    expect(() => assertCurrentGlobal({ ...expected, cash: expected.cash + 1 }, action, 'after')).toThrow();
    expect(() => assertCurrentGlobal({ ...expected, unexpectedRoot: null } as typeof expected, action, 'after')).toThrow();
    expect(() => assertCurrentGlobal({ ...expected, unexpectedRoot: undefined } as typeof expected, action, 'after')).toThrow();
    const missing = { ...expected }; Reflect.deleteProperty(missing, 'door');
    expect(() => assertCurrentGlobal(missing, action, 'after')).toThrow();
    expect(() => assertCurrentGlobal(expected, action, 'before')).toThrow();
    expect(() => assertCurrentGlobal(expected, { ...action, commandCount: 917 }, 'after')).toThrow();
    expect(() => assertCurrentGlobal(expected, { ...action, final: { ...action.final, revision: 917 } }, 'after')).toThrow();
    expect(() => same({ ...action.final, random: { ...action.final.random, cursor: 209 } }, action.final)).toThrow();
    for (const field of [{ nextRoll: 1 }, { privateSource: action.final.door.source }, { actorId: null },
      { renderedText: action.final.random.seed }]) expect(() => assertPublicOnly(field, action.final)).toThrow();
    expect(validateSlicePayload({ type: 'DOOR', command: { type: 'CONSUME', compoundId: 'door-compound-1', confirmed: true, roll: 1 } })).toBe(false);
    expect(validateSlicePayload({ type: 'DOOR', command: { type: 'EPILOGUE', command: { type: 'CONCEPTUAL_ESCAPE', success: true } } })).toBe(false);
    const row = structuredClone(data.rows[0]!); row.afterStateSha256 = '0'.repeat(64);
    expect(() => readAction(row)).toThrow(); row.capture.file = '../replacement.json.gz'; expect(() => readAction(row)).toThrow();
    expect(() => assertPublicAction(action.publicBefore, { ...action.audit, publicCost: 'free' })).toThrow();
    expect(hash(action)).toBe(original); expect(hash(data.original)).toBe(PINS.originalStateSha256);
  }, 300_000);
});
