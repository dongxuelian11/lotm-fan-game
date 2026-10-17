import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { createCoffinBearerLifeState } from '../../src/domain/coffin-bearer/life.js';
import { combatBody, createBarrenMatriarchEncounterState, barrenMatriarchTerminalBudgetMatches, validateBarrenMatriarchEncounterCommand, validateBarrenMatriarchPreparation, type BarrenMatriarchPreparation } from '../../src/domain/barren-matriarch/encounter.js';
import { DORMANCY, ROOT_BUFFER, BODY, FOLLOWUP, PRESERVATION, MATRIX, LIFE_SUPPORT, CAREFUL, SPECIMEN, BARREN_MATRIARCH_COUNT_WHEEL, BARREN_MATRIARCH_ENEMY_ABILITY_WHEEL,
  advanceBarrenMatriarchCombatClock, createBarrenMatriarchRuntime, barrenMatriarchAbilityWheel, nextBarrenMatriarchCombatSource, replayBarrenMatriarchCombatRound,
  resolveBarrenMatriarchEnemySlot, resolveBarrenMatriarchPlayerSlot, validateBarrenMatriarchCombatRound, validateBarrenMatriarchRoundOutcome, validBarrenMatriarchCombatSource,
  type BarrenMatriarchCombatSource, type BarrenMatriarchRoundOutcome } from '../../src/domain/barren-matriarch/combat.js';
import type { BarrenMatriarchSceneRoot, BarrenMatriarchRootPad } from '../../src/domain/barren-matriarch/life.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { resolveSliceWeeklyFinance } from '../../src/domain/slice/weekly-finance.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';

/** Declared UNIT-only source, never edits a natural prefix or an old original roll. */
function source(): BarrenMatriarchCombatSource {
  const root: BarrenMatriarchSceneRoot = createCoffinBearerLifeState(); root.introducedWeek = 1; root.playerLocation = 'A'; root.owner.location = root.recipient.location = 'OUTSIDE';
  root.box.holder = root.tag.holder = root.paper.holder = 'OWNER'; root.box.sampleId = null;
  root.samples[0]!.holder = 'RECIPIENT'; root.samples[0]!.care = 'RECIPIENT_CARE';
  for (const p of root.pads) p.holder = 'OWNER';
  for (const item of [...root.samples, root.box, root.tag, root.paper, ...root.pads]) item.location = 'OUTSIDE';
  root.clockSeconds = root.externalSeconds = 24; root.playerTravelMetres = 4;
  Object.assign(root.guard, { prepared: true, owner: 'PLAYER', location: 'HAND', preparedWeek: 1, actionsSpent: 1, costPence: 120, spiritualitySpent: 4 });
  root.guard.segments.forEach((v, i) => { v.status = i === 0 ? 'SPENT' : 'UNUSED'; });
  const rootPad: BarrenMatriarchRootPad = { id: 'BM2-ROOT-PAD', sourceId: 'BM2-ROOT-FIBRE-STOCK', material: 'PLANT_FIBRE', quantity: 1, owner: 'PLAYER', holder: 'PLAYER', location: 'START', integrity: 65, acquiredWeek: 1 };
  const before = { cash: 1000, actions: 100, health: 100, mind: 100, spirituality: 120, pollution: 0, gender: 'FEMALE', sequence: 2 as const, acting: 100, coreStats: { physique: 10, perception: 20, will: 30, knowledge: 40 },
    mastery: { [DORMANCY]: 0, [ROOT_BUFFER]: 0, [CAREFUL]: 0, [LIFE_SUPPORT]: 0, [SPECIMEN]: 0, [PRESERVATION]: 0, [MATRIX]: 0 }, completedSources: [], injuries: [], injuryRisk: 0, rootPad, guard: structuredClone(root.guard) };
  const date = { epoch: 'FIFTH_EPOCH' as const, year: 1349, month: 6, day: 28 };
  return { runId: 'barren-matriarch-combat-declared-unit', revision: 4, week: 1, date, round: 1, encounterId: 'BARREN_MATRIARCH_DISPUTE', targetId: 'BM2-MARTIN', attemptWeek: 1, startHistoryIndex: 0,
    targetName: '马丁·里德', targetAge: 45, targetPathway: 'original-caster', targetSequence: 3, targetCore: 22, actualBody: true, independentMind: true, enemyWeapon: 'BM2-MARTIN-ROD', weaponOwner: 'BM2-MARTIN', yardId: 'CB3-NURSERY-TRANSFER', enemyPosition: 'BETWEEN_A_AND_B', enemyDistanceMetres: 2,
    ordinaryExit: 'OPEN', pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false, freeSkillLibrary: false, playerHealth: 100, playerMind: 98, playerSpirituality: 120, playerInjuries: [], playerRisk: 0,
    ...before.coreStats, mastery: { ...before.mastery }, clubHeld: false, rootPad: { ...rootPad, location: 'A' },
    preparation: { week: 1, date, revision: 2, runId: 'barren-matriarch-combat-declared-unit', randomSeed: 'barren-matriarch-combat-declared-unit', randomCursor: 0, mindPaid: 2, lifeJournalLength: 1, lifeClockSeconds: 0, before, after: { ...before, mind: 98 },
      finance: { weeklyBudget: 100, lifeTier: 'DESTITUTE', nextLifeTier: 'DESTITUTE', debts: [], missedWeeks: 0, credit: 'NORMAL' } },
    root, body: combatBody(createBarrenMatriarchEncounterState()), randomSeed: 'barren-matriarch-combat-declared-unit', randomCursor: 0 };
}
function random(...rolls: number[]): ActionRandomStream { let cursor = 0; return { seed: 'declared-slot-unit', get cursor() { return cursor; }, nextInt(min, max) { const n = rolls[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected declared draw ${n} in ${min}..${max}`); return n; } }; }
function scripted(rolls: number[]) {
  let cursor = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function(this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = rolls[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected directed draw ${n} in ${min}..${max}`); return n;
  });
}
afterEach(() => vi.restoreAllMocks());

