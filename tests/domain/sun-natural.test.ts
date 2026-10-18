import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { emptyDeathPublic, emptyDoorPublic } from '../helpers/empty-death-capture.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { openSunRuntimeSession, type SunRuntimeSession } from '../../src/domain/sun/owned-session.js';
import { SUN_ABILITY_IDS, SUN_ORIGINAL_IDS } from '../../src/domain/sun/types.js';
import {
  NEW_COMMANDS, PINS, PREFIX, actualReceipts, assertCurrentGlobal, assertGlobalPublic, assertPublicAction,
  authenticateInputs, capturePublic, expectedCurrentGlobal, hash, historicalSunPublic, historicalSunState, loadCapture,
  migrateCapturedSunState, outcome, readAction, same, type LoadedCapture,
} from '../helpers/sun-capture.js';

/** Original853 is authenticated historical evidence, NEVER replayed. All81 new
 * actual commands execute once in three disjoint contiguous27-command blocks.
 * One gzip action is held per iteration; source/current private state, RNG and
 * complete global public projection have separate immutable expectations. */
const BLOCKS = [[854, 880], [881, 907], [908, 934]] as const;
let data: LoadedCapture;
beforeAll(() => { data = loadCapture(); }, 120_000);
afterAll(() => { authenticateInputs(); }, 120_000);
const actionAt = (count: number) => readAction(data.rows[count - PREFIX - 1]!);
function preserveOriginal(state: SliceState): void {
  expect(state.runId).toBe(data.original.runId); expect(state.random.seed).toBe(data.original.random.seed);
  for (const key of ['bard', 'lightprayer', 'sunpriest', 'notary', 'priestOfLight', 'unshadowed',
    'justiceMentor', 'lightSeeker', 'pureWhiteAngel', 'world', 'combatHistory', 'character'] as const)
    same(state[key], data.original[key], `Original853 ${key}`);
  for (const [id, mastery] of Object.entries(data.original.progression.mastery)) expect(state.progression.mastery[id], id).toBe(mastery);
  expect(state.activeEvent).toBeNull(); expect(state.combat).toBeNull(); expect(state.eventQueue).toEqual([]); expect(state.pulse).toBe('NONE');
}

