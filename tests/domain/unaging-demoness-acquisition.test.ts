import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyUnagingDemonessAcquisition, createUnagingDemonessState, hasUnagingDemonessLock, isUnagingDemonessAcquisitionCommand, projectUnagingDemoness, unagingDemonessAcquisitionBlock, validateUnagingDemonessCommand, validateUnagingDemonessState } from '../../src/domain/unaging-demoness/index.js';
import { UNAGING_DEMONESS_CONSUMPTION_RISK, UNAGING_DEMONESS_FORMULA_STATUS, UNAGING_DEMONESS_PRICES, UNAGING_DEMONESS_SOURCE_STATUS } from '../../src/domain/unaging-demoness/content.js';
import { UNAGING_DEMONESS_ABILITY_IDS, UNAGING_DEMONESS_PREPARATION_IDS, type UnagingDemonessAcquisitionCommand } from '../../src/domain/unaging-demoness/types.js';

const prior = () => JSON.parse(readFileSync('tests/fixtures/despair-v01300/natural.json', 'utf8'));
const roots = ['assassin', 'instigator', 'witch', 'pleasure', 'pain', 'despair'] as const;
/** Actual361-command baseline; resource/time edits below are isolated unit setup, never natural-play evidence. */
function despair(): SliceState {
  const s = migrateSliceState(prior().final); s.unagingDemoness = createUnagingDemonessState();
  s.week = Math.max(s.week, s.despair.promotionWeek! + 12); s.activeEvent = null; s.eventQueue = []; s.combat = null;
  s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100; s.spirituality = 31;
  s.seer.pollution = 0; s.character.coreStats.will = 30; return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: UnagingDemonessAcquisitionCommand, roll = 1) { const c = context(s, roll); applyUnagingDemonessAcquisition(s, command, c); return c; }
