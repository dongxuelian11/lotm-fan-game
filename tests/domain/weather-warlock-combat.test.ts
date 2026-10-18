import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import { assertValidSliceState } from '../../src/domain/slice/validation.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { PYROMANIAC_COUNT_WHEEL } from '../../src/domain/pyromaniac/combat.js';
import { resolveWeatherWarlockCombatRound } from '../../src/domain/slice/weather-warlock-combat.js';
import { settleWeatherWarlockEncounter, validateWeatherWarlockEncounter } from '../../src/domain/weather-warlock/encounter.js';
import { WEATHER_WARLOCK_MEMBER_IDS } from '../../src/domain/weather-warlock/life.js';
import {
  WEATHER_WARLOCK_COUNT_WHEEL, WEATHER_WARLOCK_ENEMY_COUNT_WHEEL, WEATHER_WARLOCK_ENEMY_ABILITY_WHEEL,
  weatherWarlockActionCount, weatherWarlockEnemyActionCount, weatherWarlockAbilityWheel,
  beginWeatherWarlockCombatRound, currentWeatherWarlockCombatSource,
  resolveWeatherWarlockCombatAbility, resolveWeatherWarlockEnemyAbility,
  finishWeatherWarlockCombatRound, shareWeatherWarlockHealthDamage,
  validWeatherWarlockTerrain, validateWeatherWarlockRoundOutcome,
  type WeatherWarlockMoveId, type WeatherWarlockPolicy, type WeatherWarlockCombatSource,
  type WeatherWarlockTerrain,
} from '../../src/domain/weather-warlock/combat.js';
import { weatherSnapshot, weatherContext } from './weather-warlock-test-fixture.js';

const noRandom: ActionRandomStream = { seed: 'weather-unit-no-extra-draw', cursor: 0, nextInt() { throw new Error('Unexpected extra draw'); } };
const begin = (s: SliceState, policy: WeatherWarlockPolicy = 'HOLD') => beginWeatherWarlockCombatRound(s, 'ATTACK', noRandom, policy);
const effect = (s: SliceState, id: WeatherWarlockMoveId, r: ReturnType<typeof begin>, source: WeatherWarlockCombatSource | null = r.source) => resolveWeatherWarlockCombatAbility(s, id, 1, noRandom, r, source);
const finish = (s: SliceState, r: ReturnType<typeof begin>) => {
  const o = finishWeatherWarlockCombatRound(s, r); expect(validateWeatherWarlockRoundOutcome(o)).toBe(true); return o;
};
/** Directed RNG through the real shared adapter, preserving draws and recording each real round.
 * Both selected losing-side attacks are non-threatening, so depletion needs no fabricated healing/history. */
function safeRound(s: SliceState, playerMove: 'hunter.s2.storm' | 'BLOCK', enemyMove: 'COMPOSE' | 'LIGHTNING') {
  const playerFirst = s.combat!.round % 2 === 1;
  const original = DeterministicActionRandomStream.prototype.nextInt;
  let n = 0;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const index = n++;
    if (index < 2) return 1;
    if (index === 4) return playerMove === 'BLOCK' ? 1 : 1_000_000;
    const playerTurn = index === (playerFirst ? 2 : 3);
    if (!playerTurn) return enemyMove === 'COMPOSE' ? 90 : 1;
    const wheel = weatherWarlockAbilityWheel(s, 'ATTACK');
    const before = wheel.slice(0, wheel.findIndex(a => a.id === playerMove)).reduce((sum, a) => sum + a.weight, 0);
    return Math.floor(before / 100 * max + 1e-8) + 1;
  });
  try {
    const result = resolveWeatherWarlockCombatRound(s, 'ATTACK', 'HOLD');
    expect(result.outcome).toBe('CONTINUE'); expect(n).toBe(5);
    s.combatHistory.push(structuredClone(result.round));
    settleWeatherWarlockEncounter(s, result.outcome, weatherContext(s));
    expect(validateWeatherWarlockRoundOutcome(result.round.weatherWarlockOutcome)).toBe(true);
    expect(validateWeatherWarlockEncounter(s)).toBe(true);
    return result.round.weatherWarlockOutcome!;
  } finally { spy.mockRestore(); }
}
afterEach(() => vi.restoreAllMocks());

