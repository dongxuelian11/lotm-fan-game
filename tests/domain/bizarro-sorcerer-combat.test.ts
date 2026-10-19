import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { currentMarionettistCombatSource, resolveMarionettistCombatAbility, type MarionettistMoveId } from '../../src/domain/marionettist/combat.js';
import { currentMagicianFireSource, MAGICIAN_COUNT_WHEEL, resolveMagicianFigurineReplacement } from '../../src/domain/magician/combat.js';
import { currentClownDangerSource } from '../../src/domain/clown/combat.js';
import { createBizarroRitualState, handleBizarroRitualCommand, hasBizarroRitualOpponent, settleBizarroRitual, validateBizarroRitualState } from '../../src/domain/bizarro-sorcerer/ritual.js';
import { BIZARRO_ENEMY_ABILITY_WHEEL, BIZARRO_ENEMY_COUNT_WHEEL, applyBizarroPlayerCounterplay,
  bizarroEnemyActionCount, createBizarroRoundContext, drawBizarroEnemyAbility, projectBizarroCombat,
  resolveBizarroEnemyAbility, type BizarroRoundContext } from '../../src/domain/bizarro-sorcerer/ritual-combat.js';
import { bizarroSorcererAbilityWheel, currentBizarroSorcererCombatSource, resolveBizarroSorcererCombatAbility } from '../../src/domain/bizarro-sorcerer/combat.js';

/** DIRECTED_RANDOM_NOT_NATURAL bounded engine fixture. */
function fixture(sequence: 5 | 4 = 5): SliceState {
  const s = createSliceRun(`bizarro-combat-${sequence}`, sliceDefaultCreationSelection, 'bizarro-combat');
  s.activeEvent = null; s.eventQueue = []; s.week = 20; s.world.city = 'BACKLUND'; s.arc.stage = 'ENDED';
  s.world.carrierAlive = false; s.world.carrierCanResist = false;
  s.character.coreStats = { physique: 20, perception: 20, will: 20, knowledge: 20 };
  s.progression = { pathwayId: 'diviner', sequence, mastery: {}, acting: 100, promotionWeek: 1 };
  s.health = 100; s.mind = 100; s.spirituality = sequence === 4 ? 120 : 100; s.cash = 100; s.actionsRemaining = 4;
  s.bizarroSorcerer.ritual = createBizarroRitualState();
  const command = (c: Parameters<typeof handleBizarroRitualCommand>[1]) => expect(handleBizarroRitualCommand(s, c).error).toBeUndefined();
  command({ type: 'SURVEY_RITUAL', targetId: 'B4-COPPER-BELL-A' });
  if (sequence === 5) {
    s.bizarroSorcerer.bottles.push({ id: 'bounded-bottle', batchId: 'bounded-batch', inputIds: ['a','b','c','d','e','f','g'], brewedWeek: 19,
      status: 'PREPARED', outcome: null, consumedWeek: null, ritualAttemptId: null });
    command({ type: 'PREPARE_STAGE' }); s.week += 1; s.actionsRemaining = 4; command({ type: 'GATHER_WITNESSES' });
    s.magician.lantern.prepared = true; s.magician.lantern.oilSpent = 1;
    command({ type: 'START_RITUAL', bottleId: 'bounded-bottle', confirmed: true });
  } else command({ type: 'START_CHALLENGE', targetId: 'B4-COPPER-BELL-A', confirmed: true });
  return s;
}
function player(s: SliceState, id: MarionettistMoveId, round = createBizarroRoundContext()) {
  const before = s.spirituality;
  const original = s.progression.sequence === 4 ? resolveBizarroSorcererCombatAbility(s, id, 1) : resolveMarionettistCombatAbility(s, id, 1);
  return applyBizarroPlayerCounterplay(s, id, original, before, round);
}
function script(...rolls: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt; let i = 0;
  vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const roll = rolls[i++]; if (roll === undefined || roll < min || roll > max) throw new Error(`Unexpected draw ${i}: ${roll} [${min},${max}]`); return roll;
  });
}
const enemy = (s: SliceState, id: Parameters<typeof resolveBizarroEnemyAbility>[1], round: BizarroRoundContext = createBizarroRoundContext()) => resolveBizarroEnemyAbility(s, id, 1, round);
afterEach(() => vi.restoreAllMocks());

