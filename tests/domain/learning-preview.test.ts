import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { learnTargets } from '../../src/domain/slice/events.js';
import { learningKnowledge } from '../../src/domain/slice/learning.js';
import { learningTargetDescription } from '../../src/renderer/learning-preview.js';
const displayedTargets = (state: Parameters<typeof learnTargets>[0]) => learnTargets(state).map(target => ({...target, description: learningTargetDescription(state, target)}));
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

// Synthetic boundary fixtures only; no captured playthrough or player save is read or changed.
function fixture(knowledge = 15, bonus = 0) {
  const state = createSliceRun('synthetic-learning-preview', sliceDefaultCreationSelection, 'learning-preview');
  state.character.coreStats.knowledge = knowledge;
  state.character.learningBonus = bonus;
  return state;
}

describe('learning knowledge preview shares the existing capped settlement calculation', () => {
  it.each([[19, 0, 20], [20, 0, 20], [22, 0, 22], [15, 2, 18], [19, 3, 20]] as const)
    ('ordinary knowledge %s with bonus %s previews %s without mutation', (before, bonus, after) => {
      const state = fixture(before, bonus), original = structuredClone(state);
      expect(learningKnowledge(state, 'learn.bookkeeping')).toEqual({ before, after, cap: 20, difficulty: 12 });
      expect(state).toEqual(original);
    });
  it.each([[29, 0, 30], [31, 2, 31]] as const)('paragon knowledge %s preserves its 30 cap without shrinking', (before, bonus, after) => {
    const state = fixture(before, bonus); state.progression.pathwayId = 'paragon';
    const original = structuredClone(state);
    expect(learningKnowledge(state, 'learn.bookkeeping')).toEqual({ before, after, cap: 30, difficulty: 10 });
    expect(state).toEqual(original);
  });
  it('applies the existing extra two points only to seer notes and uses difficulty 9', () => {
    const state = fixture(12, 1); state.progression.pathwayId = 'diviner';
    expect(learningKnowledge(state, 'learn.bookkeeping')).toEqual({ before: 12, after: 14, cap: 20, difficulty: 12 });
    expect(learningKnowledge(state, 'learn.seer-notes')).toEqual({ before: 12, after: 16, cap: 20, difficulty: 9 });
    state.character.coreStats.knowledge = 19;
    expect(learningKnowledge(state, 'learn.seer-notes').after).toBe(20);
    state.character.coreStats.knowledge = 22;
    expect(learningKnowledge(state, 'learn.seer-notes').after).toBe(22);
  });
  it('keeps historical public learning descriptions unchanged while formatting the current menu', () => {
    const state = fixture(22, 2), publicTargets = learnTargets(state);
    expect(publicTargets[0]!.description).toBe('阅读手边的普通记账材料。知识难度12；成功知识+1及学历加值，普通知识上限20。');
    const original = JSON.stringify(projectSliceState(state));
    expect(learningTargetDescription(state, publicTargets[0]!)).toContain('成功也不增加知识');
    expect(JSON.stringify(projectSliceState(state))).toBe(original);
    const unknown = { id: 'future-topic', label: '其它主题', description: '保留未识别主题原说明。' };
    expect(learningTargetDescription(state, unknown)).toBe(unknown.description);
  });
  it('filters completed topics while preserving topic identity and renders current exact previews without mutation', () => {
    const state = fixture(19, 2); state.progression.pathwayId = 'diviner';
    state.completedTopics = ['learn.safety'];
    const original = structuredClone(state), targets = displayedTargets(state);
    expect(targets.map(t => t.id)).toEqual(['learn.bookkeeping', 'learn.profession', 'learn.seer-notes']);
    expect(targets.map(t => t.label)).toEqual(['日用记账常识', '本职已知工作说明', '整理已学占卜笔记']);
    for (const target of targets) expect(target.description).toContain('19→20');
    expect(targets.find(t => t.id === 'learn.bookkeeping')!.description).toContain('普通记账材料');
    expect(targets.find(t => t.id === 'learn.profession')!.description).toContain('不改变职业资格');
    expect(targets.find(t => t.id === 'learn.seer-notes')!.description).toContain('掌握');
    expect(state).toEqual(original);
  });
  it.each([20, 22])('displayed ordinary descriptions disclose no growth at knowledge %s', before => {
    const state = fixture(before, 2);
    for (const target of displayedTargets(state)) {
      expect(target.description).toContain(`当前知识${before}`);
      expect(target.description).toContain("学习上限20");
      expect(target.description).toMatch(/不再增长|不增长|无增长|不增加|不再增加|不提升/);
      expect(target.description).not.toContain('成功知识+1');
    }
  });
  it('shows paragon mastery independently from capped knowledge without promising a chosen ability', () => {
    const state = fixture(31, 2); state.progression.pathwayId = 'paragon';
    for (const target of displayedTargets(state)) {
      expect(target.description).toContain('当前知识31'); expect(target.description).toContain('学习上限30'); expect(target.description).toContain('掌握');
      expect(target.description).not.toMatch(/选择.*能力|指定.*能力/);
    }
  });
  it.each([19, 20, 22])('actual ordinary successful settlement matches the preview at knowledge %s', knowledge => {
    let state = fixture(knowledge, 0);
    state = applySliceIntent(state, { type: 'EVENT_CHOICE', eventInstanceId: projectSliceState(state).activeEvent!.instanceId, choiceId: '.decline' });
    // Pick a great-success RNG input for a synthetic unit boundary, never a live game outcome.
    let seeded = false;
    for (let i = 0; i < 10000; i++) {
      const seed = `synthetic-learning-success-${i}`;
      if (new DeterministicActionRandomStream(seed).nextInt(1, 100) <= 5) { state.random = { seed, cursor: 0 }; seeded = true; break; }
    }
    expect(seeded).toBe(true);
    const before = structuredClone(state), expected = learningKnowledge(state, 'learn.bookkeeping');
    const after = applySliceIntent(state, { type: 'ACTION', action: 'LEARN', targetId: 'learn.bookkeeping' });
    expect(after.lastCheck?.tier).toBe('GREAT_SUCCESS');
    expect(after.character.coreStats.knowledge).toBe(expected.after);
    expect(after.actionsRemaining).toBe(before.actionsRemaining - 1);
    expect(after.completedTopics).toContain('learn.bookkeeping');
    expect(learnTargets(after).some(t => t.id === 'learn.bookkeeping')).toBe(false);
    expect(state).toEqual(before); assertValidSliceState(after);
  });
});
