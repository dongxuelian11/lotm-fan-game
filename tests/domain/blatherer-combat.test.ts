import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { createBlathererState } from '../../src/domain/blatherer/index.js';
import { applyBlathererEncounterCommand } from '../../src/domain/blatherer/encounter.js';
import {
  BLATHERER_COUNT_WHEEL, BLATHERER_ENEMY_COUNT_WHEEL, BLATHERER_ENEMY_ABILITY_WHEEL,
  blathererActionCount, blathererEnemyActionCount, blathererAbilityWheel, drawBlathererAbility, drawBlathererEnemyAbility,
  beginBlathererCombatRound, currentBlathererCombatSource, resolveBlathererCombatAbility, resolveBlathererEnemyAbility,
  finishBlathererCombatRound, blathererRoundOutcome, validateBlathererRoundOutcome, projectBlathererCombat,
  type BlathererCombatSource, type BlathererMoveId,
} from '../../src/domain/blatherer/combat.js';

const H = 'abyss.s6.flame-hex', J = 'BODY_FOLLOWUP', B = 'abyss.s6.demonic-body', K = 'abyss.s3.limited-murmur';
const context: SeerContext = { roll: min => min, note: () => {}, check: () => { throw new Error('No automatic scene check'); } };
function random(...values: number[]): ActionRandomStream { let cursor = 0;
  return { seed: 'blatherer-directed-unit', get cursor() { return cursor; }, nextInt(min, max) { const n = values[cursor++] ?? 1; expect(n).toBeGreaterThanOrEqual(min); expect(n).toBeLessThanOrEqual(max); return n; } };
}
/** Directed S3 boundary setup on the unchanged genuine434-command Devil4 prefix, not natural promotion evidence. */
function fixture(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/devil-v01330/natural.json', 'utf8')).final);
  s.blatherer = createBlathererState(); s.blatherer.guidanceKnown = true; s.blatherer.promotionWeek = s.week; s.blatherer.devilActingAtPromotion = 100;
  s.progression.sequence = 3; s.progression.acting = 0; s.progression.mastery[K] = 0; s.character.coreStats.knowledge = 18;
  s.actionsRemaining = 3; s.health = 100; s.mind = 100; s.spirituality = 120; s.activeEvent = null; s.combat = null;
  applyBlathererEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context); applyBlathererEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); return s;
}
const begin = (s: SliceState) => beginBlathererCombatRound(s, 'ATTACK', random());
const player = (s: SliceState, r: ReturnType<typeof begin>, id: BlathererMoveId, rng = random(), physical = 1) => resolveBlathererCombatAbility(s, id, physical, rng, r);
const enemy = (s: SliceState, r: ReturnType<typeof begin>, id: Parameters<typeof resolveBlathererEnemyAbility>[1], physical = 1) => resolveBlathererEnemyAbility(s, id, physical, random(), r);
const valid = (s: SliceState, r: ReturnType<typeof begin>) => expect(validateBlathererRoundOutcome(finishBlathererCombatRound(s, r))).toBe(true);
const legacy = (s: SliceState) => structuredClone({ criminal: s.criminal, unwinged: s.unwinged, serialKiller: s.serialKiller, demon: s.demon, desireApostle: s.desireApostle, devil: s.devil, town: s.town });

