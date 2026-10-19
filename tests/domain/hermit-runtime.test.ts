import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { openHermitRuntimeSession } from '../../src/domain/hermit/owned-session.js';
import { createHermitState, validateHermitCommand, validateHermitState } from '../../src/domain/hermit/index.js';
import { HERMIT_ABILITY_IDS, HERMIT_ORIGINAL_IDS, HERMIT_MOVE_LINE } from '../../src/domain/hermit/content.js';
import { hermitHost } from '../../src/domain/hermit/engine.js';
import { hermitSceneBlock } from '../../src/domain/hermit/scene.js';
import * as predecessor from '../../src/domain/knowledge-emperor/index.js';
import { assertHermitSourceUnmodified, controlledHermitRolls, executeHermit, hermitHash,
  hermitInheritedHash, hermitPublicLeaks, preparedHermitScenario } from '../helpers/hermit-scenario.js';

let scenario: ReturnType<typeof preparedHermitScenario>;
const futureRolls: Record<number, number> = {};
let restoreRolls: (() => void) | undefined;
beforeAll(() => {
  restoreRolls = controlledHermitRolls(futureRolls);
  scenario = preparedHermitScenario();
}, 300_000);
afterAll(() => { restoreRolls?.(); assertHermitSourceUnmodified(); });

