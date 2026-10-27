import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { openChainedRuntimeSession } from '../../src/domain/chained/owned-session.js';
import { createChainedState, validateChainedState, validateChainedCommand } from '../../src/domain/chained/index.js';
import { CHAINED_ABILITY_IDS, CHAINED_ORIGINAL_IDS } from '../../src/domain/chained/content.js';
import { chainedHost } from '../../src/domain/chained/engine.js';
import { chainedSceneBlock } from '../../src/domain/chained/scene.js';
import { assertChainedSourceUnmodified, controlledChainedRolls, executeChained, chainedHash,
  chainedInheritedHash, chainedPublicLeaks, preparedChainedScenario } from '../helpers/chained-scenario.js';

let route: ReturnType<typeof preparedChainedScenario>, restore: (() => void) | undefined;
const rolls: Record<number, number> = {};
beforeAll(() => { restore = controlledChainedRolls(rolls); route = preparedChainedScenario(); }, 300_000);
afterAll(() => { restore?.(); assertChainedSourceUnmodified(); });

describe('Chained225 real original778 body, three originals and owned runtime', () => {
  it('rests the original mind48, walks out and preserves the second embodied original and all old people', () => {
    const { source, guided, beforeConsume: state, commands } = route, root = state.chained, scene = root.scene!;
    expect(guided.mind).toBe(48);
    expect(guided.chained.scene!.playerPosition).toBe('ORIGINAL_ENTRY');
    const departure = commands.findIndex(command => command.type === 'LEAVE_ORIGINAL_COURT');
    expect(departure).toBeGreaterThan(commands.findIndex(command => command.type === 'REST'));
    expect(commands.slice(0, departure).some(command => command.type === 'CLINIC')).toBe(false);
    expect(scene.originalDepartureEventId).toBeTruthy();
    expect(scene.originalOperation).toEqual(source.abomination.life.operation);
    expect(scene.originalBlocks).toEqual(source.abomination.encounter.blocks);
    expect(scene.evacuationReportEventId).toBeTruthy();
    expect(scene.workers.every(worker => worker.age >= 18 && worker.position === 'OUTSIDE' && worker.passage.a && worker.passage.b && worker.passage.exit)).toBe(true);
    expect(scene.cargo.filter(cargo => cargo.carrierId !== 'PLAYER').every(cargo => cargo.position === 'OUTSIDE' && cargo.passage.a && cargo.passage.b && cargo.passage.exit)).toBe(true);
    expect(root.materials!.originals.map(original => original.originalId)).toEqual([...CHAINED_ORIGINAL_IDS]);
    expect(root.materials!.originals.map(original => original.holder)).toEqual(['COMPOUND', 'EMBODIED', 'COMPOUND']);
    const remnant = root.materials!.originals[0]!;
    expect(remnant.investigationEventId).toBeTruthy(); expect(remnant.sealedEventId).toBeTruthy(); expect(remnant.recoveredEventId).toBeTruthy();
    expect(root.materials!.originals[2]!.labourSteps).toBe(5);
    expect(state.week - source.abomination.promotionWeek!).toBeGreaterThanOrEqual(12);
    expect(state.week - source.week).toBeGreaterThanOrEqual(6);
    expect(state.progression.mastery).toEqual(source.progression.mastery);
    expect(chainedInheritedHash(state)).toBe(chainedInheritedHash(source));
    expect(root.promotionStability.preparations.at(-1)!.status).toBe('READY');
  });

  it('keeps drafts isolated and rejects old routes, forged S0 and hidden-roll commands', () => {
    const session = route.session, before = chainedHash(session.snapshot());
    const projection = session.project();
    expect(chainedPublicLeaks(projection)).toEqual([]);
    expect(projection).toMatchObject({ canAct: false, maxSpirituality: 120, abomination: { promoted: true } });
    expect(projection.abomination.actions.every(action => !action.enabled)).toBe(true);
    expect(validateChainedCommand({ type: 'CONSUME', compoundId: 'x', confirmed: true, roll: 1 })).toBe(false);
    const draft = session.prepare({ type: 'CHAINED', command: { type: 'NEXT_WEEK' } }, session.inspect().revision);
    const copy = session.snapshotDraft(draft); copy.cash = 999999;
    expect(session.snapshotDraft(draft).cash).not.toBe(999999);
    expect(chainedHash(session.snapshot())).toBe(before);
    session.discard(draft);
    expect(() => session.commit(draft)).toThrow();
    expect(() => session.prepare({ type: 'ACTION', action: 'REST' }, session.inspect().revision)).toThrow();
    const forged = structuredClone(route.source); forged.progression.sequence = 0; forged.chained = createChainedState();
    expect(validateChainedState(forged)).toBe(false);
    const tampered = structuredClone(route.beforeConsume); tampered.abomination.encounter.enemyHealth++;
    expect(validateChainedState(tampered)).toBe(false);
  }, 300_000);

  it('uses one real prepared70 draw, two finite personal effects and an ordinary return', () => {
    const before = route.beforeConsume;
    const promoted = executeChained(route.session, { type: 'CONSUME', compoundId: before.chained.materials!.compounds[0]!.id, confirmed: true });
    expect(promoted.progression).toMatchObject({ pathwayId: 'chained', sequence: 0, acting: 0 });
    expect(promoted.spirituality).toBe(before.spirituality - 30);
    expect(promoted.mind).toBe(before.mind - 12);
    expect(promoted.health).toBe(before.health);
    expect(promoted.random.cursor).toBe(before.random.cursor + 1);
    expect(promoted.lastCheck).toMatchObject({ chance: 70, roll: 1 });
    expect(promoted.chained.materials!.originals.every(original => original.holder === 'FUSED')).toBe(true);
    expect(promoted.chained.materials!.uniqueness.holder).toBe('FUSED');
    expect(route.session.project()).toMatchObject({ canAct: false, maxSpirituality: 150, chained: { promoted: true }, abomination: { promoted: true } });
    assertValidSliceState(promoted);
    let binding = false, burden = false;
    for (let step = 0; step < 100; step++) {
      const current = route.session.snapshot(), scene = current.chained.scene!;
      if (scene.returnReportEventId) break;
      const action = route.session.projectChained().actions.find(candidate => candidate.preferredAction);
      if (!action?.enabled) throw Error(`Chained S0 route blocked ${JSON.stringify({ scene, actions: current.actionsRemaining, action })}`);
      const command = action.command;
      if (command.type === 'BIND_ROPE' || command.type === 'BEAR_IMPACT') {
        const withdrawn = structuredClone(scene); withdrawn.owner.consent = 'WITHDRAWN';
        expect(chainedSceneBlock(withdrawn, command, chainedHost(current.chained, 'test', current.revision + 1))).not.toBeNull();
        if (command.type === 'BIND_ROPE') binding = true; else burden = true;
      }
      const next = executeChained(route.session, command);
      if (command.type === 'BIND_ROPE' || command.type === 'BEAR_IMPACT') {
        expect(next.spirituality).toBe(current.spirituality - 12);
        expect(next.mind).toBe(current.mind - 5);
        expect(next.chained.scene!.window!.expiresAt - next.chained.scene!.window!.createdAt).toBe(20);
      }
    }
    const final = route.session.snapshot();
    expect(final.chained.scene!.returnReportEventId).toBeTruthy();
    expect(binding).toBe(true); expect(burden).toBe(true);
    expect(CHAINED_ABILITY_IDS.map(id => final.progression.mastery[id])).toEqual([8, 8]);
    expect(chainedInheritedHash(final)).toBe(chainedInheritedHash(route.source));
    expect(chainedPublicLeaks(route.session.project())).toEqual([]);
  }, 300_000);

  it('retains the same living failure materials and seals fatal loss without a fourth original', () => {
    const before = route.beforeConsume, compoundId = before.chained.materials!.compounds[0]!.id, cursor = before.random.cursor;
    try {
      rolls[cursor] = 80;
      const failed = openChainedRuntimeSession(before), state = executeChained(failed, { type: 'CONSUME', compoundId, confirmed: true });
      expect(state.status).toBe('ACTIVE'); expect(state.progression.sequence).toBe(1);
      expect(state.health).toBe(before.health - 45);
      expect(state.chained.materials!.originals).toHaveLength(3);
      expect(state.chained.materials!.uniqueness.holder).toBe('EXPOSED');
      executeChained(failed, { type: 'NEXT_WEEK' });
      expect(executeChained(failed, { type: 'SEAL_REMAINS', compoundId }).chained.materials!.compounds[0]!.status).toBe('FAILED_SEALED');
      rolls[cursor] = 100;
      const dying = openChainedRuntimeSession(before), dead = executeChained(dying, { type: 'CONSUME', compoundId, confirmed: true });
      expect(dead.status).toBe('DEAD');
      expect(dead.chained.materials!.originals.every(original => original.holder === 'DEATH_REMAINS')).toBe(true);
      expect(() => dying.prepare({ type: 'CHAINED', command: { type: 'REST' } }, dead.revision)).toThrow();
      assertValidSliceState(dead);
    } finally { delete rolls[cursor]; }
  }, 300_000);
});
