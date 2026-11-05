import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { magicianActions } from '../../src/domain/magician/practice.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
const lessons = [
  ['lamplit-step', 'perception'], ['air-target', 'perception'],
  ['consenting-audience', 'will'], ['shallow-water', 'will'],
  ['loose-rope', 'physique'], ['paper-weapon', 'physique'],
] as const;
function fixture() {
  const s = createSliceRun('magician-feedback-unit', sliceDefaultCreationSelection, 'preview');
  s.progression.pathwayId = 'diviner'; s.progression.sequence = 7;
  return s;
}
describe('current magician public probability previews', () => {
  it.each([0, 15, 500])('uses authoritative clamped probabilities at stat %i without mutation', value => {
    const s = fixture();
    s.character.coreStats = { will:value, perception:value, physique:value, knowledge:value };
    const before = structuredClone(s), actions = magicianActions(s);
    const chance = computeCheckChance({baseAbility:value,difficulty:14,modifiers:[]});
    for (const [id] of lessons) expect(actions.find(a => a.id === `magician-practice-${id}`)?.cost).toContain(`成功率${chance}%`);
    expect(actions.find(a => a.command.type === 'ENCOUNTER_TALK')?.cost).toContain(`成功率${chance}%`);
    expect(s).toEqual(before);
  });
  it('uses the lesson-specific public stat', () => {
    const s = fixture(); s.character.coreStats = {will:10,perception:20,physique:30,knowledge:40};
    const actions = magicianActions(s);
    for (const [id,stat] of lessons) expect(actions.find(a => a.id === `magician-practice-${id}`)?.cost)
      .toContain(`成功率${computeCheckChance({baseAbility:s.character.coreStats[stat],difficulty:14,modifiers:[]})}%`);
  });
  it('does not invent odds for deterministic actions or combat', () => {
    const actions = magicianActions(fixture());
    const deterministic = actions.filter(a => a.command.type !== 'PRACTICE' && a.command.type !== 'ENCOUNTER_TALK');
    expect(deterministic.length).toBeGreaterThan(0);
    for (const action of deterministic) expect(action.cost).not.toContain('成功率');
  });
  it.each([6, 5, 4, 3, 2])('keeps inherited sequence %i action text outside this display change', sequence => {
    const s = fixture(); s.progression.sequence = sequence;
    for (const action of magicianActions(s)) expect(action.cost).not.toContain('成功率');
  });
});
