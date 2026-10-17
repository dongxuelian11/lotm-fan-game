import { stableStringify } from '../../src/domain/canonical.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { createParasiteState } from '../../src/domain/parasite/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import {
  PARASITE_COUNT_WHEEL, PARASITE_ENEMY_COUNT_WHEEL, parasiteActionCount, parasiteEnemyActionCount,
  parasiteAbilityWheel, drawParasiteAbility, drawParasiteEnemyAbility, currentParasiteCombatSource,
  createParasiteRoundContext, decideParasiteEnemyIntent, resolveParasiteCombatAbility, resolveParasiteEnemyIntent,
  finishParasiteCombatRound, projectParasiteCombat, validateParasiteRoundOutcome,
  type ParasiteMoveId, type ParasiteRoundContext,
} from '../../src/domain/parasite/combat.js';
import {
  applyParasiteEncounterCommand, hasParasiteDisputeOpponent, createParasiteEncounterState,
  isParasitePowerDisabled, expireParasitePowers, settleParasiteEncounter, validateParasiteEncounter,
  hasParasiteEncounterLock, projectParasiteEncounter, type ParasiteEnemyIntent,
} from '../../src/domain/parasite/encounter.js';
import { TRAVELER_COUNT_WHEEL } from '../../src/domain/traveler/combat.js';

const K = 'error.s4.deferred-thought', R = 'error.s6.power-theft';
const profile: readonly [ParasiteMoveId, number, SliceStance | null][] = [
  ['STRIKE', 30, 'ATTACK'], ['RELEASE_POWER', 15, 'ATTACK'], ['BLOCK', 20, 'DEFEND'],
  [K, 20, 'CONTROL'], [R, 10, 'PREPARE'], ['ACCIDENT', 5, null],
];
function ticket(id: ParasiteMoveId, stance: SliceStance | null): number {
  let start = 1;
  for (const [candidate, weight, preferred] of profile) {
    if (candidate === id) return start;
    start += weight * (stance !== null && stance === preferred ? 5 : 4);
  }
  throw new Error('Missing test action');
}
function random(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-parasite-test', get cursor() { return cursor; }, nextInt(min, max) {
    const value = values[cursor++]; if (value === undefined || value < min || value > max) throw new Error(`Unexpected draw ${cursor}: ${value}, ${min}..${max}`);
    return value;
  } };
}
function context(roll = 1): SeerContext {
  return { roll: min => min, note: vi.fn(), check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 15, difficulty, modifiers: [], roll }) };
}
/** Directed branch fixture, not a claimed natural promotion or campaign replay. */
function fixture(firstCase = false): SliceState {
  const s = createSliceRun('parasite-combat-directed', sliceDefaultCreationSelection, 'parasite-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 84; s.actionsRemaining = 4;
  s.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  s.progression = { pathwayId: 'error', sequence: 4, mastery: { 'error.s4.parasitism': 0, [K]: 0, [R]: 0 }, acting: 0, promotionWeek: 84 };
  s.parasite = createParasiteState(); s.parasite.promotionWeek = 84; s.parasite.dreamStealerActingAtPromotion = 100;
  s.health = 100; s.mind = 100; s.spirituality = 120; s.town.clubLocation = 'SHOP';
  if (firstCase) {
    s.arc.stage = 'COMBAT'; s.world.carrierAlive = true; s.world.carrierCanResist = true;
    s.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  } else {
    s.arc.stage = 'ENDED'; applyParasiteEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context());
  }
  return s;
}
function pending(s: SliceState, id: ParasiteEnemyIntent = 'WIND_BLADE'): ParasiteRoundContext {
  const r = createParasiteRoundContext(s); decideParasiteEnemyIntent(s, r, id); return r;
}
function effect(s: SliceState, id: ParasiteMoveId, rng = random(), r = createParasiteRoundContext(s), physical = 1) {
  return resolveParasiteCombatAbility(s, id, physical, rng, r);
}
function recordedRound(s: SliceState, stance: SliceStance, ...values: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt; let index = 0;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function(this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const value = values[index++];
    if (value === undefined || value < min || value > max) throw new Error(`Unexpected shared draw ${index}: ${value}, ${min}..${max}`);
    return value;
  });
  try { const result = resolveSliceCombatRound(s, stance); s.combatHistory.push(structuredClone(result.round)); expect(spy).toHaveBeenCalledTimes(values.length); return result; }
  finally { spy.mockRestore(); }
}
afterEach(() => vi.restoreAllMocks());

