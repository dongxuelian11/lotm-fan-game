import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applyHunterCommand } from '../../src/domain/hunter/index.js';
import { applyProvokerCommand, validateProvokerState } from '../../src/domain/provoker/index.js';
import { applyProvokerAdventure, provokerAdventureActions, settleProvokerEncounter, validateProvokerAdventure } from '../../src/domain/provoker/adventure.js';
import { PROVOKER_CASE_IDS, type ProvokerCommand } from '../../src/domain/provoker/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyPyromaniacCommand, projectPyromaniac } from '../../src/domain/pyromaniac/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

// Synthetic bounded rule tests, not native play or replacements for frozen historical captures.
function context(s: SliceState) {
  const calls: string[] = [], notes: { title: string; text: string }[] = [];
  const ctx: SeerContext = {
    roll(min) { calls.push('roll'); return min; },
    check(ability, difficulty) { calls.push('check'); return resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: 1 }); },
    note(title, text) { notes.push({ title, text }); },
  };
  return { ctx, calls, notes };
}
function apply(s: SliceState, command: ProvokerCommand) {
  const c = context(s);
  applyProvokerAdventure(s, command, c.ctx, source => { c.calls.push('award'); s.seer.completedSources.push(source); });
  return c;
}
function ready(completed = 3, outcome: 'RETREATED' | 'RESOLVED' = 'RETREATED') {
  const s = createSliceRun('provoker-reflection-rule-test', sliceDefaultCreationSelection, 'provoker-reflection-rule-test');
  s.activeEvent = null; s.eventQueue = []; s.week = 5; s.cash = 10000; s.actionsRemaining = 40;
  const ctx = context(s).ctx;
  applyHunterCommand(s, { type: 'DISCOVER' }, ctx);
  applyHunterCommand(s, { type: 'LEARN_GUIDANCE' }, ctx);
  applyHunterCommand(s, { type: 'BUY_POTION', bottleId: s.hunter.bottles[0]!.id }, ctx);
  applyHunterCommand(s, { type: 'CONSUME', bottleId: s.hunter.bottles[0]!.id, confirmed: true }, ctx);
  s.week = 11; s.progression.acting = 100;
  applyProvokerCommand(s, { type: 'LEARN_GUIDANCE' }, ctx);
  applyProvokerCommand(s, { type: 'BUY_POTION', bottleId: s.provoker.bottles[0]!.id }, ctx);
  applyProvokerCommand(s, { type: 'CONSUME', bottleId: s.provoker.bottles[0]!.id, confirmed: true }, ctx);
  for (const caseId of PROVOKER_CASE_IDS.slice(0, completed)) {
    apply(s, { type: 'OBSERVE', caseId });
    apply(s, { type: 'CHOOSE', caseId, choice: caseId === 'yard-hound' ? 'WAIT' : 'DEESCALATE' });
  }
  if (outcome === 'RESOLVED') apply(s, { type: 'ENCOUNTER_TALK' });
  else {
    apply(s, { type: 'ENCOUNTER_FIGHT' });
    settleProvokerEncounter(s, 'RETREATED', ctx, () => { throw Error('No effective combat move was recorded'); });
  }
  return s;
}
function rejected(s: SliceState) {
  const before = structuredClone(s);
  expect(() => apply(s, { type: 'REFLECT' })).toThrow();
  expect(s).toEqual(before);
  expect(provokerAdventureActions(s).find(a => a.command.type === 'REFLECT')?.enabled ?? false).toBe(false);
}

