import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { createThreeHeadedTemplarState } from '../../src/domain/three-headed-templar/index.js';
import { applyThreeHeadedTemplarActivity, type ThreeHeadedTemplarActivityCommand } from '../../src/domain/three-headed-templar/life.js';
import { applyThreeHeadedTemplarEncounterCommand } from '../../src/domain/three-headed-templar/encounter.js';
import {
  THREE_HEADED_TEMPLAR_COUNT_WHEEL, THREE_HEADED_TEMPLAR_ENEMY_COUNT_WHEEL, THREE_HEADED_TEMPLAR_ENEMY_ABILITY_WHEEL,
  threeHeadedTemplarActionCount, threeHeadedTemplarEnemyActionCount, threeHeadedTemplarAbilityWheel, drawThreeHeadedTemplarAbility, drawThreeHeadedTemplarEnemyAbility,
  beginThreeHeadedTemplarCombatRound, currentThreeHeadedTemplarCombatSource, resolveThreeHeadedTemplarCombatAbility, resolveThreeHeadedTemplarEnemyAbility,
  finishThreeHeadedTemplarCombatRound, threeHeadedTemplarRoundOutcome, validateThreeHeadedTemplarRoundOutcome, projectThreeHeadedTemplarCombat,
  type ThreeHeadedTemplarMoveId, type ThreeHeadedTemplarCombatSource,
} from '../../src/domain/three-headed-templar/combat.js';

const H = 'hanged-man.s4.flesh-soul-blade', J = 'BODY_FOLLOWUP', B = 'BORROWED_WARD', K = 'hanged-man.s4.shadow-command', R = 'hanged-man.s5.borrowed-arts';
const factor = (n: number) => .65 + .35 * n / 500;
const context = (s: SliceState): SeerContext => ({ roll: min => min, note: () => {}, check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: 1 }) });
function rng(...values: number[]): ActionRandomStream { let cursor = 0; return { seed: 'three-headed-templar-directed', get cursor() { return cursor; }, nextInt(min, max) { const n = values[cursor++] ?? 1; expect(n).toBeGreaterThanOrEqual(min); expect(n).toBeLessThanOrEqual(max); return n; } }; }
/** Directed S3 setup preserves the original339-command BlackKnight prefix; not claimed natural acquisition. */
function prepared(external: 'NONE' | 'BOTH' | 'UNSELECTED' = 'NONE'): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/black-knight-v01320/natural.json', 'utf8')).final);
  s.threeHeadedTemplar = createThreeHeadedTemplarState(); s.threeHeadedTemplar.guidanceKnown = true; s.threeHeadedTemplar.promotionWeek = s.week; s.threeHeadedTemplar.blackKnightActingAtPromotion = 100;
  s.progression.sequence = 3; s.progression.acting = 0; s.progression.mastery['hanged-man.s3.multiple-release'] = 0; s.character.coreStats.knowledge = 30;
  s.health = 100; s.mind = 100; s.spirituality = 120; s.cash = 10000; s.actionsRemaining = 30; s.activeEvent = null; s.combat = null;
  const act = (c: ThreeHeadedTemplarActivityCommand) => applyThreeHeadedTemplarActivity(s, c, context(s));
  if (external !== 'NONE') {
    act({ type: 'MEET_SPIRITS' });
    for (const spiritId of ['THT3-HELENA', 'THT3-ROLAND'] as const) { act({ type: 'PREPARE_GRAZING', spiritId }); act({ type: 'GRAZE', spiritId, abilityIds: external === 'UNSELECTED' ? ['SIGNAL'] : spiritId === 'THT3-HELENA' ? ['SIGNAL', 'BRIEF_WARD', 'LOW_GLOW'] : ['SIGNAL', 'STEADY_HOLD', 'SCREEN'], confirmed: true }); }
  }
  applyThreeHeadedTemplarEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context(s));
  if (external !== 'NONE') for (const spiritId of ['THT3-HELENA', 'THT3-ROLAND'] as const) act({ type: 'EXTERNALIZE', spiritId });
  applyThreeHeadedTemplarEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context(s)); return s;
}
const begin = (s: SliceState) => beginThreeHeadedTemplarCombatRound(s, 'ATTACK', rng());
const player = (s: SliceState, r: ReturnType<typeof begin>, id: ThreeHeadedTemplarMoveId, random = rng(), physical = 1) => resolveThreeHeadedTemplarCombatAbility(s, id, physical, random, r);
const enemy = (s: SliceState, r: ReturnType<typeof begin>, id: Parameters<typeof resolveThreeHeadedTemplarEnemyAbility>[1], physical = 1) => resolveThreeHeadedTemplarEnemyAbility(s, id, physical, rng(), r);
const validateFinish = (s: SliceState, r: ReturnType<typeof begin>) => { const o = finishThreeHeadedTemplarCombatRound(s, r); expect(validateThreeHeadedTemplarRoundOutcome(o)).toBe(true); return o; };
const legacy = (s: SliceState) => structuredClone({ secretSupplicant: s.secretSupplicant, listener: s.listener, shadowAscetic: s.shadowAscetic, shepherd: s.shepherd, blackKnight: s.blackKnight, town: s.town });

