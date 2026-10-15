import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyThreeHeadedTemplarAcquisition, createThreeHeadedTemplarState, hasThreeHeadedTemplarLock, isThreeHeadedTemplarAcquisitionCommand, projectThreeHeadedTemplar, threeHeadedTemplarAcquisitionBlock, validateThreeHeadedTemplarCommand, validateThreeHeadedTemplarState } from '../../src/domain/three-headed-templar/index.js';
import { THREE_HEADED_TEMPLAR_CONSUMPTION_RISK, THREE_HEADED_TEMPLAR_FORMULA_STATUS, THREE_HEADED_TEMPLAR_PRICES, THREE_HEADED_TEMPLAR_SOURCE_STATUS } from '../../src/domain/three-headed-templar/content.js';
import { THREE_HEADED_TEMPLAR_ABILITY_IDS, THREE_HEADED_TEMPLAR_PREPARATION_IDS, type ThreeHeadedTemplarAcquisitionCommand } from '../../src/domain/three-headed-templar/types.js';

const prior = () => JSON.parse(readFileSync('tests/fixtures/black-knight-v01320/natural.json', 'utf8'));
const roots = ['secretSupplicant', 'listener', 'shadowAscetic', 'roseBishop', 'shepherd', 'blackKnight'] as const;
/** Actual339-command baseline; resource/time edits below are isolated unit setup, never natural-play evidence. */
function blackKnight(): SliceState {
  const s = migrateSliceState(prior().final); s.threeHeadedTemplar = createThreeHeadedTemplarState();
  s.week = Math.max(s.week, s.blackKnight.promotionWeek! + 12); s.activeEvent = null; s.eventQueue = []; s.combat = null;
  s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100; s.spirituality = 31;
  s.seer.pollution = 0; s.character.coreStats.will = 30; return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: ThreeHeadedTemplarAcquisitionCommand, roll = 1) { const c = context(s, roll); applyThreeHeadedTemplarAcquisition(s, command, c); return c; }
