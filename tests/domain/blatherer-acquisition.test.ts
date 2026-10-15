import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyBlathererAcquisition, createBlathererState, hasBlathererLock, isBlathererAcquisitionCommand, projectBlatherer, blathererAcquisitionBlock, validateBlathererCommand, validateBlathererState } from '../../src/domain/blatherer/index.js';
import { BLATHERER_CONSUMPTION_RISK, BLATHERER_FORMULA_STATUS, BLATHERER_PRICES, BLATHERER_SOURCE_STATUS } from '../../src/domain/blatherer/content.js';
import { BLATHERER_ABILITY_IDS, BLATHERER_PREPARATION_IDS, type BlathererAcquisitionCommand } from '../../src/domain/blatherer/types.js';

const prior = () => JSON.parse(readFileSync('tests/fixtures/devil-v01330/natural.json', 'utf8'));
const roots = ['criminal', 'unwinged', 'serialKiller', 'demon', 'desireApostle', 'devil'] as const;
/** Actual434-command baseline; resource/time edits below are isolated unit setup, never natural-play evidence. */
function devil(): SliceState {
  const s = migrateSliceState(prior().final); s.blatherer = createBlathererState();
  s.week = Math.max(s.week, s.devil.promotionWeek! + 12); s.activeEvent = null; s.eventQueue = []; s.combat = null;
  s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100; s.spirituality = 31;
  s.seer.pollution = 0; s.character.coreStats.will = 30; return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: BlathererAcquisitionCommand, roll = 1) { const c = context(s, roll); applyBlathererAcquisition(s, command, c); return c; }
