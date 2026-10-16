import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { combatBody, createAttendantMysteriesEncounterState, createAttendantMysteriesRemnant, createAttendantMysteriesScene,
  validateAttendantMysteriesPreparation, validateAttendantMysteriesEncounterCommand, validAttendantMysteriesRemnant, leaveAttendantMysteriesCombatScene, attendantMysteriesTerminalBudgetMatches,
  type AttendantMysteriesPreparation } from '../../src/domain/attendant-mysteries/encounter.js';
import { AIR_BULLET, BALANCE, BODY, BODY_CONTROL, BOUNDED_GRAFTING, ILLUSION, MYSTERIOUS_REALM, PAST_SELF, PROBABILITY, THREAD_REGENERATION,
  ATTENDANT_MYSTERIES_COUNT_WHEEL, ATTENDANT_MYSTERIES_ENEMY_ABILITY_WHEEL, advanceAttendantMysteriesCombatClock, attendantMysteriesAbilityWheel,
  createAttendantMysteriesRuntime, nextAttendantMysteriesCombatSource, replayAttendantMysteriesCombatRound, resolveAttendantMysteriesEnemySlot, resolveAttendantMysteriesPlayerSlot,
  validAttendantMysteriesCombatSource, validateAttendantMysteriesCombatRound, validateAttendantMysteriesRoundOutcome, type AttendantMysteriesCombatSource } from '../../src/domain/attendant-mysteries/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';

/** Explicit unit-only fixture. It does not modify a natural old history prefix. */
function source(): AttendantMysteriesCombatSource {
  const runId = 'attendant-mysteries-declared-unit', date = { epoch: 'FIFTH_EPOCH' as const, year: 1349, month: 6, day: 28 };
  const mastery = Object.fromEntries([AIR_BULLET, BALANCE, BODY_CONTROL, ILLUSION, PAST_SELF, PROBABILITY, THREAD_REGENERATION, BOUNDED_GRAFTING, MYSTERIOUS_REALM].map(id => [id, 0]));
  const before = { cash: 1000, actions: 100, health: 100, mind: 100, spirituality: 120, pollution: 0, gender: 'MALE', sequence: 1 as const, acting: 100,
    coreStats: { physique: 10, perception: 20, will: 30, knowledge: 40 }, mastery, completedSources: [], injuries: [], injuryRisk: 0 };
  const preparation: AttendantMysteriesPreparation = { week: 1, date, revision: 2, runId, randomSeed: runId, randomCursor: 0, pricePaid: 30, actionsPaid: 1, lifeReflected: true,
    before, after: { ...before, cash: 970, actions: 99 }, finance: { weeklyBudget: 100, lifeTier: 'DESTITUTE', nextLifeTier: 'DESTITUTE', debts: [], missedWeeks: 0, credit: 'NORMAL' },
    pastSample: null, pastSampleObservedWeek: null };
  const root = createAttendantMysteriesScene(); Object.assign(root, { playerLocation: 'CLEARING', playerCoordinate: 12, observedSourceId: `${runId}:AM1-CLEARING:3`, observationWeek: 1, clockSeconds: 12, externalSeconds: 12, playerTravelMetres: 12 });
  const remnant = createAttendantMysteriesRemnant(); Object.assign(remnant, { owner: 'PLAYER', holder: 'PLAYER', location: 'CLEARING', acquiredWeek: 1, pricePaid: 30, lostThreadsEvidence: `${runId}:AM1-LOST-THREADS:2` });
  return { runId, revision: 4, week: 1, date, round: 1, encounterId: 'ATTENDANT_MYSTERIES_DISPUTE', targetId: 'AM1-ELIAS-VALE', attemptWeek: 1, startHistoryIndex: 0,
    targetName: '埃利亚斯·维尔', targetAge: 47, targetPathway: 'original-caster', targetSequence: 2, targetCore: 22, targetPerception: 28,
    actualBody: true, independentMind: true, playerBodyId: `${runId}:body`, enemyWeapon: 'AM1-ELIAS-ROD', weaponOwner: 'AM1-ELIAS-VALE', ordinaryExit: 'OPEN', pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false, freeSkillLibrary: false,
    playerHealth: 100, playerMind: 100, playerSpirituality: 120, playerInjuries: [], playerRisk: 0, ...before.coreStats, mastery: { ...mastery }, preparation, root, remnant,
    body: combatBody(createAttendantMysteriesEncounterState()), randomSeed: runId, randomCursor: 0 };
}
function random(...rolls: number[]): ActionRandomStream { let cursor = 0; return { seed: 'declared-slot-unit', get cursor() { return cursor; }, nextInt(min, max) { const n = rolls[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected declared draw ${n} in ${min}..${max}`); return n; } }; }
function scripted(rolls: number[]) { let cursor = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function(this: DeterministicActionRandomStream, min, max) { original.call(this, min, max); const n = rolls[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected declared draw ${n} in ${min}..${max}`); return n; }); }
afterEach(() => vi.restoreAllMocks());

