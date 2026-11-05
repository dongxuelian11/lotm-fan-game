import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { applyClownAdventure, clownAdventureActions } from '../../src/domain/clown/adventure.js';
import type { ClownCommand } from '../../src/domain/clown/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';

// Synthetic unit boundary, never a player save or natural playthrough claim.
const lessons = [
  ['quiet-support', 'will', 0], ['unexpected-stage', 'perception', 1],
  ['balance-rehearsal', 'perception', 2], ['paper-target', 'physique', 1],
  ['composed-apology', 'will', 0],
] as const;
function fixture() {
  const s = createSliceRun('clown-feedback-unit', sliceDefaultCreationSelection, 'feedback');
  s.activeEvent = null; s.eventQueue = []; s.actionsRemaining = 3;
  s.world.city = 'BACKLUND'; s.progression.pathwayId = 'diviner'; s.progression.sequence = 8;
  s.clown.paperSheets = 2; s.spirituality = 20;
  return s;
}
describe('clown public check feedback', () => {
  it.each([0, 15, 500])('previews actual normal-check odds at ability %i without drawing randomness', value => {
    const s = fixture();
    s.character.coreStats = { will: value, perception: value, physique: value, knowledge: value };
    const before = structuredClone(s), actions = clownAdventureActions(s);
    for (const [id] of lessons) expect(actions.find(a => a.id === id)?.cost).toContain(`成功率${computeCheckChance({baseAbility:value,difficulty:12,modifiers:[]})}%`);
    expect(actions.find(a => a.command.type === 'RESCUE_TALK')?.cost).toContain(`成功率${computeCheckChance({baseAbility:value,difficulty:14,modifiers:[]})}%`);
    expect(actions.find(a => a.command.type === 'RESCUE_FIGHT')?.cost).not.toContain('成功率');
    expect(s).toEqual(before);
  });
  it('uses each lesson’s actual stat instead of a shared or hard-coded chance', () => {
    const s = fixture();
    s.character.coreStats = {will: 10, perception: 20, physique: 30, knowledge: 40};
    const actions = clownAdventureActions(s);
    for (const [id, stat] of lessons) {
      expect(actions.find(a => a.id === id)?.cost).toContain(`成功率${computeCheckChance({baseAbility:s.character.coreStats[stat],difficulty:12,modifiers:[]})}%`);
    }
  });
  for (const roll of [1, 60, 100]) {
    it.each(lessons)(`preserves roll ${roll} resolution for %s, costs and retry gates`, (id, stat, cost) => {
      const s = fixture(), before = structuredClone(s), award = vi.fn(), note = vi.fn();
      const result = resolveNormalCheck({ability:stat,baseAbility:s.character.coreStats[stat],difficulty:12,modifiers:[],roll});
      const check = vi.fn(() => result), rng = vi.fn();
      applyClownAdventure(s, {type:'PRACTICE',practiceId:id}, {check,note,roll:rng}, award);
      expect(check).toHaveBeenCalledExactlyOnceWith(stat, 12); expect(rng).not.toHaveBeenCalled();
      expect(note.mock.calls[0]?.[1]).not.toContain('骰点');
      expect(s.actionsRemaining).toBe(before.actionsRemaining - 1);
      expect(s.spirituality).toBe(before.spirituality - cost);
      expect(s.clown.paperSheets).toBe(before.clown.paperSheets - (id === 'paper-target' ? 1 : 0));
      expect(s.random).toEqual(before.random);
      const success = result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS';
      expect(award).toHaveBeenCalledTimes(success ? 1 : 0);
      if (success) expect(clownAdventureActions(s).find(a => a.id === id)).toBeUndefined();
      else expect(clownAdventureActions(s).find(a => a.id === id)).toMatchObject({enabled:false,reason:'本周已经尝试过，下周再练。'});
    });
    it.each(['reflection', 'talk'])(`preserves roll ${roll} for %s without fabricating history`, kind => {
      const s = fixture(), note = vi.fn();
      s.clown.practices = lessons.map(x => x[0]);
      s.clown.rescue.status = kind === 'reflection' ? 'RETREATED' : 'AVAILABLE';
      const command: ClownCommand = kind === 'reflection' ? {type:'PRACTICE',practiceId:'retreat-reflection'} : {type:'RESCUE_TALK'};
      const difficulty = kind === 'reflection' ? 12 : 14;
      const result = resolveNormalCheck({ability:'will',baseAbility:s.character.coreStats.will,difficulty,modifiers:[],roll});
      expect(clownAdventureActions(s).find(a => a.command.type === command.type)?.cost).toContain(`成功率${result.chance}%`);
      applyClownAdventure(s,command,{check:()=>result,note,roll:vi.fn()},vi.fn());
      expect(note).toHaveBeenCalledTimes(1);
      expect(note.mock.calls[0]?.[1]).not.toContain('骰点');
    });
  }
});