function taught(s = despair()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function qualify(s: SliceState) { for (const taskId of UNAGING_DEMONESS_PREPARATION_IDS) apply(s, { type: 'PREPARE_TASK', taskId }); return s; }
function buy(s: SliceState, index = 0) { const bottle = s.unagingDemoness.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.unagingDemoness.bottles[index]!.id, confirmed: true }) as const;
function prepared() { const s = qualify(taught()); buy(s); apply(s, { type: 'PREPARE_PROMOTION' }); return s; }
function reject(s: SliceState, command: unknown) {
  const original = structuredClone(s), c = context(s);
  expect(() => applyUnagingDemonessAcquisition(s, command as UnagingDemonessAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(original); expect(c.check).not.toHaveBeenCalled();
}
function originals(s: SliceState, before: SliceState) { for (const root of roots) expect(s[root]).toEqual(before[root]); }

describe('Unaging Demoness3 original bottles and bounded G preparation', () => {
  it('reads the actual361-command W97 living baseline without rewriting RNG or the original six roots', () => {
    const capture = prior(), s = migrateSliceState(capture.final);
    expect(capture.commands).toHaveLength(361); expect(capture.seed).toBe('assassin-natural-v045');
    expect(s).toMatchObject({ week: 97, status: 'ACTIVE', cash: 130, actionsRemaining: 1, health: 100, mind: 100, spirituality: 107, progression: { sequence: 4, acting: 100 }, random: { seed: 'assassin-natural-v045', cursor: 149 } });
    expect(s.despair.promotionWeek).toBe(90); expect(s.character.age).toBe(26); expect(s.character.gender).toBe('FEMALE');
    expect(s.despair.encounter).toMatchObject({ targetId: 'DP4-VALEN-HOLT', enemyStatus: 'SURRENDERED', enemyHealth: 60, enemyMind: 100, enemySpirituality: 12, enemyDisease: 0, terminal: { enemyDisease: 2 } });
    expect(s.despair.encounter.careVisits).toEqual([{ week: 97, costPence: 60, before: 2, after: 0 }]);
    originals(s, capture.final); expect(validateUnagingDemonessState(s)).toBe(true); expect(projectUnagingDemoness(s).digestion).toContain('7/12');
  });
  it('creates independent originals and hides this source before actual Demoness4', () => {
    const s = createSliceRun('unaging-hidden', sliceDefaultCreationSelection, 'unaging-hidden');
    expect(validateUnagingDemonessState(s)).toBe(true);
    expect(projectUnagingDemoness(s)).toMatchObject({ discovered: false, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], resources: null, appearanceRecord: '' });
    expect(projectUnagingDemoness(s).story).toBeUndefined(); reject(s, { type: 'LEARN_GUIDANCE' });
    const other = createUnagingDemonessState(); other.bottles[0]!.labourSteps = 5; other.preparations.push({ taskId: 'REVIEW_RECORDS', completedWeek: 1 });
    expect(s.unagingDemoness.bottles[0]!.labourSteps).toBe(0); expect(s.unagingDemoness.preparations).toEqual([]);
  });
  it('does not open this source for another path, an unsupported sequence, or a missing real S4 promotion', () => {
    for (const pathwayId of ['diviner', 'hunter', 'audience', 'paragon', 'moon', 'darkness', 'white-tower', 'tyrant', 'death', 'sun', 'door', 'warrior', 'error', 'hermit', 'hanged-man', 'abyss', 'chained', 'wheel', 'black-emperor', 'justiciar', 'mother'] as const) {
      const s = despair(); s.progression.pathwayId = pathwayId; expect(projectUnagingDemoness(s).discovered).toBe(false); reject(s, { type: 'LEARN_GUIDANCE' });
    }
    for (const sequence of [9, 8, 7, 6, 5, 1, 0]) { const s = despair(); s.progression.sequence = sequence as NonNullable<SliceState['progression']['sequence']>; expect(projectUnagingDemoness(s).discovered).toBe(false); }
    const s = despair(); s.despair.promotionWeek = null; reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges500 and one action without turning unknown recipe, ritual or revival into facts', () => {
    const s = despair(), before = structuredClone(s); apply(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]); originals(s, before);
    expect(UNAGING_DEMONESS_PRICES).toEqual({ guidance: 500, potion: 6400, labourCredit: 5500, preparation: 140 });
    expect(UNAGING_DEMONESS_FORMULA_STATUS).toContain('完整配方与晋升仪式尚未核实'); expect(UNAGING_DEMONESS_FORMULA_STATUS).toContain('不老泉只是');
    for (const text of ['卡特琳娜', '个体经历', '第五部第163章', '第七部第9章', '阿蒙', '均为原创G', '复活条件、次数与周期未核']) expect(UNAGING_DEMONESS_SOURCE_STATUS).toContain(text);
    expect(UNAGING_DEMONESS_CONSUMPTION_RISK).toContain('不保护实际战斗');
    expect(projectUnagingDemoness(s).formula).toEqual([]); reject(s, { type: 'LEARN_GUIDANCE' }); expect(validateUnagingDemonessState(s)).toBe(true);
  });
  it('five actual jobs reduce only that unique bottle to900 and do not pay for preparations', () => {
    const s = taught(), bottle = s.unagingDemoness.bottles[0]!;
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect([bottle.labourSteps, bottle.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]); reject(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s); expect([s.cash, bottle.status, bottle.acquiredWeek]).toEqual([98600, 'PLAYER', s.week]);
    expect(s.unagingDemoness.bottles[1]!.labourSteps).toBe(0); expect(s.unagingDemoness.preparations).toEqual([]); expect(s.unagingDemoness.preparedWeek).toBeNull();
    reject(s, { type: 'BUY_POTION', bottleId: bottle.id }); expect(validateUnagingDemonessState(s)).toBe(true);
  });
  it('does not partially discount jobs, borrow an old original bottle or spend unavailable funds', () => {
    const s = taught(), bottle = s.unagingDemoness.bottles[0]!;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: bottle.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(6400);
    s.cash = 6399; reject(s, { type: 'BUY_POTION', bottleId: s.unagingDemoness.bottles[1]!.id });
    for (const bottleId of ['despair-potion-1', 'pain-potion-1', 'witch-potion-1']) reject(s, { type: 'BUY_POTION', bottleId });
  });
  it('requires three distinct one-action preparations and a separate current-week140 check', () => {
    const s = taught(); buy(s); reject(s, dose(s)); reject(s, { type: 'PREPARE_PROMOTION' });
    for (const [index, taskId] of UNAGING_DEMONESS_PREPARATION_IDS.entries()) {
      const ap = s.actionsRemaining; apply(s, { type: 'PREPARE_TASK', taskId }); expect(s.actionsRemaining).toBe(ap - 1);
      expect(s.unagingDemoness.preparations[index]).toEqual({ taskId, completedWeek: s.week }); reject(s, { type: 'PREPARE_TASK', taskId });
    }
    reject(s, dose(s)); const cash = s.cash, ap = s.actionsRemaining; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.cash, s.actionsRemaining, s.unagingDemoness.preparedWeek]).toEqual([cash - 140, ap - 1, s.week]);
    expect(hasUnagingDemonessLock(s)).toBe(true); expect(projectUnagingDemoness(s).insideCase).toBe(true); expect(validateUnagingDemonessState(s)).toBe(true);
  });
  it('leaves a real zero-action nonrefunding exit after the last preparation action', () => {
    const s = qualify(taught()); buy(s); s.actionsRemaining = 1; const cash = s.cash, week = s.week;
    apply(s, { type: 'PREPARE_PROMOTION' }); expect([s.week, s.actionsRemaining, s.cash]).toEqual([week, 0, cash - 140]);
    reject(s, { type: 'PREPARE_PROMOTION' }); s.health = 1; s.mind = 1; const c = apply(s, { type: 'LEAVE_PREPARATION' });
    expect([s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining]).toEqual([1, 1, 31, cash - 140, 0]); expect(c.check).not.toHaveBeenCalled();
    expect(s.unagingDemoness.preparedWeek).toBeNull(); expect(s.unagingDemoness.bottles[0]!.status).toBe('PLAYER'); expect(hasUnagingDemonessLock(s)).toBe(false);
    reject(s, dose(s)); reject(s, { type: 'LEAVE_PREPARATION' }); expect(validateUnagingDemonessState(s)).toBe(true);
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 3], [30, 'SUCCESS', 85, 100, 0, 3], [90, 'FAILURE', 75, 85, 30, 4], [100, 'GREAT_FAILURE', 55, 75, 60, 4]] as const)('settles roll%s honestly without resource refills or rewriting original people', (roll, tier, mind, health, pollution, sequence) => {
    const s = prepared(), before = structuredClone(s), bottle = s.unagingDemoness.bottles[0]!; s.actionsRemaining = 0;
    const c = apply(s, dose(s), roll); expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 30);
    expect([bottle.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
    expect(bottle).toMatchObject({ status: 'CONSUMED', consumedWeek: s.week, preparationWeek: s.week }); expect(s.unagingDemoness.preparedWeek).toBeNull();
    originals(s, before); expect(s.character.age).toBe(26); expect(s.character.gender).toBe('FEMALE'); expect(s.random).toEqual(before.random);
    expect(s.combatHistory).toEqual(before.combatHistory); expect(s.injuries).toEqual(before.injuries); expect(s.town).toEqual(before.town);
    expect(s.unagingDemoness.life).toEqual(before.unagingDemoness.life); expect(s.unagingDemoness.encounter).toEqual(before.unagingDemoness.encounter);
    for (const [id, mastery] of Object.entries(before.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    if (sequence === 3) {
      expect(s.unagingDemoness.despairActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
      expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(before.progression.mastery, id))).toEqual([...UNAGING_DEMONESS_ABILITY_IDS]);
      expect(s.progression.mastery['assassin.s3.mirror-passage']).toBe(0);
      for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(before.character.coreStats[stat] + 1);
      expect(projectUnagingDemoness(s).appearanceRecord).toContain(`第${s.week}周登记`); expect(projectUnagingDemoness(s).appearanceRecord).toContain('创建年龄26岁');
      expect(projectUnagingDemoness(s).resources).toMatchObject({ maxSpirituality: 120, spirituality: 31 });
    } else expect(s.progression.acting).toBe(100);
    expect(validateUnagingDemonessState(s)).toBe(true); reject(s, dose(s));
  });
  it('protects only guided potion rejection and never revives a dead body', () => {
    const s = prepared(); s.health = 21; s.mind = 41; apply(s, dose(s), 100); expect([s.health, s.mind, s.status, s.progression.sequence]).toEqual([1, 1, 'ACTIVE', 4]);
    const dead = prepared(); dead.status = 'DEAD'; dead.health = 0; reject(dead, dose(dead)); expect(validateUnagingDemonessState(s)).toBe(true);
  });
  it('retains failed originals and requires another140 check for recovery and retry', () => {
    const s = prepared(); apply(s, dose(s), 100); const failed = structuredClone(s.unagingDemoness.bottles[0]), tasks = structuredClone(s.unagingDemoness.preparations);
    buy(s, 1); reject(s, dose(s, 1)); s.health = 100; s.mind = 100; const cash = s.cash; apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, 1));
    expect(s.cash).toBe(cash - 140); expect(s.unagingDemoness.bottles[0]).toEqual(failed); expect(s.unagingDemoness.preparations).toEqual(tasks); expect(validateUnagingDemonessState(s)).toBe(true);
  });
  it('waits an actual next week for three new priced bottles after all current originals fail', () => {
    const s = qualify(taught()); reject(s, { type: 'RECEIVE_SUPPLY' });
    for (let n = 0; n < 3; n++) { buy(s, n); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100; if (n < 2) reject(s, { type: 'REQUEST_SUPPLY' }); }
    const bottles = structuredClone(s.unagingDemoness.bottles); apply(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; apply(s, { type: 'RECEIVE_SUPPLY' }); expect(s.unagingDemoness.bottles.slice(0, 3)).toEqual(bottles); expect(s.unagingDemoness.bottles).toHaveLength(6);
    expect(s.unagingDemoness.bottles[3]).toMatchObject({ id: 'unaging-demoness-potion-4', status: 'SUPPLIER', labourSteps: 0, stockedWeek: s.week, acquiredWeek: null });
    expect(projectUnagingDemoness(s).actions.find(a => a.id === 'buy-unaging-demoness-potion-4')!.cost).toContain('6400'); expect(validateUnagingDemonessState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('measures twelve full weeks from original DespairW90, then rejects stale checks and unmet digestion', () => {
    const s = qualify(taught()); buy(s); const originalPromotion = s.progression.promotionWeek; s.week = 101;
    expect(unagingDemonessAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('11/12'); reject(s, { type: 'PREPARE_PROMOTION' });
    s.week = 102; apply(s, { type: 'PREPARE_PROMOTION' }); expect(s.progression.promotionWeek).toBe(originalPromotion);
    s.progression.acting = 99; reject(s, dose(s)); s.progression.acting = 100; s.health = 20; reject(s, dose(s)); s.health = 100; s.mind = 40; reject(s, dose(s)); s.mind = 100;
    s.week++; reject(s, dose(s)); expect(validateUnagingDemonessState(s)).toBe(false); apply(s, { type: 'LEAVE_PREPARATION' });
  });
  it('blocks open old contacts, original routes, tension, fields and prepared cases without charging', () => {
    const s = qualify(taught()); buy(s);
    const changes: ((state: SliceState) => void)[] = [
      t => { t.pain.practice.playerNode = 'SAFE_MARK'; }, t => { t.pleasure.practice.wrist = 'SILK'; },
      t => { Object.values(t.despair.life.cases)[0]!.contactOpen = true; }, t => { t.despair.encounter.status = 'FIGHTING'; },
      t => { t.despair.encounter.fieldActive = true; }, t => { Object.values(t.despair.life.cases)[0]!.status = 'PREPARED'; },
      ...(['assassin', 'instigator', 'witch', 'pleasure', 'pain'] as const).map(root => (t: SliceState) => { Object.values(t[root].cases)[0]!.status = 'PREPARED'; }),
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); reject(t, { type: 'PREPARE_PROMOTION' }); }
  });
  it('rejects unavailable guidance, foreign locations, no actions and insufficient current preparation funds', () => {
    const s = despair(); s.cash = 499; reject(s, { type: 'LEARN_GUIDANCE' }); s.cash = 100000; s.actionsRemaining = 0; reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught(); t.actionsRemaining = 0; reject(t, { type: 'PREPARE_TASK', taskId: 'REVIEW_RECORDS' }); reject(t, { type: 'POTION_WORK', bottleId: t.unagingDemoness.bottles[0]!.id });
    const u = qualify(taught()); buy(u); u.cash = 139; reject(u, { type: 'PREPARE_PROMOTION' }); u.cash = 140; u.world.city = 'ELSEWHERE'; reject(u, { type: 'PREPARE_PROMOTION' });
  });
  it.each([null, {}, { type: 'BREW' }, { type: 'MIRROR_REVIVAL' }, { type: 'TELEPORT_ANYWHERE' }, { type: 'BECOME_EIGHTEEN' }, { type: 'BUY_POTION', bottleId: 'despair-potion-1' }, { type: 'PREPARE_TASK', taskId: 'GATHER_BELIEVERS' }, { type: 'LEARN_GUIDANCE', grantImmortality: true }, { type: 'CONSUME', bottleId: 'unaging-demoness-potion-1', confirmed: false }])('rejects exact unauthorized command shape%# before mutation', command => {
    expect(validateUnagingDemonessCommand(command)).toBe(false); expect(isUnagingDemonessAcquisitionCommand(command)).toBe(false); reject(taught(), command);
  });
  it('rejects forged chronology, duplicated bottles or tasks, missing mastery and malformed scene data', () => {
    const s = prepared(); apply(s, dose(s));
    const changes: ((state: SliceState) => void)[] = [
      t => { t.unagingDemoness.despairActingAtPromotion = 99; }, t => { t.unagingDemoness.bottles[0]!.source = 'old original'; },
      t => { t.unagingDemoness.bottles[0]!.preparationWeek = t.unagingDemoness.bottles[0]!.preparationWeek! - 1; }, t => { t.unagingDemoness.bottles[1]!.id = t.unagingDemoness.bottles[0]!.id; },
      t => { t.unagingDemoness.preparations[1]!.taskId = t.unagingDemoness.preparations[0]!.taskId; }, t => { t.unagingDemoness.preparations[0]!.completedWeek = t.week + 1; },
      t => { t.unagingDemoness.preparedWeek = t.week; }, t => { delete t.progression.mastery['assassin.s3.mirror-passage']; },
      t => { (t.unagingDemoness as unknown as Record<string, unknown>).life = null; }, t => { (t.unagingDemoness as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateUnagingDemonessState(t)).not.toThrow(); expect(validateUnagingDemonessState(t)).toBe(false); }
  });
  it('keeps serialized key order irrelevant and records original Valen illness without rewriting terminal history', () => {
    const s = prepared(); apply(s, dose(s));
    const reorder = (value: unknown): unknown => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, reorder(v)])) : value;
    expect(validateUnagingDemonessState(reorder(s) as SliceState)).toBe(true);
    const history = projectUnagingDemoness(s).inheritedHistory.join(' ');
    for (const text of ['DP4-VALEN-HOLT', 'SURRENDERED', '健康60/100', '灵性12', '当前病势0', '原伤势2处']) expect(history).toContain(text);
    expect(s.despair.encounter.terminal!.enemyDisease).toBe(2); expect(s.pain.encounter.enemyStatus).toBe('DEAD');
  });
});
