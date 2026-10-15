import { CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createAncientEvilState, hasAncientEvilLock, projectAncientEvil, ANCIENT_EVIL_INHERITED_ABILITY_IDS, validateAncientEvilAcquisitionJournal, validateAncientEvilJournalContinuity, validateAncientEvilCommand, validateAncientEvilState } from '../../src/domain/ancient-evil/index.js';
import { ANCIENT_EVIL_ABILITY_IDS, ANCIENT_EVIL_PREPARATION_IDS } from '../../src/domain/ancient-evil/types.js';
import { directedInitial3, dose, ae, oldChainedRoots, originalSilentDisciple, prepared, promoted, recover, rejectAncientEvil, rejectIntent, step, taught, silentDiscipleNaturalPath } from './ancient-evil-directed-helper.js';

const journal = (s: SliceState) => s.ancientEvil.acquisitionJournal;

describe('AncientEvil acquisition: actual complete507-command S3 source and explicitly directed units', () => {
  it('migrates the exact living source with17 skills, seven paid histories, untreated injury and old Calder surrender', () => {
    const original = readObjectEntry<SliceState>(silentDiscipleNaturalPath, 'final'), s = originalSilentDisciple();
    expect(readObjectEntry<SliceIntent[]>(silentDiscipleNaturalPath, 'commands')).toHaveLength(507);
    expect(s).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, week: 119, revision: 508, status: 'ACTIVE', health: 100, mind: 99, spirituality: 116, cash: 360, actionsRemaining: 3, injuryRisk: 0, random: { seed: 'prisoner-natural-v057', cursor: 206 }, progression: { sequence: 3, acting: 100, promotionWeek: 6 } });
    expect(s.character.coreStats).toEqual({ physique: 29, perception: 23, will: 23, knowledge: 19 });
    expect(s.injuries).toEqual([{ id: 'prisoner-rebuild-natural:combat:1:PLAYER:406:0', severity: 'HEAVY', acquiredRevision: 406, treatedRevision: null }]);
    expect(s.silentDisciple.promotionWeek).toBe(110); expect(oldChainedRoots(s)).toEqual(oldChainedRoots(original));
    expect(s.silentDisciple.encounter).toMatchObject({ status: 'RESOLVED', enemyStatus: 'SURRENDERED', enemyHealth: 70, enemyMind: 100, enemySpirituality: 116 });
    expect(s.silentDisciple.encounter.blocks).toHaveLength(3); expect(s.silentDisciple.encounter.blocks.every(b => b.status === 'READY')).toBe(true);
    expect(s.silentDisciple.life.moon.status).toBe('RESOLVED');
    expect(Object.keys(s.progression.mastery)).toEqual([...ANCIENT_EVIL_INHERITED_ABILITY_IDS]);
    for (const id of ['chained.s7.toxic-claws', 'chained.s6.steel-body', 'chained.s6.death-craft', 'chained.s5.spirit-possession']) expect(s.progression.mastery[id]).toBe(0);
    expect(s.ancientEvil).toEqual(createAncientEvilState()); assertValidSliceState(s);
  });
  it('declares pre-journal unit budgets and cursor without editing, healing or refilling the original source', () => {
    const original = originalSilentDisciple(), s = directedInitial3();
    expect(s).toMatchObject({ week: 122, cash: 100000, actionsRemaining: 100, weeklyBudget: 100, health: 100, mind: 99, spirituality: 116, injuryRisk: 0 });
    expect(s.date).toEqual(addGameDays(original.date, 21)); expect(s.random.seed).toBe(original.random.seed);
    expect(s.random.cursor).toBeGreaterThanOrEqual(original.random.cursor); expect(s.random.cursor).toBeLessThan(original.random.cursor + 512);
    expect(oldChainedRoots(s)).toEqual(oldChainedRoots(original)); expect(s.injuries).toEqual(original.injuries);
    expect(s.character).toEqual(original.character); expect(s.progression).toEqual(original.progression);
    expect(journal(s)).toEqual([]); expect(originalSilentDisciple()).toEqual(original);
  });
  it('keeps independent defaults and hides the stage from unrelated, earlier and S1/S0 characters', () => {
    const s = createSliceRun('ancient-evil-hidden', sliceDefaultCreationSelection, 'ancient-evil-hidden');
    expect(projectAncientEvil(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], resources: null });
    rejectAncientEvil(s, { type: 'LEARN_GUIDANCE' });
    const a = createAncientEvilState(); a.bottles[0]!.labourSteps = 5;
    expect(s.ancientEvil.bottles[0]!.labourSteps).toBe(0);
    for (const sequence of [4, 1, 0] as const) { const t = originalSilentDisciple(); t.progression.sequence = sequence; expect(projectAncientEvil(t).discovered).toBe(false); rejectAncientEvil(t, { type: 'LEARN_GUIDANCE' }); }
  });
  it('rejects changed lineage and missing or invented skills before accepting new costs', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.silentDisciple.promotionWeek = null; }, s => { s.silentDisciple.puppetActingAtPromotion = 99; },
      s => { s.progression.pathwayId = 'hermit'; }, s => { delete s.progression.mastery['chained.s3.short-transfiguration']; },
      s => { s.progression.mastery['chained.s2.invented'] = 0; },
      s => { s.prisoner.bottles.find(b => b.status === 'CONSUMED' && ['SUCCESS', 'GREAT_SUCCESS'].includes(b.outcome ?? ''))!.acquiredWeek = s.week + 1; },
    ];
    for (const [index, change] of mutations.entries()) {
      const s = directedInitial3(); change(s);
      try { rejectAncientEvil(s, { type: 'LEARN_GUIDANCE' }); } catch (cause) { throw new Error(`Lineage mutation ${index} was accepted`, { cause }); }
    }
  });
  it('requires twelve complete weeks from actual promotion110, so week119 cannot consume', () => {
    let s = taught('SUCCESS', false);
    expect(projectAncientEvil(s).digestion).toContain('9/12');
    for (const taskId of ANCIENT_EVIL_PREPARATION_IDS) s = ae(s, { type: 'PREPARE_TASK', taskId });
    s = ae(s, { type: 'BUY_POTION', bottleId: 'ancient-evil-potion-1' });
    rejectAncientEvil(s, { type: 'PREPARE_PROMOTION' }); rejectAncientEvil(s, dose);
    const atBoundary = prepared(); expect(atBoundary.week).toBe(122); expect(projectAncientEvil(atBoundary).digestion).toContain('12/12');
    expect(ae(atBoundary, dose).ancientEvil.promotionWeek).toBe(122);
  });
  it('requires each actual old report and reflection before current preparation', () => {
    for (const missing of ['silent-disciple-life-original-body', 'silent-disciple-life-revoked-form', 'silent-disciple-life-measured-link', 'silent-disciple-reflection']) {
      const s = prepared(); s.seer.completedSources = s.seer.completedSources.filter(id => id !== missing);
      rejectAncientEvil(s, dose); expect(validateAncientEvilAcquisitionJournal(s)).toBe(false);
    }
    const incomplete = prepared(); incomplete.silentDisciple.life.reflected = false; rejectAncientEvil(incomplete, dose);
  });
  it('rejects resurrecting or backdating an old consumed original at the whole-state save boundary', () => {
    const restored = originalSilentDisciple(); restored.prisoner.bottles[0]!.status = 'PLAYER';
    expect(restored.prisoner.bottles[0]!.consumedWeek).toBe(6); expect(() => assertValidSliceState(restored)).toThrow();
    const backdated = originalSilentDisciple(); backdated.prisoner.bottles[0]!.acquiredWeek = 122;
    expect(() => assertValidSliceState(backdated)).toThrow();
  });
  it('guidance costs exactly500 and one action without granting skills or inventory', () => {
    const before = directedInitial3(), payload = { type: 'LEARN_GUIDANCE' } as const, s = ae(before, payload), e = journal(s)[0]!;
    expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]); expect(s.progression.mastery).toEqual(before.progression.mastery);
    expect(s.ancientEvil.bottles.every(b => b.status === 'SUPPLIER')).toBe(true);
    expect([e.before.cash - e.after.cash, e.before.actions - e.after.actions]).toEqual([500, 1]);
    expect([e.check, e.randomBefore, e.randomAfter]).toEqual([null, null, null]);
    expect(e.actor).toEqual({ name: before.character.name, gender: before.character.gender, pathwayId: 'chained', silentDisciplePromotionWeek: 110, prisonerPromotionWeek: 6 });
    expect(oldChainedRoots(s)).toEqual(oldChainedRoots(before)); expect(payload).toEqual({ type: 'LEARN_GUIDANCE' });
    expect(before.ancientEvil.guidanceKnown).toBe(false); rejectAncientEvil(s, payload);
  });
});

