import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { validatePlaneswalkerState } from '../../src/domain/planeswalker/index.js';
import { validatePlaneswalkerLife } from '../../src/domain/planeswalker/life.js';
import { validatePlaneswalkerEncounter } from '../../src/domain/planeswalker/encounter.js';
import { PLANESWALKER_ENEMY_COUNT_WHEEL, PLANESWALKER_ENEMY_ABILITY_WHEEL, validatePlaneswalkerRoundOutcome, validatePlaneswalkerCombatRound } from '../../src/domain/planeswalker/combat.js';
import { combatStart, encounterReady, practiced, pw, oldDoorRoots, type DirectedKind } from './planeswalker-directed-helper.js';

const roundCache = new Map<DirectedKind, SliceState>();
function firstRound(kind: 'TRANSIT_45' | 'WARD_45'): SliceState {
  if (!roundCache.has(kind)) roundCache.set(kind, applySliceIntent(combatStart(kind), { type: 'COMBAT_ROUND', stance: kind === 'TRANSIT_45' ? 'CONTROL' : 'ATTACK' }));
  return structuredClone(roundCache.get(kind)!);
}
const latest = (s: SliceState) => s.combatHistory.at(-1)!;
const valid = (s: SliceState) => {
  expect(validatePlaneswalkerLife(s)).toBe(true); expect(validatePlaneswalkerEncounter(s)).toBe(true); expect(validatePlaneswalkerState(s)).toBe(true);
  expect(validatePlaneswalkerRoundOutcome(latest(s).planeswalkerOutcome)).toBe(true); expect(validatePlaneswalkerCombatRound(latest(s))).toBe(true); assertValidSliceState(s);
};
describe('Planeswalker actual ordered45 consumption and replayable contemporary combat', () => {
  it('moves the original coordinator outside before optional fighting while retaining the closed life source', () => {
    const before = practiced(), s = encounterReady(), p = s.planeswalker.life.site, e = s.planeswalker.encounter;
    expect(e.startSite).toEqual(before.planeswalker.life.site); expect(e).toMatchObject({ status: 'READY', targetId: 'PW2-SOREN', enemyHealth: 100, enemySpirituality: 120, weaponLocation: 'HAND', enemyLocation: 'FAR' });
    expect(p).toMatchObject({ operatorId: 'PW2-MARA', operatorLocation: 'OUTSIDE', operatorEnergy: before.planeswalker.life.site.operatorEnergy - 2, playerLocation: 'NEAR', parcel: { id: 'PW2-PARCEL', location: 'ENTRY_STAND' } });
    expect(p.playerMetres).toBe(before.planeswalker.life.site.playerMetres + 2); expect(p.operatorMetres).toBe(before.planeswalker.life.site.operatorMetres + 2);
    expect(p.elapsedSeconds).toBe(before.planeswalker.life.site.elapsedSeconds + 4); expect(s.planeswalker.life.journal).toEqual(before.planeswalker.life.journal);
    const left = pw(s, { type: 'LEAVE_ENCOUNTER' }); expect(left.planeswalker.life.site.playerLocation).toBe('ENTRY');
    expect(left.planeswalker.life.site.playerMetres).toBe(p.playerMetres + 2); expect(left.planeswalker.encounter.status).toBe('RESOLVED'); assertValidSliceState(left);
  }, 90_000);
  it.each(['TRANSIT_45', 'WARD_45'] as const)('replays directed%s through the public round adapter with immutable source', kind => {
    const before = combatStart(kind), input = structuredClone(before), intent = { type: 'COMBAT_ROUND', stance: kind === 'TRANSIT_45' ? 'CONTROL' : 'ATTACK' } as const;
    const result = applySliceIntent(before, intent); expect(result).toEqual(applySliceIntent(before, intent)); expect(before).toEqual(input);
    expect(oldDoorRoots(result)).toEqual(oldDoorRoots(before)); expect(result.planeswalker.ritual).toEqual(before.planeswalker.ritual);
    expect(result.progression.mastery).toEqual(before.progression.mastery); expect(result.planeswalker.life.journal).toEqual(before.planeswalker.life.journal); valid(result);
  }, 90_000);
  it('consumes successful four-metre transit once at the subsequent actual original-club attack', () => {
    const s = firstRound('TRANSIT_45'), o = latest(s).planeswalkerOutcome!, transit = o.playerActions[0]!, strike = o.enemyActions[0]!;
    expect(transit).toMatchObject({ id: 'door.s2.symbolic-transit', attempted: true, succeeded: true, paidCost: 6, symbolicMetres: 4, chargeGranted: true, appliedAmount: 45, enemyReduction: 45 });
    expect(transit.siteBefore.playerLocation).toBe('NEAR'); expect(transit.siteAfter.playerLocation).toBe('FAR');
    expect(transit.siteAfter.playerMetres).toBe(transit.siteBefore.playerMetres + 4);
    expect(strike).toMatchObject({ actual: 'BODY_STRIKE', paidCost: 0, threatens: true, consumedTransitOrder: transit.order });
    expect(transit.chargeConsumedByOrder).toBe(strike.order); expect(strike.order).toBeGreaterThan(transit.order);
    expect(o.enemyActions.filter(a => a.consumedTransitOrder === transit.order)).toHaveLength(1);
    expect(o.siteAfter.playerAstralLegs).toBe(o.source.site.playerAstralLegs); expect(o.siteAfter.parcel).toEqual(o.source.site.parcel);
    expect(latest(s).consequence).toContain('实际减势45'); valid(s);
  }, 90_000);
  it('charges the enemy ward once and consumes it only at the next real successful known-pattern action', () => {
    const s = firstRound('WARD_45'), o = latest(s).planeswalkerOutcome!, door = o.playerActions[0]!, ward = o.enemyActions[0]!, pattern = o.playerActions[1]!;
    expect(door).toMatchObject({ id: 'door.s2.pattern-reproduction', fallback: 'DOOR_OPEN', paidCost: 0, attempted: false, doorOperationSeconds: 5, threatens: false });
    expect(door.rolls).toEqual([]); expect(ward).toMatchObject({ actual: 'REFRACT_WARD', paidCost: 4, chargeGranted: true, appliedAmount: 45, enemyReduction: 45 });
    expect(pattern).toMatchObject({ id: 'door.s2.pattern-reproduction', attempted: true, succeeded: true, paidCost: 7, selfGain: 90, consumedWardOrder: ward.order });
    expect(ward.chargeConsumedByOrder).toBe(pattern.order); expect(pattern.order).toBeGreaterThan(ward.order);
    expect(o.playerActions.filter(a => a.consumedWardOrder === ward.order)).toHaveLength(1); valid(s);
  }, 90_000);
  it.each(['TRANSIT_45', 'WARD_45'] as const)('keeps exact per-action resources, one-use windows and finite physical movement in%s', kind => {
    const s = firstRound(kind), o = latest(s).planeswalkerOutcome!;
    expect(o.playerSpiritualityAfter).toBe(o.source.playerSpirituality - o.playerActions.reduce((sum, a) => sum + a.paidCost, 0));
    expect(o.enemySpirituality).toBe(o.source.enemySpirituality - o.enemyActions.reduce((sum, a) => sum + a.paidCost, 0));
    expect(s.spirituality).toBe(o.continuing ? Math.min(120, o.playerSpiritualityAfter + 12) : o.playerSpiritualityAfter);
    expect(s.planeswalker.encounter.enemySpirituality).toBe(o.enemySpirituality);
    expect(o.playerActions.filter(a => a.id === 'door.s2.symbolic-transit' && a.attempted).length).toBeLessThanOrEqual(1);
    expect(o.enemyActions.filter(a => a.actual === 'REFRACT_WARD' && a.paidCost === 4).length).toBeLessThanOrEqual(1);
    for (const a of [...o.playerActions, ...o.enemyActions]) {
      if (a.chargeGranted && a.chargeConsumedByOrder === null) expect(a.appliedAmount).toBe(0);
      if (a.doorOperationSeconds > 0) expect([a.selfGain, a.threatens, a.paidCost]).toEqual([0, false, 0]);
    }
    expect(o.siteAfter.effect).toEqual({ mode: 'OFF', expiresAt: null }); valid(s);
  }, 90_000);
  it('projects the genuine opponent wheels and the same single live site instead of constructing another body', () => {
    const s = combatStart('TRANSIT_45'), p = projectSliceState(s);
    expect(p.combat!.enemyCountWheel).toEqual(PLANESWALKER_ENEMY_COUNT_WHEEL); expect(p.combat!.enemyAbilityWheel).toEqual(PLANESWALKER_ENEMY_ABILITY_WHEEL);
    expect(p.combat!.planeswalker!.site).toEqual(s.planeswalker.life.site); expect(s.planeswalker.encounter.startSource).toMatchObject({ targetId: 'PW2-SOREN', actualContemporaryBody: true, independentMind: true, enemyWeapon: 'PW2-SOREN-CLUB', thirdPartiesInArea: 0 });
    assertValidSliceState(s);
  });
});
const mutations: [string, (s: SliceState) => void][] = [
  ['unearned45', s => { latest(s).planeswalkerOutcome!.playerActions[0]!.appliedAmount = 0; }],
  ['consumed by wrong action', s => { latest(s).planeswalkerOutcome!.playerActions[0]!.chargeConsumedByOrder = 999; }],
  ['missing reciprocal consumption', s => { latest(s).planeswalkerOutcome!.enemyActions[0]!.consumedTransitOrder = null; }],
  ['refunded paid transit', s => { latest(s).planeswalkerOutcome!.playerActions[0]!.paidCost = 0; }],
  ['new four-metre destination', s => { latest(s).planeswalkerOutcome!.playerActions[0]!.siteAfter.playerLocation = 'NEAR'; }],
  ['fake planetary leg', s => { latest(s).planeswalkerOutcome!.playerActions[0]!.siteAfter.playerAstralLegs++; }],
  ['substituted original weapon', s => { Object.assign(latest(s).planeswalkerOutcome!.source, { enemyWeapon: 'COPY' }); }],
  ['changed target identity', s => { Object.assign(latest(s).planeswalkerOutcome!.source, { targetId: 'OTHER' }); }],
  ['free enemy recovery', s => { latest(s).planeswalkerOutcome!.enemySpirituality++; }],
  ['changed action order', s => { latest(s).planeswalkerOutcome!.enemyActions[0]!.order++; }],
  ['forged current RNG cursor', s => { latest(s).planeswalkerOutcome!.randomCursorAfter++; }],
  ['rewritten action roll', s => { const rolls = latest(s).planeswalkerOutcome!.playerActions[0]!.rolls; rolls[0] = rolls[0] === 1 ? 2 : 1; }],
];
describe('Planeswalker complete ordered combat mutation rejection', () => {
  it.each(mutations)('rejects%s', (_name, mutate) => {
    const s = firstRound('TRANSIT_45'); mutate(s); expect(validatePlaneswalkerRoundOutcome(latest(s).planeswalkerOutcome)).toBe(false);
    expect(validatePlaneswalkerEncounter(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  }, 90_000);
});
