import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { bloodDukeAbilityWheel } from '../../src/domain/blood-duke/combat.js';
import { resolveUncleanMonarchCombatRound } from '../../src/domain/slice/unclean-monarch-combat.js';
import { UNCLEAN_MONARCH_COUNT_WHEEL, UNCLEAN_MONARCH_ENEMY_COUNT_WHEEL, UNCLEAN_MONARCH_ENEMY_ABILITY_WHEEL, BINDING, INTERFERENCE,
  uncleanMonarchAbilityWheel, uncleanMonarchActionCount, uncleanMonarchEnemyActionCount, currentUncleanMonarchCombatSource, replayUncleanMonarchCombatRound,
  validUncleanMonarchCombatSource, validateUncleanMonarchCombatRound, validateUncleanMonarchRoundOutcome, nextUncleanMonarchCombatSource, projectUncleanMonarchCombat,
  type UncleanMonarchRoundOutcome } from '../../src/domain/unclean-monarch/combat.js';
import { UNCLEAN_MONARCH_POLICIES, projectUncleanMonarchEncounter, validateUncleanMonarchEncounter, uncleanMonarchApproachedSite,
  uncleanMonarchFinanceSnapshot, uncleanMonarchCompletedBudgetMatches, type UncleanMonarchPolicy } from '../../src/domain/unclean-monarch/encounter.js';
import { UNCLEAN_MONARCH_CASE_IDS } from '../../src/domain/unclean-monarch/life.js';
import { um, directedInitial2, prepareBottle, dose, ready, originalBloodDuke, oldAbyssRoots, rejectUncleanMonarch } from './unclean-monarch-directed-helper.js';

let practicedCache: SliceState | undefined;
/** Only promotion is a declared pre-journal UNIT selection. Every later action
 * uses public commands, the original RNG and three real AP per week. */