describe('Parasite finite wheels, body and source', () => {
  it('uses the existing count distribution and exact six-slot30/15/20/20/10/5 wheel', () => {
    const s = fixture(); expect(PARASITE_COUNT_WHEEL).toEqual(TRAVELER_COUNT_WHEEL); expect(playerCountWheel(s)).toEqual(PARASITE_COUNT_WHEEL);
    expect(parasiteAbilityWheel(s, null).map(a => a.weight)).toEqual([30, 15, 20, 20, 10, 5]);
    expect(playerAbilityWheel(s, null)).toEqual(parasiteAbilityWheel(s, null));
    for (const [id] of profile) expect(drawParasiteAbility(random(ticket(id, 'CONTROL')), s, 'CONTROL')).toBe(id);
    expect([1, 11, 26, 51, 76, 91].map(parasiteActionCount)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(PARASITE_ENEMY_COUNT_WHEEL.map(e => e.weight)).toEqual([20, 50, 30]);
    expect([1, 20, 21, 70, 71, 100].map(parasiteEnemyActionCount)).toEqual([2, 2, 3, 3, 4, 4]);
    expect([1, 36, 56, 71, 96].map(n => drawParasiteEnemyAbility(random(n)))).toEqual(['WIND_BLADE', 'WIND_STEP', 'GUST', 'STICK', 'ACCIDENT']);
  });
  it('has no free borrowed spells or second player body on promotion', () => {
    const s = fixture(), before = structuredClone(s);
    expect(s.parasite.encounter.borrowed).toEqual([]); expect(effect(s, 'RELEASE_POWER').selfGain).toBe(0);
    expect(s).toEqual(before); expect(projectParasiteCombat(s).enemySpirituality).toBe(32);
    expect(effect(s, 'STRIKE', random(), undefined, .5)).toMatchObject({ selfGain: 6, threatens: true });
    s.town.clubLocation = 'HAND'; expect(effect(s, 'STRIKE', random(), undefined, .5).selfGain).toBe(8);
    expect(effect(s, 'BLOCK').enemyReduction).toBe(10); expect(effect(s, 'ACCIDENT').selfGain).toBe(-22.5);
  });
  it('refuses counterfeit or stale source without RNG or resource spending', () => {
    for (const mutate of [(s: SliceState) => { s.revision++; }, (s: SliceState) => { s.town.clubLocation = 'HAND'; },
      (s: SliceState) => { s.health--; }, (s: SliceState) => { s.combat!.enemyMind--; }]) {
      const s = fixture(), r = pending(s); mutate(s); const before = structuredClone(s), rng = random();
      expect(effect(s, K, rng, r)).toMatchObject({ selfGain: 0, enemyReduction: 0 }); expect(s).toEqual(before); expect(rng.cursor).toBe(0);
      expect(() => resolveParasiteEnemyIntent(s, r, 1)).toThrow();
    }
  });
  it('requires original living Ralf and settled contact before the common round', () => {
    for (const mutate of [(s: SliceState) => { s.parasite.encounter.targetId = 'COPY' as never; },
      (s: SliceState) => { s.parasite.encounter.weapon.location = 'YARD'; },
      (s: SliceState) => { s.parasite.life.player.presence = 'INSIDE_HOST'; },
      (s: SliceState) => { s.combat!.round = 2; }, (s: SliceState) => { s.world.city = 'TINGEN'; }]) {
      const s = fixture(); mutate(s); const before = structuredClone(s);
      expect(currentParasiteCombatSource(s)).toBeNull(); expect(() => resolveSliceCombatRound(s, 'ATTACK')).toThrow(); expect(s).toEqual(before);
    }
  });
  it('FIRST_CASE remains the original ordinary carrier and never acquires Ralf powers', () => {
    const s = fixture(true), before = structuredClone(s);
    expect(currentParasiteCombatSource(s)?.targetId).toBe('ORIGINAL_LIVING_CARRIER');
    for (const id of [K, R, 'RELEASE_POWER'] as const) expect(effect(s, id)).toMatchObject({ selfGain: 0, enemyReduction: 0 });
    expect(s).toEqual(before); expect(effect(s, 'STRIKE').selfGain).toBe(12);
    s.world.carrierAlive = false; expect(currentParasiteCombatSource(s)).toBeNull();
  });
});

describe('Current thought theft is not immediate S5 execution or power acquisition', () => {
  it('pays4 and withholds only one current pending spell intention without executing it', () => {
    const s = fixture(), r = pending(s), old = structuredClone(s.fireThief), rng = random(1);
    const result = effect(s, K, rng, r);
    expect(result).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false }); expect(result.label).toContain('没有立即照做');
    expect(s.spirituality).toBe(116); expect(s.parasite.encounter.borrowed).toEqual([]);
    expect(s.parasite.encounter.thoughts).toEqual([{ round: 1, action: 'WIND_BLADE', status: 'WITHHELD' }]);
    expect(resolveParasiteEnemyIntent(s, r, 1)).toMatchObject({ selfGain: 0, enemyReduction: 0 }); expect(s.parasite.encounter.enemySpirituality).toBe(32);
    decideParasiteEnemyIntent(s, r, 'WIND_BLADE'); expect(resolveParasiteEnemyIntent(s, r, 1).selfGain).toBe(54);
    expect(s.parasite.encounter.enemySpirituality).toBe(28); expect(s.fireThief).toEqual(old);
    const snapshot = finishParasiteCombatRound(s, r); expect(s.parasite.encounter.thoughts[0]?.status).toBe('DISCARDED');
    expect(snapshot?.stolenThoughts).toBe(1); expect(validateParasiteRoundOutcome(snapshot)).toBe(true);
  });
  it('a failed K pays4 and leaves the original same decision executable', () => {
    const s = fixture(), r = pending(s); expect(effect(s, K, random(100), r).selfGain).toBe(0);
    expect(s.spirituality).toBe(116); expect(r.pending?.stolen).toBe(false); expect(s.parasite.encounter.thoughts).toEqual([]);
    expect(resolveParasiteEnemyIntent(s, r, 1).selfGain).toBe(54); expect(s.parasite.encounter.enemySpirituality).toBe(28);
  });
  it('missing,accidental,already-stolen or unaffordable thoughts have no check or payment', () => {
    for (const mode of ['NONE', 'ACCIDENT', 'STOLEN', 'NO_SP', 'NAN_SP'] as const) {
      const s = fixture(), r = mode === 'NONE' ? createParasiteRoundContext(s) : pending(s, mode === 'ACCIDENT' ? 'ACCIDENT' : 'STICK');
      if (mode === 'STOLEN') effect(s, K, random(1), r);
      if (mode === 'NO_SP') s.spirituality = 3; if (mode === 'NAN_SP') s.spirituality = Number.NaN;
      const before = structuredClone(s), rng = random(); expect(effect(s, K, rng, r).selfGain).toBe(0);
      expect(s).toEqual(before); expect(rng.cursor).toBe(0);
    }
  });
  it('cannot plan a second decision before consuming the first or reuse a finished context', () => {
    const s = fixture(), r = pending(s); expect(() => decideParasiteEnemyIntent(s, r, 'GUST')).toThrow();
    resolveParasiteEnemyIntent(s, r, 1); expect(() => resolveParasiteEnemyIntent(s, r, 1)).toThrow();
    finishParasiteCombatRound(s, r); expect(() => decideParasiteEnemyIntent(s, r, 'GUST')).toThrow();
    expect(effect(s, K, random(), r).selfGain).toBe(0);
  });
});

