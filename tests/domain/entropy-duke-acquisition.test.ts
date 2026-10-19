import { CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createEntropyDukeState, hasEntropyDukeLock, projectEntropyDuke, ENTROPY_DUKE_INHERITED_ABILITY_IDS, validateEntropyDukeAcquisitionJournal, validateEntropyDukeJournalContinuity, validateEntropyDukeCommand, validateEntropyDukeState } from '../../src/domain/entropy-duke/index.js';
import { ENTROPY_DUKE_ABILITY_IDS, ENTROPY_DUKE_PREPARATION_IDS } from '../../src/domain/entropy-duke/types.js';
import { directedInitial3, dose, ed, oldBlackEmperorRoots, originalFrenzyMage, prepared, promoted, recover, rejectEntropyDuke, rejectIntent, step, taught, frenzyMageNaturalPath } from './entropy-duke-directed-helper.js';

const journal = (s: SliceState) => s.entropyDuke.acquisitionJournal;

describe('EntropyDuke acquisition: actual living555-command S3 prefix and explicitly directed units', () => {
  it('uses the real living555-command prefix and never revives the complete558-command death', () => {
    const dead = readObjectEntry<SliceState>(frenzyMageNaturalPath, 'final'), s = originalFrenzyMage();
    expect(readObjectEntry<SliceIntent[]>(frenzyMageNaturalPath, 'commands')).toHaveLength(558);
    expect(dead).toMatchObject({ revision: 559, status: 'DEAD', health: 0, injuryRisk: 3 });
    expect(s).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, week: 141, revision: 556, status: 'ACTIVE', health: 100, mind: 100, spirituality: 120, cash: 540, actionsRemaining: 3, injuryRisk: 2, random: { seed: 'lawyer-natural-v063', cursor: 189 }, progression: { sequence: 3, acting: 100, promotionWeek: 6 } });
    expect(s.character.coreStats).toEqual({ physique: 28, perception: 22, will: 24, knowledge: 22 });
    expect(s.injuries).toEqual(dead.injuries); expect(s.injuries.map(i => [i.severity, i.treatedRevision])).toEqual([['HEAVY', null], ['HEAVY', null]]);
    expect(s.frenzyMage.promotionWeek).toBe(133); expect(s.frenzyMage.encounter.status).toBe('AVAILABLE');
    expect(s.fallenEarl.encounter).toMatchObject({ enemyStatus: 'DEAD', enemyHealth: 0 });
    expect(s.briber.gifts).toHaveLength(15); expect(s.briber.gifts.slice(10).every(g => g.location === 'PLAYER')).toBe(true);
    expect(Object.keys(s.progression.mastery)).toEqual([...ENTROPY_DUKE_INHERITED_ABILITY_IDS]);
    for (const id of ['black-emperor.s7.bribery-weakening', 'black-emperor.s5.disorder', 'black-emperor.s3.ordered-deviation']) expect(s.progression.mastery[id]).toBe(0);
    expect(s.entropyDuke).toEqual(createEntropyDukeState()); assertValidSliceState(s);
  }, 30_000);
  it('declares pre-journal unit budgets and cursor without editing, healing or refilling the original source', () => {
    const original = originalFrenzyMage(), s = directedInitial3();
    expect(s).toMatchObject({ week: 145, cash: 100000, actionsRemaining: 100, weeklyBudget: 100, health: 100, mind: 100, spirituality: 120, injuryRisk: 2 });
    expect(s.date).toEqual(addGameDays(original.date, 28)); expect(s.random.seed).toBe(original.random.seed);
    expect(s.random.cursor).toBeGreaterThanOrEqual(original.random.cursor); expect(s.random.cursor).toBeLessThan(original.random.cursor + 512);
    expect(oldBlackEmperorRoots(s)).toEqual(oldBlackEmperorRoots(original)); expect(s.injuries).toEqual(original.injuries);
    expect(s.character).toEqual(original.character); expect(s.progression).toEqual(original.progression);
    expect(journal(s)).toEqual([]); expect(originalFrenzyMage()).toEqual(original);
  });
  it('keeps independent defaults and hides the stage from unrelated, earlier and S1/S0 characters', () => {
    const s = createSliceRun('entropy-duke-hidden', sliceDefaultCreationSelection, 'entropy-duke-hidden');
    expect(projectEntropyDuke(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], resources: null });
    rejectEntropyDuke(s, { type: 'LEARN_GUIDANCE' });
    const a = createEntropyDukeState(); a.bottles[0]!.labourSteps = 5;
    expect(s.entropyDuke.bottles[0]!.labourSteps).toBe(0);
    for (const sequence of [4, 1, 0] as const) { const t = originalFrenzyMage(); t.progression.sequence = sequence; expect(projectEntropyDuke(t).discovered).toBe(false); rejectEntropyDuke(t, { type: 'LEARN_GUIDANCE' }); }
  });
  it('rejects changed lineage and missing or invented skills before accepting new costs', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.frenzyMage.promotionWeek = null; }, s => { s.frenzyMage.fallenEarlActingAtPromotion = 99; },
      s => { s.progression.pathwayId = 'hermit'; }, s => { delete s.progression.mastery['black-emperor.s3.ordered-deviation']; },
      s => { s.progression.mastery['black-emperor.s2.invented'] = 0; },
      s => { s.lawyer.bottles.find(b => b.status === 'CONSUMED' && ['SUCCESS', 'GREAT_SUCCESS'].includes(b.outcome ?? ''))!.acquiredWeek = s.week + 1; },
    ];
    for (const [index, change] of mutations.entries()) {
      const s = directedInitial3(); change(s);
      try { rejectEntropyDuke(s, { type: 'LEARN_GUIDANCE' }); } catch (cause) { throw new Error(`Lineage mutation ${index} was accepted`, { cause }); }
    }
  });
  it('requires twelve complete weeks from actual promotion133, so week141 cannot consume', () => {
    let s = taught('SUCCESS', false);
    expect(projectEntropyDuke(s).digestion).toContain('8/12');
    for (const taskId of ENTROPY_DUKE_PREPARATION_IDS) s = ed(s, { type: 'PREPARE_TASK', taskId });
    s = ed(s, { type: 'BUY_POTION', bottleId: 'entropy-duke-potion-1' });
    rejectEntropyDuke(s, { type: 'PREPARE_PROMOTION' }); rejectEntropyDuke(s, dose);
    const atBoundary = prepared(); expect(atBoundary.week).toBe(145); expect(projectEntropyDuke(atBoundary).digestion).toContain('12/12');
    expect(ed(atBoundary, dose).entropyDuke.promotionWeek).toBe(145);
  });
  it('requires each actual old report and reflection before current preparation', () => {
    for (const missing of ['frenzy-mage-life-courier-route', 'frenzy-mage-life-withdrawn-route', 'frenzy-mage-life-own-throw', 'frenzy-mage-reflection']) {
      const s = prepared(); s.seer.completedSources = s.seer.completedSources.filter(id => id !== missing);
      rejectEntropyDuke(s, dose); expect(validateEntropyDukeAcquisitionJournal(s)).toBe(false);
    }
    const incomplete = prepared(); incomplete.frenzyMage.life.reflected = false; rejectEntropyDuke(incomplete, dose);
  });
  it('rejects resurrecting or backdating an old consumed original at the whole-state save boundary', () => {
    const restored = originalFrenzyMage(); restored.lawyer.bottles[0]!.status = 'PLAYER';
    expect(restored.lawyer.bottles[0]!.consumedWeek).toBe(6); expect(() => assertValidSliceState(restored)).toThrow();
    const backdated = originalFrenzyMage(); backdated.lawyer.bottles[0]!.acquiredWeek = 145;
    expect(() => assertValidSliceState(backdated)).toThrow();
  });
  it('guidance costs exactly500 and one action without granting skills or inventory', () => {
    const before = directedInitial3(), payload = { type: 'LEARN_GUIDANCE' } as const, s = ed(before, payload), e = journal(s)[0]!;
    expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]); expect(s.progression.mastery).toEqual(before.progression.mastery);
    expect(s.entropyDuke.bottles.every(b => b.status === 'SUPPLIER')).toBe(true);
    expect([e.before.cash - e.after.cash, e.before.actions - e.after.actions]).toEqual([500, 1]);
    expect([e.check, e.randomBefore, e.randomAfter]).toEqual([null, null, null]);
    expect(e.actor).toEqual({ name: before.character.name, gender: before.character.gender, pathwayId: 'black-emperor', frenzyMagePromotionWeek: 133, lawyerPromotionWeek: 6 });
    expect(oldBlackEmperorRoots(s)).toEqual(oldBlackEmperorRoots(before)); expect(payload).toEqual({ type: 'LEARN_GUIDANCE' });
    expect(before.entropyDuke.guidanceKnown).toBe(false); rejectEntropyDuke(s, payload);
  });
});

