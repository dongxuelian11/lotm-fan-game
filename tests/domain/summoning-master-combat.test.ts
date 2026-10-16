import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createSummoningMasterState } from '../../src/domain/summoning-master/index.js';
import { applySummoningMasterEncounterCommand, createSummoningMasterEncounterState } from '../../src/domain/summoning-master/encounter.js';
import { applyWitchKingActivity } from '../../src/domain/witch-king/life.js';
import {
  SUMMONING_MASTER_COUNT_WHEEL, SUMMONING_MASTER_ENEMY_COUNT_WHEEL, SUMMONING_MASTER_ENEMY_ABILITY_WHEEL,
  summoningMasterActionCount, summoningMasterEnemyActionCount, summoningMasterAbilityWheel,
  drawSummoningMasterAbility, drawSummoningMasterEnemyAbility, beginSummoningMasterCombatRound,
  currentSummoningMasterCombatSource, resolveSummoningMasterCombatAbility, resolveSummoningMasterEnemyAbility,
  finishSummoningMasterCombatRound, summoningMasterRoundOutcome, validateSummoningMasterRoundOutcome,
  type SummoningMasterCombatSource, type SummoningMasterMoveId,
} from '../../src/domain/summoning-master/combat.js';

const SUMMON = 'moon.s3.bounded-summoning', COOPERATE = 'moon.s3.guest-cooperation';
const context = (s: SliceState): SeerContext => ({ roll: min => min, note: () => {}, check: (ability, difficulty) =>
  resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: 1 }) });
function random(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'summoning-master-unit', get cursor() { return cursor; }, nextInt(min, max) {
    const n = values[cursor++] ?? 1; expect(n).toBeGreaterThanOrEqual(min); expect(n).toBeLessThanOrEqual(max); return n;
  } };
}
/** Local original-scene unit fixture only; natural legacy/promotion replay has separate tests. */
function fixture(help = true, paper = false): SliceState {
  const s = createSliceRun('summoning-master-combat', sliceDefaultCreationSelection, 'summoning-master-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 20; s.actionsRemaining = 20; s.cash = 1000;
  s.health = 100; s.mind = 100; s.spirituality = 120; s.character.coreStats = { physique: 20, perception: 20, will: 20, knowledge: 20 };
  s.progression = { pathwayId: 'moon', sequence: 4, acting: 100, mastery: { 'moon.s4.blood-moon-arrow': 500 }, promotionWeek: 1 };
  s.witchKing.promotionWeek = 1;
  if (paper) { applyWitchKingActivity(s, { type: 'BUY_PAPERS' }, context(s)); applyWitchKingActivity(s, { type: 'PREPARE_PAPER', paperId: 'WK4-PAPER-1-2' }, context(s)); }
  s.progression.sequence = 3; s.summoningMaster = createSummoningMasterState(); s.summoningMaster.promotionWeek = 19;
  s.summoningMaster.life.partner.metWeek = 20; s.spirituality = 120;
  applySummoningMasterEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context(s));
  if (help) applySummoningMasterEncounterCommand(s, { type: 'SET_GUEST_POLICY', policy: 'ASK_HELP' }, context(s));
  applySummoningMasterEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context(s)); return s;
}
const begin = (s: SliceState) => beginSummoningMasterCombatRound(s, 'ATTACK', random());

