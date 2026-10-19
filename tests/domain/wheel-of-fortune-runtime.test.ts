import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { openWheelOfFortuneRuntimeSession } from '../../src/domain/wheel-of-fortune/owned-session.js';
import { createWheelOfFortuneState, validateWheelOfFortuneState, validateWheelOfFortuneCommand } from '../../src/domain/wheel-of-fortune/index.js';
import { WHEEL_OF_FORTUNE_ABILITY_IDS, WHEEL_OF_FORTUNE_ORIGINAL_IDS } from '../../src/domain/wheel-of-fortune/content.js';
import { wheelOfFortuneHost } from '../../src/domain/wheel-of-fortune/engine.js';
import { wheelOfFortuneSceneBlock } from '../../src/domain/wheel-of-fortune/scene.js';
import { assertWheelOfFortuneSourceUnmodified, controlledWheelOfFortuneRolls, executeWheelOfFortune, wheelOfFortuneHash,
  wheelOfFortuneInheritedHash, wheelOfFortunePublicLeaks, preparedWheelOfFortuneScenario } from '../helpers/wheel-of-fortune-scenario.js';

let route: ReturnType<typeof preparedWheelOfFortuneScenario>, restore: (() => void) | undefined;
const rolls: Record<number, number> = {};
beforeAll(() => { restore = controlledWheelOfFortuneRolls(rolls); route = preparedWheelOfFortuneScenario(); }, 300_000);
afterAll(() => { restore?.(); assertWheelOfFortuneSourceUnmodified(); });

