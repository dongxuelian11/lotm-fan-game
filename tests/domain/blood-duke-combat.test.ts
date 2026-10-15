import { describe, expect, it } from 'vitest';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState, SliceStance, SliceCombatRound } from '../../src/domain/slice/types.js';
import { projectBloodDukeCombat, currentBloodDukeCombatSource, validateBloodDukeRoundOutcome, validateBloodDukeCombatRound, bloodDukeAbilityWheel,
  beginBloodDukeCombatRound, resolveBloodDukeCombatAbility } from '../../src/domain/blood-duke/combat.js';
import { createBloodDukeEncounterState, validateBloodDukeEncounter, projectBloodDukeEncounter, replayBloodDukeEncounterRoot } from '../../src/domain/blood-duke/encounter.js';
import { replayBloodDukeLifeRoot } from '../../src/domain/blood-duke/life.js';
import { resolveBloodDukeCombatRound } from '../../src/domain/slice/blood-duke-combat.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { bd, promoted, recover, step, rejectBloodDuke } from './blood-duke-directed-helper.js';

const RESTRAINT = 'abyss.s2.self-restraint', INTERFERENCE = 'abyss.s2.emotion-interference';
let closedCache: SliceState | undefined;
/** UNIT-only initial budgets are declared by promoted(). Every subsequent life,
 * encounter and campaign-round transition below uses the public command path. */
function closedLife(): SliceState {
  if (!closedCache) {
    let s = recover(promoted());
    for (const caseId of ['door-restraint', 'bell-hesitation', 'withdrawn-rehearsal'] as const) {
      for (const command of [
        { type: 'OBSERVE', caseId }, { type: 'PREPARE', caseId, method: 'ORDINARY' },
        { type: 'WALK', caseId, to: 'A' }, { type: 'CONSENT_NORA', caseId }, { type: 'TAKE_CARD', caseId },
        { type: 'WALK', caseId, to: 'B' }, { type: 'READ_NOTE', caseId }, { type: 'WALK', caseId, to: 'A' }, { type: 'MANUAL_OPERATION', caseId },
      ] as const) s = bd(s, command);
      if (caseId === 'withdrawn-rehearsal') s = bd(s, { type: 'WITHDRAW_PERMISSION', caseId });
      for (const command of [
        { type: 'RETURN_CARD', caseId }, { type: 'WALK', caseId, to: 'START' }, { type: 'INSPECT', caseId },
        { type: 'LEAVE', caseId }, { type: 'REPORT', caseId },
      ] as const) s = bd(s, command);
    }
    s = bd(s, { type: 'REFLECT' }); assertValidSliceState(s); closedCache = s;
  }
  return structuredClone(closedCache);
}
function ready(): SliceState { return bd(bd(closedLife(), { type: 'PREPARE_ENCOUNTER' }), { type: 'ENCOUNTER_TALK' }); }
function fight(): SliceState { return bd(ready(), { type: 'ENCOUNTER_FIGHT' }); }

