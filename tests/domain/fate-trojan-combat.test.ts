import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { baseAdvantage, statusPenalty } from '../../src/domain/slice/combat.js';
import { resolveFateTrojanCombatRound } from '../../src/domain/slice/fate-trojan-combat.js';
import type { SliceState, SliceCombatRound, SliceStance } from '../../src/domain/slice/types.js';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { FATE_TROJAN_COUNT_WHEEL, FATE_TROJAN_ENEMY_COUNT_WHEEL, FATE_TROJAN_ENEMY_ABILITY_WHEEL,
  fateTrojanActionCount, fateTrojanEnemyActionCount, fateTrojanAbilityWheel, currentFateTrojanCombatSource,
  beginFateTrojanCombatRound, resolveFateTrojanCombatAbility, resolveFateTrojanEnemyAbility, finishFateTrojanCombatRound,
  fateTrojanRoundOutcome, projectFateTrojanCombat, validateFateTrojanCombatRound, validateFateTrojanRoundOutcome,
  type FateTrojanMoveId, type FateTrojanCombatSource, type FateTrojanRoundOutcome } from '../../src/domain/fate-trojan/combat.js';
import { fateTrojanApproachedSite, validateFateTrojanEncounter } from '../../src/domain/fate-trojan/encounter.js';
import { validateFateTrojanLife } from '../../src/domain/fate-trojan/life.js';
import { encounterReady, ft, oldErrorRoots, rejectFT } from './fate-trojan-directed-helper.js';
import { actualCombatStart as combatStart } from './fate-trojan-fixture-helper.js';
import { stableStringify } from '../../src/domain/canonical.js';
const LINK = 'error.s2.identity-link', FATE = 'error.s2.fate-assumption', DECEIT = 'error.s3.deep-deception';
const ordered = (o: FateTrojanRoundOutcome) => [...o.playerActions, ...o.enemyActions].sort((a, b) => a.order - b.order);
const outcome = (r: SliceCombatRound) => { if (!r.fateTrojanOutcome) throw new Error('Missing Fate Trojan outcome'); return r.fateTrojanOutcome; };
function scripted(s: SliceState, values: number[] = []): ActionRandomStream {
  let index = 0, cursor = s.random.cursor;
  return { seed: s.random.seed, get cursor() { return cursor; }, nextInt(min, max) {
    const value = values[index++]; if (value === undefined || !Number.isInteger(value) || value < min || value > max) throw new Error(`Unexpected DIRECTED slot draw ${index}: ${value}`);
    cursor++; return value;
  } };
}
/** Explicit SCRIPTED SLOT UNIT ONLY. Real public entry is retained; selected current player
 * budgets/checks isolate a branch. These are not persisted or represented as natural whole rounds,
 * and complete-RNG validation must reject the scripted outputs. */
function scenario(checks: number[] = [], change?: (s: SliceState) => void) {
  const state = combatStart(); change?.(state); const random = scripted(state, checks), round = beginFateTrojanCombatRound(state, 'ATTACK', random);
  return { state, random, round,
    player: (id: FateTrojanMoveId) => resolveFateTrojanCombatAbility(state, id, 1 - statusPenalty(state.health, 100), random, round),
    enemy: (id: Parameters<typeof resolveFateTrojanEnemyAbility>[1]) => resolveFateTrojanEnemyAbility(state, id, 1 - statusPenalty(round.source.enemyHealth, 100), random, round) };
}
let publicRoundCache: SliceState | undefined;
function publicRound(): SliceState {
  publicRoundCache ??= applySliceIntent(combatStart(), { type: 'COMBAT_ROUND', stance: 'ATTACK' }); return structuredClone(publicRoundCache);
}