describe('Bizarro original beast shared combat', () => {
  it('publishes the exact distinct enemy wheels, actual S and one original beast source', () => {
    const s = fixture(); expect(BIZARRO_ENEMY_COUNT_WHEEL.map(x => x.weight)).toEqual([20, 50, 30]);
    for (const [roll, expected] of [[1,2],[20,2],[21,3],[70,3],[71,4],[100,4]]) expect(bizarroEnemyActionCount(roll!)).toBe(expected);
    expect(BIZARRO_ENEMY_ABILITY_WHEEL.map(x => x.weight)).toEqual([45,35,15,5]);
    for (const [roll,id] of [[1,'B4-CURTAIN-BLADE'],[45,'B4-CURTAIN-BLADE'],[46,'B4-VEIL'],[80,'B4-VEIL'],[81,'B4-EXTINGUISH'],[95,'B4-EXTINGUISH'],[96,'B4-STUMBLE'],[100,'B4-STUMBLE']] as const) {
      const random: ActionRandomStream = { seed: 'bounded', cursor: 0, nextInt: () => roll }; expect(drawBizarroEnemyAbility(random)).toBe(id);
    }
    expect(projectBizarroCombat(s).enemyName).toContain('序列4等价'); expect(projectBizarroCombat(s).enemySpirituality).toBe(40);
    expect(currentMarionettistCombatSource(s)?.nature).toBe('ORIGINAL_LIVING_S4_EQUIVALENT_BEAST');
    expect(currentClownDangerSource(s)?.action).toBe('VISIBLE_ORIGINAL_BEAST_MOVEMENT');
    expect(currentMagicianFireSource(s)?.encounterId).toBe('BIZARRO_RITUAL');
  });
  it('keeps the finite enemy costs and resources exhausted without redraw or free refill', () => {
    const s = fixture(); const r = s.bizarroSorcerer.ritual;
    expect(enemy(s, 'B4-CURTAIN-BLADE').selfGain).toBe(100); expect(r.enemySpirituality).toBe(38);
    r.enemySpirituality = 1; expect(enemy(s, 'B4-CURTAIN-BLADE').selfGain).toBe(24);
    expect(enemy(s, 'B4-VEIL').selfGain).toBe(0); expect(r.veil).toBe(false);
    expect(enemy(s, 'B4-EXTINGUISH').selfGain).toBe(0); expect(s.magician.lantern.prepared).toBe(true);
    enemy(s, 'B4-STUMBLE'); expect(r.enemySpirituality).toBe(1);
  });
  it('has one consumable veil that spends the actual blocked attack resources', () => {
    const s = fixture(); enemy(s, 'B4-VEIL'); enemy(s, 'B4-VEIL'); expect(s.bizarroSorcerer.ritual.enemySpirituality).toBe(32);
    const sp = s.spirituality, blocked = player(s, 'diviner.s7.air-bullet');
    expect(blocked.selfGain).toBe(0); expect(blocked.threatens).toBe(false); expect(s.spirituality).toBe(sp - 2);
    expect(s.bizarroSorcerer.ritual.veil).toBe(false); expect(player(s, 'diviner.s7.air-bullet').selfGain).toBe(60);
    expect(s.bizarroSorcerer.ritual.attempts[0]?.playerAttackCount).toBe(1);
  });
  it('allows paid real fire or actual spirit lines to counter veil without one-slot capture', () => {
    const s = fixture(); enemy(s, 'B4-VEIL'); const sp = s.spirituality;
    expect(player(s, 'diviner.s7.flame-control').selfGain).toBe(31.2); expect(s.spirituality).toBe(sp - 2);
    expect(s.bizarroSorcerer.ritual.veil).toBe(false); enemy(s, 'B4-VEIL');
    const thread = player(s, 'diviner.s5.spirit-threads'); expect(thread.enemyReduction).toBeCloseTo(7.8);
    expect(thread.threatens).toBe(false); expect(s.bizarroSorcerer.ritual.veil).toBe(false);
    expect(s.combat?.enemyStatus).toBe('RESISTING'); expect(s.marionettist.puppet.target).toBeNull();
  });
  it('makes illusion directional, finite and nonstacking instead of granting both reductions', () => {
    const s = fixture(), round = createBizarroRoundContext();
    const first = enemy(s, 'B4-CURTAIN-BLADE', round); expect(first.selfGain).toBe(100);
    const illusion = player(s, 'diviner.s7.illusion', round); expect(illusion.enemyReduction).toBe(0);
    expect(round.diversion).toBe(true); expect(enemy(s, 'B4-CURTAIN-BLADE', round).selfGain).toBe(50);
    expect(round.diversion).toBe(false); expect(enemy(s, 'B4-CURTAIN-BLADE', round).selfGain).toBe(100);
    player(s, 'diviner.s7.illusion', round); enemy(s, 'B4-EXTINGUISH', round);
    expect(s.magician.lantern.prepared).toBe(true); expect(round.diversion).toBe(false);
  });
  it('first extinguishes only the real lamp, then moves the actual curtain and exits every adult', () => {
    const s = fixture(), oil = s.magician.lantern.oilSpent; enemy(s, 'B4-EXTINGUISH');
    expect(s.magician.lantern.prepared).toBe(false); expect(s.magician.lantern.oilSpent).toBe(oil);
    expect(s.bizarroSorcerer.ritual.witnesses.presentIds).toHaveLength(36);
    const sp = s.spirituality; expect(player(s, 'diviner.s7.flame-jump').enemyReduction).toBe(0); expect(s.spirituality).toBe(sp);
    enemy(s, 'B4-EXTINGUISH'); expect(s.bizarroSorcerer.ritual.witnesses.presentIds).toEqual([]);
    expect(s.bizarroSorcerer.ritual.witnesses.exitedIds).toHaveLength(36);
    expect(s.bizarroSorcerer.ritual.witnesses.viewObstructed).toBe(true); expect(hasBizarroRitualOpponent(s)).toBe(true);
    expect(validateBizarroRitualState(s)).toBe(true);
  });
  it('does not auto-surrender on heavy injury, and retreat preserves that same wounded living original', () => {
    const s = fixture(); script(1,1,1,100,100,1,70);
    const heavy = resolveSliceCombatRound(s, 'ATTACK'); s.combatHistory.push(structuredClone(heavy.round)); vi.restoreAllMocks();
    expect(heavy.outcome).toBe('CONTINUE'); expect(s.combat?.enemyStatus).toBe('RESISTING'); expect(s.combat?.enemyHealth).toBe(70);
    expect(heavy.round.enemyAdvantage).toBe(1270); expect(heavy.round.enemyCount).toBe(2);
    script(1,1,100,1); const retreated = resolveSliceCombatRound(s, 'RETREAT'); s.combatHistory.push(structuredClone(retreated.round));
    expect(retreated.outcome).toBe('RETREATED'); settleBizarroRitual(s, retreated.outcome);
    const target = s.bizarroSorcerer.ritual.targets[0]!; expect(target.status).toBe('LEFT_ALIVE'); expect(target.terminalBody?.health).toBe(70);
    expect(target.terminalBody?.injuries).toHaveLength(1); expect(validateBizarroRitualState(s)).toBe(true);
  });
  it('preserves original paper, injury identity and real replacement cost through inherited sources', () => {
    const s = fixture(); s.clown.paperSheets = 1; const sp = s.spirituality;
    expect(player(s, 'diviner.s8.paper-dagger').selfGain).toBe(34); expect(s.clown.paperSheets).toBe(0); expect(s.spirituality).toBe(sp - 1);
    s.injuries.push({ id: 'old-heavy', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: null }); s.injuryRisk = 3;
    player(s, 'diviner.s7.damage-transfer'); expect(s.injuries[0]?.severity).toBe('LIGHT'); expect(s.injuryRisk).toBe(3);
    s.magician.figurinesMade = 1; s.magician.figurinesHeld = 1; const before = s.spirituality;
    expect(resolveMagicianFigurineReplacement(s, 'DEATH')).not.toBeNull(); expect(s.spirituality).toBe(before - 5);
    expect(s.magician.figurinesHeld).toBe(0); expect(s.injuries[0]?.id).toBe('old-heavy'); expect(s.injuryRisk).toBe(3);
  });
});

