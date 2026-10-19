import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addGameDays, addGameWeeks, compareGameDates } from '../../src/domain/game-calendar.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { createWhiteTowerState, validateWhiteTowerState, whiteTowerCommandBlock } from '../../src/domain/white-tower/index.js';
import { getWhiteTowerPromotionStabilityPreview } from '../../src/domain/white-tower/engine.js';
import { openWhiteTowerRuntimeSession } from '../../src/domain/white-tower/owned-session.js';
import { WHITE_TOWER_FUTURE_BRANCH } from '../../src/domain/white-tower/material-content.js';
import { WHITE_TOWER_PASSAGES, whiteTowerPassageVerifiedReceipts } from '../../src/domain/white-tower/passages.js';
import { WHITE_TOWER_ABILITY_IDS, WHITE_TOWER_LABOUR_IDS } from '../../src/domain/white-tower/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import {
  WHITE_TOWER_CONTROLLED_CONSUME, WHITE_TOWER_CONTROLLED_CURSOR, WHITE_TOWER_CONTROLLED_SEED,
  WHITE_TOWER_SOURCE_CURSOR, assertUnmodifiedWhiteTowerInput, assertWhiteTowerPublicBoundary,
  controlledWhiteTowerSuccess, installControlledWhiteTowerPromotion, whiteTowerInheritedHash,
  whiteTowerScenarioDate, whiteTowerScenarioHash, type ControlledWhiteTowerSuccess,
} from '../helpers/white-tower-scenario.js';

// Authentic 666-command predecessor plus every new paid command. Budgets are
// local to these full-history cases, never a change to the general test limit.
const fullHistoryBudget = 240_000;
let seam: ReturnType<typeof installControlledWhiteTowerPromotion>;
let scenario: ControlledWhiteTowerSuccess;
beforeAll(() => { seam = installControlledWhiteTowerPromotion(); scenario = controlledWhiteTowerSuccess(seam); }, fullHistoryBudget);
afterAll(() => { try { assertUnmodifiedWhiteTowerInput(); } finally { seam?.restore(); } }, fullHistoryBudget);