function expectCosts(round: SliceCombatRound): void {
  const o = round.bloodDukeOutcome!;
  expect(validateBloodDukeRoundOutcome(o)).toBe(true); expect(validateBloodDukeCombatRound(round)).toBe(true);
  expect(validateBloodDukeCombatRound(JSON.parse(JSON.stringify(round)) as SliceCombatRound)).toBe(true);
  expect(round.consequenceDomain).toBe('BODY'); expect(o.elapsedSeconds).toBe(60);
  expect(o.enemySpirituality).toBe(o.enemySpiritualityBefore - o.enemyActions.reduce((n, a) => n + a.paidCost, 0));
  expect(o.playerSpiritualityAfter).toBe(o.playerSpiritualityBefore - o.playerActions.reduce((n, a) => n + a.paidCost, 0));
  expect(o.playerMindAfter).toBe(o.source.playerMind - o.playerActions.reduce((n, a) => n + a.mindCost, 0));
  expect(o.playerStrainAfter).toBe(o.source.strain + o.playerActions.reduce((n, a) => n + a.strainCost, 0));
  expect(o.playerStrainAfter).toBeLessThanOrEqual(3);
  for (const id of [RESTRAINT, INTERFERENCE]) {
    const attempts = o.playerActions.filter(a => a.id === id && a.attempted); expect(attempts.length).toBeLessThanOrEqual(1);
    for (const a of attempts) { expect(a.paidCost).toBe(6); expect(a.mindCost).toBe(2); expect(a.enemyReduction).toBe(0); expect(a.selfGain).toBe(0); }
  }
  for (const a of o.playerActions.filter(a => a.chargeGranted)) {
    if (a.chargeConsumedByOrder === null) { expect(a.applied).toBe(false); expect(a.appliedAmount).toBe(0); }
    else {
      const consumer = o.enemyActions.find(e => e.order === a.chargeConsumedByOrder)!;
      expect(consumer).toBeDefined(); expect(consumer.attackKind).toBe('BODY'); expect(consumer.succeeded).toBe(true);
      expect(['BODY_STRIKE', 'SILVER_THRUST']).toContain(consumer.actual); expect(consumer.consumedEffectOrders).toContain(a.order);
      expect(a.appliedAmount).toBeGreaterThan(0); if (a.id === RESTRAINT) expect(a.appliedAmount).toBeLessThanOrEqual(30); if (a.id === INTERFERENCE) expect(a.appliedAmount).toBeLessThanOrEqual(25);
    }
    if (a.chargeCancelledByOrder !== null) { const clearer = o.enemyActions.find(e => e.order === a.chargeCancelledByOrder); if (clearer) expect(clearer.actual).toBe('STEADY_BREATH'); else expect(o.playerActions.find(p => p.order === a.chargeCancelledByOrder)?.id).toBe('abyss.s3.limited-murmur'); expect(a.applied).toBe(false); }
  }
  for (const a of o.playerActions.filter(a => a.mode === 'NO_STRONG_EMOTION')) { expect(a.paidCost).toBe(0); expect(a.mindCost).toBe(0); expect(a.attempted).toBe(false); expect(a.chargeGranted).toBe(false); }
}

