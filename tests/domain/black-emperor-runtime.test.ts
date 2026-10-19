import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { gameDaysBetween } from '../../src/domain/game-calendar.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { BlackEmperorState } from '../../src/domain/black-emperor/types.js';
import { openBlackEmperorRuntimeSession } from '../../src/domain/black-emperor/owned-session.js';
import { createBlackEmperorState, validateBlackEmperorState, validateBlackEmperorCommand } from '../../src/domain/black-emperor/index.js';
import { BLACK_EMPEROR_ABILITY_IDS, BLACK_EMPEROR_CITIES, BLACK_EMPEROR_CONSTRUCTION, BLACK_EMPEROR_ORIGINAL_IDS } from '../../src/domain/black-emperor/content.js';
import { blackEmperorConsumeBlock, blackEmperorHost } from '../../src/domain/black-emperor/engine.js';
import { applyBlackEmperorScene, blackEmperorSceneBlock } from '../../src/domain/black-emperor/scene.js';
import { assertBlackEmperorSourceUnmodified, controlledBlackEmperorRolls, executeBlackEmperor, blackEmperorHash,
  blackEmperorInheritedHash, blackEmperorPublicLeaks, preparedBlackEmperorScenario } from '../helpers/black-emperor-scenario.js';

let route: ReturnType<typeof preparedBlackEmperorScenario>, restore: (() => void) | undefined;
const rolls: Record<number, number> = {};
beforeAll(() => { restore = controlledBlackEmperorRolls(rolls); route = preparedBlackEmperorScenario(); }, 300_000);
afterAll(() => { restore?.(); assertBlackEmperorSourceUnmodified(); });