describe('Barren Matriarch exact original combat kernel', () => {
  it('retains actual Coffin Bearer six count slots and original ability weights', () => {
    expect(BARREN_MATRIARCH_COUNT_WHEEL.map(x => x.weight)).toEqual([12, 20, 25, 23, 14, 6]);
    const wheel = barrenMatriarchAbilityWheel({} as SliceState, null);
    expect(wheel.map(x => x.weight)).toEqual([30, 15, 25, 10, 15, 5]); expect(wheel.map(x => x.id)).toEqual([BODY, FOLLOWUP, ROOT_BUFFER, PRESERVATION, LIFE_SUPPORT, 'ACCIDENT']);
    expect(wheel.some(x => x.id === DORMANCY)).toBe(false); expect(BARREN_MATRIARCH_ENEMY_ABILITY_WHEEL.reduce((n, x) => n + x.weight, 0)).toBe(100);
    expect(validBarrenMatriarchCombatSource(source())).toBe(true); expect(validateBarrenMatriarchPreparation(source().preparation)).toBe(true);
    expect(validateBarrenMatriarchEncounterCommand({ type: 'PREPARE_ENCOUNTER' })).toBe(true); expect(validateBarrenMatriarchEncounterCommand({ type: 'ENCOUNTER_FIGHT', reset: true })).toBe(false);
  });
  it('preserves ordinary body12, held club16 and careful side blow8.4 at legal zero mastery', () => {
    const x = source(), r = createBarrenMatriarchRuntime(x);
    expect(resolveBarrenMatriarchPlayerSlot(x, r, BODY, 0, random()).selfGain).toBe(12);
    expect(resolveBarrenMatriarchPlayerSlot(x, r, FOLLOWUP, 1, random()).selfGain).toBeCloseTo(8.4 * .65);
    x.clubHeld = true; expect(resolveBarrenMatriarchPlayerSlot(x, r, BODY, 2, random()).selfGain).toBe(16);
    expect(r.root.guard).toEqual(x.root.guard); expect(r.mastery).toEqual(x.mastery);
  });
  it('never applies plant dormancy to an independent living human', () => {
    const x = source(), r = createBarrenMatriarchRuntime(x), a = resolveBarrenMatriarchPlayerSlot(x, r, DORMANCY, 0, random());
    expect(a).toMatchObject({ selectedAbility: 'OBSERVE', fallbackReason: 'HUMAN_IS_NOT_A_LIVING_PLANT', paidCost: 0, mindCost: 0, selfGain: 0, enemyReduction: 0, check: null });
    expect(r.pending).toEqual([]); expect(r.body.enemyMind).toBe(100); expect(r.mastery[DORMANCY]).toBe(0);
  });
  it('charges failed buffer but wears and rewards only actual later body contact', () => {
    const x = source(), r = createBarrenMatriarchRuntime(x), failed = resolveBarrenMatriarchPlayerSlot(x, r, ROOT_BUFFER, 0, random(100));
    expect(failed).toMatchObject({ paidCost: 6, mindCost: 1, succeeded: false, padWear: 0 }); expect(r.rootPad.integrity).toBe(65); expect(r.mastery[ROOT_BUFFER]).toBe(0);
    resolveBarrenMatriarchPlayerSlot(x, r, ROOT_BUFFER, 1, random(1)); expect(r.mastery[ROOT_BUFFER]).toBe(0);
    const arc = resolveBarrenMatriarchEnemySlot(x, r, 'ARC_BOLT', 2, random()), mind = resolveBarrenMatriarchEnemySlot(x, r, 'MENTAL_PRESSURE', 3, random());
    expect(arc.selfGain).toBe(70); expect(mind.selfGain).toBe(45); expect(r.pending).toHaveLength(1); expect(r.rootPad.integrity).toBe(65);
    const body = resolveBarrenMatriarchEnemySlot(x, r, 'BODY_STRIKE', 4, random()); expect(body).toMatchObject({ rawContribution: 20, selfGain: 0, padWear: 15, threatens: false });
    expect(r.rootPad.integrity).toBe(50); expect(r.mastery[ROOT_BUFFER]).toBe(8); expect(r.pending).toEqual([]); expect(r.playerS).toBe(108); expect(r.playerM).toBe(96);
    expect(resolveBarrenMatriarchEnemySlot(x, r, 'BODY_STRIKE', 5, random()).selfGain).toBe(20); expect(r.rootPad.integrity).toBe(50);
  });
  it('does not stack, refresh, refund, regrow or clear physical buffer through enemy composure', () => {
    const x = source(), r = createBarrenMatriarchRuntime(x); resolveBarrenMatriarchPlayerSlot(x, r, ROOT_BUFFER, 0, random(1)); const expiry = r.pending[0]!.expiresAt;
    expect(resolveBarrenMatriarchPlayerSlot(x, r, ROOT_BUFFER, 1, random()).paidCost).toBe(0);
    const compose = resolveBarrenMatriarchEnemySlot(x, r, 'COMPOSE', 2, random()); expect(compose.paidCost).toBe(4); expect(r.pending[0]!.expiresAt).toBe(expiry);
    advanceBarrenMatriarchCombatClock(r, expiry - r.root.clockSeconds); expect(r.pending).toEqual([]); expect(r.rootPad.integrity).toBe(65); expect(r.playerS).toBe(114); expect(r.mastery[ROOT_BUFFER]).toBe(0);
  });
  it('consumes exactly the two remaining original guard segments and never refills the already spent first one', () => {
    const x = source(), r = createBarrenMatriarchRuntime(x);
    const fail = resolveBarrenMatriarchPlayerSlot(x, r, PRESERVATION, 0, random(100)); expect(fail).toMatchObject({ paidCost: 5, guardSegmentId: 'CB3-SEG2', succeeded: false });
    const success = resolveBarrenMatriarchPlayerSlot(x, r, PRESERVATION, 1, random(1)); expect(success).toMatchObject({ paidCost: 5, guardSegmentId: 'CB3-SEG3', succeeded: true });
    expect(resolveBarrenMatriarchEnemySlot(x, r, 'WARD', 2, random()).selfGain).toBe(0); expect(r.pending[0]!.remaining).toBe(2);
    resolveBarrenMatriarchEnemySlot(x, r, 'COMPOSE', 3, random()); expect(r.pending[0]!.remaining).toBe(2);
    expect(resolveBarrenMatriarchEnemySlot(x, r, 'ARC_BOLT', 4, random()).selfGain).toBe(56);
    expect(resolveBarrenMatriarchEnemySlot(x, r, 'BODY_STRIKE', 5, random()).selfGain).toBe(16); expect(r.pending).toEqual([]);
    expect(r.root.guard.segments.map(x => x.status)).toEqual(['SPENT', 'SPENT', 'SPENT']);
    const fallback = resolveBarrenMatriarchPlayerSlot(x, r, PRESERVATION, 6, random()); expect(fallback).toMatchObject({ paidCost: 0, guardSegmentId: null, enemyReduction: 6, fallbackReason: 'NO_REMAINING_ORIGINAL_SEGMENT' });
    expect(r.body.preservationAttempts).toBe(2); expect(r.playerS).toBe(110); expect(r.mastery[PRESERVATION]).toBe(0);
  });
  it('root-pad shortage uses only actual inherited matrix material and never grants new mastery', () => {
    const x = source(), r = createBarrenMatriarchRuntime(x); r.rootPad.integrity = 14;
    const a = resolveBarrenMatriarchPlayerSlot(x, r, ROOT_BUFFER, 0, random(1)); expect(a).toMatchObject({ selectedAbility: MATRIX, paidCost: 4, guardSegmentId: 'CB3-SEG2', mindCost: 0 });
    expect(resolveBarrenMatriarchEnemySlot(x, r, 'BODY_STRIKE', 1, random()).selfGain).toBe(12); expect(r.rootPad.integrity).toBe(14); expect(r.mastery[ROOT_BUFFER]).toBe(0);
    r.root.guard.segments.forEach(v => { v.status = 'SPENT'; }); const none = resolveBarrenMatriarchPlayerSlot(x, r, ROOT_BUFFER, 2, random());
    expect(none.paidCost).toBe(0); expect(none.enemyReduction).toBeCloseTo(42.25 * .65);
  });
  it('inherited life support restores real health only and keeps actual wounds and risk', () => {
    const x = source(), r = createBarrenMatriarchRuntime(x); expect(resolveBarrenMatriarchPlayerSlot(x, r, LIFE_SUPPORT, 0, random()).paidCost).toBe(0);
    r.playerH = 70; const a = resolveBarrenMatriarchPlayerSlot(x, r, LIFE_SUPPORT, 1, random()); expect(a).toMatchObject({ recoveredHealth: 9, playerHealthAfter: 79, paidCost: 4, selfGain: 0 }); expect(r.playerM).toBe(98);
  });
  it('enemy depleted spells fall back to the actual original staff without redraw or recharge', () => {
    const x = source(), r = createBarrenMatriarchRuntime(x); r.body.enemySpirituality = 3;
    const a = resolveBarrenMatriarchEnemySlot(x, r, 'MENTAL_PRESSURE', 0, random()); expect(a).toMatchObject({ id: 'BODY_STRIKE', attackKind: 'BODY', paidCost: 0 }); expect(r.body.enemySpirituality).toBe(3);
  });
  it('replays exact seed and rejects enemy, guard, pad, cost, mastery and cursor edits', () => {
    const { round } = replayBarrenMatriarchCombatRound(source(), 'DEFEND'); expect(validateBarrenMatriarchCombatRound(round)).toBe(true); const o = round.barrenMatriarchOutcome!;
    for (const change of [(v: BarrenMatriarchRoundOutcome) => { v.enemySpirituality++; }, (v: BarrenMatriarchRoundOutcome) => { v.randomCursorAfter++; }, (v: BarrenMatriarchRoundOutcome) => { v.masteryAfter[ROOT_BUFFER]!++; }, (v: BarrenMatriarchRoundOutcome) => { v.rootPadAfter.integrity--; }, (v: BarrenMatriarchRoundOutcome) => { v.playerMindAfter++; }, (v: BarrenMatriarchRoundOutcome) => { v.rootAfter.guard.segments[0]!.status = 'UNUSED'; }]) { const bad = structuredClone(o); change(bad); expect(validateBarrenMatriarchRoundOutcome(bad)).toBe(false); }
    if (o.continuing) { const next = nextBarrenMatriarchCombatSource(o); expect(next.playerSpirituality).toBe(Math.min(120, o.playerSpiritualityAfter + 12)); expect(next.root.guard).toEqual(o.rootAfter.guard); expect(next.rootPad).toEqual(o.rootPadAfter); expect(validBarrenMatriarchCombatSource(next)).toBe(true); }
  });
  it('rejects old Nolan, dead-plant resurrection, fake extra pad, returned bystander and renewed old segment', () => {
    for (const mutate of [(x: BarrenMatriarchCombatSource) => { x.targetId = 'CB3-NOLAN' as never; }, (x: BarrenMatriarchCombatSource) => { x.root.samples[2]!.alive = true; }, (x: BarrenMatriarchCombatSource) => { x.rootPad.id = 'SECOND-PAD' as never; }, (x: BarrenMatriarchCombatSource) => { x.freeSkillLibrary = true as never; }, (x: BarrenMatriarchCombatSource) => { x.root.owner.location = 'A'; }, (x: BarrenMatriarchCombatSource) => { x.root.guard.segments[0]!.status = 'UNUSED'; x.root.guard.segments[1]!.status = 'SPENT'; }]) { const x = source(); mutate(x); expect(validBarrenMatriarchCombatSource(x)).toBe(false); }
  });
  it('preserves Mother20/15/20/45 core and the original1250 tier', () => {
    scripted([1, 1, 415, 100, 1]); const { round } = replayBarrenMatriarchCombatRound(source(), 'PREPARE');
    expect(round.playerAdvantage).toBeCloseTo(1250 + 10 * .2 + 20 * .15 + 30 * .2 + 40 * .45 - 22.5); expect(round.enemyAdvantage).toBeCloseTo(1250 + 22 - 22.5);
  });
  it('separates mental-only consequences from physical death and surrender', () => {
    scripted([1, 1, 425, 90, 1000000]); const mental = replayBarrenMatriarchCombatRound(source(), 'DEFEND');
    expect(mental.round.consequenceDomain).toBe('MENTAL'); expect(mental.round.barrenMatriarchOutcome!.playerMindAfter).toBe(88); expect(mental.round.barrenMatriarchOutcome!.playerHealthAfter).toBe(100); expect(mental.round.consequenceWeights).toBeNull(); vi.restoreAllMocks();
    scripted([1, 1, 1, 1, 1, 100]); const body = replayBarrenMatriarchCombatRound(source(), 'ATTACK'); expect(body.outcome).toBe('ENEMY_DEAD'); expect(body.round.barrenMatriarchOutcome!.weaponLocation).toBe('COURT'); vi.restoreAllMocks();
    scripted([1, 1, 1, 1, 1, 80]); const surrender = replayBarrenMatriarchCombatRound(source(), 'ATTACK'); expect(surrender.outcome).toBe('ENEMY_SURRENDERED'); expect(surrender.round.barrenMatriarchOutcome).toMatchObject({ enemyHealth: 70, weaponLocation: 'HAND' });
  });
  it('retreat uses shared50 percent check and real60 seconds without free recovery', () => {
    scripted([1, 1, 1]); const result = replayBarrenMatriarchCombatRound(source(), 'RETREAT'); expect(result.outcome).toBe('RETREATED');
    expect(result.round.barrenMatriarchOutcome).toMatchObject({ elapsedSeconds: 60, playerHealthAfter: 100, playerMindAfter: 98, playerSpiritualityAfter: 120, rootAfter: { playerLocation: 'A', clockSeconds: 84, externalSeconds: 84 } });
  });
});