function practiced(): SliceState {
  if (!practicedCache) {
    const initial = directedInitial2('SUCCESS'); initial.actionsRemaining = initial.weeklyBudget = 3;
    let s = um(prepareBottle(initial, dose.bottleId), dose); expect(s.progression.sequence).toBe(1);
    for (const caseId of UNCLEAN_MONARCH_CASE_IDS) {
      s = ready(s, { ap: 3, cash: 20 });
      s = um(s, { type: 'OBSERVE', caseId }); s = um(s, { type: 'CONSENT', caseId, permission: 'OWNER' }); s = um(s, { type: 'PREPARE', caseId, method: 'ORDINARY' });
      for (const type of ['WALK_TO_A', 'TAKE_CARD', 'WALK_TO_B', 'READ_ORIGINAL', 'MANUAL_OPERATION', 'RETURN_TO_A', 'RETURN_CARD', 'RETURN_TO_ENTRY', 'RETURN_PIECE', 'LEAVE', 'REPORT'] as const) s = um(s, { type, caseId });
    }
    s = um(ready(s), { type: 'REFLECT' }); assertValidSliceState(s); practicedCache = s;
  }
  return structuredClone(practicedCache);
}
const starts = new Map<string, SliceState>();
function start(policy: UncleanMonarchPolicy = 'ALL', zeroAP = false): SliceState {
  const key = `${policy}:${zeroAP}`;
  if (!starts.has(key)) {
    let s = ready(practiced(), { ap: 2, cash: 30, health: 100, mind: 100, spirituality: 120 });
    if (zeroAP) while (s.actionsRemaining > 2) s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    s = um(s, { type: 'PREPARE_ENCOUNTER' }); s = um(s, { type: 'ENCOUNTER_TALK' });
    if (policy !== 'ALL') s = um(s, { type: 'SET_COMBAT_POLICY', policy });
    s = um(s, { type: 'ENCOUNTER_FIGHT' }); assertValidSliceState(s); starts.set(key, s);
  }
  return structuredClone(starts.get(key)!);
}
function costEvidence(o: UncleanMonarchRoundOutcome): void {
  const actions = [...o.playerActions, ...o.enemyActions].sort((a, b) => a.order - b.order);
  expect(actions.map(a => a.order)).toEqual(actions.map((_a, i) => i));
  expect(actions.every(a => a.elapsedSeconds === 5 && a.atSeconds === o.source.clockSeconds + 5 * a.order)).toBe(true);
  expect(o.clockSecondsAfter).toBe(o.source.clockSeconds + 60);
  expect(o.playerSpiritualityAfter).toBe(o.source.playerSpirituality - o.playerActions.reduce((n, a) => n + a.paidCost, 0));
  expect(o.enemySpirituality).toBe(o.source.enemySpirituality - o.enemyActions.reduce((n, a) => n + a.paidCost, 0));
  expect(o.strainAfter).toBe(o.source.strain + o.playerActions.reduce((n, a) => n + a.strainCost, 0));
  expect(o.operationAfter).toEqual(o.source.operation);
  expect(o.pieceAfter.charges).toBe(o.source.piece.charges - actions.reduce((n, a) => n + a.pieceChargePaid, 0));
  expect(o.pieceAfter.wear).toBe(o.source.piece.wear + actions.reduce((n, a) => n + a.pieceWearPaid, 0));
  expect(o.siteAfter.card).toEqual(o.source.site.card); expect(o.siteAfter.volunteer).toEqual(o.source.site.volunteer); expect(o.siteAfter.guide).toEqual(o.source.site.guide);
  expect(o.siteAfter.playerTravelMetres).toBe(o.source.site.playerTravelMetres + o.playerActions.reduce((n, a) => n + a.travelMetres, 0));
  for (const a of o.playerActions.filter(a => a.id === BINDING || a.id === INTERFERENCE)) {
    expect(a.paidCost).toBe(a.attempted ? 8 : 0); expect(a.mindCost).toBe(a.attempted ? a.succeeded ? 2 : 4 : 0);
    expect(a.rolls.length).toBe(a.attempted ? a.id === INTERFERENCE && (a.succeeded || a.resisted) ? 2 : 1 : 0);
    if (a.attempted && a.id === BINDING) expect(a.ownImpulse).toEqual({ actor: 'PLAYER', kind: 'RUSH_STRIKE', observedAt: a.atSeconds, conditionVersion: a.conditionVersion });
    if (a.attempted && a.id === INTERFERENCE) expect(a.emotionEvidence).toEqual({ targetId: 'UM1-HARLAN', kind: 'STRONG_ANGER', observedAt: o.source.emotionObservedAt, conditionVersion: a.conditionVersion, visible: true });
    if (a.applied) {
      const trigger = actions.find(v => v.order === a.chargeConsumedByOrder)!;
      expect(a.succeeded).toBe(true); expect(trigger.atSeconds).toBeLessThan(a.expiresAt!); expect(trigger.conditionVersion).toBe(a.conditionVersion);
      expect(a.appliedAmount).toBeGreaterThan(0); expect(a.appliedAmount).toBeLessThanOrEqual(a.id === BINDING ? 35 : 30);
      expect(trigger.pieceChargePaid).toBe(1); expect(trigger.pieceWearPaid).toBe(1); expect(a.masteryApplied).toEqual([a.id]);
      if (a.id === BINDING) { expect('id' in trigger).toBe(true); expect(['ORDINARY', 'ORIGINAL_CLUB', 'ORDINARY_FALLBACK', 'INHERITED_BODY']).toContain((trigger as UncleanMonarchRoundOutcome['playerActions'][number]).mode); }
      else { expect('attackKind' in trigger).toBe(true); expect(['BODY', 'MENTAL']).toContain((trigger as UncleanMonarchRoundOutcome['enemyActions'][number]).attackKind); }
    } else expect(a.masteryApplied).toEqual([]);
  }
  for (const [id, value] of Object.entries(o.source.inheritedMastery)) expect(o.masteryAfter[id]).toBe(value);
  for (const id of [BINDING, INTERFERENCE]) expect(o.masteryAfter[id]).toBe(Math.min(500, o.source.mastery[id]! + 8 * o.playerActions.filter(a => a.masteryApplied.includes(id)).length));
  for (const a of o.enemyActions.filter(a => a.actual === 'ARC_BOLT' || a.actual === 'DREAD_PULSE')) {
    expect(a.paidCost).toBe(7); expect(a.receipt).toMatchObject({ targetId: 'UM1-HARLAN', plateId: a.plateId, paidCost: 7, atSeconds: a.atSeconds, visible: true });
    expect(o.platesAfter.find(p => p.id === a.plateId)).toMatchObject({ status: 'SPENT', usedRound: o.round, usedOrder: a.order });
    expect(a.threatens).toBe(a.attackKind === 'BODY' && a.selfGain > 0); expect(a.mentalPressure).toBe(a.attackKind === 'MENTAL' && a.selfGain > 0);
  }
  expect(o.platesAfter.filter(p => p.status === 'SPENT').length).toBe(o.powerUses.ARC_BOLT + o.powerUses.DREAD_PULSE);
  expect(o.conditionVersion).toBe(1 + o.powerUses.CALM_BREATH);
  if (o.powerUses.CALM_BREATH) { expect(o.emotion).toBe('CALM'); expect(o.emotionObservedAt).toBeNull(); }
}

