import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { createUnagingDemonessState } from '../../src/domain/unaging-demoness/index.js';
import { applyUnagingDemonessEncounterCommand } from '../../src/domain/unaging-demoness/encounter.js';
import {
  UNAGING_DEMONESS_COUNT_WHEEL, UNAGING_DEMONESS_ENEMY_COUNT_WHEEL, UNAGING_DEMONESS_ENEMY_ABILITY_WHEEL,
  unagingDemonessActionCount, unagingDemonessEnemyActionCount, unagingDemonessAbilityWheel, drawUnagingDemonessAbility, drawUnagingDemonessEnemyAbility,
  beginUnagingDemonessCombatRound, currentUnagingDemonessCombatSource, resolveUnagingDemonessCombatAbility, resolveUnagingDemonessEnemyAbility,
  finishUnagingDemonessCombatRound, unagingDemonessRoundOutcome, validateUnagingDemonessRoundOutcome, projectUnagingDemonessCombat,
  type UnagingDemonessCombatSource, type UnagingDemonessMoveId,
} from '../../src/domain/unaging-demoness/combat.js';

const MIRROR = 'assassin.s3.mirror-passage', FLAME = 'assassin.s7.black-flame', FROST = 'assassin.s7.frost', SUB = 'assassin.s7.substitute', SILK = 'assassin.s6.silk-binding';
const context: SeerContext = { roll: min => min, note: () => {}, check: () => { throw new Error('No automatic scene check'); } };
function random(...values: number[]): ActionRandomStream { let cursor = 0;
  return { seed: 'unaging-demoness-directed-unit', get cursor() { return cursor; }, nextInt(min, max) { const n = values[cursor++] ?? 1; expect(n).toBeGreaterThanOrEqual(min); expect(n).toBeLessThanOrEqual(max); return n; } };
}
/** Directed S3 unit arrangement on the unchanged genuine natural361-command S4 prefix. */
function fixture(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/despair-v01300/natural.json', 'utf8')).final);
  s.unagingDemoness = createUnagingDemonessState(); s.unagingDemoness.guidanceKnown = true; s.unagingDemoness.promotionWeek = s.week; s.unagingDemoness.despairActingAtPromotion = 100;
  s.progression.sequence = 3; s.progression.acting = 0; s.progression.mastery[MIRROR] = 0; s.character.coreStats.knowledge = 30;
  s.actionsRemaining = 3; s.health = 100; s.mind = 100; s.spirituality = 120; s.activeEvent = null; s.combat = null;
  applyUnagingDemonessEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context); applyUnagingDemonessEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); return s;
}
const begin = (s: SliceState) => beginUnagingDemonessCombatRound(s, 'ATTACK', random());
const player = (s: SliceState, r: ReturnType<typeof begin>, id: UnagingDemonessMoveId, rng = random()) => resolveUnagingDemonessCombatAbility(s, id, 1, rng, r);
const enemy = (s: SliceState, r: ReturnType<typeof begin>, id: Parameters<typeof resolveUnagingDemonessEnemyAbility>[1]) => resolveUnagingDemonessEnemyAbility(s, id, 1, random(), r);
const valid = (s: SliceState, r: ReturnType<typeof begin>) => expect(validateUnagingDemonessRoundOutcome(finishUnagingDemonessCombatRound(s, r))).toBe(true);
const legacy = (s: SliceState) => structuredClone({ assassin: s.assassin, instigator: s.instigator, witch: s.witch, pleasure: s.pleasure, pain: s.pain, despair: s.despair, town: s.town });