describe('WhiteTower genuine-history explicitly controlled S0 central authority', () => {
  it('preserves all prior fields and draws, treating the actual heavy wound and paying real wages and every bill', () => {
    const { source, guided, healed, success, commands } = scenario;
    for (const state of [guided, healed, success]) {
      const view = projectSliceState(state);
      expect(view.nextStep).toBe(view.whiteTower.nextStep);
    }
    expect(whiteTowerInheritedHash(success)).toBe(whiteTowerInheritedHash(source));
    for (let cursor = 0; cursor < WHITE_TOWER_CONTROLLED_CURSOR; cursor++) {
      const rng = new DeterministicActionRandomStream(WHITE_TOWER_CONTROLLED_SEED, cursor);
      expect(rng.nextInt(1, 100)).toBe(seam.original.call(new DeterministicActionRandomStream(WHITE_TOWER_CONTROLLED_SEED, cursor), 1, 100));
      expect(rng.cursor).toBe(cursor + 1);
    }
    const next = new DeterministicActionRandomStream(WHITE_TOWER_CONTROLLED_SEED, WHITE_TOWER_CONTROLLED_CURSOR);
    expect(next.nextInt(1, 100)).toBe(1); expect(next.cursor).toBe(231);
    expect(next.nextInt(1, 100)).toBe(seam.original.call(new DeterministicActionRandomStream(WHITE_TOWER_CONTROLLED_SEED, 231), 1, 100));
    for (const [seed, minimum, maximum] of [[WHITE_TOWER_CONTROLLED_SEED, 0, 9], ['another-white-tower-seed', 1, 100]] as const) {
      const rng = new DeterministicActionRandomStream(seed, WHITE_TOWER_CONTROLLED_CURSOR);
      expect(rng.nextInt(minimum, maximum)).toBe(seam.original.call(new DeterministicActionRandomStream(seed, WHITE_TOWER_CONTROLLED_CURSOR), minimum, maximum));
    }
    expect(seam.substituted.every(draw => draw.cursorBefore === 230 && draw.cursorAfter === 231 && draw.controlled === 1)).toBe(true);
    expect(source.random.cursor).toBe(WHITE_TOWER_SOURCE_CURSOR);
    expect(success.random.cursor).toBe(231);
    expect(guided.cash).toBe(1290); expect(guided.actionsRemaining).toBe(2);
    expect(guided.health).toBe(70); expect(guided.injuries).toEqual(source.injuries);
    expect(guided.whiteTower.journal).toEqual([]);
    expect(guided.whiteTower.source!.budget).toMatchObject({ cash: 1390, health: 70, mind: 86, spirituality: 120, actions: 3 });
    expect(commands.slice(0, 6).map(command => command.type)).toEqual(['LEARN_GUIDANCE', 'CLINIC', 'REST', 'NEXT_WEEK', 'REST', 'TRAVEL']);
    expect(healed.health).toBe(86); expect(healed.injuries).toEqual([]);
    const clinic = healed.whiteTower.journal[0]!, rests = healed.whiteTower.journal.filter(event => event.command.type === 'REST');
    expect(clinic.after.budget.cash).toBe(clinic.before.budget.cash - 60);
    expect(clinic.after.budget.health).toBe(clinic.before.budget.health);
    expect(clinic.after.budget.injuries[0]!.treatedRevision).toBe(clinic.revision);
    expect(rests.map(event => event.after.budget.health - event.before.budget.health)).toEqual([8, 8]);
    expect(rests[0]!.after.budget.injuries).toHaveLength(1);
    expect(success.whiteTower.journal.map(event => event.command)).toEqual(commands.slice(1));
    expect(success.revision).toBe(source.revision + commands.length);
    const workedWeeks: number[] = [];
    let previous = guided.whiteTower.frame!;
    for (const [index, event] of success.whiteTower.journal.entries()) {
      expect(event.revision).toBe(source.revision + index + 2);
      expect(event.before).toEqual(previous);
      expect(event.after.nowSecond).toBeGreaterThanOrEqual(event.before.nowSecond);
      const weeks = event.after.budget.week - event.before.budget.week;
      expect(event.after.budget.date).toEqual(addGameWeeks(event.before.budget.date, weeks));
      expect(event.after.weekAnchor - event.before.weekAnchor).toBe(weeks * 604800);
      if (event.command.type === 'WORK') {
        workedWeeks.push(event.before.budget.week);
        expect(event.after.budget.cash).toBe(event.before.budget.cash + 180);
        expect(event.after.budget.actions).toBe(event.before.budget.actions - 1);
        expect(event.after.nowSecond - event.before.nowSecond).toBe(28800);
      }
      if (event.command.type === 'NEXT_WEEK') {
        expect(weeks).toBe(1); expect(event.after.budget.actions).toBe(3);
        expect([event.after.budget.health, event.after.budget.mind, event.after.budget.spirituality])
          .toEqual([event.before.budget.health, event.before.budget.mind, event.before.budget.spirituality]);
        expect(event.financeReceipts.length).toBeGreaterThan(0);
      }
      previous = event.after;
    }
    expect(new Set(workedWeeks).size).toBe(workedWeeks.length);
    expect(workedWeeks.length).toBeGreaterThan(0);
    const clinicCost = commands.filter(command => command.type === 'CLINIC').length * 60;
    const checkCost = commands.filter(command => command.type === 'MATERIAL' && command.command.type === 'VERIFY_UNIQUENESS').length * 60;
    const repairCost = commands.reduce((sum, command) => sum + (command.type === 'PASSAGE' && command.command.type === 'BUY_REPAIR'
      ? WHITE_TOWER_PASSAGES.find(passage => passage.id === command.command.passageId)!.repairPrice : 0), 0);
    // 100 guidance, three original supply packs132, two original doses2200,
    // unique handover120, finite carrier320, actual composition100/prep100.
    const charges = 100 + clinicCost + 132 + repairCost + 2200 + checkCost + 120 + 320 + 100 + 100;
    const debt = (state: SliceState) => state.debts.reduce((sum, entry) => sum + entry.remaining, 0);
    expect(success.cash - debt(success)).toBe(source.cash - debt(source) + workedWeeks.length * 180 - (success.week - source.week) * 30 - charges);
    expect(success.whiteTower.source).toEqual(guided.whiteTower.source);
  }, fullHistoryBudget);

  it('earns three original residents’ full passages and later reviews, then acquires the actual three originals and dated unique object', () => {
    const { source, guided, passagesComplete, beforeConsume, success } = scenario;
    const passages = passagesComplete.whiteTower.passages!, materials = beforeConsume.whiteTower.materials!;
    expect(passages.routes).toHaveLength(3);
    for (const definition of WHITE_TOWER_PASSAGES) {
      const route = passages.routes.find(value => value.id === definition.id)!;
      expect(route.resident).toMatchObject({ id: definition.residentId, age: definition.age, position: definition.length, consent: 'ACCEPT', injuries: [] });
      expect(route.survey!.walkedMeters).toBe(definition.obstacle * 2);
      expect(route.passage).toMatchObject({ from: 0, to: definition.length, walkedMeters: definition.length });
      expect(route.review!.week).toBeGreaterThan(route.passage!.week);
      expect(route.review!.residentPosition).toBe(definition.length);
      expect(route.playerPosition).toBe(0);
      expect(route.materials.stock).toBe(0); expect(route.materials.tool.holder).toBe('PLAYER');
      expect(route.materials.consumedEventId).toBe(route.construction!.eventId);
      expect(route.resident.permissionHistory.some(permission => permission.eventId === route.passage!.permissionEventId && permission.answer === 'ACCEPT')).toBe(true);
      const build = success.whiteTower.journal.find(event => event.id === route.construction!.eventId)!;
      expect(build.randomReceipts).toHaveLength(1);
      const receipt = build.randomReceipts[0]!;
      expect(receipt.cursorBefore).toBeLessThan(WHITE_TOWER_CONTROLLED_CURSOR);
      expect(receipt.check.roll).toBe(seam.original.call(new DeterministicActionRandomStream(source.random.seed, receipt.cursorBefore), 1, 100));
      if (!route.construction!.passed) {
        expect(route.materials.repair.stock).toBe(0);
        expect(route.materials.repair.consumedEventId).toBe(route.construction!.repairedEventId);
        expect(success.whiteTower.journal.find(event => event.id === route.construction!.repairedEventId)!.randomReceipts).toEqual([]);
      }
    }
    const receipts = whiteTowerPassageVerifiedReceipts(passages);
    expect(receipts).toHaveLength(3);
    expect(new Set(receipts.flatMap(receipt => [receipt.passedEventId, receipt.reviewedEventId])).size).toBe(6);
    expect(materials.compounds[0]!.passageReceipts).toEqual(receipts);
    expect(materials.embodiedOriginalBottleId).toBe('all-knowing-eye-potion-1');
    expect(materials.legacyRemains).toEqual([]);
    expect(materials.characteristics.map(item => item.originBottleId)).toEqual(['all-knowing-eye-potion-1', 'all-knowing-eye-potion-2', 'all-knowing-eye-potion-3']);
    for (const item of materials.characteristics.slice(1)) {
      expect(item.labour.map(entry => entry.taskId)).toEqual(WHITE_TOWER_LABOUR_IDS);
      expect(new Set(item.labour.map(entry => entry.eventId)).size).toBe(5);
      const acquired = beforeConsume.whiteTower.journal.find(event => event.id === item.acquiredEventId)!;
      expect(acquired.before.budget.cash - acquired.after.budget.cash).toBe(1100);
    }
    expect(compareGameDates(whiteTowerScenarioDate(guided), WHITE_TOWER_FUTURE_BRANCH.terminationDate)).toBeLessThan(0);
    expect(whiteTowerCommandBlock(guided, { type: 'MATERIAL', command: { type: 'VERIFY_UNIQUENESS', step: 'CHAIN' } })).toContain('实际日期');
    expect(compareGameDates(whiteTowerScenarioDate(beforeConsume), WHITE_TOWER_FUTURE_BRANCH.transferDate)).toBeGreaterThanOrEqual(0);
    for (const check of materials.uniqueness.checks) {
      const event = beforeConsume.whiteTower.journal.find(value => value.id === check.eventId)!;
      const date = addGameDays(event.before.budget.date, Math.floor((event.before.nowSecond - event.before.weekAnchor) / 86400));
      expect(compareGameDates(date, WHITE_TOWER_FUTURE_BRANCH.transferDate)).toBeGreaterThanOrEqual(0);
    }
    expect(materials.uniqueness.checks.map(check => check.step)).toEqual(['CHAIN', 'VACANCY']);
    expect(materials.uniqueness.succession).toMatchObject({ objectCount: 1, predecessorStillEmbodied: false,
      termination: { cause: 'ACTUAL_DEATH', date: WHITE_TOWER_FUTURE_BRANCH.terminationDate },
      transfer: { custodyOnly: true, date: WHITE_TOWER_FUTURE_BRANCH.transferDate }, incumbentActorId: null, custodianEmbodied: false });
    expect(beforeConsume.week - source.allKnowingEye.promotionWeek!).toBeGreaterThanOrEqual(12);
    expect(whiteTowerInheritedHash(beforeConsume)).toBe(whiteTowerInheritedHash(source));
  }, fullHistoryBudget);

  it('centrally replays a genuinely consumed 70% prepared S0, preserving21 old mastery values and adding exactly two zero skills', () => {
    const { source, guided, beforePreparation, beforeConsume, success } = scenario;
    expect(whiteTowerCommandBlock(beforePreparation, WHITE_TOWER_CONTROLLED_CONSUME.command)).toContain('准备');
    expect(getWhiteTowerPromotionStabilityPreview(beforeConsume.whiteTower, 'white-tower-compound-1')).toMatchObject({ prepared: true, preparedChance: 70 });
    const preparation = beforeConsume.whiteTower.promotionStability.preparations.at(-1)!, event = success.whiteTower.journal.at(-1)!;
    const preparedEvent = beforeConsume.whiteTower.journal.find(value => value.id === preparation.eventId)!;
    expect(preparedEvent.before).toEqual(beforePreparation.whiteTower.frame);
    expect([preparedEvent.after.budget.cash, preparedEvent.after.budget.actions, preparedEvent.after.budget.spirituality, preparedEvent.after.budget.mind])
      .toEqual([beforePreparation.cash - 100, beforePreparation.actionsRemaining - 1, beforePreparation.spirituality - 12, beforePreparation.mind - 8]);
    expect(preparation.expiresSecond - preparation.preparedSecond).toBe(604800);
    expect(preparation.receipts).toHaveLength(6);
    expect(event.command).toEqual(WHITE_TOWER_CONTROLLED_CONSUME.command);
    expect(event.before).toEqual(beforeConsume.whiteTower.frame);
    expect(event.randomReceipts).toEqual([{ kind: 'CHECK', id: `${event.id}:check:1`, cursorBefore: 230, cursorAfter: 231,
      check: { ability: 'will', baseAbility: 28, modifiers: [{ source: '本瓶本次实际稳定准备', value: 40 }],
        effectiveAbility: 68, difficulty: 58, chance: 70, roll: 1, tier: 'GREAT_SUCCESS' } }]);
    expect(success.progression).toMatchObject({ pathwayId: 'white-tower', sequence: 0, acting: 0 });
    expect([success.cash, success.health, success.mind, success.spirituality, success.actionsRemaining])
      .toEqual([beforeConsume.cash, beforeConsume.health, beforeConsume.mind - 12, beforeConsume.spirituality - 30, beforeConsume.actionsRemaining - 1]);
    expect(success.whiteTower.promotionStability.preparations.at(-1)).toEqual({ ...preparation, status: 'SPENT', spentEventId: event.id });
    expect(Object.keys(success.progression.mastery)).toHaveLength(23);
    for (const [id, value] of Object.entries(source.progression.mastery)) expect(success.progression.mastery[id], id).toBe(value);
    for (const id of WHITE_TOWER_ABILITY_IDS) expect(success.progression.mastery[id]).toBe(0);
    expect(success.whiteTower.materials!.compounds).toHaveLength(1);
    expect(success.whiteTower.materials!.compounds[0]).toMatchObject({ status: 'SUCCESS', settlementEventId: event.id });
    expect(success.whiteTower.materials!.settlements).toHaveLength(1);
    for (const item of [...success.whiteTower.materials!.characteristics, success.whiteTower.materials!.uniqueness])
      expect(item).toMatchObject({ holder: 'FUSED', location: success.whiteTower.source!.actorId });
    expect(success.whiteTower.materials!.batches.map(batch => [batch.id, batch.status, batch.uses])).toEqual([
      ['white-tower-carrier-1', 'SPENT', 1], ['white-tower-carrier-2', 'SUPPLIER', 0], ['white-tower-carrier-3', 'SUPPLIER', 0],
    ]);
    const hash = whiteTowerScenarioHash(success);
    assertValidSliceState(success); expect(validateWhiteTowerState(success)).toBe(true);
    for (const state of [guided, success]) {
      const publicState = projectSliceState(state);
      assertWhiteTowerPublicBoundary(publicState, state);
      for (const key of ['source', 'frame', 'journal']) expect(publicState.whiteTower).not.toHaveProperty(key);
      expect(publicState.whiteTower.abilities).toHaveLength(state === success ? 23 : 21);
    }
    const future = projectSliceState(guided).whiteTower.sections.find(section => section.id === 'future-branch')!.lines.join('');
    for (const spoiler of [WHITE_TOWER_FUTURE_BRANCH.predecessorName, WHITE_TOWER_FUTURE_BRANCH.custodianName, '1352年7月8日', '析出同一件']) expect(future.includes(spoiler)).toBe(false);
    const reopened = openWhiteTowerRuntimeSession(JSON.parse(JSON.stringify(success)));
    expect(whiteTowerScenarioHash(reopened.snapshot())).toBe(hash);
    expect(reopened.project()).toEqual(projectSliceState(success));
    // The controlled branch cannot masquerade as an unmodified natural run.
    // A strict replay must use the same explicit seam when it changed a draw.
    if (scenario.cursorAdvancement.actual !== 1) {
      seam.restore();
      try { expect(() => openWhiteTowerRuntimeSession(JSON.parse(JSON.stringify(success)))).toThrow(); }
      finally { seam = installControlledWhiteTowerPromotion(); }
    }
    expect(whiteTowerScenarioHash(success)).toBe(hash);
  }, fullHistoryBudget);

  it('rejects bare S0, missing consumption/history, substituted rolls, fabricated passage receipts and tampered original sources', () => {
    const { source, success } = scenario, hash = whiteTowerScenarioHash(success);
    const forgeries: { name: string; base: SliceState; change: (state: SliceState) => void }[] = [
      { name: 'bare S0 on authentic S1', base: source, change: state => { state.progression.sequence = 0; } },
      { name: 'empty own history', base: success, change: state => { state.whiteTower = createWhiteTowerState(); } },
      { name: 'missing actual CONSUME', base: success, change: state => { state.whiteTower.journal.pop(); } },
      { name: 'self-asserted roll', base: success, change: state => { state.whiteTower.journal.at(-1)!.randomReceipts[0]!.check.roll = 2; } },
      { name: 'fabricated passage review', base: success, change: state => { state.whiteTower.passages!.routes[0]!.review!.eventId = 'fabricated-review'; } },
      { name: 'rewritten source budget', base: success, change: state => { state.whiteTower.source!.budget.cash++; } },
      { name: 'original mastery rewritten', base: success, change: state => { state.whiteTower.source!.budget.mastery['reader.s1.bounded-insight'] = 8; } },
      { name: 'duplicated original characteristic', base: success, change: state => { state.whiteTower.materials!.characteristics.push(structuredClone(state.whiteTower.materials!.characteristics[0]!)); } },
    ];
    for (const forgery of forgeries) {
      const state = structuredClone(forgery.base); forgery.change(state);
      expect(validateWhiteTowerState(state), forgery.name).toBe(false);
      expect(() => assertValidSliceState(state), forgery.name).toThrow();
      expect(() => openWhiteTowerRuntimeSession(state), forgery.name).toThrow();
    }
    expect(whiteTowerScenarioHash(success)).toBe(hash);
  }, fullHistoryBudget);

  it('keeps snapshots and drafts detached, rejects copied/cross-session/stale authority and commits one actual consume only once', () => {
    const { beforeConsume, success } = scenario, beforeHash = whiteTowerScenarioHash(beforeConsume), successHash = whiteTowerScenarioHash(success);
    const first = openWhiteTowerRuntimeSession(beforeConsume), second = openWhiteTowerRuntimeSession(beforeConsume);
    const snapshot = first.snapshot(); snapshot.whiteTower.source!.budget.cash++; snapshot.random.cursor++;
    expect(whiteTowerScenarioHash(first.snapshot())).toBe(beforeHash);
    const cancelled = first.prepare(WHITE_TOWER_CONTROLLED_CONSUME, beforeConsume.revision);
    first.discard(cancelled); expect(() => first.commit(cancelled)).toThrow();
    const draft = first.prepare(WHITE_TOWER_CONTROLLED_CONSUME, beforeConsume.revision);
    const sibling = first.prepare(WHITE_TOWER_CONTROLLED_CONSUME, beforeConsume.revision);
    const detached = first.snapshotDraft(draft); detached.whiteTower.journal.pop(); detached.cash++;
    expect(whiteTowerScenarioHash(first.snapshotDraft(draft))).toBe(successHash);
    expect(first.projectDraft(draft)).toEqual(projectSliceState(success));
    expect(() => second.commit(draft)).toThrow(); expect(() => first.commit({ ...draft })).toThrow();
    expect(() => first.prepare(WHITE_TOWER_CONTROLLED_CONSUME, beforeConsume.revision + 1)).toThrow();
    expect(whiteTowerScenarioHash(first.snapshot())).toBe(beforeHash);
    first.commit(draft);
    expect(() => first.commit(draft)).toThrow(); expect(() => first.commit(sibling)).toThrow();
    expect(() => first.prepare(WHITE_TOWER_CONTROLLED_CONSUME, success.revision)).toThrow();
    expect(() => first.prepare({ type: 'DARKNESS', command: { type: 'REST' } }, success.revision)).toThrow();
    expect(() => applySliceIntent(success, WHITE_TOWER_CONTROLLED_CONSUME)).toThrow();
    expect(whiteTowerScenarioHash(first.snapshot())).toBe(successHash);
    expect(whiteTowerScenarioHash(second.snapshot())).toBe(beforeHash);
    const reopened = openWhiteTowerRuntimeSession(JSON.parse(JSON.stringify(first.snapshot())));
    expect(whiteTowerScenarioHash(reopened.snapshot())).toBe(successHash);
    expect(reopened.snapshot().whiteTower.materials!.settlements).toHaveLength(1);
  }, fullHistoryBudget);
});
