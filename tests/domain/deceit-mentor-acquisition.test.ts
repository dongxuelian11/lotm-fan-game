import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyDeceitMentorAcquisition, applyDeceitMentorCommand, createDeceitMentorState, hasDeceitMentorLock, isDeceitMentorAcquisitionCommand, projectDeceitMentor, validateDeceitMentorCommand, validateDeceitMentorState, deceitMentorAcquisitionBlock } from '../../src/domain/deceit-mentor/index.js';
import { DECEIT_MENTOR_CONSUMPTION_RISK, DECEIT_MENTOR_FORMULA_STATUS, DECEIT_MENTOR_PRICES, DECEIT_MENTOR_SOURCE_STATUS } from '../../src/domain/deceit-mentor/content.js';
import { DECEIT_MENTOR_ABILITY_IDS, DECEIT_MENTOR_PREPARATION_IDS, type DeceitMentorAcquisitionCommand } from '../../src/domain/deceit-mentor/types.js';

/** Actual living S4 result from all352 natural public commands; subsequent edits are targeted unit setup, never natural-play evidence. */
function parasite(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/parasite-v01280/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.deceitMentor = createDeceitMentorState();
  s.week = Math.max(s.week, s.parasite.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.combat = null;
  s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 30;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: DeceitMentorAcquisitionCommand, roll = 1) { const c = context(s, roll); applyDeceitMentorAcquisition(s, command, c); return c; }
function taught(s = parasite()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function qualify(s: SliceState) { for (const taskId of DECEIT_MENTOR_PREPARATION_IDS) apply(s, { type: 'PREPARE_TASK', taskId }); return s; }
function buy(s: SliceState, index = 0) { const b = s.deceitMentor.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.deceitMentor.bottles[index]!.id, confirmed: true }) as const;
function prepared() { const s = qualify(taught()); buy(s); apply(s, { type: 'PREPARE_PROMOTION' }); return s; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyDeceitMentorAcquisition(s, command as DeceitMentorAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('DeceitMentor S3 original bottles and explicitly G professional preparation', () => {
  it('reads the real352-command living W92 natural parasite baseline without altering its random state', () => {
    const fixture = JSON.parse(readFileSync('tests/fixtures/parasite-v01280/natural.json', 'utf8'));
    expect(fixture.commands).toHaveLength(352); expect(fixture.seed).toBe('marauder-natural-v038');
    expect(fixture.final).toMatchObject({ week: 92, status: 'ACTIVE', cash: 570, actionsRemaining: 3, health: 100, mind: 100, spirituality: 114, parasite: { promotionWeek: 82 }, progression: { sequence: 4, acting: 100 } });
    const state = migrateSliceState(fixture.final); expect(validateDeceitMentorState(state)).toBe(true);
    for (const key of ['marauder', 'swindler', 'cryptologist', 'fireThief', 'dreamStealer', 'parasite'] as const) expect(state[key]).toEqual(fixture.final[key]);
    expect(state.random).toEqual(fixture.final.random); expect(projectDeceitMentor(state).digestion).toContain('10/12');
    expect(state.parasite.encounter).toMatchObject({ enemyStatus: 'SURRENDERED', weapon: { id: 'PR4-RALF-CLUB', location: 'YARD' }, borrowed: [] });
  });
  it('creates independent originals and hides the source before Error S4', () => {
    const s = createSliceRun('deceitMentor-hidden', sliceDefaultCreationSelection, 'deceitMentor-hidden');
    expect(validateDeceitMentorState(s)).toBe(true);
    expect(projectDeceitMentor(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], supplies: '', resources: null });
    expect(projectDeceitMentor(s).story).toBeUndefined(); reject(s, { type: 'LEARN_GUIDANCE' });
    const other = createDeceitMentorState(); other.bottles[0]!.labourSteps = 5; other.preparations.push({ taskId: 'CHECK_SOURCE', completedWeek: 1 });
    expect(s.deceitMentor.bottles[0]!.labourSteps).toBe(0); expect(s.deceitMentor.preparations).toEqual([]);
  });
  it('does not open this S3 channel for any other pathway or unsupported Error sequence', () => {
    const s = parasite();
    for (const pathwayId of ['diviner', 'hunter', 'audience', 'paragon', 'moon', 'darkness', 'white-tower', 'tyrant', 'death', 'sun', 'door', 'warrior', 'demoness', 'hermit', 'hanged-man', 'abyss', 'chained', 'wheel', 'black-emperor', 'justiciar', 'mother'] as const) {
      const other = structuredClone(s); other.progression.pathwayId = pathwayId;
      expect(projectDeceitMentor(other).discovered).toBe(false); expect(projectDeceitMentor(other).actions).toEqual([]); reject(other, { type: 'LEARN_GUIDANCE' });
    }
    for (const sequence of [9, 8, 7, 6, 5, 1, 0]) { const other = structuredClone(s); other.progression.sequence = sequence as NonNullable<SliceState['progression']['sequence']>; expect(projectDeceitMentor(other).discovered).toBe(false); }
  });
  it('charges500 and one action while separating verified direction from unknown complete recipe and rite', () => {
    const s = parasite(), old = structuredClone([s.marauder, s.swindler, s.cryptologist, s.fireThief, s.dreamStealer, s.parasite]);
    apply(s, { type: 'LEARN_GUIDANCE' }); expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]);
    expect([s.marauder, s.swindler, s.cryptologist, s.fireThief, s.dreamStealer, s.parasite]).toEqual(old);
    expect(DECEIT_MENTOR_PRICES).toEqual({ guidance: 500, potion: 6400, labourCredit: 5500, preparation: 140 });
    expect(DECEIT_MENTOR_FORMULA_STATUS).toContain('完整配方与晋升仪式尚未核实');
    expect(DECEIT_MENTOR_SOURCE_STATUS).toContain('第六部第12章'); expect(DECEIT_MENTOR_SOURCE_STATUS).toContain('阿蒙');
    expect(DECEIT_MENTOR_SOURCE_STATUS).toContain('一周'); expect(DECEIT_MENTOR_SOURCE_STATUS).toContain('均为原创G');
    expect(DECEIT_MENTOR_CONSUMPTION_RISK).toContain('不保护实际战斗');
    expect(projectDeceitMentor(s)).toMatchObject({ title: '欺瞒导师·错误序列3（有限规则欺瞒G）', formulaKnown: false, formula: [], preparations: DECEIT_MENTOR_PREPARATION_IDS.map(taskId => ({ taskId, completedWeek: null })) });
    expect(JSON.stringify(projectDeceitMentor(s))).not.toContain('sourceEpoch');
    reject(s, { type: 'LEARN_GUIDANCE' }); expect(validateDeceitMentorState(s)).toBe(true);
  });
  it('five actual bottle-specific jobs yield only that original900 price, never free preparation', () => {
    const s = taught(), b = s.deceitMentor.bottles[0]!, oldHistory = structuredClone(s.parasite);
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, b.status, b.acquiredWeek]).toEqual([98600, 'PLAYER', s.week]);
    expect(s.deceitMentor.bottles[1]!.labourSteps).toBe(0); expect(s.deceitMentor.preparations).toEqual([]); expect(s.deceitMentor.preparedWeek).toBeNull();
    expect(s.parasite).toEqual(oldHistory); expect(validateDeceitMentorState(s)).toBe(true); reject(s, { type: 'BUY_POTION', bottleId: b.id });
  });
  it('does not partially discount or transfer one bottle’s labour', () => {
    const s = taught(), b = s.deceitMentor.bottles[0]!;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(6400);
    s.cash = 6399; reject(s, { type: 'BUY_POTION', bottleId: s.deceitMentor.bottles[1]!.id });
  });
  it('requires three distinct real professional tasks and separate current-week paid preparation', () => {
    const s = taught(); buy(s); reject(s, dose(s)); reject(s, { type: 'PREPARE_PROMOTION' });
    for (const [index, taskId] of DECEIT_MENTOR_PREPARATION_IDS.entries()) {
      const ap = s.actionsRemaining; apply(s, { type: 'PREPARE_TASK', taskId });
      expect(s.actionsRemaining).toBe(ap - 1); expect(s.deceitMentor.preparations[index]).toEqual({ taskId, completedWeek: s.week });
      reject(s, { type: 'PREPARE_TASK', taskId });
      if (index < 2) reject(s, { type: 'PREPARE_PROMOTION' });
    }
    reject(s, dose(s)); const cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'PREPARE_PROMOTION' }); expect([s.cash, s.actionsRemaining, s.deceitMentor.preparedWeek]).toEqual([cash - 140, ap - 1, s.week]);
    expect(hasDeceitMentorLock(s)).toBe(true); expect(projectDeceitMentor(s).insideCase).toBe(true); expect(validateDeceitMentorState(s)).toBe(true);
  });
  it('preserves the last action as a real zero-action confirmation or non-refunding exit', () => {
    const s = qualify(taught()); buy(s); s.actionsRemaining = 1;
    const week = s.week, cash = s.cash; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.week, s.actionsRemaining, s.cash]).toEqual([week, 0, cash - 140]); reject(s, { type: 'PREPARE_PROMOTION' });
    applyDeceitMentorCommand(s, { type: 'LEAVE_PREPARATION' }, context(s));
    expect([s.actionsRemaining, s.cash, s.deceitMentor.preparedWeek]).toEqual([0, cash - 140, null]);
    expect(s.deceitMentor.bottles[0]!.status).toBe('PLAYER'); expect(hasDeceitMentorLock(s)).toBe(false); reject(s, dose(s));
    expect(validateDeceitMentorState(s)).toBe(true);
  });
  it('requires exact independent confirmation before any result draw', () => {
    const s = prepared();
    for (const command of [{ type: 'CONSUME', bottleId: dose(s).bottleId }, { ...dose(s), confirmed: false }, { ...dose(s), acceptBodyChange: true }]) {
      expect(validateDeceitMentorCommand(command)).toBe(false); reject(s, command);
    }
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 3], [30, 'SUCCESS', 85, 100, 0, 3], [90, 'FAILURE', 75, 85, 30, 4], [100, 'GREAT_FAILURE', 55, 75, 60, 4]] as const)('settles exact tier%s while preserving original S4 history and original people', (roll, tier, mind, health, pollution, sequence) => {
    const s = prepared(), b = s.deceitMentor.bottles[0]!, original = structuredClone([s.marauder, s.swindler, s.cryptologist, s.fireThief, s.dreamStealer, s.parasite]);
    const oldMastery = { ...s.progression.mastery }, stats = { ...s.character.coreStats }, gender = s.character.gender, tasks = structuredClone(s.deceitMentor.preparations);
    s.actionsRemaining = 0; const c = apply(s, dose(s), roll);
    expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 30);
    expect([b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
    expect(b).toMatchObject({ status: 'CONSUMED', consumedWeek: s.week, preparationWeek: s.week }); expect(s.deceitMentor.preparedWeek).toBeNull();
    expect([s.marauder, s.swindler, s.cryptologist, s.fireThief, s.dreamStealer, s.parasite]).toEqual(original);
    expect(s.deceitMentor.preparations).toEqual(tasks); expect(s.character.gender).toBe(gender);
    for (const [id, value] of Object.entries(oldMastery)) expect(s.progression.mastery[id]).toBe(value);
    if (sequence === 3) {
      expect(s.deceitMentor.parasiteActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
      expect(DECEIT_MENTOR_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
      for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
      expect(projectDeceitMentor(s).resources).toMatchObject({ maxSpirituality: 120, spirituality: 31 });
    } else expect(s.progression.acting).toBe(100);
    expect(validateDeceitMentorState(s)).toBe(true); reject(s, dose(s));
  });
  it('floors only guided potion rejection to1 and never reopens a dead run', () => {
    const s = prepared(); s.health = 21; s.mind = 41; apply(s, dose(s), 100);
    expect([s.health, s.mind, s.status, s.progression.sequence]).toEqual([1, 1, 'ACTIVE', 4]);
    expect(validateDeceitMentorState(s)).toBe(true);
    const dead = prepared(); dead.status = 'DEAD'; dead.health = 0; reject(dead, dose(dead));
  });
  it('keeps the failed bottle consumed, requires paid re-preparation, and permits recovery then retry', () => {
    const s = prepared(); apply(s, dose(s), 100);
    const first = structuredClone(s.deceitMentor.bottles[0]), oldHistory = structuredClone(s.parasite), tasks = structuredClone(s.deceitMentor.preparations);
    buy(s, 1); reject(s, dose(s, 1)); s.health = 100; s.mind = 100;
    const cash = s.cash, ap = s.actionsRemaining; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 140, ap - 1]); apply(s, dose(s, 1));
    expect(s.deceitMentor.bottles[0]).toEqual(first); expect(s.parasite).toEqual(oldHistory); expect(s.deceitMentor.preparations).toEqual(tasks);
    expect(validateDeceitMentorState(s)).toBe(true);
  });
  it('retains all failed originals and waits a true week for a new priced batch', () => {
    const s = qualify(taught());
    for (let n = 0; n < 3; n++) { buy(s, n); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100; if (n < 2) reject(s, { type: 'REQUEST_SUPPLY' }); }
    const originals = structuredClone(s.deceitMentor.bottles), oldHistory = structuredClone(s.parasite), ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); reject(s, { type: 'RECEIVE_SUPPLY' });
    s.week++; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.deceitMentor.bottles.slice(0, 3)).toEqual(originals); expect(s.deceitMentor.bottles).toHaveLength(6);
    expect(s.deceitMentor.bottles[3]).toMatchObject({ id: 'deceit-mentor-potion-4', status: 'SUPPLIER', labourSteps: 0, stockedWeek: s.week, acquiredWeek: null });
    expect(s.parasite).toEqual(oldHistory);
    expect(projectDeceitMentor(s).actions.find(a => a.id === 'buy-deceit-mentor-potion-4')!.cost).toContain('6400便士');
    expect(validateDeceitMentorState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('checks prior digestion, twelve full weeks, vitality and stale preparation before drawing', () => {
    const s = prepared();
    s.progression.acting = 99; reject(s, dose(s)); s.progression.acting = 100;
    const oldPromotion = s.parasite.promotionWeek; s.parasite.promotionWeek = s.week - 11; reject(s, dose(s)); s.parasite.promotionWeek = oldPromotion;
    s.health = 20; reject(s, dose(s)); s.health = 100; s.mind = 40; reject(s, dose(s)); s.mind = 100;
    s.week++; reject(s, dose(s)); expect(validateDeceitMentorState(s)).toBe(false);
    apply(s, { type: 'LEAVE_PREPARATION' }); expect(s.deceitMentor.preparedWeek).toBeNull();
  });
  it('measures twelve full weeks from actual parasite promotionW82 rather than original marauderW5', () => {
    const s = qualify(taught()); buy(s); expect(s.parasite.promotionWeek).toBe(82); expect(s.progression.promotionWeek).toBe(5);
    s.week = 90; expect(deceitMentorAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('8/12');
    expect(projectDeceitMentor(s).digestion).toContain('8/12'); reject(s, { type: 'PREPARE_PROMOTION' });
    s.week = 93; reject(s, { type: 'PREPARE_PROMOTION' }); s.week = 94; apply(s, { type: 'PREPARE_PROMOTION' });
    expect(s.deceitMentor.preparedWeek).toBe(94); expect(s.progression.promotionWeek).toBe(5);
  });
  it('lets an alive depleted character cancel at zero actions without healing, refund or a result draw', () => {
    const s = prepared(); s.actionsRemaining = 0; s.health = 1; s.mind = 1;
    const cash = s.cash, spirit = s.spirituality, bottles = structuredClone(s.deceitMentor.bottles), old = structuredClone(s.parasite);
    reject(s, dose(s));
    expect(projectDeceitMentor(s).actions.find(a => a.command.type === 'LEAVE_PREPARATION')).toMatchObject({ enabled: true, cost: expect.stringContaining('0行动') });
    const c = apply(s, { type: 'LEAVE_PREPARATION' });
    expect(c.check).not.toHaveBeenCalled(); expect([s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining]).toEqual([1, 1, spirit, cash, 0]);
    expect(s.deceitMentor.bottles).toEqual(bottles); expect(s.parasite).toEqual(old); expect(hasDeceitMentorLock(s)).toBe(false);
    reject(s, { type: 'LEAVE_PREPARATION' }); expect(validateDeceitMentorState(s)).toBe(true);
  });
  it.each([1, 100])('leaves the real preparation scene after consumption%s even with no remaining actions', roll => {
    const s = prepared(); s.actionsRemaining = 0; const c = apply(s, dose(s), roll);
    expect(s.deceitMentor.preparedWeek).toBeNull(); expect(hasDeceitMentorLock(s)).toBe(false);
    expect(c.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('沿原出口实际离开'));
    expect(projectDeceitMentor(s).insideCase).toBe(false); expect(validateDeceitMentorState(s)).toBe(true);
  });
  it('preserves the autonomous host, restored old thought, surrendered injured Ralf and every old theft window across S3', () => {
    const s = prepared(), history = structuredClone(s.combatHistory), injuries = structuredClone(s.injuries), town = structuredClone(s.town);
    const originalPromotion = s.progression.promotionWeek, random = structuredClone(s.random);
    expect(s.parasite.life).toMatchObject({ host: { id: 'PR4-THOMAS', control: 'HOST', mode: 'NONE' }, player: { entries: 2, exits: 2, presence: 'OUTSIDE' }, thought: { pending: 'NONE', targetPaused: false, lastRelease: 'EXECUTED' } });
    expect(s.parasite.encounter).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED', weapon: { location: 'YARD' }, borrowed: [] });
    const originals = structuredClone([s.marauder, s.swindler, s.cryptologist, s.fireThief, s.dreamStealer, s.parasite]), newScenes = structuredClone([s.deceitMentor.life, s.deceitMentor.encounter]);
    apply(s, dose(s)); expect(s.combatHistory).toEqual(history); expect(s.injuries).toEqual(injuries); expect(s.town).toEqual(town);
    expect(s.progression.promotionWeek).toBe(originalPromotion); expect(s.random).toEqual(random); expect(s.character.gender).toBe('FEMALE');
    expect([s.marauder, s.swindler, s.cryptologist, s.fireThief, s.dreamStealer, s.parasite]).toEqual(originals); expect([s.deceitMentor.life, s.deceitMentor.encounter]).toEqual(newScenes);
    expect(s.progression.mastery['error.s4.parasitism']).toBe(16); expect(s.progression.mastery['error.s4.deferred-thought']).toBe(33);
    const visible = projectDeceitMentor(s).inheritedHistory.join(' ');
    for (const text of ['PR4-THOMAS', 'HOST', 'PR4-ALICE', 'EXECUTED', 'PR4-RALF-TOREN', 'SURRENDERED', 'PR4-RALF-CLUB', 'YARD', '原暂窃记录0条']) expect(visible).toContain(text);
  });
  it('rejects guidance without the actual S4 promotion and cannot borrow any old material batch', () => {
    const s = parasite(); s.parasite.promotionWeek = null;
    expect(projectDeceitMentor(s).discovered).toBe(false); reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught();
    for (const bottleId of ['parasite-potion-1', 'dream-stealer-potion-2', 'fire-thief-potion-2']) reject(t, { type: 'BUY_POTION', bottleId });
    expect(t.parasite.bottles[0]!.status).toBe('CONSUMED');
  });
  it('rejects missing action points before charging tasks, work, guidance or preparation', () => {
    const s = parasite(); s.actionsRemaining = 0; reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught(); t.actionsRemaining = 0;
    reject(t, { type: 'PREPARE_TASK', taskId: 'CHECK_SOURCE' }); reject(t, { type: 'POTION_WORK', bottleId: t.deceitMentor.bottles[0]!.id });
    const u = qualify(taught()); buy(u); u.actionsRemaining = 0; reject(u, { type: 'PREPARE_PROMOTION' });
  });
  it('blocks old bodily contact, withheld thought, original borrowed windows and all earlier prepared cases', () => {
    const s = qualify(taught()); buy(s); expect(deceitMentorAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toBeNull();
    const changes: ((state: SliceState) => void)[] = [
      t => { t.parasite.life.player.presence = 'INSIDE_HOST'; }, t => { t.parasite.life.host.token = 'HOST_HAND'; },
      t => { t.parasite.life.player.location = 'ROUTE_END'; }, t => { t.parasite.life.thought.pending = 'SIT_ON_PR4_CHAIR_1'; },
      t => { t.parasite.life.thought.targetPaused = true; }, t => { t.parasite.encounter.status = 'FIGHTING'; },
      t => { t.parasite.life.cases['shared-senses'].status = 'PREPARED'; }, t => { t.dreamStealer.practice.targetPaused = true; },
      t => { t.fireThief.loan.playerSteps = 1; }, t => { Object.values(t.marauder.cases)[0]!.status = 'PREPARED'; },
      t => { Object.values(t.swindler.cases)[0]!.status = 'PREPARED'; }, t => { Object.values(t.cryptologist.cases)[0]!.status = 'PREPARED'; },
      t => { Object.values(t.fireThief.cases)[0]!.status = 'PREPARED'; }, t => { Object.values(t.dreamStealer.cases)[0]!.status = 'PREPARED'; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); reject(t, { type: 'PREPARE_PROMOTION' }); }
  });
  it.each([null, {}, { type: 'BREW' }, { type: 'BUY_POTION', bottleId: 'parasite-potion-3' }, { type: 'PREPARE_TASK', taskId: 'MASS_RESONANCE' }, { type: 'LEARN_GUIDANCE', grantOmniscience: true }, { type: 'CONSUME', bottleId: 'deceit-mentor-potion-1', confirmed: false }])('rejects nonexact commands%# without mutation', command => {
    expect(validateDeceitMentorCommand(command)).toBe(false); expect(isDeceitMentorAcquisitionCommand(command)).toBe(false); reject(taught(), command);
  });
  it('rejects malformed shape, copied bottle provenance, duplicate preparation and forged chronology', () => {
    const s = prepared(); apply(s, dose(s));
    const changes: ((state: SliceState) => void)[] = [
      t => { t.deceitMentor.parasiteActingAtPromotion = 99; }, t => { t.deceitMentor.bottles[0]!.source = 'old S4 bottle'; },
      t => { t.deceitMentor.bottles[0]!.preparationWeek = t.deceitMentor.bottles[0]!.preparationWeek! - 1; }, t => { t.deceitMentor.bottles[1]!.id = t.deceitMentor.bottles[0]!.id; },
      t => { t.deceitMentor.preparations[1]!.taskId = t.deceitMentor.preparations[0]!.taskId; },
      t => { t.deceitMentor.preparations[0]!.completedWeek = t.week + 1; }, t => { t.deceitMentor.preparedWeek = t.week; },
      t => { delete t.progression.mastery[DECEIT_MENTOR_ABILITY_IDS[0]]; },
      t => { (t.deceitMentor as unknown as Record<string, unknown>).life = null; },
      t => { (t.deceitMentor as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateDeceitMentorState(t)).not.toThrow(); expect(validateDeceitMentorState(t)).toBe(false); }
  });
  it('keeps validation independent of serialized object key order', () => {
    const s = prepared(); apply(s, dose(s));
    const reorder = (v: unknown): unknown => Array.isArray(v) ? v.map(reorder) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, reorder(x)])) : v;
    expect(validateDeceitMentorState(reorder(s) as SliceState)).toBe(true);
    expect(projectDeceitMentor(reorder(s) as SliceState).inheritedHistory).toEqual(projectDeceitMentor(s).inheritedHistory);
  });

  it('returns explicit preparation blockers without consuming the next original bottle', () => {
    const s = qualify(taught()); buy(s); s.cash = 139;
    expect(deceitMentorAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('140'); reject(s, { type: 'PREPARE_PROMOTION' });
    expect(s.deceitMentor.bottles[0]!.status).toBe('PLAYER');
  });
  it('prepares only the current promotion and never grants future life consent or moves an original object', () => {
    const s = taught(), scenes = structuredClone([s.deceitMentor.life, s.deceitMentor.encounter]);
    qualify(s); buy(s); apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.deceitMentor.life, s.deceitMentor.encounter]).toEqual(scenes);
    expect(s.deceitMentor.preparations.map(p => p.taskId)).toEqual(['CHECK_SOURCE', 'BOUND_EFFECT', 'PLAN_RESTITUTION']);
    reject(s, { type: 'PREPARE_TASK', taskId: 'CHECK_SOURCE' });
    reject(s, { type: 'BUY_POTION', bottleId: s.deceitMentor.bottles[1]!.id });
    apply(s, { type: 'LEAVE_PREPARATION' });
    expect([s.deceitMentor.life, s.deceitMentor.encounter]).toEqual(scenes);
  });
  it('does not promise same-week supply, duplicate deliveries or repricing of old failed bottles', () => {
    const s = qualify(taught());
    reject(s, { type: 'RECEIVE_SUPPLY' });
    for (let n = 0; n < 3; n++) { buy(s, n); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100; }
    apply(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    const pending = structuredClone(s); pending.deceitMentor.resupply.requestedWeek = pending.week + 1;
    expect(validateDeceitMentorState(pending)).toBe(false);
    s.week++; apply(s, { type: 'RECEIVE_SUPPLY' });
    const before = structuredClone(s.deceitMentor.bottles.slice(0, 3));
    buy(s, 3); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, 3));
    expect(s.deceitMentor.bottles.slice(0, 3)).toEqual(before);
    expect(validateDeceitMentorState(s)).toBe(true);
    const bad = structuredClone(s); bad.deceitMentor.bottles[4]!.stockedWeek = bad.deceitMentor.bottles[4]!.stockedWeek! - 1;
    expect(validateDeceitMentorState(bad)).toBe(false);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
  });
  it('rejects unavailable guidance, foreign locations and unresolved original encounters without charges', () => {
    const s = parasite(); s.cash = 499; reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught(); t.parasite.life.player.presence = 'INSIDE_HOST'; reject(t, { type: 'PREPARE_TASK', taskId: 'CHECK_SOURCE' });
    t.parasite.life.player.presence = 'OUTSIDE'; t.status = 'DEAD'; reject(t, { type: 'PREPARE_TASK', taskId: 'CHECK_SOURCE' });
    t.status = 'ACTIVE'; t.world.city = 'ELSEWHERE'; reject(t, { type: 'PREPARE_TASK', taskId: 'CHECK_SOURCE' });
  });
  it('never imports angel avatars, rewritten fate, infinite effects, fake resources or new stolen abilities', () => {
    const s = prepared(); apply(s, dose(s));
    for (const type of ['CREATE_AVATAR', 'SWAP_FATE', 'REVERSE_PRIMARY', 'SOURCE_CASTLE_REVIVAL', 'REFILL_FUEL', 'GRANT_POWER', 'HOLD_FOREVER']) expect(validateDeceitMentorCommand({ type })).toBe(false);
    expect(Object.keys(s.deceitMentor).sort()).toEqual(['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'parasiteActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter'].sort());
    expect(s.parasite.encounter.borrowed).toEqual([]);
  });
});