/** Reconciliation unit freezes all inputs before the terminal result; uses the
 * production shared finance resolver, never relaxes combat resource equality. */
function terminalFinance(finance: Partial<BarrenMatriarchPreparation['finance']> = {}, cash = 1000, actions = 2) {
  const x = source(); x.preparation.before.actions = x.preparation.after.actions = actions; x.preparation.before.cash = x.preparation.after.cash = cash;
  Object.assign(x.preparation.finance, finance); const spy = scripted([1, 1, 1]), result = replayBarrenMatriarchCombatRound(x, 'RETREAT'), o = result.round.barrenMatriarchOutcome!, prep = x.preparation; spy.mockRestore();
  const s = { revision: o.source.revision + 1, runId: x.runId, week: prep.week, date: { ...prep.date }, status: 'ACTIVE', cash, actionsRemaining: actions - 2,
    health: o.playerHealthAfter, mind: o.playerMindAfter, spirituality: o.playerSpiritualityAfter, injuries: structuredClone(o.playerInjuriesAfter), injuryRisk: o.playerRiskAfter,
    coffinBearer: { life: { guard: structuredClone(o.rootAfter.guard) } }, barrenMatriarch: { life: { rootPad: { ...structuredClone(o.rootPadAfter), location: 'START' } } }, progression: { mastery: { ...o.masteryAfter }, acting: prep.after.acting }, seer: { pollution: prep.after.pollution, completedSources: [...prep.after.completedSources] },
    character: { gender: prep.after.gender, coreStats: { ...prep.after.coreStats } }, random: { cursor: o.randomCursorAfter }, ...structuredClone(prep.finance), pulse: 'NONE', billAmount: 0, activeEvent: null, eventQueue: [], chronicle: [] } as unknown as SliceState;
  s.chronicle.push({ id: `record-${s.revision}-0`, week: prep.week, title: '原马丁冲突结束', text: '沿普通出口离开。' });
  if (actions === 2) {
    const billing = resolveSliceWeeklyFinance({ ...prep.finance, cash, week: prep.week, revision: o.source.revision, pulse: 'BILL', billAmount: 0 }); Object.assign(s, billing.state); s.revision = o.source.revision + 1;
    for (const receipt of billing.receipts) s.chronicle.push({ id: `record-${s.revision}-${s.chronicle.length}`, week: prep.week, ...receipt });
    if (billing.eventId) s.activeEvent = { id: billing.eventId, instanceId: `${s.runId}:${billing.eventId}:${s.revision}:${s.chronicle.length}` };
    else { s.week++; s.date = addGameWeeks(prep.date, 1); s.actionsRemaining = prep.finance.weeklyBudget; s.lifeTier = s.nextLifeTier; s.pulse = 'NONE'; s.billAmount = 0;
      s.chronicle.push({ id: `record-${s.revision}-${s.chronicle.length}`, week: s.week, title: '新的一周', text: `日期推进7天，本周${prep.finance.weeklyBudget}次行动。` }); }
  }
  return { s, o, prep };
}
describe('BarrenMatriarch exact zero-action terminal finance', () => {
  it('accepts paid bill and exact week advance without refilling combat resources', () => {
    const { s, o, prep } = terminalFinance(); expect(barrenMatriarchTerminalBudgetMatches(s, prep, o)).toBe(true); expect(s.week).toBe(prep.week + 1);
    for (const change of [(v: SliceState) => { v.spirituality++; }, (v: SliceState) => { v.mind++; }, (v: SliceState) => { v.cash++; }, (v: SliceState) => { v.actionsRemaining--; }, (v: SliceState) => { v.week++; }, (v: SliceState) => { v.random.cursor++; }, (v: SliceState) => { v.progression.mastery[ROOT_BUFFER]!++; }]) { const bad = structuredClone(s); change(bad); expect(barrenMatriarchTerminalBudgetMatches(bad, prep, o)).toBe(false); }
  });
  it('accepts unpaid billing interruption and rejects invented event IDs and receipts', () => {
    const { s, o, prep } = terminalFinance({}, 0); expect(s.activeEvent?.id).toBe('LIFE-BILL-01'); expect(s.week).toBe(prep.week); expect(barrenMatriarchTerminalBudgetMatches(s, prep, o)).toBe(true);
    s.activeEvent!.instanceId += ':forged'; expect(barrenMatriarchTerminalBudgetMatches(s, prep, o)).toBe(false);
  });
  it('accepts existing debt repayment, notice/suspension and new debt exemption exactly', () => {
    for (const missedWeeks of [0, 1, 3]) {
      const f = { debts: [{ id: 'old-debt', source: '约定账目', remaining: 100, weeklyPayment: 30, createdWeek: 0 }], missedWeeks, credit: 'NORMAL' as const };
      const { s, o, prep } = terminalFinance(f, 30); expect(barrenMatriarchTerminalBudgetMatches(s, prep, o)).toBe(true);
      const bad = structuredClone(s); bad.debts[0]!.remaining--; expect(barrenMatriarchTerminalBudgetMatches(bad, prep, o)).toBe(false);
    }
    const fresh = terminalFinance({ debts: [{ id: 'new-debt', source: '本周账目', remaining: 100, weeklyPayment: 30, createdWeek: 1 }] }, 1000); expect(fresh.s.debts[0]!.remaining).toBe(100); expect(barrenMatriarchTerminalBudgetMatches(fresh.s, fresh.prep, fresh.o)).toBe(true);
    const suspended = terminalFinance({ credit: 'SUSPENDED', missedWeeks: 4 }, 0); expect(suspended.s.debts.length).toBe(1); expect(barrenMatriarchTerminalBudgetMatches(suspended.s, suspended.prep, suspended.o)).toBe(true);
  });
  it('retains strict same-week cash/actions when a terminal round leaves action budget', () => {
    const { s, o, prep } = terminalFinance({}, 1000, 3); expect(barrenMatriarchTerminalBudgetMatches(s, prep, o)).toBe(true);
    s.week++; expect(barrenMatriarchTerminalBudgetMatches(s, prep, o)).toBe(false); s.week--; s.actionsRemaining++; expect(barrenMatriarchTerminalBudgetMatches(s, prep, o)).toBe(false);
  });
});

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { BARREN_MATRIARCH_CASE_IDS, replayBarrenMatriarchLifeRoot, type BarrenMatriarchActivityCommand, type BarrenMatriarchCaseId } from '../../src/domain/barren-matriarch/life.js';
import { BARREN_MATRIARCH_PREPARATION_IDS } from '../../src/domain/barren-matriarch/types.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { hasBarrenMatriarchDisputeOpponent, validateBarrenMatriarchEncounter } from '../../src/domain/barren-matriarch/encounter.js';
import { directedInitial3, dose, ba, promoted, rejectBarrenMatriarch, rejectIntent, step } from './barren-matriarch-directed-helper.js';
function ordinary(s: SliceState, caseId: BarrenMatriarchCaseId): SliceState {
  const first = caseId === 'bounded-dormancy', second = caseId === 'withdrawn-transfer', third = caseId === 'finite-root-buffer';
  const commands: BarrenMatriarchActivityCommand[] = [{ type: 'OBSERVE', caseId }, { type: 'PREPARE', caseId, method: 'ORDINARY' }, { type: 'WALK', caseId, to: 'A' }, { type: 'CHECK_ORIGINALS', caseId }, { type: 'CONSENT_OWNER', caseId }, { type: 'TAKE_KIT', caseId }];
  if (first) commands.push({ type: 'WALK', caseId, to: 'B' });
  commands.push({ type: 'CHECK_SAMPLE', caseId }, { type: 'CONSENT_SAMPLE', caseId }, { type: 'TAKE_SAMPLE', caseId }, { type: 'WALK', caseId, to: first ? 'A' : 'B' });
  if (second) commands.push({ type: 'WITHDRAW_PERMISSION', caseId });
  commands.push({ type: 'VERIFY_TRANSPORT', caseId });
  if (third) commands.push({ type: 'CONFIRM_LIMITED', caseId }, { type: 'ORDINARY_SUPPORT', caseId });
  commands.push({ type: 'WALK', caseId, to: first ? 'B' : 'A' }, { type: 'RETURN_SAMPLE', caseId });
  if (first) commands.push({ type: 'WALK', caseId, to: 'A' });
  commands.push({ type: 'RETURN_KIT', caseId }, { type: 'WALK', caseId, to: 'START' }, { type: 'INSPECT', caseId }, { type: 'LEAVE', caseId }, { type: 'REPORT', caseId });
  for (const c of commands) s = ba(s, c); return s;
}
let readyCache: SliceState | undefined;
function ready() { if (!readyCache) { let s = ba(promoted(), { type: 'BUY_ROOT_PAD' }); for (const id of BARREN_MATRIARCH_CASE_IDS) s = ordinary(s, id); readyCache = ba(s, { type: 'REFLECT' }); } return structuredClone(readyCache); }
const fight = (s = ready()) => ba(ba(ba(s, { type: 'PREPARE_ENCOUNTER' }), { type: 'ENCOUNTER_TALK' }), { type: 'ENCOUNTER_FIGHT' });
function financialReady(cash: number, finance: Partial<Pick<SliceState, 'debts' | 'missedWeeks' | 'credit' | 'lifeTier' | 'nextLifeTier'>> = {}) {
  let s = directedInitial3(); s.actionsRemaining = s.weeklyBudget = 100 - ready().actionsRemaining + 2; s.cash -= ready().cash - cash; Object.assign(s, finance);
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] }); let selected: number | null = null;
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 128; cursor++) { const rng = new DeterministicActionRandomStream(s.random.seed, cursor), potion = rng.nextInt(1, 100);
    rng.nextInt(1, 100); rng.nextInt(1, 100); if (potion > 5 && potion <= chance && rng.nextInt(1, 100) <= 50) { selected = cursor; break; } }
  expect(selected).not.toBeNull(); s.random.cursor = selected!; assertValidSliceState(s);
  s = ba(s, { type: 'LEARN_GUIDANCE' }); for (const taskId of BARREN_MATRIARCH_PREPARATION_IDS) s = ba(s, { type: 'PREPARE_TASK', taskId });
  s = ba(s, { type: 'BUY_POTION', bottleId: 'barren-matriarch-potion-1' }); s = ba(s, { type: 'PREPARE_PROMOTION' }); s = ba(s, dose); s = ba(s, { type: 'BUY_ROOT_PAD' });
  for (const id of BARREN_MATRIARCH_CASE_IDS) s = ordinary(s, id); s = ba(s, { type: 'REFLECT' }); expect(s.actionsRemaining).toBe(2); expect(s.cash).toBe(cash); return s;
}
/** Explicit opt-in capture, fresh output directory only; never replaces natural evidence. */
function captureDirectedFinanceBoundaries(boundaries: Record<string, { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }>): void {
  const requested = process.env.BARREN_MATRIARCH_DIRECTED_CAPTURE_DIR; if (!requested) return;
  const directory = resolve(requested), insideOutput = relative(resolve('output'), directory);
  if (!insideOutput || insideOutput === '..' || insideOutput.startsWith(`..${sep}`) || isAbsolute(insideOutput)) throw new Error('BARREN_MATRIARCH_DIRECTED_CAPTURE_DIR must name a fresh directory inside output/.');
  if (existsSync(directory)) throw new Error(`Refusing to replace an existing directed capture directory: ${directory}`);
  mkdirSync(dirname(directory), { recursive: true }); mkdirSync(directory); const index: Record<string, string> = {};
  for (const [name, boundary] of Object.entries(boundaries)) { const filename = `${name}.json`; index[name] = filename;
    writeFileSync(resolve(directory, filename), JSON.stringify({ provenance: 'DECLARED_UNIT_FINANCIAL_BRANCH_NOT_NATURAL',
      sourceDeclaration: 'The complete actual living674-command Coffin Bearer prefix remains unchanged. Before the first Barren Matriarch journal, this directed unit declares maturity, gender, cash, action budget, financial variants and a bounded original-seed cursor. Every acquisition, ordinary practice, unique pad purchase, preparation and terminal command afterward uses the public API. The original already-spent guard segment and two real remaining segments are inherited unchanged. This is directed boundary coverage, not a natural result or resurrection of another run.', ...boundary }), { flag: 'wx' }); }
  writeFileSync(resolve(directory, 'directed.index.json'), JSON.stringify(index, null, 2), { flag: 'wx' });
}
describe('Barren Matriarch original nursery through public commands', () => {
  it('moves actual Ada and Lena OUTSIDE with current plants and kit before independent Martin combat', () => {
    const before = ready(), s = fight(before), e = s.barrenMatriarch.encounter;
    expect(hasBarrenMatriarchDisputeOpponent(s)).toBe(true); expect(validateBarrenMatriarchEncounter(s)).toBe(true);
    expect(s.coffinBearer.life.owner).toMatchObject({ id: 'CB3-ADA', age: 46, alive: true, location: 'OUTSIDE' }); expect(s.coffinBearer.life.recipient).toMatchObject({ id: 'CB3-LENA', age: 39, location: 'OUTSIDE' });
    for (const item of [...s.coffinBearer.life.samples, s.coffinBearer.life.box, s.coffinBearer.life.tag, ...s.coffinBearer.life.pads, s.coffinBearer.life.paper]) expect(item.location).toBe('OUTSIDE');
    expect(s.coffinBearer.life.samples[0]!.holder).toBe('RECIPIENT'); expect(s.coffinBearer.life.samples[2]).toMatchObject({ id: 'CB3-DRY-1', alive: false, vitality: 0, holder: 'OWNER' });
    expect(s.barrenMatriarch.life.rootPad).toEqual({ ...before.barrenMatriarch.life.rootPad, location: 'A' }); expect(e.clearance).toMatchObject({ ownerMetres: 8, recipientMetres: 12, elapsedSeconds: 24 });
    expect(s.coffinBearer.life.clockSeconds - before.coffinBearer.life.clockSeconds).toBe(24);
    expect(e).toMatchObject({ targetId: 'BM2-MARTIN', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120 }); expect(s.coffinBearer.encounter).toEqual(before.coffinBearer.encounter);
    expect(s.coffinBearer.life.guard.segments.map(x => x.status)).toEqual(['SPENT', 'UNUSED', 'UNUSED']); expect(s.coffinBearer.life.cases).toEqual(before.coffinBearer.life.cases);
    expect(s.combatHistory).toEqual(before.combatHistory); expect(s.progression.mastery).toEqual(before.progression.mastery); expect(Object.keys(s.progression.mastery)).toHaveLength(15);
    rejectIntent(s, { type: 'ACTION', action: 'REST' }); const bad = structuredClone(s); bad.coffinBearer.life.owner.location = 'A'; expect(validateBarrenMatriarchEncounter(bad)).toBe(false);
  }, 20_000);
  it('keeps actual preparation and exit costs and never respawns old Nolan', () => {
    const before = ready(), prepared = ba(before, { type: 'PREPARE_ENCOUNTER' }); expect(prepared.mind).toBe(before.mind - 2); rejectBarrenMatriarch(prepared, { type: 'PREPARE_ENCOUNTER' });
    const left = ba(ba(prepared, { type: 'ENCOUNTER_TALK' }), { type: 'LEAVE_ENCOUNTER' }); expect(left.coffinBearer.life.playerLocation).toBe('START'); expect(left.barrenMatriarch.life.rootPad).toEqual(before.barrenMatriarch.life.rootPad);
    expect(left.barrenMatriarch.encounter.enemyHealth).toBe(100); expect(left.combatHistory).toEqual(before.combatHistory); expect(left.coffinBearer.encounter).toEqual(before.coffinBearer.encounter);
    expect(left.coffinBearer.life.clockSeconds - before.coffinBearer.life.clockSeconds).toBe(28); rejectBarrenMatriarch(left, { type: 'ENCOUNTER_TALK' }); assertValidSliceState(left);
  });
  it('strictly replays the saved original pad, guard, source, financial preparation and every new round', () => {
    let s = fight(); s = step(s, { type: 'COMBAT_ROUND', stance: 'DEFEND' }); expect(validateBarrenMatriarchEncounter(s)).toBe(true); assertValidSliceState(s); assertValidSliceState(JSON.parse(JSON.stringify(s)) as SliceState);
    for (const mutate of [(v: SliceState) => { v.barrenMatriarch.life.rootPad.integrity++; }, (v: SliceState) => { v.barrenMatriarch.encounter.preparation!.before.rootPad.integrity--; }, (v: SliceState) => { v.barrenMatriarch.encounter.startSource!.targetId = 'CB3-NOLAN' as never; }, (v: SliceState) => { v.barrenMatriarch.encounter.preparation!.finance.weeklyBudget--; }, (v: SliceState) => { v.coffinBearer.life.guard.segments[0]!.status = 'UNUSED'; }]) { const bad = structuredClone(s); mutate(bad); expect(validateBarrenMatriarchEncounter(bad)).toBe(false); }
  });
  it('settles actual zero-AP terminal through paid bill, interruption, NOTICE, SUSPENDED and new debt', () => {
    const variants: [number, Parameters<typeof financialReady>[1]][] = [[1000, {}], [0, {}], [30, { debts: [{ id: 'old', source: '约定账目', remaining: 100, weeklyPayment: 30, createdWeek: 1 }], missedWeeks: 1 }],
      [30, { debts: [{ id: 'old', source: '约定账目', remaining: 100, weeklyPayment: 30, createdWeek: 1 }], missedWeeks: 3 }], [0, { credit: 'SUSPENDED', missedWeeks: 4 }]];
    const names = ['zero-ap-paid-bill-and-advance', 'zero-ap-unpaid-bill-interruption', 'zero-ap-second-missed-payment-notice', 'zero-ap-fourth-missed-payment-suspension', 'zero-ap-suspended-shortfall-new-debt'] as const;
    const captured: Parameters<typeof captureDirectedFinanceBoundaries>[0] = {};
    for (const [variantIndex, [cash, finance]] of variants.entries()) {
      const original = financialReady(cash, finance), fighting = fight(original); expect(fighting.actionsRemaining).toBe(0); const lastIntent: SliceIntent = { type: 'COMBAT_ROUND', stance: 'RETREAT' }, s = step(fighting, lastIntent);
      expect(s.barrenMatriarch.encounter.status).toBe('RETREATED'); const o = s.combatHistory.at(-1)!.barrenMatriarchOutcome!;
      expect(validateBarrenMatriarchEncounter(s), JSON.stringify({ cash, finance, life: !!replayBarrenMatriarchLifeRoot(s), budget: barrenMatriarchTerminalBudgetMatches(s, s.barrenMatriarch.encounter.preparation!, o), revision: s.revision, week: s.week, pulse: s.pulse, actions: s.actionsRemaining, activeEvent: s.activeEvent, chronicle: s.chronicle.slice(-6) })).toBe(true); assertValidSliceState(s);
      expect([s.health, s.mind, s.spirituality]).toEqual([o.playerHealthAfter, o.playerMindAfter, o.playerSpiritualityAfter]); expect(s.barrenMatriarch.life.rootPad.integrity).toBe(o.rootPadAfter.integrity); expect(s.coffinBearer.life.guard).toEqual(o.rootAfter.guard);
      for (const mutate of [(v: SliceState) => { v.cash++; }, (v: SliceState) => { v.spirituality++; }, (v: SliceState) => { v.mind++; }, (v: SliceState) => { v.actionsRemaining++; }, (v: SliceState) => { v.random.cursor++; }]) { const bad = structuredClone(s); mutate(bad); expect(validateBarrenMatriarchEncounter(bad)).toBe(false); }
      if (process.env.BARREN_MATRIARCH_DIRECTED_CAPTURE_DIR) captured[names[variantIndex]!] = { beforeLast: structuredClone(fighting), lastIntent: structuredClone(lastIntent), final: structuredClone(s) };
    }
    captureDirectedFinanceBoundaries(captured);
  }, 20_000);
});
