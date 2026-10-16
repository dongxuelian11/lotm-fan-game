import { namedBoundary, sameCaptureValue } from './abomination-capture-helper.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { ancientEvilAbilityWheel } from '../../src/domain/ancient-evil/combat.js';
import { resolveAbominationCombatRound } from '../../src/domain/slice/abomination-combat.js';
import { ABOMINATION_COUNT_WHEEL, ABOMINATION_ENEMY_COUNT_WHEEL, ABOMINATION_ENEMY_ABILITY_WHEEL, BARRIER, CRY,
  abominationAbilityWheel, abominationActionCount, abominationEnemyActionCount, currentAbominationCombatSource, replayAbominationCombatRound,
  validAbominationCombatSource, validateAbominationCombatRound, validateAbominationRoundOutcome, nextAbominationCombatSource, projectAbominationCombat,
  createAbominationRuntime, resolveAbominationPlayerSlot, resolveAbominationEnemySlot, advanceAbominationCombatClock, drawAbominationEnemyAbility,
  type AbominationCombatSource, type AbominationRoundOutcome } from '../../src/domain/abomination/combat.js';
import { ABOMINATION_POLICIES, projectAbominationEncounter, validateAbominationEncounter, abominationApproachedSite,
  abominationFinanceSnapshot, abominationCompletedBudgetMatches, type AbominationPolicy } from '../../src/domain/abomination/encounter.js';
