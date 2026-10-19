/** Directed campaign continuations, NOT naturally obtained S0 evidence.
 * Every state starts at the unchanged 823-command S1 source. The only RNG seam
 * is the declared first promotion draw at cursor 205; later draws are genuine.
 * No body, finance, material, AP, history or scene state is grafted or donated. */
import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { openDoorRuntimeSession, type DoorRuntimeSession } from '../../src/domain/door/owned-session.js';
import { DOOR_CONSUMPTION, DOOR_PROMOTION_STABILITY } from '../../src/domain/door/content.js';
import { DOOR_MATERIAL_POLICY } from '../../src/domain/door/material-content.js';
import { DOOR_EPILOGUE_POLICY as EP, DOOR_EPILOGUE_SCENE as SCENE } from '../../src/domain/door/epilogue-content.js';
import { DOOR_ABILITY_IDS, type DoorCommand, type DoorEvent } from '../../src/domain/door/types.js';
import { doorServiceVerifiedReceipts } from '../../src/domain/door/services.js';
import { SLICE_LIFE } from '../../src/content/slice-events.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import {
  authenticDoorSource, assertDoorPublicBoundary, assertUnmodifiedDoorInput,
  controlledDoorSuccess, doorInheritedHash, doorScenarioHash, installControlledDoorPromotion,
  DOOR_CONTROLLED_CURSOR, DOOR_CONTROLLED_SEED,
} from '../helpers/door-scenario.js';

const fullHistoryBudget = 300_000;
const [ESCAPE, SEAL] = DOOR_ABILITY_IDS;

function preferred(session: DoorRuntimeSession): DoorCommand {
  const panel = session.projectDoor(), action = panel.actions.find(item => item.preferredAction);
  if (!action?.enabled) throw Error(`Actual Door continuation stopped: ${panel.nextStep}`);
  return structuredClone(action.command);
}
function step(session: DoorRuntimeSession, command: DoorCommand): SliceState {
  const previous = session.inspect(), draft = session.prepare({ type: 'DOOR', command }, previous.revision);
  expect(session.inspect()).toEqual(previous);
  session.commit(draft);
  expect(session.inspect()).toMatchObject({ revision: previous.revision + 1, status: 'ACTIVE' });
  return session.snapshot();
}
function retainOldSkills(source: SliceState, state: SliceState): void {
  for (const [id, mastery] of Object.entries(source.progression.mastery)) expect(state.progression.mastery[id], id).toBe(mastery);
  expect(doorInheritedHash(state)).toBe(doorInheritedHash(source));
}
function sameWeekCost(event: DoorEvent, cash: number, actions: number, seconds: number): void {
  expect(event.after.nowSecond - event.before.nowSecond).toBe(seconds);
  if (event.before.budget.week === event.after.budget.week) {
    expect(event.after.budget.cash).toBe(event.before.budget.cash - cash);
    expect(event.after.budget.actions).toBe(event.before.budget.actions - actions);
  } else {
    // A real weekly bill may add a debit and reset AP, never refund this cost.
    expect(event.after.budget.cash).toBeLessThanOrEqual(event.before.budget.cash - cash);
    expect(event.financeReceipts.length).toBeGreaterThan(0);
    expect(event.after.budget.actions).toBe(event.after.finance.weeklyBudget);
  }
}
function preparedRoute() {
  const source = authenticDoorSource(), sourceHash = doorScenarioHash(source);
  const guided = applySliceIntent(source, { type: 'DOOR', command: { type: 'LEARN_GUIDANCE' } });
  const session = openDoorRuntimeSession(guided), commands: DoorCommand[] = [{ type: 'LEARN_GUIDANCE' }];
  for (;;) {
    const command = preferred(session);
    if (commands.length > 260) throw Error('Actual Door preparation did not reach the first real bottle');
    if (command.type === 'CONSUME') return { source, sourceHash, session, commands, before: session.snapshot(), consume: command };
    step(session, command); commands.push(command);
  }
}

/** Account for ordinary healing and wages from committed events rather than
 * writing resources into a saved body to manufacture an affordable retry. */
