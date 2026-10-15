import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { createChaosHunterState } from '../../src/domain/chaos-hunter/index.js';
import { baseAdvantage, consequenceWeights, playerAbilityWheel, playerCountWheel } from '../../src/domain/slice/combat.js';
import { resolveChaosHunterCombatRound } from '../../src/domain/slice/chaos-hunter-combat.js';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { CHAOS_HUNTER_COUNT_WHEEL, CHAOS_HUNTER_ENEMY_COUNT_WHEEL, CHAOS_HUNTER_ENEMY_ABILITY_WHEEL,
  chaosHunterAbilityWheel, chaosHunterActionCount, chaosHunterEnemyActionCount, drawChaosHunterAbility, drawChaosHunterEnemyAbility,
  currentChaosHunterCombatSource, beginChaosHunterCombatRound, resolveChaosHunterCombatAbility, resolveChaosHunterEnemyCombatAbility,
  finishChaosHunterCombatRound, validateChaosHunterRoundOutcome, projectChaosHunterCombat, type ChaosHunterMoveId, type ChaosHunterRoundOutcome } from '../../src/domain/chaos-hunter/combat.js';
import { applyChaosHunterEncounterCommand, settleChaosHunterEncounter, validateChaosHunterEncounter } from '../../src/domain/chaos-hunter/encounter.js';

const H = 'justiciar.s9.combat-training', J = 'justiciar.s5.wound-verdict', B = 'justiciar.s4.intimidation', K = 'justiciar.s3.bounded-order', R = 'justiciar.s4.deprivation';
const profile: readonly [ChaosHunterMoveId, number, SliceStance | null][] = [[H, 30, 'ATTACK'], [J, 15, 'ATTACK'], [B, 25, 'DEFEND'], [K, 10, 'CONTROL'], [R, 15, 'PREPARE'], ['ACCIDENT', 5, null]];
function ticket(id: ChaosHunterMoveId, stance: SliceStance | null): number {
  let n = 1; for (const [candidate, weight, preferred] of profile) { if (id === candidate) return n; n += weight * (stance !== null && preferred === stance ? 5 : 4); } throw new Error('Missing action');
}
function random(...values: number[]): ActionRandomStream {
  let cursor = 0; return { seed: 'chaos-hunter-directed', get cursor() { return cursor; }, nextInt(min, max) {
    const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected directed draw ${cursor}: ${n}, ${min}..${max}`); return n;
  } };
}
function context(): SeerContext { return { roll: min => min, note: vi.fn(), check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 20, difficulty, modifiers: [], roll: 1 }) }; }
/** Explicit directed unit setup. The unchanged 352-command natural lineage is separately replayed by shared tests. */
function fixture(): SliceState {
  const s = createSliceRun('chaos-hunter-combat-directed', sliceDefaultCreationSelection, 'chaos-hunter-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 120; s.actionsRemaining = 6; s.cash = 1000; s.arc.stage = 'ENDED';
  s.character.coreStats = { physique: 20, perception: 20, will: 20, knowledge: 20 };
  s.progression = { pathwayId: 'justiciar', sequence: 3, mastery: { [H]: 0, [J]: 0, [B]: 0, [K]: 0, [R]: 0,
    'justiciar.s5.punishment': 0, 'justiciar.s8.trace-sensing': 0, 'justiciar.s6.prohibition': 0 }, acting: 0, promotionWeek: 120 };
  s.chaosHunter = createChaosHunterState(); s.chaosHunter.guidanceKnown = true; s.chaosHunter.promotionWeek = 120; s.chaosHunter.imperativeMageActingAtPromotion = 100;
  s.chaosHunter.life.cases['paired-line'].status = 'RESOLVED'; s.health = 100; s.mind = 100; s.spirituality = 120; s.town.clubLocation = 'SHOP';
  applyChaosHunterEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context()); applyChaosHunterEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context()); return s;
}
const oldRoots = (s: SliceState) => structuredClone({ arbiter: s.arbiter, sheriff: s.sheriff, interrogator: s.interrogator, judge: s.judge, punishmentKnight: s.punishmentKnight, imperativeMage: s.imperativeMage });
function begin(s: SliceState, stance: SliceStance = 'ATTACK') { return beginChaosHunterCombatRound(s, stance, random()); }
function effect(s: SliceState, id: ChaosHunterMoveId, r: ReturnType<typeof begin>, rng = random(), physical = 1) { return resolveChaosHunterCombatAbility(s, id, physical, rng, r); }
function enemy(s: SliceState, id: Parameters<typeof resolveChaosHunterEnemyCombatAbility>[1], r: ReturnType<typeof begin>, rng = random(), physical = 1) { return resolveChaosHunterEnemyCombatAbility(s, id, physical, rng, r); }
function complete(s: SliceState, r: ReturnType<typeof begin>) { const o = finishChaosHunterCombatRound(s, r); expect(validateChaosHunterRoundOutcome(o)).toBe(true); return o; }
function wound(s: SliceState) {
  s.revision = 2; s.combat!.enemyInjuries = [{ id: 'directed-real-old-enemy-injury', severity: 'LIGHT', acquiredRevision: 1, treatedRevision: null }];
  s.chaosHunter.encounter.enemyInjuries = structuredClone(s.combat!.enemyInjuries);
}
function play(s: SliceState, stance: SliceStance, ...values: number[]) {
  let cursor = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function(this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected directed shared draw ${cursor}: ${n}, ${min}..${max}`); return n;
  });
  try { const result = resolveChaosHunterCombatRound(s, stance); s.combatHistory.push(structuredClone(result.round)); s.revision++; expect(spy).toHaveBeenCalledTimes(values.length); return result; } finally { spy.mockRestore(); }
}
afterEach(() => vi.restoreAllMocks());

