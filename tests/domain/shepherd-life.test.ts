import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { applyRoseBishopActivity } from '../../src/domain/rose-bishop/life.js';
import { applyShepherdCommand, createShepherdState, freshShepherdPractice, validateShepherdCommand, validateShepherdState } from '../../src/domain/shepherd/index.js';
import { activateShepherdSpirit, applyShepherdActivity, isShepherdActivity, projectShepherdLife, shepherdActions, shepherdCases, shepherdGrazing, shepherdInside, shepherdPractice, validateShepherdLife } from '../../src/domain/shepherd/life.js';
import { SHEPHERD_SPIRITS } from '../../src/domain/shepherd/content.js';
import { SHEPHERD_ABILITY_IDS, SHEPHERD_CASE_IDS, type ShepherdActivityCommand, type ShepherdCaseId, type ShepherdCommand, type ShepherdRationCommand } from '../../src/domain/shepherd/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

const IRIS = 'SH5-IRIS-1', CEDRIC = 'SH5-CEDRIC-1';
/** Directed domain checks are distinct from the saved natural replay and do not claim natural dice. */
function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source); s.progression.mastery[SHEPHERD_ABILITY_IDS[0]]! += amount;
  });
  return { ctx, award };
}
function roseBishop(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/rose-bishop-v0880/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous); s.shepherd = createShepherdState();
  const week = Math.max(s.week, s.roseBishop.promotionWeek! + 12);
  s.date = addGameWeeks(s.date, week - s.week); s.week = week;
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.spirituality = 50; s.seer.pollution = 0; s.character.coreStats.will = 26; s.character.coreStats.knowledge = 26;
  return s;
}
function promoted(): SliceState {
  const s = roseBishop(), { ctx } = context(s);
  applyShepherdCommand(s, { type: 'LEARN_GUIDANCE' }, ctx);
  applyShepherdCommand(s, { type: 'BUY_POTION', bottleId: s.shepherd.bottles[0]!.id }, ctx);
  applyShepherdCommand(s, { type: 'CONSUME', bottleId: s.shepherd.bottles[0]!.id, confirmed: true }, ctx);
  return s;
}
function nextWeek(s: SliceState) { s.week += 1; s.date = addGameWeeks(s.date, 1); }
function act(s: SliceState, command: ShepherdActivityCommand, roll = 1) { const c = context(s, roll); applyShepherdActivity(s, command, c.ctx, c.award); return c; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyShepherdActivity(s, command as ShepherdActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function graze(s: SliceState, spiritId: string, abilityIds?: string[]) {
  if (!s.shepherd.grazing.met) act(s, { type: 'MEET_SPIRITS' });
  return act(s, { type: 'GRAZE', spiritId, abilityIds: abilityIds ?? SHEPHERD_SPIRITS.find(source => source.id === spiritId)!.knownAbilities.map(ability => ability.id) });
}
function choose(s: SliceState, spiritId: string | null) { return act(s, { type: 'ACTIVATE_SPIRIT', spiritId }); }
function begin(s: SliceState, caseId: ShepherdCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  if (s.shepherd.cases[caseId]!.status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: ShepherdCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); act(s, { type: 'PERFORM', caseId }); act(s, { type: 'CLOSE', caseId });
  return act(s, { type: 'REPORT', caseId });
}
function reach(s: SliceState, caseId: ShepherdCaseId) { for (const id of SHEPHERD_CASE_IDS) { if (id === caseId) break; complete(s, id); } }
const messages = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(call => call.join(' ')).join(' ');
const originals = (s: SliceState) => structuredClone([s.secretSupplicant, s.listener, s.shadowAscetic, s.roseBishop, s.world, s.town, s.combatHistory]);

describe('Shepherd actual finite spirits and original paper, voice and account practices', () => {
  it('promotes with no gifted spirits or free ability library and keeps finite sources private until meeting', () => {
    const old = roseBishop();
    expect(shepherdActions(old)).toEqual([]); expect(shepherdCases(old)).toEqual([]); expect(shepherdPractice(old)).toBeNull(); expect(shepherdGrazing(old)).toBeNull(); expect(validateShepherdLife(old)).toBe(true);
    const s = promoted(); expect(originals(s)).toEqual(originals(old)); expect(s.shepherd.practice).toEqual(freshShepherdPractice());
    expect(s.shepherd.grazing).toMatchObject({ met: false, activeSpiritId: null });
    expect(s.shepherd.grazing.spirits).toHaveLength(2);
    expect(s.shepherd.grazing.spirits.every(spirit => spirit.status === 'UNMET' && spirit.selectedAbilities.length === 0)).toBe(true);
    expect(shepherdGrazing(s)).toMatchObject({ capacity: 7, spirits: [] });
    act(s, { type: 'OBSERVE', caseId: 'paper-guidance' });
    const hidden = JSON.stringify(projectShepherdLife(s));
    for (const text of [IRIS, CEDRIC, '伊芮斯', '塞德里克', 'light-touch', 'courage-song']) expect(hidden).not.toContain(text);
    reject(s, { type: 'GRAZE', spiritId: IRIS, abilityIds: ['light-touch'] });
    reject(s, { type: 'ACTIVATE_SPIRIT', spiritId: IRIS });
    const before = [s.actionsRemaining, s.spirituality], mastery = structuredClone(s.progression.mastery);
    const met = act(s, { type: 'MEET_SPIRITS' });
    expect([s.actionsRemaining, s.spirituality]).toEqual([before[0]! - 1, before[1]]);
    expect(met.ctx.check).not.toHaveBeenCalled(); expect(met.award).not.toHaveBeenCalled(); expect(s.progression.mastery).toEqual(mastery);
    expect(s.shepherd.grazing.spirits.every(spirit => spirit.status === 'AVAILABLE' && spirit.acquiredWeek === null)).toBe(true);
    expect(shepherdGrazing(s)!.spirits.map(spirit => spirit.id)).toEqual([IRIS, CEDRIC]);
    expect(shepherdGrazing(s)!.spirits.map(spirit => spirit.knownAbilities.length)).toEqual([3, 1]);
    expect(messages(met)).toContain('故事开始前死亡'); reject(s, { type: 'MEET_SPIRITS' }); expect(validateShepherdState(s)).toBe(true);
  });

  it('grazes only chosen distinct actual source methods; failure costs remain and retries require the next real week', () => {
    const s = promoted(); act(s, { type: 'MEET_SPIRITS' });
    for (const abilityIds of [[], ['light-touch', 'light-touch'], ['courage-song'], ['unknown'], ['light-touch', 'brief-ward', 'blur-mark', 'courage-song']]) reject(s, { type: 'GRAZE', spiritId: IRIS, abilityIds });
    reject(s, { type: 'GRAZE', spiritId: CEDRIC, abilityIds: ['light-touch'] });
    reject(s, { type: 'GRAZE', spiritId: 'SH5-FREE-7', abilityIds: ['light-touch'] });
    const original = originals(s), before = [s.actionsRemaining, s.spirituality], mastery = structuredClone(s.progression.mastery);
    const failed = act(s, { type: 'GRAZE', spiritId: IRIS, abilityIds: ['light-touch'] }, 100);
    expect(failed.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14);
    expect([s.actionsRemaining, s.spirituality]).toEqual([before[0]! - 1, before[1]! - 3]);
    expect(s.shepherd.grazing.spirits[0]).toMatchObject({ status: 'AVAILABLE', attemptWeek: s.week, acquiredWeek: null, selectedAbilities: [] });
    reject(s, { type: 'GRAZE', spiritId: IRIS, abilityIds: ['light-touch'] });
    graze(s, CEDRIC); expect(s.shepherd.grazing.activeSpiritId).toBeNull();
    nextWeek(s); const selected = ['light-touch']; act(s, { type: 'GRAZE', spiritId: IRIS, abilityIds: selected }); selected.push('brief-ward');
    expect(s.shepherd.grazing.spirits[0]).toMatchObject({ status: 'GRAZED', acquiredWeek: s.week, selectedAbilities: ['light-touch'] });
    expect(s.shepherd.grazing.activeSpiritId).toBeNull(); expect(s.progression.mastery).toEqual(mastery); expect(originals(s)).toEqual(original);
    reject(s, { type: 'GRAZE', spiritId: IRIS, abilityIds: ['brief-ward'] }); expect(validateShepherdLife(s)).toBe(true);
  });

  it('switches only one real grazed source without AP, spirituality, time, dice, copied powers or soul movement', () => {
    const s = promoted(); graze(s, IRIS); graze(s, CEDRIC);
    const before = structuredClone(s), c = choose(s, IRIS);
    expect(s.shepherd.grazing.activeSpiritId).toBe(IRIS);
    expect([s.actionsRemaining, s.spirituality, s.week, s.date]).toEqual([before.actionsRemaining, before.spirituality, before.week, before.date]);
    expect(s.shepherd.grazing.spirits).toEqual(before.shepherd.grazing.spirits); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.ctx.roll).not.toHaveBeenCalled();
    expect(choose(s, IRIS).ctx.note).not.toHaveBeenCalled();
    s.actionsRemaining = 0; s.spirituality = 0; choose(s, CEDRIC); expect(s.shepherd.grazing.activeSpiritId).toBe(CEDRIC);
    choose(s, null); expect(s.shepherd.grazing.activeSpiritId).toBeNull(); expect(choose(s, null).ctx.note).not.toHaveBeenCalled();
    expect(s.progression.mastery).toEqual(before.progression.mastery); expect(s.shepherd.grazing.spirits).toEqual(before.shepherd.grazing.spirits);
    expect(validateShepherdLife(s)).toBe(true);
  });

  it('allows immediate original-source round preselection only in the current Shepherd dispute', () => {
    const s = promoted(); graze(s, IRIS); graze(s, CEDRIC); complete(s, 'paper-guidance'); act(s, { type: 'ENCOUNTER_FIGHT' });
    const before = structuredClone(s), c = context(s); activateShepherdSpirit(s, IRIS, c.ctx);
    expect(s.shepherd.grazing.activeSpiritId).toBe(IRIS); expect(s.combat).toEqual(before.combat);
    expect([s.actionsRemaining, s.spirituality, s.week, s.date]).toEqual([before.actionsRemaining, before.spirituality, before.week, before.date]);
    expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.ctx.roll).not.toHaveBeenCalled();
    const noop = context(s); activateShepherdSpirit(s, IRIS, noop.ctx); expect(noop.ctx.note).not.toHaveBeenCalled();
    activateShepherdSpirit(s, CEDRIC, c.ctx); expect(s.shepherd.grazing.activeSpiritId).toBe(CEDRIC);
    activateShepherdSpirit(s, null, c.ctx); expect(s.shepherd.grazing.activeSpiritId).toBeNull();
    reject(s, { type: 'ACTIVATE_SPIRIT', spiritId: IRIS }); reject(s, { type: 'RELEASE_SPIRIT', spiritId: IRIS, confirmed: true });
    s.combat!.encounterId = 'ROSE_BISHOP_DISPUTE';
    expect(() => activateShepherdSpirit(s, IRIS, c.ctx)).toThrow(); expect(s.shepherd.grazing.activeSpiritId).toBeNull();
  });

  it('requires independent release confirmation, preserves selected history and never allows reacquisition', () => {
    const s = promoted(); graze(s, IRIS); graze(s, CEDRIC); choose(s, CEDRIC);
    reject(s, { type: 'RELEASE_SPIRIT', spiritId: CEDRIC }); reject(s, { type: 'RELEASE_SPIRIT', spiritId: CEDRIC, confirmed: false });
    const before = structuredClone(s); s.actionsRemaining = 0;
    const released = act(s, { type: 'RELEASE_SPIRIT', spiritId: CEDRIC, confirmed: true });
    expect(s.shepherd.grazing.spirits[1]).toMatchObject({ status: 'RELEASED', releasedWeek: s.week, selectedAbilities: ['courage-song'] });
    expect(s.shepherd.grazing.activeSpiritId).toBeNull(); expect(s.spirituality).toBe(before.spirituality); expect(released.ctx.check).not.toHaveBeenCalled();
    expect(messages(released)).toContain('不能重新放牧'); expect(released.award).not.toHaveBeenCalled();
    s.actionsRemaining = 100; nextWeek(s);
    reject(s, { type: 'GRAZE', spiritId: CEDRIC, abilityIds: ['courage-song'] }); reject(s, { type: 'ACTIVATE_SPIRIT', spiritId: CEDRIC }); reject(s, { type: 'RELEASE_SPIRIT', spiritId: CEDRIC, confirmed: true });
    expect(shepherdActions(s).filter(action => 'spiritId' in action.command && action.command.spiritId === CEDRIC)).toEqual([]);
    choose(s, IRIS); expect(s.shepherd.grazing.activeSpiritId).toBe(IRIS); expect(validateShepherdState(s)).toBe(true);
  });

  it.each([1, 100])('borrowed paper roll%s moves only the same paper on success and requires physical zero-AP retrieval', roll => {
    const s = promoted(); graze(s, IRIS); choose(s, IRIS); begin(s, 'paper-guidance', 'ABILITY');
    const old = originals(s), spirit = s.spirituality; expect(shepherdInside(s)).toBe(false);
    const performed = act(s, { type: 'PERFORM', caseId: 'paper-guidance' }, roll);
    expect(performed.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14); expect(s.spirituality).toBe(spirit - 2);
    expect(s.shepherd.practice).toMatchObject({ paper: roll === 1 ? 'MARK' : 'TABLE', playerNode: 'DESK' });
    expect(shepherdInside(s)).toBe(true); expect(validateShepherdLife(s)).toBe(true);
    reject(s, { type: 'ACTIVATE_SPIRIT', spiritId: null }); reject(s, { type: 'RELEASE_SPIRIT', spiritId: IRIS, confirmed: true }); reject(s, { type: 'BUY_RATION' }); reject(s, { type: 'REPORT', caseId: 'paper-guidance' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    const closed = act(s, { type: 'CLOSE', caseId: 'paper-guidance' });
    expect(s.shepherd.practice).toEqual(freshShepherdPractice()); expect(shepherdInside(s)).toBe(false);
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]); expect(originals(s)).toEqual(old);
    if (roll === 1) expect(messages(closed)).toContain('亲手取起同一原纸SH5-PAPER-1');
    else expect(messages(closed)).toContain('没有虚构取纸');
    expect(closed.award).not.toHaveBeenCalled(); expect(validateShepherdLife(s)).toBe(true);
  });

  it.each([1, 100])('ordinary paper roll%s keeps actual bodily position even when the paper returns to the table', roll => {
    const s = promoted(); begin(s, 'paper-guidance'); const before = [s.spirituality, s.mind], old = originals(s);
    const performed = act(s, { type: 'PERFORM', caseId: 'paper-guidance' }, roll);
    expect(performed.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect([s.spirituality, s.mind]).toEqual(before);
    expect(s.shepherd.practice).toMatchObject({ paper: roll === 1 ? 'MARK' : 'TABLE', playerNode: 'MARK' });
    if (roll === 100) expect(messages(performed)).toContain('亲手携同一原纸沿原路普通步行两米回原桌');
    expect(validateShepherdLife(s)).toBe(true); const closed = act(s, { type: 'CLOSE', caseId: 'paper-guidance' });
    expect(messages(closed)).toContain('普通步行两米'); expect(s.shepherd.practice).toEqual(freshShepherdPractice()); expect(originals(s)).toEqual(old);
    if (roll === 100) {
      reject(s, { type: 'REPORT', caseId: 'paper-guidance' }); reject(s, { type: 'PREPARE', caseId: 'paper-guidance', method: 'ORDINARY' });
      nextWeek(s); complete(s, 'paper-guidance'); expect(s.shepherd.cases['paper-guidance']!.closes).toBe(2);
    }
    expect(validateShepherdLife(s)).toBe(true);
  });

  it('revalidates the current selected ability at implementation and allows zero-AP cancellation', () => {
    const s = promoted(); graze(s, IRIS, ['brief-ward']); choose(s, IRIS); act(s, { type: 'OBSERVE', caseId: 'paper-guidance' });
    reject(s, { type: 'PREPARE', caseId: 'paper-guidance', method: 'ABILITY' });
    const correct = promoted(); graze(correct, IRIS); graze(correct, CEDRIC); choose(correct, IRIS); begin(correct, 'paper-guidance', 'ABILITY');
    choose(correct, CEDRIC); reject(correct, { type: 'PERFORM', caseId: 'paper-guidance' });
    choose(correct, IRIS); correct.spirituality = 1; reject(correct, { type: 'PERFORM', caseId: 'paper-guidance' });
    correct.actionsRemaining = 0; const cancelled = act(correct, { type: 'WITHDRAW', caseId: 'paper-guidance' });
    expect(cancelled.award).not.toHaveBeenCalled(); expect(correct.spirituality).toBe(1); expect(shepherdInside(correct)).toBe(false);
    expect(correct.shepherd.practice).toEqual(freshShepherdPractice()); expect(validateShepherdLife(correct)).toBe(true);
  });

  it.each([1, 100])('borrowed chorus roll%s is the player actual voice and stops on failure as well as success', roll => {
    const s = promoted(); graze(s, CEDRIC); choose(s, CEDRIC); reach(s, 'willing-chorus'); begin(s, 'willing-chorus', 'ABILITY');
    const old = originals(s), spirit = s.spirituality, performed = act(s, { type: 'PERFORM', caseId: 'willing-chorus' }, roll);
    expect(performed.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14); expect(s.spirituality).toBe(spirit - 2);
    expect(s.shepherd.practice.chorusOpen).toBe(true); expect(s.shepherd.cases['willing-chorus']!.outcome).toBe(roll === 1 ? 'CHORUS_CHECKED' : 'NONE');
    expect(messages(performed)).toContain('你本人已开始唱'); expect(validateShepherdLife(s)).toBe(true);
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    const closed = act(s, { type: 'CLOSE', caseId: 'willing-chorus' }); expect(messages(closed)).toContain('实际停止已开始的歌声');
    expect(s.shepherd.practice.chorusOpen).toBe(false); expect(s.shepherd.grazing.activeSpiritId).toBe(CEDRIC);
    expect(originals(s)).toEqual(old); expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]); expect(validateShepherdLife(s)).toBe(true);
  });

  it('ordinary encouragement uses neither spirits nor singing and provides only public feedback', () => {
    const s = promoted(); reach(s, 'willing-chorus'); s.spirituality = 0; begin(s, 'willing-chorus');
    const performed = act(s, { type: 'PERFORM', caseId: 'willing-chorus' });
    expect(performed.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect(s.spirituality).toBe(0);
    expect(s.shepherd.practice.chorusOpen).toBe(false); expect(s.shepherd.cases['willing-chorus']!.outcome).toBe('TALK_CHECKED'); expect(shepherdInside(s)).toBe(true);
    act(s, { type: 'CLOSE', caseId: 'willing-chorus' }); expect(act(s, { type: 'REPORT', caseId: 'willing-chorus' }).award).not.toHaveBeenCalled();
    expect(validateShepherdLife(s)).toBe(true);
  });

  it.each([1, 100])('ordinary account roll%s writes and hands over the same original, retaining even failed words', roll => {
    const s = promoted(); reach(s, 'limited-account'); begin(s, 'limited-account'); const old = originals(s), before = [s.spirituality, s.cash, s.health];
    const performed = act(s, { type: 'PERFORM', caseId: 'limited-account' }, roll);
    expect(performed.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect(s.shepherd.practice.note).toBe('WRITTEN'); expect(validateShepherdLife(s)).toBe(true);
    s.actionsRemaining = 0; const closed = act(s, { type: 'CLOSE', caseId: 'limited-account' });
    expect(messages(closed)).toContain('同一原说明纸SH5-NOTE-1亲手交给'); expect(s.shepherd.practice.note).toBe('HANDED_OVER');
    expect([s.spirituality, s.cash, s.health]).toEqual(before); expect(originals(s)).toEqual(old); expect(closed.award).not.toHaveBeenCalled(); expect(s.actionsRemaining).toBe(0);
    if (roll === 100) {
      expect(messages(closed)).toContain('失败文字'); expect(shepherdPractice(s)!.history.join(' ')).toContain('失败文字');
      s.actionsRemaining = 100; reject(s, { type: 'REPORT', caseId: 'limited-account' }); nextWeek(s); begin(s, 'limited-account');
      const retried = act(s, { type: 'PERFORM', caseId: 'limited-account' }); expect(messages(retried)).toContain('同一原说明纸SH5-NOTE-1亲手交回');
      act(s, { type: 'CLOSE', caseId: 'limited-account' }); expect(act(s, { type: 'REPORT', caseId: 'limited-account' }).award).not.toHaveBeenCalled();
      expect(s.shepherd.cases['limited-account']!.closes).toBe(2);
    }
    expect(validateShepherdLife(s)).toBe(true);
  });

  it('reaches peaceful acting100 by all ordinary reports with no spirit, new mastery or changed old original', () => {
    const s = promoted(), old = originals(s), mastery = structuredClone(s.progression.mastery); s.spirituality = 0;
    for (const id of SHEPHERD_CASE_IDS) expect(complete(s, id).award).not.toHaveBeenCalled();
    expect(s.progression.acting).toBe(75); expect(act(s, { type: 'REFLECT' }).award).not.toHaveBeenCalled();
    expect(s.progression.acting).toBe(100); expect(s.progression.mastery).toEqual(mastery); expect(originals(s)).toEqual(old);
    expect(s.shepherd.grazing).toEqual(createShepherdState().grazing); expect(s.shepherd.practice).toEqual({ ...freshShepherdPractice(), note: 'HANDED_OVER' });
    expect(s.seer.completedSources.filter(source => source.startsWith('shepherd-'))).toEqual([...SHEPHERD_CASE_IDS.map(id => `shepherd-case:${id}`), 'shepherd-reflection']);
    reject(s, { type: 'REFLECT' }); reject(s, { type: 'REPORT', caseId: 'paper-guidance' }); expect(validateShepherdState(s)).toBe(true);
  });

  it('rewards the two successful real borrowed reports once and preserves them through later permanent release', () => {
    const s = promoted(); graze(s, IRIS); graze(s, CEDRIC); choose(s, IRIS);
    expect(complete(s, 'paper-guidance', 'ABILITY').award).toHaveBeenCalledExactlyOnceWith('shepherd-case:paper-guidance', 8);
    choose(s, CEDRIC); expect(complete(s, 'willing-chorus', 'ABILITY').award).toHaveBeenCalledExactlyOnceWith('shepherd-case:willing-chorus', 8);
    act(s, { type: 'RELEASE_SPIRIT', spiritId: CEDRIC, confirmed: true });
    expect(validateShepherdLife(s)).toBe(true); expect(shepherdPractice(s)!.history.join(' ')).toContain('当时驱使的原塞德里克');
    begin(s, 'limited-account'); act(s, { type: 'WITHDRAW', caseId: 'limited-account' });
    reject(s, { type: 'PREPARE', caseId: 'limited-account', method: 'ABILITY' });
    expect(complete(s, 'limited-account').award).not.toHaveBeenCalled(); act(s, { type: 'REFLECT' });
    expect(validateShepherdState(s)).toBe(true); expect(shepherdActions(s).some(action => action.command.type === 'PREPARE' && action.command.caseId === 'limited-account' && action.command.method === 'ABILITY')).toBe(false);
  });

  it('delegates only the original animal-ration commands with identical packet identity, cost and weekly gates', () => {
    const s = promoted(), oldCases = structuredClone(s.roseBishop.cases), oldPackets = structuredClone(s.roseBishop.reserve.packets);
    const compare = (command: ShepherdRationCommand) => {
      const expected = structuredClone(s), direct = context(expected), actual = context(s);
      applyRoseBishopActivity(expected, command, direct.ctx, direct.award); applyShepherdActivity(s, command, actual.ctx, actual.award);
      expect(s).toEqual(expected); expect(vi.mocked(actual.ctx.check).mock.calls).toEqual(vi.mocked(direct.ctx.check).mock.calls);
    };
    compare({ type: 'BUY_RATION' }); const packet = s.roseBishop.reserve.packets.at(-1)!;
    expect(packet.status).toBe('HELD'); expect(s.roseBishop.reserve.packets.slice(0, oldPackets.length)).toEqual(oldPackets);
    reject(s, { type: 'BUY_RATION' });
    if (s.roseBishop.reserve.points < 3) { compare({ type: 'TAKE_RATION', packetId: packet.id }); reject(s, { type: 'TAKE_RATION', packetId: packet.id }); }
    else reject(s, { type: 'TAKE_RATION', packetId: packet.id });
    reject(s, { type: 'TAKE_RATION', packetId: 'invented-packet' }); reject(s, { type: 'OBSERVE', caseId: 'ring-release' });
    expect(s.roseBishop.cases).toEqual(oldCases); expect(validateShepherdLife(s)).toBe(true);
  });

  it.each(SHEPHERD_CASE_IDS)('%s leaves the public final AP open until actual zero-AP cleanup', caseId => {
    const s = promoted(); reach(s, caseId); begin(s, caseId); s.actionsRemaining = 1;
    const week = s.week, performed = applySliceIntent(s, { type: 'SHEPHERD', command: { type: 'PERFORM', caseId } });
    expect([performed.week, performed.actionsRemaining]).toEqual([week, 0]); expect(shepherdInside(performed)).toBe(true);
    expect(() => applySliceIntent(performed, { type: 'ACTION', action: 'WORK' })).toThrow(); expect(() => applySliceIntent(performed, { type: 'ACTION', action: 'REST' })).toThrow();
    const closed = applySliceIntent(performed, { type: 'SHEPHERD', command: { type: 'CLOSE', caseId } });
    expect(closed.week).toBe(week + 1); expect(shepherdInside(closed)).toBe(false);
    expect(closed.shepherd.practice).toMatchObject({ paper: 'TABLE', chorusOpen: false, playerNode: 'DESK', note: caseId === 'limited-account' ? 'HANDED_OVER' : 'BLANK' });
    expect(validateShepherdLife(closed)).toBe(true);
  });

  it('returns detached actual roster and practice projections without seven invented cards', () => {
    const s = promoted(); graze(s, IRIS); choose(s, IRIS); complete(s, 'paper-guidance', 'ABILITY');
    const grazing = shepherdGrazing(s)!; expect(grazing.spirits).toHaveLength(2); expect(grazing.capacity).toBe(7);
    grazing.spirits[0]!.selectedAbilities.push('invented'); grazing.spirits[0]!.knownAbilities[0]!.description = 'invented';
    const practice = shepherdPractice(s)!, cases = shepherdCases(s); practice.history.push('invented'); cases[0]!.observations.push('invented');
    expect(shepherdGrazing(s)!.spirits[0]!.selectedAbilities).not.toContain('invented'); expect(shepherdGrazing(s)!.spirits[0]!.knownAbilities[0]!.description).not.toBe('invented');
    expect(shepherdPractice(s)!.history).not.toContain('invented'); expect(shepherdCases(s)[0]!.observations).not.toContain('invented');
    expect(new Set(shepherdActions(s).map(action => action.id)).size).toBe(shepherdActions(s).length);
  });

  it('rejects forged commands, extra souls, wrong-source powers, invented physical closure and false report sources', () => {
    expect(isShepherdActivity(null as unknown as ShepherdCommand)).toBe(false); expect(isShepherdActivity({ type: 'LEARN_GUIDANCE' })).toBe(false);
    for (const command of [null, {}, { type: 'MEET_SPIRITS', free: true }, { type: 'GRAZE', spiritId: IRIS, abilityIds: ['light-touch'], free: true }, { type: 'ACTIVATE_SPIRIT', spiritId: [IRIS, CEDRIC] }, { type: 'OBSERVE', caseId: 'invented' }, { type: 'PREPARE', caseId: 'limited-account', method: 'ABILITY' }, { type: 'CLOSE', caseId: 'paper-guidance', teleport: true }, { type: 'REFLECT', refill: true }]) {
      expect(validateShepherdCommand(command)).toBe(false); reject(promoted(), command);
    }
    for (const change of [
      (s: SliceState) => { s.shepherd.practice.paper = 'MARK'; },
      (s: SliceState) => { s.shepherd.practice.playerNode = 'MARK'; },
      (s: SliceState) => { s.shepherd.practice.chorusOpen = true; },
      (s: SliceState) => { s.shepherd.practice.note = 'WRITTEN'; },
    ]) { const s = promoted(); change(s); expect(shepherdInside(s)).toBe(true); expect(validateShepherdLife(s)).toBe(false); }
    for (const change of [
      (s: SliceState) => { s.shepherd.grazing.activeSpiritId = IRIS; },
      (s: SliceState) => { s.shepherd.grazing.spirits.push({ ...s.shepherd.grazing.spirits[0]!, id: 'extra-soul' }); },
      (s: SliceState) => { s.shepherd.grazing.spirits[0]!.selectedAbilities = ['courage-song']; },
      (s: SliceState) => { s.shepherd.grazing.spirits[0]!.selectedAbilities = ['light-touch', 'light-touch']; },
      (s: SliceState) => { s.shepherd.practice.note = 'HANDED_OVER'; },
      (s: SliceState) => { Object.assign(s.shepherd.practice, { sparePaper: 1 }); },
      (s: SliceState) => { Object.assign(s.shepherd, { grazing: null }); },
      (s: SliceState) => { Object.assign(s.shepherd.cases, { 'paper-guidance': null }); },
      (s: SliceState) => { s.seer.completedSources.push('shepherd-case:paper-guidance'); },
      (s: SliceState) => { s.seer.completedSources.push('shepherd-reflection'); },
    ]) { const s = promoted(); change(s); expect(validateShepherdLife(s)).toBe(false); }
    const wrong = promoted(); graze(wrong, IRIS); wrong.shepherd.grazing.spirits[0]!.selectedAbilities.push('courage-song');
    expect(validateShepherdLife(wrong)).toBe(false); expect(() => activateShepherdSpirit(wrong, IRIS, context(wrong).ctx)).toThrow();
    const released = promoted(); graze(released, CEDRIC); act(released, { type: 'RELEASE_SPIRIT', spiritId: CEDRIC, confirmed: true }); released.shepherd.grazing.activeSpiritId = CEDRIC;
    expect(validateShepherdLife(released)).toBe(false);
  });
});
