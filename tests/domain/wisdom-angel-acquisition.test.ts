import { describe, expect, it, vi } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyWisdomAngelAcquisition, applyWisdomAngelCommand, createWisdomAngelState, hasWisdomAngelLock,
  isWisdomAngelAcquisitionCommand, isWisdomAngelAcquisitionStage, hasWisdomAngelHistory,
  projectWisdomAngel, validateWisdomAngelCommand, validateWisdomAngelState, wisdomAngelAcquisitionBlock } from '../../src/domain/wisdom-angel/index.js';
import { WISDOM_ANGEL_FORMULA_STATUS, WISDOM_ANGEL_SOURCE_STATUS, WISDOM_ANGEL_CONSUMPTION_RISK,
  WISDOM_ANGEL_PRICES, WISDOM_ANGEL_POTION_SOURCES } from '../../src/domain/wisdom-angel/content.js';
import { WISDOM_ANGEL_ABILITY_IDS, WISDOM_ANGEL_PREPARATION_IDS,
  type WisdomAngelAcquisitionCommand } from '../../src/domain/wisdom-angel/types.js';
import { readingLegacyKeys, insightScholarPeacefulFixturePath } from './wisdom-angel-helper.js';

/** Directed domain-only setup from the genuine 423-command survivor. No natural RNG or save is rewritten. */
function insightScholar(): SliceState {
  const s = migrateSliceState(readObjectEntry<unknown>(insightScholarPeacefulFixturePath, 'final'));
  s.wisdomAngel = createWisdomAngelState(); s.week = s.insightScholar.promotionWeek! + 12;
  s.activeEvent = null; s.eventQueue = []; s.combat = null;
  s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 30;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) =>
    resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: WisdomAngelAcquisitionCommand, roll = 1) {
  const c = context(s, roll); applyWisdomAngelAcquisition(s, command, c); return c;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyWisdomAngelAcquisition(s, command as WisdomAngelAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled(); expect(c.note).not.toHaveBeenCalled();
}
function taught(s = insightScholar()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function qualify(s: SliceState) { for (const taskId of WISDOM_ANGEL_PREPARATION_IDS) apply(s, { type: 'PREPARE_TASK', taskId }); return s; }
function buy(s: SliceState, index = 0) { const b = s.wisdomAngel.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.wisdomAngel.bottles[index]!.id, confirmed: true }) as const;
function prepared() { const s = qualify(taught()); buy(s); apply(s, { type: 'PREPARE_PROMOTION' }); return s; }
const oldRoots = (s: SliceState) => readingLegacyKeys.map(key => s[key]);

describe('Wisdom Angel candidate S2 independent acquisition and finite source boundaries', () => {
  it('starts with the genuinely living W106 branch,17 original mastery and an untreated heavy injury', () => {
    const old = readObjectEntry<SliceState>(insightScholarPeacefulFixturePath, 'final'), s = migrateSliceState(old);
    expect(readObjectEntry<unknown[]>(insightScholarPeacefulFixturePath, 'commands')).toHaveLength(423);
    expect(old).toMatchObject({ week: 106, status: 'ACTIVE', health: 100, mind: 100, spirituality: 120, cash: 640,
      actionsRemaining: 1, injuryRisk: 1, random: { seed: 'reader-natural-v023', cursor: 173 },
      progression: { sequence: 3, acting: 100, promotionWeek: 5 }, insightScholar: { promotionWeek: 99 } });
    expect(Object.keys(old.progression.mastery)).toHaveLength(17); expect(oldRoots(s)).toEqual(oldRoots(old));
    expect(s.injuries).toHaveLength(1); expect(s.injuries[0]).toMatchObject({ severity: 'HEAVY', treatedRevision: null });
    expect(validateWisdomAngelState(s)).toBe(true); expect(projectWisdomAngel(s).digestion).toContain('7/12');
    expect(isWisdomAngelAcquisitionStage(s)).toBe(true); expect(hasWisdomAngelHistory(s)).toBe(false);
  });
  it('creates independent originals and hides the source for ordinary people and every unsupported stage', () => {
    const s = createSliceRun('wisdom-hidden', sliceDefaultCreationSelection, 'wisdom-hidden');
    expect(projectWisdomAngel(s)).toMatchObject({ discovered: false, guidanceKnown: false, promoted: false,
      formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], resources: null });
    expect(projectWisdomAngel(s).story).toBeUndefined(); reject(s, { type: 'LEARN_GUIDANCE' });
    const other = createWisdomAngelState(); other.bottles[0]!.labourSteps = 5;
    expect(s.wisdomAngel.bottles[0]!.labourSteps).toBe(0); expect(validateWisdomAngelState(s)).toBe(true);
    for (const sequence of [9, 8, 7, 6, 5, 4, 1, 0]) {
      const t = insightScholar(); t.progression.sequence = sequence as NonNullable<SliceState['progression']['sequence']>;
      expect(projectWisdomAngel(t).discovered).toBe(false); reject(t, { type: 'LEARN_GUIDANCE' });
    }
    const t = insightScholar(); t.progression.pathwayId = 'diviner';
    expect(projectWisdomAngel(t).discovered).toBe(false); reject(t, { type: 'LEARN_GUIDANCE' });
  });
  it('charges actual guidance while keeping both candidate names, sequence numbers and new powers explicitly unverified G', () => {
    const s = insightScholar(), prior = structuredClone(oldRoots(s)); apply(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]); expect(oldRoots(s)).toEqual(prior);
    expect(WISDOM_ANGEL_PRICES).toEqual({ guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 });
    expect(WISDOM_ANGEL_SOURCE_STATUS).toContain('尚无阅读者序列2编号证据');
    expect(WISDOM_ANGEL_SOURCE_STATUS).toContain('均为明确原创G'); expect(WISDOM_ANGEL_SOURCE_STATUS).toContain('跨链推断');
    expect(WISDOM_ANGEL_FORMULA_STATUS).toContain('完整配方及晋升仪式均未核实');
    expect(WISDOM_ANGEL_FORMULA_STATUS).toContain('不能断言无需仪式');
    expect(WISDOM_ANGEL_CONSUMPTION_RISK).toContain('不保护普通死亡或战斗');
    expect(projectWisdomAngel(s)).toMatchObject({ formulaKnown: false, formula: [],
      preparations: WISDOM_ANGEL_PREPARATION_IDS.map(taskId => ({ taskId, completedWeek: null })) });
    expect(s.wisdomAngel.bottles.map(b => b.source)).toEqual(WISDOM_ANGEL_POTION_SOURCES.map(b => b.source));
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five bottle-specific jobs and an independent800 payment with no transferred labour or free preparation', () => {
    const s = taught(), old = structuredClone(oldRoots(s)), b = s.wisdomAngel.bottles[0]!;
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); const cash = s.cash; buy(s);
    expect(s.cash).toBe(cash - 800); expect(b).toMatchObject({ status: 'PLAYER', acquiredWeek: s.week });
    expect(s.wisdomAngel.bottles[1]!.labourSteps).toBe(0); expect(s.wisdomAngel.preparations).toEqual([]);
    expect(s.wisdomAngel.preparedWeek).toBeNull(); expect(oldRoots(s)).toEqual(old); reject(s, { type: 'BUY_POTION', bottleId: b.id });
  });
  it('does not partially discount, refurbish or substitute any earlier bottle', () => {
    const s = taught(), b = s.wisdomAngel.bottles[0]!;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(6200);
    for (const bottleId of ['insight-scholar-potion-1', 'prophet-potion-1', 'reader-potion-1']) reject(s, { type: 'BUY_POTION', bottleId });
    s.cash = 6199; reject(s, { type: 'BUY_POTION', bottleId: s.wisdomAngel.bottles[1]!.id });
  });
  it('requires three different professional tasks, paid current-week inspection and exact independent dose confirmation', () => {
    const s = taught(); buy(s); reject(s, dose(s)); reject(s, { type: 'PREPARE_PROMOTION' });
    for (const [i, taskId] of WISDOM_ANGEL_PREPARATION_IDS.entries()) {
      const ap = s.actionsRemaining; apply(s, { type: 'PREPARE_TASK', taskId }); expect(s.actionsRemaining).toBe(ap - 1);
      expect(s.wisdomAngel.preparations[i]).toEqual({ taskId, completedWeek: s.week });
      reject(s, { type: 'PREPARE_TASK', taskId }); if (i < 2) reject(s, { type: 'PREPARE_PROMOTION' });
    }
    const scenes = structuredClone([s.wisdomAngel.life, s.wisdomAngel.encounter]), cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'PREPARE_PROMOTION' }); expect([s.cash, s.actionsRemaining, s.wisdomAngel.preparedWeek]).toEqual([cash - 120, ap - 1, s.week]);
    expect([s.wisdomAngel.life, s.wisdomAngel.encounter]).toEqual(scenes); expect(hasWisdomAngelLock(s)).toBe(true);
    for (const command of [{ type: 'CONSUME', bottleId: dose(s).bottleId }, { ...dose(s), confirmed: false }, { ...dose(s), ritual: true }]) {
      expect(validateWisdomAngelCommand(command)).toBe(false); reject(s, command);
    }
  });
  it('starts twelve full weeks at the real S3 W99 rather than original S9 W5', () => {
    const s = qualify(taught()); buy(s); expect(s.insightScholar.promotionWeek).toBe(99); expect(s.progression.promotionWeek).toBe(5);
    s.week = 106; expect(wisdomAngelAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('7/12');
    s.week = 110; reject(s, { type: 'PREPARE_PROMOTION' }); s.week = 111; apply(s, { type: 'PREPARE_PROMOTION' });
    expect(s.wisdomAngel.preparedWeek).toBe(111); expect(s.progression.promotionWeek).toBe(5);
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 2], [30, 'SUCCESS', 85, 100, 0, 2], [90, 'FAILURE', 75, 85, 30, 3], [100, 'GREAT_FAILURE', 55, 75, 60, 3]] as const)
    ('settles directed roll%s as%s without healing, refilling or rewriting17 old abilities and original people', (roll, tier, mind, health, pollution, sequence) => {
      const s = prepared(), old = structuredClone(oldRoots(s)), mastery = { ...s.progression.mastery }, stats = { ...s.character.coreStats };
      const injuries = structuredClone(s.injuries), risk = s.injuryRisk, history = structuredClone(s.combatHistory), town = structuredClone(s.town), random = structuredClone(s.random), gender = s.character.gender;
      s.actionsRemaining = 0; const c = apply(s, dose(s), roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 30);
      expect([s.wisdomAngel.bottles[0]!.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
      expect(s.wisdomAngel.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: s.week, preparationWeek: s.week });
      expect(s.wisdomAngel.preparedWeek).toBeNull(); expect(hasWisdomAngelLock(s)).toBe(false);
      expect(oldRoots(s)).toEqual(old); expect(s.injuries).toEqual(injuries); expect(s.injuryRisk).toBe(risk);
      expect(s.combatHistory).toEqual(history); expect(s.town).toEqual(town); expect(s.random).toEqual(random); expect(s.character.gender).toBe(gender);
      for (const [id, value] of Object.entries(mastery)) expect(s.progression.mastery[id]).toBe(value);
      if (sequence === 2) {
        expect(hasWisdomAngelHistory(s)).toBe(true); expect(isWisdomAngelAcquisitionStage(s)).toBe(false);
        expect(s.wisdomAngel.insightScholarActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
        expect(Object.keys(s.progression.mastery)).toHaveLength(19); expect(WISDOM_ANGEL_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
        expect(projectWisdomAngel(s).resources).toMatchObject({ maxSpirituality: 120, spirituality: 31 });
        expect(projectWisdomAngel(s).actions.some(a => ['BUY_POTION', 'CONSUME', 'PREPARE_TASK'].includes(a.command.type))).toBe(false);
      } else { expect(s.progression.acting).toBe(100); expect(s.character.coreStats).toEqual(stats); expect(Object.keys(s.progression.mastery)).toHaveLength(17); }
      expect(validateWisdomAngelState(s)).toBe(true); reject(s, dose(s));
    });
  it('floors only guided rejection and never changes death, wounds or accumulated risk into a successful promotion', () => {
    const s = prepared(); s.health = 21; s.mind = 41; const injuries = structuredClone(s.injuries), risk = s.injuryRisk;
    apply(s, dose(s), 100); expect([s.health, s.mind, s.status, s.progression.sequence]).toEqual([1, 1, 'ACTIVE', 3]);
    expect(s.injuries).toEqual(injuries); expect(s.injuryRisk).toBe(risk); expect(validateWisdomAngelState(s)).toBe(true);
    const dead = prepared(); dead.status = 'DEAD'; dead.health = 0; reject(dead, dose(dead));
  });
  it('allows zero-action physical exit with no refund, healing, draw or restored preparation', () => {
    const s = prepared(); s.actionsRemaining = 0; s.health = 1; s.mind = 1;
    const cash = s.cash, spirit = s.spirituality, bottles = structuredClone(s.wisdomAngel.bottles); reject(s, dose(s));
    const c = apply(s, { type: 'LEAVE_PREPARATION' }); expect(c.check).not.toHaveBeenCalled();
    expect([s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining]).toEqual([1, 1, spirit, cash, 0]);
    expect(s.wisdomAngel.bottles).toEqual(bottles); expect(hasWisdomAngelLock(s)).toBe(false);
    reject(s, { type: 'LEAVE_PREPARATION' }); reject(s, dose(s));
  });
  it('rejects incomplete digestion, stale preparation, old scenes, altered mastery and insufficient vitality before any draw', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.progression.acting = 99; }, s => { s.insightScholar.promotionWeek = s.week - 11; },
      s => { s.health = 20; }, s => { s.mind = 40; }, s => { s.week++; },
      s => { s.insightScholar.encounter.status = 'READY'; }, s => { s.prophet.life.pages.location = 'FLOOR'; },
      s => { delete s.progression.mastery['reader.s3.method-analysis']; }, s => { s.progression.mastery['reader.s1.unearned'] = 0; },
      s => { s.world.city = 'ELSEWHERE'; },
    ];
    for (const mutate of mutations) { const s = prepared(); mutate(s); reject(s, dose(s)); }
  });
  it('retains failed originals, charges another preparation, and waits a real week for independently priced resupply', () => {
    const s = qualify(taught());
    for (let i = 0; i < 3; i++) {
      buy(s, i); reject(s, dose(s, i)); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, i), 100);
      // Explicit directed unit recovery, not a claimed public medical or natural-play step.
      s.health = 100; s.mind = 100; if (i < 2) reject(s, { type: 'REQUEST_SUPPLY' });
    }
    const bottles = structuredClone(s.wisdomAngel.bottles), old = structuredClone(oldRoots(s)), ap = s.actionsRemaining, cash = s.cash;
    apply(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); expect(s.cash).toBe(cash);
    expect(s.wisdomAngel.bottles).toEqual(bottles); reject(s, { type: 'RECEIVE_SUPPLY' }); s.week++;
    apply(s, { type: 'RECEIVE_SUPPLY' }); expect(s.wisdomAngel.bottles.slice(0, 3)).toEqual(bottles);
    expect(s.wisdomAngel.bottles).toHaveLength(6); expect(oldRoots(s)).toEqual(old);
    expect(s.wisdomAngel.bottles[3]).toMatchObject({ id: 'wisdom-angel-potion-4', status: 'SUPPLIER', labourSteps: 0, stockedWeek: s.week, acquiredWeek: null });
    expect(projectWisdomAngel(s).actions.find(a => a.id === 'buy-wisdom-angel-potion-4')!.cost).toContain('6200便士');
    expect(validateWisdomAngelState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    const beforeBuy = s.cash; buy(s, 3); expect(s.cash).toBe(beforeBuy - 6200); reject(s, dose(s, 3));
    for (const mutate of [
      (t: SliceState) => { t.wisdomAngel.bottles[3]!.source = t.insightScholar.bottles[0]!.source; },
      (t: SliceState) => { t.wisdomAngel.bottles[4]!.stockedWeek!--; },
      (t: SliceState) => { t.wisdomAngel.bottles[0]!.consumedWeek = t.week; t.wisdomAngel.bottles[0]!.preparationWeek = t.week; },
    ]) { const t = structuredClone(s); mutate(t); expect(validateWisdomAngelState(t)).toBe(false); }
  });
  it('rejects malformed acquisition commands, invented slots and extra confirmation fields', () => {
    for (const command of [null, [], {}, { type: 'PREPARE_TASK', taskId: 'FREE_RITUAL' }, { type: 'BUY_POTION', bottleId: 'wisdom-angel-potion-0' },
      { type: 'LEARN_GUIDANCE', free: true }, { type: 'CONSUME', bottleId: 'wisdom-angel-potion-1', confirmed: 1 }]) expect(isWisdomAngelAcquisitionCommand(command)).toBe(false);
    expect(validateWisdomAngelCommand({ type: 'MAKE_INHERITED_FLASH', free: true })).toBe(false);
    const s = taught(); reject(s, { type: 'BUY_POTION', bottleId: 'wisdom-angel-potion-999' });
  });
  it.each([1, 100])('uses only the original paid FLASH producer and records failed production costs: directed roll%s', roll => {
    const s = prepared(); apply(s, dose(s)); const oldMastery = { ...s.progression.mastery }, oldActing = s.progression.acting;
    const originals = structuredClone(s.mysticismMagister.crafts), otherRoots = structuredClone(readingLegacyKeys.filter(k => k !== 'mysticismMagister').map(k => s[k]));
    const before = { cash: s.cash, spirit: s.spirituality, actions: s.actionsRemaining, kits: s.mysticismMagister.practice.kitsUsed };
    expect(projectWisdomAngel(s).actions.find(a => a.command.type === 'MAKE_INHERITED_FLASH')).toMatchObject({ enabled: true, cost: expect.stringContaining('160便士') });
    const c = context(s, roll); applyWisdomAngelCommand(s, { type: 'MAKE_INHERITED_FLASH' }, c);
    expect(c.check).toHaveBeenCalledExactlyOnceWith('knowledge', 16);
    expect([s.cash, s.spirituality, s.actionsRemaining, s.mysticismMagister.practice.kitsUsed, s.mysticismMagister.craftAttemptWeek])
      .toEqual([before.cash - 160, before.spirit - 4, before.actions - 1, before.kits + 1, s.week]);
    expect(s.mysticismMagister.crafts.slice(0, originals.length)).toEqual(originals);
    expect(readingLegacyKeys.filter(k => k !== 'mysticismMagister').map(k => s[k])).toEqual(otherRoots);
    expect(s.progression.mastery).toEqual(oldMastery); expect(s.progression.acting).toBe(oldActing);
    if (roll === 1) expect(s.mysticismMagister.crafts.at(-1)).toMatchObject({ id: `MM5-FLASH-${before.kits + 1}`, sourceKitId: `MM5-KIT-${before.kits + 1}`, createdWeek: s.week, usedWeek: null, status: 'PLAYER' });
    else expect(s.mysticismMagister.crafts).toHaveLength(originals.length);
    const once = structuredClone(s), again = context(s); expect(() => applyWisdomAngelCommand(s, { type: 'MAKE_INHERITED_FLASH' }, again)).toThrow();
    expect(s).toEqual(once); expect(again.check).not.toHaveBeenCalled(); expect(validateWisdomAngelState(s)).toBe(true);
  });
  it('blocks inherited production without original learned FLASH, paid resources, old resolution or an available new scene', () => {
    const source = prepared(); apply(source, dose(source));
    const changes: ((s: SliceState) => void)[] = [
      s => { s.cash = 159; }, s => { s.spirituality = 3; }, s => { s.actionsRemaining = 0; },
      s => { s.polymath.samples.FLASH.learnedWeek = null; }, s => { s.mysticismMagister.cases['modest-craft']!.status = 'EXAMINED'; },
      s => { s.insightScholar.encounter.status = 'READY'; }, s => { s.wisdomAngel.encounter.status = 'READY'; },
      s => { s.wisdomAngel.preparedWeek = s.week; },
    ];
    for (const change of changes) {
      const s = structuredClone(source); change(s); const before = structuredClone(s), c = context(s);
      expect(() => applyWisdomAngelCommand(s, { type: 'MAKE_INHERITED_FLASH' }, c)).toThrow(); expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
    }
  });
});
