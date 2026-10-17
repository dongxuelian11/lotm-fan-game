import { CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createElderState, hasElderLock, projectElder, ELDER_INHERITED_ABILITY_IDS, validateElderAcquisitionJournal, validateElderJournalContinuity, validateElderCommand, validateElderState } from '../../src/domain/elder/index.js';
import { ELDER_ABILITY_IDS, ELDER_PREPARATION_IDS } from '../../src/domain/elder/types.js';
import { directedInitial3, dose, eg, hangedManLegacyKeys, oldHangedManRoots, originalTemplarFinal, prepared, promoted, recover, rejectElder, rejectIntent, step, taught, templarNaturalPath } from './elder-directed-helper.js';

const journal = (s: SliceState) => s.elder.acquisitionJournal;

describe('Elder acquisition: actual 500-command natural S3 source and explicitly directed units', () => {
  it('retains seven original roots, 13 skills, untreated injuries, spent bottles and all original people and spirits', () => {
    const s = originalTemplarFinal(), raw = readObjectEntry<SliceState>(templarNaturalPath, 'final');
    expect(readObjectEntry<{ kind: string; newRandomChanges: boolean }>(templarNaturalPath, 'provenance')).toMatchObject({ kind: 'SAME_SEED_PUBLIC_NATURAL_PREFIX', newRandomChanges: false });
    expect(readObjectEntry<SliceIntent[]>(templarNaturalPath, 'commands')).toHaveLength(500);
    expect(s).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, week: 124, health: 40, mind: 96, spirituality: 120, cash: 600, actionsRemaining: 3, injuryRisk: 3, random: { seed: 'secret-supplicant-natural-v051', cursor: 313 }, progression: { sequence: 3, acting: 100 }, character: { gender: 'FEMALE' } });
    expect(s.injuries.map(i => [i.severity, i.treatedRevision])).toEqual([['HEAVY', null], ['LIGHT', null], ['LIGHT', null], ['LIGHT', null]]);
    for (const key of hangedManLegacyKeys) expect(s[key]).toEqual(raw[key]);
    expect(s.threeHeadedTemplar.promotionWeek).toBe(113);
    expect(s.threeHeadedTemplar.life.spirits['THT3-HELENA']).toMatchObject({ status: 'GRAZED', location: 'INTERNAL', integrity: 60, spirituality: 18 });
    expect(s.threeHeadedTemplar.life.spirits['THT3-ROLAND']).toMatchObject({ status: 'GRAZED', location: 'INTERNAL', integrity: 100, spirituality: 27 });
    expect(s.shepherd.grazing.spirits.find(p => p.id === 'SH5-CEDRIC-1')).toMatchObject({ status: 'RELEASED', releasedWeek: 64 });
    expect(s.blackKnight.life.shade).toMatchObject({ creatureId: 'BK4-SHADE-1', status: 'ISOLATED', roomStatus: 'QUARANTINED', emergencySealUsed: true, glassHood: 'BROKEN' });
    expect(s.blackKnight.encounter).toMatchObject({ enemyStatus: 'SURRENDERED', enemyHealth: 40 });
    expect(s.threeHeadedTemplar.encounter).toMatchObject({ status: 'RETREATED', enemyStatus: 'RESISTING', enemyHealth: 80 });
    expect(Object.keys(s.progression.mastery)).toEqual([...ELDER_INHERITED_ABILITY_IDS]);
    expect(s.elder).toEqual(createElderState()); assertValidSliceState(s);
  });
  it('declares pre-journal unit budgets and cursor without editing, healing or refilling the original source', () => {
    const original = originalTemplarFinal(), s = directedInitial3();
    expect(s).toMatchObject({ week: 125, cash: 100000, actionsRemaining: 100, weeklyBudget: 100, health: 40, mind: 96, spirituality: 120, injuryRisk: 3 });
    expect(s.date).toEqual(addGameDays(original.date, 7)); expect(s.random.seed).toBe(original.random.seed);
    expect(s.random.cursor).toBeGreaterThanOrEqual(original.random.cursor); expect(s.random.cursor).toBeLessThan(original.random.cursor + 512);
    expect(oldHangedManRoots(s)).toEqual(oldHangedManRoots(original)); expect(s.injuries).toEqual(original.injuries);
    expect(s.character).toEqual(original.character); expect(s.progression).toEqual(original.progression);
    expect(journal(s)).toEqual([]); expect(originalTemplarFinal()).toEqual(original);
  });
  it('keeps independent defaults and this old channel closed for unrelated, earlier, S1 and S0 characters', () => {
    const s = createSliceRun('elder-hidden', sliceDefaultCreationSelection, 'elder-hidden');
    expect(projectElder(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], resources: null });
    rejectElder(s, { type: 'LEARN_GUIDANCE' });
    const a = createElderState(); a.bottles[0]!.labourSteps = 5;
    expect(s.elder.bottles[0]!.labourSteps).toBe(0);
    for (const sequence of [4, 1, 0] as const) { const t = originalTemplarFinal(); t.progression.sequence = sequence; expect(projectElder(t).discovered).toBe(false); rejectElder(t, { type: 'LEARN_GUIDANCE' }); }
  });
  it('rejects changed lineage and missing or invented skills before accepting new costs', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.threeHeadedTemplar.promotionWeek = null; }, s => { s.threeHeadedTemplar.blackKnightActingAtPromotion = 99; },
      s => { s.progression.pathwayId = 'hermit'; }, s => { delete s.progression.mastery['hanged-man.s3.multiple-release']; },
      s => { s.progression.mastery['hanged-man.s2.invented'] = 0; },
      s => { s.secretSupplicant.bottles.find(b => b.status === 'CONSUMED' && b.outcome === 'GREAT_SUCCESS')!.acquiredWeek = s.week + 1; },
    ];
    for (const [index, change] of mutations.entries()) {
      const s = directedInitial3(); change(s);
      try { rejectElder(s, { type: 'LEARN_GUIDANCE' }); } catch (cause) { throw new Error(`Lineage mutation ${index} was accepted`, { cause }); }
    }
  });
  it('requires twelve complete weeks from actual promotion113, so week124 cannot consume', () => {
    let s = taught('SUCCESS', false);
    expect(projectElder(s).digestion).toContain('11/12');
    for (const taskId of ELDER_PREPARATION_IDS) s = eg(s, { type: 'PREPARE_TASK', taskId });
    s = eg(s, { type: 'BUY_POTION', bottleId: 'elder-potion-1' });
    rejectElder(s, { type: 'PREPARE_PROMOTION' }); rejectElder(s, dose);
    const atBoundary = prepared(); expect(atBoundary.week).toBe(125); expect(projectElder(atBoundary).digestion).toContain('12/12');
    expect(eg(atBoundary, dose).elder.promotionWeek).toBe(125);
  });
  it('rejects resurrecting or backdating an old failed original at the whole-state save boundary', () => {
    const restored = originalTemplarFinal(); restored.secretSupplicant.bottles[0]!.status = 'PLAYER';
    expect(restored.secretSupplicant.bottles[0]!.consumedWeek).toBe(5); expect(() => assertValidSliceState(restored)).toThrow();
    const backdated = originalTemplarFinal(); backdated.secretSupplicant.bottles[0]!.acquiredWeek = 125;
    expect(() => assertValidSliceState(backdated)).toThrow();
  });
  it('guidance costs exactly500 and one action without granting skills or inventory', () => {
    const before = directedInitial3(), payload = { type: 'LEARN_GUIDANCE' } as const, s = eg(before, payload), e = journal(s)[0]!;
    expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]); expect(s.progression.mastery).toEqual(before.progression.mastery);
    expect(s.elder.bottles.every(b => b.status === 'SUPPLIER')).toBe(true);
    expect([e.before.cash - e.after.cash, e.before.actions - e.after.actions]).toEqual([500, 1]);
    expect([e.check, e.randomBefore, e.randomAfter]).toEqual([null, null, null]);
    expect(e.actor).toEqual({ name: '艾洛', gender: 'FEMALE', pathwayId: 'hanged-man', threeHeadedTemplarPromotionWeek: 113, secretSupplicantPromotionWeek: 6 });
    expect(oldHangedManRoots(s)).toEqual(oldHangedManRoots(before)); expect(payload).toEqual({ type: 'LEARN_GUIDANCE' });
    expect(before.elder.guidanceKnown).toBe(false); rejectElder(s, payload);
  });
});

