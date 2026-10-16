import { CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createBarrenMatriarchState, hasBarrenMatriarchLock, projectBarrenMatriarch, BARREN_MATRIARCH_INHERITED_ABILITY_IDS, validateBarrenMatriarchAcquisitionJournal, validateBarrenMatriarchJournalContinuity, validateBarrenMatriarchCommand, validateBarrenMatriarchState } from '../../src/domain/barren-matriarch/index.js';
import { BARREN_MATRIARCH_ABILITY_IDS, BARREN_MATRIARCH_PREPARATION_IDS } from '../../src/domain/barren-matriarch/types.js';
import { directedInitial3, dose, ba, oldMotherRoots, originalCoffinBearer, prepared, promoted, recover, recoverResources, rejectBarrenMatriarch, rejectIntent, step, taught, coffinBearerNaturalPath } from './barren-matriarch-directed-helper.js';

const journal = (s: SliceState) => s.barrenMatriarch.acquisitionJournal;

describe('BarrenMatriarch acquisition: complete674-command source and DECLARED directed units', () => {
  it('uses all674 original commands with the actual four untreated injuries and thirteen masteries', () => {
    const original = readObjectEntry<SliceState>(coffinBearerNaturalPath, 'final'), bytes = JSON.stringify(original), s = originalCoffinBearer();
    expect(readObjectEntry<SliceIntent[]>(coffinBearerNaturalPath, 'commands')).toHaveLength(674);
    expect(s).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, week: 174, revision: 675, status: 'ACTIVE', health: 50, mind: 100, spirituality: 116, cash: 335, actionsRemaining: 3, injuryRisk: 5, random: { seed: 'cultivator-natural-v069', cursor: 208 }, progression: { sequence: 3, acting: 100, promotionWeek: 6 }, character: { gender: 'FEMALE' } });
    expect(s.character.coreStats).toEqual({ physique: 27, perception: 23, will: 22, knowledge: 23 });
    expect(s.injuries).toEqual(original.injuries); expect(s.injuries.map(i => [i.severity, i.acquiredRevision, i.treatedRevision])).toEqual([['HEAVY', 131, null], ['LIGHT', 671, null], ['HEAVY', 672, null], ['LIGHT', 673, null]]);
    expect(s.coffinBearer.promotionWeek).toBe(165); expect(s.coffinBearer.encounter).toMatchObject({ status: 'RESOLVED', targetId: 'CB3-NOLAN', enemyStatus: 'SURRENDERED', enemyHealth: 50 });
    expect(Object.keys(s.progression.mastery)).toEqual([...BARREN_MATRIARCH_INHERITED_ABILITY_IDS]);
    expect(s.progression.mastery).toEqual(original.progression.mastery); expect(Object.values(s.progression.mastery).filter(m => m === 0)).toHaveLength(3);
    expect(s.barrenMatriarch).toEqual(createBarrenMatriarchState()); expect(JSON.stringify(original)).toBe(bytes); assertValidSliceState(s);
  }, 30_000);
  it('declares directed input edits before the first new-stage journal and preserves every old root', () => {
    const original = originalCoffinBearer(), s = directedInitial3();
    expect(s).toMatchObject({ week: 177, cash: 100000, actionsRemaining: 100, weeklyBudget: 100, health: 50, mind: 100, spirituality: 116, injuryRisk: 5 });
    expect(s.date).toEqual(addGameDays(original.date, 21)); expect(s.random.seed).toBe(original.random.seed);
    expect(s.random.cursor).toBeGreaterThanOrEqual(original.random.cursor); expect(s.random.cursor).toBeLessThan(original.random.cursor + 512);
    expect(oldMotherRoots(s)).toEqual(oldMotherRoots(original)); expect(s.injuries).toEqual(original.injuries);
    expect(s.character).toEqual(original.character); expect(s.progression).toEqual(original.progression);
    expect(journal(s)).toEqual([]); expect(originalCoffinBearer()).toEqual(original);
  });
  it('keeps independent defaults and hides the stage from unrelated, earlier and S1/S0 characters', () => {
    const s = createSliceRun('barren-matriarch-hidden', sliceDefaultCreationSelection, 'barren-matriarch-hidden');
    expect(projectBarrenMatriarch(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], resources: null });
    rejectBarrenMatriarch(s, { type: 'LEARN_GUIDANCE' });
    const a = createBarrenMatriarchState(); a.bottles[0]!.labourSteps = 5;
    expect(s.barrenMatriarch.bottles[0]!.labourSteps).toBe(0);
    for (const sequence of [4, 1, 0] as const) { const t = originalCoffinBearer(); t.progression.sequence = sequence; expect(projectBarrenMatriarch(t).discovered).toBe(false); rejectBarrenMatriarch(t, { type: 'LEARN_GUIDANCE' }); }
  });
  it('rejects changed lineage and missing or invented skills before accepting new costs', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.coffinBearer.promotionWeek = null; }, s => { s.coffinBearer.ancientAlchemistActingAtPromotion = 99; },
      s => { s.progression.pathwayId = 'hermit'; }, s => { delete s.progression.mastery['mother.s3.finite-preservation']; },
      s => { s.progression.mastery['mother.s2.invented'] = 0; },
      s => { s.cultivator.bottles.find(b => b.status === 'CONSUMED' && ['SUCCESS', 'GREAT_SUCCESS'].includes(b.outcome ?? ''))!.acquiredWeek = s.week + 1; },
    ];
    for (const [index, change] of mutations.entries()) {
      const s = directedInitial3(); change(s);
      try { rejectBarrenMatriarch(s, { type: 'LEARN_GUIDANCE' }); } catch (cause) { throw new Error(`Lineage mutation ${index} was accepted`, { cause }); }
    }
  });
  it('requires twelve complete weeks from actual promotion165, so week174 cannot consume', () => {
    let s = taught('SUCCESS', false);
    expect(projectBarrenMatriarch(s).digestion).toContain('9/12');
    for (const taskId of BARREN_MATRIARCH_PREPARATION_IDS) s = ba(s, { type: 'PREPARE_TASK', taskId });
    s = ba(s, { type: 'BUY_POTION', bottleId: 'barren-matriarch-potion-1' });
    rejectBarrenMatriarch(s, { type: 'PREPARE_PROMOTION' }); rejectBarrenMatriarch(s, dose);
    const atBoundary = prepared(); expect(atBoundary.week).toBe(177); expect(projectBarrenMatriarch(atBoundary).digestion).toContain('12/12');
    expect(ba(atBoundary, dose).barrenMatriarch.promotionWeek).toBe(177);
  });
  it('requires each actual old report and reflection before current preparation', () => {
    for (const missing of ['coffin-bearer-life-fresh-transfer', 'coffin-bearer-life-withdrawn-transfer', 'coffin-bearer-life-dry-record', 'coffin-bearer-reflection']) {
      const s = prepared(); s.seer.completedSources = s.seer.completedSources.filter(id => id !== missing);
      rejectBarrenMatriarch(s, dose); expect(validateBarrenMatriarchAcquisitionJournal(s)).toBe(false);
    }
    const incomplete = prepared(); incomplete.coffinBearer.life.reflected = false; rejectBarrenMatriarch(incomplete, dose);
  });
  it('rejects resurrecting or backdating an old consumed original at the whole-state save boundary', () => {
    const restored = originalCoffinBearer(); restored.cultivator.bottles[0]!.status = 'PLAYER';
    expect(() => assertValidSliceState(restored)).toThrow();
    const backdated = originalCoffinBearer(); backdated.cultivator.bottles[0]!.acquiredWeek = 177;
    expect(() => assertValidSliceState(backdated)).toThrow();
  });
  it('guidance costs exactly500 and one action without granting skills or inventory', () => {
    const before = directedInitial3(), payload = { type: 'LEARN_GUIDANCE' } as const, s = ba(before, payload), e = journal(s)[0]!;
    expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]); expect(s.progression.mastery).toEqual(before.progression.mastery);
    expect(s.barrenMatriarch.bottles.every(b => b.status === 'SUPPLIER')).toBe(true);
    expect([e.before.cash - e.after.cash, e.before.actions - e.after.actions]).toEqual([500, 1]);
    expect([e.check, e.randomBefore, e.randomAfter]).toEqual([null, null, null]);
    expect(e.actor).toEqual({ name: before.character.name, gender: before.character.gender, age: before.character.age, sourceHistoryDigest: null, pathwayId: 'mother', coffinBearerPromotionWeek: 165, cultivatorPromotionWeek: 6 });
    expect(oldMotherRoots(s)).toEqual(oldMotherRoots(before)); expect(payload).toEqual({ type: 'LEARN_GUIDANCE' });
    expect(before.barrenMatriarch.guidanceKnown).toBe(false); rejectBarrenMatriarch(s, payload);
  });
});

