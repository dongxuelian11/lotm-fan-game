import { CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createFateProphetState, hasFateProphetLock, projectFateProphet, FATE_PROPHET_INHERITED_ABILITY_IDS, validateFateProphetAcquisitionJournal, validateFateProphetJournalContinuity, validateFateProphetCommand, validateFateProphetState } from '../../src/domain/fate-prophet/index.js';
import { FATE_PROPHET_ABILITY_IDS, FATE_PROPHET_PREPARATION_IDS } from '../../src/domain/fate-prophet/types.js';
import { directedInitial3, dose, fp, oldWheelRoots, originalChaosWalker, prepared, promoted, recover, rejectFateProphet, rejectIntent, step, taught, chaosWalkerNaturalPath } from './fate-prophet-directed-helper.js';

const journal = (s: SliceState) => s.fateProphet.acquisitionJournal;

describe('FateProphet acquisition: actual complete551-command S3 source and explicitly directed units', () => {
  it('retains the complete immutable original source byte hash', async () => {
    const hash = createHash('sha256'); for await (const bytes of createReadStream(chaosWalkerNaturalPath)) hash.update(bytes);
    expect(hash.digest('hex')).toBe('eb42c6205279a77bd6c19f7ea0946181e2b6df8e31201f8ba1126fa51d928ce2');
  });
  it('migrates the exact living source with15 skills, two old untreated heavy wounds, original luck and actual dead Gareth', () => {
    const original = readObjectEntry<SliceState>(chaosWalkerNaturalPath, 'final'), s = originalChaosWalker();
    expect(readObjectEntry<SliceIntent[]>(chaosWalkerNaturalPath, 'commands')).toHaveLength(551);
    expect(s).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, week: 140, revision: 552, status: 'ACTIVE', health: 60, mind: 100, spirituality: 120, cash: 630, actionsRemaining: 3, injuryRisk: 2, random: { seed: 'monster-natural-v060', cursor: 219 }, progression: { sequence: 3, acting: 100, promotionWeek: 6 } });
    expect(s.character.coreStats).toEqual({ physique: 25, perception: 24, will: 22, knowledge: 23 });
    expect(s.injuries).toEqual([
      { id: 'monster-rebuild-natural:combat:1:PLAYER:333:0', severity: 'HEAVY', acquiredRevision: 333, treatedRevision: null },
      { id: 'monster-rebuild-natural:combat:1:PLAYER:547:1', severity: 'HEAVY', acquiredRevision: 547, treatedRevision: null },
      { id: 'monster-rebuild-natural:combat:3:PLAYER:549:2', severity: 'LIGHT', acquiredRevision: 549, treatedRevision: null },
    ]);
    expect(s.winner.luck).toEqual({ stored: 0, accumulated: 12, spent: 12, lastAccumulateWeek: 138 });
    expect(s.chaosWalker.promotionWeek).toBe(130); expect(oldWheelRoots(s)).toEqual(oldWheelRoots(original));
    expect(s.chaosWalker.encounter).toMatchObject({ status: 'RESOLVED', enemyStatus: 'DEAD', enemyHealth: 0, enemyMind: 100, enemySpirituality: 57, terminal: { round: 5, outcome: 'ENEMY_DEAD' } });
    expect(s.misfortuneMage.encounter.enemyStatus).toBe('SURRENDERED');
    expect(Object.keys(s.progression.mastery)).toEqual([...FATE_PROPHET_INHERITED_ABILITY_IDS]);
    for (const id of ['wheel.s7.passive-luck', 'wheel.s6.disaster-awareness', 'wheel.s6.disaster-attraction', 'wheel.s5.luck-reserve', 'wheel.s5.ill-fortune']) expect(s.progression.mastery[id]).toBe(0);
    expect(s.fateProphet).toEqual(createFateProphetState()); assertValidSliceState(s);
  });
  it('declares pre-journal unit budgets and cursor without editing, healing or refilling the original source', () => {
    const original = originalChaosWalker(), s = directedInitial3();
    expect(s).toMatchObject({ week: 142, cash: 100000, actionsRemaining: 100, weeklyBudget: 100, health: 60, mind: 100, spirituality: 120, injuryRisk: 2 });
    expect(s.date).toEqual(addGameDays(original.date, 14)); expect(s.random.seed).toBe(original.random.seed);
    expect(s.random.cursor).toBeGreaterThanOrEqual(original.random.cursor); expect(s.random.cursor).toBeLessThan(original.random.cursor + 512);
    expect(oldWheelRoots(s)).toEqual(oldWheelRoots(original)); expect(s.injuries).toEqual(original.injuries);
    expect(s.character).toEqual(original.character); expect(s.progression).toEqual(original.progression);
    expect(journal(s)).toEqual([]); expect(originalChaosWalker()).toEqual(original);
  });
  it('keeps independent defaults and hides the stage from unrelated, earlier and S1/S0 characters', () => {
    const s = createSliceRun('fate-prophet-hidden', sliceDefaultCreationSelection, 'fate-prophet-hidden');
    expect(projectFateProphet(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], resources: null });
    rejectFateProphet(s, { type: 'LEARN_GUIDANCE' });
    const a = createFateProphetState(); a.bottles[0]!.labourSteps = 5;
    expect(s.fateProphet.bottles[0]!.labourSteps).toBe(0);
    for (const sequence of [4, 1, 0] as const) { const t = originalChaosWalker(); t.progression.sequence = sequence; expect(projectFateProphet(t).discovered).toBe(false); rejectFateProphet(t, { type: 'LEARN_GUIDANCE' }); }
  });
  it('rejects changed lineage and missing or invented skills before accepting new costs', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.chaosWalker.promotionWeek = null; }, s => { s.chaosWalker.misfortuneMageActingAtPromotion = 99; },
      s => { s.progression.pathwayId = 'hermit'; }, s => { delete s.progression.mastery['wheel.s3.deviation-buffer']; },
      s => { s.progression.mastery['wheel.s2.invented'] = 0; },
      s => { s.monster.bottles.find(b => b.status === 'CONSUMED' && ['SUCCESS', 'GREAT_SUCCESS'].includes(b.outcome ?? ''))!.acquiredWeek = s.week + 1; },
    ];
    for (const [index, change] of mutations.entries()) {
      const s = directedInitial3(); change(s);
      try { rejectFateProphet(s, { type: 'LEARN_GUIDANCE' }); } catch (cause) { throw new Error(`Lineage mutation ${index} was accepted`, { cause }); }
    }
  });
  it('requires twelve complete weeks from actual promotion130, so week140 cannot consume', () => {
    let s = taught('SUCCESS', false);
    expect(projectFateProphet(s).digestion).toContain('10/12');
    for (const taskId of FATE_PROPHET_PREPARATION_IDS) s = fp(s, { type: 'PREPARE_TASK', taskId });
    s = fp(s, { type: 'BUY_POTION', bottleId: 'fate-prophet-potion-1' });
    rejectFateProphet(s, { type: 'PREPARE_PROMOTION' }); rejectFateProphet(s, dose);
    const atBoundary = prepared(); expect(atBoundary.week).toBe(142); expect(projectFateProphet(atBoundary).digestion).toContain('12/12');
    expect(fp(atBoundary, dose).fateProphet.promotionWeek).toBe(142);
  });
  it('requires each actual old report and reflection before current preparation', () => {
    for (const missing of ['chaos-walker-life-cart-fork', 'chaos-walker-life-revoked-draw', 'chaos-walker-life-counterexample', 'chaos-walker-reflection']) {
      const s = prepared(); s.seer.completedSources = s.seer.completedSources.filter(id => id !== missing);
      rejectFateProphet(s, dose); expect(validateFateProphetAcquisitionJournal(s)).toBe(false);
    }
    const incomplete = prepared(); incomplete.chaosWalker.life.reflected = false; rejectFateProphet(incomplete, dose);
  });
  it('rejects resurrecting or backdating an old consumed original at the whole-state save boundary', () => {
    const restored = originalChaosWalker(); restored.monster.bottles[0]!.status = 'PLAYER';
    expect(restored.monster.bottles[0]!.consumedWeek).toBe(6); expect(() => assertValidSliceState(restored)).toThrow();
    const backdated = originalChaosWalker(); backdated.monster.bottles[0]!.acquiredWeek = 142;
    expect(() => assertValidSliceState(backdated)).toThrow();
  });
  it('guidance costs exactly500 and one action without granting skills or inventory', () => {
    const before = directedInitial3(), payload = { type: 'LEARN_GUIDANCE' } as const, s = fp(before, payload), e = journal(s)[0]!;
    expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]); expect(s.progression.mastery).toEqual(before.progression.mastery);
    expect(s.fateProphet.bottles.every(b => b.status === 'SUPPLIER')).toBe(true);
    expect([e.before.cash - e.after.cash, e.before.actions - e.after.actions]).toEqual([500, 1]);
    expect([e.check, e.randomBefore, e.randomAfter]).toEqual([null, null, null]);
    expect(e.source).toEqual({ seed: before.random.seed, cursorBefore: before.random.cursor, cursorAfter: before.random.cursor });
    expect(e.actor).toEqual({ name: before.character.name, gender: before.character.gender, pathwayId: 'wheel', chaosWalkerPromotionWeek: 130, monsterPromotionWeek: 6 });
    expect(oldWheelRoots(s)).toEqual(oldWheelRoots(before)); expect(payload).toEqual({ type: 'LEARN_GUIDANCE' });
    expect(before.fateProphet.guidanceKnown).toBe(false); rejectFateProphet(s, payload);
  });
});