function taught(s = devil()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function qualify(s: SliceState) { for (const taskId of BLATHERER_PREPARATION_IDS) apply(s, { type: 'PREPARE_TASK', taskId }); return s; }
function buy(s: SliceState, index = 0) { const bottle = s.blatherer.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.blatherer.bottles[index]!.id, confirmed: true }) as const;
function prepared() { const s = qualify(taught()); buy(s); apply(s, { type: 'PREPARE_PROMOTION' }); return s; }
function reject(s: SliceState, command: unknown) {
  const original = structuredClone(s), c = context(s);
  expect(() => applyBlathererAcquisition(s, command as BlathererAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(original); expect(c.check).not.toHaveBeenCalled();
}
function originals(s: SliceState, before: SliceState) { for (const root of roots) expect(s[root]).toEqual(before[root]); }

describe('Blatherer3 original bottles and bounded G preparation', () => {
  it('reads the actual434-command W121 baseline without rewriting RNG, original choices or the original six roots', () => {
    const capture = prior(), s = migrateSliceState(capture.final);
    expect(capture.commands).toHaveLength(434); expect(capture.seed).toBe('criminal-natural-v054');
    expect(s).toMatchObject({ week: 121, status: 'ACTIVE', cash: 430, actionsRemaining: 2, health: 100, mind: 100, spirituality: 116, progression: { sequence: 4, acting: 100 }, random: { seed: 'criminal-natural-v054', cursor: 100 } });
    expect(s.devil.promotionWeek).toBe(114); expect(s.demon.strain).toBe(3); expect(s.unwinged.conscienceLost).toBe(true);
    expect(s.devil.encounter).toMatchObject({ targetId: 'DV4-ORRICK-FANE', enemyStatus: 'SURRENDERED', enemyHealth: 70, enemyMind: 100, enemySpirituality: 32 });
    expect(s.devil.encounter.enemyInjuries).toHaveLength(1); expect(s.devil.encounter.enemyInjuries[0]!.severity).toBe('HEAVY');
    originals(s, capture.final); expect(validateBlathererState(s)).toBe(true); expect(projectBlatherer(s).digestion).toContain('7/12');
  });
  it('creates independent originals and hides this source before actual Devil4', () => {
    const s = createSliceRun('blatherer-hidden', sliceDefaultCreationSelection, 'blatherer-hidden');
    expect(validateBlathererState(s)).toBe(true);
    expect(projectBlatherer(s)).toMatchObject({ discovered: false, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], resources: null, inheritedTools: '' });
    expect(projectBlatherer(s).story).toBeUndefined(); reject(s, { type: 'LEARN_GUIDANCE' });
    const other = createBlathererState(); other.bottles[0]!.labourSteps = 5; other.preparations.push({ taskId: 'REVIEW_RECORDS', completedWeek: 1 });
    expect(s.blatherer.bottles[0]!.labourSteps).toBe(0); expect(s.blatherer.preparations).toEqual([]);
  });
  it('does not open this source for another path, an unsupported sequence, or a missing real S4 promotion', () => {
    for (const pathwayId of ['diviner', 'hunter', 'audience', 'paragon', 'moon', 'darkness', 'white-tower', 'tyrant', 'death', 'sun', 'door', 'warrior', 'error', 'demoness', 'hanged-man', 'hermit', 'chained', 'wheel', 'black-emperor', 'justiciar', 'mother'] as const) {
      const s = devil(); s.progression.pathwayId = pathwayId; expect(projectBlatherer(s).discovered).toBe(false); reject(s, { type: 'LEARN_GUIDANCE' });
    }
    for (const sequence of [9, 8, 7, 6, 5, 2, 1, 0]) { const s = devil(); s.progression.sequence = sequence as NonNullable<SliceState['progression']['sequence']>; expect(projectBlatherer(s).discovered).toBe(false); }
    const s = devil(); s.devil.promotionWeek = null; reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges500 and one action without turning the unknown recipe, ritual or high-level information into facts', () => {
    const s = devil(), before = structuredClone(s); apply(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]); originals(s, before);
    expect(BLATHERER_PRICES).toEqual({ guidance: 500, potion: 6400, labourCredit: 5500, preparation: 140 });
    for (const text of ['完整配方与晋升仪式尚未核实', '不搭祭坛', '不收血晶', '人物推断', '罗安·费里']) expect(BLATHERER_FORMULA_STATUS).toContain(text);
    for (const text of ['Thirdpart205L123579', 'L123587–591', '可能为序列3', '血晶', '鲜血大公', '不授天使腐化', '均为原创G']) expect(BLATHERER_SOURCE_STATUS).toContain(text);
    expect(BLATHERER_CONSUMPTION_RISK).toContain('不保护实际战斗');
    expect(projectBlatherer(s).formula).toEqual([]); reject(s, { type: 'LEARN_GUIDANCE' }); expect(validateBlathererState(s)).toBe(true);
  });
  it('five actual jobs reduce only that unique bottle to900 and do not pay for preparations', () => {
    const s = taught(), bottle = s.blatherer.bottles[0]!;
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect([bottle.labourSteps, bottle.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]); reject(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s); expect([s.cash, bottle.status, bottle.acquiredWeek]).toEqual([98600, 'PLAYER', s.week]);
    expect(s.blatherer.bottles[1]!.labourSteps).toBe(0); expect(s.blatherer.preparations).toEqual([]); expect(s.blatherer.preparedWeek).toBeNull();
    reject(s, { type: 'BUY_POTION', bottleId: bottle.id }); expect(validateBlathererState(s)).toBe(true);
  });
  it('does not partially discount jobs, borrow an old original bottle or spend unavailable funds', () => {
    const s = taught(), bottle = s.blatherer.bottles[0]!;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: bottle.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(6400);
    s.cash = 6399; reject(s, { type: 'BUY_POTION', bottleId: s.blatherer.bottles[1]!.id });
    for (const bottleId of ['devil-potion-1', 'desire-apostle-potion-1', 'demon-potion-1']) reject(s, { type: 'BUY_POTION', bottleId });
  });
  it('requires three distinct one-action preparations and a separate current-week140 check', () => {
    const s = taught(); buy(s); reject(s, dose(s)); reject(s, { type: 'PREPARE_PROMOTION' });
    for (const [index, taskId] of BLATHERER_PREPARATION_IDS.entries()) {
      const ap = s.actionsRemaining; apply(s, { type: 'PREPARE_TASK', taskId }); expect(s.actionsRemaining).toBe(ap - 1);
      expect(s.blatherer.preparations[index]).toEqual({ taskId, completedWeek: s.week }); reject(s, { type: 'PREPARE_TASK', taskId });
    }
    reject(s, dose(s)); const cash = s.cash, ap = s.actionsRemaining; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.cash, s.actionsRemaining, s.blatherer.preparedWeek]).toEqual([cash - 140, ap - 1, s.week]);
    expect(hasBlathererLock(s)).toBe(true); expect(projectBlatherer(s).insideCase).toBe(true); expect(validateBlathererState(s)).toBe(true);
  });
  it('leaves a real zero-action nonrefunding exit after the last preparation action', () => {
    const s = qualify(taught()); buy(s); s.actionsRemaining = 1; const cash = s.cash, week = s.week;
    apply(s, { type: 'PREPARE_PROMOTION' }); expect([s.week, s.actionsRemaining, s.cash]).toEqual([week, 0, cash - 140]);
    reject(s, { type: 'PREPARE_PROMOTION' }); s.health = 1; s.mind = 1; const c = apply(s, { type: 'LEAVE_PREPARATION' });
    expect([s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining]).toEqual([1, 1, 31, cash - 140, 0]); expect(c.check).not.toHaveBeenCalled();
    expect(s.blatherer.preparedWeek).toBeNull(); expect(s.blatherer.bottles[0]!.status).toBe('PLAYER'); expect(hasBlathererLock(s)).toBe(false);
    reject(s, dose(s)); reject(s, { type: 'LEAVE_PREPARATION' }); expect(validateBlathererState(s)).toBe(true);
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 3], [30, 'SUCCESS', 85, 100, 0, 3], [90, 'FAILURE', 75, 85, 30, 4], [100, 'GREAT_FAILURE', 55, 75, 60, 4]] as const)('settles roll%s honestly without resource refills or rewriting original people', (roll, tier, mind, health, pollution, sequence) => {
    const s = prepared(), before = structuredClone(s), bottle = s.blatherer.bottles[0]!; s.actionsRemaining = 0;
    const c = apply(s, dose(s), roll); expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 30);
    expect([bottle.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
    expect(bottle).toMatchObject({ status: 'CONSUMED', consumedWeek: s.week, preparationWeek: s.week }); expect(s.blatherer.preparedWeek).toBeNull();
    originals(s, before); expect(s.character.age).toBe(26); expect(s.character.gender).toBe('FEMALE'); expect(s.random).toEqual(before.random);
    expect(s.combatHistory).toEqual(before.combatHistory); expect(s.injuries).toEqual(before.injuries); expect(s.town).toEqual(before.town);
    expect(s.blatherer.life).toEqual(before.blatherer.life); expect(s.blatherer.encounter).toEqual(before.blatherer.encounter);
    for (const [id, mastery] of Object.entries(before.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    if (sequence === 3) {
      expect(s.blatherer.devilActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
      expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(before.progression.mastery, id))).toEqual([...BLATHERER_ABILITY_IDS]);
      expect(s.progression.mastery['abyss.s3.limited-murmur']).toBe(0);
      for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(before.character.coreStats[stat] + 1);
      expect(projectBlatherer(s).inheritedHistory.join(' ')).toContain('DV4-ORRICK-FANE'); expect(projectBlatherer(s).inheritedHistory.join(' ')).toContain('原恶魔紧绷3/3');
      expect(projectBlatherer(s).resources).toMatchObject({ maxSpirituality: 120, spirituality: 31 });
    } else expect(s.progression.acting).toBe(100);
    expect(validateBlathererState(s)).toBe(true); reject(s, dose(s));
  });
  it('protects only guided potion rejection and never revives a dead body', () => {
    const s = prepared(); s.health = 21; s.mind = 41; apply(s, dose(s), 100); expect([s.health, s.mind, s.status, s.progression.sequence]).toEqual([1, 1, 'ACTIVE', 4]);
    const dead = prepared(); dead.status = 'DEAD'; dead.health = 0; reject(dead, dose(dead)); expect(validateBlathererState(s)).toBe(true);
  });
  it('retains failed originals and requires another140 check for recovery and retry', () => {
    const s = prepared(); apply(s, dose(s), 100); const failed = structuredClone(s.blatherer.bottles[0]), tasks = structuredClone(s.blatherer.preparations);
    buy(s, 1); reject(s, dose(s, 1)); s.health = 100; s.mind = 100; const cash = s.cash; apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, 1));
    expect(s.cash).toBe(cash - 140); expect(s.blatherer.bottles[0]).toEqual(failed); expect(s.blatherer.preparations).toEqual(tasks); expect(validateBlathererState(s)).toBe(true);
  });
  it('waits an actual next week for three new priced bottles after all current originals fail', () => {
    const s = qualify(taught()); reject(s, { type: 'RECEIVE_SUPPLY' });
    for (let n = 0; n < 3; n++) { buy(s, n); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100; if (n < 2) reject(s, { type: 'REQUEST_SUPPLY' }); }
    const bottles = structuredClone(s.blatherer.bottles); apply(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; apply(s, { type: 'RECEIVE_SUPPLY' }); expect(s.blatherer.bottles.slice(0, 3)).toEqual(bottles); expect(s.blatherer.bottles).toHaveLength(6);
    expect(s.blatherer.bottles[3]).toMatchObject({ id: 'blatherer-potion-4', status: 'SUPPLIER', labourSteps: 0, stockedWeek: s.week, acquiredWeek: null });
    expect(projectBlatherer(s).actions.find(a => a.id === 'buy-blatherer-potion-4')!.cost).toContain('6400'); expect(validateBlathererState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('measures twelve full weeks from original DevilW114, then rejects stale checks and unmet digestion', () => {
    const s = devil(); s.week = s.devil.promotionWeek! + 11; qualify(taught(s)); buy(s); const originalPromotion = s.progression.promotionWeek;
    expect(blathererAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('11/12'); reject(s, { type: 'PREPARE_PROMOTION' });
    s.week = s.devil.promotionWeek! + 12; apply(s, { type: 'PREPARE_PROMOTION' }); expect(s.progression.promotionWeek).toBe(originalPromotion);
    s.progression.acting = 99; reject(s, dose(s)); s.progression.acting = 100; s.health = 20; reject(s, dose(s)); s.health = 100; s.mind = 40; reject(s, dose(s)); s.mind = 100;
    s.week++; reject(s, dose(s)); expect(validateBlathererState(s)).toBe(false); apply(s, { type: 'LEAVE_PREPARATION' });
  });
  it('blocks unfinished old originals and practice without charging', () => {
    const s = qualify(taught()); buy(s);
    const changes: ((state: SliceState) => void)[] = [
      t => { Object.values(t.criminal.cases)[0]!.holding = true; }, t => { Object.values(t.unwinged.cases)[0]!.urgeOpen = true; },
      t => { Object.values(t.serialKiller.cases)[0]!.contactOpen = true; }, t => { Object.values(t.demon.cases)[0]!.contactOpen = true; },
      t => { Object.values(t.desireApostle.cases)[0]!.contactOpen = true; }, t => { Object.values(t.devil.life.cases)[0]!.contactOpen = true; },
      t => { t.demon.practice.body = 'ENLARGED'; }, t => { t.demon.practice.flame = 'LIT'; },
      t => { t.desireApostle.practice.ledger = 'PLAYER'; }, t => { t.desireApostle.practice.note = 'WRITTEN'; },
      t => { t.desireApostle.practice.seed = 'PLANTED'; }, t => { t.desireApostle.encounter.seedPlanted = true; },
      t => { t.desireApostle.encounter.staggerReady = true; }, t => { t.demon.encounter.status = 'FIGHTING'; },
      t => { t.desireApostle.encounter.status = 'FIGHTING'; }, t => { t.devil.encounter.status = 'FIGHTING'; },
      t => { t.devil.encounter.seedPlanted = true; }, t => { t.devil.encounter.staggerReady = true; },
      t => { t.devil.life.stage.seed = 'PLANTED'; }, t => { t.devil.life.stage.pauseSeconds = 30; },
      t => { t.devil.life.stage.consented = true; }, t => { t.devil.life.stage.emotion = 'STRONG'; },
      t => { t.desireApostle.practice.emotion = 'STRONG'; }, t => { t.devil.life.invitation.playerNode = 'SHELF'; },
      t => { t.devil.life.invitation.holder = 'PLAYER'; }, t => { t.devil.life.account.holder = 'PLAYER'; },
      t => { Object.values(t.devil.life.cases)[0]!.status = 'PREPARED'; },
      ...(['criminal', 'unwinged', 'serialKiller', 'demon', 'desireApostle'] as const).map(root => (t: SliceState) => { Object.values(t[root].cases)[0]!.status = 'PREPARED'; }),
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); reject(t, { type: 'PREPARE_PROMOTION' }); }
  });
  it('rejects unavailable guidance, foreign locations, no actions and insufficient current preparation funds', () => {
    const s = devil(); s.cash = 499; reject(s, { type: 'LEARN_GUIDANCE' }); s.cash = 100000; s.actionsRemaining = 0; reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught(); t.actionsRemaining = 0; reject(t, { type: 'PREPARE_TASK', taskId: 'REVIEW_RECORDS' }); reject(t, { type: 'POTION_WORK', bottleId: t.blatherer.bottles[0]!.id });
    const u = qualify(taught()); buy(u); u.cash = 139; reject(u, { type: 'PREPARE_PROMOTION' }); u.cash = 140; u.world.city = 'ELSEWHERE'; reject(u, { type: 'PREPARE_PROMOTION' });
  });
  it.each([null, {}, { type: 'BREW' }, { type: 'GLOBAL_MADNESS' }, { type: 'SUMMON_ANGEL' }, { type: 'SACRIFICIAL_ALTAR' }, { type: 'BUY_POTION', bottleId: 'devil-potion-1' }, { type: 'PREPARE_TASK', taskId: 'GATHER_BELIEVERS' }, { type: 'LEARN_GUIDANCE', forceConsent: true }, { type: 'CONSUME', bottleId: 'blatherer-potion-1', confirmed: false }])('rejects exact unauthorized command shape%# before mutation', command => {
    expect(validateBlathererCommand(command)).toBe(false); expect(isBlathererAcquisitionCommand(command)).toBe(false); reject(taught(), command);
  });
  it('rejects forged chronology, duplicated bottles or tasks, missing mastery and malformed scene data', () => {
    const s = prepared(); apply(s, dose(s));
    const changes: ((state: SliceState) => void)[] = [
      t => { t.blatherer.devilActingAtPromotion = 99; }, t => { t.blatherer.bottles[0]!.source = 'old original'; },
      t => { t.blatherer.bottles[0]!.preparationWeek = t.blatherer.bottles[0]!.preparationWeek! - 1; }, t => { t.blatherer.bottles[1]!.id = t.blatherer.bottles[0]!.id; },
      t => { t.blatherer.preparations[1]!.taskId = t.blatherer.preparations[0]!.taskId; }, t => { t.blatherer.preparations[0]!.completedWeek = t.week + 1; },
      t => { t.blatherer.preparedWeek = t.week; }, t => { delete t.progression.mastery['abyss.s3.limited-murmur']; },
      t => { (t.blatherer as unknown as Record<string, unknown>).life = null; }, t => { (t.blatherer as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateBlathererState(t)).not.toThrow(); expect(validateBlathererState(t)).toBe(false); }
  });
  it('keeps key order irrelevant and preserves actual prior choices, original objects and surrendered Orrick', () => {
    const s = prepared(), before = structuredClone(s); apply(s, dose(s));
    const reorder = (value: unknown): unknown => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, reorder(v)])) : value;
    expect(validateBlathererState(reorder(s) as SliceState)).toBe(true);
    const history = projectBlatherer(s).inheritedHistory.join(' ');
    for (const text of ['DV4-ORRICK-FANE', 'SURRENDERED', '健康70/100', '灵性32', '原伤势1处', '原恶魔紧绷3/3', '拒绝仍保留']) expect(history).toContain(text);
    originals(s, before); expect(s.devil.life.invitation.declined).toBe(true); expect(s.unwinged.conscienceLost).toBe(true);
    expect(s.devil.life.stage.programHolder).toBe('MIREL'); expect(s.demon.strain).toBe(3);
  });
});