describe('Chaos Hunter original bodies, unchanged inherited core and bounded wheels', () => {
  it('uses both1–6 wheels, six30/15/25/10/15/5 slots and stance5/4 tickets', () => {
    const s = fixture(); expect(CHAOS_HUNTER_COUNT_WHEEL.map(a => a.weight)).toEqual([12, 20, 25, 23, 14, 6]); expect(CHAOS_HUNTER_ENEMY_COUNT_WHEEL).toEqual(CHAOS_HUNTER_COUNT_WHEEL);
    expect(playerCountWheel(s)).toEqual(CHAOS_HUNTER_COUNT_WHEEL); expect(chaosHunterAbilityWheel(s, null).map(a => a.weight)).toEqual([30, 15, 25, 10, 15, 5]); expect(playerAbilityWheel(s, null)).toEqual(chaosHunterAbilityWheel(s, null));
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) for (const [id] of profile) expect(drawChaosHunterAbility(random(ticket(id, stance)), s, stance)).toBe(id);
    for (const count of [chaosHunterActionCount, chaosHunterEnemyActionCount]) expect([1, 12, 13, 32, 33, 57, 58, 80, 81, 94, 95, 100].map(count)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
    expect(CHAOS_HUNTER_ENEMY_ABILITY_WHEEL.map(a => a.weight)).toEqual([35, 25, 25, 10, 5]); expect([1, 36, 61, 86, 96].map(n => drawChaosHunterEnemyAbility(random(n)))).toEqual(['ARC_BOLT', 'WARD', 'BODY_STRIKE', 'COMPOSE', 'ACCIDENT']);
    const rng = random(); beginChaosHunterCombatRound(s, 'ATTACK', rng); expect(rng.cursor).toBe(0);
  });
  it('inherits JUSTICIAR30/20/35/15, both1250/120 and no passive luck', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    const r = play(s, 'ATTACK', 1, 1, ticket('ACCIDENT', 'ATTACK'), 96, 1);
    expect(r.round.playerAdvantage).toBe(baseAdvantage(10 * .3 + 20 * .2 + 30 * .35 + 40 * .15, 100, 100, 120, 1250, 120) - 22.5);
    expect(r.round.enemyAdvantage).toBe(baseAdvantage(22, 100, 100, 120, 1250, 120) - 22.5); expect(r.round.consequenceWeights).toBeNull(); expect(r.round.passiveLuck).toBeUndefined(); expect(validateChaosHunterEncounter(s)).toBe(true);
  });
  it.each(['SHOP', 'BAG', 'HAND'] as const)('H uses actual%s original gear and J ordinary BODY budget, without free punishment', gear => {
    const s = fixture(); s.town.clubLocation = gear; const r = begin(s);
    expect(effect(s, H, r, random(), .5).selfGain).toBe((gear === 'HAND' ? 16 : 59.15 * .65) * .5);
    expect(effect(s, J, r, random(), .5).selfGain).toBe(41.405 * .65 * .5); expect(s.spirituality).toBe(120); complete(s, r);
  });
  it('low funds preserve exact trace49.29 and ordinary movement6 without payment or draws', () => {
    const s = fixture(); s.spirituality = 2; const r = begin(s);
    expect(effect(s, B, r).enemyReduction).toBe(49.29 * .65); expect(effect(s, K, r, random(), .5).enemyReduction).toBe(3); expect(effect(s, R, r).selfGain).toBe(0); expect(s.spirituality).toBe(2); complete(s, r);
  });
  it('rejects stale identity, gear, resources, core, injury, risk and clock without draws or cost', () => {
    for (const change of [(s: SliceState) => { s.revision++; }, (s: SliceState) => { s.health--; }, (s: SliceState) => { s.spirituality--; },
      (s: SliceState) => { s.town.clubLocation = 'HAND'; }, (s: SliceState) => { s.character.coreStats.physique++; }, (s: SliceState) => { s.injuryRisk++; },
      (s: SliceState) => { s.chaosHunter.life.clockSeconds++; }, (s: SliceState) => { s.chaosHunter.encounter.enemySpirituality--; }]) {
      const s = fixture(), r = begin(s); change(s); const before = structuredClone(s), rng = random(); expect(effect(s, K, r, rng).selfGain).toBe(0); expect(s).toEqual(before); expect(rng.cursor).toBe(0);
    }
    const s = fixture(); s.combat!.encounterId = 'IMPERATIVE_MAGE_DISPUTE'; expect(currentChaosHunterCombatSource(s)).toBeNull();
  });
});

