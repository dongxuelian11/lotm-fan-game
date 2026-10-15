import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applySummoningMasterAcquisition, applySummoningMasterCommand, createSummoningMasterState, hasSummoningMasterLock, isSummoningMasterAcquisitionCommand, projectSummoningMaster, validateSummoningMasterCommand, validateSummoningMasterState, summoningMasterAcquisitionBlock } from '../../src/domain/summoning-master/index.js';
import { SUMMONING_MASTER_CONSUMPTION_RISK, SUMMONING_MASTER_FORMULA_STATUS, SUMMONING_MASTER_PRICES, SUMMONING_MASTER_SOURCE_STATUS } from '../../src/domain/summoning-master/content.js';
import { SUMMONING_MASTER_ABILITY_IDS, SUMMONING_MASTER_PREPARATION_IDS, type SummoningMasterAcquisitionCommand } from '../../src/domain/summoning-master/types.js';

/** Genuine 349-command witch-king-v01210 end-state; later time/resources are explicit unit setup, never natural-play evidence. */
function witchKing(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/witch-king-v01210/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.summoningMaster = createSummoningMasterState();
  s.week = Math.max(s.week, s.witchKing.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.combat = null;
  s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 30;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: SummoningMasterAcquisitionCommand, roll = 1) { const c = context(s, roll); applySummoningMasterAcquisition(s, command, c); return c; }
function taught(s = witchKing()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function qualify(s: SliceState) { for (const taskId of SUMMONING_MASTER_PREPARATION_IDS) apply(s, { type: 'PREPARE_TASK', taskId }); return s; }
function buy(s: SliceState, index = 0) { const b = s.summoningMaster.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.summoningMaster.bottles[index]!.id, confirmed: true }) as const;
function prepared() { const s = qualify(taught()); buy(s); apply(s, { type: 'PREPARE_PROMOTION' }); return s; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applySummoningMasterAcquisition(s, command as SummoningMasterAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Summoning Master S3 original bottles and explicitly G professional preparation', () => {
  it('reads the genuine349-command living W92 baseline without treating unit boosts as natural play', () => {
    const fixture = JSON.parse(readFileSync('tests/fixtures/witch-king-v01210/natural.json', 'utf8'));
    expect(fixture.commands).toHaveLength(349); expect(fixture.seed).toBe(fixture.final.random.seed);
    expect(fixture.final).toMatchObject({ week: 92, status: 'ACTIVE', cash: 664, actionsRemaining: 3, health: 100, mind: 100, spirituality: 102, character: { gender: 'FEMALE' }, witchKing: { promotionWeek: 83 }, progression: { sequence: 4, acting: 100 } });
    const state = migrateSliceState(fixture.final);
    expect(validateSummoningMasterState(state)).toBe(true);
    expect(state.witchKing).toEqual(fixture.final.witchKing); expect(state.vampire).toEqual(fixture.final.vampire); expect(state.tamer).toEqual(fixture.final.tamer);
    expect(projectSummoningMaster(state).digestion).toContain('9/12');
  });
  it('creates independent originals and hides the source before moon S4', () => {
    const s = createSliceRun('summoning-master-hidden', sliceDefaultCreationSelection, 'summoning-master-hidden');
    expect(validateSummoningMasterState(s)).toBe(true);
    expect(projectSummoningMaster(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], supplies: '', resources: null });
    expect(projectSummoningMaster(s).story).toBeUndefined(); reject(s, { type: 'LEARN_GUIDANCE' });
    const other = createSummoningMasterState(); other.bottles[0]!.labourSteps = 5; other.preparations.push({ taskId: 'INSPECT_SOURCE', completedWeek: 1 });
    expect(s.summoningMaster.bottles[0]!.labourSteps).toBe(0); expect(s.summoningMaster.preparations).toEqual([]);
  });
  it('does not open this S3 channel for any other pathway or unsupported moon sequence', () => {
    const s = witchKing();
    for (const pathwayId of ['diviner', 'hunter', 'audience', 'paragon', 'darkness', 'white-tower', 'tyrant', 'sun', 'death', 'door', 'error', 'warrior', 'demoness', 'hermit', 'hanged-man', 'abyss', 'chained', 'wheel', 'black-emperor', 'justiciar', 'mother'] as const) {
      const other = structuredClone(s); other.progression.pathwayId = pathwayId;
      expect(projectSummoningMaster(other).discovered).toBe(false); expect(projectSummoningMaster(other).actions).toEqual([]); reject(other, { type: 'LEARN_GUIDANCE' });
    }
    for (const sequence of [9, 8, 7, 6, 5, 1, 0]) { const other = structuredClone(s); other.progression.sequence = sequence as NonNullable<SliceState['progression']['sequence']>; expect(projectSummoningMaster(other).discovered).toBe(false); }
  });
  it('keeps S2 as read-only inherited S3 history without reopening acquisition', () => { const s=witchKing();s.progression.sequence=2;expect(projectSummoningMaster(s).discovered).toBe(true);expect(projectSummoningMaster(s).actions).toEqual([]);reject(s,{type:'LEARN_GUIDANCE'}); });
  it('charges500 and one action without inventing a canonical formula, rite or unverified canonical ability', () => {
    const s = witchKing(), old = structuredClone([s.apothecary, s.tamer, s.vampire, s.potionProfessor, s.crimsonScholar, s.witchKing]);
    apply(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]);
    expect([s.apothecary, s.tamer, s.vampire, s.potionProfessor, s.crimsonScholar, s.witchKing]).toEqual(old);
    expect(SUMMONING_MASTER_PRICES).toEqual({ guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 });
    expect(SUMMONING_MASTER_FORMULA_STATUS).toContain('完整配方与晋升仪式尚未核实');
    expect(SUMMONING_MASTER_FORMULA_STATUS).toContain('不复用巫王的旧仪式包');
    expect(SUMMONING_MASTER_SOURCE_STATUS).toContain('直接核实月亮序列3召唤大师'); expect(SUMMONING_MASTER_SOURCE_STATUS).toContain('序列2创生者之名'); expect(SUMMONING_MASTER_SOURCE_STATUS).toContain('受外来加持的巫王越阶个例'); expect(SUMMONING_MASTER_SOURCE_STATUS).toContain('均为明确原创G'); expect(SUMMONING_MASTER_CONSUMPTION_RISK).toContain('不保护实际战斗');
    expect(projectSummoningMaster(s)).toMatchObject({ formulaKnown: false, formula: [], preparations: SUMMONING_MASTER_PREPARATION_IDS.map(taskId => ({ taskId, completedWeek: null })) });
    reject(s, { type: 'LEARN_GUIDANCE' }); expect(validateSummoningMasterState(s)).toBe(true);
  });
  it('five actual bottle-specific jobs yield only that original800 price, never free preparation', () => {
    const s = taught(), b = s.summoningMaster.bottles[0]!, oldHistory = structuredClone(s.witchKing);
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, b.status, b.acquiredWeek]).toEqual([98700, 'PLAYER', s.week]);
    expect(s.summoningMaster.bottles[1]!.labourSteps).toBe(0); expect(s.summoningMaster.preparations).toEqual([]); expect(s.summoningMaster.preparedWeek).toBeNull();
    expect(s.witchKing).toEqual(oldHistory); expect(validateSummoningMasterState(s)).toBe(true); reject(s, { type: 'BUY_POTION', bottleId: b.id });
  });
  it('does not partially discount or transfer one bottle’s labour', () => {
    const s = taught(), b = s.summoningMaster.bottles[0]!;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(6200);
    s.cash = 6199; reject(s, { type: 'BUY_POTION', bottleId: s.summoningMaster.bottles[1]!.id });
  });
  it('requires three distinct real professional tasks and separate current-week paid preparation', () => {
    const s = taught(); buy(s); reject(s, dose(s)); reject(s, { type: 'PREPARE_PROMOTION' });
    for (const [index, taskId] of SUMMONING_MASTER_PREPARATION_IDS.entries()) {
      const ap = s.actionsRemaining; apply(s, { type: 'PREPARE_TASK', taskId });
      expect(s.actionsRemaining).toBe(ap - 1); expect(s.summoningMaster.preparations[index]).toEqual({ taskId, completedWeek: s.week });
      reject(s, { type: 'PREPARE_TASK', taskId });
      if (index < 2) reject(s, { type: 'PREPARE_PROMOTION' });
    }
    reject(s, dose(s)); const cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'PREPARE_PROMOTION' }); expect([s.cash, s.actionsRemaining, s.summoningMaster.preparedWeek]).toEqual([cash - 120, ap - 1, s.week]);
    expect(hasSummoningMasterLock(s)).toBe(true); expect(projectSummoningMaster(s).insideCase).toBe(true); expect(validateSummoningMasterState(s)).toBe(true);
  });
  it('preserves the last action as a real zero-action confirmation or non-refunding exit', () => {
    const s = qualify(taught()); buy(s); s.actionsRemaining = 1;
    const week = s.week, cash = s.cash; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.week, s.actionsRemaining, s.cash]).toEqual([week, 0, cash - 120]); reject(s, { type: 'PREPARE_PROMOTION' });
    applySummoningMasterCommand(s, { type: 'LEAVE_PREPARATION' }, context(s));
    expect([s.actionsRemaining, s.cash, s.summoningMaster.preparedWeek]).toEqual([0, cash - 120, null]);
    expect(s.summoningMaster.bottles[0]!.status).toBe('PLAYER'); expect(hasSummoningMasterLock(s)).toBe(false); reject(s, dose(s));
    expect(validateSummoningMasterState(s)).toBe(true);
  });
  it('requires exact independent confirmation before any result draw', () => {
    const s = prepared();
    for (const command of [{ type: 'CONSUME', bottleId: dose(s).bottleId }, { ...dose(s), confirmed: false }, { ...dose(s), acceptBodyChange: true }]) {
      expect(validateSummoningMasterCommand(command)).toBe(false); reject(s, command);
    }
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 3], [30, 'SUCCESS', 85, 100, 0, 3], [90, 'FAILURE', 75, 85, 30, 4], [100, 'GREAT_FAILURE', 55, 75, 60, 4]] as const)('settles exact tier%s while preserving original S4 history and original people', (roll, tier, mind, health, pollution, sequence) => {
    const s = prepared(), b = s.summoningMaster.bottles[0]!, original = structuredClone([s.apothecary, s.tamer, s.vampire, s.potionProfessor, s.crimsonScholar, s.witchKing]);
    const oldMastery = { ...s.progression.mastery }, stats = { ...s.character.coreStats }, gender = s.character.gender, tasks = structuredClone(s.summoningMaster.preparations);
    s.actionsRemaining = 0; const c = apply(s, dose(s), roll);
    expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 30);
    expect([b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
    expect(b).toMatchObject({ status: 'CONSUMED', consumedWeek: s.week, preparationWeek: s.week }); expect(s.summoningMaster.preparedWeek).toBeNull();
    expect([s.apothecary, s.tamer, s.vampire, s.potionProfessor, s.crimsonScholar, s.witchKing]).toEqual(original);
    expect(s.summoningMaster.preparations).toEqual(tasks); expect(s.character.gender).toBe(gender);
    for (const [id, value] of Object.entries(oldMastery)) expect(s.progression.mastery[id]).toBe(value);
    if (sequence === 3) {
      expect(s.summoningMaster.witchKingActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
      expect(SUMMONING_MASTER_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
      for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
      expect(projectSummoningMaster(s).resources).toMatchObject({ maxSpirituality: 120, spirituality: 31 });
    } else expect(s.progression.acting).toBe(100);
    expect(validateSummoningMasterState(s)).toBe(true); reject(s, dose(s));
  });
  it('floors only guided potion rejection to1 and never reopens a dead run', () => {
    const s = prepared(); s.health = 21; s.mind = 41; apply(s, dose(s), 100);
    expect([s.health, s.mind, s.status, s.progression.sequence]).toEqual([1, 1, 'ACTIVE', 4]);
    expect(validateSummoningMasterState(s)).toBe(true);
    const dead = prepared(); dead.status = 'DEAD'; dead.health = 0; reject(dead, dose(dead));
  });
  it('keeps the failed bottle consumed, requires paid re-preparation, and permits recovery then retry', () => {
    const s = prepared(); apply(s, dose(s), 100);
    const first = structuredClone(s.summoningMaster.bottles[0]), oldHistory = structuredClone(s.witchKing), tasks = structuredClone(s.summoningMaster.preparations);
    buy(s, 1); reject(s, dose(s, 1)); s.health = 100; s.mind = 100;
    const cash = s.cash, ap = s.actionsRemaining; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 120, ap - 1]); apply(s, dose(s, 1));
    expect(s.summoningMaster.bottles[0]).toEqual(first); expect(s.witchKing).toEqual(oldHistory); expect(s.summoningMaster.preparations).toEqual(tasks);
    expect(validateSummoningMasterState(s)).toBe(true);
  });
  it('retains all failed originals and waits a true week for a new priced batch', () => {
    const s = qualify(taught());
    for (let n = 0; n < 3; n++) { buy(s, n); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100; if (n < 2) reject(s, { type: 'REQUEST_SUPPLY' }); }
    const originals = structuredClone(s.summoningMaster.bottles), oldHistory = structuredClone(s.witchKing), ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); reject(s, { type: 'RECEIVE_SUPPLY' });
    s.week++; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.summoningMaster.bottles.slice(0, 3)).toEqual(originals); expect(s.summoningMaster.bottles).toHaveLength(6);
    expect(s.summoningMaster.bottles[3]).toMatchObject({ id: 'summoning-master-potion-4', status: 'SUPPLIER', labourSteps: 0, stockedWeek: s.week, acquiredWeek: null });
    expect(s.witchKing).toEqual(oldHistory);
    expect(projectSummoningMaster(s).actions.find(a => a.id === 'buy-summoning-master-potion-4')!.cost).toContain('6200便士');
    expect(validateSummoningMasterState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('checks prior digestion, twelve full weeks, vitality and stale preparation before drawing', () => {
    const s = prepared();
    s.progression.acting = 99; reject(s, dose(s)); s.progression.acting = 100;
    const oldPromotion = s.witchKing.promotionWeek; s.witchKing.promotionWeek = s.week - 11; reject(s, dose(s)); s.witchKing.promotionWeek = oldPromotion;
    s.health = 20; reject(s, dose(s)); s.health = 100; s.mind = 40; reject(s, dose(s)); s.mind = 100;
    s.week++; reject(s, dose(s)); expect(validateSummoningMasterState(s)).toBe(false);
    apply(s, { type: 'LEAVE_PREPARATION' }); expect(s.summoningMaster.preparedWeek).toBeNull();
  });
  it('measures twelve full weeks from actual witchKing promotion W83 rather than original apothecary W5', () => {
    const s = qualify(taught()); buy(s);
    expect(s.witchKing.promotionWeek).toBe(83); expect(s.progression.promotionWeek).toBe(5);
    s.week = 91;
    expect(summoningMasterAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('8/12');
    expect(projectSummoningMaster(s).digestion).toContain('8/12'); reject(s, { type: 'PREPARE_PROMOTION' });
    s.week = 94; reject(s, { type: 'PREPARE_PROMOTION' });
    s.week = 95; apply(s, { type: 'PREPARE_PROMOTION' });
    expect(s.summoningMaster.preparedWeek).toBe(95); expect(s.progression.promotionWeek).toBe(5);
  });
  it('lets an alive depleted character cancel at zero actions without healing, refund or a result draw', () => {
    const s = prepared(); s.actionsRemaining = 0; s.health = 1; s.mind = 1;
    const cash = s.cash, spirit = s.spirituality, bottles = structuredClone(s.summoningMaster.bottles), old = structuredClone(s.witchKing);
    reject(s, dose(s));
    expect(projectSummoningMaster(s).actions.find(a => a.command.type === 'LEAVE_PREPARATION')).toMatchObject({ enabled: true, cost: expect.stringContaining('0行动') });
    const c = apply(s, { type: 'LEAVE_PREPARATION' });
    expect(c.check).not.toHaveBeenCalled(); expect([s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining]).toEqual([1, 1, spirit, cash, 0]);
    expect(s.summoningMaster.bottles).toEqual(bottles); expect(s.witchKing).toEqual(old); expect(hasSummoningMasterLock(s)).toBe(false);
    reject(s, { type: 'LEAVE_PREPARATION' }); expect(validateSummoningMasterState(s)).toBe(true);
  });
  it.each([1, 100])('leaves the real preparation scene after consumption%s even with no remaining actions', roll => {
    const s = prepared(); s.actionsRemaining = 0; const c = apply(s, dose(s), roll);
    expect(s.summoningMaster.preparedWeek).toBeNull(); expect(hasSummoningMasterLock(s)).toBe(false);
    expect(c.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('沿原出口实际离开'));
    expect(projectSummoningMaster(s).insideCase).toBe(false); expect(validateSummoningMasterState(s)).toBe(true);
  });
  it('preserves the same original injured Dorian, papers, people, blood, animals and female body across S3', () => {
    const s = prepared(), history = structuredClone(s.combatHistory), injuries = structuredClone(s.injuries), town = structuredClone(s.town);
    const originalPromotion = s.progression.promotionWeek, random = structuredClone(s.random);
    expect(s.character.gender).toBe('FEMALE');
    expect(s.witchKing.encounter.enemy).toMatchObject({ id: 'WK4-DORIAN', health: 70, mind: 100, status: 'SURRENDERED', weaponLocation: 'YARD' });
    expect(s.witchKing.life.papers.map(p => [p.id, p.status])).toEqual([['WK4-PAPER-1-1', 'CONSUMED'], ['WK4-PAPER-1-2', 'PREPARED'], ['WK4-PAPER-1-3', 'HELD']]);
    expect(s.witchKing.life.target.status).toBe('BROKEN'); expect(s.witchKing.life.instructor).toMatchObject({ id: 'WK4-IRMA', alive: true });
    expect(s.witchKing.ritual.expert).toMatchObject({ id: 'WK4-GRACE', alive: true });
    const originals = structuredClone([s.apothecary, s.tamer, s.vampire, s.potionProfessor, s.crimsonScholar, s.witchKing]);
    const newScenes = structuredClone([s.summoningMaster.life, s.summoningMaster.encounter]);
    apply(s, dose(s));
    expect(s.combatHistory).toEqual(history); expect(s.injuries).toEqual(injuries); expect(s.town).toEqual(town);
    expect(s.progression.promotionWeek).toBe(originalPromotion); expect(s.random).toEqual(random); expect(s.character.gender).toBe('FEMALE');
    expect([s.apothecary, s.tamer, s.vampire, s.potionProfessor, s.crimsonScholar, s.witchKing]).toEqual(originals);
    expect([s.summoningMaster.life, s.summoningMaster.encounter]).toEqual(newScenes);
    const visible = projectSummoningMaster(s).inheritedHistory.join(' ');
    expect(visible).toContain('健康70/100、精神100/100'); expect(visible).toContain('已投降，原伤势保留'); expect(visible).toContain('原院地面');
    expect(visible).toContain('WK4-PAPER-1-1：已耗尽，不补回'); expect(visible).toContain('WK4-PAPER-1-2：已明确准备，未耗尽');
    expect(visible).toContain('WK4-PAPER-1-3：实际持有，尚未准备'); expect(visible).toContain('已经破损，不重置');
  });
  it('rejects guidance without the actual S4 promotion and cannot borrow any old material batch', () => {
    const s = witchKing(); s.witchKing.promotionWeek = null;
    expect(projectSummoningMaster(s).discovered).toBe(false); reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught();
    for (const bottleId of ['witch-king-potion-1', 'crimson-scholar-potion-2', 'potion-professor-potion-2']) reject(t, { type: 'BUY_POTION', bottleId });
    expect(t.witchKing.bottles[2]!.status).toBe('SUPPLIER');
  });
  it('rejects missing action points before charging tasks, work, guidance or preparation', () => {
    const s = witchKing(); s.actionsRemaining = 0; reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught(); t.actionsRemaining = 0;
    reject(t, { type: 'PREPARE_TASK', taskId: 'INSPECT_SOURCE' }); reject(t, { type: 'POTION_WORK', bottleId: t.summoningMaster.bottles[0]!.id });
    const u = qualify(taught()); buy(u); u.actionsRemaining = 0; reject(u, { type: 'PREPARE_PROMOTION' });
  });
  it('requires old rituals, moon fields, original practice and accompanying animals to be closed', () => {
    const s = qualify(taught()); buy(s);
    s.witchKing.life.practice.field = 'MOON'; reject(s, { type: 'PREPARE_PROMOTION' }); s.witchKing.life.practice.field = 'NONE';
    s.witchKing.life.practice.location = 'END'; reject(s, { type: 'PREPARE_PROMOTION' }); s.witchKing.life.practice.location = 'START';
    s.witchKing.life.cases['paper-trial'].status = 'PREPARED'; reject(s, { type: 'PREPARE_PROMOTION' }); s.witchKing.life.cases['paper-trial'].status = 'RESOLVED';
    const first = Object.values(s.crimsonScholar.cases)[0]!; first.contactOpen = true; reject(s, { type: 'PREPARE_PROMOTION' }); first.contactOpen = false;
    s.crimsonScholar.practice.field = 'FULL'; reject(s, { type: 'PREPARE_PROMOTION' }); s.crimsonScholar.practice.field = 'NONE';
    s.tamer.companionId = 'yard-hound'; reject(s, { type: 'PREPARE_PROMOTION' }); s.tamer.companionId = null;
    const oldPotionCase = Object.values(s.potionProfessor.cases)[0]!; oldPotionCase.contactOpen = true; reject(s, { type: 'PREPARE_PROMOTION' }); oldPotionCase.contactOpen = false;
    expect(summoningMasterAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toBeNull();
  });
  it.each([null, {}, { type: 'BREW' }, { type: 'BUY_POTION', bottleId: 'witch-king-potion-3' }, { type: 'PREPARE_TASK', taskId: 'MASS_RESONANCE' }, { type: 'LEARN_GUIDANCE', grantArmy: true }, { type: 'CONSUME', bottleId: 'summoning-master-potion-1', confirmed: false }])('rejects nonexact commands%# without mutation', command => {
    expect(validateSummoningMasterCommand(command)).toBe(false); expect(isSummoningMasterAcquisitionCommand(command)).toBe(false); reject(taught(), command);
  });
  it('rejects malformed shape, copied bottle provenance, duplicate preparation and forged chronology', () => {
    const s = prepared(); apply(s, dose(s));
    const changes: ((state: SliceState) => void)[] = [
      t => { t.summoningMaster.witchKingActingAtPromotion = 99; }, t => { t.summoningMaster.bottles[0]!.source = 'old S4 bottle'; },
      t => { t.summoningMaster.bottles[0]!.preparationWeek = t.summoningMaster.bottles[0]!.preparationWeek! - 1; }, t => { t.summoningMaster.bottles[1]!.id = t.summoningMaster.bottles[0]!.id; },
      t => { t.summoningMaster.preparations[1]!.taskId = t.summoningMaster.preparations[0]!.taskId; },
      t => { t.summoningMaster.preparations[0]!.completedWeek = t.week + 1; }, t => { t.summoningMaster.preparedWeek = t.week; },
      t => { delete t.progression.mastery[SUMMONING_MASTER_ABILITY_IDS[0]]; },
      t => { (t.summoningMaster as unknown as Record<string, unknown>).life = null; },
      t => { (t.summoningMaster as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateSummoningMasterState(t)).not.toThrow(); expect(validateSummoningMasterState(t)).toBe(false); }
  });
  it('keeps validation independent of serialized object key order', () => {
    const s = prepared(); apply(s, dose(s));
    const reorder = (v: unknown): unknown => Array.isArray(v) ? v.map(reorder) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, reorder(x)])) : v;
    expect(validateSummoningMasterState(reorder(s) as SliceState)).toBe(true);
  });

  it('returns explicit preparation blockers without consuming the next original bottle', () => {
    const s = qualify(taught()); buy(s); s.cash = 119;
    expect(summoningMasterAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('120'); reject(s, { type: 'PREPARE_PROMOTION' });
    expect(s.summoningMaster.bottles[0]!.status).toBe('PLAYER');
  });
});