describe('Weather Warlock paid finite weather and strict original terrain replay', () => {
  it('keeps both original six-slot wheels and exactly three new S2 ability entries', () => {
    const s = weatherSnapshot('combatStart');
    expect(currentWeatherWarlockCombatSource(s)).toMatchObject({ targetId: 'WW2-ORREN-VOSS', targetAge: 49, targetSequence: 2, enemyWeapon: 'WW2-ORREN-CLUB', actualOriginalBody: true, independentMind: true });
    expect(WEATHER_WARLOCK_COUNT_WHEEL).toEqual(PYROMANIAC_COUNT_WHEEL);
    expect(WEATHER_WARLOCK_ENEMY_COUNT_WHEEL).toEqual(PYROMANIAC_COUNT_WHEEL);
    expect([1, 11, 26, 51, 76, 91].map(weatherWarlockActionCount)).toEqual([1, 2, 3, 4, 5, 6]);
    expect([1, 11, 26, 51, 76, 91].map(weatherWarlockEnemyActionCount)).toEqual([1, 2, 3, 4, 5, 6]);
    const wheel = weatherWarlockAbilityWheel(s, null);
    expect(wheel.reduce((sum, row) => sum + row.weight, 0)).toBeCloseTo(100);
    expect(wheel.filter(a => a.id.startsWith('hunter.s2.')).map(a => a.id)).toEqual(['hunter.s2.battle-fog', 'hunter.s2.frost', 'hunter.s2.storm']);
    expect(WEATHER_WARLOCK_ENEMY_ABILITY_WHEEL.map(a => a.weight)).toEqual([35, 25, 25, 10, 5]);
  });

  it.each([
    ['hunter.s2.battle-fog', 'FOG', 8, 2, -10, 60, 10],
    ['hunter.s2.frost', 'FROST', 8, 1, -8, 50, 8],
    ['hunter.s2.storm', 'STORM', 10, 4, 75, 0, 15],
  ] as const)('pays and exposes all original bodies for %s under HOLD', (id, field, cost, water, gain, reduction, penalty) => {
    const s = weatherSnapshot('combatStart'), original = structuredClone(s.ironBloodKnight), oldWarBishop = structuredClone(s.warBishop);
    const energy = s.ironBloodKnight.team.members.slice(0, 5).map(m => m.energy), spirit = s.spirituality, r = begin(s);
    expect(effect(s, id, r)).toMatchObject({ selfGain: gain, enemyReduction: reduction });
    const o = finish(s, r);
    expect(o.playerActions[0]).toMatchObject({ weatherField: field, paidCost: cost, waterLitresUsed: water, selfFieldPenalty: penalty });
    expect(o.playerActions[0]!.memberEnergyCosts).toEqual(WEATHER_WARLOCK_MEMBER_IDS.map(memberId => ({ memberId, amount: 1 })));
    expect(o).toMatchObject({ linkCost: 0, linkedMemberIds: [], weatherFieldUsed: true, playerSpiritualityAfter: spirit - cost });
    expect(o.terrainAfter).toEqual({ waterLitres: 40 - water, wet: field === 'STORM', fixtureDamage: field === 'STORM' ? 1 : 0,
      weatherUses: { FOG: field === 'FOG' ? 1 : 0, FROST: field === 'FROST' ? 1 : 0, STORM: field === 'STORM' ? 1 : 0 } });
    expect(s.ironBloodKnight.team.members.slice(0, 5).map(m => m.energy)).toEqual(energy.map(e => e - 1));
    expect(s.ironBloodKnight.team.members.map(m => m.health)).toEqual(original.team.members.map(m => m.health));
    expect(s.ironBloodKnight.team.members.slice(5)).toEqual(original.team.members.slice(5));
    expect(s.ironBloodKnight.life).toEqual(original.life); expect(s.ironBloodKnight.encounter).toEqual(original.encounter);
    expect(s.warBishop).toEqual(oldWarBishop);
  });

  it('shares one real weather use across all three weather slots without repaying or stacking', () => {
    const s = weatherSnapshot('combatStart'), r = begin(s);
    effect(s, 'hunter.s2.battle-fog', r); const afterFirst = structuredClone(s);
    expect(effect(s, 'hunter.s2.frost', r)).toMatchObject({ selfGain: 0, enemyReduction: 10 });
    expect(effect(s, 'hunter.s2.storm', r)).toMatchObject({ selfGain: r.source.clubHeld ? 16 : 12, enemyReduction: 0 });
    expect(s).toEqual(afterFirst);
    const o = finish(s, r); expect(o.playerActions.map(a => a.paidCost)).toEqual([8, 0, 0]);
    expect(o.playerActions.map(a => a.weatherField)).toEqual(['FOG', null, null]);
    expect(o.payments.map(p => p.energyCost)).toEqual([1, 1, 1, 1, 1]);
  });

  it('charges linked originals the field exposure in addition to the paid old formation', () => {
    const s = weatherSnapshot('combatStart'), energies = s.ironBloodKnight.team.members.slice(0, 5).map(m => m.energy), r = begin(s, 'LINK_IF_READY');
    effect(s, 'hunter.s2.storm', r); expect(effect(s, 'hunter.s3.coordinated-action', r).selfGain).toBe(20);
    expect(effect(s, 'hunter.s3.formation-link', r).enemyReduction).toBe(0);
    const o = finish(s, r); expect(o).toMatchObject({ linkCost: 5, playerSpiritualityAfter: 105, teamContribution: 20 });
    expect(o.payments.map(p => p.energyCost)).toEqual([3, 3, 3, 3, 3]);
    expect(s.ironBloodKnight.team.members.slice(0, 5).map(m => m.energy)).toEqual(energies.map(e => e - 3));
    expect(s.weatherWarlock.encounter.linkedMemberIds).toEqual([]);
  });

  it.each(['spirit', 'present-member-energy'] as const)('falls back atomically when %s is insufficient and does not draw again', cause => {
    const s = weatherSnapshot('combatStart');
    if (cause === 'spirit') s.spirituality = 7; else s.ironBloodKnight.team.members[0]!.energy = 0;
    const before = structuredClone(s), r = begin(s);
    expect(effect(s, 'hunter.s2.battle-fog', r)).toMatchObject({ selfGain: 0, enemyReduction: 10 });
    expect(effect(s, 'hunter.s2.storm', r)).toMatchObject({ selfGain: r.source.clubHeld ? 16 : 12, enemyReduction: 0 });
    expect(s).toEqual(before);
    const o = finish(s, r); expect(o).toMatchObject({ weatherFieldUsed: false, payments: [] });
    expect(o.playerActions.every(a => a.paidCost === 0 && a.weatherField === null && a.waterLitresUsed === 0)).toBe(true);
  });

  it('does not grant an unwilling but actually exposed original a free field exemption', () => {
    const s = weatherSnapshot('combatStart'); s.ironBloodKnight.team.members[0]!.willing = false;
    const energy = s.ironBloodKnight.team.members[0]!.energy, r = begin(s, 'LINK_IF_READY');
    expect(r.model.linkCost).toBe(0); effect(s, 'hunter.s2.frost', r);
    expect(s.ironBloodKnight.team.members[0]!.energy).toBe(energy - 1); expect(finish(s, r).payments).toHaveLength(5);
  });

  it('spends the original 40 L in ten real rounds and uses ordinary fallback thereafter without resetting terrain', () => {
    const s = weatherSnapshot('combatStart'), health = s.health, old = structuredClone(s.warBishop);
    for (let i = 1; i <= 10; i++) {
      const o = safeRound(s, 'hunter.s2.storm', 'COMPOSE');
      expect(o.terrainAfter).toEqual({ waterLitres: 40 - 4 * i, wet: true, fixtureDamage: i, weatherUses: { FOG: 0, FROST: 0, STORM: i } });
      expect(o.playerActions[0]!.weatherField).toBe('STORM');
    }
    const terrain = structuredClone(s.weatherWarlock.encounter.terrain), members = structuredClone(s.ironBloodKnight.team.members);
    const last = safeRound(s, 'hunter.s2.storm', 'COMPOSE');
    expect(last.playerActions[0]).toMatchObject({ weatherField: null, paidCost: 0, waterLitresUsed: 0, selfGain: last.source.clubHeld ? 16 : 12 });
    expect(last.weatherFieldUsed).toBe(false); expect(s.weatherWarlock.encounter.terrain).toEqual(terrain);
    expect(s.ironBloodKnight.team.members).toEqual(members); expect(s.health).toBe(health); expect(s.warBishop).toEqual(old);
  });

  it('spends enemy independent 120 SP in fifteen real lightning uses before its original-club fallback', () => {
    const s = weatherSnapshot('combatStart'), old = structuredClone(s.ironBloodKnight.encounter);
    for (let i = 1; i <= 15; i++) expect(safeRound(s, 'BLOCK', 'LIGHTNING').enemySpirituality).toBe(120 - 8 * i);
    const o = safeRound(s, 'BLOCK', 'LIGHTNING');
    expect(o.enemyActions[0]).toMatchObject({ planned: 'LIGHTNING', actual: 'BODY_STRIKE', paidCost: 0, selfGain: 20 });
    expect(o.powerUses.LIGHTNING).toBe(15); expect(s.weatherWarlock.encounter.enemySpirituality).toBe(0);
    expect(s.ironBloodKnight.encounter).toEqual(old);
  });

  it('rejects inconsistent terrain shape, conserved water, wetness and original fixture damage', () => {
    const valid: WeatherWarlockTerrain = { waterLitres: 33, wet: true, fixtureDamage: 1, weatherUses: { FOG: 1, FROST: 1, STORM: 1 } };
    expect(validWeatherWarlockTerrain(valid)).toBe(true);
    for (const bad of [null, [], { ...valid, waterLitres: 34 }, { ...valid, wet: false }, { ...valid, fixtureDamage: 0 },
      { ...valid, reservoirCopy: true }, { ...valid, weatherUses: { ...valid.weatherUses, FREE: 1 } },
      { ...valid, weatherUses: { FOG: 1.5, FROST: 0, STORM: 1 } }]) expect(validWeatherWarlockTerrain(bad)).toBe(false);
  });

  it('replays terrain/actions exactly and rejects forged refunds, exemptions, duplicate fields and stale original sources', () => {
    const s = weatherSnapshot('combatStart'), r = begin(s), before = structuredClone(s);
    for (const source of [null, { ...r.source, targetId: 'WB3-CEDRIC-VALE' }, { ...r.source, enemyWeapon: 'COPY' },
      { ...r.source, terrain: { ...r.source.terrain, waterLitres: 39 } }])
      expect(effect(s, 'hunter.s2.storm', r, source as WeatherWarlockCombatSource | null).selfGain).toBe(0);
    expect(s).toEqual(before); effect(s, 'hunter.s2.storm', r); const o = finish(s, r);
    const edits: ((x: typeof o) => void)[] = [
      x => { x.terrainAfter.waterLitres++; }, x => { x.terrainAfter.fixtureDamage = 0; },
      x => { x.terrainAfter.wet = false; }, x => { x.weatherFieldUsed = false; },
      x => { x.playerActions[0]!.paidCost = 0; }, x => { x.playerActions[0]!.selfFieldPenalty = 0; },
      x => { x.playerActions[0]!.memberEnergyCosts.pop(); }, x => { x.membersAfter[0]!.energy++; },
      x => { x.source.terrain = structuredClone(x.terrainAfter); },
      x => { x.playerActions.push({ ...structuredClone(x.playerActions[0]!), order: 1 }); },
    ];
    for (const edit of edits) { const bad = structuredClone(o); edit(bad); expect(validateWeatherWarlockRoundOutcome(bad)).toBe(false); }
    expect(validateWeatherWarlockRoundOutcome(JSON.parse(stableStringify(o)))).toBe(true);
    expect(() => finishWeatherWarlockCombatRound(s, r)).toThrow();
  });

  it('detects external terrain replacement during an unfinished round before further effects or commits', () => {
    const s = weatherSnapshot('combatStart'), r = begin(s); s.weatherWarlock.encounter.terrain.waterLitres--;
    const before = structuredClone(s); expect(effect(s, 'hunter.s2.storm', r).selfGain).toBe(0);
    expect(resolveWeatherWarlockEnemyAbility(s, 'LIGHTNING', 1, noRandom, r).selfGain).toBe(0);
    expect(s).toEqual(before); expect(() => finishWeatherWarlockCombatRound(s, r)).toThrow();
  });

  it('accepts both genuine six-slot budgets and all twelve recorded moves at the full-state boundary', () => {
    const s = weatherSnapshot('combatStart'), original = DeterministicActionRandomStream.prototype.nextInt;
    let draws = 0;
    const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
      original.call(this, min, max); const n = draws++;
      if (n < 2) return 91;
      if (max === 1_000_000) return 1;
      if (max === 100) return 90; // Enemy COMPOSE is genuinely non-threatening.
      const wheel = weatherWarlockAbilityWheel(s, 'ATTACK');
      const before = wheel.slice(0, wheel.findIndex(a => a.id === 'BLOCK')).reduce((sum, a) => sum + a.weight, 0);
      return Math.floor(before / 100 * max + 1e-8) + 1;
    });
    try {
      const result = resolveWeatherWarlockCombatRound(s, 'ATTACK');
      expect(result.outcome).toBe('CONTINUE'); expect(draws).toBe(15);
      expect([result.round.playerCount, result.round.enemyCount, result.round.moves.length]).toEqual([6, 6, 12]);
      expect(result.round.weatherWarlockOutcome!.playerActions).toHaveLength(6);
      expect(result.round.weatherWarlockOutcome!.enemyActions).toHaveLength(6);
      s.combatHistory.push(structuredClone(result.round)); settleWeatherWarlockEncounter(s, result.outcome, weatherContext(s));
      expect(validateWeatherWarlockEncounter(s)).toBe(true); expect(() => assertValidSliceState(s)).not.toThrow();
    } finally { spy.mockRestore(); }
  });

  it('still conserves real light injury sharing and never redirects direct death', () => {
    const s = weatherSnapshot('combatStart'), r = begin(s, 'LINK_IF_READY'), health = s.health;
    expect(shareWeatherWarlockHealthDamage(s, 100, r, 'DEATH').ownerDamage).toBe(100);
    expect(r.share).toBeNull(); const shared = shareWeatherWarlockHealthDamage(s, 10, r, 'LIGHT');
    expect(shared.ownerDamage).toBe(8); s.health -= shared.ownerDamage;
    const o = finish(s, r); expect(o.sharedHealthDamage).toBe(2); expect(o.playerHealthAfter).toBe(health - 8);
    expect(o.payments.reduce((sum, p) => sum + p.healthDamage, 0)).toBe(2);
  });
});
