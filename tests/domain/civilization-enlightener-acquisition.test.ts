import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { validateKnowledgeMentorState } from '../../src/domain/knowledge-mentor/index.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import {
  CIVILIZATION_ENLIGHTENER_INHERITED_ABILITY_IDS, createCivilizationEnlightenerState, hasCivilizationEnlightenerLock,
  projectCivilizationEnlightener, civilizationEnlightenerInheritedView, validateCivilizationEnlightenerAcquisitionJournal,
  validateCivilizationEnlightenerCommand, validateCivilizationEnlightenerSource, validateCivilizationEnlightenerState, resolveCivilizationEnlightenerOriginalCharacteristics,
} from '../../src/domain/civilization-enlightener/index.js';
import { CIVILIZATION_ENLIGHTENER_ABILITY_IDS, CIVILIZATION_ENLIGHTENER_PREPARATION_IDS, type CivilizationEnlightenerAcquisitionBudget, type CivilizationEnlightenerAcquisitionEvent } from '../../src/domain/civilization-enlightener/types.js';
import { ce, directedInitial2, directedInitialCursor, dose, originalParagonRoots, originalKnowledgeMentor, prepared, promoted, recoverResources, rejectEnlightener, rejectIntent, step, taught, knowledgeMentorNaturalPath, paragonLegacyKeys } from './civilization-enlightener-directed-helper.js';

import { CIVILIZATION_ENLIGHTENER_GUIDE } from '../../src/domain/civilization-enlightener/content.js';

