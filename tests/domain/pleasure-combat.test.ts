import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import {
  PLEASURE_COUNT_WHEEL, consumePleasureSilkBinding, currentPleasureCombatSource, drawPleasureAbility,
  finishPleasureCombatRound, isPleasure, pleasureAbilityWheel, pleasureActionCount,
  releasePleasureSilkBinding, resolvePleasureCombatAbility, type PleasureMoveId, type PleasureCombatSource,
} from '../../src/domain/pleasure/combat.js';
import * as pleasureCombat from '../../src/domain/pleasure/combat.js';
import { ASSASSIN_COUNT_WHEEL, assassinAbilityWheel } from '../../src/domain/assassin/combat.js';
import { INSTIGATOR_COUNT_WHEEL, instigatorAbilityWheel } from '../../src/domain/instigator/combat.js';
import { WITCH_COUNT_WHEEL, resolveWitchCombatAbility, witchAbilityWheel } from '../../src/domain/witch/combat.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';

const H = 'assassin.s7.black-flame', J = 'assassin.s7.frost', B = 'assassin.s7.substitute', K = 'assassin.s6.silk-binding';
const ids = [H, J, B, K, 'OBSERVE', 'ACCIDENT'] as const;
/** Synthetic actual paid arrival for isolated combat rules; public arrival is covered by domain lifecycle tests. */
function fixture(): SliceState {
  const s = createSliceRun('pleasure-combat-test', sliceDefaultCreationSelection, 'pleasure-combat');
  s.activeEvent = null; s.arc.stage = 'ENDED'; s.world.city = 'BACKLUND';
  s.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  s.progression = { pathwayId: 'demoness', sequence: 6, mastery: {}, acting: 0, promotionWeek: 1 };
  s.pleasure.cases['silk-release'].status = 'RESOLVED'; s.pleasure.cases['silk-release'].outcome = 'CORD_TIED';
  s.pleasure.encounter = { status: 'FIGHTING', startHistoryIndex: s.combatHistory.length,
    attemptWeek: s.week, silkPrepared: false, boundRound: null };
  s.combat = { encounterId: 'PLEASURE_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  s.town.clubLocation = 'SHOP'; s.health = 100; s.mind = 100; s.spirituality = 80;
  return s;
}
function fixedRolls(...rolls: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-pleasure-test', get cursor() { return cursor; }, nextInt(minimum, maximum) {
    const value = rolls[cursor++];
    if (value === undefined || value < minimum || value > maximum) throw new Error('Unexpected random draw');
    return value;
  } };
}
function resolve(s: SliceState, id: PleasureMoveId, physical = 1,
  source: PleasureCombatSource | null = currentPleasureCombatSource(s), random = fixedRolls()) {
  return resolvePleasureCombatAbility(s, id, physical, random, source);
}
function scriptRolls(...rolls: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt; let index = 0;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum, maximum,
  ) {
    original.call(this, minimum, maximum);
    const value = rolls[index++];
    if (value === undefined) throw new Error('Unexpected additional random draw');
    expect(value).toBeGreaterThanOrEqual(minimum); expect(value).toBeLessThanOrEqual(maximum);
    return value;
  });
}
function nextRound(s: SliceState): void {
  finishPleasureCombatRound(s, true);
  const r: SliceCombatRound = { round: s.combat!.round, stance: 'PREPARE', first: 'PLAYER',
    playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1, moves: [],
    playerAdvantage: 665, enemyAdvantage: 114, winChance: 80, winner: 'PLAYER',
    consequence: '没有有效致伤行动', consequenceWeights: null, retreat: 'NONE' };
  s.combatHistory.push(r); s.combat!.lastRound = r; s.combat!.round += 1;
}
afterEach(() => vi.restoreAllMocks());

