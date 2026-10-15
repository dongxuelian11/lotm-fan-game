import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createBloodDukeState, hasBloodDukeLock, projectBloodDuke, BLOOD_DUKE_INHERITED_ABILITY_IDS, validateBloodDukeAcquisitionJournal, validateBloodDukeJournalContinuity, validateBloodDukeCommand, validateBloodDukeState } from '../../src/domain/blood-duke/index.js';
import { BLOOD_DUKE_ABILITY_IDS, BLOOD_DUKE_PREPARATION_IDS } from '../../src/domain/blood-duke/types.js';
import { directedInitial3, dose, bd, oldAbyssRoots, originalBlathererPrefix, originalBlathererDead, prepared, promoted, recover, rejectBloodDuke, rejectIntent, step, taught, blathererNaturalPath } from './blood-duke-directed-helper.js';

const journal = (s: SliceState) => s.bloodDuke.acquisitionJournal;

describe('BloodDuke acquisition: actual 583-command natural S3 source and explicitly directed units', () => {
  it('replays exactly583 original commands and preserves fourteen skills, seven paid histories and the distinct DEAD ending', () => {
    const s = originalBlathererPrefix();
    expect(readObjectEntry<SliceIntent[]>(blathererNaturalPath, 'commands')).toHaveLength(592);
    expect(s).toMatchObject({ schemaVersion: 177, week: 154, health: 100, mind: 100, spirituality: 120, cash: 500, actionsRemaining: 3, injuryRisk: 0, random: { seed: 'criminal-natural-v054', cursor: 106 }, progression: { sequence: 3, acting: 100 } });
    expect(s.character.coreStats).toEqual({ physique: 29, perception: 23, will: 21, knowledge: 23 });
    expect(s.injuries).toEqual([]); expect(s.blatherer.promotionWeek).toBe(146);
    expect(s.blatherer.encounter).toMatchObject({ status: 'AVAILABLE', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120 });
    expect(s.devil.encounter).toMatchObject({ enemyStatus: 'SURRENDERED', enemyHealth: 70 });
    expect(Object.keys(s.progression.mastery)).toEqual([...BLOOD_DUKE_INHERITED_ABILITY_IDS]);
    for (const id of ['abyss.s7.demonic-lore', 'abyss.s7.ritual-practice', 'abyss.s6.danger-premonition', 'abyss.s5.catalysis']) expect(s.progression.mastery[id]).toBe(0);
    expect(s.bloodDuke).toEqual(createBloodDukeState()); assertValidSliceState(s);
    const dead = originalBlathererDead(); expect(dead.status).toBe('DEAD'); expect(dead.bloodDuke).toEqual(createBloodDukeState());
    rejectBloodDuke(dead, { type: 'LEARN_GUIDANCE' }); expect(originalBlathererDead()).toEqual(dead);
  }, 60_000);
  it('declares pre-journal unit budgets and cursor without editing, healing or refilling the original source', () => {
    const original = originalBlathererPrefix(), s = directedInitial3();
    expect(s).toMatchObject({ week: 158, cash: 100000, actionsRemaining: 100, weeklyBudget: 100, health: 100, mind: 100, spirituality: 120, injuryRisk: 0 });
    expect(s.date).toEqual(addGameDays(original.date, 28)); expect(s.random.seed).toBe(original.random.seed);
    expect(s.random.cursor).toBeGreaterThanOrEqual(original.random.cursor); expect(s.random.cursor).toBeLessThan(original.random.cursor + 512);
    expect(oldAbyssRoots(s)).toEqual(oldAbyssRoots(original)); expect(s.injuries).toEqual(original.injuries);
    expect(s.character).toEqual(original.character); expect(s.progression).toEqual(original.progression);
    expect(journal(s)).toEqual([]); expect(originalBlathererPrefix()).toEqual(original);
  });
  it('keeps independent defaults and hides the stage from unrelated, earlier and S1/S0 characters', () => {
    const s = createSliceRun('blood-duke-hidden', sliceDefaultCreationSelection, 'blood-duke-hidden');
    expect(projectBloodDuke(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], resources: null });
    rejectBloodDuke(s, { type: 'LEARN_GUIDANCE' });
    const a = createBloodDukeState(); a.bottles[0]!.labourSteps = 5;
    expect(s.bloodDuke.bottles[0]!.labourSteps).toBe(0);
    for (const sequence of [4, 1, 0] as const) { const t = originalBlathererPrefix(); t.progression.sequence = sequence; expect(projectBloodDuke(t).discovered).toBe(false); rejectBloodDuke(t, { type: 'LEARN_GUIDANCE' }); }
  });
  it('rejects changed lineage and missing or invented skills before accepting new costs', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.blatherer.promotionWeek = null; }, s => { s.blatherer.devilActingAtPromotion = 99; },
      s => { s.progression.pathwayId = 'hermit'; }, s => { delete s.progression.mastery['abyss.s3.limited-murmur']; },
      s => { s.progression.mastery['abyss.s2.invented'] = 0; },
      s => { s.criminal.bottles.find(b => b.status === 'CONSUMED' && ['SUCCESS', 'GREAT_SUCCESS'].includes(b.outcome ?? ''))!.acquiredWeek = s.week + 1; },
    ];
    for (const [index, change] of mutations.entries()) {
      const s = directedInitial3(); change(s);
      try { rejectBloodDuke(s, { type: 'LEARN_GUIDANCE' }); } catch (cause) { throw new Error(`Lineage mutation ${index} was accepted`, { cause }); }
    }
  });
  it('requires twelve complete weeks from actual promotion146, so week154 cannot consume', () => {
    let s = taught('SUCCESS', false);
    expect(projectBloodDuke(s).digestion).toContain('8/12');
    for (const taskId of BLOOD_DUKE_PREPARATION_IDS) s = bd(s, { type: 'PREPARE_TASK', taskId });
    s = bd(s, { type: 'BUY_POTION', bottleId: 'blood-duke-potion-1' });
    rejectBloodDuke(s, { type: 'PREPARE_PROMOTION' }); rejectBloodDuke(s, dose);
    const atBoundary = prepared(); expect(atBoundary.week).toBe(158); expect(projectBloodDuke(atBoundary).digestion).toContain('12/12');
    expect(bd(atBoundary, dose).bloodDuke.promotionWeek).toBe(158);
  });
  it('requires each actual old report and reflection before current preparation', () => {
    for (const missing of ['blatherer-life-conflicting-bell', 'blatherer-life-withdrawn-invitation', 'blatherer-life-open-corridor', 'blatherer-reflection']) {
      const s = prepared(); s.seer.completedSources = s.seer.completedSources.filter(id => id !== missing);
      rejectBloodDuke(s, dose); expect(validateBloodDukeAcquisitionJournal(s)).toBe(false);
    }
    const incomplete = prepared(); incomplete.blatherer.life.reflected = false; rejectBloodDuke(incomplete, dose);
  });
  it('rejects resurrecting or backdating an old consumed original at the whole-state save boundary', () => {
    const restored = originalBlathererPrefix(); restored.criminal.bottles[0]!.status = 'PLAYER';
    expect(restored.criminal.bottles[0]!.consumedWeek).toBe(5); expect(() => assertValidSliceState(restored)).toThrow();
    const backdated = originalBlathererPrefix(); backdated.criminal.bottles[0]!.acquiredWeek = 158;
    expect(() => assertValidSliceState(backdated)).toThrow();
  });
  it('guidance costs exactly500 and one action without granting skills or inventory', () => {
    const before = directedInitial3(), payload = { type: 'LEARN_GUIDANCE' } as const, s = bd(before, payload), e = journal(s)[0]!;
    expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]); expect(s.progression.mastery).toEqual(before.progression.mastery);
    expect(s.bloodDuke.bottles.every(b => b.status === 'SUPPLIER')).toBe(true);
    expect([e.before.cash - e.after.cash, e.before.actions - e.after.actions]).toEqual([500, 1]);
    expect([e.check, e.randomBefore, e.randomAfter]).toEqual([null, null, null]);
    expect(e.actor).toEqual({ name: before.character.name, gender: before.character.gender, pathwayId: 'abyss', blathererPromotionWeek: 146, criminalPromotionWeek: 5 });
    expect(oldAbyssRoots(s)).toEqual(oldAbyssRoots(before)); expect(payload).toEqual({ type: 'LEARN_GUIDANCE' });
    expect(before.bloodDuke.guidanceKnown).toBe(false); rejectBloodDuke(s, payload);
  });
});