const journal = (s: SliceState) => s.civilizationEnlightener.acquisitionJournal;
describe('Civilization Enlightener: actual691-command source and declared future inputs', () => {
  it('keeps the raw schema164 fixture fingerprint and migrates before current validation', () => {
    expect(createHash('sha256').update(readFileSync(knowledgeMentorNaturalPath)).digest('hex')).toBe('a1d58df609ea1c22e6605f8267a4e0792be7c2278fe2eb99c9b776af1a3d5b9a');
    const raw = readObjectEntry<SliceState>(knowledgeMentorNaturalPath, 'final'), s = originalKnowledgeMentor();
    expect(raw).toMatchObject({ schemaVersion: 164, contentVersion: 'knowledge-mentor-v164' });
    expect(s.progression.mastery).toEqual(raw.progression.mastery); expect(Object.keys(s.progression.mastery)).toEqual([...CIVILIZATION_ENLIGHTENER_INHERITED_ABILITY_IDS]);
    expect(Object.values(s.progression.mastery).filter(n => n === 0)).toHaveLength(7);
    expect(s.civilizationEnlightener).toEqual(createCivilizationEnlightenerState()); expect(originalParagonRoots(s)).toEqual(originalParagonRoots(raw));
    expect(s.knowledgeMentor.encounter).toMatchObject({ enemyStatus: 'DEAD', enemyHealth: 0, enemyMind: 100, enemySpirituality: 74 });
    expect(s.arcaneScholar.encounter.enemyStatus).toBe('SURRENDERED'); expect(s.alchemist.encounter.enemy.status).toBe('DEAD');
    expect(s.knowledgeMentor.life.combatPlates.map(p => [p.status, p.location])).toEqual([['SPENT', 'PLAYER'], ['FAILED', 'RECYCLE'], ['FAILED', 'RECYCLE']]);
    assertValidSliceState(s);
  }, 60_000);
  it('replays every original command without repairing the predecessor and matches its migrated histories', () => {
    const expected = originalKnowledgeMentor(), commands = readObjectEntry<SliceIntent[]>(knowledgeMentorNaturalPath, 'commands');
    const creation = readObjectEntry<Parameters<typeof createSliceRun>[1]>(knowledgeMentorNaturalPath, 'creation'), seed = readObjectEntry<string>(knowledgeMentorNaturalPath, 'seed');
    let replay = createSliceRun(expected.runId, creation, seed);
    for (const command of commands) replay = applySliceIntent(replay, command);
    expect(originalParagonRoots(replay)).toEqual(originalParagonRoots(expected)); expect(replay.progression).toEqual(expected.progression);
    expect(replay.character).toEqual(expected.character); expect(replay.combatHistory).toEqual(expected.combatHistory); expect(replay.random).toEqual(expected.random);
    expect(replay).toMatchObject({ revision: 692, week: 169, health: 70, mind: 99, spirituality: 113, cash: 576, actionsRemaining: 3, injuryRisk: 0 });
    expect(replay.injuries).toEqual(expected.injuries);
  }, 120_000);
  it('declares only pre-journal cash/AP/future-cursor inputs without time travel or healing', () => {
    const original = originalKnowledgeMentor(), s = directedInitial2();
    expect(s).toMatchObject({ week: 169, cash: 100000, actionsRemaining: 100, weeklyBudget: 100, health: 70, mind: 99, spirituality: 113 });
    expect(s.date).toEqual(original.date); expect(s.random.seed).toBe(original.random.seed); expect(s.random.cursor).toBeGreaterThanOrEqual(original.random.cursor);
    expect(originalParagonRoots(s)).toEqual(originalParagonRoots(original)); expect(s.character).toEqual(original.character);
    expect(s.injuries).toEqual(original.injuries); expect(s.progression).toEqual(original.progression); expect(journal(s)).toEqual([]);
    expect(() => directedInitialCursor(taught(), 'SUCCESS')).toThrow(/precede/);
  });
  it('hides the new stage for unrelated characters and creates separate original bottles', () => {
    const s = createSliceRun('enlightener-hidden', sliceDefaultCreationSelection, 'enlightener-hidden');
    expect(projectCivilizationEnlightener(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], actions: [], abilities: [], bottles: [], resources: null });
    rejectEnlightener(s, { type: 'LEARN_GUIDANCE' }); const other = createCivilizationEnlightenerState(); other.bottles[0]!.labourSteps = 5;
    expect(s.civilizationEnlightener.bottles[0]!.labourSteps).toBe(0);
  });
  it('captures the true live source on paid guidance, not the stale old resource ledger', () => {
    const before = originalKnowledgeMentor(), s = ce(before, { type: 'LEARN_GUIDANCE' }), e = journal(s)[0]!;
    expect([s.cash, s.actionsRemaining]).toEqual([76, 2]); expect([s.health, s.mind, s.spirituality]).toEqual([70, 99, 113]); expect(s.injuries).toEqual(before.injuries);
    const scene = s.civilizationEnlightener.sourceScene!;
    expect(scene).toMatchObject({ week: 169, revision: 692, random: { seed: 'savant-rebuild-first', cursor: 308 }, city: 'BACKLUND' });
    expect(scene.creations).toEqual(before.alchemist.life.creations); expect(scene.creations.map(o => o.charge)).toEqual([0, 0]);
    expect(before.knowledgeMentor.life.originalLedger.at(-1)!.after.map(o => o.charge)).toEqual([3, 3]);
    for (const key of paragonLegacyKeys) expect(s.civilizationEnlightener.sourceHistory![key]).toEqual(before[key]);
    expect(s.civilizationEnlightener.sourceHistory!.alchemist).not.toBe(s.alchemist);
    expect(e.before.cash - e.after.cash).toBe(500); expect(e.before.actions - e.after.actions).toBe(1);
    expect([e.cursorBefore, e.cursorAfter, e.check, e.randomBefore, e.randomAfter]).toEqual([308, 308, null, null, null]);
    expect(e.actor).toMatchObject({ pathwayId: 'paragon', knowledgeMentorPromotionWeek: 156, savantPromotionWeek: 5 });
    expect(e.actor.sourceHistoryDigest).toMatch(/^[0-9a-f]{64}$/); expect(e.actor.sourceIdentityDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(validateCivilizationEnlightenerSource(s)).toBe(true); expect(validateCivilizationEnlightenerAcquisitionJournal(s)).toBe(true);
    rejectEnlightener(s, { type: 'LEARN_GUIDANCE' });
  });
  it('uses actual promotion156 for13 elapsed weeks and requires all original reports/reflection', () => {
    const original = originalKnowledgeMentor(); expect(projectCivilizationEnlightener(original).digestion).toContain('13/12');
    expect(ce(prepared(), dose).civilizationEnlightener.promotionWeek).toBe(169);
    for (const source of ['knowledge-mentor-case:documented-cycle', 'knowledge-mentor-case:consented-transfer', 'knowledge-mentor-case:blocked-cycle', 'knowledge-mentor-reflection']) {
      const s = directedInitial2(); s.seer.completedSources = s.seer.completedSources.filter(id => id !== source); rejectEnlightener(s, { type: 'LEARN_GUIDANCE' });
    }
    for (const mutate of [
      (s: SliceState) => { s.knowledgeMentor.arcaneScholarActingAtPromotion = 99; },
      (s: SliceState) => { s.arcaneScholar.promotionWeek = null; },
      (s: SliceState) => { s.savant.bottles[0]!.consumedWeek = 6; },
      (s: SliceState) => { delete s.progression.mastery['paragon.s3.bounded-analysis']; },
      (s: SliceState) => { s.progression.mastery['paragon.s1.invented'] = 0; },
    ]) { const s = directedInitial2(); mutate(s); rejectEnlightener(s, { type: 'LEARN_GUIDANCE' }); }
  });
  it('rejects unknown fields and foreign, absent or false confirmations', () => {
    for (const command of [null, {}, { type: 'LEARN_GUIDANCE', free: true }, { type: 'PREPARE_TASK', taskId: 'CREATE_SOUL' },
      { ...dose, confirmed: false }, { type: 'CONSUME', bottleId: dose.bottleId }, { ...dose, bottleId: 'knowledge-mentor-potion-1' },
      { ...dose, bottleId: 'civilization-enlightener-potion-0' }, { ...dose, acceptFeminization: true }]) expect(validateCivilizationEnlightenerCommand(command)).toBe(false);
    expect(validateCivilizationEnlightenerCommand(dose)).toBe(true);
  });
});

