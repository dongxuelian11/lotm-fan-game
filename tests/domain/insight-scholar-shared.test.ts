import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSliceRun, applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
import { INSIGHT_SCHOLAR_ABILITY_IDS } from '../../src/domain/insight-scholar/types.js';
import { INSIGHT_SCHOLAR_CASE_IDS, createInsightScholarLifeState } from '../../src/domain/insight-scholar/life.js';

interface Capture {
  creation: Parameters<typeof createSliceRun>[1]; seed: string; prefixCount: number; commands: SliceIntent[];
  departureStart: SliceState; guidanceStart: SliceState; promoted: SliceState; practiced: SliceState;
  combatStart: SliceState; beforeLast: SliceState; final: SliceState;
}
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
const old = (): Capture => JSON.parse(readFileSync('tests/fixtures/prophet-v01230/natural.json', 'utf8'));
function read(): Capture {
  const data: Capture = JSON.parse(readFileSync('tests/fixtures/insight-scholar-v01460/natural.json', 'utf8'));
  for (const key of ['departureStart', 'guidanceStart', 'promoted', 'practiced', 'combatStart', 'beforeLast', 'final'] as const) if (data[key]) data[key] = migrateSliceState(data[key]);
  return data;
}
const originalRoots = ['reader', 'reasoner', 'detective', 'polymath', 'prophet'] as const;
function expectOldRecords(state: SliceState, prior: SliceState) {
  for (const key of originalRoots) expect(state[key]).toEqual(prior[key]);
  const original = structuredClone(prior.mysticismMagister), current = structuredClone(state.mysticismMagister);
  expect(current.crafts).toHaveLength(original.crafts.length);
  const consumed = state.combatHistory.slice(prior.combatHistory.length).flatMap(round => round.insightScholarOutcome?.consumedCraftIds ?? []);
  expect(new Set(consumed).size).toBe(consumed.length);
  for (const [index, craft] of current.crafts.entries()) {
    const before = original.crafts[index]!;
    if (consumed.includes(craft.id)) {
      expect(before.status).toBe('PLAYER'); expect(before.usedWeek).toBeNull();
      expect(craft.status).toBe('CONSUMED'); expect(craft.usedWeek).toBeGreaterThanOrEqual(prior.week);
      craft.status = before.status; craft.usedWeek = before.usedWeek;
    }
    expect(craft).toEqual(before);
  }
  expect(current).toEqual(original);
  expect(state.character.gender).toBe(prior.character.gender); expect(state.random.seed).toBe(prior.random.seed); expect(state.runId).toBe(prior.runId);
}