function assertRecoveryEconomy(events: DoorEvent[], state: SliceState, wage: number): void {
  const materials = state.door.materials!;
  for (const event of events) {
    const before = event.before.budget, after = event.after.budget, command = event.command;
    expect(event.randomReceipts).toEqual([]);
    expect(event.after.random).toEqual(event.before.random);
    if (command.type === 'WORK') {
      expect(after.cash).toBeLessThanOrEqual(before.cash + wage);
      if (before.week === after.week) expect(after.cash - before.cash).toBe(wage);
      expect(event.after.finance.wagePaidWeek).toBe(before.week);
      sameWeekCost(event, -wage, 1, 28800);
    } else {
      expect(after.cash).toBeLessThanOrEqual(before.cash);
      if (command.type === 'CLINIC') {
        sameWeekCost(event, 60, 1, 3600);
        expect(after.health).toBe(before.health);
        expect(after.injuries.filter(injury => injury.severity === 'HEAVY').every(injury => injury.treatedRevision === event.revision)).toBe(true);
      } else if (command.type === 'REST') {
        const life = SLICE_LIFE[event.before.finance.lifeTier];
        sameWeekCost(event, 0, 1, 28800);
        expect(after.health).toBe(Math.min(100, before.health + life.health));
        expect(after.mind).toBe(Math.min(100, before.mind + life.mind));
        expect(after.spirituality).toBe(Math.min(120, before.spirituality + Math.round(120 * life.spirituality)));
        expect(after.pollution).toBe(Math.max(0, before.pollution - 10));
        for (const injury of before.injuries.filter(injury => injury.severity === 'HEAVY' && injury.treatedRevision === null))
          expect(after.injuries).toContainEqual(injury);
      } else if (command.type === 'MATERIAL') {
        const receipt = materials.receipts.find(item => item.eventId === event.id)!;
        expect(receipt).toBeDefined();
        sameWeekCost(event, receipt.effect.cashCost, receipt.effect.actions, receipt.effect.seconds);
      } else if (command.type === 'STABILIZE_PROMOTION') {
        sameWeekCost(event, DOOR_PROMOTION_STABILITY.cash, DOOR_PROMOTION_STABILITY.actions, DOOR_PROMOTION_STABILITY.seconds);
        expect(after.spirituality).toBe(before.spirituality - DOOR_PROMOTION_STABILITY.spirituality);
        expect(after.mind).toBe(before.mind - DOOR_PROMOTION_STABILITY.mind);
      } else if (command.type === 'TRAVEL' || command.type === 'RETURN_ON_FOOT') {
        sameWeekCost(event, 0, command.type === 'TRAVEL' ? 1 : 0, command.type === 'TRAVEL' ? 1800 : 7200);
      } else if (command.type === 'NEXT_WEEK') {
        expect(after.week).toBe(before.week + 1);
        expect(after.actions).toBe(event.after.finance.weeklyBudget);
        expect(after.health).toBe(before.health); expect(after.mind).toBe(before.mind);
        expect(after.spirituality).toBe(before.spirituality);
        expect(after.cash).toBeLessThan(before.cash);
        expect(event.after.nowSecond).toBe(event.before.weekAnchor + 604800);
      } else throw Error(`Unexpected recovery command ${command.type}`);
    }
    if (command.type !== 'REST') expect(after.health).toBe(before.health);
  }
}