describe('Civilization Enlightener acquisition: real costs, failures and finite resupply', () => {
  it('five actual jobs credit only that bottle5500 and leave1100 due', () => {
    let s = taught(); const before = structuredClone(s);
    for (let n = 0; n < 5; n++) s = ce(s, { type: 'POTION_WORK', bottleId: 'civilization-enlightener-potion-2' });
    expect([s.actionsRemaining, s.cash]).toEqual([before.actionsRemaining - 5, before.cash]); rejectEnlightener(s, { type: 'POTION_WORK', bottleId: 'civilization-enlightener-potion-2' });
    s = ce(s, { type: 'BUY_POTION', bottleId: 'civilization-enlightener-potion-2' }); expect(s.cash).toBe(before.cash - 1100);
    s = ce(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); expect(s.cash).toBe(before.cash - 1100 - 6600);
    rejectEnlightener(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); expect(validateCivilizationEnlightenerAcquisitionJournal(s)).toBe(true);
    expect(prepared('SUCCESS', true)).toMatchObject({ cash: 98250, actionsRemaining: 90 });
  });
  it('four jobs give no partial credit and do not buy the three separate preparations', () => {
    let s = taught(); for (let n = 0; n < 4; n++) s = ce(s, { type: 'POTION_WORK', bottleId: dose.bottleId });
    const cash = s.cash; s = ce(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); expect(s.cash).toBe(cash - 6600);
    expect(s.civilizationEnlightener.preparations).toEqual([]); rejectEnlightener(s, { type: 'PREPARE_PROMOTION' });
  });
  it('requires three distinct preparations, a same-week real site and cancellation keeps costs', () => {
    let s = taught(); for (const taskId of CIVILIZATION_ENLIGHTENER_PREPARATION_IDS) {
      rejectEnlightener(s, { type: 'PREPARE_PROMOTION' }); s = ce(s, { type: 'PREPARE_TASK', taskId }); rejectEnlightener(s, { type: 'PREPARE_TASK', taskId });
    }
    rejectEnlightener(s, { type: 'PREPARE_PROMOTION' }); const ready = prepared(); expect(hasCivilizationEnlightenerLock(ready)).toBe(true);
    rejectIntent(ready, { type: 'ACTION', action: 'REST' }); const left = ce(ready, { type: 'LEAVE_PREPARATION' });
    expect(hasCivilizationEnlightenerLock(left)).toBe(false); expect([left.cash, left.actionsRemaining, left.health, left.mind, left.spirituality]).toEqual([ready.cash, ready.actionsRemaining, ready.health, ready.mind, ready.spirituality]);
    expect(left.civilizationEnlightener.bottles[0]!.status).toBe('PLAYER'); rejectEnlightener(left, dose); expect(ce(left, { type: 'PREPARE_PROMOTION' }).cash).toBe(left.cash - 150);
  });
  it.each([['GREAT_SUCCESS', 1, 70, 91, 0], ['SUCCESS', 1, 70, 84, 0], ['FAILURE', 2, 55, 74, 30], ['GREAT_FAILURE', 2, 45, 54, 60]] as const)('records actual %s once without healing or changing original objects', (kind, sequence, health, mind, pollution) => {
    const before = prepared(kind), s = ce(before, dose), event = journal(s).at(-1)!;
    expect(s).toMatchObject({ health, mind, spirituality: 113, progression: { sequence }, seer: { pollution } });
    expect(s.civilizationEnlightener.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind, consumedWeek: 169, preparationWeek: 169 });
    expect(s.civilizationEnlightener.preparedWeek).toBeNull(); expect(originalParagonRoots(s)).toEqual(originalParagonRoots(before));
    expect(s.character.gender).toBe('FEMALE'); expect(s.character.age).toBe(26); expect(s.injuries).toEqual(before.injuries);
    for (const id of CIVILIZATION_ENLIGHTENER_INHERITED_ABILITY_IDS) expect(s.progression.mastery[id], id).toBe(before.progression.mastery[id]);
    expect([event.cursorAfter, event.randomAfter]).toEqual([event.cursorBefore + 1, event.randomBefore! + 1]); expect(event.check!.tier).toBe(kind);
    expect(validateCivilizationEnlightenerAcquisitionJournal(s)).toBe(true); expect(validateCivilizationEnlightenerState(s)).toBe(true);
    if (sequence === 1) {
      expect(s.progression.acting).toBe(0); expect(s.civilizationEnlightener.knowledgeMentorActingAtPromotion).toBe(100); expect(Object.keys(s.progression.mastery)).toHaveLength(21);
      for (const id of CIVILIZATION_ENLIGHTENER_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
      expect(s.character.coreStats).toEqual({ physique: 30, perception: 29, will: 25, knowledge: 32 });
      expect(s.seer.completedSources.at(-1)).toBe('paragon-s1'); expect(projectCivilizationEnlightener(s).abilities).toHaveLength(21);
      rejectEnlightener(s, { type: 'PREPARE_PROMOTION' });
    } else { expect(s.progression.acting).toBe(100); expect(s.character.coreStats).toEqual(before.character.coreStats); }
    rejectEnlightener(s, dose);
  });
  it('recovers one paid original after three failures while reading old independent-supply history unchanged', () => {
    let s = taught('THREE_FAILURES'); for (const taskId of CIVILIZATION_ENLIGHTENER_PREPARATION_IDS) s = ce(s, { type: 'PREPARE_TASK', taskId });
    const original = structuredClone(originalParagonRoots(s));
    for (const bottleId of ['civilization-enlightener-potion-1', 'civilization-enlightener-potion-2', 'civilization-enlightener-potion-3']) {
      s = recoverResources(s); s = ce(s, { type: 'BUY_POTION', bottleId }); s = ce(s, { type: 'PREPARE_PROMOTION' }); s = ce(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    expect(s.civilizationEnlightener.bottles.every(b => b.status === 'CONSUMED' && b.outcome === 'FAILURE')).toBe(true);
    expect(s.cash).toBe(100000 - 500 - 60 - 3 * (6600 + 150));
    const failures = structuredClone(s.civilizationEnlightener.bottles), archived = structuredClone(s), cash = s.cash, ap = s.actionsRemaining;
    rejectEnlightener(s, { type: 'REQUEST_SUPPLY' }); rejectEnlightener(s, { type: 'RECEIVE_SUPPLY' });
    s = ce(s, { type: 'REQUEST_RECOVERY_V1', bottleId: 'civilization-enlightener-potion-1' });
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 120, ap - 1]);
    rejectEnlightener(s, { type: 'RECOVER_CHARACTERISTIC_V1', bottleId: 'civilization-enlightener-potion-1' });
    rejectEnlightener(s, { type: 'REQUEST_RECOVERY_V1', bottleId: 'civilization-enlightener-potion-2' });
    const requestWeek = s.week, requestDate = structuredClone(s.date), remaining = s.actionsRemaining;
    for (let n = 0; n < remaining; n++) s = step(s, { type: 'ACTION', action: 'REST' });
    expect(s.week).toBe(requestWeek + 1); expect(s.date).toEqual(addGameDays(requestDate, 7));
    const before = structuredClone(s), delivered = ce(s, { type: 'RECOVER_CHARACTERISTIC_V1', bottleId: 'civilization-enlightener-potion-1' });
    expect(delivered.civilizationEnlightener.bottles.slice(0, 3)).toEqual(failures);
    expect(delivered.civilizationEnlightener.bottles).toHaveLength(4);
    expect(delivered.civilizationEnlightener.bottles[3]).toMatchObject({ id: 'civilization-enlightener-potion-4', status: 'SUPPLIER',
      labourSteps: 0, acquiredWeek: null, stockedWeek: requestWeek + 1,
      recovery: { version: 1, sourceBottleId: 'civilization-enlightener-potion-1', originalBottleId: 'civilization-enlightener-potion-1',
        characteristicId: 'civilization-enlightener-potion-1:characteristic', requestedWeek: requestWeek, recoveredWeek: requestWeek + 1 } });
    expect([delivered.cash, delivered.actionsRemaining]).toEqual([before.cash, before.actionsRemaining - 1]);
    expect(originalParagonRoots(delivered)).toEqual(original); expect(validateCivilizationEnlightenerAcquisitionJournal(delivered)).toBe(true);
    const originals = resolveCivilizationEnlightenerOriginalCharacteristics(delivered)!;
    expect(originals.characteristics).toHaveLength(3); expect(originals.characteristics[0]).toMatchObject({ originalBottleId: 'civilization-enlightener-potion-1', latestBottleId: 'civilization-enlightener-potion-4', holder: 'SUPPLIER' });
    rejectEnlightener(delivered, { type: 'RECOVER_CHARACTERISTIC_V1', bottleId: 'civilization-enlightener-potion-1' });

    // Declared archived legacy receipts only. Never offered as future commands,
    // never migrated into a newly invented ancestry and never written to fixtures.
    const budget = (): CivilizationEnlightenerAcquisitionBudget => ({ actions: archived.actionsRemaining, health: archived.health, mind: archived.mind,
      spirituality: archived.spirituality, cash: archived.cash, pollution: archived.seer.pollution, gender: archived.character.gender,
      sequence: 2, acting: archived.progression.acting, coreStats: { ...archived.character.coreStats }, mastery: { ...archived.progression.mastery },
      completedSources: [...archived.seer.completedSources], injuries: structuredClone(archived.injuries), injuryRisk: archived.injuryRisk });
    const appendLegacy = (type: 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY', mutation: () => void) => {
      const before = budget(), actor = { ...journal(archived).at(-1)!.actor, sourceHistoryDigest: null };
      mutation();
      const receipt: CivilizationEnlightenerAcquisitionEvent = { week: archived.week, date: structuredClone(archived.date), revision: archived.revision,
        command: { type }, actor, before, after: budget(), cursorBefore: archived.random.cursor, cursorAfter: archived.random.cursor,
        randomBefore: null, randomAfter: null, check: null };
      journal(archived).push(receipt); archived.revision++;
    };
    appendLegacy('REQUEST_SUPPLY', () => { archived.actionsRemaining--; archived.cash -= 100; archived.civilizationEnlightener.resupply.requestedWeek = archived.week; });
    // Historical elapsed-time input with an explicit ordinary-play revision gap.
    archived.week++; archived.date = addGameDays(archived.date, 7); archived.revision += 2;
    appendLegacy('RECEIVE_SUPPLY', () => {
      for (let n = 4; n <= 6; n++) archived.civilizationEnlightener.bottles.push({ id: `civilization-enlightener-potion-${n}`,
        source: `${CIVILIZATION_ENLIGHTENER_GUIDE}第2批、第${archived.week}周实际到货的序列1文明启蒙者成品，独立封存编号civilization-enlightener-potion-${n}。本瓶须另行取得并独立耗用。`,
        stockedWeek: archived.week, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
      archived.civilizationEnlightener.resupply.deliveries++; archived.civilizationEnlightener.resupply.requestedWeek = null;
    });
    const legacyBytes = JSON.stringify(archived);
    expect(validateCivilizationEnlightenerAcquisitionJournal(archived)).toBe(true); expect(validateCivilizationEnlightenerState(archived)).toBe(true);
    expect(resolveCivilizationEnlightenerOriginalCharacteristics(archived)).toBeNull(); expect(JSON.stringify(archived)).toBe(legacyBytes);
    expect(archived.civilizationEnlightener.bottles.slice(0, 3)).toEqual(failures);
  }, 90_000);
  it('preserves the wound until ordinary paid care and later actual rest', () => {
    const before = promoted(), commands: SliceIntent[] = [], after = recoverResources(before, commands);
    expect(before.injuries).toHaveLength(1); expect(after.injuries).toEqual([]); expect(after.cash).toBe(before.cash - 60);
    expect(commands.some(c => c.type === 'EVENT_CHOICE' && c.choiceId === 'PAY')).toBe(true);
    const payment = commands.findIndex(c => c.type === 'EVENT_CHOICE'); expect(commands.slice(payment + 1).some(c => c.type === 'ACTION' && c.action === 'REST')).toBe(true);
    expect(after.alchemist.life.creations).toEqual(before.alchemist.life.creations); expect(after.progression.mastery).toEqual(before.progression.mastery);
  }, 60_000);
});

describe('Civilization Enlightener exact source, budget and immutable receipt validation', () => {
  it('rejects free original resources, modified manufacture, restored dead people and changed old histories', () => {
    const base = promoted();
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.alchemist.life.creations[0]!.charge++; }, s => { s.alchemist.life.creations[1]!.durability++; },
      s => { s.alchemist.life.creations[0]!.source += ' altered'; }, s => { s.alchemist.life.creations[0]!.owner = 'AL4-HELENA' as never; },
      s => { s.knowledgeMentor.encounter.enemyHealth = 100; }, s => { s.knowledgeMentor.life.combatPlates[0]!.status = 'READY'; },
      s => { s.arcaneScholar.bottles[0]!.source += ' altered'; }, s => { s.civilizationEnlightener.sourceHistory!.alchemist.life.creations[0]!.charge = 3; },
      s => { s.civilizationEnlightener.sourceScene!.random.seed = 'replacement'; }, s => { s.random.seed = 'replacement'; },
      s => { s.character.name = '替代姓名'; }, s => { s.character.traits[0]!.label = '替代特质'; },
      s => { s.combatHistory[0]!.round++; },
    ];
    for (const mutate of mutations) { const s = structuredClone(base); mutate(s); expect(validateCivilizationEnlightenerState(s)).toBe(false); }
  });
  it('rejects unknown root, bottle, scene, actor and event fields and exact financial/RNG tampering', () => {
    const base = promoted(); const mutations: ((s: SliceState) => void)[] = [
      s => { Object.assign(s.civilizationEnlightener, { freeRepair: true }); }, s => { Object.assign(s.civilizationEnlightener.bottles[0]!, { refill: true }); },
      s => { Object.assign(s.civilizationEnlightener.sourceScene!, { freeEnergy: 3 }); }, s => { Object.assign(journal(s)[0]!.actor, { override: true }); },
      s => { Object.assign(journal(s)[0]!, { bypass: true }); }, s => { journal(s)[0]!.after.cash++; },
      s => { journal(s).at(-1)!.check!.roll = 100; }, s => { journal(s).at(-1)!.randomAfter!++; }, s => { journal(s)[1]!.cursorBefore++; },
      s => { s.civilizationEnlightener.bottles[0]!.labourSteps = 5; }, s => { s.civilizationEnlightener.bottles[0]!.status = 'PLAYER'; },
      s => { s.progression.mastery['paragon.s3.bounded-analysis'] = 8; }, s => { s.progression.mastery['paragon.s1.process-analysis'] = 8; },
    ];
    for (const mutate of mutations) { const s = structuredClone(base); mutate(s); expect(validateCivilizationEnlightenerState(s)).toBe(false); }
    rejectEnlightener(taught(), { type: 'REQUEST_SUPPLY' }); rejectEnlightener(taught(), { type: 'RECEIVE_SUPPLY' });
  });
  it('returns a separate exact original S2 view for all old validators without altering S1', () => {
    const s = promoted(), before = structuredClone(s), source = s.civilizationEnlightener.sourceScene!, view = civilizationEnlightenerInheritedView(s);
    expect(s).toEqual(before); expect(view.progression).toMatchObject({ pathwayId: 'paragon', sequence: 2, acting: 100, mastery: source.budget.mastery });
    expect(view.character.coreStats).toEqual(source.budget.coreStats); expect(view.character.gender).toBe(s.character.gender);
    expect(view.alchemist.life.creations).toEqual(source.creations); expect(view.combatHistory).toEqual(s.combatHistory.slice(0, source.combatHistoryLength));
    expect(view.civilizationEnlightener).toEqual(createCivilizationEnlightenerState()); expect(validateKnowledgeMentorState(view)).toBe(true);
  });
  it('keeps source-verification labels and divine or civilization-scale powers out of player prose', () => {
    const view = projectCivilizationEnlightener(promoted());
    const text = JSON.stringify({ story: view.story, risk: view.risk, supplies: view.supplies, abilities: view.abilities, preparations: view.preparations, history: view.inheritedHistory, tools: view.inheritedTools });
    expect(text).not.toMatch(/原创G|本作G|候选|未核|文明画卷|工业革命|acceptFeminization/);
    expect(view.characterName).toBe('伊文'); expect(view.appearanceRecord).toContain('本次晋升不改变角色性别'); expect(view.formula).toEqual([]);
    expect(view.abilities.slice(-2).map(a => a.label)).toEqual(['工艺析解', '操作启示']);
  });
});
