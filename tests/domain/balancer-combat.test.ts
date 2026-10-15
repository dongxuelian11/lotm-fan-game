import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { createChaosHunterLifeState } from '../../src/domain/chaos-hunter/life.js';
import { combatBody, createBalancerEncounterState, balancerTerminalBudgetMatches, validateBalancerEncounterCommand, validateBalancerPreparation, type BalancerPreparation } from '../../src/domain/balancer/encounter.js';
import { IMBALANCE, RESISTANCE, BODY, WOUND, DEPRIVATION, BALANCER_COUNT_WHEEL, BALANCER_ENEMY_ABILITY_WHEEL,
  advanceBalancerCombatClock, createBalancerRuntime, balancerAbilityWheel, nextBalancerCombatSource, replayBalancerCombatRound,
  resolveBalancerEnemySlot, resolveBalancerPlayerSlot, validateBalancerCombatRound, validateBalancerRoundOutcome, validBalancerCombatSource,
  type BalancerCombatSource, type BalancerRoundOutcome } from '../../src/domain/balancer/combat.js';
import type { BalancerSceneRoot, BalancerGuardPlate } from '../../src/domain/balancer/life.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { resolveSliceWeeklyFinance } from '../../src/domain/slice/weekly-finance.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';

/** Declared UNIT-only inputs, never edits a natural prefix or a recorded roll. */
function source(): BalancerCombatSource {
  const root: BalancerSceneRoot = createChaosHunterLifeState(); root.introducedWeek = 1; root.playerLocation = 'A'; root.volunteer.location = 'OUTSIDE'; root.guide.location = 'OUTSIDE';
  root.parcel.location = root.line.location = root.paper.location = 'OUTSIDE'; root.clockSeconds = 16; root.playerTravelMetres = 4; root.guideTravelMetres = 4;
  const guardPlate: BalancerGuardPlate = { id: 'BA2-GUARD-PLATE', owner: 'PLAYER', holder: 'PLAYER', location: 'START', integrity: 65, acquiredWeek: 1 };
  const before = { cash: 1000, actions: 100, health: 100, mind: 100, spirituality: 120, pollution: 0, sequence: 2 as const, acting: 100, coreStats: { physique: 10, perception: 20, will: 30, knowledge: 40 },
    mastery: { [IMBALANCE]: 0, [RESISTANCE]: 0, [BODY]: 0, [WOUND]: 0, 'justiciar.s8.trace-sensing': 0 }, completedSources: [], injuries: [], injuryRisk: 0, guardPlate };
  const date = { epoch: 'FIFTH_EPOCH' as const, year: 1349, month: 6, day: 28 };
  return { runId: 'balancer-combat-declared-unit', revision: 4, week: 1, date, round: 1, encounterId: 'BALANCER_DISPUTE', targetId: 'BA2-CASPAR', attemptWeek: 1, startHistoryIndex: 0,
    targetName: '卡斯帕·霍尔特', targetAge: 46, targetPathway: 'original-caster', targetSequence: 3, targetCore: 22, actualBody: true, independentMind: true, enemyWeapon: 'BA2-CASPAR-ROD', weaponOwner: 'BA2-CASPAR', yardId: 'CH3-LINE-PRACTICE', enemyPosition: 'BETWEEN_A_AND_B', enemyDistanceMetres: 2,
    ordinaryExit: 'OPEN', pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false, freeSkillLibrary: false, playerHealth: 100, playerMind: 98, playerSpirituality: 120, playerInjuries: [], playerRisk: 0,
    ...before.coreStats, mastery: { ...before.mastery }, clubHeld: false, guardPlate: { ...guardPlate, location: 'A' },
    preparation: { week: 1, date, revision: 2, runId: 'balancer-combat-declared-unit', randomSeed: 'balancer-combat-declared-unit', randomCursor: 0, mindPaid: 2, lifeJournalLength: 1, lifeClockSeconds: 0, before, after: { ...before, mind: 98 },
      finance: { weeklyBudget: 100, lifeTier: 'DESTITUTE', nextLifeTier: 'DESTITUTE', debts: [], missedWeeks: 0, credit: 'NORMAL' } },
    root, body: combatBody(createBalancerEncounterState()), randomSeed: 'balancer-combat-declared-unit', randomCursor: 0 };
}
function random(...rolls: number[]): ActionRandomStream { let cursor = 0; return { seed: 'declared-slot-unit', get cursor() { return cursor; }, nextInt(min, max) { const n = rolls[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected declared draw ${n} in ${min}..${max}`); return n; } }; }
function scripted(rolls: number[]) {
  let cursor = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function(this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = rolls[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected directed draw ${n} in ${min}..${max}`); return n;
  });
}
afterEach(() => vi.restoreAllMocks());

