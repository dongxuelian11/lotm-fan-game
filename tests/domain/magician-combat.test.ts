import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import {
  ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel, resolveSliceCombatRound,
} from '../../src/domain/slice/combat.js';
import {
  MAGICIAN_COUNT_WHEEL, currentMagicianFireSource, drawMagicianAbility, isMagician,
  magicianAbilityWheel, magicianActionCount, resolveMagicianCombatAbility, resolveMagicianFigurineReplacement,
  type MagicianFireSource,
} from '../../src/domain/magician/combat.js';
import { createMagicianState } from '../../src/domain/magician/index.js';
import { CLOWN_COUNT_WHEEL, clownAbilityWheel } from '../../src/domain/clown/combat.js';
import { SEER_COUNT_WHEEL, seerAbilityWheel } from '../../src/domain/seer/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

function fixture(): SliceState {
  const state = createSliceRun('magician-combat-test', sliceDefaultCreationSelection, 'magician-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.arc.stage = 'COMBAT';
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.progression = { pathwayId: 'diviner', sequence: 7, mastery: {}, acting: 0, promotionWeek: 1 };
  state.magician = createMagicianState();
  state.spirituality = 60;
  state.clown.paperSheets = 3;
  state.clown.paperSpent = 0;
  state.world.carrierAlive = true;
  state.world.carrierCanResist = true;
  return state;
}

function prepareLamp(state: SliceState): void {
  Object.assign(state.magician.lantern, { oilStock: 5, oilHeld: 0, oilSpent: 1, prepared: true });
}
function prepareFigure(state: SliceState): void {
  state.clown.paperSheets -= 1;
  state.clown.paperSpent += 1;
  state.magician.figurinesMade += 1;
  state.magician.figurinesHeld += 1;
}
function addOldInjury(state: SliceState, id = 'old-wound'): void {
  state.injuries.push({ id, severity: 'HEAVY', acquiredRevision: 0, treatedRevision: null });
}

/** Prescribe exact outcomes while still consuming the production RNG stream. */
function scriptRolls(...rolls: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt;
  let index = 0;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum, maximum,
  ) {
    original.call(this, minimum, maximum);
    const value = rolls[index++];
    if (value === undefined) throw new Error('Unexpected additional random draw');
    expect(value).toBeGreaterThanOrEqual(minimum);
    expect(value).toBeLessThanOrEqual(maximum);
    return value;
  });
}

afterEach(() => vi.restoreAllMocks());