describe('Pleasure S6 exact profile and current source', () => {
  it('routes only demoness6 to six20/15/20/30/8/7 slots and six8/12/20/23/22/15 counts', () => {
    const s = fixture(); expect(isPleasure(s)).toBe(true);
    expect(playerAbilityWheel(s, null)).toEqual(pleasureAbilityWheel(null, s));
    expect(playerAbilityWheel(s, null).map(x => x.id)).toEqual(ids);
    expect(playerAbilityWheel(s, null).map(x => x.weight)).toEqual([20, 15, 20, 30, 8, 7]);
    expect(playerCountWheel(s)).toEqual(PLEASURE_COUNT_WHEEL);
    expect(playerCountWheel(s).map(x => x.weight)).toEqual([8, 12, 20, 23, 22, 15]);
    playerAbilityWheel(s, null)[0]!.weight = 0; playerCountWheel(s)[0]!.weight = 0;
    expect(playerAbilityWheel(s, null)[0]!.weight).toBe(20); expect(playerCountWheel(s)[0]!.weight).toBe(8);
    s.progression.pathwayId = 'warrior'; expect(isPleasure(s)).toBe(false);
  });
  it('keeps precise count boundaries and integer-ticket posture ratios', () => {
    for (const [roll, count] of [[1, 1], [8, 1], [9, 2], [20, 2], [21, 3], [40, 3], [41, 4], [63, 4], [64, 5], [85, 5], [86, 6], [100, 6]]) {
      expect(pleasureActionCount(roll!)).toBe(count);
    }
    for (const [roll, id] of [[1, H], [80, H], [81, J], [140, J], [141, B], [220, B],
      [221, K], [340, K], [341, 'OBSERVE'], [372, 'OBSERVE'], [373, 'ACCIDENT'], [400, 'ACCIDENT']] as const) {
      const r = fixedRolls(roll); expect(drawPleasureAbility(r, null)).toBe(id); expect(r.cursor).toBe(1);
    }
    for (const stance of ['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const boosted = stance === 'ATTACK' ? [0, 1] : stance === 'DEFEND' ? [2] : stance === 'CONTROL' ? [3] : stance === 'PREPARE' ? [4] : [];
      const tickets = [20, 15, 20, 30, 8, 7].map((x, i) => x * (boosted.includes(i) ? 5 : 4));
      const total = tickets.reduce((sum, x) => sum + x, 0);
      pleasureAbilityWheel(stance).forEach((e, i) => expect(e.weight).toBeCloseTo(tickets[i]! / total * 100, 12));
    }
  });
  it('uses core25/30/30/15, tier650/cap130/floor65, max80/recovery8', () => {
    const s = fixture(); s.spirituality = 72;
    s.character.coreStats = { physique: 20, perception: 10, will: 40, knowledge: 30 };
    scriptRolls(1, 1, 221, 400, 1);
    expect(resolveSliceCombatRound(s, 'CONTROL').round.playerAdvantage).toBe(674.5);
    expect(s.spirituality).toBe(80); vi.restoreAllMocks();
    const cap = fixture(); cap.character.coreStats = { physique: 200, perception: 200, will: 200, knowledge: 200 };
    cap.health = 50; cap.mind = 25; cap.spirituality = 8;
    scriptRolls(1, 1, 221, 400, 1);
    expect(resolveSliceCombatRound(cap, 'CONTROL').round.playerAdvantage).toBe(468);
    expect(cap.spirituality).toBe(16); vi.restoreAllMocks();
    vi.spyOn(pleasureCombat, 'resolvePleasureCombatAbility').mockReturnValue({
      label: 'Controlled negative contribution', selfGain: -1000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 221, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'CONTROL').round.playerAdvantage).toBe(65);
  });
  it('requires paid current-week arrival, closed life contact, real history and the ordinary opponent', () => {
    expect(currentPleasureCombatSource(fixture())).toMatchObject({ encounterId: 'PLEASURE_DISPUTE',
      target: 'MALEN_SINGLE_ADULT_ORDINARY_HUMAN', nature: 'ORDINARY_HUMAN', distanceMetres: 2,
      targetPhysique: 14, targetRank: -1, bystanders: 'NONE', spiritualFire: 'NONE', pursuit: false });
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.combat!.encounterId = 'FIRST_CASE'; s.arc.stage = 'COMBAT'; },
      s => { s.progression.sequence = 7; }, s => { s.world.city = 'ELSEWHERE'; },
      s => { s.health = 0; }, s => { s.mind = 0; }, s => { s.combat!.enemyHealth = 0; },
      s => { s.combat!.enemyStatus = 'SURRENDERED'; }, s => { s.pleasure.encounter.status = 'AVAILABLE'; },
      s => { s.pleasure.encounter.attemptWeek = null; }, s => { s.pleasure.encounter.startHistoryIndex = null; },
      s => { s.combat!.round = 2; }, s => { s.pleasure.encounter.boundRound = 2; },
      s => { s.pleasure.cases['silk-release'].contactOpen = true; },
      s => { s.pleasure.cases['fire-break'].status = 'PREPARED'; },
      s => { s.pleasure.cases['silk-release'].status = 'AVAILABLE'; },
      s => { s.pleasure.practice.wrist = 'SILK'; }, s => { s.pleasure.practice.fireSilk = 'ON_FRAME'; },
      s => { s.pleasure.practice.fireSilk = 'BROKEN'; },
    ];
    for (const mutate of mutations) {
      const s = fixture(); mutate(s); const before = structuredClone(s);
      expect(currentPleasureCombatSource(s)).toBeNull(); expect(resolve(s, H).selfGain).toBe(0);
      expect(() => resolveSliceCombatRound(s, 'ATTACK')).toThrow(); expect(s).toEqual(before);
    }
    const s = fixture(); nextRound(s); expect(currentPleasureCombatSource(s)).not.toBeNull();
    s.combatHistory.at(-1)!.retreat = 'SUCCESS'; expect(currentPleasureCombatSource(s)).toBeNull();
  });
  it('rejects all forged source fields and stale source before spending, rolling or item mutations', () => {
    for (const field of Object.keys(currentPleasureCombatSource(fixture())!)) {
      const s = fixture(), source = currentPleasureCombatSource(s)!;
      Object.assign(source, { [field]: 'forged' }); const before = structuredClone(s);
      for (const id of [...ids, 'assassin.s6.charm'] as const) expect(resolve(s, id, 1, source)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(s).toEqual(before);
    }
    const s = fixture(), stale = currentPleasureCombatSource(s); s.revision += 1;
    expect(resolve(s, 'OBSERVE', 1, stale).selfGain).toBe(0); expect(s.spirituality).toBe(80);
  });
});

