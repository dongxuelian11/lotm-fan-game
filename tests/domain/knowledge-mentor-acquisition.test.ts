import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import { createKnowledgeMentorState, projectKnowledgeMentor, validateKnowledgeMentorCommand, validateKnowledgeMentorState } from '../../src/domain/knowledge-mentor/index.js';
import { KNOWLEDGE_MENTOR_ABILITY_IDS, KNOWLEDGE_MENTOR_PREPARATION_IDS } from '../../src/domain/knowledge-mentor/types.js';
import { KNOWLEDGE_MENTOR_FORMULA_STATUS, KNOWLEDGE_MENTOR_SOURCE_STATUS } from '../../src/domain/knowledge-mentor/content.js';
import { knowledgeMentorBoundary, knowledgeMentorSnapshot, km, paragonLegacyKeys, rejectKm, unitBudget } from './knowledge-mentor-test-fixture.js';
import type { SliceState } from '../../src/domain/slice/types.js';

function prepared() { return unitBudget(knowledgeMentorBoundary('promotion').beforeLast); }
function consume(s: SliceState, roll: number) {
  const c = knowledgeMentorBoundary('promotion').lastIntent;
  if (c.type !== 'KNOWLEDGE_MENTOR' || c.command.type !== 'CONSUME') throw new Error('Expected real independently confirmed promotion boundary');
  return km(s, c.command, roll);
}
function untaught() {
  const s = knowledgeMentorSnapshot('guidanceStart'); s.cash = 20000; return unitBudget(s);
}