describe('FateProphet paid acquisition, preparations, four real potion tiers and bounded resupply', () => {
  it('five actual jobs discount only their specific bottle and still require900', () => {
    let s = taught(); const before = structuredClone(s);
    for (let n = 0; n < 5; n++) s = fp(s, { type: 'POTION_WORK', bottleId: 'fate-prophet-potion-2' });
    expect([s.actionsRemaining, s.cash]).toEqual([before.actionsRemaining - 5, before.cash]);
    expect(s.fateProphet.bottles[1]).toMatchObject({ labourSteps: 5, status: 'SUPPLIER' }); expect(s.fateProphet.bottles[0]!.labourSteps).toBe(0);
    rejectFateProphet(s, { type: 'POTION_WORK', bottleId: 'fate-prophet-potion-2' });
    s = fp(s, { type: 'BUY_POTION', bottleId: 'fate-prophet-potion-2' }); expect(s.cash).toBe(before.cash - 900);
    expect(s.fateProphet.bottles[1]).toMatchObject({ status: 'PLAYER', acquiredWeek: 142 }); rejectFateProphet(s, { type: 'BUY_POTION', bottleId: 'fate-prophet-potion-2' });
    expect(validateFateProphetAcquisitionJournal(s)).toBe(true); rejectFateProphet(s, { type: 'PREPARE_PROMOTION' });
  });
  it('four jobs give no partial credit and earned credit never transfers to another bottle', () => {
    let s = taught(); for (let n = 0; n < 4; n++) s = fp(s, { type: 'POTION_WORK', bottleId: 'fate-prophet-potion-1' });
    const cash = s.cash; s = fp(s, { type: 'BUY_POTION', bottleId: 'fate-prophet-potion-1' }); expect(s.cash).toBe(cash - 6400);
    s = fp(s, { type: 'BUY_POTION', bottleId: 'fate-prophet-potion-2' }); expect(s.cash).toBe(cash - 12800);
    const credited = prepared('SUCCESS', true); expect([credited.cash, credited.actionsRemaining]).toEqual([98460, 90]);
  });
  it.each([[20, 99], [100, 40], [1, 99], [100, 1]] as const)('requires health>20 and mind>40 before site preparation (%s/%s)', (health, mind) => {
    const initial = directedInitial3(); initial.health = health; initial.mind = mind;
    let s = fp(initial, { type: 'LEARN_GUIDANCE' });
    for (const taskId of FATE_PROPHET_PREPARATION_IDS) s = fp(s, { type: 'PREPARE_TASK', taskId });
    s = fp(s, { type: 'BUY_POTION', bottleId: dose.bottleId });
    rejectFateProphet(s, { type: 'PREPARE_PROMOTION' }); rejectFateProphet(s, dose);
    expect(s.fateProphet.bottles[0]!.status).toBe('PLAYER'); expect(s.injuries).toEqual(initial.injuries);
  });
  it('requires all three distinct preparations and cancellation refunds neither140 nor an action', () => {
    let s = taught(); const ap = s.actionsRemaining;
    for (const taskId of FATE_PROPHET_PREPARATION_IDS) { rejectFateProphet(s, { type: 'PREPARE_PROMOTION' }); s = fp(s, { type: 'PREPARE_TASK', taskId }); rejectFateProphet(s, { type: 'PREPARE_TASK', taskId }); }
    expect(s.actionsRemaining).toBe(ap - 3); rejectFateProphet(s, { type: 'PREPARE_PROMOTION' });
    const ready = prepared(), e = journal(ready).at(-1)!;
    expect([e.before.cash - e.after.cash, e.before.actions - e.after.actions]).toEqual([140, 1]);
    expect([ready.cash, ready.actionsRemaining]).toEqual([92960, 95]); expect(hasFateProphetLock(ready)).toBe(true);
    rejectIntent(ready, { type: 'ACTION', action: 'REST' }); rejectFateProphet(ready, { type: 'LEARN_GUIDANCE' });
    const left = fp(ready, { type: 'LEAVE_PREPARATION' });
    expect([left.cash, left.actionsRemaining, left.health, left.spirituality]).toEqual([ready.cash, ready.actionsRemaining, ready.health, ready.spirituality]);
    expect(left.fateProphet.bottles[0]!.status).toBe('PLAYER'); expect(left.fateProphet.preparedWeek).toBeNull(); expect(left.fateProphet.preparations).toEqual(ready.fateProphet.preparations);
    expect(oldWheelRoots(left)).toEqual(oldWheelRoots(ready)); rejectFateProphet(left, dose);
    const retried = fp(left, { type: 'PREPARE_PROMOTION' }); expect([retried.cash, retried.actionsRemaining]).toEqual([left.cash - 140, left.actionsRemaining - 1]);
  });
  it.each(FATE_PROPHET_PREPARATION_IDS)('owning a real potion never substitutes for missing preparation %s', omitted => {
    let s = fp(taught(), { type: 'BUY_POTION', bottleId: 'fate-prophet-potion-1' });
    for (const taskId of FATE_PROPHET_PREPARATION_IDS.filter(id => id !== omitted)) s = fp(s, { type: 'PREPARE_TASK', taskId });
    rejectFateProphet(s, { type: 'PREPARE_PROMOTION' }); rejectFateProphet(s, dose);
    s = fp(s, { type: 'PREPARE_TASK', taskId: omitted }); expect(fp(s, { type: 'PREPARE_PROMOTION' }).fateProphet.preparedWeek).toBe(142);
  });
  it.each(['SUCCESS', 'GREAT_SUCCESS'] as const)('directed unit %s gives exactly15→17 without healing, resource refills or rewriting history', kind => {
    const before = prepared(kind), snapshot = structuredClone(before), s = fp(before, dose), e = journal(s).at(-1)!;
    const rng = new DeterministicActionRandomStream(before.random.seed, before.random.cursor);
    expect(e.check).toEqual(resolveNormalCheck({ ability: 'will', baseAbility: before.character.coreStats.will, difficulty: 30, modifiers: [], roll: rng.nextInt(1, 100) }));
    expect(e.check!.tier).toBe(kind); expect([e.randomBefore, e.randomAfter, s.random.cursor]).toEqual([before.random.cursor, rng.cursor, rng.cursor]);
    expect(s.progression.sequence).toBe(2); expect(Object.keys(s.progression.mastery)).toEqual([...FATE_PROPHET_INHERITED_ABILITY_IDS, ...FATE_PROPHET_ABILITY_IDS]);
    for (const [id, mastery] of Object.entries(before.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    for (const id of FATE_PROPHET_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const stat of ['physique', 'perception', 'knowledge', 'will'] as const) expect(s.character.coreStats[stat]).toBe(before.character.coreStats[stat] + 1);
    expect([s.health, s.spirituality, s.mind, s.injuryRisk, s.character.gender]).toEqual([60, 120, kind === 'GREAT_SUCCESS' ? 92 : 85, 2, before.character.gender]);
    expect(s.injuries).toEqual(before.injuries); expect(oldWheelRoots(s)).toEqual(oldWheelRoots(before)); expect(s.seer.completedSources).toEqual(before.seer.completedSources);
    expect(s.winner.luck).toEqual(before.winner.luck); expect(s.fateProphet.chaosWalkerActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
    expect(s.fateProphet.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind, preparationWeek: 142, consumedWeek: 142 });
    expect([s.actionsRemaining, s.cash]).toEqual([before.actionsRemaining, before.cash]); expect(before).toEqual(snapshot);
    expect(validateFateProphetAcquisitionJournal(s)).toBe(true); assertValidSliceState(s); rejectFateProphet(s, dose);
  });
  it('does not refill a declared pre-journal partial health or spirituality budget on successful promotion', () => {
    let s = directedInitial3('SUCCESS'); s.health = 83; s.mind = 85; s.spirituality = 17;
    s = fp(s, { type: 'LEARN_GUIDANCE' }); for (const taskId of FATE_PROPHET_PREPARATION_IDS) s = fp(s, { type: 'PREPARE_TASK', taskId });
    s = fp(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = fp(s, { type: 'PREPARE_PROMOTION' }); s = fp(s, dose);
    expect([s.health, s.mind, s.spirituality]).toEqual([83, 70, 17]); expect(projectFateProphet(s).resources!.maxSpirituality).toBe(120);
    expect(validateFateProphetAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
  });
  it.each([['FAILURE', 45, 75, 30], ['GREAT_FAILURE', 35, 55, 60]] as const)('directed unit %s consumes the original bottle with exact retained costs', (kind, health, mind, pollution) => {
    const before = prepared(kind), s = fp(before, dose);
    expect(s).toMatchObject({ health, mind, spirituality: 120, progression: { sequence: 3, acting: 100 } }); expect(s.seer.pollution).toBe(pollution);
    expect(s.fateProphet.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind, consumedWeek: 142, preparationWeek: 142 }); expect(s.fateProphet.preparedWeek).toBeNull();
    expect([s.cash, s.actionsRemaining]).toEqual([before.cash, before.actionsRemaining]); expect(s.fateProphet.preparations).toEqual(before.fateProphet.preparations);
    expect(oldWheelRoots(s)).toEqual(oldWheelRoots(before)); expect(s.injuries).toEqual(before.injuries); expect(Object.keys(s.progression.mastery)).toHaveLength(15);
    expect(s.seer.completedSources).toEqual(before.seer.completedSources); expect(validateFateProphetAcquisitionJournal(s)).toBe(true); assertValidSliceState(s); rejectFateProphet(s, dose);
    const bought = fp(s, { type: 'BUY_POTION', bottleId: 'fate-prophet-potion-2' }); expect(fp(bought, { type: 'PREPARE_PROMOTION' }).cash).toBe(s.cash - 6400 - 140);
  });
  it('ordinary REST restores actor resources through real actions without resetting old histories', () => {
    const before = promoted(), commands: SliceIntent[] = [], s = recover(before, commands);
    expect(commands.length).toBeGreaterThan(0); expect(commands.every(c => c.type === 'ACTION' && c.action === 'REST')).toBe(true);
    expect([s.health, s.mind, s.spirituality, s.injuryRisk]).toEqual([100, 100, 120, 2]); expect(s.injuries).toEqual(before.injuries.filter(i => i.severity === 'HEAVY'));
    expect(before.injuries.find(i => i.severity === 'LIGHT')!.acquiredRevision).toBe(549); expect(s.injuries.every(i => i.treatedRevision === null)).toBe(true);
    expect([s.actionsRemaining, s.cash]).toEqual([before.actionsRemaining - commands.length, before.cash]);
    expect(s.random).toEqual(before.random); expect(oldWheelRoots(s)).toEqual(oldWheelRoots(before)); expect(s.fateProphet).toEqual(before.fateProphet); assertValidSliceState(s);
  });
  it('uses only declared low pre-journal resources and confines the minimum1 support to the actual potion', () => {
    let s = directedInitial3('GREAT_FAILURE'); s.health = 21; s.mind = 41;
    s = fp(s, { type: 'LEARN_GUIDANCE' }); for (const taskId of FATE_PROPHET_PREPARATION_IDS) s = fp(s, { type: 'PREPARE_TASK', taskId });
    s = fp(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = fp(s, { type: 'PREPARE_PROMOTION' }); s = fp(s, dose);
    expect(s).toMatchObject({ status: 'ACTIVE', health: 1, mind: 1, progression: { sequence: 3 } });
    const bought = fp(s, { type: 'BUY_POTION', bottleId: 'fate-prophet-potion-2' }); rejectFateProphet(bought, { type: 'PREPARE_PROMOTION' });
    expect(s.fateProphet.bottles[0]!.status).toBe('CONSUMED'); expect(validateFateProphetAcquisitionJournal(s)).toBe(true);
  });
  it('requires three actually failed original bottles and next-week delivery of independent new stock', () => {
    let s = taught('THREE_FAILURES'); rejectFateProphet(s, { type: 'REQUEST_SUPPLY' }); rejectFateProphet(s, { type: 'RECEIVE_SUPPLY' });
    for (const taskId of FATE_PROPHET_PREPARATION_IDS) s = fp(s, { type: 'PREPARE_TASK', taskId });
    const originalRoots = structuredClone(oldWheelRoots(s));
    for (const bottleId of ['fate-prophet-potion-1', 'fate-prophet-potion-2', 'fate-prophet-potion-3']) {
      s = recover(s); s = fp(s, { type: 'BUY_POTION', bottleId }); s = fp(s, { type: 'PREPARE_PROMOTION' }); s = fp(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    expect(s.fateProphet.bottles.every(b => b.status === 'CONSUMED' && b.outcome === 'FAILURE')).toBe(true);
    expect(s.cash).toBe(100000 - 500 - 3 * (6400 + 140));
    const old = structuredClone(s.fateProphet.bottles), beforeAP = s.actionsRemaining;
    s = fp(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(beforeAP - 1); expect(s.fateProphet.bottles).toEqual(old); rejectFateProphet(s, { type: 'RECEIVE_SUPPLY' });
    // Advance the unit continuation through real REST actions, never editing the
    // week/date or a resource once the first FateProphet journal has been recorded.
    const requestWeek = s.week, requestDate = structuredClone(s.date), remaining = s.actionsRemaining;
    let nextWeek = s;
    for (let n = 0; n < remaining; n++) nextWeek = step(nextWeek, { type: 'ACTION', action: 'REST' });
    expect(nextWeek.week).toBe(requestWeek + 1); expect(nextWeek.date).toEqual(addGameDays(requestDate, 7));
    const received = fp(nextWeek, { type: 'RECEIVE_SUPPLY' });
    expect(received.fateProphet.bottles.slice(0, 3)).toEqual(old); expect(received.fateProphet.bottles.slice(3).map(b => b.id)).toEqual(['fate-prophet-potion-4', 'fate-prophet-potion-5', 'fate-prophet-potion-6']);
    expect(received.fateProphet.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.stockedWeek === 143 && b.acquiredWeek === null && b.labourSteps === 0 && b.source.includes(b.id))).toBe(true);
    expect([received.cash, received.actionsRemaining]).toEqual([nextWeek.cash, nextWeek.actionsRemaining]); expect(oldWheelRoots(received)).toEqual(originalRoots);
    expect(validateFateProphetAcquisitionJournal(received)).toBe(true); assertValidSliceState(received); rejectFateProphet(received, { type: 'RECEIVE_SUPPLY' });
  });
  it('closes every predecessor acquisition command after the real FateProphet promotion', () => {
    const s = promoted();
    for (const type of ['MONSTER', 'MACHINE', 'LUCKY', 'CALAMITY_PRIEST', 'WINNER', 'MISFORTUNE_MAGE', 'CHAOS_WALKER'] as const) rejectIntent(s, { type, command: { type: 'LEARN_GUIDANCE' } } as SliceIntent);
    rejectFateProphet(s, { type: 'LEARN_GUIDANCE' }); rejectFateProphet(s, { type: 'PREPARE_PROMOTION' }); rejectFateProphet(s, { type: 'REQUEST_SUPPLY' });
  });
  it('rejects unknown fields, false confirmation, wrong source IDs and invented ritual commands without mutation', () => {
    const s = prepared();
    for (const command of [{ ...dose, confirmed: false }, { ...dose, free: true }, { type: 'BUY_POTION', bottleId: 'chaos-walker-potion-1' }, { type: 'PREPARE_TASK', taskId: 'REVIEW_DISASTER' }, { type: 'LEARN_GUIDANCE', free: true }, { type: 'RITUAL_CONTAIN' }, { type: 'RITUAL_REVIEW', stopped: true }]) {
      expect(validateFateProphetCommand(command)).toBe(false); rejectFateProphet(s, command);
    }
    rejectFateProphet(s, { ...dose, bottleId: 'fate-prophet-potion-99' });
  });
});

const acquisitionMutations: [string, (s: SliceState) => void][] = [
  ['free original lucky reserve', s => { journal(s).at(-1)!.after.luck.stored++; journal(s).at(-1)!.after.luck.accumulated++; }],
  ['refunded guidance', s => { journal(s)[0]!.after.cash++; }],
  ['free preparation', s => { journal(s).find(e => e.command.type === 'PREPARE_PROMOTION')!.after.actions++; }],
  ['unearned mastery', s => { journal(s).at(-1)!.after.mastery[FATE_PROPHET_ABILITY_IDS[0]] = 8; }],
  ['altered source seed', s => { journal(s)[0]!.source.seed += '-forged'; }],
  ['altered no-draw source cursor', s => { journal(s)[0]!.source.cursorAfter++; }],
  ['altered dose cursor', s => { journal(s).at(-1)!.randomBefore!++; }],
  ['altered dose check', s => { journal(s).at(-1)!.check!.difficulty++; }],
  ['fabricated injury', s => { journal(s).at(-1)!.after.injuries.push({ id: 'fabricated', severity: 'LIGHT', acquiredRevision: 1, treatedRevision: null }); }],
  ['rewritten source IDs', s => { journal(s).at(-1)!.after.completedSources[0] = 'counterfeit-source'; }],
  ['missing purchase', s => { s.fateProphet.acquisitionJournal = journal(s).filter(e => e.command.type !== 'BUY_POTION'); }],
  ['other actor', s => { journal(s)[0]!.actor.name = 'Counterfeit'; }],
  ['other prior promotion week', s => { journal(s)[0]!.actor.chaosWalkerPromotionWeek--; }],
  ['relabelled original bottle', s => { s.fateProphet.bottles[0]!.id = 'fate-prophet-potion-2'; }],
  ['restored consumed original', s => { s.fateProphet.bottles[0]!.status = 'PLAYER'; }],
  ['invented supplier provenance', s => { s.fateProphet.bottles[0]!.source += ' free'; }],
  ['extra evidence field', s => { Object.assign(journal(s)[0]!, { free: true }); }],
  ['extra stage field', s => { Object.assign(s.fateProphet, { free: true }); }],
];
describe('FateProphet acquisition replay rejects falsified evidence and cross-resource changes', () => {
  it.each(acquisitionMutations)('rejects %s', (_name, change) => {
    const s = promoted(); expect(validateFateProphetState(s)).toBe(true); change(s);
    expect(validateFateProphetState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it.each(['health', 'mind', 'spirituality', 'cash', 'actions', 'pollution', 'injuryRisk'] as const)('rejects a discontinuous %s budget even when both event endpoints are adjusted', field => {
    const s = promoted(), event = journal(s)[1]!;
    const delta = field === 'health' || field === 'mind' || field === 'spirituality' ? -1 : 1;
    event.before[field] += delta; event.after[field] += delta;
    expect(validateFateProphetJournalContinuity(s)).toBe(false); expect(validateFateProphetAcquisitionJournal(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it.each(['health', 'mind', 'spirituality', 'cash', 'actionsRemaining', 'injuryRisk'] as const)('rejects rewriting immediate post-potion %s without a real intervening command', field => {
    const s = promoted(); s[field] += field === 'health' || field === 'spirituality' ? -1 : 1;
    expect(validateFateProphetAcquisitionJournal(s)).toBe(false); expect(validateFateProphetState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it('rejects revision collisions, backdated checks and deleted consumed source prefixes', () => {
    const collision = promoted(); journal(collision)[1]!.revision = journal(collision)[0]!.revision;
    expect(validateFateProphetJournalContinuity(collision)).toBe(false); expect(validateFateProphetState(collision)).toBe(false);
    const backdated = promoted(); journal(backdated).at(-1)!.date = originalChaosWalker().date;
    expect(validateFateProphetAcquisitionJournal(backdated)).toBe(false);
    const missing = promoted(); missing.seer.completedSources.shift();
    expect(validateFateProphetAcquisitionJournal(missing)).toBe(false); expect(validateFateProphetState(missing)).toBe(false);
  });
  it('rejects a forged cursor even before the first potion draw', () => {
    const s = taught(); s.random.cursor++;
    expect(validateFateProphetAcquisitionJournal(s)).toBe(false); expect(validateFateProphetJournalContinuity(s)).toBe(false);
  });
  it('rejects a forged no-draw cursor after an adjacent post-failure purchase', () => {
    const failed = fp(prepared('FAILURE'), dose), bought = fp(failed, { type: 'BUY_POTION', bottleId: 'fate-prophet-potion-2' });
    expect(bought.random.cursor).toBe(failed.random.cursor); expect(validateFateProphetJournalContinuity(bought)).toBe(true);
    bought.random.cursor++;
    expect(validateFateProphetJournalContinuity(bought)).toBe(false); expect(() => assertValidSliceState(bought)).toThrow();
  });
  it('replays the whole directed command continuation identically without mutating input or payloads', () => {
    const initial = directedInitial3(), original = structuredClone(initial), commands: SliceIntent[] = [];
    let s = fp(initial, { type: 'LEARN_GUIDANCE' }, commands);
    for (const taskId of FATE_PROPHET_PREPARATION_IDS) s = fp(s, { type: 'PREPARE_TASK', taskId }, commands);
    s = fp(s, { type: 'BUY_POTION', bottleId: 'fate-prophet-potion-1' }, commands); s = fp(s, { type: 'PREPARE_PROMOTION' }, commands); s = fp(s, dose, commands);
    const payloads = structuredClone(commands); let replayed = structuredClone(initial);
    for (const command of commands) replayed = step(replayed, command);
    expect(replayed).toEqual(s); expect(initial).toEqual(original); expect(commands).toEqual(payloads);
    expect(validateFateProphetJournalContinuity(replayed)).toBe(true); expect(validateFateProphetAcquisitionJournal(replayed)).toBe(true);
  });
  it('projects only actual knowledge, exact17 abilities and independent state copies', () => {
    const s = promoted(), before = structuredClone(s), p = projectFateProphet(s);
    expect(p.formulaKnown).toBe(false); expect(p.formula).toEqual([]); expect(p.abilities.map(a => a.id)).toEqual([...FATE_PROPHET_INHERITED_ABILITY_IDS, ...FATE_PROPHET_ABILITY_IDS]);
    expect(new Set(p.abilities.map(a => a.id)).size).toBe(17); expect(p.resources!.maxSpirituality).toBe(120); expect(p.currentGender).toBe(s.character.gender);
    expect(p.inheritedHistory.join(' ')).toContain('15项'); expect(p.inheritedHistory.join(' ')).toContain('第130周'); expect(p.inheritedTools).toContain('薇拉');
    expect(p.story).not.toMatch(/原创G|候选|未核|原核/); expect(p.risk).not.toMatch(/原创G|候选|未核|原核/);
    expect(p.injuries).toEqual(s.injuries.map(i => ({ id: i.id, severity: i.severity, treated: i.treatedRevision !== null }))); expect(p.injuryRisk).toBe(2); expect(p.luck).toEqual({ ...s.winner.luck, capacity: 3 });
    p.injuries[0]!.treated = true; p.luck.stored = 3; p.abilities[0]!.mastery++; p.bottles[0]!.source = 'altered view'; expect(s).toEqual(before);
  });
});
