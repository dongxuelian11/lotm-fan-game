import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { resolveSageCombatRound } from '../../src/domain/slice/sage-combat.js';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import { SAGE_COUNT_WHEEL, SAGE_ENEMY_COUNT_WHEEL, sageAbilityWheel, sageActionCount, sageEnemyActionCount, beginSageCombatRound, currentSageCombatSource,
  resolveSageCombatAbility, validateSageCombatRound, validateSageRoundOutcome, type SageRoundOutcome } from '../../src/domain/sage/combat.js';
import { validateSageEncounter } from '../../src/domain/sage/encounter.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { promoted, sg, oldHermitRoots } from './sage-directed-helper.js';
const FORM = 'hermit.s2.information-form', SIFT = 'hermit.s2.information-sift';
let cache: SliceState | undefined;
let practicedCache: SliceState | undefined;
/** Actual public commands after a declared pre-journal unit promotion source. No battle
 * seed, resources, saved check or old story is rewritten for a favorable outcome. */
function practiced(): SliceState {
  if (!practicedCache) {
    let s = promoted();
    for (const caseId of ['information-route', 'onsite-sift', 'joint-verification'] as const) {
      s = sg(s, { type: 'OBSERVE', caseId }); s = sg(s, { type: 'CONSENT_OWNER', caseId }); s = sg(s, { type: 'PREPARE', caseId, method: 'ORDINARY' });
      if (caseId === 'joint-verification') s = sg(s, { type: 'INVITE_OWNER', caseId });
      s = sg(s, { type: 'WALK', caseId, to: 'A' }); s = sg(s, { type: 'WALK', caseId, to: 'B' });
      s = sg(s, { type: 'READ_ARCHIVE', caseId }); s = sg(s, { type: 'VERIFY_INFORMATION', caseId });
      s = sg(s, { type: 'WALK', caseId, to: 'A' }); s = sg(s, { type: 'WALK', caseId, to: 'ENTRY' });
      if (caseId === 'joint-verification') s = sg(s, { type: 'RETURN_OWNER', caseId });
      for (const type of ['RETURN_ITEMS', 'INSPECT', 'LEAVE', 'REPORT'] as const) s = sg(s, { type, caseId });
    }
    s = sg(s, { type: 'REFLECT' }); practicedCache = s;
  }
  return structuredClone(practicedCache);
}
function combatStart(): SliceState {
  if (!cache) {
    let s = practiced();
    for (const type of ['PREPARE_ENCOUNTER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'] as const) s = sg(s, { type });
    assertValidSliceState(s); cache = s;
  }
  return structuredClone(cache);
}
const outcome = (r: ReturnType<typeof resolveSageCombatRound>) => r.round.sageOutcome!;
/** Source-only branch coverage: retain original seed, vary a declared starting cursor;
 * never claim these isolated rounds reconstruct whole prior campaign history. */