describe('New bounded order gives EACH actual body its own one-attempt rule', () => {
  it.each([[1, 'GREAT_SUCCESS'], [6, 'SUCCESS'], [51, 'FAILURE'], [96, 'GREAT_FAILURE']] as const)('records knowledge20 fourtier%s and actual5S without forced success', (roll, tier) => {
    const s = fixture(), r = begin(s); effect(s, K, r, random(roll)); expect(r.playerActions[0]).toMatchObject({ paidCost: 5, checkChance: 50, checkTier: tier, succeeded: roll <= 50, bodyPendingAfter: { PLAYER: roll <= 50, ENEMY: roll <= 50 } });
    expect(s.spirituality).toBe(115); complete(s, r);
  });
  it.each(['PLAYER', 'ENEMY'] as const)('first%s BODY spends only their own pending; second body still independently rolls', first => {
    const s = fixture(), r = begin(s); effect(s, K, r, random(1));
    if (first === 'PLAYER') { expect(effect(s, H, r, random(1)).selfGain).toBe(0); expect(r.model).toMatchObject({ playerBodyPending: false, enemyBodyPending: true }); expect(enemy(s, 'BODY_STRIKE', r, random(1)).selfGain).toBe(0); }
    else { expect(enemy(s, 'BODY_STRIKE', r, random(1)).selfGain).toBe(0); expect(r.model).toMatchObject({ playerBodyPending: true, enemyBodyPending: false }); expect(effect(s, H, r, random(1)).selfGain).toBe(0); }
    expect(r.model).toMatchObject({ playerBodyPending: false, enemyBodyPending: false, breachReady: false }); expect(s.spirituality).toBe(115); complete(s, r);
  });
  it('any one remaining pending blocks repeatK with no new roll or payment', () => {
    const s = fixture(), r = begin(s); effect(s, K, r, random(1)); enemy(s, 'BODY_STRIKE', r, random(1)); effect(s, K, r);
    expect(r.playerActions[1]).toMatchObject({ paidCost: 0, checkRoll: null, bodyPendingAfter: { PLAYER: true, ENEMY: false } }); expect(s.spirituality).toBe(115);
    effect(s, H, r, random(1)); effect(s, K, r, random(1)); expect(s.spirituality).toBe(110); expect(r.model).toMatchObject({ playerBodyPending: true, enemyBodyPending: true }); complete(s, r);
  });
  it('ARC/WARD/COMPOSE and paid oldwoundJ never consume eitherBODY constraint', () => {
    const s = fixture(); wound(s); const r = begin(s); effect(s, K, r, random(1)); expect(effect(s, J, r, random(1), 0).selfGain).toBe(45 * .65);
    expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(70); expect(enemy(s, 'WARD', r).enemyReduction).toBe(30); expect(enemy(s, 'COMPOSE', r).selfGain).toBe(8);
    expect(r.model).toMatchObject({ playerBodyPending: true, enemyBodyPending: true }); expect(s.spirituality).toBe(112); complete(s, r);
  });
  it('original prohibition mastery alone sets resistance55..75; new mastery is not a hidden boost', () => {
    const s = fixture(); s.progression.mastery['justiciar.s6.prohibition'] = 500; s.progression.mastery[K] = 500; const r = begin(s); effect(s, K, r, random(1));
    expect(enemy(s, 'BODY_STRIKE', r, random(75)).selfGain).toBe(0); expect(effect(s, H, r, random(76)).selfGain).toBe(59.15 * .65);
    expect(r.enemyActions[0]!.prohibitionThreshold).toBe(75); expect(r.playerActions[1]!.prohibitionThreshold).toBe(75); expect(r.model.breachReady).toBe(false); complete(s, r);
  });
  it('only enemy resisted positiveBODY funds once-paidH, while own blockedH preserves it', () => {
    const s = fixture(), r = begin(s); effect(s, K, r, random(1)); expect(enemy(s, 'BODY_STRIKE', r, random(100)).selfGain).toBe(20);
    expect(effect(s, H, r, random(1)).selfGain).toBe(0); expect(r.model.breachReady).toBe(true); expect(s.spirituality).toBe(115);
    expect(effect(s, H, r).selfGain).toBe(59.15 * .65 + 20 * .65); expect(effect(s, H, r).selfGain).toBe(59.15 * .65); expect(s.spirituality).toBe(112); expect(r.model.punishmentUses).toBe(1); complete(s, r);
  });
  it('zero enemyBODY or own resistance never invents an enemy breach', () => {
    const s = fixture(), r = begin(s); effect(s, K, r, random(1)); enemy(s, 'BODY_STRIKE', r, random(100), 0); effect(s, H, r, random(100));
    expect(r.model.breachReady).toBe(false); expect(r.model.punishmentUses).toBe(0); expect(s.spirituality).toBe(115); complete(s, r);
  });
  it('failed paidK keeps all cost and never rewrites an already completed enemy action', () => {
    const s = fixture(), r = begin(s); enemy(s, 'BODY_STRIKE', r); effect(s, K, r, random(100)); enemy(s, 'BODY_STRIKE', r); effect(s, H, r);
    expect(r.enemyActions.map(a => a.selfGain)).toEqual([20, 20]); expect(r.model).toMatchObject({ playerBodyPending: false, enemyBodyPending: false, breachReady: false }); expect(s.spirituality).toBe(115); complete(s, r);
  });
  it('no resource for actual woundedJ falls back toBODY and is stopped by its own pending', () => {
    const s = fixture(); wound(s); s.spirituality = 7; const r = begin(s); effect(s, K, r, random(1));
    expect(effect(s, J, r, random(1))).toMatchObject({ selfGain: 0, threatens: false }); expect(r.playerActions[1]).toMatchObject({ paidCost: 0, checkRoll: null, prohibitionBlocked: true }); expect(r.model.enemyBodyPending).toBe(true); complete(s, r);
  });
});

