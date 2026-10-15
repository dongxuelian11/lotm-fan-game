import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { CIVILIZATION_ENLIGHTENER_ABILITY_IDS, CIVILIZATION_ENLIGHTENER_SOURCE_KEYS } from '../../src/domain/civilization-enlightener/types.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';

const ROOT = 'tests/fixtures/civilization-enlightener-v01890';
const SOURCE = 'tests/fixtures/knowledge-mentor-v01670/natural.json';
const SOURCE_SHA256 = 'a1d58df609ea1c22e6605f8267a4e0792be7c2278fe2eb99c9b776af1a3d5b9a';
const entry = <T>(key: string): T => readObjectEntry<T>(`${ROOT}/natural.json`, key);
const captured = (key: string): SliceState => migrateSliceState(entry<unknown>(key));
const same = (actual: unknown, expected: unknown) => expect(stableStringify(actual)).toBe(stableStringify(expected));
const index = (): Record<string, string> => JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8'));
const boundary = (name: string) => {
  const file = `${ROOT}/${index()[name]}`;
  return { before: migrateSliceState(readObjectEntry<unknown>(file, 'beforeLast')),
    intent: readObjectEntry<SliceIntent>(file, 'lastIntent'), final: migrateSliceState(readObjectEntry<unknown>(file, 'final')) };
};
const originals = (state: SliceState) => state.alchemist.life.creations.map(item => [item.id, item.charge, item.durability, item.location, item.active]);