describe('AncientEvil paid acquisition, preparations, four real potion tiers and bounded resupply', () => {
  it('five actual jobs discount only their specific bottle and still require900', () => {
    let s = taught(); const before = structuredClone(s);
    for (let n = 0; n < 5; n++) s = ae(s, { type: 'POTION_WORK', bottleId: 'ancient-evil-potion-2' });
    expect([s.actionsRemaining, s.cash]).toEqual([before.actionsRemaining - 5, before.cash]);
    expect(s.ancientEvil.bottles[1]).toMatchObject({ labourSteps: 5, status: 'SUPPLIER' }); expect(s.ancientEvil.bottles[0]!.labourSteps).toBe(0);
    rejectAncientEvil(s, { type: 'POTION_WORK', bottleId: 'ancient-evil-potion-2' });
    s = ae(s, { type: 'BUY_POTION', bottleId: 'ancient-evil-potion-2' }); expect(s.cash).toBe(before.cash - 900);
    expect(s.ancientEvil.bottles[1]).toMatchObject({ status: 'PLAYER', acquiredWeek: 122 }); rejectAncientEvil(s, { type: 'BUY_POTION', bottleId: 'ancient-evil-potion-2' });
    expect(validateAncientEvilAcquisitionJournal(s)).toBe(true); rejectAncientEvil(s, { type: 'PREPARE_PROMOTION' });
  });
  it('four jobs give no partial credit and earned credit never transfers to another bottle', () => {
    let s = taught(); for (let n = 0; n < 4; n++) s = ae(s, { type: 'POTION_WORK', bottleId: 'ancient-evil-potion-1' });
    const cash = s.cash; s = ae(s, { type: 'BUY_POTION', bottleId: 'ancient-evil-potion-1' }); expect(s.cash).toBe(cash - 6400);
    s = ae(s, { type: 'BUY_POTION', bottleId: 'ancient-evil-potion-2' }); expect(s.cash).toBe(cash - 12800);
    const credited = prepared('SUCCESS', true); expect([credited.cash, credited.actionsRemaining]).toEqual([98460, 90]);
  });
  it.each([[20, 99], [100, 40], [1, 99], [100, 1]] as const)('requires health>20 and mind>40 before site preparation (%s/%s)', (health, mind) => {
    const initial = directedInitial3(); initial.health = health; initial.mind = mind;
    let s = ae(initial, { type: 'LEARN_GUIDANCE' });
    for (const taskId of ANCIENT_EVIL_PREPARATION_IDS) s = ae(s, { type: 'PREPARE_TASK', taskId });
    s = ae(s, { type: 'BUY_POTION', bottleId: dose.bottleId });
    rejectAncientEvil(s, { type: 'PREPARE_PROMOTION' }); rejectAncientEvil(s, dose);
    expect(s.ancientEvil.bottles[0]!.status).toBe('PLAYER'); expect(s.injuries).toEqual(initial.injuries);
  });
  it('requires all three distinct preparations and cancellation refunds neither140 nor an action', () => {
    let s = taught(); const ap = s.actionsRemaining;
    for (const taskId of ANCIENT_EVIL_PREPARATION_IDS) { rejectAncientEvil(s, { type: 'PREPARE_PROMOTION' }); s = ae(s, { type: 'PREPARE_TASK', taskId }); rejectAncientEvil(s, { type: 'PREPARE_TASK', taskId }); }
    expect(s.actionsRemaining).toBe(ap - 3); rejectAncientEvil(s, { type: 'PREPARE_PROMOTION' });
    const ready = prepared(), e = journal(ready).at(-1)!;
    expect([e.before.cash - e.after.cash, e.before.actions - e.after.actions]).toEqual([140, 1]);
    expect([ready.cash, ready.actionsRemaining]).toEqual([92960, 95]); expect(hasAncientEvilLock(ready)).toBe(true);
    rejectIntent(ready, { type: 'ACTION', action: 'REST' }); rejectAncientEvil(ready, { type: 'LEARN_GUIDANCE' });
    const left = ae(ready, { type: 'LEAVE_PREPARATION' });
    expect([left.cash, left.actionsRemaining, left.health, left.spirituality]).toEqual([ready.cash, ready.actionsRemaining, ready.health, ready.spirituality]);
    expect(left.ancientEvil.bottles[0]!.status).toBe('PLAYER'); expect(left.ancientEvil.preparedWeek).toBeNull(); expect(left.ancientEvil.preparations).toEqual(ready.ancientEvil.preparations);
    expect(oldChainedRoots(left)).toEqual(oldChainedRoots(ready)); rejectAncientEvil(left, dose);
    const retried = ae(left, { type: 'PREPARE_PROMOTION' }); expect([retried.cash, retried.actionsRemaining]).toEqual([left.cash - 140, left.actionsRemaining - 1]);
  });
  it.each(ANCIENT_EVIL_PREPARATION_IDS)('owning a real potion never substitutes for missing preparation %s', omitted => {
    let s = ae(taught(), { type: 'BUY_POTION', bottleId: 'ancient-evil-potion-1' });
    for (const taskId of ANCIENT_EVIL_PREPARATION_IDS.filter(id => id !== omitted)) s = ae(s, { type: 'PREPARE_TASK', taskId });
    rejectAncientEvil(s, { type: 'PREPARE_PROMOTION' }); rejectAncientEvil(s, dose);
    s = ae(s, { type: 'PREPARE_TASK', taskId: omitted }); expect(ae(s, { type: 'PREPARE_PROMOTION' }).ancientEvil.preparedWeek).toBe(122);
  });
  it.each(['SUCCESS', 'GREAT_SUCCESS'] as const)('directed unit %s gives exactly17→19 without healing, resource refills or rewriting history', kind => {
    const before = prepared(kind), snapshot = structuredClone(before), s = ae(before, dose), e = journal(s).at(-1)!;
    const rng = new DeterministicActionRandomStream(before.random.seed, before.random.cursor);
    expect(e.check).toEqual(resolveNormalCheck({ ability: 'will', baseAbility: before.character.coreStats.will, difficulty: 30, modifiers: [], roll: rng.nextInt(1, 100) }));
    expect(e.check!.tier).toBe(kind); expect([e.randomBefore, e.randomAfter, s.random.cursor]).toEqual([before.random.cursor, rng.cursor, rng.cursor]);
    expect(s.progression.sequence).toBe(2); expect(Object.keys(s.progression.mastery)).toEqual([...ANCIENT_EVIL_INHERITED_ABILITY_IDS, ...ANCIENT_EVIL_ABILITY_IDS]);
    for (const [id, mastery] of Object.entries(before.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    for (const id of ANCIENT_EVIL_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const stat of ['physique', 'perception', 'knowledge', 'will'] as const) expect(s.character.coreStats[stat]).toBe(before.character.coreStats[stat] + 1);
    expect([s.health, s.spirituality, s.mind, s.injuryRisk, s.character.gender]).toEqual([100, 116, kind === 'GREAT_SUCCESS' ? 91 : 84, 0, before.character.gender]);
    expect(s.injuries).toEqual(before.injuries); expect(oldChainedRoots(s)).toEqual(oldChainedRoots(before)); expect(s.seer.completedSources).toEqual(before.seer.completedSources);
    expect(s.ancientEvil.silentDiscipleActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
    expect(s.ancientEvil.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind, preparationWeek: 122, consumedWeek: 122 });
    expect([s.actionsRemaining, s.cash]).toEqual([before.actionsRemaining, before.cash]); expect(before).toEqual(snapshot);
    expect(validateAncientEvilAcquisitionJournal(s)).toBe(true); assertValidSliceState(s); rejectAncientEvil(s, dose);
  });
  it('does not refill a declared pre-journal partial health or spirituality budget on successful promotion', () => {
    let s = directedInitial3('SUCCESS'); s.health = 83; s.mind = 85; s.spirituality = 17;
    s = ae(s, { type: 'LEARN_GUIDANCE' }); for (const taskId of ANCIENT_EVIL_PREPARATION_IDS) s = ae(s, { type: 'PREPARE_TASK', taskId });
    s = ae(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = ae(s, { type: 'PREPARE_PROMOTION' }); s = ae(s, dose);
    expect([s.health, s.mind, s.spirituality]).toEqual([83, 70, 17]); expect(projectAncientEvil(s).resources!.maxSpirituality).toBe(120);
    expect(validateAncientEvilAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
  });
  it.each([['FAILURE', 85, 74, 30], ['GREAT_FAILURE', 75, 54, 60]] as const)('directed unit %s consumes the original bottle with exact retained costs', (kind, health, mind, pollution) => {
    const before = prepared(kind), s = ae(before, dose);
    expect(s).toMatchObject({ health, mind, spirituality: 116, progression: { sequence: 3, acting: 100 } }); expect(s.seer.pollution).toBe(pollution);
    expect(s.ancientEvil.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind, consumedWeek: 122, preparationWeek: 122 }); expect(s.ancientEvil.preparedWeek).toBeNull();
    expect([s.cash, s.actionsRemaining]).toEqual([before.cash, before.actionsRemaining]); expect(s.ancientEvil.preparations).toEqual(before.ancientEvil.preparations);
    expect(oldChainedRoots(s)).toEqual(oldChainedRoots(before)); expect(s.injuries).toEqual(before.injuries); expect(Object.keys(s.progression.mastery)).toHaveLength(17);
    expect(s.seer.completedSources).toEqual(before.seer.completedSources); expect(validateAncientEvilAcquisitionJournal(s)).toBe(true); assertValidSliceState(s); rejectAncientEvil(s, dose);
    const bought = ae(s, { type: 'BUY_POTION', bottleId: 'ancient-evil-potion-2' }); expect(ae(bought, { type: 'PREPARE_PROMOTION' }).cash).toBe(s.cash - 6400 - 140);
  });
  it('ordinary REST restores actor resources through real actions without resetting old histories', () => {
    const before = promoted(), commands: SliceIntent[] = [], s = recover(before, commands);
    expect(commands.length).toBeGreaterThan(0); expect(commands.every(c => c.type === 'ACTION' && c.action === 'REST')).toBe(true);
    expect([s.health, s.mind, s.spirituality, s.injuryRisk]).toEqual([100, 100, 120, 0]); expect(s.injuries).toEqual(before.injuries);
    expect([s.actionsRemaining, s.cash]).toEqual([before.actionsRemaining - commands.length, before.cash]);
    expect(s.random).toEqual(before.random); expect(oldChainedRoots(s)).toEqual(oldChainedRoots(before)); expect(s.ancientEvil).toEqual(before.ancientEvil); assertValidSliceState(s);
  });
  it('uses only declared low pre-journal resources and confines the minimum1 support to the actual potion', () => {
    let s = directedInitial3('GREAT_FAILURE'); s.health = 21; s.mind = 41;
    s = ae(s, { type: 'LEARN_GUIDANCE' }); for (const taskId of ANCIENT_EVIL_PREPARATION_IDS) s = ae(s, { type: 'PREPARE_TASK', taskId });
    s = ae(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = ae(s, { type: 'PREPARE_PROMOTION' }); s = ae(s, dose);
    expect(s).toMatchObject({ status: 'ACTIVE', health: 1, mind: 1, progression: { sequence: 3 } });
    const bought = ae(s, { type: 'BUY_POTION', bottleId: 'ancient-evil-potion-2' }); rejectAncientEvil(bought, { type: 'PREPARE_PROMOTION' });
    expect(s.ancientEvil.bottles[0]!.status).toBe('CONSUMED'); expect(validateAncientEvilAcquisitionJournal(s)).toBe(true);
  });
  it('requires three actually failed original bottles and next-week delivery of independent new stock', () => {
    let s = taught('THREE_FAILURES'); rejectAncientEvil(s, { type: 'REQUEST_SUPPLY' }); rejectAncientEvil(s, { type: 'RECEIVE_SUPPLY' });
    for (const taskId of ANCIENT_EVIL_PREPARATION_IDS) s = ae(s, { type: 'PREPARE_TASK', taskId });
    const originalRoots = structuredClone(oldChainedRoots(s));
    for (const bottleId of ['ancient-evil-potion-1', 'ancient-evil-potion-2', 'ancient-evil-potion-3']) {
      s = recover(s); s = ae(s, { type: 'BUY_POTION', bottleId }); s = ae(s, { type: 'PREPARE_PROMOTION' }); s = ae(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    expect(s.ancientEvil.bottles.every(b => b.status === 'CONSUMED' && b.outcome === 'FAILURE')).toBe(true);
    expect(s.cash).toBe(100000 - 500 - 3 * (6400 + 140));
    const old = structuredClone(s.ancientEvil.bottles), beforeAP = s.actionsRemaining;
    s = ae(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(beforeAP - 1); expect(s.ancientEvil.bottles).toEqual(old); rejectAncientEvil(s, { type: 'RECEIVE_SUPPLY' });
    // Advance the unit continuation through real REST actions, never editing the
    // week/date or a resource once the first AncientEvil journal has been recorded.
    const requestWeek = s.week, requestDate = structuredClone(s.date), remaining = s.actionsRemaining;
    let nextWeek = s;
    for (let n = 0; n < remaining; n++) nextWeek = step(nextWeek, { type: 'ACTION', action: 'REST' });
    expect(nextWeek.week).toBe(requestWeek + 1); expect(nextWeek.date).toEqual(addGameDays(requestDate, 7));
    const received = ae(nextWeek, { type: 'RECEIVE_SUPPLY' });
    expect(received.ancientEvil.bottles.slice(0, 3)).toEqual(old); expect(received.ancientEvil.bottles.slice(3).map(b => b.id)).toEqual(['ancient-evil-potion-4', 'ancient-evil-potion-5', 'ancient-evil-potion-6']);
    expect(received.ancientEvil.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.stockedWeek === 123 && b.acquiredWeek === null && b.labourSteps === 0 && b.source.includes(b.id))).toBe(true);
    expect([received.cash, received.actionsRemaining]).toEqual([nextWeek.cash, nextWeek.actionsRemaining]); expect(oldChainedRoots(received)).toEqual(originalRoots);
    expect(validateAncientEvilAcquisitionJournal(received)).toBe(true); assertValidSliceState(received); rejectAncientEvil(received, { type: 'RECEIVE_SUPPLY' });
  });
  it('closes every predecessor acquisition command after the real AncientEvil promotion', () => {
    const s = promoted();
    for (const type of ['PRISONER', 'MADMAN', 'WEREWOLF', 'ZOMBIE', 'WRAITH', 'PUPPET', 'SILENT_DISCIPLE'] as const) rejectIntent(s, { type, command: { type: 'LEARN_GUIDANCE' } } as SliceIntent);
    rejectAncientEvil(s, { type: 'LEARN_GUIDANCE' }); rejectAncientEvil(s, { type: 'PREPARE_PROMOTION' }); rejectAncientEvil(s, { type: 'REQUEST_SUPPLY' });
  });
  it('rejects unknown fields, false confirmation, wrong source IDs and invented ritual commands without mutation', () => {
    const s = prepared();
    for (const command of [{ ...dose, confirmed: false }, { ...dose, free: true }, { type: 'BUY_POTION', bottleId: 'silent-disciple-potion-1' }, { type: 'PREPARE_TASK', taskId: 'REVIEW_DISASTER' }, { type: 'LEARN_GUIDANCE', free: true }, { type: 'RITUAL_CONTAIN' }, { type: 'RITUAL_REVIEW', stopped: true }]) {
      expect(validateAncientEvilCommand(command)).toBe(false); rejectAncientEvil(s, command);
    }
    rejectAncientEvil(s, { ...dose, bottleId: 'ancient-evil-potion-99' });
  });
});

const acquisitionMutations: [string, (s: SliceState) => void][] = [
  ['refunded guidance', s => { journal(s)[0]!.after.cash++; }],
  ['free preparation', s => { journal(s).find(e => e.command.type === 'PREPARE_PROMOTION')!.after.actions++; }],
  ['unearned mastery', s => { journal(s).at(-1)!.after.mastery[ANCIENT_EVIL_ABILITY_IDS[0]] = 8; }],
  ['altered dose cursor', s => { journal(s).at(-1)!.randomBefore!++; }],
  ['altered dose check', s => { journal(s).at(-1)!.check!.difficulty++; }],
  ['fabricated injury', s => { journal(s).at(-1)!.after.injuries.push({ id: 'fabricated', severity: 'LIGHT', acquiredRevision: 1, treatedRevision: null }); }],
  ['rewritten source IDs', s => { journal(s).at(-1)!.after.completedSources[0] = 'counterfeit-source'; }],
  ['missing purchase', s => { s.ancientEvil.acquisitionJournal = journal(s).filter(e => e.command.type !== 'BUY_POTION'); }],
  ['other actor', s => { journal(s)[0]!.actor.name = 'Counterfeit'; }],
  ['other prior promotion week', s => { journal(s)[0]!.actor.silentDisciplePromotionWeek--; }],
  ['relabelled original bottle', s => { s.ancientEvil.bottles[0]!.id = 'ancient-evil-potion-2'; }],
  ['restored consumed original', s => { s.ancientEvil.bottles[0]!.status = 'PLAYER'; }],
  ['invented supplier provenance', s => { s.ancientEvil.bottles[0]!.source += ' free'; }],
  ['extra evidence field', s => { Object.assign(journal(s)[0]!, { free: true }); }],
  ['extra stage field', s => { Object.assign(s.ancientEvil, { free: true }); }],
];
describe('AncientEvil acquisition replay rejects falsified evidence and cross-resource changes', () => {
  it.each(acquisitionMutations)('rejects %s', (_name, change) => {
    const s = promoted(); expect(validateAncientEvilState(s)).toBe(true); change(s);
    expect(validateAncientEvilState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it.each(['health', 'mind', 'spirituality', 'cash', 'actions', 'pollution', 'injuryRisk'] as const)('rejects a discontinuous %s budget even when both event endpoints are adjusted', field => {
    const s = promoted(), event = journal(s)[1]!;
    const delta = field === 'health' || field === 'mind' || field === 'spirituality' ? -1 : 1;
    event.before[field] += delta; event.after[field] += delta;
    expect(validateAncientEvilJournalContinuity(s)).toBe(false); expect(validateAncientEvilAcquisitionJournal(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it.each(['health', 'mind', 'spirituality', 'cash', 'actionsRemaining', 'injuryRisk'] as const)('rejects rewriting immediate post-potion %s without a real intervening command', field => {
    const s = promoted(); s[field] += field === 'health' || field === 'spirituality' ? -1 : 1;
    expect(validateAncientEvilAcquisitionJournal(s)).toBe(false); expect(validateAncientEvilState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it('rejects revision collisions, backdated checks and deleted consumed source prefixes', () => {
    const collision = promoted(); journal(collision)[1]!.revision = journal(collision)[0]!.revision;
    expect(validateAncientEvilJournalContinuity(collision)).toBe(false); expect(validateAncientEvilState(collision)).toBe(false);
    const backdated = promoted(); journal(backdated).at(-1)!.date = originalSilentDisciple().date;
    expect(validateAncientEvilAcquisitionJournal(backdated)).toBe(false);
    const missing = promoted(); missing.seer.completedSources.shift();
    expect(validateAncientEvilAcquisitionJournal(missing)).toBe(false); expect(validateAncientEvilState(missing)).toBe(false);
  });
  it('rejects a forged no-draw cursor after an adjacent post-failure purchase', () => {
    const failed = ae(prepared('FAILURE'), dose), bought = ae(failed, { type: 'BUY_POTION', bottleId: 'ancient-evil-potion-2' });
    expect(bought.random.cursor).toBe(failed.random.cursor); expect(validateAncientEvilJournalContinuity(bought)).toBe(true);
    bought.random.cursor++;
    expect(validateAncientEvilJournalContinuity(bought)).toBe(false); expect(() => assertValidSliceState(bought)).toThrow();
  });
  it('replays the whole directed command continuation identically without mutating input or payloads', () => {
    const initial = directedInitial3(), original = structuredClone(initial), commands: SliceIntent[] = [];
    let s = ae(initial, { type: 'LEARN_GUIDANCE' }, commands);
    for (const taskId of ANCIENT_EVIL_PREPARATION_IDS) s = ae(s, { type: 'PREPARE_TASK', taskId }, commands);
    s = ae(s, { type: 'BUY_POTION', bottleId: 'ancient-evil-potion-1' }, commands); s = ae(s, { type: 'PREPARE_PROMOTION' }, commands); s = ae(s, dose, commands);
    const payloads = structuredClone(commands); let replayed = structuredClone(initial);
    for (const command of commands) replayed = step(replayed, command);
    expect(replayed).toEqual(s); expect(initial).toEqual(original); expect(commands).toEqual(payloads);
    expect(validateAncientEvilJournalContinuity(replayed)).toBe(true); expect(validateAncientEvilAcquisitionJournal(replayed)).toBe(true);
  });
  it('projects only actual knowledge, exact19 abilities and independent state copies', () => {
    const s = promoted(), before = structuredClone(s), p = projectAncientEvil(s);
    expect(p.formulaKnown).toBe(false); expect(p.formula).toEqual([]); expect(p.abilities.map(a => a.id)).toEqual([...ANCIENT_EVIL_INHERITED_ABILITY_IDS, ...ANCIENT_EVIL_ABILITY_IDS]);
    expect(new Set(p.abilities.map(a => a.id)).size).toBe(19); expect(p.resources!.maxSpirituality).toBe(120); expect(p.currentGender).toBe(s.character.gender);
    expect(p.inheritedHistory.join(' ')).toContain('17项'); expect(p.inheritedHistory.join(' ')).toContain('第110周'); expect(p.inheritedTools).toContain('埃尔莎');
    expect(p.story).not.toMatch(/原创G|候选|未核|原核/); expect(p.risk).not.toMatch(/原创G|候选|未核|原核/);
    p.abilities[0]!.mastery++; p.bottles[0]!.source = 'altered view'; expect(s).toEqual(before);
  });
});
