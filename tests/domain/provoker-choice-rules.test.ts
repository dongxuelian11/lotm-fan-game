import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { applyProvokerAdventure, provokerAdventureActions } from '../../src/domain/provoker/adventure.js';
import type { ProvokerChoice } from '../../src/domain/provoker/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { PROVOKER_CHOICE_RULES, PROVOKER_CHOICE_SUCCESS } from '../../src/shared/provoker-choice-rules.js';

const rows = [
  ['CHALLENGE', 'invoice-claim', 'will', 14, 2, 4, 5],
  ['DEESCALATE', 'queue-boast', 'knowledge', 12, 0, 0, 0],
  ['ATTRACT', 'yard-hound', 'perception', 12, 2, 0, 5],
  ['WAIT', 'yard-hound', 'perception', 14, 0, 0, 0],
] as const;
function ready(caseId: string) {
  // Controlled isolated rule input, never a native save or historical fixture.
  const s = createSliceRun('choice-rule-test', sliceDefaultCreationSelection, 'choice-rule-test');
  s.activeEvent = null; s.combat = null; s.world.city = 'BACKLUND';
  s.progression.pathwayId = 'hunter'; s.progression.sequence = 8; s.progression.acting = 0;
  s.actionsRemaining = 3; s.spirituality = 10; s.health = 80; s.mind = 80;
  s.provoker.cases[caseId] = { status: 'OBSERVED', attemptWeek: null, choice: null };
  return s;
}
describe('unchanged public provoker choice constants', () => {
  it('covers exactly the existing choice union and fixed values', () => {
    expectTypeOf<keyof typeof PROVOKER_CHOICE_RULES>().toEqualTypeOf<ProvokerChoice>();
    expect(Object.keys(PROVOKER_CHOICE_RULES)).toEqual(rows.map(row => row[0]));
    for (const [choice, , attribute, difficulty, spirituality, failureHealth, failureMind] of rows) {
      expect(PROVOKER_CHOICE_RULES[choice]).toEqual({ attribute, difficulty, spirituality, failureHealth, failureMind });
    }
    expect(PROVOKER_CHOICE_SUCCESS).toEqual({ acting: 20, mastery: 8 });
  });
  for (const [choice, caseId, attribute, difficulty, cost, hpLoss, mindLoss] of rows) {
    for (const success of [true, false]) it(`${choice} ${success ? 'success' : 'failure'} preserves order, costs and outcomes`, () => {
      const s = ready(caseId), calls: string[] = [];
      const command = { type: 'CHOOSE' as const, caseId, choice };
      const before = structuredClone(s);
      const ctx: SeerContext = {
        roll: vi.fn(() => { throw Error('Unexpected extra RNG'); }),
        check(stat, diff) {
          calls.push('check'); expect([stat, diff]).toEqual([attribute, difficulty]);
          expect(s.actionsRemaining).toBe(2); expect(s.spirituality).toBe(10 - cost);
          expect(s.provoker.cases[caseId]).toEqual({ status: 'OBSERVED', attemptWeek: s.week, choice });
          return resolveNormalCheck({ ability: stat, baseAbility: 20, difficulty: diff, modifiers: [], roll: success ? 1 : 100 });
        },
        note(_title, text) {
          calls.push('note');
          expect(s.health).toBe(80 - (success ? 0 : hpLoss)); expect(s.mind).toBe(80 - (success ? 0 : mindLoss));
          expect(text).toContain(success ? '扮演+20' : choice === 'CHALLENGE' ? '健康−4、精神−5' : choice === 'ATTRACT' ? '精神−5' : '普通协商暂未奏效');
        },
      };
      const award = vi.fn((source: string, amount: number) => {
        calls.push('award'); expect([source, amount]).toEqual([`provoker-case:${caseId}`, 8]);
        expect(s.progression.acting).toBe(20); expect(s.provoker.cases[caseId]?.status).toBe('COMPLETED');
      });
      applyProvokerAdventure(s, command, ctx, award);
      expect(calls).toEqual(success ? ['check', 'award', 'note'] : ['check', 'note']);
      expect(s.progression.acting).toBe(success ? 20 : 0);
      expect(s.progression.mastery).toEqual(before.progression.mastery);
      expect(ctx.roll).not.toHaveBeenCalled();
      const after = structuredClone(s);
      expect(() => applyProvokerAdventure(s, command, ctx, award)).toThrow(success ? '不重复发奖' : '本周已经试过');
      expect(s).toEqual(after);
    });
    it(`${choice} retains original action cost and resource gate`, () => {
      const s = ready(caseId); s.spirituality = 1;
      const a = provokerAdventureActions(s).find(a => a.command.type === 'CHOOSE' && a.command.caseId === caseId && a.command.choice === choice)!;
      expect(a.cost).toBe(cost ? '1行动 · 2灵性 · 可能被拒绝；人的冲突可能导致推搡受伤' : '1行动 · 0灵性 · 沿真实普通方法解决，不保证成功');
      expect(a.enabled).toBe(!cost); expect(a.reason).toBe(cost ? '这次能力实践需要2灵性。' : null);
    });
  }
});
