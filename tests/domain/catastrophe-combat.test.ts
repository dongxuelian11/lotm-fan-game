import { playerText } from '../../src/shared/player-text.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { baseAdvantage, consequenceWeights, statusPenalty } from '../../src/domain/slice/combat.js';
import type { SliceState, SliceCombatRound } from '../../src/domain/slice/types.js';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import {
  CATASTROPHE_COUNT_WHEEL, CATASTROPHE_ENEMY_COUNT_WHEEL, CATASTROPHE_ENEMY_ABILITY_WHEEL,
  catastropheActionCount, catastropheEnemyActionCount, catastropheAbilityWheel, drawCatastropheAbility, drawCatastropheEnemyAbility,
  currentCatastropheCombatSource, beginCatastropheCombatRound, resolveCatastropheCombatAbility, resolveCatastropheEnemyAbility,
  finishCatastropheCombatRound, catastropheRoundOutcome, projectCatastropheCombat,
  validateCatastropheRoundOutcome, validateCatastropheCombatRound,
  type CatastropheCombatSource, type CatastropheMoveId, type CatastropheRoundOutcome,
} from '../../src/domain/catastrophe/combat.js';
import { validateCatastropheEncounter, catastropheApproachedSite } from '../../src/domain/catastrophe/encounter.js';
import { validateCatastropheLife } from '../../src/domain/catastrophe/life.js';
import { validateCatastropheSiteState } from '../../src/domain/catastrophe/resources.js';
import { catastropheBoundary, catastropheSnapshot, tyrantLegacyKeys, rejectCt } from './catastrophe-helper.js';

const STORM = 'tyrant.s2.storm-field', PRESSURE = 'tyrant.s2.water-pressure';
const WIND = 'tyrant.s6.wind-control', LIGHTNING = 'tyrant.s4.great-lightning';
let original: SliceState, terminal: SliceState, naturalRounds: SliceCombatRound[];
beforeAll(() => {
  original = catastropheSnapshot('combatStart'); terminal = catastropheBoundary('combat-terminal').final;
  const e = terminal.catastrophe.encounter; naturalRounds = terminal.combatHistory.slice(e.startHistoryIndex!, e.terminal!.historyIndex + 1);
});
function scripted(s: SliceState, values: number[] = []): ActionRandomStream {
  let index = 0, cursor = s.random.cursor;
  return { seed: s.random.seed, get cursor() { return cursor; }, nextInt(min, max) {
    const value = values[index++]; if (value === undefined || !Number.isInteger(value) || value < min || value > max) throw new Error(`Unexpected isolated slot draw ${index}: ${value}`);
    cursor++; return value;
  } };
}
/** DIRECTED SLOT-ONLY units. Starting from the actual living combat entry, isolated resource
 * or skill inputs and scripted checks exercise local rules only. They are never saved as
 * natural captures or asserted to be complete deterministic combat/encounter histories. */
