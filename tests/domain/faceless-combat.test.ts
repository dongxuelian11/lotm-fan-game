import { ANCIENT_SCHOLAR_COUNT_WHEEL, currentAncientScholarCombatSource } from '../../src/domain/ancient-scholar/combat.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import {
  ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel, resolveSliceCombatRound,
} from '../../src/domain/slice/combat.js';
import { CLOWN_COUNT_WHEEL, clownAbilityWheel } from '../../src/domain/clown/combat.js';
import { SEER_COUNT_WHEEL, seerAbilityWheel } from '../../src/domain/seer/combat.js';
import { createMagicianState } from '../../src/domain/magician/index.js';
import {
  MAGICIAN_COUNT_WHEEL, currentMagicianFireSource, isMagician, magicianAbilityWheel,
  resolveMagicianCombatAbility, resolveMagicianFigurineReplacement, type MagicianFireSource,
} from '../../src/domain/magician/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

function fixture(sequence: 6 | 7 = 6): SliceState {
  const state = createSliceRun('faceless-combat-test', sliceDefaultCreationSelection, 'faceless-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.arc.stage = 'COMBAT';
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.progression = { pathwayId: 'diviner', sequence, mastery: {}, acting: 0, promotionWeek: 1 };
  state.magician = createMagicianState();
  state.spirituality = 52;
  state.clown.paperSheets = 3;
  state.clown.paperSpent = 0;
  state.world.carrierAlive = true;
  state.world.carrierCanResist = true;
  return state;
}

function prepareLamp(state: SliceState): void {
  Object.assign(state.magician.lantern, { oilStock: 5, oilHeld: 0, oilSpent: 1, prepared: true });
}

function prepareFigurine(state: SliceState): void {
  state.clown.paperSheets -= 1;
  state.clown.paperSpent += 1;
  state.magician.figurinesMade += 1;
  state.magician.figurinesHeld += 1;
}

/** Force exact choices while retaining the production stream's consumption. */
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

describe('Faceless S6 inherits the finite Magician combat profile', () => {
  it('uses the existing wheel without a face-change action, new source or passive reset', () => {
    const state = fixture(), before = structuredClone(state);
    expect(isMagician(state)).toBe(true);
    expect(playerCountWheel(state)).toEqual(MAGICIAN_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'ATTACK')).toEqual(magicianAbilityWheel(fixture(7), 'ATTACK'));
    expect(playerAbilityWheel(state, null).some(entry => /appearance|face|water|bone|figurine/.test(entry.id))).toBe(false);
    expect(state).toEqual(before);
  });

  it.each([
    ['diviner.s7.air-bullet', 2, 60, 0, true],
    ['diviner.s7.flame-control', 2, 31.2, 0, true],
    ['diviner.s7.flame-jump', 3, 0, 31.2, false],
    ['diviner.s7.illusion', 2, 0, 16, false],
    ['diviner.s7.paper-weapon', 1, 22, 0, true],
  ] as const)('%s uses explicit G advantages and its original finite cost', (id, cost, selfGain, enemyReduction, threatens) => {
    const state = fixture(); prepareLamp(state);
    const enemy = structuredClone(state.combat), lamp = structuredClone(state.magician.lantern);
    const effect = resolveMagicianCombatAbility(state, id, 1);
    expect(effect).toMatchObject({ selfGain, enemyReduction, threatens });
    expect(effect.label).toContain('（G）');
    expect(state.spirituality).toBe(52 - cost);
    expect(state.combat).toEqual(enemy);
    expect(state.magician.lantern).toEqual(lamp);
    expect(state.clown.paperSheets).toBe(id === 'diviner.s7.paper-weapon' ? 2 : 3);
    expect(state.clown.paperSpent).toBe(id === 'diviner.s7.paper-weapon' ? 1 : 0);
    expect(state.random.cursor).toBe(0);
    if (id === 'diviner.s7.flame-jump') {
      expect(effect.label).toContain('同场2米');
      expect(effect.label).toContain('仍在战斗中');
    }
  });

  it.each(['diviner.s7.flame-control', 'diviner.s7.flame-jump'] as const)(
    '%s requires the original lit lamp, current encounter and exact 2m source before charging', id => {
      const mutations: ((state: SliceState) => void)[] = [
        s => { s.magician.lantern.prepared = false; },
        s => { s.magician.lantern.oilSpent = 0; },
        s => { s.world.city = 'ELSEWHERE'; },
        s => { s.world.carrierAlive = false; },
        s => { s.world.carrierCanResist = false; },
        s => { s.arc.stage = 'ENDED'; },
        s => { s.combat!.encounterId = 'HUNTER_CARGO'; },
        s => { s.combat!.enemyStatus = 'SURRENDERED'; },
        s => { s.combat = null; },
      ];
      for (const mutate of mutations) {
        const state = fixture(); prepareLamp(state);
        const source = currentMagicianFireSource(state);
        mutate(state); const before = structuredClone(state);
        expect(currentMagicianFireSource(state)).toBeNull();
        expect(resolveMagicianCombatAbility(state, id, 1, source))
          .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
        expect(state).toEqual(before);
      }
      const state = fixture(); prepareLamp(state);
      const source = currentMagicianFireSource(state)!;
      expect(source).toEqual({ encounterId: 'FIRST_CASE', round: 1, source: 'CARRIED_LANTERN', distanceMetres: 2 });
      for (const invalid of [null, { ...source, round: 2 }, { ...source, encounterId: 'CLOWN_RESCUE' },
        { ...source, distanceMetres: 30 }, { ...source, distanceMetres: 39 }, { ...source, source: 'IMAGINARY_FIRE' }]) {
        const before = structuredClone(state);
        expect(resolveMagicianCombatAbility(state, id, 1, invalid as MagicianFireSource | null))
          .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
        expect(state).toEqual(before);
      }
    },
  );

  it('inherits the actual rescue/Mori opponent without reviving an old first-case carrier', () => {
    for (const encounterId of ['CLOWN_RESCUE', 'MAGICIAN_DISPUTE'] as const) {
      const state = fixture(); prepareLamp(state);
      state.combat!.encounterId = encounterId; state.arc.stage = 'ENDED';
      state.world.carrierAlive = false; state.world.carrierCanResist = false;
      expect(currentMagicianFireSource(state)).toMatchObject({ encounterId, distanceMetres: 2 });
      expect(resolveMagicianCombatAbility(state, 'diviner.s7.flame-jump', 1).enemyReduction).toBe(31.2);
      expect(resolveMagicianCombatAbility(state, 'diviner.s8.danger-prediction', 1).enemyReduction).toBe(22);
      expect(resolveMagicianCombatAbility(state, 'diviner.s9.spiritual-sight', 1).label)
        .toContain(encounterId === 'MAGICIAN_DISPUTE' ? '莫里' : '勒索者');
      expect(state.world.carrierAlive).toBe(false);
      expect(state.combat!.enemyStatus).toBe('RESISTING');
    }
  });

  it('spends only original paper and retains an already prepared figurine separately', () => {
    const state = fixture(); prepareFigurine(state);
    expect(resolveMagicianCombatAbility(state, 'diviner.s8.paper-dagger', 1).selfGain).toBe(34);
    expect(resolveMagicianCombatAbility(state, 'diviner.s7.paper-weapon', 1).selfGain).toBe(22);
    expect(state.clown.paperSheets).toBe(0); expect(state.clown.paperSpent).toBe(3);
    expect(state.magician.figurinesHeld).toBe(1); expect(state.spirituality).toBe(50);
    expect(resolveMagicianCombatAbility(state, 'diviner.s7.paper-weapon', 1).selfGain).toBe(12);
    expect(state.magician.figurinesHeld).toBe(1); expect(state.spirituality).toBe(50);
    expect(state.clown.paperSheets).toBe(0); expect(state.clown.paperSpent).toBe(3);
  });

  it('retains once-per-original-wound transfer, health, accumulated risk and enemy state', () => {
    const state = fixture(); state.health = 40; state.injuryRisk = 3;
    state.injuries.push({ id: 'original-heavy-wound', severity: 'HEAVY', acquiredRevision: 0, treatedRevision: null });
    const enemy = structuredClone(state.combat);
    resolveMagicianCombatAbility(state, 'diviner.s7.damage-transfer', 1);
    expect(state.injuries[0]).toEqual({ id: 'original-heavy-wound', severity: 'LIGHT', acquiredRevision: 0, treatedRevision: null });
    expect(state.magician.damageTransfers).toEqual(['original-heavy-wound']);
    expect(state.spirituality).toBe(49); expect(state.health).toBe(40); expect(state.injuryRisk).toBe(3);
    expect(state.combat).toEqual(enemy);
    state.injuries[0]!.severity = 'HEAVY';
    const before = structuredClone(state);
    resolveMagicianCombatAbility(state, 'diviner.s7.damage-transfer', 1);
    expect(state).toEqual(before);
  });

  it('uses the same prepared figurine and 5 spirituality before one physical consequence', () => {
    const state = fixture(); prepareFigurine(state); state.health = 15; state.injuryRisk = 2;
    state.injuries.push({ id: 'old-light-wound', severity: 'LIGHT', acquiredRevision: 0, treatedRevision: null });
    const injuries = structuredClone(state.injuries), enemy = structuredClone(state.combat);
    expect(resolveMagicianFigurineReplacement(state, 'DEATH')?.label).toContain('不是死后复活');
    expect(state.magician).toMatchObject({ figurinesMade: 1, figurinesHeld: 0, figurinesUsed: 1 });
    expect(state.spirituality).toBe(47); expect(state.health).toBe(15); expect(state.injuryRisk).toBe(2);
    expect(state.injuries).toEqual(injuries); expect(state.combat).toEqual(enemy);
    const before = structuredClone(state);
    expect(resolveMagicianFigurineReplacement(state, 'DEATH')).toBeNull();
    expect(state).toEqual(before);
  });

  it.each(['NO_FIGURINE', 'LOW_SPIRIT', 'DEAD'] as const)('does not fabricate substitution with %s', mode => {
    const state = fixture();
    if (mode !== 'NO_FIGURINE') prepareFigurine(state);
    if (mode === 'LOW_SPIRIT') state.spirituality = 4;
    if (mode === 'DEAD') { state.health = 0; state.status = 'DEAD'; }
    const before = structuredClone(state);
    expect(resolveMagicianFigurineReplacement(state, 'DEATH')).toBeNull();
    expect(state).toEqual(before);
  });

  it.each(['diviner.s7.underwater-breathing', 'diviner.s7.bone-softening', 'diviner.s7.paper-figurine'] as const)(
    '%s does not invent a combat scene or an immediate-action bonus', id => {
      const state = fixture(), before = structuredClone(state);
      expect(resolveMagicianCombatAbility(state, id, 1)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before);
    },
  );

  it.each([
    ['diviner.s7.air-bullet', 12, 0], ['diviner.s7.flame-control', 12, 0],
    ['diviner.s7.flame-jump', 0, 10], ['diviner.s7.illusion', 0, 10], ['diviner.s7.paper-weapon', 12, 0],
  ] as const)('%s at zero spirituality uses only its ordinary fallback', (id, selfGain, enemyReduction) => {
    const state = fixture(); prepareLamp(state); state.spirituality = 0;
    const before = structuredClone(state);
    expect(resolveMagicianCombatAbility(state, id, 1)).toMatchObject({ selfGain, enemyReduction });
    expect(state).toEqual(before);
  });

  it('resolves an actual air-bullet round with unchanged enemy behavior and bounded recovery, not a refill', () => {
    const state = fixture(); state.spirituality = 30;
    const draws = scriptRolls(1, 1, 254, 400, 1, 1);
    const result = resolveSliceCombatRound(state, 'ATTACK');
    expect(result.outcome).toBe('CONTINUE');
    expect(result.round.playerCount).toBe(1); expect(result.round.enemyCount).toBe(1);
    expect(result.round.moves).toHaveLength(2);
    expect(result.round.moves[0]).toMatchObject({ selfGain: 60, enemyReduction: 0 });
    expect(result.round.moves[0]!.label).toContain('空气弹');
    expect(state.spirituality).toBe(36); // 30 - original cost2 + 10% of S6 G max80.
    expect(state.combat!.enemyHealth).toBe(90); expect(state.combat!.enemyStatus).toBe('RESISTING');
    expect(draws).toHaveBeenCalledTimes(6); expect(state.random.cursor).toBe(6);
  });

  it.each([
    ['diviner.s7.air-bullet', 2, 30, 0], ['diviner.s7.flame-control', 2, 24, 0],
    ['diviner.s7.flame-jump', 3, 0, 24],
  ] as const)('keeps old S7 %s values and costs unchanged', (id, cost, selfGain, enemyReduction) => {
    const state = fixture(7); prepareLamp(state);
    expect(resolveMagicianCombatAbility(state, id, 1)).toMatchObject({ selfGain, enemyReduction });
    expect(state.spirituality).toBe(52 - cost);
  });

  it.each([9, 8] as const)('preserves sequence%s wheel routing', sequence => {
    const state = fixture(); state.progression.sequence = sequence;
    expect(isMagician(state)).toBe(false);
    expect(playerCountWheel(state)).toEqual(sequence === 9 ? SEER_COUNT_WHEEL : CLOWN_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'ATTACK')).toEqual(sequence === 9 ? seerAbilityWheel('ATTACK') : clownAbilityWheel('ATTACK'));
  });

  it('does not grant an S3 or another pathway combat source via saved Magician resources', () => {
    for (const sequence of [3, 6, 2] as const) {
      const state = fixture(); prepareLamp(state); prepareFigurine(state);
      state.progression.sequence = sequence as SliceState['progression']['sequence'];
      if (sequence === 6) state.progression.pathwayId = 'hunter';
      if (sequence === 2) state.progression.pathwayId = 'abyss';
      const before = structuredClone(state);
      expect(isMagician(state)).toBe(false);
      const withoutMagician = structuredClone(state); withoutMagician.magician = createMagicianState();
      expect(playerCountWheel(state)).toEqual(sequence === 3 ? ANCIENT_SCHOLAR_COUNT_WHEEL : sequence === 2 ? ORDINARY_COUNT_WHEEL : playerCountWheel(withoutMagician));
      if (sequence === 2) expect(playerAbilityWheel(state, 'ATTACK')).toEqual(ordinaryAbilityWheel(false, 'ATTACK'));
      expect(playerCountWheel(state)).toEqual(playerCountWheel(withoutMagician));
      expect(currentAncientScholarCombatSource(state)).toBeNull();
      expect(currentMagicianFireSource(state)).toBeNull();
      expect(resolveMagicianCombatAbility(state, 'diviner.s7.air-bullet', 1).selfGain).toBe(0);
      expect(resolveMagicianFigurineReplacement(state, 'DEATH')).toBeNull();
      expect(state).toEqual(before);
    }
  });
});
