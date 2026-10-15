import { CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createBalancerState, hasBalancerLock, projectBalancer, BALANCER_INHERITED_ABILITY_IDS, validateBalancerAcquisitionJournal, validateBalancerJournalContinuity, validateBalancerCommand, validateBalancerState } from '../../src/domain/balancer/index.js';
import { BALANCER_ABILITY_IDS, BALANCER_PREPARATION_IDS } from '../../src/domain/balancer/types.js';
import { directedInitial3, dose, ba, oldJusticiarRoots, originalChaosHunter, prepared, promoted, recover, recoverResources, rejectBalancer, rejectIntent, step, taught, recoveryNaturalPath, chaosHunterNaturalPath } from './balancer-directed-helper.js';

const journal = (s: SliceState) => s.balancer.acquisitionJournal;

describe('Balancer acquisition: complete483-command recovery source and DECLARED directed units', () => {
  it('uses all483 actual recovery commands while the complete477-command original remains dead', () => {
    const original = readObjectEntry<SliceState>(recoveryNaturalPath, 'final');
    const dead = readObjectEntry<SliceState>(chaosHunterNaturalPath, 'final'), bytes = JSON.stringify(dead), s = originalChaosHunter();
    expect(readObjectEntry<SliceIntent[]>(recoveryNaturalPath, 'commands')).toHaveLength(483);
    expect(readObjectEntry<SliceIntent[]>(chaosHunterNaturalPath, 'commands')).toHaveLength(477);
    expect(dead).toMatchObject({ revision: 478, status: 'DEAD', health: 0, injuryRisk: 3 });
    expect(s).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, week: 115, revision: 484, status: 'ACTIVE', health: 70, mind: 100, spirituality: 116, cash: 400, actionsRemaining: 1, injuryRisk: 0, random: { seed: 'arbiter-natural-v066', cursor: 310 }, progression: { sequence: 3, acting: 100, promotionWeek: 9 } });
    expect(s.character.coreStats).toEqual({ physique: 29, perception: 24, will: 24, knowledge: 20 });
    expect(s.injuries).toEqual(original.injuries); expect(s.injuries.map(i => [i.severity, i.acquiredRevision, i.treatedRevision])).toEqual([['HEAVY', 482, null]]);
    expect(s.chaosHunter.promotionWeek).toBe(106); expect(s.chaosHunter.encounter).toMatchObject({ status: 'RESOLVED', targetId: 'CH3-EDRIC', enemyStatus: 'SURRENDERED', enemyHealth: 70 });
    expect(Object.keys(s.progression.mastery)).toEqual([...BALANCER_INHERITED_ABILITY_IDS]);
    expect(s.progression.mastery).toEqual(original.progression.mastery); expect(Object.values(s.progression.mastery).filter(m => m === 0)).toHaveLength(5);
    expect(s.balancer).toEqual(createBalancerState()); expect(JSON.stringify(dead)).toBe(bytes); assertValidSliceState(s);
  }, 30_000);
  it('declares W118/cash100000/AP100/cursor before the journal and retains real H70/M100/S116/injury', () => {
    const original = originalChaosHunter(), s = directedInitial3();
    expect(s).toMatchObject({ week: 118, cash: 100000, actionsRemaining: 100, weeklyBudget: 100, health: 70, mind: 100, spirituality: 116, injuryRisk: 0 });
    expect(s.date).toEqual(addGameDays(original.date, 21)); expect(s.random.seed).toBe(original.random.seed);
    expect(s.random.cursor).toBeGreaterThanOrEqual(original.random.cursor); expect(s.random.cursor).toBeLessThan(original.random.cursor + 512);
    expect(oldJusticiarRoots(s)).toEqual(oldJusticiarRoots(original)); expect(s.injuries).toEqual(original.injuries);
    expect(s.character).toEqual(original.character); expect(s.progression).toEqual(original.progression);
    expect(journal(s)).toEqual([]); expect(originalChaosHunter()).toEqual(original);
  });
  it('keeps independent defaults and hides the stage from unrelated, earlier and S1/S0 characters', () => {
    const s = createSliceRun('balancer-hidden', sliceDefaultCreationSelection, 'balancer-hidden');
    expect(projectBalancer(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], resources: null });
    rejectBalancer(s, { type: 'LEARN_GUIDANCE' });
    const a = createBalancerState(); a.bottles[0]!.labourSteps = 5;
    expect(s.balancer.bottles[0]!.labourSteps).toBe(0);
    for (const sequence of [4, 1, 0] as const) { const t = originalChaosHunter(); t.progression.sequence = sequence; expect(projectBalancer(t).discovered).toBe(false); rejectBalancer(t, { type: 'LEARN_GUIDANCE' }); }
  });
  it('rejects changed lineage and missing or invented skills before accepting new costs', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.chaosHunter.promotionWeek = null; }, s => { s.chaosHunter.imperativeMageActingAtPromotion = 99; },
      s => { s.progression.pathwayId = 'hermit'; }, s => { delete s.progression.mastery['justiciar.s3.bounded-order']; },
      s => { s.progression.mastery['justiciar.s2.invented'] = 0; },
      s => { s.arbiter.bottles.find(b => b.status === 'CONSUMED' && ['SUCCESS', 'GREAT_SUCCESS'].includes(b.outcome ?? ''))!.acquiredWeek = s.week + 1; },
    ];
    for (const [index, change] of mutations.entries()) {
      const s = directedInitial3(); change(s);
      try { rejectBalancer(s, { type: 'LEARN_GUIDANCE' }); } catch (cause) { throw new Error(`Lineage mutation ${index} was accepted`, { cause }); }
    }
  });
  it('requires twelve complete weeks from actual promotion106, so week115 cannot consume', () => {
    let s = taught('SUCCESS', false);
    expect(projectBalancer(s).digestion).toContain('9/12');
    for (const taskId of BALANCER_PREPARATION_IDS) s = ba(s, { type: 'PREPARE_TASK', taskId });
    s = ba(s, { type: 'BUY_POTION', bottleId: 'balancer-potion-1' });
    rejectBalancer(s, { type: 'PREPARE_PROMOTION' }); rejectBalancer(s, dose);
    const atBoundary = prepared(); expect(atBoundary.week).toBe(118); expect(projectBalancer(atBoundary).digestion).toContain('12/12');
    expect(ba(atBoundary, dose).balancer.promotionWeek).toBe(118);
  });
  it('requires each actual old report and reflection before current preparation', () => {
    for (const missing of ['chaos-hunter-life-paired-line', 'chaos-hunter-life-withdrawn-line', 'chaos-hunter-life-own-line', 'chaos-hunter-reflection']) {
      const s = prepared(); s.seer.completedSources = s.seer.completedSources.filter(id => id !== missing);
      rejectBalancer(s, dose); expect(validateBalancerAcquisitionJournal(s)).toBe(false);
    }
    const incomplete = prepared(); incomplete.chaosHunter.life.reflected = false; rejectBalancer(incomplete, dose);
  });
  it('rejects resurrecting or backdating an old consumed original at the whole-state save boundary', () => {
    const restored = originalChaosHunter(); restored.arbiter.bottles[0]!.status = 'PLAYER';
    expect(restored.arbiter.bottles[0]!.consumedWeek).toBe(6); expect(() => assertValidSliceState(restored)).toThrow();
    const backdated = originalChaosHunter(); backdated.arbiter.bottles[0]!.acquiredWeek = 118;
    expect(() => assertValidSliceState(backdated)).toThrow();
  });
  it('guidance costs exactly500 and one action without granting skills or inventory', () => {
    const before = directedInitial3(), payload = { type: 'LEARN_GUIDANCE' } as const, s = ba(before, payload), e = journal(s)[0]!;
    expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]); expect(s.progression.mastery).toEqual(before.progression.mastery);
    expect(s.balancer.bottles.every(b => b.status === 'SUPPLIER')).toBe(true);
    expect([e.before.cash - e.after.cash, e.before.actions - e.after.actions]).toEqual([500, 1]);
    expect([e.check, e.randomBefore, e.randomAfter]).toEqual([null, null, null]);
    expect(e.actor).toEqual({ name: before.character.name, gender: before.character.gender, age: before.character.age, sourceHistoryDigest: null, pathwayId: 'justiciar', chaosHunterPromotionWeek: 106, arbiterPromotionWeek: 9 });
    expect(oldJusticiarRoots(s)).toEqual(oldJusticiarRoots(before)); expect(payload).toEqual({ type: 'LEARN_GUIDANCE' });
    expect(before.balancer.guidanceKnown).toBe(false); rejectBalancer(s, payload);
  });
});

