import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { createAncientAlchemistState } from '../../src/domain/ancient-alchemist/index.js';
import { baseAdvantage, consequenceWeights, playerAbilityWheel, playerCountWheel } from '../../src/domain/slice/combat.js';
import { resolveAncientAlchemistCombatRound } from '../../src/domain/slice/ancient-alchemist-combat.js';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { ANCIENT_ALCHEMIST_COUNT_WHEEL, ANCIENT_ALCHEMIST_ENEMY_COUNT_WHEEL, ANCIENT_ALCHEMIST_ENEMY_ABILITY_WHEEL,
  ancientAlchemistAbilityWheel, ancientAlchemistActionCount, ancientAlchemistEnemyActionCount, drawAncientAlchemistAbility, drawAncientAlchemistEnemyAbility,
  currentAncientAlchemistCombatSource, beginAncientAlchemistCombatRound, resolveAncientAlchemistCombatAbility, resolveAncientAlchemistEnemyAbility,
  finishAncientAlchemistCombatRound, validateAncientAlchemistRoundOutcome, projectAncientAlchemistCombat, type AncientAlchemistMoveId } from '../../src/domain/ancient-alchemist/combat.js';
import { applyAncientAlchemistEncounterCommand, ancientAlchemistEncounterReason, hasAncientAlchemistDisputeOpponent,
  projectAncientAlchemistEncounter, settleAncientAlchemistEncounter, validateAncientAlchemistEncounter, validateAncientAlchemistEncounterCommand } from '../../src/domain/ancient-alchemist/encounter.js';
import { applyAncientAlchemistActivity, getAncientAlchemistGuardSegment } from '../../src/domain/ancient-alchemist/life.js';
import { DRUID_COUNT_WHEEL } from '../../src/domain/druid/combat.js';

const H = 'STRIKE', J = 'BODY_FOLLOWUP', B = 'mother.s4.living-matrix', K = 'mother.s5.ground-passage', R = 'mother.s7.life-support';
const profile: readonly [AncientAlchemistMoveId, number, SliceStance | null][] = [[H, 30, 'ATTACK'], [J, 15, 'ATTACK'], [B, 25, 'DEFEND'], [K, 10, 'CONTROL'], [R, 15, 'PREPARE'], ['ACCIDENT', 5, null]];
function ticket(id: AncientAlchemistMoveId, stance: SliceStance | null): number {
  let n = 1; for (const [candidate, weight, preferred] of profile) { if (id === candidate) return n; n += weight * (stance !== null && preferred === stance ? 5 : 4); }
  throw new Error('Missing action');
}
function random(...values: number[]): ActionRandomStream {
  let cursor = 0; return { seed: 'ancient-alchemist-directed', get cursor() { return cursor; }, nextInt(min, max) {
    const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected draw ${cursor}: ${n}, ${min}..${max}`); return n;
  } };
}
function context(): SeerContext { return { roll: min => min, note: vi.fn(), check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 20, difficulty, modifiers: [], roll: 1 }) }; }
/** Directed source fixture; acquisition and natural old Mother prefix are verified separately. */
function fixture(start = true, guard = false): SliceState {
  const s = createSliceRun('ancient-alchemist-combat-directed', sliceDefaultCreationSelection, 'ancient-alchemist-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 100; s.actionsRemaining = 6; s.cash = 1000;
  s.character.coreStats = { physique: 20, perception: 20, will: 20, knowledge: 20 };
  s.progression = { pathwayId: 'mother', sequence: 4, mastery: { [B]: 0, [K]: 0, [R]: 0, 'mother.s4.vital-knit': 0,
    'mother.s9.careful-practice': 0, 'mother.s6.specimen-study': 0 }, acting: 0, promotionWeek: 100 };
  s.ancientAlchemist = createAncientAlchemistState(); s.ancientAlchemist.promotionWeek = 100; s.ancientAlchemist.druidActingAtPromotion = 100;
  s.ancientAlchemist.guidanceKnown = true; s.druid.guidanceKnown = true;
  s.health = 100; s.mind = 100; s.spirituality = 120; s.town.clubLocation = 'SHOP'; s.arc.stage = 'ENDED';
  s.druid.encounter.status = 'RESOLVED';
  if (guard) applyAncientAlchemistActivity(s, { type: 'PREPARE_GUARD', kitId: 'AA4-GUARD-KIT-1' }, context(), vi.fn());
  s.ancientAlchemist.life.cases['living-stem'].status = 'RESOLVED';
  if (start) applyAncientAlchemistEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context()); return s;
}
function begin(s: SliceState, stance: SliceStance = 'ATTACK') { return beginAncientAlchemistCombatRound(s, stance, random()); }
function effect(s: SliceState, id: AncientAlchemistMoveId, r: ReturnType<typeof begin>, rng = random(), physical = 1) {
  return resolveAncientAlchemistCombatAbility(s, id, physical, rng, r);
}
function enemy(s: SliceState, id: Parameters<typeof resolveAncientAlchemistEnemyAbility>[1], r: ReturnType<typeof begin>, physical = 1) {
  return resolveAncientAlchemistEnemyAbility(s, id, physical, random(), r);
}
function complete(s: SliceState, r: ReturnType<typeof begin>) { const o = finishAncientAlchemistCombatRound(s, r); expect(validateAncientAlchemistRoundOutcome(o)).toBe(true); return o; }
function play(s: SliceState, stance: SliceStance, ...values: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt; let cursor = 0;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function(this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected shared draw ${cursor}: ${n}, ${min}..${max}`); return n;
  });
  try { const result = resolveAncientAlchemistCombatRound(s, stance); s.combatHistory.push(structuredClone(result.round)); s.revision++;
    expect(spy).toHaveBeenCalledTimes(values.length); return result; } finally { spy.mockRestore(); }
}
afterEach(() => vi.restoreAllMocks());

