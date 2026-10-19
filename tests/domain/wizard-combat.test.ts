import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { COMBAT_SCHOLAR_COUNT_WHEEL, combatScholarAbilityWheel,
  resolveCombatScholarCombatAbility } from '../../src/domain/combat-scholar/combat.js';
import { WIZARD_COUNT_WHEEL, drawWizardAbility, isWizard, resolveWizardCombatAbility,
  wizardAbilityWheel, wizardActionCount, type WizardMoveId } from '../../src/domain/wizard/combat.js';
import * as wizardCombat from '../../src/domain/wizard/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const spellcraft = 'hermit.s7.spellcraft', training = 'hermit.s8.combat-study';
const vision = 'hermit.s9.spirit-vision', ritual = 'hermit.s9.ritual-lore';
const ids = [spellcraft, 'BODY_FOLLOWUP', 'BRIEF_WARD', 'BLUR_MARK', ritual, 'ACCIDENT'] as const;
/** Synthetic combat-only setup; learned spells retain their matching learning evidence. */
function fixture(learned = false): SliceState {
  const state = createSliceRun('wizard-combat-test', sliceDefaultCreationSelection, 'wizard-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'hermit', sequence: 7, acting: 0, promotionWeek: 1,
    mastery: { [spellcraft]: 0, [training]: 0, [vision]: 0, [ritual]: 0, 'hermit.s9.occult-study': 0 } };
  for (const id of ['light-touch', 'brief-ward', 'blur-mark']) {
    state.wizard.lessons[id] = { learned, attemptWeek: learned ? state.week : null };
    if (learned) state.seer.completedSources.push(`wizard-learning:${id}`);
  }
  state.arc.stage = 'COMBAT'; state.world.city = 'BACKLUND';
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.spirituality = 60;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: WizardMoveId, physical = 1) {
  return resolveWizardCombatAbility(state, id, physical, stream(state));
}
/** Script known tickets while still advancing the production replay cursor. */
function scriptRolls(...rolls: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt;
  let index = 0;
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
afterEach(() => vi.restoreAllMocks());

describe('Wizard S7 learned G spells and inherited actions', () => {
  it('dispatches exact six-slot and count weights with one draw per stance ticket', () => {
    const state = fixture();
    expect(isWizard(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(wizardAbilityWheel(null, state));
    expect(wizardAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(wizardAbilityWheel(null).map(entry => entry.weight)).toEqual([30, 15, 25, 15, 10, 5]);
    expect(playerCountWheel(state)).toEqual(WIZARD_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([10, 15, 25, 30, 20]);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3],
      [51, 4], [80, 4], [81, 5], [100, 5]]) expect(wizardActionCount(roll!)).toBe(count);
    for (const [stance, weights] of [
      [null, [120, 60, 100, 60, 40, 20]], ['ATTACK', [150, 75, 100, 60, 40, 20]],
      ['DEFEND', [120, 60, 125, 60, 40, 20]], ['CONTROL', [120, 60, 100, 75, 40, 20]],
      ['PREPARE', [120, 60, 100, 60, 50, 20]],
    ] as const) {
      const total = weights.reduce<number>((sum, n) => sum + n, 0);
      expect(wizardAbilityWheel(stance).map(entry => entry.weight))
        .toEqual(weights.map(n => total === 400 ? n / 4 : n / total * 100));
      let boundary = 0;
      for (let index = 0; index < weights.length; index++) {
        const first = boundary + 1; boundary += weights[index]!;
        const draws = scriptRolls(first, boundary), random = stream(state);
        expect(drawWizardAbility(random, stance)).toBe(ids[index]);
        expect(drawWizardAbility(random, stance)).toBe(ids[index]);
        expect(draws).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2); vi.restoreAllMocks();
      }
    }
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(30);
    expect(playerCountWheel(state)[0]!.weight).toBe(10);
  });

  it('requires each actual learned flag even at full mastery and after a recorded lesson attempt', () => {
    const state = fixture();
    for (const id of Object.keys(state.progression.mastery)) state.progression.mastery[id] = 500;
    for (const lesson of Object.values(state.wizard.lessons)) lesson.attemptWeek = state.week;
    const before = structuredClone(state);
    expect(resolve(state, spellcraft, 0.8).selfGain).toBe(12 * 0.8);
    expect(resolve(state, 'BRIEF_WARD', 0.8).enemyReduction).toBe(27);
    expect(resolve(state, 'BLUR_MARK', 0.8).enemyReduction).toBe(18.9 * 0.8);
    before.spirituality -= 1;
    expect(state).toEqual(before);
    state.wizard.lessons['light-touch']!.learned = true;
    state.seer.completedSources.push('wizard-learning:light-touch');
    expect(resolve(state, spellcraft, 0).selfGain).toBe(45);
    expect(resolve(state, 'BRIEF_WARD', 0).enemyReduction).toBe(27);
    expect(resolve(state, 'BLUR_MARK', 0).enemyReduction).toBe(0);
  });

  it('uses only spellcraft for learned H45/B54/K37.8 and original training for J16.8', () => {
    for (const mastery of [0, 100, 500]) {
      const state = fixture(true); state.progression.mastery[spellcraft] = mastery;
      state.progression.mastery[training] = 500; state.progression.mastery[vision] = 500;
      state.progression.mastery[ritual] = 500;
      const before = structuredClone(state), factor = 0.65 + 0.35 * mastery / 500;
      expect(resolve(state, spellcraft, 0.8)).toMatchObject({ selfGain: 45 * factor, enemyReduction: 0, threatens: true });
      expect(resolve(state, 'BRIEF_WARD', 0.8)).toMatchObject({ selfGain: 0, enemyReduction: 54 * factor, threatens: false });
      expect(resolve(state, 'BLUR_MARK', 0.8)).toMatchObject({ selfGain: 0, enemyReduction: 37.8 * factor, threatens: false });
      expect(resolve(state, 'BODY_FOLLOWUP', 0.8).selfGain).toBe(16.8 * 0.8);
      before.spirituality -= 6;
      expect(state).toEqual(before); // No materials, lesson, equipment or mastery mutation.
    }
  });

  it('pays exactly2S or falls back without overdraft; B can still spend1S on inherited vision', () => {
    for (const spirituality of [0, 0.5, 1, 1.5, 2, Number.NaN, Number.POSITIVE_INFINITY]) {
      for (const id of [spellcraft, 'BRIEF_WARD', 'BLUR_MARK'] as const) {
        const state = fixture(true); state.spirituality = spirituality;
        state.progression.mastery[training] = 500; state.progression.mastery[vision] = 100;
        const canSpell = Number.isFinite(spirituality) && spirituality >= 2;
        const canVision = Number.isFinite(spirituality) && spirituality >= 1;
        const effect = resolve(state, id, 0.8);
        const contribution = id === spellcraft ? effect.selfGain : effect.enemyReduction;
        expect(contribution).toBe(canSpell ? (id === spellcraft ? 45 : id === 'BRIEF_WARD' ? 54 : 37.8) * 0.65
          : id === spellcraft ? 12 * 0.8 : id === 'BLUR_MARK' ? 18.9 * 0.8 : canVision ? 27 * (0.65 + 0.35 * 100 / 500) : 8);
        expect(state.spirituality).toBe(canSpell ? spirituality - 2
          : id === 'BRIEF_WARD' && canVision ? spirituality - 1 : spirituality);
      }
    }
  });

  it('only the actual Town HAND original replaces H with16physical and costs noS', () => {
    for (const location of ['SHOP', 'BAG', 'HAND'] as const) {
      const state = fixture(true); state.town.clubLocation = location;
      state.progression.mastery[spellcraft] = 500;
      Object.assign(state.warrior.practiceClub, { custodian: 'PLAYER', location: 'player:hand' });
      const before = structuredClone(state);
      expect(resolve(state, spellcraft, 0.8).selfGain).toBe(location === 'HAND' ? 16 * 0.8 : 45);
      before.spirituality -= location === 'HAND' ? 0 : 2;
      expect(state).toEqual(before);
      if (location === 'HAND') expect(playerAbilityWheel(state, null)[0]!.label).toBe('持握原短棍打击');
    }
  });

  it('requires this living resisting FIRST_CASE opponent before any action or cost', () => {
    for (const mutate of [
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.status = 'DEAD'; }, (s: SliceState) => { s.combat!.enemyHealth = 0; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.progression.sequence = 8; },
      (s: SliceState) => { s.arc.stage = 'C'; }, (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
      (s: SliceState) => { s.world.carrierAlive = false; }, (s: SliceState) => { s.world.carrierCanResist = false; },
      (s: SliceState) => { s.combat!.encounterId = 'HUNTER_CARGO'; },
    ]) {
      const state = fixture(true); mutate(state); const before = structuredClone(state), random = stream(state);
      for (const id of ids) expect(resolveWizardCombatAbility(state, id, 1, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('gives no ritual source or learned flags, signed11.25 accident, and retains the S8 profile', () => {
    const state = fixture(); state.progression.mastery[ritual] = 500;
    const before = structuredClone(state), random = stream(state);
    expect(resolveWizardCombatAbility(state, ritual, 1, random))
      .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    scriptRolls(1, 2);
    expect(resolveWizardCombatAbility(state, 'ACCIDENT', 1, random))
      .toMatchObject({ selfGain: -11.25, enemyReduction: 0, threatens: false });
    expect(resolveWizardCombatAbility(state, 'ACCIDENT', 1, random))
      .toMatchObject({ selfGain: 11.25, enemyReduction: 0, threatens: false });
    expect(random.cursor).toBe(2); expect(state).toEqual(before);
    state.progression.sequence = 8;
    expect(isWizard(state)).toBe(false);
    expect(playerCountWheel(state)).toEqual(COMBAT_SCHOLAR_COUNT_WHEEL);
    expect(playerAbilityWheel(state, null)).toEqual(combatScholarAbilityWheel(null, state));
    expect(resolveCombatScholarCombatAbility(state, training, 1, stream(state)).selfGain).toBe(24 * 0.65);
  });
});

describe('Wizard uses shared complete round and public-command settlement', () => {
  it('uses core15/25/25/35, base450, floor45 and one capped max60 round recovery', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 0;
    scriptRolls(1, 1, 386, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(478 * 0.8);
    expect(state.spirituality).toBe(6); vi.restoreAllMocks();
    const full = fixture(); full.spirituality = 59;
    scriptRolls(1, 1, 386, 400, 1);
    resolveSliceCombatRound(full, 'ATTACK'); expect(full.spirituality).toBe(60); vi.restoreAllMocks();
    vi.spyOn(wizardCombat, 'resolveWizardCombatAbility').mockReturnValue({
      label: 'controlled negative contribution', selfGain: -1_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 386, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(45);
  });

  it('keeps three real enemy strikes and common injury after five separately paid player slots', () => {
    const state = fixture(true), before = structuredClone(state);
    const draws = scriptRolls(100, 100, 1, 1, 151, 1, 226, 1, 326, 386, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER',
    ]);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction]))
      .toEqual([[45 * 0.65, 0], [16.8 * 0.65, 0], [0, 54 * 0.65], [0, 37.8 * 0.65], [0, 0]]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
    expect(round.playerAdvantage).toBe(465 + (45 * 0.65 + 16.8 * 0.65));
    expect(round.enemyAdvantage).toBe(114 + 48 - (54 * 0.65 + 37.8 * 0.65));
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90);
    expect(state.spirituality).toBe(60); expect(state.progression).toEqual(before.progression);
    expect(state.wizard).toEqual(before.wizard); expect(state.town).toEqual(before.town);
    expect(draws).toHaveBeenCalledTimes(12); expect(state.random.cursor).toBe(before.random.cursor + 12);
  });

  it('can still die through common consequences and replays complete public command state without Math.random', () => {
    const dying = fixture(true); dying.health = 40; dying.spirituality = 5; dying.injuryRisk = 1;
    dying.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    scriptRolls(1, 1, 226, 1, 1_000_000, 96);
    const dead = applySliceIntent(dying, { type: 'COMBAT_ROUND', stance: 'ATTACK' });
    expect(dead.status).toBe('DEAD'); expect(dead.health).toBe(0); expect(dead.spirituality).toBe(3);
    expect(dead.lastCombatRound!.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
    expect(dead.wizard).toEqual(dying.wizard); vi.restoreAllMocks();
    const original = fixture(true); original.town.clubLocation = 'HAND'; original.random.cursor = 7; original.health = 70;
    const before = structuredClone(original), restored = JSON.parse(JSON.stringify(original)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    const left = applySliceIntent(original, { type: 'COMBAT_ROUND', stance: 'CONTROL' });
    const right = applySliceIntent(restored, { type: 'COMBAT_ROUND', stance: 'CONTROL' });
    expect(left).toEqual(right); expect(projectSliceState(left)).toEqual(projectSliceState(right));
    expect(original).toEqual(before); expect(restored).toEqual(before); expect(forbidden).not.toHaveBeenCalled();
    expect(left.town.clubLocation).toBe('HAND'); expect(left.wizard).toEqual(before.wizard);
  });
});