describe('Inherited abilities use original mastery, club and real Witch inventory', () => {
  it('uses H59.15 and J31.85 in inherited directions with no duplicate mastery or injury from frost', () => {
    const s = fixture(); s.progression.mastery[H] = 500; s.progression.mastery[J] = 250;
    s.progression.mastery['assassin.s9.burst'] = 237; s.progression.mastery['assassin.s8.instigation'] = 123;
    const original = structuredClone(s.progression.mastery);
    expect(resolve(s, H)).toMatchObject({ selfGain: 59.15, enemyReduction: 0, threatens: true });
    const frost = resolve(s, J); expect(frost.selfGain).toBe(0); expect(frost.enemyReduction).toBeCloseTo(31.85 * 0.825); expect(frost.threatens).toBe(false);
    expect(s.spirituality).toBe(76); expect(s.progression.mastery).toEqual(original);
  });
  it('uses a genuinely held original ordinary club as a replacement and never materializes one', () => {
    const s = fixture(); s.town.clubLocation = 'HAND'; const before = structuredClone(s.town);
    expect(resolve(s, H, 0.8)).toMatchObject({ selfGain: 12.8, enemyReduction: 0, threatens: true });
    expect(s.spirituality).toBe(80); expect(s.town).toEqual(before);
    s.town.clubLocation = 'SHOP'; s.spirituality = 1;
    expect(resolve(s, H, 0.8).selfGain).toBeCloseTo(9.6); expect(resolve(s, J, 0.8).enemyReduction).toBeCloseTo(4.8);
    expect(s.spirituality).toBe(1); expect(s.town.clubLocation).toBe('SHOP');
  });
  it('prioritizes actual prepared mirror, then powder, then ordinary guard without inventories copied or invented', () => {
    const s = fixture(); Object.assign(s.witch.tools, { mirrorPrepared: true, mirrorsHeld: 1, mirrorsUsed: 0, powderHeld: 1, powderUsed: 0 });
    s.progression.mastery[B] = 500; s.progression.mastery['assassin.s7.invisibility'] = 500;
    expect(resolve(s, B).enemyReduction).toBe(42.25);
    expect(s.witch.tools).toMatchObject({ mirrorsHeld: 0, mirrorsUsed: 1, mirrorPrepared: false, powderHeld: 1 });
    expect(resolve(s, B).enemyReduction).toBe(21.125);
    expect(s.witch.tools).toMatchObject({ powderHeld: 0, powderUsed: 1 });
    expect(resolve(s, B, 0.8).enemyReduction).toBe(8); expect(s.spirituality).toBe(75);
    Object.assign(s.witch.tools, { mirrorPrepared: false, mirrorsHeld: 2 });
    expect(resolve(s, B).enemyReduction).toBe(10); expect(s.witch.tools.mirrorsHeld).toBe(2);
    Object.assign(s.witch.tools, { mirrorPrepared: true, powderHeld: 1 }); s.spirituality = 2;
    expect(resolve(s, B).enemyReduction).toBe(21.125); expect(s.witch.tools.mirrorsHeld).toBe(2); expect(s.witch.tools.mirrorPrepared).toBe(true);
    expect(s.spirituality).toBe(0);
  });
  it('does not grant charm control, a curse medium or damage from accidents', () => {
    const s = fixture(), before = structuredClone(s);
    expect(resolve(s, 'assassin.s6.charm')).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(resolve(s, 'ACCIDENT', 1, undefined, fixedRolls(1))).toMatchObject({ selfGain: -16.25, threatens: false });
    expect(resolve(s, 'ACCIDENT', 1, undefined, fixedRolls(2))).toMatchObject({ selfGain: 16.25, threatens: false });
    expect(s).toEqual(before);
  });
});

