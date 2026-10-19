import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyChaosWalkerAcquisition, createChaosWalkerState, hasChaosWalkerLock, isChaosWalkerAcquisitionCommand, projectChaosWalker, chaosWalkerAcquisitionBlock, validateChaosWalkerCommand, validateChaosWalkerState } from '../../src/domain/chaos-walker/index.js';
import { CHAOS_WALKER_CONSUMPTION_RISK, CHAOS_WALKER_FORMULA_STATUS, CHAOS_WALKER_PRICES, CHAOS_WALKER_SOURCE_STATUS } from '../../src/domain/chaos-walker/content.js';
import { CHAOS_WALKER_ABILITY_IDS, CHAOS_WALKER_PREPARATION_IDS, type ChaosWalkerAcquisitionCommand } from '../../src/domain/chaos-walker/types.js';

const prior = () => JSON.parse(readFileSync('tests/fixtures/misfortune-mage-v01350/natural.json', 'utf8'));
const roots = ['monster', 'machine', 'lucky', 'calamityPriest', 'winner', 'misfortuneMage'] as const;
/** Actual333-command baseline; resource/time edits below are isolated unit setup, never natural-play evidence. */
function misfortuneMage(): SliceState {
  const s = migrateSliceState(prior().final); s.chaosWalker = createChaosWalkerState();
  s.week = Math.max(s.week, s.misfortuneMage.promotionWeek! + 12); s.activeEvent = null; s.eventQueue = []; s.combat = null;
  s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100; s.spirituality = 31;
  s.seer.pollution = 0; s.character.coreStats.will = 30; return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: ChaosWalkerAcquisitionCommand, roll = 1) { const c = context(s, roll); applyChaosWalkerAcquisition(s, command, c); return c; }