// The actual 797-command capture has one successful potion, failed teaching
// and failed independent learning, then a wounded fourth-round retreat. Raw
// historical pins are separate; every loaded playable state is migrated.
describe('Civilization Enlightener exact original691-command public continuation', () => {
  it('pins the untouched historical bytes and their historical schema separately', () => {
    expect(createHash('sha256').update(readFileSync(SOURCE)).digest('hex')).toBe(SOURCE_SHA256);
    expect(readObjectEntry(SOURCE, 'final')).toMatchObject({ schemaVersion: 164, contentVersion: 'knowledge-mentor-v164', revision: 692, week: 169 });
    expect(createHash('sha256').update(readFileSync(`${ROOT}/natural.json`)).digest('hex')).toBe('5d7a97347f8a555c91c7b1a57dc4acdebd78f3ac36414e1674d2bb5d34cc835f');
    expect(entry('final')).toMatchObject({ schemaVersion: 186, contentVersion: 'civilization-enlightener-v186' });
  });

  it('replays the same seed, all691 original commands and every one of the797 final commands', () => {
    const originalCommands = readObjectEntry<SliceIntent[]>(SOURCE, 'commands'), commands = entry<SliceIntent[]>('commands');
    expect(originalCommands).toHaveLength(691); expect(commands).toHaveLength(797);
    expect(entry<number>('prefixCount')).toBe(691); expect(entry<boolean>('prefixVerified')).toBe(true);
    expect(entry<string>('seed')).toBe('savant-rebuild-first');
    expect(entry('provenance')).toEqual({ kind: 'SAME_SEED_ORIGINAL_LIVING_BRANCH_PUBLIC_CONTINUATION', source: SOURCE, sourceSha256: SOURCE_SHA256, newRandomChanges: false });
    same(commands.slice(0, 691), originalCommands); same(entry('creation'), readObjectEntry(SOURCE, 'creation'));
    const final = captured('final'), prefix = captured('prefixFinal');
    same(prefix, migrateSliceState(readObjectEntry<unknown>(SOURCE, 'final')));
    let state = createSliceRun(final.runId, entry<Parameters<typeof createSliceRun>[1]>('creation'), entry<string>('seed'));
    same(state, captured('initial'));
    for (const [i, intent] of commands.entries()) {
      if (i >= 691 && intent.type === 'CIVILIZATION_ENLIGHTENER') {
        const action = projectSliceState(state).civilizationEnlightener.actions.find(action => stableStringify(action.command) === stableStringify(intent.command));
        expect(action, `Captured command ${i + 1} must have a current public control`).toBeDefined();
        expect(action!.enabled, action!.reason ?? JSON.stringify(intent)).toBe(true);
      }
      state = applySliceIntent(state, intent);
      if (i === 690) same(state, prefix);
    }
    same(state, final); assertValidSliceState(state);
    expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(state.revision).toBe(captured('initial').revision + commands.length);
    expect(entry('pendingIntent')).toBeNull(); expect(entry('error')).toBeNull();
    expect(entry<string>('stage')).toBe('NATURAL_CIVILIZATION_ENLIGHTENER_PUBLIC_CONTINUATION');
    expect(Object.keys(index())).toHaveLength(69); expect(new Set(Object.values(index())).size).toBe(69);
  }, 30_000);

  it('retains all eight frozen roots,19 inherited masteries, seven zeros and every old combat ending', () => {
    const original = captured('prefixFinal'), final = captured('final');
    expect(Object.keys(original.progression.mastery)).toHaveLength(19);
    expect(Object.values(original.progression.mastery).filter(value => value === 0)).toHaveLength(7);
    for (const root of CIVILIZATION_ENLIGHTENER_SOURCE_KEYS) {
      same(final.civilizationEnlightener.sourceHistory![root], original[root]);
      if (root !== 'alchemist') same(final[root], original[root]);
    }
    // Only the current originals evolve; manufacture, life history and old
    // opponents remain exactly the original alchemist record.
    const oldAlchemist = structuredClone(original.alchemist), currentAlchemist = structuredClone(final.alchemist);
    currentAlchemist.life.creations = oldAlchemist.life.creations;
    same(currentAlchemist, oldAlchemist);
    for (const [id, value] of Object.entries(original.progression.mastery)) expect(final.progression.mastery[id], id).toBe(value);
    expect(Object.keys(original.progression.mastery).filter(id => final.progression.mastery[id] === 0)).toHaveLength(7);
    same(final.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
    same(final.civilizationEnlightener.encounter.originalHistory, original.combatHistory);
    expect(final.knowledgeMentor.encounter).toMatchObject({ enemyStatus: 'DEAD', enemyHealth: 0 });
    expect(final.arcaneScholar.encounter.enemyStatus).toBe('SURRENDERED');
    expect(final.alchemist.encounter.enemy.status).toBe('DEAD');
    expect(final.knowledgeMentor.life.combatPlates.map(plate => [plate.status, plate.location])).toEqual([['SPENT', 'PLAYER'], ['FAILED', 'RECYCLE'], ['FAILED', 'RECYCLE']]);
    expect(final.character).toMatchObject({ name: original.character.name, gender: original.character.gender, age: original.character.age });
    expect(final.progression.promotionWeek).toBe(original.progression.promotionWeek);
    expect(final.random.seed).toBe(original.random.seed); same(migrateSliceState(final), final); assertValidSliceState(final);
  });

  it('pays the real clinic and first original bottle, preserving actual checks and zero new mastery at promotion', () => {
    const clinic = boundary('clinic-actual-pay60');
    expect(clinic.intent).toMatchObject({ type: 'EVENT_CHOICE', choiceId: 'PAY' });
    same(applySliceIntent(clinic.before, clinic.intent), clinic.final);
    expect(clinic.final.cash).toBe(clinic.before.cash - 60);
    expect(clinic.final.health).toBe(clinic.before.health);
    expect(clinic.final.actionsRemaining).toBe(clinic.before.actionsRemaining);
    same(clinic.final.random, clinic.before.random);
    const rest = boundary('original-wound-rest-1');
    expect(rest.intent).toEqual({ type: 'ACTION', action: 'REST' });
    expect(rest.before.injuries).toHaveLength(1); expect(rest.before.injuries[0]!.treatedRevision).not.toBeNull();
    expect(rest.final.injuries).toEqual([]); same(applySliceIntent(rest.before, rest.intent), rest.final);
    const promotion = boundary('consume-civilization-enlightener-potion-1'), final = captured('final');
    expect(promotion.intent).toEqual({ type: 'CIVILIZATION_ENLIGHTENER', command: { type: 'CONSUME', bottleId: 'civilization-enlightener-potion-1', confirmed: true } });
    same(applySliceIntent(promotion.before, promotion.intent), promotion.final);
    const receipts = final.civilizationEnlightener.acquisitionJournal.filter(receipt => receipt.command.type === 'CONSUME');
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({ week: 180, check: { roll: 35, chance: 38, tier: 'SUCCESS' }, randomBefore: 308, randomAfter: 309 });
    expect(final.civilizationEnlightener.bottles.map(bottle => bottle.outcome)).toEqual(['SUCCESS', null, null]);
    expect(final.civilizationEnlightener.promotionWeek).toBe(180);
    expect(promotion.final.progression.sequence).toBe(1); expect(Object.keys(promotion.final.progression.mastery)).toHaveLength(21);
    expect(CIVILIZATION_ENLIGHTENER_ABILITY_IDS.map(id => promotion.final.progression.mastery[id])).toEqual([0, 0]);
    for (const [id, value] of Object.entries(promotion.before.progression.mastery)) expect(promotion.final.progression.mastery[id], id).toBe(value);
    for (const root of CIVILIZATION_ENLIGHTENER_SOURCE_KEYS) same(promotion.final[root], promotion.before[root]);
    expect(promotion.final.health).toBe(promotion.before.health); expect(promotion.final.spirituality).toBe(promotion.before.spirituality);
    same(promotion.final.injuries, promotion.before.injuries);
  });

  it('repairs the same frame90→95 with the paid original shim and never gives either original free charge', () => {
    const original = captured('prefixFinal'), final = captured('final');
    expect(originals(original)).toEqual([['AL4-BOX-1', 0, 100, 'PLAYER', false], ['AL4-FRAME-1', 0, 90, 'PLAYER', false]]);
    const analysis = boundary('paid-limited-defect-analysis'), shim = boundary('paid-finite-original-shim'), repair = boundary('explicit-frame90-to95-no-recharge');
    same(analysis.final.alchemist.life.creations, analysis.before.alchemist.life.creations);
    expect(shim.final.cash).toBe(shim.before.cash - 40);
    expect(shim.final.civilizationEnlightener.life.practice.shim).toMatchObject({ id: 'CE1-SHIM-1', price: 40, status: 'PLAYER', purchasedWeek: 182 });
    expect(repair.intent).toEqual({ type: 'CIVILIZATION_ENLIGHTENER', command: { type: 'REPAIR_FRAME' } });
    same(applySliceIntent(repair.before, repair.intent), repair.final);
    expect(repair.before.alchemist.life.creations[1]!.durability).toBe(90);
    expect(repair.final.alchemist.life.creations[1]!.durability).toBe(95);
    expect(repair.final.civilizationEnlightener.life.practice.shim).toMatchObject({ status: 'CONSUMED', consumedWeek: 182 });
    same(repair.final.random, repair.before.random);
    expect([repair.final.health, repair.final.mind, repair.final.spirituality, repair.final.cash, repair.final.actionsRemaining])
      .toEqual([repair.before.health, repair.before.mind, repair.before.spirituality, repair.before.cash, repair.before.actionsRemaining]);
    expect(originals(final)).toEqual([['AL4-BOX-1', 0, 100, 'PLAYER', false], ['AL4-FRAME-1', 0, 95, 'PLAYER', false]]);
    final.alchemist.life.creations.forEach((item, i) => same({ ...item, durability: original.alchemist.life.creations[i]!.durability }, original.alchemist.life.creations[i]));
    const receipts = final.civilizationEnlightener.life.journal;
    expect(receipts.filter(receipt => receipt.command.type === 'BUY_SHIM')).toHaveLength(1);
    expect(receipts.filter(receipt => receipt.command.type === 'REPAIR_FRAME')).toHaveLength(1);
    for (const receipt of receipts) {
      expect(receipt.originalsBefore.map(item => item.charge)).toEqual([0, 0]);
      expect(receipt.originalsAfter.map(item => item.charge)).toEqual([0, 0]);
      if (receipt.command.type !== 'REPAIR_FRAME') same(receipt.originalsAfter.map(item => item.durability), receipt.originalsBefore.map(item => item.durability));
    }
  });

  it('keeps successful analysis, both failed teaching checks and ordinary withdrawn permission as recorded', () => {
    const final = captured('final'), life = final.civilizationEnlightener.life;
    expect(life.reflected).toBe(true); expect(final.progression.acting).toBe(100);
    expect(Object.values(life.cases).map(report => [report.status, report.result, report.abilityApplied, report.returned])).toEqual([
      ['RESOLVED', 'ABILITY', true, true], ['RESOLVED', 'ORDINARY', false, true], ['RESOLVED', 'ORDINARY', false, true],
    ]);
    expect(life.cases['worn-bearing']).toMatchObject({ outcome: 'SUCCESS', recordsRead: true, baselineInspected: true, defectKnown: true, handsInspected: true, repairDone: true });
    expect(life.cases['taught-stop']).toMatchObject({ outcome: 'FAILURE', guidanceEnd: 'FAILED', learnerAttempted: true, learnerOutcome: 'FAILURE', ordinaryStepLearned: false });
    expect(life.cases['withdrawn-operation']).toMatchObject({ method: 'ORDINARY', permission: { ability: 'WITHDRAWN', teaching: 'DECLINED' }, abilityAttempted: false, outcome: null });
    expect(life.journal.filter(receipt => receipt.check).map(receipt => [receipt.command.type, receipt.checkBase, receipt.check!.roll, receipt.check!.chance, receipt.check!.tier, receipt.randomBefore, receipt.randomAfter])).toEqual([
      ['PROCESS_ANALYSIS', 32, 54, 78, 'SUCCESS', 309, 310], ['OPERATIONAL_GUIDANCE', 32, 92, 74, 'FAILURE', 310, 311], ['LEARNER_TRY', 12, 73, 34, 'FAILURE', 311, 312],
    ]);
    const taught = boundary('paid-one-ordinary-step-guidance'), learner = boundary('adult-independent-single-attempt');
    expect([taught.before.spirituality - taught.final.spirituality, taught.before.mind - taught.final.mind]).toEqual([8, 3]);
    expect(taught.final.civilizationEnlightener.life.practice.pendingGuidance).toBeNull();
    same(applySliceIntent(learner.before, learner.intent), learner.final);
    expect([learner.final.health, learner.final.mind, learner.final.spirituality]).toEqual([learner.before.health, learner.before.mind, learner.before.spirituality]);
    expect(life.practice).toMatchObject({ activeCase: null, ownerNode: 'NEAR', elapsedSeconds: 171, ownerWalkedMetres: 12, pendingGuidance: null,
      participant: { id: 'KM2-VERA', age: 39, present: false, node: 'NEAR', walkedMetres: 12 },
      parcel: { id: 'KM2-VERA-PARCEL', owner: 'KM2-VERA', holder: 'KM2-VERA', location: 'OWNER' },
      stopBar: { loadRunning: false }, handle: { demonstrations: 2, ordinaryStops: 4, learnerStops: 0 }, wrench: { holder: 'RACK', loans: 3, returns: 3 },
      abilityUses: { 'paragon.s1.process-analysis': { attempts: 1, successes: 1, applied: 1 }, 'paragon.s1.operational-guidance': { attempts: 1, successes: 0, applied: 0 } } });
    expect(CIVILIZATION_ENLIGHTENER_ABILITY_IDS.map(id => final.progression.mastery[id])).toEqual([8, 0]);
    for (const id of ['worn-bearing', 'taught-stop', 'withdrawn-operation']) {
      const exit = boundary(`${id}-actual-participant-exit`);
      expect(exit.intent).toEqual({ type: 'CIVILIZATION_ENLIGHTENER', command: { type: 'RETURN_HOME' } });
      expect(exit.before.civilizationEnlightener.life.practice.participant.present).toBe(true);
      expect(exit.final.civilizationEnlightener.life.practice.participant.present).toBe(false);
      expect(exit.final.civilizationEnlightener.life.journal.at(-1)).toMatchObject({ command: { type: 'RETURN_HOME' }, elapsedSeconds: 3, veraWalkedMetres: 2 });
      same(applySliceIntent(exit.before, exit.intent), exit.final);
    }
  });

  it('replays all four actual combat commands and preserves unavailable new abilities without mastery awards', () => {
    const final = captured('final'), rounds = final.combatHistory.filter(round => round.civilizationEnlightenerOutcome);
    expect(rounds.map(round => [round.round, round.stance, round.winner, round.consequenceDomain, round.retreat])).toEqual([
      [1, 'DEFEND', 'ENEMY', 'BODY', 'NONE'], [2, 'CONTROL', 'PLAYER', 'BODY', 'NONE'], [3, 'ATTACK', 'ENEMY', 'BODY', 'NONE'], [4, 'RETREAT', 'ENEMY', undefined, 'SUCCESS'],
    ]);
    expect(rounds.map(round => round.civilizationEnlightenerOutcome!.playerHealthAfter)).toEqual([90, 90, 60, 60]);
    const actions = rounds.flatMap(round => [...round.civilizationEnlightenerOutcome!.playerActions, ...round.civilizationEnlightenerOutcome!.enemyActions]);
    const attemptedAnalysis = actions.filter(action => action.planned === 'paragon.s1.process-analysis');
    expect(attemptedAnalysis).toHaveLength(3);
    for (const action of attemptedAnalysis) expect(action).toMatchObject({ selectedAbility: 'BLOCK', finiteResult: 'UNAVAILABLE', paidCost: 0, mindCost: 0, succeeded: false, masteryApplied: [] });
    expect(actions.flatMap(action => action.masteryApplied)).toEqual([]);
    expect(actions.filter(action => action.selectedAbility === 'MECHANICAL_PULSE').map(action => [action.paidCost, action.mechanismChargeSpent])).toEqual([[7, 1], [7, 1], [7, 1]]);
    for (const action of actions) {
      expect([action.boxChargeSpent, action.frameChargeSpent, action.frameDurabilityDamage]).toEqual([0, 0, 0]);
      expect(action.creationsAfter.map(item => item.charge)).toEqual([0, 0]);
    }
    for (let number = 1; number <= 4; number++) {
      const capture = boundary(`combat-round-${number}`);
      expect(capture.intent.type).toBe('COMBAT_ROUND');
      expect(projectSliceState(capture.before).combat?.civilizationEnlightener?.targetId).toBe('CE1-ADRIAN-HALE');
      same(applySliceIntent(capture.before, capture.intent), capture.final);
      same(capture.final.knowledgeMentor, capture.before.knowledgeMentor);
      same(capture.final.progression.mastery, capture.before.progression.mastery);
    }
  }, 30_000);

  it('keeps the two new wounds, real four-metre retreat and subsequent ordinary work without healing or rerolling', () => {
    const final = captured('final'), encounter = final.civilizationEnlightener.encounter;
    expect(final).toMatchObject({ status: 'ACTIVE', revision: 798, week: 188, date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 1, day: 27 },
      health: 60, mind: 98, spirituality: 120, cash: 436, actionsRemaining: 3, injuryRisk: 1, combat: null,
      random: { seed: 'savant-rebuild-first', cursor: 346 } });
    expect(final.injuries.map(injury => [injury.severity, injury.acquiredRevision, injury.treatedRevision])).toEqual([['LIGHT', 794, null], ['HEAVY', 796, null]]);
    expect(encounter).toMatchObject({ status: 'RETREATED', targetId: 'CE1-ADRIAN-HALE', policy: 'ALL', enemyStatus: 'RESISTING', enemyHealth: 90, enemyMind: 100, enemySpirituality: 83,
      analysisAttempts: 0, analysisSuccesses: 0, guidanceAttempts: 0, guidanceSuccesses: 0, totalOwnerMindSpent: 2,
      terminal: { outcome: 'RETREATED', round: 4, historyIndex: 27, exitMetres: 4, exitSeconds: 4 },
      scene: { playerLocation: 'WORKSHOP', playerCoordinate: 0, playerTravelMetres: 12, clockSeconds: 248, presentMemberIds: [], thirdPartiesInArea: 0 },
      materials: { weapon: { id: 'CE1-ADRIAN-ROD', owner: 'CE1-ADRIAN-HALE', location: 'HAND' }, mechanism: { charge: 1, capacity: 4 } } });
    const work = boundary('ordinary-life-after-exit');
    expect(work.intent).toEqual({ type: 'ACTION', action: 'WORK' }); expect(entry<SliceIntent[]>('commands').at(-1)).toEqual(work.intent);
    same(work.final, final); same(applySliceIntent(work.before, work.intent), final);
    expect(final.cash - work.before.cash).toBe(150); same(final.injuries, work.before.injuries); same(final.random, work.before.random);
    same(final.lastCombatRound, work.before.lastCombatRound); same(final.civilizationEnlightener, work.before.civilizationEnlightener);
    expect(projectSliceState(final).canAct).toBe(true); expect(projectSliceState(final).knowledgeMentor.actions).toEqual([]);
  });
});