describe('Bizarro postpromotion finite player profile', () => {
  it('selects 1–6 counts, independent exact wheel and 120/12 regeneration without refill', () => {
    const s = fixture(4); expect(playerCountWheel(s)).toEqual(MAGICIAN_COUNT_WHEEL);
    expect(playerAbilityWheel(s, null)).toEqual(bizarroSorcererAbilityWheel(s, null));
    expect(playerAbilityWheel(s, null).map(x => x.weight)).toEqual([15,8,12,4,3,3,8,9,8,20,5,5]);
    s.spirituality = 80; script(1,1,1,100,100,1,1);
    const result = resolveSliceCombatRound(s, 'ATTACK'); expect(result.outcome).toBe('CONTINUE'); expect(s.spirituality).toBe(92);
    expect(result.round.playerAdvantage).toBeCloseTo((1250 + 20) * .95 + 12);
  });
  it('requires exact current original source and never turns a caged mouse into a deployed swap endpoint', () => {
    const s = fixture(4), source = currentBizarroSorcererCombatSource(s)!; expect(source).not.toBeNull();
    const before = structuredClone(s);
    expect(resolveBizarroSorcererCombatAbility(s, 'diviner.s4.worm-assignment', 1).selfGain).toBe(0);
    expect(resolveBizarroSorcererCombatAbility(s, 'diviner.s4.puppet-swap', 1).enemyReduction).toBe(0);
    expect(s).toEqual(before);
    expect(resolveBizarroSorcererCombatAbility(s, 'diviner.s7.air-bullet', 1, { ...source, targetId: 'fake-body' }).selfGain).toBe(0);
    expect(s).toEqual(before); expect(resolveBizarroSorcererCombatAbility(s, 'diviner.s7.air-bullet', 1).selfGain).toBe(60);
    expect(s.spirituality).toBe(before.spirituality - 2); expect(s.bizarroSorcerer.life.worms.split).toBe(0);
  });
});