describe('Blood Duke actual adult encounter and deterministic physical combat', () => {
  it('walks the same Nora and original card outside before fighting and permits a real ordinary exit', () => {
    const source = closedLife(), old = structuredClone(source.blatherer.encounter), immutable = structuredClone(source);
    expect(projectBloodDukeEncounter(source).scene?.distanceMetres).toBe(6); expect(projectBloodDukeCombat(source)).toMatchObject({ distanceMetres: 6, alliesPresent: 1, automaticAllyImmunity: false }); expect(source).toEqual(immutable);
    rejectBloodDuke(source, { type: 'ENCOUNTER_FIGHT' });
    const s = ready();
    expect(projectBloodDukeEncounter(s).scene?.distanceMetres).toBe(2); expect(projectBloodDukeCombat(s)).toMatchObject({ distanceMetres: 2, alliesPresent: 0, automaticAllyImmunity: false });
    expect(s.blatherer.life.volunteer).toEqual({ ...source.blatherer.life.volunteer, location: 'OUTSIDE' });
    expect(s.blatherer.life.card).toEqual({ ...source.blatherer.life.card, travelMetres: source.blatherer.life.card.travelMetres + 8 });
    expect(s.blatherer.life.playerLocation).toBe('A'); expect(s.blatherer.life.playerTravelMetres).toBe(source.blatherer.life.playerTravelMetres + 4);
    expect(s.blatherer.life.clockSeconds).toBe(source.blatherer.life.clockSeconds + 12); expect(s.blatherer.encounter).toEqual(old); expect(old.status).toBe('AVAILABLE');
    const enemy = projectBloodDukeEncounter(s).enemy!; expect(enemy.id).not.toBe(old.targetId); expect(enemy.age).toBe(44); expect(enemy.pathway).toBe('warrior');
    const left = bd(s, { type: 'LEAVE_ENCOUNTER' }); expect(left.bloodDuke.encounter.status).toBe('RESOLVED'); expect(left.blatherer.life.playerLocation).toBe('START');
    expect(left.blatherer.life.volunteer.location).toBe('OUTSIDE'); expect(left.blatherer.life.clockSeconds).toBe(source.blatherer.life.clockSeconds + 16);
    expect(projectBloodDukeEncounter(left).scene?.distanceMetres).toBe(6); expect(projectBloodDukeCombat(left)).toMatchObject({ distanceMetres: 6, alliesPresent: 0 });
    expect(left.blatherer.encounter).toEqual(old); assertValidSliceState(left); rejectBloodDuke(left, { type: 'ENCOUNTER_TALK' });
  }, 10_000); // Includes the actual 583-command prefix and all three public life cases on a cold cache.

  it('keeps all six old relative wheel weights, paid stance substitutions and real inherited resources', () => {
    let s = fight(); const start = structuredClone(s), wheel = bloodDukeAbilityWheel(s, null);
    expect(wheel).toHaveLength(6); expect(wheel.map(a => a.weight / wheel[5]!.weight)).toEqual([6, 3, 4, 4, 2, 1]);
    expect(bloodDukeAbilityWheel(s, 'DEFEND')[2]!.id).toBe(RESTRAINT); expect(bloodDukeAbilityWheel(s, 'CONTROL')[3]!.id).toBe(INTERFERENCE);
    expect(bloodDukeAbilityWheel(s, 'ATTACK')[2]!.id).toBe('abyss.s6.demonic-body'); expect(bloodDukeAbilityWheel(s, 'ATTACK')[3]!.id).toBe('abyss.s3.limited-murmur');
    let rounds = 0;
    while (s.combat && rounds++ < 30) {
      s = step(s, { type: 'COMBAT_ROUND', stance: rounds % 3 === 1 ? 'CONTROL' : rounds % 3 === 2 ? 'DEFEND' : 'ATTACK' });
      expectCosts(s.combatHistory.at(-1)!); expect(validateBloodDukeEncounter(s)).toBe(true); assertValidSliceState(s);
      expect(s.blatherer.encounter).toEqual(start.blatherer.encounter);
      for (const key of ['criminal', 'unwinged', 'serialKiller', 'desireApostle', 'devil'] as const) expect(s[key]).toEqual(start[key]);
      expect({ ...s.demon, strain: start.demon.strain }).toEqual(start.demon); expect(s.progression.mastery).toEqual(start.progression.mastery);
    }
    expect(rounds).toBeLessThan(30); expect(s.bloodDuke.encounter.terminal).not.toBeNull(); expect(s.blatherer.life.volunteer.location).toBe('OUTSIDE');
    expect(projectBloodDukeCombat(s).summary).not.toMatch(/G\b|候选|来源|吸血恢复/); expect(projectSliceState(s).combat).toBeNull();
  });

  it('rejects refills, restored old strain, altered bystanders, stale contexts and extra recorded fields', () => {
    const s = fight(); expect(validateBloodDukeEncounter(s)).toBe(true);
    for (const mutate of [
      (q: SliceState) => { q.spirituality++; }, (q: SliceState) => { q.demon.strain = q.demon.strain === 0 ? 1 : 0; },
      (q: SliceState) => { q.blatherer.life.volunteer.location = 'A'; }, (q: SliceState) => { q.bloodDuke.encounter.startSource!.randomCursor--; },
      (q: SliceState) => { q.blatherer.encounter.enemyHealth--; }, (q: SliceState) => { q.bloodDuke.encounter.startRoot!.card.travelMetres++; },
      (q: SliceState) => { (q.bloodDuke.encounter.preparation! as unknown as Record<string, unknown>).freeGuard = true; },
    ]) { const q = structuredClone(s); mutate(q); expect(validateBloodDukeEncounter(q)).toBe(false); }
    const q = structuredClone(s), random = new DeterministicActionRandomStream(q.random.seed, q.random.cursor), context = beginBloodDukeCombatRound(q, 'CONTROL', random), before = structuredClone(q);
    expect(resolveBloodDukeCombatAbility(q, INTERFERENCE, 1, random, context).selfGain).toBe(0); expect(q).toEqual(before);
    const reset = structuredClone(s); reset.bloodDuke.encounter = createBloodDukeEncounterState(); expect(replayBloodDukeEncounterRoot(reset, replayBloodDukeLifeRoot(reset)!)).not.toEqual(reset.blatherer.life);
  });

  it('replays declared isolated UNIT rounds through failed or resisted casts, real pending consumption and enemy counteraction', () => {
    const base = fight(), seen = { restraint: false, unused: false, interference: false, resisted: false, failed: false, cancelled: false, noEmotion: false, death: false, retreat: false, fallback: false, armor: false };
    // Round-only UNIT input sources, explicitly separate from complete saves and
    // the unchanged-seed public natural campaign. No outcome/draw is replaced.
    for (let n = 0; n < 384 && !Object.values(seen).every(Boolean); n++) {
      const s = structuredClone(base); s.random.seed = `blood-duke-combat-unit-${n}`; s.random.cursor = 0;
      s.bloodDuke.encounter.preparation!.randomSeed = s.random.seed; s.bloodDuke.encounter.preparation!.randomCursor = 0;
      if (n % 11 === 0) s.spirituality = 0;
      if (n % 11 === 1) { s.health = 10; s.injuryRisk = 10; }
      s.bloodDuke.encounter.startSource = currentBloodDukeCombatSource(s)!;
      const stance: SliceStance = n % 13 === 0 ? 'RETREAT' : n % 2 ? 'CONTROL' : 'DEFEND';
      const result = resolveBloodDukeCombatRound(s, stance), round = result.round, o = round.bloodDukeOutcome!; expectCosts(round);
      seen.restraint ||= o.playerActions.some(a => a.id === RESTRAINT && a.applied); seen.unused ||= o.playerActions.some(a => a.id === RESTRAINT && a.chargeGranted && !a.applied);
      seen.interference ||= o.playerActions.some(a => a.id === INTERFERENCE && a.applied); seen.resisted ||= o.playerActions.some(a => a.resisted);
      seen.failed ||= o.playerActions.some(a => [RESTRAINT, INTERFERENCE].includes(a.id) && a.attempted && !a.succeeded && !a.resisted);
      seen.cancelled ||= o.playerActions.some(a => a.chargeCancelledByOrder !== null); seen.noEmotion ||= o.playerActions.some(a => a.mode === 'NO_STRONG_EMOTION');
      seen.death ||= result.outcome === 'PLAYER_DEAD'; seen.retreat ||= result.outcome === 'RETREATED'; seen.fallback ||= o.playerActions.some(a => a.mode === 'ORDINARY_FALLBACK');
      seen.armor ||= o.enemyActions.some(a => a.actual === 'SILVER_ARMOR' && a.appliedAmount > 0);
      if (o.breathUses > o.source.breathUses) expect(o.emotionAfter).toBe('CALM');
      expect(s.blatherer.encounter).toEqual(base.blatherer.encounter); expect(o.playerHealthAfter).toBeLessThanOrEqual(o.source.playerHealth);
      const forged = structuredClone(round); (forged as unknown as Record<string, unknown>).freeGuard = true; expect(validateBloodDukeCombatRound(forged)).toBe(false);
      for (const mutate of [
        (v: typeof o) => { v.playerMindAfter++; }, (v: typeof o) => { v.randomCursorAfter++; },
        (v: typeof o) => { v.emotionAfter = v.emotionAfter === 'CALM' ? 'ANGRY' : 'CALM'; },
        (v: typeof o) => { if (v.playerActions[0]) v.playerActions[0].paidCost++; else v.elapsedSeconds = 61 as 60; },
      ]) { const bad = structuredClone(o); mutate(bad); expect(validateBloodDukeRoundOutcome(bad)).toBe(false); }
    }
    expect(seen).toEqual({ restraint: true, unused: true, interference: true, resisted: true, failed: true, cancelled: true, noEmotion: true, death: true, retreat: true, fallback: true, armor: true });
  }, 30_000);
});