function scenario(checks: number[] = [], change?: (s: SliceState) => void) {
  const state = structuredClone(original); change?.(state);
  const random = scripted(state, checks), round = beginCatastropheCombatRound(state, 'ATTACK', random);
  return { state, random, round,
    player: (id: CatastropheMoveId) => resolveCatastropheCombatAbility(state, id, 1 - statusPenalty(round.source.playerHealth, 100), random, round),
    enemy: (id: Parameters<typeof resolveCatastropheEnemyAbility>[1]) => resolveCatastropheEnemyAbility(state, id, 1 - statusPenalty(round.source.enemyHealth, 100), random, round),
  };
}
const openWater = (s: SliceState, units = 4) => {
  const p = s.catastrophe.life.site; p.gate.position = 'OPEN'; p.gate.operations++; p.gate.durability--;
  p.water.bayUnits = 20 - units; p.water.channelUnits = units;
};
function outcome(r: SliceCombatRound): CatastropheRoundOutcome { if (!r.catastropheOutcome) throw new Error('Missing genuine recorded Catastrophe outcome'); return r.catastropheOutcome; }
const sum = (xs: { selfGain: number; enemyReduction: number }[], key: 'selfGain' | 'enemyReduction') => xs.reduce((n, a) => n + a[key], 0);
function accounting(before: SliceState, after: SliceState, round: SliceCombatRound) {
  const o = outcome(round), x = o.source, ordered = [...o.playerActions, ...o.enemyActions].sort((a, b) => a.order - b.order);
  expect(o.playerSpiritualityAfter).toBe(x.playerSpirituality - o.playerActions.reduce((n, a) => n + a.paidCost, 0));
  expect(o.enemySpirituality).toBe(x.enemySpirituality - o.enemyActions.reduce((n, a) => n + a.paidCost, 0));
  expect(after.spirituality).toBe(o.continuing ? Math.min(120, o.playerSpiritualityAfter + 12) : o.playerSpiritualityAfter);
  expect(after.catastrophe.encounter.enemySpirituality).toBe(o.enemySpirituality);
  expect(o.enemySpirituality).toBe(120 - o.powerUses.STORM * 7 - o.powerUses.PRESSURE * 6);
  let playerS = x.playerSpirituality, enemyS = x.enemySpirituality, site = x.site;
  for (const [index, a] of ordered.entries()) {
    expect(a.order).toBe(index); expect(a.atSeconds).toBe(x.site.clockSeconds + index * 5); expect(a.elapsedSeconds).toBe(5);
    expect(a.siteBefore).toEqual(site); expect(a.siteAfter.clockSeconds).toBe(a.siteBefore.clockSeconds + 5);
    expect(validateCatastropheSiteState(a.siteAfter)).toBe(true);
    expect(a.siteAfter.water.bayUnits + a.siteAfter.water.channelUnits).toBe(20);
    expect(a.siteAfter.water.channelUnits - a.siteBefore.water.channelUnits).toBe(a.admittedUnits - a.dischargedUnits);
    expect(a.siteAfter.water.bayUnits - a.siteBefore.water.bayUnits).toBe(a.dischargedUnits - a.admittedUnits);
    expect(a.siteBefore.gate.durability - a.siteAfter.gate.durability).toBe(a.gateOperationSeconds / 2);
    expect(a.siteAfter.gate.operations - a.siteBefore.gate.operations).toBe(a.gateOperationSeconds / 2);
    expect(a.siteBefore.mooring.durability - a.siteAfter.mooring.durability).toBe(a.mooringWear);
    expect(a.siteAfter.keeper).toEqual(a.siteBefore.keeper); expect(a.siteAfter.wheel).toEqual(a.siteBefore.wheel); expect(a.siteAfter.winch).toEqual(a.siteBefore.winch);
    if ('id' in a) {
      playerS -= a.paidCost;
      if (a.id === PRESSURE && a.fallback === 'GATE_PREPARATION') expect(a).toMatchObject({ paidCost: 0, rolls: [], attempted: false, succeeded: false, applied: false, enemyReduction: 10 });
      if (a.id === STORM && a.succeeded) expect(a).toMatchObject({ paidCost: 7, selfGain: 75, applied: true, mooringWear: 1 });
      if (a.id === PRESSURE && a.succeeded) expect(a).toMatchObject({ paidCost: 6, enemyReduction: 45, applied: true, dischargedUnits: 1, waterTransferSeconds: 3 });
      if (a.id === WIND && a.succeeded) expect(a.enemyReduction).toBe(18 * (.65 + .35 * x.windMastery / 500));
      if (a.id === LIGHTNING && a.succeeded) expect(a.selfGain).toBe(38 * (.65 + .35 * x.lightningMastery / 500));
    } else {
      enemyS -= a.paidCost;
      if (a.actual === 'STORM') expect(a).toMatchObject({ paidCost: 7, selfGain: 105, mooringWear: 1 });
      if (a.actual === 'PRESSURE') expect(a).toMatchObject({ paidCost: 6, enemyReduction: 60, dischargedUnits: 1 });
      if (a.actual === 'GATE') expect(a).toMatchObject({ paidCost: 0, selfGain: 0, gateChanged: true, gateOperationSeconds: 2 });
    }
    expect(a.playerSpiritualityAfter).toBe(playerS); expect(a.enemySpiritualityAfter).toBe(enemyS);
    expect(a.randomCursorAfter - a.randomCursorBefore).toBe(a.rolls.length); site = a.siteAfter;
  }
  expect(o.enemyActions.filter(a => a.actual === 'GATE').length).toBeLessThanOrEqual(1);
  for (const id of ['STORM', 'PRESSURE', 'GATE'] as const) expect(o.powerUses[id]).toBe(x.powerUses[id] + o.enemyActions.filter(a => a.actual === id).length);
  const expectedSite = structuredClone(site), leaves = !o.continuing && o.playerHealthAfter > 0;
  expectedSite.clockSeconds = x.site.clockSeconds + (leaves ? 62 : 60);
  if (leaves) { expectedSite.playerPosition = 'EXIT'; expectedSite.playerTravelMetres += 2; }
  expect(o.siteAfter).toEqual(expectedSite); expect(after.catastrophe.life.site).toEqual(o.siteAfter); expect(o.elapsedSeconds).toBe(leaves ? 62 : 60);
  const core = x.physique * .35 + x.perception * .25 + x.will * .25 + x.knowledge * .15;
  expect(round.playerAdvantage).toBe(Math.max(125, baseAdvantage(core, x.playerHealth, x.playerMind, x.playerSpirituality, 1250, 120) + sum(o.playerActions, 'selfGain') - sum(o.enemyActions, 'enemyReduction')));
  expect(round.enemyAdvantage).toBe(Math.max(125, baseAdvantage(24, x.enemyHealth, x.enemyMind, x.enemySpirituality, 1250, 120) + sum(o.enemyActions, 'selfGain') - sum(o.playerActions, 'enemyReduction')));
  expect(round.winChance).toBe(round.playerAdvantage / (round.playerAdvantage + round.enemyAdvantage) * 100);
  if (round.consequenceWeights) expect(round.consequenceWeights).toEqual(consequenceWeights(round.winner === 'PLAYER' ? o.enemyRiskAfter : o.playerRiskAfter));
  expect(after.random).toEqual({ seed: before.random.seed, cursor: o.randomCursorAfter });
  expect(after.progression.mastery).toEqual(before.progression.mastery); expect(after.combatHistory.slice(0, -1)).toEqual(before.combatHistory);
  for (const key of tyrantLegacyKeys) expect(after[key]).toEqual(before[key]);
}