function taught(s = blackKnight()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function qualify(s: SliceState) { for (const taskId of THREE_HEADED_TEMPLAR_PREPARATION_IDS) apply(s, { type: 'PREPARE_TASK', taskId }); return s; }
function buy(s: SliceState, index = 0) { const bottle = s.threeHeadedTemplar.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.threeHeadedTemplar.bottles[index]!.id, confirmed: true }) as const;
function prepared() { const s = qualify(taught()); buy(s); apply(s, { type: 'PREPARE_PROMOTION' }); return s; }
function reject(s: SliceState, command: unknown) {
  const original = structuredClone(s), c = context(s);
  expect(() => applyThreeHeadedTemplarAcquisition(s, command as ThreeHeadedTemplarAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(original); expect(c.check).not.toHaveBeenCalled();
}
function originals(s: SliceState, before: SliceState) { for (const root of roots) expect(s[root]).toEqual(before[root]); }

describe('Three Headed Templar3 original bottles and bounded G preparation', () => {
  it('reads the actual339-command W90 baseline without rewriting RNG, released originals or the original six roots', () => {
    const capture = prior(), s = migrateSliceState(capture.final);
    expect(capture.commands).toHaveLength(339); expect(capture.seed).toBe('secret-supplicant-natural-v051');
    expect(s).toMatchObject({ week: 90, status: 'ACTIVE', cash: 920, actionsRemaining: 3, health: 90, mind: 100, spirituality: 115, progression: { sequence: 4, acting: 100 }, random: { seed: 'secret-supplicant-natural-v051', cursor: 222 } });
    expect(s.blackKnight.promotionWeek).toBe(77);
    expect(s.shepherd.grazing.activeSpiritId).toBe('SH5-IRIS-1');
    expect(s.shepherd.grazing.spirits.find(spirit => spirit.id === 'SH5-CEDRIC-1')).toMatchObject({ status: 'RELEASED', releasedWeek: 64 });
    expect(s.blackKnight.encounter).toMatchObject({ targetId: 'BK4-GARRICK-NOLL', enemyStatus: 'SURRENDERED', enemyHealth: 40, enemyMind: 100, enemySpirituality: 5 });
    expect(s.blackKnight.life.shade).toMatchObject({ creatureId: 'BK4-SHADE-1', status: 'ISOLATED', controlled: false, roomStatus: 'QUARANTINED' });
    originals(s, capture.final); expect(validateThreeHeadedTemplarState(s)).toBe(true); expect(projectThreeHeadedTemplar(s).digestion).toContain('13/12');
  });
  it('creates independent originals and hides this source before actual BlackKnight4', () => {
    const s = createSliceRun('templar-hidden', sliceDefaultCreationSelection, 'templar-hidden');
    expect(validateThreeHeadedTemplarState(s)).toBe(true);
    expect(projectThreeHeadedTemplar(s)).toMatchObject({ discovered: false, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], resources: null, inheritedTools: '' });
    expect(projectThreeHeadedTemplar(s).story).toBeUndefined(); reject(s, { type: 'LEARN_GUIDANCE' });
    const other = createThreeHeadedTemplarState(); other.bottles[0]!.labourSteps = 5; other.preparations.push({ taskId: 'REVIEW_RECORDS', completedWeek: 1 });
    expect(s.threeHeadedTemplar.bottles[0]!.labourSteps).toBe(0); expect(s.threeHeadedTemplar.preparations).toEqual([]);
  });
  it('does not open this source for another path, an unsupported sequence, or a missing real S4 promotion', () => {
    for (const pathwayId of ['diviner', 'hunter', 'audience', 'paragon', 'moon', 'darkness', 'white-tower', 'tyrant', 'death', 'sun', 'door', 'warrior', 'error', 'demoness', 'hermit', 'abyss', 'chained', 'wheel', 'black-emperor', 'justiciar', 'mother'] as const) {
      const s = blackKnight(); s.progression.pathwayId = pathwayId; expect(projectThreeHeadedTemplar(s).discovered).toBe(false); reject(s, { type: 'LEARN_GUIDANCE' });
    }
    // S2 now retains the tested Elder lineage; S1 and S0 remain unopened.
    for (const sequence of [9, 8, 7, 6, 5, 1, 0]) { const s = blackKnight(); s.progression.sequence = sequence as NonNullable<SliceState['progression']['sequence']>; expect(projectThreeHeadedTemplar(s).discovered).toBe(false); }
    const s = blackKnight(); s.blackKnight.promotionWeek = null; reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges500 and one action without turning the unknown recipe, ritual or high-level information into facts', () => {
    const s = blackKnight(), before = structuredClone(s); apply(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]); originals(s, before);
    expect(THREE_HEADED_TEMPLAR_PRICES).toEqual({ guidance: 500, potion: 6400, labourCredit: 5500, preparation: 140 });
    for (const text of ['完整配方与晋升仪式尚未核实', '不能断言无需仪式', '三瓶独立成品']) expect(THREE_HEADED_TEMPLAR_FORMULA_STATUS).toContain(text);
    for (const text of ['没有给出具体新上限', '本作至多2位外放', '主人仍同时只借1灵', '此前已故', '失败消耗不返', '永久释放', '均为原创G']) expect(THREE_HEADED_TEMPLAR_SOURCE_STATUS).toContain(text);
    expect(THREE_HEADED_TEMPLAR_CONSUMPTION_RISK).toContain('不保护实际战斗');
    expect(projectThreeHeadedTemplar(s).formula).toEqual([]); reject(s, { type: 'LEARN_GUIDANCE' }); expect(validateThreeHeadedTemplarState(s)).toBe(true);
  });
  it('five actual jobs reduce only that unique bottle to900 and do not pay for preparations', () => {
    const s = taught(), bottle = s.threeHeadedTemplar.bottles[0]!;
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect([bottle.labourSteps, bottle.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]); reject(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s); expect([s.cash, bottle.status, bottle.acquiredWeek]).toEqual([98600, 'PLAYER', s.week]);
    expect(s.threeHeadedTemplar.bottles[1]!.labourSteps).toBe(0); expect(s.threeHeadedTemplar.preparations).toEqual([]); expect(s.threeHeadedTemplar.preparedWeek).toBeNull();
    reject(s, { type: 'BUY_POTION', bottleId: bottle.id }); expect(validateThreeHeadedTemplarState(s)).toBe(true);
  });
  it('does not partially discount jobs, borrow an old original bottle or spend unavailable funds', () => {
    const s = taught(), bottle = s.threeHeadedTemplar.bottles[0]!;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: bottle.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(6400);
    s.cash = 6399; reject(s, { type: 'BUY_POTION', bottleId: s.threeHeadedTemplar.bottles[1]!.id });
    for (const bottleId of ['black-knight-potion-1', 'shepherd-potion-1', 'rose-bishop-potion-1']) reject(s, { type: 'BUY_POTION', bottleId });
  });
  it('requires three distinct one-action preparations and a separate current-week140 check', () => {
    const s = taught(); buy(s); reject(s, dose(s)); reject(s, { type: 'PREPARE_PROMOTION' });
    for (const [index, taskId] of THREE_HEADED_TEMPLAR_PREPARATION_IDS.entries()) {
      const ap = s.actionsRemaining; apply(s, { type: 'PREPARE_TASK', taskId }); expect(s.actionsRemaining).toBe(ap - 1);
      expect(s.threeHeadedTemplar.preparations[index]).toEqual({ taskId, completedWeek: s.week }); reject(s, { type: 'PREPARE_TASK', taskId });
    }
    reject(s, dose(s)); const cash = s.cash, ap = s.actionsRemaining; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.cash, s.actionsRemaining, s.threeHeadedTemplar.preparedWeek]).toEqual([cash - 140, ap - 1, s.week]);
    expect(hasThreeHeadedTemplarLock(s)).toBe(true); expect(projectThreeHeadedTemplar(s).insideCase).toBe(true); expect(validateThreeHeadedTemplarState(s)).toBe(true);
  });
  it('leaves a real zero-action nonrefunding exit after the last preparation action', () => {
    const s = qualify(taught()); buy(s); s.actionsRemaining = 1; const cash = s.cash, week = s.week;
    apply(s, { type: 'PREPARE_PROMOTION' }); expect([s.week, s.actionsRemaining, s.cash]).toEqual([week, 0, cash - 140]);
    reject(s, { type: 'PREPARE_PROMOTION' }); s.health = 1; s.mind = 1; const c = apply(s, { type: 'LEAVE_PREPARATION' });
    expect([s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining]).toEqual([1, 1, 31, cash - 140, 0]); expect(c.check).not.toHaveBeenCalled();
    expect(s.threeHeadedTemplar.preparedWeek).toBeNull(); expect(s.threeHeadedTemplar.bottles[0]!.status).toBe('PLAYER'); expect(hasThreeHeadedTemplarLock(s)).toBe(false);
    reject(s, dose(s)); reject(s, { type: 'LEAVE_PREPARATION' }); expect(validateThreeHeadedTemplarState(s)).toBe(true);
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 3], [30, 'SUCCESS', 85, 100, 0, 3], [90, 'FAILURE', 75, 85, 30, 4], [100, 'GREAT_FAILURE', 55, 75, 60, 4]] as const)('settles roll%s honestly without resource refills or rewriting original people', (roll, tier, mind, health, pollution, sequence) => {
    const s = prepared(), before = structuredClone(s), bottle = s.threeHeadedTemplar.bottles[0]!; s.actionsRemaining = 0;
    const c = apply(s, dose(s), roll); expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 30);
    expect([bottle.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
    expect(bottle).toMatchObject({ status: 'CONSUMED', consumedWeek: s.week, preparationWeek: s.week }); expect(s.threeHeadedTemplar.preparedWeek).toBeNull();
    originals(s, before); expect(s.character.age).toBe(26); expect(s.character.gender).toBe('FEMALE'); expect(s.random).toEqual(before.random);
    expect(s.combatHistory).toEqual(before.combatHistory); expect(s.injuries).toEqual(before.injuries); expect(s.town).toEqual(before.town);
    expect(s.threeHeadedTemplar.life).toEqual(before.threeHeadedTemplar.life); expect(s.threeHeadedTemplar.encounter).toEqual(before.threeHeadedTemplar.encounter);
    for (const [id, mastery] of Object.entries(before.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    if (sequence === 3) {
      expect(s.threeHeadedTemplar.blackKnightActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
      expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(before.progression.mastery, id))).toEqual([...THREE_HEADED_TEMPLAR_ABILITY_IDS]);
      expect(s.progression.mastery['hanged-man.s3.multiple-release']).toBe(0);
      for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(before.character.coreStats[stat] + 1);
      expect(projectThreeHeadedTemplar(s).inheritedHistory.join(' ')).toContain('RELEASED'); expect(projectThreeHeadedTemplar(s).inheritedHistory.join(' ')).toContain('ISOLATED');
      expect(projectThreeHeadedTemplar(s).resources).toMatchObject({ maxSpirituality: 120, spirituality: 31 });
    } else expect(s.progression.acting).toBe(100);
    expect(validateThreeHeadedTemplarState(s)).toBe(true); reject(s, dose(s));
  });
  it('protects only guided potion rejection and never revives a dead body', () => {
    const s = prepared(); s.health = 21; s.mind = 41; apply(s, dose(s), 100); expect([s.health, s.mind, s.status, s.progression.sequence]).toEqual([1, 1, 'ACTIVE', 4]);
    const dead = prepared(); dead.status = 'DEAD'; dead.health = 0; reject(dead, dose(dead)); expect(validateThreeHeadedTemplarState(s)).toBe(true);
  });
  it('retains failed originals and requires another140 check for recovery and retry', () => {
    const s = prepared(); apply(s, dose(s), 100); const failed = structuredClone(s.threeHeadedTemplar.bottles[0]), tasks = structuredClone(s.threeHeadedTemplar.preparations);
    buy(s, 1); reject(s, dose(s, 1)); s.health = 100; s.mind = 100; const cash = s.cash; apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, 1));
    expect(s.cash).toBe(cash - 140); expect(s.threeHeadedTemplar.bottles[0]).toEqual(failed); expect(s.threeHeadedTemplar.preparations).toEqual(tasks); expect(validateThreeHeadedTemplarState(s)).toBe(true);
  });
  it('waits an actual next week for three new priced bottles after all current originals fail', () => {
    const s = qualify(taught()); reject(s, { type: 'RECEIVE_SUPPLY' });
    for (let n = 0; n < 3; n++) { buy(s, n); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100; if (n < 2) reject(s, { type: 'REQUEST_SUPPLY' }); }
    const bottles = structuredClone(s.threeHeadedTemplar.bottles); apply(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; apply(s, { type: 'RECEIVE_SUPPLY' }); expect(s.threeHeadedTemplar.bottles.slice(0, 3)).toEqual(bottles); expect(s.threeHeadedTemplar.bottles).toHaveLength(6);
    expect(s.threeHeadedTemplar.bottles[3]).toMatchObject({ id: 'three-headed-templar-potion-4', status: 'SUPPLIER', labourSteps: 0, stockedWeek: s.week, acquiredWeek: null });
    expect(projectThreeHeadedTemplar(s).actions.find(a => a.id === 'buy-three-headed-templar-potion-4')!.cost).toContain('6400'); expect(validateThreeHeadedTemplarState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('measures twelve full weeks from original BlackKnightW77, then rejects stale checks and unmet digestion', () => {
    const s = blackKnight(); s.week = s.blackKnight.promotionWeek! + 11; qualify(taught(s)); buy(s); const originalPromotion = s.progression.promotionWeek;
    expect(threeHeadedTemplarAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('11/12'); reject(s, { type: 'PREPARE_PROMOTION' });
    s.week = s.blackKnight.promotionWeek! + 12; apply(s, { type: 'PREPARE_PROMOTION' }); expect(s.progression.promotionWeek).toBe(originalPromotion);
    s.progression.acting = 99; reject(s, dose(s)); s.progression.acting = 100; s.health = 20; reject(s, dose(s)); s.health = 100; s.mind = 40; reject(s, dose(s)); s.mind = 100;
    s.week++; reject(s, dose(s)); expect(validateThreeHeadedTemplarState(s)).toBe(false); apply(s, { type: 'LEAVE_PREPARATION' });
  });
  it('blocks unfinished old originals and practice without charging', () => {
    const s = qualify(taught()); buy(s);
    const changes: ((state: SliceState) => void)[] = [
      t => { Object.values(t.secretSupplicant.cases)[0]!.contactOpen = true; },
      t => { Object.values(t.listener.cases)[0]!.contactOpen = true; },
      t => { Object.values(t.shadowAscetic.cases)[0]!.hidden = true; },
      t => { t.roseBishop.practice.shape = 'SLIM_HAND'; },
      t => { Object.values(t.shepherd.cases)[0]!.contactOpen = true; },
      t => { t.shepherd.practice.playerNode = 'MARK'; },
      t => { t.shepherd.encounter.blurReady = true; },
      t => { t.blackKnight.life.card.location = 'MARK'; },
      t => { t.blackKnight.life.card.borrowing = true; },
      t => { t.blackKnight.life.shadow.bound = true; },
      t => { t.blackKnight.life.panel.bladeActive = true; },
      t => { t.blackKnight.life.shade.playerNode = 'ROOM'; },
      t => { t.blackKnight.encounter.status = 'FIGHTING'; },
      t => { t.blackKnight.encounter.shadowReady = true; },
      t => { Object.values(t.blackKnight.life.cases)[0]!.status = 'PREPARED'; },
      ...(['secretSupplicant', 'listener', 'shadowAscetic', 'roseBishop', 'shepherd'] as const).map(root => (t: SliceState) => { Object.values(t[root].cases)[0]!.status = 'PREPARED'; }),
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); reject(t, { type: 'PREPARE_PROMOTION' }); }
  });
  it('rejects unavailable guidance, foreign locations, no actions and insufficient current preparation funds', () => {
    const s = blackKnight(); s.cash = 499; reject(s, { type: 'LEARN_GUIDANCE' }); s.cash = 100000; s.actionsRemaining = 0; reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught(); t.actionsRemaining = 0; reject(t, { type: 'PREPARE_TASK', taskId: 'REVIEW_RECORDS' }); reject(t, { type: 'POTION_WORK', bottleId: t.threeHeadedTemplar.bottles[0]!.id });
    const u = qualify(taught()); buy(u); u.cash = 139; reject(u, { type: 'PREPARE_PROMOTION' }); u.cash = 140; u.world.city = 'ELSEWHERE'; reject(u, { type: 'PREPARE_PROMOTION' });
  });
  it.each([null, {}, { type: 'BREW' }, { type: 'COPY_SPIRIT' }, { type: 'RECALL_CEDRIC' }, { type: 'CONTROL_OLD_SHADE' }, { type: 'BUY_POTION', bottleId: 'black-knight-potion-1' }, { type: 'PREPARE_TASK', taskId: 'GATHER_BELIEVERS' }, { type: 'LEARN_GUIDANCE', grantAllStories: true }, { type: 'CONSUME', bottleId: 'three-headed-templar-potion-1', confirmed: false }])('rejects exact unauthorized command shape%# before mutation', command => {
    expect(validateThreeHeadedTemplarCommand(command)).toBe(false); expect(isThreeHeadedTemplarAcquisitionCommand(command)).toBe(false); reject(taught(), command);
  });
  it('rejects forged chronology, duplicated bottles or tasks, missing mastery and malformed scene data', () => {
    const s = prepared(); apply(s, dose(s));
    const changes: ((state: SliceState) => void)[] = [
      t => { t.threeHeadedTemplar.blackKnightActingAtPromotion = 99; }, t => { t.threeHeadedTemplar.bottles[0]!.source = 'old original'; },
      t => { t.threeHeadedTemplar.bottles[0]!.preparationWeek = t.threeHeadedTemplar.bottles[0]!.preparationWeek! - 1; }, t => { t.threeHeadedTemplar.bottles[1]!.id = t.threeHeadedTemplar.bottles[0]!.id; },
      t => { t.threeHeadedTemplar.preparations[1]!.taskId = t.threeHeadedTemplar.preparations[0]!.taskId; }, t => { t.threeHeadedTemplar.preparations[0]!.completedWeek = t.week + 1; },
      t => { t.threeHeadedTemplar.preparedWeek = t.week; }, t => { delete t.progression.mastery['hanged-man.s3.multiple-release']; },
      t => { (t.threeHeadedTemplar as unknown as Record<string, unknown>).life = null; }, t => { (t.threeHeadedTemplar as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateThreeHeadedTemplarState(t)).not.toThrow(); expect(validateThreeHeadedTemplarState(t)).toBe(false); }
  });
  it('keeps key order irrelevant and preserves actual released Cedric, grazed Iris, isolated shadow and surrendered Garrick', () => {
    const s = prepared(), before = structuredClone(s); apply(s, dose(s));
    const reorder = (value: unknown): unknown => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, reorder(v)])) : value;
    expect(validateThreeHeadedTemplarState(reorder(s) as SliceState)).toBe(true);
    const history = projectThreeHeadedTemplar(s).inheritedHistory.join(' ');
    for (const text of ['BK4-GARRICK-NOLL', 'SURRENDERED', '健康40/100', '灵性5', '原伤势4处', 'SH5-CEDRIC-1', 'RELEASED', 'SH5-IRIS-1', 'GRAZED', 'ISOLATED']) expect(history).toContain(text);
    expect(s.shepherd.grazing).toEqual(before.shepherd.grazing); expect(s.blackKnight.life.shade).toEqual(before.blackKnight.life.shade);
    expect(s.roseBishop.reserve).toEqual(before.roseBishop.reserve); originals(s, before);
    expect(projectThreeHeadedTemplar(s).inheritedTools).toContain('全局仍同时只借1灵');
    expect(projectThreeHeadedTemplar(s).inheritedTools).toContain('两位新源只供实际外放协作');
  });
});