describe('Balancer finite original combat kernel', () => {
  it('retains inherited six count slots and original six ability weights', () => {
    expect(BALANCER_COUNT_WHEEL.map(x => x.weight)).toEqual([12, 20, 25, 23, 14, 6]);
    expect(balancerAbilityWheel({} as SliceState, null).map(x => x.weight)).toEqual([30, 15, 25, 10, 15, 5]);
    expect(balancerAbilityWheel({} as SliceState, null).map(x => x.id)).toEqual([BODY, WOUND, RESISTANCE, IMBALANCE, DEPRIVATION, 'ACCIDENT']);
    expect(BALANCER_ENEMY_ABILITY_WHEEL.reduce((n, x) => n + x.weight, 0)).toBe(100);
    expect(validBalancerCombatSource(source())).toBe(true); expect(validateBalancerPreparation(source().preparation)).toBe(true);
    expect(validateBalancerEncounterCommand({ type: 'PREPARE_ENCOUNTER' })).toBe(true); expect(validateBalancerEncounterCommand({ type: 'ENCOUNTER_FIGHT', reset: true })).toBe(false);
  });
  it('preserves original ordinary body, held club, side blow and wound costs', () => {
    const x = source(), r = createBalancerRuntime(x);
    expect(resolveBalancerPlayerSlot(x, r, BODY, 0, random()).selfGain).toBeCloseTo(59.15 * .65);
    expect(resolveBalancerPlayerSlot(x, r, WOUND, 1, random()).selfGain).toBeCloseTo(41.405 * .65);
    x.clubHeld = true; expect(resolveBalancerPlayerSlot(x, r, BODY, 2, random()).selfGain).toBe(16);
    r.body.enemyInjuries.push({ id: 'actual-old-injury', severity: 'LIGHT', acquiredRevision: 3, treatedRevision: null });
    const wound = resolveBalancerPlayerSlot(x, r, WOUND, 3, random(1)); expect(wound.attackKind).toBe('WOUND'); expect(wound.paidCost).toBe(3); expect(wound.selfGain).toBeCloseTo(45 * .65); expect(wound.check?.chance).toBeGreaterThan(0);
  });
  it('does not invent an opening from hidden intentions, arc or mental pressure', () => {
    const x = source(), r = createBalancerRuntime(x);
    expect(resolveBalancerPlayerSlot(x, r, IMBALANCE, 0, random()).paidCost).toBe(0);
    resolveBalancerEnemySlot(x, r, 'ARC_BOLT', 1, random()); resolveBalancerEnemySlot(x, r, 'MENTAL_PRESSURE', 2, random());
    const observed = resolveBalancerPlayerSlot(x, r, IMBALANCE, 3, random()); expect(observed.check).toBeNull(); expect(r.opening).toBeNull(); expect(r.mastery[IMBALANCE]).toBe(0);
  });
  it('charges failed sensing and only awards successful sensing when a real next own BODY uses it', () => {
    const x = source(), r = createBalancerRuntime(x); resolveBalancerEnemySlot(x, r, 'BODY_STRIKE', 0, random());
    const failed = resolveBalancerPlayerSlot(x, r, IMBALANCE, 1, random(100)); expect(failed.paidCost).toBe(5); expect(r.playerS).toBe(115); expect(r.mastery[IMBALANCE]).toBe(0);
    const success = resolveBalancerPlayerSlot(x, r, IMBALANCE, 2, random(1)); expect(success.succeeded).toBe(true); expect(r.mastery[IMBALANCE]).toBe(0);
    const used = resolveBalancerPlayerSlot(x, r, BODY, 3, random()); expect(used.selfGain - used.rawContribution).toBe(25); expect(used.masteryApplied).toEqual([IMBALANCE]); expect(r.mastery[IMBALANCE]).toBe(8); expect(r.opening).toBeNull();
    expect(resolveBalancerPlayerSlot(x, r, BODY, 4, random()).selfGain).toBeCloseTo(59.15 * .65);
  });
  it('never applies sensed BODY gain to wound verdict or duplicates a pending cast', () => {
    const x = source(), r = createBalancerRuntime(x); resolveBalancerEnemySlot(x, r, 'BODY_STRIKE', 0, random()); resolveBalancerPlayerSlot(x, r, IMBALANCE, 1, random(1));
    expect(resolveBalancerPlayerSlot(x, r, IMBALANCE, 2, random()).paidCost).toBe(0);
    r.body.enemyInjuries.push({ id: 'old', severity: 'LIGHT', acquiredRevision: 3, treatedRevision: null });
    const wound = resolveBalancerPlayerSlot(x, r, WOUND, 3, random(1)); expect(wound.selfGain).toBe(wound.rawContribution); expect(r.mastery[IMBALANCE]).toBe(0); expect(r.pending[0]?.kind).toBe('IMBALANCE');
  });
  it('expires the actual opening at30 seconds without free new knowledge or refunded costs', () => {
    const x = source(), r = createBalancerRuntime(x); resolveBalancerEnemySlot(x, r, 'BODY_STRIKE', 0, random()); const deadline = r.opening!.expiresAt;
    resolveBalancerPlayerSlot(x, r, IMBALANCE, 1, random(1)); advanceBalancerCombatClock(r, deadline - r.root.clockSeconds);
    expect(r.opening).toBeNull(); expect(r.pending).toEqual([]); expect(r.playerS).toBe(115); expect(r.mastery[IMBALANCE]).toBe(0);
    expect(resolveBalancerPlayerSlot(x, r, BODY, 2, random()).selfGain).toBeCloseTo(59.15 * .65);
  });
  it('prepares one30-second plate response but awards8 and wears15 only at actual BODY mitigation', () => {
    const x = source(), r = createBalancerRuntime(x), cast = resolveBalancerPlayerSlot(x, r, RESISTANCE, 0, random(1));
    expect([cast.paidCost, cast.mindCost, r.playerS, r.playerM, r.guardPlate.integrity]).toEqual([6, 1, 114, 97, 65]); expect(r.mastery[RESISTANCE]).toBe(0);
    const attack = resolveBalancerEnemySlot(x, r, 'BODY_STRIKE', 1, random()); expect([attack.rawContribution, attack.selfGain, attack.plateWear, r.guardPlate.integrity]).toEqual([20, 0, 15, 50]);
    expect(attack.threatens).toBe(false); expect(attack.masteryApplied).toEqual([RESISTANCE]); expect(r.mastery[RESISTANCE]).toBe(8); expect(r.pending).toEqual([]);
    expect(resolveBalancerEnemySlot(x, r, 'BODY_STRIKE', 2, random()).selfGain).toBe(20); expect(r.guardPlate.integrity).toBe(50);
  });
  it('keeps ARC and MIND outside plate resistance, without health or mind immunity', () => {
    const x = source(), r = createBalancerRuntime(x); resolveBalancerPlayerSlot(x, r, RESISTANCE, 0, random(1));
    const arc = resolveBalancerEnemySlot(x, r, 'ARC_BOLT', 1, random()), mind = resolveBalancerEnemySlot(x, r, 'MENTAL_PRESSURE', 2, random());
    expect([arc.selfGain, arc.attackKind, arc.paidCost]).toEqual([70, 'ARC', 5]); expect([mind.selfGain, mind.attackKind, mind.mentalPressure]).toEqual([45, 'MIND', true]); expect(r.guardPlate.integrity).toBe(65); expect(r.pending).toHaveLength(1);
  });
  it('charges failed resistance and never stacks, replenishes or awards unused windows', () => {
    const x = source(), r = createBalancerRuntime(x), failed = resolveBalancerPlayerSlot(x, r, RESISTANCE, 0, random(100));
    expect([failed.paidCost, failed.mindCost, failed.succeeded]).toEqual([6, 1, false]); expect(r.guardPlate.integrity).toBe(65); expect(r.pending).toEqual([]);
    resolveBalancerPlayerSlot(x, r, RESISTANCE, 1, random(1)); const deadline = r.pending[0]!.expiresAt;
    expect(resolveBalancerPlayerSlot(x, r, RESISTANCE, 2, random()).paidCost).toBe(0); expect(r.pending[0]!.expiresAt).toBe(deadline);
    advanceBalancerCombatClock(r, deadline - r.root.clockSeconds); expect(r.pending).toEqual([]); expect(r.mastery[RESISTANCE]).toBe(0); expect(r.guardPlate.integrity).toBe(65);
  });
  it('uses the same finite plate down to5 then only inherited intimidation or trace fallback', () => {
    const x = source(), r = createBalancerRuntime(x);
    for (let i = 0; i < 4; i++) { resolveBalancerPlayerSlot(x, r, RESISTANCE, i * 2, random(1)); resolveBalancerEnemySlot(x, r, 'BODY_STRIKE', i * 2 + 1, random()); }
    expect(r.guardPlate.integrity).toBe(5); expect(r.mastery[RESISTANCE]).toBe(32);
    const fallback = resolveBalancerPlayerSlot(x, r, RESISTANCE, 8, random(1)); expect([fallback.selectedAbility, fallback.paidCost]).toEqual(['justiciar.s4.intimidation', 4]);
    expect(resolveBalancerEnemySlot(x, r, 'ARC_BOLT', 9, random()).selfGain).toBe(42); expect(r.guardPlate.integrity).toBe(5);
    r.playerS = 3; const dry = resolveBalancerPlayerSlot(x, r, RESISTANCE, 10, random()); expect(dry.selectedAbility).toBe('justiciar.s8.trace-sensing'); expect(dry.enemyReduction).toBeCloseTo(49.29 * .65); expect(r.mastery[RESISTANCE]).toBe(32);
  });
  it('requires actually held owned plate, not a guide object or copied inventory', () => {
    for (const change of [(p: BalancerGuardPlate) => { p.owner = 'GUIDE'; p.holder = 'GUIDE'; p.location = 'OUTSIDE'; p.acquiredWeek = null; }, (p: BalancerGuardPlate) => { p.integrity = 14; }]) {
      const x = source(), r = createBalancerRuntime(x); change(r.guardPlate); const a = resolveBalancerPlayerSlot(x, r, RESISTANCE, 0, random(1)); expect(a.selectedAbility).toBe('justiciar.s4.intimidation'); expect(a.mindCost).toBe(0); expect(r.mastery[RESISTANCE]).toBe(0);
    }
  });
  it('lets independently paid COMPOSE cancel actual opening, plate window and old deprivation', () => {
    const x = source(), r = createBalancerRuntime(x); resolveBalancerEnemySlot(x, r, 'BODY_STRIKE', 0, random()); resolveBalancerPlayerSlot(x, r, IMBALANCE, 1, random(1)); resolveBalancerPlayerSlot(x, r, RESISTANCE, 2, random(1)); resolveBalancerPlayerSlot(x, r, DEPRIVATION, 3, random(1));
    const compose = resolveBalancerEnemySlot(x, r, 'COMPOSE', 4, random()); expect([compose.paidCost, r.body.enemySpirituality]).toEqual([4, 116]); expect(r.pending).toEqual([]); expect(r.opening).toBeNull(); expect(r.guardPlate.integrity).toBe(65); expect(r.mastery[IMBALANCE]).toBe(0); expect(r.mastery[RESISTANCE]).toBe(0);
    const resisted = resolveBalancerPlayerSlot(x, r, RESISTANCE, 5, random(1)); expect(resisted.resisted).toBe(true); expect(resisted.paidCost).toBe(6); expect(r.pending).toEqual([]);
  });
  it('keeps inherited deprivation4S knowledge18 and actual no-fee BODY fallback on the same enemy slot', () => {
    const x = source(), r = createBalancerRuntime(x); const deprivation = resolveBalancerPlayerSlot(x, r, DEPRIVATION, 0, random(1)); expect(deprivation.paidCost).toBe(4);
    const arc = resolveBalancerEnemySlot(x, r, 'ARC_BOLT', 1, random()); expect([arc.planned, arc.id, arc.paidCost, arc.attackKind, r.body.enemySpirituality]).toEqual(['ARC_BOLT', 'BODY_STRIKE', 0, 'BODY', 120]);
    expect(resolveBalancerPlayerSlot(x, r, DEPRIVATION, 2, random()).paidCost).toBe(0);
    resolveBalancerEnemySlot(x, r, 'COMPOSE', 3, random()); expect(resolveBalancerEnemySlot(x, r, 'ARC_BOLT', 4, random()).paidCost).toBe(5);
  });
  it('never gives Caspar free powers or changes his independent weapon and health', () => {
    const x = source(), r = createBalancerRuntime(x); r.body.enemySpirituality = 3;
    const a = resolveBalancerEnemySlot(x, r, 'MENTAL_PRESSURE', 0, random()); expect(a.id).toBe('BODY_STRIKE'); expect(a.attackKind).toBe('BODY'); expect(a.paidCost).toBe(0); expect(r.body.enemySpirituality).toBe(3); expect(r.body.enemyHealth).toBe(100);
  });
  it('replays exact original seed and rejects cost, plate, mastery, enemy and cursor edits', () => {
    const { round } = replayBalancerCombatRound(source(), 'DEFEND'); expect(validateBalancerCombatRound(round)).toBe(true); const o = round.balancerOutcome!; expect(validateBalancerRoundOutcome(o)).toBe(true);
    for (const change of [(v: BalancerRoundOutcome) => { v.enemySpirituality++; }, (v: BalancerRoundOutcome) => { v.randomCursorAfter++; }, (v: BalancerRoundOutcome) => { v.masteryAfter[IMBALANCE]!++; }, (v: BalancerRoundOutcome) => { v.guardPlateAfter.integrity--; }, (v: BalancerRoundOutcome) => { v.playerMindAfter++; }, (v: BalancerRoundOutcome) => { v.source.enemyWeapon = 'CH3-EDRIC-ROD' as never; }]) { const bad = structuredClone(o); change(bad); expect(validateBalancerRoundOutcome(bad)).toBe(false); }
    if (o.continuing) { const next = nextBalancerCombatSource(o); expect(next.playerSpirituality).toBe(Math.min(120, o.playerSpiritualityAfter + 12)); expect(next.guardPlate).toEqual(o.guardPlateAfter); expect(validBalancerCombatSource(next)).toBe(true); }
  });
  it('rejects foreign root, phantom plate, old target and hidden authority in source', () => {
    for (const mutate of [(x: BalancerCombatSource) => { x.targetId = 'CH3-EDRIC' as never; }, (x: BalancerCombatSource) => { x.root.parcel.massGrams = 400 as never; }, (x: BalancerCombatSource) => { x.guardPlate.id = 'SECOND-PLATE' as never; }, (x: BalancerCombatSource) => { x.freeSkillLibrary = true as never; }, (x: BalancerCombatSource) => { x.root.guide.location = 'A'; }]) { const x = source(); mutate(x); expect(validBalancerCombatSource(x)).toBe(false); }
  });
  it('preserves Justiciar30/20/35/15 core, tier1250 and original finite status penalties', () => {
    scripted([1, 1, 400, 100, 1]); const { round } = replayBalancerCombatRound(source(), 'PREPARE');
    expect(round.playerAdvantage).toBeCloseTo(1250 + 10 * .3 + 20 * .2 + 30 * .35 + 40 * .15 - 22.5); expect(round.enemyAdvantage).toBeCloseTo(1250 + 22 - 22.5);
  });
  it('separates actual mental-only consequence from ordinary physical injury and death', () => {
    scripted([1, 1, 425, 90, 1000000]); const mental = replayBalancerCombatRound(source(), 'DEFEND');
    expect(mental.round.consequenceDomain).toBe('MENTAL'); expect(mental.round.balancerOutcome!.playerMindAfter).toBe(88); expect(mental.round.balancerOutcome!.playerHealthAfter).toBe(100); expect(mental.round.consequenceWeights).toBeNull(); vi.restoreAllMocks();
    scripted([1, 1, 1, 1, 1, 100]); const body = replayBalancerCombatRound(source(), 'ATTACK');
    expect(body.outcome).toBe('ENEMY_DEAD'); expect(body.round.consequenceDomain).toBe('BODY'); expect(body.round.balancerOutcome!.weaponLocation).toBe('COURT');
  });
  it('retreat uses the shared50 percent check and consumes actual time without teleport or heal', () => {
    scripted([1, 1, 1]); const result = replayBalancerCombatRound(source(), 'RETREAT'); expect(result.outcome).toBe('RETREATED'); expect(result.round.retreat).toBe('SUCCESS');
    expect(result.round.balancerOutcome).toMatchObject({ elapsedSeconds: 60, playerHealthAfter: 100, playerMindAfter: 98, playerSpiritualityAfter: 120, rootAfter: { playerLocation: 'A', clockSeconds: 76 } });
  });
});
/** Reconciliation unit freezes all inputs before the terminal result; uses the
 * production shared finance resolver, never relaxes combat resource equality. */
