import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSliceRun, applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
import { SUMMONING_MASTER_ABILITY_IDS } from '../../src/domain/summoning-master/types.js';
import { SUMMONING_MASTER_CASE_IDS } from '../../src/domain/summoning-master/life.js';

interface Capture {
  creation: Parameters<typeof createSliceRun>[1]; seed: string; prefixCount: number; commands: SliceIntent[];
  departureStart: SliceState; guidanceStart: SliceState; promoted: SliceState; practiced: SliceState;
  combatStart: SliceState; beforeLast: SliceState; final: SliceState;
}
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
const old = (): Capture => JSON.parse(readFileSync('tests/fixtures/witch-king-v01210/natural.json', 'utf8'));
function read(): Capture {
  const data: Capture = JSON.parse(readFileSync('tests/fixtures/summoning-master-v01440/natural.json', 'utf8'));
  for (const key of ['departureStart', 'guidanceStart', 'promoted', 'practiced', 'combatStart', 'beforeLast', 'final'] as const) if (data[key]) data[key] = migrateSliceState(data[key]);
  return data;
}
const originalRoots = ['apothecary', 'tamer', 'vampire', 'potionProfessor', 'crimsonScholar'] as const;
function expectOldRecords(state: SliceState, prior: SliceState) {
  for (const key of originalRoots) expect(state[key]).toEqual(prior[key]);
  const original = structuredClone(prior.witchKing), current = structuredClone(state.witchKing);
  expect(current.life.papers).toHaveLength(original.life.papers.length);
  for (const paper of current.life.papers) {
    const previous = original.life.papers.find(entry => entry.id === paper.id)!;
    expect(previous).toBeTruthy();
    if (paper.status !== previous.status) {
      expect(previous.status).toBe('PREPARED'); expect(paper.status).toBe('CONSUMED'); expect(paper.consumedBy).toBe('COMBAT');
      const round = state.combatHistory.find(entry => entry.round === paper.combatRound && entry.summoningMasterOutcome?.papersConsumed.includes(paper.id));
      expect(round?.summoningMasterOutcome?.source.week).toBe(paper.consumedWeek);
      for (const key of ['status', 'consumedWeek', 'consumedBy', 'combatRound'] as const) Object.assign(paper, { [key]: previous[key] });
    }
  }
  expect(current).toEqual(original);
  expect(state.character.gender).toBe(prior.character.gender); expect(state.random.seed).toBe(prior.random.seed); expect(state.runId).toBe(prior.runId);
}