const sourceCache = new Map<string, { base: SliceState; rounds: { state: SliceState; result: ReturnType<typeof resolveSageCombatRound> }[] }>();
function branch(predicate: (o: SageRoundOutcome) => boolean, stance: SliceStance = 'ATTACK', change?: (s: SliceState) => void) {
  const key = stance + String(change); let scan = sourceCache.get(key);
  if (!scan) { const base = combatStart(); change?.(base); scan = { base, rounds: [] }; sourceCache.set(key, scan); }
  for (let n = 0; n < 256; n++) {
    if (!scan.rounds[n]) {
      const s: SliceState = { ...scan.base, random: { ...scan.base.random, cursor: scan.base.random.cursor + n }, injuries: structuredClone(scan.base.injuries),
        combat: structuredClone(scan.base.combat), sage: { ...scan.base.sage, encounter: structuredClone(scan.base.sage.encounter) },
        scrollProfessor: { ...scan.base.scrollProfessor, workshop: structuredClone(scan.base.scrollProfessor.workshop) } };
      scan.rounds.push({ state: s, result: resolveSageCombatRound(s, stance) });
    }
    const found = scan.rounds[n]!; if (predicate(outcome(found.result))) return structuredClone(found);
  }
  throw new Error('Requested isolated branch absent from256 original-seed source cursors.');
}
describe('Sage actual optional archive combat', () => {
  it('keeps inherited budgets, exact action-count wheels and independent actual opponent', () => {
    const s = combatStart(), x = currentSageCombatSource(s)!;
    expect(SAGE_COUNT_WHEEL.map(a => a.weight)).toEqual([10, 15, 25, 25, 15, 10]); expect(SAGE_ENEMY_COUNT_WHEEL).toEqual(SAGE_COUNT_WHEEL);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [26, 3], [51, 4], [76, 5], [91, 6], [100, 6]]) { expect(sageActionCount(roll!)).toBe(count); expect(sageEnemyActionCount(roll!)).toBe(count); }
    const wheel = sageAbilityWheel(s, null); expect(wheel).toHaveLength(9); expect(wheel.map(a => Math.round(a.weight * 1.4))).toEqual([30, 15, 20, 15, 10, 5, 5, 20, 20]);
    expect(Object.keys(x.inheritedMastery)).toHaveLength(11); expect(x.targetId).toBe('SG2-MERRIN'); expect(x.enemyWeapon).toBe('SG2-MERRIN-ROD'); expect(x.targetSequence).toBe(3);
    expect(x.site.iris).toMatchObject({ id: 'PM3-IRIS', age: 49, location: 'OUTSIDE', consent: 'GRANTED', travelMetres: 22, energy: 78 });
    expect(x.site.playerLocation).toBe('YARD'); expect(x.site.playerEnergy).toBe(36);
    expect(s.prophecyMaster.encounter).toMatchObject({ targetId: 'PM3-OSRIC', enemyStatus: 'DEAD' }); expect(s.mystic.encounter).toMatchObject({ targetId: 'MY4-LUCAN-VEY', enemyStatus: 'SURRENDERED' });
  });
  it('executes unchanged-seed public combat to a real terminal outcome, retaining old roots and source replay', () => {
    let s = combatStart(); const roots = structuredClone(oldHermitRoots(s)), seed = s.random.seed;
    for (let n = 0; n < 30 && s.combat; n++) {
      s = applySliceIntent(s, { type: 'COMBAT_ROUND', stance: n >= 12 ? 'RETREAT' : 'ATTACK' });
      expect(validateSageCombatRound(s.combatHistory.at(-1)!)).toBe(true); expect(validateSageEncounter(s)).toBe(true); assertValidSliceState(s);
    }
    expect(s.combat).toBeNull(); expect(['RESOLVED', 'RETREATED', 'LOST']).toContain(s.sage.encounter.status); expect(s.random.seed).toBe(seed);
    expect(oldHermitRoots(s)).toEqual(roots); expect(s.sage.encounter.terminal).not.toBeNull();
  }, 60_000);
  it('allows an actual peaceful exit without fighting, restoring nothing and preserving old outcomes', () => {
    let s = practiced(); const old = structuredClone(oldHermitRoots(s)), cursor = s.random.cursor, mind = s.mind, health = s.health;
    s = sg(s, { type: 'PREPARE_ENCOUNTER' }); s = sg(s, { type: 'ENCOUNTER_TALK' }); s = sg(s, { type: 'LEAVE_ENCOUNTER' });
    expect(s.sage.encounter).toMatchObject({ status: 'RESOLVED', startSource: null, startHistoryIndex: null, terminal: null, enemyHealth: 100, enemySpirituality: 120, weaponLocation: 'HAND' });
    expect(s.sage.encounter.currentSite).toMatchObject({ playerLocation: 'OUTSIDE', playerEnergy: 34, playerTravelMetres: 66, iris: { location: 'OUTSIDE', energy: 78 } });
    expect(s.mind).toBe(mind - 2); expect(s.health).toBe(health); expect(s.random.cursor).toBe(cursor); expect(oldHermitRoots(s)).toEqual(old); assertValidSliceState(s);
  });
  it('distinguishes paid form preparation from its one later actual BODY use and expiry', () => {
    const used = branch(o => o.playerActions.some(a => a.id === FORM && a.applied)); const o = outcome(used.result), a = o.playerActions.find(v => v.id === FORM && v.applied)!;
    expect(a).toMatchObject({ attempted: true, succeeded: true, chargeGranted: true, paidCost: 6, mindCost: 2, formEnergyPaid: 6, exposurePaid: 1 });
    expect(a.appliedAmount).toBeGreaterThan(0); expect(a.appliedAmount).toBeLessThanOrEqual(45); expect(a.chargeConsumedByOrder).toBeGreaterThan(a.order);
    expect(o.enemyActions.filter(e => e.consumedEffectOrders.includes(a.order))).toHaveLength(1);
    expect(o.siteAfter.formEnergySpent - o.source.site.formEnergySpent).toBe(6); expect(o.siteAfter.playerEnergy + o.siteAfter.playerTravelMetres + o.siteAfter.formEnergySpent).toBe(100);
    expect(validateSageCombatRound(used.result.round)).toBe(true);
    const expired = outcome(branch(o => o.playerActions.some(a => a.id === FORM && a.chargeGranted && a.chargeConsumedByOrder === null)).result);
    const e = expired.playerActions.find(a => a.id === FORM && a.chargeGranted)!; expect(e.applied).toBe(false); expect(e.appliedAmount).toBe(0); expect(expired.expiredEffectOrders).toContain(e.order);
  });
  it('reads only the present weapon pattern, pays on resistance and grants finite bonus only to a later real attack', () => {
    const used = outcome(branch(o => o.playerActions.some(a => a.id === SIFT && a.applied)).result), a = used.playerActions.find(a => a.id === SIFT && a.applied)!;
    expect(a.observed).toEqual({ weaponId: 'SG2-MERRIN-ROD', position: 'YARD', distanceMetres: 2, pattern: 'PRESENT_GRIP_AND_FOOTING' });
    expect(a.selfGain).toBe(0); expect(a.threatens).toBe(false); expect(a.appliedAmount).toBeGreaterThan(0); expect(a.chargeConsumedByOrder).toBeGreaterThan(a.order);
    expect(used.playerActions.filter(v => v.consumedEffectOrders.includes(a.order) && v.threatens)).toHaveLength(1);
    const resisted = outcome(branch(o => o.playerActions.some(a => a.id === SIFT && a.resisted)).result), r = resisted.playerActions.find(a => a.resisted)!;
    expect(r).toMatchObject({ paidCost: 6, mindCost: 2, exposurePaid: 1, applied: false, chargeGranted: false, appliedAmount: 0 }); expect(r.rolls[1]).toBeLessThanOrEqual(25);
  });
  it('retains real paid failure, ordinary low-resource fallback, finite energy and strict defense', () => {
    const failed = outcome(branch(o => o.playerActions.some(a => (a.id === FORM || a.id === SIFT) && a.attempted && !a.succeeded)).result);
    expect(failed.playerActions.find(a => a.attempted && !a.succeeded && [FORM, SIFT].includes(a.id))).toMatchObject({ paidCost: 6, mindCost: 2, applied: false, chargeGranted: false });
    const low = outcome(branch(o => o.playerActions.some(a => a.id === FORM), 'ATTACK', s => { s.spirituality = 0; }).result);
    expect(low.playerActions.filter(a => [FORM, SIFT].includes(a.id)).every(a => a.paidCost === 0 && !a.chargeGranted)).toBe(true);
    const defend = outcome(branch(o => o.playerActions.some(a => a.id === 'hermit.s6.scrollcraft' || a.id === 'BODY_FOLLOWUP'), 'DEFEND').result);
    expect(defend.playerActions.filter(a => a.id === 'hermit.s6.scrollcraft' || a.id === 'BODY_FOLLOWUP').every(a => a.mode === 'HOLD_GUARD' && !a.threatens && a.paidCost === 0 && a.scroll === null)).toBe(true);
  });
  it('consumes exactly one original scroll with proof for each actual maker stage6/5/4/3/2, and never replenishes it', () => {
    for (const makerSequence of [6, 5, 4, 3, 2] as const) {
      const base = combatStart(), w = base.scrollProfessor.workshop, materialId = `scroll-professor-material-${w.materials.length + 1}`, id = `scroll-professor-scroll-${w.scrolls.length + 1}`;
      // Explicit isolated inventory boundary, not a natural acquisition or a game-provided gift.
      w.materials.push({ id: materialId, acquiredWeek: base.week, spentWeek: base.week, status: 'SPENT' });
      w.scrolls.push({ id, materialId, kind: 'IMPACT', makerSequence, inscriptionMastery: 17, createdWeek: base.week, status: 'HELD', usedWeek: null, authorized: true }); w.craftAttempts++;
      let found = false;
      for (let n = 0; n < 64 && !found; n++) {
        const s = structuredClone(base); s.random.cursor += n; const result = resolveSageCombatRound(s, 'ATTACK'), o = outcome(result), uses = o.playerActions.filter(a => a.scroll?.id === id);
        if (!uses.length) continue; found = true; expect(uses).toHaveLength(1); expect(uses[0]).toMatchObject({ mode: 'ORIGINAL_SCROLL', paidCost: 1, scroll: { id, materialId, makerSequence, inscriptionMastery: 17 } });
        expect(o.workshopAfter.scrolls.at(-1)).toMatchObject({ id, status: 'USED', authorized: false, usedWeek: base.week }); expect(o.workshopAfter.materials).toEqual(w.materials); expect(validateSageCombatRound(result.round)).toBe(true);
      }
      expect(found).toBe(true);
    }
  });
  it('rejects forged source, wrong actor draws, outcome costs, effects and terminal labels', () => {
    const s = combatStart(), rng = new DeterministicActionRandomStream(s.random.seed, s.random.cursor), r = beginSageCombatRound(s, 'ATTACK', rng), before = structuredClone(s);
    expect(resolveSageCombatAbility(s, FORM, 1, rng, r).selfGain).toBe(0); expect(s).toEqual(before); // No count or action draw was paid.
    const good = branch(o => o.playerActions.some(a => a.id === FORM && a.attempted)).result;
    for (const mutate of [(o: SageRoundOutcome) => { o.playerActions[0]!.paidCost++; }, (o: SageRoundOutcome) => { o.siteAfter.playerEnergy++; }, (o: SageRoundOutcome) => { o.source.inheritedMastery['hermit.s7.spellcraft'] = 501; }, (o: SageRoundOutcome) => { o.randomCursorAfter++; }, (o: SageRoundOutcome) => { o.playerHealthAfter = 100; }]) {
      const bad = structuredClone(good.round.sageOutcome!); mutate(bad); expect(validateSageRoundOutcome(bad)).toBe(false);
    }
    const bad = structuredClone(good.round); bad.consequence += ' guaranteed victory'; expect(validateSageCombatRound(bad)).toBe(false);
  });
});