describe('Sun216 actual natural934 from unchanged original194 living853', () => {
  it('authenticates the exact original853, all81 action pins and34 selected boundaries without replaying history', () => {
    expect(data.rows).toHaveLength(81); expect(data.checkpoint.commands).toHaveLength(NEW_COMMANDS);
    expect(data.checkpoint.boundaries.map(row => row.commandCount)).toEqual(PINS.boundaryCommandCounts);
    expect(data.original).toMatchObject({ schemaVersion: 191, contentVersion: 'pure-white-angel-v191',
      revision: 854, status: 'ACTIVE', week: 196, health: 100, mind: 98, spirituality: 106, cash: 1250,
      actionsRemaining: 3, injuries: [], random: { seed: 'bard-natural-v029', cursor: 385 },
      progression: { pathwayId: 'sun', sequence: 1, acting: 100 } });
    expect(Object.keys(data.original.progression.mastery)).toHaveLength(22);
    expect(Object.values(data.original.progression.mastery).filter(value => value === 0)).toHaveLength(6);
    expect(hash(data.original)).toBe(PINS.originalStateSha256);
    expect(BLOCKS.flatMap(([first, last]) => Array.from({ length: last - first + 1 }, (_, index) => first + index)))
      .toEqual(data.rows.map(row => row.commandCount));
    expect(data.checkpoint.pending).toBeNull();
    expect(data.checkpoint.terminal).toEqual({ stage: PINS.stage, reason: PINS.reason });
    expect(data.checkpoint.policy).toMatchObject({ doses: 1, carriers: ['sun-carrier-1'],
      epilogueAttempted: ['DIRECTED_RADIANCE', 'RADIANCE_WARD'], reported: true });
  });

  it('requires exactly the empty Death and Door additions while preserving every historical field and unknown root', () => {
    const current = data.initial, raw = actionAt(854).beforeLast;
    same(historicalSunState(current), raw);
    const { death: _missingDeath, ...missing } = current;
    expect(() => historicalSunState(missing as SliceState)).toThrow();
    for (const death of [null, { ...current.death, guidanceKnown: true },
      { ...current.death, unexpectedField: undefined },
      { ...current.death, promotionStability: { preparations: [], unexpectedField: undefined } }])
      expect(() => historicalSunState({ ...current, death } as SliceState)).toThrow();
    expect(() => migrateCapturedSunState({ ...raw, death: current.death })).toThrow();
    const { door: _missingDoor, ...missingDoor } = current;
    expect(() => historicalSunState(missingDoor as SliceState)).toThrow();
    for (const door of [null, { ...current.door, guidanceKnown: true },
      { ...current.door, unexpectedField: undefined },
      { ...current.door, promotionStability: { preparations: [], unexpectedField: undefined } }])
      expect(() => historicalSunState({ ...current, door } as SliceState)).toThrow();
    expect(() => migrateCapturedSunState({ ...raw, door: current.door })).toThrow();
    const originalHash = hash(raw);
    expect(hash(historicalSunState({ ...current, unknownRoot: null } as SliceState))).not.toBe(originalHash);
    expect(hash(historicalSunState({ ...current, cash: current.cash + 1 }))).not.toBe(originalHash);
    const projection = projectSliceState(current), historical = historicalSunPublic(projection, current);
    expect(Object.hasOwn(historical, 'death')).toBe(false);
    for (const death of [null, { ...projection.death, promoted: true },
      { ...projection.death, unexpectedField: undefined }])
      expect(() => historicalSunPublic({ ...projection, death } as typeof projection, current)).toThrow();
    expect(Object.hasOwn(historical, 'door')).toBe(false);
    for (const door of [null, { ...projection.door, promoted: true },
      { ...projection.door, unexpectedField: undefined }])
      expect(() => historicalSunPublic({ ...projection, door } as typeof projection, current)).toThrow();
    expect(hash(historicalSunPublic({ ...projection, unknownRoot: null } as typeof projection, current)))
      .not.toBe(hash(historical));
  });

  it.each(BLOCKS)('replays actual %i..%i with complete private/RNG/chapter/global equivalence', (first, last) => {
    let state = first === PREFIX + 1 ? structuredClone(data.initial) : migrateCapturedSunState(actionAt(first).beforeLast);
    let session: SunRuntimeSession | null = state.sun.guidanceKnown ? openSunRuntimeSession(state) : null;
    let global = session ? session.project() : projectSliceState(state), prepared = 0, committed = 0, ingress = 0;
    for (const row of data.rows.filter(item => item.commandCount >= first && item.commandCount <= last)) {
      const recorded = readAction(row), before = state, beforeHash = hash(before);
      expect(hash(historicalSunState(before))).toBe(row.beforeStateSha256);
      same(historicalSunState(before), recorded.beforeLast, `Complete private before ${row.commandCount}`);
      assertCurrentGlobal(global, recorded, 'before'); assertGlobalPublic(global, before);
      expect(hash(historicalSunPublic(global, before))).toBe(hash(expectedCurrentGlobal(recorded, 'before')));
      assertPublicAction(capturePublic(global), row); expect(validateSlicePayload(row.intent)).toBe(true);
      expect(before.random).toEqual(recorded.randomBefore); expect(hash(before.random)).toBe(row.randomBeforeSha256);
      expect(before.status).toBe('ACTIVE');
      if (session) {
        const draft = session.prepare(row.intent, before.revision); prepared++;
        state = session.snapshotDraft(draft); global = session.projectDraft(draft);
        expect(session.inspect()).toEqual({ runId: before.runId, revision: before.revision, status: before.status });
        expect(hash(before), 'Preparing cannot mutate predecessor').toBe(beforeHash);
        same(historicalSunState(state), recorded.final); assertCurrentGlobal(global, recorded, 'after');
        session.commit(draft); committed++;
        expect(session.inspect()).toEqual({ runId: state.runId, revision: state.revision, status: state.status });
      } else {
        expect(row.commandCount).toBe(854); expect(row.intent).toEqual({ type: 'SUN', command: { type: 'LEARN_GUIDANCE' } });
        state = applySliceIntent(before, row.intent); ingress++;
        expect(state.sun.guidanceKnown).toBe(true); session = openSunRuntimeSession(state); global = session.project();
      }
      expect(hash(before), 'Committing cannot mutate predecessor').toBe(beforeHash);
      same(historicalSunState(state), recorded.final, `Complete private after ${row.commandCount}`);
      expect(hash(historicalSunState(state))).toBe(row.afterStateSha256);
      assertCurrentGlobal(global, recorded, 'after'); assertGlobalPublic(global, state);
      expect(hash(historicalSunPublic(global, state))).toBe(hash(expectedCurrentGlobal(recorded, 'after')));
      expect(hash(capturePublic(global))).toBe(hash(capturePublic(expectedCurrentGlobal(recorded, 'after'))));
      expect(state.random).toEqual(recorded.randomAfter); expect(hash(state.random)).toBe(row.randomAfterSha256);
      expect(state.random.seed).toBe(data.original.random.seed); expect(state.revision).toBe(before.revision + 1);
      expect([state.revision, state.week]).toEqual([row.revision, row.week]);
      expect(outcome(capturePublic(global))).toEqual(row.selectionOutcome); same(actualReceipts(state, before), row.receipts);
      if (before.sun.guidanceKnown) same(state.sun.source, before.sun.source, 'Owned source remains unchanged');
    }
    expect(prepared + ingress).toBe(27); expect(committed).toBe(prepared);
    expect(session).not.toBeNull(); same(session!.snapshot(), state); same(session!.project(), global);
    preserveOriginal(state);
    if (last === 934) { same(historicalSunState(state), data.checkpoint.state); expect(hash(historicalSunState(state))).toBe(PINS.finalStateSha256); }
  }, 120_000);

  it('retains exactly three actual draws and their paid, non-rerolled outcomes', () => {
    const draws = data.rows.filter(row => row.randomBefore.cursor !== row.randomAfter.cursor);
    expect(draws.map(row => [row.commandCount, row.randomBefore.cursor, row.randomAfter.cursor]))
      .toEqual([[923, 385, 386], [929, 386, 387], [931, 387, 388]]);
    expect(draws.map(row => row.receipts.checks)).toEqual(data.checkpoint.state.sun.journal
      .filter(row => row.randomReceipts.length).map(row => row.randomReceipts));
    expect(data.checkpoint.state.sun.journal.flatMap(row => row.randomReceipts)
      .map(row => [row.check.chance, row.check.roll, row.check.tier]))
      .toEqual([[74, 57, 'SUCCESS'], [70, 14, 'SUCCESS'], [70, 95, 'FAILURE']]);
  });

  it('permits exactly the guidance854 gating/reason and promotion923 maximum corrections, rejecting omissions, extra changes and wrong actions', () => {
    const reason = '请在当前街区与筹备处继续行动。';
    const recoveryPaths = [
      ['locked'], ['blockedReason'],
      ['actions', 'rest', 'enabled'], ['actions', 'rest', 'reason'],
      ['actions', 'discover', 'enabled'], ['actions', 'discover', 'reason'],
      ['actions', 'work', 'enabled'], ['actions', 'work', 'reason'],
      ['actions', 'aid', 'enabled'], ['actions', 'aid', 'reason'],
      ['nextAction', 'enabled'], ['nextAction', 'reason'],
    ] as const;
    for (const count of [854, 855, 923, 934]) {
      const action = actionAt(count), rawHash = hash(action), fields = ['maxSpirituality', 'canAct', 'actionBlockedReason'] as const;
      for (const side of ['before', 'after'] as const) {
        const raw = side === 'before' ? action.globalPublicBefore : action.globalPublic;
        const chapter = side === 'before' ? action.publicBefore : action.public;
        const state = side === 'before' ? action.beforeLast : action.final;
        const guided = count !== 854 || side === 'after', promoted = count === 934 || count === 923 && side === 'after';
        const patch = { maxSpirituality: promoted ? 150 : 120, canAct: guided ? false : raw.canAct,
          actionBlockedReason: guided ? reason : null };
        const recovery = guided ? { ...raw.recovery, locked: true, blockedReason: reason,
          actions: { ...raw.recovery.actions,
            rest: { ...raw.recovery.actions.rest, enabled: false, reason },
            discover: { ...raw.recovery.actions.discover, enabled: false, reason },
            work: { ...raw.recovery.actions.work, enabled: false, reason },
            aid: { ...raw.recovery.actions.aid, enabled: false, reason } },
          nextAction: { ...raw.recovery.nextAction, enabled: false, reason } } : raw.recovery;
        const expected = expectedCurrentGlobal(action, side);
        same(expected, { ...raw, ...patch, recovery },
          'Every public key and value is compared; only the three central fields and twelve named derived recovery leaves may differ');
        same(capturePublic(expected), { ...chapter, ...patch });
        same(expected.recovery.actions.pay, raw.recovery.actions.pay, 'Event-choice payment gating remains frozen');
        same(expected.recovery.actions.credit, raw.recovery.actions.credit, 'Event-choice credit gating remains frozen');
        expect(state.sun.guidanceKnown).toBe(guided); expect(state.sun.source !== null).toBe(guided);
        expect([raw.maxSpirituality, expected.maxSpirituality]).toEqual(promoted ? [30, 150] : [120, 120]);
        const currentExpected = { ...expected, death: emptyDeathPublic(state), door: emptyDoorPublic(state) };
        assertCurrentGlobal(currentExpected, action, side);
        if (guided) expect(() => assertCurrentGlobal({ ...raw, death: emptyDeathPublic(state), door: emptyDoorPublic(state) }, action, side)).toThrow();
        else {
          same(expected, raw, '854-before remains completely unchanged');
          expect(raw.canAct).toBe(true); expect(raw.actionBlockedReason).toBeNull(); expect(state.sun.source).toBeNull();
          expect(() => assertCurrentGlobal({ ...currentExpected, canAct: false }, action, side)).toThrow();
          expect(() => assertCurrentGlobal({ ...currentExpected, actionBlockedReason: '请在当前街区与筹备处继续行动。' }, action, side)).toThrow();
        }
        for (const field of fields) {
          if (raw[field] !== expected[field])
            expect(() => assertCurrentGlobal({ ...currentExpected, [field]: raw[field] }, action, side), `Missing correction: ${field}`).toThrow();
          const missing = { ...currentExpected }; Reflect.deleteProperty(missing, field);
          expect(() => assertCurrentGlobal(missing, action, side), `Missing public key: ${field}`).toThrow();
        }
        // Cover every newly allowed leaf at the exact guidance boundary, and
        // again at the injured/action-exhausted final boundary. An already-false
        // captured flag has no missing correction, but deletion or a new value
        // must still fail. No recovery object or field is excluded from equality.
        if (count === 854 || count === 934 && side === 'after') {
          for (const path of recoveryPaths) {
            const key = path.at(-1)!;
            const parent = (view: typeof expected): Record<string, unknown> => {
              let object = view.recovery as unknown as Record<string, unknown>;
              for (const part of path.slice(0, -1)) object = object[part] as Record<string, unknown>;
              return object;
            };
            const actualValue = parent(expected)[key], rawValue = parent(raw)[key];
            const name = `recovery.${path.join('.')}`;
            if (actualValue !== rawValue) {
              const omitted = structuredClone(currentExpected); parent(omitted)[key] = rawValue;
              expect(() => assertCurrentGlobal(omitted, action, side), `Missing correction: ${name}`).toThrow();
            }
            const missing = structuredClone(currentExpected); Reflect.deleteProperty(parent(missing), key);
            expect(() => assertCurrentGlobal(missing, action, side), `Missing public key: ${name}`).toThrow();
            const extra = structuredClone(currentExpected);
            parent(extra)[key] = typeof actualValue === 'boolean' ? !actualValue : 'Unexpected recovery reason';
            expect(() => assertCurrentGlobal(extra, action, side), `Extra change: ${name}`).toThrow();
          }
          for (const name of ['pay', 'credit'] as const) {
            const changed = structuredClone(currentExpected);
            changed.recovery.actions[name] = { enabled: true, reason };
            expect(() => assertCurrentGlobal(changed, action, side), `Unreviewed event choice: ${name}`).toThrow();
          }
          const extraRecovery = structuredClone(currentExpected);
          Reflect.set(extraRecovery.recovery, 'unexpectedRecoveryField', null);
          expect(() => assertCurrentGlobal(extraRecovery, action, side)).toThrow();
          const changedGuidance = structuredClone(currentExpected); changedGuidance.recovery.guidance += ' changed';
          expect(() => assertCurrentGlobal(changedGuidance, action, side)).toThrow();
        }
        expect(() => assertCurrentGlobal({ ...currentExpected, cash: expected.cash + 1 }, action, side)).toThrow();
        expect(() => assertCurrentGlobal({ ...currentExpected, unexpectedRoot: null } as typeof expected, action, side)).toThrow();
        const missingOther = { ...currentExpected }; Reflect.deleteProperty(missingOther, 'cash');
        expect(() => assertCurrentGlobal(missingOther, action, side)).toThrow();
        expect(() => assertCurrentGlobal(currentExpected, action, side === 'before' ? 'after' : 'before')).toThrow();
        expect(() => expectedCurrentGlobal({ ...action, commandCount: count + 1 }, side)).toThrow();
      }
      if (count === 854) {
        const next = actionAt(855);
        same(action.final, next.beforeLast); same(action.globalPublic, next.globalPublicBefore);
        expect(() => assertCurrentGlobal({ ...expectedCurrentGlobal(action, 'after'), death: emptyDeathPublic(action.final), door: emptyDoorPublic(action.final) }, next, 'after')).toThrow();
        expect(() => expectedCurrentGlobal({ ...action, lastIntent: next.lastIntent }, 'after')).toThrow();
        const sourceMissing = { ...action, final: { ...action.final, sun: { ...action.final.sun, source: null } } };
        expect(() => expectedCurrentGlobal(sourceMissing, 'after')).toThrow();
        const guidanceMissing = { ...action, final: { ...action.final, sun: { ...action.final.sun, guidanceKnown: false } } };
        expect(() => expectedCurrentGlobal(guidanceMissing, 'after')).toThrow();
        const inactive = { ...action, final: { ...action.final, status: 'DEAD' as const } };
        expect(() => expectedCurrentGlobal(inactive, 'after')).toThrow();
        const eventActive = structuredClone(action); Reflect.set(eventActive.final, 'activeEvent', 'LIFE-CARE-01');
        expect(() => expectedCurrentGlobal(eventActive, 'after')).toThrow();
        const currentEvent = structuredClone(action); currentEvent.globalPublic.recovery.nextAction.kind = 'CURRENT_EVENT';
        expect(() => expectedCurrentGlobal(currentEvent, 'after')).toThrow();
      }
      if (count === 923 || count === 934) assertCurrentGlobal(projectSliceState(migrateCapturedSunState(action.final)), action, 'after');
      expect(hash(action), 'Complete original capture, public/private states and RNG remain untouched').toBe(rawHash);
    }
  }, 120_000);

  it('consumes the same original three characteristics and unique object at real74% roll57, with both new skills initially zero', () => {
    const action = actionAt(923), before = action.beforeLast, state = action.final, materials = state.sun.materials!;
    expect(action.lastIntent).toEqual({ type: 'SUN', command: { type: 'CONSUME', compoundId: 'sun-compound-1', confirmed: true } });
    expect(state.lastCheck).toEqual({ ability: 'will', baseAbility: 30, modifiers: [{ source: '本瓶本次实际稳定准备', value: 40 }],
      effectiveAbility: 70, difficulty: 58, chance: 74, roll: 57, tier: 'SUCCESS' });
    expect([before.progression.sequence, state.progression.sequence]).toEqual([1, 0]);
    expect([before.mind - state.mind, before.spirituality - state.spirituality, before.actionsRemaining - state.actionsRemaining]).toEqual([12, 30, 1]);
    expect(state.sun.promotionWeek).toBe(214); expect(state.sun.epilogue).toBeNull();
    expect(SUN_ABILITY_IDS.map(id => state.progression.mastery[id])).toEqual([0, 0]);
    expect(materials.characteristics.map(row => [row.originBottleId, row.latestBottleId, row.holder]))
      .toEqual(SUN_ORIGINAL_IDS.map(id => [id, id, 'FUSED']));
    expect(materials.uniqueness).toMatchObject({ id: 'SU0-U1', holder: 'FUSED', compoundId: 'sun-compound-1' });
    expect(materials.compounds).toHaveLength(1); expect(materials.compounds[0]).toMatchObject({ status: 'SUCCESS', consumedWeek: 214 });
    expect(materials.batches.map(row => [row.id, row.status, row.uses])).toEqual([
      ['sun-carrier-1', 'SPENT', 1], ['sun-carrier-2', 'SUPPLIER', 0], ['sun-carrier-3', 'SUPPLIER', 0],
    ]);
    preserveOriginal(state);
  });

  it('grants the150 maximum only to authentic923 Sun0 without refilling spirituality or admitting forged promotion history', () => {
    const action = actionAt(923), before = migrateCapturedSunState(action.beforeLast), state = migrateCapturedSunState(action.final);
    const beforePublic = projectSliceState(before), afterPublic = projectSliceState(state);
    expect(before.progression).toMatchObject({ pathwayId: 'sun', sequence: 1 });
    expect(state.progression).toMatchObject({ pathwayId: 'sun', sequence: 0 });
    expect(before.sun.promotionWeek).toBeNull(); expect(state.sun.promotionWeek).toBe(214);
    expect([beforePublic.maxSpirituality, afterPublic.maxSpirituality]).toEqual([120, 150]);
    expect([beforePublic.spirituality, afterPublic.spirituality]).toEqual([before.spirituality, state.spirituality]);
    expect(afterPublic.spirituality).toBe(beforePublic.spirituality - 30);
    expect(afterPublic.spirituality).toBeLessThan(afterPublic.maxSpirituality);
    expect(state.sun.journal.at(-1)?.command).toEqual({ type: 'CONSUME', compoundId: 'sun-compound-1', confirmed: true });

    const bareZero = structuredClone(before); bareZero.progression.sequence = 0;
    const missingSuccess = structuredClone(state); missingSuccess.sun.journal = structuredClone(before.sun.journal);
    for (const [label, forged] of [['S1 relabelled as0', bareZero], ['S0 missing actual successful consumption', missingSuccess]] as const) {
      expect(() => projectSliceState(forged), label).toThrow();
      expect(() => assertValidSliceState(forged), label).toThrow();
    }
    same(before, action.beforeLast, 'Resource projection cannot mutate the actual S1 predecessor');
    same(state, action.final, 'Resource projection cannot refill or mutate the actual S0 successor');
  }, 120_000);

  it('requires actual application after directed-radiance success before granting8 mastery or removing any of the four original residues', () => {
    for (const count of [929, 930]) {
      const action = actionAt(count), state = action.final, applied = count === 930, incident = state.sun.epilogue!;
      expect(incident.radiance).toMatchObject({ attempted: true, passed: true, applied });
      expect(incident.heat.cassette).toMatchObject({ total: 4, exposed: applied ? 0 : 4, neutralized: applied ? 4 : 0, contained: 0 });
      expect(state.progression.mastery[SUN_ABILITY_IDS[0]]).toBe(applied ? 8 : 0);
      expect(state.progression.mastery[SUN_ABILITY_IDS[1]]).toBe(0);
      expect(state.random).toEqual({ seed: 'bard-natural-v029', cursor: 387 });
      if (!applied) {
        expect(state.lastCheck).toMatchObject({ chance: 70, roll: 14, tier: 'SUCCESS' });
        expect([action.beforeLast.cash - state.cash, action.beforeLast.mind - state.mind,
          action.beforeLast.spirituality - state.spirituality, action.beforeLast.actionsRemaining - state.actionsRemaining]).toEqual([8, 8, 14, 1]);
      } else expect(state.lastCheck).toBeNull();
    }
  });

  it('keeps actual ward70% roll95 failure, its light wound and every cost through ordinary rescue and honest report934', () => {
    const failed = actionAt(931), before = failed.beforeLast, state = failed.final, final = data.checkpoint.state;
    expect(state.lastCheck).toMatchObject({ chance: 70, roll: 95, tier: 'FAILURE' });
    expect([before.health - state.health, before.cash - state.cash, before.mind - state.mind,
      before.spirituality - state.spirituality, before.actionsRemaining - state.actionsRemaining]).toEqual([8, 6, 6, 12, 1]);
    expect(state.sun.epilogue!.ward).toMatchObject({ attempted: true, passed: false, applied: false });
    expect(final).toMatchObject({ revision: 935, status: 'ACTIVE', week: 215, health: 92, mind: 64, spirituality: 38,
      cash: 36, actionsRemaining: 0, injuryRisk: 1, ending: null, lastCheck: null,
      random: { seed: 'bard-natural-v029', cursor: 388 }, progression: { sequence: 0 } });
    same(final.injuries, state.injuries); expect(final.injuries).toEqual([
      { id: 'R216:bard-rebuild-natural:932:sun-thermal-injury', severity: 'LIGHT', acquiredRevision: 932, treatedRevision: null },
    ]);
    const incident = final.sun.epilogue!;
    expect(incident).toMatchObject({ status: 'RESOLVED', reported: true,
      arrival: { route: 'SIDE', residentMeters: 18, helperMeters: 4, thermalHealthLoss: 0 },
      resident: { id: 'SUN0-TOMAS', health: 100, position: 0, travelledMeters: 42, injuries: [] },
      shelteredResident: { id: 'SUN0-LENA', injuries: ['原有脚踝扭伤，仍需普通照料'] },
      heat: { id: 'SUN0-BOILER-1', condition: 72, cutoffClosed: true, pressure: 0,
        cassette: { total: 4, neutralized: 4, exposed: 0, contained: 0 } } });
    expect(incident.heat.fuel.map(row => row.holder)).toEqual(['BURNED', 'BURNED']);
    expect(SUN_ABILITY_IDS.map(id => final.progression.mastery[id])).toEqual([8, 0]);
    preserveOriginal(final);
  });

  it('rejects forged results, unknown roots, repeated finite attempts and private projection leakage without editing evidence', () => {
    const final = migrateCapturedSunState(data.checkpoint.state), before = hash(final), session = openSunRuntimeSession(final), global = session.project();
    expect(() => migrateCapturedSunState({ ...data.checkpoint.state, unexpectedRoot: null } as SliceState)).toThrow();
    expect(() => same(historicalSunState({ ...final, cash: final.cash + 1 }), historicalSunState(final))).toThrow();
    expect(() => same(historicalSunPublic({ ...global, unexpectedRoot: null } as typeof global, final), historicalSunPublic(global, final))).toThrow();
    expect(() => assertGlobalPublic({ ...global, nextRoll: 1 } as typeof global, final)).toThrow();
    expect(() => assertGlobalPublic({ ...global, privateSource: final.sun.source } as typeof global, final)).toThrow();
    expect(validateSlicePayload({ type: 'SUN', command: { type: 'EPILOGUE', command: { type: 'RADIANCE_WARD', success: true } } })).toBe(false);
    expect(validateSlicePayload({ type: 'SUN', command: { type: 'CONSUME', compoundId: 'sun-compound-1', confirmed: true, roll: 1 } })).toBe(false);
    for (const type of ['DIRECTED_RADIANCE', 'RADIANCE_WARD', 'REPORT'] as const)
      expect(() => session.prepare({ type: 'SUN', command: { type: 'EPILOGUE', command: { type } } }, final.revision)).toThrow();
    const row = structuredClone(data.rows[0]!); row.afterStateSha256 = '0'.repeat(64);
    expect(() => readAction(row)).toThrow(); row.capture.file = '../replacement.json.gz'; expect(() => readAction(row)).toThrow();
    expect(hash(final)).toBe(before); same(session.snapshot(), final); same(session.project(), global);
  }, 120_000);
});