describe('One independent Osric and exact Mother profile', () => {
  it('keeps old six counts,30/15/25/10/15/5 and enemy2–4 slots', () => {
    const s = fixture(); expect(ANCIENT_ALCHEMIST_COUNT_WHEEL).toEqual(DRUID_COUNT_WHEEL); expect(playerCountWheel(s)).toEqual(DRUID_COUNT_WHEEL);
    expect(ancientAlchemistAbilityWheel(s, null).map(a => a.weight)).toEqual([30, 15, 25, 10, 15, 5]); expect(playerAbilityWheel(s, null)).toEqual(ancientAlchemistAbilityWheel(s, null));
    for (const [id] of profile) expect(drawAncientAlchemistAbility(random(ticket(id, 'CONTROL')), s, 'CONTROL')).toBe(id);
    expect([1, 13, 33, 58, 81, 95].map(ancientAlchemistActionCount)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(ANCIENT_ALCHEMIST_ENEMY_COUNT_WHEEL.map(a => a.weight)).toEqual([20, 50, 30]);
    expect([1, 20, 21, 70, 71, 100].map(ancientAlchemistEnemyActionCount)).toEqual([2, 2, 3, 3, 4, 4]);
    expect(ANCIENT_ALCHEMIST_ENEMY_ABILITY_WHEEL.map(a => a.weight)).toEqual([35, 25, 25, 10, 5]);
    expect([1, 36, 61, 86, 96].map(n => drawAncientAlchemistEnemyAbility(random(n)))).toEqual(['ARC_BOLT', 'WARD', 'BODY_STRIKE', 'COMPOSE', 'ACCIDENT']);
  });
  it('keeps Mother20/15/20/45 core with finite1250 and originalenemy850', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    const result = play(s, 'ATTACK', 1, 1, ticket('ACCIDENT', 'ATTACK'), 96, 96, 1);
    expect(result.round.playerAdvantage).toBe(baseAdvantage(10 * .2 + 20 * .15 + 30 * .2 + 40 * .45, 100, 100, 120, 1250, 120) - 22.5);
    expect(result.round.enemyAdvantage).toBe(baseAdvantage(20, 100, 100, 40, 850, 40) - 45); expect(result.round.consequenceWeights).toBeNull();
    expect(validateAncientAlchemistEncounter(s)).toBe(true);
  });
  it('never rewrites five old stages or reopens old Maren', () => {
    const s = fixture(false), old = structuredClone([s.cultivator, s.physician, s.harvestpriest, s.biologist, s.druid]);
    applyAncientAlchemistEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context());
    expect([s.cultivator, s.physician, s.harvestpriest, s.biologist, s.druid]).toEqual(old);
    expect(currentAncientAlchemistCombatSource(s)).toMatchObject({ targetId: 'AA4-OSRIC-VALE', targetAlive: true, independentMind: true,
      distanceMetres: 2, noBystanders: true, ordinaryExit: true, pursuit: false, enemyWeapon: 'AA4-OSRIC-CLUB', ground: 'KNOWN_SHALLOW_ORDINARY_LOAM' });
    expect(hasAncientAlchemistDisputeOpponent(s)).toBe(true); expect(validateAncientAlchemistEncounter(s)).toBe(true);
    expect(projectAncientAlchemistEncounter(s).encounter!.abilities.map(a => a.cost)).toEqual([5, 3, 0]);
  });
  it('requires report and real practice closure; ordinary refusal is final and costs1AP', () => {
    const s = fixture(false); s.ancientAlchemist.life.cases['living-stem'].status = 'AVAILABLE';
    expect(ancientAlchemistEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toContain('报告');
    s.ancientAlchemist.life.cases['living-stem'].status = 'RESOLVED'; s.druid.practice.marker = 'NEAR';
    expect(ancientAlchemistEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toContain('收束'); s.druid.practice.marker = 'BOX';
    applyAncientAlchemistEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context());
    expect(s.actionsRemaining).toBe(5); expect(s.combat).toBeNull(); expect(s.ancientAlchemist.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100, enemySpirituality: 40 });
    expect(validateAncientAlchemistEncounter(s)).toBe(true); expect(() => applyAncientAlchemistEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context())).toThrow('不能');
    expect(validateAncientAlchemistEncounterCommand({ type: 'ENCOUNTER_FIGHT', revive: true })).toBe(false);
  });
  it('rejects changed body, source, stock or resources with no RNG/payment', () => {
    for (const change of [(s: SliceState) => { s.revision++; }, (s: SliceState) => { s.health--; }, (s: SliceState) => { s.town.clubLocation = 'HAND'; },
      (s: SliceState) => { s.spirituality--; }, (s: SliceState) => { s.ancientAlchemist.encounter.enemySpirituality--; },
      (s: SliceState) => { s.ancientAlchemist.life.guards[0]!.segments[0]!.spentWeek = s.week; }]) {
      const s = fixture(true, true), r = begin(s); change(s); const before = structuredClone(s), rng = random();
      expect(effect(s, B, r, rng)).toMatchObject({ selfGain: 0, enemyReduction: 0 }); expect(s).toEqual(before); expect(rng.cursor).toBe(0);
    }
    const s = fixture(), r = begin(s); expect(resolveAncientAlchemistCombatAbility(s, K, 1, random(), r, { ...r.source, ground: 'UNKNOWN' } as never).selfGain).toBe(0);
    s.combat!.encounterId = 'DRUID_DISPUTE'; expect(currentAncientAlchemistCombatSource(s)).toBeNull(); expect(() => resolveAncientAlchemistCombatRound(s, 'ATTACK')).toThrow('原');
  });
});

