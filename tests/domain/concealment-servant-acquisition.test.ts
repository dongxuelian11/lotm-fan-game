import { describe, expect, it, vi } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyConcealmentServantAcquisition, createConcealmentServantState, hasConcealmentServantLock,
  isConcealmentServantAcquisitionCommand, projectConcealmentServant, validateConcealmentServantCommand,
  validateConcealmentServantState, concealmentServantAcquisitionBlock } from '../../src/domain/concealment-servant/index.js';
import { CONCEALMENT_SERVANT_FORMULA_STATUS, CONCEALMENT_SERVANT_SOURCE_STATUS, CONCEALMENT_SERVANT_CONSUMPTION_RISK,
  CONCEALMENT_SERVANT_PRICES, CONCEALMENT_SERVANT_POTION_SOURCES } from '../../src/domain/concealment-servant/content.js';
import { CONCEALMENT_SERVANT_ABILITY_IDS, CONCEALMENT_SERVANT_PREPARATION_IDS,
  type ConcealmentServantAcquisitionCommand } from '../../src/domain/concealment-servant/types.js';
import { darknessLegacyKeys, fearBishopFixturePath } from './concealment-servant-test-fixture.js';

/** Explicit directed unit setup from the genuine 420-command S3 survivor, NOT natural-play evidence. */
function fearBishop(): SliceState {
  const s = migrateSliceState(readObjectEntry<unknown>(fearBishopFixturePath, 'final'));
  s.concealmentServant = createConcealmentServantState();
  s.week = s.fearBishop.promotionWeek! + 12;
  s.activeEvent = null; s.eventQueue = []; s.combat = null;
  s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 30;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: ConcealmentServantAcquisitionCommand, roll = 1) { const c = context(s, roll); applyConcealmentServantAcquisition(s, command, c); return c; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyConcealmentServantAcquisition(s, command as ConcealmentServantAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled(); expect(c.note).not.toHaveBeenCalled();
}
function taught(s = fearBishop()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function qualify(s: SliceState) { for (const taskId of CONCEALMENT_SERVANT_PREPARATION_IDS) apply(s, { type: 'PREPARE_TASK', taskId }); return s; }
function buy(s: SliceState, index = 0) { const b = s.concealmentServant.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.concealmentServant.bottles[index]!.id, confirmed: true }) as const;
function prepared() { const s = qualify(taught()); buy(s); apply(s, { type: 'PREPARE_PROMOTION' }); return s; }

const oldRoots = (s: SliceState) => [...darknessLegacyKeys.map(k => s[k]), s.spiritWarlock];

describe('Concealment Servant S2 independent acquisition and source boundaries', () => {
  it('keeps the genuine S3 survivor and all16 old mastery entries before directed setup', () => {
    const old = readObjectEntry<SliceState>(fearBishopFixturePath, 'final'), s = migrateSliceState(old);
    expect(readObjectEntry<unknown[]>(fearBishopFixturePath, 'commands')).toHaveLength(420);
    expect(old).toMatchObject({ week: 105, health: 80, mind: 100, spirituality: 111, cash: 580, actionsRemaining: 3, injuryRisk: 3,
      random: { seed: 'sleepless-natural-v020', cursor: 334 }, progression: { sequence: 3, acting: 100, promotionWeek: 5 }, fearBishop: { promotionWeek: 97 } });
    expect(Object.keys(old.progression.mastery)).toHaveLength(16); expect(s.fearBishop).toEqual(old.fearBishop);
    expect(validateConcealmentServantState(s)).toBe(true); expect(projectConcealmentServant(s).digestion).toContain('8/12');
  });
  it('creates isolated initial originals and hides the source outside implemented Darkness history', () => {
    const s = createSliceRun('concealment-hidden', sliceDefaultCreationSelection, 'concealment-hidden');
    expect(projectConcealmentServant(s)).toMatchObject({ discovered: false, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], resources: null });
    expect(projectConcealmentServant(s).story).toBeUndefined(); reject(s, { type: 'LEARN_GUIDANCE' });
    const other = createConcealmentServantState(); other.bottles[0]!.labourSteps = 5;
    expect(s.concealmentServant.bottles[0]!.labourSteps).toBe(0); expect(validateConcealmentServantState(s)).toBe(true);
    for (const sequence of [9, 8, 7, 6, 5, 4, 0]) {
      const t = fearBishop(); t.progression.sequence = sequence as NonNullable<SliceState['progression']['sequence']>;
      expect(projectConcealmentServant(t).discovered).toBe(false); reject(t, { type: 'LEARN_GUIDANCE' });
    }
    const forgedS1 = fearBishop(); forgedS1.progression.sequence = 1; expect(() => assertValidSliceState(forgedS1)).toThrow(TypeError); reject(forgedS1, { type: 'LEARN_GUIDANCE' });
    const t = fearBishop(); t.progression.pathwayId = 'diviner'; expect(projectConcealmentServant(t).discovered).toBe(false); reject(t, { type: 'LEARN_GUIDANCE' });
  });
  it('separates high-confidence name inference, verified direction, unknown formula and original G numbers', () => {
    const s = fearBishop(), prior = structuredClone(oldRoots(s)); apply(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]); expect(oldRoots(s)).toEqual(prior);
    expect(CONCEALMENT_SERVANT_PRICES).toEqual({ guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 });
    expect(CONCEALMENT_SERVANT_SOURCE_STATUS).toContain('高置信推断'); expect(CONCEALMENT_SERVANT_SOURCE_STATUS).toContain('不是原文直接');
    expect(CONCEALMENT_SERVANT_SOURCE_STATUS).toContain('高阶规则能阻挡'); expect(CONCEALMENT_SERVANT_SOURCE_STATUS).toContain('可能伤及旁人');
    expect(CONCEALMENT_SERVANT_SOURCE_STATUS).toContain('均为原创G'); expect(CONCEALMENT_SERVANT_SOURCE_STATUS).toContain('跨链推断');
    expect(CONCEALMENT_SERVANT_FORMULA_STATUS).toContain('完整配方与晋升仪式仍未知'); expect(CONCEALMENT_SERVANT_FORMULA_STATUS).toContain('不能断言原著无需仪式');
    expect(CONCEALMENT_SERVANT_CONSUMPTION_RISK).toContain('不保护普通死亡或战斗');
    expect(projectConcealmentServant(s)).toMatchObject({ formulaKnown: false, formula: [], preparations: CONCEALMENT_SERVANT_PREPARATION_IDS.map(taskId => ({ taskId, completedWeek: null })) });
    expect(s.concealmentServant.bottles.map(b => b.source)).toEqual(CONCEALMENT_SERVANT_POTION_SOURCES.map(b => b.source));
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires independent five-job labour and actual800 payment, never free preparation or shared credit', () => {
    const s = taught(), before = structuredClone(oldRoots(s)), b = s.concealmentServant.bottles[0]!;
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); const cash = s.cash; buy(s);
    expect(s.cash).toBe(cash - 800); expect(b).toMatchObject({ status: 'PLAYER', acquiredWeek: s.week });
    expect(s.concealmentServant.bottles[1]!.labourSteps).toBe(0); expect(s.concealmentServant.preparations).toEqual([]);
    expect(s.concealmentServant.preparedWeek).toBeNull(); expect(oldRoots(s)).toEqual(before); reject(s, { type: 'BUY_POTION', bottleId: b.id });
  });
  it('does not partially discount a bottle or borrow old S3 bottles', () => {
    const s = taught(), b = s.concealmentServant.bottles[0]!;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(6200);
    for (const bottleId of ['fear-bishop-potion-1', 'nightwatcher-potion-1', 'spirit-warlock-potion-2']) reject(s, { type: 'BUY_POTION', bottleId });
    s.cash = 6199; reject(s, { type: 'BUY_POTION', bottleId: s.concealmentServant.bottles[1]!.id });
  });
  it('requires three distinct tasks and separate current-week inspection and dose confirmation', () => {
    const s = taught(); buy(s); reject(s, dose(s)); reject(s, { type: 'PREPARE_PROMOTION' });
    for (const [i, taskId] of CONCEALMENT_SERVANT_PREPARATION_IDS.entries()) {
      const ap = s.actionsRemaining; apply(s, { type: 'PREPARE_TASK', taskId }); expect(s.actionsRemaining).toBe(ap - 1);
      reject(s, { type: 'PREPARE_TASK', taskId }); if (i < 2) reject(s, { type: 'PREPARE_PROMOTION' });
    }
    const scenes = structuredClone([s.concealmentServant.life, s.concealmentServant.encounter]), cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'PREPARE_PROMOTION' }); expect([s.cash, s.actionsRemaining, s.concealmentServant.preparedWeek]).toEqual([cash - 120, ap - 1, s.week]);
    expect([s.concealmentServant.life, s.concealmentServant.encounter]).toEqual(scenes); expect(hasConcealmentServantLock(s)).toBe(true);
    for (const command of [{ type: 'CONSUME', bottleId: dose(s).bottleId }, { ...dose(s), confirmed: false }, { ...dose(s), ritual: true }]) {
      expect(validateConcealmentServantCommand(command)).toBe(false); reject(s, command);
    }
  });
  it('starts the twelve full weeks at actual S3 W97, never original S9 W5', () => {
    const s = qualify(taught()); buy(s); expect(s.fearBishop.promotionWeek).toBe(97); expect(s.progression.promotionWeek).toBe(5);
    s.week = 105; expect(concealmentServantAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('8/12');
    s.week = 108; reject(s, { type: 'PREPARE_PROMOTION' }); s.week = 109; apply(s, { type: 'PREPARE_PROMOTION' });
    expect(s.concealmentServant.preparedWeek).toBe(109); expect(s.progression.promotionWeek).toBe(5);
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 2], [30, 'SUCCESS', 85, 100, 0, 2], [90, 'FAILURE', 75, 85, 30, 3], [100, 'GREAT_FAILURE', 55, 75, 60, 3]] as const)
    ('settles directed roll%s as%s without healing, rewriting16 old mastery or old people', (roll, tier, mind, health, pollution, sequence) => {
      const s = prepared(), old = structuredClone(oldRoots(s)), mastery = { ...s.progression.mastery }, stats = { ...s.character.coreStats };
      const injuries = structuredClone(s.injuries), risk = s.injuryRisk, history = structuredClone(s.combatHistory), town = structuredClone(s.town), seed = structuredClone(s.random);
      s.actionsRemaining = 0; const c = apply(s, dose(s), roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 30);
      expect([s.concealmentServant.bottles[0]!.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
      expect(s.concealmentServant.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: s.week, preparationWeek: s.week });
      expect(s.concealmentServant.preparedWeek).toBeNull(); expect(hasConcealmentServantLock(s)).toBe(false);
      expect(oldRoots(s)).toEqual(old); expect(s.injuries).toEqual(injuries); expect(s.injuryRisk).toBe(risk);
      expect(s.combatHistory).toEqual(history); expect(s.town).toEqual(town); expect(s.random).toEqual(seed); expect(s.character.gender).toBe('FEMALE');
      for (const [id, value] of Object.entries(mastery)) expect(s.progression.mastery[id]).toBe(value);
      if (sequence === 2) {
        expect(s.concealmentServant.fearBishopActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
        expect(Object.keys(s.progression.mastery)).toHaveLength(18); expect(CONCEALMENT_SERVANT_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
        expect(projectConcealmentServant(s).resources).toMatchObject({ maxSpirituality: 120, spirituality: 31 });
        expect(projectConcealmentServant(s).actions.some(a => ['BUY_POTION', 'CONSUME', 'PREPARE_TASK'].includes(a.command.type))).toBe(false);
      } else { expect(s.progression.acting).toBe(100); expect(s.character.coreStats).toEqual(stats); expect(Object.keys(s.progression.mastery)).toHaveLength(16); }
      expect(validateConcealmentServantState(s)).toBe(true); reject(s, dose(s));
    });
  it('floors guided potion rejection only and cannot reopen a genuinely dead run', () => {
    const s = prepared(); s.health = 21; s.mind = 41; apply(s, dose(s), 100);
    expect([s.health, s.mind, s.status, s.progression.sequence]).toEqual([1, 1, 'ACTIVE', 3]); expect(validateConcealmentServantState(s)).toBe(true);
    const dead = prepared(); dead.status = 'DEAD'; dead.health = 0; reject(dead, dose(dead));
  });
  it('retains failures then supplies only after a real week and charges each actual new bottle', () => {
    const s = qualify(taught());
    for (let i = 0; i < 3; i++) { buy(s, i); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, i), 100); s.health = 100; s.mind = 100; if (i < 2) reject(s, { type: 'REQUEST_SUPPLY' }); }
    const bottles = structuredClone(s.concealmentServant.bottles), old = structuredClone(oldRoots(s)), ap = s.actionsRemaining, cash = s.cash;
    apply(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); expect(s.cash).toBe(cash);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' }); s.week++; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.concealmentServant.bottles).toHaveLength(6); expect(s.concealmentServant.bottles.slice(0, 3)).toEqual(bottles); expect(oldRoots(s)).toEqual(old);
    expect(s.concealmentServant.bottles[3]).toMatchObject({ id: 'concealment-servant-potion-4', status: 'SUPPLIER', labourSteps: 0, stockedWeek: s.week, acquiredWeek: null });
    expect(projectConcealmentServant(s).actions.find(a => a.id === 'buy-concealment-servant-potion-4')!.cost).toContain('6200');
    const paid = s.cash; buy(s, 3); expect(s.cash).toBe(paid - 6200); reject(s, dose(s, 3));
    apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, 3)); expect(validateConcealmentServantState(s)).toBe(true);
    expect(s.concealmentServant.bottles.slice(0, 3)).toEqual(bottles); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('requires fresh paid preparation after failure and permits no refund on zero-action cancellation', () => {
    const s = prepared(); apply(s, dose(s), 90); const original = structuredClone(s.concealmentServant.bottles[0]); buy(s, 1); reject(s, dose(s, 1));
    s.health = 100; s.mind = 100; const cash = s.cash; apply(s, { type: 'PREPARE_PROMOTION' });
    s.actionsRemaining = 0; s.health = 1; s.mind = 1; const spirit = s.spirituality; const c = apply(s, { type: 'LEAVE_PREPARATION' });
    expect(c.check).not.toHaveBeenCalled(); expect([s.cash, s.spirituality, s.actionsRemaining, s.health, s.mind]).toEqual([cash - 120, spirit, 0, 1, 1]);
    expect(s.concealmentServant.bottles[0]).toEqual(original); expect(s.concealmentServant.bottles[1]!.status).toBe('PLAYER');
    expect(hasConcealmentServantLock(s)).toBe(false); reject(s, dose(s, 1)); expect(validateConcealmentServantState(s)).toBe(true);
  });
  it('enforces vitality, digestion, exact old mastery, action points and current-week preparation', () => {
    const s = prepared(); s.progression.acting = 99; reject(s, dose(s)); s.progression.acting = 100;
    s.health = 20; reject(s, dose(s)); s.health = 100; s.mind = 40; reject(s, dose(s)); s.mind = 100;
    s.week++; reject(s, dose(s)); expect(validateConcealmentServantState(s)).toBe(false); apply(s, { type: 'LEAVE_PREPARATION' });
    const t = taught(); t.actionsRemaining = 0; reject(t, { type: 'PREPARE_TASK', taskId: 'CHECK_BOUNDARY' }); reject(t, { type: 'POTION_WORK', bottleId: t.concealmentServant.bottles[0]!.id });
    const u = fearBishop(); delete u.progression.mastery['darkness.s3.sleep-fear']; reject(u, { type: 'LEARN_GUIDANCE' });
  });
  it('requires old scenes, original people, objects and original Leaf to be actually closed before promotion', () => {
    const s = qualify(taught()); buy(s);
    const changes: ((t: SliceState) => void)[] = [
      t => { t.fearBishop.preparedWeek = t.week; }, t => { t.fearBishop.life.tomas.effectActive = true; },
      t => { t.fearBishop.life.container.location = 'PLAYER'; }, t => { t.fearBishop.life.lamp.location = 'PLAYER'; },
      t => { t.fearBishop.life.cases['stop-signal'].contactOpen = true; }, t => { t.fearBishop.encounter.status = 'READY'; },
      t => { t.spiritWarlock.companion.status = 'DEPLOYED'; }, t => { t.spiritWarlock.practice.note = 'RECIPIENT'; },
      t => { t.spiritWarlock.practice.dreamOpen = true; }, t => { t.nightwatcher.life.practice.concentration = true; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); reject(t, { type: 'PREPARE_PROMOTION' }); }
    expect(concealmentServantAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toBeNull();
  });
  it('preserves release rather than gifting a replacement original spirit at promotion', () => {
    const s = prepared(); s.spiritWarlock.companion.status = 'RELEASED'; s.spiritWarlock.companion.releases++;
    const old = structuredClone(s.spiritWarlock); apply(s, dose(s)); expect(s.spiritWarlock).toEqual(old);
    expect(projectConcealmentServant(s).inheritedHistory.join(' ')).toContain('当前RELEASED'); expect(validateConcealmentServantState(s)).toBe(true);
  });
  it.each([null, {}, { type: 'BREW' }, { type: 'LEARN_GUIDANCE', grantSpirit: true }, { type: 'PREPARE_TASK', taskId: 'CANONICAL_RITUAL' }, { type: 'BUY_POTION', bottleId: 'fear-bishop-potion-1' }, { type: 'CONSUME', bottleId: 'concealment-servant-potion-1', confirmed: false }])
    ('rejects malformed or unapproved command shape%# without mutation', command => {
      expect(validateConcealmentServantCommand(command)).toBe(false); expect(isConcealmentServantAcquisitionCommand(command)).toBe(false); reject(taught(), command);
    });
  it('rejects forged source, bottle identity, chronology, task and promoted mastery shapes', () => {
    const s = prepared(); apply(s, dose(s));
    const changes: ((t: SliceState) => void)[] = [
      t => { t.concealmentServant.bottles[0]!.source = t.fearBishop.bottles[0]!.source; },
      t => { t.concealmentServant.bottles[0]!.acquiredWeek = t.fearBishop.promotionWeek! - 1; },
      t => { t.concealmentServant.bottles[0]!.preparationWeek!--; },
      t => { t.concealmentServant.bottles[1]!.id = t.concealmentServant.bottles[0]!.id; },
      t => { t.concealmentServant.preparations[0]!.completedWeek = t.week + 1; },
      t => { t.concealmentServant.preparations[1]!.taskId = t.concealmentServant.preparations[0]!.taskId; },
      t => { t.concealmentServant.fearBishopActingAtPromotion = 99; },
      t => { t.concealmentServant.promotionWeek = t.fearBishop.promotionWeek! + 11; },
      t => { t.concealmentServant.preparedWeek = t.week; },
      t => { delete t.progression.mastery['darkness.s9.danger-sense']; },
      t => { delete t.progression.mastery[CONCEALMENT_SERVANT_ABILITY_IDS[1]]; },
      t => { t.progression.mastery['darkness.s1.free-power'] = 0; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateConcealmentServantState(t)).not.toThrow(); expect(validateConcealmentServantState(t)).toBe(false); }
  });
  it('rejects forged resupply source, mixed delivery dates and nonchronological failures', () => {
    const s = qualify(taught());
    for (let i = 0; i < 3; i++) { buy(s, i); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, i), 90); s.health = 100; s.mind = 100; }
    apply(s, { type: 'REQUEST_SUPPLY' }); s.week++; apply(s, { type: 'RECEIVE_SUPPLY' }); expect(validateConcealmentServantState(s)).toBe(true);
    for (const mutate of [
      (t: SliceState) => { t.concealmentServant.bottles[3]!.source = t.concealmentServant.bottles[0]!.source; },
      (t: SliceState) => { t.concealmentServant.bottles[4]!.stockedWeek!--; },
      (t: SliceState) => { t.concealmentServant.bottles[0]!.consumedWeek = t.week; t.concealmentServant.bottles[0]!.preparationWeek = t.week; },
    ]) { const t = structuredClone(s); mutate(t); expect(validateConcealmentServantState(t)).toBe(false); }
  });
});