describe('Catastrophe current actual wheels and bounded isolated combat slots', () => {
  it('uses actual1–6 count constants, player25/20/15/20/15/5, enemy35/25/20/15/5 and the inherited5:4 stance convention', () => {
    expect(CATASTROPHE_COUNT_WHEEL.map(x => x.weight)).toEqual([10, 15, 25, 25, 15, 10]); expect(CATASTROPHE_ENEMY_COUNT_WHEEL).toEqual(CATASTROPHE_COUNT_WHEEL);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [75, 4], [76, 5], [90, 5], [91, 6], [100, 6]]) {
      expect(catastropheActionCount(roll!)).toBe(count); expect(catastropheEnemyActionCount(roll!)).toBe(count);
    }
    const neutral = catastropheAbilityWheel(original, null); expect(neutral.map(x => x.id)).toEqual([STORM, PRESSURE, WIND, LIGHTNING, 'EVADE', 'ACCIDENT']);
    expect(neutral.map(x => x.weight)).toEqual([25, 20, 15, 20, 15, 5]);
    expect(CATASTROPHE_ENEMY_ABILITY_WHEEL.map(x => [x.id, x.weight])).toEqual([['STORM', 35], ['PRESSURE', 25], ['BODY_STRIKE', 20], ['GATE', 15], ['ACCIDENT', 5]]);
    const stances = ['ATTACK', 'CONTROL', 'DEFEND', 'CONTROL', 'PREPARE', null];
    for (const stance of ['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const weights = neutral.map((x, i) => x.weight * (stances[i] === stance ? 5 : 4)), total = weights.reduce((n, x) => n + x, 0);
      expect(catastropheAbilityWheel(original, stance).map(x => x.weight)).toEqual(weights.map(x => x / total * 100));
    }
  });
  it('draws the real inclusive published boundaries exactly once per selected slot', () => {
    let edge = 0;
    for (const item of catastropheAbilityWheel(original, null)) {
      const first = edge + 1; edge += item.weight * 4; const random = scripted(original, [first, edge]);
      expect(drawCatastropheAbility(random, original, null)).toBe(item.id); expect(drawCatastropheAbility(random, original, null)).toBe(item.id); expect(random.cursor - original.random.cursor).toBe(2);
    }
    edge = 0;
    for (const item of CATASTROPHE_ENEMY_ABILITY_WHEEL) {
      const first = edge + 1; edge += item.weight; const random = scripted(original, [first, edge]);
      expect(drawCatastropheEnemyAbility(random)).toBe(item.id); expect(drawCatastropheEnemyAbility(random)).toBe(item.id); expect(random.cursor - original.random.cursor).toBe(2);
    }
  });
  it('successful new storm pays7S, adds75, wears the original mooring once and never directly damages or refills people', () => {
    for (const m of [0, 250, 500]) {
      const u = scenario([1], s => { s.progression.mastery[STORM] = m; }), prior = u.state.spirituality, site = structuredClone(u.state.catastrophe.life.site), health = u.state.health;
      expect(u.player(STORM)).toMatchObject({ selfGain: 75, enemyReduction: 0, threatens: true });
      expect(u.state.spirituality).toBe(prior - 7); expect(u.state.catastrophe.encounter.enemySpirituality).toBe(120);
      expect(u.state.health).toBe(health); expect(u.state.combat!.enemyHealth).toBe(100);
      expect(u.state.catastrophe.life.site.mooring.durability).toBe(site.mooring.durability - 1); expect(u.state.catastrophe.life.site.water).toEqual(site.water);
      expect(u.round.playerActions[0]).toMatchObject({ paidCost: 7, rolls: [1], attempted: true, succeeded: true, applied: true, mooringWear: 1, elapsedSeconds: 5 });
    }
  });
  it('old wind and lightning use their own original mastery8/25 and never either new mastery entry', () => {
    expect(original.progression.mastery[WIND]).toBe(8); expect(original.progression.mastery[LIGHTNING]).toBe(25);
    for (const m of [0, 250, 500]) {
      const u = scenario([1, 1], s => { s.progression.mastery[STORM] = m; s.progression.mastery[PRESSURE] = 500 - m; });
      expect(u.round.source).toMatchObject({ windMastery: 8, lightningMastery: 25 });
      expect(u.player(WIND).enemyReduction).toBe(18 * (.65 + .35 * 8 / 500)); expect(u.player(LIGHTNING).selfGain).toBe(38 * (.65 + .35 * 25 / 500));
      expect(u.round.playerActions.map(a => a.paidCost)).toEqual([4, 6]);
    }
    const changedOld = scenario([1, 1], s => { s.progression.mastery[WIND] = 500; s.progression.mastery[LIGHTNING] = 0; });
    expect(changedOld.player(WIND).enemyReduction).toBe(18); expect(changedOld.player(LIGHTNING).selfGain).toBe(38 * .65);
  });
  it('a closed empty pressure slot only pays actual ordinary gate/water preparation, and the next paid success discharges one unit', () => {
    const u = scenario([1]), prior = u.state.spirituality, site = structuredClone(u.state.catastrophe.life.site), cursor = u.random.cursor;
    expect(u.player(PRESSURE)).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
    expect(u.random.cursor).toBe(cursor); expect(u.state.spirituality).toBe(prior);
    expect(u.round.playerActions[0]).toMatchObject({ fallback: 'GATE_PREPARATION', attempted: false, succeeded: false, applied: false, paidCost: 0,
      gateOperationSeconds: 2, waterTransferSeconds: 3, admittedUnits: 4, rolls: [], elapsedSeconds: 5 });
    expect(u.state.catastrophe.life.site).toMatchObject({ water: { bayUnits: 16, channelUnits: 4 }, gate: { position: 'OPEN', durability: site.gate.durability - 1 } });
    expect(u.player(PRESSURE).enemyReduction).toBe(45); expect(u.state.spirituality).toBe(prior - 6);
    expect(u.state.catastrophe.life.site.water).toMatchObject({ bayUnits: 17, channelUnits: 3 }); expect(u.round.playerActions[1]).toMatchObject({ paidCost: 6, dischargedUnits: 1, waterTransferSeconds: 3, applied: true });
  });
  it('ordinary pressure preparation preserves existing channel water, never repairs a broken gate and never re-draws', () => {
    const existing = scenario([], s => { s.catastrophe.life.site.water.bayUnits = 18; s.catastrophe.life.site.water.channelUnits = 2; });
    existing.player(PRESSURE); expect(existing.state.catastrophe.life.site.water).toMatchObject({ bayUnits: 18, channelUnits: 2 }); expect(existing.round.playerActions[0]!.admittedUnits).toBe(0);
    const broken = scenario([], s => { Object.assign(s.catastrophe.life.site.gate, { position: 'BROKEN', durability: 0, operations: 100 }); });
    const gate = structuredClone(broken.state.catastrophe.life.site.gate); broken.player(PRESSURE);
    expect(broken.state.catastrophe.life.site.gate).toEqual(gate); expect(broken.state.catastrophe.life.site.water).toMatchObject({ bayUnits: 20, channelUnits: 0 });
    expect(broken.round.playerActions[0]).toMatchObject({ paidCost: 0, admittedUnits: 0, gateOperationSeconds: 0, attempted: false }); expect(broken.random.cursor).toBe(original.random.cursor);
  });
  it('all four failed paid checks retain exactly7/6/4/6S and cannot gain effects, repair wear or run a second fallback', () => {
    const u = scenario([100, 100, 100, 100], openWater), site = structuredClone(u.state.catastrophe.life.site), prior = u.state.spirituality;
    for (const id of [STORM, PRESSURE, WIND, LIGHTNING] as const) expect(u.player(id)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(u.state.spirituality).toBe(prior - 23); expect(u.random.cursor - original.random.cursor).toBe(4);
    expect(u.round.playerActions.map(a => a.paidCost)).toEqual([7, 6, 4, 6]); expect(u.round.playerActions.every(a => a.attempted && !a.succeeded && !a.applied && a.fallback === 'NONE')).toBe(true);
    expect(u.state.catastrophe.life.site.water).toEqual(site.water); expect(u.state.catastrophe.life.site.mooring).toEqual(site.mooring);
  });
  it('insufficient player S uses only the actual HAND club16 or body12, ordinary evade and observation', () => {
    for (const held of [false, true]) {
      const u = scenario([], s => { s.spirituality = 3; s.town.clubLocation = held ? 'HAND' : 'SHOP'; openWater(s); });
      expect(u.player(STORM).selfGain).toBe((held ? 16 : 12) * (1 - statusPenalty(original.health, 100)));
      expect(u.player(PRESSURE).enemyReduction).toBe(10); expect(u.player(WIND).enemyReduction).toBe(10); expect(u.player(LIGHTNING).selfGain).toBe(0);
      expect(u.round.playerActions.map(a => a.fallback)).toEqual(['STRIKE', 'EVADE', 'EVADE', 'OBSERVE']);
      expect(u.round.playerActions.every(a => a.paidCost === 0 && !a.attempted && a.rolls.length === 0)).toBe(true); expect(u.state.spirituality).toBe(3);
    }
  });
  it('missing original bay water or exhausted mooring produces only ordinary storm fallback', () => {
    for (const change of [(s: SliceState) => { s.catastrophe.life.site.water.bayUnits = 0; s.catastrophe.life.site.water.channelUnits = 20; },
      (s: SliceState) => { s.catastrophe.life.site.mooring.durability = 0; }]) {
      const u = scenario([], change), before = u.state.spirituality; u.player(STORM); u.enemy('STORM');
      expect(u.round.playerActions[0]).toMatchObject({ fallback: 'STRIKE', attempted: false, paidCost: 0 });
      expect(u.round.enemyActions[0]).toMatchObject({ actual: 'BODY_STRIKE', paidCost: 0 }); expect(u.state.spirituality).toBe(before); expect(u.state.catastrophe.encounter.enemySpirituality).toBe(120);
    }
  });
  it('enemy pays only its own actual7/6S, while one ordinary gate toggle consumes a real slot and preserves original water', () => {
    const u = scenario(), prior = u.state.spirituality; u.enemy('GATE'); u.enemy('PRESSURE'); u.enemy('STORM');
    expect(u.state.catastrophe.encounter.enemySpirituality).toBe(107); expect(u.state.catastrophe.encounter.powerUses).toEqual({ STORM: 1, PRESSURE: 1, GATE: 1 });
    expect(u.state.spirituality).toBe(prior); expect(u.state.catastrophe.life.site.water).toMatchObject({ bayUnits: 17, channelUnits: 3 });
    expect(u.round.enemyActions.map(a => a.paidCost)).toEqual([0, 6, 7]); expect(u.round.enemyActions.map(a => a.elapsedSeconds)).toEqual([5, 5, 5]);
    const again = u.enemy('GATE'); expect(again.selfGain).toBe(20); expect(u.round.enemyActions[3]).toMatchObject({ actual: 'BODY_STRIKE', gateChanged: false, paidCost: 0 });
  });
  it('enemy close retains all channel water, blocks the next pressure and cannot toggle again during the same round', () => {
    const u = scenario([], openWater), water = structuredClone(u.state.catastrophe.life.site.water); u.enemy('GATE');
    expect(u.state.catastrophe.life.site.gate.position).toBe('CLOSED'); expect(u.state.catastrophe.life.site.water).toEqual(water);
    u.enemy('PRESSURE'); u.enemy('GATE'); expect(u.round.enemyActions.map(a => a.actual)).toEqual(['GATE', 'BODY_STRIKE', 'BODY_STRIKE']);
    expect(u.state.catastrophe.encounter.enemySpirituality).toBe(120); expect(u.state.catastrophe.life.site.water).toEqual(water);
  });
  it('an isolated exhausted enemy source cannot overdraft, steal playerS or automatically recover its original pool', () => {
    const u = scenario([], s => { openWater(s); s.catastrophe.encounter.powerUses = { STORM: 12, PRESSURE: 6, GATE: 0 }; s.catastrophe.encounter.enemySpirituality = 0; });
    // Synthetic prior-spending source is an affordability unit only, never an accepted encounter replay.
    const prior = u.state.spirituality; u.enemy('STORM'); u.enemy('PRESSURE');
    expect(u.round.enemyActions.every(a => a.actual === 'BODY_STRIKE' && a.paidCost === 0)).toBe(true);
    expect(u.state.catastrophe.encounter.enemySpirituality).toBe(0); expect(u.state.spirituality).toBe(prior);
  });
  it('rejects stale/old-target/resource-substituted sources and wrong physical factors with no draw or state change', () => {
    const u = scenario([1]), x = structuredClone(u.round.source), before = structuredClone(u.state), cursor = u.random.cursor;
    for (const bad of [null, { ...x, targetId: 'SK3-QUENTIN' }, { ...x, enemyWeapon: 'CP4-BENEDICT-CLUB' }, { ...x, round: 99 }]) {
      expect(resolveCatastropheCombatAbility(u.state, STORM, 1 - statusPenalty(x.playerHealth, 100), u.random, u.round, bad as CatastropheCombatSource | null).selfGain).toBe(0); expect(u.state).toEqual(before);
    }
    expect(resolveCatastropheCombatAbility(u.state, STORM, .5, u.random, u.round).selfGain).toBe(0); expect(u.random.cursor).toBe(cursor);
    u.state.catastrophe.life.site.water.bayUnits--; u.state.catastrophe.life.site.water.channelUnits++;
    const changed = structuredClone(u.state); expect(u.player(PRESSURE).enemyReduction).toBe(0); expect(u.state).toEqual(changed); expect(u.random.cursor).toBe(cursor);
    expect(() => finishCatastropheCombatRound(u.state, u.round, true, u.random.cursor)).toThrow();
  });
  it('caps each actor at six actual5-second slots and returns detached outcome evidence, without accepting scripted slots as full replay', () => {
    const u = scenario(); for (let i = 0; i < 6; i++) { u.player('EVADE'); u.enemy('ACCIDENT'); }
    const before = structuredClone(u.state); expect(u.player(STORM).selfGain).toBe(0); expect(u.enemy('STORM').selfGain).toBe(0); expect(u.state).toEqual(before);
    expect(u.round.playerActions).toHaveLength(6); expect(u.round.enemyActions).toHaveLength(6);
    const o = finishCatastropheCombatRound(u.state, u.round, true, u.random.cursor); expect(o.elapsedSeconds).toBe(60);
    expect(validateCatastropheRoundOutcome(o)).toBe(false); o.siteAfter.water.bayUnits--; expect(catastropheRoundOutcome(u.round).siteAfter.water.bayUnits).toBe(20);
    expect(() => finishCatastropheCombatRound(u.state, u.round)).toThrow();
  });
});