describe('Knowledge Mentor S2 paid acquisition and exact seventeen-plus-two inheritance', () => {
  it('keeps a new run undiscovered with an independent fresh candidate G state', () => {
    const s = createSliceRun('knowledge-mentor-hidden', sliceDefaultCreationSelection, 'knowledge-mentor-hidden'); assertValidSliceState(s);
    expect(s.knowledgeMentor).toEqual(createKnowledgeMentorState());
    expect(projectKnowledgeMentor(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], resources: null, actions: [], abilities: [] });
    rejectKm(s, { type: 'LEARN_GUIDANCE' });
    const other = createKnowledgeMentorState(); other.bottles[0]!.labourSteps = 5;
    expect(s.knowledgeMentor.bottles[0]!.labourSteps).toBe(0);
    expect(KNOWLEDGE_MENTOR_FORMULA_STATUS).toContain('未核实'); expect(KNOWLEDGE_MENTOR_FORMULA_STATUS).toContain('候选G');
    expect(KNOWLEDGE_MENTOR_SOURCE_STATUS).toContain('文明启蒙者1');
  });

  it('migrates legacy schema163 by adding only fresh S2 state, without changing any earlier value', () => {
    const legacy = readObjectEntry<Record<string, unknown>>('tests/fixtures/discerner-v01660/natural.json', 'final');
    expect(legacy.schemaVersion).toBe(163); expect(legacy).not.toHaveProperty('knowledgeMentor');
    const bytes = JSON.stringify(legacy), s = migrateSliceState(legacy); assertValidSliceState(s);
    expect(s.knowledgeMentor).toEqual(createKnowledgeMentorState()); expect(s.schemaVersion).toBe(177); expect(s.contentVersion).toBe('blood-duke-v177');
    for (const [key, value] of Object.entries(legacy)) if (!['schemaVersion', 'contentVersion'].includes(key)) expect((s as unknown as Record<string, unknown>)[key], key).toEqual(value);
    expect(JSON.stringify(legacy)).toBe(bytes);
    expect(() => migrateSliceState({ ...legacy, knowledgeMentor: createKnowledgeMentorState() })).toThrow();
  });

  it('charges the real guidance, five bottle-specific jobs, full distinct preparation and original balance', () => {
    let s = untaught(), before = structuredClone(s); s = km(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([before.cash - 500, before.actionsRemaining - 1]);
    const bottleId = s.knowledgeMentor.bottles[0]!.id;
    for (let i = 0; i < 5; i++) s = km(unitBudget(s), { type: 'POTION_WORK', bottleId });
    expect(s.knowledgeMentor.bottles[0]!.labourSteps).toBe(5); rejectKm(s, { type: 'POTION_WORK', bottleId });
    expect(s.knowledgeMentor.bottles[1]!.labourSteps).toBe(0); before = structuredClone(s); s = km(s, { type: 'BUY_POTION', bottleId });
    expect(s.cash).toBe(before.cash - 800); expect(s.knowledgeMentor.bottles[0]!.status).toBe('PLAYER'); rejectKm(s, { type: 'PREPARE_PROMOTION' });
    for (const taskId of KNOWLEDGE_MENTOR_PREPARATION_IDS) { s = km(unitBudget(s), { type: 'PREPARE_TASK', taskId }); rejectKm(s, { type: 'PREPARE_TASK', taskId }); }
    before = unitBudget(s); s = km(before, { type: 'PREPARE_PROMOTION' });
    expect([s.cash, s.actionsRemaining, s.knowledgeMentor.preparedWeek]).toEqual([before.cash - 120, before.actionsRemaining - 1, s.week]);
    for (const key of paragonLegacyKeys) expect(s[key]).toEqual(before[key]);
  });

  it('consumes the selected original once, appends only two new zero masteries and freezes all lower-stage history', () => {
    const s = prepared(); s.spirituality = 17; const old = structuredClone(s), result = consume(s, 1); assertValidSliceState(result);
    expect(Object.keys(old.progression.mastery)).toHaveLength(17);
    expect(Object.keys(result.progression.mastery)).toHaveLength(19);
    expect(Object.keys(result.progression.mastery).filter(id => !Object.hasOwn(old.progression.mastery, id))).toEqual([...KNOWLEDGE_MENTOR_ABILITY_IDS]);
    for (const [id, value] of Object.entries(old.progression.mastery)) expect(result.progression.mastery[id]).toBe(value);
    expect(KNOWLEDGE_MENTOR_ABILITY_IDS.map(id => result.progression.mastery[id])).toEqual([0, 0]);
    expect(result.progression).toMatchObject({ sequence: 2, acting: 0, promotionWeek: old.progression.promotionWeek });
    expect(result.knowledgeMentor.arcaneScholarActingAtPromotion).toBe(100); expect(result.spirituality).toBe(17);
    expect(result.knowledgeMentor.life.combatPlates).toEqual([]); expect(result.knowledgeMentor.preparedWeek).toBeNull();
    for (const key of paragonLegacyKeys) expect(result[key], key).toEqual(old[key]);
    for (const key of ['injuries', 'injuryRisk', 'town', 'combatHistory'] as const) expect(result[key]).toEqual(old[key]);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(result.character.coreStats[stat]).toBe(Math.min(500, old.character.coreStats[stat] + 1));
    expect(projectSliceState(result).arcaneScholar.acting).toBe(100);
    const visible = projectSliceState(result).knowledgeMentor.abilities.map(a => a.id);
    expect(visible).toHaveLength(19); expect(new Set(visible).size).toBe(19); expect(new Set(visible)).toEqual(new Set(Object.keys(result.progression.mastery)));
    for (const command of [{ type: 'LEARN_GUIDANCE' }, { type: 'PREPARE_PROMOTION' }, { type: 'REQUEST_SUPPLY' }] as const) rejectKm(result, command);
  });

  it.each([[90, 'FAILURE', 15, 25, 30], [100, 'GREAT_FAILURE', 25, 45, 60]] as const)('retains true paid failure roll%s and consumed bottle without granting S2', (roll, tier, h, m, pollution) => {
    const s = prepared(), before = structuredClone(s), next = consume(s, roll);
    expect(next.progression).toEqual(before.progression); expect(next.health).toBe(Math.max(1, before.health - h)); expect(next.mind).toBe(Math.max(1, before.mind - m));
    expect(next.seer.pollution).toBe(Math.min(100, before.seer.pollution + pollution)); expect(next.spirituality).toBe(before.spirituality);
    const selected = next.knowledgeMentor.bottles.find(b => b.consumedWeek === next.week && b.outcome === tier)!;
    expect(selected).toMatchObject({ status: 'CONSUMED', preparationWeek: next.week }); expect(next.knowledgeMentor.preparedWeek).toBeNull();
    rejectKm(next, { type: 'CONSUME', bottleId: selected.id, confirmed: true });
    for (const key of paragonLegacyKeys) expect(next[key]).toEqual(before[key]);
  });

  it('allows depleted preparation cancellation without refund, healing or consuming the chosen bottle', () => {
    const s = prepared(); s.health = 1; s.mind = 1; const before = structuredClone(s), next = km(s, { type: 'LEAVE_PREPARATION' });
    expect([next.health, next.mind, next.cash, next.actionsRemaining, next.spirituality]).toEqual([before.health, before.mind, before.cash, before.actionsRemaining, before.spirituality]);
    expect(next.knowledgeMentor.bottles).toEqual(before.knowledgeMentor.bottles); expect(next.knowledgeMentor.preparedWeek).toBeNull();
  });

  it('keeps maxS120 in validation, public projection and ordinary REST rather than falling back to30', () => {
    let s = unitBudget(knowledgeMentorSnapshot('promoted')); s.spirituality = 119; assertValidSliceState(s);
    expect(projectKnowledgeMentor(s).resources!.maxSpirituality).toBe(120); expect(projectSliceState(s).maxSpirituality).toBe(120);
    s = applySliceIntent(s, { type: 'ACTION', action: 'REST' }); assertValidSliceState(s); expect(s.spirituality).toBe(120);
    s.spirituality = 121; expect(() => assertValidSliceState(s)).toThrow();
  });

  it('keeps old S3 use, acquisition and recharge frozen while retaining Corwin and the unique objects', () => {
    const s = knowledgeMentorSnapshot('promoted'), before = structuredClone(s);
    for (const command of [{ type: 'LEARN_GUIDANCE' }, { type: 'RECHARGE', objectId: 'AL4-FRAME-1' }, { type: 'OBSERVE', caseId: 'tolerance-map' }, { type: 'ENCOUNTER_TALK' }])
      expect(() => applySliceIntent(s, { type: 'ARCANE_SCHOLAR', command } as never)).toThrow();
    expect(s).toEqual(before); expect(s.arcaneScholar.encounter).toMatchObject({ targetId: 'AR3-CORWIN', enemyHealth: 70, enemySpirituality: 64, enemyStatus: 'SURRENDERED' });
    expect(s.alchemist.encounter.enemy).toMatchObject({ status: 'DEAD', health: 0 });
    expect(s.alchemist.life.creations.map(x => [x.id, x.charge, x.durability])).toEqual([['AL4-BOX-1', 1, 100], ['AL4-FRAME-1', 0, 95]]);
  });

  it.each([null, {}, { type: 'BREW' }, { type: 'BUY_POTION', bottleId: 'arcane-scholar-potion-1' }, { type: 'BUY_POTION', bottleId: 'knowledge-mentor-potion-01' }, { type: 'CONSUME', bottleId: 'knowledge-mentor-potion-1', confirmed: false }, { type: 'LEARN_GUIDANCE', free: true }, { type: 'PREPARE_TASK', taskId: 'READ_ALL_KNOWLEDGE' }])('rejects malformed acquisition %# before changing resources or randomness', command => {
    expect(validateKnowledgeMentorCommand(command)).toBe(false); expect(validateSlicePayload({ type: 'KNOWLEDGE_MENTOR', command })).toBe(false); rejectKm(knowledgeMentorSnapshot('promoted'), command);
  });

  it('rejects forged provenance, copied bottles, missing inherited mastery and false acting snapshots', () => {
    const s = knowledgeMentorSnapshot('promoted');
    const corruptions: ((s: SliceState) => void)[] = [
      t => { t.knowledgeMentor.arcaneScholarActingAtPromotion = 99; }, t => { t.knowledgeMentor.bottles[0]!.source = 'copied old bottle'; },
      t => { t.knowledgeMentor.bottles[1]!.id = t.knowledgeMentor.bottles[0]!.id; }, t => { delete t.progression.mastery['paragon.s9.memory']; },
      t => { delete t.progression.mastery['paragon.s2.protocol-binding']; }, t => { t.knowledgeMentor.preparations[0]!.completedWeek = t.week + 1; },
    ];
    for (const change of corruptions) { const bad = structuredClone(s); change(bad); expect(validateKnowledgeMentorState(bad)).toBe(false); expect(() => assertValidSliceState(bad)).toThrow(); }
  });
});