describe('Magician S7 finite combat profile', () => {
  it('uses six nonuniform counts and excludes passive substitution and invented water/restraints from the wheel', () => {
    const state = fixture();
    expect(isMagician(state)).toBe(true);
    expect(playerCountWheel(state)).toEqual(MAGICIAN_COUNT_WHEEL);
    expect(playerCountWheel(state).map(x => x.weight)).toEqual([10, 15, 25, 25, 15, 10]);
    const wheel = playerAbilityWheel(state, null);
    expect(wheel).toEqual(magicianAbilityWheel(state, null));
    const expected = [8, 8, 12, 7, 6, 6, 5, 3, 2, 12, 7, 7, 8, 5, 2, 2];
    wheel.forEach((entry, index) => expect(entry.weight).toBeCloseTo(expected[index]!));
    expect(wheel.reduce((sum, x) => sum + x.weight, 0)).toBeCloseTo(100);
    expect(wheel.map(x => x.id)).toEqual(expect.arrayContaining([
      'STRIKE', 'BLOCK', 'diviner.s8.body-control', 'diviner.s8.balance', 'diviner.s8.agility',
      'diviner.s8.danger-prediction', 'diviner.s8.paper-dagger', 'diviner.s9.spiritual-sight',
      'diviner.s9.spiritual-intuition', 'diviner.s7.air-bullet', 'diviner.s7.flame-control',
      'diviner.s7.flame-jump', 'diviner.s7.illusion', 'diviner.s7.paper-weapon',
    ]));
    expect(wheel.some(x => /paper-figurine|underwater-breathing|bone-softening|damage-transfer/.test(x.id))).toBe(false);
    wheel[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(8);
  });

  it.each([[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [75, 4], [76, 5], [90, 5], [91, 6], [100, 6]])(
    'maps count roll %i to %i actions', (roll, count) => expect(magicianActionCount(roll)).toBe(count),
  );

  it('keeps exact stance tickets and only adds eligible same-body damage transfer', () => {
    const state = fixture();
    const expected = [40, 32, 60, 28, 24, 24, 25, 12, 8, 60, 35, 28, 32, 25, 8, 8];
    expect(magicianAbilityWheel(state, 'ATTACK').map(x => x.weight)).toEqual(expected.map(x => x / 449 * 100));
    scriptRolls(254);
    expect(drawMagicianAbility(new DeterministicActionRandomStream('magician-wheel'), state, 'ATTACK')).toBe('diviner.s7.air-bullet');
    addOldInjury(state);
    const wheel = magicianAbilityWheel(state, 'ATTACK');
    expect(wheel.at(-1)).toEqual({ id: 'diviner.s7.damage-transfer', label: '伤害转移', weight: 32 / 481 * 100 });
    state.magician.damageTransfers.push('old-wound');
    expect(magicianAbilityWheel(state, 'ATTACK').some(x => x.id === 'diviner.s7.damage-transfer')).toBe(false);
  });

  it('uses base450, confirmed core20/30/15/35, cap90 and spirituality60 without strengthening the ordinary enemy', () => {
    const state = fixture();
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 59;
    scriptRolls(1, 1, 449, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(476.5);
    expect(round.enemyAdvantage).toBe(114);
    expect(state.spirituality).toBe(60);
    expect(round.consequenceRoll).toBeUndefined();
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 6;
    scriptRolls(1, 1, 449, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(324);
    expect(capped.spirituality).toBe(12);
  });

  it('does not create passive round contributions from mastery, a lamp or figurine possession', () => {
    const state = fixture(); prepareLamp(state); prepareFigure(state);
    state.progression.mastery = { 'diviner.s7.air-bullet': 500, 'diviner.s7.illusion': 500 };
    scriptRolls(1, 1, 449, 400, 1);
    const result = resolveSliceCombatRound(state, 'ATTACK');
    expect(result.round.playerAdvantage).toBe(465);
    expect(result.round.enemyAdvantage).toBe(114);
    expect(result.round.moves).toHaveLength(2);
    expect(state.magician.figurinesHeld).toBe(1);
    expect(state.magician.figurinesUsed).toBe(0);
    expect(state.magician.lantern.oilSpent).toBe(1);
  });
});

describe('source-bound immediate spells and real finite resources', () => {
  it.each([
    ['diviner.s7.air-bullet', 2, 30, 0, true],
    ['diviner.s7.flame-control', 2, 24, 0, true],
    ['diviner.s7.flame-jump', 3, 0, 24, false],
    ['diviner.s7.illusion', 2, 0, 16, false],
    ['diviner.s7.paper-weapon', 1, 22, 0, true],
  ] as const)('%s spends exactly its own cost and produces one effect', (id, cost, selfGain, enemyReduction, threatens) => {
    const state = fixture(); prepareLamp(state);
    const effect = resolveMagicianCombatAbility(state, id, 1);
    expect(effect).toMatchObject({ selfGain, enemyReduction, threatens });
    expect(state.spirituality).toBe(60 - cost);
    expect(state.combat!.enemyHealth).toBe(100);
    expect(state.magician.lantern).toMatchObject({ oilStock: 5, oilHeld: 0, oilSpent: 1, prepared: true });
    expect(state.clown.paperSheets).toBe(id === 'diviner.s7.paper-weapon' ? 2 : 3);
    expect(state.clown.paperSpent).toBe(id === 'diviner.s7.paper-weapon' ? 1 : 0);
    expect(state.random.cursor).toBe(0);
  });

  it.each(['diviner.s7.flame-control', 'diviner.s7.flame-jump'] as const)(
    '%s rejects absent, spent-out, remote, stale and unrelated fire before charging', id => {
      const mutations: ((state: SliceState) => void)[] = [
        s => { s.magician.lantern.prepared = false; },
        s => { s.magician.lantern.oilSpent = 0; },
        s => { s.world.city = 'ELSEWHERE'; },
        s => { s.world.carrierAlive = false; },
        s => { s.world.carrierCanResist = false; },
        s => { s.combat!.enemyStatus = 'SURRENDERED'; },
        s => { s.combat!.encounterId = 'HUNTER_CARGO'; },
        s => { s.combat = null; },
      ];
      for (const change of mutations) {
        const state = fixture(); prepareLamp(state); const source = currentMagicianFireSource(state);
        change(state); const before = structuredClone(state);
        expect(currentMagicianFireSource(state)).toBeNull();
        expect(resolveMagicianCombatAbility(state, id, 1, source)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
        expect(state).toEqual(before);
      }
      const state = fixture(); prepareLamp(state); const source = currentMagicianFireSource(state)!;
      for (const stale of [
        { ...source, round: 2 }, { ...source, encounterId: 'CLOWN_RESCUE' },
        { ...source, distanceMetres: 31 }, { ...source, source: 'IMAGINARY_FIRE' },
      ]) {
        expect(resolveMagicianCombatAbility(state, id, 1, stale as MagicianFireSource))
          .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
        expect(state.spirituality).toBe(60);
      }
    },
  );

  it('uses the independent living rescue/Mori source after the first carrier died', () => {
    for (const encounterId of ['CLOWN_RESCUE', 'MAGICIAN_DISPUTE'] as const) {
      const state = fixture(); prepareLamp(state);
      state.combat!.encounterId = encounterId; state.arc.stage = 'ENDED';
      state.world.carrierAlive = false; state.world.carrierCanResist = false;
      expect(currentMagicianFireSource(state)).toMatchObject({ encounterId, distanceMetres: 2 });
      const jump = resolveMagicianCombatAbility(state, 'diviner.s7.flame-jump', 1);
      expect(jump.enemyReduction).toBe(24);
      expect(jump.label).toContain('仍在战斗中');
      expect(jump.label).toContain('不穿过封闭墙壁');
      expect(state.combat!.encounterId).toBe(encounterId);
      expect(resolveMagicianCombatAbility(state, 'diviner.s8.danger-prediction', 1).enemyReduction).toBe(22);
      expect(resolveMagicianCombatAbility(state, 'diviner.s9.spiritual-sight', 1).label)
        .toContain(encounterId === 'MAGICIAN_DISPUTE' ? '莫里' : '勒索者');
    }
  });

  it.each([
    ['diviner.s7.air-bullet', 12, 0, true], ['diviner.s7.flame-control', 12, 0, true],
    ['diviner.s7.flame-jump', 0, 10, false], ['diviner.s7.illusion', 0, 10, false],
    ['diviner.s7.paper-weapon', 12, 0, true],
  ] as const)('%s at zero spirituality uses exactly one ordinary fallback without free spell/redraw', (id, selfGain, enemyReduction, threatens) => {
    const state = fixture(); prepareLamp(state); state.spirituality = 0;
    expect(resolveMagicianCombatAbility(state, id, 1)).toMatchObject({ selfGain, enemyReduction, threatens });
    expect(state.spirituality).toBe(0);
    expect(state.clown.paperSheets).toBe(3);
    expect(state.clown.paperSpent).toBe(0);
    expect(state.random.cursor).toBe(0);
  });

  it('shares original Clown paper, never consuming a prepared figurine as raw paper', () => {
    const state = fixture(); prepareFigure(state);
    resolveMagicianCombatAbility(state, 'diviner.s8.paper-dagger', 1);
    resolveMagicianCombatAbility(state, 'diviner.s7.paper-weapon', 1);
    expect(state.clown.paperSheets).toBe(0);
    expect(state.clown.paperSpent).toBe(3);
    expect(state.magician.figurinesHeld).toBe(1);
    expect(state.spirituality).toBe(58);
    expect(resolveMagicianCombatAbility(state, 'diviner.s7.paper-weapon', 0.9).selfGain).toBeCloseTo(10.8);
    expect(state.spirituality).toBe(58);
    expect(state.magician.figurinesHeld).toBe(1);
  });

  it('leaves scenario-only spells inert and does not resurrect or grant abilities to an ordinary character', () => {
    for (const id of ['diviner.s7.underwater-breathing', 'diviner.s7.bone-softening', 'diviner.s7.paper-figurine'] as const) {
      const state = fixture(), before = structuredClone(state);
      expect(resolveMagicianCombatAbility(state, id, 1)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before);
    }
    for (const change of [
      (s: SliceState) => { s.progression.sequence = 8; },
      (s: SliceState) => { s.status = 'DEAD'; s.health = 0; },
    ]) {
      const state = fixture(); change(state); const before = structuredClone(state);
      expect(resolveMagicianCombatAbility(state, 'diviner.s7.air-bullet', 1).selfGain).toBe(0);
      expect(state).toEqual(before);
    }
  });
});

describe('same-body, once-per-original-wound transfer', () => {
  it('reduces one original heavy injury without restoring health, removing IDs, altering risk or hurting another body', () => {
    const state = fixture(); state.health = 40; state.injuryRisk = 3;
    addOldInjury(state); addOldInjury(state, 'other-wound');
    const enemy = structuredClone(state.combat);
    const effect = resolveMagicianCombatAbility(state, 'diviner.s7.damage-transfer', 1);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(state.injuries).toEqual([
      { id: 'old-wound', severity: 'LIGHT', acquiredRevision: 0, treatedRevision: null },
      { id: 'other-wound', severity: 'HEAVY', acquiredRevision: 0, treatedRevision: null },
    ]);
    expect(state.health).toBe(40); expect(state.injuryRisk).toBe(3);
    expect(state.magician.damageTransfers).toEqual(['old-wound']);
    expect(state.combat).toEqual(enemy); expect(state.spirituality).toBe(57);
    resolveMagicianCombatAbility(state, 'diviner.s7.damage-transfer', 1);
    expect(state.magician.damageTransfers).toEqual(['old-wound', 'other-wound']);
    expect(state.spirituality).toBe(54);
    state.injuries[0]!.severity = 'HEAVY';
    const before = structuredClone(state);
    expect(resolveMagicianCombatAbility(state, 'diviner.s7.damage-transfer', 1).label).toContain('未消耗灵性');
    expect(state).toEqual(before);
  });

  it('does not cast or charge without eligible self injury or enough spirituality', () => {
    const state = fixture();
    state.combat!.enemyInjuries.push({ id: 'enemy-wound', severity: 'HEAVY', acquiredRevision: 0, treatedRevision: null });
    const before = structuredClone(state);
    resolveMagicianCombatAbility(state, 'diviner.s7.damage-transfer', 1);
    expect(state).toEqual(before);
    addOldInjury(state); state.spirituality = 2.5;
    const low = structuredClone(state);
    resolveMagicianCombatAbility(state, 'diviner.s7.damage-transfer', 1);
    expect(state).toEqual(low);
  });

  it('removes the used wound sector before the next action without adding a turn or a redraw', () => {
    const state = fixture(); addOldInjury(state); state.health = 70;
    const draws = scriptRolls(11, 1, 450, 400, 449, 1);
    const result = resolveSliceCombatRound(state, 'ATTACK');
    expect(result.round.playerCount).toBe(2);
    expect(result.round.moves).toHaveLength(3);
    expect(result.round.moves[0]!.label).toContain('伤害转移');
    expect(result.round.moves[2]!.label).toContain('失误');
    expect(result.round.playerAdvantage).toBeCloseTo(441.75);
    expect(state.health).toBe(70);
    expect(state.injuries[0]!.id).toBe('old-wound');
    expect(state.injuries[0]!.severity).toBe('LIGHT');
    expect(state.magician.damageTransfers).toEqual(['old-wound']);
    expect(draws).toHaveBeenCalledTimes(6);
  });
});

describe('finite paper substitution before pending physical consequences', () => {
  it.each([[1, 'LIGHT'], [70, 'HEAVY'], [96, 'DEATH']] as const)(
    'retains roll%i and %s while consuming one figure before any new injury or death, including health-lethal light damage', (roll, severity) => {
      const state = fixture(); prepareFigure(state); addOldInjury(state);
      state.health = 5; state.spirituality = 5;
      const injuries = structuredClone(state.injuries);
      const draws = scriptRolls(1, 1, 449, 1, 1_000_000, roll);
      const result = resolveSliceCombatRound(state, 'ATTACK');
      expect(result.outcome).toBe('CONTINUE');
      expect(result.round.winner).toBe('ENEMY');
      expect(result.round.consequenceRoll).toBe(roll);
      expect(result.round.pendingConsequence).toBe(severity);
      expect(result.round.consequenceWeights).toEqual({ light: 55, heavy: 30, death: 15 });
      expect(result.round.consequence).toContain('物理后果提交前替代');
      expect(result.round.consequence).toContain('不是死后复活');
      expect(state.health).toBe(5); expect(state.status).toBe('ACTIVE');
      expect(state.injuries).toEqual(injuries); expect(state.injuryRisk).toBe(1);
      expect(state.magician.figurinesHeld).toBe(0); expect(state.magician.figurinesUsed).toBe(1);
      expect(state.magician.figurinesMade).toBe(1);
      expect(state.clown.paperSheets).toBe(2); expect(state.clown.paperSpent).toBe(1);
      expect(state.spirituality).toBe(6); // 5 spent, then normal continuing-round recovery only.
      expect(draws).toHaveBeenCalledTimes(6); expect(state.random.cursor).toBe(6);
      expect(state.lastCombatRound).toEqual(result.round);
    },
  );

  it.each(['NO_FIGURE', 'LOW_SPIRIT', 'ONLY_RAW_PAPER'] as const)('allows real death with %s instead of inventing protection', mode => {
    const state = fixture();
    if (mode === 'LOW_SPIRIT') { prepareFigure(state); state.spirituality = 4.5; }
    const before = structuredClone(state.magician);
    scriptRolls(1, 1, 449, 1, 1_000_000, 96);
    const result = resolveSliceCombatRound(state, 'ATTACK');
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(state.health).toBe(0);
    expect(result.round.consequenceRoll).toBe(96); expect(result.round.pendingConsequence).toBe('DEATH');
    expect(state.magician).toEqual(before);
    expect(state.spirituality).toBe(mode === 'LOW_SPIRIT' ? 4.5 : 60);
  });

  it('cannot reuse a spent figure on the next fatal round', () => {
    const state = fixture(); prepareFigure(state);
    scriptRolls(1, 1, 449, 1, 1_000_000, 96);
    expect(resolveSliceCombatRound(state, 'ATTACK').outcome).toBe('CONTINUE');
    vi.restoreAllMocks();
    scriptRolls(1, 1, 1, 449, 1_000_000, 96); // even round: enemy action first
    expect(resolveSliceCombatRound(state, 'ATTACK').outcome).toBe('PLAYER_DEAD');
    expect(state.health).toBe(0);
    expect(state.magician.figurinesHeld).toBe(0); expect(state.magician.figurinesUsed).toBe(1);
  });

  it('checks the remaining spirituality after active spells, before recovery, rather than the round-opening balance', () => {
    const state = fixture(); prepareFigure(state); state.spirituality = 5;
    scriptRolls(1, 1, 254, 1, 1_000_000, 96);
    expect(resolveSliceCombatRound(state, 'ATTACK').outcome).toBe('PLAYER_DEAD');
    expect(state.spirituality).toBe(3);
    expect(state.magician.figurinesHeld).toBe(1); expect(state.magician.figurinesUsed).toBe(0);
    expect(state.health).toBe(0);
  });

  it('never revives a committed death, protects the enemy, or triggers without a physical attack', () => {
    const dead = fixture(); prepareFigure(dead); dead.health = 0; dead.status = 'DEAD';
    const before = structuredClone(dead);
    expect(resolveMagicianFigurineReplacement(dead, 'DEATH')).toBeNull();
    expect(dead).toEqual(before);
    const state = fixture(); prepareFigure(state);
    scriptRolls(1, 1, 449, 400, 1_000_000);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.consequenceWeights).toBeNull();
    expect(state.magician.figurinesHeld).toBe(1);
    vi.restoreAllMocks();
    state.combat!.round = 1;
    scriptRolls(1, 1, 1, 400, 1, 96);
    expect(resolveSliceCombatRound(state, 'ATTACK').outcome).toBe('ENEMY_DEAD');
    expect(state.magician.figurinesHeld).toBe(1); expect(state.magician.figurinesUsed).toBe(0);
  });
});

describe('old branches and deterministic replay', () => {
  it('runs a zero-spirituality round with one ordinary fallback, one consequence and no redraw', () => {
    const state = fixture(); state.spirituality = 0;
    const draws = scriptRolls(1, 1, 254, 400, 1, 1);
    const result = resolveSliceCombatRound(state, 'ATTACK');
    expect(result.round.moves[0]).toMatchObject({ selfGain: 12, enemyReduction: 0 });
    expect(result.round.moves[0]!.label).toContain('灵性不足2');
    expect(result.round.moves).toHaveLength(2); expect(draws).toHaveBeenCalledTimes(6);
    expect(state.combat!.enemyHealth).toBe(90); expect(state.spirituality).toBe(6);
  });

  it.each([null, 9, 8] as const)('preserves original sequence%s wheels, base, draws and consequence shape', sequence => {
    const state = fixture(); prepareFigure(state);
    state.progression.sequence = sequence; state.progression.pathwayId = sequence === null ? null : 'diviner';
    state.spirituality = sequence === 8 ? 45 : sequence === 9 ? 30 : 15;
    expect(playerCountWheel(state)).toEqual(sequence === 8 ? CLOWN_COUNT_WHEEL : sequence === 9 ? SEER_COUNT_WHEEL : ORDINARY_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'ATTACK')).toEqual(sequence === 8 ? clownAbilityWheel('ATTACK') : sequence === 9 ? seerAbilityWheel('ATTACK') : ordinaryAbilityWheel(false, 'ATTACK'));
    const draws = scriptRolls(1, 1, sequence === 8 ? 438 : sequence === 9 ? 270 : 440, 1, 1_000_000, 96);
    const result = resolveSliceCombatRound(state, 'ATTACK');
    expect(result.round.playerAdvantage).toBe(sequence === 8 ? 315 : sequence === 9 ? 215 : 115);
    expect(result.outcome).toBe('PLAYER_DEAD');
    expect(result.round).not.toHaveProperty('consequenceRoll');
    expect(result.round).not.toHaveProperty('pendingConsequence');
    expect(state.magician.figurinesHeld).toBe(1);
    expect(draws).toHaveBeenCalledTimes(6); expect(state.random.cursor).toBe(6);
  });

  it('uses the current Mori opponent in surrender/retreat while preserving enemy counts and actual world facts', () => {
    const state = fixture(); state.combat!.encounterId = 'MAGICIAN_DISPUTE';
    const world = structuredClone(state.world);
    scriptRolls(1, 1, 254, 400, 1, 66);
    const result = resolveSliceCombatRound(state, 'ATTACK');
    expect(result.outcome).toBe('ENEMY_SURRENDERED');
    expect(result.round.consequence).toContain('莫里仍然活着，放下短棍投降');
    expect(result.round.consequence).not.toContain('携铃者');
    expect(result.round.enemyCount).toBe(1); expect(state.world).toEqual(world);
    vi.restoreAllMocks();
    const retreat = fixture(); retreat.combat!.encounterId = 'MAGICIAN_DISPUTE'; prepareLamp(retreat);
    scriptRolls(100, 100, 50);
    expect(resolveSliceCombatRound(retreat, 'RETREAT').outcome).toBe('RETREATED');
    expect(retreat.lastCombatRound!.consequence).toContain('莫里保住了现场');
    expect(retreat.spirituality).toBe(60);
  });

  it('replays a serialized S7 round and real resources exactly without Math.random', () => {
    const state = fixture(); prepareLamp(state); prepareFigure(state); addOldInjury(state);
    state.random.cursor = 4; state.spirituality = 7; state.health = 40;
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'DEFEND')).toEqual(resolveSliceCombatRound(restored, 'DEFEND'));
    expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled();
  });
});