describe('Elder paid acquisition, preparations, four real potion tiers and bounded resupply', () => {
  it('five actual jobs discount only their specific bottle and still require900', () => {
    let s = taught(); const before = structuredClone(s);
    for (let n = 0; n < 5; n++) s = eg(s, { type: 'POTION_WORK', bottleId: 'elder-potion-2' });
    expect([s.actionsRemaining, s.cash]).toEqual([before.actionsRemaining - 5, before.cash]);
    expect(s.elder.bottles[1]).toMatchObject({ labourSteps: 5, status: 'SUPPLIER' }); expect(s.elder.bottles[0]!.labourSteps).toBe(0);
    rejectElder(s, { type: 'POTION_WORK', bottleId: 'elder-potion-2' });
    s = eg(s, { type: 'BUY_POTION', bottleId: 'elder-potion-2' }); expect(s.cash).toBe(before.cash - 900);
    expect(s.elder.bottles[1]).toMatchObject({ status: 'PLAYER', acquiredWeek: 125 }); rejectElder(s, { type: 'BUY_POTION', bottleId: 'elder-potion-2' });
    expect(validateElderAcquisitionJournal(s)).toBe(true); rejectElder(s, { type: 'PREPARE_PROMOTION' });
  });
  it('four jobs give no partial credit and earned credit never transfers to another bottle', () => {
    let s = taught(); for (let n = 0; n < 4; n++) s = eg(s, { type: 'POTION_WORK', bottleId: 'elder-potion-1' });
    const cash = s.cash; s = eg(s, { type: 'BUY_POTION', bottleId: 'elder-potion-1' }); expect(s.cash).toBe(cash - 6400);
    s = eg(s, { type: 'BUY_POTION', bottleId: 'elder-potion-2' }); expect(s.cash).toBe(cash - 12800);
    const credited = prepared('SUCCESS', true); expect([credited.cash, credited.actionsRemaining]).toEqual([98460, 90]);
  });
  it('requires all three distinct preparations and cancellation refunds neither140 nor an action', () => {
    let s = taught(); const ap = s.actionsRemaining;
    for (const taskId of ELDER_PREPARATION_IDS) { rejectElder(s, { type: 'PREPARE_PROMOTION' }); s = eg(s, { type: 'PREPARE_TASK', taskId }); rejectElder(s, { type: 'PREPARE_TASK', taskId }); }
    expect(s.actionsRemaining).toBe(ap - 3); rejectElder(s, { type: 'PREPARE_PROMOTION' });
    const ready = prepared(), e = journal(ready).at(-1)!;
    expect([e.before.cash - e.after.cash, e.before.actions - e.after.actions]).toEqual([140, 1]);
    expect([ready.cash, ready.actionsRemaining]).toEqual([92960, 95]); expect(hasElderLock(ready)).toBe(true);
    rejectIntent(ready, { type: 'ACTION', action: 'REST' }); rejectElder(ready, { type: 'LEARN_GUIDANCE' });
    const left = eg(ready, { type: 'LEAVE_PREPARATION' });
    expect([left.cash, left.actionsRemaining, left.health, left.spirituality]).toEqual([ready.cash, ready.actionsRemaining, ready.health, ready.spirituality]);
    expect(left.elder.bottles[0]!.status).toBe('PLAYER'); expect(left.elder.preparedWeek).toBeNull(); expect(left.elder.preparations).toEqual(ready.elder.preparations);
    expect(oldHangedManRoots(left)).toEqual(oldHangedManRoots(ready)); rejectElder(left, dose);
    const retried = eg(left, { type: 'PREPARE_PROMOTION' }); expect([retried.cash, retried.actionsRemaining]).toEqual([left.cash - 140, left.actionsRemaining - 1]);
  });
  it.each(ELDER_PREPARATION_IDS)('owning a real potion never substitutes for missing preparation %s', omitted => {
    let s = eg(taught(), { type: 'BUY_POTION', bottleId: 'elder-potion-1' });
    for (const taskId of ELDER_PREPARATION_IDS.filter(id => id !== omitted)) s = eg(s, { type: 'PREPARE_TASK', taskId });
    rejectElder(s, { type: 'PREPARE_PROMOTION' }); rejectElder(s, dose);
    s = eg(s, { type: 'PREPARE_TASK', taskId: omitted }); expect(eg(s, { type: 'PREPARE_PROMOTION' }).elder.preparedWeek).toBe(125);
  });
  it.each(['SUCCESS', 'GREAT_SUCCESS'] as const)('directed unit %s gives exactly13→15 without healing, spirit refills or rewriting history', kind => {
    const before = prepared(kind), snapshot = structuredClone(before), s = eg(before, dose), e = journal(s).at(-1)!;
    const rng = new DeterministicActionRandomStream(before.random.seed, before.random.cursor);
    expect(e.check).toEqual(resolveNormalCheck({ ability: 'will', baseAbility: 26, difficulty: 30, modifiers: [], roll: rng.nextInt(1, 100) }));
    expect(e.check!.tier).toBe(kind); expect([e.randomBefore, e.randomAfter, s.random.cursor]).toEqual([before.random.cursor, rng.cursor, rng.cursor]);
    expect(s.progression.sequence).toBe(2); expect(Object.keys(s.progression.mastery)).toEqual([...ELDER_INHERITED_ABILITY_IDS, ...ELDER_ABILITY_IDS]);
    for (const [id, mastery] of Object.entries(before.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    for (const id of ELDER_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const stat of ['physique', 'perception', 'knowledge', 'will'] as const) expect(s.character.coreStats[stat]).toBe(before.character.coreStats[stat] + 1);
    expect([s.health, s.spirituality, s.mind, s.injuryRisk, s.character.gender]).toEqual([40, 120, kind === 'GREAT_SUCCESS' ? 88 : 81, 3, 'FEMALE']);
    expect(s.injuries).toEqual(before.injuries); expect(oldHangedManRoots(s)).toEqual(oldHangedManRoots(before)); expect(s.seer.completedSources).toEqual(before.seer.completedSources);
    expect(s.elder.threeHeadedTemplarActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
    expect(s.elder.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind, preparationWeek: 125, consumedWeek: 125 });
    expect([s.actionsRemaining, s.cash]).toEqual([before.actionsRemaining, before.cash]); expect(before).toEqual(snapshot);
    expect(validateElderAcquisitionJournal(s)).toBe(true); assertValidSliceState(s); rejectElder(s, dose);
  });
  it.each([['FAILURE', 25, 71, 30], ['GREAT_FAILURE', 15, 51, 60]] as const)('directed unit %s consumes the original bottle with exact retained costs', (kind, health, mind, pollution) => {
    const before = prepared(kind), s = eg(before, dose);
    expect(s).toMatchObject({ health, mind, spirituality: 120, progression: { sequence: 3, acting: 100 } }); expect(s.seer.pollution).toBe(pollution);
    expect(s.elder.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind, consumedWeek: 125, preparationWeek: 125 }); expect(s.elder.preparedWeek).toBeNull();
    expect([s.cash, s.actionsRemaining]).toEqual([before.cash, before.actionsRemaining]); expect(s.elder.preparations).toEqual(before.elder.preparations);
    expect(oldHangedManRoots(s)).toEqual(oldHangedManRoots(before)); expect(s.injuries).toEqual(before.injuries); expect(Object.keys(s.progression.mastery)).toHaveLength(13);
    expect(s.seer.completedSources).toEqual(before.seer.completedSources); expect(validateElderAcquisitionJournal(s)).toBe(true); assertValidSliceState(s); rejectElder(s, dose);
    if (kind === 'GREAT_FAILURE') { const bought = eg(s, { type: 'BUY_POTION', bottleId: 'elder-potion-2' }); rejectElder(bought, { type: 'PREPARE_PROMOTION' }); }
  });
  it('ordinary REST restores actor resources but neither treats the original HEAVY injury nor refills spirits', () => {
    const before = promoted(), commands: SliceIntent[] = [], s = recover(before, commands);
    expect(commands.length).toBeGreaterThan(0); expect(commands.every(c => c.type === 'ACTION' && c.action === 'REST')).toBe(true);
    expect([s.health, s.mind, s.spirituality, s.injuryRisk]).toEqual([100, 100, 120, 3]);
    expect(s.injuries).toEqual([before.injuries[0]]); expect(s.injuries[0]!.treatedRevision).toBeNull();
    expect([s.actionsRemaining, s.cash]).toEqual([before.actionsRemaining - commands.length, before.cash]);
    expect(s.random).toEqual(before.random); expect(oldHangedManRoots(s)).toEqual(oldHangedManRoots(before)); expect(s.elder).toEqual(before.elder); assertValidSliceState(s);
  });
  it('real paid treatment costs60 and only a later public REST removes the original HEAVY injury', () => {
    let s = recover(promoted()); const before = structuredClone(s);
    s = step(s, { type: 'ACTION', action: 'INVESTIGATE', targetId: 'CARE-ACCESS-01' });
    s = step(s, { type: 'ACTION', action: 'REST' }); expect(s.activeEvent?.id).toBe('LIFE-CARE-01');
    s = step(s, { type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent!.instanceId, choiceId: 'PAY' });
    expect(s.cash).toBe(before.cash - 60); expect(s.injuries).toHaveLength(1); expect(s.injuries[0]!.id).toBe(before.injuries[0]!.id);
    expect(s.injuries[0]!.treatedRevision).not.toBeNull(); expect(s.injuryRisk).toBe(3);
    s = step(s, { type: 'ACTION', action: 'REST' }); expect(s.injuries).toEqual([]); expect(s.injuryRisk).toBe(0);
    expect(oldHangedManRoots(s)).toEqual(oldHangedManRoots(before)); expect(s.elder).toEqual(before.elder); assertValidSliceState(s);
  });
  it('requires three actually failed original bottles and next-week delivery of independent new stock', () => {
    let s = taught('THREE_FAILURES'); rejectElder(s, { type: 'REQUEST_SUPPLY' }); rejectElder(s, { type: 'RECEIVE_SUPPLY' });
    for (const taskId of ELDER_PREPARATION_IDS) s = eg(s, { type: 'PREPARE_TASK', taskId });
    const originalRoots = structuredClone(oldHangedManRoots(s));
    for (const bottleId of ['elder-potion-1', 'elder-potion-2', 'elder-potion-3']) {
      s = recover(s); s = eg(s, { type: 'BUY_POTION', bottleId }); s = eg(s, { type: 'PREPARE_PROMOTION' }); s = eg(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    expect(s.elder.bottles.every(b => b.status === 'CONSUMED' && b.outcome === 'FAILURE')).toBe(true);
    expect(s.cash).toBe(100000 - 500 - 3 * (6400 + 140));
    const old = structuredClone(s.elder.bottles), beforeAP = s.actionsRemaining;
    s = eg(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(beforeAP - 1); expect(s.elder.bottles).toEqual(old); rejectElder(s, { type: 'RECEIVE_SUPPLY' });
    // Advance the unit continuation through real REST actions, never editing the
    // week/date or a resource once the first Elder journal has been recorded.
    const requestWeek = s.week, requestDate = structuredClone(s.date), remaining = s.actionsRemaining;
    let nextWeek = s;
    for (let n = 0; n < remaining; n++) nextWeek = step(nextWeek, { type: 'ACTION', action: 'REST' });
    expect(nextWeek.week).toBe(requestWeek + 1); expect(nextWeek.date).toEqual(addGameDays(requestDate, 7));
    const received = eg(nextWeek, { type: 'RECEIVE_SUPPLY' });
    expect(received.elder.bottles.slice(0, 3)).toEqual(old); expect(received.elder.bottles.slice(3).map(b => b.id)).toEqual(['elder-potion-4', 'elder-potion-5', 'elder-potion-6']);
    expect(received.elder.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.stockedWeek === 126 && b.acquiredWeek === null && b.labourSteps === 0 && b.source.includes(b.id))).toBe(true);
    expect([received.cash, received.actionsRemaining]).toEqual([nextWeek.cash, nextWeek.actionsRemaining]); expect(oldHangedManRoots(received)).toEqual(originalRoots);
    expect(validateElderAcquisitionJournal(received)).toBe(true); assertValidSliceState(received); rejectElder(received, { type: 'RECEIVE_SUPPLY' });
  });
  it('closes every predecessor acquisition command after the real Elder promotion', () => {
    const s = promoted();
    for (const type of ['SECRET_SUPPLICANT', 'LISTENER', 'SHADOW_ASCETIC', 'ROSE_BISHOP', 'SHEPHERD', 'BLACK_KNIGHT', 'THREE_HEADED_TEMPLAR'] as const) rejectIntent(s, { type, command: { type: 'LEARN_GUIDANCE' } } as SliceIntent);
    rejectElder(s, { type: 'LEARN_GUIDANCE' }); rejectElder(s, { type: 'PREPARE_PROMOTION' }); rejectElder(s, { type: 'REQUEST_SUPPLY' });
  });
  it('rejects unknown fields, false confirmation, wrong source IDs and invented ritual commands without mutation', () => {
    const s = prepared();
    for (const command of [{ ...dose, confirmed: false }, { ...dose, free: true }, { type: 'BUY_POTION', bottleId: 'three-headed-templar-potion-1' }, { type: 'PREPARE_TASK', taskId: 'REVIEW_DISASTER' }, { type: 'LEARN_GUIDANCE', free: true }, { type: 'RITUAL_CONTAIN' }, { type: 'RITUAL_REVIEW', stopped: true }]) {
      expect(validateElderCommand(command)).toBe(false); rejectElder(s, command);
    }
    rejectElder(s, { ...dose, bottleId: 'elder-potion-99' });
  });
});

const acquisitionMutations: [string, (s: SliceState) => void][] = [
  ['refunded guidance', s => { journal(s)[0]!.after.cash++; }],
  ['free preparation', s => { journal(s).find(e => e.command.type === 'PREPARE_PROMOTION')!.after.actions++; }],
  ['unearned mastery', s => { journal(s).at(-1)!.after.mastery[ELDER_ABILITY_IDS[0]] = 8; }],
  ['altered dose cursor', s => { journal(s).at(-1)!.randomBefore!++; }],
  ['altered dose check', s => { journal(s).at(-1)!.check!.difficulty++; }],
  ['healed old injury', s => { journal(s).at(-1)!.after.injuries = []; }],
  ['rewritten source IDs', s => { journal(s).at(-1)!.after.completedSources[0] = 'counterfeit-source'; }],
  ['missing purchase', s => { s.elder.acquisitionJournal = journal(s).filter(e => e.command.type !== 'BUY_POTION'); }],
  ['other actor', s => { journal(s)[0]!.actor.name = 'Counterfeit'; }],
  ['other prior promotion week', s => { journal(s)[0]!.actor.threeHeadedTemplarPromotionWeek--; }],
  ['relabelled original bottle', s => { s.elder.bottles[0]!.id = 'elder-potion-2'; }],
  ['restored consumed original', s => { s.elder.bottles[0]!.status = 'PLAYER'; }],
  ['invented supplier provenance', s => { s.elder.bottles[0]!.source += ' free'; }],
  ['extra evidence field', s => { Object.assign(journal(s)[0]!, { free: true }); }],
  ['extra stage field', s => { Object.assign(s.elder, { free: true }); }],
];
describe('Elder acquisition replay rejects falsified evidence and cross-resource changes', () => {
  it.each(acquisitionMutations)('rejects %s', (_name, change) => {
    const s = promoted(); expect(validateElderState(s)).toBe(true); change(s);
    expect(validateElderState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it.each(['health', 'mind', 'spirituality', 'cash', 'actions', 'pollution', 'injuryRisk'] as const)('rejects a discontinuous %s budget even when both event endpoints are adjusted', field => {
    const s = promoted(), event = journal(s)[1]!;
    const delta = field === 'mind' || field === 'spirituality' ? -1 : 1;
    event.before[field] += delta; event.after[field] += delta;
    expect(validateElderJournalContinuity(s)).toBe(false); expect(validateElderAcquisitionJournal(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it.each(['health', 'mind', 'spirituality', 'cash', 'actionsRemaining', 'injuryRisk'] as const)('rejects rewriting immediate post-potion %s without a real intervening command', field => {
    const s = promoted(); s[field] += field === 'spirituality' ? -1 : 1;
    expect(validateElderAcquisitionJournal(s)).toBe(false); expect(validateElderState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it('rejects revision collisions, backdated checks and deleted consumed source prefixes', () => {
    const collision = promoted(); journal(collision)[1]!.revision = journal(collision)[0]!.revision;
    expect(validateElderJournalContinuity(collision)).toBe(false); expect(validateElderState(collision)).toBe(false);
    const backdated = promoted(); journal(backdated).at(-1)!.date = originalTemplarFinal().date;
    expect(validateElderAcquisitionJournal(backdated)).toBe(false);
    const missing = promoted(); missing.seer.completedSources.shift();
    expect(validateElderAcquisitionJournal(missing)).toBe(false); expect(validateElderState(missing)).toBe(false);
  });
  it('replays the whole directed command continuation identically without mutating input or payloads', () => {
    const initial = directedInitial3(), original = structuredClone(initial), commands: SliceIntent[] = [];
    let s = eg(initial, { type: 'LEARN_GUIDANCE' }, commands);
    for (const taskId of ELDER_PREPARATION_IDS) s = eg(s, { type: 'PREPARE_TASK', taskId }, commands);
    s = eg(s, { type: 'BUY_POTION', bottleId: 'elder-potion-1' }, commands); s = eg(s, { type: 'PREPARE_PROMOTION' }, commands); s = eg(s, dose, commands);
    const payloads = structuredClone(commands); let replayed = structuredClone(initial);
    for (const command of commands) replayed = step(replayed, command);
    expect(replayed).toEqual(s); expect(initial).toEqual(original); expect(commands).toEqual(payloads);
    expect(validateElderJournalContinuity(replayed)).toBe(true); expect(validateElderAcquisitionJournal(replayed)).toBe(true);
  });
  it('projects only actual knowledge, exact15 abilities and independent state copies', () => {
    const s = promoted(), before = structuredClone(s), p = projectElder(s);
    expect(p.formulaKnown).toBe(false); expect(p.formula).toEqual([]); expect(p.abilities.map(a => a.id)).toEqual([...ELDER_INHERITED_ABILITY_IDS, ...ELDER_ABILITY_IDS]);
    expect(new Set(p.abilities.map(a => a.id)).size).toBe(15); expect(p.resources!.maxSpirituality).toBe(120); expect(p.currentGender).toBe('FEMALE');
    expect(p.inheritedHistory.join(' ')).toContain('18/30'); expect(p.inheritedHistory.join(' ')).toContain('27/30'); expect(p.inheritedHistory.join(' ')).toContain('RELEASED');
    p.abilities[0]!.mastery++; p.bottles[0]!.source = 'altered view'; expect(s).toEqual(before);
  });
});
