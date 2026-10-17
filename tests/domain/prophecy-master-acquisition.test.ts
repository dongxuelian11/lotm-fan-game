import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyProphecyMasterAcquisition, createProphecyMasterState, hasProphecyMasterLock, isProphecyMasterAcquisitionCommand, projectProphecyMaster, prophecyMasterAcquisitionBlock, validateProphecyMasterCommand, validateProphecyMasterState } from '../../src/domain/prophecy-master/index.js';
import { PROPHECY_MASTER_CONSUMPTION_RISK, PROPHECY_MASTER_FORMULA_STATUS, PROPHECY_MASTER_PRICES, PROPHECY_MASTER_SOURCE_STATUS } from '../../src/domain/prophecy-master/content.js';
import { PROPHECY_MASTER_ABILITY_IDS, PROPHECY_MASTER_PREPARATION_IDS, type ProphecyMasterAcquisitionCommand } from '../../src/domain/prophecy-master/types.js';

const prior = () => JSON.parse(readFileSync('tests/fixtures/mystic-v01310/natural.json', 'utf8'));
const roots = ['pryer', 'combatScholar', 'wizard', 'scrollProfessor', 'starMystic', 'mystic'] as const;
/** Actual411-command baseline; resource/time edits below are isolated unit setup, never natural-play evidence. */
function mystic(): SliceState {
  const s = migrateSliceState(prior().final); s.prophecyMaster = createProphecyMasterState();
  s.week = Math.max(s.week, s.mystic.promotionWeek! + 12); s.activeEvent = null; s.eventQueue = []; s.combat = null;
  s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100; s.spirituality = 31;
  s.seer.pollution = 0; s.character.coreStats.will = 30; return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: ProphecyMasterAcquisitionCommand, roll = 1) { const c = context(s, roll); applyProphecyMasterAcquisition(s, command, c); return c; }