describe('Real silk contact, resisting Q and finite one-action binding', () => {
  it('requires separate real R3 preparation and K3; neither grants simultaneous contribution', () => {
    const s = fixture(); expect(resolve(s, K)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(s.spirituality).toBe(80); expect(s.pleasure.encounter.boundRound).toBeNull();
    expect(resolve(s, 'OBSERVE')).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(s.spirituality).toBe(77); expect(s.pleasure.encounter.silkPrepared).toBe(true);
    resolve(s, 'OBSERVE'); expect(s.spirituality).toBe(77);
    const effect = resolve(s, K, 1, undefined, fixedRolls(1));
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(s.spirituality).toBe(74); expect(s.pleasure.encounter).toMatchObject({ silkPrepared: false, boundRound: 1 });
  });
  it('has bounded real opposition using rank/perception/mastery versus declared physique14', () => {
    for (const [roll, bound] of [[81, 1], [82, null]] as const) {
      const s = fixture(); resolve(s, 'OBSERVE'); const random = fixedRolls(roll);
      expect(resolve(s, K, 1, undefined, random).label).toContain('阈值81.48');
      expect(random.cursor).toBe(1); expect(s.spirituality).toBe(74);
      expect(s.pleasure.encounter).toMatchObject({ silkPrepared: false, boundRound: bound });
    }
    const s = fixture(); s.character.coreStats.perception = 500; s.progression.mastery[K] = 500;
    resolve(s, 'OBSERVE'); expect(resolve(s, K, 1, undefined, fixedRolls(96)).label).toContain('阈值95');
    expect(s.pleasure.encounter.boundRound).toBeNull();
  });
  it('does not spend missing resources, roll a free Q, or consume unaffordable preparation', () => {
    const s = fixture(); s.spirituality = 2; resolve(s, 'OBSERVE');
    expect(s.pleasure.encounter.silkPrepared).toBe(false); expect(s.spirituality).toBe(2);
    s.spirituality = 3; resolve(s, 'OBSERVE'); expect(s.spirituality).toBe(0);
    resolve(s, K); expect(s.pleasure.encounter.silkPrepared).toBe(true); expect(s.pleasure.encounter.boundRound).toBeNull();
  });
  it('refreshes one binding, never stacks, and only consumes the next positive physical action', () => {
    const s = fixture(); resolve(s, 'OBSERVE'); resolve(s, K, 1, undefined, fixedRolls(1));
    resolve(s, 'OBSERVE'); resolve(s, K, 1, undefined, fixedRolls(1));
    expect(s.pleasure.encounter.boundRound).toBe(1); expect(s.spirituality).toBe(68);
    for (const id of ['OPENING', 'BLOCK', 'DISTANCE', 'MISS', 'MENTAL_ATTACK', 'SPIRITUAL_FIRE', 'NONBODY_SPELL']) {
      expect(consumePleasureSilkBinding(s, id, 8)).toBeNull();
    }
    expect(consumePleasureSilkBinding(s, 'STRIKE', 16, true)).toBeNull();
    expect(consumePleasureSilkBinding(s, 'STRIKE', 0)).toBeNull(); expect(consumePleasureSilkBinding(s, 'STRIKE', -1)).toBeNull();
    expect(s.pleasure.encounter.boundRound).toBe(1);
    expect(consumePleasureSilkBinding(s, 'STRIKE', 16)?.physicalMultiplier).toBe(0.5);
    expect(consumePleasureSilkBinding(s, 'STRIKE', 16)).toBeNull(); expect(s.pleasure.encounter.boundRound).toBeNull();
  });
  it('expires untriggered binding at this round end and supports explicit release', () => {
    const s = fixture(); resolve(s, 'OBSERVE'); resolve(s, K, 1, undefined, fixedRolls(1));
    resolve(s, 'OBSERVE'); expect(finishPleasureCombatRound(s, true)).toContain('本回合结束');
    expect(s.pleasure.encounter).toMatchObject({ silkPrepared: true, boundRound: null });
    nextRound(s); expect(consumePleasureSilkBinding(s, 'STRIKE', 16)).toBeNull();
    expect(releasePleasureSilkBinding(s)).toContain('实际解除');
    expect(s.pleasure.encounter).toMatchObject({ silkPrepared: false, boundRound: null });
    expect(s.spirituality).toBe(71);
  });
  it('does not fabricate spiritual fire or a drowsy opponent to remove a real connection', () => {
    const s = fixture(); resolve(s, 'OBSERVE'); resolve(s, K, 1, undefined, fixedRolls(1));
    const forged = { ...currentPleasureCombatSource(s)!, spiritualFire: 'INVENTED_FIRE' } as unknown as PleasureCombatSource;
    expect(resolve(s, H, 1, forged).selfGain).toBe(0); expect(s.pleasure.encounter.boundRound).toBe(1);
    expect(currentPleasureCombatSource(s)).toMatchObject({ spiritualFire: 'NONE', drowsinessSource: 'NONE' });
  });
});

describe('Pleasure binding integration and unchanged common injury/retreat', () => {
  it('prepares, resists then halves only the later enemy physical move without deleting any action', () => {
    const s = fixture(); s.spirituality = 72; const rolls = scriptRolls(9, 46, 371, 1, 221, 1, 1, 1);
    const result = resolveSliceCombatRound(s, 'CONTROL');
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.playerCount).toBe(2); expect(result.round.enemyCount).toBe(2);
    expect(result.round.moves.map(m => m.actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER', 'ENEMY']);
    expect(result.round.moves.map(m => m.selfGain)).toEqual([0, 16, 0, 8]);
    expect(result.round.moves[3]!.label).toContain('×0.50'); expect(rolls).toHaveBeenCalledTimes(8);
    expect(s.spirituality).toBe(74); expect(s.pleasure.encounter.boundRound).toBeNull();
  });
  it('still draws real player wounds/death after a halved attack and does not recover on death', () => {
    for (const consequence of [1, 100]) {
      const s = fixture(); resolve(s, 'OBSERVE');
      const rolls = scriptRolls(1, 1, 221, 1, 1, 1_000_000, consequence);
      const result = resolveSliceCombatRound(s, 'CONTROL');
      expect(result.round.moves[1]!.selfGain).toBe(8); expect(result.round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
      expect(rolls).toHaveBeenCalledTimes(7);
      if (consequence === 1) { expect(result.outcome).toBe('CONTINUE'); expect(s.health).toBe(90); expect(s.injuries).toHaveLength(1); }
      else { expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.spirituality).toBe(74); }
      expect(s.pleasure.encounter).toMatchObject({ silkPrepared: false, boundRound: null }); vi.restoreAllMocks();
    }
  });
  it('black flame can produce ordinary surrender or death only through the actual shared consequence draw', () => {
    for (const consequence of [90, 100]) {
      const s = fixture(); const inventory = structuredClone(s.witch.tools), town = structuredClone(s.town);
      scriptRolls(1, 1, 1, 400, 1, consequence);
      const result = resolveSliceCombatRound(s, 'ATTACK');
      expect(result.outcome).toBe(consequence === 90 ? 'ENEMY_SURRENDERED' : 'ENEMY_DEAD');
      expect(s.combat!.enemyHealth).toBe(consequence === 90 ? 70 : 0); expect(s.spirituality).toBe(78);
      expect(s.witch.tools).toEqual(inventory); expect(s.town).toEqual(town);
      if (consequence === 90) expect(result.round.consequence).toContain('原棍归属不变'); vi.restoreAllMocks();
    }
  });
  it('releases before retreat including a failed exit, preserves injuries and never starts pursuit', () => {
    for (const retreat of [1, 100]) {
      const s = fixture(); resolve(s, 'OBSERVE'); resolve(s, K, 1, undefined, fixedRolls(1)); resolve(s, 'OBSERVE');
      s.health = 90; s.injuries.push({ id: 'prior', severity: 'LIGHT', acquiredRevision: 1, treatedRevision: null });
      const injuries = structuredClone(s.injuries);
      scriptRolls(...(retreat === 1 ? [1, 1, 1] : [1, 1, 100, 400, 1]));
      const result = resolveSliceCombatRound(s, 'RETREAT');
      expect(result.outcome).toBe(retreat === 1 ? 'RETREATED' : 'CONTINUE');
      expect(s.health).toBe(90); expect(s.injuries).toEqual(injuries);
      expect(s.pleasure.encounter).toMatchObject({ silkPrepared: false, boundRound: null });
      if (retreat === 1) { expect(result.round.consequence).toContain('没有瞬移或进入追逐'); expect(s.spirituality).toBe(71); }
      vi.restoreAllMocks();
    }
  });
  it('replays an unchanged initial state deterministically', () => {
    const first = fixture(), second = structuredClone(first);
    const a = resolveSliceCombatRound(first, 'CONTROL'), b = resolveSliceCombatRound(second, 'CONTROL');
    expect(a).toEqual(b); expect(first).toEqual(second);
  });
});

describe('Demoness S9–S7 compatibility', () => {
  it('preserves prior wheels, original Witch budgets and all old mastery without mutating Pleasure', () => {
    const s = fixture(); s.combat!.encounterId = 'FIRST_CASE'; s.arc.stage = 'COMBAT';
    s.world.carrierAlive = true; s.world.carrierCanResist = true; const original = structuredClone(s.pleasure);
    s.progression.sequence = 9;
    expect(playerCountWheel(s)).toEqual(ASSASSIN_COUNT_WHEEL); expect(playerAbilityWheel(s, null)).toEqual(assassinAbilityWheel(null, s));
    s.progression.sequence = 8;
    expect(playerCountWheel(s)).toEqual(INSTIGATOR_COUNT_WHEEL); expect(playerAbilityWheel(s, null)).toEqual(instigatorAbilityWheel(null, s));
    s.progression.sequence = 7;
    expect(playerCountWheel(s)).toEqual(WITCH_COUNT_WHEEL); expect(playerAbilityWheel(s, null)).toEqual(witchAbilityWheel(null, s));
    expect(resolveWitchCombatAbility(s, H, 1, fixedRolls()).selfGain).toBe(45 * 0.65);
    expect(s.pleasure).toEqual(original);
    s.progression.sequence = 6; expect(() => resolveSliceCombatRound(s, 'ATTACK')).toThrow();
  });
});
