import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SeerContext } from '../../src/domain/seer/index.js';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createSilverKnightState } from '../../src/domain/silver-knight/index.js';
import { applySilverKnightEncounterCommand, currentSilverKnightBody, SILVER_KNIGHT_SPECIES, type SilverKnightSpeciesId } from '../../src/domain/silver-knight/encounter.js';
import { beginSilverKnightCombatRound, currentSilverKnightCombatSource, resolveSilverKnightCombatAbility, resolveSilverKnightEnemyAbility,
  finishSilverKnightCombatRound, validateSilverKnightRoundOutcome, silverKnightAbilityWheel, silverKnightActionCount, silverKnightEnemyActionCount,
  drawSilverKnightAbility, drawSilverKnightEnemyAbility, SILVER_KNIGHT_COUNT_WHEEL, SILVER_KNIGHT_ENEMY_COUNT_WHEEL,
  attemptSilverKnightRetreat, type SilverKnightMoveId, type SilverKnightRoundContext } from '../../src/domain/silver-knight/combat.js';
import { resolveSilverKnightCombatRound } from '../../src/domain/slice/silver-knight-combat.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';

const H = 'warrior.s6.dawn-weapon', J = 'warrior.s4.targeted-preparation', B = 'warrior.s5.guard-state', K = 'warrior.s4.discern-corruption', R = 'warrior.s4.veil-intent';
const A = 'warrior.s3.silver-armor', L = 'warrior.s3.light-concealment', T = 'warrior.s3.silver-thrust';
const ctx: SeerContext = { note: () => {}, roll: min => min, check: () => { throw new Error('Unexpected scene check'); } };
function random(...values: number[]): ActionRandomStream { let cursor = 0; return { seed: 'directed-unit-silver', get cursor() { return cursor; }, nextInt(min, max) {
  const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected draw ${cursor}: ${n}, ${min}..${max}`); return n;
} }; }
/** Explicitly directed unit resources on the unchanged natural340 S4 origin. Never natural campaign evidence. */
function fixture(species: SilverKnightSpeciesId | 'POST' = 'ROCK_HUSK', prepared = false): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/demon-hunter-v01290/natural.json', 'utf8')).final);
  s.silverKnight = createSilverKnightState(); s.silverKnight.guidanceKnown = true; s.actionsRemaining = 20; s.cash = 20000;
  s.health = 100; s.mind = 100; s.spirituality = 120; s.activeEvent = null; s.combat = null; s.town.clubLocation = 'SHOP';
  if (species === 'POST') {
    s.progression.sequence = 3; s.silverKnight.promotionWeek = s.week; s.silverKnight.demonHunterActingAtPromotion = 100;
    for (const id of [A, L, T]) s.progression.mastery[id] = 0;
    applySilverKnightEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, ctx); applySilverKnightEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx);
  } else {
    applySilverKnightEncounterCommand(s, { type: 'INVESTIGATE_HUNT', speciesId: species }, ctx);
    if (prepared) applySilverKnightEncounterCommand(s, { type: 'PREPARE_HUNT', speciesId: species }, ctx);
    applySilverKnightEncounterCommand(s, { type: 'HUNT_FIGHT', speciesId: species }, ctx);
  }
  return s;
}
const player = (s: SliceState, r: SilverKnightRoundContext, id: SilverKnightMoveId, rng = random()) => resolveSilverKnightCombatAbility(s, id, 1, rng, r);
const enemy = (s: SliceState, r: SilverKnightRoundContext, id: 'PRIMARY' | 'DEFENSE' | 'TRAIT' | 'BODY_STRIKE' | 'ACCIDENT') => resolveSilverKnightEnemyAbility(s, id, 1, random(), r);
function scriptedRound(s: SliceState, stance: SliceStance, ...values: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt; let cursor = 0;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected shared draw ${cursor}: ${n}`); return n;
  });
  try { const result = resolveSilverKnightCombatRound(s, stance); expect(spy).toHaveBeenCalledTimes(values.length); return result; }
  finally { spy.mockRestore(); }
}
afterEach(() => vi.restoreAllMocks());

