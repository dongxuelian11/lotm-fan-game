import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createSageState, hasSageLock, projectSage, SAGE_INHERITED_ABILITY_IDS, validateSageAcquisitionJournal, validateSageJournalContinuity, validateSageCommand, validateSageState } from '../../src/domain/sage/index.js';
import { hasSageStoppedDisaster, validateSageRitualState } from '../../src/domain/sage/ritual.js';
import { SAGE_ABILITY_IDS, SAGE_PREPARATION_IDS } from '../../src/domain/sage/types.js';
import { directedInitial3, dose, evacuated, hermitLegacyKeys, oldHermitRoots, originalProphecyFinal, prepared, promoted, prophecyNaturalPath, recover, rejectIntent, rejectSage, sg, step, stopDisaster, stopped, taught } from './sage-directed-helper.js';

const journal = (s: SliceState) => s.sage.acquisitionJournal;
const ritual = (s: SliceState) => s.sage.ritual;

describe('Sage acquisition: original 507-command natural source and explicitly directed unit continuations', () => {
  it('retains all seven roots, 11 skills, original injuries, dead Osric, surrendered Lucan and consumed scrolls', () => {
    const s = originalProphecyFinal(), raw = readObjectEntry<SliceState>(prophecyNaturalPath, 'final');
    expect(readObjectEntry<{ kind: string; newRandomChanges: boolean }>(prophecyNaturalPath, 'provenance')).toMatchObject({ kind: 'SAME_SEED_PUBLIC_NATURAL_PREFIX', newRandomChanges: false });
    expect(readObjectEntry<SliceIntent[]>(prophecyNaturalPath, 'commands')).toHaveLength(507);
    expect(s).toMatchObject({ week: 124, health: 80, mind: 100, spirituality: 114, cash: 530, actionsRemaining: 3, injuryRisk: 1, random: { seed: 'pryer-natural-v048', cursor: 290 }, progression: { sequence: 3, acting: 100 }, character: { gender: 'FEMALE' } });
    expect(s.injuries.map(i => [i.severity, i.treatedRevision])).toEqual([['LIGHT', null], ['LIGHT', null]]);
    for (const key of hermitLegacyKeys) expect(s[key]).toEqual(raw[key]);
    expect(s.mystic.life.story.readerIds).toHaveLength(105); expect(s.mystic.life.publicDisclosed).toBe(true);
    expect(s.mystic.encounter).toMatchObject({ enemyStatus: 'SURRENDERED', enemyHealth: 70 });
    expect(s.prophecyMaster.encounter).toMatchObject({ enemyStatus: 'DEAD', enemyHealth: 0 });
    expect(s.scrollProfessor.workshop.scrolls).toHaveLength(9); expect(s.scrollProfessor.workshop.scrolls.every(x => x.status === 'USED')).toBe(true);
    expect(s.scrollProfessor.workshop.materials).toHaveLength(12); expect(s.scrollProfessor.workshop.materials.every(x => x.status === 'SPENT')).toBe(true);
    expect(Object.keys(s.progression.mastery)).toHaveLength(11); expect(SAGE_INHERITED_ABILITY_IDS).toHaveLength(11);
    expect(s.sage).toEqual(createSageState()); assertValidSliceState(s);
  });
  it('declares pre-journal unit resources and cursor without editing or healing the original', () => {
    const original = originalProphecyFinal(), s = directedInitial3();
    expect(s).toMatchObject({ week: 128, cash: 100000, actionsRemaining: 100, weeklyBudget: 100, health: 80, mind: 100, spirituality: 114, injuryRisk: 1 });
    expect(s.random.seed).toBe(original.random.seed); expect(s.random.cursor).toBeGreaterThanOrEqual(original.random.cursor);
    expect(oldHermitRoots(s)).toEqual(oldHermitRoots(original)); expect(s.injuries).toEqual(original.injuries);
    expect([s.sage.acquisitionJournal, s.sage.ritual.journal]).toEqual([[], []]); expect(originalProphecyFinal()).toEqual(original);
  });
  it('keeps independent defaults and hides the stage from unrelated, earlier and S1/S0 characters', () => {
    const s = createSliceRun('sage-hidden', sliceDefaultCreationSelection, 'sage-hidden');
    expect(projectSage(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], resources: null });
    expect(projectSage(s).ritual.actions).toEqual([]); rejectSage(s, { type: 'LEARN_GUIDANCE' });
    const a = createSageState(); a.bottles[0]!.labourSteps = 5; a.ritual.people[0]!.health = 1;
    expect(s.sage.bottles[0]!.labourSteps).toBe(0); expect(s.sage.ritual.people[0]!.health).toBe(88);
    for (const sequence of [4, 1, 0] as const) { const t = originalProphecyFinal(); t.progression.sequence = sequence; expect(projectSage(t).discovered).toBe(false); rejectSage(t, { type: 'LEARN_GUIDANCE' }); }
  });
  it('rejects altered lineage and missing or invented mastery before accepting new costs', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.prophecyMaster.promotionWeek = null; }, s => { s.prophecyMaster.mysticActingAtPromotion = 99; },
      s => { s.progression.pathwayId = 'warrior'; },
      s => { delete s.progression.mastery['hermit.s3.prophetic-glimpse']; }, s => { s.progression.mastery['hermit.s2.invented'] = 0; },
      s => { s.pryer.bottles.find(b => b.status === 'CONSUMED')!.acquiredWeek = s.week + 1; },
    ];
    for (const [index, change] of changes.entries()) { const s = directedInitial3(); change(s); try { rejectSage(s, { type: 'LEARN_GUIDANCE' }); } catch (cause) { throw new Error(`Rejected lineage mutation ${index} was accepted`, { cause }); } }
  });
  it('rejects resurrecting a consumed original scroll at the whole-state save boundary', () => {
    const s = originalProphecyFinal(); s.scrollProfessor.workshop.scrolls[0]!.status = 'HELD';
    expect(s.scrollProfessor.workshop.scrolls[0]!.usedWeek).not.toBeNull();
    expect(() => assertValidSliceState(s)).toThrow();
  });
  it('guidance costs exactly 500 and one action without granting skills, materials or potion ownership', () => {
    const before = directedInitial3(), s = sg(before, { type: 'LEARN_GUIDANCE' }), e = journal(s).at(-1)!;
    expect([s.cash, s.actionsRemaining]).toEqual([before.cash - 500, before.actionsRemaining - 1]);
    expect(s.progression.mastery).toEqual(before.progression.mastery); expect(s.sage.bottles.every(b => b.status === 'SUPPLIER')).toBe(true); expect(ritual(s).seals).toEqual([]);
    expect([e.before.cash - e.after.cash, e.before.actions - e.after.actions, e.ritualEvents]).toEqual([500, 1, 0]);
    expect([e.check, e.randomBefore, e.randomAfter]).toEqual([null, null, null]); rejectSage(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires all twelve complete S3 weeks even after genuinely stopping and reviewing the disaster', () => {
    let s = stopDisaster(taught('SUCCESS', false));
    expect(projectSage(s).digestion).toContain('8/12');
    for (const taskId of SAGE_PREPARATION_IDS) s = sg(s, { type: 'PREPARE_TASK', taskId });
    s = sg(s, { type: 'BUY_POTION', bottleId: 'sage-potion-1' });
    rejectSage(s, { type: 'PREPARE_PROMOTION' }); expect(s.sage.preparedWeek).toBeNull();
  });
});