describe('BloodDuke paid acquisition, preparations, four real potion tiers and bounded resupply', () => {
  it('five actual jobs discount only their specific bottle and still require900', () => {
    let s = taught(); const before = structuredClone(s);
    for (let n = 0; n < 5; n++) s = bd(s, { type: 'POTION_WORK', bottleId: 'blood-duke-potion-2' });
    expect([s.actionsRemaining, s.cash]).toEqual([before.actionsRemaining - 5, before.cash]);
    expect(s.bloodDuke.bottles[1]).toMatchObject({ labourSteps: 5, status: 'SUPPLIER' }); expect(s.bloodDuke.bottles[0]!.labourSteps).toBe(0);
    rejectBloodDuke(s, { type: 'POTION_WORK', bottleId: 'blood-duke-potion-2' });
    s = bd(s, { type: 'BUY_POTION', bottleId: 'blood-duke-potion-2' }); expect(s.cash).toBe(before.cash - 900);
    expect(s.bloodDuke.bottles[1]).toMatchObject({ status: 'PLAYER', acquiredWeek: 158 }); rejectBloodDuke(s, { type: 'BUY_POTION', bottleId: 'blood-duke-potion-2' });
    expect(validateBloodDukeAcquisitionJournal(s)).toBe(true); rejectBloodDuke(s, { type: 'PREPARE_PROMOTION' });
  });
  it('four jobs give no partial credit and earned credit never transfers to another bottle', () => {
    let s = taught(); for (let n = 0; n < 4; n++) s = bd(s, { type: 'POTION_WORK', bottleId: 'blood-duke-potion-1' });
    const cash = s.cash; s = bd(s, { type: 'BUY_POTION', bottleId: 'blood-duke-potion-1' }); expect(s.cash).toBe(cash - 6400);
    s = bd(s, { type: 'BUY_POTION', bottleId: 'blood-duke-potion-2' }); expect(s.cash).toBe(cash - 12800);
    const credited = prepared('SUCCESS', true); expect([credited.cash, credited.actionsRemaining]).toEqual([98460, 90]);
  });
  it('requires all three distinct preparations and cancellation refunds neither140 nor an action', () => {
    let s = taught(); const ap = s.actionsRemaining;
    for (const taskId of BLOOD_DUKE_PREPARATION_IDS) { rejectBloodDuke(s, { type: 'PREPARE_PROMOTION' }); s = bd(s, { type: 'PREPARE_TASK', taskId }); rejectBloodDuke(s, { type: 'PREPARE_TASK', taskId }); }
    expect(s.actionsRemaining).toBe(ap - 3); rejectBloodDuke(s, { type: 'PREPARE_PROMOTION' });
    const ready = prepared(), e = journal(ready).at(-1)!;
    expect([e.before.cash - e.after.cash, e.before.actions - e.after.actions]).toEqual([140, 1]);
    expect([ready.cash, ready.actionsRemaining]).toEqual([92960, 95]); expect(hasBloodDukeLock(ready)).toBe(true);
    rejectIntent(ready, { type: 'ACTION', action: 'REST' }); rejectBloodDuke(ready, { type: 'LEARN_GUIDANCE' });
    const left = bd(ready, { type: 'LEAVE_PREPARATION' });
    expect([left.cash, left.actionsRemaining, left.health, left.spirituality]).toEqual([ready.cash, ready.actionsRemaining, ready.health, ready.spirituality]);
    expect(left.bloodDuke.bottles[0]!.status).toBe('PLAYER'); expect(left.bloodDuke.preparedWeek).toBeNull(); expect(left.bloodDuke.preparations).toEqual(ready.bloodDuke.preparations);
    expect(oldAbyssRoots(left)).toEqual(oldAbyssRoots(ready)); rejectBloodDuke(left, dose);
    const retried = bd(left, { type: 'PREPARE_PROMOTION' }); expect([retried.cash, retried.actionsRemaining]).toEqual([left.cash - 140, left.actionsRemaining - 1]);
  });
  it.each(BLOOD_DUKE_PREPARATION_IDS)('owning a real potion never substitutes for missing preparation %s', omitted => {
    let s = bd(taught(), { type: 'BUY_POTION', bottleId: 'blood-duke-potion-1' });
    for (const taskId of BLOOD_DUKE_PREPARATION_IDS.filter(id => id !== omitted)) s = bd(s, { type: 'PREPARE_TASK', taskId });
    rejectBloodDuke(s, { type: 'PREPARE_PROMOTION' }); rejectBloodDuke(s, dose);
    s = bd(s, { type: 'PREPARE_TASK', taskId: omitted }); expect(bd(s, { type: 'PREPARE_PROMOTION' }).bloodDuke.preparedWeek).toBe(158);
  });
  it.each(['SUCCESS', 'GREAT_SUCCESS'] as const)('directed unit %s gives exactly14→16 without healing, resource refills or rewriting history', kind => {
    const before = prepared(kind), snapshot = structuredClone(before), s = bd(before, dose), e = journal(s).at(-1)!;
    const rng = new DeterministicActionRandomStream(before.random.seed, before.random.cursor);
    expect(e.check).toEqual(resolveNormalCheck({ ability: 'will', baseAbility: before.character.coreStats.will, difficulty: 30, modifiers: [], roll: rng.nextInt(1, 100) }));
    expect(e.check!.tier).toBe(kind); expect([e.randomBefore, e.randomAfter, s.random.cursor]).toEqual([before.random.cursor, rng.cursor, rng.cursor]);
    expect(s.progression.sequence).toBe(2); expect(Object.keys(s.progression.mastery)).toEqual([...BLOOD_DUKE_INHERITED_ABILITY_IDS, ...BLOOD_DUKE_ABILITY_IDS]);
    for (const [id, mastery] of Object.entries(before.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    for (const id of BLOOD_DUKE_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const stat of ['physique', 'perception', 'knowledge', 'will'] as const) expect(s.character.coreStats[stat]).toBe(before.character.coreStats[stat] + 1);
    expect([s.health, s.spirituality, s.mind, s.injuryRisk, s.character.gender]).toEqual([100, 120, kind === 'GREAT_SUCCESS' ? 92 : 85, 0, before.character.gender]);
    expect(s.injuries).toEqual(before.injuries); expect(oldAbyssRoots(s)).toEqual(oldAbyssRoots(before)); expect(s.seer.completedSources).toEqual(before.seer.completedSources);
    expect(s.bloodDuke.blathererActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
    expect(s.bloodDuke.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind, preparationWeek: 158, consumedWeek: 158 });
    expect([s.actionsRemaining, s.cash]).toEqual([before.actionsRemaining, before.cash]); expect(before).toEqual(snapshot);
    expect(validateBloodDukeAcquisitionJournal(s)).toBe(true); assertValidSliceState(s); rejectBloodDuke(s, dose);
  });
  it('does not refill a declared pre-journal partial health or spirituality budget on successful promotion', () => {
    let s = directedInitial3('SUCCESS'); s.health = 83; s.mind = 85; s.spirituality = 17;
    s = bd(s, { type: 'LEARN_GUIDANCE' }); for (const taskId of BLOOD_DUKE_PREPARATION_IDS) s = bd(s, { type: 'PREPARE_TASK', taskId });
    s = bd(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = bd(s, { type: 'PREPARE_PROMOTION' }); s = bd(s, dose);
    expect([s.health, s.mind, s.spirituality]).toEqual([83, 70, 17]); expect(projectBloodDuke(s).resources!.maxSpirituality).toBe(120);
    expect(validateBloodDukeAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
  });
  it.each([['FAILURE', 85, 75, 30], ['GREAT_FAILURE', 75, 55, 60]] as const)('directed unit %s consumes the original bottle with exact retained costs', (kind, health, mind, pollution) => {
    const before = prepared(kind), s = bd(before, dose);
    expect(s).toMatchObject({ health, mind, spirituality: 120, progression: { sequence: 3, acting: 100 } }); expect(s.seer.pollution).toBe(pollution);
    expect(s.bloodDuke.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind, consumedWeek: 158, preparationWeek: 158 }); expect(s.bloodDuke.preparedWeek).toBeNull();
    expect([s.cash, s.actionsRemaining]).toEqual([before.cash, before.actionsRemaining]); expect(s.bloodDuke.preparations).toEqual(before.bloodDuke.preparations);
    expect(oldAbyssRoots(s)).toEqual(oldAbyssRoots(before)); expect(s.injuries).toEqual(before.injuries); expect(Object.keys(s.progression.mastery)).toHaveLength(14);
    expect(s.seer.completedSources).toEqual(before.seer.completedSources); expect(validateBloodDukeAcquisitionJournal(s)).toBe(true); assertValidSliceState(s); rejectBloodDuke(s, dose);
    const bought = bd(s, { type: 'BUY_POTION', bottleId: 'blood-duke-potion-2' }); expect(bd(bought, { type: 'PREPARE_PROMOTION' }).cash).toBe(s.cash - 6400 - 140);
  });
  it('ordinary REST restores actor resources through real actions without resetting old histories', () => {
    const before = promoted(), commands: SliceIntent[] = [], s = recover(before, commands);
    expect(commands.length).toBeGreaterThan(0); expect(commands.every(c => c.type === 'ACTION' && c.action === 'REST')).toBe(true);
    expect([s.health, s.mind, s.spirituality, s.injuryRisk]).toEqual([100, 100, 120, 0]); expect(s.injuries).toEqual([]);
    expect([s.actionsRemaining, s.cash]).toEqual([before.actionsRemaining - commands.length, before.cash]);
    expect(s.random).toEqual(before.random); expect(oldAbyssRoots(s)).toEqual(oldAbyssRoots(before)); expect(s.bloodDuke).toEqual(before.bloodDuke); assertValidSliceState(s);
  });
  it('uses only declared low pre-journal resources and confines the minimum1 support to the actual potion', () => {
    let s = directedInitial3('GREAT_FAILURE'); s.health = 21; s.mind = 41;
    s = bd(s, { type: 'LEARN_GUIDANCE' }); for (const taskId of BLOOD_DUKE_PREPARATION_IDS) s = bd(s, { type: 'PREPARE_TASK', taskId });
    s = bd(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = bd(s, { type: 'PREPARE_PROMOTION' }); s = bd(s, dose);
    expect(s).toMatchObject({ status: 'ACTIVE', health: 1, mind: 1, progression: { sequence: 3 } });
    const bought = bd(s, { type: 'BUY_POTION', bottleId: 'blood-duke-potion-2' }); rejectBloodDuke(bought, { type: 'PREPARE_PROMOTION' });
    expect(s.bloodDuke.bottles[0]!.status).toBe('CONSUMED'); expect(validateBloodDukeAcquisitionJournal(s)).toBe(true);
  });
  it('requires three actually failed original bottles and next-week delivery of independent new stock', () => {
    let s = taught('THREE_FAILURES'); rejectBloodDuke(s, { type: 'REQUEST_SUPPLY' }); rejectBloodDuke(s, { type: 'RECEIVE_SUPPLY' });
    for (const taskId of BLOOD_DUKE_PREPARATION_IDS) s = bd(s, { type: 'PREPARE_TASK', taskId });
    const originalRoots = structuredClone(oldAbyssRoots(s));
    for (const bottleId of ['blood-duke-potion-1', 'blood-duke-potion-2', 'blood-duke-potion-3']) {
      s = recover(s); s = bd(s, { type: 'BUY_POTION', bottleId }); s = bd(s, { type: 'PREPARE_PROMOTION' }); s = bd(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    expect(s.bloodDuke.bottles.every(b => b.status === 'CONSUMED' && b.outcome === 'FAILURE')).toBe(true);
    expect(s.cash).toBe(100000 - 500 - 3 * (6400 + 140));
    const old = structuredClone(s.bloodDuke.bottles), beforeAP = s.actionsRemaining;
    s = bd(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(beforeAP - 1); expect(s.bloodDuke.bottles).toEqual(old); rejectBloodDuke(s, { type: 'RECEIVE_SUPPLY' });
    // Advance the unit continuation through real REST actions, never editing the
    // week/date or a resource once the first BloodDuke journal has been recorded.
    const requestWeek = s.week, requestDate = structuredClone(s.date), remaining = s.actionsRemaining;
    let nextWeek = s;
    for (let n = 0; n < remaining; n++) nextWeek = step(nextWeek, { type: 'ACTION', action: 'REST' });
    expect(nextWeek.week).toBe(requestWeek + 1); expect(nextWeek.date).toEqual(addGameDays(requestDate, 7));
    const received = bd(nextWeek, { type: 'RECEIVE_SUPPLY' });
    expect(received.bloodDuke.bottles.slice(0, 3)).toEqual(old); expect(received.bloodDuke.bottles.slice(3).map(b => b.id)).toEqual(['blood-duke-potion-4', 'blood-duke-potion-5', 'blood-duke-potion-6']);
    expect(received.bloodDuke.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.stockedWeek === 159 && b.acquiredWeek === null && b.labourSteps === 0 && b.source.includes(b.id))).toBe(true);
    expect([received.cash, received.actionsRemaining]).toEqual([nextWeek.cash, nextWeek.actionsRemaining]); expect(oldAbyssRoots(received)).toEqual(originalRoots);
    expect(validateBloodDukeAcquisitionJournal(received)).toBe(true); assertValidSliceState(received); rejectBloodDuke(received, { type: 'RECEIVE_SUPPLY' });
  });
  it('closes every predecessor acquisition command after the real BloodDuke promotion', () => {
    const s = promoted();
    for (const type of ['CRIMINAL', 'UNWINGED', 'SERIAL_KILLER', 'DEMON', 'DESIRE_APOSTLE', 'DEVIL', 'BLATHERER'] as const) rejectIntent(s, { type, command: { type: 'LEARN_GUIDANCE' } } as SliceIntent);
    rejectBloodDuke(s, { type: 'LEARN_GUIDANCE' }); rejectBloodDuke(s, { type: 'PREPARE_PROMOTION' }); rejectBloodDuke(s, { type: 'REQUEST_SUPPLY' });
  });
  it('rejects unknown fields, false confirmation, wrong source IDs and invented ritual commands without mutation', () => {
    const s = prepared();
    for (const command of [{ ...dose, confirmed: false }, { ...dose, free: true }, { type: 'BUY_POTION', bottleId: 'blatherer-potion-1' }, { type: 'PREPARE_TASK', taskId: 'REVIEW_DISASTER' }, { type: 'LEARN_GUIDANCE', free: true }, { type: 'RITUAL_CONTAIN' }, { type: 'RITUAL_REVIEW', stopped: true }]) {
      expect(validateBloodDukeCommand(command)).toBe(false); rejectBloodDuke(s, command);
    }
    rejectBloodDuke(s, { ...dose, bottleId: 'blood-duke-potion-99' });
  });
});

const acquisitionMutations: [string, (s: SliceState) => void][] = [
  ['refunded guidance', s => { journal(s)[0]!.after.cash++; }],
  ['free preparation', s => { journal(s).find(e => e.command.type === 'PREPARE_PROMOTION')!.after.actions++; }],
  ['unearned mastery', s => { journal(s).at(-1)!.after.mastery[BLOOD_DUKE_ABILITY_IDS[0]] = 8; }],
  ['altered dose cursor', s => { journal(s).at(-1)!.randomBefore!++; }],
  ['altered dose check', s => { journal(s).at(-1)!.check!.difficulty++; }],
  ['fabricated injury', s => { journal(s).at(-1)!.after.injuries.push({ id: 'fabricated', severity: 'LIGHT', acquiredRevision: 1, treatedRevision: null }); }],
  ['rewritten source IDs', s => { journal(s).at(-1)!.after.completedSources[0] = 'counterfeit-source'; }],
  ['missing purchase', s => { s.bloodDuke.acquisitionJournal = journal(s).filter(e => e.command.type !== 'BUY_POTION'); }],
  ['other actor', s => { journal(s)[0]!.actor.name = 'Counterfeit'; }],
  ['other prior promotion week', s => { journal(s)[0]!.actor.blathererPromotionWeek--; }],
  ['relabelled original bottle', s => { s.bloodDuke.bottles[0]!.id = 'blood-duke-potion-2'; }],
  ['restored consumed original', s => { s.bloodDuke.bottles[0]!.status = 'PLAYER'; }],
  ['invented supplier provenance', s => { s.bloodDuke.bottles[0]!.source += ' free'; }],
  ['extra evidence field', s => { Object.assign(journal(s)[0]!, { free: true }); }],
  ['extra stage field', s => { Object.assign(s.bloodDuke, { free: true }); }],
];
describe('BloodDuke acquisition replay rejects falsified evidence and cross-resource changes', () => {
  it.each(acquisitionMutations)('rejects %s', (_name, change) => {
    const s = promoted(); expect(validateBloodDukeState(s)).toBe(true); change(s);
    expect(validateBloodDukeState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it.each(['health', 'mind', 'spirituality', 'cash', 'actions', 'pollution', 'injuryRisk'] as const)('rejects a discontinuous %s budget even when both event endpoints are adjusted', field => {
    const s = promoted(), event = journal(s)[1]!;
    const delta = field === 'health' || field === 'mind' || field === 'spirituality' ? -1 : 1;
    event.before[field] += delta; event.after[field] += delta;
    expect(validateBloodDukeJournalContinuity(s)).toBe(false); expect(validateBloodDukeAcquisitionJournal(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it.each(['health', 'mind', 'spirituality', 'cash', 'actionsRemaining', 'injuryRisk'] as const)('rejects rewriting immediate post-potion %s without a real intervening command', field => {
    const s = promoted(); s[field] += field === 'health' || field === 'spirituality' ? -1 : 1;
    expect(validateBloodDukeAcquisitionJournal(s)).toBe(false); expect(validateBloodDukeState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it('rejects revision collisions, backdated checks and deleted consumed source prefixes', () => {
    const collision = promoted(); journal(collision)[1]!.revision = journal(collision)[0]!.revision;
    expect(validateBloodDukeJournalContinuity(collision)).toBe(false); expect(validateBloodDukeState(collision)).toBe(false);
    const backdated = promoted(); journal(backdated).at(-1)!.date = originalBlathererPrefix().date;
    expect(validateBloodDukeAcquisitionJournal(backdated)).toBe(false);
    const missing = promoted(); missing.seer.completedSources.shift();
    expect(validateBloodDukeAcquisitionJournal(missing)).toBe(false); expect(validateBloodDukeState(missing)).toBe(false);
  });
  it('replays the whole directed command continuation identically without mutating input or payloads', () => {
    const initial = directedInitial3(), original = structuredClone(initial), commands: SliceIntent[] = [];
    let s = bd(initial, { type: 'LEARN_GUIDANCE' }, commands);
    for (const taskId of BLOOD_DUKE_PREPARATION_IDS) s = bd(s, { type: 'PREPARE_TASK', taskId }, commands);
    s = bd(s, { type: 'BUY_POTION', bottleId: 'blood-duke-potion-1' }, commands); s = bd(s, { type: 'PREPARE_PROMOTION' }, commands); s = bd(s, dose, commands);
    const payloads = structuredClone(commands); let replayed = structuredClone(initial);
    for (const command of commands) replayed = step(replayed, command);
    expect(replayed).toEqual(s); expect(initial).toEqual(original); expect(commands).toEqual(payloads);
    expect(validateBloodDukeJournalContinuity(replayed)).toBe(true); expect(validateBloodDukeAcquisitionJournal(replayed)).toBe(true);
  });
  it('projects only actual knowledge, exact16 abilities and independent state copies', () => {
    const s = promoted(), before = structuredClone(s), p = projectBloodDuke(s);
    expect(p.formulaKnown).toBe(false); expect(p.formula).toEqual([]); expect(p.abilities.map(a => a.id)).toEqual([...BLOOD_DUKE_INHERITED_ABILITY_IDS, ...BLOOD_DUKE_ABILITY_IDS]);
    expect(new Set(p.abilities.map(a => a.id)).size).toBe(16); expect(p.resources!.maxSpirituality).toBe(120); expect(p.currentGender).toBe(s.character.gender);
    expect(p.inheritedHistory.join(' ')).toContain('14项'); expect(p.inheritedHistory.join(' ')).toContain('第146周'); expect(p.inheritedTools).toContain('诺拉');
    expect(p.story).not.toMatch(/原创G|候选|未核|原核/); expect(p.risk).not.toMatch(/原创G|候选|未核|原核/);
    p.abilities[0]!.mastery++; p.bottles[0]!.source = 'altered view'; expect(s).toEqual(before);
  });
});