describe('Catastrophe actual complete public rounds, immutable source chain and original death', () => {
  it('carries the closed life site into combat by real6m keeper clearance and2m player entry without resetting any resource', () => {
    const b = catastropheBoundary('original-enemy-approach'), start = b.beforeLast.catastrophe.life.site, live = b.final.catastrophe.life.site;
    expect(b.final.catastrophe.encounter.startSite).toEqual(start); expect(live).toEqual(catastropheApproachedSite(start));
    for (const key of ['water', 'gate', 'buoy', 'mooring', 'winch', 'wheel'] as const) expect(live[key]).toEqual(start[key]);
    expect(live.keeper).toMatchObject({ position: 'EXIT', travelMetres: start.keeper.travelMetres + 6, energy: start.keeper.energy - 2 });
    expect(live.playerTravelMetres).toBe(start.playerTravelMetres + 2); expect(live.clockSeconds).toBe(start.clockSeconds + 8);
    expect(original.catastrophe.life.site).toEqual(live); expect(original.catastrophe.encounter.startSite).toEqual(start);
    expect(currentCatastropheCombatSource(original)).toEqual(original.catastrophe.encounter.startSource);
    expect(original.catastrophe.encounter.startSource).toMatchObject({ targetId: 'CT2-VALE', targetAge: 47, targetSequence: 2, targetCore: 24,
      actualOriginalBody: true, independentMind: true, enemyWeapon: 'CT2-VALE-CLUB', weaponLocation: 'HAND', enemyHealth: 100, enemyMind: 100,
      enemySpirituality: 120, thirdPartiesInArea: 0, automaticAllyImmunity: false, ordinaryExit: true, pursuit: false, distanceMetres: 2 });
    expect(validateCatastropheLife(original)).toBe(true); expect(validateCatastropheEncounter(original)).toBe(true);
  });
  it('replays every real natural round and accounts for exact costs, shared resources, ordered slots and common injury resolution', () => {
    expect(naturalRounds.length).toBeGreaterThan(0); let state = original;
    for (const expected of naturalRounds) {
      const before = state, frozen = structuredClone(state); state = applySliceIntent(state, { type: 'COMBAT_ROUND', stance: expected.stance });
      expect(before).toEqual(frozen); expect(state.combatHistory.at(-1)).toEqual(expected); expect(validateCatastropheRoundOutcome(outcome(expected))).toBe(true);
      expect(validateCatastropheCombatRound(expected)).toBe(true); expect(validateCatastropheEncounter(state)).toBe(true); expect(validateCatastropheLife(state)).toBe(true);
      assertValidSliceState(state); accounting(before, state, expected);
    }
    expect(state).toEqual(terminal); expect(terminal.catastrophe.encounter.terminal!.historyIndex).toBe(terminal.combatHistory.length - 1);
    expect(terminal.catastrophe.encounter.terminal!.round).toBe(naturalRounds.length);
  });
  it('preserves the actual natural first-round player death, original surviving enemyS108 and unavailable respawn/rest/re-entry', () => {
    const last = naturalRounds.at(-1)!, o = outcome(last); expect(naturalRounds).toHaveLength(1);
    expect(last).toMatchObject({ stance: 'CONTROL', winner: 'ENEMY', consequenceWeights: { light: 65, heavy: 30, death: 5 }, consequenceRoll: 100 });
    expect(terminal).toMatchObject({ status: 'DEAD', health: 0, spirituality: 107, combat: null, ending: { kind: 'DEATH' } });
    expect(terminal.catastrophe.encounter).toMatchObject({ status: 'LOST', enemyHealth: 100, enemyMind: 100, enemySpirituality: 108,
      enemyStatus: 'RESISTING', weaponLocation: 'HAND', terminal: { outcome: 'PLAYER_DEAD', round: 1 } });
    expect(o).toMatchObject({ continuing: false, playerHealthAfter: 0, playerSpiritualityAfter: 107, elapsedSeconds: 60 });
    expect(terminal.catastrophe.life.site.playerPosition).toBe('PLATFORM'); expect(terminal.catastrophe.life.site.keeper.position).toBe('EXIT');
    expect(currentCatastropheCombatSource(terminal)).toBeNull();
    for (const type of ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'] as const) rejectCt(terminal, { type });
    for (const intent of [{ type: 'ACTION', action: 'REST' }, { type: 'COMBAT_ROUND', stance: 'DEFEND' }] as const) {
      const before = structuredClone(terminal); expect(() => applySliceIntent(terminal, intent)).toThrow(); expect(terminal).toEqual(before);
    }
    expect(terminal.cataclysmPriest.encounter.enemy.status).toBe('DEAD'); expect(terminal.seaKing.encounter.enemyStatus).toBe('DEAD');
    expect(terminal.cataclysmPriest).toEqual(original.cataclysmPriest); expect(terminal.seaKing).toEqual(original.seaKing);
  });
  it('publishes actual same-source wheels, enemyS and sorted paid actions, with no draw, second water stock or mutation', () => {
    const before = structuredClone(terminal), view = projectCatastropheCombat(terminal), o = outcome(naturalRounds.at(-1)!);
    expect(view.enemySpirituality).toBe(terminal.catastrophe.encounter.enemySpirituality); expect(view.playerSpirituality).toBe(terminal.spirituality);
    expect(view.site).toEqual(terminal.catastrophe.life.site); expect(view.startSite).toEqual(terminal.catastrophe.encounter.startSite);
    expect(view.lastActionSequence).toEqual([...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' }))].sort((a, b) => a.order - b.order));
    expect(view.enemyCountWheel).toEqual(CATASTROPHE_ENEMY_COUNT_WHEEL); expect(view.enemyAbilityWheel).toEqual(CATASTROPHE_ENEMY_ABILITY_WHEEL);
    const publicCombat = projectSliceState(original).combat!;
    expect(publicCombat.enemyCountWheel).toEqual(CATASTROPHE_ENEMY_COUNT_WHEEL); expect(publicCombat.enemyAbilityWheel).toEqual(CATASTROPHE_ENEMY_ABILITY_WHEEL.map(row => ({ ...row, label: playerText(row.label) })));
    view.site!.water.channelUnits++; view.startSite!.gate.durability--; view.lastActionSequence[0]!.paidCost++; expect(terminal).toEqual(before);
  });
  it('DIRECTED runtime-only cursor branch proves CONTINUE player+12 and a fully replayable next-round source chain without rewriting the natural death', () => {
    // Only this unit advances a test cursor and its matching first-round source. The original
    // seed, physical inputs and CONTROL stance remain fixed. This selects continuation coverage,
    // never a natural outcome or a victory, and is never written into the captured fixtures.
    let input: SliceState | null = null, continued: SliceState | null = null;
    for (let offset = 1; offset <= 100; offset++) {
      const candidate = structuredClone(original); candidate.random.cursor += offset;
      candidate.catastrophe.encounter.startSource!.randomCursor = candidate.random.cursor;
      assertValidSliceState(candidate);
      const next = applySliceIntent(candidate, { type: 'COMBAT_ROUND', stance: 'CONTROL' });
      if (outcome(next.combatHistory.at(-1)!).continuing) { input = candidate; continued = next; break; }
    }
    expect(continued).not.toBeNull(); if (!continued || !input) throw new Error('No directed CONTINUE coverage in the declared test-cursor range');
    const first = continued.combatHistory.at(-1)!, o = outcome(first); accounting(input, continued, first); assertValidSliceState(continued);
    expect(continued.spirituality).toBe(Math.min(120, o.playerSpiritualityAfter + 12)); expect(continued.catastrophe.encounter.enemySpirituality).toBe(o.enemySpirituality);
    const nextSource = currentCatastropheCombatSource(continued)!;
    expect(nextSource).toEqual({ ...structuredClone(o.source), revision: o.source.revision + 1, round: o.round + 1,
      site: o.siteAfter, playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter, playerSpirituality: Math.min(120, o.playerSpiritualityAfter + 12),
      enemyHealth: o.enemyHealth, enemyMind: o.enemyMind, enemySpirituality: o.enemySpirituality,
      playerInjuries: o.playerInjuriesAfter, enemyInjuries: o.enemyInjuriesAfter, playerRisk: o.playerRiskAfter, enemyRisk: o.enemyRiskAfter,
      powerUses: o.powerUses, randomCursor: o.randomCursorAfter });
    const next = applySliceIntent(continued, { type: 'COMBAT_ROUND', stance: 'CONTROL' }), r = next.combatHistory.at(-1)!;
    expect(outcome(r).source).toEqual(nextSource); accounting(continued, next, r); expect(validateCatastropheCombatRound(r)).toBe(true); assertValidSliceState(next);
    const forged = structuredClone(continued); forged.spirituality = (forged.spirituality + 1) % 121;
    expect(validateCatastropheEncounter(forged)).toBe(false); expect(() => assertValidSliceState(forged)).toThrow();
    expect(catastropheSnapshot('final')).toEqual(terminal);
  });
});

function firstAction(o: CatastropheRoundOutcome) {
  const a = [...o.playerActions, ...o.enemyActions].sort((a, b) => a.order - b.order)[0]; if (!a) throw new Error('Expected actual recorded paid/action evidence'); return a;
}
describe('Catastrophe strict complete-RNG replay and immutable shared-site provenance', () => {
  it('rejects result, source, payment, physical-resource, ordering and appended-text forgery', () => {
    const changes: [string, (o: CatastropheRoundOutcome) => void][] = [
      ['old enemy', o => { o.source.targetId = 'SK3-QUENTIN' as never; }], ['old weapon', o => { o.source.enemyWeapon = 'CP4-BENEDICT-CLUB' as never; }],
      ['non-original body', o => { o.source.actualOriginalBody = false as never; }], ['automatic immunity', o => { o.source.automaticAllyImmunity = true as never; }],
      ['enemy core', o => { o.source.targetCore = 25 as never; }], ['enemy age', o => { o.source.targetAge = 46 as never; }],
      ['seed', o => { o.source.randomSeed += '-tampered'; }], ['cursor', o => { o.source.randomCursor++; }],
      ['round output target', o => { o.targetId = 'CP4-BENEDICT' as never; }], ['player refund', o => { o.playerSpiritualityAfter++; }],
      ['enemy refill', o => { o.enemySpirituality++; }], ['enemy free cost', o => { firstAction(o).paidCost++; }],
      ['cost plus pool', o => { firstAction(o).paidCost++; o.playerSpiritualityAfter--; o.enemySpirituality--; }],
      ['changed roll', o => { const a = [...o.playerActions, ...o.enemyActions].find(a => a.rolls.length) ?? firstAction(o); a.rolls[0] = a.rolls[0] === 100 ? 1 : 100; }],
      ['extra roll', o => { firstAction(o).rolls.push(1); }], ['random cursor after', o => { o.randomCursorAfter++; }],
      ['slot order', o => { firstAction(o).order++; }], ['slot start', o => { firstAction(o).atSeconds++; }], ['slot length', o => { firstAction(o).elapsedSeconds = 0 as never; }],
      ['appended action text', o => { firstAction(o).label += ' Free healing'; }], ['slot advantage', o => { firstAction(o).selfGain++; }],
      ['water creation', o => { o.siteAfter.water.bayUnits++; }], ['resource-valid unexplained water move', o => { o.siteAfter.water.bayUnits--; o.siteAfter.water.channelUnits++; }],
      ['resource-valid gate repair', o => { o.siteAfter.gate.operations--; o.siteAfter.gate.durability++; }],
      ['wear removal', o => { o.siteAfter.mooring.durability++; }], ['extra original stock', o => { (o as unknown as Record<string, unknown>).waterReserve = 20; }],
      ['teleport', o => { o.siteAfter.playerPosition = 'EXIT'; }], ['automatic keeper return', o => { o.siteAfter.keeper.position = 'CONTROL'; }],
      ['time', o => { o.elapsedSeconds = 62; }], ['continuation after death', o => { o.continuing = true; }], ['resurrection', o => { o.playerHealthAfter = 100; }],
    ];
    for (const [name, change] of changes) {
      const r = structuredClone(naturalRounds[0]!), o = outcome(r); expect(validateCatastropheCombatRound(r)).toBe(true); change(o);
      expect(validateCatastropheRoundOutcome(o), name).toBe(false); expect(validateCatastropheCombatRound(r), name).toBe(false);
    }
  });
  it('rejects forged public result fields even when the nested full deterministic outcome remains genuine', () => {
    for (const field of ['consequence', 'moves', 'winner', 'playerAdvantage', 'enemyAdvantage', 'winChance', 'playerCount', 'enemyCount', 'first', 'consequenceRoll'] as const) {
      const r = structuredClone(naturalRounds[0]!);
      switch (field) {
        case 'consequence': r.consequence += ' Undocumented effect'; break;
        case 'moves': r.moves[0]!.label += ' Undocumented action'; break;
        case 'winner': r.winner = r.winner === 'PLAYER' ? 'ENEMY' : 'PLAYER'; break;
        case 'first': r.first = r.first === 'PLAYER' ? 'ENEMY' : 'PLAYER'; break;
        case 'consequenceRoll': r.consequenceRoll = r.consequenceRoll === 100 ? 1 : 100; break;
        default: r[field]++; break;
      }
      expect(validateCatastropheRoundOutcome(outcome(r)), field).toBe(true); expect(validateCatastropheCombatRound(r), field).toBe(false);
    }
  });
  it('proves the immutable start snapshot came from the closed life journal and the final shared site from the complete actual fight', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.catastrophe.encounter.startSite!.water.bayUnits--; s.catastrophe.encounter.startSite!.water.channelUnits++; },
      s => { s.catastrophe.encounter.startSite!.gate.operations--; s.catastrophe.encounter.startSite!.gate.durability++; },
      s => { s.catastrophe.encounter.startSource!.windMastery++; },
      s => { s.catastrophe.encounter.startSource!.randomCursor++; },
      s => { s.catastrophe.life.site.water.bayUnits--; s.catastrophe.life.site.water.channelUnits++; },
      s => { s.catastrophe.life.site.keeper.position = 'CONTROL'; },
      s => { s.catastrophe.encounter.enemySpirituality = 120; },
      s => { s.catastrophe.encounter.terminal!.historyIndex--; },
      s => { s.catastrophe.encounter.terminal!.outcome = 'ENEMY_DEAD'; },
      s => { s.combatHistory.push(structuredClone(s.combatHistory.at(-1)!)); },
    ];
    for (const [index, change] of changes.entries()) {
      const s = structuredClone(terminal); change(s);
      expect(validateCatastropheLife(s) && validateCatastropheEncounter(s), `forgery ${index}`).toBe(false);
      expect(() => assertValidSliceState(s), `forgery ${index}`).toThrow();
    }
  });
});