describe('Fate Trojan finite six-slot battle rules, explicitly directed local units', () => {
  it('uses exact S2 membership, six count slots and the frozen player/enemy weights', () => {
    const s = combatStart(); expect(FATE_TROJAN_COUNT_WHEEL.map(x => x.weight)).toEqual([10, 15, 25, 25, 15, 10]); expect(FATE_TROJAN_ENEMY_COUNT_WHEEL).toEqual(FATE_TROJAN_COUNT_WHEEL);
    expect([1, 10, 11, 25, 26, 50, 51, 75, 76, 90, 91, 100].map(fateTrojanActionCount)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
    expect([1, 100].map(fateTrojanEnemyActionCount)).toEqual([1, 6]);
    expect(fateTrojanAbilityWheel(s, null).map(x => [x.id, x.weight])).toEqual([[LINK, 25], [FATE, 20], [DECEIT, 20], ['STRIKE', 15], ['EVADE', 15], ['ACCIDENT', 5]]);
    expect(FATE_TROJAN_ENEMY_ABILITY_WHEEL.map(x => [x.id, x.weight])).toEqual([['FORCE_STRIKE', 35], ['GUARD', 25], ['BODY_STRIKE', 20], ['DISCERN', 15], ['ACCIDENT', 5]]);
    for (const sequence of [1, 3, 4, 9]) { const bad = structuredClone(s); bad.progression.sequence = sequence; expect(currentFateTrojanCombatSource(bad)).toBeNull(); }
  });
  it('charges fate 7 spirituality and 5 actual health before success, and prepares no immediate advantage', () => {
    const u = scenario([1]), h = u.state.health, spirit = u.state.spirituality; const effect = u.player(FATE);
    expect(u.state.health).toBe(h - 5); expect(u.state.spirituality).toBe(spirit - 7); expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
    expect(u.round.playerActions[0]).toMatchObject({ attempted: true, succeeded: true, paidCost: 7, healthPaid: 5, chargeGranted: true, applied: false, appliedAmount: 0, playerHealthAfter: h - 5 });
    expect(u.random.cursor).toBe(u.round.source.randomCursor + 1);
  });
  it('retains both actual fate costs on failure and allows no second paid attempt that round', () => {
    const u = scenario([100]), h = u.state.health, spirit = u.state.spirituality;
    u.player(FATE); u.player(FATE);
    expect(u.state.health).toBe(h - 5); expect(u.state.spirituality).toBe(spirit - 7); expect(u.random.cursor).toBe(u.round.source.randomCursor + 1);
    expect(u.round.playerActions[0]).toMatchObject({ attempted: true, succeeded: false, healthPaid: 5, paidCost: 7, chargeGranted: false });
    expect(u.round.playerActions[1]).toMatchObject({ attempted: false, paidCost: 0, healthPaid: 0, fallback: 'EVADE', enemyReduction: 10, rolls: [] });
  });
  it('requires health above five; six becomes one with no magical survival refund', () => {
    const denied = scenario([], s => { s.health = 5; }); denied.player(FATE);
    expect(denied.state.health).toBe(5); expect(denied.round.playerActions[0]).toMatchObject({ attempted: false, paidCost: 0, healthPaid: 0, fallback: 'EVADE' });
    const allowed = scenario([100], s => { s.health = 6; }); allowed.player(FATE);
    expect(allowed.state.health).toBe(1); expect(allowed.round.playerActions[0]).toMatchObject({ attempted: true, succeeded: false, healthPaid: 5, paidCost: 7 });
  });
  it('spends the fate window only on the next actual own STRIKE, for exactly 85 once', () => {
    const u = scenario([1, 1]); u.player(FATE); u.player('EVADE'); u.player(DECEIT);
    expect(u.round.playerActions[0]!.appliedAmount).toBe(0);
    u.player('STRIKE'); const first = u.round.playerActions[3]!, base = (u.round.source.clubHeld ? 16 : 12) * (1 - statusPenalty(u.state.health, 100));
    expect(first).toMatchObject({ selfGain: base + 85, consumedFateOrder: 0, threatens: true });
    expect(u.round.playerActions[0]).toMatchObject({ applied: true, appliedAmount: 85, chargeConsumedByOrder: first.order });
    u.player('STRIKE'); expect(u.round.playerActions[4]).toMatchObject({ selfGain: base, consumedFateOrder: null });
  });
  it('recomputes physical strike strength from actual health after the five-point payment', () => {
    const u = scenario([1], s => { s.health = 76; }); u.player(FATE); u.player('STRIKE');
    expect(u.state.health).toBe(71); expect(u.round.playerActions[0]!.physicalFactor).toBe(1); expect(u.round.playerActions[1]!.physicalFactor).toBe(.95);
    expect(u.round.playerActions[1]!.selfGain).toBe((u.round.source.clubHeld ? 16 : 12) * .95 + 85);
  });
  it('pays 8 for identity once and only reduces the next actual BODY attack by 30', () => {
    const u = scenario([1]); u.player(LINK); const paid = u.state.spirituality; u.player(LINK); u.enemy('GUARD'); u.enemy('ACCIDENT');
    expect(u.state.spirituality).toBe(paid); expect(u.round.playerActions[0]).toMatchObject({ paidCost: 8, chargeGranted: true, appliedAmount: 0, enemyReduction: 0 });
    u.enemy('FORCE_STRIKE'); expect(u.round.enemyActions[2]).toMatchObject({ actual: 'FORCE_STRIKE', attackKind: 'BODY', paidCost: 5, selfGain: 75, consumedIdentityOrder: 0 });
    expect(u.round.playerActions[0]).toMatchObject({ applied: true, appliedAmount: 30, enemyReduction: 30, chargeConsumedByOrder: u.round.enemyActions[2]!.order });
    u.enemy('BODY_STRIKE'); expect(u.round.enemyActions[3]!.consumedIdentityOrder).toBeNull();
  });
  it('failed identity is still a paid once-per-round attempt and produces no reduction', () => {
    const u = scenario([100]); u.player(LINK); u.player(LINK); u.enemy('BODY_STRIKE');
    expect(u.round.playerActions.map(a => a.paidCost)).toEqual([8, 0]); expect(u.round.playerActions[0]).toMatchObject({ attempted: true, succeeded: false, chargeGranted: false, appliedAmount: 0 });
    expect(u.round.enemyActions[0]!.consumedIdentityOrder).toBeNull(); expect(u.random.cursor).toBe(u.round.source.randomCursor + 1);
  });
  it('DISCERN pays three only for a currently pending identity and cancels that exact window', () => {
    const u = scenario([1]); u.enemy('DISCERN'); expect(u.round.enemyActions[0]).toMatchObject({ actual: 'OBSERVE', paidCost: 0 });
    u.player(LINK); const link = u.round.playerActions[0]!; u.enemy('DISCERN'); u.enemy('BODY_STRIKE'); u.enemy('DISCERN');
    expect(u.round.enemyActions[1]).toMatchObject({ actual: 'DISCERN', paidCost: 3, attackKind: 'NONE', consumedIdentityOrder: link.order });
    expect(link).toMatchObject({ applied: false, appliedAmount: 0, enemyReduction: 0, chargeCancelledByOrder: u.round.enemyActions[1]!.order });
    expect(u.round.enemyActions[2]!.consumedIdentityOrder).toBeNull(); expect(u.round.enemyActions[3]).toMatchObject({ actual: 'OBSERVE', paidCost: 0 });
    expect(u.state.fateTrojan.encounter.powerUses.DISCERN).toBe(1);
  });
  it('enemy GUARD costs four once, waits through non-strikes and reduces only one subsequent strike by forty', () => {
    const u = scenario([1]); u.enemy('GUARD'); u.enemy('GUARD'); u.player(DECEIT); u.player('EVADE');
    const guard = u.round.enemyActions[0]!; expect(guard).toMatchObject({ paidCost: 4, chargeGranted: true, appliedAmount: 0, enemyReduction: 0 });
    expect(u.round.enemyActions[1]).toMatchObject({ actual: 'OBSERVE', paidCost: 0, chargeGranted: false });
    u.player('STRIKE'); expect(guard).toMatchObject({ appliedAmount: 40, enemyReduction: 40, chargeConsumedByOrder: u.round.playerActions[2]!.order });
    expect(u.round.playerActions[2]!.consumedGuardOrder).toBe(guard.order); u.player('STRIKE'); expect(u.round.playerActions[3]!.consumedGuardOrder).toBeNull();
    expect(u.state.fateTrojan.encounter.powerUses.GUARD).toBe(1);
  });
  it('all unpaid player abilities fall back to ordinary evasion without checks, health payment or fake use', () => {
    const u = scenario([], s => { s.spirituality = 0; });
    for (const id of [LINK, FATE, DECEIT] as const) u.player(id);
    for (const a of u.round.playerActions) expect(a).toMatchObject({ attempted: false, paidCost: 0, healthPaid: 0, fallback: 'EVADE', enemyReduction: 10, threatens: false, rolls: [] });
    expect(u.state.health).toBe(u.round.source.playerHealth); expect(u.random.cursor).toBe(u.round.source.randomCursor);
  });
  it('depleted enemy runtime falls back to the real club without spending spiritual powers', () => {
    const u = scenario();
    // Explicit in-flight SLOT mock only. The entry source and whole-round history are not forged.
    // Simulate a depleted actor pool at the resolver boundary; never finish, persist or validate
    // this local mock as a complete replay. Production source validation remains unchanged.
    u.state.fateTrojan.encounter.enemySpirituality = 0;
    u.state.fateTrojan.encounter.powerUses = { FORCE_STRIKE: 24, GUARD: 0, DISCERN: 0 };
    u.round.runtime.enemyS = 0; u.round.runtime.powers = { ...u.state.fateTrojan.encounter.powerUses };
    u.round.liveState = stableStringify({ spirituality: u.state.spirituality, enemySpirituality: 0,
      powerUses: u.state.fateTrojan.encounter.powerUses, site: u.state.fateTrojan.life.site });
    u.enemy('FORCE_STRIKE'); u.enemy('GUARD');
    for (const a of u.round.enemyActions) expect(a).toMatchObject({ actual: 'BODY_STRIKE', attackKind: 'BODY', paidCost: 0, selfGain: 20, threatens: true, chargeGranted: false });
    expect(u.state.fateTrojan.encounter.enemySpirituality).toBe(0);
    expect(u.state.fateTrojan.encounter.powerUses).toEqual({ FORCE_STRIKE: 24, GUARD: 0, DISCERN: 0 });
    expect(u.random.cursor).toBe(u.round.source.randomCursor);
  });
  it('ends unused windows at sixty seconds without returning health, spirit, enemy guard cost or mastery', () => {
    const u = scenario([1, 1]), mastery = structuredClone(u.state.progression.mastery); u.player(LINK); u.player(FATE); u.enemy('GUARD');
    const h = u.state.health, spirit = u.state.spirituality, enemySpirit = u.state.fateTrojan.encounter.enemySpirituality;
    const o = finishFateTrojanCombatRound(u.state, u.round, true, u.random.cursor);
    expect(o).toMatchObject({ pendingIdentityAfter: false, pendingFateAfter: false, pendingGuardAfter: false, expiredIdentityOrder: 0, expiredFateOrder: 1, expiredGuardOrder: 2, healthPaid: 5, elapsedSeconds: 60 });
    expect([u.state.health, u.state.spirituality, u.state.fateTrojan.encounter.enemySpirituality]).toEqual([h, spirit, enemySpirit]); expect(u.state.progression.mastery).toEqual(mastery);
    expect(o.clockSecondsAfter).toBe(o.source.clockSeconds + 60); expect(validateFateTrojanRoundOutcome(o)).toBe(false);
    o.playerActions[0]!.paidCost++; expect(fateTrojanRoundOutcome(u.round).playerActions[0]!.paidCost).toBe(8); expect(() => finishFateTrojanCombatRound(u.state, u.round)).toThrow();
  });
  it('refuses a substituted target/source, wrong physical factor or stale site before drawing or paying', () => {
    const u = scenario(), frozen = structuredClone(u.state), cursor = u.random.cursor;
    for (const source of [null, { ...u.round.source, targetId: 'DM3-GIDEON' }, { ...u.round.source, enemyWeapon: 'COPY' }, { ...u.round.source, round: 99 }])
      expect(resolveFateTrojanCombatAbility(u.state, LINK, 1 - statusPenalty(u.state.health, 100), u.random, u.round, source as FateTrojanCombatSource | null).selfGain).toBe(0);
    expect(resolveFateTrojanEnemyAbility(u.state, 'FORCE_STRIKE', .5, u.random, u.round).selfGain).toBe(0);
    expect(u.state).toEqual(frozen); expect(u.random.cursor).toBe(cursor); expect(u.round.playerActions).toHaveLength(0);
    u.state.fateTrojan.life.site.playerEnergy--; const changed = structuredClone(u.state); u.player(LINK); expect(u.state).toEqual(changed); expect(u.random.cursor).toBe(cursor); expect(() => finishFateTrojanCombatRound(u.state, u.round)).toThrow();
  });
  it('permits at most six actions per actor and records five seconds per actual slot', () => {
    const u = scenario(); for (let n = 0; n < 6; n++) { u.player('EVADE'); u.enemy('ACCIDENT'); }
    const frozen = structuredClone(u.state); u.player(FATE); u.enemy('FORCE_STRIKE'); expect(u.state).toEqual(frozen);
    expect(u.round.playerActions).toHaveLength(6); expect(u.round.enemyActions).toHaveLength(6);
    for (const [index, a] of [...u.round.playerActions, ...u.round.enemyActions].sort((a, b) => a.order - b.order).entries()) expect(a).toMatchObject({ order: index, atSeconds: u.round.source.clockSeconds + index * 5, elapsedSeconds: 5 });
  });
});

describe('Fate Trojan exact deterministic public rounds and physical scene continuity', () => {
  it('moves both original adults and the player on real ordinary paths before optional fighting', () => {
    const s = encounterReady(), e = s.fateTrojan.encounter, start = e.startSite!, p = s.fateTrojan.life.site;
    expect(p).toEqual(fateTrojanApproachedSite(start, s.week)); expect(e.clearance).toMatchObject({ linaConsent: 'GRANTED', victorConsent: 'GRANTED', elapsedSeconds: 12 });
    for (const id of ['lina', 'victor'] as const) expect(p[id]).toMatchObject({ location: 'OUTSIDE', travelMetres: start[id].travelMetres + 4, energy: start[id].energy - 4 });
    expect(p).toMatchObject({ playerLocation: 'YARD', playerTravelMetres: start.playerTravelMetres + 4, playerEnergy: start.playerEnergy - 4, clockSeconds: start.clockSeconds + 12 });
    for (const key of ['cabinet', 'parcel', 'link', 'fate', 'seals'] as const) expect(p[key]).toEqual(start[key]);
    const left = ft(s, { type: 'LEAVE_ENCOUNTER' }); expect(left.fateTrojan.life.site).toMatchObject({ playerLocation: 'OUTSIDE', playerTravelMetres: p.playerTravelMetres + 2, playerEnergy: p.playerEnergy - 2, clockSeconds: p.clockSeconds + 2 });
    expect(left.fateTrojan.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 100, enemySpirituality: 120, weaponLocation: 'HAND' });
    rejectFT(left, { type: 'ENCOUNTER_TALK' }); assertValidSliceState(left);
  });
  it('public replay is identical, preserves its input and every old body, and has explicit BODY evidence', () => {
    const s = combatStart(), before = structuredClone(s), intent = { type: 'COMBAT_ROUND', stance: 'ATTACK' } as const;
    const after = applySliceIntent(s, intent); expect(after).toEqual(applySliceIntent(s, intent)); expect(s).toEqual(before);
    expect(oldErrorRoots(after)).toEqual(oldErrorRoots(s)); expect(after.progression.mastery).toEqual(s.progression.mastery); expect(after.fateTrojan.life.journal).toEqual(s.fateTrojan.life.journal);
    const r = after.combatHistory.at(-1)!; expect(r.consequenceDomain).toBe('BODY'); expect(validateFateTrojanCombatRound(r)).toBe(true); expect(validateFateTrojanRoundOutcome(r.fateTrojanOutcome)).toBe(true);
    expect(validateFateTrojanLife(after)).toBe(true); expect(validateFateTrojanEncounter(after)).toBe(true); assertValidSliceState(after);
  });
  it('reconstructs weighted advantage, exact costs, current physical injury and continuation-only 12-spirit recovery', () => {
    const after = publicRound(), r = after.combatHistory.at(-1)!, o = outcome(r), x = o.source;
    const sum = (items: { selfGain: number; enemyReduction: number }[], key: 'selfGain' | 'enemyReduction') => items.reduce((n, a) => n + a[key], 0);
    const core = x.physique * .35 + x.perception * .25 + x.will * .25 + x.knowledge * .15;
    expect(r.playerAdvantage).toBe(Math.max(125, baseAdvantage(core, x.playerHealth, x.playerMind, x.playerSpirituality, 1250, 120) + sum(o.playerActions, 'selfGain') - sum(o.enemyActions, 'enemyReduction')));
    expect(r.enemyAdvantage).toBe(Math.max(125, baseAdvantage(20, x.enemyHealth, x.enemyMind, x.enemySpirituality, 1250, 120) + sum(o.enemyActions, 'selfGain') - sum(o.playerActions, 'enemyReduction')));
    expect(o.playerSpiritualityAfter).toBe(x.playerSpirituality - o.playerActions.reduce((n, a) => n + a.paidCost, 0));
    expect(o.enemySpirituality).toBe(x.enemySpirituality - o.enemyActions.reduce((n, a) => n + a.paidCost, 0));
    expect(o.healthPaid).toBe(o.playerActions.reduce((n, a) => n + a.healthPaid, 0)); expect(after.spirituality).toBe(o.continuing ? Math.min(120, o.playerSpiritualityAfter + 12) : o.playerSpiritualityAfter);
    expect(after.health).toBe(o.playerHealthAfter); expect(after.mind).toBe(x.playerMind); expect(after.fateTrojan.encounter.enemyMind).toBe(100);
    for (const [i, a] of ordered(o).entries()) expect(a).toMatchObject({ order: i, elapsedSeconds: 5, atSeconds: x.clockSeconds + i * 5 });
    expect(o.clockSecondsAfter).toBe(x.clockSeconds + 60); expect(after.fateTrojan.life.site.clockSeconds).toBe(o.clockSecondsAfter + (o.continuing || after.health === 0 ? 0 : 2));
    if (r.consequenceWeights) expect(r.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
  });
  it('projects detached genuine wheels, ordered actions, live site and real contemporary enemy resources', () => {
    const s = publicRound(), frozen = structuredClone(s), view = projectFateTrojanCombat(s), p = projectSliceState(combatStart());
    expect(p.combat!.enemyCountWheel).toEqual(FATE_TROJAN_ENEMY_COUNT_WHEEL); expect(p.combat!.enemyAbilityWheel).toEqual(FATE_TROJAN_ENEMY_ABILITY_WHEEL);
    expect(p.combat!.fateTrojan!.site).toEqual(combatStart().fateTrojan.life.site);
    expect(combatStart().fateTrojan.encounter.startSource).toMatchObject({ targetId: 'FT2-ELIAS', targetAge: 46, targetSequence: 3, actualBody: true, independentMind: true, enemyWeapon: 'FT2-ELIAS-CLUB', thirdPartiesInArea: 0, automaticAllyImmunity: false });
    view.site!.playerEnergy--; view.powerUses!.GUARD++; if (view.lastActionSequence.length) view.lastActionSequence[0]!.paidCost++; expect(s).toEqual(frozen);
  });
});

/** Bounded SOURCE-ONLY adapter forks: the current cursor is selected only for isolated combat
 * branch tests. No forged campaign history is constructed, persisted or passed to whole-state
 * validation. The adapter itself uses its genuine deterministic RNG and the complete outcome
 * must independently replay. Natural 451-prefix continuation belongs in its own capture tests. */
function directedAdapterRound(wanted: (r: SliceCombatRound, s: SliceState) => boolean, stance: SliceStance = 'ATTACK') {
  const base = combatStart();
  for (let offset = 0; offset < 2_000; offset++) {
    const state = structuredClone(base); state.random.cursor += offset;
    const result = resolveFateTrojanCombatRound(state, stance);
    if (wanted(result.round, state)) { expect(validateFateTrojanCombatRound(result.round)).toBe(true); return { state, ...result }; }
  }
  throw new Error('No bounded directed source branch; do not synthesize an outcome.');
}
describe('Fate Trojan real BODY consequences from independently replayed directed sources', () => {
  it('actual paid fate health is additional to a real bodily wound, with no mental injury substitute', () => {
    const { state, round } = directedAdapterRound(r => r.winner === 'ENEMY' && outcome(r).healthPaid === 5 && r.consequenceRoll !== undefined && outcome(r).playerHealthAfter > 0);
    const o = outcome(round), severity = round.consequenceRoll! <= round.consequenceWeights!.light ? 'LIGHT' : 'HEAVY';
    expect(state.health).toBe(o.source.playerHealth - 5 - (severity === 'LIGHT' ? 10 : 30)); expect(state.mind).toBe(o.source.playerMind); expect(state.injuries.at(-1)!.severity).toBe(severity);
  });
  it('a real fatal BODY roll leaves actual player health zero; preparation is not a death shield', () => {
    const { state, round, outcome: result } = directedAdapterRound(r => r.winner === 'ENEMY' && outcome(r).playerHealthAfter === 0);
    expect(result).toBe('PLAYER_DEAD'); expect(state.health).toBe(0); expect(outcome(round).continuing).toBe(false); expect(round.consequenceDomain).toBe('BODY'); expect(round.consequenceRoll).toBeGreaterThan(95);
    expect(state.fateTrojan.life.site.playerLocation).toBe('YARD'); expect(state.spirituality).toBe(outcome(round).playerSpiritualityAfter);
  });
  it('a real enemy death puts the original club at the body and never replenishes the enemy', () => {
    const { state, round, outcome: result } = directedAdapterRound(r => outcome(r).enemyStatus === 'DEAD');
    expect(result).toBe('ENEMY_DEAD'); expect(state.fateTrojan.encounter).toMatchObject({ enemyHealth: 0, enemyStatus: 'DEAD', weaponLocation: 'YARD' });
    expect(outcome(round).enemySpirituality).toBe(120 - outcome(round).enemyActions.reduce((n, a) => n + a.paidCost, 0));
  });
});

const mutations: [string, (o: FateTrojanRoundOutcome) => void][] = [
  ['legacy target', o => { Object.assign(o.source, { targetId: 'DM3-GIDEON' }); }],
  ['copied weapon', o => { Object.assign(o.source, { enemyWeapon: 'COPY' }); }],
  ['wrong actor age', o => { Object.assign(o.source, { targetAge: 47 }); }],
  ['wrong source sequence', o => { Object.assign(o.source, { targetSequence: 2 }); }],
  ['fake physical body', o => { Object.assign(o.source, { actualBody: false }); }],
  ['invented ally immunity', o => { Object.assign(o.source, { automaticAllyImmunity: true }); }],
  ['wrong source distance', o => { Object.assign(o.source, { enemyDistanceMetres: 4 }); }],
  ['source cursor', o => { o.source.randomCursor++; }], ['final cursor', o => { o.randomCursorAfter++; }],
  ['source health', o => { o.source.playerHealth--; }], ['health refund', o => { o.playerHealthAfter++; }],
  ['spirit refund', o => { o.playerSpiritualityAfter++; }], ['enemy refill', o => { o.enemySpirituality++; }],
  ['extra actual health payment', o => { o.healthPaid++; }], ['paid slot cost', o => { ordered(o)[0]!.paidCost++; }],
  ['slot health payment', o => { ordered(o)[0]!.healthPaid++; }], ['slot cursor', o => { ordered(o)[0]!.randomCursorAfter++; }],
  ['slot order', o => { ordered(o)[0]!.order++; }], ['slot seconds', o => { ordered(o)[0]!.atSeconds++; }],
  ['slot factor', o => { ordered(o)[0]!.physicalFactor = .5; }], ['extra roll', o => { ordered(o)[0]!.rolls.push(1); }],
  ['slot advantage', o => { ordered(o)[0]!.selfGain++; }], ['slot narrative', o => { ordered(o)[0]!.label += ' Free shield'; }],
  ['forged charge', o => { ordered(o)[0]!.chargeGranted = !ordered(o)[0]!.chargeGranted; }],
  ['forged use', o => { ordered(o)[0]!.appliedAmount++; }], ['retroactive consumption', o => { ordered(o)[0]!.chargeConsumedByOrder = -1; }],
  ['invented fate link', o => { ordered(o)[0]!.consumedFateOrder = 999; }], ['invented guard link', o => { ordered(o)[0]!.consumedGuardOrder = 999; }],
  ['invented identity link', o => { ordered(o)[0]!.consumedIdentityOrder = 999; }], ['cancelled wrong window', o => { ordered(o)[0]!.chargeCancelledByOrder = 999; }],
  ['pending survives round', o => { Object.assign(o, { pendingFateAfter: true }); }], ['attempt reset', o => { o.identityAttempted = !o.identityAttempted; }],
  ['enemy power count', o => { o.powerUses.GUARD++; }], ['clock forgery', o => { o.clockSecondsAfter++; }],
  ['continued terminal', o => { o.continuing = !o.continuing; }], ['extra output', o => { Object.assign(o, { permanentGuard: 40 }); }],
];
describe('Fate Trojan strict complete-RNG and legacy-discriminator rejection', () => {
  it.each(mutations)('rejects %s', (_name, mutate) => {
    const r = structuredClone(publicRound().combatHistory.at(-1)!); expect(validateFateTrojanCombatRound(r)).toBe(true);
    mutate(outcome(r)); expect(validateFateTrojanRoundOutcome(r.fateTrojanOutcome)).toBe(false); expect(validateFateTrojanCombatRound(r)).toBe(false);
  });
  it('rejects public metadata tampering even when nested outcome is independently genuine', () => {
    const changes: ((r: SliceCombatRound) => void)[] = [r => { r.playerCount++; }, r => { r.enemyCount++; }, r => { r.playerCountRoll++; }, r => { r.enemyCountRoll++; },
      r => { r.playerAdvantage++; }, r => { r.enemyAdvantage++; }, r => { r.winChance++; }, r => { r.moves[0]!.selfGain++; }, r => { r.moves[0]!.label += ' Copy'; },
      r => { r.winner = r.winner === 'PLAYER' ? 'ENEMY' : 'PLAYER'; }, r => { r.consequence += ' Undocumented'; }, r => { Object.assign(r, { consequenceDomain: 'MIND' }); },
      r => { Object.assign(r, { freeTurn: true }); }];
    for (const change of changes) { const r = structuredClone(publicRound().combatHistory.at(-1)!); change(r); expect(validateFateTrojanRoundOutcome(r.fateTrojanOutcome)).toBe(true); expect(validateFateTrojanCombatRound(r)).toBe(false); }
  });
  it('rejects deleting the new discriminator to launder a Fate Trojan result as a legacy BODY round', () => {
    const s = publicRound(), last = s.combatHistory.at(-1)!; delete last.fateTrojanOutcome;
    if (s.lastCombatRound) delete s.lastCombatRound.fateTrojanOutcome;
    if (s.combat?.lastRound) delete s.combat.lastRound.fateTrojanOutcome;
    expect(validateFateTrojanCombatRound(last)).toBe(false); expect(validateFateTrojanEncounter(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
    const forged = publicRound(); Object.assign(forged.combatHistory.at(-1)!, { deceitMentorOutcome: {} }); expect(() => assertValidSliceState(forged)).toThrow();
  });
  it('rejects changed live/start site lineage and resources without silently reconstructing a fresh scene', () => {
    const changes: ((s: SliceState) => void)[] = [s => { s.fateTrojan.encounter.startSite!.playerEnergy++; }, s => { s.fateTrojan.encounter.startSource!.randomCursor++; },
      s => { s.fateTrojan.life.site.victor.energy++; }, s => { s.fateTrojan.life.site.playerTravelMetres++; }, s => { s.fateTrojan.life.site.parcel.location = 'CABINET'; },
      s => { s.fateTrojan.encounter.enemySpirituality++; }, s => { s.fateTrojan.encounter.enemyHealth--; }, s => { s.fateTrojan.encounter.clearance!.linaConsent = 'WITHDRAWN' as never; }];
    for (const change of changes) { const s = publicRound(); change(s); expect(validateFateTrojanLife(s) && validateFateTrojanEncounter(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow(); }
  });
});