describe('Balancer paid acquisition, preparations, four real potion tiers and bounded resupply', () => {
  it('five actual jobs discount only their specific bottle and still require900', () => {
    let s = taught(); const before = structuredClone(s);
    for (let n = 0; n < 5; n++) s = ba(s, { type: 'POTION_WORK', bottleId: 'balancer-potion-2' });
    expect([s.actionsRemaining, s.cash]).toEqual([before.actionsRemaining - 5, before.cash]);
    expect(s.balancer.bottles[1]).toMatchObject({ labourSteps: 5, status: 'SUPPLIER' }); expect(s.balancer.bottles[0]!.labourSteps).toBe(0);
    rejectBalancer(s, { type: 'POTION_WORK', bottleId: 'balancer-potion-2' });
    s = ba(s, { type: 'BUY_POTION', bottleId: 'balancer-potion-2' }); expect(s.cash).toBe(before.cash - 900);
    expect(s.balancer.bottles[1]).toMatchObject({ status: 'PLAYER', acquiredWeek: 118 }); rejectBalancer(s, { type: 'BUY_POTION', bottleId: 'balancer-potion-2' });
    expect(validateBalancerAcquisitionJournal(s)).toBe(true); rejectBalancer(s, { type: 'PREPARE_PROMOTION' });
  });
  it('four jobs give no partial credit and earned credit never transfers to another bottle', () => {
    let s = taught(); for (let n = 0; n < 4; n++) s = ba(s, { type: 'POTION_WORK', bottleId: 'balancer-potion-1' });
    const cash = s.cash; s = ba(s, { type: 'BUY_POTION', bottleId: 'balancer-potion-1' }); expect(s.cash).toBe(cash - 6400);
    s = ba(s, { type: 'BUY_POTION', bottleId: 'balancer-potion-2' }); expect(s.cash).toBe(cash - 12800);
    const credited = prepared('SUCCESS', true); expect([credited.cash, credited.actionsRemaining]).toEqual([98460, 90]);
  });
  it.each([[20, 99], [100, 40], [1, 99], [100, 1]] as const)('requires health>20 and mind>40 before site preparation (%s/%s)', (health, mind) => {
    const initial = directedInitial3(); initial.health = health; initial.mind = mind;
    let s = ba(initial, { type: 'LEARN_GUIDANCE' });
    for (const taskId of BALANCER_PREPARATION_IDS) s = ba(s, { type: 'PREPARE_TASK', taskId });
    s = ba(s, { type: 'BUY_POTION', bottleId: dose.bottleId });
    rejectBalancer(s, { type: 'PREPARE_PROMOTION' }); rejectBalancer(s, dose);
    expect(s.balancer.bottles[0]!.status).toBe('PLAYER'); expect(s.injuries).toEqual(initial.injuries);
  });
  it('requires all three distinct preparations and cancellation refunds neither140 nor an action', () => {
    let s = taught(); const ap = s.actionsRemaining;
    for (const taskId of BALANCER_PREPARATION_IDS) { rejectBalancer(s, { type: 'PREPARE_PROMOTION' }); s = ba(s, { type: 'PREPARE_TASK', taskId }); rejectBalancer(s, { type: 'PREPARE_TASK', taskId }); }
    expect(s.actionsRemaining).toBe(ap - 3); rejectBalancer(s, { type: 'PREPARE_PROMOTION' });
    const ready = prepared(), e = journal(ready).at(-1)!;
    expect([e.before.cash - e.after.cash, e.before.actions - e.after.actions]).toEqual([140, 1]);
    expect([ready.cash, ready.actionsRemaining]).toEqual([92960, 95]); expect(hasBalancerLock(ready)).toBe(true);
    rejectIntent(ready, { type: 'ACTION', action: 'REST' }); rejectBalancer(ready, { type: 'LEARN_GUIDANCE' });
    const left = ba(ready, { type: 'LEAVE_PREPARATION' });
    expect([left.cash, left.actionsRemaining, left.health, left.spirituality]).toEqual([ready.cash, ready.actionsRemaining, ready.health, ready.spirituality]);
    expect(left.balancer.bottles[0]!.status).toBe('PLAYER'); expect(left.balancer.preparedWeek).toBeNull(); expect(left.balancer.preparations).toEqual(ready.balancer.preparations);
    expect(oldJusticiarRoots(left)).toEqual(oldJusticiarRoots(ready)); rejectBalancer(left, dose);
    const retried = ba(left, { type: 'PREPARE_PROMOTION' }); expect([retried.cash, retried.actionsRemaining]).toEqual([left.cash - 140, left.actionsRemaining - 1]);
  });
  it.each(BALANCER_PREPARATION_IDS)('owning a real potion never substitutes for missing preparation %s', omitted => {
    let s = ba(taught(), { type: 'BUY_POTION', bottleId: 'balancer-potion-1' });
    for (const taskId of BALANCER_PREPARATION_IDS.filter(id => id !== omitted)) s = ba(s, { type: 'PREPARE_TASK', taskId });
    rejectBalancer(s, { type: 'PREPARE_PROMOTION' }); rejectBalancer(s, dose);
    s = ba(s, { type: 'PREPARE_TASK', taskId: omitted }); expect(ba(s, { type: 'PREPARE_PROMOTION' }).balancer.preparedWeek).toBe(118);
  });
  it.each(['SUCCESS', 'GREAT_SUCCESS'] as const)('directed unit %s gives exactly15→17 without healing, resource refills or rewriting history', kind => {
    const before = prepared(kind), snapshot = structuredClone(before), s = ba(before, dose), e = journal(s).at(-1)!;
    const rng = new DeterministicActionRandomStream(before.random.seed, before.random.cursor);
    expect(e.check).toEqual(resolveNormalCheck({ ability: 'will', baseAbility: before.character.coreStats.will, difficulty: 30, modifiers: [], roll: rng.nextInt(1, 100) }));
    expect(e.check!.tier).toBe(kind); expect([e.randomBefore, e.randomAfter, s.random.cursor]).toEqual([before.random.cursor, rng.cursor, rng.cursor]);
    expect(s.progression.sequence).toBe(2); expect(Object.keys(s.progression.mastery)).toEqual([...BALANCER_INHERITED_ABILITY_IDS, ...BALANCER_ABILITY_IDS]);
    for (const [id, mastery] of Object.entries(before.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    for (const id of BALANCER_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const stat of ['physique', 'perception', 'knowledge', 'will'] as const) expect(s.character.coreStats[stat]).toBe(before.character.coreStats[stat] + 1);
    expect([s.health, s.spirituality, s.mind, s.injuryRisk, s.character.gender]).toEqual([70, 116, kind === 'GREAT_SUCCESS' ? 92 : 85, 0, before.character.gender]);
    expect(s.injuries).toEqual(before.injuries); expect(oldJusticiarRoots(s)).toEqual(oldJusticiarRoots(before)); expect(s.seer.completedSources).toEqual(before.seer.completedSources);
    expect(s.balancer.chaosHunterActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
    expect(s.balancer.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind, preparationWeek: 118, consumedWeek: 118 });
    expect([s.actionsRemaining, s.cash]).toEqual([before.actionsRemaining, before.cash]); expect(before).toEqual(snapshot);
    expect(validateBalancerAcquisitionJournal(s)).toBe(true); assertValidSliceState(s); rejectBalancer(s, dose);
  });
  it('does not refill a declared pre-journal partial health or spirituality budget on successful promotion', () => {
    let s = directedInitial3('SUCCESS'); s.health = 83; s.mind = 85; s.spirituality = 17;
    s = ba(s, { type: 'LEARN_GUIDANCE' }); for (const taskId of BALANCER_PREPARATION_IDS) s = ba(s, { type: 'PREPARE_TASK', taskId });
    s = ba(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = ba(s, { type: 'PREPARE_PROMOTION' }); s = ba(s, dose);
    expect([s.health, s.mind, s.spirituality]).toEqual([83, 70, 17]); expect(projectBalancer(s).resources!.maxSpirituality).toBe(120);
    expect(validateBalancerAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
  });
  it.each([['FAILURE', 55, 75, 30], ['GREAT_FAILURE', 45, 55, 60]] as const)('directed unit %s consumes the original bottle with exact retained costs', (kind, health, mind, pollution) => {
    const before = prepared(kind), s = ba(before, dose);
    expect(s).toMatchObject({ health, mind, spirituality: 116, progression: { sequence: 3, acting: 100 } }); expect(s.seer.pollution).toBe(pollution);
    expect(s.balancer.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind, consumedWeek: 118, preparationWeek: 118 }); expect(s.balancer.preparedWeek).toBeNull();
    expect([s.cash, s.actionsRemaining]).toEqual([before.cash, before.actionsRemaining]); expect(s.balancer.preparations).toEqual(before.balancer.preparations);
    expect(oldJusticiarRoots(s)).toEqual(oldJusticiarRoots(before)); expect(s.injuries).toEqual(before.injuries); expect(Object.keys(s.progression.mastery)).toHaveLength(15);
    expect(s.seer.completedSources).toEqual(before.seer.completedSources); expect(validateBalancerAcquisitionJournal(s)).toBe(true); assertValidSliceState(s); rejectBalancer(s, dose);
    const bought = ba(s, { type: 'BUY_POTION', bottleId: 'balancer-potion-2' }); expect(ba(bought, { type: 'PREPARE_PROMOTION' }).cash).toBe(s.cash - 6400 - 140);
  });
  it('real REST and actual medical decline restore resources while retaining the original untreated injury', () => {
    const before = promoted(), commands: SliceIntent[] = [], s = recoverResources(before, commands);
    expect(commands.some(c => c.type === 'ACTION' && c.action === 'REST')).toBe(true);
    expect(commands.some(c => c.type === 'EVENT_CHOICE' && c.choiceId === 'DECLINE')).toBe(true);
    expect([s.health, s.mind, s.spirituality, s.injuryRisk]).toEqual([100, 100, 120, 0]); expect(s.injuries).toEqual(before.injuries);
    expect(s.cash).toBe(before.cash); expect(s.random).toEqual(before.random); expect(oldJusticiarRoots(s)).toEqual(oldJusticiarRoots(before));
    expect(s.balancer).toEqual(before.balancer); assertValidSliceState(s);
  });
  it('real clinic payment and later REST remove the actual injury without rewriting the source fixture', () => {
    const before = promoted(), commands: SliceIntent[] = [], s = recover(before, commands);
    expect(commands.filter(c => c.type === 'EVENT_CHOICE' && c.choiceId === 'PAY')).toHaveLength(1);
    expect(s.cash).toBe(before.cash - 60); expect([s.health, s.mind, s.spirituality]).toEqual([100, 100, 120]); expect(s.injuries).toEqual([]);
    expect(oldJusticiarRoots(s)).toEqual(oldJusticiarRoots(before)); expect(originalChaosHunter().injuries).toHaveLength(1); assertValidSliceState(s);
  });
  it('uses only declared low pre-journal resources and confines the minimum1 support to the actual potion', () => {
    let s = directedInitial3('GREAT_FAILURE'); s.health = 21; s.mind = 41;
    s = ba(s, { type: 'LEARN_GUIDANCE' }); for (const taskId of BALANCER_PREPARATION_IDS) s = ba(s, { type: 'PREPARE_TASK', taskId });
    s = ba(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = ba(s, { type: 'PREPARE_PROMOTION' }); s = ba(s, dose);
    expect(s).toMatchObject({ status: 'ACTIVE', health: 1, mind: 1, progression: { sequence: 3 } });
    const bought = ba(s, { type: 'BUY_POTION', bottleId: 'balancer-potion-2' }); rejectBalancer(bought, { type: 'PREPARE_PROMOTION' });
    expect(s.balancer.bottles[0]!.status).toBe('CONSUMED'); expect(validateBalancerAcquisitionJournal(s)).toBe(true);
  });
  it('requires three actually failed original bottles and next-week delivery of independent new stock', () => {
    let s = taught('THREE_FAILURES'); rejectBalancer(s, { type: 'REQUEST_SUPPLY' }); rejectBalancer(s, { type: 'RECEIVE_SUPPLY' });
    for (const taskId of BALANCER_PREPARATION_IDS) s = ba(s, { type: 'PREPARE_TASK', taskId });
    const originalRoots = structuredClone(oldJusticiarRoots(s));
    for (const bottleId of ['balancer-potion-1', 'balancer-potion-2', 'balancer-potion-3']) {
      s = recoverResources(s); s = ba(s, { type: 'BUY_POTION', bottleId }); s = ba(s, { type: 'PREPARE_PROMOTION' }); s = ba(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    expect(s.balancer.bottles.every(b => b.status === 'CONSUMED' && b.outcome === 'FAILURE')).toBe(true);
    expect(s.cash).toBe(100000 - 500 - 3 * (6400 + 140));
    const old = structuredClone(s.balancer.bottles), beforeAP = s.actionsRemaining;
    s = ba(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(beforeAP - 1); expect(s.balancer.bottles).toEqual(old); rejectBalancer(s, { type: 'RECEIVE_SUPPLY' });
    // Advance the unit continuation through real REST actions, never editing the
    // week/date or a resource once the first Balancer journal has been recorded.
    const requestWeek = s.week, requestDate = structuredClone(s.date), remaining = s.actionsRemaining;
    let nextWeek = s;
    for (let n = 0; n < remaining; n++) nextWeek = step(nextWeek, { type: 'ACTION', action: 'REST' });
    expect(nextWeek.week).toBe(requestWeek + 1); expect(nextWeek.date).toEqual(addGameDays(requestDate, 7));
    const received = ba(nextWeek, { type: 'RECEIVE_SUPPLY' });
    expect(received.balancer.bottles.slice(0, 3)).toEqual(old); expect(received.balancer.bottles.slice(3).map(b => b.id)).toEqual(['balancer-potion-4', 'balancer-potion-5', 'balancer-potion-6']);
    expect(received.balancer.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.stockedWeek === 119 && b.acquiredWeek === null && b.labourSteps === 0 && b.source.includes(b.id))).toBe(true);
    expect([received.cash, received.actionsRemaining]).toEqual([nextWeek.cash, nextWeek.actionsRemaining]); expect(oldJusticiarRoots(received)).toEqual(originalRoots);
    expect(validateBalancerAcquisitionJournal(received)).toBe(true); assertValidSliceState(received); rejectBalancer(received, { type: 'RECEIVE_SUPPLY' });
  });
  it('closes every predecessor acquisition command after the real Balancer promotion', () => {
    const s = promoted();
    for (const type of ['ARBITER', 'SHERIFF', 'INTERROGATOR', 'JUDGE', 'PUNISHMENT_KNIGHT', 'IMPERATIVE_MAGE', 'CHAOS_HUNTER'] as const) rejectIntent(s, { type, command: { type: 'LEARN_GUIDANCE' } } as SliceIntent);
    rejectBalancer(s, { type: 'LEARN_GUIDANCE' }); rejectBalancer(s, { type: 'PREPARE_PROMOTION' }); rejectBalancer(s, { type: 'REQUEST_SUPPLY' });
  });
  it('rejects unknown fields, false confirmation, wrong source IDs and invented ritual commands without mutation', () => {
    const s = prepared();
    for (const command of [{ ...dose, confirmed: false }, { ...dose, free: true }, { type: 'BUY_POTION', bottleId: 'chaos-hunter-potion-1' }, { type: 'PREPARE_TASK', taskId: 'REVIEW_DISASTER' }, { type: 'LEARN_GUIDANCE', free: true }, { type: 'RITUAL_CONTAIN' }, { type: 'RITUAL_REVIEW', stopped: true }]) {
      expect(validateBalancerCommand(command)).toBe(false); rejectBalancer(s, command);
    }
    rejectBalancer(s, { ...dose, bottleId: 'balancer-potion-99' });
  });
});

const acquisitionMutations: [string, (s: SliceState) => void][] = [
  ['altered sealed history digest', s => { journal(s).at(-1)!.actor.sourceHistoryDigest = '0'.repeat(64); }],
  ['changed original age', s => { journal(s)[0]!.actor.age++; }],
  ['refunded guidance', s => { journal(s)[0]!.after.cash++; }],
  ['free preparation', s => { journal(s).find(e => e.command.type === 'PREPARE_PROMOTION')!.after.actions++; }],
  ['unearned mastery', s => { journal(s).at(-1)!.after.mastery[BALANCER_ABILITY_IDS[0]] = 8; }],
  ['altered dose cursor', s => { journal(s).at(-1)!.randomBefore!++; }],
  ['altered dose check', s => { journal(s).at(-1)!.check!.difficulty++; }],
  ['fabricated injury', s => { journal(s).at(-1)!.after.injuries.push({ id: 'fabricated', severity: 'LIGHT', acquiredRevision: 1, treatedRevision: null }); }],
  ['rewritten source IDs', s => { journal(s).at(-1)!.after.completedSources[0] = 'counterfeit-source'; }],
  ['missing purchase', s => { s.balancer.acquisitionJournal = journal(s).filter(e => e.command.type !== 'BUY_POTION'); }],
  ['other actor', s => { journal(s)[0]!.actor.name = 'Counterfeit'; }],
  ['other prior promotion week', s => { journal(s)[0]!.actor.chaosHunterPromotionWeek--; }],
  ['relabelled original bottle', s => { s.balancer.bottles[0]!.id = 'balancer-potion-2'; }],
  ['restored consumed original', s => { s.balancer.bottles[0]!.status = 'PLAYER'; }],
  ['invented supplier provenance', s => { s.balancer.bottles[0]!.source += ' free'; }],
  ['extra evidence field', s => { Object.assign(journal(s)[0]!, { free: true }); }],
  ['extra stage field', s => { Object.assign(s.balancer, { free: true }); }],
];
describe('Balancer acquisition replay rejects falsified evidence and cross-resource changes', () => {
  it.each(acquisitionMutations)('rejects %s', (_name, change) => {
    const s = promoted(); expect(validateBalancerState(s)).toBe(true); change(s);
    expect(validateBalancerState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it.each(['health', 'mind', 'spirituality', 'cash', 'actions', 'pollution', 'injuryRisk'] as const)('rejects a discontinuous %s budget even when both event endpoints are adjusted', field => {
    const s = promoted(), event = journal(s)[1]!;
    const delta = field === 'health' || field === 'mind' || field === 'spirituality' ? -1 : 1;
    event.before[field] += delta; event.after[field] += delta;
    expect(validateBalancerJournalContinuity(s)).toBe(false); expect(validateBalancerAcquisitionJournal(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it.each(['health', 'mind', 'spirituality', 'cash', 'actionsRemaining', 'injuryRisk'] as const)('rejects rewriting immediate post-potion %s without a real intervening command', field => {
    const s = promoted(); s[field] += field === 'health' || field === 'spirituality' ? -1 : 1;
    expect(validateBalancerAcquisitionJournal(s)).toBe(false); expect(validateBalancerState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it('rejects revision collisions, backdated checks and deleted consumed source prefixes', () => {
    const collision = promoted(); journal(collision)[1]!.revision = journal(collision)[0]!.revision;
    expect(validateBalancerJournalContinuity(collision)).toBe(false); expect(validateBalancerState(collision)).toBe(false);
    const backdated = promoted(); journal(backdated).at(-1)!.date = originalChaosHunter().date;
    expect(validateBalancerAcquisitionJournal(backdated)).toBe(false);
    const missing = promoted(); missing.seer.completedSources.shift();
    expect(validateBalancerAcquisitionJournal(missing)).toBe(false); expect(validateBalancerState(missing)).toBe(false);
  });
  it('rejects a forged no-draw cursor after an adjacent post-failure purchase', () => {
    const failed = ba(prepared('FAILURE'), dose), bought = ba(failed, { type: 'BUY_POTION', bottleId: 'balancer-potion-2' });
    expect(bought.random.cursor).toBe(failed.random.cursor); expect(validateBalancerJournalContinuity(bought)).toBe(true);
    bought.random.cursor++;
    expect(validateBalancerJournalContinuity(bought)).toBe(false); expect(() => assertValidSliceState(bought)).toThrow();
  });
  it('replays the whole directed command continuation identically without mutating input or payloads', () => {
    const initial = directedInitial3(), original = structuredClone(initial), commands: SliceIntent[] = [];
    let s = ba(initial, { type: 'LEARN_GUIDANCE' }, commands);
    for (const taskId of BALANCER_PREPARATION_IDS) s = ba(s, { type: 'PREPARE_TASK', taskId }, commands);
    s = ba(s, { type: 'BUY_POTION', bottleId: 'balancer-potion-1' }, commands); s = ba(s, { type: 'PREPARE_PROMOTION' }, commands); s = ba(s, dose, commands);
    const payloads = structuredClone(commands); let replayed = structuredClone(initial);
    for (const command of commands) replayed = step(replayed, command);
    expect(replayed).toEqual(s); expect(initial).toEqual(original); expect(commands).toEqual(payloads);
    expect(validateBalancerJournalContinuity(replayed)).toBe(true); expect(validateBalancerAcquisitionJournal(replayed)).toBe(true);
  });
  it('projects only actual knowledge, exact17 abilities and independent state copies', () => {
    const s = promoted(), before = structuredClone(s), p = projectBalancer(s);
    expect(p.formulaKnown).toBe(false); expect(p.formula).toEqual([]); expect(p.abilities.map(a => a.id)).toEqual([...BALANCER_INHERITED_ABILITY_IDS, ...BALANCER_ABILITY_IDS]);
    expect(new Set(p.abilities.map(a => a.id)).size).toBe(17); expect(p.resources!.maxSpirituality).toBe(120); expect(p.currentGender).toBe(s.character.gender);
    expect(p.inheritedHistory.join(' ')).toContain('15项'); expect(p.inheritedHistory.join(' ')).toContain('第106周'); expect(p.inheritedTools).toContain('米拉');
    expect(p.story).not.toMatch(/原创G|候选|未核|原核/); expect(p.risk).not.toMatch(/原创G|候选|未核|原核/);
    p.abilities[0]!.mastery++; p.bottles[0]!.source = 'altered view'; expect(s).toEqual(before);
  });
});