describe('Summoning Master one original guest and finite shared combat', () => {
  it('uses exact 1–6 counts for both sides and the six published player entries', () => {
    expect(SUMMONING_MASTER_COUNT_WHEEL.map(v => v.weight)).toEqual([10, 15, 25, 25, 15, 10]);
    expect(SUMMONING_MASTER_ENEMY_COUNT_WHEEL).toEqual(SUMMONING_MASTER_COUNT_WHEEL);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [75, 4], [76, 5], [90, 5], [91, 6], [100, 6]]) {
      expect(summoningMasterActionCount(roll!)).toBe(count); expect(summoningMasterEnemyActionCount(roll!)).toBe(count);
    }
    const s = fixture();
    expect(summoningMasterAbilityWheel(s, null).map(v => v.id)).toEqual(['moon.s4.blood-moon-arrow', 'moon.s4.moon-paper-substitute', SUMMON, 'moon.s7.abyss-shackles', COOPERATE, 'ACCIDENT']);
    expect(summoningMasterAbilityWheel(s, null).map(v => v.weight)).toEqual([25, 20, 20, 15, 15, 5]);
  });
  it('draws the displayed weights with exactly one draw per player/enemy slot', () => {
    const s = fixture(); let boundary = 0;
    for (const a of summoningMasterAbilityWheel(s, null)) { const first = boundary + 1; boundary += a.weight * 4; const rng = random(first, boundary);
      expect(drawSummoningMasterAbility(rng, s, null)).toBe(a.id); expect(drawSummoningMasterAbility(rng, s, null)).toBe(a.id); expect(rng.cursor).toBe(2); }
    boundary = 0;
    for (const a of SUMMONING_MASTER_ENEMY_ABILITY_WHEEL) { const first = boundary + 1; boundary += a.weight; const rng = random(first, boundary);
      expect(drawSummoningMasterEnemyAbility(rng)).toBe(a.id); expect(drawSummoningMasterEnemyAbility(rng)).toBe(a.id); expect(rng.cursor).toBe(2); }
  });
  it('HOME means actual ordinary fallback, with no paid summon, guest move or hidden check', () => {
    const s = fixture(false), r = begin(s), rng = random(), partner = s.summoningMaster.life.partner, before = structuredClone(partner);
    expect(resolveSummoningMasterCombatAbility(s, SUMMON, 1, rng, r).enemyReduction).toBe(10);
    expect(resolveSummoningMasterCombatAbility(s, COOPERATE, .5, rng, r).selfGain).toBe(6);
    expect(s.spirituality).toBe(120); expect(partner).toEqual(before); expect(rng.cursor).toBe(0);
    expect(validateSummoningMasterRoundOutcome(finishSummoningMasterCombatRound(s, r))).toBe(true);
  });
  it('paid summon moves the exact life body and its same owned chime, once this round', () => {
    const s = fixture(), partner = s.summoningMaster.life.partner, chime = partner.chime, r = begin(s), rng = random(1);
    expect(resolveSummoningMasterCombatAbility(s, SUMMON, 1, rng, r).selfGain).toBe(0);
    expect(s.summoningMaster.life.partner).toBe(partner); expect(partner.chime).toBe(chime);
    expect(partner).toMatchObject({ id: 'SM3-LUMEN', location: 'YARD', stamina: 94, gateCrossings: 1 });
    expect(s.spirituality).toBe(114); expect(s.summoningMaster.encounter.gateOpen).toBe(true);
    expect(resolveSummoningMasterCombatAbility(s, SUMMON, 1, rng, r).enemyReduction).toBe(10);
    expect(rng.cursor).toBe(1); expect(s.spirituality).toBe(114); expect(partner.stamina).toBe(94);
  });
  it('failed summon pays once, leaves the body HOME and cannot reroll', () => {
    const s = fixture(), r = begin(s), rng = random(100);
    expect(resolveSummoningMasterCombatAbility(s, SUMMON, 1, rng, r)).toMatchObject({ selfGain: 0, enemyReduction: 0 });
    expect(s.spirituality).toBe(114); expect(s.summoningMaster.life.partner).toMatchObject({ location: 'HOME', stamina: 100, gateCrossings: 0 });
    resolveSummoningMasterCombatAbility(s, SUMMON, 1, rng, r); expect(rng.cursor).toBe(1);
    const o = finishSummoningMasterCombatRound(s, r); expect(o.ordinaryReturnMetres).toBe(0); expect(validateSummoningMasterRoundOutcome(o)).toBe(true);
  });
  it('cooperation requires the actual paid current-round arrival and charges failure as well as success', () => {
    const s = fixture(), r = begin(s), rng = random(1, 100, 1);
    expect(resolveSummoningMasterCombatAbility(s, COOPERATE, 1, rng, r).selfGain).toBe(12); expect(rng.cursor).toBe(0);
    resolveSummoningMasterCombatAbility(s, SUMMON, 1, rng, r);
    expect(resolveSummoningMasterCombatAbility(s, COOPERATE, 1, rng, r)).toMatchObject({ selfGain: 0, enemyReduction: 0 });
    expect(resolveSummoningMasterCombatAbility(s, COOPERATE, 1, rng, r)).toMatchObject({ selfGain: 32, enemyReduction: 16 });
    expect(s.spirituality).toBe(108); expect(s.summoningMaster.life.partner.stamina).toBe(78); expect(rng.cursor).toBe(3);
    expect(validateSummoningMasterRoundOutcome(finishSummoningMasterCombatRound(s, r))).toBe(true);
  });
  it('a destroyed door does not delete or teleport its guest, and shock is once per round', () => {
    const s = fixture(), r = begin(s), rng = random(1, 1), partner = s.summoningMaster.life.partner;
    resolveSummoningMasterCombatAbility(s, SUMMON, 1, rng, r);
    resolveSummoningMasterEnemyAbility(s, 'DISRUPT', 1, rng, r);
    expect(s.summoningMaster.encounter.gateOpen).toBe(false); expect(partner).toMatchObject({ location: 'YARD', mind: 92 });
    resolveSummoningMasterEnemyAbility(s, 'DISRUPT', 1, rng, r); expect(partner.mind).toBe(92);
    expect(resolveSummoningMasterCombatAbility(s, COOPERATE, 1, rng, r).selfGain).toBe(32);
    const o = finishSummoningMasterCombatRound(s, r); expect(o.enemySpirituality).toBe(112);
    expect(o.ordinaryReturnMetres).toBe(30); expect(partner.location).toBe('HOME'); expect(partner.ordinaryDistanceM).toBe(30);
    expect(partner.chime.owner).toBe('SM3-LUMEN'); expect(validateSummoningMasterRoundOutcome(o)).toBe(true);
  });
  it('DISRUPT before summoning spends enemy S without touching the HOME body', () => {
    const s = fixture(), r = begin(s), rng = random(), p = s.summoningMaster.life.partner;
    resolveSummoningMasterEnemyAbility(s, 'DISRUPT', 1, rng, r); expect(p.mind).toBe(100);
    resolveSummoningMasterCombatAbility(s, SUMMON, 1, rng, r);
    resolveSummoningMasterEnemyAbility(s, 'DISRUPT', 1, rng, r); expect(p.mind).toBe(92);
    expect(validateSummoningMasterRoundOutcome(finishSummoningMasterCombatRound(s, r))).toBe(true);
  });
  it('an actual cooperation shield spends original health/stamina once without reducing the common enemy attack', () => {
    const s = fixture(), r = begin(s), rng = random(), p = s.summoningMaster.life.partner;
    resolveSummoningMasterCombatAbility(s, SUMMON, 1, rng, r); resolveSummoningMasterCombatAbility(s, COOPERATE, 1, rng, r);
    expect(resolveSummoningMasterEnemyAbility(s, 'BODY_STRIKE', 1, rng, r).selfGain).toBe(20);
    expect(p).toMatchObject({ health: 95, stamina: 82 });
    resolveSummoningMasterCombatAbility(s, COOPERATE, 1, rng, r); resolveSummoningMasterEnemyAbility(s, 'BODY_STRIKE', 1, rng, r);
    expect(p).toMatchObject({ health: 95, stamina: 74 }); expect(s.health).toBe(100);
    expect(validateSummoningMasterRoundOutcome(finishSummoningMasterCombatRound(s, r))).toBe(true);
  });
  it('the original guest can really die; its body and owned chime remain YARD while old skills still work', () => {
    const s = fixture(); s.summoningMaster.life.partner.health = 5; const p = s.summoningMaster.life.partner, r = begin(s), rng = random();
    resolveSummoningMasterCombatAbility(s, SUMMON, 1, rng, r); resolveSummoningMasterCombatAbility(s, COOPERATE, 1, rng, r);
    resolveSummoningMasterEnemyAbility(s, 'BODY_STRIKE', 1, rng, r);
    expect(p).toMatchObject({ health: 0, status: 'DEAD', location: 'YARD', willing: false, chime: { owner: 'SM3-LUMEN' } });
    expect(resolveSummoningMasterCombatAbility(s, COOPERATE, 1, rng, r).selfGain).toBe(12);
    expect(resolveSummoningMasterCombatAbility(s, 'moon.s4.blood-moon-arrow', 1, rng, r).selfGain).toBe(45);
    const o = finishSummoningMasterCombatRound(s, r); expect(o.ordinaryReturnMetres).toBe(0); expect(p.location).toBe('YARD'); expect(validateSummoningMasterRoundOutcome(o)).toBe(true);
  });
  it('player death does not kill or delete the guest: living guest independently walks its prior agreed original route', () => {
    const s = fixture(), r = begin(s), rng = random(); resolveSummoningMasterCombatAbility(s, SUMMON, 1, rng, r); s.health = 0;
    const o = finishSummoningMasterCombatRound(s, r, false);
    expect(s.health).toBe(0); expect(o.partnerAfter.location).toBe('HOME'); expect(o.partnerAfter.stamina).toBe(94); expect(o.ordinaryReturnMetres).toBe(30);
    expect(o.playerSpiritualityAfter).toBe(114); expect(validateSummoningMasterRoundOutcome(o)).toBe(true);
  });
  it('uses actual original PREPARED paper once without consuming HELD paper or replacing old materials', () => {
    const s = fixture(true, true), before = structuredClone(s.witchKing), r = begin(s), rng = random();
    expect(resolveSummoningMasterCombatAbility(s, 'moon.s4.moon-paper-substitute', 1, rng, r).enemyReduction).toBe(35);
    expect(resolveSummoningMasterCombatAbility(s, 'moon.s4.moon-paper-substitute', 1, rng, r).enemyReduction).toBe(10);
    expect(s.spirituality).toBe(117); expect(rng.cursor).toBe(0);
    expect(s.witchKing.life.papers[1]).toMatchObject({ id: 'WK4-PAPER-1-2', status: 'CONSUMED', consumedBy: 'COMBAT', consumedWeek: 20, combatRound: 1 });
    expect(s.witchKing.life.papers.filter(p => p.status === 'HELD')).toHaveLength(2); expect(s.witchKing.encounter).toEqual(before.encounter);
    expect(s.witchKing.life.target).toEqual(before.life.target); const o = finishSummoningMasterCombatRound(s, r);
    expect(o.papersConsumed).toEqual(['WK4-PAPER-1-2']); expect(validateSummoningMasterRoundOutcome(o)).toBe(true);
  });
  it('inherits paid arrow4/45 and shackles2/18 with real checks and no refund on failures', () => {
    const s = fixture(), r = begin(s), rng = random(1, 1, 100, 100);
    expect(resolveSummoningMasterCombatAbility(s, 'moon.s4.blood-moon-arrow', 1, rng, r).selfGain).toBe(45);
    expect(resolveSummoningMasterCombatAbility(s, 'moon.s7.abyss-shackles', 1, rng, r).enemyReduction).toBe(18);
    expect(resolveSummoningMasterCombatAbility(s, 'moon.s4.blood-moon-arrow', 1, rng, r).selfGain).toBe(0);
    expect(resolveSummoningMasterCombatAbility(s, 'moon.s7.abyss-shackles', 1, rng, r).enemyReduction).toBe(0);
    expect(s.spirituality).toBe(108); expect(validateSummoningMasterRoundOutcome(finishSummoningMasterCombatRound(s, r))).toBe(true);
  });
  it('low S uses only ordinary body/actual held club and never draws a replacement skill', () => {
    const s = fixture(); s.spirituality = 1; s.town.clubLocation = 'HAND'; const r = begin(s), rng = random();
    expect(resolveSummoningMasterCombatAbility(s, 'moon.s4.blood-moon-arrow', .5, rng, r).selfGain).toBe(8);
    expect(resolveSummoningMasterCombatAbility(s, SUMMON, 1, rng, r).enemyReduction).toBe(10);
    expect(resolveSummoningMasterCombatAbility(s, 'moon.s7.abyss-shackles', 1, rng, r).enemyReduction).toBe(10);
    expect(s.spirituality).toBe(1); expect(rng.cursor).toBe(0); expect(validateSummoningMasterRoundOutcome(finishSummoningMasterCombatRound(s, r))).toBe(true);
  });
  it('enemy uses its independent finite pool and falls back to its own original club', () => {
    const s = fixture(), r = begin(s), rng = random();
    expect(resolveSummoningMasterEnemyAbility(s, 'DARK_BOLT', 1, rng, r).selfGain).toBe(75);
    expect(resolveSummoningMasterEnemyAbility(s, 'WARD', 1, rng, r).enemyReduction).toBe(45);
    expect(s.summoningMaster.encounter.enemySpirituality).toBe(111); expect(s.spirituality).toBe(120);
    expect(validateSummoningMasterRoundOutcome(finishSummoningMasterCombatRound(s, r))).toBe(true);
    const low = fixture(); Object.assign(low.summoningMaster.encounter, { enemySpirituality: 3, powerUses: { DARK_BOLT: 9, WARD: 18, DISRUPT: 0 } });
    const lowRound = begin(low); expect(resolveSummoningMasterEnemyAbility(low, 'DARK_BOLT', .5, rng, lowRound).selfGain).toBe(10);
    expect(low.summoningMaster.encounter.enemySpirituality).toBe(3); expect(lowRound.enemyActions[0]).toMatchObject({ actual: 'BODY_STRIKE', paidCost: 0 });
  });
  it('rejects missing/stale/substituted original source without spending or drawing', () => {
    const s = fixture(), r = begin(s), source = currentSummoningMasterCombatSource(s)!, rng = random();
    for (const bad of [null, { ...source, round: 99 }, { ...source, targetId: 'COPY' }, { ...source, partner: { ...source.partner, bodyId: 'COPY' } }]) {
      const before = structuredClone(s); expect(resolveSummoningMasterCombatAbility(s, SUMMON, 1, rng, r, bad as SummoningMasterCombatSource | null).selfGain).toBe(0); expect(s).toEqual(before);
    }
    expect(rng.cursor).toBe(0); Object.assign(s.summoningMaster.life.partner, { id: 'COPY' }); expect(currentSummoningMasterCombatSource(s)).toBeNull();
  });
  it('finished rounds cannot be reused and exported history snapshots never mutate the original guest', () => {
    const s = fixture(), r = begin(s), rng = random(); resolveSummoningMasterCombatAbility(s, SUMMON, 1, rng, r);
    const o = finishSummoningMasterCombatRound(s, r); expect(s.summoningMaster.life.clockSeconds).toBe(120);
    expect(() => finishSummoningMasterCombatRound(s, r)).toThrow(); expect(resolveSummoningMasterCombatAbility(s, SUMMON, 1, rng, r).selfGain).toBe(0);
    o.partnerAfter.stamina = 100; expect(s.summoningMaster.life.partner.stamina).toBe(94); expect(summoningMasterRoundOutcome(r).partnerAfter.stamina).toBe(94);
    expect(validateSummoningMasterRoundOutcome(o)).toBe(false);
  });
  it('ordinary death/positions/cost tampering is rejected without introducing another state machine', () => {
    const s = fixture(), r = begin(s), rng = random(); resolveSummoningMasterCombatAbility(s, SUMMON, 1, rng, r); resolveSummoningMasterCombatAbility(s, COOPERATE, 1, rng, r);
    const o = finishSummoningMasterCombatRound(s, r);
    for (const mutate of [(v: typeof o) => { v.partnerAfter.location = 'YARD'; }, (v: typeof o) => { v.playerSpiritualityAfter++; },
      (v: typeof o) => { v.playerActions[0]!.guestStaminaSpent = 0; }, (v: typeof o) => { v.ordinaryReturnMetres = 0; }]) {
      const bad = structuredClone(o); mutate(bad); expect(validateSummoningMasterRoundOutcome(bad)).toBe(false);
    }
    expect(validateSummoningMasterRoundOutcome(o)).toBe(true);
    expect(createSummoningMasterEncounterState().guestPolicy).toBe('HOME');
    expect(resolveSummoningMasterCombatAbility(s, 'moon.s2.create-angel' as SummoningMasterMoveId, 1, rng, r).selfGain).toBe(0);
  });
});
