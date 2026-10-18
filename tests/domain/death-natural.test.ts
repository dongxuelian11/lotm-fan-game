import { emptyErrorAscentPublic } from '../helpers/empty-error-ascent-capture.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applySliceIntent, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { emptyDoorPublic } from '../helpers/empty-death-capture.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { openDeathRuntimeSession, type DeathRuntimeSession } from '../../src/domain/death/owned-session.js';
import { DEATH_ABILITY_IDS, DEATH_ORIGINAL_IDS } from '../../src/domain/death/types.js';
import {
  FINAL_COMMAND, NEW_COMMANDS, PINS, PREFIX, actualReceipts, assertCurrentGlobal, assertGlobalPublic,
  assertPublicAction, assertPublicOnly, authenticateInputs, capturePublic, hash, historicalDeathState, historicalDeathPublic, loadCapture, outcome, readAction, same,
  type LoadedCapture,
} from '../helpers/death-capture.js';

/** Original1038 is authenticated historical evidence, NEVER replayed. All103
 * new commands execute once in four disjoint continuous blocks (26/26/26/25).
 * Only one compressed action is inflated per iteration. Strict session opening
 * is bounded to block ingress, never repeated for each incremental action. */
const BLOCKS = [[1039, 1064], [1065, 1090], [1091, 1116], [1117, 1141]] as const;
let data: LoadedCapture;
beforeAll(() => { data = loadCapture(); }, 300_000);
afterAll(() => { authenticateInputs(); }, 300_000);
const actionAt = (count: number) => readAction(data.rows[count - PREFIX - 1]!);
function preserveOriginal(state: SliceState): void {
  expect(state.runId).toBe(data.original.runId); expect(state.random.seed).toBe(data.original.random.seed);
  for (const key of ['corpsecollector', 'gravedigger', 'spiritmedium', 'spiritGuide', 'gatekeeper', 'undying',
    'ferryman', 'deathConsul', 'longChapter', 'paleEmperor', 'world', 'combatHistory', 'character'] as const)
    same(state[key], data.original[key], `Original1038 ${key}`);
  for (const [id, mastery] of Object.entries(data.original.progression.mastery)) expect(state.progression.mastery[id], id).toBe(mastery);
  expect(state.activeEvent).toBeNull(); expect(state.combat).toBeNull(); expect(state.eventQueue).toEqual([]); expect(state.pulse).toBe('NONE');
}