describe('EntropyDuke paid acquisition, preparations, four real potion tiers and bounded resupply', () => {
  it('five actual jobs discount only their specific bottle and still require900', () => {
    let s = taught(); const before = structuredClone(s);
    for (let n = 0; n < 5; n++) s = ed(s, { type: 'POTION_WORK', bottleId: 'entropy-duke-potion-2' });
    expect([s.actionsRemaining, s.cash]).toEqual([before.actionsRemaining - 5, before.cash]);
    expect(s.entropyDuke.bottles[1]).toMatchObject({ labourSteps: 5, status: 'SUPPLIER' }); expect(s.entropyDuke.bottles[0]!.labourSteps).toBe(0);
    rejectEntropyDuke(s, { type: 'POTION_WORK', bottleId: 'entropy-duke-potion-2' });
    s = ed(s, { type: 'BUY_POTION', bottleId: 'entropy-duke-potion-2' }); expect(s.cash).toBe(before.cash - 900);
    expect(s.entropyDuke.bottles[1]).toMatchObject({ status: 'PLAYER', acquiredWeek: 145 }); rejectEntropyDuke(s, { type: 'BUY_POTION', bottleId: 'entropy-duke-potion-2' });
    expect(validateEntropyDukeAcquisitionJournal(s)).toBe(true); rejectEntropyDuke(s, { type: 'PREPARE_PROMOTION' });
  });
  it('four jobs give no partial credit and earned credit never transfers to another bottle', () => {
    let s = taught(); for (let n = 0; n < 4; n++) s = ed(s, { type: 'POTION_WORK', bottleId: 'entropy-duke-potion-1' });
    const cash = s.cash; s = ed(s, { type: 'BUY_POTION', bottleId: 'entropy-duke-potion-1' }); expect(s.cash).toBe(cash - 6400);
    s = ed(s, { type: 'BUY_POTION', bottleId: 'entropy-duke-potion-2' }); expect(s.cash).toBe(cash - 12800);
    const credited = prepared('SUCCESS', true); expect([credited.cash, credited.actionsRemaining]).toEqual([98460, 90]);
  });
  it.each([[20, 99], [100, 40], [1, 99], [100, 1]] as const)('requires health>20 and mind>40 before site preparation (%s/%s)', (health, mind) => {
    const initial = directedInitial3(); initial.health = health; initial.mind = mind;
    let s = ed(initial, { type: 'LEARN_GUIDANCE' });
    for (const taskId of ENTROPY_DUKE_PREPARATION_IDS) s = ed(s, { type: 'PREPARE_TASK', taskId });
    s = ed(s, { type: 'BUY_POTION', bottleId: dose.bottleId });
    rejectEntropyDuke(s, { type: 'PREPARE_PROMOTION' }); rejectEntropyDuke(s, dose);
    expect(s.entropyDuke.bottles[0]!.status).toBe('PLAYER'); expect(s.injuries).toEqual(initial.injuries);
  });
  it('requires all three distinct preparations and cancellation refunds neither140 nor an action', () => {
    let s = taught(); const ap = s.actionsRemaining;
    for (const taskId of ENTROPY_DUKE_PREPARATION_IDS) { rejectEntropyDuke(s, { type: 'PREPARE_PROMOTION' }); s = ed(s, { type: 'PREPARE_TASK', taskId }); rejectEntropyDuke(s, { type: 'PREPARE_TASK', taskId }); }
    expect(s.actionsRemaining).toBe(ap - 3); rejectEntropyDuke(s, { type: 'PREPARE_PROMOTION' });
    const ready = prepared(), e = journal(ready).at(-1)!;
    expect([e.before.cash - e.after.cash, e.before.actions - e.after.actions]).toEqual([140, 1]);
    expect([ready.cash, ready.actionsRemaining]).toEqual([92960, 95]); expect(hasEntropyDukeLock(ready)).toBe(true);
    rejectIntent(ready, { type: 'ACTION', action: 'REST' }); rejectEntropyDuke(ready, { type: 'LEARN_GUIDANCE' });
    const left = ed(ready, { type: 'LEAVE_PREPARATION' });
    expect([left.cash, left.actionsRemaining, left.health, left.spirituality]).toEqual([ready.cash, ready.actionsRemaining, ready.health, ready.spirituality]);
    expect(left.entropyDuke.bottles[0]!.status).toBe('PLAYER'); expect(left.entropyDuke.preparedWeek).toBeNull(); expect(left.entropyDuke.preparations).toEqual(ready.entropyDuke.preparations);
    expect(oldBlackEmperorRoots(left)).toEqual(oldBlackEmperorRoots(ready)); rejectEntropyDuke(left, dose);
    const retried = ed(left, { type: 'PREPARE_PROMOTION' }); expect([retried.cash, retried.actionsRemaining]).toEqual([left.cash - 140, left.actionsRemaining - 1]);
  });
  it.each(ENTROPY_DUKE_PREPARATION_IDS)('owning a real potion never substitutes for missing preparation %s', omitted => {
    let s = ed(taught(), { type: 'BUY_POTION', bottleId: 'entropy-duke-potion-1' });
    for (const taskId of ENTROPY_DUKE_PREPARATION_IDS.filter(id => id !== omitted)) s = ed(s, { type: 'PREPARE_TASK', taskId });
    rejectEntropyDuke(s, { type: 'PREPARE_PROMOTION' }); rejectEntropyDuke(s, dose);
    s = ed(s, { type: 'PREPARE_TASK', taskId: omitted }); expect(ed(s, { type: 'PREPARE_PROMOTION' }).entropyDuke.preparedWeek).toBe(145);
  });
  it.each(['SUCCESS', 'GREAT_SUCCESS'] as const)('directed unit %s gives exactly12→14 without healing, resource refills or rewriting history', kind => {
    const before = prepared(kind), snapshot = structuredClone(before), s = ed(before, dose), e = journal(s).at(-1)!;
    const rng = new DeterministicActionRandomStream(before.random.seed, before.random.cursor);
    expect(e.check).toEqual(resolveNormalCheck({ ability: 'will', baseAbility: before.character.coreStats.will, difficulty: 30, modifiers: [], roll: rng.nextInt(1, 100) }));
    expect(e.check!.tier).toBe(kind); expect([e.randomBefore, e.randomAfter, s.random.cursor]).toEqual([before.random.cursor, rng.cursor, rng.cursor]);
    expect(s.progression.sequence).toBe(2); expect(Object.keys(s.progression.mastery)).toEqual([...ENTROPY_DUKE_INHERITED_ABILITY_IDS, ...ENTROPY_DUKE_ABILITY_IDS]);
    for (const [id, mastery] of Object.entries(before.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    for (const id of ENTROPY_DUKE_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const stat of ['physique', 'perception', 'knowledge', 'will'] as const) expect(s.character.coreStats[stat]).toBe(before.character.coreStats[stat] + 1);
    expect([s.health, s.spirituality, s.mind, s.injuryRisk, s.character.gender]).toEqual([100, 120, kind === 'GREAT_SUCCESS' ? 92 : 85, 2, before.character.gender]);
    expect(s.injuries).toEqual(before.injuries); expect(oldBlackEmperorRoots(s)).toEqual(oldBlackEmperorRoots(before)); expect(s.seer.completedSources).toEqual(before.seer.completedSources);
    expect(s.entropyDuke.frenzyMageActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
    expect(s.entropyDuke.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind, preparationWeek: 145, consumedWeek: 145 });
    expect([s.actionsRemaining, s.cash]).toEqual([before.actionsRemaining, before.cash]); expect(before).toEqual(snapshot);
    expect(validateEntropyDukeAcquisitionJournal(s)).toBe(true); assertValidSliceState(s); rejectEntropyDuke(s, dose);
  });
  it('does not refill a declared pre-journal partial health or spirituality budget on successful promotion', () => {
    let s = directedInitial3('SUCCESS'); s.health = 83; s.mind = 85; s.spirituality = 17;
    s = ed(s, { type: 'LEARN_GUIDANCE' }); for (const taskId of ENTROPY_DUKE_PREPARATION_IDS) s = ed(s, { type: 'PREPARE_TASK', taskId });
    s = ed(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = ed(s, { type: 'PREPARE_PROMOTION' }); s = ed(s, dose);
    expect([s.health, s.mind, s.spirituality]).toEqual([83, 70, 17]); expect(projectEntropyDuke(s).resources!.maxSpirituality).toBe(120);
    expect(validateEntropyDukeAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
  });
  it.each([['FAILURE', 85, 75, 30], ['GREAT_FAILURE', 75, 55, 60]] as const)('directed unit %s consumes the original bottle with exact retained costs', (kind, health, mind, pollution) => {
    const before = prepared(kind), s = ed(before, dose);
    expect(s).toMatchObject({ health, mind, spirituality: 120, progression: { sequence: 3, acting: 100 } }); expect(s.seer.pollution).toBe(pollution);
    expect(s.entropyDuke.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind, consumedWeek: 145, preparationWeek: 145 }); expect(s.entropyDuke.preparedWeek).toBeNull();
    expect([s.cash, s.actionsRemaining]).toEqual([before.cash, before.actionsRemaining]); expect(s.entropyDuke.preparations).toEqual(before.entropyDuke.preparations);
    expect(oldBlackEmperorRoots(s)).toEqual(oldBlackEmperorRoots(before)); expect(s.injuries).toEqual(before.injuries); expect(Object.keys(s.progression.mastery)).toHaveLength(12);
    expect(s.seer.completedSources).toEqual(before.seer.completedSources); expect(validateEntropyDukeAcquisitionJournal(s)).toBe(true); assertValidSliceState(s); rejectEntropyDuke(s, dose);
    const bought = ed(s, { type: 'BUY_POTION', bottleId: 'entropy-duke-potion-2' }); expect(ed(bought, { type: 'PREPARE_PROMOTION' }).cash).toBe(s.cash - 6400 - 140);
  });
  it('ordinary REST restores actor resources through real actions without resetting old histories', () => {
    const before = promoted(), commands: SliceIntent[] = [], s = recover(before, commands);
    expect(commands.length).toBeGreaterThan(0); expect(commands.every(c => c.type === 'ACTION' && c.action === 'REST')).toBe(true);
    expect([s.health, s.mind, s.spirituality, s.injuryRisk]).toEqual([100, 100, 120, 2]); expect(s.injuries).toEqual(before.injuries);
    expect([s.actionsRemaining, s.cash]).toEqual([before.actionsRemaining - commands.length, before.cash]);
    expect(s.random).toEqual(before.random); expect(oldBlackEmperorRoots(s)).toEqual(oldBlackEmperorRoots(before)); expect(s.entropyDuke).toEqual(before.entropyDuke); assertValidSliceState(s);
  });
  it('uses only declared low pre-journal resources and confines the minimum1 support to the actual potion', () => {
    let s = directedInitial3('GREAT_FAILURE'); s.health = 21; s.mind = 41;
    s = ed(s, { type: 'LEARN_GUIDANCE' }); for (const taskId of ENTROPY_DUKE_PREPARATION_IDS) s = ed(s, { type: 'PREPARE_TASK', taskId });
    s = ed(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = ed(s, { type: 'PREPARE_PROMOTION' }); s = ed(s, dose);
    expect(s).toMatchObject({ status: 'ACTIVE', health: 1, mind: 1, progression: { sequence: 3 } });
    const bought = ed(s, { type: 'BUY_POTION', bottleId: 'entropy-duke-potion-2' }); rejectEntropyDuke(bought, { type: 'PREPARE_PROMOTION' });
    expect(s.entropyDuke.bottles[0]!.status).toBe('CONSUMED'); expect(validateEntropyDukeAcquisitionJournal(s)).toBe(true);
  });
  it('requires three actually failed original bottles and next-week delivery of independent new stock', () => {
    let s = taught('THREE_FAILURES'); rejectEntropyDuke(s, { type: 'REQUEST_SUPPLY' }); rejectEntropyDuke(s, { type: 'RECEIVE_SUPPLY' });
    for (const taskId of ENTROPY_DUKE_PREPARATION_IDS) s = ed(s, { type: 'PREPARE_TASK', taskId });
    const originalRoots = structuredClone(oldBlackEmperorRoots(s));
    for (const bottleId of ['entropy-duke-potion-1', 'entropy-duke-potion-2', 'entropy-duke-potion-3']) {
      s = recover(s); s = ed(s, { type: 'BUY_POTION', bottleId }); s = ed(s, { type: 'PREPARE_PROMOTION' }); s = ed(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    expect(s.entropyDuke.bottles.every(b => b.status === 'CONSUMED' && b.outcome === 'FAILURE')).toBe(true);
    expect(s.cash).toBe(100000 - 500 - 3 * (6400 + 140));
    const old = structuredClone(s.entropyDuke.bottles), beforeAP = s.actionsRemaining;
    s = ed(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(beforeAP - 1); expect(s.entropyDuke.bottles).toEqual(old); rejectEntropyDuke(s, { type: 'RECEIVE_SUPPLY' });
    // Advance the unit continuation through real REST actions, never editing the
    // week/date or a resource once the first EntropyDuke journal has been recorded.
    const requestWeek = s.week, requestDate = structuredClone(s.date), remaining = s.actionsRemaining;
    let nextWeek = s;
    for (let n = 0; n < remaining; n++) nextWeek = step(nextWeek, { type: 'ACTION', action: 'REST' });
    expect(nextWeek.week).toBe(requestWeek + 1); expect(nextWeek.date).toEqual(addGameDays(requestDate, 7));
    const received = ed(nextWeek, { type: 'RECEIVE_SUPPLY' });
    expect(received.entropyDuke.bottles.slice(0, 3)).toEqual(old); expect(received.entropyDuke.bottles.slice(3).map(b => b.id)).toEqual(['entropy-duke-potion-4', 'entropy-duke-potion-5', 'entropy-duke-potion-6']);
    expect(received.entropyDuke.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.stockedWeek === 146 && b.acquiredWeek === null && b.labourSteps === 0 && b.source.includes(b.id))).toBe(true);
    expect([received.cash, received.actionsRemaining]).toEqual([nextWeek.cash, nextWeek.actionsRemaining]); expect(oldBlackEmperorRoots(received)).toEqual(originalRoots);
    expect(validateEntropyDukeAcquisitionJournal(received)).toBe(true); assertValidSliceState(received); rejectEntropyDuke(received, { type: 'RECEIVE_SUPPLY' });
  });
  it('closes every predecessor acquisition command after the real EntropyDuke promotion', () => {
    const s = promoted();
    for (const type of ['LAWYER', 'BARBARIAN', 'BRIBER', 'CORRUPTION_BARON', 'MENTOR_DISORDER', 'FALLEN_EARL', 'FRENZY_MAGE'] as const) rejectIntent(s, { type, command: { type: 'LEARN_GUIDANCE' } } as SliceIntent);
    rejectEntropyDuke(s, { type: 'LEARN_GUIDANCE' }); rejectEntropyDuke(s, { type: 'PREPARE_PROMOTION' }); rejectEntropyDuke(s, { type: 'REQUEST_SUPPLY' });
  });
  it('rejects unknown fields, false confirmation, wrong source IDs and invented ritual commands without mutation', () => {
    const s = prepared();
    for (const command of [{ ...dose, confirmed: false }, { ...dose, free: true }, { type: 'BUY_POTION', bottleId: 'frenzy-mage-potion-1' }, { type: 'PREPARE_TASK', taskId: 'REVIEW_DISASTER' }, { type: 'LEARN_GUIDANCE', free: true }, { type: 'RITUAL_CONTAIN' }, { type: 'RITUAL_REVIEW', stopped: true }]) {
      expect(validateEntropyDukeCommand(command)).toBe(false); rejectEntropyDuke(s, command);
    }
    rejectEntropyDuke(s, { ...dose, bottleId: 'entropy-duke-potion-99' });
  });
});

const acquisitionMutations: [string, (s: SliceState) => void][] = [
  ['refunded guidance', s => { journal(s)[0]!.after.cash++; }],
  ['free preparation', s => { journal(s).find(e => e.command.type === 'PREPARE_PROMOTION')!.after.actions++; }],
  ['unearned mastery', s => { journal(s).at(-1)!.after.mastery[ENTROPY_DUKE_ABILITY_IDS[0]] = 8; }],
  ['altered dose cursor', s => { journal(s).at(-1)!.randomBefore!++; }],
  ['altered dose check', s => { journal(s).at(-1)!.check!.difficulty++; }],
  ['duplicated old gift', s => { journal(s).at(-1)!.after.gifts.push(structuredClone(journal(s).at(-1)!.after.gifts[0]!)); }],
  ['recalled old gift', s => { journal(s).at(-1)!.after.gifts[0]!.location = 'PLAYER'; journal(s).at(-1)!.after.gifts[0]!.givenWeek = null; journal(s).at(-1)!.after.gifts[0]!.destination = null; }],
  ['fabricated injury', s => { journal(s).at(-1)!.after.injuries.push({ id: 'fabricated', severity: 'LIGHT', acquiredRevision: 1, treatedRevision: null }); }],
  ['rewritten source IDs', s => { journal(s).at(-1)!.after.completedSources[0] = 'counterfeit-source'; }],
  ['missing purchase', s => { s.entropyDuke.acquisitionJournal = journal(s).filter(e => e.command.type !== 'BUY_POTION'); }],
  ['other actor', s => { journal(s)[0]!.actor.name = 'Counterfeit'; }],
  ['other prior promotion week', s => { journal(s)[0]!.actor.frenzyMagePromotionWeek--; }],
  ['relabelled original bottle', s => { s.entropyDuke.bottles[0]!.id = 'entropy-duke-potion-2'; }],
  ['restored consumed original', s => { s.entropyDuke.bottles[0]!.status = 'PLAYER'; }],
  ['invented supplier provenance', s => { s.entropyDuke.bottles[0]!.source += ' free'; }],
  ['extra evidence field', s => { Object.assign(journal(s)[0]!, { free: true }); }],
  ['extra stage field', s => { Object.assign(s.entropyDuke, { free: true }); }],
];
describe('EntropyDuke acquisition replay rejects falsified evidence and cross-resource changes', () => {
  it.each(acquisitionMutations)('rejects %s', (_name, change) => {
    const s = promoted(); expect(validateEntropyDukeState(s)).toBe(true); change(s);
    expect(validateEntropyDukeState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it.each(['health', 'mind', 'spirituality', 'cash', 'actions', 'pollution', 'injuryRisk'] as const)('rejects a discontinuous %s budget even when both event endpoints are adjusted', field => {
    const s = promoted(), event = journal(s)[1]!;
    const delta = field === 'health' || field === 'mind' || field === 'spirituality' ? -1 : 1;
    event.before[field] += delta; event.after[field] += delta;
    expect(validateEntropyDukeJournalContinuity(s)).toBe(false); expect(validateEntropyDukeAcquisitionJournal(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it.each(['health', 'mind', 'spirituality', 'cash', 'actionsRemaining', 'injuryRisk'] as const)('rejects rewriting immediate post-potion %s without a real intervening command', field => {
    const s = promoted(); s[field] += field === 'health' || field === 'spirituality' ? -1 : 1;
    expect(validateEntropyDukeAcquisitionJournal(s)).toBe(false); expect(validateEntropyDukeState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it('rejects revision collisions, backdated checks and deleted consumed source prefixes', () => {
    const collision = promoted(); journal(collision)[1]!.revision = journal(collision)[0]!.revision;
    expect(validateEntropyDukeJournalContinuity(collision)).toBe(false); expect(validateEntropyDukeState(collision)).toBe(false);
    const backdated = promoted(); journal(backdated).at(-1)!.date = originalFrenzyMage().date;
    expect(validateEntropyDukeAcquisitionJournal(backdated)).toBe(false);
    const missing = promoted(); missing.seer.completedSources.shift();
    expect(validateEntropyDukeAcquisitionJournal(missing)).toBe(false); expect(validateEntropyDukeState(missing)).toBe(false);
  });
  it('rejects a forged no-draw cursor after an adjacent post-failure purchase', () => {
    const failed = ed(prepared('FAILURE'), dose), bought = ed(failed, { type: 'BUY_POTION', bottleId: 'entropy-duke-potion-2' });
    expect(bought.random.cursor).toBe(failed.random.cursor); expect(validateEntropyDukeJournalContinuity(bought)).toBe(true);
    bought.random.cursor++;
    expect(validateEntropyDukeJournalContinuity(bought)).toBe(false); expect(() => assertValidSliceState(bought)).toThrow();
  });
  it('replays the whole directed command continuation identically without mutating input or payloads', () => {
    const initial = directedInitial3(), original = structuredClone(initial), commands: SliceIntent[] = [];
    let s = ed(initial, { type: 'LEARN_GUIDANCE' }, commands);
    for (const taskId of ENTROPY_DUKE_PREPARATION_IDS) s = ed(s, { type: 'PREPARE_TASK', taskId }, commands);
    s = ed(s, { type: 'BUY_POTION', bottleId: 'entropy-duke-potion-1' }, commands); s = ed(s, { type: 'PREPARE_PROMOTION' }, commands); s = ed(s, dose, commands);
    const payloads = structuredClone(commands); let replayed = structuredClone(initial);
    for (const command of commands) replayed = step(replayed, command);
    expect(replayed).toEqual(s); expect(initial).toEqual(original); expect(commands).toEqual(payloads);
    expect(validateEntropyDukeJournalContinuity(replayed)).toBe(true); expect(validateEntropyDukeAcquisitionJournal(replayed)).toBe(true);
  });
  it('projects only actual knowledge, exact14 abilities and independent state copies', () => {
    const s = promoted(), before = structuredClone(s), p = projectEntropyDuke(s);
    expect(p.formulaKnown).toBe(false); expect(p.formula).toEqual([]); expect(p.abilities.map(a => a.id)).toEqual([...ENTROPY_DUKE_INHERITED_ABILITY_IDS, ...ENTROPY_DUKE_ABILITY_IDS]);
    expect(new Set(p.abilities.map(a => a.id)).size).toBe(14); expect(p.resources!.maxSpirituality).toBe(120); expect(p.currentGender).toBe(s.character.gender);
    expect(p.inheritedHistory.join(' ')).toContain('12项'); expect(p.inheritedHistory.join(' ')).toContain('第133周'); expect(p.inheritedTools).toContain('达里安');
    expect(p.story).not.toMatch(/原创G|候选|未核|原核/); expect(p.risk).not.toMatch(/原创G|候选|未核|原核/);
    p.abilities[0]!.mastery++; p.bottles[0]!.source = 'altered view'; expect(s).toEqual(before);
  });
});
