import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addGameWeeks, compareGameDates } from '../../src/domain/game-calendar.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { createDarknessState, darknessCommandBlock, validateDarknessState } from '../../src/domain/darkness/index.js';
import { openDarknessRuntimeSession } from '../../src/domain/darkness/owned-session.js';
import { DARKNESS_FROZEN_SOURCE_KEYS } from '../../src/domain/darkness/source.js';
import { DARKNESS_ABILITY_IDS } from '../../src/domain/darkness/types.js';
import { DARKNESS_WORKSHOP } from '../../src/domain/darkness/content.js';
import { DARKNESS_FUTURE_BRANCH } from '../../src/domain/darkness/material-content.js';
import { darknessEvacuationVerifiedReceipts } from '../../src/domain/darkness/evacuation.js';
import { getDarknessPromotionStabilityPreview } from '../../src/domain/darkness/engine.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import {
  DARKNESS_CONTROLLED_CONSUME, DARKNESS_CONTROLLED_CURSOR, DARKNESS_CONTROLLED_SEED,
  DARKNESS_ORIGINAL_DEATH, assertUnmodifiedDarknessInputs, controlledDarknessSuccess,
  darknessScenarioDate, darknessScenarioHash, installControlledDarknessPromotion,
  type ControlledDarknessSuccess,
} from '../helpers/darkness-scenario.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

/** One full, explicitly controlled construction shared read-only by six cases.
 * The180s setup budget covers the authentic old history and every new owned
 * command; each120s case budget includes strict cold reconstruction. No test
 * rewrites a fixture, fabricates S0, or claims this is a natural success. */
let seam: ReturnType<typeof installControlledDarknessPromotion>;
let scenario: ControlledDarknessSuccess;
beforeAll(() => {
  seam = installControlledDarknessPromotion();
  scenario = controlledDarknessSuccess(seam);
}, 180_000);
afterAll(() => {
  seam?.restore();
  assertUnmodifiedDarknessInputs();
}, 120_000);

function assertDarknessPublicBoundary(view: SliceProjection, state: SliceState): void {
  const forbidden = new Set(['random', 'seed', 'cursor', 'randomSeed', 'randomCursor',
    'randomCursorBefore', 'randomCursorAfter', 'cursorBefore', 'cursorAfter',
    'randomBefore', 'randomAfter', 'randomReceipts', 'sourceDigest', 'historyDigest',
    'originalsDigest', 'originalPracticeDigest', 'acquisitionDigest', 'beforeDigest', 'afterDigest',
    'actorId', 'predecessorActorId', 'incumbentActorId', 'custodianActorId']);
  const leaks: string[] = [];
  const visit = (node: unknown, path: string): void => {
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      const next = `${path}.${key}`;
      // These two unrelated, inactive public guard slots carry a null target,
      // not this run's private source actor identity. Do not ban a field name
      // irrespective of its exact public meaning.
      const inactivePublicGuard = key === 'actorId' && value === null &&
        ['$.divineHand.life.site.guard.actorId', '$.glory.life.site.guard.actorId'].includes(next);
      if (forbidden.has(key) && !inactivePublicGuard || key === 'source' && value !== null && typeof value === 'object') leaks.push(next);
      visit(value, next);
    }
  };
  visit(view, '$');
  expect(leaks, `Whole public state must not expose private replay or original-actor authority: ${leaks.join(', ')}`).toEqual([]);
  const json = JSON.stringify(view);
  expect(json).not.toContain(state.random.seed);
  expect(json).not.toContain(state.darkness.source!.actorId);
  expect(json).not.toContain(state.darkness.source!.historyDigest);
  const panel = view.darkness;
  // Inspect display copy only. Commands, stable IDs, legitimate check modifier
  // source labels and published preparation amounts are not authoring labels.
  const display = [panel.title, panel.story, panel.nextStep, panel.risk,
    ...panel.abilities.flatMap(ability => [ability.label, ability.description]),
    ...panel.actions.flatMap(action => [action.label, action.cost, action.reason ?? '']),
    ...panel.sections.flatMap(section => [section.title, ...section.lines])].join('\n');
  expect(display).not.toMatch(/未知|候选G|原创G|本作G|G专业|G候选/);
}