describe('Death217 actual natural1141 from unchanged original195 living1038', () => {
  it('authenticates all115 members, original1038, exact migration, all103 action pins and60 selected boundaries', () => {
    expect(data.rows).toHaveLength(NEW_COMMANDS); expect(data.checkpoint.commands).toHaveLength(103);
    expect(data.checkpoint.boundaries.map(row => row.commandCount)).toEqual([...PINS.boundaryCommandCounts]);
    expect(BLOCKS.flatMap(([first, last]) => Array.from({ length: last - first + 1 }, (_, index) => first + index)))
      .toEqual(data.rows.map(row => row.commandCount));
    expect(data.original).toMatchObject({ schemaVersion: 192, contentVersion: 'pale-emperor-v192', revision: 1039,
      status: 'ACTIVE', week: 3323, date: { epoch: 'FIFTH_EPOCH', year: 1413, month: 3, day: 3 },
      health: 50, mind: 100, spirituality: 120, cash: 36, actionsRemaining: 1, injuryRisk: 2,
      random: { seed: 'corpsecollector-natural-v032', cursor: 490 }, progression: { pathwayId: 'death', sequence: 1, acting: 100 } });
    expect(data.original.injuries.map(({ severity, treatedRevision }) => ({ severity, treatedRevision }))).toEqual([
      { severity: 'HEAVY', treatedRevision: null }, { severity: 'LIGHT', treatedRevision: null }, { severity: 'LIGHT', treatedRevision: null },
    ]);
    expect(data.original.paleEmperor.bottles.map(bottle => [bottle.status, bottle.outcome]))
      .toEqual([['CONSUMED', 'FAILURE'], ['CONSUMED', 'FAILURE'], ['CONSUMED', 'SUCCESS']]);
    expect(data.original.paleEmperor).toMatchObject({ promotionWeek: 3317, life: { reflected: true }, encounter: { enemyStatus: 'DEAD' } });
    expect(data.original.combatHistory).toHaveLength(38);
    expect(Object.keys(data.original.progression.mastery)).toHaveLength(19);
    expect(Object.values(data.original.progression.mastery).filter(value => value === 0)).toHaveLength(7);
    const originalHash = hash(data.original), migrated = migrateSliceState(data.original);
    same(historicalDeathState(migrated), data.initial, 'Current migration retains every exact192->214 captured field');
    expect(Object.keys(migrated).sort()).toEqual([...Object.keys(data.initial), 'door', 'errorAscent'].sort());
    expect(hash(data.original)).toBe(originalHash); expect(originalHash).toBe(PINS.originalStateSha256);
    const global = projectSliceState(migrated); same(historicalDeathPublic(global, migrated), data.initialPublic); assertGlobalPublic(global, migrated);
    expect(hash(historicalDeathPublic(global, migrated))).toBe(PINS.initialGlobalPublicSha256); expect(hash(capturePublic(global))).toBe(PINS.initialPublicSha256);
    expect(data.checkpoint.pending).toBeNull(); expect(data.checkpoint.terminal).toEqual({ stage: PINS.stage, reason: PINS.reason });
    expect(data.checkpoint.policy).toMatchObject({ doses: 1, carriers: ['death-carrier-1'], consumedCompounds: ['death-compound-1'],
      epilogueAttempted: ['PROPAGATION_BARRIER', 'PARTIAL_SPIRIT_PASSAGE'], reported: true });
  }, 300_000);

  it.each(BLOCKS)('replays actual %i..%i with complete private/RNG/chapter/global equivalence', (first, last) => {
    let state = migrateSliceState(first === PREFIX + 1 ? data.initial : actionAt(first).beforeLast);
    let session: DeathRuntimeSession | null = state.death.guidanceKnown ? openDeathRuntimeSession(state) : null;
    let global = session ? session.project() : projectSliceState(state), prepared = 0, committed = 0, ingress = 0;
    for (const row of data.rows.filter(item => item.commandCount >= first && item.commandCount <= last)) {
      const recorded = readAction(row), before = state, beforeHash = hash(before);
      expect(hash(historicalDeathState(before))).toBe(row.beforeStateSha256); same(historicalDeathState(before), recorded.beforeLast, `Complete private before ${row.commandCount}`);
      assertCurrentGlobal(global, recorded, 'before'); assertPublicAction(capturePublic(global), row);
      expect(validateSlicePayload(row.intent)).toBe(true); expect(before.random).toEqual(recorded.randomBefore);
      expect(hash(before.random)).toBe(row.randomBeforeSha256); expect(before.status).toBe('ACTIVE');
      if (session) {
        const draft = session.prepare(row.intent, before.revision); prepared++;
        state = session.snapshotDraft(draft); global = session.projectDraft(draft);
        expect(session.inspect()).toEqual({ runId: before.runId, revision: before.revision, status: before.status });
        expect(hash(before), 'Preparing cannot mutate predecessor').toBe(beforeHash);
        same(historicalDeathState(state), recorded.final); assertCurrentGlobal(global, recorded, 'after');
        session.commit(draft); committed++;
        expect(session.inspect()).toEqual({ runId: state.runId, revision: state.revision, status: state.status });
      } else {
        expect(row.commandCount).toBe(1039); expect(row.intent).toEqual({ type: 'DEATH', command: { type: 'LEARN_GUIDANCE' } });
        state = applySliceIntent(before, row.intent); ingress++;
        expect(state.death.guidanceKnown).toBe(true); session = openDeathRuntimeSession(state); global = session.project();
      }
      expect(hash(before), 'Committing cannot mutate predecessor').toBe(beforeHash);
      same(historicalDeathState(state), recorded.final, `Complete private after ${row.commandCount}`); expect(hash(historicalDeathState(state))).toBe(row.afterStateSha256);
      assertCurrentGlobal(global, recorded, 'after'); expect(hash(historicalDeathPublic(global, state))).toBe(row.globalPublicAfterSha256);
      expect(hash(capturePublic(global))).toBe(row.publicAfterSha256);
      expect(state.random).toEqual(recorded.randomAfter); expect(hash(state.random)).toBe(row.randomAfterSha256);
      expect(state.random.seed).toBe(data.original.random.seed); expect(state.revision).toBe(before.revision + 1);
      expect([state.revision, state.week]).toEqual([row.revision, row.week]);
      expect(outcome(capturePublic(global))).toEqual(row.selectionOutcome); same(actualReceipts(state, before), row.receipts);
      if (before.death.guidanceKnown) same(state.death.source, before.death.source, 'Owned source remains exact');
    }
    expect(prepared + ingress).toBe(last - first + 1); expect(committed).toBe(prepared);
    expect(session).not.toBeNull(); same(session!.snapshot(), state); same(session!.project(), global); preserveOriginal(state);
    if (last === FINAL_COMMAND) {
      same(historicalDeathState(state), data.checkpoint.state); expect(hash(historicalDeathState(state))).toBe(PINS.finalStateSha256);
      expect(hash(historicalDeathPublic(global, state))).toBe(PINS.finalGlobalPublicSha256);
    }
  }, 300_000);

  it('retains three actual draws and same-original promotion1128 at70% roll62 with paid costs and no spirituality refill', () => {
    const draws = data.rows.filter(row => row.randomBefore.cursor !== row.randomAfter.cursor);
    expect(draws.map(row => [row.commandCount, row.randomBefore.cursor, row.randomAfter.cursor]))
      .toEqual([[1128, 490, 491], [1134, 491, 492], [1138, 492, 493]]);
    const receipts = data.checkpoint.state.death.journal.filter(row => row.randomReceipts.length).map(row => row.randomReceipts);
    expect(draws.map(row => row.receipts.checks)).toEqual(receipts);
    expect(receipts.flat().map(row => [row.check.chance, row.check.roll, row.check.tier]))
      .toEqual([[70, 62, 'SUCCESS'], [70, 43, 'SUCCESS'], [70, 24, 'SUCCESS']]);
    const action = actionAt(1128), before = action.beforeLast, state = action.final, materials = state.death.materials!;
    expect(action.lastIntent).toEqual({ type: 'DEATH', command: { type: 'CONSUME', compoundId: 'death-compound-1', confirmed: true } });
    expect(state.lastCheck).toEqual({ ability: 'will', baseAbility: 27, modifiers: [{ source: '本瓶本次实际稳定准备', value: 40 }],
      effectiveAbility: 67, difficulty: 57, chance: 70, roll: 62, tier: 'SUCCESS' });
    expect([before.progression.sequence, state.progression.sequence]).toEqual([1, 0]);
    expect([before.mind - state.mind, before.spirituality - state.spirituality, before.actionsRemaining - state.actionsRemaining]).toEqual([12, 30, 1]);
    expect([action.globalPublicBefore.maxSpirituality, action.globalPublic.maxSpirituality]).toEqual([120, 150]);
    expect([action.globalPublicBefore.spirituality, action.globalPublic.spirituality]).toEqual([108, 78]);
    expect(state.spirituality).toBeLessThan(action.globalPublic.maxSpirituality);
    expect(state.death.promotionWeek).toBe(3331); expect(state.death.epilogue).toBeNull();
    expect(DEATH_ABILITY_IDS.map(id => state.progression.mastery[id])).toEqual([0, 0]);
    expect(materials.characteristics.map(row => [row.id, row.originBottleId, row.latestBottleId, row.holder]))
      .toEqual(DEATH_ORIGINAL_IDS.map(id => [`${id}:characteristic`, id, id, 'FUSED']));
    expect(materials.uniqueness).toMatchObject({ id: 'DE0-U1', holder: 'FUSED', compoundId: 'death-compound-1' });
    expect(materials.compounds).toHaveLength(1);
    expect(materials.compounds[0]).toMatchObject({ id: 'death-compound-1', status: 'SUCCESS', consumedWeek: 3331, residualPresent: false,
      characteristicIds: ['pale-emperor-potion-1:characteristic', 'pale-emperor-potion-2:characteristic'], uniquenessId: 'DE0-U1' });
    expect(materials.batches.map(row => [row.id, row.status, row.uses])).toEqual([
      ['death-carrier-1', 'SPENT', 1], ['death-carrier-2', 'SUPPLIER', 0], ['death-carrier-3', 'SUPPLIER', 0],
    ]);
    preserveOriginal(state);
  }, 300_000);

  it('awards both finite masteries only on actual application and honestly reports1141 without repairing old damage', () => {
    for (const [castCount, applyCount, window, ability, roll, mindCost, spiritCost] of [
      [1134, 1135, 'barrier', DEATH_ABILITY_IDS[1], 43, 3, 8],
      [1138, 1139, 'passage', DEATH_ABILITY_IDS[0], 24, 4, 10],
    ] as const) {
      const cast = actionAt(castCount), applied = actionAt(applyCount), before = cast.beforeLast;
      expect(cast.final.lastCheck).toMatchObject({ chance: 70, roll, tier: 'SUCCESS' });
      expect([before.mind - cast.final.mind, before.spirituality - cast.final.spirituality]).toEqual([mindCost, spiritCost]);
      expect([before.cash, cast.final.cash, before.actionsRemaining, cast.final.actionsRemaining]).toEqual([12, 12, 0, 0]);
      expect(cast.final.death.epilogue![window].window).toMatchObject({ attempted: true, passed: true, applied: false });
      expect(cast.final.progression.mastery[ability]).toBe(0);
      same(applied.beforeLast, cast.final); expect(applied.final.lastCheck).toBeNull(); same(applied.randomBefore, applied.randomAfter);
      expect(applied.final.death.epilogue![window].window).toMatchObject({ attempted: true, passed: true, applied: true });
      expect(applied.final.progression.mastery[ability]).toBe(8);
      expect(applied.final.death.epilogue!.journal.at(-1)?.masteryGains).toEqual({ [ability]: 8 });
    }
    const final = data.checkpoint.state, incident = final.death.epilogue!, report = actionAt(1141);
    expect(final).toMatchObject({ revision: 1142, status: 'ACTIVE', week: 3331, date: { epoch: 'FIFTH_EPOCH', year: 1413, month: 4, day: 28 },
      health: 80, mind: 71, spirituality: 60, cash: 12, actionsRemaining: 0, injuries: [], injuryRisk: 0, ending: null, lastCheck: null,
      random: { seed: 'corpsecollector-natural-v032', cursor: 493 }, progression: { pathwayId: 'death', sequence: 0, acting: 0 } });
    expect(final.death.frame!.budget.pollution).toBe(0);
    expect(final.death.frame!.economy).toMatchObject({ works: 187, rests: 100, treatments: 3, weeksAdvanced: 96,
      income: 4488, expenses: 3368, emergencyWorks: 29, livingArrears: 0 });
    expect(incident).toMatchObject({ status: 'RESOLVED', reported: true,
      residue: { id: 'DE0-RESIDUE-1', total: 4, exposed: 0, contained: 3, dissipated: 1 },
      propagation: { id: 'DE0-RESIDUE-LINE-1', visible: false, remainingPulses: 0, blockedPulses: 1 },
      pulse: { outcome: 'BLOCKED', healthLost: 0 },
      wharf: { bridge: { id: 'DE0-WHARF-BRIDGE', condition: 46 }, rope: { id: 'DE0-WHARF-ROPE-1', condition: 78, stock: 0, holder: 'INSTALLED' } },
      vessel: { ownerId: 'DE0-RESIDUE-KEEPER', holderId: 'DE0-WHARF-WORKER-1', delivered: true, lid: 'CLOSED', seal: 'BROKEN' } });
    expect(incident.wharf.workers.map(worker => [worker.id, worker.health, worker.position, worker.injuries])).toEqual([
      ['DE0-WHARF-WORKER-1', 100, 12, []], ['DE0-WHARF-WORKER-2', 100, 18, ['DE0-WHARF-WORKER-2:OLD-ANKLE-SPRAIN']],
    ]);
    expect(incident.arrivals).toMatchObject([{ workerId: 'DE0-WHARF-WORKER-2', route: 'PARTIAL_SPIRIT', metres: 6, seconds: 6, energyCost: 3 }]);
    expect(DEATH_ABILITY_IDS.map(id => final.progression.mastery[id])).toEqual([8, 8]);
    for (const [cast, apply, ability] of [
      ['PROPAGATION_BARRIER', 'APPLY_BARRIER', DEATH_ABILITY_IDS[1]],
      ['PARTIAL_SPIRIT_PASSAGE', 'TRAVERSE_PASSAGE', DEATH_ABILITY_IDS[0]],
    ] as const) {
      expect(incident.journal.filter(event => event.command.type === cast)).toHaveLength(1);
      const gains = incident.journal.filter(event => (event.masteryGains[ability] ?? 0) > 0);
      expect(gains).toHaveLength(1); expect(gains[0]!.command.type).toBe(apply); expect(gains[0]!.masteryGains[ability]).toBe(8);
    }
    expect(report.lastIntent).toEqual({ type: 'DEATH', command: { type: 'EPILOGUE', command: { type: 'REPORT' } } });
    same(report.randomBefore, report.randomAfter); same(report.final, final); preserveOriginal(final);
  }, 300_000);

  it('rejects altered evidence, unknown roots, wrong sides, forged input and private leakage without editing any capture', () => {
    const action = actionAt(1128), original = hash(action), expected = { ...action.globalPublic, door: emptyDoorPublic(action.final), errorAscent: emptyErrorAscentPublic(action.final) };
    assertCurrentGlobal(expected, action, 'after');
    expect(() => assertCurrentGlobal(action.globalPublic, action, 'after')).toThrow();
    expect(() => assertCurrentGlobal({ ...expected, cash: expected.cash + 1 }, action, 'after')).toThrow();
    expect(() => assertCurrentGlobal({ ...expected, unexpectedRoot: null } as typeof expected, action, 'after')).toThrow();
    expect(() => assertCurrentGlobal({ ...expected, unexpectedRoot: undefined } as typeof expected, action, 'after')).toThrow();
    const missing = { ...expected }; Reflect.deleteProperty(missing, 'recovery');
    expect(() => assertCurrentGlobal(missing, action, 'after')).toThrow();
    expect(() => assertCurrentGlobal(expected, action, 'before')).toThrow();
    expect(() => assertCurrentGlobal(expected, { ...action, commandCount: 1129 }, 'after')).toThrow();
    expect(() => same({ ...action.final, random: { ...action.final.random, cursor: 494 } }, action.final)).toThrow();
    for (const field of [{ nextRoll: 1 }, { privateSource: action.final.death.source }, { actorId: null },
      { renderedText: action.final.random.seed }]) expect(() => assertPublicOnly(field, action.final)).toThrow();
    expect(validateSlicePayload({ type: 'DEATH', command: { type: 'CONSUME', compoundId: 'death-compound-1', confirmed: true, roll: 1 } })).toBe(false);
    expect(validateSlicePayload({ type: 'DEATH', command: { type: 'EPILOGUE', command: { type: 'PROPAGATION_BARRIER', success: true } } })).toBe(false);
    const row = structuredClone(data.rows[0]!); row.afterStateSha256 = '0'.repeat(64);
    expect(() => readAction(row)).toThrow(); row.capture.file = '../replacement.json.gz'; expect(() => readAction(row)).toThrow();
    expect(() => assertPublicAction(action.publicBefore, { ...action.audit, publicCost: 'free' })).toThrow();
    expect(hash(action)).toBe(original); expect(hash(data.original)).toBe(PINS.originalStateSha256);
  }, 300_000);
});
