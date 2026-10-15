import { beforeAll, describe, expect, it } from 'vitest';
import { projectSliceState } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, statusPenalty } from '../../src/domain/slice/combat.js';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import {
  WISDOM_ANGEL_COUNT_WHEEL, WISDOM_ANGEL_ENEMY_COUNT_WHEEL, WISDOM_ANGEL_ENEMY_ABILITY_WHEEL,
  wisdomAngelActionCount, wisdomAngelEnemyActionCount, wisdomAngelAbilityWheel,
  drawWisdomAngelAbility, drawWisdomAngelEnemyAbility, beginWisdomAngelCombatRound,
  currentWisdomAngelCombatSource, resolveWisdomAngelCombatAbility, resolveWisdomAngelEnemyAbility,
  finishWisdomAngelCombatRound, projectWisdomAngelCombat, validateWisdomAngelRoundOutcome,
  type WisdomAngelMoveId, type WisdomAngelCombatSource,
} from '../../src/domain/wisdom-angel/combat.js';
import { wisdomAngelSnapshot } from './wisdom-angel-helper.js';

const SYNTHESIS = 'reader.s2.conditional-synthesis', RESPONSE = 'reader.s2.observed-response';
const METHOD = 'reader.s3.method-analysis', FLASH = 'reader.s6.limited-imitation', MATERIAL = 'reader.s5.material-imitation';
const abilities = [
  { id: SYNTHESIS, weight: 20, stance: 'ATTACK' }, { id: RESPONSE, weight: 20, stance: 'DEFEND' },
  { id: METHOD, weight: 15, stance: 'CONTROL' }, { id: FLASH, weight: 15, stance: 'CONTROL' },
  { id: MATERIAL, weight: 15, stance: 'PREPARE' }, { id: 'STRIKE', weight: 15, stance: 'ATTACK' },
] as const;
let original: SliceState;
beforeAll(() => { original = wisdomAngelSnapshot('combatStart'); });
function scripted(s: SliceState, values: number[] = []): ActionRandomStream {
  let index = 0, cursor = s.random.cursor;
  return { seed: s.random.seed, get cursor() { return cursor; }, nextInt(min, max) {
    const value = values[index++];
    if (value === undefined || !Number.isInteger(value) || value < min || value > max) throw new Error(`Unexpected isolated unit draw ${index}: ${value}`);
    cursor++; return value;
  } };
}
/** Explicit SLOT-ONLY units. Forced IDs/checks are never labelled natural play,
 * persisted, or accepted as full deterministic rounds. Real public replay has a separate suite. */
function scenario(checks: number[] = [], change?: (s: SliceState) => void) {
  const state = structuredClone(original); change?.(state);
  const random = scripted(state, checks), round = beginWisdomAngelCombatRound(state, 'ATTACK', random);
  return { state, random, round,
    player: (id: WisdomAngelMoveId) => resolveWisdomAngelCombatAbility(state, id, 1 - statusPenalty(round.source.playerHealth, 100), random, round),
    enemy: (id: Parameters<typeof resolveWisdomAngelEnemyAbility>[1]) => resolveWisdomAngelEnemyAbility(state, id, 1 - statusPenalty(round.source.enemyHealth, 100), random, round),
    finish: () => finishWisdomAngelCombatRound(state, round, true, random.cursor),
  };
}

/** Affordability source only: deliberately synthetic prior-slot records satisfy the
 * isolated source contract. These are not saved gameplay or a valid encounter history. */
function depletedSource(s: SliceState): void {
  const e = s.wisdomAngel.encounter;
  e.powerUses = { FLASH: 9, WARD: 9, FEINT: 0 }; e.enemySpirituality = 3;
  e.observations = Array.from({ length: 18 }, (_, i) => {
    const power = i < 9 ? 'FLASH' as const : 'WARD' as const, round = Math.floor(i / 6) + 1, order = i % 6;
    return { power, round, order, atSeconds: 2 + (round - 1) * 60 + order * 5, conditionVersion: 1, paidCost: power === 'FLASH' ? 7 as const : 6 as const };
  });
  s.combat!.round = 4; e.clockSeconds = 182;
  const placeholder = s.combatHistory.at(-1);
  if (!placeholder) throw new Error('Expected preserved old combat history for an isolated source fixture');
  for (let i = 0; i < 3; i++) s.combatHistory.push(structuredClone(placeholder));
}