describe('Sage ritual requires personally stopping the real high-level disaster', () => {
  it('rescue and ordinary retreat preserve injured adults and an active disaster, never promotion credit', () => {
    let s = evacuated(); const r = ritual(s), originalPeople = createSageState().ritual.people;
    expect(r).toMatchObject({ status: 'ACTIVE', location: 'OUTSIDE', closure: 'CLOSED', studiedWeek: s.week, evacuatedWeek: s.week, core: { highLevelRemnant: true, active: true }, routes: { plate: { active: true }, index: { active: true } }, stoppedRecord: null, review: null });
    expect(r.people).toEqual(originalPeople.map(p => ({ ...p, location: 'OUTSIDE' }))); expect(r.records.damaged).toBe(4);
    expect(hasSageStoppedDisaster(s)).toBe(false); rejectSage(s, { type: 'RITUAL_REVIEW' }); rejectSage(s, { type: 'PREPARE_TASK', taskId: 'REVIEW_DISASTER' });
    s = sg(s, { type: 'RITUAL_VISIT' }); rejectSage(s, { type: 'RITUAL_CONTAIN' });
    s = sg(s, { type: 'RITUAL_RETREAT' }); expect(ritual(s).core.active).toBe(true); expect(ritual(s).people).toEqual(r.people);
    s = sg(s, { type: 'BUY_POTION', bottleId: 'sage-potion-1' }); rejectSage(s, { type: 'PREPARE_PROMOTION' }); rejectSage(s, dose);
  });
  it('two real cuts and core containment consume three paid originals with exact checks and costs', () => {
    const before = directedInitial3(), s = stopped(), r = ritual(s);
    expect([s.cash, s.actionsRemaining, s.health, s.mind, s.spirituality]).toEqual([100000 - 500 - 120, 94, 80, 92, 90]);
    expect(r).toMatchObject({ status: 'STOPPED', location: 'OUTSIDE', closure: 'SEALED', travelMetres: 56, elapsedSeconds: 236, core: { active: false, sealId: 'sage-seal-3' }, routes: { plate: { active: false, sealId: 'sage-seal-1' }, index: { active: false, sealId: 'sage-seal-2' } } });
    expect(r.seals.map(x => [x.id, x.status, x.usedFor])).toEqual([['sage-seal-1', 'USED', 'PLATE'], ['sage-seal-2', 'USED', 'INDEX'], ['sage-seal-3', 'USED', 'CORE']]);
    const checks = r.journal.filter(e => e.check !== null), rng = new DeterministicActionRandomStream(before.random.seed, before.random.cursor);
    expect(checks.map(e => e.command.type)).toEqual(['RITUAL_CUT_PLATE', 'RITUAL_CUT_INDEX', 'RITUAL_CONTAIN']);
    for (const [i, e] of checks.entries()) {
      expect(e.check).toEqual(resolveNormalCheck({ ability: 'knowledge', baseAbility: 23, difficulty: i === 2 ? 25 : 20, modifiers: [], roll: rng.nextInt(1, 100) }));
      expect([e.randomBefore, e.randomAfter]).toEqual([rng.cursor - 1, rng.cursor]);
    }
    expect(s.random.cursor).toBe(rng.cursor); expect(r.stoppedRecord).toMatchObject({ actorName: s.character.name, sourceId: r.sourceId, coreId: r.core.id, routeIds: [r.routes.plate.objectId, r.routes.index.objectId], damagedRecords: 4, damagedPlates: 1 });
    expect(hasSageStoppedDisaster(s)).toBe(true); expect(validateSageRitualState(s)).toBe(true);
    expect(oldHermitRoots(s)).toEqual(oldHermitRoots(before)); expect(s.injuries).toEqual(before.injuries); expect(s.progression.mastery).toEqual(before.progression.mastery);
    rejectSage(s, { type: 'RITUAL_VISIT' }); rejectSage(s, { type: 'RITUAL_REVIEW' }); rejectSage(s, { type: 'RITUAL_BUY_SEALS' }); assertValidSliceState(s);
  });
  it.each([['RITUAL_FAILURE', 4, 1], ['RITUAL_GREAT_FAILURE', 8, 2]] as const)('%s consumes the original seal and preserves real damage across retreat and retry', (kind, damage, records) => {
    const before = sg(evacuated(kind), { type: 'RITUAL_VISIT' }), failed = sg(before, { type: 'RITUAL_CUT_PLATE' });
    expect([failed.health, failed.mind, failed.spirituality, failed.actionsRemaining, failed.seer.pollution]).toEqual([before.health - damage, before.mind - 2 - damage, before.spirituality - 6, before.actionsRemaining - 1, before.seer.pollution + damage]);
    expect(ritual(failed).seals[0]).toMatchObject({ status: 'USED', usedFor: 'PLATE' }); expect(ritual(failed).routes.plate.active).toBe(true);
    expect([ritual(failed).records.damaged, ritual(failed).plates.damaged]).toEqual([4 + records, 2]);
    const retreated = sg(failed, { type: 'RITUAL_RETREAT' });
    expect([retreated.health, retreated.mind, retreated.spirituality, retreated.cash]).toEqual([failed.health, failed.mind, failed.spirituality, failed.cash]);
    expect(ritual(retreated).core.active).toBe(true); expect(ritual(retreated).records).toEqual(ritual(failed).records);
    const s = stopDisaster(retreated); expect(ritual(s).seals).toHaveLength(6); expect(ritual(s).seals.filter(x => x.status === 'USED')).toHaveLength(4);
    expect(s.cash).toBe(100000 - 500 - 240); expect(s.health).toBe(80 - damage); expect(s.injuries).toEqual(before.injuries);
    expect(ritual(s).records).toEqual(ritual(failed).records); expect(ritual(s).plates).toEqual(ritual(failed).plates); expect(ritual(s).people).toEqual(ritual(failed).people);
    expect(ritual(s).routes.plate.sealId).toBe('sage-seal-2'); expect(ritual(s).core.sealId).toBe('sage-seal-4'); expect(validateSageRitualState(s)).toBe(true);
  });
  it('requires every real scene phase and holds ordinary actions until actual exit', () => {
    let s = sg(taught(), { type: 'RITUAL_VISIT' });
    expect(hasSageLock(s)).toBe(true); rejectIntent(s, { type: 'ACTION', action: 'REST' });
    for (const type of ['RITUAL_EVACUATE', 'RITUAL_CUT_PLATE', 'RITUAL_CUT_INDEX', 'RITUAL_CONTAIN', 'BUY_POTION'] as const) rejectSage(s, type === 'BUY_POTION' ? { type, bottleId: 'sage-potion-1' } : { type });
    s = sg(s, { type: 'RITUAL_STUDY' }); rejectSage(s, { type: 'RITUAL_CUT_PLATE' });
    s = sg(s, { type: 'RITUAL_EVACUATE' }); s = sg(s, { type: 'RITUAL_VISIT' }); rejectSage(s, { type: 'RITUAL_CUT_PLATE' });
    s = sg(s, { type: 'RITUAL_RETREAT' }); expect(hasSageLock(s)).toBe(false);
    const rested = step(s, { type: 'ACTION', action: 'REST' }); expect(ritual(rested)).toEqual(ritual(s)); expect(rested.random).toEqual(s.random);
  });
  it('does not permit core containment after only one cut or review before ordinary exit', () => {
    let s = sg(evacuated(), { type: 'RITUAL_VISIT' }); s = sg(s, { type: 'RITUAL_CUT_PLATE' });
    rejectSage(s, { type: 'RITUAL_CUT_PLATE' }); rejectSage(s, { type: 'RITUAL_CONTAIN' });
    s = sg(s, { type: 'RITUAL_CUT_INDEX' }); s = sg(s, { type: 'RITUAL_CONTAIN' });
    expect(hasSageStoppedDisaster(s)).toBe(false); rejectSage(s, { type: 'RITUAL_REVIEW' });
    s = sg(s, { type: 'RITUAL_RETREAT' }); expect(hasSageStoppedDisaster(s)).toBe(false);
    s = sg(s, { type: 'RITUAL_REVIEW' }); expect(hasSageStoppedDisaster(s)).toBe(true);
  });
});