describe('Insight Scholar candidate original public route and shared runtime', () => {
  it('replays all329 original commands and every new choice using the unchanged original seed', () => {
    const data = read(), prior = old();
    expect(prior.commands).toHaveLength(329); expect(data.prefixCount).toBe(329); expect(data.commands).toHaveLength(425); expect(data.seed).toBe('reader-natural-v023');
    expect(data.commands.slice(0, data.prefixCount)).toEqual(prior.commands); expect(data.seed).toBe(prior.seed);
    let state = createSliceRun(data.final.runId, data.creation, data.seed);
    for (const [index, command] of data.commands.entries()) {
      state = applySliceIntent(state, command);
      if (index + 1 === data.prefixCount) expect(state).toEqual(data.departureStart);
    }
    assertValidSliceState(state); expect(state).toEqual(data.final);
  }, 30_000);

  it('migrates the genuineW88 state to144 without changing Harold, original objects or the original learned samples', () => {
    const prior = old(), bytes = JSON.stringify(prior.final), state = migrateSliceState(prior.final);
    expect(state.schemaVersion).toBe(176); expect(state.contentVersion).toBe('elder-v176');
    expect(state.insightScholar.promotionWeek).toBeNull(); expect(state.insightScholar.prophetActingAtPromotion).toBeNull();
    for (const key of Object.keys(prior.final)) if (!['schemaVersion', 'contentVersion'].includes(key)) {
      expect((state as unknown as Record<string, unknown>)[key]).toEqual((prior.final as unknown as Record<string, unknown>)[key]);
    }
    expect(state).toMatchObject({ week: 88, health: 100, mind: 100, spirituality: 114, cash: 1360, actionsRemaining: 1, character: { age: 26, gender: 'FEMALE', coreStats: { physique: 26, perception: 27, will: 25, knowledge: 28 } } });
    expect(state.prophet.promotionWeek).toBe(78);
    expect(state.prophet.encounter.enemy).toMatchObject({ id: 'PF4-HAROLD', health: 70, mind: 100, status: 'SURRENDERED', weaponLocation: 'YARD' });
    expect(state.mysticismMagister.crafts[1]).toMatchObject({ id: 'MM5-FLASH-3', sourceKitId: 'MM5-KIT-3', createdWeek: 63, status: 'PLAYER', usedWeek: null, power: 0.65 });
    expect(state.insightScholar.life).toEqual(createInsightScholarLifeState());
    expect(JSON.stringify(prior.final)).toBe(bytes); assertValidSliceState(state);
  });

  it('retains all original mastery and exposes the inherited pool after independent candidateS3 promotion', () => {
    const state = read().promoted, prior = old().final; assertValidSliceState(state);
    expect(state.progression.sequence).toBe(3); expect(state.insightScholar.prophetActingAtPromotion).toBe(100);
    expect(state.insightScholar.promotionWeek).toBe(99); expect(state.insightScholar.promotionWeek! - state.prophet.promotionWeek!).toBeGreaterThanOrEqual(12);
    expect(state.insightScholar.bottles.slice(0, 2)).toMatchObject([{ id: 'insight-scholar-potion-1', status: 'CONSUMED', outcome: 'FAILURE', consumedWeek: 92, preparationWeek: 92 }, { id: 'insight-scholar-potion-2', status: 'CONSUMED', outcome: 'SUCCESS', consumedWeek: 99, preparationWeek: 99 }]);
    expectOldRecords(state, prior); expect(state.mysticismMagister).toEqual(prior.mysticismMagister); expect(state.injuries).toEqual(prior.injuries);
    for (const [id, mastery] of Object.entries(prior.progression.mastery)) expect(state.progression.mastery[id]).toBe(mastery);
    expect(Object.keys(state.progression.mastery).filter(id => !Object.hasOwn(prior.progression.mastery, id))).toEqual([...INSIGHT_SCHOLAR_ABILITY_IDS]);
    expect(INSIGHT_SCHOLAR_ABILITY_IDS.map(id => state.progression.mastery[id])).toEqual([0, 0]);
    const visible = projectSliceState(state);
    expect(visible.prophet.acting).toBe(100);
    expect(visible.insightScholar.abilities.map(ability => ability.id).sort()).toEqual(Object.keys(state.progression.mastery).sort());
    expect(visible.insightScholar).toMatchObject({ title: '洞悉者·阅读者序列3', promoted: true, formulaKnown: false, formula: [], currentGender: 'FEMALE' });
    expect(state.insightScholar.life).toEqual(createInsightScholarLifeState());
    expect(state.insightScholar.encounter).toMatchObject({ status: 'AVAILABLE', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, targetId: 'IS3-ALTON' });
    const successful = state.insightScholar.bottles.filter(bottle => ['SUCCESS', 'GREAT_SUCCESS'].includes(bottle.outcome ?? ''));
    expect(successful).toHaveLength(1);
    for (const bottle of state.insightScholar.bottles.filter(bottle => bottle.status === 'CONSUMED')) {
      expect(bottle.consumedWeek).toBe(bottle.preparationWeek); expect(bottle.acquiredWeek).not.toBeNull();
      expect(bottle.id).toMatch(/^insight-scholar-potion-/);
    }
  });

  it('replays every actual saved boundary without mutating its original input', () => {
    const boundaries = JSON.parse(readFileSync('tests/fixtures/insight-scholar-v01460/boundaries.json', 'utf8')) as Record<string, Boundary>;
    for (const name of ['guidance', 'potion-work-5', 'buy-independent-potion', 'prepare-current-week', 'consume-failure', 'promotion', 'copy-discrepancy-ability-outcome', 'copy-discrepancy-returned', 'known-method-ability-outcome', 'known-method-second-demo', 'revised-route-ability-outcome', 'revised-route-returned', 'reflection', 'combat-first', 'combat-terminal', 'peaceful-leave', 'peaceful-ordinary-life']) expect(boundaries[name]).toBeTruthy();
    for (const captured of Object.values(boundaries)) {
      const state = migrateSliceState(captured.beforeLast), expected = migrateSliceState(captured.final);
      assertValidSliceState(state); assertValidSliceState(expected);
      const stateBytes = JSON.stringify(state), intentBytes = JSON.stringify(captured.lastIntent);
      expect(applySliceIntent(state, captured.lastIntent)).toEqual(expected);
      expect(JSON.stringify(state)).toBe(stateBytes); expect(JSON.stringify(captured.lastIntent)).toBe(intentBytes);
    }
  }, 30_000);

  it('finishes finite evidence work with the same original papers, depleted box and unbroken barrier before reflection100', () => {
    const state = read().practiced, prior = old().final; assertValidSliceState(state);
    expect(state.progression).toMatchObject({ pathwayId: 'white-tower', sequence: 3, acting: 100 });
    const life = state.insightScholar.life;
    expect(Object.keys(life.cases)).toEqual([...INSIGHT_SCHOLAR_CASE_IDS]);
    expect(Object.values(life.cases).every(scene => scene.status === 'RESOLVED' && scene.returned && !scene.contactOpen && scene.attempts.every(attempt => attempt.closed))).toBe(true);
    expect(life.activeCase).toBeNull(); expect(life.playerLocation).toBe('EXIT'); expect(life.reflected).toBe(true);
    expect(life.original).toEqual({ id: 'IS3-ORIGINAL', owner: 'IS3-FENNA', location: 'DESK' });
    expect(life.copy).toEqual({ id: 'IS3-COPY', owner: 'IS3-FENNA', location: 'DESK' });
    expect(life.box).toMatchObject({ id: 'IS3-BOX', owner: 'IS3-FENNA', location: 'OWNER', charges: 0, output: 'DARK', selector: 'DARK', demonstrations: 2 });
    expect(life.barrier).toEqual({ id: 'IS3-BARRIER', location: 'JUNCTION', state: 'CLOSED' });
    expect(life.parcel).toEqual({ id: 'IS3-PARCEL', owner: 'IS3-FENNA', location: 'OWNER' });
    expect(life.routeRecord).toEqual({ id: 'IS3-ROUTE', owner: 'IS3-FENNA', location: 'DESK' });
    expect(life.cases['copy-discrepancy'].attempts.at(-1)).toMatchObject({ readBoth: true, hypothesis: 'COPY_ERROR', ownerEvidenceRead: true, verified: true, papersReturned: true, inspected: true });
    expect(life.cases['known-method'].attempts.at(-1)).toMatchObject({ recordRead: true, firstDemoSeen: true, secondDemoSeen: true, observedResult: true, revised: true, boxReturned: true });
    expect(life.cases['revised-route'].attempts.at(-1)).toMatchObject({ oldRouteRead: true, scouted: true, route: 'SIDE', parcelTaken: true, parcelReturned: true, inspected: true });
    expect(life.playerTravelMetres).toBe(34); expect(life.clockSeconds).toBe(96); expect(state.week).toBe(104);
    expect(life.cases['copy-discrepancy'].attempts.at(-1)).toMatchObject({ abilityTier: 'FAILURE', result: 'ORDINARY', manualCompared: true, hypothesisHistory: ['MISSING_DELIVERY', 'COPY_ERROR'], playerTravelMetres: 8, elapsedSeconds: 32 });
    expect(life.cases['known-method'].attempts.at(-1)).toMatchObject({ abilityTier: 'GREAT_FAILURE', result: 'ORDINARY', prediction: 'LIT', revised: true, playerTravelMetres: 6, elapsedSeconds: 28 });
    expect(life.cases['revised-route'].attempts.at(-1)).toMatchObject({ abilityTier: 'SUCCESS', result: 'ABILITY', routeHistory: ['SHORT', 'SIDE'], shortBlocked: true, playerTravelMetres: 20, elapsedSeconds: 36 });
    expectOldRecords(state, prior); expect(state.mysticismMagister).toEqual(prior.mysticismMagister);
  });

  it('preserves actual one-shot ability costs and rejected hypotheses instead of rewriting results', () => {
    const state = read().practiced, life = state.insightScholar.life;
    for (const [id, scene] of Object.entries(life.cases)) {
      expect(scene.attempts.filter(attempt => attempt.abilityTier !== null)).toHaveLength(1);
      for (const attempt of scene.attempts) {
        expect(attempt.spiritualitySpent).toBe(attempt.abilityTier === null ? 0 : id === 'known-method' ? 5 : 6);
        if (attempt.abilityTier === 'FAILURE' || attempt.abilityTier === 'GREAT_FAILURE') expect(attempt.result).toBe('ORDINARY');
        if (id === 'copy-discrepancy') { expect(attempt.ownerEvidenceRead).toBe(true); expect(attempt.hypothesisHistory.at(-1)).toBe('COPY_ERROR'); }
        if (id === 'known-method') { expect(attempt.demonstrationsPerformed).toBe(2); expect(attempt.revised).toBe(true); }
        if (id === 'revised-route') { expect(attempt.routeHistory.at(-1)).toBe('SIDE'); expect(attempt.playerTravelMetres).toBeGreaterThanOrEqual(16); }
      }
    }
    expect(life.fenna).toMatchObject({ id: 'IS3-FENNA', age: 42, alive: true, location: 'EXIT' });
    expect(life.osric).toMatchObject({ id: 'IS3-OSRIC', age: 51, alive: true, location: 'BENCH', present: true });
  });

  it('keeps independent enemy resources, genuinely observed powers and original craft consumption through the actual terminal branch', () => {
    const state = read().final, prior = old().final; assertValidSliceState(state);
    expect(state.combat).toBeNull(); expect(state.insightScholar.encounter.terminal).not.toBeNull();
    expect(state).toMatchObject({ week: 106, status: 'DEAD', health: 0, mind: 100, spirituality: 111 });
    expect(state.insightScholar.encounter).toMatchObject({ status: 'LOST', enemyHealth: 100, enemyMind: 100, enemySpirituality: 102, enemyStatus: 'RESISTING', weaponLocation: 'HAND', terminal: { outcome: 'PLAYER_DEAD', round: 3 } });
    const encounter = state.insightScholar.encounter;
    expect(encounter.targetId).toBe('IS3-ALTON');
    expect(encounter.enemySpirituality).toBe(120 - encounter.powerUses.FLASH * 5 - encounter.powerUses.WARD * 4 - encounter.powerUses.FOCUS * 4);
    const rounds = state.combatHistory.filter(round => round.insightScholarOutcome);
    expect(rounds.length).toBeGreaterThan(0);
    let enemyPaid = 0, previousCrafts = prior.mysticismMagister.crafts;
    for (const round of rounds) {
      const outcome = round.insightScholarOutcome!;
      expect(outcome.source.crafts).toEqual(previousCrafts);
      expect(outcome.source).toMatchObject({ targetId: 'IS3-ALTON', enemyWeapon: 'IS3-ALTON-CLUB', ordinaryExit: true, pursuit: false, distanceMetres: 2 });
      expect(outcome.source.flashSample).toEqual(prior.polymath.samples.FLASH);
      enemyPaid += outcome.enemyActions.reduce((total, action) => total + action.paidCost, 0);
      expect(outcome.enemySpirituality).toBe(120 - enemyPaid);
      for (const action of outcome.playerActions.filter(action => action.id === 'reader.s3.method-analysis' && action.paidCost > 0)) {
        expect(action.paidCost).toBe(5); expect(action.observedPower).not.toBeNull();
        const seenBefore = outcome.source.seenPowers.includes(action.observedPower!);
        const seenInRound = outcome.enemyActions.some(enemy => enemy.order < action.order && enemy.actual === action.observedPower && enemy.paidCost > 0);
        expect(seenBefore || seenInRound).toBe(true);
      }
      for (const id of outcome.consumedCraftIds) expect(outcome.source.crafts.find(craft => craft.id === id)).toMatchObject({ status: 'PLAYER', usedWeek: null });
      previousCrafts = outcome.craftsAfter;
    }
    expect(encounter.enemySpirituality).toBe(120 - enemyPaid);
    expect(state.mysticismMagister.crafts).toEqual(previousCrafts); expectOldRecords(state, prior);
    expect(state.prophet.encounter.enemy).toMatchObject({ id: 'PF4-HAROLD', health: 70, mind: 100, status: 'SURRENDERED', weaponId: 'PF4-HAROLD-CLUB', weaponLocation: 'YARD' });
    if (state.status === 'DEAD') { expect(state.health).toBe(0); expect(state.ending?.kind).toBe('DEATH'); }
    else { expect(state.health).toBeGreaterThan(0); expect(projectSliceState(state).insightScholar.insideCase).toBe(false); }
  });

  it('cannot reopen oldS4 acquisition afterS3 and preserves rejected public input', () => {
    const state = read().promoted, bytes = JSON.stringify(state);
    expect(() => applySliceIntent(state, { type: 'PROPHET', command: { type: 'LEARN_GUIDANCE' } })).toThrow();
    expect(JSON.stringify(state)).toBe(bytes);
    expect(projectSliceState(state).prophet.actions).toEqual([]);
  });
  it('independently replays the same421-command prefix then peacefully leaves and works without reopening the dead branch', () => {
    const capture = JSON.parse(readFileSync('tests/fixtures/insight-scholar-v01460/peaceful.json', 'utf8')) as Pick<Capture, 'creation' | 'seed' | 'commands' | 'prefixCount' | 'departureStart' | 'final'> & { sharedPublicPrefix: number; branch: string };
    const death = read(), prior = old();
    expect(capture.sharedPublicPrefix).toBe(421); expect(capture.commands).toHaveLength(423); expect(capture.prefixCount).toBe(329);
    expect(capture.branch).toBe('BEFORE_OPTIONAL_FIGHT'); expect(capture.seed).toBe(prior.seed);
    expect(capture.commands.slice(0, 329)).toEqual(prior.commands);
    expect(capture.commands.slice(0, 421)).toEqual(death.commands.slice(0, 421));
    expect(death.commands[421]).toEqual({ type: 'INSIGHT_SCHOLAR', command: { type: 'ENCOUNTER_FIGHT' } });
    expect(capture.commands.slice(421)).toEqual([{ type: 'INSIGHT_SCHOLAR', command: { type: 'LEAVE_ENCOUNTER' } }, { type: 'ACTION', action: 'WORK' }]);
    let state = createSliceRun(capture.final.runId, capture.creation, capture.seed);
    for (const command of capture.commands) state = applySliceIntent(state, command);
    assertValidSliceState(state); expect(state).toEqual(migrateSliceState(capture.final));
    expect(state).toMatchObject({ week: 106, status: 'ACTIVE', health: 100, mind: 100, spirituality: 120, cash: 640, actionsRemaining: 1, ending: null, combat: null });
    expect(state.insightScholar.encounter).toMatchObject({ status: 'RESOLVED', attemptWeek: null, startHistoryIndex: null, terminal: null, enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', powerUses: { FLASH: 0, WARD: 0, FOCUS: 0 }, seenPowers: [] });
    expect(state.combatHistory).toEqual(prior.final.combatHistory); expect(state.mysticismMagister).toEqual(prior.final.mysticismMagister); expectOldRecords(state, prior.final);
    expect(projectSliceState(state).insightScholar.insideCase).toBe(false);
    expect(death.final).toMatchObject({ status: 'DEAD', health: 0, ending: { kind: 'DEATH' } });
  }, 30_000);
});
