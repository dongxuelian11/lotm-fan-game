/** Small deterministic domain fixtures only. No full-source import, replay,
 * natural capture, SQLite or randomness replacement is involved. */
import { describe, expect, it } from 'vitest';
import { computeCheckChance, resolveNormalCheck } from '../src/resolution/normal-check.js';
import { ERROR_RITUAL_CANDIDATE as C, ERROR_RITUAL_CUSTODIAN as K, ERROR_RITUAL_INNER as INNER,
  ERROR_RITUAL_SITE as SITE, ERROR_RITUAL_THUNDER as THUNDER, ERROR_RITUAL_TYRANT as UNIQUE } from '../src/domain/error-ascent/ritual-content.js';
import { createErrorRitual, advanceErrorRitual, applyErrorRitual, applyErrorRitualWorldChange,
  errorCandidateIneligible, errorRitualBlock, errorRitualPopulation, getErrorRitualCheckInput,
  getErrorRitualPreparationFacts, validateErrorRitualCommand,
  type ErrorRitualCommand, type ErrorRitualHost, type ErrorRitualState } from '../src/domain/error-ascent/ritual.js';

type Scene = { state: ErrorRitualState; host: ErrorRitualHost; nextEvent: number };
const replace = { type: 'REPLACE', confirmed: true } as const;
const originals = ['time-worm-potion-1', 'time-worm-potion-2', 'time-worm-potion-3'];
function scene(year = 1352): Scene {
  const host: ErrorRitualHost = {
    actorId: 'fixture-player', eventId: 'unused-preview', revision: 1, week: 147,
    date: { epoch: 'FIFTH_EPOCH', year, month: 4, day: 15 }, nowSecond: 36000,
    location: SITE, status: 'ACTIVE', sequence: 1, health: 100, mental: 88, spirituality: 120,
    pollution: 0, cash: 1000, actionPoints: 3, will: 26, injuries: [], check: null,
    compound: { id: 'error-ascent-compound-1', status: 'PREPARED', location: SITE,
      carrierId: 'error-ascent-carrier-1', embodiedOriginalId: 'time-worm-potion-1',
      externalOriginalIds: ['time-worm-potion-2', 'time-worm-potion-3'], uniquenessId: 'ER219-ERROR-UNIQUE' },
    preparation: { id: 'paid-stability', compoundId: 'error-ascent-compound-1', actorId: 'fixture-player',
      status: 'READY', expiresSecond: 1000000 },
    bookingPlan: { leadSeconds: 3600, routeSummary: '本小场景已经取得材料和稳定准备；尚需走查、购线与实际入场。' },
  };
  return { host, state: createErrorRitual(host), nextEvent: 1 };
}
function act(x: Scene, command: ErrorRitualCommand, roll?: number) {
  x.host = { ...x.host, eventId: `action-${x.nextEvent}`, revision: x.nextEvent++, check: null };
  if (command.type === 'REPLACE') {
    if (roll === undefined) throw Error('Test must supply the normal check roll explicitly.');
    x.host.check = resolveNormalCheck({ ...getErrorRitualCheckInput(x.state, x.host), roll });
  }
  const result = applyErrorRitual(x.state, command, x.host), e = result.effect;
  x.state = result.state;
  x.host = { ...x.host, nowSecond: x.host.nowSecond + e.seconds, cash: x.host.cash - e.cashCost,
    actionPoints: x.host.actionPoints - e.actions, health: Math.max(0, x.host.health - e.health),
    mental: Math.max(0, x.host.mental - e.mental), spirituality: x.host.spirituality - e.spirituality,
    pollution: Math.min(100, x.host.pollution + e.pollution), sequence: e.promoted ? 0 : x.host.sequence,
    status: e.died ? 'DEAD' : x.host.status, check: null, eventId: `preview-${x.nextEvent}` };
  if (result.settlement) { x.host.compound = null; x.host.preparation = null; }
  return result;
}
function to(x: Scene, second: number) {
  x.state = advanceErrorRitual(x.state, second); x.host = { ...x.host, nowSecond: second };
}
function prepared(enter = true, wait = true): Scene {
  const x = scene();
  act(x, { type: 'BRIEF' }); act(x, { type: 'SURVEY' }); act(x, { type: 'PREPARE_LINE' });
  if (enter) { act(x, { type: 'ENTER' }); if (wait) act(x, { type: 'WAIT_FOR_CHANT' }); }
  return x;
}
const item = (s: ErrorRitualState, id: string) => s.objects.find(o => o.id === id)!;
const settlementCount = (s: ErrorRitualState) => s.journal.filter(e => e.id === 'ER219-CANDIDATE-SETTLED').length;