describe('UnagingDemoness same original body and finite mirror combat', () => {
  it('retains shared1–6 counts and actual old six-slot weighting with only plague replaced', () => {
    expect(UNAGING_DEMONESS_COUNT_WHEEL.map(v => v.weight)).toEqual([10, 15, 25, 25, 15, 10]); expect(UNAGING_DEMONESS_ENEMY_COUNT_WHEEL).toEqual(UNAGING_DEMONESS_COUNT_WHEEL);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [75, 4], [76, 5], [90, 5], [91, 6], [100, 6]]) {
      expect(unagingDemonessActionCount(roll!)).toBe(count); expect(unagingDemonessEnemyActionCount(roll!)).toBe(count);
    }
    const wheel = unagingDemonessAbilityWheel(fixture(), null);
    expect(wheel.map(v => v.id)).toEqual([FLAME, FROST, SUB, MIRROR, SILK, 'ACCIDENT']); expect(wheel.map(v => v.weight)).toEqual([30, 15, 20, 20, 10, 5]);
    expect(UNAGING_DEMONESS_ENEMY_ABILITY_WHEEL.map(v => v.id)).toEqual(['FORCE_STRIKE', 'SEAL_MIRROR', 'BODY_STRIKE', 'BREAK_MIRROR', 'ACCIDENT']);
    expect(UNAGING_DEMONESS_ENEMY_ABILITY_WHEEL.map(v => v.weight)).toEqual([35, 25, 20, 15, 5]);
  });
  it('draws base wheel boundaries once without extra slots and uses standard5-to4 stance bias', () => {
    const s = fixture(); let boundary = 0;
    for (const a of unagingDemonessAbilityWheel(s, null)) { const first = boundary + 1; boundary += a.weight * 4;
      const rng = random(first, boundary); expect(drawUnagingDemonessAbility(rng, s, null)).toBe(a.id); expect(drawUnagingDemonessAbility(rng, s, null)).toBe(a.id); expect(rng.cursor).toBe(2); }
    boundary = 0; for (const a of UNAGING_DEMONESS_ENEMY_ABILITY_WHEEL) { const first = boundary + 1; boundary += a.weight;
      const rng = random(first, boundary); expect(drawUnagingDemonessEnemyAbility(rng)).toBe(a.id); expect(drawUnagingDemonessEnemyAbility(rng)).toBe(a.id); }
    expect(drawUnagingDemonessAbility(random(306), s, 'ATTACK')).toBe(MIRROR); expect(drawUnagingDemonessAbility(random(385), s, 'ATTACK')).toBe(MIRROR);
    expect(unagingDemonessAbilityWheel(s, 'CONTROL')[3]!.weight).toBe(100 / 420 * 100);
  });
  it('moves the same body A↔B2metres per6S success without attacking or changing original people', () => {
    const s = fixture(), old = legacy(s), r = begin(s);
    expect(player(s, r, MIRROR)).toMatchObject({ selfGain: 0, enemyReduction: 36, threatens: false });
    expect(s.unagingDemoness.encounter.scene).toMatchObject({ playerPosition: 'B', mirrorPassedMetres: 2 });
    expect(player(s, r, MIRROR).enemyReduction).toBe(36); expect(s.unagingDemoness.encounter.scene).toMatchObject({ playerPosition: 'A', mirrorPassedMetres: 4 });
    expect(s.spirituality).toBe(108); expect(legacy(s)).toEqual(old); valid(s, r);
  });
  it('uses actual knowledge18 boundary and retains the failed6S cost at original point', () => {
    const s = fixture(); s.character.coreStats.knowledge = 18; const r = begin(s);
    expect(player(s, r, MIRROR, random(50)).enemyReduction).toBe(36); expect(player(s, r, MIRROR, random(51)).enemyReduction).toBe(0);
    expect(r.playerActions[1]).toMatchObject({ paidCost: 6, mode: 'MIRROR_FAILURE', from: 'B', to: 'B' }); expect(s.spirituality).toBe(108); valid(s, r);
  });
  it('insufficientS leaves body inA with ordinary0S fallback and no roll', () => {
    const s = fixture(); s.spirituality = 5; const r = begin(s), rng = random();
    expect(player(s, r, MIRROR, rng)).toMatchObject({ enemyReduction: 10, threatens: false }); expect(rng.cursor).toBe(0); expect(s.spirituality).toBe(5);
    expect(s.unagingDemoness.encounter.scene.playerPosition).toBe('A'); valid(s, r);
  });
  it('seal spends4S once, consumes only the next attempted passage and never stacks', () => {
    const s = fixture(), r = begin(s); enemy(s, r, 'SEAL_MIRROR'); enemy(s, r, 'SEAL_MIRROR');
    expect(r.enemyActions[1]).toMatchObject({ actual: 'BODY_STRIKE', paidCost: 0 }); const rng = random();
    expect(player(s, r, MIRROR, rng).enemyReduction).toBe(10); expect(s.spirituality).toBe(120); expect(rng.cursor).toBe(0);
    expect(s.unagingDemoness.encounter.sealReady).toBe(false); expect(player(s, r, MIRROR).enemyReduction).toBe(36);
    expect(s.unagingDemoness.encounter.powerUses.SEAL_MIRROR).toBe(1); expect(s.unagingDemoness.encounter.enemySpirituality).toBe(116); valid(s, r);
  });
  it('three paid seals exhaust actual finite budget and fourth draw is ordinary rod fallback', () => {
    const s = fixture(), r = begin(s); for (let i = 0; i < 3; i++) { enemy(s, r, 'SEAL_MIRROR'); player(s, r, MIRROR); }
    enemy(s, r, 'SEAL_MIRROR'); expect(r.enemyActions[3]).toMatchObject({ actual: 'BODY_STRIKE', paidCost: 0 });
    expect(s.unagingDemoness.encounter).toMatchObject({ enemySpirituality: 108, powerUses: { SEAL_MIRROR: 3 }, sealReady: false }); valid(s, r);
  });
  it('breaks only actual B once, persists destruction and never pays to re-shatter', () => {
    const s = fixture(), old = legacy(s), r = begin(s); player(s, r, MIRROR); enemy(s, r, 'BREAK_MIRROR'); enemy(s, r, 'BREAK_MIRROR'); enemy(s, r, 'SEAL_MIRROR');
    expect(s.unagingDemoness.encounter).toMatchObject({ enemySpirituality: 115, powerUses: { BREAK_MIRROR: 1, SEAL_MIRROR: 0 }, scene: { playerPosition: 'B', mirrorB: { intact: false } } });
    const rng = random(); expect(player(s, r, MIRROR, rng).enemyReduction).toBe(10); expect(s.spirituality).toBe(114); expect(rng.cursor).toBe(0);
    expect(r.enemyActions.slice(1).every(a => a.actual === 'BODY_STRIKE' && a.paidCost === 0)).toBe(true); expect(legacy(s)).toEqual(old);
    const o = finishUnagingDemonessCombatRound(s, r, false); expect(o.sceneAfter).toMatchObject({ playerPosition: 'EXIT', ordinaryWalkedMetres: 4, mirrorB: { intact: false } }); expect(validateUnagingDemonessRoundOutcome(o)).toBe(true);
  });
  it('inherits actual2S blackflame/frost costs and old mastery coefficients', () => {
    const s = fixture(); s.town.clubLocation = 'SHOP'; s.progression.mastery[FLAME] = 0; s.progression.mastery[FROST] = 500; const r = begin(s);
    expect(player(s, r, FLAME)).toMatchObject({ selfGain: 59.15 * .65, threatens: true }); expect(player(s, r, FROST)).toMatchObject({ enemyReduction: 31.85, threatens: false });
    expect(s.spirituality).toBe(116); valid(s, r);
  });
  it('own held original club replaces blackflame without borrowing enemyrod or spendingS', () => {
    const s = fixture(); s.town.clubLocation = 'HAND'; const r = begin(s), old = legacy(s);
    expect(resolveUnagingDemonessCombatAbility(s, FLAME, .5, random(), r)).toMatchObject({ selfGain: 8, threatens: true }); expect(s.spirituality).toBe(120); expect(legacy(s)).toEqual(old); valid(s, r);
  });
  it('substitute consumes actual prepared old smallmirror then actual powder, never the scene mirror', () => {
    const s = fixture(); s.witch.tools.mirrorsHeld = 1; s.witch.tools.mirrorPrepared = true; s.witch.tools.powderHeld = 1; const before = structuredClone(s.witch.tools), r = begin(s);
    player(s, r, SUB); player(s, r, SUB); player(s, r, SUB);
    expect(r.playerActions.map(a => a.mode)).toEqual(['ORIGINAL_SMALL_MIRROR', 'ORIGINAL_POWDER', 'ORDINARY']); expect(s.spirituality).toBe(115);
    expect(s.witch.tools).toMatchObject({ mirrorsHeld: 0, powderHeld: 0, mirrorsUsed: before.mirrorsUsed + 1, powderUsed: before.powderUsed + 1, mirrorPrepared: false });
    expect(s.unagingDemoness.encounter.scene.mirrorA.intact).toBe(true); expect(s.unagingDemoness.encounter.scene.mirrorB.intact).toBe(true); valid(s, r);
  });
  it('silk requires separate3S setup/3S resistance and affects only next original bodystrike', () => {
    const s = fixture(), r = begin(s); player(s, r, SILK); player(s, r, SILK); expect(s.spirituality).toBe(114);
    expect(enemy(s, r, 'FORCE_STRIKE').selfGain).toBe(70); expect(r.boundReady).toBe(true);
    expect(enemy(s, r, 'BODY_STRIKE').selfGain).toBe(10); expect(enemy(s, r, 'BODY_STRIKE').selfGain).toBe(20); expect(r.boundReady).toBe(false); valid(s, r);
  });
  it('silk failed resistance costs6S and defense clears existing setup', () => {
    const s = fixture(), r = begin(s); player(s, r, SILK); player(s, r, SILK, random(100)); expect(r.boundReady).toBe(false); expect(s.spirituality).toBe(114); valid(s, r);
    const d = fixture(); d.unagingDemoness.encounter.silkPrepared = true;
    const dr = beginUnagingDemonessCombatRound(d, 'DEFEND', random()); expect(d.unagingDemoness.encounter.silkPrepared).toBe(false); valid(d, dr);
  });
  it('enemy insufficient originalS uses its original rod without free spell or refund', () => {
    const s = fixture(); s.unagingDemoness.encounter.powerUses.FORCE_STRIKE = 24; s.unagingDemoness.encounter.enemySpirituality = 0; const r = begin(s);
    expect(enemy(s, r, 'FORCE_STRIKE')).toMatchObject({ selfGain: 20, threatens: true }); expect(enemy(s, r, 'SEAL_MIRROR').selfGain).toBe(20);
    expect(s.unagingDemoness.encounter.enemySpirituality).toBe(0); valid(s, r);
  });
  it('source is actual original scene and rejects substituted target, stale resource or fabricated bodypoint without RNG', () => {
    const s = fixture(), r = begin(s), rng = random(), source = structuredClone(r.source); source.scene.playerPosition = 'B';
    expect(resolveUnagingDemonessCombatAbility(s, MIRROR, 1, rng, r, source).enemyReduction).toBe(0); expect(rng.cursor).toBe(0);
    s.unagingDemoness.encounter.scene.playerPosition = 'B'; expect(player(s, r, MIRROR, rng).enemyReduction).toBe(0); expect(rng.cursor).toBe(0);
    const other = fixture(); other.unagingDemoness.encounter.targetId = 'DP4-VALEN-HOLT' as typeof other.unagingDemoness.encounter.targetId; expect(currentUnagingDemonessCombatSource(other)).toBeNull();
  });
  it('caps both actors at six and isolated outcome cannot mutate stored evidence', () => {
    const s = fixture(), r = begin(s); for (let i = 0; i < 6; i++) { player(s, r, MIRROR); enemy(s, r, 'ACCIDENT'); }
    const rng = random(); expect(player(s, r, MIRROR, rng).enemyReduction).toBe(0); expect(enemy(s, r, 'FORCE_STRIKE').selfGain).toBe(0); expect(rng.cursor).toBe(0);
    const o = finishUnagingDemonessCombatRound(s, r); expect(validateUnagingDemonessRoundOutcome(o)).toBe(true); o.sceneAfter.mirrorB.intact = false;
    expect(unagingDemonessRoundOutcome(r).sceneAfter.mirrorB.intact).toBe(true); expect(validateUnagingDemonessRoundOutcome(o)).toBe(false); expect(() => finishUnagingDemonessCombatRound(s, r)).toThrow();
  });
  it('actual death leaves original body atB and never heals, returns or repairs', () => {
    const s = fixture(), old = legacy(s), r = begin(s); player(s, r, MIRROR); enemy(s, r, 'BREAK_MIRROR'); enemy(s, r, 'FORCE_STRIKE'); s.health = 0;
    const o = finishUnagingDemonessCombatRound(s, r, false); expect(o.sceneAfter).toMatchObject({ playerPosition: 'B', ordinaryWalkedMetres: 0, mirrorB: { intact: false } });
    expect(s.health).toBe(0); expect(s.spirituality).toBe(114); expect(s.unagingDemoness.life.clockSeconds).toBe(60); expect(legacy(s)).toEqual(old); expect(validateUnagingDemonessRoundOutcome(o)).toBe(true);
  });
  it('replays costs, original tools, physicalpositions, seals, destroyedmirror and no phantom injury', () => {
    const s = fixture(), r = begin(s); enemy(s, r, 'SEAL_MIRROR'); player(s, r, MIRROR); player(s, r, MIRROR); enemy(s, r, 'BREAK_MIRROR'); const o = finishUnagingDemonessCombatRound(s, r);
    expect(validateUnagingDemonessRoundOutcome(o)).toBe(true);
    const mutations: ((v: typeof o) => void)[] = [v => { v.playerSpiritualityAfter++; }, v => { v.playerActions[1]!.paidCost = 0; }, v => { v.playerActions[1]!.to = 'A'; },
      v => { v.enemyActions[1]!.paidCost = 0; }, v => { v.sceneAfter.mirrorB.intact = true; }, v => { v.sceneAfter.playerPosition = 'A'; }, v => { v.sceneAfter.mirrorPassedMetres++; },
      v => { v.toolsAfter.mirrorsHeld++; }, v => { v.sealReadyAfter = true; }, v => { v.enemyMind--; }, v => { v.playerActions[0]!.order = 99; },
      v => { v.playerActions[0]!.threatens = true; }, v => { v.lifeClockSecondsAfter++; }, v => { v.enemyHealth--; }, v => { v.playerHealthAfter--; }, v => { v.enemyStatus = 'SURRENDERED'; },
      v => { v.source = { ...v.source, actualOriginalBody: false } as unknown as UnagingDemonessCombatSource; }];
    for (const mutate of mutations) { const bad = structuredClone(o); mutate(bad); expect(validateUnagingDemonessRoundOutcome(bad)).toBe(false); }
  });
  it('does not offer disease or resurrection slots, expose Corbin beforeS3 or mutate oldValen illness/care', () => {
    const s = fixture(); expect(unagingDemonessAbilityWheel(s, null).some(a => /plague|resurrect/.test(a.id))).toBe(false);
    expect(s.despair.encounter).toMatchObject({ targetId: 'DP4-VALEN-HOLT', enemyHealth: 60, enemySpirituality: 12, enemyStatus: 'SURRENDERED', enemyDisease: 0 });
    expect(currentUnagingDemonessCombatSource(s)).toMatchObject({ targetAge: 49, actualOriginalBody: true, enemyWeapon: 'UD3-CORBIN-ROD' }); s.progression.sequence = 4;
    const privateEncounter = structuredClone(s.unagingDemoness.encounter), view = projectUnagingDemonessCombat(s);
    expect(view).toEqual({ enemyName: '', targetId: null, enemyMind: null, enemySpirituality: null, powerUses: null, scene: null, summary: '' });
    expect(view).not.toHaveProperty('source'); expect(JSON.stringify(view)).not.toMatch(/CORBIN|科宾/);
    expect(s.unagingDemoness.encounter).toEqual(privateEncounter);
  });
});
