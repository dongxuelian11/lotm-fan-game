import { beforeAll, describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { baseAdvantage, consequenceWeights, statusPenalty } from '../../src/domain/slice/combat.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { playerText } from '../../src/shared/player-text.js';
import {
  LIGHT_SEEKER_COUNT_WHEEL, LIGHT_SEEKER_ENEMY_COUNT_WHEEL, LIGHT_SEEKER_ENEMY_ABILITY_WHEEL,
  lightSeekerActionCount, lightSeekerEnemyActionCount, lightSeekerAbilityWheel,
  drawLightSeekerAbility, drawLightSeekerEnemyAbility, currentLightSeekerCombatSource,
  beginLightSeekerCombatRound, resolveLightSeekerCombatAbility, resolveLightSeekerEnemyAbility,
  finishLightSeekerCombatRound, lightSeekerRoundOutcome, projectLightSeekerCombat,
  validateLightSeekerRoundOutcome, validateLightSeekerCombatRound,
  type LightSeekerMoveId, type LightSeekerCombatSource, type LightSeekerRoundOutcome,
} from '../../src/domain/light-seeker/combat.js';
import { lightSeekerApproachedSite, validateLightSeekerEncounter } from '../../src/domain/light-seeker/encounter.js';
import { validateLightSeekerLife } from '../../src/domain/light-seeker/life.js';
import { validateLightSeekerSiteState } from '../../src/domain/light-seeker/resources.js';
import {
  lightSeekerBoundaryForIntent, lightSeekerSnapshot, sunLegacyKeys, rejectCt,
} from './light-seeker-helper.js';

const GUIDED = 'sun.s2.guided-radiance', LIMITED = 'sun.s2.limited-light';
const DOMAIN = 'sun.s4.unshadowed-domain', PURIFICATION = 'sun.s4.purification';
let original: SliceState, terminal: SliceState, naturalRounds: SliceCombatRound[];
beforeAll(() => {
  original = lightSeekerSnapshot('combatStart');
  terminal = lightSeekerBoundaryForIntent(i => i.type === 'COMBAT_ROUND',
    b => b.beforeLast.combat?.encounterId === 'LIGHT_SEEKER_DISPUTE' && b.final.lightSeeker.encounter.terminal !== null).final;
  const e = terminal.lightSeeker.encounter;
  naturalRounds = terminal.combatHistory.slice(e.startHistoryIndex!, e.terminal!.historyIndex + 1);
});
function outcome(round: SliceCombatRound): LightSeekerRoundOutcome {
  if (!round.lightSeekerOutcome) throw new Error('Missing genuine recorded LightSeeker outcome');
  return round.lightSeekerOutcome;
}
function scripted(s: SliceState, values: number[] = []): ActionRandomStream {
  let index = 0, cursor = s.random.cursor;
  return { seed: s.random.seed, get cursor() { return cursor; }, nextInt(min, max) {
    const value = values[index++];
    if (value === undefined || !Number.isInteger(value) || value < min || value > max) throw new Error(`Unexpected isolated slot draw ${index}: ${value}`);
    cursor++; return value;
  } };
}
/** DIRECTED SLOT-ONLY units. The unchanged natural combat entry supplies actual people and
 * objects. Explicit input changes and scripted d100 checks exercise local rules only. These
 * are never saved as natural captures, selected by seed search, or claimed as full rounds. */
function scenario(checks: number[] = [], change?: (s: SliceState) => void, base = original) {
  const state = structuredClone(base); change?.(state);
  const random = scripted(state, checks), round = beginLightSeekerCombatRound(state, 'ATTACK', random);
  return { state, random, round,
    player: (id: LightSeekerMoveId) => resolveLightSeekerCombatAbility(state, id, 1 - statusPenalty(round.source.playerHealth, 100), random, round),
    enemy: (id: Parameters<typeof resolveLightSeekerEnemyAbility>[1]) => resolveLightSeekerEnemyAbility(state, id, 1 - statusPenalty(round.source.enemyHealth, 100), random, round),
  };
}
function openLine(s: SliceState): void {
  const shutter = s.lightSeeker.life.site.shutter;
  if (shutter.state === 'CLOSED') { shutter.state = 'OPEN'; shutter.operations++; shutter.durability--; }
}
const sum = (xs: { selfGain: number; enemyReduction: number }[], key: 'selfGain' | 'enemyReduction') => xs.reduce((n, a) => n + a[key], 0);
const ordered = (o: LightSeekerRoundOutcome) => [...o.playerActions, ...o.enemyActions].sort((a, b) => a.order - b.order);
function firstAction(o: LightSeekerRoundOutcome) {
  const a = ordered(o)[0]; if (!a) throw new Error('Expected actual action evidence'); return a;
}
function accounting(before: SliceState, after: SliceState, round: SliceCombatRound): void {
  const o = outcome(round), x = o.source, actions = ordered(o);
  expect(o.playerSpiritualityAfter).toBe(x.playerSpirituality - o.playerActions.reduce((n, a) => n + a.paidCost, 0));
  expect(o.enemySpirituality).toBe(x.enemySpirituality - o.enemyActions.reduce((n, a) => n + a.paidCost, 0));
  expect(after.spirituality).toBe(o.continuing ? Math.min(120, o.playerSpiritualityAfter + 12) : o.playerSpiritualityAfter);
  expect(after.lightSeeker.encounter.enemySpirituality).toBe(o.enemySpirituality);
  expect(o.enemySpirituality).toBe(120 - o.powerUses.LIGHT_STRIKE * 7 - o.powerUses.LIGHT_WARD * 6);
  let playerS = x.playerSpirituality, enemyS = x.enemySpirituality, site = x.site;
  for (const [index, a] of actions.entries()) {
    expect(a.order).toBe(index); expect(a.atSeconds).toBe(x.site.elapsedSeconds + index * 5); expect(a.elapsedSeconds).toBe(5);
    expect(a.siteBefore).toEqual(site); expect(a.siteAfter.elapsedSeconds).toBe(a.siteBefore.elapsedSeconds + 5);
    expect(validateLightSeekerSiteState(a.siteAfter)).toBe(true);
    expect(a.siteAfter.shutter.operations - a.siteBefore.shutter.operations).toBe(a.shutterWear);
    expect(a.siteBefore.shutter.durability - a.siteAfter.shutter.durability).toBe(a.shutterWear);
    expect(a.shutterOperationSeconds).toBe(a.shutterWear * 2);
    for (const key of ['lamp', 'cover', 'screen', 'board', 'playerLocation', 'playerMetres', 'operatorId', 'operatorLocation', 'operatorMetres',
      'operatorEnergy', 'operatorConsent', 'operatorConsentWeek', 'spiritId', 'spiritLocation', 'spiritMetres', 'spiritEnergy', 'spiritConsent', 'spiritConsentWeek', 'ordinaryExit'] as const) {
      expect(a.siteAfter[key]).toEqual(a.siteBefore[key]);
    }
    if ('id' in a) {
      playerS -= a.paidCost;
      if (a.fallback === 'SHUTTER_OPEN') expect(a).toMatchObject({ id: GUIDED, paidCost: 0, rolls: [], selfGain: 0, enemyReduction: 0,
        threatens: false, attempted: false, succeeded: false, applied: false, shutterWear: 1, shutterOperationSeconds: 2 });
      if (a.id === GUIDED && a.succeeded) expect(a).toMatchObject({ paidCost: 7, selfGain: 105, applied: true });
      if (a.id === DOMAIN && a.succeeded) expect(a.enemyReduction).toBe(18 * (.65 + .35 * x.domainMastery / 500));
      if (a.id === PURIFICATION && a.succeeded) expect(a.selfGain).toBe(34 * (.65 + .35 * x.purificationMastery / 500));
      if (a.id === LIMITED && a.attempted) {
        expect(a.paidCost).toBe(6); expect(a.chargeGranted).toBe(a.succeeded);
        expect(a.applied).toBe(a.appliedAmount > 0); expect(a.enemyReduction).toBe(a.appliedAmount);
        if (a.chargeConsumedByOrder === null) expect(a.appliedAmount).toBe(0);
        else {
          const consumer = o.enemyActions.find(e => e.order === a.chargeConsumedByOrder)!;
          expect(consumer).toMatchObject({ actual: 'LIGHT_STRIKE', paidCost: 7, consumedLimitedOrder: a.order });
          expect(consumer.order).toBeGreaterThan(a.order); expect(a.appliedAmount).toBe(45);
        }
      }
    } else {
      enemyS -= a.paidCost;
      if (a.actual === 'LIGHT_STRIKE') expect(a).toMatchObject({ paidCost: 7, selfGain: 105, threatens: true });
      if (a.actual === 'SHUTTER_CLOSE') expect(a).toMatchObject({ paidCost: 0, selfGain: 0, threatens: false, shutterChanged: true, shutterWear: 1, shutterOperationSeconds: 2 });
      if (a.actual === 'LIGHT_WARD') {
        expect(a.paidCost).toBe(6); expect(a.chargeGranted).toBe(true); expect(a.enemyReduction).toBe(a.appliedAmount);
        if (a.chargeConsumedByOrder === null) expect(a.appliedAmount).toBe(0);
        else {
          const consumer = o.playerActions.find(p => p.order === a.chargeConsumedByOrder)!;
          expect([GUIDED, PURIFICATION]).toContain(consumer.id); expect(consumer.succeeded).toBe(true);
          expect(consumer.order).toBeGreaterThan(a.order); expect(consumer.consumedWardOrder).toBe(a.order);
          expect(a.appliedAmount).toBe(Math.min(60, consumer.selfGain)); expect(consumer.threatens).toBe(consumer.selfGain > a.appliedAmount);
        }
      }
    }
    expect(a.playerSpiritualityAfter).toBe(playerS); expect(a.enemySpiritualityAfter).toBe(enemyS);
    expect(a.randomCursorAfter - a.randomCursorBefore).toBe(a.rolls.length); site = a.siteAfter;
  }
  expect(o.playerActions.filter(a => a.id === LIMITED && a.attempted).length).toBeLessThanOrEqual(1);
  expect(o.playerActions.filter(a => a.fallback === 'SHUTTER_OPEN').length).toBeLessThanOrEqual(1);
  for (const id of ['LIGHT_STRIKE', 'LIGHT_WARD', 'SHUTTER_CLOSE'] as const) {
    const uses = o.enemyActions.filter(a => a.actual === id).length;
    expect(o.powerUses[id]).toBe(x.powerUses[id] + uses);
    if (id !== 'LIGHT_STRIKE') expect(uses).toBeLessThanOrEqual(1);
  }
  expect(o.expiredLimitedChargeOrder).toBe(o.playerActions.find(a => a.chargeGranted && a.chargeConsumedByOrder === null)?.order ?? null);
  expect(o.expiredWardChargeOrder).toBe(o.enemyActions.find(a => a.chargeGranted && a.chargeConsumedByOrder === null)?.order ?? null);
  const expectedSite = structuredClone(site), leaves = !o.continuing && o.playerHealthAfter > 0;
  expectedSite.elapsedSeconds = x.site.elapsedSeconds + (leaves ? 62 : 60);
  expectedSite.light = { mode: 'OFF', expiresAt: null };
  if (leaves) { expectedSite.playerLocation = 'ENTRY'; expectedSite.playerMetres += 2; }
  expect(o.siteAfter).toEqual(expectedSite); expect(after.lightSeeker.life.site).toEqual(o.siteAfter);
  expect(o.elapsedSeconds).toBe(leaves ? 62 : 60);
  const core = x.physique * .35 + x.perception * .25 + x.will * .25 + x.knowledge * .15;
  expect(round.playerAdvantage).toBe(Math.max(125, baseAdvantage(core, x.playerHealth, x.playerMind, x.playerSpirituality, 1250, 120) + sum(o.playerActions, 'selfGain') - sum(o.enemyActions, 'enemyReduction')));
  expect(round.enemyAdvantage).toBe(Math.max(125, baseAdvantage(24, x.enemyHealth, x.enemyMind, x.enemySpirituality, 1250, 120) + sum(o.enemyActions, 'selfGain') - sum(o.playerActions, 'enemyReduction')));
  expect(round.winChance).toBe(round.playerAdvantage / (round.playerAdvantage + round.enemyAdvantage) * 100);
  if (round.consequenceWeights) expect(round.consequenceWeights).toEqual(consequenceWeights(round.winner === 'PLAYER' ? o.enemyRiskAfter : o.playerRiskAfter));
  expect(after.random).toEqual({ seed: before.random.seed, cursor: o.randomCursorAfter });
  expect(after.progression.mastery).toEqual(before.progression.mastery); expect(after.combatHistory.slice(0, -1)).toEqual(before.combatHistory);
  for (const key of sunLegacyKeys) expect(after[key]).toEqual(before[key]);
}

describe('LightSeeker actual wheels and explicitly directed slot-only rules', () => {
  it('uses the shared1–6 count wheel, actual player/enemy slots, and inherited5:4 stance weighting', () => {
    expect(LIGHT_SEEKER_COUNT_WHEEL.map(x => x.weight)).toEqual([10, 15, 25, 25, 15, 10]);
    expect(LIGHT_SEEKER_ENEMY_COUNT_WHEEL).toEqual(LIGHT_SEEKER_COUNT_WHEEL);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [75, 4], [76, 5], [90, 5], [91, 6], [100, 6]]) {
      expect(lightSeekerActionCount(roll!)).toBe(count); expect(lightSeekerEnemyActionCount(roll!)).toBe(count);
    }
    const neutral = lightSeekerAbilityWheel(original, null);
    expect(neutral.map(a => a.id)).toEqual([GUIDED, LIMITED, DOMAIN, PURIFICATION, 'EVADE', 'ACCIDENT']);
    expect(neutral.map(a => a.weight)).toEqual([25, 20, 15, 20, 15, 5]);
    expect(LIGHT_SEEKER_ENEMY_ABILITY_WHEEL.map(a => [a.id, a.weight])).toEqual([
      ['LIGHT_STRIKE', 35], ['LIGHT_WARD', 25], ['BODY_STRIKE', 20], ['SHUTTER_CLOSE', 15], ['ACCIDENT', 5],
    ]);
    const stances = ['ATTACK', 'CONTROL', 'DEFEND', 'CONTROL', 'PREPARE', null];
    for (const stance of ['ATTACK', 'CONTROL', 'DEFEND', 'PREPARE', 'RETREAT'] as const) {
      const weights = neutral.map((a, i) => a.weight * (stances[i] === stance ? 5 : 4)), total = weights.reduce((a, b) => a + b, 0);
      expect(lightSeekerAbilityWheel(original, stance).map(a => a.weight)).toEqual(weights.map(w => w / total * 100));
    }
  });
  it('draws each real inclusive ability boundary once, without hidden extra draws', () => {
    let edge = 0;
    for (const a of lightSeekerAbilityWheel(original, null)) {
      const first = edge + 1; edge += a.weight * 4; const random = scripted(original, [first, edge]);
      expect(drawLightSeekerAbility(random, original, null)).toBe(a.id); expect(drawLightSeekerAbility(random, original, null)).toBe(a.id);
      expect(random.cursor - original.random.cursor).toBe(2);
    }
    edge = 0;
    for (const a of LIGHT_SEEKER_ENEMY_ABILITY_WHEEL) {
      const first = edge + 1; edge += a.weight; const random = scripted(original, [first, edge]);
      expect(drawLightSeekerEnemyAbility(random)).toBe(a.id); expect(drawLightSeekerEnemyAbility(random)).toBe(a.id);
      expect(random.cursor - original.random.cursor).toBe(2);
    }
  });
  it('closed-shutter guided fallback opens the original once:1 wear and2 seconds included in its5-second slot, no attack/SP/RNG', () => {
    const u = scenario(), site = structuredClone(u.state.lightSeeker.life.site), spirituality = u.state.spirituality;
    expect(u.player(GUIDED)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(u.round.playerActions[0]).toMatchObject({ fallback: 'SHUTTER_OPEN', paidCost: 0, attempted: false, succeeded: false,
      applied: false, rolls: [], shutterWear: 1, shutterOperationSeconds: 2, elapsedSeconds: 5 });
    expect(u.state.lightSeeker.life.site.shutter).toEqual({ ...site.shutter, state: 'OPEN', durability: site.shutter.durability - 1, operations: site.shutter.operations + 1 });
    expect(u.state.lightSeeker.life.site.elapsedSeconds).toBe(site.elapsedSeconds + 5);
    expect(u.state.spirituality).toBe(spirituality); expect(u.random.cursor).toBe(original.random.cursor);
    expect(u.state.lightSeeker.life.site.playerLocation).toBe('NEAR'); expect(u.state.lightSeeker.life.site.ordinaryExit).toBe('OPEN');
    u.enemy('SHUTTER_CLOSE'); u.player(GUIDED); u.enemy('SHUTTER_CLOSE'); u.player(PURIFICATION);
    expect(u.round.playerActions.map(a => a.fallback)).toEqual(['SHUTTER_OPEN', 'OBSERVE', 'OBSERVE']);
    expect(u.round.enemyActions.map(a => a.actual)).toEqual(['SHUTTER_CLOSE', 'OBSERVE']);
    expect(u.state.lightSeeker.life.site.shutter.operations).toBe(site.shutter.operations + 2);
    expect(u.state.lightSeeker.life.site.elapsedSeconds).toBe(site.elapsedSeconds + 25);
    expect(u.state.lightSeeker.encounter.enemySpirituality).toBe(120); expect(u.random.cursor).toBe(original.random.cursor);
  });
  it('an operation that exhausts the original shutter breaks it and never repairs or opens a new light path', () => {
    const u = scenario([], s => { Object.assign(s.lightSeeker.life.site.shutter, { state: 'CLOSED', durability: 1, operations: 99 }); });
    u.player(GUIDED); u.player(GUIDED); u.enemy('LIGHT_STRIKE'); u.enemy('SHUTTER_CLOSE');
    expect(u.state.lightSeeker.life.site.shutter).toMatchObject({ id: 'LS2-SHUTTER', state: 'BROKEN', durability: 0, operations: 100 });
    expect(u.round.playerActions.map(a => a.shutterWear)).toEqual([1, 0]);
    expect(u.round.enemyActions.map(a => a.actual)).toEqual(['BODY_STRIKE', 'OBSERVE']);
    expect(u.round.playerActions.every(a => a.paidCost === 0 && a.selfGain === 0 && a.rolls.length === 0)).toBe(true);
    expect(u.state.lightSeeker.life.site.ordinaryExit).toBe('OPEN'); expect(u.random.cursor).toBe(original.random.cursor);
  });
  it('guided success pays7 and gives105 on a clear line, without mastery scaling, direct health damage, healing or permanent light', () => {
    for (const mastery of [0, 250, 500]) {
      const u = scenario([1], s => { openLine(s); s.progression.mastery[GUIDED] = mastery; });
      const before = structuredClone(u.state), source = structuredClone(u.round.source);
      expect(u.player(GUIDED)).toMatchObject({ selfGain: 105, enemyReduction: 0, threatens: true });
      expect(u.round.playerActions[0]).toMatchObject({ paidCost: 7, attempted: true, succeeded: true, applied: true, rolls: [1], elapsedSeconds: 5 });
      expect(u.state.spirituality).toBe(before.spirituality - 7); expect(u.state.health).toBe(before.health);
      expect(u.state.combat!.enemyHealth).toBe(before.combat!.enemyHealth); expect(u.state.lightSeeker.encounter.enemySpirituality).toBe(120);
      expect(u.state.lightSeeker.life.site.light).toEqual({ mode: 'OFF', expiresAt: null });
      expect(u.state.lightSeeker.life.site.shutter).toEqual(before.lightSeeker.life.site.shutter);
      expect(u.state.progression.mastery).toEqual(before.progression.mastery); expect(u.round.source).toEqual(source);
    }
  });
  it('a paid6 successful limited-light setup initially reduces0 and waits through club blows for exactly one subsequent real light strike', () => {
    const u = scenario([1], openLine), spirituality = u.state.spirituality;
    expect(u.player(LIMITED)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    const pending = structuredClone(u.round.playerActions[0]!);
    expect(pending).toMatchObject({ paidCost: 6, attempted: true, succeeded: true, chargeGranted: true,
      applied: false, appliedAmount: 0, enemyReduction: 0, chargeConsumedByOrder: null });
    u.enemy('BODY_STRIKE'); expect(u.round.playerActions[0]).toEqual(pending);
    expect(u.round.enemyActions[0]).toMatchObject({ actual: 'BODY_STRIKE', selfGain: 20, paidCost: 0, consumedLimitedOrder: null, threatens: true });
    u.enemy('LIGHT_STRIKE');
    expect(u.round.playerActions[0]).toMatchObject({ applied: true, appliedAmount: 45, enemyReduction: 45, chargeConsumedByOrder: 2 });
    expect(u.round.enemyActions[1]).toMatchObject({ paidCost: 7, selfGain: 105, threatens: true, consumedLimitedOrder: 0 });
    u.enemy('LIGHT_STRIKE');
    expect(u.round.enemyActions[2]).toMatchObject({ paidCost: 7, selfGain: 105, consumedLimitedOrder: null });
    expect(u.state.spirituality).toBe(spirituality - 6); expect(u.state.lightSeeker.encounter.enemySpirituality).toBe(106);
    expect(u.random.cursor - original.random.cursor).toBe(1); expect(pending.enemyReduction).toBe(0);
  });
  it('limited-light cannot retroactively resist a previous strike, cannot stop a blocked-line club fallback and cannot be retried after success', () => {
    const u = scenario([1]); u.enemy('LIGHT_STRIKE'); u.player(LIMITED); u.enemy('LIGHT_STRIKE'); u.player(LIMITED);
    expect(u.round.enemyActions.every(a => a.actual === 'BODY_STRIKE' && a.consumedLimitedOrder === null && a.paidCost === 0)).toBe(true);
    expect(u.round.playerActions[0]).toMatchObject({ paidCost: 6, chargeGranted: true, applied: false, appliedAmount: 0, chargeConsumedByOrder: null });
    expect(u.round.playerActions[1]).toMatchObject({ fallback: 'EVADE', paidCost: 0, enemyReduction: 10, attempted: false, rolls: [] });
    expect(u.round.runtime.limited?.order).toBe(1); expect(u.random.cursor - original.random.cursor).toBe(1);
  });
  it('a failed limited-light attempt still costs6, prevents another check this round and never grants a pending charge', () => {
    const u = scenario([100], openLine), spirituality = u.state.spirituality;
    u.player(LIMITED); u.player(LIMITED); u.enemy('LIGHT_STRIKE');
    expect(u.round.playerActions[0]).toMatchObject({ paidCost: 6, attempted: true, succeeded: false, applied: false, chargeGranted: false, rolls: [100] });
    expect(u.round.playerActions[1]).toMatchObject({ paidCost: 0, attempted: false, fallback: 'EVADE', rolls: [], enemyReduction: 10 });
    expect(u.round.enemyActions[0]!.consumedLimitedOrder).toBeNull(); expect(u.round.runtime.limited).toBeNull();
    expect(u.state.spirituality).toBe(spirituality - 6); expect(u.random.cursor - original.random.cursor).toBe(1);
  });
  it('enemy ward pays6 once, remains pending through a failed spell, fully blocks low-power purification and does not grow another charge', () => {
    const u = scenario([100, 1, 1], openLine); u.enemy('LIGHT_WARD');
    const pending = structuredClone(u.round.enemyActions[0]!);
    expect(pending).toMatchObject({ actual: 'LIGHT_WARD', paidCost: 6, chargeGranted: true, enemyReduction: 0, appliedAmount: 0, chargeConsumedByOrder: null });
    u.player(GUIDED); expect(u.round.enemyActions[0]).toEqual(pending);
    const purified = u.player(PURIFICATION), amount = 34 * (.65 + .35 * u.round.source.purificationMastery / 500);
    expect(purified).toMatchObject({ selfGain: amount, threatens: false });
    expect(u.round.enemyActions[0]).toMatchObject({ enemyReduction: amount, appliedAmount: amount, chargeConsumedByOrder: 2 });
    expect(u.round.playerActions[1]).toMatchObject({ paidCost: 6, succeeded: true, consumedWardOrder: 0, threatens: false });
    u.enemy('LIGHT_WARD'); expect(u.round.enemyActions[1]).toMatchObject({ actual: 'OBSERVE', paidCost: 0, chargeGranted: false });
    expect(u.player(GUIDED)).toMatchObject({ selfGain: 105, threatens: true });
    expect(u.round.playerActions[2]!.consumedWardOrder).toBeNull(); expect(u.state.lightSeeker.encounter.enemySpirituality).toBe(114);
  });
  it('enemy ward ignores domain/ordinary evasion, caps a guided block at60 and only blocks its first successful light action', () => {
    const u = scenario([1, 1, 1], openLine); u.enemy('LIGHT_WARD'); u.player(DOMAIN); u.player('EVADE'); u.enemy('LIGHT_WARD');
    expect(u.round.enemyActions[0]).toMatchObject({ enemyReduction: 0, chargeConsumedByOrder: null });
    expect(u.round.enemyActions[1]).toMatchObject({ actual: 'OBSERVE', paidCost: 0 });
    expect(u.player(GUIDED)).toMatchObject({ selfGain: 105, threatens: true });
    expect(u.round.enemyActions[0]).toMatchObject({ enemyReduction: 60, appliedAmount: 60, chargeConsumedByOrder: 4 });
    u.player(GUIDED); expect(u.round.playerActions[3]!.consumedWardOrder).toBeNull();
    expect(u.state.lightSeeker.encounter.enemySpirituality).toBe(114); expect(u.round.runtime.ward).toBeNull();
  });
  it('both unused successful preparations expire at the round boundary without refund or invented applied amount', () => {
    const u = scenario([1], openLine), spirituality = u.state.spirituality; u.player(LIMITED); u.enemy('LIGHT_WARD');
    const o = finishLightSeekerCombatRound(u.state, u.round, true, u.random.cursor);
    expect(o).toMatchObject({ expiredLimitedChargeOrder: 0, expiredWardChargeOrder: 1, playerSpiritualityAfter: spirituality - 6, enemySpirituality: 114, elapsedSeconds: 60 });
    expect(o.playerActions[0]).toMatchObject({ applied: false, appliedAmount: 0, enemyReduction: 0 });
    expect(o.enemyActions[0]).toMatchObject({ appliedAmount: 0, enemyReduction: 0 });
    expect(u.state.spirituality).toBe(spirituality - 6); expect(u.state.lightSeeker.encounter.enemySpirituality).toBe(114);
    // This isolated context did not draw counts, selected abilities or a winner; it is not a complete replay.
    expect(validateLightSeekerRoundOutcome(o)).toBe(false);
  });
  it('inherited domain/purification use only their own original mastery, with costs5/6 and no evil-human multiplier', () => {
    for (const mastery of [0, 250, 500]) {
      const u = scenario([1, 1], s => { openLine(s); s.progression.mastery[GUIDED] = mastery; s.progression.mastery[LIMITED] = 500 - mastery; });
      expect(u.round.source.domainMastery).toBe(original.progression.mastery[DOMAIN]);
      expect(u.round.source.purificationMastery).toBe(original.progression.mastery[PURIFICATION]);
      expect(u.player(DOMAIN).enemyReduction).toBe(18 * (.65 + .35 * u.round.source.domainMastery / 500));
      expect(u.player(PURIFICATION).selfGain).toBe(34 * (.65 + .35 * u.round.source.purificationMastery / 500));
      expect(u.round.playerActions.map(a => a.paidCost)).toEqual([5, 6]);
    }
    const changed = scenario([1, 1], s => { openLine(s); s.progression.mastery[DOMAIN] = 500; s.progression.mastery[PURIFICATION] = 0; });
    expect(changed.player(DOMAIN).enemyReduction).toBe(18); expect(changed.player(PURIFICATION).selfGain).toBe(34 * .65);
  });
  it('all four failed paid checks retain7/6/5/6 costs and make no second attack, light, repair, charge or mastery award', () => {
    const u = scenario([100, 100, 100, 100], openLine), before = structuredClone(u.state);
    for (const id of [GUIDED, LIMITED, DOMAIN, PURIFICATION] as const) expect(u.player(id)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(u.state.spirituality).toBe(before.spirituality - 24); expect(u.random.cursor - original.random.cursor).toBe(4);
    expect(u.round.playerActions.map(a => a.paidCost)).toEqual([7, 6, 5, 6]);
    expect(u.round.playerActions.every(a => a.attempted && !a.succeeded && !a.applied && !a.chargeGranted && a.fallback === 'NONE')).toBe(true);
    expect(u.state.lightSeeker.life.site.shutter).toEqual(before.lightSeeker.life.site.shutter);
    expect(u.state.progression.mastery).toEqual(before.progression.mastery);
  });
  it('insufficient player spirituality uses ordinary held-club/body, evasion or observation without overdraft or extra RNG', () => {
    for (const held of [false, true]) {
      const u = scenario([], s => { openLine(s); s.spirituality = 3; s.town.clubLocation = held ? 'HAND' : 'SHOP'; });
      expect(u.player(GUIDED).selfGain).toBe((held ? 16 : 12) * (1 - statusPenalty(u.round.source.playerHealth, 100)));
      expect(u.player(LIMITED).enemyReduction).toBe(10); expect(u.player(DOMAIN).enemyReduction).toBe(10); expect(u.player(PURIFICATION).selfGain).toBe(0);
      expect(u.round.playerActions.map(a => a.fallback)).toEqual(['STRIKE', 'EVADE', 'EVADE', 'OBSERVE']);
      expect(u.round.playerActions.every(a => a.paidCost === 0 && !a.attempted && a.rolls.length === 0)).toBe(true);
      expect(u.state.spirituality).toBe(3); expect(u.random.cursor).toBe(original.random.cursor);
    }
  });
  it('actual low enemy pool cannot refill or borrow player spirituality, and all unaffordable powers use only its ordinary body', () => {
    const b = lightSeekerBoundaryForIntent(i => i.type === 'COMBAT_ROUND',
      b => b.beforeLast.combat?.encounterId === 'LIGHT_SEEKER_DISPUTE' && b.beforeLast.lightSeeker.encounter.enemySpirituality < 6);
    const u = scenario([], openLine, b.beforeLast), spirituality = u.state.spirituality, enemyS = u.state.lightSeeker.encounter.enemySpirituality;
    u.enemy('LIGHT_STRIKE'); u.enemy('LIGHT_WARD');
    expect(u.round.enemyActions.every(a => a.actual === 'BODY_STRIKE' && a.paidCost === 0 && a.rolls.length === 0)).toBe(true);
    expect(u.state.lightSeeker.encounter.enemySpirituality).toBe(enemyS); expect(u.state.spirituality).toBe(spirituality);
    expect(u.random.cursor).toBe(b.beforeLast.random.cursor);
  });
  it('rejects wrong source/target/weapon, wrong physical factors and out-of-band site mutation without draws or action', () => {
    const u = scenario([1]), source = structuredClone(u.round.source), before = structuredClone(u.state), cursor = u.random.cursor;
    for (const bad of [null, { ...source, targetId: 'JM3-CORWIN' }, { ...source, enemyWeapon: 'UD4-EDMUND-CLUB' }, { ...source, round: 99 }]) {
      expect(resolveLightSeekerCombatAbility(u.state, GUIDED, 1 - statusPenalty(source.playerHealth, 100), u.random, u.round, bad as LightSeekerCombatSource | null).selfGain).toBe(0);
      expect(u.state).toEqual(before);
    }
    expect(resolveLightSeekerCombatAbility(u.state, GUIDED, .5, u.random, u.round).selfGain).toBe(0);
    expect(resolveLightSeekerEnemyAbility(u.state, 'LIGHT_STRIKE', .5, u.random, u.round).selfGain).toBe(0);
    expect(u.random.cursor).toBe(cursor); expect(u.round.playerActions).toHaveLength(0); expect(u.round.enemyActions).toHaveLength(0);
    u.state.lightSeeker.life.site.lamp.oil--; const changed = structuredClone(u.state);
    expect(u.player(LIMITED).enemyReduction).toBe(0); expect(u.state).toEqual(changed); expect(u.random.cursor).toBe(cursor);
    expect(() => finishLightSeekerCombatRound(u.state, u.round, true, u.random.cursor)).toThrow();
  });
  it('caps each actor at six real5-second slots and returns detached outcomes, without treating isolated slots as full replay', () => {
    const u = scenario(); for (let i = 0; i < 6; i++) { u.player('EVADE'); u.enemy('ACCIDENT'); }
    const before = structuredClone(u.state); expect(u.player(GUIDED).selfGain).toBe(0); expect(u.enemy('LIGHT_STRIKE').selfGain).toBe(0); expect(u.state).toEqual(before);
    expect(u.round.playerActions).toHaveLength(6); expect(u.round.enemyActions).toHaveLength(6);
    const o = finishLightSeekerCombatRound(u.state, u.round, true, u.random.cursor);
    expect(o.elapsedSeconds).toBe(60); expect(o.siteAfter.elapsedSeconds).toBe(u.round.source.site.elapsedSeconds + 60);
    expect(validateLightSeekerRoundOutcome(o)).toBe(false); o.siteAfter.lamp.oil--;
    expect(lightSeekerRoundOutcome(u.round).siteAfter.lamp.oil).toBe(original.lightSeeker.life.site.lamp.oil);
    expect(() => finishLightSeekerCombatRound(u.state, u.round)).toThrow();
  });
  it('DIRECTED finish-only corpse/survival branches preserve objects and costs; a corpse staysNEAR while a survivor walks2m/2s', () => {
    for (const alive of [false, true]) {
      const u = scenario([1]); u.player(GUIDED); u.player(LIMITED);
      const paid = u.state.spirituality, site = structuredClone(u.state.lightSeeker.life.site);
      // The corpse input is an isolated finish boundary, not a fabricated natural death or complete round.
      if (!alive) u.state.health = 0;
      const o = finishLightSeekerCombatRound(u.state, u.round, false, u.random.cursor);
      expect(o.siteAfter).toEqual({ ...site, light: { mode: 'OFF', expiresAt: null },
        elapsedSeconds: u.round.source.site.elapsedSeconds + (alive ? 62 : 60),
        playerLocation: alive ? 'ENTRY' : 'NEAR', playerMetres: site.playerMetres + (alive ? 2 : 0) });
      expect(o.playerSpiritualityAfter).toBe(paid); expect(u.state.spirituality).toBe(paid);
      expect(o.expiredLimitedChargeOrder).toBe(1); expect(o.playerActions[1]).toMatchObject({ applied: false, appliedAmount: 0, paidCost: 6 });
      expect(u.state.lightSeeker.encounter).toMatchObject({ enemyLocation: 'OTHER', enemyMetres: 0, enemyHealth: 100, weaponLocation: 'HAND' });
      expect(validateLightSeekerRoundOutcome(o)).toBe(false);
    }
  });
});

describe('LightSeeker actual complete public rounds and original shared-site continuity', () => {
  it('imports the exact closed life site, clears Mara9m/9s/2energy and enters2m/2s without resetting any original resource', () => {
    const b = lightSeekerBoundaryForIntent(i => i.type === 'LIGHT_SEEKER' && i.command.type === 'ENCOUNTER_TALK');
    const start = b.beforeLast.lightSeeker.life.site, live = b.final.lightSeeker.life.site;
    expect(b.final.lightSeeker.encounter.startSite).toEqual(start); expect(live).toEqual(lightSeekerApproachedSite(start, b.final.week));
    for (const key of ['shutter', 'lamp', 'cover', 'screen', 'board', 'spiritLocation', 'spiritMetres', 'spiritEnergy'] as const) expect(live[key]).toEqual(start[key]);
    expect(live).toMatchObject({ operatorLocation: 'SIDE', operatorMetres: start.operatorMetres + 9, operatorEnergy: start.operatorEnergy - 2,
      operatorConsent: 'GRANTED', operatorConsentWeek: b.final.week, playerLocation: 'NEAR', playerMetres: start.playerMetres + 2, elapsedSeconds: start.elapsedSeconds + 11 });
    expect(original.lightSeeker.life.site).toEqual(live); expect(original.lightSeeker.encounter.startSite).toEqual(start);
    expect(currentLightSeekerCombatSource(original)).toEqual(original.lightSeeker.encounter.startSource);
    expect(original.lightSeeker.encounter.startSource).toMatchObject({ targetId: 'LS2-OWEN', targetAge: 51, targetSequence: 2, targetCore: 24,
      actualOriginalBody: true, independentMind: true, enemyWeapon: 'LS2-OWEN-CLUB', weaponLocation: 'HAND', enemyHealth: 100, enemyMind: 100,
      enemySpirituality: 120, thirdPartiesInArea: 0, automaticAllyImmunity: false, ordinaryExit: true, pursuit: false, distanceMetres: 2 });
    expect(validateLightSeekerLife(original)).toBe(true); expect(validateLightSeekerEncounter(original)).toBe(true); assertValidSliceState(original);
  });
  it('replays every actual recorded stance with the original seed/cursor and proves exact ordered actions, costs, injuries and continuing-only player+12', () => {
    expect(naturalRounds.length).toBeGreaterThan(0); let state = original;
    for (const [index, expected] of naturalRounds.entries()) {
      const before = state, frozen = structuredClone(state);
      expect(currentLightSeekerCombatSource(before)).toEqual(outcome(expected).source);
      state = applySliceIntent(state, { type: 'COMBAT_ROUND', stance: expected.stance });
      expect(before).toEqual(frozen); expect(state.combatHistory.at(-1)).toEqual(expected);
      expect(validateLightSeekerRoundOutcome(outcome(expected))).toBe(true); expect(validateLightSeekerCombatRound(expected)).toBe(true);
      expect(validateLightSeekerEncounter(state)).toBe(true); expect(validateLightSeekerLife(state)).toBe(true); assertValidSliceState(state);
      accounting(before, state, expected);
      if (outcome(expected).continuing) {
        expect(state.lightSeeker.encounter.enemySpirituality).toBe(outcome(expected).enemySpirituality);
        expect(currentLightSeekerCombatSource(state)).toEqual(outcome(naturalRounds[index + 1]!).source);
      }
    }
    expect(state).toEqual(terminal); expect(terminal.lightSeeker.encounter.terminal!.historyIndex).toBe(terminal.combatHistory.length - 1);
    expect(terminal.lightSeeker.encounter.terminal!.round).toBe(naturalRounds.length);
    expect(naturalRounds.some(r => outcome(r).continuing && outcome(r).playerSpiritualityAfter < 108)).toBe(true);
  });
  it('actual paid limited-light evidence distinguishes failed, pending-at-expiry and later-consumed45 charges', () => {
    const applied = naturalRounds.flatMap(r => outcome(r).playerActions.filter(a => a.id === LIMITED && a.appliedAmount > 0).map(a => ({ round: r, action: a })));
    expect(applied.length).toBeGreaterThan(0);
    for (const { round, action } of applied) {
      expect(action).toMatchObject({ paidCost: 6, attempted: true, succeeded: true, chargeGranted: true, applied: true, appliedAmount: 45, enemyReduction: 45 });
      const consumer = outcome(round).enemyActions.find(a => a.order === action.chargeConsumedByOrder)!;
      expect(consumer).toMatchObject({ actual: 'LIGHT_STRIKE', paidCost: 7, consumedLimitedOrder: action.order }); expect(consumer.order).toBeGreaterThan(action.order);
    }
    const unspent = naturalRounds.flatMap(r => outcome(r).playerActions.filter(a => a.id === LIMITED && a.chargeGranted && a.chargeConsumedByOrder === null));
    expect(unspent.length).toBeGreaterThan(0); expect(unspent.every(a => a.paidCost === 6 && a.appliedAmount === 0 && !a.applied && a.enemyReduction === 0)).toBe(true);
    const failed = naturalRounds.find(r => outcome(r).playerActions.some(a => a.id === LIMITED && a.attempted && !a.succeeded)
      && outcome(r).playerActions.filter(a => a.id === LIMITED).length > 1)!;
    expect(failed).toBeDefined(); const attempts = outcome(failed).playerActions.filter(a => a.id === LIMITED);
    expect(attempts.filter(a => a.attempted)).toHaveLength(1); expect(attempts.reduce((n, a) => n + a.paidCost, 0)).toBe(6);
    expect(attempts.slice(1).every(a => a.fallback === 'EVADE' && a.rolls.length === 0)).toBe(true);
  });
  it('actual enemy wards fully block ordinary-human purification, so those otherwise winning rounds create no injury or injury roll', () => {
    const protectedRounds = naturalRounds.filter(r => outcome(r).enemyActions.some(a => a.actual === 'LIGHT_WARD' && a.appliedAmount > 0 && a.appliedAmount < 60));
    expect(protectedRounds.length).toBeGreaterThan(0);
    for (const round of protectedRounds) {
      const o = outcome(round), ward = o.enemyActions.find(a => a.actual === 'LIGHT_WARD' && a.appliedAmount > 0)!;
      const attack = o.playerActions.find(a => a.order === ward.chargeConsumedByOrder)!;
      expect(attack).toMatchObject({ id: PURIFICATION, succeeded: true, threatens: false, consumedWardOrder: ward.order });
      expect(ward.appliedAmount).toBe(attack.selfGain); expect(ward.enemyReduction).toBe(attack.selfGain);
      if (round.winner === 'PLAYER' && o.playerActions.every(a => !a.threatens)) {
        expect(round.consequenceRoll).toBeUndefined(); expect(round.consequenceWeights).toBeNull();
        expect(o.enemyHealth).toBe(o.source.enemyHealth); expect(o.enemyInjuriesAfter).toEqual(o.source.enemyInjuries);
      }
    }
  });
  it('keeps the actual terminal body/weapon, original objects, wounds and ordinary2m exit instead of resetting the encounter', () => {
    const last = naturalRounds.at(-1)!, o = outcome(last), e = terminal.lightSeeker.encounter, site = terminal.lightSeeker.life.site;
    expect(o.continuing).toBe(false); expect(terminal.combat).toBeNull(); expect(currentLightSeekerCombatSource(terminal)).toBeNull();
    expect(e).toMatchObject({ targetId: 'LS2-OWEN', enemyLocation: 'OTHER', enemyMetres: 0, enemyHealth: o.enemyHealth,
      enemySpirituality: o.enemySpirituality, enemyInjuries: o.enemyInjuriesAfter, enemyRisk: o.enemyRiskAfter });
    expect(e.weaponLocation).toBe(o.enemyStatus === 'RESISTING' ? 'HAND' : 'OTHER');
    expect(terminal.spirituality).toBe(o.playerSpiritualityAfter); expect(terminal.injuries).toEqual(o.playerInjuriesAfter);
    expect(site.light).toEqual({ mode: 'OFF', expiresAt: null }); expect(site).toMatchObject({ operatorLocation: 'SIDE', spiritLocation: 'SIDE', ordinaryExit: 'OPEN' });
    expect(site.shutter.durability).toBe(o.siteAfter.shutter.durability);
    expect(site.playerLocation).toBe(o.playerHealthAfter > 0 ? 'ENTRY' : 'NEAR');
    expect(site.playerMetres).toBe(o.source.site.playerMetres + (o.playerHealthAfter > 0 ? 2 : 0));
    expect(o.elapsedSeconds).toBe(o.playerHealthAfter > 0 ? 62 : 60);
    for (const key of ['lamp', 'screen', 'cover', 'board', 'operatorEnergy', 'spiritEnergy', 'operatorMetres', 'spiritMetres'] as const) expect(site[key]).toEqual(original.lightSeeker.life.site[key]);
    for (const type of ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'] as const) rejectCt(terminal, { type });
    const frozen = structuredClone(terminal); expect(() => applySliceIntent(terminal, { type: 'COMBAT_ROUND', stance: 'ATTACK' })).toThrow(); expect(terminal).toEqual(frozen);
    for (const key of sunLegacyKeys) expect(terminal[key]).toEqual(original[key]);
    // These are the same old surviving people, not new opponents with reused identities.
    expect(terminal.justiceMentor.encounter).toEqual(original.justiceMentor.encounter);
    expect(terminal.unshadowed.encounter).toEqual(original.unshadowed.encounter);
  });
  it('publishes the actual source wheels, same original site and paid ordered actions without drawing, mutating or exposing shared references', () => {
    const frozen = structuredClone(terminal), view = projectLightSeekerCombat(terminal), o = outcome(naturalRounds.at(-1)!);
    expect(view.enemySpirituality).toBe(terminal.lightSeeker.encounter.enemySpirituality); expect(view.playerSpirituality).toBe(terminal.spirituality);
    expect(view.site).toEqual(terminal.lightSeeker.life.site); expect(view.startSite).toEqual(terminal.lightSeeker.encounter.startSite);
    expect(view.lastActionSequence).toEqual([...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' }))].sort((a, b) => a.order - b.order));
    expect(view.enemyCountWheel).toEqual(LIGHT_SEEKER_ENEMY_COUNT_WHEEL); expect(view.enemyAbilityWheel).toEqual(LIGHT_SEEKER_ENEMY_ABILITY_WHEEL);
    const publicCombat = projectSliceState(original).combat!;
    expect(publicCombat.enemyCountWheel).toEqual(LIGHT_SEEKER_ENEMY_COUNT_WHEEL);
    expect(publicCombat.enemyAbilityWheel).toEqual(LIGHT_SEEKER_ENEMY_ABILITY_WHEEL.map(a => ({ ...a, label: playerText(a.label) })));
    view.site!.lamp.oil--; view.startSite!.shutter.durability--; view.lastActionSequence[0]!.paidCost++;
    expect(terminal).toEqual(frozen);
  });
});

describe('LightSeeker strict complete-RNG replay and shared-site provenance', () => {
  it('rejects changed source, paid cost, ordered actions, charge provenance, clocks, objects and cursor even with plausible totals', () => {
    const actual = naturalRounds.find(r => outcome(r).playerActions.some(a => a.appliedAmount === 45))!;
    expect(actual).toBeDefined();
    const changes: [string, (o: LightSeekerRoundOutcome) => void][] = [
      ['old opponent', o => { o.source.targetId = 'JM3-CORWIN' as never; }],
      ['old weapon', o => { o.source.enemyWeapon = 'UD4-EDMUND-CLUB' as never; }],
      ['body substitution', o => { o.source.actualOriginalBody = false as never; }],
      ['automatic ally immunity', o => { o.source.automaticAllyImmunity = true as never; }],
      ['enemy core', o => { o.source.targetCore = 25 as never; }],
      ['enemy age', o => { o.source.targetAge = 46 as never; }],
      ['distance', o => { o.source.distanceMetres = 6 as never; }],
      ['unexplained source oil', o => { o.source.site.lamp.oil--; }],
      ['different seed', o => { o.source.randomSeed += '-tampered'; }],
      ['source cursor', o => { o.source.randomCursor++; }],
      ['output cursor', o => { o.randomCursorAfter++; }],
      ['output target', o => { o.targetId = 'JM3-CORWIN' as never; }],
      ['player refund', o => { o.playerSpiritualityAfter++; }],
      ['enemy refill', o => { o.enemySpirituality++; }],
      ['slot cost', o => { firstAction(o).paidCost++; }],
      ['slot cost with both pools changed', o => { firstAction(o).paidCost++; o.playerSpiritualityAfter--; o.enemySpirituality--; }],
      ['extra check', o => { firstAction(o).rolls.push(1); }],
      ['slot cursor', o => { firstAction(o).randomCursorAfter++; }],
      ['slot order', o => { firstAction(o).order++; }],
      ['slot time', o => { firstAction(o).atSeconds++; }],
      ['slot duration', o => { firstAction(o).elapsedSeconds = 7 as never; }],
      ['slot advantage', o => { firstAction(o).selfGain++; }],
      ['slot threatened', o => { firstAction(o).threatens = !firstAction(o).threatens; }],
      ['slot physical factor', o => { firstAction(o).physicalFactor = .5; }],
      ['invented text', o => { firstAction(o).label += ' Free healing'; }],
      ['slot source site', o => { firstAction(o).siteBefore.playerMetres++; }],
      ['slot result site', o => { firstAction(o).siteAfter.playerMetres++; }],
      ['paid charge erased', o => { o.playerActions.find(a => a.appliedAmount === 45)!.chargeGranted = false; }],
      ['charge consumed before setup', o => { const a = o.playerActions.find(a => a.appliedAmount === 45)!; a.chargeConsumedByOrder = a.order - 1; }],
      ['charge has no actual consumer', o => { o.playerActions.find(a => a.appliedAmount === 45)!.chargeConsumedByOrder = null; }],
      ['applied amount changed', o => { o.playerActions.find(a => a.appliedAmount === 45)!.appliedAmount = 60; }],
      ['applied amount and advantage changed together', o => { const a = o.playerActions.find(a => a.appliedAmount === 45)!; a.appliedAmount = 60; a.enemyReduction = 60; }],
      ['consumer link erased', o => { o.enemyActions.find(a => a.consumedLimitedOrder !== null)!.consumedLimitedOrder = null; }],
      ['consumed charge also expires', o => { o.expiredLimitedChargeOrder = o.playerActions.find(a => a.appliedAmount === 45)!.order; }],
      ['attempt reset', o => { o.limitedAttempted = false; }],
      ['invented power use', o => { o.powerUses.LIGHT_WARD++; }],
      ['valid-shape shutter repair', o => { o.siteAfter.shutter.operations--; o.siteAfter.shutter.durability++; }],
      ['oil creation', o => { o.siteAfter.lamp.oil++; }],
      ['unexplained valid-shape screen repair', o => { o.siteAfter.screen.inspections--; o.siteAfter.screen.durability++; }],
      ['board transfer', o => { o.siteAfter.board.owner = 'PLAYER'; o.siteAfter.board.location = 'PLAYER'; }],
      ['player teleport', o => { o.siteAfter.playerLocation = 'ENTRY'; }],
      ['operator teleport', o => { o.siteAfter.operatorLocation = 'ENTRY'; }],
      ['elapsed time', o => { o.elapsedSeconds = o.elapsedSeconds === 60 ? 62 : 60; }],
      ['continuation', o => { o.continuing = !o.continuing; }],
      ['unexplained healing', o => { o.playerHealthAfter++; }],
      ['extra charge field', o => { (o as unknown as Record<string, unknown>).nextRoundCharge = 45; }],
    ];
    for (const [name, change] of changes) {
      const r = structuredClone(actual), o = outcome(r); expect(validateLightSeekerCombatRound(r), name).toBe(true); change(o);
      expect(validateLightSeekerRoundOutcome(o), name).toBe(false); expect(validateLightSeekerCombatRound(r), name).toBe(false);
    }
  });
  it('rejects enemy ward amount/consumer forgery including a false threat on fully blocked purification', () => {
    const actual = naturalRounds.find(r => outcome(r).enemyActions.some(a => a.actual === 'LIGHT_WARD' && a.appliedAmount > 0))!;
    expect(actual).toBeDefined();
    const changes: ((o: LightSeekerRoundOutcome) => void)[] = [
      o => { o.enemyActions.find(a => a.appliedAmount > 0)!.paidCost = 0; },
      o => { o.enemyActions.find(a => a.appliedAmount > 0)!.chargeGranted = false; },
      o => { o.enemyActions.find(a => a.appliedAmount > 0)!.appliedAmount = 60; },
      o => { o.enemyActions.find(a => a.appliedAmount > 0)!.chargeConsumedByOrder = null; },
      o => { const a = o.playerActions.find(a => a.consumedWardOrder !== null)!; a.consumedWardOrder = null; },
      o => { o.playerActions.find(a => a.consumedWardOrder !== null)!.threatens = true; },
      o => { o.expiredWardChargeOrder = o.enemyActions.find(a => a.appliedAmount > 0)!.order; },
    ];
    for (const [index, change] of changes.entries()) {
      const r = structuredClone(actual); change(outcome(r));
      expect(validateLightSeekerRoundOutcome(outcome(r)), `ward forgery ${index}`).toBe(false); expect(validateLightSeekerCombatRound(r)).toBe(false);
    }
  });
  it('rejects public round and consequence tampering even while the nested deterministic outcome remains genuine', () => {
    for (const field of ['consequence', 'moves', 'winner', 'playerAdvantage', 'enemyAdvantage', 'winChance', 'playerCount', 'enemyCount', 'playerCountRoll', 'enemyCountRoll', 'first', 'consequenceRoll', 'retreat'] as const) {
      const r = structuredClone(naturalRounds[0]!);
      switch (field) {
        case 'consequence': r.consequence += ' Undocumented effect'; break;
        case 'moves': r.moves[0]!.label += ' Undocumented action'; break;
        case 'winner': r.winner = r.winner === 'PLAYER' ? 'ENEMY' : 'PLAYER'; break;
        case 'first': r.first = r.first === 'PLAYER' ? 'ENEMY' : 'PLAYER'; break;
        case 'consequenceRoll': r.consequenceRoll = r.consequenceRoll === 100 ? 1 : 100; break;
        case 'retreat': r.retreat = r.retreat === 'SUCCESS' ? 'NONE' : 'SUCCESS'; break;
        default: r[field]++; break;
      }
      expect(validateLightSeekerRoundOutcome(outcome(r)), field).toBe(true); expect(validateLightSeekerCombatRound(r), field).toBe(false);
    }
    const r = structuredClone(naturalRounds[0]!); r.consequenceWeights = { light: 100, heavy: 0, death: 0 };
    expect(validateLightSeekerRoundOutcome(outcome(r))).toBe(true); expect(validateLightSeekerCombatRound(r)).toBe(false);
  });
  it('proves immutable approach input against life history and final site against all original rounds, rejecting plausible repairs/refills', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.lightSeeker.encounter.startSite!.shutter.operations--; s.lightSeeker.encounter.startSite!.shutter.durability++; },
      s => { s.lightSeeker.encounter.startSite!.lamp.oil--; },
      s => { s.lightSeeker.encounter.startSource!.domainMastery++; },
      s => { s.lightSeeker.encounter.startSource!.randomCursor++; },
      s => { s.lightSeeker.encounter.startSource!.site.operatorConsentWeek = s.lightSeeker.encounter.startSource!.site.operatorConsentWeek! - 1; },
      s => { s.lightSeeker.life.site.shutter.operations--; s.lightSeeker.life.site.shutter.durability++; },
      s => { s.lightSeeker.life.site.operatorLocation = 'ENTRY'; },
      s => { s.lightSeeker.life.site.playerMetres++; },
      s => { s.lightSeeker.encounter.enemySpirituality++; },
      s => { s.lightSeeker.encounter.weaponLocation = s.lightSeeker.encounter.weaponLocation === 'HAND' ? 'OTHER' : 'HAND'; },
      s => { s.lightSeeker.encounter.terminal!.historyIndex--; },
      s => { s.lightSeeker.encounter.terminal!.outcome = s.lightSeeker.encounter.terminal!.outcome === 'PLAYER_DEAD' ? 'RETREATED' : 'PLAYER_DEAD'; },
      s => { s.combatHistory.push(structuredClone(s.combatHistory.at(-1)!)); },
    ];
    for (const [index, change] of changes.entries()) {
      const s = structuredClone(terminal); change(s);
      expect(validateLightSeekerLife(s) && validateLightSeekerEncounter(s), `provenance forgery ${index}`).toBe(false);
      expect(() => assertValidSliceState(s), `provenance forgery ${index}`).toThrow();
    }
  });
});