describe('Unchanged inherited Druid moves', () => {
  it('H12 and J8.4 use ordinary physical budgets and original mastery', () => {
    const s = fixture(), r = begin(s); expect(effect(s, H, r, random(), .5).selfGain).toBe(6);
    expect(effect(s, J, r, random(), .5).selfGain).toBe(8.4 * .65 * .5); expect(s.spirituality).toBe(120); complete(s, r);
  });
  it('actualHANDclub replacesH16 and absentguard observes42.25 without creation', () => {
    const s = fixture(); s.town.clubLocation = 'HAND'; const r = begin(s);
    expect(effect(s, H, r, random(), .5).selfGain).toBe(8); expect(effect(s, B, r, random(), .5).enemyReduction).toBe(42.25 * .65 * .5);
    expect(s.ancientAlchemist.life.guards).toEqual([]); expect(s.spirituality).toBe(120); complete(s, r);
  });
  it('Ksuccess preserves3S knowledge14 and58.5 oldmastery completedloam maneuver', () => {
    const s = fixture(); s.progression.mastery[K] = 500; const r = begin(s), result = effect(s, K, r, random(1), .5);
    expect(result.enemyReduction).toBe(58.5 * .5); expect(result.label).toContain('沉入再出'); expect(result.threatens).toBe(false);
    expect(s.spirituality).toBe(117); expect(s.combat!.enemyHealth).toBe(100); complete(s, r);
  });
  it('Kfailure pays3S once, insufficientS takes ordinary6physical with no draw', () => {
    const s = fixture(), r = begin(s); expect(effect(s, K, r, random(100)).enemyReduction).toBe(0); expect(s.spirituality).toBe(117); complete(s, r);
    const low = fixture(); low.spirituality = 2; const l = begin(low); expect(effect(low, K, l, random(), .5).enemyReduction).toBe(3); expect(low.spirituality).toBe(2); complete(low, l);
  });
  it('Ractually healsfloor15mastery for4S, keeps oldinjuries/risk and uses no RNG', () => {
    const s = fixture(); s.health = 70; s.injuryRisk = 3; s.injuries = [{ id: 'old-original-injury', severity: 'HEAVY', acquiredRevision: 0, treatedRevision: null }];
    const old = structuredClone(s.injuries), r = begin(s), rng = random();
    expect(effect(s, R, r, rng)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(s.health).toBe(79); expect(s.spirituality).toBe(116); expect(s.injuries).toEqual(old); expect(s.injuryRisk).toBe(3); expect(rng.cursor).toBe(0);
    expect(complete(s, r)).toMatchObject({ playerHealthBeforeConsequence: 79, playerHealthAfter: 79 });
  });
  it('Rcaps at100 and repeated fullhealthR is0cost without newmastery substitutions', () => {
    const s = fixture(); s.health = 97; s.progression.mastery[R] = 500; s.progression.mastery['mother.s4.vital-knit'] = 0; const r = begin(s);
    effect(s, R, r); effect(s, R, r); expect(s.health).toBe(100); expect(s.spirituality).toBe(116); expect(r.playerActions.map(a => a.recoveredHealth)).toEqual([3, 0]); complete(s, r);
  });
  it('Rfullhealth/lowS never pays or draws and cannot revive', () => {
    const s = fixture(), r = begin(s); effect(s, R, r); expect(s.spirituality).toBe(120); complete(s, r);
    const low = fixture(); low.health = 50; low.spirituality = 3; const l = begin(low); effect(low, R, l); expect(low.health).toBe(50); expect(low.spirituality).toBe(3); complete(low, l);
    low.health = 0; expect(currentAncientAlchemistCombatSource(low)).toBeNull();
  });
});

describe('Three actual paid wrist segments, never duplicate inventory', () => {
  it('requires actual prepared3segments from registeredkit and retains its1AP120p4S costs', () => {
    const s = fixture(false, true); expect(s.cash).toBe(880); expect(s.spirituality).toBe(116); expect(s.actionsRemaining).toBe(5);
    expect(s.ancientAlchemist.life.guards).toHaveLength(1); expect(s.ancientAlchemist.life.guards[0]).toMatchObject({ id: 'AA4-GUARD-1', kitId: 'AA4-GUARD-KIT-1', holder: 'PLAYER' });
    expect(s.ancientAlchemist.life.guards[0]!.segments).toHaveLength(3);
    expect(s.ancientAlchemist.life.guardKits[0]!.status).toBe('CONSUMED');
  });
  it('Bconsumes actualsegment plus4S; pendingduplicate consumes nothing', () => {
    const s = fixture(true, true), r = begin(s); effect(s, B, r, random(1)); effect(s, B, r);
    expect(s.spirituality).toBe(112); expect(s.ancientAlchemist.encounter.guardAttempts).toBe(1);
    expect(s.ancientAlchemist.life.guards[0]!.segments.map(x => x.spentWeek)).toEqual([100, null, null]);
    expect(r.playerActions[0]).toMatchObject({ guard: { guardId: 'AA4-GUARD-1', segmentId: 'AA4-GUARD-1-SEGMENT-1' }, paidCost: 4, succeeded: true, activeSeconds: 60 });
    expect(r.playerActions[1]).toMatchObject({ guard: null, paidCost: 0, rolls: [] }); complete(s, r);
  });
  it('Bdoesnot reduce WARD/COMPOSE/accident and protects only nextpositiveARC', () => {
    const s = fixture(true, true), r = begin(s); effect(s, B, r, random(1));
    expect(enemy(s, 'WARD', r).enemyReduction).toBe(30); expect(enemy(s, 'COMPOSE', r).selfGain).toBe(0); expect(enemy(s, 'ACCIDENT', r).selfGain).toBe(-22.5);
    expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(33); expect(s.ancientAlchemist.encounter.guardReady).toBeNull();
    expect(s.ancientAlchemist.encounter.enemySpirituality).toBe(32); expect(r.enemyActions[3]).toMatchObject({ guardApplied: true, paidCost: 5, guard: r.playerActions[0]!.guard }); complete(s, r);
  });
  it('zeroBODY leaves pendingguard; onepositiveBODY uses it and nextBODY is unaffected', () => {
    const s = fixture(true, true), r = begin(s); effect(s, B, r, random(1));
    expect(enemy(s, 'BODY_STRIKE', r, 0).selfGain).toBe(0); expect(s.ancientAlchemist.encounter.guardReady).not.toBeNull();
    expect(enemy(s, 'BODY_STRIKE', r).selfGain).toBe(18 * .6); expect(enemy(s, 'BODY_STRIKE', r).selfGain).toBe(18); complete(s, r);
  });
  it('failedBkeeps paid costs and sameinertsegment, never edits priorattack', () => {
    const s = fixture(true, true), r = begin(s); enemy(s, 'ARC_BOLT', r); effect(s, B, r, random(100)); enemy(s, 'ARC_BOLT', r);
    expect(r.enemyActions.map(a => a.selfGain)).toEqual([55, 55]); expect(s.spirituality).toBe(112);
    expect(s.ancientAlchemist.life.guards[0]!.segments[0]).toEqual({ id: 'AA4-GUARD-1-SEGMENT-1', spentWeek: 100 });
    expect(r.playerActions[0]).toMatchObject({ succeeded: false, activeSeconds: 0, paidCost: 4 }); complete(s, r);
  });
  it('threefailedcharges exhaust allrealunits, fourthBonly ordinary observation', () => {
    const s = fixture(true, true), r = begin(s); for (let i = 0; i < 3; i++) effect(s, B, r, random(100));
    expect(effect(s, B, r).enemyReduction).toBe(42.25 * .65); expect(s.spirituality).toBe(104); expect(getAncientAlchemistGuardSegment(s)).toBeNull();
    expect(s.ancientAlchemist.life.guards[0]!.segments.every(x => x.spentWeek === 100)).toBe(true); expect(complete(s, r).remainingGuardSegments).toEqual([]);
  });
  it('lowSfallback leaves actualunusedsegments untouched', () => {
    const s = fixture(true, true); s.spirituality = 3; const r = begin(s), original = structuredClone(s.ancientAlchemist.life.guards);
    expect(effect(s, B, r, random(), .5).enemyReduction).toBe(42.25 * .65 * .5); expect(s.spirituality).toBe(3); expect(s.ancientAlchemist.life.guards).toEqual(original); complete(s, r);
  });
  it('roundexpiry actually ends60seconds, keeps spentbody and never refunds or refills', () => {
    const s = fixture(true, true), r = begin(s); effect(s, B, r, random(1)); const o = complete(s, r);
    expect(o).toMatchObject({ guardReady: null, guardExpired: true, elapsedSeconds: 60, playerSpiritualityAfter: 112 });
    expect(o.remainingGuardSegments).toHaveLength(2); expect(s.ancientAlchemist.encounter.guardReady).toBeNull();
    expect(s.ancientAlchemist.life.guards[0]!.segments[0]!.spentWeek).toBe(100); expect(() => finishAncientAlchemistCombatRound(s, r)).toThrow('结束');
    expect(projectAncientAlchemistCombat(s).summary).toContain('无自动补充');
  });
});

describe('Common real consequences, finite enemy and replay integrity', () => {
  it('enemyspends40 across realrounds then originalARCslot fallsbackactualBODY0S', () => {
    const s = fixture();
    play(s, 'PREPARE', 1, 100, ticket('ACCIDENT', 'PREPARE'), 1, 1, 1, 1, 1);
    play(s, 'PREPARE', 1, 100, 1, ticket('ACCIDENT', 'PREPARE'), 1, 1, 1, 1);
    expect(s.ancientAlchemist.encounter.enemySpirituality).toBe(0); expect(s.ancientAlchemist.encounter.powerUses.ARC_BOLT).toBe(8);
    const r = begin(s); expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(18); expect(enemy(s, 'WARD', r).selfGain).toBe(18);
    expect(enemy(s, 'COMPOSE', r).selfGain).toBe(0); expect(s.ancientAlchemist.encounter.enemySpirituality).toBe(0); complete(s, r);
  });
  it('only continue recoversoriginal12S; guardstock remains actually depleted', () => {
    const s = fixture(true, true); s.spirituality = 20;
    const result = play(s, 'DEFEND', 1, 1, ticket(B, 'DEFEND'), 1, 86, 86, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.ancientAlchemistOutcome!.playerSpiritualityAfter).toBe(16); expect(s.spirituality).toBe(28);
    expect(getAncientAlchemistGuardSegment(s)?.segmentId).toBe('AA4-GUARD-1-SEGMENT-2'); expect(validateAncientAlchemistEncounter(s)).toBe(true);
  });
  it('real Rhealthsurvives roundfinish then commoninjury subtracts fromactual healedHP', () => {
    const s = fixture(); s.health = 70; s.injuryRisk = 2; s.injuries = [{ id: 'old-light', severity: 'LIGHT', acquiredRevision: 0, treatedRevision: null }];
    const result = play(s, 'PREPARE', 1, 1, ticket(R, 'PREPARE'), 61, 86, 1_000_000, 1);
    expect(result.round.ancientAlchemistOutcome).toMatchObject({ playerHealthBeforeConsequence: 79, playerHealthAfter: 69 });
    expect(s.health).toBe(69); expect(s.injuryRisk).toBe(3); expect(s.injuries).toHaveLength(2);
    expect(result.round.consequenceWeights).toEqual(consequenceWeights(3)); expect(validateAncientAlchemistEncounter(s)).toBe(true);
  });
  it('real enemyheavyinjury causes surrender, recordsoriginalbody and doesnot reopen', () => {
    const s = fixture(), result = play(s, 'ATTACK', 1, 1, ticket(H, 'ATTACK'), 86, 86, 1, 70);
    expect(result.outcome).toBe('ENEMY_SURRENDERED'); expect(s.ancientAlchemist.encounter.enemyHealth).toBe(70);
    const award = vi.fn(); settleAncientAlchemistEncounter(s, result.outcome, context(), award); expect(award).toHaveBeenCalledWith('ancient-alchemist-dispute', 25);
    expect(s.combat).toBeNull(); expect(validateAncientAlchemistEncounter(s)).toBe(true); expect(ancientAlchemistEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toContain('不能');
  });
  it('commondeath reallykillsoriginalenemy and gives no living replacement', () => {
    const s = fixture(), old = structuredClone(s.druid), result = play(s, 'ATTACK', 1, 1, ticket(H, 'ATTACK'), 86, 86, 1, 100);
    expect(result.outcome).toBe('ENEMY_DEAD'); settleAncientAlchemistEncounter(s, result.outcome, context());
    expect(s.ancientAlchemist.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 0, enemyStatus: 'DEAD' }); expect(s.druid).toEqual(old); expect(validateAncientAlchemistEncounter(s)).toBe(true);
  });
  it('originalplayerdeath remainsdeath withoutlifealchemyrevival', () => {
    const s = fixture(), result = play(s, 'ATTACK', 1, 1, ticket('ACCIDENT', 'ATTACK'), 61, 86, 1_000_000, 100);
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); s.status = 'DEAD'; settleAncientAlchemistEncounter(s, result.outcome, context());
    expect(s.ancientAlchemist.encounter.status).toBe('LOST'); expect(validateAncientAlchemistEncounter(s)).toBe(true);
  });
  it('originalexit retreat costsnocreativeescape or12Scontinue bonus', () => {
    const s = fixture(); s.spirituality = 20; const result = play(s, 'RETREAT', 1, 1, 1);
    expect(result.outcome).toBe('RETREATED'); expect(result.round.moves).toEqual([]); expect(s.spirituality).toBe(20);
    settleAncientAlchemistEncounter(s, result.outcome, context()); expect(validateAncientAlchemistEncounter(s)).toBe(true); expect(s.ancientAlchemist.encounter.enemyHealth).toBe(100);
  });
  it('recordedroll/cost/effect/heal/segment tampering is rejected by actual replay', () => {
    const s = fixture(true, true); s.health = 70; const r = begin(s); effect(s, B, r, random(1)); enemy(s, 'ARC_BOLT', r); effect(s, R, r); const o = complete(s, r);
    for (const alter of [(p: typeof o) => { p.playerActions[0]!.paidCost = 0; }, (p: typeof o) => { p.enemyActions[0]!.selfGain = 0; },
      (p: typeof o) => { p.playerActions[1]!.recoveredHealth = 100; }, (p: typeof o) => { p.playerHealthBeforeConsequence = 100; },
      (p: typeof o) => { p.playerActions[0]!.guard!.segmentId = 'fabricated'; }, (p: typeof o) => { p.remainingGuardSegments.push(p.source.guardSegments[0]!); },
      (p: typeof o) => { p.playerActions[0]!.rolls = []; }]) { const forged = structuredClone(o); alter(forged); expect(validateAncientAlchemistRoundOutcome(forged)).toBe(false); }
  });
  it('actual retainedsegment cannot be unspent or replaced after persisted round', () => {
    const s = fixture(true, true); play(s, 'DEFEND', 1, 1, ticket(B, 'DEFEND'), 1, 86, 86, 1);
    expect(validateAncientAlchemistEncounter(s)).toBe(true); s.ancientAlchemist.life.guards[0]!.segments[0]!.spentWeek = null;
    expect(validateAncientAlchemistEncounter(s)).toBe(false);
  });
});