describe('Three actual original powers and finite borrowed records', () => {
  it('each R takes only one distinct ability, spends6, and stops at three without copies', () => {
    const s = fixture(), old = structuredClone(s.fireThief);
    for (let i = 1; i <= 3; i++) { effect(s, R, random(1, 1)); expect(s.parasite.encounter.borrowed).toHaveLength(i); }
    expect(s.parasite.encounter.borrowed.map(p => p.abilityId)).toEqual(['WIND_BLADE', 'WIND_STEP', 'GUST']);
    expect(s.spirituality).toBe(102); expect(s.parasite.encounter.enemySpirituality).toBe(32);
    const before = structuredClone(s), rng = random(); expect(effect(s, R, rng).selfGain).toBe(0); expect(s).toEqual(before); expect(rng.cursor).toBe(0);
    expect(s.fireThief).toEqual(old);
  });
  it('uses finite observed familiarity weighting without granting a knowledge library', () => {
    const s = fixture(); s.parasite.encounter.observed = ['GUST']; const rng = random(1, 5);
    effect(s, R, rng); expect(s.parasite.encounter.borrowed[0]?.abilityId).toBe('GUST');
    expect(s.parasite.encounter.observed).toEqual(['GUST']); expect(rng.cursor).toBe(2);
  });
  it('failed or unaffordable R cannot disable a source or fabricate storage', () => {
    const s = fixture(); effect(s, R, random(100)); expect(s.spirituality).toBe(114); expect(s.parasite.encounter.borrowed).toEqual([]);
    s.spirituality = 5; const before = structuredClone(s); effect(s, R); expect(s).toEqual(before);
  });
  it('J pays the real original cost each time and remains repeatable inside its window', () => {
    const s = fixture(); effect(s, R, random(1, 1));
    expect(effect(s, 'RELEASE_POWER', random(), undefined, .5)).toMatchObject({ selfGain: 27, enemyReduction: 0, threatens: true });
    expect(effect(s, 'RELEASE_POWER').selfGain).toBe(54);
    expect(s.spirituality).toBe(106); expect(s.parasite.encounter.borrowed[0]).toMatchObject({ status: 'USED', uses: 2, usedRound: 1, closedSeconds: null, expiresSeconds: 7200 });
    expect(isParasitePowerDisabled(s.parasite.encounter, 'WIND_BLADE')).toBe(true); expect(s.parasite.encounter.enemySpirituality).toBe(32);
  });
  it('does not skip an unaffordable first stored power or consume a different one', () => {
    const s = fixture(); effect(s, R, random(1, 1)); effect(s, R, random(1, 1)); s.spirituality = 3;
    const before = structuredClone(s); expect(effect(s, 'RELEASE_POWER').selfGain).toBe(0); expect(s).toEqual(before);
  });
  it('power theft disables even a previously planned spell before it executes', () => {
    const s = fixture(), r = pending(s, 'WIND_BLADE'); effect(s, R, random(1, 1), r);
    const result = resolveParasiteEnemyIntent(s, r, .5); expect(result.selfGain).toBe(12); expect(result.label).toContain('原短棍');
    expect(s.parasite.encounter.enemySpirituality).toBe(32); expect(s.parasite.encounter.observed).toEqual([]);
    decideParasiteEnemyIntent(s, r, 'WIND_BLADE'); expect(r.pending?.id).toBe('STICK');
  });
  it('real source powers pay4/3/3, have source effects and eventually fall back to the same stick', () => {
    const s = fixture();
    for (const [id, cost, gain, reduction] of [['WIND_BLADE', 4, 54, 0], ['WIND_STEP', 3, 0, 22], ['GUST', 3, 0, 18]] as const) {
      const before = s.parasite.encounter.enemySpirituality, r = pending(s, id);
      expect(resolveParasiteEnemyIntent(s, r, 1)).toMatchObject({ selfGain: gain, enemyReduction: reduction }); expect(s.parasite.encounter.enemySpirituality).toBe(before - cost);
    }
    s.parasite.encounter.enemySpirituality = 2; const r = pending(s, 'GUST'); expect(r.pending?.id).toBe('STICK');
    expect(resolveParasiteEnemyIntent(s, r, 1).selfGain).toBe(24); expect(s.parasite.encounter.enemySpirituality).toBe(2);
  });
  it('actual G expiry keeps source identity,use history,and original depleted spirituality', () => {
    const s = fixture(); effect(s, R, random(1, 1)); effect(s, 'RELEASE_POWER'); s.parasite.encounter.enemySpirituality = 12;
    s.parasite.encounter.elapsedSeconds = 7199; expireParasitePowers(s); expect(isParasitePowerDisabled(s.parasite.encounter, 'WIND_BLADE')).toBe(true);
    s.parasite.encounter.elapsedSeconds = 7200; expireParasitePowers(s);
    expect(s.parasite.encounter.borrowed[0]).toMatchObject({ sourceId: 'PR4-RALF-TOREN', status: 'EXPIRED', uses: 1, closedSeconds: 7200, restoredToSource: true });
    expect(s.parasite.encounter.enemySpirituality).toBe(12); expect(effect(s, 'RELEASE_POWER').selfGain).toBe(0);
  });
});