function terminalFinance(finance: Partial<BalancerPreparation['finance']> = {}, cash = 1000, actions = 2) {
  const x = source(); x.preparation.before.actions = x.preparation.after.actions = actions; x.preparation.before.cash = x.preparation.after.cash = cash;
  Object.assign(x.preparation.finance, finance); const spy = scripted([1, 1, 1]), result = replayBalancerCombatRound(x, 'RETREAT'), o = result.round.balancerOutcome!, prep = x.preparation; spy.mockRestore();
  const s = { revision: o.source.revision + 1, runId: x.runId, week: prep.week, date: { ...prep.date }, status: 'ACTIVE', cash, actionsRemaining: actions - 2,
    health: o.playerHealthAfter, mind: o.playerMindAfter, spirituality: o.playerSpiritualityAfter, injuries: structuredClone(o.playerInjuriesAfter), injuryRisk: o.playerRiskAfter,
    balancer: { life: { guardPlate: { ...structuredClone(o.guardPlateAfter), location: o.guardPlateAfter.holder === 'PLAYER' ? 'START' : 'OUTSIDE' } } }, progression: { mastery: { ...o.masteryAfter }, acting: prep.after.acting }, seer: { pollution: prep.after.pollution, completedSources: [...prep.after.completedSources] },
    character: { coreStats: { ...prep.after.coreStats } }, random: { cursor: o.randomCursorAfter }, ...structuredClone(prep.finance), pulse: 'NONE', billAmount: 0, activeEvent: null, eventQueue: [], chronicle: [] } as unknown as SliceState;
  s.chronicle.push({ id: `record-${s.revision}-0`, week: prep.week, title: '原卡斯帕冲突结束', text: '沿普通出口离开。' });
  if (actions === 2) {
    const billing = resolveSliceWeeklyFinance({ ...prep.finance, cash, week: prep.week, revision: o.source.revision, pulse: 'BILL', billAmount: 0 }); Object.assign(s, billing.state); s.revision = o.source.revision + 1;
    for (const receipt of billing.receipts) s.chronicle.push({ id: `record-${s.revision}-${s.chronicle.length}`, week: prep.week, ...receipt });
    if (billing.eventId) s.activeEvent = { id: billing.eventId, instanceId: `${s.runId}:${billing.eventId}:${s.revision}:${s.chronicle.length}` };
    else { s.week++; s.date = addGameWeeks(prep.date, 1); s.actionsRemaining = prep.finance.weeklyBudget; s.lifeTier = s.nextLifeTier; s.pulse = 'NONE'; s.billAmount = 0;
      s.chronicle.push({ id: `record-${s.revision}-${s.chronicle.length}`, week: s.week, title: '新的一周', text: `日期推进7天，本周${prep.finance.weeklyBudget}次行动。` }); }
  }
  return { s, o, prep };
}
describe('Balancer exact zero-action terminal finance', () => {
  it('accepts paid bill and exact week advance without refilling combat resources', () => {
    const { s, o, prep } = terminalFinance(); expect(balancerTerminalBudgetMatches(s, prep, o)).toBe(true); expect(s.week).toBe(prep.week + 1);
    for (const change of [(v: SliceState) => { v.spirituality++; }, (v: SliceState) => { v.mind++; }, (v: SliceState) => { v.cash++; }, (v: SliceState) => { v.actionsRemaining--; }, (v: SliceState) => { v.week++; }, (v: SliceState) => { v.random.cursor++; }, (v: SliceState) => { v.progression.mastery[IMBALANCE]!++; }]) { const bad = structuredClone(s); change(bad); expect(balancerTerminalBudgetMatches(bad, prep, o)).toBe(false); }
  });
  it('accepts unpaid billing interruption and rejects invented event IDs and receipts', () => {
    const { s, o, prep } = terminalFinance({}, 0); expect(s.activeEvent?.id).toBe('LIFE-BILL-01'); expect(s.week).toBe(prep.week); expect(balancerTerminalBudgetMatches(s, prep, o)).toBe(true);
    s.activeEvent!.instanceId += ':forged'; expect(balancerTerminalBudgetMatches(s, prep, o)).toBe(false);
  });
  it('accepts existing debt repayment, notice/suspension and new debt exemption exactly', () => {
    for (const missedWeeks of [0, 1, 3]) {
      const f = { debts: [{ id: 'old-debt', source: '约定账目', remaining: 100, weeklyPayment: 30, createdWeek: 0 }], missedWeeks, credit: 'NORMAL' as const };
      const { s, o, prep } = terminalFinance(f, 30); expect(balancerTerminalBudgetMatches(s, prep, o)).toBe(true);
      const bad = structuredClone(s); bad.debts[0]!.remaining--; expect(balancerTerminalBudgetMatches(bad, prep, o)).toBe(false);
    }
    const fresh = terminalFinance({ debts: [{ id: 'new-debt', source: '本周账目', remaining: 100, weeklyPayment: 30, createdWeek: 1 }] }, 1000); expect(fresh.s.debts[0]!.remaining).toBe(100); expect(balancerTerminalBudgetMatches(fresh.s, fresh.prep, fresh.o)).toBe(true);
    const suspended = terminalFinance({ credit: 'SUSPENDED', missedWeeks: 4 }, 0); expect(suspended.s.debts.length).toBe(1); expect(balancerTerminalBudgetMatches(suspended.s, suspended.prep, suspended.o)).toBe(true);
  });
  it('retains strict same-week cash/actions when a terminal round leaves action budget', () => {
    const { s, o, prep } = terminalFinance({}, 1000, 3); expect(balancerTerminalBudgetMatches(s, prep, o)).toBe(true);
    s.week++; expect(balancerTerminalBudgetMatches(s, prep, o)).toBe(false); s.week--; s.actionsRemaining++; expect(balancerTerminalBudgetMatches(s, prep, o)).toBe(false);
  });
});