describe('Blatherer bounded whisper, actual inherited costs and ordered evidence', () => {
  it('uses both1–6 wheels and exact H30/J15/B20/K20/R10/A5 weights', () => {
    expect(BLATHERER_COUNT_WHEEL.map(v => v.weight)).toEqual([10, 15, 25, 25, 15, 10]); expect(BLATHERER_ENEMY_COUNT_WHEEL).toEqual(BLATHERER_COUNT_WHEEL);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [75, 4], [76, 5], [90, 5], [91, 6], [100, 6]]) {
      expect(blathererActionCount(roll!)).toBe(count); expect(blathererEnemyActionCount(roll!)).toBe(count);
    }
    const wheel = blathererAbilityWheel(fixture(), null);
    expect(wheel.map(v => v.id)).toEqual([H, J, B, K, 'OBSERVE', 'ACCIDENT']); expect(wheel.map(v => v.weight)).toEqual([30, 15, 20, 20, 10, 5]);
    expect(BLATHERER_ENEMY_ABILITY_WHEEL.map(v => v.id)).toEqual(['ARC_BOLT', 'WARD', 'BODY_STRIKE', 'STEADY_BREATH', 'ACCIDENT']);
    expect(BLATHERER_ENEMY_ABILITY_WHEEL.map(v => v.weight)).toEqual([35, 25, 25, 10, 5]);
  });
  it('draws exact boundaries once with standard5-to4 stance bias', () => {
    const s = fixture(); let boundary = 0;
    for (const a of blathererAbilityWheel(s, null)) { const first = boundary + 1; boundary += a.weight * 4;
      const rng = random(first, boundary); expect(drawBlathererAbility(rng, s, null)).toBe(a.id); expect(drawBlathererAbility(rng, s, null)).toBe(a.id); expect(rng.cursor).toBe(2); }
    boundary = 0; for (const a of BLATHERER_ENEMY_ABILITY_WHEEL) { const first = boundary + 1; boundary += a.weight;
      const rng = random(first, boundary); expect(drawBlathererEnemyAbility(rng)).toBe(a.id); expect(drawBlathererEnemyAbility(rng)).toBe(a.id); }
    expect(drawBlathererAbility(random(306), s, 'ATTACK')).toBe(K); expect(drawBlathererAbility(random(385), s, 'ATTACK')).toBe(K);
    expect(blathererAbilityWheel(s, 'CONTROL')[3]!.weight).toBe(100 / 420 * 100);
  });
  it.each([[1, 'GREAT_SUCCESS', true], [50, 'SUCCESS', true], [51, 'FAILURE', false], [100, 'GREAT_FAILURE', false]] as const)('records fourtier roll%s as%s and retains4S1M', (roll, tier, success) => {
    const s = fixture(), old = legacy(s), r = begin(s); expect(player(s, r, K, random(roll))).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
    expect(r.playerActions[0]).toMatchObject({ paidCost: 4, mindCost: 1, strainCost: 0, checkTier: tier, prepared: success ? 'WHISPER' : null });
    expect(s.spirituality).toBe(116); expect(s.mind).toBe(99); expect(enemy(s, r, 'BODY_STRIKE').selfGain).toBe(success ? 10 : 20);
    expect(legacy(s)).toEqual(old); valid(s, r);
  });
  it('reduces only one positive actual BODY or paid ARC and leaves real30s residual after consumption', () => {
    const s = fixture(), r = begin(s); player(s, r, K); enemy(s, r, 'WARD'); enemy(s, r, 'ACCIDENT'); enemy(s, r, 'BODY_STRIKE', 0);
    expect(s.blatherer.encounter.whisperReady).toBe(true); expect(enemy(s, r, 'ARC_BOLT').selfGain).toBe(35); expect(enemy(s, r, 'BODY_STRIKE').selfGain).toBe(20);
    expect(s.blatherer.encounter).toMatchObject({ whisperReady: false, residualSeconds: 30, enemySpirituality: 111, powerUses: { ARC_BOLT: 1, WARD: 1 } }); valid(s, r);
  });
  it('repeated successful whisper paysagain but cannot stack damage multipliers', () => {
    const s = fixture(), r = begin(s), rng = random(1, 50); player(s, r, K, rng); player(s, r, K, rng);
    expect(rng.cursor).toBe(2); expect(s.spirituality).toBe(112); expect(s.mind).toBe(98); expect(enemy(s, r, 'ARC_BOLT').selfGain).toBe(35);
    expect(enemy(s, r, 'ARC_BOLT').selfGain).toBe(70); valid(s, r);
  });
  it('failed paid renewal does not fabricate success or erase a prior successful window', () => {
    const s = fixture(), r = begin(s); player(s, r, K, random(1)); player(s, r, K, random(100));
    expect(r.playerActions.map(a => a.mode)).toEqual(['PREPARED', 'FAILED']); expect(enemy(s, r, 'BODY_STRIKE').selfGain).toBe(10);
    expect(s.spirituality).toBe(112); expect(s.mind).toBe(98); valid(s, r);
  });
  it('actual focused breath clears pending whisper and residual without refund or health repair', () => {
    const s = fixture(), old = legacy(s), r = begin(s); player(s, r, K);
    expect(enemy(s, r, 'STEADY_BREATH')).toMatchObject({ selfGain: 8, enemyReduction: 0, threatens: false });
    expect(r.enemyActions[0]).toMatchObject({ paidCost: 0, whisperCleared: true, whisperConsumed: false });
    expect(s.blatherer.encounter).toMatchObject({ whisperReady: false, residualSeconds: 0, breathUses: 1, enemySpirituality: 120 });
    expect(enemy(s, r, 'ARC_BOLT').selfGain).toBe(70); expect(s.spirituality).toBe(116); expect(s.mind).toBe(99); expect(s.health).toBe(100); expect(legacy(s)).toEqual(old); valid(s, r);
  });
  it('breath after earlier halving cannot undo the alreadyexecuted contribution', () => {
    const s = fixture(), r = begin(s); player(s, r, K); enemy(s, r, 'ARC_BOLT'); enemy(s, r, 'STEADY_BREATH'); enemy(s, r, 'BODY_STRIKE');
    expect(r.enemyActions.map(a => a.selfGain)).toEqual([35, 8, 20]); expect(r.enemyActions[1]!.whisperCleared).toBe(true); valid(s, r);
  });
  it('enemy attacks before whisper are not retroactively reduced', () => {
    const s = fixture(), r = begin(s); enemy(s, r, 'ARC_BOLT'); player(s, r, K); enemy(s, r, 'ARC_BOLT');
    expect(r.enemyActions.map(a => a.selfGain)).toEqual([70, 35]); expect(r.enemyActions.map(a => a.order)).toEqual([0, 2]); valid(s, r);
  });
  it('insufficientenemyS uses originalrod with zero cost and no free refill', () => {
    const s = fixture(); s.blatherer.encounter.powerUses.ARC_BOLT = 24; s.blatherer.encounter.enemySpirituality = 0; const r = begin(s); player(s, r, K);
    expect(enemy(s, r, 'ARC_BOLT').selfGain).toBe(10); expect(enemy(s, r, 'WARD').selfGain).toBe(20); expect(enemy(s, r, 'STEADY_BREATH').selfGain).toBe(8);
    expect(r.enemyActions.slice(0, 2).every(a => a.actual === 'BODY_STRIKE' && a.paidCost === 0)).toBe(true); expect(s.blatherer.encounter.enemySpirituality).toBe(0); valid(s, r);
  });
  it('cannot whisper with3S or1M and makes no draw or charge', () => {
    for (const [spirituality, mind] of [[3, 100], [120, 1]]) { const s = fixture(); s.spirituality = spirituality!; s.mind = mind!; const r = begin(s), rng = random();
      player(s, r, K, rng); expect(rng.cursor).toBe(0); expect(s.spirituality).toBe(spirituality); expect(s.mind).toBe(mind); valid(s, r); }
  });
  it('pays actual olddemon strain for flame60 and inherited harden50.7; nevercreates new freeimmune', () => {
    const s = fixture(); s.demon.strain = 0; s.progression.mastery[H] = 500; s.progression.mastery[B] = 500; const old = legacy(s), r = begin(s);
    expect(player(s, r, H).selfGain).toBe(60); expect(player(s, r, B, random(), .5).enemyReduction).toBe(25.35); expect(player(s, r, B).enemyReduction).toBe(50.7);
    expect(s.spirituality).toBe(113); expect(s.demon.strain).toBe(3); expect(r.playerActions.map(a => a.strainCost)).toEqual([1, 1, 1]);
    expect(player(s, r, H).selfGain).toBe(12); expect(player(s, r, B).enemyReduction).toBe(10); expect(s.spirituality).toBe(113);
    old.demon.strain = 3; expect(legacy(s)).toEqual(old); valid(s, r);
  });
  it('actualnatural oldstrain3 remains full and newstage does notreset inheritedlimit', () => {
    const s = fixture(), old = legacy(s), r = begin(s); expect(s.demon.strain).toBe(3); expect(player(s, r, H).selfGain).toBe(12); expect(player(s, r, B).enemyReduction).toBe(10);
    expect(s.spirituality).toBe(120); expect(legacy(s)).toEqual(old); valid(s, r);
  });
  it('ownoriginalclub replacesflame with16body atzero cost; bodyfollowup uses actualoldmastery', () => {
    const s = fixture(); s.town.clubLocation = 'HAND'; s.progression.mastery[B] = 500; const r = begin(s);
    expect(player(s, r, H, random(), .5).selfGain).toBe(8); expect(player(s, r, J, random(), .5).selfGain).toBe(29.575 * .5); expect(s.spirituality).toBe(120);
    expect(s.blatherer.encounter.weaponLocation).toBe('HAND'); expect(s.town.clubLocation).toBe('HAND'); valid(s, r);
  });
  it('newmastery doesnot grant damage or better chances without a new explicit rule', () => {
    const s = fixture(); s.progression.mastery[K] = 500; const r = begin(s); player(s, r, K, random(51));
    expect(r.playerActions[0]).toMatchObject({ checkTier: 'FAILURE', selfGain: 0, enemyReduction: 0, threatens: false }); valid(s, r);
  });
  it('observe and accident neither read secrets nor fabricate old seeds', () => {
    const s = fixture(), old = legacy(s), r = begin(s), rng = random();
    expect(player(s, r, 'OBSERVE', rng)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(player(s, r, 'ACCIDENT', rng).selfGain).toBe(-22.5); expect(rng.cursor).toBe(0); expect(legacy(s)).toEqual(old);
    expect(JSON.stringify(s.blatherer.encounter)).not.toMatch(/seedPlanted|lastSeedRound/); valid(s, r);
  });
  it('rejects stalesource, changedcurrentresources and substitutedoriginalperson without draw', () => {
    const s = fixture(), r = begin(s), rng = random(), source = structuredClone(r.source); source.targetAge = 49 as 48;
    resolveBlathererCombatAbility(s, K, 1, rng, r, source); expect(rng.cursor).toBe(0); expect(r.playerActions).toHaveLength(0);
    s.demon.strain = 2; player(s, r, K, rng); expect(rng.cursor).toBe(0); expect(s.spirituality).toBe(120);
    const other = fixture(); other.blatherer.encounter.targetId = 'DV4-ORRICK-FANE' as 'BL3-EDRIC'; expect(currentBlathererCombatSource(other)).toBeNull();
  });
  it('requires actual currentawake listener, originalrod and emptycourt', () => {
    const mutations: ((s: SliceState) => void)[] = [s => { s.blatherer.encounter.scene.targetAwake = false; }, s => { s.blatherer.encounter.scene.targetListening = false; },
      s => { s.blatherer.encounter.scene.thirdPartiesInArea = 1 as 0; }, s => { s.blatherer.encounter.weaponLocation = 'COURT'; }, s => { s.blatherer.encounter.scene.distanceMetres = 9 as 4; }];
    for (const mutate of mutations) { const s = fixture(), r = begin(s), rng = random(); mutate(s); expect(currentBlathererCombatSource(s)).toBeNull();
      player(s, r, K, rng); expect(rng.cursor).toBe(0); expect(r.playerActions).toHaveLength(0); expect(s.spirituality).toBe(120); }
  });
  it('caps bothactors at6 and isolates returnedoutcome from storedproof', () => {
    const s = fixture(), r = begin(s); for (let i = 0; i < 6; i++) { player(s, r, K); enemy(s, r, 'STEADY_BREATH'); }
    const rng = random(); player(s, r, K, rng); enemy(s, r, 'ARC_BOLT'); expect(rng.cursor).toBe(0); expect(r.playerActions).toHaveLength(6); expect(r.enemyActions).toHaveLength(6);
    const o = finishBlathererCombatRound(s, r); expect(validateBlathererRoundOutcome(o)).toBe(true); o.breathUses++;
    expect(blathererRoundOutcome(r).breathUses).toBe(6); expect(validateBlathererRoundOutcome(o)).toBe(false); expect(() => finishBlathererCombatRound(s, r)).toThrow();
  });
  it('actual60second continuation expires roundeffect and residual without healing or ownrefill', () => {
    const s = fixture(), r = begin(s); player(s, r, K); const o = finishBlathererCombatRound(s, r);
    expect(o).toMatchObject({ whisperReadyAfter: false, residualSecondsAfter: 0, elapsedSeconds: 60, cleanupWaitSeconds: 0, exitSeconds: 0 });
    expect(s.spirituality).toBe(116); expect(s.mind).toBe(99); expect(s.blatherer.life.clockSeconds).toBe(60); expect(validateBlathererRoundOutcome(o)).toBe(true);
  });
  it('terminalactual30second residual wait precedes ordinary4metreexit without healing', () => {
    const s = fixture(), r = begin(s); player(s, r, K); const o = finishBlathererCombatRound(s, r, false);
    expect(o).toMatchObject({ cleanupWaitSeconds: 30, exitSeconds: 4, elapsedSeconds: 94, lifeClockSecondsAfter: 94, sceneAfter: { playerPosition: 'EXIT', ordinaryWalkedMetres: 4, targetListening: false } });
    expect(s.spirituality).toBe(116); expect(s.mind).toBe(99); expect(validateBlathererRoundOutcome(o)).toBe(true);
  });
  it('realdeath keeps actualplayerbody inoriginalcourt withnorevival', () => {
    const s = fixture(), r = begin(s); player(s, r, K); enemy(s, r, 'ARC_BOLT'); s.health = 0;
    const o = finishBlathererCombatRound(s, r, false); expect(o).toMatchObject({ cleanupWaitSeconds: 30, exitSeconds: 0, elapsedSeconds: 90, sceneAfter: { playerPosition: 'COURT', ordinaryWalkedMetres: 0 } });
    expect(s.health).toBe(0); expect(s.mind).toBe(99); expect(validateBlathererRoundOutcome(o)).toBe(true);
  });
  it('replayscosts,chronology,breath,effects and currentstate proof without phantom injury', () => {
    const s = fixture(), r = begin(s); player(s, r, K); enemy(s, r, 'STEADY_BREATH'); const o = finishBlathererCombatRound(s, r); expect(validateBlathererRoundOutcome(o)).toBe(true);
    const changes: ((v: typeof o) => void)[] = [v => { v.playerSpiritualityAfter++; }, v => { v.playerMindAfter++; }, v => { v.enemySpirituality--; }, v => { v.playerStrainAfter--; },
      v => { v.playerActions[0]!.paidCost = 0; }, v => { v.playerActions[0]!.mindCost = 0; }, v => { v.playerActions[0]!.threatens = true; }, v => { v.playerActions[0]!.checkTier = 'FAILURE'; },
      v => { v.enemyActions[0]!.whisperCleared = false; }, v => { v.enemyActions[0]!.order = 0; }, v => { v.whisperReadyAfter = true as false; }, v => { v.breathUses++; },
      v => { v.enemyHealth--; }, v => { v.playerHealthAfter--; }, v => { v.enemyMind--; }, v => { v.enemyStatus = 'SURRENDERED'; }, v => { v.lifeClockSecondsAfter++; },
      v => { v.sceneAfter.playerPosition = 'EXIT'; }, v => { v.source = { ...v.source, actualOriginalBody: false } as unknown as BlathererCombatSource; }];
    for (const change of changes) { const bad = structuredClone(o); change(bad); expect(validateBlathererRoundOutcome(bad)).toBe(false); }
  });
  it('preserves originalOriick70H32S surrendered and hides newEdric beforeS3', () => {
    const s = fixture(); expect(s.devil.encounter).toMatchObject({ targetId: 'DV4-ORRICK-FANE', enemyHealth: 70, enemySpirituality: 32, enemyStatus: 'SURRENDERED' });
    expect(currentBlathererCombatSource(s)).toMatchObject({ targetAge: 48, targetSequence: 4, targetPhysique: 22, distanceMetres: 4, enemyWeapon: 'BL3-EDRIC-ROD' });
    s.progression.sequence = 4; const view = projectBlathererCombat(s); expect(view.source).toBeNull(); expect(view.scene).toBeNull(); expect(view.targetId).toBeNull(); expect(JSON.stringify(view)).not.toMatch(/EDRIC|埃德里克/);
  });
});