describe('Hermit222 real predecessor, paid preparation and owned runtime', () => {
  it('keeps nine roots and all 15 skills, earns ordinary exits, and pays for the same three originals and one uniqueness', () => {
    const { source, guided, beforeConsume: state } = scenario;
    const root = state.hermit, materials = root.materials!, scene = root.scene!;
    expect(guided.cash).toBe(545);
    expect(guided.actionsRemaining).toBe(2);
    expect(guided.hermit.materials!.originals.map(item => item.holder))
      .toEqual(['UNLOCATED_REMNANT', 'UNLOCATED_REMNANT', 'EMBODIED']);
    expect(hermitInheritedHash(state)).toBe(hermitInheritedHash(source));
    expect(state.progression.mastery).toEqual(source.progression.mastery);
    expect(Object.keys(state.progression.mastery)).toHaveLength(15);
    expect(state.progression.mastery['hermit.s1.knowledge-power']).toBe(0);
    expect(state.progression.mastery['hermit.s1.power-knowledge']).toBe(0);
    expect(state.week).toBeGreaterThanOrEqual(source.week + 3);
    expect(state.week - source.knowledgeEmperor.promotionWeek!).toBeGreaterThanOrEqual(12);
    expect(root.journal.some(event => event.financeReceipts.length > 0)).toBe(true);
    const work = root.journal.filter(event => event.command.type === 'WORK');
    expect(work.length).toBeGreaterThan(0);
    for (const event of work) expect(event.after.budget.cash - event.before.budget.cash).toBe(source.character.weeklyWage);
    for (const originalId of HERMIT_ORIGINAL_IDS.slice(0, 2)) {
      const events = root.journal.filter(event => 'originalId' in event.command && event.command.originalId === originalId);
      const investigation = events.find(event => event.command.type === 'INVESTIGATE_REMAINS')!;
      const sealed = events.find(event => event.command.type === 'SEAL_ORIGINAL')!;
      const recovered = events.find(event => event.command.type === 'RECOVER_ORIGINAL')!;
      expect(investigation.before.budget.cash - investigation.after.budget.cash).toBe(120);
      expect(recovered.before.budget.cash - recovered.after.budget.cash).toBe(30);
      expect(recovered.before.nowSecond - sealed.after.nowSecond).toBeGreaterThanOrEqual(604800);
      expect(recovered.before.budget.week).toBeGreaterThan(sealed.after.budget.week);
    }
    expect(materials.originals.map(item => item.originalId)).toEqual([...HERMIT_ORIGINAL_IDS]);
    expect(materials.originals.map(item => item.holder)).toEqual(['COMPOUND', 'COMPOUND', 'EMBODIED']);
    expect(materials.uniqueness).toMatchObject({ id: 'HM222-UNIQUENESS', holder: 'COMPOUND' });
    expect(materials.uniqueness.verifiedEventId).toBeTruthy();
    expect(materials.uniqueness.acquiredEventId).toBeTruthy();
    expect(materials.compounds).toHaveLength(1);
    expect(materials.compounds[0]).toMatchObject({ originalIds: [...HERMIT_ORIGINAL_IDS.slice(0, 2)],
      embodiedOriginalId: HERMIT_ORIGINAL_IDS[2], status: 'PREPARED' });
    expect(materials.carriers.map(carrier => carrier.status)).toEqual(['SPENT', 'SUPPLIER', 'SUPPLIER']);
    expect(scene.preparationReportEventId).toBeTruthy();
    expect(scene.custody).toMatchObject({ recordId: 'PM3-BOUNDARY-RECORD', quantity: 1, holder: 'OWNER', position: 'OUTSIDE' });
    expect(scene.custody.returnEventId).toBeTruthy();
    expect(scene.workers.every(worker => worker.position === 'OUTSIDE' && worker.passage.a && worker.passage.b && worker.passage.sideExit)).toBe(true);
    expect(scene.owner.consent).toBe('CLOSED');
    expect(scene.body).toBe('SOLID');
    expect(scene.window).toBeNull();
    expect(scene.contact).toBe(false);
    const preparation = root.journal.at(-1)!;
    expect(preparation.command.type).toBe('STABILIZE_PROMOTION');
    expect(preparation.after.budget.cash).toBe(preparation.before.budget.cash - 150);
    expect(preparation.after.budget.spirituality).toBe(preparation.before.budget.spirituality - 12);
    expect(preparation.after.budget.mind).toBe(preparation.before.budget.mind - 8);
    const receipts = root.journal.flatMap(event => event.randomReceipts);
    expect(receipts.length).toBeGreaterThanOrEqual(2);
    expect(state.random).toEqual({ seed: source.random.seed, cursor: source.random.cursor + receipts.length });
  });

  it('keeps public views private, locks generic actions, discards drafts and rejects altered inherited history', () => {
    const session = scenario.session, before = hermitHash(session.snapshot());
    expect(validateHermitCommand({ type: 'CONSUME', compoundId: 'x', confirmed: true, roll: 1 })).toBe(false);
    expect(validateHermitCommand({ type: 'REPORT_PASSAGE', receipts: [] })).toBe(false);
    const view = session.project();
    expect(view.canAct).toBe(false);
    expect(hermitPublicLeaks(view)).toEqual([]);
    expect(JSON.stringify(view)).not.toContain(scenario.source.random.seed);
    expect(view.hermit.resources.maxSpirituality).toBe(120);
    const spy = vi.spyOn(predecessor, 'validateKnowledgeEmperorState');
    try {
      const draft = session.prepare({ type: 'HERMIT', command: { type: 'NEXT_WEEK' } }, session.inspect().revision);
      expect(spy).not.toHaveBeenCalled();
      const copy = session.snapshotDraft(draft); copy.cash = 999999;
      expect(session.snapshotDraft(draft).cash).not.toBe(999999);
      session.discard(draft);
      expect(() => session.commit(draft)).toThrow();
      expect(hermitHash(session.snapshot())).toBe(before);
      expect(() => session.prepare({ type: 'WORK' }, session.inspect().revision)).toThrow();
    } finally { spy.mockRestore(); }
    const tampered = structuredClone(scenario.beforeConsume);
    tampered.knowledgeEmperor.life.site.archive!.readings++;
    expect(validateHermitState(tampered)).toBe(false);
    const noHistory = structuredClone(scenario.source);
    noHistory.progression.sequence = 0; noHistory.hermit = createHermitState();
    expect(validateHermitState(noHistory)).toBe(false);
  }, 300_000);

  it('consumes without a refill, cold-validates cap 150, and completes both finite S0 applications with the same owned session', () => {
    const before = scenario.beforeConsume;
    const state = executeHermit(scenario.session, { type: 'CONSUME', compoundId: before.hermit.materials!.compounds[0]!.id, confirmed: true });
    expect(state.progression).toMatchObject({ pathwayId: 'hermit', sequence: 0, acting: 0 });
    expect(state.random).toEqual({ seed: before.random.seed, cursor: before.random.cursor + 1 });
    expect(state.spirituality).toBe(before.spirituality - 30);
    expect(state.mind).toBe(before.mind - 12);
    expect(state.health).toBe(before.health);
    expect(state.character.coreStats).toEqual(before.character.coreStats);
    expect(Object.fromEntries(Object.keys(before.progression.mastery).map(id => [id, state.progression.mastery[id]])))
      .toEqual(before.progression.mastery);
    for (const id of HERMIT_ABILITY_IDS) expect(state.progression.mastery[id]).toBe(0);
    expect(state.hermit.materials!.originals.map(item => item.holder)).toEqual(['FUSED', 'FUSED', 'FUSED']);
    expect(state.hermit.materials!.uniqueness.holder).toBe('FUSED');
    expect(state.hermit.promotionStability.preparations.at(-1)!.status).toBe('SPENT');
    expect(state.hermit.journal.at(-1)!.randomReceipts).toMatchObject([{ cursorBefore: before.random.cursor,
      cursorAfter: before.random.cursor + 1, check: { roll: 1, chance: 70, tier: 'GREAT_SUCCESS' } }]);
    expect(hermitInheritedHash(state)).toBe(hermitInheritedHash(scenario.source));
    const view = scenario.session.project();
    expect(view).toMatchObject({ canAct: false, maxSpirituality: 150, hermit: { promoted: true, resources: { maxSpirituality: 150 } } });
    expect(hermitPublicLeaks(view)).toEqual([]);
    expect(() => scenario.session.prepare({ type: 'REST' }, state.revision)).toThrow();
    assertValidSliceState(state);

    // Continue this already-owned successful head. Probe negative conditions only
    // on scene copies, without manufacturing a new campaign or replay authority.
    let entered = false, touched = false;
    const practiceCommands: string[] = [];
    for (let step = 0; step < 100; step++) {
      const current = scenario.session.snapshot(), scene = current.hermit.scene!;
      if (scene.returnReportEventId) break;
      const action = scenario.session.projectHermit().actions.find(candidate => candidate.preferredAction);
      if (!action?.enabled) throw Error(`Hermit S0 preferred return blocked: ${JSON.stringify({
        week: current.week, actions: current.actionsRemaining, cash: current.cash,
        location: current.hermit.frame!.location, scene, action, last: practiceCommands.slice(-10),
      })}`);
      const command = action.command;
      if (command.type === 'ENTER_INFORMATION_FORM' || command.type === 'TOUCH_READ_RECORD') {
        const host = hermitHost(current.hermit, `R222:${current.runId}:${current.revision + 1}`, current.revision + 1);
        const sceneBefore = hermitHash(scene);
        expect(hermitSceneBlock(scene, command, host)).toBeNull();
        const withdrawn = structuredClone(scene);
        withdrawn.owner.consent = 'WITHDRAWN';
        withdrawn.owner.permissionVersion++;
        expect(hermitSceneBlock(withdrawn, command, host)).not.toBeNull();
        if (command.type === 'ENTER_INFORMATION_FORM') {
          entered = true;
          const disconnected = structuredClone(scene); disconnected.slit.connected = false;
          expect(hermitSceneBlock(disconnected, command, host)).not.toBeNull();
          const blocked = structuredClone(scene); blocked.slit.open = false;
          expect(hermitSceneBlock(blocked, command, host)).not.toBeNull();
        } else {
          touched = true;
          const unread = structuredClone(scene); unread.reading = null;
          expect(hermitSceneBlock(unread, command, host)).not.toBeNull();
        }
        expect(hermitHash(scene)).toBe(sceneBefore);
      }
      const next = executeHermit(scenario.session, command), nextScene = next.hermit.scene!;
      practiceCommands.push(command.type);
      if (command.type === 'ENTER_INFORMATION_FORM' || command.type === 'TOUCH_READ_RECORD') {
        const information = command.type === 'ENTER_INFORMATION_FORM';
        expect(next.actionsRemaining).toBe(current.actionsRemaining - 1);
        expect(next.spirituality).toBe(current.spirituality - (information ? 18 : 12));
        expect(next.mind).toBe(current.mind - (information ? 6 : 5));
        expect(nextScene.playerEnergy).toBe(scene.playerEnergy - (information ? 10 : 3));
        expect(next.health).toBe(current.health);
        expect(nextScene.custody).toEqual(scene.custody);
        expect(nextScene.window!.expiresAt - nextScene.window!.createdAt).toBe(information ? 10 : 15);
        expect(next.progression.mastery[HERMIT_ABILITY_IDS[information ? 0 : 1]]).toBe(0);
      }
      if (command.type === 'CROSS_INFORMATION_ROUTE') {
        expect(nextScene.moves.at(-1)).toMatchObject({ actorId: 'PLAYER', from: 'MIDPOINT',
          to: 'DESTINATION', metres: 3, mode: 'INFORMATION', carriedRecord: false });
        expect(nextScene.custody).toEqual(scene.custody);
        expect(next.progression.mastery[HERMIT_ABILITY_IDS[0]]).toBe(0);
      }
      if (command.type === 'RECONSTRUCT') expect(next.progression.mastery[HERMIT_ABILITY_IDS[0]]).toBe(8);
      if (command.type === 'TRANSFER_READ_LINE') expect(next.progression.mastery[HERMIT_ABILITY_IDS[1]]).toBe(0);
      if (command.type === 'AFFIX_SEAL') expect(next.progression.mastery[HERMIT_ABILITY_IDS[1]]).toBe(8);
    }
    const returned = scenario.session.snapshot(), scene = returned.hermit.scene!;
    expect(scene.returnReportEventId, `Preferred commands: ${practiceCommands.join(', ')}`).toBeTruthy();
    expect(entered).toBe(true);
    expect(touched).toBe(true);
    for (const id of HERMIT_ABILITY_IDS) expect(returned.progression.mastery[id]).toBe(8);
    expect(scene).toMatchObject({ phase: 'PRACTICE', status: 'COMPLETED', body: 'SOLID', playerPosition: 'OUTSIDE',
      informationCompleted: true, transferCompleted: true, manualCopyCompleted: false, window: null, contact: false,
      owner: { position: 'OUTSIDE', consent: 'CLOSED' },
      custody: { recordId: 'PM3-BOUNDARY-RECORD', quantity: 1, holder: 'OWNER', position: 'OUTSIDE', sealed: true } });
    expect(scene.custody.returnEventId).toBeTruthy();
    expect(scene.segments.A.open).toBe(false);
    expect(scene.segments.B.open).toBe(false);
    expect(scene.workers.every(worker => worker.age >= 18 && worker.alive && worker.health === 100 &&
      worker.position === 'OUTSIDE' && worker.consent === 'CLOSED' && worker.passage.a && worker.passage.b && worker.passage.sideExit)).toBe(true);
    expect(scene.seals).toHaveLength(1);
    expect(scene.seals[0]).toMatchObject({ status: 'APPLIED', content: HERMIT_MOVE_LINE });
    expect(scene.seals[0]!.boughtEventId).toBeTruthy();
    expect(scene.seals[0]!.writtenEventId).toBeTruthy();
    expect(scene.seals[0]!.appliedEventId).toBeTruthy();
    const practice = returned.hermit.journal.slice(state.hermit.journal.length);
    const paidWorkers = practice.filter(event => event.command.type === 'ASK_ARCHIVIST');
    expect(paidWorkers).toHaveLength(2);
    for (const event of paidWorkers) expect(event.before.budget.cash - event.after.budget.cash).toBe(20);
    const paidSeals = practice.filter(event => event.command.type === 'BUY_SEAL');
    expect(paidSeals).toHaveLength(1);
    expect(paidSeals[0]!.before.budget.cash - paidSeals[0]!.after.budget.cash).toBe(20);
    expect(returned.random).toEqual(state.random);
    expect(returned.hermit.materials).toEqual(state.hermit.materials);
    expect(hermitInheritedHash(returned)).toBe(hermitInheritedHash(scenario.source));
    expect(hermitPublicLeaks(scenario.session.project())).toEqual([]);
  }, 300_000);

  it('keeps living failed originals recoverable only after real sealing and seven days, while severe failure cannot resurrect', () => {
    const before = scenario.beforeConsume, cursor = before.random.cursor;
    for (const roll of [80, 100]) {
      futureRolls[cursor] = roll;
      try {
        const session = openHermitRuntimeSession(before), compoundId = before.hermit.materials!.compounds[0]!.id;
        const failed = executeHermit(session, { type: 'CONSUME', compoundId, confirmed: true });
        expect(failed.progression.sequence).toBe(1);
        expect(failed.random.cursor).toBe(cursor + 1);
        expect(failed.status).toBe(roll === 80 ? 'ACTIVE' : 'DEAD');
        expect(failed.hermit.materials!.compounds[0]!.status).toBe(roll === 80 ? 'FAILED_EXPOSED' : 'DEATH_REMAINS');
        expect(failed.hermit.materials!.originals.map(item => item.holder))
          .toEqual(roll === 80 ? ['LOCATED', 'LOCATED', 'EMBODIED'] : ['DEATH_REMAINS', 'DEATH_REMAINS', 'DEATH_REMAINS']);
        expect(hermitInheritedHash(failed)).toBe(hermitInheritedHash(scenario.source));
        if (roll === 100) {
          expect(() => session.prepare({ type: 'HERMIT', command: { type: 'REST' } }, failed.revision)).toThrow();
          expect(() => session.prepare({ type: 'HERMIT', command: { type: 'NEXT_WEEK' } }, failed.revision)).toThrow();
          continue;
        }
        if (failed.actionsRemaining < 1) executeHermit(session, { type: 'NEXT_WEEK' });
        const sealed = executeHermit(session, { type: 'SEAL_REMAINS', compoundId });
        expect(() => session.prepare({ type: 'HERMIT', command: { type: 'RECOVER_REMAINS', compoundId } }, sealed.revision)).toThrow();
        // A single week boundary is not automatically seven elapsed days after sealing.
        const sealedSecond = sealed.hermit.materials!.compounds[0]!.sealedSecond!;
        for (let step = 0; step < 2 && session.snapshot().hermit.frame!.nowSecond < sealedSecond + 604800; step++)
          executeHermit(session, { type: 'NEXT_WEEK' });
        const worked = executeHermit(session, { type: 'WORK' });
        const recovered = executeHermit(session, { type: 'RECOVER_REMAINS', compoundId });
        expect(recovered.cash).toBe(worked.cash - 60);
        expect(recovered.health).toBe(failed.health);
        expect(recovered.mind).toBe(failed.mind);
        expect(recovered.injuries).toEqual(failed.injuries);
        expect(recovered.hermit.materials!.originals.map(item => item.holder)).toEqual(['PLAYER', 'PLAYER', 'EMBODIED']);
        expect(recovered.hermit.materials!.uniqueness.holder).toBe('PLAYER');
        expect(recovered.hermit.materials!.compounds[0]!.status).toBe('RECOVERED');
        expect(recovered.hermit.materials!.carriers.map(carrier => carrier.status)).toEqual(['SPENT', 'SUPPLIER', 'SUPPLIER']);
      } finally { delete futureRolls[cursor]; }
    }
  }, 300_000);
});