describe('Inherited B/R use actual old source, actual original spell and finite resources', () => {
  it('B costs4 once and only weakens the next actual positiveBODY/ARC after SELF and zero actions', () => {
    const s = fixture(), r = begin(s); effect(s, B, r, random(1)); effect(s, B, r); enemy(s, 'WARD', r); enemy(s, 'ACCIDENT', r); enemy(s, 'BODY_STRIKE', r, random(), 0);
    expect(r.model.intimidationReady).toBe(true); expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(70 * .6); expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(70); expect(s.spirituality).toBe(116); complete(s, r);
  });
  it('R makes plannedARC actualBODY for0S, blocked by only enemyK and preserving pendingB', () => {
    const s = fixture(), r = begin(s); effect(s, R, r, random(1)); effect(s, B, r, random(1)); effect(s, K, r, random(1)); enemy(s, 'ARC_BOLT', r, random(1));
    expect(r.enemyActions[0]).toMatchObject({ planned: 'ARC_BOLT', actual: 'BODY_STRIKE', paidCost: 0, deprivationApplied: true, prohibitionBlocked: true, bodyPendingAfter: { PLAYER: true, ENEMY: false } });
    expect(r.model.intimidationReady).toBe(true); expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(20 * .6); expect(r.model.breachReady).toBe(false); expect(s.chaosHunter.encounter.enemySpirituality).toBe(120); complete(s, r);
  });
  it('deprivedARC resistance creates an actualBODY source and ownH must still resist separately', () => {
    const s = fixture(), r = begin(s); effect(s, R, r, random(1)); effect(s, K, r, random(1)); enemy(s, 'ARC_BOLT', r, random(100));
    expect(effect(s, H, r, random(100)).selfGain).toBe(59.15 * .65 + 20 * .65); expect(s.spirituality).toBe(108); expect(s.chaosHunter.encounter.enemySpirituality).toBe(120); complete(s, r);
  });
  it('COMPOSE pays4 gains8, clears onlyB/R and resists newB/R without clearing eitherK', () => {
    const s = fixture(), r = begin(s); effect(s, B, r, random(1)); effect(s, R, r, random(1)); effect(s, K, r, random(1)); expect(enemy(s, 'COMPOSE', r)).toMatchObject({ selfGain: 8, threatens: false });
    expect(r.model).toMatchObject({ intimidationReady: false, deprivationReady: false, composureReady: true, playerBodyPending: true, enemyBodyPending: true });
    effect(s, B, r, random(1)); effect(s, R, r, random(1)); expect(r.playerActions.slice(3).every(a => a.paidCost === 4 && a.resistedByComposure && !a.succeeded)).toBe(true);
    expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(70); expect(enemy(s, 'BODY_STRIKE', r, random(1)).selfGain).toBe(0); expect(r.model.playerBodyPending).toBe(true); complete(s, r);
  });
  it('an earlierCOMPOSE does not resist the newK category', () => {
    const s = fixture(), r = begin(s); enemy(s, 'COMPOSE', r); effect(s, K, r, random(1)); expect(r.playerActions[0]).toMatchObject({ succeeded: true, resistedByComposure: false, bodyPendingAfter: { PLAYER: true, ENEMY: true } }); complete(s, r);
  });
  it('failedB/R and failedJ keep full original costs and no false power use', () => {
    const s = fixture(); wound(s); const r = begin(s); effect(s, B, r, random(100)); effect(s, R, r, random(100)); effect(s, J, r, random(100));
    expect(s.spirituality).toBe(109); expect(r.model).toMatchObject({ intimidationReady: false, deprivationReady: false }); expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(70); complete(s, r);
  });
  it('end of real60seconds clears both unused rules and oldeffects without refund, refill or mastery', () => {
    const s = fixture(), old = oldRoots(s), mastery = structuredClone(s.progression.mastery), r = begin(s); effect(s, B, r, random(1)); effect(s, R, r, random(1)); effect(s, K, r, random(1));
    const o = complete(s, r); expect(o).toMatchObject({ intimidationReady: false, deprivationReady: false, playerBodyPending: false, enemyBodyPending: false, breachReady: false, elapsedSeconds: 60, lifeClockSecondsAfter: 60, playerSpiritualityAfter: 107 });
    expect(oldRoots(s)).toEqual(old); expect(s.progression.mastery).toEqual(mastery); expect(() => finishChaosHunterCombatRound(s, r)).toThrow('结束');
  });
  it('replays ordered dualpending, actual costs, separate resistance and original scene receipts', () => {
    const s = fixture(), r = begin(s); effect(s, K, r, random(1)); enemy(s, 'BODY_STRIKE', r, random(100)); effect(s, H, r, random(100)); const o = complete(s, r);
    const mutations: ((v: ChaosHunterRoundOutcome) => void)[] = [v => { v.playerActions[0]!.checkTier = 'FAILURE'; }, v => { v.playerActions[0]!.bodyPendingAfter.PLAYER = false; },
      v => { v.enemyActions[0]!.bodyPendingAfter.PLAYER = false; }, v => { v.enemyActions[0]!.prohibitionRoll = 1; }, v => { v.playerActions[1]!.punishmentApplied = false; },
      v => { v.playerActions[1]!.paidCost = 0; }, v => { v.playerActions[1]!.order = 0; }, v => { v.enemyActions[0]!.spiritualityAfter--; },
      v => { v.source.enemyWeapon = 'IM4-ROWAN-CLUB' as never; }, v => { v.source.targetSequence = 5 as never; }, v => { v.source.scene.distanceMetres = 4 as never; },
      v => { v.source.prohibitionMastery = 500; }, v => { v.lifeClockSecondsAfter--; }, v => { v.source.playerSpirituality++; }, v => { v.enemyBodyPending = true as never; },
      v => { v.source.enemyInjuries.push({ id: 'invented', severity: 'LIGHT', acquiredRevision: 0, treatedRevision: null }); }, v => { v.source.playerRisk = -1; }];
    for (const mutate of mutations) { const bad = structuredClone(o); mutate(bad); expect(validateChaosHunterRoundOutcome(bad)).toBe(false); }
  });
});