describe('Summoning Master original public route and shared runtime', () => {
  it('replays all349 original commands and every new choice using the unchanged original seed', () => {
    const data = read(), prior = old();
    expect(prior.commands).toHaveLength(349); expect(data.prefixCount).toBe(349);
    expect(data.commands.slice(0, data.prefixCount)).toEqual(prior.commands); expect(data.seed).toBe(prior.seed);
    let state = createSliceRun(data.final.runId, data.creation, data.seed);
    for (const [index, command] of data.commands.entries()) {
      state = applySliceIntent(state, command);
      if (index + 1 === data.prefixCount) expect(state).toEqual(data.departureStart);
    }
    assertValidSliceState(state); expect(state).toEqual(data.final);
  }, 30_000);

  it('migrates the genuineW92 state tocurrent schema165 without changing the female body, injured Dorian or original stock', () => {
    const prior = old(), bytes = JSON.stringify(prior.final), state = migrateSliceState(prior.final);
    expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION); expect(state.contentVersion).toBe(CURRENT_CONTENT_VERSION);
    expect(state.summoningMaster.promotionWeek).toBeNull(); expect(state.summoningMaster.witchKingActingAtPromotion).toBeNull();
    for (const key of Object.keys(prior.final)) if (!['schemaVersion', 'contentVersion'].includes(key)) {
      expect((state as unknown as Record<string, unknown>)[key]).toEqual((prior.final as unknown as Record<string, unknown>)[key]);
    }
    expect(state).toMatchObject({ week: 92, health: 100, mind: 100, spirituality: 102, cash: 664, actionsRemaining: 3, character: { gender: 'FEMALE' } });
    expect(state.witchKing.promotionWeek).toBe(83);
    expect(state.witchKing.encounter.enemy).toMatchObject({ id: 'WK4-DORIAN', health: 70, status: 'SURRENDERED', weaponLocation: 'YARD' });
    expect(state.witchKing.life.papers.map(paper => paper.status)).toEqual(['CONSUMED', 'PREPARED', 'HELD']);
    expect(state.witchKing.life.target.status).toBe('BROKEN');
    expect(state.summoningMaster.life.partner).toMatchObject({ id: 'SM3-LUMEN', bodyId: 'SM3-LUMEN-BODY', location: 'HOME', metWeek: null });
    expect(JSON.stringify(prior.final)).toBe(bytes); assertValidSliceState(state);
  });

  it('retains all original mastery and exposes the inherited pool after independentS3 promotion', () => {
    const state = read().promoted, prior = old().final; assertValidSliceState(state);
    expect(state.progression.sequence).toBe(3); expect(state.summoningMaster.witchKingActingAtPromotion).toBe(100);
    expect(state.summoningMaster.promotionWeek! - state.witchKing.promotionWeek!).toBeGreaterThanOrEqual(12);
    expectOldRecords(state, prior); expect(state.witchKing).toEqual(prior.witchKing); expect(state.injuries).toEqual(prior.injuries);
    for (const [id, mastery] of Object.entries(prior.progression.mastery)) expect(state.progression.mastery[id]).toBe(mastery);
    expect(Object.keys(state.progression.mastery).filter(id => !Object.hasOwn(prior.progression.mastery, id))).toEqual([...SUMMONING_MASTER_ABILITY_IDS]);
    expect(SUMMONING_MASTER_ABILITY_IDS.map(id => state.progression.mastery[id])).toEqual([0, 0]);
    const visible = projectSliceState(state);
    expect(visible.witchKing.acting).toBe(100);
    expect(visible.summoningMaster.abilities.map(ability => ability.id).sort()).toEqual(Object.keys(state.progression.mastery).sort());
    expect(visible.summoningMaster).toMatchObject({ promoted: true, formulaKnown: false, formula: [], currentGender: 'FEMALE' });
    expect(state.summoningMaster.life.partner).toMatchObject({ id: 'SM3-LUMEN', metWeek: null, location: 'HOME', health: 100, mind: 100, stamina: 100 });
    expect(state.summoningMaster.encounter).toMatchObject({ status: 'AVAILABLE', guestPolicy: 'HOME', guestPermit: null });
  });

  it('replays every actual saved boundary without mutating its original input', () => {
    const boundaries = JSON.parse(readFileSync('tests/fixtures/summoning-master-v01440/boundaries.json', 'utf8')) as Record<string, Boundary>;
    for (const name of ['guidance', 'potion-work-5', 'buy-independent-potion', 'prepare-current-week', 'promotion', 'source-visit-ability-outcome', 'original-token-ability-outcome', 'original-token-returned', 'interrupted-door-opened', 'interrupted-door-cut', 'reflection', 'combat-first', 'combat-terminal']) expect(boundaries[name]).toBeTruthy();
    for (const captured of Object.values(boundaries)) {
      const state = migrateSliceState(captured.beforeLast), expected = migrateSliceState(captured.final);
      assertValidSliceState(state); assertValidSliceState(expected);
      const stateBytes = JSON.stringify(state), intentBytes = JSON.stringify(captured.lastIntent);
      expect(applySliceIntent(state, captured.lastIntent)).toEqual(expected);
      expect(JSON.stringify(state)).toBe(stateBytes); expect(JSON.stringify(captured.lastIntent)).toBe(intentBytes);
    }
  }, 30_000);

  it('completes three distinct practices with the same original partner and returns the same token before reflection100', () => {
    const data = read(), state = data.practiced, prior = old().final; assertValidSliceState(state);
    expect(state.progression).toMatchObject({ pathwayId: 'moon', sequence: 3, acting: 100 });
    const life = state.summoningMaster.life;
    expect(Object.keys(life.cases)).toEqual([...SUMMONING_MASTER_CASE_IDS]);
    expect(Object.values(life.cases).every(scene => scene.status === 'RESOLVED' && scene.returned && !scene.contactOpen && scene.attempts.every(attempt => attempt.closed))).toBe(true);
    expect(life.activeCase).toBeNull(); expect(life.playerLocation).toBe('YARD'); expect(life.gate.status).not.toBe('OPEN'); expect(life.reflected).toBe(true);
    expect(life.token).toEqual({ id: 'SM3-TEST-TOKEN', owner: 'SM3-ADA39', massGrams: 200, custodian: 'SM3-ADA39', location: 'OWNER' });
    expect(life.partner).toMatchObject({ id: 'SM3-LUMEN', bodyId: 'SM3-LUMEN-BODY', homeId: 'SM3-GLASS-ROOM', adult: true, independentMind: true, status: 'ALIVE', location: 'HOME', chime: { id: 'SM3-CHIME', owner: 'SM3-LUMEN' } });
    expect(life.partner.metWeek).not.toBeNull(); expect(life.partner.source).toBe(data.promoted.summoningMaster.life.partner.source);
    expect(life.partner.ordinaryDistanceM).toBeGreaterThanOrEqual(30);
    expect(life.cases['source-visit'].attempts.at(-1)).toMatchObject({ identityChecked: true, guestReturned: true });
    expect(life.cases['original-token'].attempts.at(-1)).toMatchObject({ tokenTaken: true, tokenDelivered: true, tokenReturned: true, guestReturned: true });
    expect(life.cases['interrupted-door'].attempts.at(-1)).toMatchObject({ interruptionObserved: true, guestReturned: true });
    expectOldRecords(state, prior); expect(state.witchKing).toEqual(prior.witchKing);
  });

  it('retains real failed gate and cooperation attempts even when ordinary fallback completed the case', () => {
    const state = read().practiced;
    for (const [id, scene] of Object.entries(state.summoningMaster.life.cases)) {
      for (const attempt of scene.attempts) {
        expect(attempt.spiritualitySpent).toBe((attempt.gateTier === null ? 0 : 6) + (attempt.cooperationTier === null ? 0 : 3));
        if (attempt.gateTier === 'FAILURE' || attempt.gateTier === 'GREAT_FAILURE') expect(attempt.arrivalMethod).not.toBe('GATE');
        if (id === 'original-token' && (attempt.cooperationTier === 'FAILURE' || attempt.cooperationTier === 'GREAT_FAILURE')) {
          expect(attempt.result).toBe('ORDINARY'); expect(attempt.tokenDelivered).toBe(true);
        }
        if (id === 'interrupted-door') {
          expect(attempt.guestTravelMetres).toBeGreaterThanOrEqual(30);
          if (attempt.gateTier === 'FAILURE' || attempt.gateTier === 'GREAT_FAILURE') expect(attempt.gateInterrupted).toBe(false);
        }
      }
    }
  });

  it('uses one real partner per round and subtracts actual independent enemy spirituality through the captured terminal branch', () => {
    const data = read(), state = data.final, prior = old().final; assertValidSliceState(state);
    expect(state.combat).toBeNull(); expect(state.summoningMaster.encounter.terminal).not.toBeNull();
    const encounter = state.summoningMaster.encounter;
    expect(encounter.targetId).toBe('SM3-EDWIN'); expect(encounter.enemySpirituality).toBe(120 - encounter.powerUses.DARK_BOLT * 5 - encounter.powerUses.WARD * 4 - encounter.powerUses.DISRUPT * 4);
    const rounds = state.combatHistory.filter(round => round.summoningMasterOutcome);
    expect(rounds.length).toBeGreaterThan(0);
    let enemyPaid = 0;
    for (const round of rounds) {
      const outcome = round.summoningMasterOutcome!;
      expect(outcome.targetId).toBe('SM3-EDWIN'); expect(outcome.source.partner).toMatchObject({ id: 'SM3-LUMEN', bodyId: 'SM3-LUMEN-BODY' });
      expect(outcome.partnerAfter).toMatchObject({ id: 'SM3-LUMEN', bodyId: 'SM3-LUMEN-BODY', chime: { id: 'SM3-CHIME', owner: 'SM3-LUMEN' } });
      expect(outcome.partnerAfter.location).toBe(outcome.partnerAfter.status === 'DEAD' ? 'YARD' : 'HOME');
      expect(outcome.partnerAfter.health).toBeLessThanOrEqual(outcome.source.partner.health);
      expect(outcome.gateOpenAfter).toBe(false); expect(outcome.ordinaryReturnMetres).toBeGreaterThanOrEqual(0);
      expect([0, 30]).toContain(outcome.ordinaryReturnMetres);
      enemyPaid += outcome.enemyActions.reduce((total, action) => total + action.paidCost, 0);
      expect(outcome.enemySpirituality).toBe(120 - enemyPaid);
      for (const paperId of outcome.papersConsumed) {
        const paper = state.witchKing.life.papers.find(entry => entry.id === paperId)!;
        expect(paper).toMatchObject({ status: 'CONSUMED', consumedBy: 'COMBAT', consumedWeek: outcome.source.week, combatRound: round.round });
      }
    }
    expect(state.summoningMaster.life.partner).toEqual(rounds.at(-1)!.summoningMasterOutcome!.partnerAfter);
    expect(encounter.enemySpirituality).toBe(120 - enemyPaid); expectOldRecords(state, prior);
    expect(state.witchKing.encounter.enemy).toMatchObject({ id: 'WK4-DORIAN', health: 70, status: 'SURRENDERED', weaponLocation: 'YARD' });
    if (state.status === 'DEAD') { expect(state.health).toBe(0); expect(state.ending?.kind).toBe('DEATH'); }
    else { expect(state.health).toBeGreaterThan(0); expect(projectSliceState(state).summoningMaster.insideCase).toBe(false); }
  });

  it('cannot reopen oldS4 acquisition afterS3 and preserves rejected public input', () => {
    const state = read().promoted, bytes = JSON.stringify(state);
    expect(() => applySliceIntent(state, { type: 'WITCH_KING', command: { type: 'LEARN_GUIDANCE' } })).toThrow();
    expect(JSON.stringify(state)).toBe(bytes);
    expect(projectSliceState(state).witchKing.actions.filter(action => ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(action.command.type))).toEqual([]);
  });
});