describe('Wisdom Angel isolated paid slots, current evidence and original sources', () => {
  it('uses the exact inherited six-count thresholds on both sides', () => {
    expect(WISDOM_ANGEL_COUNT_WHEEL.map(a => a.weight)).toEqual([10, 15, 25, 25, 15, 10]);
    expect(WISDOM_ANGEL_ENEMY_COUNT_WHEEL).toEqual(WISDOM_ANGEL_COUNT_WHEEL);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [75, 4], [76, 5], [90, 5], [91, 6], [100, 6]]) {
      expect(wisdomAngelActionCount(roll!)).toBe(count); expect(wisdomAngelEnemyActionCount(roll!)).toBe(count);
    }
  });
  it('draws every six-slot neutral/stance boundary and five-slot enemy boundary once', () => {
    expect(wisdomAngelAbilityWheel(original, null).map(a => [a.id, a.weight])).toEqual(abilities.map(a => [a.id, a.weight]));
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as (SliceStance | null)[]) {
      const weights = abilities.map(a => a.weight * (a.stance === stance ? 5 : 4)), total = weights.reduce((n, w) => n + w, 0);
      const wheel = wisdomAngelAbilityWheel(original, stance); let boundary = 0;
      abilities.forEach((a, i) => {
        const first = boundary + 1; boundary += weights[i]!; const rng = scripted(original, [first, boundary]), cursor = rng.cursor;
        expect(drawWisdomAngelAbility(rng, original, stance)).toBe(a.id); expect(drawWisdomAngelAbility(rng, original, stance)).toBe(a.id);
        expect(rng.cursor).toBe(cursor + 2); expect(wheel[i]).toMatchObject({ id: a.id, weight: weights[i]! / total * 100 });
      });
    }
    expect(WISDOM_ANGEL_ENEMY_ABILITY_WHEEL.map(a => [a.id, a.weight])).toEqual([['FLASH', 35], ['WARD', 25], ['BODY_STRIKE', 20], ['FEINT', 15], ['ACCIDENT', 5]]);
    let boundary = 0;
    for (const a of WISDOM_ANGEL_ENEMY_ABILITY_WHEEL) {
      const first = boundary + 1; boundary += a.weight; const rng = scripted(original, [first, boundary]), cursor = rng.cursor;
      expect(drawWisdomAngelEnemyAbility(rng)).toBe(a.id); expect(drawWisdomAngelEnemyAbility(rng)).toBe(a.id); expect(rng.cursor).toBe(cursor + 2);
    }
  });
  it('publishes the exact actual draw sources and independent Victor resources without changing state', () => {
    const before = structuredClone(original), p = projectSliceState(original).combat!, detail = projectWisdomAngelCombat(original);
    expect(p.playerCountWheel).toEqual(WISDOM_ANGEL_COUNT_WHEEL); expect(p.enemyCountWheel).toEqual(WISDOM_ANGEL_ENEMY_COUNT_WHEEL);
    const enemyLabels=["原有限闪光：7S/105", "原有限护术：6S/减60", "原棍普通打击：20×身体", "实际变换节奏：3S/每轮一次，当前条件版本+1并结束当前应对窗", "判断偏差：−22.5"],playerLabels=["条件综合（5S/知识20；当前条件已见FLASH+WARD才可用，成功65）", "已见方法应对（6S/知识20；20秒内下一实际敌槽，匹配实付原法术减45）", "继承方法辨析（本场实际已见FLASH/WARD，5S/知识18减35）", "继承实际学会原FLASH（2S/知识14，减12×旧掌握）", "消耗最早合格自持原微光片（0S，减18×制作固定效力）", "持握原短棍打击"];
    expect(WISDOM_ANGEL_ENEMY_ABILITY_WHEEL).toHaveLength(enemyLabels.length);expect(p.playerAbilityWheel).toHaveLength(playerLabels.length);
    expect(p.enemyAbilityWheel).toEqual(WISDOM_ANGEL_ENEMY_ABILITY_WHEEL.map((entry,index)=>({...entry,label:enemyLabels[index]}))); expect(p.playerAbilityWheel.map(({id,weight})=>({id,weight}))).toEqual(wisdomAngelAbilityWheel(original, null).map(({id,weight})=>({id,weight})));
    expect(original.town.clubLocation).toBe('HAND'); expect(p.playerAbilityWheel.find(a=>a.id==='STRIKE')?.label).toBe('持握原短棍打击');
    expect(p.playerAbilityWheel).toEqual(playerAbilityWheel(original, null).map((entry,index)=>({...entry,label:playerLabels[index]})));
    for (const stance of ['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE'] as const) expect(p.playerAbilityWheels?.[stance]).toEqual(playerAbilityWheel(original, stance).map((entry,index)=>({...entry,label:playerLabels[index]})));
    expect(p.playerAbilityWheels?.RETREAT).toEqual([]);
    expect(detail).toMatchObject({ targetId: 'WA2-VICTOR', playerHealth: original.health, playerMind: original.mind, playerSpirituality: original.spirituality,
      enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, maxSpirituality: 120, conditionVersion: 1, observations: [], currentObservations: [], responseWindow: null, originalExit: true, pursuit: false });
    expect(currentWisdomAngelCombatSource(original)).toMatchObject({ targetAge: 49, targetSequence: 2, targetCore: 24, enemyWeapon: 'WA2-VICTOR-CLUB', distanceMetres: 2, space: 'WA2-COURT', door: 'WA2-COURT-DOOR', ordinaryExit: true });
    expect(original).toEqual(before);
  });
  it('does not observe a future draw: missing evidence means ordinary10/0S and no check', () => {
    const h = scenario(), before = structuredClone(h.state), cursor = h.random.cursor;
    for (const id of [SYNTHESIS, RESPONSE, METHOD] as const) expect(h.player(id)).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
    const wheelRandom = scripted(h.state, [36]); expect(drawWisdomAngelEnemyAbility(wheelRandom)).toBe('WARD');
    expect(h.state.wisdomAngel.encounter.observations).toEqual([]); expect(h.random.cursor).toBe(cursor); expect(h.state.spirituality).toBe(before.spirituality);
    expect(h.round.playerActions.every(a => !a.attempted && a.paidCost === 0 && a.rolls.length === 0)).toBe(true);
    h.enemy('WARD'); expect(h.state.wisdomAngel.encounter.observations).toHaveLength(1);
    expect(h.round.enemyActions[0]!.observation).toMatchObject({ power: 'WARD', paidCost: 6, conditionVersion: 1, order: 3 });
    expect(h.state.polymath.samples).toEqual(before.polymath.samples);
  });
  it('requires two distinct actual current methods, then pays5S/knowledge20 for non-threatening65G', () => {
    const h = scenario([1]), spirit = h.state.spirituality, health = h.state.combat!.enemyHealth, mastery = structuredClone(h.state.progression.mastery);
    h.enemy('FLASH'); h.enemy('FLASH'); expect(h.player(SYNTHESIS).enemyReduction).toBe(10);
    h.enemy('WARD'); expect(h.player(SYNTHESIS)).toMatchObject({ selfGain: 65, enemyReduction: 0, threatens: false, mentalPressure: false });
    expect(h.round.playerActions[1]).toMatchObject({ paidCost: 5, attempted: true, succeeded: true, applied: true, rolls: [1] });
    expect(h.round.playerActions[1]!.requiredObservations.map(o => o.power)).toEqual(['FLASH', 'WARD']);
    expect(h.state.wisdomAngel.encounter.abilityUses.SYNTHESIS).toEqual({ attempts: 1, successes: 1, effects: 1 });
    expect(h.state.spirituality).toBe(spirit - 5); expect(h.state.combat!.enemyHealth).toBe(health); expect(h.state.combat!.enemyInjuries).toEqual([]);
    expect(h.state.progression.mastery).toEqual(mastery);
  });
  it.each(['FLASH', 'WARD'] as const)('response observes %s, opens a paid future window and reduces only the next matching paid spell45G', power => {
    const h = scenario([1]), spirit = h.state.spirituality;
    h.enemy(power); const previous = structuredClone(h.round.enemyActions[0]);
    expect(h.player(RESPONSE)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(h.state.wisdomAngel.encounter.responseWindow).toMatchObject({ targetPower: power, conditionVersion: 1, openedOrder: 1, expiresAt: 25 });
    expect(h.state.wisdomAngel.encounter.abilityUses.RESPONSE).toEqual({ attempts: 1, successes: 1, effects: 0 });
    const effect = h.enemy(power); expect(effect[power === 'FLASH' ? 'selfGain' : 'enemyReduction']).toBe(power === 'FLASH' ? 60 : 15);
    expect(h.round.enemyActions[1]).toMatchObject({ actual: power, paidCost: power === 'FLASH' ? 7 : 6, responseConsumed: true, responseApplied: true, responseReduction: 45 });
    expect(h.state.wisdomAngel.encounter.responseWindow).toBeNull(); expect(h.round.enemyActions[0]).toEqual(previous);
    expect(h.enemy(power)[power === 'FLASH' ? 'selfGain' : 'enemyReduction']).toBe(power === 'FLASH' ? 105 : 60);
    expect(h.state.spirituality).toBe(spirit - 6); expect(h.state.wisdomAngel.encounter.abilityUses.RESPONSE.effects).toBe(1);
  });
  it.each(['FLASH', 'BODY_STRIKE', 'ACCIDENT'] as const)('the next mismatched actual %s consumes the latest-WARD window with zero mitigation', next => {
    const h = scenario([1]); h.enemy('FLASH'); h.enemy('WARD'); h.player(RESPONSE);
    expect(h.round.playerActions[0]!.requiredObservations).toEqual([h.round.enemyActions[1]!.observation]);
    h.enemy(next); expect(h.round.enemyActions[2]).toMatchObject({ responseConsumed: true, responseApplied: false, responseReduction: 0 });
    expect(h.state.wisdomAngel.encounter.responseWindow).toBeNull(); expect(h.enemy('WARD').enemyReduction).toBe(60);
    expect(h.state.wisdomAngel.encounter.abilityUses.RESPONSE).toEqual({ attempts: 1, successes: 1, effects: 0 });
  });
  it('expires at the exact20-second limit before another actual enemy action', () => {
    const h = scenario([1]); h.enemy('FLASH'); h.player(RESPONSE);
    for (let i = 0; i < 3; i++) h.player('OBSERVE');
    expect(h.enemy('FLASH').selfGain).toBe(105); expect(h.round.enemyActions[1]).toMatchObject({ order: 5, atSeconds: 25, responseExpired: true, responseConsumed: false, responseApplied: false });
    expect(h.state.wisdomAngel.encounter.abilityUses.RESPONSE.effects).toBe(0);
  });
  it('a last-slot successful response closes unused at60seconds without an effect or mastery', () => {
    const h = scenario([1]), mastery = structuredClone(h.state.progression.mastery), spirit = h.state.spirituality;
    for (let i = 0; i < 5; i++) { h.enemy('WARD'); h.player('OBSERVE'); }
    h.enemy('WARD'); h.player(RESPONSE);
    expect(h.round.playerActions[5]).toMatchObject({ order: 11, atSeconds: 55, succeeded: true, applied: false });
    const result = h.finish(); expect(result.responseWindowBeforeClose).toMatchObject({ openedOrder: 11, expiresAt: 60, targetPower: 'WARD' });
    expect(result.responseWindowAfter).toBeNull(); expect(h.state.wisdomAngel.encounter.responseWindow).toBeNull();
    expect(result.abilityUses.RESPONSE).toEqual({ attempts: 1, successes: 1, effects: 0 }); expect(h.state.progression.mastery).toEqual(mastery);
    expect(h.state.spirituality).toBe(spirit - 6); expect(result.elapsedSeconds).toBe(60);
    expect(validateWisdomAngelRoundOutcome(result)).toBe(false);
  });
  it('reopening replaces a window without duplicating effects', () => {
    const h = scenario([1, 1]); h.enemy('FLASH'); h.player(RESPONSE); h.player(RESPONSE);
    expect(h.enemy('FLASH').selfGain).toBe(60); expect(h.state.wisdomAngel.encounter.abilityUses.RESPONSE).toEqual({ attempts: 2, successes: 2, effects: 1 });
  });
  it('real3S feint changes current conditions once, retains old observations and never rewrites completed synthesis', () => {
    const h = scenario([1, 1, 1]); h.enemy('FLASH'); h.enemy('WARD'); h.player(SYNTHESIS); h.player(RESPONSE);
    const observations = structuredClone(h.state.wisdomAngel.encounter.observations), applied = structuredClone(h.round.playerActions[0]);
    h.enemy('FEINT'); expect(h.round.enemyActions[2]).toMatchObject({ actual: 'FEINT', paidCost: 3, changedCondition: true, conditionVersionBefore: 1, conditionVersionAfter: 2, responseConsumed: true, responseInvalidated: true });
    expect(h.state.wisdomAngel.encounter.observations).toEqual(observations); expect(projectWisdomAngelCombat(h.state).currentObservations).toEqual([]);
    expect(h.player(SYNTHESIS).enemyReduction).toBe(10); expect(h.player(RESPONSE).enemyReduction).toBe(10);
    expect(h.player(METHOD).enemyReduction).toBe(35); expect(h.round.playerActions[4]!.requiredObservations[0]!.conditionVersion).toBe(1);
    expect(h.enemy('FEINT').selfGain).toBe(20); expect(h.round.enemyActions[3]).toMatchObject({ planned: 'FEINT', actual: 'BODY_STRIKE', paidCost: 0, changedCondition: false });
    expect(h.state.wisdomAngel.encounter).toMatchObject({ conditionVersion: 2, enemySpirituality: 104, powerUses: { FLASH: 1, WARD: 1, FEINT: 1 } });
    expect(h.round.playerActions[0]).toEqual(applied); expect(h.state.wisdomAngel.encounter.abilityUses.SYNTHESIS.effects).toBe(1);
    expect(h.state.wisdomAngel.encounter.abilityUses.RESPONSE.effects).toBe(0);
  });
  it('new paid observations after feint restore current-version eligibility only after both actual powers', () => {
    const h = scenario([1]); h.enemy('FLASH'); h.enemy('WARD'); h.enemy('FEINT'); h.enemy('FLASH');
    expect(h.player(SYNTHESIS).enemyReduction).toBe(10); h.enemy('WARD'); expect(h.player(SYNTHESIS).selfGain).toBe(65);
    expect(h.round.playerActions[1]!.requiredObservations.every(o => o.conditionVersion === 2)).toBe(true);
    expect(h.state.wisdomAngel.encounter.observations.map(o => o.conditionVersion)).toEqual([1, 1, 2, 2]);
  });
  it('a later feint leaves a completed response application intact', () => {
    const h = scenario([1]); h.enemy('FLASH'); h.player(RESPONSE); h.enemy('FLASH'); const applied = structuredClone(h.round.enemyActions[1]);
    h.enemy('FEINT'); expect(h.round.enemyActions[1]).toEqual(applied); expect(applied.selfGain).toBe(60);
    expect(h.state.wisdomAngel.encounter.abilityUses.RESPONSE.effects).toBe(1);
  });
  it('failed new and inherited checks retain all5/6/5/2S costs and award no effects', () => {
    const h = scenario([100, 100, 100, 100]), spirit = h.state.spirituality; h.enemy('FLASH'); h.enemy('WARD');
    for (const id of [SYNTHESIS, RESPONSE, METHOD, FLASH] as const) expect(h.player(id)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(h.state.spirituality).toBe(spirit - 18); expect(h.round.playerActions.map(a => a.paidCost)).toEqual([5, 6, 5, 2]);
    expect(h.round.playerActions.every(a => a.attempted && !a.succeeded && !a.applied && a.rolls[0] === 100)).toBe(true);
    expect(h.state.wisdomAngel.encounter.abilityUses).toEqual({ SYNTHESIS: { attempts: 1, successes: 0, effects: 0 }, RESPONSE: { attempts: 1, successes: 0, effects: 0 } });
  });
  it.each([[SYNTHESIS, 20, 5], [RESPONSE, 20, 6], [METHOD, 18, 5], [FLASH, 14, 2]] as const)(
    'uses exactly the published knowledge difficulty and one paid check for%s', (id, difficulty, cost) => {
      const chance = computeCheckChance({ ability: 'knowledge', baseAbility: 20, difficulty, modifiers: [] });
      for (const [roll, succeeds] of [[chance, true], [chance + 1, false]] as const) {
        const h = scenario([roll], s => { s.character.coreStats.knowledge = 20; }), spirit = h.state.spirituality, cursor = h.random.cursor;
        h.enemy('FLASH'); h.enemy('WARD'); h.player(id);
        expect(h.round.playerActions[0]).toMatchObject({ attempted: true, succeeded: succeeds, paidCost: cost, rolls: [roll] });
        expect(h.state.spirituality).toBe(spirit - cost); expect(h.random.cursor).toBe(cursor + 1);
      }
    });
  it.each([0, 250, 500])('old actually learned FLASH uses old mastery%s and never changes the sample library', mastery => {
    const h = scenario([1], s => { s.progression.mastery[FLASH] = mastery; }), before = structuredClone(h.state.polymath), spirit = h.state.spirituality;
    expect(h.round.source.flashSample).toMatchObject({ observedWeek: 41, understoodWeek: 41, learnedWeek: 42 });
    expect(h.player(FLASH).enemyReduction).toBe(12 * (.65 + .35 * mastery / 500));
    expect(h.state.spirituality).toBe(spirit - 2); expect(h.state.polymath).toEqual(before); expect(h.state.progression.mastery[FLASH]).toBe(mastery);
  });
  it('a missing real learned FLASH falls back to the actual body without a check or free sample', () => {
    const h = scenario([], s => { s.polymath.samples.FLASH = { observedWeek: null, understoodWeek: null, learnedWeek: null, analysisAttemptWeek: null }; });
    const before = structuredClone(h.state.polymath), spirit = h.state.spirituality;
    expect(h.player(FLASH).selfGain).toBe(h.round.source.clubHeld ? 16 : 12); expect(h.round.playerActions[0]).toMatchObject({ paidCost: 0, attempted: false, rolls: [] });
    expect(h.state.spirituality).toBe(spirit); expect(h.state.polymath).toEqual(before);
  });
  it('consumes the oldest actual original held microglimmer once at fixed manufacture power with no free replacement', () => {
    const h = scenario(), before = structuredClone(h.state.mysticismMagister), mastery = structuredClone(h.state.progression.mastery), spirit = h.state.spirituality;
    const held = before.crafts.filter(c => c.status === 'PLAYER').sort((a, b) => a.createdWeek - b.createdWeek || Number(a.id.slice(10)) - Number(b.id.slice(10)));
    expect(held.length).toBeGreaterThan(0); expect(held[0]!.id).toBe('MM5-FLASH-3');
    for (const craft of held) { expect(h.player(MATERIAL).enemyReduction).toBe(18 * craft.power); expect(h.round.playerActions.at(-1)!.consumedCraftId).toBe(craft.id); }
    expect(h.player(MATERIAL).selfGain).toBe(h.round.source.clubHeld ? 16 : 12);
    expect(h.state.mysticismMagister).toEqual({ ...before, crafts: before.crafts.map(c => c.status === 'PLAYER' ? { ...c, status: 'CONSUMED', usedWeek: h.state.week } : c) });
    expect(h.state.mysticismMagister.crafts).toHaveLength(before.crafts.length); expect(h.state.spirituality).toBe(spirit); expect(h.state.progression.mastery).toEqual(mastery);
  });
  it.each([true, false])('insufficient spirituality uses only the actual held-club=%s ordinary body, no charge or reroll', held => {
    const h = scenario([], s => { s.spirituality = 1; s.town.clubLocation = held ? 'HAND' : 'SHOP'; });
    h.enemy('FLASH'); h.enemy('WARD'); const cursor = h.random.cursor;
    for (const id of [SYNTHESIS, RESPONSE, METHOD, FLASH] as const) expect(h.player(id)).toMatchObject({ selfGain: held ? 16 : 12, enemyReduction: 0, threatens: true });
    expect(h.state.spirituality).toBe(1); expect(h.random.cursor).toBe(cursor); expect(h.round.playerActions.every(a => a.paidCost === 0 && !a.attempted)).toBe(true);
  });
  it('isolated low enemy budget cannot pay an original spell, and only a funded first feint changes conditions', () => {
    const h = scenario([], depletedSource), observations = structuredClone(h.state.wisdomAngel.encounter.observations);
    for (const power of ['FLASH', 'WARD'] as const) expect(h.enemy(power)).toMatchObject({ selfGain: 20, enemyReduction: 0 });
    expect(h.state.wisdomAngel.encounter.observations).toEqual(observations); h.enemy('FEINT');
    expect(h.state.wisdomAngel.encounter.enemySpirituality).toBe(0); expect(h.state.wisdomAngel.encounter.conditionVersion).toBe(2);
    for (const power of ['FLASH', 'WARD', 'FEINT'] as const) expect(h.enemy(power)).toMatchObject({ selfGain: 20, enemyReduction: 0 });
    expect(h.state.wisdomAngel.encounter.powerUses).toEqual({ FLASH: 9, WARD: 9, FEINT: 1 }); expect(h.state.wisdomAngel.encounter.observations).toEqual(observations);
    expect(h.finish().enemySpirituality).toBe(0);
  });
  it('a matching planned but unpaid spell is an actual physical fallback and consumes response without mitigation', () => {
    const h = scenario([1], depletedSource); h.player(RESPONSE); expect(h.state.wisdomAngel.encounter.responseWindow?.targetPower).toBe('WARD');
    expect(h.enemy('WARD').selfGain).toBe(20); expect(h.round.enemyActions[0]).toMatchObject({ planned: 'WARD', actual: 'BODY_STRIKE', paidCost: 0, responseConsumed: true, responseApplied: false, responseReduction: 0 });
  });
  it('caps both sides at six slots without a seventh fee, check or observation', () => {
    const h = scenario(); for (let i = 0; i < 6; i++) { h.player('OBSERVE'); h.enemy('WARD'); }
    const before = structuredClone(h.state), cursor = h.random.cursor;
    expect(h.player(SYNTHESIS).selfGain).toBe(0); expect(h.enemy('FLASH').selfGain).toBe(0);
    expect(h.state).toEqual(before); expect(h.random.cursor).toBe(cursor); expect(h.round.playerActions).toHaveLength(6); expect(h.round.enemyActions).toHaveLength(6);
  });
  it('rejects borrowed/stale original-body, club, sample and random sources before any spend or draw', () => {
    const h = scenario(), source = h.round.source, physical = 1 - statusPenalty(source.playerHealth, 100), cursor = h.random.cursor;
    for (const bad of [null, { ...source, round: 99 }, { ...source, targetId: 'IS3-ALTON' }, { ...source, enemyWeapon: 'PF4-HAROLD-CLUB' },
      { ...source, door: 'FOREIGN-DOOR' }, { ...source, conditionVersion: 99 }, { ...source, flashSample: { ...source.flashSample, learnedWeek: source.week } }]) {
      const before = structuredClone(h.state);
      expect(resolveWisdomAngelCombatAbility(h.state, FLASH, physical, h.random, h.round, bad as WisdomAngelCombatSource | null).selfGain).toBe(0);
      expect(h.state).toEqual(before); expect(h.random.cursor).toBe(cursor);
    }
    expect(() => beginWisdomAngelCombatRound(h.state, 'ATTACK', { ...h.random, seed: 'foreign' })).toThrow();
    expect(() => beginWisdomAngelCombatRound(h.state, 'ATTACK', { ...h.random, cursor: cursor + 1 })).toThrow();
    h.state.mysticismMagister.crafts[0]!.power += .01; const changed = structuredClone(h.state);
    expect(h.player(MATERIAL).enemyReduction).toBe(0); expect(h.state).toEqual(changed); expect(() => h.finish()).toThrow();
  });
});