describe('Unclean Monarch finite original-body combat and exact replay', () => {
  it('retains the genuine migrated718 living source, all16 mastery values, four zeros, load3 and all eight historical roots', () => {
    const original = originalBloodDuke(), s = practiced();
    expect(original.schemaVersion).toBe(CURRENT_SCHEMA_VERSION); expect(original.contentVersion).toBe(CURRENT_CONTENT_VERSION);
    expect(oldAbyssRoots(s)).toEqual(oldAbyssRoots(original)); expect(s.character.gender).toBe('FEMALE'); expect(s.uncleanMonarch.life.site.playerLocation).toBe('START');
    expect(s.uncleanMonarch.encounter.strain).toBe(3); expect(s.demon.strain).toBe(3); expect(s.unwinged.conscienceLost).toBe(true);
    expect(s.uncleanMonarch.life.volunteerEffortSpent).toBe(9);
    for (const [id, value] of Object.entries(original.progression.mastery)) expect(s.progression.mastery[id]).toBe(value);
    expect(Object.values(original.progression.mastery).filter(n => n === 0)).toHaveLength(4);
    expect([s.progression.mastery[BINDING], s.progression.mastery[INTERFERENCE]]).toEqual([0, 0]);
  }, 180_000);
  it('keeps six original weights and exactly the existing S2 stance substitutions, with two20-ticket slots only', () => {
    const s = start(), wheel = uncleanMonarchAbilityWheel(s, null), weights = [30, 15, 20, 20, 10, 5, 20, 20];
    expect(wheel).toHaveLength(8); wheel.forEach((row, i) => expect(row.weight).toBeCloseTo(weights[i]! / 140 * 100));
    const inherited = start('INHERITED_ONLY');
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) expect(uncleanMonarchAbilityWheel(inherited, stance).map(({ id, weight }) => ({ id, weight }))).toEqual(bloodDukeAbilityWheel(originalBloodDuke(), stance).map(({ id, weight }) => ({ id, weight })));
    expect(uncleanMonarchAbilityWheel(s, 'DEFEND').map(row => row.id)).toContain('abyss.s2.self-restraint');
    expect(uncleanMonarchAbilityWheel(s, 'CONTROL').map(row => row.id)).toContain('abyss.s2.emotion-interference');
    expect(UNCLEAN_MONARCH_COUNT_WHEEL).toEqual(UNCLEAN_MONARCH_ENEMY_COUNT_WHEEL);
    const counts = Array.from({ length: 100 }, (_, i) => uncleanMonarchActionCount(i + 1));
    expect([1, 2, 3, 4, 5, 6].map(n => counts.filter(v => v === n).length)).toEqual([10, 15, 25, 25, 15, 10]);
    expect(counts).toEqual(Array.from({ length: 100 }, (_, i) => uncleanMonarchEnemyActionCount(i + 1)));
    expect(projectUncleanMonarchEncounter(s).enemyAbilityWheel).toEqual(UNCLEAN_MONARCH_ENEMY_ABILITY_WHEEL);
    expect(UNCLEAN_MONARCH_POLICIES).toEqual(['INHERITED_ONLY', 'BINDING', 'INTERFERENCE', 'ALL', 'ORDINARY']);
  }, 120_000);
  it('buys one new piece then physically moves original Nora with her original card before the player enters the adjacent yard', () => {
    const s = start(), e = s.uncleanMonarch.encounter, original = originalBloodDuke();
    expect(e.currentSite!.playerTravelMetres).toBe(e.startSite!.playerTravelMetres + 4);
    expect(e.currentSite!.clockSeconds).toBe(e.startSite!.clockSeconds + 12); expect(e.currentSite!.card.travelMetres).toBe(e.startSite!.card.travelMetres + 8);
    expect(e.currentSite!.volunteer).toEqual({ ...e.startSite!.volunteer, location: 'OUTSIDE' }); expect(e.currentSite!.card.location).toBe('NORA');
    expect(e.currentSite!.guide).toEqual(original.blatherer.life.guide); expect(e.currentSite).toEqual(uncleanMonarchApproachedSite(e.startSite!, s.uncleanMonarch.sourceScene!.originals));
    expect(e.piece).toMatchObject({ id: 'UM1-COMBAT-PIECE', charges: 3, wear: 0, paidPennies: 30 }); expect(e.plates.map(p => p.id)).toEqual(['UM1-HARLAN-PLATE-1', 'UM1-HARLAN-PLATE-2', 'UM1-HARLAN-PLATE-3']);
    expect(e.emotionObservedAt).toBe(e.currentSite!.clockSeconds); expect(e.targetId).toBe('UM1-HARLAN'); expect(e.startSource).toMatchObject({ targetAge: 47, independentMind: true, actualBody: true, enemyWeapon: 'UM1-HARLAN-ROD', maxActionCount: 6 });
    expect(oldAbyssRoots(s)).toEqual(oldAbyssRoots(original)); rejectUncleanMonarch(s, { type: 'PREPARE_ENCOUNTER' }); rejectUncleanMonarch(s, { type: 'SET_COMBAT_SPIRIT', spiritId: 'THT3-HELENA' });
  }, 120_000);
  it('peaceful exit before talk or after talk preserves the same paid piece, bodies, card and original load', () => {
    let s = ready(practiced(), { ap: 2, cash: 30 }); s = um(s, { type: 'PREPARE_ENCOUNTER' }); const prepared = structuredClone(s), before = structuredClone(s.uncleanMonarch.encounter.currentSite!);
    const leaveAtDoor = um(s, { type: 'LEAVE_ENCOUNTER' }); expect(leaveAtDoor.uncleanMonarch.encounter.currentSite).toEqual(before); expect(validateUncleanMonarchEncounter(leaveAtDoor)).toBe(true);
    s = um(prepared, { type: 'ENCOUNTER_TALK' }); const yard = structuredClone(s.uncleanMonarch.encounter.currentSite!); s = um(s, { type: 'LEAVE_ENCOUNTER' });
    expect(s.uncleanMonarch.encounter.currentSite).toEqual({ ...yard, playerLocation: 'START', playerTravelMetres: yard.playerTravelMetres + 4, clockSeconds: yard.clockSeconds + 4 });
    expect(s.uncleanMonarch.encounter.piece).toEqual(prepared.uncleanMonarch.encounter.piece); expect(s.uncleanMonarch.encounter.strain).toBe(3); expect(s.uncleanMonarch.encounter.terminal).toBeNull();
    expect(s.uncleanMonarch.encounter.currentSite!.volunteer.location).toBe('OUTSIDE'); expect(s.uncleanMonarch.encounter.currentSite!.card.location).toBe('NORA');
    expect(validateUncleanMonarchEncounter(s)).toBe(true); assertValidSliceState(s); rejectUncleanMonarch(s, { type: 'PREPARE_ENCOUNTER' });
  }, 120_000);
  it('purely replays the exact ordered RNG, actual costs, independent finite plates and body/mental causality', () => {
    const s = start(), snapshot = structuredClone(s), source = currentUncleanMonarchCombatSource(s)!; expect(validUncleanMonarchCombatSource(source)).toBe(true);
    const result = replayUncleanMonarchCombatRound(source, 'CONTROL'); expect(replayUncleanMonarchCombatRound(source, 'CONTROL')).toEqual(result); expect(s).toEqual(snapshot);
    const o = result.round.uncleanMonarchOutcome!; costEvidence(o); expect(validateUncleanMonarchCombatRound(result.round)).toBe(true); expect(validateUncleanMonarchRoundOutcome(o)).toBe(true);
    expect(resolveUncleanMonarchCombatRound(s, 'CONTROL')).toEqual(result); expect(oldAbyssRoots(s)).toEqual(oldAbyssRoots(snapshot)); expect(s.uncleanMonarch.encounter.currentSite).toEqual(o.siteAfter);
    expect(s.uncleanMonarch.encounter.piece).toEqual(o.pieceAfter); expect(s.uncleanMonarch.encounter.strain).toBe(o.strainAfter);
    if (o.continuing) { s.combatHistory.push(result.round); s.revision++; expect(currentUncleanMonarchCombatSource(s)).toEqual(nextUncleanMonarchCombatSource(o)); }
  }, 120_000);
  it('rejects tampered complete rounds and forged receipts, counts, resources, bodies, emotion, old mastery or current conditions', () => {
    const round = replayUncleanMonarchCombatRound(currentUncleanMonarchCombatSource(start())!, 'CONTROL').round;
    const bad = (mutate: (r: SliceCombatRound) => void) => { const copy = structuredClone(round); mutate(copy); expect(validateUncleanMonarchCombatRound(copy)).toBe(false); };
    bad(r => r.uncleanMonarchOutcome!.randomCursorAfter++); bad(r => r.uncleanMonarchOutcome!.pieceAfter.charges++); bad(r => r.uncleanMonarchOutcome!.strainAfter = 0);
    bad(r => r.uncleanMonarchOutcome!.masteryAfter['abyss.s7.ritual-practice'] = 1); bad(r => r.uncleanMonarchOutcome!.masteryAfter[BINDING]!++);
    bad(r => r.uncleanMonarchOutcome!.source.targetAge = 48 as 47); bad(r => r.uncleanMonarchOutcome!.source.maxActionCount = 7 as 6);
    bad(r => r.uncleanMonarchOutcome!.siteAfter.volunteer.location = 'A'); bad(r => r.uncleanMonarchOutcome!.siteAfter.card.travelMetres++);
    bad(r => r.uncleanMonarchOutcome!.enemySpirituality++); bad(r => r.uncleanMonarchOutcome!.playerSpiritualityAfter++); bad(r => r.uncleanMonarchOutcome!.conditionVersion++);
    bad(r => r.uncleanMonarchOutcome!.source.emotionObservedAt = null); bad(r => r.uncleanMonarchOutcome!.platesAfter[0]!.id = 'OLD-REUSED-PLATE');
    bad(r => r.moves.push({ actor: 'PLAYER', label: '伪造', selfGain: 0, enemyReduction: 0 }));
    bad(r => r.playerCount = 7); bad(r => r.consequenceRoll = null as unknown as number);
  }, 120_000);
  it('ordinary policy preserves all supernatural resources and full source-specific six-slot weights', () => {
    const s = start('ORDINARY'), o = replayUncleanMonarchCombatRound(currentUncleanMonarchCombatSource(s)!, 'ATTACK').round.uncleanMonarchOutcome!;
    expect(o.playerActions.every(a => a.paidCost === 0 && a.mindCost === 0 && a.strainCost === 0 && a.masteryApplied.length === 0)).toBe(true);
    expect(o.strainAfter).toBe(3); expect(o.pieceAfter).toEqual(o.source.piece); expect(o.masteryAfter).toEqual(o.source.mastery); expect(uncleanMonarchAbilityWheel(s, null)).toHaveLength(6);
  }, 120_000);
  it('covers finite new-window successes, paid failures, real resistance, expiry, calm counters and empty-piece fallback without changing a live run', () => {
    const live = start(), untouched = structuredClone(live), original = currentUncleanMonarchCombatSource(live)!;
    const seen = { appliedBinding: false, appliedInterference: false, failed: false, resisted: false, expired: false, countered: false, emptyFallback: false, noEmotionFallback: false };
    // Exhaustive UNIT-only cursor matrix for the pure resolver. No cursor is selected
    // for public play, no source save is written and the natural continuation is untouched.
    for (let offset = 0; offset < 192; offset++) {
      const source = structuredClone(original); source.randomCursor += offset;
      const o = replayUncleanMonarchCombatRound(source, offset % 2 ? 'CONTROL' : 'PREPARE').round.uncleanMonarchOutcome!; costEvidence(o);
      for (const a of o.playerActions.filter(a => a.id === BINDING || a.id === INTERFERENCE)) {
        if (a.applied) { if (a.id === BINDING) seen.appliedBinding = true; else seen.appliedInterference = true; }
        if (a.attempted && !a.succeeded) { seen.failed = true; expect(a.mindCost).toBe(4); }
        if (a.resisted) { seen.resisted = true; expect(a.rolls.at(-1)).toBeLessThanOrEqual(35); }
        if (a.chargeGranted && !a.applied && o.expiredEffectOrders.includes(a.order)) seen.expired = true;
        if (a.chargeCancelledByOrder !== null) { seen.countered = true; expect(o.enemyActions.find(e => e.order === a.chargeCancelledByOrder)?.actual).toBe('CALM_BREATH'); }
        if (!a.attempted && a.id === INTERFERENCE && o.enemyActions.some(e => e.actual === 'CALM_BREATH' && e.order < a.order)) seen.noEmotionFallback = true;
      }
      const empty = structuredClone(source); empty.piece.charges = 0; empty.piece.wear = 3;
      const emptyOutcome = replayUncleanMonarchCombatRound(empty, 'PREPARE').round.uncleanMonarchOutcome!;
      for (const a of emptyOutcome.playerActions.filter(a => a.id === BINDING || a.id === INTERFERENCE)) { seen.emptyFallback = true; expect(a).toMatchObject({ attempted: false, paidCost: 0, mindCost: 0, masteryApplied: [] }); }
    }
    expect(Object.values(seen).every(Boolean), JSON.stringify(seen)).toBe(true); expect(live).toEqual(untouched);
  }, 120_000);
  it('uses the exact35/30/15/20 core formula and never turns a mental-only consequence into a body wound', () => {
    const original = currentUncleanMonarchCombatSource(start())!;
    let mentalFound = false;
    for (let offset = 0; offset < 192; offset++) {
      const x = structuredClone(original); x.randomCursor += offset;
      const round = replayUncleanMonarchCombatRound(x, 'PREPARE').round, o = round.uncleanMonarchOutcome!;
      const expected = Math.max(150, 1500 + Math.min(300, x.physique * .35 + x.perception * .30 + x.will * .15 + x.knowledge * .20) + o.playerActions.reduce((n, a) => n + a.selfGain, 0) - o.enemyActions.reduce((n, a) => n + a.enemyReduction, 0));
      expect(round.playerAdvantage).toBeCloseTo(expected);
      if (round.consequenceDomain === 'MENTAL') { mentalFound = true; expect(round.consequenceRoll).toBeUndefined(); expect(round.consequenceWeights).toBeNull(); expect(o.playerHealthAfter).toBe(x.playerHealth); expect(o.playerInjuriesAfter).toEqual(x.playerInjuries); expect(o.playerRiskAfter).toBe(x.playerRisk); }
    }
    expect(mentalFound).toBe(true);
  }, 120_000);
  it('fixed ALL plus CONTROL reaches its real terminal with zeroAP weekly finance and immutable old enemies', () => {
    let s = start('ALL', true); const roots = oldAbyssRoots(s), startWeek = s.week, prep = s.uncleanMonarch.encounter.preparation!; expect(s.actionsRemaining).toBe(0);
    for (let round = 0; round < 90 && s.combat; round++) s = applySliceIntent(s, { type: 'COMBAT_ROUND', stance: 'CONTROL' });
    expect(s.combat).toBeNull(); expect(s.uncleanMonarch.encounter.terminal).not.toBeNull(); expect(validateUncleanMonarchEncounter(s)).toBe(true); assertValidSliceState(s); expect(oldAbyssRoots(s)).toEqual(roots);
    const terminal = s.uncleanMonarch.encounter.terminal!, last = s.combatHistory[terminal.historyIndex]!.uncleanMonarchOutcome!, fight = s.uncleanMonarch.encounter.journal.at(-1)!;
    expect(s.uncleanMonarch.encounter.currentSite!.playerLocation).toBe(terminal.outcome === 'PLAYER_DEAD' ? 'YARD' : 'START');
    expect(s.uncleanMonarch.encounter.currentSite!.volunteer.location).toBe('OUTSIDE'); expect(s.uncleanMonarch.encounter.currentSite!.card.location).toBe('NORA');
    expect(s.uncleanMonarch.encounter.weaponLocation).toBe(last.enemyStatus === 'RESISTING' ? 'HAND' : 'YARD'); expect(terminal.exitMetres).toBe(s.status === 'DEAD' ? 0 : 4);
    if (s.status === 'ACTIVE') { expect(s.week).toBe(startWeek + 1); expect(s.actionsRemaining).toBe(prep.finance.weeklyBudget); } else expect(s.week).toBe(startWeek);
    const expected = { ...fight.after, health: last.playerHealthAfter, mind: last.playerMindAfter, spirituality: last.playerSpiritualityAfter, mastery: last.masteryAfter, injuries: last.playerInjuriesAfter, injuryRisk: last.playerRiskAfter };
    expect(uncleanMonarchCompletedBudgetMatches(s, expected, fight.finance, fight.week, fight.date, last.source.revision + 1, last.randomCursorAfter, '哈伦的相邻院落冲突结束')).toBe(true);
    const fakeFinance = uncleanMonarchFinanceSnapshot(fight.finance); fakeFinance.debts.push({ id: 'forged-debt', source: '未发生的欠款', remaining: 50, weeklyPayment: 5, createdWeek: fight.week });
    expect(uncleanMonarchCompletedBudgetMatches(s, expected, fakeFinance, fight.week, fight.date, last.source.revision + 1, last.randomCursorAfter, '哈伦的相邻院落冲突结束')).toBe(false);
    expect(s.blatherer.encounter.status).toBe('AVAILABLE'); expect(s.bloodDuke.encounter.status).toBe('AVAILABLE');
    expect(projectUncleanMonarchCombat(s).lastActionSequence.length).toBe(last.playerActions.length + last.enemyActions.length);
  }, 180_000);
});