import { ABOMINATION_CASE_IDS } from '../../src/domain/abomination/life.js';
import { ab, directedInitial2, prepareBottle, dose, ready, originalAncientEvil, oldChainedRoots, rejectAbomination } from './abomination-directed-helper.js';
const H = 'chained.s4.object-motion', J = 'BODY_FOLLOWUP', B = 'GHOST_DODGE', K = 'chained.s2.enduring-transfiguration';
let practicedCache: SliceState | undefined;
function practiced(): SliceState {
  if (!practicedCache) {
    // Declared UNIT setup before any new-stage journal; never changes the642 source history or natural run.
    const initial = directedInitial2(); initial.actionsRemaining = initial.weeklyBudget = 3;
    let s = ab(prepareBottle(initial, dose.bottleId), dose); expect(s.progression.sequence).toBe(1);
    for (const caseId of ABOMINATION_CASE_IDS) {
      s = ready(s, { ap: 3, cash: 20 }); s = ab(s, { type: 'OBSERVE', caseId }); s = ab(s, { type: 'CONSENT', caseId, permission: 'OWNER' });
      if (s.abomination.life.site.volunteer.location === 'OUTSIDE') s = ab(s, { type: 'INVITE', caseId });
      s = ab(s, { type: 'PREPARE', caseId, method: 'ORDINARY' });
      for (const type of ['WALK_TO_A', 'WALK_TO_B', 'READ_ORIGINAL', 'RETURN_TO_A', 'PLACE_PIECE'] as const) s = ab(s, { type, caseId });
      s = ab(s, { type: caseId === 'spoken-hesitation' ? 'PREPARE_CUE' : 'PREPARE_PULSE', caseId });
      s = ab(s, { type: caseId === 'spoken-hesitation' ? 'PERFORM_CUE' : 'PERFORM_PULSE', caseId });
      for (const type of ['TAKE_PIECE', 'RETURN_TO_ENTRY', 'RETURN_PIECE', 'LEAVE'] as const) s = ab(s, { type, caseId });
      s = ab(ready(s), { type: 'REPORT', caseId });
    }
    s = ab(ready(s), { type: 'REFLECT' }); assertValidSliceState(s); practicedCache = s;
  }
  return structuredClone(practicedCache);
}
const starts = new Map<string, SliceState>();
function start(policy: AbominationPolicy = 'ALL', zeroAP = false): SliceState {
  const key = `${policy}:${zeroAP}`;
  if (!starts.has(key)) {
    let s = ready(practiced(), { ap: 2, cash: 30, health: 100, mind: 100, spirituality: 120 });
    if (zeroAP) while (s.actionsRemaining > 2) s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    s = ab(s, { type: 'PREPARE_ENCOUNTER' }); s = ab(s, { type: 'ENCOUNTER_TALK' });
    if (policy !== 'ALL') s = ab(s, { type: 'SET_COMBAT_POLICY', policy });
    s = ab(s, { type: 'ENCOUNTER_FIGHT' }); assertValidSliceState(s); starts.set(key, s);
  }
  return structuredClone(starts.get(key)!);
}
const source = () => currentAbominationCombatSource(start())!;
function random(...rolls: number[]): ActionRandomStream { let cursor = 0; return { seed: 'abomination-declared-slot-unit', get cursor() { return cursor; }, nextInt(min, max) { const n = rolls[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected declared draw ${n} in ${min}..${max}`); return n; } }; }
function scripted(rolls: number[]) { let cursor = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function(this: DeterministicActionRandomStream, min, max) { original.call(this, min, max); const n = rolls[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected declared draw ${n} in ${min}..${max}`); return n; });
}
afterEach(() => vi.restoreAllMocks());
function costs(o: AbominationRoundOutcome): void {
  const actions = [...o.playerActions, ...o.enemyActions].sort((a, b) => a.order - b.order); let clock = o.source.site.clockSeconds;
  for (const [i, a] of actions.entries()) { expect(a.order).toBe(i); expect(a.atSeconds).toBe(clock); expect(a.elapsedSeconds).toBe(5 + a.hesitationSeconds); clock += a.elapsedSeconds; }
  expect(o.elapsedSeconds).toBe(60 + o.hesitationSeconds - o.source.body.hesitationSeconds); expect(o.siteAfter.clockSeconds).toBe(o.source.site.clockSeconds + o.elapsedSeconds);
  expect(o.playerSpiritualityAfter).toBe(o.source.playerSpirituality - o.playerActions.reduce((n, a) => n + a.paidCost, 0));
  expect(o.enemySpirituality).toBe(o.source.body.enemySpirituality - o.enemyActions.reduce((n, a) => n + a.paidCost, 0));
  expect(o.piece!.charges).toBe(o.source.body.piece!.charges - actions.reduce((n, a) => n + a.pieceChargePaid, 0));
  expect(o.piece!.wear).toBe(o.barrierApplications + o.cryApplications); expect(o.hesitationSeconds).toBe(3 * o.cryApplications);
  expect(o.plates.filter(p => p.status === 'SPENT')).toHaveLength(o.powerUses.MIND_SPIKE); expect(o.blocks).toEqual(o.source.originals.blocks);
  expect(o.siteAfter.volunteer).toEqual(o.source.site.volunteer); expect(o.siteAfter.clothing).toEqual(o.source.site.clothing); expect(o.siteAfter.bag).toEqual(o.source.site.bag);
  expect(o.siteAfter.playerTravelMetres).toBe(o.source.site.playerTravelMetres + o.playerActions.reduce((n, a) => n + a.travelMetres, 0));
  for (const a of o.playerActions.filter(a => [BARRIER, CRY].includes(a.id as typeof BARRIER | typeof CRY))) {
    expect(a.paidCost).toBe(a.attempted ? 8 : 0); expect(a.mindCost).toBe(a.attempted ? a.succeeded ? 2 : 4 : 0);
    expect(a.rolls.length).toBe(a.attempted ? a.id === CRY && (a.succeeded || a.resisted) ? 2 : 1 : 0); expect(a.pieceChargePaid).toBe(0);
  }
  for (const a of o.enemyActions) { expect(a.threatens).toBe(a.attackKind === 'BODY' && a.selfGain > 0); expect(a.mentalPressure).toBe(a.attackKind === 'MENTAL' && a.selfGain > 0);
    if (a.windowsApplied.length) { expect(a.attackKind).toBe('MENTAL'); expect(a.id).toBe('MIND_SPIKE'); expect(a.paidCost).toBe(7); expect(a.receipt).toMatchObject({ kind: 'MENTAL', paidCost: 7 }); expect(a.windowsApplied.every(w => w.amount > 0 && w.amount <= 30)).toBe(true); }
  }
  for (const [id, value] of Object.entries(o.source.inheritedMastery)) expect(o.masteryAfter[id]).toBe(value);
  for (const id of [BARRIER, CRY]) expect(o.masteryAfter[id]).toBe(Math.min(500, o.source.mastery[id]! + 8 * actions.filter(a => a.masteryApplied.includes(id)).length));
}