describe('WheelOfFortune226 real original841 body, three originals and owned runtime', () => {
  it('pays from the original20, rests the light injury and witnesses two irreversible real handovers', () => {
    const { source, guided, beforeConsume: state, commands } = route, root = state.wheelOfFortune, scene = root.scene!;
    expect(guided.cash).toBe(0); expect(guided.mind).toBe(88); expect(guided.health).toBe(90);
    expect(guided.injuries).toEqual(source.injuries);
    expect(guided.wheelOfFortune.scene!.playerPosition).toBe('ORIGINAL_ENTRY');
    expect(commands.some(command => command.type === 'WORK')).toBe(true);
    expect(scene.originalDepartureEventId).toBeTruthy();
    expect(scene.originalOperation).toEqual(source.mercurySnake.life.operation);
    expect(scene.originalLuck).toEqual(source.mercurySnake.luck);
    const commission = scene.commissions[scene.commissionIndex]!;
    expect(commission.reportEventId).toBeTruthy(); expect(commission.opportunityWeek).toBe(state.week);
    expect(commission.consumedEventId).toBeNull();
    expect(commission.workers.every(worker => worker.age >= 18 && worker.position === worker.destination && worker.cargo.position === worker.destination && worker.decisionEventId && worker.handoverEventId && worker.destinationEventId)).toBe(true);
    expect(root.materials!.originals.map(original => original.originalId)).toEqual([...WHEEL_OF_FORTUNE_ORIGINAL_IDS]);
    expect(root.materials!.originals.map(original => original.holder)).toEqual(['COMPOUND', 'EMBODIED', 'COMPOUND']);
    const remnant = root.materials!.originals[0]!;
    expect(remnant.investigationEventId).toBeTruthy(); expect(remnant.sealedEventId).toBeTruthy(); expect(remnant.recoveredEventId).toBeTruthy();
    expect(root.materials!.originals[2]!.labourSteps).toBe(5);
    expect(state.week - source.mercurySnake.promotionWeek!).toBeGreaterThanOrEqual(12);
    expect(state.progression.mastery).toEqual(source.progression.mastery);
    expect(wheelOfFortuneInheritedHash(state)).toBe(wheelOfFortuneInheritedHash(source));
    expect(root.promotionStability.preparations.at(-1)!.status).toBe('READY');
  });

  it('keeps drafts isolated and rejects old routes, forged S0 and hidden-roll commands', () => {
    const session = route.session, before = wheelOfFortuneHash(session.snapshot());
    const projection = session.project();
    expect(wheelOfFortunePublicLeaks(projection)).toEqual([]);
    expect(projection).toMatchObject({ canAct: false, maxSpirituality: 120, mercurySnake: { promoted: true } });
    expect(projection.mercurySnake.actions.every(action => !action.enabled)).toBe(true);
    expect(validateWheelOfFortuneCommand({ type: 'CONSUME', compoundId: 'x', confirmed: true, roll: 1 })).toBe(false);
    const draft = session.prepare({ type: 'WHEEL_OF_FORTUNE', command: { type: 'NEXT_WEEK' } }, session.inspect().revision);
    const copy = session.snapshotDraft(draft); copy.cash = 999999;
    expect(session.snapshotDraft(draft).cash).not.toBe(999999);
    expect(wheelOfFortuneHash(session.snapshot())).toBe(before);
    session.discard(draft);
    expect(() => session.commit(draft)).toThrow();
    expect(() => session.prepare({ type: 'ACTION', action: 'REST' }, session.inspect().revision)).toThrow();
    const forged = structuredClone(route.source); forged.progression.sequence = 0; forged.wheelOfFortune = createWheelOfFortuneState();
    expect(validateWheelOfFortuneState(forged)).toBe(false);
    const tampered = structuredClone(route.beforeConsume); tampered.mercurySnake.encounter.enemyHealth++;
    expect(validateWheelOfFortuneState(tampered)).toBe(false);
    const scene = structuredClone(route.beforeConsume.wheelOfFortune.scene!);
    const commission = scene.commissions[scene.commissionIndex]!;
    const chosen = commission.workers[0]!;
    expect(wheelOfFortuneSceneBlock(scene, { type: 'CHOOSE_DESTINATION', workerId: chosen.id, destination: 'NORTH_DEPOT' }, wheelOfFortuneHost(route.beforeConsume.wheelOfFortune, 'test', route.beforeConsume.revision + 1))).not.toBeNull();
    expect(wheelOfFortuneSceneBlock(scene, { type: 'NEXT_COMMISSION' }, wheelOfFortuneHost(route.beforeConsume.wheelOfFortune, 'test', route.beforeConsume.revision + 1))).not.toBeNull();
  }, 300_000);

  it('uses one real prepared70 draw, two finite personal effects and an ordinary return', () => {
    const before = route.beforeConsume;
    const promoted = executeWheelOfFortune(route.session, { type: 'CONSUME', compoundId: before.wheelOfFortune.materials!.compounds[0]!.id, confirmed: true });
    expect(promoted.progression).toMatchObject({ pathwayId: 'wheel', sequence: 0, acting: 0 });
    expect(promoted.spirituality).toBe(before.spirituality - 30);
    expect(promoted.mind).toBe(before.mind - 12);
    expect(promoted.health).toBe(before.health);
    expect(promoted.random.cursor).toBe(before.random.cursor + 1);
    expect(promoted.lastCheck).toMatchObject({ chance: 70, roll: 1 });
    expect(promoted.wheelOfFortune.materials!.originals.every(original => original.holder === 'FUSED')).toBe(true);
    expect(promoted.wheelOfFortune.materials!.uniqueness.holder).toBe('FUSED');
    expect(route.session.project()).toMatchObject({ canAct: false, maxSpirituality: 150, wheelOfFortune: { promoted: true }, mercurySnake: { promoted: true } });
    assertValidSliceState(promoted);
    let binding = false, burden = false;
    for (let step = 0; step < 100; step++) {
      const current = route.session.snapshot(), scene = current.wheelOfFortune.scene!;
      if (scene.returnReportEventId) break;
      const action = route.session.projectWheelOfFortune().actions.find(candidate => candidate.preferredAction);
      if (!action?.enabled) throw Error(`WheelOfFortune S0 route blocked ${JSON.stringify({ scene, actions: current.actionsRemaining, action })}`);
      const command = action.command;
      if (command.type === 'BUFFER_IMPACT' || command.type === 'CAPTURE_RETURN') {
        const withdrawn = structuredClone(scene); withdrawn.owner.consent = 'WITHDRAWN';
        expect(wheelOfFortuneSceneBlock(withdrawn, command, wheelOfFortuneHost(current.wheelOfFortune, 'test', current.revision + 1))).not.toBeNull();
        if (command.type === 'BUFFER_IMPACT') binding = true; else burden = true;
      }
      const next = executeWheelOfFortune(route.session, command);
      if (command.type === 'BUFFER_IMPACT' || command.type === 'CAPTURE_RETURN') {
        expect(next.spirituality).toBe(current.spirituality - 12);
        expect(next.mind).toBe(current.mind - 5);
        expect(next.wheelOfFortune.scene!.window!.expiresAt - next.wheelOfFortune.scene!.window!.createdAt).toBe(20);
      }
    }
    const final = route.session.snapshot();
    expect(final.wheelOfFortune.scene!.returnReportEventId).toBeTruthy();
    expect(binding).toBe(true); expect(burden).toBe(true);
    expect(WHEEL_OF_FORTUNE_ABILITY_IDS.map(id => final.progression.mastery[id])).toEqual([8, 8]);
    expect(wheelOfFortuneInheritedHash(final)).toBe(wheelOfFortuneInheritedHash(route.source));
    expect(wheelOfFortunePublicLeaks(route.session.project())).toEqual([]);
  }, 300_000);

  it('retains the same living failure materials and seals fatal loss without a fourth original', () => {
    const before = route.beforeConsume, compoundId = before.wheelOfFortune.materials!.compounds[0]!.id, cursor = before.random.cursor;
    try {
      rolls[cursor] = 80;
      const failed = openWheelOfFortuneRuntimeSession(before), state = executeWheelOfFortune(failed, { type: 'CONSUME', compoundId, confirmed: true });
      expect(state.status).toBe('ACTIVE'); expect(state.progression.sequence).toBe(1);
      expect(state.health).toBe(before.health - 45);
      expect(state.wheelOfFortune.materials!.originals).toHaveLength(3);
      expect(state.wheelOfFortune.materials!.uniqueness.holder).toBe('EXPOSED');
      executeWheelOfFortune(failed, { type: 'NEXT_WEEK' });
      expect(executeWheelOfFortune(failed, { type: 'SEAL_REMAINS', compoundId }).wheelOfFortune.materials!.compounds[0]!.status).toBe('FAILED_SEALED');
      rolls[cursor] = 100;
      const dying = openWheelOfFortuneRuntimeSession(before), dead = executeWheelOfFortune(dying, { type: 'CONSUME', compoundId, confirmed: true });
      expect(dead.status).toBe('DEAD');
      expect(dead.wheelOfFortune.materials!.originals.every(original => original.holder === 'DEATH_REMAINS')).toBe(true);
      expect(() => dying.prepare({ type: 'WHEEL_OF_FORTUNE', command: { type: 'REST' } }, dead.revision)).toThrow();
      assertValidSliceState(dead);
    } finally { delete rolls[cursor]; }
  }, 300_000);
});
