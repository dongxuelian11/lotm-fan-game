import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import { createLifeGiverState, projectLifeGiver, validateLifeGiverCommand, validateLifeGiverState } from '../../src/domain/life-giver/index.js';
import { LIFE_GIVER_ABILITY_IDS, LIFE_GIVER_PREPARATION_IDS } from '../../src/domain/life-giver/types.js';
import { LIFE_GIVER_ABILITIES, LIFE_GIVER_FORMULA_STATUS, LIFE_GIVER_SOURCE_STATUS } from '../../src/domain/life-giver/content.js';
import { guest, lifeGiverBoundary, lifeGiverSnapshot, lg, moonLegacyKeys, rejectLg, unitBudget } from './life-giver-test-fixture.js';
import type { SliceState } from '../../src/domain/slice/types.js';

function prepared() { return unitBudget(lifeGiverBoundary('promotion').beforeLast); }
function consume(s: SliceState, roll: number) {
  const c = lifeGiverBoundary('promotion').lastIntent;
  if (c.type !== 'LIFE_GIVER' || c.command.type !== 'CONSUME') throw new Error('Expected separately confirmed original bottle boundary');
  return lg(s, c.command, roll);
}
function untaught() { const s = unitBudget(lifeGiverSnapshot('guidanceStart')); s.cash = 20000; assertValidSliceState(s); return s; }

