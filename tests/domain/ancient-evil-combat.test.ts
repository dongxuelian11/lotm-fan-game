import { ae, promoted, step } from './ancient-evil-directed-helper.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import type { AncientEvilActivityCommand } from '../../src/domain/ancient-evil/life.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { createSilentDiscipleLifeState } from '../../src/domain/silent-disciple/life.js';
import { ANCIENT_EVIL_BLOCK_IDS, ancientEvilApproachedRoot, combatBody, createAncientEvilEncounterState } from '../../src/domain/ancient-evil/encounter.js';
import { ANCIENT_EVIL_COUNT_WHEEL, ANCIENT_EVIL_ENEMY_COUNT_WHEEL, ANCIENT_EVIL_ENEMY_ABILITY_WHEEL, advanceAncientEvilCombatClock, ancientEvilAbilityWheel,
  createAncientEvilRuntime, drawAncientEvilEnemyAbility, nextAncientEvilCombatSource, replayAncientEvilCombatRound, resolveAncientEvilEnemySlot, resolveAncientEvilPlayerSlot,
  validateAncientEvilCombatRound, validateAncientEvilRoundOutcome, validAncientEvilCombatSource, type AncientEvilCombatSource } from '../../src/domain/ancient-evil/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';

const H = 'chained.s4.object-motion', J = 'BODY_FOLLOWUP', B = 'GHOST_DODGE', K = 'chained.s2.enduring-transfiguration';
/** Declared UNIT-only source. No persisted natural run, command list, or seed is edited. */
function source(purchased = true): AncientEvilCombatSource {
  const p = createSilentDiscipleLifeState(); p.introducedWeek = 1; p.volunteer.location = 'OUTSIDE'; p.guide.location = 'OUTSIDE'; p.playerLocation = 'A'; p.clockSeconds = 16; p.playerTravelMetres = 4;
  const e = createAncientEvilEncounterState(); e.blocksPurchased = purchased; if (purchased) e.blocks = ANCIENT_EVIL_BLOCK_IDS.map(id => ({ id, owner: 'PLAYER', status: 'READY', location: 'SOURCE', usedRound: null }));
  const before = { cash: 920, actions: 3, health: 100, mind: 100, spirituality: 120 };
  const fullBefore = { ...before, pollution: 0, sequence: 2 as const, acting: 100, coreStats: { physique: 10, perception: 20, will: 30, knowledge: 40 }, mastery: {}, completedSources: [], injuries: [], injuryRisk: 0 };
  return { runId: 'ancient-combat-unit', revision: 4, week: 1, round: 1, encounterId: 'ANCIENT_EVIL_DISPUTE', targetId: 'AE2-LENA', attemptWeek: 1, startHistoryIndex: 0,
    targetName: '莱娜', targetAge: 45, targetPathway: 'audience', targetSequence: 3, targetCore: 22, targetWill: 22, actualBody: true, independentMind: true, enemyWeapon: 'AE2-LENA-STAFF', yardId: 'SD3-QUIET-ROOM',
    enemyPosition: 'BETWEEN_A_AND_B', enemyDistanceMetres: 2, ordinaryExit: 'OPEN', pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false,
    playerHealth: 100, playerMind: 98, playerSpirituality: 120, playerInjuries: [], playerRisk: 0, physique: 10, perception: 20, will: 30, knowledge: 40,
    objectMastery: 0, bodyMastery: 0, burstMastery: 0, clubHeld: false, preparation: { week: 1, date: { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 }, fullBefore, fullAfter: { ...fullBefore, mind: 98 }, revision: 2, runId: 'ancient-combat-unit', randomSeed: 'ancient-combat-declared-unit', randomCursor: 0,
      mindPaid: 2, lifeJournalLength: 1, lifeClockSeconds: 0, before, after: { ...before, mind: 98 } }, root: p, body: combatBody(e), randomSeed: 'ancient-combat-declared-unit', randomCursor: 0 };
}
function random(...rolls: number[]): ActionRandomStream { let cursor = 0; return { seed: 'declared-slot-unit', get cursor() { return cursor; }, nextInt(min, max) { const n = rolls[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected declared draw ${n} in ${min}..${max}`); return n; } }; }
function scripted(rolls: number[]) { let cursor = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function(this: DeterministicActionRandomStream, min, max) { original.call(this, min, max); const n = rolls[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected directed draw ${n} in ${min}..${max}`); return n; });
  return { spy, count: () => cursor };
}
afterEach(() => vi.restoreAllMocks());
describe('Ancient Evil original-body combat: declared unit coverage', () => {
  it('retains the six weights, inherited core, separate actual enemy wheel and exact seeded replay', () => {
    const x = source(), s = { town: { clubLocation: 'SHOP' } } as SliceState;
    expect(ancientEvilAbilityWheel(s, null).map(a => a.weight)).toEqual([30, 15, 20, 20, 10, 5]);
    expect(ANCIENT_EVIL_COUNT_WHEEL).toEqual(ANCIENT_EVIL_ENEMY_COUNT_WHEEL);
    expect(ANCIENT_EVIL_ENEMY_ABILITY_WHEEL.map(a => a.weight)).toEqual([35, 25, 25, 10, 5]);
    expect([1, 36, 61, 86, 96].map(n => drawAncientEvilEnemyAbility(random(n)))).toEqual(['DREAM_SPIKE', 'DREAM_WARD', 'BODY_STRIKE', 'RESIST_FORM', 'ACCIDENT']);
    expect(validAncientEvilCombatSource(x)).toBe(true);
    const { round } = replayAncientEvilCombatRound(x, 'CONTROL'); expect(validateAncientEvilCombatRound(round)).toBe(true); expect(validateAncientEvilRoundOutcome(round.ancientEvilOutcome)).toBe(true);
    expect(replayAncientEvilCombatRound(x, 'CONTROL').round).toEqual(round);
    const bodyOnly = scripted([1, 1, 426, 96, 1]);
    const weighted = replayAncientEvilCombatRound(x, 'ATTACK').round; bodyOnly.spy.mockRestore();
    expect(weighted.playerAdvantage).toBe(1250 + 10 * .5 + 20 * .2 + 30 * .15 + 40 * .15 - 22.5); expect(weighted.enemyAdvantage).toBe(1272);
    expect(weighted.consequenceDomain).toBeUndefined(); expect(weighted.consequenceWeights).toBeNull();
  });
  it('keeps a paid90-second form after input ends and across a60-second boundary, with exact original body and staff', () => {
    const x = source(), r = createAncientEvilRuntime(x), before = structuredClone(x.body); r.body.enemyHealth = 80;
    r.body.enemyInjuries = [{ id: 'unit-original-wound', severity: 'LIGHT', acquiredRevision: 1, treatedRevision: null }];
    const contact = resolveAncientEvilPlayerSlot(x, r, K, 0, random(1)); expect(contact).toMatchObject({ mode: 'CONTACT', paidCost: 4, mindCost: 1, travelMetres: 4 });
    const cast = resolveAncientEvilPlayerSlot(x, r, K, 1, random(1, 100)); expect(cast).toMatchObject({ mode: 'TARGET_FORM', paidCost: 6, mindCost: 2, succeeded: true, resistanceChance: 57 });
    expect(r.body).toMatchObject({ enemyForm: 'RABBIT', enemyFormUntilSeconds: 111, weaponLocation: 'COURT', enemyHealth: 80, enemyMind: 100, enemySpirituality: 120 });
    resolveAncientEvilPlayerSlot(x, r, K, 2, random()); expect(r.body.enemyFormUntilSeconds).toBe(111); expect(r.playerS).toBe(110); expect(r.playerM).toBe(95);
    advanceAncientEvilCombatClock(r, 76 - r.root.clockSeconds); expect(r.body.enemyForm).toBe('RABBIT'); expect(r.body.enemyFormUntilSeconds! - r.root.clockSeconds).toBe(35);
    const second = { ...x, round: 2, revision: 5, root: structuredClone(r.root), body: combatBody(r.body), playerSpirituality: r.playerS, playerMind: r.playerM };
    expect(validAncientEvilCombatSource(second)).toBe(true);
    advanceAncientEvilCombatClock(r, 35); expect(r.body.enemyForm).toBe('HUMAN'); expect(r.body.weaponLocation).toBe('COURT'); expect(r.body.enemyInjuries[0]!.id).toBe('unit-original-wound'); expect(x.body).toEqual(before);
  });
  it('retains rabbit mind powers, charges real resistance, and consumes a whole later action for original-staff pickup', () => {
    const x = source(), r = createAncientEvilRuntime(x); resolveAncientEvilPlayerSlot(x, r, K, 0, random(1)); resolveAncientEvilPlayerSlot(x, r, K, 1, random(1, 100));
    const spike = resolveAncientEvilEnemySlot(x, r, 'DREAM_SPIKE', 2, random()); expect(spike).toMatchObject({ id: 'DREAM_SPIKE', paidCost: 6, mentalPressure: true, threatens: false, attackKind: 'MIND', enemyFormAfter: 'RABBIT' });
    const gesture = resolveAncientEvilEnemySlot(x, r, 'DREAM_WARD', 3, random()); expect(gesture).toMatchObject({ id: 'BODY_STRIKE', paidCost: 0, selfGain: 10, attackKind: 'BODY' });
    const fail = resolveAncientEvilEnemySlot(x, r, 'RESIST_FORM', 4, random(100)); expect(fail.succeeded).toBe(false); expect(r.body.enemyForm).toBe('RABBIT'); expect(r.body.enemySpirituality).toBe(108);
    const success = resolveAncientEvilEnemySlot(x, r, 'RESIST_FORM', 5, random(1)); expect(success.succeeded).toBe(true); expect(r.body).toMatchObject({ enemyForm: 'HUMAN', link: 'NONE', weaponLocation: 'COURT', enemySpirituality: 102 });
    const pickup = resolveAncientEvilEnemySlot(x, r, 'DREAM_SPIKE', 6, random()); expect(pickup).toMatchObject({ id: 'PICKUP', paidCost: 0, selfGain: 0, enemyReduction: 0, attackKind: 'NONE' }); expect(r.body.weaponLocation).toBe('HAND'); expect(r.body.powerUses.DREAM_SPIKE).toBe(1);
  });
  it('retains failed contact, failed knowledge and successful independent resistance costs without phantom forms', () => {
    const x = source(), r = createAncientEvilRuntime(x); const failed = resolveAncientEvilPlayerSlot(x, r, K, 0, random(100)); expect(failed.succeeded).toBe(false); expect(r.body.link).toBe('NONE'); expect(r.playerS).toBe(116);
    resolveAncientEvilPlayerSlot(x, r, K, 1, random(1)); const resisted = resolveAncientEvilPlayerSlot(x, r, K, 2, random(1, 1)); expect(resisted).toMatchObject({ succeeded: false, resisted: true, paidCost: 6, mindCost: 2 });
    expect(r.body).toMatchObject({ enemyForm: 'HUMAN', weaponLocation: 'HAND', transfigurationAttempts: 1, transfigurationSuccesses: 0 }); expect(r.playerS).toBe(106);
    const q = createAncientEvilRuntime(x); resolveAncientEvilPlayerSlot(x, q, K, 0, random(1)); expect(resolveAncientEvilPlayerSlot(x, q, K, 1, random(100)).rolls).toEqual([100]); expect(q.playerS).toBe(110); expect(q.body.enemyForm).toBe('HUMAN');
  });
  it('spends only three unique purchased originals; finite physical fallback and opt-in Madman costs preserve old semantics', () => {
    const x = source(), r = createAncientEvilRuntime(x, 'BURST_FIRST');
    expect(resolveAncientEvilPlayerSlot(x, r, B, 0, random()).enemyReduction).toBe(17.55);
    for (let i = 0; i < 3; i++) expect(resolveAncientEvilPlayerSlot(x, r, H, i + 1, random()).selfGain).toBe(55 * .65);
    expect(r.body.blocks.map(b => b.id)).toEqual(ANCIENT_EVIL_BLOCK_IDS); expect(r.body.blocks.every(b => b.status === 'SPENT' && b.location === 'TARGET_GROUND')).toBe(true);
    const fallback = resolveAncientEvilPlayerSlot(x, r, H, 4, random()); expect(fallback.selfGain).toBe(16 * (1 + .25 * .65)); expect(r.madman).toEqual({ policy: 'BURST_FIRST', triggered: true, mentalCost: 10, spiritualCost: 2 }); expect(r.playerS).toBe(107); expect(r.playerM).toBe(88);
    const poor = createAncientEvilRuntime(source(false)); poor.playerS = 1; expect(resolveAncientEvilPlayerSlot(x, poor, H, 0, random()).selfGain).toBe(16); expect(poor.playerS).toBe(1); expect(poor.body.blocks).toHaveLength(0);
  });
  it('only explicit own curse activates the inherited self-harm source; later draws never automatically release it', () => {
    const x = source(), r = createAncientEvilRuntime(x); resolveAncientEvilPlayerSlot(x, r, K, 0, random(1), true);
    expect(resolveAncientEvilPlayerSlot(x, r, K, 1, random(1), true).mode).toBe('SELF_FORM'); expect(r.body.form).toBe('WOOD');
    const later = resolveAncientEvilPlayerSlot(x, r, K, 2, random(), true); expect(later).toMatchObject({ mode: 'OBSERVE', paidCost: 0, mindCost: 0, selfGain: 0 }); expect(r.body.form).toBe('WOOD');
    advanceAncientEvilCombatClock(r, r.body.formUntilSeconds! - r.root.clockSeconds); expect(r.body.form).toBe('HUMAN'); expect(r.body.formUntilSeconds).toBeNull();
    expect(x.playerHealth).toBe(100); expect(r.body.reflectionHistory).toEqual([]); expect(r.playerS).toBe(112); expect(r.playerM).toBe(97);
  });
  it('labels BODY only after actual bodily attacks, uses MENTAL for a pure mind attack, and rejects forged costs, clock, form and RNG', () => {
    const x = source(); let control = scripted([1, 1, 351, 1, 1_000_000]);
    const mental = replayAncientEvilCombatRound(x, 'PREPARE').round; control.spy.mockRestore(); expect(mental.consequenceDomain).toBe('MENTAL'); expect(mental.ancientEvilOutcome!.playerMindAfter).toBe(88); expect(mental.ancientEvilOutcome!.playerHealthAfter).toBe(100); expect(mental.consequenceWeights).toBeNull();
    control = scripted([1, 1, 351, 61, 1_000_000, 10]); const body = replayAncientEvilCombatRound(x, 'PREPARE').round; control.spy.mockRestore(); expect(body.consequenceDomain).toBe('BODY'); expect(body.ancientEvilOutcome!.playerHealthAfter).toBe(90); expect(body.ancientEvilOutcome!.playerInjuriesAfter).toHaveLength(1);
    const real = replayAncientEvilCombatRound(x, 'CONTROL').round; expect(validateAncientEvilCombatRound(real)).toBe(true);
    for (const tamper of [(r: typeof real) => { r.ancientEvilOutcome!.rootAfter.clockSeconds++; }, (r: typeof real) => { r.ancientEvilOutcome!.randomCursorAfter++; },
      (r: typeof real) => { r.ancientEvilOutcome!.playerSpiritualityAfter++; }, (r: typeof real) => { r.ancientEvilOutcome!.weaponLocation = 'COURT'; },
      (r: typeof real) => { r.ancientEvilOutcome!.playerActions[0]!.label += ' changed'; }, (r: typeof real) => { r.consequenceDomain = 'MENTAL'; }]) {
      const changed = structuredClone(real); tamper(changed); expect(validateAncientEvilCombatRound(changed)).toBe(false);
    }
    if (real.ancientEvilOutcome!.continuing) expect(nextAncientEvilCombatSource(real.ancientEvilOutcome!).randomCursor).toBe(real.ancientEvilOutcome!.randomCursorAfter);
  });
  it('moves the same human Elsa with returned originals and guide along the actual original route before player enters', () => {
    const p = createSilentDiscipleLifeState(); p.introducedWeek = 1; for (const c of Object.values(p.cases)) c.status = 'RESOLVED';
    const before = structuredClone(p), after = ancientEvilApproachedRoot(p, 1); expect(p).toEqual(before);
    expect(after).toMatchObject({ playerLocation: 'A', playerTravelMetres: 4, clockSeconds: 16, volunteer: { id: 'SD3-ELSA', location: 'OUTSIDE', form: 'HUMAN' }, guide: { id: 'HARLAN', location: 'OUTSIDE' } });
    expect(after.clothing).toEqual(before.clothing); expect(after.bag).toEqual(before.bag);
    const changed = structuredClone(p); changed.volunteer.form = 'RABBIT'; expect(() => ancientEvilApproachedRoot(changed, 1)).toThrow();
    changed.volunteer.form = 'HUMAN'; changed.bag.location = 'TRAY'; expect(() => ancientEvilApproachedRoot(changed, 1)).toThrow();
    // Integrated UNIT source: every operation after the declared promoted fixture is a public command.
    let state = promoted();
    for (const caseId of ['lasting-form', 'revoked-form', 'original-link'] as const) {
      for (const command of [
        { type: 'OBSERVE', caseId }, { type: 'PREPARE', caseId, method: 'ORDINARY' }, { type: 'WALK', caseId, to: 'A' }, { type: 'READ_IDENTITY', caseId },
        { type: 'WALK', caseId, to: 'B' }, { type: 'READ_NOTE', caseId }, { type: 'WALK', caseId, to: 'A' }, { type: 'COMPARE_IDENTITY', caseId },
        { type: 'MANUAL_OPERATION', caseId }, { type: 'WALK', caseId, to: 'START' }, { type: 'INSPECT', caseId }, { type: 'LEAVE', caseId }, { type: 'REPORT', caseId },
      ] as AncientEvilActivityCommand[]) state = ae(state, command);
    }
    state = ae(state, { type: 'REFLECT' }); const old = structuredClone(state.silentDisciple.encounter), sourceRoot = structuredClone(state.silentDisciple.life), cash = state.cash;
    state = ae(state, { type: 'BUY_BLOCKS' }); expect(state.cash).toBe(cash - 80); assertValidSliceState(state);
    for (const tamper of [(v: SliceState) => { const p = v.ancientEvil.encounter.blockPurchase!; p.randomBefore++; p.randomAfter++; v.random.cursor++; },
      (v: SliceState) => { const p = v.ancientEvil.encounter.blockPurchase!; p.before.spirituality--; p.after.spirituality--; v.spirituality--; },
      (v: SliceState) => { v.ancientEvil.encounter.blockPurchase!.date.day++; },
      (v: SliceState) => { const p = v.ancientEvil.encounter.blockPurchase!; p.before.cash += 80; p.after.cash += 80; p.cashBefore += 80; p.cashAfter += 80; v.cash += 80; }]) {
      const mutated = structuredClone(state); tamper(mutated); expect(() => assertValidSliceState(mutated)).toThrow();
    }
    state = ae(state, { type: 'PREPARE_ENCOUNTER' }); state = ae(state, { type: 'ENCOUNTER_TALK' });
    expect(state.silentDisciple.life.clockSeconds).toBe(sourceRoot.clockSeconds + 16); expect(state.silentDisciple.life.volunteer.location).toBe('OUTSIDE'); expect(state.silentDisciple.life.guide.location).toBe('OUTSIDE');
    state = ae(state, { type: 'ENCOUNTER_FIGHT' }); assertValidSliceState(state);
    const omitted = step(state, { type: 'COMBAT_ROUND', stance: 'CONTROL' }), explicit = step(state, { type: 'COMBAT_ROUND', stance: 'CONTROL', puppetCurse: false, madmanPolicy: 'HOLD' });
    expect(omitted).toEqual(explicit); expect(explicit.lastCombatRound!.ancientEvilOutcome).toMatchObject({ cursePolicy: false, madmanBurst: { policy: 'HOLD' } });
    const opted = step(state, { type: 'COMBAT_ROUND', stance: 'CONTROL', puppetCurse: true, madmanPolicy: 'BURST_FIRST' }); assertValidSliceState(opted);
    expect(opted.lastCombatRound!.ancientEvilOutcome).toMatchObject({ cursePolicy: true, madmanBurst: { policy: 'BURST_FIRST' } });
    const retreat = step(state, { type: 'COMBAT_ROUND', stance: 'RETREAT', puppetCurse: false, madmanPolicy: 'HOLD' }); assertValidSliceState(retreat);
    expect(retreat.ancientEvil.encounter.terminal).toMatchObject({ outcome: 'RETREATED', round: 1, exitMetres: 4, exitSeconds: 4 }); expect(retreat.lastCombatRound!.retreat).toBe('SUCCESS');
    let rounds = 0;
    while (state.combat && rounds++ < 100) { state = step(state, { type: 'COMBAT_ROUND', stance: 'CONTROL', puppetCurse: false, madmanPolicy: 'HOLD' }); assertValidSliceState(state); }
    expect(state.ancientEvil.encounter.terminal).toMatchObject({ outcome: 'PLAYER_DEAD', round: 9, exitMetres: 0 }); expect(state.silentDisciple.life.playerLocation).toBe('A');
    expect(state.combat).toBeNull(); expect(state.ancientEvil.encounter.terminal).not.toBeNull(); expect(state.silentDisciple.encounter).toEqual(old);
    expect(state.ancientEvil.encounter.enemyForm).toBe('HUMAN'); expect(state.silentDisciple.life.clothing).toEqual(sourceRoot.clothing); expect(state.silentDisciple.life.bag).toEqual(sourceRoot.bag);

  });
});
