import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { facelessActions } from '../../src/domain/faceless/practice.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
const cases = [['stage-double','perception'],['familiar-manner','knowledge'],['remember-self','will']] as const;
function fixture() {
  const s = createSliceRun('faceless-feedback-unit', sliceDefaultCreationSelection, 'preview');
  s.progression.pathwayId = 'diviner'; s.progression.sequence = 6;
  for (const [id] of cases) { s.faceless.cases[id].status = 'PREPARED'; s.faceless.cases[id].method = 'ABILITY'; }
  return s;
}
describe('current S6 authoritative faceless chance previews', () => {
  for (const method of ['ABILITY','ORDINARY'] as const) it.each([0,15,500])(`${method} clamps true odds at stat %i without mutation`, value => {
    const s = fixture(); s.character.coreStats = {will:value,perception:value,physique:value,knowledge:value};
    for (const [id] of cases) s.faceless.cases[id].method = method;
    const before = structuredClone(s), actions = facelessActions(s), difficulty = method === 'ABILITY' ? 10 : 12;
    const chance = computeCheckChance({baseAbility:value,difficulty,modifiers:[]});
    for (const [id] of cases) expect(actions.find(a => a.id === `${id}-perform`)?.cost).toContain(`难度${difficulty} · 成功率${chance}%`);
    expect(actions.find(a => a.command.type === 'ENCOUNTER_TALK')?.cost).toContain(`意志难度16 · 成功率${computeCheckChance({baseAbility:value,difficulty:16,modifiers:[]})}%`);
    expect(s).toEqual(before);
  });
  it.each(['ABILITY','ORDINARY'] as const)('uses correct stat for each %s case', method => {
    const s = fixture(); s.character.coreStats = {will:20,perception:30,physique:40,knowledge:10};
    for (const [id] of cases) s.faceless.cases[id].method = method;
    const actions = facelessActions(s);
    for (const [id,stat] of cases) {
      const expectedStat = method === 'ABILITY' ? stat : 'knowledge', difficulty = method === 'ABILITY' ? 10 : 12;
      expect(actions.find(a => a.id === `${id}-perform`)?.cost).toContain(`成功率${computeCheckChance({baseAbility:s.character.coreStats[expectedStat],difficulty,modifiers:[]})}%`);
    }
  });
  it('does not add probabilities to deterministic actions or combat', () => {
    const s = fixture(); const actions = facelessActions(s);
    const other = actions.filter(a => a.command.type !== 'PERFORM' && a.command.type !== 'ENCOUNTER_TALK');
    expect(other.length).toBeGreaterThan(0);
    for (const action of other) expect(action.cost).not.toContain('成功率');
    for (const [id] of cases) s.faceless.cases[id].status = 'OBSERVED';
    for (const action of facelessActions(s).filter(a => a.command.type === 'PREPARE')) expect(action.cost).not.toContain('成功率');
  });
  it('does not guess a method for malformed prepared data', () => {
    const s = fixture(); s.faceless.cases['stage-double'].method = null;
    expect(facelessActions(s).find(a => a.id === 'stage-double-perform')?.cost).not.toContain('成功率');
  });
  it.each([5,4,3,2])('does not change inherited S%i action presentation', sequence => {
    const s = fixture(); s.progression.sequence = sequence;
    for (const action of facelessActions(s)) expect(action.cost).not.toContain('成功率');
  });
});