describe('Abomination original-body finite encounter and exact complete-source replay', () => {
  it('retains genuine642 original deaths,19 masteries/four zeros, same clothes and bag, exact old six weights and source-specific1..6 counts', () => {
    const original = originalAncientEvil(), s = start(), inherited = start('INHERITED_ONLY');
    expect(oldChainedRoots(s)).toEqual(oldChainedRoots(original)); expect(s.ancientEvil.encounter).toMatchObject({ enemyStatus: 'DEAD', enemyHealth: 0 }); expect(s.silentDisciple.encounter.enemyStatus).toBe('SURRENDERED');
    expect(s.abomination.encounter.blocks).toEqual(original.ancientEvil.encounter.blocks); expect(s.abomination.encounter.blocks.every(b => b.status === 'SPENT')).toBe(true);
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) expect(abominationAbilityWheel(inherited, stance).map(({ id, weight }) => ({ id, weight }))).toEqual(ancientEvilAbilityWheel(original, stance).map(({ id, weight }) => ({ id, weight })));
    const weights = [30, 15, 20, 20, 10, 5, 20, 20]; abominationAbilityWheel(s, null).forEach((r, i) => expect(r.weight).toBeCloseTo(weights[i]! / 140 * 100));
    expect(ABOMINATION_POLICIES).toEqual(['INHERITED_ONLY', 'BARRIER', 'CRY', 'ALL', 'ORDINARY']); expect(ABOMINATION_COUNT_WHEEL).toEqual(ABOMINATION_ENEMY_COUNT_WHEEL);
    const counts = Array.from({ length: 100 }, (_, i) => abominationActionCount(i + 1)); expect([1, 2, 3, 4, 5, 6].map(n => counts.filter(v => v === n).length)).toEqual([10, 15, 25, 25, 15, 10]); expect(counts).toEqual(Array.from({ length: 100 }, (_, i) => abominationEnemyActionCount(i + 1)));
    expect([1, 36, 56, 81, 91, 96].map(n => drawAbominationEnemyAbility(random(n)))).toEqual(['MIND_SPIKE', 'WARD', 'BODY_STRIKE', 'CALM', 'REPOSITION', 'ACCIDENT']);
    expect(projectAbominationEncounter(s).enemyAbilityWheel).toEqual(ABOMINATION_ENEMY_ABILITY_WHEEL);
    for (const [id, value] of Object.entries(original.progression.mastery)) expect(s.progression.mastery[id]).toBe(value);
  }, 180_000);
  it('walks adult Elsa8m with her exact clothes/bag before entering the independent yard4m, without changing predecessor roots', () => {
    const s = start(), e = s.abomination.encounter, p = e.startSite!;
    expect(e.currentSite).toEqual(abominationApproachedSite(p, s.abomination.sourceScene!.originals)); expect(e.currentSite!.clockSeconds).toBe(p.clockSeconds + 12); expect(e.currentSite!.playerTravelMetres).toBe(p.playerTravelMetres + 4);
    expect(e.currentSite!.volunteer).toEqual({ ...p.volunteer, location: 'OUTSIDE' }); expect(e.currentSite!.clothing).toEqual(p.clothing); expect(e.currentSite!.bag).toEqual(p.bag); expect(e.currentSite!.guide.location).toBe('OUTSIDE');
    expect(e.startSource).toMatchObject({ targetId: 'AB1-RODERICK', targetName: '罗德里克·霍尔', targetAge: 45, maxActionCount: 6, enemyWeapon: 'AB1-RODERICK-ROD' });
    expect(e.piece).toMatchObject({ id: 'AB1-COMBAT-PIECE', charges: 3, wear: 0, paidPennies: 30 }); expect(e.plates.map(p => p.id)).toEqual(['AB1-RODERICK-PLATE-1', 'AB1-RODERICK-PLATE-2', 'AB1-RODERICK-PLATE-3']); rejectAbomination(s, { type: 'PREPARE_ENCOUNTER' });
  }, 120_000);
  it('supports lastAP preparation, zeroAP talk and actual ordinary4m exit with exact weekly finance; early door exit refunds nothing', () => {
    for (const talk of [false, true]) {
      let s = ready(practiced(), { cash: 30 }); while (s.actionsRemaining > 1) s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
      s = ab(s, { type: 'PREPARE_ENCOUNTER' }); expect(s.actionsRemaining).toBe(0); const prepared = structuredClone(s.abomination.encounter.piece);
      if (talk) s = ab(s, { type: 'ENCOUNTER_TALK' }); const before = structuredClone(s.abomination.encounter.currentSite!); rejectAbomination(s, { type: 'ENCOUNTER_FIGHT' });
      s = ab(s, { type: 'LEAVE_ENCOUNTER' }); expect(s.abomination.encounter.currentSite).toEqual({ ...before, playerLocation: 'START', clockSeconds: before.clockSeconds + (talk ? 4 : 0), playerTravelMetres: before.playerTravelMetres + (talk ? 4 : 0) });
      expect(s.abomination.encounter.piece).toEqual(prepared); expect(validateAbominationEncounter(s)).toBe(true); assertValidSliceState(s);
      const last = s.abomination.encounter.journal.at(-1)!; expect(abominationCompletedBudgetMatches(s, last.after, last.finance, last.week, last.date, last.revision, last.randomCursor, '沿普通路和平离开相邻院落')).toBe(true);
      const bad = abominationFinanceSnapshot(last.finance); bad.debts.push({ id: 'forged', source: '不存在的欠款', remaining: 50, weeklyPayment: 5, createdWeek: last.week }); expect(abominationCompletedBudgetMatches(s, last.after, bad, last.week, last.date, last.revision, last.randomCursor, '沿普通路和平离开相邻院落')).toBe(false);
    }
  }, 180_000);
  it('barrier only changes the next paid visibleMENTAL attack, consumes no charge on cast/BODY/movement/expiry and never restores old blocks', () => {
    const x = source(), r = createAbominationRuntime(x); const cast = resolveAbominationPlayerSlot(x, r, BARRIER, 0, random(1));
    expect(cast).toMatchObject({ attempted: true, succeeded: true, paidCost: 8, mindCost: 2, pieceChargePaid: 0 }); expect(r.body.piece!.charges).toBe(3);
    const hit = resolveAbominationEnemySlot(x, r, 'MIND_SPIKE', 1, random()); expect(hit).toMatchObject({ selfGain: 45, attackKind: 'MENTAL', paidCost: 7, pieceChargePaid: 1, pieceWearPaid: 1, hesitationSeconds: 0 }); expect(hit.windowsApplied).toEqual([{ kind: 'BARRIER', round: 1, order: 0, amount: 30 }]);
    expect(r.body.piece!.charges).toBe(2); expect(r.mastery[BARRIER]).toBe(x.mastery[BARRIER]! + 8); expect(r.body.blocks).toEqual(x.originals.blocks);
    for (const trigger of ['BODY_STRIKE', 'REPOSITION', 'CALM'] as const) { const q = createAbominationRuntime(x); resolveAbominationPlayerSlot(x, q, BARRIER, 0, random(1)); const a = resolveAbominationEnemySlot(x, q, trigger, 1, random()); expect(q.body.piece!.charges).toBe(3); expect(q.body.barrier).toBeNull(); expect(a.windowsApplied).toEqual([]); if (trigger === 'BODY_STRIKE') expect(a.selfGain).toBe(25); }
    const q = createAbominationRuntime(x); resolveAbominationPlayerSlot(x, q, BARRIER, 0, random(1)); advanceAbominationCombatClock(q, 15); expect(q.body.barrier).toBeNull(); const expired = resolveAbominationEnemySlot(x, q, 'MIND_SPIKE', 1, random()); expect(expired.selfGain).toBe(75); expect(q.body.piece!.charges).toBe(3);
    const moved = createAbominationRuntime(x); resolveAbominationPlayerSlot(x, moved, BARRIER, 0, random(1)); const attack = resolveAbominationPlayerSlot(x, moved, H, 1, random()); expect(attack).toMatchObject({ attackKind: 'BODY', paidCost: 0 }); expect(moved.body.barrier).toBeNull(); expect(moved.body.blocks).toEqual(x.originals.blocks);
  }, 120_000);
  it('cry retains the actual pending mental action and7S+plate cost, imposes3 real seconds, and charges the piece only on application', () => {
    const x = source(), r = createAbominationRuntime(x), cast = resolveAbominationPlayerSlot(x, r, CRY, 0, random(1, 100)); expect(cast.rolls).toEqual([1, 100]); expect(r.body.piece!.charges).toBe(3);
    const at = r.root.clockSeconds, a = resolveAbominationEnemySlot(x, r, 'MIND_SPIKE', 1, random()); expect(a).toMatchObject({ id: 'MIND_SPIKE', planned: 'MIND_SPIKE', selfGain: 45, paidCost: 7, hesitationSeconds: 3, elapsedSeconds: 8, pieceChargePaid: 1, attackKind: 'MENTAL' });
    expect(r.root.clockSeconds).toBe(at + 8); expect(r.body.hesitationSeconds).toBe(3); expect(r.body.cryApplications).toBe(1); expect(r.body.powerUses.MIND_SPIKE).toBe(1); expect(r.body.plates.filter(p => p.status === 'SPENT')).toHaveLength(1); expect(r.body.enemySpirituality).toBe(113); expect(r.mastery[CRY]).toBe(x.mastery[CRY]! + 8);
    const q = createAbominationRuntime(x); expect(resolveAbominationPlayerSlot(x, q, CRY, 0, random(100))).toMatchObject({ succeeded: false, paidCost: 8, mindCost: 4, rolls: [100] }); expect(q.body.cry).toBeNull(); expect(q.body.piece!.charges).toBe(3);
    const t = createAbominationRuntime(x); expect(resolveAbominationPlayerSlot(x, t, CRY, 0, random(1, 1))).toMatchObject({ resisted: true, succeeded: false, paidCost: 8, mindCost: 4, rolls: [1, 1] }); expect(t.body.cry).toBeNull();
  }, 120_000);
  it('paid old contact, target resistance,90s persistent form, rabbit mental powers and separate original-rod pickup retain S2 rules', () => {
    const x = source(), r = createAbominationRuntime(x); const c = resolveAbominationPlayerSlot(x, r, K, 0, random(1)); expect(c).toMatchObject({ mode: 'CONTACT', paidCost: 4, mindCost: 1, travelMetres: 4 });
    const a = resolveAbominationPlayerSlot(x, r, K, 1, random(1, 100)); expect(a).toMatchObject({ mode: 'TARGET_FORM', succeeded: true, paidCost: 6, mindCost: 2, resistanceChance: 57 }); expect(r.body.enemyForm).toBe('RABBIT'); expect(r.body.weaponLocation).toBe('YARD');
    expect(resolveAbominationEnemySlot(x, r, 'MIND_SPIKE', 2, random())).toMatchObject({ attackKind: 'MENTAL', paidCost: 7 }); expect(resolveAbominationEnemySlot(x, r, 'WARD', 3, random())).toMatchObject({ attackKind: 'BODY', paidCost: 0, selfGain: 10 });
    const until = r.body.enemyFormUntilSeconds!; advanceAbominationCombatClock(r, until - r.root.clockSeconds); expect(r.body.enemyForm).toBe('HUMAN'); expect(r.body.weaponLocation).toBe('YARD'); expect(resolveAbominationEnemySlot(x, r, 'MIND_SPIKE', 4, random())).toMatchObject({ id: 'PICKUP', paidCost: 0, selfGain: 0 }); expect(r.body.weaponLocation).toBe('HAND');
    const q = createAbominationRuntime(x); resolveAbominationPlayerSlot(x, q, K, 0, random(1)); expect(resolveAbominationPlayerSlot(x, q, K, 1, random(1, 1))).toMatchObject({ resisted: true, paidCost: 6, mindCost: 2 }); expect(q.body.enemyForm).toBe('HUMAN');
    const f = createAbominationRuntime(x); expect(resolveAbominationPlayerSlot(x, f, K, 0, random(100))).toMatchObject({ succeeded: false, paidCost: 4, mindCost: 1 }); expect(f.body.link).toBe('NONE');
  }, 120_000);
  it('finite three plates and three applications cannot refill; no resource means ordinary fallback, and ORDINARY suppresses inherited spells/burst', () => {
    const x = source(), r = createAbominationRuntime(x);
    for (let i = 0; i < 3; i++) { resolveAbominationPlayerSlot(x, r, BARRIER, i * 2, random(1)); expect(resolveAbominationEnemySlot(x, r, 'MIND_SPIKE', i * 2 + 1, random()).pieceChargePaid).toBe(1); }
    expect(r.body.piece).toMatchObject({ charges: 0, wear: 3 }); expect(resolveAbominationPlayerSlot(x, r, BARRIER, 6, random())).toMatchObject({ attempted: false, paidCost: 0, mindCost: 0 }); expect(resolveAbominationEnemySlot(x, r, 'MIND_SPIKE', 7, random())).toMatchObject({ id: 'BODY_STRIKE', paidCost: 0 }); expect(r.body.enemySpirituality).toBe(99);
    const ordinary = currentAbominationCombatSource(start('ORDINARY'))!, q = createAbominationRuntime(ordinary, 'BURST_FIRST');
    for (const id of [H, J, B, K] as const) expect(resolveAbominationPlayerSlot(ordinary, q, id, 0, random())).toMatchObject({ paidCost: 0, mindCost: 0 }); expect(q.madman.triggered).toBe(false); expect(q.body.blocks).toEqual(x.body.blocks);
    const burst = createAbominationRuntime(x, 'BURST_FIRST'); expect(resolveAbominationPlayerSlot(x, burst, H, 0, random())).toMatchObject({ paidCost: 2, mindCost: 10 }); expect(burst.madman.triggered).toBe(true);
  }, 120_000);
  it('exact replay accounts ordered RNG/costs, body versus mental causal consequences and the real3-second round extension', () => {
    const x = source(), s = start(), untouched = structuredClone(s), real = replayAbominationCombatRound(x, 'CONTROL'); costs(real.round.abominationOutcome!); expect(replayAbominationCombatRound(x, 'CONTROL')).toEqual(real); expect(validateAbominationRoundOutcome(real.round.abominationOutcome)).toBe(true); expect(validateAbominationCombatRound(real.round)).toBe(true);
    expect(resolveAbominationCombatRound(s, 'CONTROL')).toEqual(real); expect(oldChainedRoots(s)).toEqual(oldChainedRoots(untouched)); if (real.outcome === 'CONTINUE') { s.combatHistory.push(real.round); s.revision++; expect(currentAbominationCombatSource(s)).toEqual(nextAbominationCombatSource(real.round.abominationOutcome!)); }
    let spy = scripted([1, 1, 341, 1, 1_000_000]); const mental = replayAbominationCombatRound(x, 'PREPARE').round; spy.mockRestore(); expect(mental.consequenceDomain).toBe('MENTAL'); expect(mental.consequenceRoll).toBeUndefined(); expect(mental.consequenceWeights).toBeNull(); expect(mental.abominationOutcome!.playerHealthAfter).toBe(x.playerHealth); expect(mental.abominationOutcome!.playerRiskAfter).toBe(x.playerRisk);
    spy = scripted([1, 1, 341, 56, 1_000_000, 10]); const physical = replayAbominationCombatRound(x, 'PREPARE').round; spy.mockRestore(); expect(physical.consequenceDomain).toBe('BODY'); expect(physical.abominationOutcome!.playerHealthAfter).toBe(x.playerHealth - 10);
    spy = scripted([1, 1, 501, 1, 100, 1, 1_000_000]); const cry = replayAbominationCombatRound(x, 'CONTROL').round; spy.mockRestore(); expect(cry.abominationOutcome!.elapsedSeconds).toBe(63); expect(cry.enemyCount).toBe(1); expect(cry.abominationOutcome!.enemyActions[0]).toMatchObject({ planned: 'MIND_SPIKE', paidCost: 7, elapsedSeconds: 8 }); costs(cry.abominationOutcome!);
  }, 120_000);
  it('rejects forged full sources, illegal count/round bounds, restored old resources, altered fees/time/RNG and phantom mental injury rolls', () => {
    const x = source(); expect(validAbominationCombatSource(x)).toBe(true);
    const sourceBad = (mutate: (v: AbominationCombatSource) => void) => { const v = structuredClone(x); mutate(v); expect(validAbominationCombatSource(v)).toBe(false); expect(() => replayAbominationCombatRound(v, 'CONTROL')).toThrow(); };
    sourceBad(v => v.maxActionCount = 7 as 6); sourceBad(v => v.round = 0); sourceBad(v => v.round = v.revision + 1); sourceBad(v => v.site.clockSeconds++); sourceBad(v => v.body.enemyHealth = 90); sourceBad(v => v.site.volunteer.location = 'A'); sourceBad(v => v.site.volunteer.age = 18); sourceBad(v => v.body.blocks[0]!.status = 'READY'); sourceBad(v => v.body.piece!.charges = 4); sourceBad(v => v.body.piece!.charges = 2); sourceBad(v => v.inheritedMastery['chained.s6.steel-body'] = 1); sourceBad(v => v.targetId = 'AE2-LENA' as typeof v.targetId); sourceBad(v => v.preparation.after.cash++);
    const round = replayAbominationCombatRound(x, 'CONTROL').round; const bad = (mutate: (r: SliceCombatRound) => void) => { const r = structuredClone(round); mutate(r); expect(validateAbominationCombatRound(r)).toBe(false); };
    bad(r => r.playerCount = 7); bad(r => r.enemyCount = 7); bad(r => r.abominationOutcome!.randomCursorAfter++); bad(r => r.abominationOutcome!.playerSpiritualityAfter++); bad(r => r.abominationOutcome!.elapsedSeconds++); bad(r => r.abominationOutcome!.hesitationSeconds++); bad(r => r.abominationOutcome!.piece!.charges++); bad(r => r.abominationOutcome!.enemySpirituality++); bad(r => r.abominationOutcome!.masteryAfter[BARRIER]!++); bad(r => r.consequenceRoll = null as unknown as number);
  }, 120_000);
  it('fixed ALL/CONTROL reaches its real terminal at zeroAP with actual forms/exit/weekly finance and immutable original deaths', () => {
    let s = start('ALL', true); const roots = oldChainedRoots(s), week = s.week; expect(s.actionsRemaining).toBe(0);
    for (let count = 0; count < 90 && s.combat; count++) s = applySliceIntent(s, { type: 'COMBAT_ROUND', stance: 'CONTROL' });
    expect(s.combat).toBeNull(); expect(s.abomination.encounter.terminal).not.toBeNull(); expect(validateAbominationEncounter(s)).toBe(true); assertValidSliceState(s); expect(oldChainedRoots(s)).toEqual(roots);
    const e = s.abomination.encounter, terminal = e.terminal!, o = s.combatHistory[terminal.historyIndex]!.abominationOutcome!, fight = e.journal.at(-1)!;
    expect(e.currentSite!.playerLocation).toBe(s.status === 'DEAD' ? 'YARD' : 'START'); expect(e.currentSite!.volunteer.location).toBe('OUTSIDE'); expect(e.enemyForm).toBe('HUMAN'); expect(e.form).toBe('HUMAN'); expect(e.currentSite!.clockSeconds).toBe(o.siteAfter.clockSeconds + terminal.formWaitSeconds + terminal.exitSeconds);
    expect(s.week).toBe(week + (s.status === 'ACTIVE' ? 1 : 0)); const expected = { ...fight.after, health: o.playerHealthAfter, mind: o.playerMindAfter, spirituality: o.playerSpiritualityAfter, mastery: o.masteryAfter, injuries: o.playerInjuriesAfter, injuryRisk: o.playerRiskAfter };
    expect(abominationCompletedBudgetMatches(s, expected, fight.finance, fight.week, fight.date, o.source.revision + 1, o.randomCursorAfter, '罗德里克的相邻院落冲突结束')).toBe(true); expect(projectAbominationCombat(s).lastActionSequence.length).toBe(o.playerActions.length + o.enemyActions.length);
  }, 180_000);
});