describe('BarrenMatriarch paid acquisition, preparations, four real potion tiers and bounded resupply', () => {
  it('five actual jobs discount only their specific bottle and still require900', () => {
    let s = taught(); const before = structuredClone(s);
    for (let n = 0; n < 5; n++) s = ba(s, { type: 'POTION_WORK', bottleId: 'barren-matriarch-potion-2' });
    expect([s.actionsRemaining, s.cash]).toEqual([before.actionsRemaining - 5, before.cash]);
    expect(s.barrenMatriarch.bottles[1]).toMatchObject({ labourSteps: 5, status: 'SUPPLIER' }); expect(s.barrenMatriarch.bottles[0]!.labourSteps).toBe(0);
    rejectBarrenMatriarch(s, { type: 'POTION_WORK', bottleId: 'barren-matriarch-potion-2' });
    s = ba(s, { type: 'BUY_POTION', bottleId: 'barren-matriarch-potion-2' }); expect(s.cash).toBe(before.cash - 900);
    expect(s.barrenMatriarch.bottles[1]).toMatchObject({ status: 'PLAYER', acquiredWeek: 177 }); rejectBarrenMatriarch(s, { type: 'BUY_POTION', bottleId: 'barren-matriarch-potion-2' });
    expect(validateBarrenMatriarchAcquisitionJournal(s)).toBe(true); rejectBarrenMatriarch(s, { type: 'PREPARE_PROMOTION' });
  });
  it('four jobs give no partial credit and earned credit never transfers to another bottle', () => {
    let s = taught(); for (let n = 0; n < 4; n++) s = ba(s, { type: 'POTION_WORK', bottleId: 'barren-matriarch-potion-1' });
    const cash = s.cash; s = ba(s, { type: 'BUY_POTION', bottleId: 'barren-matriarch-potion-1' }); expect(s.cash).toBe(cash - 6400);
    s = ba(s, { type: 'BUY_POTION', bottleId: 'barren-matriarch-potion-2' }); expect(s.cash).toBe(cash - 12800);
    const credited = prepared('SUCCESS', true); expect([credited.cash, credited.actionsRemaining]).toEqual([98460, 90]);
  });
  it.each([[20, 99], [100, 40], [1, 99], [100, 1]] as const)('requires health>20 and mind>40 before site preparation (%s/%s)', (health, mind) => {
    const initial = directedInitial3(); initial.health = health; initial.mind = mind;
    let s = ba(initial, { type: 'LEARN_GUIDANCE' });
    for (const taskId of BARREN_MATRIARCH_PREPARATION_IDS) s = ba(s, { type: 'PREPARE_TASK', taskId });
    s = ba(s, { type: 'BUY_POTION', bottleId: dose.bottleId });
    rejectBarrenMatriarch(s, { type: 'PREPARE_PROMOTION' }); rejectBarrenMatriarch(s, dose);
    expect(s.barrenMatriarch.bottles[0]!.status).toBe('PLAYER'); expect(s.injuries).toEqual(initial.injuries);
  });
  it('requires all three distinct preparations and cancellation refunds neither140 nor an action', () => {
    let s = taught(); const ap = s.actionsRemaining;
    for (const taskId of BARREN_MATRIARCH_PREPARATION_IDS) { rejectBarrenMatriarch(s, { type: 'PREPARE_PROMOTION' }); s = ba(s, { type: 'PREPARE_TASK', taskId }); rejectBarrenMatriarch(s, { type: 'PREPARE_TASK', taskId }); }
    expect(s.actionsRemaining).toBe(ap - 3); rejectBarrenMatriarch(s, { type: 'PREPARE_PROMOTION' });
    const ready = prepared(), e = journal(ready).at(-1)!;
    expect([e.before.cash - e.after.cash, e.before.actions - e.after.actions]).toEqual([140, 1]);
    expect([ready.cash, ready.actionsRemaining]).toEqual([92960, 95]); expect(hasBarrenMatriarchLock(ready)).toBe(true);
    rejectIntent(ready, { type: 'ACTION', action: 'REST' }); rejectBarrenMatriarch(ready, { type: 'LEARN_GUIDANCE' });
    const left = ba(ready, { type: 'LEAVE_PREPARATION' });
    expect([left.cash, left.actionsRemaining, left.health, left.spirituality]).toEqual([ready.cash, ready.actionsRemaining, ready.health, ready.spirituality]);
    expect(left.barrenMatriarch.bottles[0]!.status).toBe('PLAYER'); expect(left.barrenMatriarch.preparedWeek).toBeNull(); expect(left.barrenMatriarch.preparations).toEqual(ready.barrenMatriarch.preparations);
    expect(oldMotherRoots(left)).toEqual(oldMotherRoots(ready)); rejectBarrenMatriarch(left, dose);
    const retried = ba(left, { type: 'PREPARE_PROMOTION' }); expect([retried.cash, retried.actionsRemaining]).toEqual([left.cash - 140, left.actionsRemaining - 1]);
  });
  it.each(BARREN_MATRIARCH_PREPARATION_IDS)('owning a real potion never substitutes for missing preparation %s', omitted => {
    let s = ba(taught(), { type: 'BUY_POTION', bottleId: 'barren-matriarch-potion-1' });
    for (const taskId of BARREN_MATRIARCH_PREPARATION_IDS.filter(id => id !== omitted)) s = ba(s, { type: 'PREPARE_TASK', taskId });
    rejectBarrenMatriarch(s, { type: 'PREPARE_PROMOTION' }); rejectBarrenMatriarch(s, dose);
    s = ba(s, { type: 'PREPARE_TASK', taskId: omitted }); expect(ba(s, { type: 'PREPARE_PROMOTION' }).barrenMatriarch.preparedWeek).toBe(177);
  });
  it.each(['SUCCESS', 'GREAT_SUCCESS'] as const)('directed unit %s gives exactly13→15 without healing, resource refills or rewriting history', kind => {
    const before = prepared(kind), snapshot = structuredClone(before), s = ba(before, dose), e = journal(s).at(-1)!;
    const rng = new DeterministicActionRandomStream(before.random.seed, before.random.cursor);
    expect(e.check).toEqual(resolveNormalCheck({ ability: 'will', baseAbility: before.character.coreStats.will, difficulty: 30, modifiers: [], roll: rng.nextInt(1, 100) }));
    expect(e.check!.tier).toBe(kind); expect([e.randomBefore, e.randomAfter, s.random.cursor]).toEqual([before.random.cursor, rng.cursor, rng.cursor]);
    expect(s.progression.sequence).toBe(2); expect(Object.keys(s.progression.mastery)).toEqual([...BARREN_MATRIARCH_INHERITED_ABILITY_IDS, ...BARREN_MATRIARCH_ABILITY_IDS]);
    for (const [id, mastery] of Object.entries(before.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    for (const id of BARREN_MATRIARCH_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const stat of ['physique', 'perception', 'knowledge', 'will'] as const) expect(s.character.coreStats[stat]).toBe(before.character.coreStats[stat] + 1);
    expect([s.health, s.spirituality, s.mind, s.injuryRisk, s.character.gender]).toEqual([50, 116, kind === 'GREAT_SUCCESS' ? 92 : 85, 5, before.character.gender]);
    expect(s.injuries).toEqual(before.injuries); expect(oldMotherRoots(s)).toEqual(oldMotherRoots(before)); expect(s.seer.completedSources).toEqual(before.seer.completedSources);
    expect(s.barrenMatriarch.coffinBearerActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
    expect(s.barrenMatriarch.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind, preparationWeek: 177, consumedWeek: 177 });
    expect([s.actionsRemaining, s.cash]).toEqual([before.actionsRemaining, before.cash]); expect(before).toEqual(snapshot);
    expect(validateBarrenMatriarchAcquisitionJournal(s)).toBe(true); assertValidSliceState(s); rejectBarrenMatriarch(s, dose);
  });
  it('does not refill a declared pre-journal partial health or spirituality budget on successful promotion', () => {
    let s = directedInitial3('SUCCESS'); s.health = 83; s.mind = 85; s.spirituality = 17;
    s = ba(s, { type: 'LEARN_GUIDANCE' }); for (const taskId of BARREN_MATRIARCH_PREPARATION_IDS) s = ba(s, { type: 'PREPARE_TASK', taskId });
    s = ba(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = ba(s, { type: 'PREPARE_PROMOTION' }); s = ba(s, dose);
    expect([s.health, s.mind, s.spirituality]).toEqual([83, 70, 17]); expect(projectBarrenMatriarch(s).resources!.maxSpirituality).toBe(120);
    expect(validateBarrenMatriarchAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
  });
  it.each([['FAILURE', 35, 75, 30], ['GREAT_FAILURE', 25, 55, 60]] as const)('directed unit %s consumes the original bottle with exact retained costs', (kind, health, mind, pollution) => {
    const before = prepared(kind), s = ba(before, dose);
    expect(s).toMatchObject({ health, mind, spirituality: 116, progression: { sequence: 3, acting: 100 } }); expect(s.seer.pollution).toBe(pollution);
    expect(s.barrenMatriarch.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind, consumedWeek: 177, preparationWeek: 177 }); expect(s.barrenMatriarch.preparedWeek).toBeNull();
    expect([s.cash, s.actionsRemaining]).toEqual([before.cash, before.actionsRemaining]); expect(s.barrenMatriarch.preparations).toEqual(before.barrenMatriarch.preparations);
    expect(oldMotherRoots(s)).toEqual(oldMotherRoots(before)); expect(s.injuries).toEqual(before.injuries); expect(Object.keys(s.progression.mastery)).toHaveLength(13);
    expect(s.seer.completedSources).toEqual(before.seer.completedSources); expect(validateBarrenMatriarchAcquisitionJournal(s)).toBe(true); assertValidSliceState(s); rejectBarrenMatriarch(s, dose);
    const bought = ba(s, { type: 'BUY_POTION', bottleId: 'barren-matriarch-potion-2' }); expect(ba(bought, { type: 'PREPARE_PROMOTION' }).cash).toBe(s.cash - 6400 - 140);
  });
  it('real REST heals LIGHT injuries but medical decline retains both original untreated HEAVY injuries', () => {
    const before = promoted(), commands: SliceIntent[] = [], s = recoverResources(before, commands);
    expect(commands.filter(c => c.type === 'ACTION' && c.action === 'INVESTIGATE' && c.targetId === 'CARE-ACCESS-01')).toHaveLength(1);
    expect(s.careKnown).toBe(true);
    expect(commands.some(c => c.type === 'ACTION' && c.action === 'REST')).toBe(true);
    expect(commands.some(c => c.type === 'EVENT_CHOICE' && c.choiceId === 'DECLINE')).toBe(true);
    expect([s.health, s.mind, s.spirituality, s.injuryRisk]).toEqual([100, 100, 120, 5]); expect(s.injuries).toEqual(before.injuries.filter(i => i.severity === 'HEAVY'));
    expect(before.injuries).toHaveLength(4); expect(s.injuries).toHaveLength(2);
    expect(s.cash).toBe(before.cash); expect(s.random).toEqual(before.random); expect(oldMotherRoots(s)).toEqual(oldMotherRoots(before));
    expect(s.barrenMatriarch).toEqual(before.barrenMatriarch); assertValidSliceState(s);
  });
  it('real clinic payment and later REST remove the actual injury without rewriting the source fixture', () => {
    const before = promoted(), commands: SliceIntent[] = [], s = recover(before, commands);
    expect(commands.filter(c => c.type === 'ACTION' && c.action === 'INVESTIGATE' && c.targetId === 'CARE-ACCESS-01')).toHaveLength(1);
    expect(s.careKnown).toBe(true);
    expect(commands.filter(c => c.type === 'EVENT_CHOICE' && c.choiceId === 'PAY')).toHaveLength(1);
    expect(s.cash).toBe(before.cash - 60); expect([s.health, s.mind, s.spirituality]).toEqual([100, 100, 120]); expect(s.injuries).toEqual([]);
    expect(oldMotherRoots(s)).toEqual(oldMotherRoots(before)); expect(originalCoffinBearer().injuries).toHaveLength(4); assertValidSliceState(s);
  });
  it('uses only declared low pre-journal resources and confines the minimum1 support to the actual potion', () => {
    let s = directedInitial3('GREAT_FAILURE'); s.health = 21; s.mind = 41;
    s = ba(s, { type: 'LEARN_GUIDANCE' }); for (const taskId of BARREN_MATRIARCH_PREPARATION_IDS) s = ba(s, { type: 'PREPARE_TASK', taskId });
    s = ba(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = ba(s, { type: 'PREPARE_PROMOTION' }); s = ba(s, dose);
    expect(s).toMatchObject({ status: 'ACTIVE', health: 1, mind: 1, progression: { sequence: 3 } });
    const bought = ba(s, { type: 'BUY_POTION', bottleId: 'barren-matriarch-potion-2' }); rejectBarrenMatriarch(bought, { type: 'PREPARE_PROMOTION' });
    expect(s.barrenMatriarch.bottles[0]!.status).toBe('CONSUMED'); expect(validateBarrenMatriarchAcquisitionJournal(s)).toBe(true);
  });
  it('requires three actually failed original bottles and next-week delivery of independent new stock', () => {
    let s = taught('THREE_FAILURES'); rejectBarrenMatriarch(s, { type: 'REQUEST_SUPPLY' }); rejectBarrenMatriarch(s, { type: 'RECEIVE_SUPPLY' });
    for (const taskId of BARREN_MATRIARCH_PREPARATION_IDS) s = ba(s, { type: 'PREPARE_TASK', taskId });
    const originalRoots = structuredClone(oldMotherRoots(s));
    for (const bottleId of ['barren-matriarch-potion-1', 'barren-matriarch-potion-2', 'barren-matriarch-potion-3']) {
      s = recoverResources(s); s = ba(s, { type: 'BUY_POTION', bottleId }); s = ba(s, { type: 'PREPARE_PROMOTION' }); s = ba(s, { type: 'CONSUME', bottleId, confirmed: true, acceptFeminization: true });
    }
    expect(s.barrenMatriarch.bottles.every(b => b.status === 'CONSUMED' && b.outcome === 'FAILURE')).toBe(true);
    expect(s.cash).toBe(100000 - 500 - 3 * (6400 + 140));
    const old = structuredClone(s.barrenMatriarch.bottles), beforeAP = s.actionsRemaining;
    s = ba(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(beforeAP - 1); expect(s.barrenMatriarch.bottles).toEqual(old); rejectBarrenMatriarch(s, { type: 'RECEIVE_SUPPLY' });
    // Advance the unit continuation through real REST actions, never editing the
    // week/date or a resource once the first BarrenMatriarch journal has been recorded.
    const requestWeek = s.week, requestDate = structuredClone(s.date), remaining = s.actionsRemaining;
    let nextWeek = s;
    for (let n = 0; n < remaining; n++) nextWeek = step(nextWeek, { type: 'ACTION', action: 'REST' });
    expect(nextWeek.week).toBe(requestWeek + 1); expect(nextWeek.date).toEqual(addGameDays(requestDate, 7));
    const received = ba(nextWeek, { type: 'RECEIVE_SUPPLY' });
    expect(received.barrenMatriarch.bottles.slice(0, 3)).toEqual(old); expect(received.barrenMatriarch.bottles.slice(3).map(b => b.id)).toEqual(['barren-matriarch-potion-4', 'barren-matriarch-potion-5', 'barren-matriarch-potion-6']);
    expect(received.barrenMatriarch.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.stockedWeek === 178 && b.acquiredWeek === null && b.labourSteps === 0 && b.source.includes(b.id))).toBe(true);
    expect([received.cash, received.actionsRemaining]).toEqual([nextWeek.cash, nextWeek.actionsRemaining]); expect(oldMotherRoots(received)).toEqual(originalRoots);
    expect(validateBarrenMatriarchAcquisitionJournal(received)).toBe(true); assertValidSliceState(received); rejectBarrenMatriarch(received, { type: 'RECEIVE_SUPPLY' });
  });
  it('closes every predecessor acquisition command after the real BarrenMatriarch promotion', () => {
    const s = promoted();
    for (const type of ['CULTIVATOR', 'PHYSICIAN', 'HARVESTPRIEST', 'BIOLOGIST', 'DRUID', 'ANCIENT_ALCHEMIST', 'COFFIN_BEARER'] as const) rejectIntent(s, { type, command: { type: 'LEARN_GUIDANCE' } } as SliceIntent);
    rejectBarrenMatriarch(s, { type: 'LEARN_GUIDANCE' }); rejectBarrenMatriarch(s, { type: 'PREPARE_PROMOTION' }); rejectBarrenMatriarch(s, { type: 'REQUEST_SUPPLY' });
  });
  it('rejects unknown fields, false confirmation, wrong source IDs and invented ritual commands without mutation', () => {
    const s = prepared();
    for (const command of [{ ...dose, confirmed: false }, { ...dose, acceptFeminization: false }, { type: 'CONSUME', bottleId: dose.bottleId, confirmed: true }, { ...dose, free: true }, { type: 'BUY_POTION', bottleId: 'coffin-bearer-potion-1' }, { type: 'PREPARE_TASK', taskId: 'REVIEW_DISASTER' }, { type: 'LEARN_GUIDANCE', free: true }, { type: 'RITUAL_CONTAIN' }, { type: 'RITUAL_REVIEW', stopped: true }]) {
      expect(validateBarrenMatriarchCommand(command)).toBe(false); rejectBarrenMatriarch(s, command);
    }
    rejectBarrenMatriarch(s, { ...dose, bottleId: 'barren-matriarch-potion-99' });
  });
});

const acquisitionMutations: [string, (s: SliceState) => void][] = [
  ['altered sealed history digest', s => { journal(s).at(-1)!.actor.sourceHistoryDigest = '0'.repeat(64); }],
  ['changed original age', s => { journal(s)[0]!.actor.age++; }],
  ['changed original gender', s => { journal(s)[0]!.actor.gender = 'MALE'; }],
  ['forged before gender', s => { journal(s).at(-1)!.before.gender = 'MALE'; }],
  ['forged after gender', s => { journal(s).at(-1)!.after.gender = 'MALE'; }],
  ['removed character acceptance', s => { delete (journal(s).at(-1)!.command as unknown as Record<string, unknown>).acceptFeminization; }],
  ['changed promoted body', s => { s.character.gender = 'MALE'; }],
  ['refunded guidance', s => { journal(s)[0]!.after.cash++; }],
  ['free preparation', s => { journal(s).find(e => e.command.type === 'PREPARE_PROMOTION')!.after.actions++; }],
  ['unearned mastery', s => { journal(s).at(-1)!.after.mastery[BARREN_MATRIARCH_ABILITY_IDS[0]] = 8; }],
  ['altered dose cursor', s => { journal(s).at(-1)!.randomBefore!++; }],
  ['altered dose check', s => { journal(s).at(-1)!.check!.difficulty++; }],
  ['fabricated injury', s => { journal(s).at(-1)!.after.injuries.push({ id: 'fabricated', severity: 'LIGHT', acquiredRevision: 1, treatedRevision: null }); }],
  ['rewritten source IDs', s => { journal(s).at(-1)!.after.completedSources[0] = 'counterfeit-source'; }],
  ['missing purchase', s => { s.barrenMatriarch.acquisitionJournal = journal(s).filter(e => e.command.type !== 'BUY_POTION'); }],
  ['other actor', s => { journal(s)[0]!.actor.name = 'Counterfeit'; }],
  ['other prior promotion week', s => { journal(s)[0]!.actor.coffinBearerPromotionWeek--; }],
  ['relabelled original bottle', s => { s.barrenMatriarch.bottles[0]!.id = 'barren-matriarch-potion-2'; }],
  ['restored consumed original', s => { s.barrenMatriarch.bottles[0]!.status = 'PLAYER'; }],
  ['invented supplier provenance', s => { s.barrenMatriarch.bottles[0]!.source += ' free'; }],
  ['extra evidence field', s => { Object.assign(journal(s)[0]!, { free: true }); }],
  ['extra stage field', s => { Object.assign(s.barrenMatriarch, { free: true }); }],
];
describe('BarrenMatriarch acquisition replay rejects falsified evidence and cross-resource changes', () => {
  it.each(acquisitionMutations)('rejects %s', (_name, change) => {
    const s = promoted(); expect(validateBarrenMatriarchState(s)).toBe(true); change(s);
    expect(validateBarrenMatriarchState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it.each(['health', 'mind', 'spirituality', 'cash', 'actions', 'pollution', 'injuryRisk'] as const)('rejects a discontinuous %s budget even when both event endpoints are adjusted', field => {
    const s = promoted(), event = journal(s)[1]!;
    const delta = field === 'health' || field === 'mind' || field === 'spirituality' ? -1 : 1;
    event.before[field] += delta; event.after[field] += delta;
    expect(validateBarrenMatriarchJournalContinuity(s)).toBe(false); expect(validateBarrenMatriarchAcquisitionJournal(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it.each(['health', 'mind', 'spirituality', 'cash', 'actionsRemaining', 'injuryRisk'] as const)('rejects rewriting immediate post-potion %s without a real intervening command', field => {
    const s = promoted(); s[field] += field === 'health' || field === 'spirituality' ? -1 : 1;
    expect(validateBarrenMatriarchAcquisitionJournal(s)).toBe(false); expect(validateBarrenMatriarchState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it('rejects revision collisions, backdated checks and deleted consumed source prefixes', () => {
    const collision = promoted(); journal(collision)[1]!.revision = journal(collision)[0]!.revision;
    expect(validateBarrenMatriarchJournalContinuity(collision)).toBe(false); expect(validateBarrenMatriarchState(collision)).toBe(false);
    const backdated = promoted(); journal(backdated).at(-1)!.date = originalCoffinBearer().date;
    expect(validateBarrenMatriarchAcquisitionJournal(backdated)).toBe(false);
    const missing = promoted(); missing.seer.completedSources.shift();
    expect(validateBarrenMatriarchAcquisitionJournal(missing)).toBe(false); expect(validateBarrenMatriarchState(missing)).toBe(false);
  });
  it('rejects a forged no-draw cursor after an adjacent post-failure purchase', () => {
    const failed = ba(prepared('FAILURE'), dose), bought = ba(failed, { type: 'BUY_POTION', bottleId: 'barren-matriarch-potion-2' });
    expect(bought.random.cursor).toBe(failed.random.cursor); expect(validateBarrenMatriarchJournalContinuity(bought)).toBe(true);
    bought.random.cursor++;
    expect(validateBarrenMatriarchJournalContinuity(bought)).toBe(false); expect(() => assertValidSliceState(bought)).toThrow();
  });
  it('replays the whole directed command continuation identically without mutating input or payloads', () => {
    const initial = directedInitial3(), original = structuredClone(initial), commands: SliceIntent[] = [];
    let s = ba(initial, { type: 'LEARN_GUIDANCE' }, commands);
    for (const taskId of BARREN_MATRIARCH_PREPARATION_IDS) s = ba(s, { type: 'PREPARE_TASK', taskId }, commands);
    s = ba(s, { type: 'BUY_POTION', bottleId: 'barren-matriarch-potion-1' }, commands); s = ba(s, { type: 'PREPARE_PROMOTION' }, commands); s = ba(s, dose, commands);
    const payloads = structuredClone(commands); let replayed = structuredClone(initial);
    for (const command of commands) replayed = step(replayed, command);
    expect(replayed).toEqual(s); expect(initial).toEqual(original); expect(commands).toEqual(payloads);
    expect(validateBarrenMatriarchJournalContinuity(replayed)).toBe(true); expect(validateBarrenMatriarchAcquisitionJournal(replayed)).toBe(true);
  });
  it('projects only actual knowledge, exact15 abilities and independent state copies', () => {
    const s = promoted(), before = structuredClone(s), p = projectBarrenMatriarch(s);
    expect(p.formulaKnown).toBe(false); expect(p.formula).toEqual([]); expect(p.abilities.map(a => a.id)).toEqual([...BARREN_MATRIARCH_INHERITED_ABILITY_IDS, ...BARREN_MATRIARCH_ABILITY_IDS]);
    expect(new Set(p.abilities.map(a => a.id)).size).toBe(15); expect(p.resources!.maxSpirituality).toBe(120); expect(p.currentGender).toBe(s.character.gender);
    expect(p.inheritedHistory.join(' ')).toContain('13项'); expect(p.inheritedHistory.join(' ')).toContain('第165周'); expect(p.inheritedTools).toContain('艾达');
    expect(p.story).not.toMatch(/原创G|候选|未核|原核/); expect(p.risk).not.toMatch(/原创G|候选|未核|原核/);
    p.abilities[0]!.mastery++; p.bottles[0]!.source = 'altered view'; expect(s).toEqual(before);
  });
});


describe('BarrenMatriarch explicitly accepted fictional character transformation', () => {
  it.each(['SUCCESS', 'GREAT_SUCCESS'] as const)('declared male unit %s becomes female only at successful confirmed consumption', kind => {
    const before = prepared(kind, false, 'MALE'), roots = structuredClone(oldMotherRoots(before));
    expect(before.character.gender).toBe('MALE'); expect(journal(before).every(e => e.before.gender === 'MALE' && e.after.gender === 'MALE' && e.actor.gender === 'MALE')).toBe(true);
    const s = ba(before, dose), event = journal(s).at(-1)!;
    expect(s.character.gender).toBe('FEMALE'); expect(event.actor.gender).toBe('MALE');
    expect(event.before.gender).toBe('MALE'); expect(event.after.gender).toBe('FEMALE');
    expect(event.command).toEqual(dose); expect(oldMotherRoots(s)).toEqual(roots);
    expect(journal(s).slice(0, -1)).toEqual(journal(before));
    expect(s.injuries).toEqual(before.injuries); expect([s.health, s.spirituality]).toEqual([50, 116]);
    expect(s.character.age).toBe(before.character.age); expect(s.character.appearanceDescription).toBe(before.character.appearanceDescription);
    expect(validateBarrenMatriarchAcquisitionJournal(s)).toBe(true); expect(validateBarrenMatriarchState(s)).toBe(true); assertValidSliceState(s);
    expect(originalCoffinBearer().character.gender).toBe('FEMALE'); expect(before.character.gender).toBe('MALE');
  });
  it.each(['FAILURE', 'GREAT_FAILURE'] as const)('declared male unit %s retains male body and records actual potion costs', kind => {
    const before = prepared(kind, false, 'MALE'), s = ba(before, dose), event = journal(s).at(-1)!;
    expect(s.character.gender).toBe('MALE'); expect(s.progression.sequence).toBe(3);
    expect([event.actor.gender, event.before.gender, event.after.gender]).toEqual(['MALE', 'MALE', 'MALE']);
    expect(s.barrenMatriarch.bottles[0]!.status).toBe('CONSUMED'); expect(s.barrenMatriarch.preparedWeek).toBeNull();
    expect(oldMotherRoots(s)).toEqual(oldMotherRoots(before)); expect(validateBarrenMatriarchAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
    const forged = structuredClone(s); forged.character.gender = 'FEMALE';
    expect(validateBarrenMatriarchAcquisitionJournal(forged)).toBe(false); expect(() => assertValidSliceState(forged)).toThrow();
  });
  it.each(['MALE', 'FEMALE'] as const)('missing or refused acceptance spends nothing and cancellation preserves %s', gender => {
    const s = prepared('SUCCESS', false, gender), before = structuredClone(s);
    for (const command of [{ type: 'CONSUME', bottleId: dose.bottleId, confirmed: true }, { ...dose, acceptFeminization: false }, { ...dose, confirmed: false }]) {
      expect(validateBarrenMatriarchCommand(command)).toBe(false); rejectBarrenMatriarch(s, command);
    }
    expect(s).toEqual(before);
    const left = ba(s, { type: 'LEAVE_PREPARATION' }); expect(left.character.gender).toBe(gender);
    expect([left.health, left.mind, left.spirituality, left.cash, left.actionsRemaining, left.random.cursor]).toEqual([s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining, s.random.cursor]);
    expect(left.barrenMatriarch.bottles[0]!.status).toBe('PLAYER'); expect(oldMotherRoots(left)).toEqual(oldMotherRoots(s));
    expect(projectBarrenMatriarch(s).risk).toContain('成功后角色成为女性'); expect(projectBarrenMatriarch(s).story).toContain('失败保留服药前性别');
  });
  it('rejects coordinated gender rewrites in a middle event and the pre-success actor history', () => {
    const s = ba(prepared('SUCCESS', false, 'MALE'), dose);
    const changed = structuredClone(s), e = journal(changed)[2]!;
    e.actor.gender = e.before.gender = e.after.gender = 'FEMALE';
    expect(validateBarrenMatriarchAcquisitionJournal(changed)).toBe(false); expect(validateBarrenMatriarchJournalContinuity(changed)).toBe(false);
    const rewritten = structuredClone(s); journal(rewritten).at(-1)!.actor.gender = 'FEMALE';
    expect(validateBarrenMatriarchAcquisitionJournal(rewritten)).toBe(false); expect(() => assertValidSliceState(rewritten)).toThrow();
  });
});