describe('Error219 finite rival and one physical substitution window', () => {
  it('builds real independent prerequisites by enacting the finite original history', () => {
    const { state: s } = scene();
    expect(errorCandidateIneligible(s)).toBeNull(); expect(errorRitualPopulation(s)).toBe(210000);
    expect(s.predecessors).toEqual({ sunAlive: false, tyrantAlive: false });
    expect(s.sun).toMatchObject({ sequence: 0, status: 'ACTIVE', health: 988, spirituality: 9936 });
    expect(s.challenge).toMatchObject({ participants: [C, 'ER219-SUN'], assistingActors: [], escaped: true,
      metres: 60, position: 60, healthOnEscape: 69 });
    expect(s.challenge.exchangeIds).toHaveLength(4);
    expect(s.history.filter(e => e.kind === 'CHALLENGE').every(e => e.kind === 'CHALLENGE' && e.candidateHealthLoss > 0 && e.sunSpiritualityCost > 0)).toBe(true);
    expect(s.candidate).toMatchObject({ health: 99, spirituality: 120, heavyInjuries: 0, cash: 8340, intendsAscension: true });
    expect(item(s, THUNDER[0])).toMatchObject({ owner: C, holder: C, state: 'EMBODIED' });
    for (const id of [THUNDER[1], THUNDER[2], UNIQUE]) expect(item(s, id)).toMatchObject({ owner: C, holder: K, state: 'SEALED' });
    expect(new Set(s.objects.map(o => o.id)).size).toBe(8);
    expect(s.objects.some(o => originals.includes(o.id))).toBe(false);
    expect(validateErrorRitualCommand({ ...replace, qualified: true })).toBe(false);
    expect(validateErrorRitualCommand({ ...replace, success: true })).toBe(false);
  });

  it('uses identity intersection and a real departure can invalidate the sole booking', () => {
    const x = scene(), mismatched = structuredClone(x.state);
    // Equal membership counts do not make unrelated people overlap.
    mismatched.cohorts[0]!.believe = [[70001, 140000]];
    expect(errorRitualPopulation(mismatched)).toBe(140000);
    act(x, { type: 'BRIEF' }); const booked = structuredClone(x.state.booking);
    x.state = applyErrorRitualWorldChange(x.state, { type: 'COHORT_DEPARTURE', cohort: 'NORTH',
      members: [1, 11000], reason: '这批原居民真实离开城邦并停止参与' }, x.host.nowSecond, 'departure');
    expect(errorRitualPopulation(x.state)).toBe(199000);
    to(x, booked!.consumeAt + 40);
    expect(x.state).toMatchObject({ phase: 'CANCELLED', candidateOutcome: 'INELIGIBLE', consumedAt: null });
    expect(x.state.booking).toEqual(booked);
    for (const id of [THUNDER[1], THUNDER[2], UNIQUE]) expect(item(x.state, id)).toMatchObject({ holder: K, state: 'SEALED' });
  });

  it('books once from the actual current date, including a much later legal entrant', () => {
    const x = scene(1400); act(x, { type: 'BRIEF' });
    expect(x.state.booking).toMatchObject({ bookedAt: 36000, consumeAt: 39600, date: { year: 1400 } });
    const original = structuredClone(x.state.booking);
    expect(() => act(x, { type: 'BRIEF' })).toThrow('不再重订');
    to(x, original!.consumeAt + 30); const once = structuredClone(x.state);
    to(x, x.host.nowSecond + 604800);
    expect(x.state.booking).toEqual(original); expect(x.state.objects).toEqual(once.objects);
    expect(x.state.candidateOutcome).toBe('ASCENDED'); expect(settlementCount(x.state)).toBe(1);
  });

  it('buys the sole physical grip, exposes early survey facts, and accepts only a complete 4 seconds', () => {
    const x = prepared(true, false), t = x.state.booking!.consumeAt;
    expect(x.host.cash).toBe(950); expect(x.host.actionPoints).toBe(1);
    expect(x.state.player.grip).toMatchObject({ holder: 'PLAYER', boughtEventId: 'action-3' });
    expect(getErrorRitualPreparationFacts(x.state, 'same-source')).toMatchObject({ actorId: x.host.actorId,
      investigationEventId: 'action-2', routeEventId: 'action-2', conductorEventId: 'action-2',
      conductorId: 'ER219-CONDUCTOR', routeId: 'ER219-OUTER-STAIR' });
    to(x, t + 17); expect(errorRitualBlock(x.state, replace, x.host)).toContain('18至30秒');
    to(x, t + 18); expect(errorRitualBlock(x.state, replace, x.host)).toBeNull();
    expect(x.state.oathRing).toMatchObject({ holder: C, worn: true, linked: true });
    expect(computeCheckChance(getErrorRitualCheckInput(x.state, x.host))).toBe(70);
    to(x, t + 26); expect(errorRitualBlock(x.state, replace, x.host)).toBeNull();
    to(x, t + 27); expect(errorRitualBlock(x.state, replace, x.host)).toContain('完整进行4秒');
    to(x, t + 30); expect(x.state.player.outcome).toBe('MISSED'); expect(x.state.candidateOutcome).toBe('ASCENDED');
  });

  it('rejects a mismatched supplied check without spending anything or marking an attempt', () => {
    const x = prepared(), before = structuredClone(x.state);
    x.host.check = resolveNormalCheck({ ...getErrorRitualCheckInput(x.state, x.host), baseAbility: x.host.will + 1, roll: 1 });
    expect(() => applyErrorRitual(x.state, replace, x.host)).toThrow('中央判定必须匹配');
    expect(x.state).toEqual(before); expect(x.state.player.attemptedAt).toBeNull();
  });

  it('spends real resistance, fuses only the player originals, and leaves a living displaced rival', () => {
    const x = prepared(), beforeCount = x.state.objects.length, result = act(x, replace, 50);
    expect(result.effect).toMatchObject({ promoted: true, died: false, actions: 1, spirituality: 30, mental: 8, seconds: 4 });
    expect(result.settlement).toMatchObject({ outcome: 'FUSED', place: SITE, position: 'OUTER_CONTACT',
      embodiedOriginalId: originals[0], externalOriginalIds: originals.slice(1), uniquenessId: 'ER219-ERROR-UNIQUE',
      carrierSpent: true, preparationSpent: true });
    expect(x.state.candidate).toMatchObject({ status: 'ACTIVE', sequence: 1, health: 54, mental: 60,
      pollution: 35, heavyInjuries: 1, spirituality: 72, seals: 1, isolation: 10 });
    expect(x.state.candidateOutcome).toBe('DISPLACED_ALIVE'); expect(x.state.objects).toHaveLength(beforeCount);
    expect(item(x.state, THUNDER[0])).toMatchObject({ holder: C, state: 'EMBODIED' });
    for (const id of [THUNDER[1], THUNDER[2], UNIQUE]) expect(item(x.state, id)).toMatchObject({ holder: INNER, place: INNER, state: 'EXPOSED' });
    expect(x.state.custodian).toMatchObject({ cash: 0, spirituality: 0, chestUses: 0, recoveredAt: null });
    to(x, x.host.nowSecond + 600);
    for (const id of [THUNDER[1], THUNDER[2], UNIQUE]) expect(item(x.state, id)).toMatchObject({ holder: K, state: 'SEALED', place: 'ER219-TYRANT-SEALING-CHEST' });
    expect(item(x.state, THUNDER[0]).state).toBe('EMBODIED'); expect(settlementCount(x.state)).toBe(1);
    expect(x.state.objects.some(o => o.holder === x.host.actorId)).toBe(false);
  });

  it('does not claim recovery if the actual path is blocked during its 600 seconds', () => {
    const x = prepared(); act(x, replace, 50);
    x.state = applyErrorRitualWorldChange(x.state, { type: 'CUSTODIAN_PATH_BLOCKED' }, x.host.nowSecond, 'blocked-path');
    to(x, x.host.nowSecond + 600);
    expect(x.state.custodian).toMatchObject({ recoveredAt: null, recoveryDue: null, chestUses: 0, cash: 0, spirituality: 0 });
    for (const id of [THUNDER[1], THUNDER[2], UNIQUE]) expect(item(x.state, id)).toMatchObject({ holder: INNER, place: INNER, state: 'EXPOSED' });
  });

  it('makes early exposure cause a real approach and cut, rather than an abstract hostile flag', () => {
    const x = prepared(false), t = x.state.booking!.consumeAt;
    to(x, t + 9); act(x, { type: 'ENTER' });
    expect(x.state.guard).toMatchObject({ dispatchedAt: t + 15, cutAt: t + 23 });
    expect(x.state.candidate).toMatchObject({ spirituality: 72, seals: 1, isolation: 10 });
    to(x, t + 20);
    expect(x.state.guard.positionMetres).toBe(5);
    expect(errorRitualBlock(x.state, replace, x.host)).toContain('四秒动作完成前');
    to(x, t + 23);
    expect(x.state.guard).toMatchObject({ positionMetres: 6, cut: true });
    expect(x.state.player.lineConnected).toBe(false); expect(x.state.conductor.intact).toBe(true);
    to(x, t + 30); expect(x.state.candidateOutcome).toBe('ASCENDED'); expect(settlementCount(x.state)).toBe(1);
  });

  it('allows cashless, actionless ordinary retreat while the same rival booking continues once', () => {
    const x = prepared(true, false), booking = structuredClone(x.state.booking), compound = structuredClone(x.host.compound);
    x.host.cash = 0; x.host.actionPoints = 0; x.host.spirituality = 0;
    const result = act(x, { type: 'RETREAT' });
    expect(result.effect).toMatchObject({ cashCost: 0, actions: 0, spirituality: 0, seconds: 6 });
    expect(result.settlement).toBeNull(); expect(x.host.compound).toEqual(compound);
    expect(x.state.player).toMatchObject({ position: 'OUTSIDE', outcome: 'WITHDRAWN', walkedMetres: 12 });
    to(x, booking!.consumeAt + 30); to(x, x.host.nowSecond + 604800);
    expect(x.state.booking).toEqual(booking); expect(x.state.candidateOutcome).toBe('ASCENDED'); expect(settlementCount(x.state)).toBe(1);
    expect(errorRitualBlock(x.state, { type: 'ENTER' }, x.host)).toContain('不能补发');
  });

  it('ordinary player failure leaves only their external originals exposed and still settles the rival', () => {
    const x = prepared(), result = act(x, replace, 80);
    expect(result.effect).toMatchObject({ promoted: false, died: false, health: 45, mental: 48, pollution: 35, heavyInjuries: 1, seconds: 12 });
    expect(result.settlement).toMatchObject({ outcome: 'EXPOSED_ALIVE', place: SITE, position: 'OUTER_CONTACT',
      embodiedOriginalId: originals[0], externalOriginalIds: originals.slice(1) });
    expect(x.state.player.outcome).toBe('FAILED_ALIVE'); expect(x.state.candidateOutcome).toBe('ASCENDED');
    for (const id of [...THUNDER, UNIQUE]) expect(item(x.state, id)).toMatchObject({ holder: C, state: 'FUSED' });
    expect(settlementCount(x.state)).toBe(1);
    expect(errorRitualBlock(x.state, replace, x.host)).toContain('机会已经结束');
    x.host.cash = 0; x.host.actionPoints = 0;
    expect(errorRitualBlock(x.state, { type: 'RETREAT' }, x.host)).toBeNull();
    act(x, { type: 'RETREAT' }); expect(x.state.player.position).toBe('OUTSIDE');
  });

  it('severe player failure consolidates the same three originals at one reachable site without freezing the rival', () => {
    const x = prepared(), result = act(x, replace, 99), settlement = result.settlement!;
    expect(result.effect).toMatchObject({ died: true, health: 110, mental: 108, pollution: 70, seconds: 12 });
    expect(settlement).toMatchObject({ outcome: 'DEATH_RESIDUE', place: SITE, position: 'OUTER_CONTACT',
      uniquenessId: 'ER219-ERROR-UNIQUE', carrierSpent: true, preparationSpent: true });
    expect([settlement.embodiedOriginalId, ...settlement.externalOriginalIds].sort()).toEqual(originals);
    expect(x.state.player.outcome).toBe('DEAD'); expect(x.state.candidateOutcome).toBe('ASCENDED');
    expect(settlementCount(x.state)).toBe(1); expect(x.host.status).toBe('DEAD');
    expect(x.state.objects.some(o => o.holder === x.host.actorId)).toBe(false);
  });
});