describe('Door directed authentic-history continuation without resource or state donations', () => {
  it('keeps a controlled living failure, then pays for clinic, rest, sealed recovery and the next actual prepared bottle', () => {
    const seam = installControlledDoorPromotion(80);
    try {
      const route = preparedRoute(), { source, session, before, consume } = route;
      expect(seam.substituted).toEqual([]);
      expect(source).toMatchObject({ revision: 1131, health: 80, random: { cursor: 205 } });
      expect(before.door.journal.some(event => event.command.type === 'REST')).toBe(true);
      expect(before.door.journal.some(event => event.command.type === 'CLINIC')).toBe(false);
      expect(before.injuries).toEqual([]);
      const failed = step(session, consume), failedHash = doorScenarioHash(failed);
      expect(failed).toMatchObject({ status: 'ACTIVE', ending: null, progression: { sequence: 1 },
        lastCheck: { chance: 70, roll: 80, tier: 'FAILURE' },
        random: { seed: DOOR_CONTROLLED_SEED, cursor: DOOR_CONTROLLED_CURSOR + 1 } });
      expect(failed.health).toBe(before.health - DOOR_CONSUMPTION.failureHealth);
      expect(failed.mind).toBe(before.mind - DOOR_CONSUMPTION.failureMind);
      expect(failed.spirituality).toBe(before.spirituality - DOOR_CONSUMPTION.spirituality);
      expect(failed.seer.pollution).toBe(before.seer.pollution + DOOR_CONSUMPTION.failurePollution);
      expect(failed.injuries.at(-1)).toMatchObject({ severity: 'HEAVY', acquiredRevision: failed.revision, treatedRevision: null });
      expect(failed.injuryRisk).toBe(before.injuryRisk + 2);
      expect(failed.progression).toEqual(before.progression); expect(failed.door.promotionWeek).toBeNull();
      sameWeekCost(failed.door.journal.at(-1)!, 0, 1, 3600);
      const originals = failed.door.materials!, failedPotion = originals.compounds.at(-1)!;
      expect(failedPotion).toMatchObject({ id: consume.compoundId, status: 'FAILED_EXPOSED', recoveredEventId: null });
      expect(originals.settlements.at(-1)).toMatchObject({ compoundId: consume.compoundId, success: false, alive: true });
      for (const item of originals.characteristics) expect(item.holder).toBe(item.originBottleId === originals.embodiedOriginalBottleId ? 'EMBODIED' : 'EXPOSED');
      expect(originals.uniqueness.holder).toBe('EXPOSED');
      expect(originals.batches.map(batch => [batch.status, batch.uses])).toEqual([['SPENT', 1], ['SUPPLIER', 0], ['SUPPLIER', 0]]);
      expect(failed.door.promotionStability.preparations.at(-1)).toMatchObject({ status: 'SPENT', compoundId: consume.compoundId });
      const beforeRejected = doorScenarioHash(session.snapshot());
      expect(() => session.prepare({ type: 'DOOR', command: consume }, failed.revision)).toThrow();
      expect(doorScenarioHash(session.snapshot())).toBe(beforeRejected);

      const seal = preferred(session);
      expect(seal).toEqual({ type: 'MATERIAL', command: { type: 'SEAL_REMAINS', compoundId: consume.compoundId } });
      const sealed = step(session, seal), sealedPotion = sealed.door.materials!.compounds[0]!;
      expect(sealedPotion).toMatchObject({ status: 'FAILED_SEALED', sealedWeek: sealed.week, sealedSecond: sealed.door.frame!.nowSecond });
      sameWeekCost(sealed.door.journal.at(-1)!, 0, 0, DOOR_MATERIAL_POLICY.sealSeconds);
      const recovery: DoorCommand = { type: 'MATERIAL', command: { type: 'RECOVER_SEALED', compoundId: consume.compoundId } };
      expect(() => session.prepare({ type: 'DOOR', command: recovery }, sealed.revision)).toThrow();
      expect(session.snapshot()).toEqual(sealed);
      let state = sealed, next: Extract<DoorCommand, { type: 'CONSUME' }> | undefined;
      const commands: DoorCommand[] = [seal];
      while (commands.length < 120) {
        const command = preferred(session);
        if (command.type === 'CONSUME') { next = command; break; }
        state = step(session, command); commands.push(command);
      }
      expect(next).toBeDefined(); expect(next!.compoundId).not.toBe(consume.compoundId);
      expect(state.random).toEqual(failed.random);
      expect(state.health).toBeGreaterThanOrEqual(80); expect(state.mind).toBeGreaterThanOrEqual(70);
      expect(state.spirituality).toBeGreaterThanOrEqual(30); expect(state.injuries).toEqual([]);
      expect(state.progression.sequence).toBe(1); expect(state.ending).toBeNull();
      const events = state.door.journal.slice(failed.door.journal.length), materials = state.door.materials!;
      expect(events.some(event => event.command.type === 'CLINIC')).toBe(true);
      expect(events.some(event => event.command.type === 'REST')).toBe(true);
      expect(events.some(event => event.command.type === 'NEXT_WEEK')).toBe(true);
      assertRecoveryEconomy(events, state, source.character.weeklyWage);
      const recovered = events.find(event => event.command.type === 'MATERIAL' && event.command.command.type === 'RECOVER_SEALED')!;
      expect(recovered.before.budget.week).toBeGreaterThan(sealedPotion.sealedWeek!);
      expect(materials.receipts.find(receipt => receipt.eventId === recovered.id)!.effect).toEqual({ actions: 1, cashCost: 60, seconds: 1800 });
      expect(materials.compounds.map(potion => potion.status)).toEqual(['RECOVERED', 'PREPARED']);
      expect(materials.compounds[0]).toMatchObject({ id: consume.compoundId, recoveredEventId: recovered.id,
        settlementEventId: failedPotion.settlementEventId, sealedEventId: sealedPotion.sealedEventId });
      expect(materials.compounds[1]).toMatchObject({ id: next!.compoundId, batchId: 'door-carrier-2', consumedWeek: null });
      expect(materials.compounds[1]!.characteristicIds).toEqual(failedPotion.characteristicIds);
      expect(materials.compounds[1]!.uniquenessId).toBe(failedPotion.uniquenessId);
      expect(materials.characteristics.map(item => item.id)).toEqual(originals.characteristics.map(item => item.id));
      expect(materials.characteristics.find(item => item.originBottleId === materials.embodiedOriginalBottleId)).toEqual(originals.characteristics.find(item => item.originBottleId === originals.embodiedOriginalBottleId));
      expect(materials.batches.map(batch => [batch.status, batch.uses])).toEqual([['SPENT', 1], ['IN_COMPOUND', 1], ['SUPPLIER', 0]]);
      expect(materials.receipts.filter(receipt => receipt.command.type === 'BUY_COMPOUND').map(receipt => receipt.effect.cashCost)).toEqual([50, 70]);
      expect(materials.settlements).toEqual(originals.settlements);
      expect(state.door.promotionStability.preparations.map(preparation => [preparation.compoundId, preparation.status])).toEqual([[consume.compoundId, 'SPENT'], [next!.compoundId, 'READY']]);
      expect(doorServiceVerifiedReceipts(state.door.services!)).toEqual(doorServiceVerifiedReceipts(failed.door.services!));
      retainOldSkills(source, state);
      assertValidSliceState(state); // Strict cold replay still uses only the declared promotion seam.
      const view = projectSliceState(state); assertDoorPublicBoundary(view, state);
      expect(view).toMatchObject({ status: 'ACTIVE', maxSpirituality: 120, canAct: false, health: state.health });
      expect(view.door.actions.find(action => action.command.type === 'CONSUME' && action.command.compoundId === next!.compoundId)).toMatchObject({ enabled: true, preferredAction: true });
      expect(doorScenarioHash(failed)).toBe(failedHash); expect(doorScenarioHash(source)).toBe(route.sourceHash);
      expect(seam.substituted.length).toBeGreaterThan(0);
      expect(seam.substituted.every(draw => draw.cursorBefore === 205 && draw.cursorAfter === 206 && draw.controlled === 80)).toBe(true);
      assertUnmodifiedDoorInput();
    } finally { seam.restore(); }
  }, fullHistoryBudget);

  it('reaches the real finite epilogue from an independent controlled paid promotion, with genuine later draws and ordinary fallback', () => {
    const seam = installControlledDoorPromotion(1);
    try {
      const scenario = controlledDoorSuccess(seam), originalHash = doorScenarioHash(scenario.source), successHash = doorScenarioHash(scenario.success);
      const session = openDoorRuntimeSession(scenario.success);
      let state = scenario.success, beforeStart: SliceState | undefined;
      const prelude: DoorCommand[] = [];
      while (state.door.epilogue === null && prelude.length < 40) {
        const command = preferred(session);
        if (command.type === 'START_EPILOGUE') beforeStart = state;
        state = step(session, command); prelude.push(command);
      }
      expect(beforeStart).toBeDefined(); expect(state.door.epilogue).not.toBeNull();
      expect(prelude.at(-1)?.type).toBe('START_EPILOGUE');
      expect(state.door.frame!.location).toBe(SCENE.location);
      sameWeekCost(state.door.journal.at(-1)!, 0, 0, 600);
      const started = state, startedHash = doorScenarioHash(started), startScene = state.door.epilogue!;
      expect(startScene.worker).toMatchObject({ id: SCENE.workerId, age: 34, health: 96, position: 8, trapped: true, injuries: [SCENE.workerInjury] });
      expect(startScene.trolley).toMatchObject({ id: SCENE.trolleyId, ownerId: SCENE.workerId, holderId: SCENE.workerId, quantity: 1, condition: 84 });
      const commands: DoorCommand[] = [];
      while (!state.door.epilogue!.reported && commands.length < 20) {
        const panel = session.projectDoor(), command = preferred(session), previous = state;
        expect(command.type).toBe('EPILOGUE');
        if (command.type !== 'EPILOGUE') throw Error('An actual active scene must not silently leave its own command boundary');
        if (state.door.epilogue!.status === 'ACTIVE') {
          expect(panel.actions.find(action => action.command.type === 'EPILOGUE' && action.command.command.type === 'WITHDRAW')).toMatchObject({ enabled: true });
          if (state.door.epilogue!.observed && !state.door.epilogue!.isolated)
            expect(panel.actions.find(action => action.command.type === 'EPILOGUE' && action.command.command.type === 'ISOLATE_AND_FREE')).toMatchObject({ enabled: true });
        }
        state = step(session, command); commands.push(command);
        const scene = state.door.epilogue!, event = scene.journal.at(-1)!;
        expect(event.afterSecond - event.beforeSecond).toBe(event.effect.seconds);
        expect(state.door.frame!.nowSecond - previous.door.frame!.nowSecond).toBe(event.effect.seconds);
        expect(event.effect.cashGain).toBe(0);
        sameWeekCost(state.door.journal.at(-1)!, event.effect.cashCost, event.effect.actions, event.effect.seconds);
        expect(state.spirituality).toBe(previous.spirituality - event.effect.spirituality);
        expect(state.mind).toBe(previous.mind - event.effect.mind);
        expect(state.health).toBe(previous.health - event.effect.health);
        for (const ability of DOOR_ABILITY_IDS)
          expect(state.progression.mastery[ability]).toBe(previous.progression.mastery[ability]! + (event.masteryGains[ability] ?? 0));
        if (command.command.type === 'CONCEPTUAL_ESCAPE' || command.command.type === 'SEAL_EXIT') {
          const escape = command.command.type === 'CONCEPTUAL_ESCAPE', cost = escape ? EP.escape : EP.seal;
          const window = escape ? scene.escape : scene.seal, ability = escape ? ESCAPE : SEAL;
          expect(event.effect).toMatchObject({ cashCost: cost.cashCost, actions: 1, spirituality: cost.spirituality, mind: cost.mind, seconds: cost.seconds });
          expect(event.masteryGains).toEqual({}); expect(state.progression.mastery[ability]).toBe(0);
          expect(window).toMatchObject({ attempted: true, applied: false });
          expect(escape ? scene.supplies.focus : scene.supplies.seal).toMatchObject({ stock: 0, holder: 'SPENT', spentEventId: event.eventId });
          if (window.passed) expect(window.expiresSecond! - window.openedSecond!).toBe(cost.windowSeconds);
          else expect(preferred(session)).toEqual({ type: 'EPILOGUE', command: { type: 'ISOLATE_AND_FREE' } });
          const unchanged = doorScenarioHash(state);
          expect(() => session.prepare({ type: 'DOOR', command }, state.revision)).toThrow();
          expect(doorScenarioHash(session.snapshot())).toBe(unchanged);
        }
        for (const [window, ability, impact] of [[scene.escape, ESCAPE, scene.impacts.spring], [scene.seal, SEAL, scene.impacts.exit]] as const) {
          expect(state.progression.mastery[ability]).toBe(window.applied ? 8 : 0);
          if (window.applied) {
            expect(window.appliedEventId).toBeTruthy(); expect(window.appliedSecond).toBe(impact.dueSecond);
            expect(impact.resolvedSecond).toBe(impact.dueSecond);
            expect(impact.status).toBe(ability === ESCAPE ? 'AVOIDED' : 'HELD');
          }
        }
        retainOldSkills(scenario.source, state);
      }
      const final = state, scene = final.door.epilogue!;
      expect(scene).toMatchObject({ status: 'RESOLVED', reported: true, playerPosition: 0, playerMetres: 32,
        worker: { position: 0, trapped: false, health: 96, travelledMetres: 24, injuries: [SCENE.workerInjury] },
        trolley: { id: SCENE.trolleyId, ownerId: SCENE.workerId, holderId: SCENE.workerId, quantity: 1, condition: 84, position: 0, travelledMetres: 24 },
        arrival: { routeId: SCENE.ordinaryExitId, workerId: SCENE.workerId, trolleyId: SCENE.trolleyId, metres: 24 } });
      expect(commands.length).toBeLessThan(20);
      expect(scene.journal.filter(event => event.command.type === 'CONCEPTUAL_ESCAPE')).toHaveLength(1);
      expect(scene.journal.filter(event => event.command.type === 'SEAL_EXIT').length).toBeLessThanOrEqual(1);
      const draws = final.door.journal.slice(started.door.journal.length).flatMap(event => event.randomReceipts);
      expect(draws.length).toBeGreaterThan(0); expect(draws.length).toBeLessThanOrEqual(2);
      const genuine = new DeterministicActionRandomStream(DOOR_CONTROLLED_SEED, DOOR_CONTROLLED_CURSOR + 1);
      for (const draw of draws) {
        expect(draw.cursorBefore).toBe(genuine.cursor); expect(draw.check.roll).toBe(genuine.nextInt(1, 100));
        expect(draw.cursorAfter).toBe(genuine.cursor);
      }
      expect(final.random.cursor).toBe(genuine.cursor);
      expect(final.door.materials).toEqual(scenario.success.door.materials);
      expect(final.door.services).toEqual(scenario.success.door.services);
      expect(session.projectDoor().actions.some(action => action.preferredAction)).toBe(false);
      assertValidSliceState(final);
      const view = projectSliceState(final); assertDoorPublicBoundary(view, final);
      expect(view).toMatchObject({ status: 'ACTIVE', maxSpirituality: 150, spirituality: final.spirituality,
        health: final.health, mind: final.mind, canAct: false });
      expect(view.door.resources).toMatchObject({ maxSpirituality: 150, spirituality: final.spirituality,
        health: final.health, mind: final.mind, actionsRemaining: final.actionsRemaining });
      expect(view.door.sections.find(section => section.id === 'epilogue')).toBeDefined();

      // Independent ordinary branch from the actual pre-incident save. Spend
      // the remaining AP through real REST commands, then rescue without casts.
      // This is a declared alternate continuation, not a changed scene/body.
      const ordinary = openDoorRuntimeSession(beforeStart!);
      let safe = beforeStart!, restCount = 0;
      while (safe.actionsRemaining > 0 && restCount++ < 8) safe = step(ordinary, { type: 'REST' });
      expect(safe.actionsRemaining).toBe(0);
      safe = step(ordinary, { type: 'START_EPILOGUE' });
      const ordinaryStart = safe;
      for (const type of ['OBSERVE', 'ISOLATE_AND_FREE', 'GUIDE_SIDE_EXIT', 'REPORT'] as const) {
        expect(preferred(ordinary)).toEqual({ type: 'EPILOGUE', command: { type } });
        safe = step(ordinary, { type: 'EPILOGUE', command: { type } });
      }
      const ordinaryScene = safe.door.epilogue!;
      expect(ordinaryScene).toMatchObject({ status: 'RESOLVED', reported: true, isolated: true,
        worker: { health: 96, injuries: [SCENE.workerInjury], position: 0 },
        trolley: { condition: 84, quantity: 1, position: 0 }, brake: { condition: 70, applied: true },
        escape: { attempted: false, applied: false }, seal: { attempted: false, applied: false } });
      expect(safe.actionsRemaining).toBe(0); expect(safe.cash).toBe(ordinaryStart.cash);
      expect(safe.health).toBe(ordinaryStart.health); expect(safe.mind).toBe(ordinaryStart.mind);
      expect(safe.spirituality).toBe(ordinaryStart.spirituality); expect(safe.random).toEqual(ordinaryStart.random);
      expect(safe.door.frame!.nowSecond - ordinaryStart.door.frame!.nowSecond).toBe(110);
      expect(ordinaryScene.journal.every(event => event.check === null && Object.keys(event.masteryGains).length === 0)).toBe(true);
      expect(safe.door.materials).toEqual(scenario.success.door.materials);
      expect(safe.door.services).toEqual(scenario.success.door.services);
      expect(ordinaryScene.supplies.focus.stock).toBe(1); expect(ordinaryScene.supplies.seal.stock).toBe(1);
      expect(safe.progression.mastery[ESCAPE]).toBe(0); expect(safe.progression.mastery[SEAL]).toBe(0);
      retainOldSkills(scenario.source, safe);
      assertValidSliceState(safe); assertDoorPublicBoundary(ordinary.project(), safe);
      expect(doorScenarioHash(started)).toBe(startedHash);
      expect(doorScenarioHash(scenario.source)).toBe(originalHash); expect(doorScenarioHash(scenario.success)).toBe(successHash);
      expect(seam.substituted.every(draw => draw.cursorBefore === 205 && draw.cursorAfter === 206 && draw.controlled === 1)).toBe(true);
      assertUnmodifiedDoorInput();
    } finally { seam.restore(); }
  }, fullHistoryBudget);
});