describe('Abomination actual public inherited policy routing', () => {
  it('accepts explicit default UI policies in all four captured rounds with byte-equivalent state and RNG', () => {
    for (const n of [1, 2, 3, 4]) {
      const save = namedBoundary(`combat-round-${n}`);
      const explicit = applySliceIntent(save.before, { type: 'COMBAT_ROUND', stance: 'CONTROL', puppetCurse: false, madmanPolicy: 'HOLD' });
      sameCaptureValue(explicit, save.final); expect(explicit.random).toEqual(save.final.random);
    }
  }, 120_000);
  it('routes enabled inherited policies through their real cost resolver and still rejects unsupported sources', () => {
    const save = namedBoundary('combat-round-1'), before = save.before;
    const x = currentAbominationCombatSource(before)!;
    const expected = replayAbominationCombatRound(x, 'CONTROL', true, 'BURST_FIRST');
    const active = applySliceIntent(before, { type: 'COMBAT_ROUND', stance: 'CONTROL', puppetCurse: true, madmanPolicy: 'BURST_FIRST' });
    sameCaptureValue(active.lastCombatRound, expected.round); costs(expected.round.abominationOutcome!);
    expect(expected.round.madmanBurst?.policy).toBe('BURST_FIRST');
    for (const payload of [
      { type: 'COMBAT_ROUND', stance: 'CONTROL', puppetCurse: false },
      { type: 'COMBAT_ROUND', stance: 'CONTROL', madmanPolicy: 'HOLD' },
    ] as const) {
      const invalid = structuredClone(before); invalid.combat!.encounterId = 'PUPPET_DISPUTE';
      expect(() => applySliceIntent(invalid, payload)).toThrow(/策略只供/);
      sameCaptureValue(before, save.before);
    }
  }, 120_000);
});