describe('Life Giver S2 original paid acquisition and nineteen-plus-two inheritance', () => {
  it('starts hidden with distinct fresh bottles and no formula, free guest or ability', () => {
    const s = createSliceRun('life-giver-hidden', sliceDefaultCreationSelection, 'life-giver-hidden'); assertValidSliceState(s);
    expect(s.lifeGiver).toEqual(createLifeGiverState());
    expect(projectLifeGiver(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], resources: null, actions: [], abilities: [] });
    expect(s.lifeGiver.life.initialGuestAnchor).toBeNull(); expect(s.lifeGiver.life.beads).toEqual([]);
    rejectLg(s, { type: 'LEARN_GUIDANCE' });
    const other = createLifeGiverState(); other.bottles[0]!.labourSteps = 5;
    expect(s.lifeGiver.bottles[0]!.labourSteps).toBe(0);
  });

  it('distinguishes verified S2/S1 names from original G mechanics, unknown formula and S1 gender change', () => {
    expect(LIFE_GIVER_FORMULA_STATUS).toContain('完整配方'); expect(LIFE_GIVER_FORMULA_STATUS).toContain('未知');
    expect(LIFE_GIVER_FORMULA_STATUS).toContain('不能断言原著无需仪式');
    expect(LIFE_GIVER_SOURCE_STATUS).toContain('原创G'); expect(LIFE_GIVER_SOURCE_STATUS).toContain('美神1');
    expect(LIFE_GIVER_SOURCE_STATUS).toContain('本阶不改变性别');
    expect(LIFE_GIVER_ABILITIES.every(a => a.label.includes('G') && a.description.includes('原创G'))).toBe(true);
  });

  it('migrates genuine schema164 to165 by adding only fresh Life Giver state', () => {
    const old = readObjectEntry<Record<string, unknown>>('tests/fixtures/knowledge-mentor-v01670/natural.json', 'final');
    expect(old.schemaVersion).toBe(164); expect(old).not.toHaveProperty('lifeGiver');
    const bytes = JSON.stringify(old), s = migrateSliceState(old); assertValidSliceState(s);
    expect(s.schemaVersion).toBe(176); expect(s.contentVersion).toBe('elder-v176'); expect(s.lifeGiver).toEqual(createLifeGiverState());
    for (const [key, value] of Object.entries(old)) if (!['schemaVersion', 'contentVersion'].includes(key)) expect((s as unknown as Record<string, unknown>)[key], key).toEqual(value);
    expect(JSON.stringify(old)).toBe(bytes); expect(() => migrateSliceState({ ...old, lifeGiver: createLifeGiverState() })).toThrow();
  });

  it('charges500 for guidance and five separate bottle-specific jobs before the800 balance', () => {
    let s = untaught(), before = structuredClone(s); s = lg(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([before.cash - 500, before.actionsRemaining - 1]);
    const bottleId = s.lifeGiver.bottles[0]!.id;
    for (let i = 0; i < 5; i++) s = lg(unitBudget(s), { type: 'POTION_WORK', bottleId });
    expect(s.lifeGiver.bottles[0]!.labourSteps).toBe(5); rejectLg(s, { type: 'POTION_WORK', bottleId });
    expect(s.lifeGiver.bottles[1]!.labourSteps).toBe(0); before = structuredClone(s); s = lg(s, { type: 'BUY_POTION', bottleId });
    expect(s.cash).toBe(before.cash - 800); expect(s.lifeGiver.bottles[0]!.status).toBe('PLAYER');
    rejectLg(s, { type: 'BUY_POTION', bottleId }); rejectLg(s, { type: 'PREPARE_PROMOTION' }); rejectLg(s, { type: 'REQUEST_SUPPLY' });
    expect(s.lifeGiver.preparations).toEqual([]); expect(s.summoningMaster).toEqual(before.summoningMaster);
  });

  it('does not transfer a partial labour discount to this or another bottle', () => {
    let s = lg(untaught(), { type: 'LEARN_GUIDANCE' });
    s = lg(s, { type: 'POTION_WORK', bottleId: 'life-giver-potion-1' }); const before = s.cash;
    s = lg(s, { type: 'BUY_POTION', bottleId: 'life-giver-potion-1' }); expect(s.cash).toBe(before - 6200);
    const second = s.cash; s = lg(s, { type: 'BUY_POTION', bottleId: 'life-giver-potion-2' }); expect(s.cash).toBe(second - 6200);
    expect(s.lifeGiver.bottles[1]!.labourSteps).toBe(0);
  });

  it('records three distinct paid professional preparations and a separately paid current-week scene', () => {
    for (const taskId of LIFE_GIVER_PREPARATION_IDS) {
      const b = lifeGiverBoundary(`preparation-${taskId.toLowerCase()}`);
      expect(b.lastIntent).toEqual({ type: 'LIFE_GIVER', command: { type: 'PREPARE_TASK', taskId } });
      expect(b.final.lifeGiver.preparations).toContainEqual({ taskId, completedWeek: b.beforeLast.week });
      expect(b.final.lifeGiver.preparations).toHaveLength(b.beforeLast.lifeGiver.preparations.length + 1);
      rejectLg(unitBudget(b.final), { type: 'PREPARE_TASK', taskId });
    }
    const b = lifeGiverBoundary('paid-current-week-preparation');
    expect([b.final.cash, b.final.actionsRemaining, b.final.lifeGiver.preparedWeek]).toEqual([b.beforeLast.cash - 120, b.beforeLast.actionsRemaining - 1, b.beforeLast.week]);
    expect(b.final.week - b.final.summoningMaster.promotionWeek!).toBeGreaterThanOrEqual(12);
    expect(projectSliceState(b.final).canAct).toBe(false);
    expect(() => applySliceIntent(b.final, { type: 'ACTION', action: 'REST' })).toThrow();
  });

  it('consumes one original and appends only two zero masteries without gender, guest, injury or spirituality restoration', () => {
    const s = prepared(); s.spirituality = 17; const old = structuredClone(s), next = consume(s, 1);
    expect(Object.keys(old.progression.mastery)).toHaveLength(19); expect(Object.keys(next.progression.mastery)).toHaveLength(21);
    expect(Object.keys(next.progression.mastery).filter(id => !Object.hasOwn(old.progression.mastery, id))).toEqual([...LIFE_GIVER_ABILITY_IDS]);
    for (const [id, value] of Object.entries(old.progression.mastery)) expect(next.progression.mastery[id], id).toBe(value);
    expect(LIFE_GIVER_ABILITY_IDS.map(id => next.progression.mastery[id])).toEqual([0, 0]);
    expect(next.progression).toMatchObject({ sequence: 2, acting: 0, promotionWeek: old.progression.promotionWeek });
    expect(next.lifeGiver.summoningMasterActingAtPromotion).toBe(100); expect(next.spirituality).toBe(17);
    expect(next.character.gender).toBe(old.character.gender); expect(guest(next)).toEqual(guest(old));
    expect(next.lifeGiver.life.initialGuestAnchor).toEqual(guest(old)); expect(next.lifeGiver.life.initialGuestAnchor).not.toBe(guest(next));
    expect(next.lifeGiver.life.beads).toEqual([]); expect(next.lifeGiver.preparedWeek).toBeNull();
    for (const key of [...moonLegacyKeys, 'witchKing', 'summoningMaster', 'injuries', 'injuryRisk', 'town', 'combatHistory'] as const) expect(next[key], key).toEqual(old[key]);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(next.character.coreStats[stat]).toBe(Math.min(500, old.character.coreStats[stat] + 1));
    expect(projectSliceState(next).summoningMaster.acting).toBe(100);
    expect(projectLifeGiver(next).abilities.map(a => a.id)).toEqual([...LIFE_GIVER_ABILITY_IDS]);
    const visible = projectSliceState(next).lifeGiver.abilities; expect(visible).toHaveLength(21);
    expect(new Set(visible.map(a => a.id))).toEqual(new Set(Object.keys(next.progression.mastery)));
    for (const type of ['LEARN_GUIDANCE', 'PREPARE_PROMOTION', 'REQUEST_SUPPLY'] as const) rejectLg(next, { type });
  });

  it.each([[90, 'FAILURE', 15, 25, 30], [100, 'GREAT_FAILURE', 25, 45, 60]] as const)('retains paid failure roll%s, bottle and preparation consumption with no S2 grant', (roll, tier, h, m, pollution) => {
    const s = prepared(), before = structuredClone(s), next = consume(s, roll);
    expect(next.progression).toEqual(before.progression); expect(next.health).toBe(Math.max(1, before.health - h)); expect(next.mind).toBe(Math.max(1, before.mind - m));
    expect(next.seer.pollution).toBe(Math.min(100, before.seer.pollution + pollution)); expect(next.spirituality).toBe(before.spirituality);
    const bottle = next.lifeGiver.bottles.find(b => b.consumedWeek === next.week && b.outcome === tier)!;
    expect(bottle).toMatchObject({ status: 'CONSUMED', preparationWeek: next.week }); expect(next.lifeGiver.preparedWeek).toBeNull();
    expect(next.lifeGiver.preparations).toEqual(before.lifeGiver.preparations); expect(guest(next)).toEqual(guest(before));
    expect(next.injuries).toEqual(before.injuries); expect(next.injuryRisk).toBe(before.injuryRisk);
    rejectLg(next, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  });

  it('allows depleted preparation cancellation without refund, healing or consuming a bottle', () => {
    const s = prepared(); s.health = 1; s.mind = 1; const before = structuredClone(s), next = lg(s, { type: 'LEAVE_PREPARATION' });
    expect([next.health, next.mind, next.cash, next.actionsRemaining, next.spirituality]).toEqual([before.health, before.mind, before.cash, before.actionsRemaining, before.spirituality]);
    expect(next.lifeGiver.bottles).toEqual(before.lifeGiver.bottles); expect(next.lifeGiver.preparedWeek).toBeNull();
  });

  it('retains S120 in validation, public projection and ordinary REST', () => {
    let s = unitBudget(lifeGiverSnapshot('promoted')); s.spirituality = 119; assertValidSliceState(s);
    expect(projectLifeGiver(s).resources!.maxSpirituality).toBe(120); expect(projectSliceState(s).maxSpirituality).toBe(120);
    const original = structuredClone(guest(s)); s = applySliceIntent(s, { type: 'ACTION', action: 'REST' }); assertValidSliceState(s);
    expect(s.spirituality).toBe(120); expect(guest(s)).toEqual(original);
    s.spirituality = 121; expect(() => assertValidSliceState(s)).toThrow();
  });

  it('freezes lower-stage acquisition and old encounters while retaining Edwin and the original paper states', () => {
    const s = lifeGiverSnapshot('promoted'), before = structuredClone(s);
    for (const command of [{ type: 'LEARN_GUIDANCE' }, { type: 'OBSERVE', caseId: 'source-visit' }, { type: 'ENCOUNTER_TALK' }])
      expect(() => applySliceIntent(s, { type: 'SUMMONING_MASTER', command } as never)).toThrow();
    expect(s).toEqual(before); expect(s.summoningMaster.encounter).toMatchObject({ targetId: 'SM3-EDWIN', status: 'RETREATED', enemyHealth: 100, enemyMind: 100, enemySpirituality: 71, enemyStatus: 'RESISTING', weaponLocation: 'HAND' });
    expect(s.witchKing.life.papers.map(p => p.status)).toEqual(['CONSUMED', 'CONSUMED', 'HELD']);
  });

  it.each([null, {}, { type: 'BREW' }, { type: 'BUY_POTION', bottleId: 'summoning-master-potion-1' }, { type: 'BUY_POTION', bottleId: 'life-giver-potion-01' }, { type: 'CONSUME', bottleId: 'life-giver-potion-1', confirmed: false }, { type: 'LEARN_GUIDANCE', free: true }, { type: 'PREPARE_TASK', taskId: 'CREATE_SOUL' }])('rejects malformed acquisition %# before changing resources or randomness', command => {
    expect(validateLifeGiverCommand(command)).toBe(false); expect(validateSlicePayload({ type: 'LIFE_GIVER', command })).toBe(false); rejectLg(lifeGiverSnapshot('promoted'), command);
  });

  it('rejects forged provenance, copied bottles, missing old/new mastery and false preparation chronology', () => {
    const s = lifeGiverSnapshot('promoted');
    const corruptions: ((s: SliceState) => void)[] = [
      t => { t.lifeGiver.summoningMasterActingAtPromotion = 99; }, t => { t.lifeGiver.bottles[0]!.source = 'copied old bottle'; },
      t => { t.lifeGiver.bottles[1]!.id = t.lifeGiver.bottles[0]!.id; }, t => { delete t.progression.mastery[Object.keys(t.progression.mastery)[0]!]; },
      t => { delete t.progression.mastery['moon.s2.bounded-vitality']; }, t => { t.lifeGiver.preparations[0]!.completedWeek = t.week + 1; },
      t => { t.lifeGiver.bottles.find(b => b.status === 'CONSUMED')!.preparationWeek = null; },
      t => { t.lifeGiver.promotionWeek = t.summoningMaster.promotionWeek! + 11; },
    ];
    for (const change of corruptions) { const bad = structuredClone(s); change(bad); expect(validateLifeGiverState(bad)).toBe(false); expect(() => assertValidSliceState(bad)).toThrow(); }
  });
});