describe('Darkness real-history controlled S0 and strict central save authority', () => {
  it('keeps the genuine679 living source and694 death unchanged, controlling only the first new d100', () => {
    const { source, success } = scenario;
    for (let cursor = 0; cursor < DARKNESS_CONTROLLED_CURSOR; cursor++) {
      const actual = new DeterministicActionRandomStream(DARKNESS_CONTROLLED_SEED, cursor);
      const expected = new DeterministicActionRandomStream(DARKNESS_CONTROLLED_SEED, cursor);
      expect(actual.nextInt(1, 100)).toBe(seam.original.call(expected, 1, 100));
      expect(actual.cursor).toBe(cursor + 1);
    }
    const next = new DeterministicActionRandomStream(DARKNESS_CONTROLLED_SEED, DARKNESS_CONTROLLED_CURSOR);
    expect(next.nextInt(1, 100)).toBe(1); expect(next.cursor).toBe(349);
    expect(next.nextInt(1, 100)).toBe(seam.original.call(new DeterministicActionRandomStream(DARKNESS_CONTROLLED_SEED, 349), 1, 100));
    for (const [seed, minimum, maximum] of [[DARKNESS_CONTROLLED_SEED, 0, 9], ['unrelated-darkness-seed', 1, 100]] as const) {
      const actual = new DeterministicActionRandomStream(seed, 348), expected = new DeterministicActionRandomStream(seed, 348);
      expect(actual.nextInt(minimum, maximum)).toBe(seam.original.call(expected, minimum, maximum));
    }
    expect(seam.substituted.every(draw => draw.cursorBefore === 348 && draw.cursorAfter === 349 && draw.controlled === 1)).toBe(true);
    expect(scenario.cursorAdvancement).toMatchObject({ cursorBefore: 348, cursorAfter: 349, chance: 70, roll: 1 });
    expect(source.random).toEqual({ seed: DARKNESS_CONTROLLED_SEED, cursor: 348 });
    expect(success.random).toEqual({ seed: DARKNESS_CONTROLLED_SEED, cursor: 349 });
    expect(readObjectEntry<unknown[]>(DARKNESS_ORIGINAL_DEATH, 'commands')).toHaveLength(694);
    const originalDeath = readObjectEntry<SliceState>(DARKNESS_ORIGINAL_DEATH, 'final');
    const deadHash = darknessScenarioHash(originalDeath);
    // The separate genuine694 death also consumes cursor348, in its original
    // combat. Its migration and validation must use the unmodified RNG, never
    // this alternative continuation's deliberately controlled promotion draw.
    seam.restore();
    try {
      const dead = migrateSliceState(originalDeath);
      assertValidSliceState(dead);
      expect(dead).toMatchObject({ revision: 695, status: 'DEAD', health: 0, week: 159,
        progression: { pathwayId: 'darkness', sequence: 1 }, random: { cursor: 444 } });
      expect(dead.darkness).toEqual(createDarknessState());
      expect(() => applySliceIntent(dead, { type: 'DARKNESS', command: { type: 'LEARN_GUIDANCE' } })).toThrow();
    } finally {
      seam = installControlledDarknessPromotion();
    }
    expect(darknessScenarioHash(originalDeath)).toBe(deadHash);
    for (const key of DARKNESS_FROZEN_SOURCE_KEYS) expect(success[key]).toEqual(source[key]);
    expect(success.combatHistory).toEqual(source.combatHistory);
    expect(success.world).toEqual(source.world);
    assertUnmodifiedDarknessInputs();
  }, 120_000);

  it('pays guidance and every later cost through real work and calendar transactions with no free reset', () => {
    const { source, guided, success, commands } = scenario;
    expect(guided.revision).toBe(source.revision + 1);
    expect(guided.cash).toBe(source.cash - 100);
    expect(guided.actionsRemaining).toBe(source.actionsRemaining - 1);
    expect(guided.darkness.journal).toEqual([]);
    expect(guided.darkness.source!.budget).toMatchObject({ cash: 400, actions: 3, health: 100, mind: 97, spirituality: 112 });
    expect(guided.darkness.frame!.location).toBe('贝克兰德原庭院');
    expect(guided.darkness.evacuation!.residents.map(p => p.position)).toEqual([0, 10, 25, 40]);
    expect(success.darkness.journal.map(event => event.command)).toEqual(commands.slice(1));
    expect(success.revision).toBe(source.revision + commands.length);
    const workedWeeks: number[] = [];
    let previous = guided.darkness.frame!;
    for (const [index, event] of success.darkness.journal.entries()) {
      expect(event.revision).toBe(source.revision + 2 + index);
      expect(event.before).toEqual(previous);
      expect(event.after.nowSecond).toBeGreaterThanOrEqual(event.before.nowSecond);
      const weeks = event.after.budget.week - event.before.budget.week;
      expect(event.after.budget.date).toEqual(addGameWeeks(event.before.budget.date, weeks));
      expect(event.after.weekAnchor - event.before.weekAnchor).toBe(weeks * 604800);
      if (event.command.type === 'WORK') {
        workedWeeks.push(event.before.budget.week);
        expect(event.after.budget.cash).toBe(event.before.budget.cash + source.character.weeklyWage);
        expect(event.after.budget.actions).toBe(event.before.budget.actions - 1);
        expect(event.after.nowSecond - event.before.nowSecond).toBe(28800);
      }
      if (event.command.type === 'NEXT_WEEK') {
        expect(weeks).toBe(1);
        expect(event.after.budget.cash).toBe(event.before.budget.cash - 30);
        expect(event.after.budget.actions).toBe(source.weeklyBudget);
        expect(event.after.budget.health).toBe(event.before.budget.health);
        expect(event.after.budget.mind).toBe(event.before.budget.mind);
        expect(event.after.budget.spirituality).toBe(event.before.budget.spirituality);
      }
      previous = event.after;
    }
    expect(new Set(workedWeeks).size).toBe(workedWeeks.length);
    expect(success.week).toBeGreaterThanOrEqual(186);
    const livingBills = success.darkness.journal.flatMap(event => event.financeReceipts).filter(receipt => receipt.title === '本周生活费');
    expect(livingBills).toHaveLength(success.week - source.week);
    // Guidance100 + finite kit108 + two investigations240 + chain/vacancy60
    // + unique object240 + carrier360 + composition120 + preparation100.
    expect(success.cash).toBe(source.cash + workedWeeks.length * 180 - (success.week - source.week) * 30 - 1328);
    expect(success.debts).toEqual(source.debts);
    expect(success.darkness.source).toEqual(guided.darkness.source);
  }, 120_000);

  it('earns all four night arrivals and recovers the two actual failed originals before the dated unique handover', () => {
    const { source, evacuated, beforeFuture, beforeConsume } = scenario;
    const ev = evacuated.darkness.evacuation!, materials = beforeConsume.darkness.materials!;
    expect(ev.survey.walkedEdges).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(ev.residents.map(p => [p.id, p.age, p.position, p.consent])).toEqual([
      ['DN-LENA', 32, 110, 'ACCEPT'], ['DN-JONAH', 41, 110, 'ACCEPT'],
      ['DN-ADA', 36, 110, 'ACCEPT'], ['DN-NOAH', 58, 110, 'ACCEPT'],
    ]);
    for (const person of ev.residents) {
      expect(person.permissionHistory).toHaveLength(1);
      expect(person.permissionHistory[0]).toMatchObject({ answer: 'ACCEPT', position: person.home });
      const night = ev.nights.find(n => n.id === person.arrival!.nightId)!;
      expect(person.arrival!.second).toBeGreaterThanOrEqual(night.startSecond);
      expect(person.arrival!.second).toBeLessThan(night.endSecond);
      expect(person.injuries).toEqual([]);
    }
    expect(new Set(ev.residents.map(p => p.arrival!.eventId)).size).toBe(4);
    expect(ev.journal.reduce((metres, receipt) => metres + receipt.walkedMeters, 0)).toBe(1060);
    expect(ev).toMatchObject({ position: 0, escortId: null, playerInjuries: [] });
    expect(ev.supplies.stock).toBe(0);
    expect(ev.supplies.totalOilUsedSeconds).toBeGreaterThan(0);
    expect(ev.supplies.lamps.reduce((oil, lamp) => oil + lamp.oilSeconds, 0) + ev.supplies.totalOilUsedSeconds).toBe(7200);
    expect(ev.supplies.rope).toMatchObject({ id: 'DN-ROPE-1', condition: 99, usedMeters: 2 });
    expect(darknessEvacuationVerifiedReceipts(ev).length).toBeGreaterThan(0);
    expect(beforeConsume.darkness.evacuation).toEqual(ev);
    expect(materials.embodiedOriginalBottleId).toBe('misfortune-knight-potion-3');
    expect(materials.legacyRemains.map(r => r.originalBottleId)).toEqual(['misfortune-knight-potion-1', 'misfortune-knight-potion-2']);
    for (const remains of materials.legacyRemains) {
      const investigation = beforeConsume.darkness.journal.find(event => event.id === remains.investigatedEventId)!;
      const recovery = beforeConsume.darkness.journal.find(event => event.id === remains.recoveredEventId)!;
      expect(investigation.before.budget.cash - investigation.after.budget.cash).toBe(120);
      expect(recovery.before.budget.week).toBeGreaterThan(investigation.before.budget.week);
      expect(recovery.before.location).toBe(investigation.before.location);
      expect(remains.residualPresent).toBe(false);
      expect(source.misfortuneKnight.acquisitionJournal.some(event => event.revision === remains.originalConsumeRevision && event.check?.tier === 'FAILURE')).toBe(true);
    }
    expect(compareGameDates(darknessScenarioDate(beforeFuture), DARKNESS_FUTURE_BRANCH.transferDate)).toBeLessThan(0);
    expect(darknessCommandBlock(beforeFuture, { type: 'MATERIAL', command: { type: 'VERIFY_UNIQUENESS', step: 'CHAIN' } })).toContain('真实日期');
    expect(materials.uniqueness.checks.map(check => check.step)).toEqual(['CHAIN', 'VACANCY']);
    for (const check of materials.uniqueness.checks) {
      const event = beforeConsume.darkness.journal.find(event => event.id === check.eventId)!;
      const actualDate = addGameWeeks(source.date, event.before.budget.week - source.week);
      expect(compareGameDates(actualDate, DARKNESS_FUTURE_BRANCH.transferDate)).toBeGreaterThanOrEqual(0);
    }
    expect(materials.uniqueness.succession).toMatchObject({ objectCount: 1, predecessorStillEmbodied: false,
      termination: { id: DARKNESS_FUTURE_BRANCH.terminationEventId, cause: 'ACTUAL_DEATH' },
      separation: { id: DARKNESS_FUTURE_BRANCH.separationEventId },
      transfer: { id: DARKNESS_FUTURE_BRANCH.transferEventId, custodyOnly: true }, incumbentActorId: null });
    expect(materials.uniqueness.deliveryRecord).toMatchObject({ vacancyRechecked: true, week: materials.uniqueness.checks[1]!.week });
    expect(materials.compounds[0]!.evacuationReceipts).toEqual(darknessEvacuationVerifiedReceipts(ev));
  }, 120_000);

  it('strictly validates and centrally projects a truly consumed S0 with70% paid preparation and exactly22 abilities', () => {
    const { source, beforePreparation, beforeConsume, success } = scenario;
    const preparation = beforeConsume.darkness.promotionStability.preparations[0]!, last = success.darkness.journal.at(-1)!;
    expect(darknessCommandBlock(beforePreparation, DARKNESS_CONTROLLED_CONSUME.command)).toContain('准备');
    expect(getDarknessPromotionStabilityPreview(beforeConsume.darkness, preparation.compoundId)).toMatchObject({ prepared: true, preparedChance: 70 });
    expect(beforeConsume.cash).toBe(beforePreparation.cash - 100);
    expect(beforeConsume.spirituality).toBe(beforePreparation.spirituality - 12);
    expect(beforeConsume.mind).toBe(beforePreparation.mind - 8);
    expect(beforeConsume.actionsRemaining).toBe(beforePreparation.actionsRemaining - 1);
    expect(preparation).toMatchObject({ status: 'READY', location: DARKNESS_WORKSHOP, spentEventId: null });
    expect(preparation.expiresSecond - preparation.preparedSecond).toBe(604800);
    expect(last.command).toEqual(DARKNESS_CONTROLLED_CONSUME.command);
    expect(last.before).toEqual(beforeConsume.darkness.frame);
    expect(last.after).toEqual(success.darkness.frame);
    expect(last.randomReceipts).toEqual([{ kind: 'CHECK', id: `${last.id}:check:1`, cursorBefore: 348, cursorAfter: 349,
      check: { ability: 'will', baseAbility: 31, modifiers: [{ source: '本瓶本次实际稳定准备', value: 40 }],
        effectiveAbility: 71, difficulty: 61, chance: 70, roll: 1, tier: 'GREAT_SUCCESS' } }]);
    expect(success.progression).toMatchObject({ pathwayId: 'darkness', sequence: 0, acting: 0 });
    expect(success.darkness.promotionWeek).toBe(beforeConsume.week);
    expect([success.cash, success.health, success.mind, success.spirituality, success.actionsRemaining])
      .toEqual([beforeConsume.cash, beforeConsume.health, beforeConsume.mind - 12, beforeConsume.spirituality - 30, beforeConsume.actionsRemaining - 1]);
    expect(success.darkness.promotionStability.preparations).toEqual([{ ...preparation, status: 'SPENT', spentEventId: last.id }]);
    expect(Object.keys(source.progression.mastery)).toHaveLength(20);
    expect(Object.keys(success.progression.mastery)).toHaveLength(22);
    for (const [id, mastery] of Object.entries(source.progression.mastery)) expect(success.progression.mastery[id]).toBe(mastery);
    for (const id of DARKNESS_ABILITY_IDS) expect(success.progression.mastery[id]).toBe(0);
    const materials = success.darkness.materials!;
    expect(materials.characteristics).toHaveLength(3);
    for (const item of [...materials.characteristics, materials.uniqueness])
      expect(item).toMatchObject({ holder: 'FUSED', compoundId: 'darkness-compound-1', location: materials.origin.actorId });
    expect(materials.uniqueness.incumbentActorId).toBe(materials.origin.actorId);
    expect(materials.compounds).toHaveLength(1);
    expect(materials.compounds[0]).toMatchObject({ status: 'SUCCESS', settlementEventId: last.id });
    expect(materials.settlements).toHaveLength(1);
    expect(materials.batches.map(batch => [batch.id, batch.status, batch.uses])).toEqual([
      ['darkness-carrier-1', 'SPENT', 1], ['darkness-carrier-2', 'SUPPLIER', 0], ['darkness-carrier-3', 'SUPPLIER', 0],
    ]);
    const hash = darknessScenarioHash(success);
    assertValidSliceState(success);
    expect(validateDarknessState(success)).toBe(true);
    const publicState = projectSliceState(success);
    assertDarknessPublicBoundary(publicState, success);
    expect(publicState.darkness).toMatchObject({ promoted: true, insideCase: false });
    expect(publicState.darkness.abilities).toHaveLength(22);
    expect(publicState.darkness).not.toHaveProperty('source');
    expect(publicState.darkness).not.toHaveProperty('frame');
    expect(publicState.darkness).not.toHaveProperty('journal');
    for (const earlier of [scenario.guided, scenario.beforeFuture]) {
      const beforeHash = darknessScenarioHash(earlier), publicEarlier = projectSliceState(earlier);
      assertDarknessPublicBoundary(publicEarlier, earlier);
      const future = publicEarlier.darkness.sections.find(section => section.id === 'future-branch')!;
      expect(future.lines.join('')).toContain('1353年1月9日');
      expect(future.lines.join('')).toContain('查询');
      for (const spoiler of [DARKNESS_FUTURE_BRANCH.predecessorName, DARKNESS_FUTURE_BRANCH.custodianName,
        '1353年1月8日', '长夜旧塔倒塌', '遗体析出']) expect(future.lines.join('')).not.toContain(spoiler);
      expect(darknessScenarioHash(earlier)).toBe(beforeHash);
    }
    const knownSuccession = publicState.darkness.sections.find(section => section.id === 'future-branch')!;
    for (const fact of [DARKNESS_FUTURE_BRANCH.predecessorName, DARKNESS_FUTURE_BRANCH.custodianName, '遗体析出'])
      expect(knownSuccession.lines.join('')).toContain(fact);
    const reopened = openDarknessRuntimeSession(JSON.parse(JSON.stringify(success)));
    expect(darknessScenarioHash(reopened.snapshot())).toBe(hash);
    expect(reopened.project()).toEqual(publicState);
    expect(darknessScenarioHash(success)).toBe(hash);
  }, 120_000);

  it('rejects bare S0, missing actual history, substituted receipts and duplicated original objects at central save entry', () => {
    const { source, success } = scenario, hash = darknessScenarioHash(success);
    const forgeries: { name: string; base: SliceState; change: (state: SliceState) => void }[] = [
      { name: 'bareS0 on untouched S1', base: source, change: state => { state.progression.sequence = 0; } },
      { name: 'empty own chapter after success', base: success, change: state => { state.darkness = createDarknessState(); } },
      { name: 'missing consume history', base: success, change: state => { state.darkness.journal.pop(); } },
      { name: 'self-asserted replacement roll', base: success, change: state => { state.darkness.journal.at(-1)!.randomReceipts[0]!.check.roll = 2; } },
      { name: 'same original fused twice', base: success, change: state => { state.darkness.materials!.characteristics.push(structuredClone(state.darkness.materials!.characteristics[0]!)); } },
    ];
    for (const forgery of forgeries) {
      const state = structuredClone(forgery.base); forgery.change(state);
      expect(validateDarknessState(state), forgery.name).toBe(false);
      expect(() => assertValidSliceState(state), forgery.name).toThrow();
      expect(() => openDarknessRuntimeSession(state), forgery.name).toThrow();
    }
    expect(darknessScenarioHash(success)).toBe(hash);
  }, 120_000);

  it('commits one prepared consume exactly once, rejects duplicate and stale drafts, and survives strict JSON reopen', () => {
    const { beforeConsume, success } = scenario, beforeHash = darknessScenarioHash(beforeConsume);
    const session = openDarknessRuntimeSession(beforeConsume), revision = session.inspect().revision;
    const cancelled = session.prepare(DARKNESS_CONTROLLED_CONSUME, revision);
    session.discard(cancelled);
    expect(() => session.commit(cancelled)).toThrow();
    expect(darknessScenarioHash(session.snapshot())).toBe(beforeHash);
    const first = session.prepare(DARKNESS_CONTROLLED_CONSUME, revision);
    const stale = session.prepare(DARKNESS_CONTROLLED_CONSUME, revision);
    expect(darknessScenarioHash(session.snapshot())).toBe(beforeHash);
    const detachedDraft = session.snapshotDraft(first); detachedDraft.cash += 1;
    expect(darknessScenarioHash(session.snapshotDraft(first))).toBe(darknessScenarioHash(success));
    session.commit(first);
    const saved = session.snapshot(), savedHash = darknessScenarioHash(saved);
    expect(savedHash).toBe(darknessScenarioHash(success));
    expect(() => session.commit(first)).toThrow();
    expect(() => session.commit(stale)).toThrow();
    expect(() => session.prepare(DARKNESS_CONTROLLED_CONSUME, revision)).toThrow();
    expect(() => session.prepare(DARKNESS_CONTROLLED_CONSUME, saved.revision)).toThrow();
    expect(() => applySliceIntent(saved, DARKNESS_CONTROLLED_CONSUME)).toThrow();
    expect(darknessScenarioHash(session.snapshot())).toBe(savedHash);
    const reopened = openDarknessRuntimeSession(JSON.parse(JSON.stringify(saved)));
    expect(darknessScenarioHash(reopened.snapshot())).toBe(savedHash);
    expect(reopened.snapshot().darkness.materials!.settlements).toHaveLength(1);
    expect(reopened.snapshot().darkness.journal.flatMap(event => event.randomReceipts)).toHaveLength(1);
    expect(() => reopened.prepare(DARKNESS_CONTROLLED_CONSUME, saved.revision)).toThrow();
    expect(darknessScenarioHash(beforeConsume)).toBe(beforeHash);
  }, 120_000);
});