function taught(s = misfortuneMage()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function qualify(s: SliceState) { for (const taskId of CHAOS_WALKER_PREPARATION_IDS) apply(s, { type: 'PREPARE_TASK', taskId }); return s; }
function buy(s: SliceState, index = 0) { const bottle = s.chaosWalker.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.chaosWalker.bottles[index]!.id, confirmed: true }) as const;
function prepared() { const s = qualify(taught()); buy(s); apply(s, { type: 'PREPARE_PROMOTION' }); return s; }
function reject(s: SliceState, command: unknown) {
  const original = structuredClone(s), c = context(s);
  expect(() => applyChaosWalkerAcquisition(s, command as ChaosWalkerAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(original); expect(c.check).not.toHaveBeenCalled();
}
function originals(s: SliceState, before: SliceState) { for (const root of roots) expect(s[root]).toEqual(before[root]); }

describe('ChaosWalker3 original bottles and bounded G preparation', () => {
  it('reads the actual333-command W87 baseline without rewriting RNG, original choices or the original six roots', () => {
    const capture = prior(), s = migrateSliceState(capture.final);
    expect(capture.commands).toHaveLength(333); expect(capture.seed).toBe('monster-natural-v060');
    expect(s).toMatchObject({ week: 87, status: 'ACTIVE', cash: 360, actionsRemaining: 1, health: 70, mind: 100, spirituality: 113, progression: { sequence: 4, acting: 100 }, random: { seed: 'monster-natural-v060', cursor: 153 } });
    expect(s.misfortuneMage.promotionWeek).toBe(79);
    expect(s.misfortuneMage.encounter).toMatchObject({ targetId: 'MM4-FERRIS-LORNE', enemyStatus: 'SURRENDERED', enemyHealth: 70, enemyMind: 100, enemySpirituality: 16 });
    expect(s.misfortuneMage.encounter.enemyInjuries.map(i => i.severity)).toEqual(['HEAVY']);
    expect(s.winner.luck).toEqual({ stored: 1, accumulated: 7, spent: 6, lastAccumulateWeek: 87 });
    expect(s.misfortuneMage.life.bag).toMatchObject({ id: 'MM4-BAG-1', owner: 'SELLA', effectActive: false });
    originals(s, capture.final); expect(validateChaosWalkerState(s)).toBe(true); expect(projectChaosWalker(s).digestion).toContain('8/12');
  });
  it('creates independent originals and hides this source before actual MisfortuneMage4', () => {
    const s = createSliceRun('chaos-walker-hidden', sliceDefaultCreationSelection, 'chaos-walker-hidden');
    expect(validateChaosWalkerState(s)).toBe(true);
    expect(projectChaosWalker(s)).toMatchObject({ discovered: false, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], resources: null, inheritedTools: '' });
    expect(projectChaosWalker(s).story).toBeUndefined(); reject(s, { type: 'LEARN_GUIDANCE' });
    const other = createChaosWalkerState(); other.bottles[0]!.labourSteps = 5; other.preparations.push({ taskId: 'REVIEW_RECORDS', completedWeek: 1 });
    expect(s.chaosWalker.bottles[0]!.labourSteps).toBe(0); expect(s.chaosWalker.preparations).toEqual([]);
  });
  it('does not open this source for another path, an unsupported sequence, or a missing real S4 promotion', () => {
    for (const pathwayId of ['diviner', 'hunter', 'audience', 'paragon', 'moon', 'darkness', 'white-tower', 'tyrant', 'death', 'sun', 'door', 'warrior', 'error', 'demoness', 'hanged-man', 'hermit', 'abyss', 'chained', 'black-emperor', 'justiciar', 'mother'] as const) {
      const s = misfortuneMage(); s.progression.pathwayId = pathwayId; expect(projectChaosWalker(s).discovered).toBe(false); reject(s, { type: 'LEARN_GUIDANCE' });
    }
    for (const sequence of [9, 8, 7, 6, 5, 2, 1, 0]) { const s = misfortuneMage(); s.progression.sequence = sequence as NonNullable<SliceState['progression']['sequence']>; expect(projectChaosWalker(s).discovered).toBe(false); }
    const s = misfortuneMage(); s.misfortuneMage.promotionWeek = null; reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges500 and one action without turning the unknown recipe, ritual or high-level information into facts', () => {
    const s = misfortuneMage(), before = structuredClone(s); apply(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]); originals(s, before);
    expect(CHAOS_WALKER_PRICES).toEqual({ guidance: 500, potion: 6400, labourCredit: 5500, preparation: 140 });
    for (const text of ['完整配方与晋升仪式尚未核实', '候选G映射', '编号尚未获得直接原核', '艾妲·芬恩']) expect(CHAOS_WALKER_FORMULA_STATUS).toContain(text);
    for (const text of ['L215038', 'L43514', 'L43536', '没有给出两者序列编号', '序列2先知', '序列1水银之蛇', '均为原创G']) expect(CHAOS_WALKER_SOURCE_STATUS).toContain(text);
    expect(CHAOS_WALKER_CONSUMPTION_RISK).toContain('不保护实际战斗');
    expect(projectChaosWalker(s).formula).toEqual([]); reject(s, { type: 'LEARN_GUIDANCE' }); expect(validateChaosWalkerState(s)).toBe(true);
  });
  it('five actual jobs reduce only that unique bottle to900 and do not pay for preparations', () => {
    const s = taught(), bottle = s.chaosWalker.bottles[0]!;
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect([bottle.labourSteps, bottle.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]); reject(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s); expect([s.cash, bottle.status, bottle.acquiredWeek]).toEqual([98600, 'PLAYER', s.week]);
    expect(s.chaosWalker.bottles[1]!.labourSteps).toBe(0); expect(s.chaosWalker.preparations).toEqual([]); expect(s.chaosWalker.preparedWeek).toBeNull();
    reject(s, { type: 'BUY_POTION', bottleId: bottle.id }); expect(validateChaosWalkerState(s)).toBe(true);
  });
  it('does not partially discount jobs, borrow an old original bottle or spend unavailable funds', () => {
    const s = taught(), bottle = s.chaosWalker.bottles[0]!;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: bottle.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(6400);
    s.cash = 6399; reject(s, { type: 'BUY_POTION', bottleId: s.chaosWalker.bottles[1]!.id });
    for (const bottleId of ['misfortune-mage-potion-1', 'winner-potion-1', 'calamity-priest-potion-1']) reject(s, { type: 'BUY_POTION', bottleId });
  });
  it('requires three distinct one-action preparations and a separate current-week140 check', () => {
    const s = taught(); buy(s); reject(s, dose(s)); reject(s, { type: 'PREPARE_PROMOTION' });
    for (const [index, taskId] of CHAOS_WALKER_PREPARATION_IDS.entries()) {
      const ap = s.actionsRemaining; apply(s, { type: 'PREPARE_TASK', taskId }); expect(s.actionsRemaining).toBe(ap - 1);
      expect(s.chaosWalker.preparations[index]).toEqual({ taskId, completedWeek: s.week }); reject(s, { type: 'PREPARE_TASK', taskId });
    }
    reject(s, dose(s)); const cash = s.cash, ap = s.actionsRemaining; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.cash, s.actionsRemaining, s.chaosWalker.preparedWeek]).toEqual([cash - 140, ap - 1, s.week]);
    expect(hasChaosWalkerLock(s)).toBe(true); expect(projectChaosWalker(s).insideCase).toBe(true); expect(validateChaosWalkerState(s)).toBe(true);
  });
  it('leaves a real zero-action nonrefunding exit after the last preparation action', () => {
    const s = qualify(taught()); buy(s); s.actionsRemaining = 1; const cash = s.cash, week = s.week;
    apply(s, { type: 'PREPARE_PROMOTION' }); expect([s.week, s.actionsRemaining, s.cash]).toEqual([week, 0, cash - 140]);
    reject(s, { type: 'PREPARE_PROMOTION' }); s.health = 1; s.mind = 1; const c = apply(s, { type: 'LEAVE_PREPARATION' });
    expect([s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining]).toEqual([1, 1, 31, cash - 140, 0]); expect(c.check).not.toHaveBeenCalled();
    expect(s.chaosWalker.preparedWeek).toBeNull(); expect(s.chaosWalker.bottles[0]!.status).toBe('PLAYER'); expect(hasChaosWalkerLock(s)).toBe(false);
    reject(s, dose(s)); reject(s, { type: 'LEAVE_PREPARATION' }); expect(validateChaosWalkerState(s)).toBe(true);
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 3], [30, 'SUCCESS', 85, 100, 0, 3], [90, 'FAILURE', 75, 85, 30, 4], [100, 'GREAT_FAILURE', 55, 75, 60, 4]] as const)('settles roll%s honestly without resource refills or rewriting original people', (roll, tier, mind, health, pollution, sequence) => {
    const s = prepared(), before = structuredClone(s), bottle = s.chaosWalker.bottles[0]!; s.actionsRemaining = 0;
    const c = apply(s, dose(s), roll); expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 30);
    expect([bottle.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
    expect(bottle).toMatchObject({ status: 'CONSUMED', consumedWeek: s.week, preparationWeek: s.week }); expect(s.chaosWalker.preparedWeek).toBeNull();
    originals(s, before); expect(s.character.age).toBe(26); expect(s.character.gender).toBe('FEMALE'); expect(s.random).toEqual(before.random);
    expect(s.combatHistory).toEqual(before.combatHistory); expect(s.injuries).toEqual(before.injuries); expect(s.town).toEqual(before.town);
    expect(s.chaosWalker.life).toEqual(before.chaosWalker.life); expect(s.chaosWalker.encounter).toEqual(before.chaosWalker.encounter);
    for (const [id, mastery] of Object.entries(before.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    if (sequence === 3) {
      expect(s.chaosWalker.misfortuneMageActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
      expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(before.progression.mastery, id))).toEqual([...CHAOS_WALKER_ABILITY_IDS]);
      expect(s.progression.mastery['wheel.s3.deviation-buffer']).toBe(0); expect(s.progression.mastery['wheel.s3.future-impediment']).toBe(0);
      for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(before.character.coreStats[stat] + 1);
      expect(projectChaosWalker(s).inheritedHistory.join(' ')).toContain('MM4-FERRIS-LORNE'); expect(projectChaosWalker(s).inheritedTools).toContain('MM4-BAG-1仍属SELLA');
      expect(projectChaosWalker(s).resources).toMatchObject({ maxSpirituality: 120, spirituality: 31 });
    } else expect(s.progression.acting).toBe(100);
    expect(validateChaosWalkerState(s)).toBe(true); reject(s, dose(s));
  });
  it('protects only guided potion rejection and never revives a dead body', () => {
    const s = prepared(); s.health = 21; s.mind = 41; apply(s, dose(s), 100); expect([s.health, s.mind, s.status, s.progression.sequence]).toEqual([1, 1, 'ACTIVE', 4]);
    const dead = prepared(); dead.status = 'DEAD'; dead.health = 0; reject(dead, dose(dead)); expect(validateChaosWalkerState(s)).toBe(true);
  });
  it('retains failed originals and requires another140 check for recovery and retry', () => {
    const s = prepared(); apply(s, dose(s), 100); const failed = structuredClone(s.chaosWalker.bottles[0]), tasks = structuredClone(s.chaosWalker.preparations);
    buy(s, 1); reject(s, dose(s, 1)); s.health = 100; s.mind = 100; const cash = s.cash; apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, 1));
    expect(s.cash).toBe(cash - 140); expect(s.chaosWalker.bottles[0]).toEqual(failed); expect(s.chaosWalker.preparations).toEqual(tasks); expect(validateChaosWalkerState(s)).toBe(true);
  });
  it('waits an actual next week for three new priced bottles after all current originals fail', () => {
    const s = qualify(taught()); reject(s, { type: 'RECEIVE_SUPPLY' });
    for (let n = 0; n < 3; n++) { buy(s, n); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100; if (n < 2) reject(s, { type: 'REQUEST_SUPPLY' }); }
    const bottles = structuredClone(s.chaosWalker.bottles); apply(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; apply(s, { type: 'RECEIVE_SUPPLY' }); expect(s.chaosWalker.bottles.slice(0, 3)).toEqual(bottles); expect(s.chaosWalker.bottles).toHaveLength(6);
    expect(s.chaosWalker.bottles[3]).toMatchObject({ id: 'chaos-walker-potion-4', status: 'SUPPLIER', labourSteps: 0, stockedWeek: s.week, acquiredWeek: null });
    expect(projectChaosWalker(s).actions.find(a => a.id === 'buy-chaos-walker-potion-4')!.cost).toContain('6400'); expect(validateChaosWalkerState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('measures twelve full weeks from original MisfortuneMageW79, then rejects stale checks and unmet digestion', () => {
    const s = misfortuneMage(); s.week = s.misfortuneMage.promotionWeek! + 11; qualify(taught(s)); buy(s); const originalPromotion = s.progression.promotionWeek;
    expect(chaosWalkerAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('11/12'); reject(s, { type: 'PREPARE_PROMOTION' });
    s.week = s.misfortuneMage.promotionWeek! + 12; apply(s, { type: 'PREPARE_PROMOTION' }); expect(s.progression.promotionWeek).toBe(originalPromotion);
    s.progression.acting = 99; reject(s, dose(s)); s.progression.acting = 100; s.health = 20; reject(s, dose(s)); s.health = 100; s.mind = 40; reject(s, dose(s)); s.mind = 100;
    s.week++; reject(s, dose(s)); expect(validateChaosWalkerState(s)).toBe(false); apply(s, { type: 'LEAVE_PREPARATION' });
  });
  it('blocks unfinished old originals and practice without charging', () => {
    const s = qualify(taught()); buy(s);
    const changes: ((state: SliceState) => void)[] = [
      t => { Object.values(t.monster.cases)[0]!.contactOpen = true; }, t => { Object.values(t.machine.cases)[0]!.contactOpen = true; },
      t => { Object.values(t.lucky.cases)[0]!.contactOpen = true; }, t => { Object.values(t.calamityPriest.cases)[0]!.contactOpen = true; },
      t => { Object.values(t.winner.cases)[0]!.contactOpen = true; }, t => { Object.values(t.misfortuneMage.life.cases)[0]!.contactOpen = true; },
      t => { t.calamityPriest.practice.board = 'UNSTABLE'; }, t => { t.calamityPriest.practice.board = 'FALLEN'; }, t => { t.calamityPriest.practice.contact = 'FOCUSED'; },
      t => { t.winner.practice.counter = 'TRAY'; }, t => { t.winner.practice.ring = 'MAT'; }, t => { t.winner.practice.note = 'WRITTEN'; },
      t => { t.misfortuneMage.life.weight.position = 'SUSPENDED'; }, t => { t.misfortuneMage.life.weight.permission = true; }, t => { t.misfortuneMage.life.weight.cordHolder = 'PLAYER'; },
      t => { t.misfortuneMage.life.bag.position = 'MAT'; }, t => { t.misfortuneMage.life.bag.consented = true; }, t => { t.misfortuneMage.life.bag.effectActive = true; },
      t => { t.misfortuneMage.life.note.holder = 'PLAYER'; }, t => { t.misfortuneMage.encounter.status = 'FIGHTING'; },
      t => { t.misfortuneMage.encounter.staggerReady = true; }, t => { t.misfortuneMage.encounter.composureReady = true; },
      t => { t.winner.encounter.status = 'FIGHTING'; }, t => { t.winner.encounter.staggerReady = true; },
      t => { Object.values(t.misfortuneMage.life.cases)[0]!.status = 'PREPARED'; },
      ...(['monster', 'machine', 'lucky', 'calamityPriest', 'winner'] as const).map(root => (t: SliceState) => { Object.values(t[root].cases)[0]!.status = 'PREPARED'; }),
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); reject(t, { type: 'PREPARE_PROMOTION' }); }
  });
  it('rejects unavailable guidance, foreign locations, no actions and insufficient current preparation funds', () => {
    const s = misfortuneMage(); s.cash = 499; reject(s, { type: 'LEARN_GUIDANCE' }); s.cash = 100000; s.actionsRemaining = 0; reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught(); t.actionsRemaining = 0; reject(t, { type: 'PREPARE_TASK', taskId: 'REVIEW_RECORDS' }); reject(t, { type: 'POTION_WORK', bottleId: t.chaosWalker.bottles[0]!.id });
    const u = qualify(taught()); buy(u); u.cash = 139; reject(u, { type: 'PREPARE_PROMOTION' }); u.cash = 140; u.world.city = 'ELSEWHERE'; reject(u, { type: 'PREPARE_PROMOTION' });
  });
  it.each([null, {}, { type: 'BREW' }, { type: 'ALWAYS_SUCCEED' }, { type: 'FREE_LUCK' }, { type: 'REROLL' }, { type: 'REWRITE_HISTORY' }, { type: 'PROBABILITY_DIE' }, { type: 'BUY_POTION', bottleId: 'misfortune-mage-potion-1' }, { type: 'PREPARE_TASK', taskId: 'GATHER_BELIEVERS' }, { type: 'LEARN_GUIDANCE', forceConsent: true }, { type: 'CONSUME', bottleId: 'chaos-walker-potion-1', confirmed: false }])('rejects exact unauthorized command shape%# before mutation', command => {
    expect(validateChaosWalkerCommand(command)).toBe(false); expect(isChaosWalkerAcquisitionCommand(command)).toBe(false); reject(taught(), command);
  });
  it('rejects forged chronology, duplicated bottles or tasks, missing mastery and malformed scene data', () => {
    const s = prepared(); apply(s, dose(s));
    const changes: ((state: SliceState) => void)[] = [
      t => { t.chaosWalker.misfortuneMageActingAtPromotion = 99; }, t => { t.chaosWalker.bottles[0]!.source = 'old original'; },
      t => { t.chaosWalker.bottles[0]!.preparationWeek = t.chaosWalker.bottles[0]!.preparationWeek! - 1; }, t => { t.chaosWalker.bottles[1]!.id = t.chaosWalker.bottles[0]!.id; },
      t => { t.chaosWalker.preparations[1]!.taskId = t.chaosWalker.preparations[0]!.taskId; }, t => { t.chaosWalker.preparations[0]!.completedWeek = t.week + 1; },
      t => { t.chaosWalker.preparedWeek = t.week; }, t => { delete t.progression.mastery['wheel.s3.deviation-buffer']; },
      t => { (t.chaosWalker as unknown as Record<string, unknown>).life = null; }, t => { (t.chaosWalker as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateChaosWalkerState(t)).not.toThrow(); expect(validateChaosWalkerState(t)).toBe(false); }
  });
  it('keeps key order irrelevant and preserves actual prior choices, original objects and surrendered Ferris', () => {
    const s = prepared(), before = structuredClone(s); apply(s, dose(s));
    const reorder = (value: unknown): unknown => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, reorder(v)])) : value;
    expect(validateChaosWalkerState(reorder(s) as SliceState)).toBe(true);
    const history = projectChaosWalker(s).inheritedHistory.join(' ');
    for (const text of ['MM4-FERRIS-LORNE', 'SURRENDERED', '健康70/100', '灵性16', '原伤势1处', '唯一幸运账本', '累计积累7', '实耗6']) expect(history).toContain(text);
    originals(s, before); expect(s.misfortuneMage.life.note.holder).toBe('GUIDE'); expect(s.misfortuneMage.life.bag).toEqual(before.misfortuneMage.life.bag);
    expect(s.winner.luck).toEqual(before.winner.luck); expect(Object.hasOwn(s.chaosWalker, 'luck')).toBe(false);

  });
});