describe('Shared round production bridge and real terminal records', () => {
  it('settles the exact same canonical-sorted lastRound without key-order dependence', () => {
    const s = fixture();
    const result = recordedRound(s, 'ATTACK', 1, 1, 96, ticket('STRIKE', 'ATTACK'), 96, 1, 70);
    expect(result.outcome).toBe('ENEMY_SURRENDERED');
    s.combat!.lastRound = JSON.parse(stableStringify(s.combat!.lastRound));
    s.parasite.encounter.enemyInjuries = JSON.parse(stableStringify(s.parasite.encounter.enemyInjuries));
    expect(() => settleParasiteEncounter(s, result.outcome, context())).not.toThrow();
    expect(validateParasiteEncounter(JSON.parse(stableStringify(s)) as SliceState)).toBe(true);
    const changed = JSON.parse(stableStringify(s)) as SliceState; changed.parasite.encounter.terminal!.enemyHealth--;
    expect(validateParasiteEncounter(changed)).toBe(false);
  });
  it('K cancels only the first real enemy decision and does not borrow its wind blade', () => {
    const s = fixture(); s.spirituality = 80;
    const result = recordedRound(s, 'CONTROL', 1, 1, 1, ticket(K, 'CONTROL'), 1, 1, 1_000_000, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.moves.map(m => m.actor)).toEqual(['PLAYER', 'ENEMY', 'ENEMY']);
    expect(result.round.moves.map(m => m.selfGain)).toEqual([0, 0, 54]); expect(s.parasite.encounter.borrowed).toEqual([]);
    expect(s.parasite.encounter.enemySpirituality).toBe(28); expect(s.health).toBe(90); expect(s.spirituality).toBe(88);
    expect(result.round.parasiteOutcome).toMatchObject({ targetId: 'PR4-RALF-TOREN', enemySpirituality: 28, elapsedSeconds: 60, stolenThoughts: 1 });
    expect(validateParasiteRoundOutcome(result.round.parasiteOutcome)).toBe(true); expect(validateParasiteEncounter(s)).toBe(true);
  });
  it('borrows in round1,releases in round2,then preserves real surrender and unresolved loans', () => {
    const s = fixture(), oldDream = structuredClone(s.dreamStealer), oldFire = structuredClone(s.fireThief); s.spirituality = 80;
    const first = recordedRound(s, 'PREPARE', 1, 1, 1, ticket(R, 'PREPARE'), 1, 1, 96, 1);
    expect(first.outcome).toBe('CONTINUE'); expect(s.spirituality).toBe(86); expect(s.parasite.encounter.enemySpirituality).toBe(32);
    const second = recordedRound(s, 'ATTACK', 1, 1, 1, 96, ticket('RELEASE_POWER', 'ATTACK'), 1, 70);
    expect(second.outcome).toBe('ENEMY_SURRENDERED'); expect(s.spirituality).toBe(82);
    settleParasiteEncounter(s, second.outcome, context());
    expect(s.parasite.encounter.terminal).toMatchObject({ outcome: 'ENEMY_SURRENDERED', round: 2, enemyHealth: 70, enemySpirituality: 32 });
    expect(s.parasite.encounter.weapon.location).toBe('YARD'); expect(hasParasiteEncounterLock(s)).toBe(true);
    expect(validateParasiteEncounter(s)).toBe(true); expect(s.fireThief).toEqual(oldFire); expect(s.dreamStealer).toEqual(oldDream);
    applyParasiteEncounterCommand(s, { type: 'RETURN_POWERS' }, context());
    expect(s.parasite.encounter.borrowed[0]).toMatchObject({ status: 'RETURNED', uses: 1, restoredToSource: true });
    expect(hasParasiteEncounterLock(s)).toBe(false); expect(validateParasiteEncounter(s)).toBe(true);
  });
  it('retreat preserves borrowed records and actual32S until explicit waiting restores the living source', () => {
    const s = fixture(); recordedRound(s, 'PREPARE', 1, 1, 1, ticket(R, 'PREPARE'), 1, 1, 96, 1);
    const result = recordedRound(s, 'RETREAT', 1, 1, 96, 96, 1); expect(result.outcome).toBe('RETREATED');
    settleParasiteEncounter(s, result.outcome, context()); expect(s.parasite.encounter.borrowed[0]?.status).toBe('STORED');
    expect(s.parasite.encounter.terminal?.outcome).toBe('RETREATED'); expect(validateParasiteEncounter(s)).toBe(true);
    applyParasiteEncounterCommand(s, { type: 'WAIT_POWER_EXPIRY' }, context());
    expect(s.parasite.encounter.elapsedSeconds).toBe(7200); expect(s.parasite.encounter.borrowed[0]).toMatchObject({ status: 'EXPIRED', restoredToSource: true });
    expect(s.parasite.encounter.enemySpirituality).toBe(32); expect(validateParasiteEncounter(s)).toBe(true);
  });
  it('enemy death retains the one original corpse and cannot restore source ability to a living replacement', () => {
    const s = fixture(); recordedRound(s, 'PREPARE', 1, 1, 1, ticket(R, 'PREPARE'), 1, 1, 96, 1);
    const result = recordedRound(s, 'ATTACK', 1, 1, 96, 96, ticket('STRIKE', 'ATTACK'), 1, 100);
    expect(result.outcome).toBe('ENEMY_DEAD'); settleParasiteEncounter(s, result.outcome, context());
    expect(s.parasite.encounter.terminal).toMatchObject({ outcome: 'ENEMY_DEAD', enemyHealth: 0, enemyStatus: 'DEAD' });
    applyParasiteEncounterCommand(s, { type: 'RETURN_POWERS' }, context());
    expect(s.parasite.encounter.borrowed[0]?.restoredToSource).toBe(false); expect(s.parasite.encounter.enemyHealth).toBe(0);
    expect(validateParasiteEncounter(s)).toBe(true); expect(() => applyParasiteEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context())).toThrow();
  });
  it('player death closes remaining G loans with evidence and gives no regeneration or revival', () => {
    const s = fixture(); s.spirituality = 80;
    const result = recordedRound(s, 'PREPARE', 1, 1, 1, ticket(R, 'PREPARE'), 1, 1, 96, 1_000_000, 100);
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.spirituality).toBe(74);
    settleParasiteEncounter(s, result.outcome, context()); s.status = 'DEAD';
    expect(s.parasite.encounter.borrowed[0]).toMatchObject({ status: 'RETURNED', closedSeconds: 60, restoredToSource: true });
    expect(s.parasite.encounter.terminal?.outcome).toBe('PLAYER_DEAD'); expect(validateParasiteEncounter(s)).toBe(true);
    expect(s.parasite.encounter.enemySpirituality).toBe(32); expect(s.combat).toBeNull();
  });
  it('refuses invented endings and malformed snapshots without rewriting original records', () => {
    const s = fixture(), before = structuredClone(s);
    expect(() => settleParasiteEncounter(s, 'ENEMY_DEAD', context())).toThrow(); expect(s).toEqual(before);
    expect(validateParasiteRoundOutcome(null)).toBe(false); expect(validateParasiteRoundOutcome({ targetId: 'COPY' })).toBe(false);
    const result = recordedRound(s, 'RETREAT', 1, 1, 96, 1);
    const snapshot = result.round.parasiteOutcome!; expect(validateParasiteRoundOutcome(snapshot)).toBe(true);
    expect(validateParasiteRoundOutcome({ ...snapshot, enemySpirituality: 33 })).toBe(false);
    expect(validateParasiteRoundOutcome({ ...snapshot, borrowed: [null] })).toBe(false);
    expect(validateParasiteRoundOutcome({ ...snapshot, extra: true })).toBe(false);
  });
});