describe('Directed complete rounds preserve ordinary exit, original deaths and shared cumulative risk', () => {
  it.each([[1, 90, 'CONTINUE'], [66, 70, 'ENEMY_SURRENDERED'], [96, 0, 'ENEMY_DEAD']] as const)('common injury roll%s has exact health, no new mastery and live4m4s exit', (roll, health, outcome) => {
    const s = fixture(); s.spirituality = 100; const r = play(s, 'ATTACK', 1, 1, ticket(H, 'ATTACK'), 36, 1, roll);
    expect(r.outcome).toBe(outcome); expect(s.combat!.enemyHealth).toBe(health); expect(r.round.consequenceWeights).toEqual(consequenceWeights(0)); expect(s.spirituality).toBe(outcome === 'CONTINUE' ? 112 : 100);
    expect(s.chaosHunter.life.clockSeconds).toBe(outcome === 'CONTINUE' ? 60 : 64); expect(s.chaosHunter.encounter.weaponLocation).toBe(outcome === 'ENEMY_DEAD' ? 'COURT' : 'HAND');
    if (outcome !== 'CONTINUE') settleChaosHunterEncounter(s, outcome, context()); expect(validateChaosHunterEncounter(s)).toBe(true);
  });
  it('death keeps paidK, leaves actual body in court and never changes any of six old roots', () => {
    const s = fixture(), old = oldRoots(s); const r = play(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 1, 1, 1_000_000, 96);
    expect(r.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.spirituality).toBe(115); expect(s.chaosHunter.life.clockSeconds).toBe(60); expect(s.chaosHunter.encounter.scene.playerPosition).toBe('COURT');
    s.status = 'DEAD'; settleChaosHunterEncounter(s, r.outcome, context()); expect(validateChaosHunterEncounter(s)).toBe(true); expect(oldRoots(s)).toEqual(old);
  });
  it('retreat keeps earlier paidWARD and moves only living original body4m4s', () => {
    const s = fixture(); play(s, 'PREPARE', 1, 1, ticket('ACCIDENT', 'PREPARE'), 96, 1); const old = oldRoots(s);
    const r = play(s, 'RETREAT', 1, 1, 36, 1); expect(r.outcome).toBe('RETREATED'); expect(s.chaosHunter.encounter.enemySpirituality).toBe(116); expect(s.chaosHunter.life.clockSeconds).toBe(124);
    settleChaosHunterEncounter(s, r.outcome, context()); expect(validateChaosHunterEncounter(s)).toBe(true); expect(oldRoots(s)).toEqual(old);
  });
  it('all120 enemyS can be exhausted through real rounds; planned spells then really fall backBODY0S', () => {
    const s = fixture();
    for (let round = 1; round <= 4; round++) {
      const actions = round % 2 ? [ticket('ACCIDENT', 'PREPARE'), 1, 1, 1, 1, 1, 1] : [1, ticket('ACCIDENT', 'PREPARE'), 1, 1, 1, 1, 1];
      play(s, 'PREPARE', 1, 100, ...actions, 1); expect(validateChaosHunterEncounter(s)).toBe(true);
    }
    expect(s.chaosHunter.encounter.enemySpirituality).toBe(0); expect(s.chaosHunter.encounter.powerUses.ARC_BOLT).toBe(24);
    const r = play(s, 'PREPARE', 1, 33, ticket('ACCIDENT', 'PREPARE'), 1, 36, 86, 1);
    expect(r.round.chaosHunterOutcome!.enemyActions.map(a => [a.actual, a.paidCost, a.selfGain])).toEqual([['BODY_STRIKE', 0, 20], ['BODY_STRIKE', 0, 20], ['BODY_STRIKE', 0, 20]]); expect(validateChaosHunterEncounter(s)).toBe(true);
  });
  it('rejects health, risk, original core, effect order and injury receipt tampering', () => {
    const s = fixture(), r = play(s, 'ATTACK', 1, 1, ticket(H, 'ATTACK'), 36, 1, 66); settleChaosHunterEncounter(s, r.outcome, context()); expect(validateChaosHunterEncounter(s)).toBe(true);
    for (const mutate of [(x: SliceState) => { x.combatHistory.at(-1)!.chaosHunterOutcome!.playerRiskAfter++; }, (x: SliceState) => { x.combatHistory.at(-1)!.chaosHunterOutcome!.source.clubLocation = 'HAND'; },
      (x: SliceState) => { x.combatHistory.at(-1)!.playerAdvantage++; }, (x: SliceState) => { x.combatHistory.at(-1)!.chaosHunterOutcome!.enemyInjuriesAfter[0]!.severity = 'LIGHT'; },
      (x: SliceState) => { x.combatHistory.at(-1)!.chaosHunterOutcome!.enemyActions[0]!.order = 0; }, (x: SliceState) => { x.chaosHunter.encounter.enemyHealth++; }]) { const bad = structuredClone(s); mutate(bad); expect(validateChaosHunterEncounter(bad)).toBe(false); }
  });
  it('public projection identifies original adult, source boundaries and both constrained bodies', () => {
    const p = projectChaosHunterCombat(fixture()); expect(p).toMatchObject({ targetId: 'CH3-EDRIC', enemySpirituality: 120, playerBodyPending: false, enemyBodyPending: false, pursuit: false });
    expect(p.source).toMatchObject({ targetAge: 44, targetSequence: 4, targetPhysique: 22, enemyWeapon: 'CH3-EDRIC-ROD' }); expect(p.summary).toContain('完整配方仪式未知'); expect(p.summary).toContain('旧罗温');
  });
});