describe('bounded provoker reflection after actual encounter withdrawal', () => {
  it.each([60, 80, 99, 100])('grants capped40 once from acting%i without RNG, mastery or ownership changes', acting => {
    const s = ready(); s.progression.acting = acting;
    expect(validateProvokerAdventure(s)).toBe(true); expect(validateProvokerState(s)).toBe(true);
    const before = structuredClone(s), action = provokerAdventureActions(s).find(a => a.command.type === 'REFLECT')!;
    expect(action.enabled).toBe(true); expect(action.cost).toContain('+40'); expect(action.label).toContain('真实撤离');
    const result = apply(s, action.command), expected = structuredClone(before);
    expected.actionsRemaining--; expected.progression.acting = Math.min(100, acting + 40);
    expected.provoker.reflected = true; expected.seer.completedSources.push('provoker-reflection');
    expect(s).toEqual(expected); expect(result.calls).toEqual([]);
    expect(result.notes[0]!.text).toContain('货栈争议仍未解决');
    expect(validateProvokerAdventure(s)).toBe(true); expect(validateProvokerState(s)).toBe(true);
    rejected(s);
    expect(() => apply(s, { type: 'ENCOUNTER_FIGHT' })).toThrow(/已经结算/);
    expect(() => apply(s, { type: 'ENCOUNTER_TALK' })).toThrow(/已经结算/);
    expect(provokerAdventureActions(s).some(a => a.command.type === 'REFLECT')).toBe(false);
  });
  it('requires all three cases and rejects mismatched completion/reflection markers', () => {
    const s = ready(2); rejected(s);
    s.provoker.reflected = true; s.seer.completedSources.push('provoker-reflection');
    expect(validateProvokerAdventure(s)).toBe(false);
    const complete = ready(); complete.provoker.reflected = true;
    expect(validateProvokerAdventure(complete)).toBe(false);
    complete.provoker.reflected = false; complete.seer.completedSources.push('provoker-reflection');
    expect(validateProvokerAdventure(complete)).toBe(false);
  });
  it.each(['AVAILABLE', 'FIGHTING', 'LOST'] as const)('does not enable withdrawal reflection for %s', status => {
    const s = ready(); s.provoker.encounter.status = status; rejected(s);
    s.provoker.reflected = true; s.seer.completedSources.push('provoker-reflection');
    expect(validateProvokerAdventure(s)).toBe(false);
  });
  it.each(['dead', 'health', 'mind', 'actions', 'event', 'combat', 'ordinary', 'later-stage', 'other-pathway', 'city'] as const)('retains the common %s gate', gate => {
    const s = ready();
    if (gate === 'dead') s.status = 'DEAD';
    if (gate === 'health') s.health = 0;
    if (gate === 'mind') s.mind = 0;
    if (gate === 'actions') s.actionsRemaining = 0;
    if (gate === 'event') s.activeEvent = { id: 'test-blocker' } as SliceState['activeEvent'];
    if (gate === 'combat') s.combat = { round: 1 } as SliceState['combat'];
    if (gate === 'ordinary') s.progression.pathwayId = null;
    if (gate === 'later-stage') s.progression.sequence = 7;
    if (gate === 'other-pathway') s.progression.pathwayId = 'audience';
    if (gate === 'city') s.world.city = 'TINGEN';
    rejected(s);
  });
  it('leaves the original resolved +20 projection and note exactly unchanged', () => {
    const s = ready(3, 'RESOLVED'); expect(s.progression.acting).toBe(80);
    expect(provokerAdventureActions(s).find(a => a.command.type === 'REFLECT')).toEqual({ id: 'provoker-reflect', label: '整理激怒与克制的界限', cost: '1行动 · 三实践与争议解决后 · 扮演+20仅一次', command: { type: 'REFLECT' }, enabled: true, reason: null });
    const before = structuredClone(s), c = apply(s, { type: 'REFLECT' });
    const expected = structuredClone(before); expected.actionsRemaining--; expected.progression.acting = 100;
    expected.provoker.reflected = true; expected.seer.completedSources.push('provoker-reflection');
    expect(s).toEqual(expected); expect(c.calls).toEqual([]);
    expect(c.notes).toEqual([{ title: '激怒不等于支配', text: '你整理三段亲见经历和货栈结果：针对性反应依赖实际了解，也会带来敌意；克制或退出同样需要判断。扮演+20，没有追加掌握或抹去旧失败。' }]);
    expect(validateProvokerAdventure(s)).toBe(true);
  });
  it('removes only the acting barrier while retaining the next potion maturity gate', () => {
    const s = ready(), ctx = context(s).ctx;
    applyPyromaniacCommand(s, { type: 'LEARN_GUIDANCE' }, ctx);
    const bottleId = s.pyromaniac.bottles[0]!.id;
    applyPyromaniacCommand(s, { type: 'BUY_POTION', bottleId }, ctx);
    expect(projectPyromaniac(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('扮演60/100');
    apply(s, { type: 'REFLECT' });
    const blocked = projectPyromaniac(s).actions.find(a => a.command.type === 'CONSUME')!;
    expect(blocked.enabled).toBe(false); expect(blocked.reason).not.toContain('扮演');
    s.week += 8;
    expect(projectPyromaniac(s).actions.find(a => a.command.type === 'CONSUME')!.enabled).toBe(true);
  });
  it('charges the normal last-action week settlement and keeps input/retreat/cargo/history intact', () => {
    const s = ready(); s.actionsRemaining = 1; s.weeklyBudget = 3; s.arc.stage = 'ENDED';
    const before = structuredClone(s), next = applySliceIntent(s, { type: 'PROVOKER', command: { type: 'REFLECT' } });
    expect(s).toEqual(before);
    expect(applySliceIntent(s, { type: 'PROVOKER', command: { type: 'REFLECT' } })).toEqual(next);
    expect(next.week).toBe(s.week + 1); expect(next.actionsRemaining).toBeGreaterThan(0);
    expect(next.cash).toBeLessThan(s.cash); expect(next.progression.acting).toBe(100);
    expect(next.provoker.encounter).toEqual(s.provoker.encounter);
    expect(next.hunter).toEqual(s.hunter); expect(next.combatHistory).toEqual(s.combatHistory);
    expect(next.progression.mastery).toEqual(s.progression.mastery);
    expect(next.chronicle.some(r => (r.title + r.text).includes('生活费'))).toBe(true);
    expect(projectSliceState(next).provoker.actions.some(a => a.command.type === 'REFLECT')).toBe(false);
    expect(() => applySliceIntent(next, { type: 'PROVOKER', command: { type: 'REFLECT' } })).toThrow();
  });
});