describe('ThreeHeadedTemplar paid original combat', () => {
  it('retains six old slots30/15/20/20/10/5 and gives both sides1–6 actions', () => {
    expect(THREE_HEADED_TEMPLAR_COUNT_WHEEL.map(x => x.weight)).toEqual([10, 15, 25, 25, 15, 10]); expect(THREE_HEADED_TEMPLAR_ENEMY_COUNT_WHEEL).toEqual(THREE_HEADED_TEMPLAR_COUNT_WHEEL);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [75, 4], [76, 5], [90, 5], [91, 6], [100, 6]]) { expect(threeHeadedTemplarActionCount(roll!)).toBe(count); expect(threeHeadedTemplarEnemyActionCount(roll!)).toBe(count); }
    const s = prepared(), wheel = threeHeadedTemplarAbilityWheel(s, null); expect(wheel.map(x => x.id)).toEqual([H, J, B, K, R, 'ACCIDENT']); expect(wheel.map(x => x.weight)).toEqual([30, 15, 20, 20, 10, 5]);
    expect(THREE_HEADED_TEMPLAR_ENEMY_ABILITY_WHEEL.map(x => x.id)).toEqual(['ARC_BOLT', 'WARD', 'BODY_STRIKE', 'LIGHT_BREAK', 'ACCIDENT']);
  });
  it('draws exact finite boundaries with ordinary5-to4 stance bias', () => {
    const s = prepared(); let boundary = 0;
    for (const a of threeHeadedTemplarAbilityWheel(s, null)) { const first = boundary + 1; boundary += a.weight * 4; const r = rng(first, boundary); expect(drawThreeHeadedTemplarAbility(r, s, null)).toBe(a.id); expect(drawThreeHeadedTemplarAbility(r, s, null)).toBe(a.id); expect(r.cursor).toBe(2); }
    boundary = 0; for (const a of THREE_HEADED_TEMPLAR_ENEMY_ABILITY_WHEEL) { const first = boundary + 1; boundary += a.weight; const r = rng(first, boundary); expect(drawThreeHeadedTemplarEnemyAbility(r)).toBe(a.id); expect(drawThreeHeadedTemplarEnemyAbility(r)).toBe(a.id); }
    expect(drawThreeHeadedTemplarAbility(rng(426), s, 'ATTACK')).toBe('ACCIDENT'); expect(threeHeadedTemplarAbilityWheel(s, 'ATTACK')[0]!.weight).toBe(150 / 445 * 100);
  });
  it('uses original blade/body budgets and new mastery contributes no damage or automatic bypass', () => {
    const s = prepared(), old = legacy(s); s.progression.mastery['hanged-man.s3.multiple-release'] = 500; const r = begin(s);
    expect(player(s, r, H).selfGain).toBe(55 * factor(s.progression.mastery[H] ?? 0)); expect(player(s, r, J, rng(), .5).selfGain).toBe(27.3 * factor(s.progression.mastery['hanged-man.s6.flesh-shaping'] ?? 0) * .5);
    expect(enemy(s, r, 'WARD').enemyReduction).toBe(30); expect(s.spirituality).toBe(115); expect(s.threeHeadedTemplar.encounter.enemySpirituality).toBe(116); expect(legacy(s)).toEqual(old); validateFinish(s, r);
  });
  it('borrows only actual current oldIris selected methods and pays master spirituality', () => {
    const s = prepared(), old = legacy(s), r = begin(s), f = factor(s.progression.mastery[R] ?? 0);
    expect(player(s, r, B).enemyReduction).toBe(30 * f); expect(player(s, r, R).selfGain).toBe(38.025 * f); expect(s.spirituality).toBe(116);
    expect(r.playerActions.map(a => a.borrowedSpiritId)).toEqual(['SH5-IRIS-1', 'SH5-IRIS-1']); expect(legacy(s)).toEqual(old); validateFinish(s, r);
  });
  it('spends one actual oldreserve for bounded10H selfrepair without injury removal', () => {
    const s = prepared(); s.shepherd.grazing.activeSpiritId = null; s.health = 90; const injuries = structuredClone(s.injuries), reserve = s.roseBishop.reserve.points, r = begin(s);
    expect(player(s, r, B).selfGain).toBe(8); expect(s.health).toBe(100); expect(s.roseBishop.reserve.points).toBe(reserve - 1); expect(s.spirituality).toBe(117); expect(s.injuries).toEqual(injuries);
    expect(player(s, r, B).enemyReduction).toBe(10); expect(r.playerActions[0]).toMatchObject({ reserveCost: 1, healthRestored: 10 }); validateFinish(s, r);
  });
  it('paid shadow knowledge18 success50/failed51 applies once only to positivebody', () => {
    const s = prepared(); s.character.coreStats.knowledge = 18; const r = begin(s);
    player(s, r, K, rng(50)); expect(enemy(s, r, 'ARC_BOLT').selfGain).toBe(70); expect(enemy(s, r, 'BODY_STRIKE', 0).selfGain).toBe(0); expect(enemy(s, r, 'BODY_STRIKE').selfGain).toBe(10);
    player(s, r, K, rng(51)); expect(enemy(s, r, 'BODY_STRIKE').selfGain).toBe(20); expect(s.spirituality).toBe(112); expect(r.playerActions.map(a => a.mode)).toEqual(['PREPARED', 'FAILED']); validateFinish(s, r);
  });
  it('never summons sealed originals and noactualexternal light costs0', () => {
    const s = prepared(), r = begin(s); player(s, r, 'ACCIDENT'); expect(r.playerActions[0]!.supportActions).toEqual([]); expect(enemy(s, r, 'LIGHT_BREAK')).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(s.spirituality).toBe(120); expect(s.threeHeadedTemplar.encounter.enemySpirituality).toBe(120); expect(s.threeHeadedTemplar.life.spirits['THT3-HELENA'].status).toBe('SEALED'); validateFinish(s, r);
  });
  it('two paidoriginal supports occur once before firstplayer action and do not threaten', () => {
    const s = prepared('BOTH'), old = legacy(s), before = s.spirituality, r = begin(s);
    expect(player(s, r, 'ACCIDENT')).toMatchObject({ selfGain: -6.5, enemyReduction: 18, threatens: false }); expect(player(s, r, 'ACCIDENT').selfGain).toBe(-22.5);
    expect(s.spirituality).toBe(before - 2); expect(r.playerActions.map(a => a.supportActions.length)).toEqual([2, 0]);
    expect(r.playerActions[0]!.supportActions.map(a => [a.spiritCost, a.paidCost, a.spiritualityAfter])).toEqual([[3, 1, 27], [3, 1, 27]]); expect(legacy(s)).toEqual(old); validateFinish(s, r);
  });
  it('unselected methods or missingmasterS give no free support', () => {
    for (const mode of ['UNSELECTED', 'BOTH'] as const) { const s = prepared(mode); if (mode === 'BOTH') s.spirituality = 0; const r = begin(s);
      expect(player(s, r, 'ACCIDENT')).toMatchObject({ selfGain: -22.5, enemyReduction: 0 }); expect(r.playerActions[0]!.supportActions).toEqual([]); expect(s.threeHeadedTemplar.life.spirits['THT3-HELENA'].spirituality).toBe(30); validateFinish(s, r); }
  });
  it('enemyfirst lightrecalls Helena before support while Roland actuallycontinues', () => {
    const s = prepared('BOTH'), start = s.threeHeadedTemplar.life.clockSeconds, before = s.spirituality, r = begin(s);
    enemy(s, r, 'LIGHT_BREAK'); expect(s.threeHeadedTemplar.life.spirits['THT3-HELENA']).toMatchObject({ location: 'INTERNAL', integrity: 80, spirituality: 30 });
    expect(player(s, r, 'ACCIDENT')).toMatchObject({ selfGain: -6.5, enemyReduction: 0, threatens: false }); expect(r.playerActions[0]!.supportActions.map(a => a.spiritId)).toEqual(['THT3-ROLAND']); expect(s.spirituality).toBe(before - 1);
    expect(validateFinish(s, r).lifeClockSecondsAfter).toBe(start + 64);
  });
  it('playerfirst alreadyperformed paidward survives laterinterruption withoutrefund', () => {
    const s = prepared('BOTH'), r = begin(s); player(s, r, 'ACCIDENT'); enemy(s, r, 'LIGHT_BREAK');
    expect(r.playerActions[0]!.enemyReduction).toBe(18); expect(s.threeHeadedTemplar.life.spirits['THT3-HELENA']).toMatchObject({ location: 'INTERNAL', spirituality: 27, integrity: 80 });
    expect(r.enemyActions[0]).toMatchObject({ paidCost: 6, interruptedSpiritId: 'THT3-HELENA', recallSeconds: 4 }); validateFinish(s, r);
  });
  it('eachlight hitsone original then noexternal costsnothing', () => {
    const s = prepared('BOTH'), r = begin(s); enemy(s, r, 'LIGHT_BREAK'); enemy(s, r, 'LIGHT_BREAK'); enemy(s, r, 'LIGHT_BREAK'); player(s, r, 'ACCIDENT');
    expect(r.enemyActions.map(a => a.interruptedSpiritId)).toEqual(['THT3-HELENA', 'THT3-ROLAND', null]); expect(r.enemyActions.map(a => a.paidCost)).toEqual([6, 6, 0]); expect(r.playerActions[0]!.supportActions).toEqual([]); expect(validateFinish(s, r).recallSeconds).toBe(8);
  });
  it('terminal livingactuallyrecalls both originals withoutrefill and walks4m', () => {
    const s = prepared('BOTH'), r = begin(s); player(s, r, 'ACCIDENT'); const o = finishThreeHeadedTemplarCombatRound(s, r, false);
    expect(o.spiritsAfter['THT3-HELENA']).toMatchObject({ status: 'GRAZED', location: 'INTERNAL', spirituality: 27, integrity: 100, travelMetres: 4 });
    expect(o.spiritsAfter['THT3-ROLAND'].location).toBe('INTERNAL'); expect(o.sceneAfter).toMatchObject({ playerPosition: 'EXIT', ordinaryWalkedMetres: 4 }); expect(o.elapsedSeconds).toBe(68); expect(validateThreeHeadedTemplarRoundOutcome(o)).toBe(true);
  });
  it('actualplayerdeath releases only still-external original permanently', () => {
    const s = prepared('BOTH'), old = legacy(s), r = begin(s); enemy(s, r, 'LIGHT_BREAK'); enemy(s, r, 'BODY_STRIKE'); s.health = 0;
    const o = finishThreeHeadedTemplarCombatRound(s, r, false); expect(o.spiritsAfter['THT3-HELENA']).toMatchObject({ status: 'GRAZED', location: 'INTERNAL', integrity: 80 });
    expect(o.spiritsAfter['THT3-ROLAND']).toMatchObject({ status: 'RELEASED', location: 'RELEASED', releasedWeek: s.week }); expect(o.sceneAfter.playerPosition).toBe('COURT'); expect(s.health).toBe(0); expect(legacy(s)).toEqual(old); expect(validateThreeHeadedTemplarRoundOutcome(o)).toBe(true);
  });
  it('rejects tamperedround source, duplicatecost, order, originalidentity andrefill evidence', () => {
    const s = prepared('BOTH'), r = begin(s); player(s, r, H); enemy(s, r, 'LIGHT_BREAK'); const o = validateFinish(s, r);
    const changes: ((x: typeof o) => void)[] = [x => { x.source.targetId = 'OLD' as typeof x.source.targetId; }, x => { x.playerActions[0]!.supportActions[0]!.spiritCost = 0 as 3; }, x => { x.enemyActions[0]!.order = 0; }, x => { x.spiritsAfter['THT3-HELENA'].spirituality = 30; }, x => { x.source.spirits['THT3-ROLAND'].deathRecordId = 'DUPLICATE'; }, x => { x.recallSeconds = 0; }, x => { x.playerActions[0]!.selfGain += 16; }];
    for (const change of changes) { const copy = structuredClone(o); change(copy); expect(validateThreeHeadedTemplarRoundOutcome(copy)).toBe(false); }
    expect(threeHeadedTemplarRoundOutcome(r)).toEqual(o); expect(() => finishThreeHeadedTemplarCombatRound(s, r)).toThrow();
  });
  it('unmatchedsource spendsnothing and hiddenprojection reveals no new opponent', () => {
    const s = prepared('BOTH'), r = begin(s), before = structuredClone(s), source = { ...r.source, targetId: 'OLD' } as ThreeHeadedTemplarCombatSource;
    expect(resolveThreeHeadedTemplarCombatAbility(s, H, 1, rng(), r, source).selfGain).toBe(0); expect(s).toEqual(before); expect(r.playerActions).toEqual([]);
    s.progression.sequence = 4; expect(currentThreeHeadedTemplarCombatSource(s)).toBeNull(); expect(projectThreeHeadedTemplarCombat(s).source).toBeNull(); expect(JSON.stringify(projectThreeHeadedTemplarCombat(s))).not.toMatch(/BRAM|布拉姆/);
  });
});