describe('Attendant of Mysteries finite original-body combat', () => {
  it('keeps the actual inherited six-slot count wheel and independent enemy ability wheel', () => {
    expect(ATTENDANT_MYSTERIES_COUNT_WHEEL.map(x => x.weight)).toEqual([10, 15, 25, 25, 15, 10]);
    expect(attendantMysteriesAbilityWheel({} as SliceState, null).reduce((n, x) => n + x.weight, 0)).toBe(100);
    expect(ATTENDANT_MYSTERIES_ENEMY_ABILITY_WHEEL.reduce((n, x) => n + x.weight, 0)).toBe(100);
    expect(validateAttendantMysteriesPreparation(source().preparation)).toBe(true); expect(validAttendantMysteriesCombatSource(source())).toBe(true);
    expect(validateAttendantMysteriesEncounterCommand({ type: 'PREPARE_ENCOUNTER' })).toBe(true);
    expect(validateAttendantMysteriesEncounterCommand({ type: 'PREPARE_ENCOUNTER', freeMaterials: true })).toBe(false);
  });
  it('recognizes inherited zero mastery, never grants an absent skill', () => {
    const x = source(), r = createAttendantMysteriesRuntime(x);
    expect(resolveAttendantMysteriesPlayerSlot(x, r, BODY_CONTROL, 0, random()).selfGain).toBe(30);
    expect(resolveAttendantMysteriesPlayerSlot(x, r, BALANCE, 1, random()).enemyReduction).toBe(28);
    const a = resolveAttendantMysteriesPlayerSlot(x, r, AIR_BULLET, 2, random()); expect(a).toMatchObject({ selfGain: 60, paidCost: 2 });
    delete x.mastery[AIR_BULLET]; const absent = resolveAttendantMysteriesPlayerSlot(x, r, AIR_BULLET, 3, random()); expect(absent.selectedAbility).toBe('ORDINARY_GUARD'); expect(absent.paidCost).toBe(0);
  });
  it('consumes exactly three provenance segments, retains dead original material, then falls back', () => {
    const x = source(), r = createAttendantMysteriesRuntime(x);
    for (let i = 0; i < 3; i++) { const a = resolveAttendantMysteriesPlayerSlot(x, r, THREAD_REGENERATION, i, random(1)); expect(a).toMatchObject({ paidCost: 6, mindCost: 1, selfGain: 32, succeeded: true }); }
    const a = resolveAttendantMysteriesPlayerSlot(x, r, THREAD_REGENERATION, 3, random());
    expect(a).toMatchObject({ selectedAbility: BODY, paidCost: 0, mindCost: 0, segmentId: null, selfGain: 12 });
    expect(r.remnant).toMatchObject({ alive: false, health: 0, quantity: 1, independentMind: false }); expect(r.remnant.segments.every(s => s.status === 'SPENT')).toBe(true);
    expect(r.playerH).toBe(100); expect(r.playerS).toBe(102); expect(r.playerM).toBe(97); expect(r.body.regenerationAttempts).toBe(3);
  });
  it('still pays the failed regeneration material and costs without healing or mastery', () => {
    const x = source(), r = createAttendantMysteriesRuntime(x); r.playerH = 40;
    const a = resolveAttendantMysteriesPlayerSlot(x, r, THREAD_REGENERATION, 0, random(100));
    expect(a).toMatchObject({ paidCost: 6, mindCost: 1, selfGain: 0, succeeded: false }); expect(r.remnant.segments[0]!.status).toBe('SPENT'); expect(r.playerH).toBe(40); expect(r.mastery[THREAD_REGENERATION]).toBe(0);
  });
  it('grafts only one mapped positive real incoming BODY or ARC, within actual six metres', () => {
    const x = source(), r = createAttendantMysteriesRuntime(x);
    const prep = resolveAttendantMysteriesPlayerSlot(x, r, BOUNDED_GRAFTING, 0, random(1)); expect(prep).toMatchObject({ paidCost: 6, mindCost: 2 });
    expect(r.pending[0]).toMatchObject({ remaining: 1, destinationCoordinate: 18, destinationDistanceMetres: 6, actualBodyContinuous: true });
    const arc = resolveAttendantMysteriesEnemySlot(x, r, 'ARC_BOLT', 1, random()); expect(arc.rawContribution).toBe(85); expect(arc.selfGain).toBe(40); expect(arc.threatens).toBe(true); expect(arc.pendingApplied).toHaveLength(1);
    expect(r.pending).toEqual([]); expect(r.mastery[BOUNDED_GRAFTING]).toBe(8); expect(resolveAttendantMysteriesEnemySlot(x, r, 'ARC_BOLT', 2, random()).selfGain).toBe(85);
  });
  it('never turns partial body buffering into immunity or a mental buffer', () => {
    const x = source(), r = createAttendantMysteriesRuntime(x);
    resolveAttendantMysteriesPlayerSlot(x, r, MYSTERIOUS_REALM, 0, random());
    const mental = resolveAttendantMysteriesEnemySlot(x, r, 'MENTAL_PRESSURE', 1, random()); expect(mental).toMatchObject({ selfGain: 45, mentalPressure: true, threatens: false, attackKind: 'MIND' }); expect(mental.pendingApplied).toEqual([]);
    const body = resolveAttendantMysteriesEnemySlot(x, r, 'BODY_STRIKE', 2, random()); expect(body.selfGain).toBeCloseTo(17.6); expect(body.threatens).toBe(true);
    const arc = resolveAttendantMysteriesEnemySlot(x, r, 'ARC_BOLT', 3, random()); expect(arc.selfGain).toBe(68); expect(arc.threatens).toBe(true); expect(r.pending).toEqual([]);
  });
  it('cannot stack, renew or store windows beyond the actual thirty seconds', () => {
    const x = source(), r = createAttendantMysteriesRuntime(x); resolveAttendantMysteriesPlayerSlot(x, r, MYSTERIOUS_REALM, 0, random()); const id = r.pending[0]!.id;
    const again = resolveAttendantMysteriesPlayerSlot(x, r, BOUNDED_GRAFTING, 1, random()); expect(again.paidCost).toBe(0); expect(r.pending[0]!.id).toBe(id);
    advanceAttendantMysteriesCombatClock(r, 20); expect(r.pending).toEqual([]); expect(r.expired).toHaveLength(1); expect(resolveAttendantMysteriesEnemySlot(x, r, 'ARC_BOLT', 2, random()).selfGain).toBe(85);
  });
  it('charges the enemy for an independent perception counter and preserves already formed attacks', () => {
    const x = source(), r = createAttendantMysteriesRuntime(x); resolveAttendantMysteriesPlayerSlot(x, r, MYSTERIOUS_REALM, 0, random());
    const a = resolveAttendantMysteriesEnemySlot(x, r, 'COMPOSE', 1, random(1)); expect(a.paidCost).toBe(4); expect(a.countered).toHaveLength(1); expect(r.pending).toEqual([]); expect(r.body.enemySpirituality).toBe(116);
    expect(r.playerS).toBe(112); expect(r.playerM).toBe(98); expect(resolveAttendantMysteriesEnemySlot(x, r, 'ARC_BOLT', 2, random()).selfGain).toBe(85);
  });
  it('cannot cast free powers when either side has no actual resources', () => {
    const x = source(), r = createAttendantMysteriesRuntime(x); r.playerS = 0; r.body.enemySpirituality = 0;
    for (const id of [AIR_BULLET, PAST_SELF, PROBABILITY, THREAD_REGENERATION, BOUNDED_GRAFTING, MYSTERIOUS_REALM] as const) { const a = resolveAttendantMysteriesPlayerSlot(x, r, id, 0, random()); expect(a.paidCost).toBe(0); expect(a.fallbackReason).not.toBeNull(); }
    for (const id of ['ARC_BOLT', 'WARD', 'MENTAL_PRESSURE', 'COMPOSE'] as const) { const a = resolveAttendantMysteriesEnemySlot(x, r, id, 0, random()); expect(a).toMatchObject({ paidCost: 0, selectedAbility: 'BODY_STRIKE', selfGain: 22, threatens: true }); }
    expect(r.playerS).toBe(0); expect(r.body.enemySpirituality).toBe(0); expect(r.remnant.segments.every(s => s.status === 'UNUSED')).toBe(true);
  });
  it('borrows only from an actual old self sample with a real remaining difference', () => {
    const x = source(); x.playerSpirituality = 20;
    x.preparation.pastSample = { id: `${x.runId}:AS3-SAMPLE:1`, bodyId: `${x.runId}:body`, revision: 1, week: 1, sequence: 3, spirituality: 40, health: 100, mind: 100, airBulletKnown: true, airBulletGain: 60, source: 'ACTUAL_RECEPTION_OBSERVATION' };
    x.preparation.pastSampleObservedWeek = 1; const r = createAttendantMysteriesRuntime(x), a = resolveAttendantMysteriesPlayerSlot(x, r, PAST_SELF, 0, random(1));
    expect(a).toMatchObject({ paidCost: 1, borrowedReserve: 6, reserveSpent: 2, discardedReserve: 4, selfGain: 60 }); expect(r.playerS).toBe(19); expect(x.preparation.pastSample.spirituality).toBe(40);
    expect(resolveAttendantMysteriesPlayerSlot(x, r, PAST_SELF, 1, random()).selectedAbility).toBe(BODY);
  });
  it('rejects forged origins, living remnants, invented skills and extra source keys', () => {
    for (const mutate of [
      (x: AttendantMysteriesCombatSource) => { x.playerBodyId = 'another-body'; },
      (x: AttendantMysteriesCombatSource) => { x.remnant.lostThreadsEvidence = 'invented'; },
      (x: AttendantMysteriesCombatSource) => { (x.remnant as unknown as { alive: boolean }).alive = true; },
      (x: AttendantMysteriesCombatSource) => { x.mastery['free-wish-library'] = 0; },
      (x: AttendantMysteriesCombatSource) => { (x as unknown as Record<string, unknown>).newBody = true; },
    ]) { const x = source(); mutate(x); expect(validAttendantMysteriesCombatSource(x)).toBe(false); expect(() => replayAttendantMysteriesCombatRound(x, 'ATTACK')).toThrow(); }
    expect(validAttendantMysteriesRemnant(createAttendantMysteriesRemnant(), source().preparation)).toBe(false);
  });
  it('replays the same seed exactly and seals costs, action evidence and outcome fields', () => {
    const x = source(), a = replayAttendantMysteriesCombatRound(x, 'DEFEND'), b = replayAttendantMysteriesCombatRound(structuredClone(x), 'DEFEND'); expect(a).toEqual(b);
    expect(validateAttendantMysteriesCombatRound(a.round)).toBe(true); expect(validateAttendantMysteriesRoundOutcome(a.round.attendantMysteriesOutcome)).toBe(true);
    const forged = structuredClone(a.round); forged.attendantMysteriesOutcome!.playerSpiritualityAfter++; expect(validateAttendantMysteriesCombatRound(forged)).toBe(false);
    const moved = structuredClone(a.round); moved.attendantMysteriesOutcome!.rootAfter.playerTravelMetres++; expect(validateAttendantMysteriesCombatRound(moved)).toBe(false);
    if (a.outcome === 'CONTINUE') { const next = nextAttendantMysteriesCombatSource(a.round.attendantMysteriesOutcome!); expect(validAttendantMysteriesCombatSource(next)).toBe(true); expect(next.root.clockSeconds).toBe(72); }
    expect(x).toEqual(source());
  });
  it('keeps positive buffered body attacks on the actual bodily consequence wheel', () => {
    // DEFEND total429; graft tickets307..381. One player graft, one enemy arc, player loses, light injury.
    scripted([1, 1, 310, 1, 1, 1_000_000, 1]); const r = replayAttendantMysteriesCombatRound(source(), 'DEFEND');
    expect(r.round.attendantMysteriesOutcome!.enemyActions[0]).toMatchObject({ rawContribution: 85, selfGain: 40, threatens: true });
    expect(r.round.consequenceDomain).toBe('BODY'); expect(r.round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 }); expect(r.round.attendantMysteriesOutcome!.playerHealthAfter).toBe(90);
  });
  it('resolves a mental-only loss without a body die, wound or invented immunity', () => {
    // PREPARE realm tickets353..402, one mental enemy slot86..95; no injury roll follows.
    scripted([1, 1, 360, 90, 1_000_000]); const r = replayAttendantMysteriesCombatRound(source(), 'PREPARE');
    expect(r.round.consequenceDomain).toBe('MENTAL'); expect(r.round.consequenceWeights).toBeNull(); expect(r.round.consequenceRoll).toBeUndefined(); expect(r.round.attendantMysteriesOutcome!.playerHealthAfter).toBe(100); expect(r.round.attendantMysteriesOutcome!.playerMindAfter).toBe(88);
  });
  it('leaves actual death terminal without any S1 revival or new body grant', () => {
    scripted([1, 1, 1, 1, 1_000_000, 100]); const r = replayAttendantMysteriesCombatRound(source(), 'ATTACK');
    expect(r.outcome).toBe('PLAYER_DEAD'); expect(r.round.attendantMysteriesOutcome!.playerHealthAfter).toBe(0); expect(r.round.attendantMysteriesOutcome!.continuing).toBe(false);
    expect(r.round.attendantMysteriesOutcome!.rootAfter.playerLocation).toBe('CLEARING'); expect(r.round.attendantMysteriesOutcome!.source.playerBodyId).toBe(`${source().runId}:body`);
  });
  it('keeps a final zero-AP withdrawal in the actual contemporary week without old-city finance', () => {
    scripted([1, 1, 1]); const x = source(), result = replayAttendantMysteriesCombatRound(x, 'RETREAT'), o = result.round.attendantMysteriesOutcome!;
    const finance = x.preparation.finance, after = { ...x.preparation.after, actions: 0 }, revision = o.source.revision + 1;
    const scene = structuredClone(o.rootAfter); leaveAttendantMysteriesCombatScene(scene); const remnant = { ...structuredClone(o.remnantAfter), location: 'WORKSHOP' as const };
    const s = { ...finance, runId: x.runId, revision, week: x.week, date: x.date, status: 'ACTIVE', cash: after.cash, actionsRemaining: 0, pulse: 'NONE', billAmount: 0,
      health: o.playerHealthAfter, mind: o.playerMindAfter, spirituality: o.playerSpiritualityAfter, injuries: o.playerInjuriesAfter, injuryRisk: o.playerRiskAfter,
      character: { coreStats: after.coreStats, gender: after.gender }, progression: { sequence: 1, acting: after.acting, mastery: o.masteryAfter }, seer: { pollution: after.pollution, completedSources: after.completedSources },
      random: { seed: x.randomSeed, cursor: o.randomCursorAfter }, activeEvent: null, eventQueue: [], chronicle: [{ id: `record-${revision}-0`, week: x.week, title: '原埃利亚斯冲突结束', text: '已实际离场。' }],
      attendantMysteries: { encounter: { scene, remnant, journal: [{ command: 'ENCOUNTER_FIGHT', after, finance }] } } } as unknown as SliceState;
    expect(attendantMysteriesTerminalBudgetMatches(s, x.preparation, o)).toBe(true);
    s.cash -= 30; expect(attendantMysteriesTerminalBudgetMatches(s, x.preparation, o)).toBe(false); s.cash += 30;
    s.actionsRemaining = 3; expect(attendantMysteriesTerminalBudgetMatches(s, x.preparation, o)).toBe(false);
  });
  it('requires three real actions before purchasing the finite optional encounter preparation', () => {
    const x = source(); x.preparation.before.actions = 2; x.preparation.after.actions = 1;
    expect(validateAttendantMysteriesPreparation(x.preparation)).toBe(false);
    x.preparation.before.actions = 3; x.preparation.after.actions = 2;
    expect(validateAttendantMysteriesPreparation(x.preparation)).toBe(true);
    // Contemporary reception replenishes four actions even when old city weeklyBudget remains three.
    x.preparation.finance.weeklyBudget = 3; x.preparation.before.actions = 4; x.preparation.after.actions = 3;
    expect(validateAttendantMysteriesPreparation(x.preparation)).toBe(true);
  });
  it('uses a real twelve-metre ordinary exit without relocating the opponent or residents', () => {
    const x = source(), root = structuredClone(x.root); leaveAttendantMysteriesCombatScene(root);
    expect(root).toMatchObject({ playerLocation: 'WORKSHOP', playerCoordinate: 0, playerTravelMetres: 24, clockSeconds: 24, externalSeconds: 24, enemyCoordinate: 14, residentsLocation: 'TOWN', residentsJoined: 0 });
  });
});
