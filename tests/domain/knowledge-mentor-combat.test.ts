import { playerAbilityWheel } from '../../src/domain/slice/combat.js';
import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import {
  KNOWLEDGE_MENTOR_COUNT_WHEEL, KNOWLEDGE_MENTOR_ENEMY_COUNT_WHEEL, KNOWLEDGE_MENTOR_ENEMY_ABILITY_WHEEL,
  KNOWLEDGE_MENTOR_PLAYER_ABILITIES, knowledgeMentorActionCount, knowledgeMentorEnemyActionCount, knowledgeMentorAbilityWheel,
  beginKnowledgeMentorCombatRound, currentKnowledgeMentorCombatSource, resolveKnowledgeMentorCombatAbility, resolveKnowledgeMentorEnemyAbility,
  finishKnowledgeMentorCombatRound, validateKnowledgeMentorRoundOutcome, validateKnowledgeMentorCombatSource, type KnowledgeMentorMoveId,
} from '../../src/domain/knowledge-mentor/combat.js';
import { validateKnowledgeMentorEncounter, KNOWLEDGE_MENTOR_POWERS } from '../../src/domain/knowledge-mentor/encounter.js';
import { validateKnowledgeMentorRecordedRound } from '../../src/domain/slice/knowledge-mentor-combat.js';
import { knowledgeMentorBoundary, knowledgeMentorSnapshot, km, rejectKm } from './knowledge-mentor-test-fixture.js';
const BIND = 'paragon.s2.protocol-binding', CALIBRATE = 'paragon.s2.bounded-calibration';
const noRandom: ActionRandomStream = { seed: 'knowledge-mentor-directed-no-extra-draw', cursor: 0, nextInt() { throw new Error('Unexpected random draw'); } };
function random(...values: number[]): ActionRandomStream { let index = 0; return { seed: 'knowledge-mentor-directed-unit', cursor: 0, nextInt(min, max) {
  const n = values[index++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected directed draw ${index}`); return n;
} }; }
const start = () => knowledgeMentorSnapshot('combatStart');
const begin = (s: SliceState) => beginKnowledgeMentorCombatRound(s, 'ATTACK', noRandom);
const effect = (s: SliceState, r: ReturnType<typeof begin>, id: KnowledgeMentorMoveId, ...rolls: number[]) => resolveKnowledgeMentorCombatAbility(s, id, 1, rolls.length ? random(...rolls) : noRandom, r);
const enemy = (s: SliceState, r: ReturnType<typeof begin>, id: Parameters<typeof resolveKnowledgeMentorEnemyAbility>[1]) => resolveKnowledgeMentorEnemyAbility(s, id, 1, noRandom, r);
function finish(s: SliceState, r: ReturnType<typeof begin>) { const o = finishKnowledgeMentorCombatRound(s, r); expect(validateKnowledgeMentorRoundOutcome(o)).toBe(true); return o; }
/** Find a unit-only first-round branch by changing the RNG cursor before the
 * public fight command freezes startSource. The real deterministic adapter,
 * public command, round replay, death and exit validators are never mocked. */
function directedTerminal(wanted: string, stance: SliceStance): SliceState {
  const ready = knowledgeMentorBoundary('combat-start').beforeLast;
  for (let offset = 0; offset < 2000; offset++) {
    const input = structuredClone(ready); input.random.cursor += offset;
    const fighting = applySliceIntent(input, { type: 'KNOWLEDGE_MENTOR', command: { type: 'ENCOUNTER_FIGHT' } });
    const next = applySliceIntent(fighting, { type: 'COMBAT_ROUND', stance });
    if (next.knowledgeMentor.encounter.terminal?.outcome === wanted) { assertValidSliceState(input); assertValidSliceState(fighting); assertValidSliceState(next); return next; }
  }
  throw new Error(`Directed search did not reach ${wanted}; no natural fixture was replaced`);
}

describe('Knowledge Mentor actual independent source, finite paid combat and real exits', () => {
  it('publishes exactly the actual six-count and independent enemy/player wheels for all stances', () => {
    const s = start(), bytes = JSON.stringify(s), p = projectSliceState(s).combat!;
    expect(currentKnowledgeMentorCombatSource(s)).toMatchObject({ targetId: 'KM2-ROWAN-HALE', targetAge: 48, targetSequence: 2, enemyPhysique: 24, actualOriginalBody: true, independentMind: true, enemyWeapon: 'KM2-ROWAN-CLUB', playerSpirituality: 120, enemySpirituality: 120 });
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [75, 4], [76, 5], [90, 5], [91, 6], [100, 6]]) {
      expect(knowledgeMentorActionCount(roll!)).toBe(count); expect(knowledgeMentorEnemyActionCount(roll!)).toBe(count);
    }
    expect(p.playerCountWheel).toEqual(KNOWLEDGE_MENTOR_COUNT_WHEEL); expect(p.enemyCountWheel).toEqual(KNOWLEDGE_MENTOR_ENEMY_COUNT_WHEEL);
    const playerLabels = ["有限工序封装（每轮一次，原指令片+5S+原件各1储能/知识18）", "现场有限校准（每轮一次，4S+1M/知识18，下一次成功原件效果+18）", "双原件有限协同（5S+各1储能/知识18，成功40/减20）", "有限结构解析（4S/知识18，下一次普通打击窗口）", "继承原护架赋灵（4S+1储能/知识16，40×原掌握）", "继承指挥原护架（2S+1储能/减26，须原架实际赋灵）", "继承短时专注（2S/12×原掌握）", "持握原短棍打击", "本人普通避让（减10，不免伤）", "观察眼前原人原物（0消耗/0贡献）", "判断失衡（固定−22.5）"];
    const enemyLabels = ["有限弧光术：7S/贡献105", "有限护术：6S/减势60", "有限干扰：3S/本轮下一次封装或协同抵抗30%→70%", "自己的唯一原棍：20×身体", "普通观察原人原出口：0贡献", "判断偏差：−22.5"];
    expect(p.enemyAbilityWheel).toEqual(KNOWLEDGE_MENTOR_ENEMY_ABILITY_WHEEL.map((entry,index)=>({...entry,label:enemyLabels[index]}))); expect(p.playerAbilityWheel).toEqual(playerAbilityWheel(s, null).map((entry,index)=>({...entry,label:playerLabels[index]}))); expect(p.playerAbilityWheel.map(({id,weight})=>({id,weight}))).toEqual(knowledgeMentorAbilityWheel(s,null).map(({id,weight})=>({id,weight})));
    expect(KNOWLEDGE_MENTOR_ENEMY_ABILITY_WHEEL.map(a => a.weight)).toEqual([30, 20, 20, 20, 5, 5]);
    for (const stance of ['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE'] as const) {
      expect(p.playerAbilityWheels?.[stance]).toEqual(playerAbilityWheel(s, stance).map((entry,index)=>({...entry,label:playerLabels[index]}))); expect(knowledgeMentorAbilityWheel(s, stance).reduce((n, a) => n + a.weight, 0)).toBeCloseTo(100);
    }
    expect(p.playerAbilityWheels?.RETREAT).toEqual([]); expect(new Set(KNOWLEDGE_MENTOR_PLAYER_ABILITIES.map(a => a.id)).size).toBe(KNOWLEDGE_MENTOR_PLAYER_ABILITIES.length); expect(JSON.stringify(s)).toBe(bytes);
  }, 15_000);

  it('spends one real prepared plate, 5S and both unique original charges once, with no free mastery or extra actor', () => {
    const s = start(), before = structuredClone(s), r = begin(s), plate = s.knowledgeMentor.life.combatPlates.find(p => p.status === 'READY')!;
    expect(effect(s, r, BIND, 1, 100)).toMatchObject({ selfGain: 40, enemyReduction: 20 });
    const paid = structuredClone(s); effect(s, r, BIND); expect(s).toEqual(paid); const o = finish(s, r);
    expect(o).toMatchObject({ protocolUses: 1, protocolSuccesses: 1, playerSpiritualityAfter: before.spirituality - 5 });
    expect(o.playerActions.map(a => a.paidCost)).toEqual([5, 0]); expect(o.playerActions[0]).toMatchObject({ plateId: plate.id, boxChargeSpent: 1, frameChargeSpent: 1, protocolResult: 'SUCCEEDED' });
    expect(o.combatPlates[0]).toMatchObject({ id: plate.id, status: 'SPENT', location: 'YARD', spentRevision: r.source.revision + 1 });
    expect(s.alchemist.life.creations.map(x => x.charge)).toEqual(before.alchemist.life.creations.map(x => x.charge - 1));
    expect(s.progression.mastery).toEqual(before.progression.mastery); expect(s.arcaneScholar).toEqual(before.arcaneScholar);
  });

  it.each([[100, null, 'FAILED'], [1, 1, 'RESISTED']] as const)('retains protocol paid failure/resistance with roll%s and no second attempt', (check, resistance, result) => {
    const s = start(), r = begin(s); effect(s, r, BIND, ...(resistance === null ? [check] : [check, resistance])); effect(s, r, BIND);
    const o = finish(s, r); expect(o.playerActions[0]).toMatchObject({ protocolResult: result, paidCost: 5, selfGain: 0, enemyReduction: 0 });
    expect(o.playerActions[1]!.rolls).toEqual([]); expect(o.protocolUses).toBe(1); expect(o.protocolSuccesses).toBe(0); expect(o.combatPlates[0]!.status).toBe('SPENT');
  });

  it('consumes paid calibration only on the next real successful construct action and expires every window at round end', () => {
    const s = start(), r = begin(s), spirit = s.spirituality, mind = s.mind;
    effect(s, r, CALIBRATE, 1); effect(s, r, 'STRIKE'); expect(r.playerActions[1]!.calibrationUsed).toBe(false);
    effect(s, r, BIND, 1, 100); effect(s, r, CALIBRATE); const o = finish(s, r);
    expect(o.playerActions[2]).toMatchObject({ selfGain: 58, enemyReduction: 20, calibrationUsed: true, calibrationBonus: 18 });
    expect(o).toMatchObject({ calibrationUses: 1, calibrationSuccesses: 1, calibrationEffects: 1, totalOwnerMindSpent: 1, playerMindAfter: mind - 1, playerSpiritualityAfter: spirit - 9, calibrationActiveAfter: false });
    expect(o.playerActions[3]!.paidCost).toBe(0);
  });

  it.each([1, 100])('retains calibration attempt roll%s without refund or carrying unused influence into another round', roll => {
    const s = start(), r = begin(s); effect(s, r, CALIBRATE, roll); effect(s, r, CALIBRATE);
    const o = finish(s, r); expect(o).toMatchObject({ calibrationUses: 1, calibrationSuccesses: roll === 1 ? 1 : 0, calibrationEffects: 0, totalOwnerMindSpent: 1, calibrationActiveAfter: false });
    expect(o.playerActions.map(a => a.paidCost)).toEqual([4, 0]); expect(o.playerActions[1]!.rolls).toEqual([]);
  });

  it('uses actual enemy JAM cost once and consumes it only at an eligible successful protocol resistance', () => {
    const s = start(), r = begin(s); enemy(s, r, 'JAM'); enemy(s, r, 'JAM'); effect(s, r, BIND, 1, 50);
    const o = finish(s, r); expect(o.enemyActions.map(a => [a.actual, a.paidCost])).toEqual([['JAM', 3], ['OBSERVE', 0]]);
    expect(o.playerActions[0]!.protocolResult).toBe('RESISTED'); expect(o.enemySpirituality).toBe(117); expect(o.powerUses.JAM).toBe(1); expect(o.resistanceActiveAfter).toBe(false);
  });

  it('keeps inherited animate/direct costs and damages the actual frame only when it really intercepts the original club', () => {
    const s = start(), r = begin(s), durability = s.alchemist.life.creations[1]!.durability;
    effect(s, r, 'paragon.s4.animate-made-object', 1); effect(s, r, 'paragon.s4.direct-creation');
    expect(s.alchemist.life.creations[1]!.durability).toBe(durability); enemy(s, r, 'BODY_STRIKE'); const o = finish(s, r);
    expect(o.playerActions.map(a => a.paidCost)).toEqual([4, 2]); expect(o.enemyActions[0]!.frameDurabilityDamage).toBe(5);
    expect(s.alchemist.life.creations[1]!.durability).toBe(durability - 5); expect(s.alchemist.life.creations[1]!.charge).toBe(1);
  });

  it('uses ordinary fallback when actual earlier paid frame actions exhaust the unique original charge', () => {
    const s = start(), r = begin(s);
    effect(s, r, 'paragon.s4.animate-made-object', 1); effect(s, r, 'paragon.s4.direct-creation'); effect(s, r, 'paragon.s4.animate-made-object', 1);
    expect(s.alchemist.life.creations[1]!.charge).toBe(0); effect(s, r, CALIBRATE, 1);
    effect(s, r, BIND); effect(s, r, 'paragon.s3.construct-coordination'); const o = finish(s, r);
    expect(o.playerActions.slice(-2).map(a => [a.paidCost, a.boxChargeSpent, a.frameChargeSpent, a.calibrationUsed, a.rolls])).toEqual([[0, 0, 0, false, []], [0, 0, 0, false, []]]);
    expect(o.playerActions.slice(-2).every(a => a.selfGain > 0)).toBe(true);
    expect(o.protocolUses).toBe(0); expect(o.calibrationEffects).toBe(0); expect(o.calibrationActiveAfter).toBe(false);
    expect(o.combatPlates[0]!.status).toBe('READY'); expect(o.creations[1]!.charge).toBe(0);
  });

  it('does not roll or spend a real plate when the legal pre-fight player resource cannot pay', () => {
    const ready = knowledgeMentorBoundary('combat-start').beforeLast; ready.spirituality = 0; assertValidSliceState(ready);
    const s = km(ready, { type: 'ENCOUNTER_FIGHT' }), r = begin(s), before = structuredClone(s);
    effect(s, r, BIND); effect(s, r, CALIBRATE); expect(s).toEqual(before); const o = finish(s, r);
    expect(o.playerActions.map(a => [a.paidCost, a.mentalCost, a.rolls])).toEqual([[0, 0, []], [0, 0, []]]);
    expect(o).toMatchObject({ protocolUses: 0, calibrationUses: 0, totalOwnerMindSpent: 0 }); expect(o.combatPlates[0]!.status).toBe('READY');
  });

  it('refuses borrowed, altered, missing and stale sources with no extra roll or mutation', () => {
    const s = start(), r = begin(s), old = structuredClone(s);
    const bad = structuredClone(r.source); bad.targetId = 'AR3-CORWIN' as typeof bad.targetId;
    expect(validateKnowledgeMentorCombatSource(bad)).toBe(false);
    for (const source of [null, bad, { ...r.source, playerSpirituality: r.source.playerSpirituality - 1 }]) {
      expect(resolveKnowledgeMentorCombatAbility(s, BIND, 1, noRandom, r, source)).toMatchObject({ selfGain: 0, enemyReduction: 0 }); expect(s).toEqual(old);
    }
    expect(r.playerActions).toEqual([]); finish(s, r); expect(() => finishKnowledgeMentorCombatRound(s, r)).toThrow();
  });

  it('rejects replay-tampered plate consumption, resource costs, counters and free calibration effects', () => {
    const s = start(), r = begin(s); effect(s, r, CALIBRATE, 1); effect(s, r, BIND, 1, 100); const o = finish(s, r);
    const changes = [
      (x: typeof o) => { x.protocolUses++; }, (x: typeof o) => { x.playerSpiritualityAfter++; }, (x: typeof o) => { x.enemySpirituality--; },
      (x: typeof o) => { x.playerActions[1]!.plateId = 'COPY'; }, (x: typeof o) => { x.playerActions[1]!.boxChargeSpent = 0; },
      (x: typeof o) => { x.combatPlates[0]!.status = 'READY'; }, (x: typeof o) => { x.calibrationEffects++; },
      (x: typeof o) => { x.playerActions[1]!.calibrationBonus = 0; }, (x: typeof o) => { x.creations[0]!.charge++; },
    ];
    for (const mutate of changes) { const bad = structuredClone(o); mutate(bad); expect(validateKnowledgeMentorRoundOutcome(bad)).toBe(false); }
  });

  it('replays the real four-round natural battle with exact independent source continuity and paid enemy costs', () => {
    const final = knowledgeMentorSnapshot('final'), e = final.knowledgeMentor.encounter, rounds = final.combatHistory.filter(r => r.knowledgeMentorOutcome);
    expect(rounds).toHaveLength(4); expect(e.powerUses).toEqual({ ARC_BOLT: 4, WARD: 2, JAM: 2 });
    expect(e.enemySpirituality).toBe(120 - KNOWLEDGE_MENTOR_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0));
    expect(e).toMatchObject({ enemySpirituality: 74, protocolUses: 1, protocolSuccesses: 0, calibrationUses: 1, calibrationSuccesses: 1, calibrationEffects: 0, totalOwnerMindSpent: 1 });
    for (const r of rounds) { expect(validateKnowledgeMentorRecordedRound(r)).toBe(true); expect(validateKnowledgeMentorRoundOutcome(r.knowledgeMentorOutcome)).toBe(true); }
    const bad = structuredClone(final); bad.knowledgeMentor.encounter.enemySpirituality++; expect(validateKnowledgeMentorEncounter(bad)).toBe(false); expect(() => assertValidSliceState(bad)).toThrow();
  });

  it('returns each same carried plate and original via ordinary 4m/4sec exit, without recharging or reviving dead Rowan', () => {
    const s = knowledgeMentorBoundary('combat-terminal').final, e = s.knowledgeMentor.encounter; assertValidSliceState(s);
    expect(e).toMatchObject({ status: 'RESOLVED', enemyHealth: 0, enemyStatus: 'DEAD', weaponLocation: 'YARD', exitTravelMetres: 4, exitSeconds: 4 });
    expect(e.retrievedIds).toEqual(e.carriedIds); expect(e.retrievedPlateIds).toEqual(e.carriedPlateIds);
    expect(s.alchemist.life.creations.every(x => x.location === 'PLAYER' && !x.active)).toBe(true);
    expect(s.knowledgeMentor.life.combatPlates[0]).toMatchObject({ status: 'SPENT', location: 'PLAYER' });
    rejectKm(s, { type: 'ENCOUNTER_TALK' });
  });

  it('allows peaceful ordinary exit before fighting and preserves every paid original', () => {
    const ready = knowledgeMentorBoundary('combat-start').beforeLast, originals = structuredClone(ready.alchemist.life.creations), plates = structuredClone(ready.knowledgeMentor.life.combatPlates);
    const next = km(ready, { type: 'LEAVE_ENCOUNTER' });
    expect(next.knowledgeMentor.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', exitTravelMetres: 4, exitSeconds: 4, terminal: null });
    expect(next.alchemist.life.creations).toEqual(originals.map(x => ({ ...x, location: 'PLAYER', active: false })));
    expect(next.knowledgeMentor.life.combatPlates).toEqual(plates.map(p => p.location === 'YARD' ? { ...p, location: 'PLAYER' } : p));
  });

  it('preserves real player death in a directed public first-round branch with no ordinary exit or revival', () => {
    const s = directedTerminal('PLAYER_DEAD', 'ATTACK'); expect(s.status).toBe('DEAD'); expect(s.health).toBe(0);
    expect(s.knowledgeMentor.encounter).toMatchObject({ status: 'LOST', exitTravelMetres: 0, exitSeconds: 0, retrievedIds: [], retrievedPlateIds: [] });
    expect(s.alchemist.life.creations.every(x => x.location === 'YARD' && !x.active)).toBe(true);
    for (const id of s.knowledgeMentor.encounter.carriedPlateIds) expect(s.knowledgeMentor.life.combatPlates.find(p => p.id === id)!.location).toBe('YARD');
    expect(() => applySliceIntent(s, { type: 'ACTION', action: 'WORK' })).toThrow(); rejectKm(s, { type: 'LEAVE_ENCOUNTER' });
  }, 60000);

  it('executes a directed true retreat through the public wheel without rewriting resources or old Corwin', () => {
    const s = directedTerminal('RETREATED', 'RETREAT'); expect(s.health).toBeGreaterThan(0);
    expect(s.knowledgeMentor.encounter).toMatchObject({ status: 'RETREATED', exitTravelMetres: 4, exitSeconds: 4, enemyStatus: 'RESISTING' });
    expect(s.arcaneScholar).toEqual(knowledgeMentorSnapshot('promoted').arcaneScholar); expect(validateKnowledgeMentorEncounter(s)).toBe(true);
  }, 60000);
});