describe('BlackEmperor227 original924 body, real three-city country and owned runtime', () => {
  it('pays from the injured original140, completes three mandates and spends27 real weeks building nine independent tombs', () => {
    const { source, guided, beforeConsume: state, commands } = route, root = state.blackEmperor, scene = root.scene!, materials = root.materials!;
    expect(guided.cash).toBe(120); expect(guided.actionsRemaining).toBe(0);
    expect(guided.health).toBe(80); expect(guided.mind).toBe(71); expect(guided.spirituality).toBe(97);
    expect(guided.injuries).toEqual(source.injuries); expect(guided.injuries).toHaveLength(2);
    expect(guided.blackEmperor.scene!.realm).toMatchObject({ ownerId: null, ownerName: null, charterEventId: null, establishedWeek: null, totalPopulation: 90000 });
    for (const city of guided.blackEmperor.scene!.realm.cities) {
      expect(city.taskEventId).toBeNull(); expect(city.mandateEventId).toBeNull(); expect(city.ownershipEventId).toBeNull();
      expect(city.nameProclamation).toBeNull(); expect(city.knowNameCount).toBe(0); expect(city.knowEmperorCount).toBe(0);
      expect(city.stocks).toEqual(city.initialStocks); expect(city.tombs.every(tomb => tomb.stage === 0)).toBe(true);
    }
    expect(commands.some(command => command.type === 'WORK')).toBe(true);
    expect(commands.some(command => command.type === 'REST')).toBe(true);
    expect(state.injuries).toEqual([]); expect(state.injuryRisk).toBe(0);
    expect(scene.originalOperation).toEqual(source.princeOfAbolition.life.operation);
    expect(scene.originalGifts).toEqual(source.princeOfAbolition.gifts);
    expect(blackEmperorInheritedHash(state)).toBe(blackEmperorInheritedHash(source));
    expect(state.progression.mastery).toEqual(source.progression.mastery);
    expect(materials.originals.map(original => original.originalId)).toEqual([...BLACK_EMPEROR_ORIGINAL_IDS]);
    expect(materials.originals.map(original => original.holder)).toEqual(['COMPOUND', 'COMPOUND', 'EMBODIED']);
    for (const original of materials.originals.slice(0, 2)) {
      expect(original.failedConsumptionRevision).toBeTruthy();
      expect(original.permissionEventId).toBeTruthy(); expect(original.investigationEventId).toBeTruthy();
      expect(original.sealedEventId).toBeTruthy(); expect(original.recoveredEventId).toBeTruthy();
      const events = root.journal.filter(event => 'originalId' in event.command && event.command.originalId === original.originalId);
      const investigated = events.find(event => event.command.type === 'INVESTIGATE_REMAINS')!;
      const sealed = events.find(event => event.command.type === 'SEAL_ORIGINAL')!;
      const recovered = events.find(event => event.command.type === 'RECOVER_ORIGINAL')!;
      expect(investigated.before.budget.cash - investigated.after.budget.cash).toBe(120);
      expect(recovered.before.budget.cash - recovered.after.budget.cash).toBe(30);
      expect(recovered.before.nowSecond - sealed.after.nowSecond).toBeGreaterThanOrEqual(604800);
      expect(recovered.before.budget.week).toBeGreaterThan(sealed.after.budget.week);
    }
    expect(materials.uniqueness).toMatchObject({ id: 'BE227-UNIQUENESS', holder: 'COMPOUND' });
    expect(materials.uniqueness.verifiedEventId).toBeTruthy(); expect(materials.uniqueness.acquiredEventId).toBeTruthy();
    expect(scene.realm.ownerId).toBe(root.source!.actorId); expect(scene.realm.ownerName).toBe(source.character.name);
    expect(scene.realm.charterEventId).toBeTruthy(); expect(scene.realm.cities).toHaveLength(3);
    expect(scene.realm.cities.reduce((sum, city) => sum + city.population, 0)).toBe(90000);
    const founded = root.journal.findIndex(event => event.command.type === 'FOUND_REALM');
    expect(founded).toBeGreaterThan(-1);
    for (const city of scene.realm.cities) {
      expect(city.population).toBe(BLACK_EMPEROR_CITIES.find(definition => definition.id === city.id)!.population);
      expect(city.taskEventId).toBeTruthy(); expect(city.task.eventId).toBe(city.taskEventId);
      expect(city.task.beneficiaries).toBeGreaterThan(0); expect(city.mandateEventId).toBeTruthy(); expect(city.ownershipEventId).toBeTruthy();
      const taskIndex = root.journal.findIndex(event => event.command.type === 'SOLVE_CITY_TASK' && event.command.cityId === city.id);
      expect(taskIndex).toBeGreaterThan(-1); expect(taskIndex).toBeLessThan(founded);
      if (city.task.kind === 'SUPPLY') expect(city.task.deliveredFood).toBeGreaterThan(0);
      else if (city.task.kind === 'ROAD') expect(city.task.roadMetres).toBe(300);
      else expect(city.task.settledClaims).toBe(6);
      expect(city.orderEvents).toHaveLength(6);
      expect(new Set(city.orderEvents.map(event => event.clauseId)).size).toBe(6);
      expect(city.orderEvents.every(event => event.participants > 0 && event.eventId)).toBe(true);
      expect(city.orderEvents.some(event => event.building && event.stone > 0 && event.timber > 0 && event.wages > 0)).toBe(true);
      expect(city.nameProclamation).toMatchObject({ actualName: source.character.name, title: '皇帝' });
      expect(city.nameProclamation!.eventId).toBeTruthy();
      expect(city.nameProclamation!.heardCount + city.nameProclamation!.witnessedCount + city.nameProclamation!.publicNoticeCount).toBeGreaterThan(0);
      expect(city.knowNameCount).toBeGreaterThan(city.population / 2); expect(city.knowNameCount).toBeLessThanOrEqual(city.population);
      expect(city.knowEmperorCount).toBeGreaterThan(city.population / 2); expect(city.knowEmperorCount).toBeLessThanOrEqual(city.population);
      expect(city.tombs).toHaveLength(3);
      for (const tomb of city.tombs) {
        expect(tomb).toMatchObject({ cityId: city.id, structure: 'PYRAMIDAL', stage: 3, integrity: 100, publicCoordinatesDisclosed: false, access: 'CLOSED_CONSTRUCTION' });
        expect(tomb.privateSite).toBeTruthy(); expect(tomb.confidentialPermitEventId).toBeTruthy();
        expect(tomb.stageEvents.map(event => event.stage)).toEqual([1, 2, 3]);
        expect(tomb.stageEvents.every(event => event.eventId && event.workers > 0 && event.labourDays > 0)).toBe(true);
        expect(tomb.stoneSpent).toBe(BLACK_EMPEROR_CONSTRUCTION.stonePerTomb * 3);
        expect(tomb.timberSpent).toBe(BLACK_EMPEROR_CONSTRUCTION.timberPerTomb * 3);
        expect(tomb.wagesPaid).toBe(BLACK_EMPEROR_CONSTRUCTION.wagesPerTomb * 3);
        expect(tomb.labourDaysSpent).toBe(BLACK_EMPEROR_CONSTRUCTION.labourDaysPerTomb * 3);
      }
      const spent = (key: 'stoneSpent' | 'timberSpent' | 'wagesPaid' | 'labourDaysSpent') => city.tombs.reduce((sum, tomb) => sum + tomb[key], 0);
      expect(city.initialStocks.stone - city.stocks.stone).toBeGreaterThanOrEqual(spent('stoneSpent'));
      expect(city.initialStocks.timber - city.stocks.timber).toBeGreaterThanOrEqual(spent('timberSpent'));
      expect(city.initialStocks.cash - city.stocks.cash).toBeGreaterThanOrEqual(spent('wagesPaid'));
      expect(city.initialStocks.labourDays - city.stocks.labourDays).toBeGreaterThanOrEqual(spent('labourDaysSpent'));
      expect(Object.values(city.stocks).every(value => value >= 0)).toBe(true);
    }
    expect(new Set(scene.realm.cities.flatMap(city => city.tombs.map(tomb => tomb.id))).size).toBe(9);
    expect(scene.constructionReceipts).toHaveLength(9);
    expect(scene.constructionReceipts.reduce((sum, receipt) => sum + receipt.weeks, 0)).toBe(27);
    for (const receipt of scene.constructionReceipts) {
      expect(receipt.endWeek - receipt.startWeek).toBe(3); expect(receipt.tombIds).toHaveLength(3);
      expect(receipt.damagedTombId).toBeNull(); expect(receipt.treasury).toBe(450);
      expect(receipt.stone).toBe(180); expect(receipt.timber).toBe(90); expect(receipt.labourDays).toBe(2160);
      const event = root.journal.find(candidate => candidate.id === receipt.eventId)!;
      expect(event.command.type).toBe('NEXT_CONSTRUCTION');
      expect(event.after.budget.week - event.before.budget.week).toBe(3);
      expect(gameDaysBetween(event.before.budget.date, event.after.budget.date)).toBe(21);
      expect(event.financeReceipts.length).toBeGreaterThan(0);
      expect(event.before.budget.cash - event.after.budget.cash).toBe(receipt.personalCost);
      expect(receipt.personalCost).toBeGreaterThan(0);
      expect([event.after.budget.health, event.after.budget.mind, event.after.budget.spirituality])
        .toEqual([event.before.budget.health, event.before.budget.mind, event.before.budget.spirituality]);
    }
    const festival = scene.festivals.find(candidate => candidate.id === scene.activeFestivalId)!;
    expect(festival.preparedEventId).toBeTruthy(); expect(festival.heldEventId).toBeTruthy(); expect(festival.consumedEventId).toBeNull();
    expect(festival.cityPreparations).toHaveLength(3); expect(festival.participation).toHaveLength(3);
    expect(festival.participation.reduce((sum, city) => sum + city.population, 0)).toBe(90000);
    for (const participation of festival.participation) {
      expect(participation.participants).toBeGreaterThan(participation.population / 2);
      expect(participation).toMatchObject({ actualName: source.character.name, emperorAcknowledged: true });
      expect(participation.eventId).toBeTruthy();
    }
    expect(scene.playerPosition).toBe('MAUSOLEUM'); expect(scene.enteredTombId).toBeTruthy(); expect(scene.tombEntryEventId).toBeTruthy();
    expect(scene.realm.cities.flatMap(city => city.tombs).find(tomb => tomb.id === scene.enteredTombId)).toMatchObject({ stage: 3, integrity: 100 });
    expect(root.journal.some(event => event.command.type === 'ENTER_MAUSOLEUM' && event.command.tombId === scene.enteredTombId)).toBe(true);
    expect(root.promotionStability.preparations.at(-1)!.status).toBe('READY');
    expect(state.week - source.week).toBeGreaterThanOrEqual(27);
  }, 300_000);

  it('isolates owned drafts, rejects forged roots and keeps country, nine tombs and actual ritual entry as hard gates', () => {
    const session = route.session, before = blackEmperorHash(session.snapshot()), projection = session.project();
    expect(blackEmperorPublicLeaks(projection)).toEqual([]);
    expect(projection).toMatchObject({ canAct: false, maxSpirituality: 120, princeOfAbolition: { promoted: true } });
    expect(projection.princeOfAbolition.actions.every(action => !action.enabled)).toBe(true);
    expect(validateBlackEmperorCommand({ type: 'CONSUME', compoundId: 'x', confirmed: true, roll: 1 })).toBe(false);
    expect(validateBlackEmperorCommand({ type: 'NEXT_CONSTRUCTION', cityId: 'BE227-NORTH', weeks: 0 })).toBe(false);
    const draft = session.prepare({ type: 'BLACK_EMPEROR', command: { type: 'LEAVE_MAUSOLEUM' } }, session.inspect().revision);
    const copy = session.snapshotDraft(draft); copy.cash = 999999; copy.blackEmperor.scene!.realm.cities[0]!.stocks.cash = 999999;
    expect(session.snapshotDraft(draft).cash).not.toBe(999999);
    expect(session.snapshotDraft(draft).blackEmperor.scene!.realm.cities[0]!.stocks.cash).not.toBe(999999);
    expect(blackEmperorHash(session.snapshot())).toBe(before); session.discard(draft);
    expect(() => session.commit(draft)).toThrow();
    expect(() => session.prepare({ type: 'ACTION', action: 'REST' }, session.inspect().revision)).toThrow();
    const forged = structuredClone(route.source); forged.progression.sequence = 0; forged.blackEmperor = createBlackEmperorState();
    expect(validateBlackEmperorState(forged)).toBe(false);
    const tampered = structuredClone(route.beforeConsume); tampered.princeOfAbolition.encounter.enemyHealth++;
    expect(validateBlackEmperorState(tampered)).toBe(false);
    const root = route.beforeConsume.blackEmperor, host = blackEmperorHost(root, 'hard-gate', route.beforeConsume.revision + 1);
    const compoundId = root.materials!.compounds[0]!.id;
    expect(blackEmperorConsumeBlock(root, compoundId)).toBeNull();
    // Isolated rule mutations test each substantive prerequisite before replay protection.
    for (const mutate of [
      (copy: BlackEmperorState) => { copy.scene!.realm.ownerId = 'ANOTHER-RULER'; },
      (copy: BlackEmperorState) => { copy.scene!.realm.cities[0]!.tombs.pop(); },
      (copy: BlackEmperorState) => { copy.scene!.realm.cities[0]!.tombs[0]!.stage = 2; },
      (copy: BlackEmperorState) => { copy.scene!.realm.cities[0]!.tombs[0]!.integrity = 70; },
      (copy: BlackEmperorState) => { copy.scene!.realm.cities[0]!.knowNameCount--; },
      (copy: BlackEmperorState) => { copy.scene!.realm.cities[0]!.knowEmperorCount--; },
      (copy: BlackEmperorState) => { copy.scene!.realm.cities[0]!.nameProclamation!.actualName = '另一个姓名'; },
      (copy: BlackEmperorState) => { copy.scene!.festivals[0]!.participation[0]!.participants = copy.scene!.festivals[0]!.participation[0]!.population / 2; },
      (copy: BlackEmperorState) => { copy.scene!.festivals[0]!.participation[0]!.population++; },
      (copy: BlackEmperorState) => { copy.scene!.festivals[0]!.heldEventId = null; },
      (copy: BlackEmperorState) => { copy.scene!.festivals[0]!.expiresSecond = copy.frame!.nowSecond - 1; },
      (copy: BlackEmperorState) => { copy.scene!.playerPosition = 'OUTSIDE'; },
      (copy: BlackEmperorState) => { copy.scene!.tombEntryEventId = null; },
      (copy: BlackEmperorState) => { copy.promotionStability.preparations.at(-1)!.status = 'INVALIDATED'; },
    ]) {
      const copy = structuredClone(root); mutate(copy);
      expect(blackEmperorConsumeBlock(copy, compoundId)).not.toBeNull();
    }
    expect(blackEmperorSceneBlock(route.guided.blackEmperor.scene!, { type: 'FOUND_REALM' }, host)).not.toBeNull();
    const unfinished = structuredClone(root.scene!); unfinished.playerPosition = 'OUTSIDE'; unfinished.enteredTombId = null; unfinished.tombEntryEventId = null;
    unfinished.realm.cities[0]!.tombs[0]!.stage = 2;
    expect(blackEmperorSceneBlock(unfinished, { type: 'PREPARE_FESTIVAL' }, host)).not.toBeNull();
    const damaged = structuredClone(root.scene!); damaged.playerPosition = 'OUTSIDE';
    damaged.realm.cities.flatMap(city => city.tombs).find(tomb => tomb.id === damaged.enteredTombId)!.integrity = 0;
    expect(blackEmperorSceneBlock(damaged, { type: 'ENTER_MAUSOLEUM', tombId: damaged.enteredTombId! }, host)).not.toBeNull();
    // A legitimate ordinary exit keeps all ritual records but must disable consumption.
    const outside = openBlackEmperorRuntimeSession(route.beforeConsume);
    executeBlackEmperor(outside, { type: 'LEAVE_MAUSOLEUM' });
    expect(outside.projectBlackEmperor().actions.filter(action => action.command.type === 'CONSUME').every(action => !action.enabled)).toBe(true);
    expect(() => outside.prepare({ type: 'BLACK_EMPEROR', command: { type: 'CONSUME', compoundId: root.materials!.compounds[0]!.id, confirmed: true } }, outside.inspect().revision)).toThrow();
  }, 300_000);

  it('uses one paid70 draw, two bounded municipal effects with resistance and an ordinary return', () => {
    const before = route.beforeConsume;
    const promoted = executeBlackEmperor(route.session, { type: 'CONSUME', compoundId: before.blackEmperor.materials!.compounds[0]!.id, confirmed: true });
    expect(promoted.progression).toMatchObject({ pathwayId: 'black-emperor', sequence: 0, acting: 0 });
    expect(promoted.spirituality).toBe(before.spirituality - 30); expect(promoted.mind).toBe(before.mind - 12); expect(promoted.health).toBe(before.health);
    expect(promoted.random.cursor).toBe(before.random.cursor + 1); expect(promoted.lastCheck).toMatchObject({ chance: 70, roll: 1 });
    expect(promoted.blackEmperor.materials!.originals.every(original => original.holder === 'FUSED')).toBe(true);
    expect(promoted.blackEmperor.materials!.uniqueness.holder).toBe('FUSED');
    expect(route.session.project()).toMatchObject({ canAct: false, maxSpirituality: 150, blackEmperor: { promoted: true }, princeOfAbolition: { promoted: true } });
    assertValidSliceState(promoted);
    let distortion = false, delay = false;
    for (let step = 0; step < 100; step++) {
      const current = route.session.snapshot(), scene = current.blackEmperor.scene!;
      if (scene.returnReportEventId) break;
      const action = route.session.projectBlackEmperor().actions.find(candidate => candidate.preferredAction);
      if (!action?.enabled) throw Error(`BlackEmperor S0 route blocked ${JSON.stringify({ scene, actions: current.actionsRemaining, action })}`);
      const command = action.command;
      if (command.type === 'DISTORT_ORDER' || command.type === 'DELAY_IMPACT') {
        const withdrawn = structuredClone(scene); withdrawn.workers[0]!.consent = 'WITHDRAWN';
        expect(blackEmperorSceneBlock(withdrawn, command, blackEmperorHost(current.blackEmperor, 'withdrawn', current.revision + 1))).not.toBeNull();
        if (command.type === 'DISTORT_ORDER') distortion = true; else delay = true;
      }
      if (command.type === 'RELEASE_LOAD' || command.type === 'DELAY_IMPACT') {
        const host = blackEmperorHost(current.blackEmperor, 'resisted-effect', current.revision + 1);
        const original = blackEmperorHash(scene);
        const resisted = applyBlackEmperorScene(scene, command, host, (ability, difficulty) =>
          resolveNormalCheck({ ability, baseAbility: current.character.coreStats[ability], difficulty, modifiers: [], roll: 100 }));
        expect(blackEmperorHash(scene)).toBe(original);
        if (command.type === 'RELEASE_LOAD') {
          expect(resisted.state.facility.currentPath).toBe('MAIN'); expect(resisted.state.orderDistortionApplied).toBe(false);
          expect(resisted.state.facility.pendingLoad).toBe(false); expect(resisted.effect.mind).toBe(2);
        } else {
          expect(resisted.state.facility.impactDueSecond).toBe(scene.facility.impactDueSecond);
          expect(resisted.state.facility.pendingImpact).toBe(true); expect(resisted.state.delayedImpactApplied).toBe(false);
          expect(resisted.effect.spirituality).toBe(12); expect(resisted.effect.mind).toBe(7);
        }
        const stopped = applyBlackEmperorScene(resisted.state, { type: 'STOP_MECHANISM' },
          { ...host, eventId: 'ordinary-stop-after-resistance', second: host.second + resisted.effect.seconds },
          () => { throw Error('The ordinary stop must not require another ability draw'); });
        expect(stopped.state.facility.stopped).toBe(true); expect(stopped.state.facility.pendingImpact).toBe(false);
        expect(stopped.effect.actions).toBe(0); expect(stopped.effect.cash).toBe(0);
      }
      const next = executeBlackEmperor(route.session, command);
      if (command.type === 'DISTORT_ORDER' || command.type === 'DELAY_IMPACT') {
        expect(next.spirituality).toBe(current.spirituality - 12); expect(next.mind).toBe(current.mind - 5);
        if (command.type === 'DISTORT_ORDER') expect(next.blackEmperor.scene!.window!.expiresAt - next.blackEmperor.scene!.window!.createdAt).toBe(20);
        else {
          expect(next.blackEmperor.scene!.facility.impactDueSecond).toBe(scene.facility.impactDueSecond! + 20);
          expect(next.blackEmperor.scene!.facility.pendingImpact).toBe(true);
          expect(blackEmperorSceneBlock(next.blackEmperor.scene!, { type: 'DELAY_IMPACT' }, blackEmperorHost(next.blackEmperor, 'no-stack', next.revision + 1))).not.toBeNull();
        }
      }
    }
    const final = route.session.snapshot(), scene = final.blackEmperor.scene!;
    expect(scene.returnReportEventId).toBeTruthy(); expect(distortion).toBe(true); expect(delay).toBe(true);
    expect(scene.orderDistortionApplied).toBe(true); expect(scene.delayedImpactApplied).toBe(true);
    expect(scene.facility.loadReleasedEventId).toBeTruthy(); expect(scene.facility.currentPath).toBe('SIDE');
    expect(scene.facility.ordinaryStopEventId).toBeTruthy(); expect(scene.facility.stopped).toBe(true);
    expect(scene.playerPosition).toBe('OUTSIDE'); expect(scene.workers.every(worker => worker.position === 'OUTSIDE' && worker.exitEventId)).toBe(true);
    expect(scene.window).toBeNull(); expect(scene.contact).toBe(false);
    expect(BLACK_EMPEROR_ABILITY_IDS.map(id => final.progression.mastery[id])).toEqual([8, 8]);
    expect(blackEmperorInheritedHash(final)).toBe(blackEmperorInheritedHash(route.source));
    expect(blackEmperorPublicLeaks(route.session.project())).toEqual([]);
  }, 300_000);

  it('keeps living failure costs and the same three originals through paid recovery, and seals fatal loss', () => {
    const before = route.beforeConsume, compoundId = before.blackEmperor.materials!.compounds[0]!.id, cursor = before.random.cursor;
    try {
      rolls[cursor] = 80;
      const failed = openBlackEmperorRuntimeSession(before), state = executeBlackEmperor(failed, { type: 'CONSUME', compoundId, confirmed: true });
      expect(state.status).toBe('ACTIVE'); expect(state.progression.sequence).toBe(1); expect(state.health).toBe(before.health - 45);
      expect(state.mind).toBe(before.mind - 40); expect(state.seer.pollution).toBe(before.seer.pollution + 35);
      expect(state.blackEmperor.materials!.originals).toHaveLength(3);
      expect(state.blackEmperor.materials!.originals[2]!.holder).toBe('EMBODIED');
      expect(state.blackEmperor.materials!.uniqueness.holder).toBe('EXPOSED');
      expect(state.blackEmperor.scene!.festivals.find(festival => festival.id === state.blackEmperor.scene!.activeFestivalId)!.consumedEventId).toBeTruthy();
      let recovered = false;
      for (let step = 0; step < 120; step++) {
        const current = failed.snapshot();
        if (current.blackEmperor.materials!.compounds[0]!.status === 'RECOVERED') { recovered = true; break; }
        const action = failed.projectBlackEmperor().actions.find(candidate => candidate.preferredAction);
        if (!action?.enabled) throw Error(`BlackEmperor living recovery blocked ${JSON.stringify({ action, health: current.health, mind: current.mind, scene: current.blackEmperor.scene })}`);
        executeBlackEmperor(failed, action.command);
      }
      expect(recovered).toBe(true);
      const recoveredState = failed.snapshot(), root = recoveredState.blackEmperor;
      const sealed = root.journal.find(event => event.command.type === 'SEAL_REMAINS')!;
      const recovery = root.journal.find(event => event.command.type === 'RECOVER_REMAINS')!;
      expect(recovery.before.nowSecond - sealed.after.nowSecond).toBeGreaterThanOrEqual(604800);
      expect(recovery.before.budget.week).toBeGreaterThan(sealed.after.budget.week);
      expect(recovery.before.budget.cash - recovery.after.budget.cash).toBe(60);
      expect(root.materials!.originals.map(original => original.originalId)).toEqual([...BLACK_EMPEROR_ORIGINAL_IDS]);
      expect(root.materials!.originals.map(original => original.holder)).toEqual(['PLAYER', 'PLAYER', 'EMBODIED']);
      expect(root.materials!.carriers.map(carrier => carrier.status)).toEqual(['SPENT', 'SUPPLIER', 'SUPPLIER']);
      expect(root.materials!.compounds[0]!.consumedEventId).toBeTruthy();
      expect(root.materials!.uniqueness).toMatchObject({ id: 'BE227-UNIQUENESS', holder: 'PLAYER' });
      expect(root.scene!.constructionReceipts).toEqual(before.blackEmperor.scene!.constructionReceipts);
      expect(blackEmperorInheritedHash(recoveredState)).toBe(blackEmperorInheritedHash(route.source));
      expect(validateBlackEmperorState(recoveredState)).toBe(true);
      rolls[cursor] = 100;
      const dying = openBlackEmperorRuntimeSession(before), dead = executeBlackEmperor(dying, { type: 'CONSUME', compoundId, confirmed: true });
      expect(dead.status).toBe('DEAD'); expect(dead.health).toBe(0); expect(dead.ending?.kind).toBe('DEATH');
      expect(dead.blackEmperor.materials!.originals).toHaveLength(3);
      expect(dead.blackEmperor.materials!.originals.every(original => original.holder === 'DEATH_REMAINS')).toBe(true);
      expect(dead.blackEmperor.materials!.uniqueness.holder).toBe('DEATH_REMAINS');
      expect(() => dying.prepare({ type: 'BLACK_EMPEROR', command: { type: 'REST' } }, dead.revision)).toThrow();
      expect(blackEmperorInheritedHash(dead)).toBe(blackEmperorInheritedHash(route.source));
      assertValidSliceState(dead);
    } finally { delete rolls[cursor]; }
  }, 300_000);
});