import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { BALANCER_CASE_IDS, replayBalancerLifeRoot, type BalancerActivityCommand, type BalancerCaseId } from '../../src/domain/balancer/life.js';
import { BALANCER_PREPARATION_IDS } from '../../src/domain/balancer/types.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { hasBalancerDisputeOpponent, validateBalancerEncounter } from '../../src/domain/balancer/encounter.js';
import { directedInitial3, dose, ba, promoted, rejectBalancer, rejectIntent, step } from './balancer-directed-helper.js';
function ordinary(s: SliceState, caseId: BalancerCaseId): SliceState {
  const commands: BalancerActivityCommand[] = [{ type: 'OBSERVE', caseId }, { type: 'PREPARE', caseId, method: 'ORDINARY' }, { type: 'WALK', caseId, to: 'A' }, { type: 'CHECK_ORIGINALS', caseId }, { type: 'CONSENT_MIRA', caseId }, { type: 'SETUP_OBJECTS', caseId }];
  if (caseId === 'measured-impact') commands.push({ type: 'TAKE_PARCEL', caseId });
  commands.push({ type: 'WALK', caseId, to: 'B' });
  if (caseId === 'withdrawn-inspection') commands.push({ type: 'REMOVE_COVER', caseId });
  if (caseId === 'measured-impact') commands.push({ type: 'ORDINARY_BRACE', caseId });
  commands.push({ type: 'MANUAL_INSPECTION', caseId }, { type: 'TAKE_OBJECT', caseId }, { type: 'WALK', caseId, to: 'A' }, { type: 'RETURN_OBJECTS', caseId }, { type: 'WALK', caseId, to: 'START' }, { type: 'INSPECT', caseId }, { type: 'LEAVE', caseId }, { type: 'REPORT', caseId });
  for (const c of commands) s = ba(s, c); return s;
}
let readyCache: SliceState | undefined;
function ready() { if (!readyCache) { let s = ba(promoted(), { type: 'BUY_GUARD_PLATE' }); for (const id of BALANCER_CASE_IDS) s = ordinary(s, id); readyCache = ba(s, { type: 'REFLECT' }); } return structuredClone(readyCache); }
const fight = (s = ready()) => ba(ba(ba(s, { type: 'PREPARE_ENCOUNTER' }), { type: 'ENCOUNTER_TALK' }), { type: 'ENCOUNTER_FIGHT' });
function financialReady(cash: number, finance: Partial<Pick<SliceState, 'debts' | 'missedWeeks' | 'credit' | 'lifeTier' | 'nextLifeTier'>> = {}) {
  let s = directedInitial3(); s.actionsRemaining = s.weeklyBudget = 100 - ready().actionsRemaining + 2; s.cash -= ready().cash - cash; Object.assign(s, finance);
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] }); let selected: number | null = null;
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 128; cursor++) { const rng = new DeterministicActionRandomStream(s.random.seed, cursor), potion = rng.nextInt(1, 100);
    rng.nextInt(1, 100); rng.nextInt(1, 100); if (potion > 5 && potion <= chance && rng.nextInt(1, 100) <= 50) { selected = cursor; break; } }
  expect(selected).not.toBeNull(); s.random.cursor = selected!; assertValidSliceState(s);
  s = ba(s, { type: 'LEARN_GUIDANCE' }); for (const taskId of BALANCER_PREPARATION_IDS) s = ba(s, { type: 'PREPARE_TASK', taskId });
  s = ba(s, { type: 'BUY_POTION', bottleId: 'balancer-potion-1' }); s = ba(s, { type: 'PREPARE_PROMOTION' }); s = ba(s, dose); s = ba(s, { type: 'BUY_GUARD_PLATE' });
  for (const id of BALANCER_CASE_IDS) s = ordinary(s, id); s = ba(s, { type: 'REFLECT' }); expect(s.actionsRemaining).toBe(2); expect(s.cash).toBe(cash); return s;
}
/** Explicit opt-in capture, fresh output directory only. No natural evidence is replaced. */
function captureDirectedFinanceBoundaries(boundaries: Record<string, { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }>): void {
  const requested = process.env.BALANCER_DIRECTED_CAPTURE_DIR; if (!requested) return;
  const directory = resolve(requested), insideOutput = relative(resolve('output'), directory);
  if (!insideOutput || insideOutput === '..' || insideOutput.startsWith(`..${sep}`) || isAbsolute(insideOutput)) throw new Error('BALANCER_DIRECTED_CAPTURE_DIR must name a fresh directory inside output/.');
  if (existsSync(directory)) throw new Error(`Refusing to replace an existing directed capture directory: ${directory}`);
  mkdirSync(dirname(directory), { recursive: true }); mkdirSync(directory); const index: Record<string, string> = {};
  for (const [name, boundary] of Object.entries(boundaries)) { const filename = `${name}.json`; index[name] = filename;
    writeFileSync(resolve(directory, filename), JSON.stringify({ provenance: 'DECLARED_UNIT_FINANCIAL_BRANCH_NOT_NATURAL',
      sourceDeclaration: 'The complete actual living483-command recovery prefix and separate dead477 history remain unchanged. Before the first Balancer journal, this directed unit declares maturity, cash, action budget, financial variants and a bounded original-seed cursor. Every acquisition, ordinary practice, plate purchase, preparation and terminal command afterward uses the public API. This is directed boundary coverage, not a natural result.', ...boundary }), { flag: 'wx' }); }
  writeFileSync(resolve(directory, 'directed.index.json'), JSON.stringify(index, null, 2), { flag: 'wx' });
}
describe('Balancer original room encounter through public commands', () => {
  it('moves original Mira and Vina OUTSIDE with their objects before independent Caspar combat', () => {
    const before = ready(), s = fight(before), e = s.balancer.encounter;
    expect(hasBalancerDisputeOpponent(s)).toBe(true); expect(validateBalancerEncounter(s)).toBe(true);
    expect(s.chaosHunter.life.volunteer).toMatchObject({ id: 'CH3-MIRA', age: 43, alive: true, location: 'OUTSIDE' }); expect(s.chaosHunter.life.guide.location).toBe('OUTSIDE');
    for (const item of [s.chaosHunter.life.parcel, s.chaosHunter.life.line, s.chaosHunter.life.paper]) expect(item).toMatchObject({ holder: 'GUIDE', location: 'OUTSIDE' });
    expect(s.chaosHunter.life.parcel).toMatchObject({ massGrams: 350, quantity: 1 }); expect(s.balancer.life.guardPlate).toEqual({ ...before.balancer.life.guardPlate, location: 'A' });
    expect(e.clearance).toMatchObject({ miraMetres: 8, guideMetres: 4, elapsedSeconds: 16 }); expect(s.chaosHunter.life.clockSeconds - before.chaosHunter.life.clockSeconds).toBe(16);
    expect(e).toMatchObject({ targetId: 'BA2-CASPAR', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120 }); expect(s.chaosHunter.encounter).toEqual(before.chaosHunter.encounter); expect(s.chaosHunter.encounter.enemyStatus).toBe('SURRENDERED');
    expect(s.chaosHunter.life.cases).toEqual(before.chaosHunter.life.cases); expect(s.combatHistory).toEqual(before.combatHistory); expect(s.progression.mastery).toEqual(before.progression.mastery); expect(Object.keys(s.progression.mastery)).toHaveLength(17);
    rejectIntent(s, { type: 'ACTION', action: 'REST' }); const bad = structuredClone(s); bad.chaosHunter.life.guide.location = 'START'; expect(validateBalancerEncounter(bad)).toBe(false);
  });
  it('keeps preparation and exit costs, actual plate location, and old enemy outcome without respawn', () => {
    const before = ready(), prepared = ba(before, { type: 'PREPARE_ENCOUNTER' }); expect(prepared.mind).toBe(before.mind - 2); rejectBalancer(prepared, { type: 'PREPARE_ENCOUNTER' });
    const left = ba(ba(prepared, { type: 'ENCOUNTER_TALK' }), { type: 'LEAVE_ENCOUNTER' }); expect(left.chaosHunter.life.playerLocation).toBe('START'); expect(left.balancer.life.guardPlate).toEqual(before.balancer.life.guardPlate);
    expect(left.balancer.encounter.enemyHealth).toBe(100); expect(left.combatHistory).toEqual(before.combatHistory); expect(left.chaosHunter.encounter).toEqual(before.chaosHunter.encounter);
    expect(left.chaosHunter.life.clockSeconds - before.chaosHunter.life.clockSeconds).toBe(20); rejectBalancer(left, { type: 'ENCOUNTER_TALK' }); assertValidSliceState(left);
  });
  it('replays saved original plate, preparation, financial source and all previous real rounds', () => {
    let s = fight(); s = step(s, { type: 'COMBAT_ROUND', stance: 'DEFEND' }); expect(validateBalancerEncounter(s)).toBe(true); assertValidSliceState(s);
    const saved = JSON.parse(JSON.stringify(s)) as SliceState; assertValidSliceState(saved);
    for (const mutate of [(v: SliceState) => { v.balancer.life.guardPlate.integrity++; }, (v: SliceState) => { v.balancer.encounter.preparation!.before.guardPlate.integrity--; }, (v: SliceState) => { v.balancer.encounter.startSource!.targetId = 'CH3-EDRIC' as never; }, (v: SliceState) => { v.balancer.encounter.preparation!.finance.weeklyBudget--; }]) { const bad = structuredClone(s); mutate(bad); expect(validateBalancerEncounter(bad)).toBe(false); }
  });
  it('settles actual zero-AP terminal through paid bill, interrupted bill, NOTICE, SUSPENDED and new debt', () => {
    const variants: [number, Parameters<typeof financialReady>[1]][] = [[1000, {}], [0, {}], [30, { debts: [{ id: 'old', source: '约定账目', remaining: 100, weeklyPayment: 30, createdWeek: 1 }], missedWeeks: 1 }],
      [30, { debts: [{ id: 'old', source: '约定账目', remaining: 100, weeklyPayment: 30, createdWeek: 1 }], missedWeeks: 3 }], [0, { credit: 'SUSPENDED', missedWeeks: 4 }]];
    const names = ['zero-ap-paid-bill-and-advance', 'zero-ap-unpaid-bill-interruption', 'zero-ap-second-missed-payment-notice', 'zero-ap-fourth-missed-payment-suspension', 'zero-ap-suspended-shortfall-new-debt'] as const;
    const captured: Parameters<typeof captureDirectedFinanceBoundaries>[0] = {};
    for (const [variantIndex, [cash, finance]] of variants.entries()) {
      const original = financialReady(cash, finance), fighting = fight(original); expect(fighting.actionsRemaining).toBe(0); const lastIntent: SliceIntent = { type: 'COMBAT_ROUND', stance: 'RETREAT' }, s = step(fighting, lastIntent);
      expect(s.balancer.encounter.status).toBe('RETREATED'); const o = s.combatHistory.at(-1)!.balancerOutcome!;
      expect(validateBalancerEncounter(s), JSON.stringify({ cash, finance, life: !!replayBalancerLifeRoot(s), budget: balancerTerminalBudgetMatches(s, s.balancer.encounter.preparation!, o), revision: s.revision, week: s.week, pulse: s.pulse, actions: s.actionsRemaining, activeEvent: s.activeEvent, chronicle: s.chronicle.slice(-6) })).toBe(true); assertValidSliceState(s);
      expect([s.health, s.mind, s.spirituality]).toEqual([o.playerHealthAfter, o.playerMindAfter, o.playerSpiritualityAfter]); expect(s.balancer.life.guardPlate.integrity).toBe(o.guardPlateAfter.integrity);
      for (const mutate of [(v: SliceState) => { v.cash++; }, (v: SliceState) => { v.spirituality++; }, (v: SliceState) => { v.mind++; }, (v: SliceState) => { v.actionsRemaining++; }, (v: SliceState) => { v.random.cursor++; }]) { const bad = structuredClone(s); mutate(bad); expect(validateBalancerEncounter(bad)).toBe(false); }
      if (process.env.BALANCER_DIRECTED_CAPTURE_DIR) captured[names[variantIndex]!] = { beforeLast: structuredClone(fighting), lastIntent: structuredClone(lastIntent), final: structuredClone(s) };
    }
    captureDirectedFinanceBoundaries(captured);
  });
});