it('reports actual BODY follow-up application in the unchanged natural round2 without changing settlement or random draws', async () => {
  const { readFileSync } = await import('node:fs');
  const boundary: { beforeLast: SliceState; lastIntent: Parameters<typeof applySliceIntent>[1]; final: SliceState } = JSON.parse(readFileSync('tests/fixtures/sage-v01780/first-run-round2.json', 'utf8'));
  // This is the unchanged first-run raw boundary, retained separately from current
  // valid saves. Reapply exactly its recorded command and original random stream.
  const sourceBytes = JSON.stringify(boundary), actual = applySliceIntent(boundary.beforeLast, boundary.lastIntent);
  const round = actual.combatHistory.at(-1)!, followups = round.sageOutcome!.playerActions.filter(a => a.id === 'BODY_FOLLOWUP');
  expect(followups).toHaveLength(1); expect(followups[0]).toMatchObject({ applied: true, threatens: true, paidCost: 0 });
  expect(followups[0]!.appliedAmount).toBeCloseTo(13.53807, 10); expect(followups[0]!.appliedAmount).toBe(followups[0]!.selfGain);
  expect(actual.random).toEqual(boundary.final.random); expect(actual.random.seed).toBe(boundary.beforeLast.random.seed);
  const omitFollowupReporting = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(omitFollowupReporting);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !((value as { id?: string }).id === 'BODY_FOLLOWUP' && ['applied', 'appliedAmount'].includes(key))).map(([key, v]) => [key, omitFollowupReporting(v)]));
    return value;
  };
  expect(omitFollowupReporting(actual)).toEqual(omitFollowupReporting(boundary.final));
  expect(JSON.stringify(boundary)).toBe(sourceBytes); assertValidSliceState(actual); expect(validateSageCombatRound(round)).toBe(true);
  const falselyUnapplied = structuredClone(round); const a = falselyUnapplied.sageOutcome!.playerActions.find(a => a.id === 'BODY_FOLLOWUP')!;
  a.applied = false; a.appliedAmount = 0; expect(validateSageCombatRound(falselyUnapplied)).toBe(false);
});