function taught(s = mystic()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function qualify(s: SliceState) { for (const taskId of PROPHECY_MASTER_PREPARATION_IDS) apply(s, { type: 'PREPARE_TASK', taskId }); return s; }
function buy(s: SliceState, index = 0) { const bottle = s.prophecyMaster.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.prophecyMaster.bottles[index]!.id, confirmed: true }) as const;
function prepared() { const s = qualify(taught()); buy(s); apply(s, { type: 'PREPARE_PROMOTION' }); return s; }
function reject(s: SliceState, command: unknown) {
  const original = structuredClone(s), c = context(s);
  expect(() => applyProphecyMasterAcquisition(s, command as ProphecyMasterAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(original); expect(c.check).not.toHaveBeenCalled();
}
function originals(s: SliceState, before: SliceState) { for (const root of roots) expect(s[root]).toEqual(before[root]); }

describe('Prophecy Master3 original bottles and bounded G preparation', () => {
  it('reads the actual411-command W108 baseline without rewriting RNG, published knowledge or the original six roots', () => {
    const capture = prior(), s = migrateSliceState(capture.final);
    expect(capture.commands).toHaveLength(411); expect(capture.seed).toBe('pryer-natural-v048');
    expect(s).toMatchObject({ week: 108, status: 'ACTIVE', cash: 750, actionsRemaining: 2, health: 100, mind: 100, spirituality: 112, progression: { sequence: 4, acting: 100 }, random: { seed: 'pryer-natural-v048', cursor: 238 } });
    expect(s.mystic.promotionWeek).toBe(95); expect(s.mystic.life.publicDisclosed).toBe(true); expect(s.mystic.life.story.readerIds).toHaveLength(105);
    expect(s.mystic.encounter).toMatchObject({ targetId: 'MY4-LUCAN-VEY', enemyStatus: 'SURRENDERED', enemyHealth: 70, enemyMind: 100, enemySpirituality: 17 });
    expect(s.mystic.ritual.sample.status).toBe('RETURNED');
    originals(s, capture.final); expect(validateProphecyMasterState(s)).toBe(true); expect(projectProphecyMaster(s).digestion).toContain('13/12');
  });
  it('creates independent originals and hides this source before actual Mystic4', () => {
    const s = createSliceRun('prophecy-hidden', sliceDefaultCreationSelection, 'prophecy-hidden');
    expect(validateProphecyMasterState(s)).toBe(true);
    expect(projectProphecyMaster(s)).toMatchObject({ discovered: false, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], resources: null, inheritedTools: '' });
    expect(projectProphecyMaster(s).story).toBeUndefined(); reject(s, { type: 'LEARN_GUIDANCE' });
    const other = createProphecyMasterState(); other.bottles[0]!.labourSteps = 5; other.preparations.push({ taskId: 'REVIEW_RECORDS', completedWeek: 1 });
    expect(s.prophecyMaster.bottles[0]!.labourSteps).toBe(0); expect(s.prophecyMaster.preparations).toEqual([]);
  });
  it('does not open this source for another path, an unsupported sequence, or a missing real S4 promotion', () => {
    for (const pathwayId of ['diviner', 'hunter', 'audience', 'paragon', 'moon', 'darkness', 'white-tower', 'tyrant', 'death', 'sun', 'door', 'warrior', 'error', 'demoness', 'hanged-man', 'abyss', 'chained', 'wheel', 'black-emperor', 'justiciar', 'mother'] as const) {
      const s = mystic(); s.progression.pathwayId = pathwayId; expect(projectProphecyMaster(s).discovered).toBe(false); reject(s, { type: 'LEARN_GUIDANCE' });
    }
    for (const sequence of [9, 8, 7, 6, 5, 2, 1, 0]) { const s = mystic(); s.progression.sequence = sequence as NonNullable<SliceState['progression']['sequence']>; expect(projectProphecyMaster(s).discovered).toBe(false); }
    const s = mystic(); s.mystic.promotionWeek = null; reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges500 and one action without turning the unknown recipe, ritual or high-level information into facts', () => {
    const s = mystic(), before = structuredClone(s); apply(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]); originals(s, before);
    expect(PROPHECY_MASTER_PRICES).toEqual({ guidance: 500, potion: 6400, labourCredit: 5500, preparation: 140 });
    for (const text of ['完整配方与晋升仪式尚未核实', '本次不再要求另一滴', '命运之蛇血是嘉德丽雅的个别准备']) expect(PROPHECY_MASTER_FORMULA_STATUS).toContain(text);
    for (const text of ['L177931/L203615', '模糊命运画面', '可能判断错误', '105', '15%', '贤者', '均为原创G']) expect(PROPHECY_MASTER_SOURCE_STATUS).toContain(text);
    expect(PROPHECY_MASTER_CONSUMPTION_RISK).toContain('不保护实际战斗');
    expect(projectProphecyMaster(s).formula).toEqual([]); reject(s, { type: 'LEARN_GUIDANCE' }); expect(validateProphecyMasterState(s)).toBe(true);
  });
  it('five actual jobs reduce only that unique bottle to900 and do not pay for preparations', () => {
    const s = taught(), bottle = s.prophecyMaster.bottles[0]!;
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect([bottle.labourSteps, bottle.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]); reject(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s); expect([s.cash, bottle.status, bottle.acquiredWeek]).toEqual([98600, 'PLAYER', s.week]);
    expect(s.prophecyMaster.bottles[1]!.labourSteps).toBe(0); expect(s.prophecyMaster.preparations).toEqual([]); expect(s.prophecyMaster.preparedWeek).toBeNull();
    reject(s, { type: 'BUY_POTION', bottleId: bottle.id }); expect(validateProphecyMasterState(s)).toBe(true);
  });
  it('does not partially discount jobs, borrow an old original bottle or spend unavailable funds', () => {
    const s = taught(), bottle = s.prophecyMaster.bottles[0]!;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: bottle.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(6400);
    s.cash = 6399; reject(s, { type: 'BUY_POTION', bottleId: s.prophecyMaster.bottles[1]!.id });
    for (const bottleId of ['mystic-potion-1', 'star-mystic-potion-1', 'scroll-professor-potion-1']) reject(s, { type: 'BUY_POTION', bottleId });
  });
  it('requires three distinct one-action preparations and a separate current-week140 check', () => {
    const s = taught(); buy(s); reject(s, dose(s)); reject(s, { type: 'PREPARE_PROMOTION' });
    for (const [index, taskId] of PROPHECY_MASTER_PREPARATION_IDS.entries()) {
      const ap = s.actionsRemaining; apply(s, { type: 'PREPARE_TASK', taskId }); expect(s.actionsRemaining).toBe(ap - 1);
      expect(s.prophecyMaster.preparations[index]).toEqual({ taskId, completedWeek: s.week }); reject(s, { type: 'PREPARE_TASK', taskId });
    }
    reject(s, dose(s)); const cash = s.cash, ap = s.actionsRemaining; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.cash, s.actionsRemaining, s.prophecyMaster.preparedWeek]).toEqual([cash - 140, ap - 1, s.week]);
    expect(hasProphecyMasterLock(s)).toBe(true); expect(projectProphecyMaster(s).insideCase).toBe(true); expect(validateProphecyMasterState(s)).toBe(true);
  });
  it('leaves a real zero-action nonrefunding exit after the last preparation action', () => {
    const s = qualify(taught()); buy(s); s.actionsRemaining = 1; const cash = s.cash, week = s.week;
    apply(s, { type: 'PREPARE_PROMOTION' }); expect([s.week, s.actionsRemaining, s.cash]).toEqual([week, 0, cash - 140]);
    reject(s, { type: 'PREPARE_PROMOTION' }); s.health = 1; s.mind = 1; const c = apply(s, { type: 'LEAVE_PREPARATION' });
    expect([s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining]).toEqual([1, 1, 31, cash - 140, 0]); expect(c.check).not.toHaveBeenCalled();
    expect(s.prophecyMaster.preparedWeek).toBeNull(); expect(s.prophecyMaster.bottles[0]!.status).toBe('PLAYER'); expect(hasProphecyMasterLock(s)).toBe(false);
    reject(s, dose(s)); reject(s, { type: 'LEAVE_PREPARATION' }); expect(validateProphecyMasterState(s)).toBe(true);
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 3], [30, 'SUCCESS', 85, 100, 0, 3], [90, 'FAILURE', 75, 85, 30, 4], [100, 'GREAT_FAILURE', 55, 75, 60, 4]] as const)('settles roll%s honestly without resource refills or rewriting original people', (roll, tier, mind, health, pollution, sequence) => {
    const s = prepared(), before = structuredClone(s), bottle = s.prophecyMaster.bottles[0]!; s.actionsRemaining = 0;
    const c = apply(s, dose(s), roll); expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 30);
    expect([bottle.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
    expect(bottle).toMatchObject({ status: 'CONSUMED', consumedWeek: s.week, preparationWeek: s.week }); expect(s.prophecyMaster.preparedWeek).toBeNull();
    originals(s, before); expect(s.character.age).toBe(26); expect(s.character.gender).toBe('FEMALE'); expect(s.random).toEqual(before.random);
    expect(s.combatHistory).toEqual(before.combatHistory); expect(s.injuries).toEqual(before.injuries); expect(s.town).toEqual(before.town);
    expect(s.prophecyMaster.life).toEqual(before.prophecyMaster.life); expect(s.prophecyMaster.encounter).toEqual(before.prophecyMaster.encounter);
    for (const [id, mastery] of Object.entries(before.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    if (sequence === 3) {
      expect(s.prophecyMaster.mysticActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
      expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(before.progression.mastery, id))).toEqual([...PROPHECY_MASTER_ABILITY_IDS]);
      expect(s.progression.mastery['hermit.s3.prophetic-glimpse']).toBe(0);
      for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(before.character.coreStats[stat] + 1);
      expect(projectProphecyMaster(s).inheritedHistory.join(' ')).toContain('105'); expect(projectProphecyMaster(s).inheritedHistory.join(' ')).toContain('15%');
      expect(projectProphecyMaster(s).resources).toMatchObject({ maxSpirituality: 120, spirituality: 31 });
    } else expect(s.progression.acting).toBe(100);
    expect(validateProphecyMasterState(s)).toBe(true); reject(s, dose(s));
  });
  it('protects only guided potion rejection and never revives a dead body', () => {
    const s = prepared(); s.health = 21; s.mind = 41; apply(s, dose(s), 100); expect([s.health, s.mind, s.status, s.progression.sequence]).toEqual([1, 1, 'ACTIVE', 4]);
    const dead = prepared(); dead.status = 'DEAD'; dead.health = 0; reject(dead, dose(dead)); expect(validateProphecyMasterState(s)).toBe(true);
  });
  it('retains failed originals and requires another140 check for recovery and retry', () => {
    const s = prepared(); apply(s, dose(s), 100); const failed = structuredClone(s.prophecyMaster.bottles[0]), tasks = structuredClone(s.prophecyMaster.preparations);
    buy(s, 1); reject(s, dose(s, 1)); s.health = 100; s.mind = 100; const cash = s.cash; apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, 1));
    expect(s.cash).toBe(cash - 140); expect(s.prophecyMaster.bottles[0]).toEqual(failed); expect(s.prophecyMaster.preparations).toEqual(tasks); expect(validateProphecyMasterState(s)).toBe(true);
  });
  it('waits an actual next week for three new priced bottles after all current originals fail', () => {
    const s = qualify(taught()); reject(s, { type: 'RECEIVE_SUPPLY' });
    for (let n = 0; n < 3; n++) { buy(s, n); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100; if (n < 2) reject(s, { type: 'REQUEST_SUPPLY' }); }
    const bottles = structuredClone(s.prophecyMaster.bottles); apply(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; apply(s, { type: 'RECEIVE_SUPPLY' }); expect(s.prophecyMaster.bottles.slice(0, 3)).toEqual(bottles); expect(s.prophecyMaster.bottles).toHaveLength(6);
    expect(s.prophecyMaster.bottles[3]).toMatchObject({ id: 'prophecy-master-potion-4', status: 'SUPPLIER', labourSteps: 0, stockedWeek: s.week, acquiredWeek: null });
    expect(projectProphecyMaster(s).actions.find(a => a.id === 'buy-prophecy-master-potion-4')!.cost).toContain('6400'); expect(validateProphecyMasterState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('measures twelve full weeks from original MysticW95, then rejects stale checks and unmet digestion', () => {
    const s = mystic(); s.week = s.mystic.promotionWeek! + 11; qualify(taught(s)); buy(s); const originalPromotion = s.progression.promotionWeek;
    expect(prophecyMasterAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('11/12'); reject(s, { type: 'PREPARE_PROMOTION' });
    s.week = s.mystic.promotionWeek! + 12; apply(s, { type: 'PREPARE_PROMOTION' }); expect(s.progression.promotionWeek).toBe(originalPromotion);
    s.progression.acting = 99; reject(s, dose(s)); s.progression.acting = 100; s.health = 20; reject(s, dose(s)); s.health = 100; s.mind = 40; reject(s, dose(s)); s.mind = 100;
    s.week++; reject(s, dose(s)); expect(validateProphecyMasterState(s)).toBe(false); apply(s, { type: 'LEAVE_PREPARATION' });
  });
  it('blocks unfinished old originals and practice without charging', () => {
    const s = qualify(taught()); buy(s);
    const changes: ((state: SliceState) => void)[] = [
      t => { t.mystic.ritual.sample.status = 'ANALYSIS'; }, t => { t.starMystic.practice.lenses = 'HELD'; },
      t => { Object.values(t.pryer.cases)[0]!.readingOpen = true; }, t => { Object.values(t.combatScholar.cases)[0]!.exerciseOpen = true; },
      t => { Object.values(t.wizard.cases)[0]!.effectOpen = true; }, t => { Object.values(t.scrollProfessor.cases)[0]!.contactOpen = true; },
      t => { t.starMystic.practice.screen = 'OPEN'; }, t => { t.starMystic.practice.companionNode = 'MARK'; },
      t => { t.starMystic.practice.playerNode = 'COURTYARD'; }, t => { t.starMystic.practice.cageActive = true; },
      t => { Object.values(t.mystic.life.cases)[0]!.contactOpen = true; }, t => { t.mystic.encounter.status = 'FIGHTING'; },
      t => { t.mystic.encounter.echoReady = true; }, t => { t.mystic.life.sight.player.location = 'MARK'; },
      t => { Object.values(t.mystic.life.cases)[0]!.status = 'PREPARED'; },
      ...(['pryer', 'combatScholar', 'wizard', 'scrollProfessor', 'starMystic'] as const).map(root => (t: SliceState) => { Object.values(t[root].cases)[0]!.status = 'PREPARED'; }),
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); reject(t, { type: 'PREPARE_PROMOTION' }); }
  });
  it('rejects unavailable guidance, foreign locations, no actions and insufficient current preparation funds', () => {
    const s = mystic(); s.cash = 499; reject(s, { type: 'LEARN_GUIDANCE' }); s.cash = 100000; s.actionsRemaining = 0; reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught(); t.actionsRemaining = 0; reject(t, { type: 'PREPARE_TASK', taskId: 'REVIEW_RECORDS' }); reject(t, { type: 'POTION_WORK', bottleId: t.prophecyMaster.bottles[0]!.id });
    const u = qualify(taught()); buy(u); u.cash = 139; reject(u, { type: 'PREPARE_PROMOTION' }); u.cash = 140; u.world.city = 'ELSEWHERE'; reject(u, { type: 'PREPARE_PROMOTION' });
  });
  it.each([null, {}, { type: 'BREW' }, { type: 'ALTER_FUTURE' }, { type: 'INFORMATION_BODY' }, { type: 'PREVENT_HIGHER_DISASTER' }, { type: 'BUY_POTION', bottleId: 'mystic-potion-1' }, { type: 'PREPARE_TASK', taskId: 'GATHER_BELIEVERS' }, { type: 'LEARN_GUIDANCE', grantAllStories: true }, { type: 'CONSUME', bottleId: 'prophecy-master-potion-1', confirmed: false }])('rejects exact unauthorized command shape%# before mutation', command => {
    expect(validateProphecyMasterCommand(command)).toBe(false); expect(isProphecyMasterAcquisitionCommand(command)).toBe(false); reject(taught(), command);
  });
  it('rejects forged chronology, duplicated bottles or tasks, missing mastery and malformed scene data', () => {
    const s = prepared(); apply(s, dose(s));
    const changes: ((state: SliceState) => void)[] = [
      t => { t.prophecyMaster.mysticActingAtPromotion = 99; }, t => { t.prophecyMaster.bottles[0]!.source = 'old original'; },
      t => { t.prophecyMaster.bottles[0]!.preparationWeek = t.prophecyMaster.bottles[0]!.preparationWeek! - 1; }, t => { t.prophecyMaster.bottles[1]!.id = t.prophecyMaster.bottles[0]!.id; },
      t => { t.prophecyMaster.preparations[1]!.taskId = t.prophecyMaster.preparations[0]!.taskId; }, t => { t.prophecyMaster.preparations[0]!.completedWeek = t.week + 1; },
      t => { t.prophecyMaster.preparedWeek = t.week; }, t => { delete t.progression.mastery['hermit.s3.prophetic-glimpse']; },
      t => { (t.prophecyMaster as unknown as Record<string, unknown>).life = null; }, t => { (t.prophecyMaster as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateProphecyMasterState(t)).not.toThrow(); expect(validateProphecyMasterState(t)).toBe(false); }
  });
  it('keeps key order irrelevant and preserves the actual public story, returned original drop and surrendered Lucan', () => {
    const s = prepared(), before = structuredClone(s); apply(s, dose(s));
    const reorder = (value: unknown): unknown => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, reorder(v)])) : value;
    expect(validateProphecyMasterState(reorder(s) as SliceState)).toBe(true);
    const history = projectProphecyMaster(s).inheritedHistory.join(' ');
    for (const text of ['MY4-LUCAN-VEY', 'SURRENDERED', '健康70/100', '灵性17', '原伤势1处', '105', '15%', 'RETURNED']) expect(history).toContain(text);
    expect(s.mystic.life.story).toEqual(before.mystic.life.story); expect(s.mystic.ritual).toEqual(before.mystic.ritual);
    expect(s.scrollProfessor.workshop).toEqual(before.scrollProfessor.workshop); expect(s.starMystic.practice.lenses).toBe('WORN');
  });
});