describe('Silver Knight actual S4 inheritance and S3 six slots', () => {
  it('retains original30/15/20/20/10/5 weights and both actual1–6 count wheels', () => {
    const s = fixture(), post = fixture('POST');
    expect(silverKnightAbilityWheel(s, null).map(a => [a.id, a.weight])).toEqual([[H, 30], [J, 15], [B, 20], [K, 20], [R, 10], ['ACCIDENT', 5]]);
    expect(silverKnightAbilityWheel(post, null).map(a => [a.id, a.weight])).toEqual([[H, 30], [T, 15], [A, 20], [L, 20], [B, 10], ['ACCIDENT', 5]]);
    expect(SILVER_KNIGHT_COUNT_WHEEL).toEqual(SILVER_KNIGHT_ENEMY_COUNT_WHEEL);
    expect([1, 11, 26, 51, 76, 91].map(silverKnightActionCount)).toEqual([1, 2, 3, 4, 5, 6]);
    expect([1, 11, 26, 51, 76, 91].map(silverKnightEnemyActionCount)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(drawSilverKnightAbility(random(1), s, 'ATTACK')).toBe(H);
    expect([1, 36, 61, 76, 96].map(n => drawSilverKnightEnemyAbility(random(n)))).toEqual(['PRIMARY', 'DEFENSE', 'TRAIT', 'BODY_STRIKE', 'ACCIDENT']);
  });
  it('binds six genuinely different original targets and budgets without touching the surrendered old cinder guard', () => {
    const max = [90, 120, 100, 100, 110, 80];
    for (const [i, species] of SILVER_KNIGHT_SPECIES.entries()) {
      const s = fixture(species), source = currentSilverKnightCombatSource(s);
      expect(source).toMatchObject({ mode: 'HUNT', targetId: `SK3-HUNT-${species}-1`, speciesId: species, playerSequence: 4, playerMaxSpirituality: 120, enemyTier: 1100, enemyCore: 20, enemyMaxSpirituality: max[i] });
      expect(s.demonHunter.encounter).toMatchObject({ targetId: 'DH4-CINDER-GUARD', enemyHealth: 70, enemySpirituality: 14, enemyStatus: 'SURRENDERED' });
    }
  });
  it('rejects S3 skills before promotion and stale body, original item, or source changes with no draws', () => {
    const s = fixture(), r = beginSilverKnightCombatRound(s, 'ATTACK'), rng = random();
    for (const id of [A, L, T] as const) expect(player(s, r, id, rng).threatens).toBe(false);
    expect(s.spirituality).toBe(120); expect(rng.cursor).toBe(0);
    s.town.clubLocation = 'HAND'; const before = structuredClone(s);
    expect(player(s, r, H).selfGain).toBe(0); expect(s).toEqual(before);
  });
  it('pays the real inherited summon/strike and exact-target coatings; old coating never moves', () => {
    const s = fixture('ROCK_HUSK', true), old = structuredClone(s.demonHunter.encounter.coatings), r = beginSilverKnightCombatRound(s, 'ATTACK');
    expect(player(s, r, J).selfGain).toBe(8); player(s, r, K, random(1)); player(s, r, H);
    const b = currentSilverKnightBody(s)!; expect(b.resources.swordReady).toBe(true); expect(s.spirituality).toBe(110);
    player(s, r, J); player(s, r, J); expect(b.resources.coatings.every(c => c.status === 'SPENT')).toBe(true);
    expect(player(s, r, J).selfGain).toBe(8); expect(s.spirituality).toBe(106); expect(s.demonHunter.encounter.coatings).toEqual(old);
  });
  it('holds an occupied original club without summoning an extra sword', () => {
    const s = fixture(); s.town.clubLocation = 'HAND'; const r = beginSilverKnightCombatRound(s, 'ATTACK');
    expect(player(s, r, H)).toMatchObject({ selfGain: 16, threatens: true }); expect(s.spirituality).toBe(120); expect(currentSilverKnightBody(s)!.resources.swordReady).toBe(false);
  });
  it('failed observation and intent concealment spend realS without free diagnosis', () => {
    const s = fixture(), r = beginSilverKnightCombatRound(s, 'ATTACK'); player(s, r, K, random(100)); player(s, r, R, random(100));
    expect(s.spirituality).toBe(113); expect(r.ledger.veilReady).toBe(false); expect(currentSilverKnightBody(s)!.resources.weaknessObserved).toBe(false);
  });
  it('full DEFEND pays3 once, forfeits all attacks and never marks blocking as bodily threat', () => {
    const s = fixture('POST'), r = beginSilverKnightCombatRound(s, 'DEFEND');
    expect(s.spirituality).toBe(117); expect(player(s, r, H).threatens).toBe(false); expect(player(s, r, T).threatens).toBe(false);
    expect(player(s, r, B).threatens).toBe(false); expect(enemy(s, r, 'BODY_STRIKE').selfGain).toBe(7);
  });
});

describe('Six real limited species traits', () => {
  it('actually cracks only two original stone armor layers then weaker ordinary defense', () => {
    const s = fixture('ROCK_HUSK'), r = beginSilverKnightCombatRound(s, 'ATTACK');
    expect(enemy(s, r, 'DEFENSE').enemyReduction).toBe(45); expect(enemy(s, r, 'DEFENSE').enemyReduction).toBe(45);
    expect(enemy(s, r, 'DEFENSE')).toMatchObject({ enemyReduction: 12, threatens: false });
    expect(currentSilverKnightBody(s)!.resources).toMatchObject({ stoneArmorCharges: 0, enemySpirituality: 80, spentSpirituality: 10 });
  });
  it('two paid consecutive fire charges require a real cooldown action without spiritual refund', () => {
    const s = fixture('EMBER_WING'), r = beginSilverKnightCombatRound(s, 'ATTACK'); enemy(s, r, 'PRIMARY'); enemy(s, r, 'PRIMARY');
    expect(enemy(s, r, 'PRIMARY')).toMatchObject({ selfGain: 0, threatens: false }); expect(r.enemyActions.at(-1)?.actual).toBe('COOL_DOWN');
    expect(currentSilverKnightBody(s)!.resources.enemySpirituality).toBe(104);
  });
  it('finite mist blocks one actual aimed sword and a real successful dawn observation clears it', () => {
    const s = fixture('MIST_ANTLER'), r = beginSilverKnightCombatRound(s, 'ATTACK'); enemy(s, r, 'DEFENSE');
    expect(player(s, r, H)).toMatchObject({ selfGain: 0, threatens: false }); expect(s.spirituality).toBe(114);
    enemy(s, r, 'DEFENSE'); player(s, r, K, random(1)); expect(player(s, r, H).threatens).toBe(true);
    expect(currentSilverKnightBody(s)!.resources.mistCharges).toBe(1);
  });
  it('shadow binding consumes actual attack slots or paid release and constrains ordinary retreat', () => {
    const s = fixture('THORN_SHADOW'), r = beginSilverKnightCombatRound(s, 'ATTACK'); enemy(s, r, 'TRAIT');
    expect(player(s, r, H).threatens).toBe(false); expect(r.ledger.boundSlots).toBe(1);
    player(s, r, K); expect(r.ledger.boundSlots).toBe(0); expect(s.spirituality).toBe(117); expect(player(s, r, H).threatens).toBe(true);
    const retreat = fixture('THORN_SHADOW'), rr = beginSilverKnightCombatRound(retreat, 'RETREAT'); enemy(retreat, rr, 'TRAIT');
    expect(attemptSilverKnightRetreat(retreat, rr, random(1))).toBe(true); expect(retreat.spirituality).toBe(117); expect(rr.retreatActions[0]?.paidCost).toBe(3);
    const low = fixture('THORN_SHADOW'); low.spirituality = 2; const lr = beginSilverKnightCombatRound(low, 'RETREAT'); enemy(low, lr, 'TRAIT');
    expect(attemptSilverKnightRetreat(low, lr, random())).toBe(false); expect(low.spirituality).toBe(2); expect(lr.retreatActions[0]?.roll).toBeNull();
  });
  it('bone resonance pays8 and reduces actual mind through guarding, bounded at1 without a frozen M0 fight', () => {
    const s = fixture('RESONANT_BONE'); s.mind = 3; const r = beginSilverKnightCombatRound(s, 'DEFEND');
    expect(enemy(s, r, 'TRAIT')).toMatchObject({ mentalPressure: true, threatens: false, selfGain: 0 }); expect(s.mind).toBe(1);
    expect(enemy(s, r, 'TRAIT').threatens).toBe(false); expect(s.mind).toBe(1); expect(currentSilverKnightBody(s)!.resources.enemySpirituality).toBe(94);
    expect(currentSilverKnightCombatSource(s)).not.toBeNull();
  });
  it('cold slow affects one later real attack and a genuinely purchased original ward resists once', () => {
    const s = fixture('FROST_SPINE'), r = beginSilverKnightCombatRound(s, 'ATTACK'); enemy(s, r, 'TRAIT');
    const first = player(s, r, H).selfGain, second = player(s, r, H).selfGain; expect(first).toBeCloseTo(second * .65);
    const prepared = fixture('FROST_SPINE', true), pr = beginSilverKnightCombatRound(prepared, 'ATTACK'); enemy(prepared, pr, 'TRAIT');
    expect(pr.ledger.frostPending).toBe(false); expect(currentSilverKnightBody(prepared)!.resources.frostWardAvailable).toBe(false);
    enemy(prepared, pr, 'TRAIT'); expect(pr.ledger.frostPending).toBe(true);
  });
});

describe('Silver armor, original light, targeted blade and replayable real consequences', () => {
  it('silver armor actually loses integrity under real load, and expires without healing health', () => {
    const s = fixture('POST'), r = beginSilverKnightCombatRound(s, 'ATTACK'); player(s, r, A, random(1));
    expect(r.ledger.armorIntegrity).toBe(36); expect(s.spirituality).toBe(114);
    expect(enemy(s, r, 'BODY_STRIKE').threatens).toBe(false); expect(r.ledger.armorIntegrity).toBe(21);
    enemy(s, r, 'PRIMARY'); expect(r.ledger.armorIntegrity).toBe(0); expect(s.health).toBe(100);
    const o = finishSilverKnightCombatRound(s, r, true); expect(o.armorIntegritySpent).toBe(36); expect(validateSilverKnightRoundOutcome(o)).toBe(true);
    const forged = structuredClone(o); forged.resourcesAfter.enemySpirituality++; expect(validateSilverKnightRoundOutcome(forged)).toBe(false);
  });
  it('borrowed light remains at original position, may be discerned and requires remaining original light', () => {
    const s = fixture('POST'), r = beginSilverKnightCombatRound(s, 'ATTACK'); player(s, r, L, random(1));
    expect(r.ledger.hidden).toBe(true); enemy(s, r, 'TRAIT'); expect(r.ledger.hidden).toBe(false);
    expect(player(s, r, L, random(1)).selfGain).toBe(0); expect(r.ledger.hidden).toBe(false); expect(s.spirituality).toBe(108);
    const dark = fixture('POST'); dark.silverKnight.encounter.scene.lampSeconds = 0; const dr = beginSilverKnightCombatRound(dark, 'ATTACK');
    expect(player(dark, dr, L)).toMatchObject({ enemyReduction: 10, threatens: false }); expect(dark.spirituality).toBe(120);
  });
  it('teleport blade can fail or be countered by a paid high-order barrier and never moves the player', () => {
    const s = fixture('POST'), r = beginSilverKnightCombatRound(s, 'ATTACK');
    expect(player(s, r, T, random(100)).threatens).toBe(false); expect(s.spirituality).toBe(114);
    enemy(s, r, 'DEFENSE'); expect(player(s, r, T, random(1)).threatens).toBe(false);
    expect(player(s, r, T, random(1)).threatens).toBe(true); expect(s.spirituality).toBe(102);
    expect(s.silverKnight.encounter.scene.playerPosition).toBe('ORIGIN');
    const o = finishSilverKnightCombatRound(s, r, true); expect(validateSilverKnightRoundOutcome(o)).toBe(true);
  });
  it('shared resolution applies genuine enemy death and player death rather than tuning the seed', () => {
    const killed = fixture(); const win = scriptedRound(killed, 'ATTACK', 1, 1, 1, 96, 1, 100);
    expect(win.outcome).toBe('ENEMY_DEAD'); expect(killed.combat?.enemyHealth).toBe(0); expect(win.round.silverKnightOutcome?.elapsedSeconds).toBe(60);
    expect(validateSilverKnightRoundOutcome(win.round.silverKnightOutcome)).toBe(true);
    const lost = fixture(); const loss = scriptedRound(lost, 'ATTACK', 1, 1, 445, 1, 1000000, 100);
    expect(loss.outcome).toBe('PLAYER_DEAD'); expect(lost.health).toBe(0); expect(loss.round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
    expect(validateSilverKnightRoundOutcome(loss.round.silverKnightOutcome)).toBe(true);
  });
  it('defense-only advantage cannot injure anyone and actual continuing rounds alone recover12S', () => {
    const s = fixture(); s.spirituality = 40;
    // ATTACK tickets: H150,J75,B80,K80,R40,A20. B starts226. Enemy DEFENSE starts36.
    const result = scriptedRound(s, 'ATTACK', 1, 1, 226, 36, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.consequenceWeights).toBeNull(); expect(s.health).toBe(100); expect(s.combat?.enemyHealth).toBe(100);
    expect(result.round.silverKnightOutcome?.playerSpiritualityAfter).toBe(40); expect(s.spirituality).toBe(52);
  });
});