describe('Sage potion acquisition, all four directed tiers and bounded resupply', () => {
  it('five real jobs discount only the specified bottle and still cost 900', () => {
    let s = taught(); const before = structuredClone(s);
    for (let n = 0; n < 5; n++) s = sg(s, { type: 'POTION_WORK', bottleId: 'sage-potion-2' });
    expect([s.actionsRemaining, s.cash]).toEqual([before.actionsRemaining - 5, before.cash]);
    expect(s.sage.bottles[1]).toMatchObject({ labourSteps: 5, status: 'SUPPLIER' }); expect(s.sage.bottles[0]!.labourSteps).toBe(0);
    rejectSage(s, { type: 'POTION_WORK', bottleId: 'sage-potion-2' });
    s = sg(s, { type: 'BUY_POTION', bottleId: 'sage-potion-2' }); expect(s.cash).toBe(before.cash - 900);
    expect(s.sage.bottles[1]).toMatchObject({ status: 'PLAYER', acquiredWeek: s.week }); rejectSage(s, { type: 'BUY_POTION', bottleId: 'sage-potion-2' });
    expect(validateSageAcquisitionJournal(s)).toBe(true); rejectSage(s, { type: 'PREPARE_PROMOTION' });
  });
  it('four jobs give no partial credit and no credit moves to another bottle', () => {
    let s = taught(); for (let n = 0; n < 4; n++) s = sg(s, { type: 'POTION_WORK', bottleId: 'sage-potion-1' });
    const cash = s.cash; s = sg(s, { type: 'BUY_POTION', bottleId: 'sage-potion-1' }); expect(s.cash).toBe(cash - 6400);
    s = sg(s, { type: 'BUY_POTION', bottleId: 'sage-potion-2' }); expect(s.cash).toBe(cash - 12800);
  });
  it('all three preparations are distinct and cancellation returns neither 140 nor one action', () => {
    let s = stopped(); const ap = s.actionsRemaining;
    for (const taskId of SAGE_PREPARATION_IDS) { s = sg(s, { type: 'PREPARE_TASK', taskId }); rejectSage(s, { type: 'PREPARE_TASK', taskId }); }
    expect(s.actionsRemaining).toBe(ap - 3); rejectSage(s, { type: 'PREPARE_PROMOTION' });
    const ready = prepared('SUCCESS', true), e = journal(ready).at(-1)!;
    expect([e.before.cash - e.after.cash, e.before.actions - e.after.actions]).toEqual([140, 1]); expect(e.ritualEvents).toBe(ritual(ready).journal.length);
    expect([ready.cash, ready.actionsRemaining]).toEqual([100000 - 500 - 120 - 900 - 140, 85]);
    rejectIntent(ready, { type: 'ACTION', action: 'REST' }); rejectSage(ready, { type: 'RITUAL_VISIT' });
    const left = sg(ready, { type: 'LEAVE_PREPARATION' });
    expect([left.cash, left.actionsRemaining, left.health, left.spirituality]).toEqual([ready.cash, ready.actionsRemaining, ready.health, ready.spirituality]);
    expect(left.sage.bottles[0]!.status).toBe('PLAYER'); expect(left.sage.preparedWeek).toBeNull(); expect(ritual(left)).toEqual(ritual(ready)); rejectSage(left, dose);
  });
  it.each(['SUCCESS', 'GREAT_SUCCESS'] as const)('directed unit %s gives exactly 11→13, with no free healing, refill or rewritten lineage', kind => {
    const before = prepared(kind), s = sg(before, dose), e = journal(s).at(-1)!, rng = new DeterministicActionRandomStream(before.random.seed, before.random.cursor);
    expect(e.check).toEqual(resolveNormalCheck({ ability: 'will', baseAbility: 25, difficulty: 30, modifiers: [], roll: rng.nextInt(1, 100) }));
    expect([e.randomBefore, e.randomAfter, s.random.cursor]).toEqual([before.random.cursor, rng.cursor, rng.cursor]);
    expect(s.progression.sequence).toBe(2); expect(Object.keys(s.progression.mastery)).toHaveLength(13);
    for (const [id, mastery] of Object.entries(before.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    for (const id of SAGE_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const stat of ['physique', 'perception', 'knowledge', 'will'] as const) expect(s.character.coreStats[stat]).toBe(before.character.coreStats[stat] + 1);
    expect([s.health, s.spirituality, s.mind, s.injuryRisk, s.character.gender]).toEqual([80, 90, kind === 'GREAT_SUCCESS' ? 84 : 77, 1, 'FEMALE']);
    expect(s.injuries).toEqual(before.injuries); expect(oldHermitRoots(s)).toEqual(oldHermitRoots(before)); expect(ritual(s)).toEqual(ritual(before));
    expect(s.sage.prophecyMasterActingAtPromotion).toBe(100); expect(s.sage.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind, preparationWeek: s.week, consumedWeek: s.week });
    expect([s.actionsRemaining, s.cash]).toEqual([before.actionsRemaining, before.cash]); expect(validateSageAcquisitionJournal(s)).toBe(true); assertValidSliceState(s); rejectSage(s, dose);
  });
  it.each([['FAILURE', 65, 67, 30], ['GREAT_FAILURE', 55, 47, 60]] as const)('directed unit %s consumes the bottle and retains exact costs and the successful disaster record', (kind, health, mind, pollution) => {
    const before = prepared(kind), s = sg(before, dose);
    expect(s).toMatchObject({ health, mind, spirituality: 90, progression: { sequence: 3, acting: 100 } }); expect(s.seer.pollution).toBe(before.seer.pollution + pollution);
    expect(s.sage.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind }); expect(s.sage.preparedWeek).toBeNull();
    expect(oldHermitRoots(s)).toEqual(oldHermitRoots(before)); expect(s.injuries).toEqual(before.injuries); expect(Object.keys(s.progression.mastery)).toHaveLength(11);
    expect(ritual(s)).toEqual(ritual(before)); expect(hasSageStoppedDisaster(s)).toBe(true); expect(validateSageAcquisitionJournal(s)).toBe(true); assertValidSliceState(s); rejectSage(s, dose);
  });
  it('ordinary rests heal the original LIGHT injuries only after actual public rest commands', () => {
    const before = promoted(), commands: SliceIntent[] = [], s = recover(before, commands);
    expect(commands.length).toBeGreaterThan(0); expect(commands.every(c => c.type === 'ACTION' && c.action === 'REST')).toBe(true);
    expect(s.actionsRemaining).toBe(before.actionsRemaining - commands.length); expect(s.cash).toBe(before.cash);
    expect([s.health, s.mind, s.spirituality, s.injuryRisk]).toEqual([100, 100, 120, 0]); expect(s.injuries).toEqual([]);
    expect(s.random).toEqual(before.random); expect(oldHermitRoots(s)).toEqual(oldHermitRoots(before)); expect(s.sage).toEqual(before.sage); assertValidSliceState(s);
  });
  it('requires three actually failed original bottles, then next-week delivery of independent stock', () => {
    let s = stopped('THREE_FAILURES'); rejectSage(s, { type: 'REQUEST_SUPPLY' }); rejectSage(s, { type: 'RECEIVE_SUPPLY' });
    for (const taskId of SAGE_PREPARATION_IDS) s = sg(s, { type: 'PREPARE_TASK', taskId });
    const originalRitual = structuredClone(ritual(s));
    for (const bottleId of ['sage-potion-1', 'sage-potion-2', 'sage-potion-3']) {
      s = recover(s); s = sg(s, { type: 'BUY_POTION', bottleId }); s = sg(s, { type: 'PREPARE_PROMOTION' }); s = sg(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    expect(s.sage.bottles.every(b => b.status === 'CONSUMED' && b.outcome === 'FAILURE')).toBe(true);
    const old = structuredClone(s.sage.bottles), beforeAP = s.actionsRemaining;
    s = sg(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(beforeAP - 1); expect(s.sage.bottles).toEqual(old); rejectSage(s, { type: 'RECEIVE_SUPPLY' });
    // Declared unit-only next-week source boundary. This is not a naturally played week transition.
    const nextWeek = structuredClone(s); nextWeek.week++; nextWeek.date = addGameDays(nextWeek.date, 7);
    const received = sg(nextWeek, { type: 'RECEIVE_SUPPLY' });
    expect(received.sage.bottles.slice(0, 3)).toEqual(old); expect(received.sage.bottles.slice(3).map(b => b.id)).toEqual(['sage-potion-4', 'sage-potion-5', 'sage-potion-6']);
    expect(received.sage.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.stockedWeek === received.week && b.acquiredWeek === null && b.labourSteps === 0)).toBe(true);
    expect([received.cash, received.actionsRemaining]).toEqual([nextWeek.cash, nextWeek.actionsRemaining]); expect(ritual(received)).toEqual(originalRitual); expect(validateSageAcquisitionJournal(received)).toBe(true); assertValidSliceState(received);
  });
  it('closes all seven old acquisition stages and locks ordinary actions during the new live case', () => {
    const s = promoted();
    for (const type of ['PRYER', 'COMBAT_SCHOLAR', 'WIZARD', 'SCROLL_PROFESSOR', 'STAR_MYSTIC', 'MYSTIC', 'PROPHECY_MASTER'] as const) rejectIntent(s, { type, command: { type: 'LEARN_GUIDANCE' } } as SliceIntent);
    rejectSage(s, { type: 'RITUAL_VISIT' });
    let live = sg(s, { type: 'OBSERVE', caseId: 'information-route' }); live = sg(live, { type: 'CONSENT_OWNER', caseId: 'information-route' }); live = sg(live, { type: 'PREPARE', caseId: 'information-route', method: 'ORDINARY' });
    expect(hasSageLock(live)).toBe(true); rejectIntent(live, { type: 'ACTION', action: 'REST' }); rejectSage(live, { type: 'LEARN_GUIDANCE' }); rejectSage(live, { type: 'RITUAL_VISIT' });
    expect(oldHermitRoots(live)).toEqual(oldHermitRoots(s));
  });
  it('rejects unknown fields, false confirmations, wrong stage ids and invalid ritual payloads', () => {
    const s = prepared();
    for (const c of [{ ...dose, confirmed: false }, { ...dose, free: true }, { type: 'BUY_POTION', bottleId: 'prophecy-master-potion-1' }, { type: 'PREPARE_TASK', taskId: 'REVIEW_RECORDS' }, { type: 'LEARN_GUIDANCE', free: true }, { type: 'RITUAL_CUT_PLATE', sealId: 'sage-seal-1' }, { type: 'RITUAL_CONTAIN', confirmed: true }, { type: 'RITUAL_REVIEW', stopped: true }]) {
      expect(validateSageCommand(c)).toBe(false); rejectSage(s, c);
    }
  });
});

const ritualMutations: [string, (s: SliceState) => void][] = [
  ['invented stopped source', s => { ritual(s).stoppedRecord!.sourceId = 'counterfeit' as SliceState['sage']['ritual']['sourceId']; }],
  ['reopened propagation', s => { ritual(s).routes.index.active = true; }],
  ['refunded consumed material', s => { ritual(s).seals[0]!.status = 'HELD'; }],
  ['healed adult', s => { ritual(s).people[0]!.health = 100; }],
  ['repaired original damage', s => { ritual(s).records.damaged = 0; }],
  ['rewritten cut roll', s => { ritual(s).journal.find(e => e.check)!.check!.roll++; }],
  ['free ritual cost', s => { ritual(s).journal.find(e => e.command.type === 'RITUAL_BUY_SEALS')!.after.cash++; }],
  ['missing core event', s => { ritual(s).journal = ritual(s).journal.filter(e => e.command.type !== 'RITUAL_CONTAIN'); }],
];
const acquisitionMutations: [string, (s: SliceState) => void][] = [
  ['refunded guidance', s => { journal(s)[0]!.after.cash++; }],
  ['forged mastery award', s => { journal(s).at(-1)!.after.mastery[SAGE_ABILITY_IDS[0]] = 8; }],
  ['dose cursor', s => { journal(s).at(-1)!.randomBefore!++; }],
  ['dose check', s => { journal(s).at(-1)!.check!.difficulty++; }],
  ['healed old injury', s => { journal(s).at(-1)!.after.injuries = []; }],
  ['missing purchase', s => { s.sage.acquisitionJournal = journal(s).filter(e => e.command.type !== 'BUY_POTION'); }],
  ['unearned ritual prefix', s => { journal(s).find(e => e.command.type === 'PREPARE_PROMOTION')!.ritualEvents = 0; }],
  ['extra evidence field', s => { Object.assign(journal(s)[0]!, { free: true }); }],
  ['extra stage field', s => { Object.assign(s.sage, { free: true }); }],
];
describe('Sage rejects counterfeit ritual and acquisition evidence', () => {
  it.each(ritualMutations)('rejects %s', (_name, change) => {
    const s = stopped(); expect(validateSageRitualState(s)).toBe(true); change(s);
    expect(validateSageRitualState(s)).toBe(false); expect(validateSageState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it.each(acquisitionMutations)('rejects %s', (_name, change) => {
    const s = promoted(); expect(validateSageState(s)).toBe(true); change(s);
    expect(validateSageState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it('cannot copy a stopped record into the rescue-only state or backdate later ritual evidence', () => {
    const s = evacuated(), complete = stopped(); ritual(s).stoppedRecord = structuredClone(ritual(complete).stoppedRecord); ritual(s).review = structuredClone(ritual(complete).review);
    expect(validateSageRitualState(s)).toBe(false); rejectSage(s, { type: 'PREPARE_TASK', taskId: 'REVIEW_DISASTER' });
    const t = promoted(); journal(t)[0]!.ritualEvents = ritual(t).journal.length;
    expect(validateSageAcquisitionJournal(t)).toBe(false); expect(() => assertValidSliceState(t)).toThrow();
  });
  it('rejects mixed-journal revision collisions and reused ritual random cursors', () => {
    const collision = promoted(); expect(validateSageJournalContinuity(collision)).toBe(true);
    journal(collision).find(e => e.command.type === 'PREPARE_TASK')!.revision = ritual(collision).journal.at(-1)!.revision;
    expect(validateSageJournalContinuity(collision)).toBe(false); expect(validateSageState(collision)).toBe(false);
    const reused = promoted(), lastRitualCheck = ritual(reused).journal.filter(e => e.check !== null).at(-1)!, potion = journal(reused).at(-1)!;
    potion.randomBefore = lastRitualCheck.randomBefore; potion.randomAfter = lastRitualCheck.randomAfter;
    expect(validateSageJournalContinuity(reused)).toBe(false); expect(validateSageState(reused)).toBe(false);
  });
  it('projects only actual knowledge, 13 exact abilities and independent state copies', () => {
    const s = promoted(), before = structuredClone(s), p = projectSage(s);
    expect(p.formulaKnown).toBe(false); expect(p.formula).toEqual([]); expect(p.abilities.map(a => a.id)).toEqual([...SAGE_INHERITED_ABILITY_IDS, ...SAGE_ABILITY_IDS]);
    expect(new Set(p.abilities.map(a => a.id)).size).toBe(13); expect(p.resources!.maxSpirituality).toBe(120);
    expect(p.currentGender).toBe('FEMALE'); expect(p.ritual.stoppedRecord).not.toBeNull();
    p.abilities[0]!.mastery++; p.life.site.playerEnergy--; expect(s).toEqual(before);
  });
});
