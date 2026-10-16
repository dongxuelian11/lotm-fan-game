import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { DISCERNER_COUNT_WHEEL } from '../../src/domain/discerner/combat.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { resolveSliceWeeklyFinance } from '../../src/domain/slice/weekly-finance.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { WRITER_CASE_IDS } from '../../src/domain/writer/life.js';
import { validateWriterEncounter, validateWriterEncounterCommand, validateWriterPreparation,
  writerTerminalBudgetMatches, projectWriterEncounter, leaveWriterCombatScene } from '../../src/domain/writer/encounter.js';
import { RECIPROCAL_INSIGHT, PLAUSIBLE_ARRANGEMENT, WRITER_COUNT_WHEEL, WRITER_ENEMY_COUNT_WHEEL, WRITER_INHERITED_SKILL_IDS,
  WRITER_ENEMY_ABILITY_WHEEL, writerAbilityWheel, createWriterRuntime, advanceWriterCombatClock, declareWriterEnemyAction,
  resolveWriterPlayerSlot, resolveWriterEnemySlot, currentWriterCombatSource, replayWriterCombatRound, nextWriterCombatSource,
  validWriterCombatSource, validateWriterCombatRound, validateWriterRoundOutcome, type WriterCombatSource } from '../../src/domain/writer/combat.js';
import { originalDiscerner, originalAudienceRoots, promoted, wr, step, rejectWriter } from './writer-directed-helper.js';

let readyCache: SliceState | undefined;
/** Only public commands after the shared explicitly declared pre-journal unit
 * setup. The actual old 580 commands, 23 skill values and actors remain intact. */
function ready(): SliceState {
  if (!readyCache) {
    let s = promoted();
    for (const caseId of WRITER_CASE_IDS) {
      s = wr(s, { type: 'OBSERVE', caseId }); s = wr(s, { type: 'INVITE', caseId, method: 'ORDINARY' }); s = wr(s, { type: 'ENTER_ROOM' });
      if (caseId === 'mutual-clue') s = wr(s, { type: 'INTRODUCE' });
      s = wr(s, { type: 'TAKE_BOOK' }); s = wr(s, { type: 'MOVE', to: 'NEAR' });
      if (caseId === 'mutual-clue') {
        s = wr(s, { type: 'CHECK_BOOK' }); s = wr(s, { type: 'MOVE', to: 'FAR' }); s = wr(s, { type: 'RETURN_BOOK' }); s = wr(s, { type: 'MOVE', to: 'NEAR' });
      } else { s = wr(s, { type: 'HAND_TO_THOMAS' }); s = wr(s, { type: 'ORDINARY_RETURN' }); }
      s = wr(s, { type: 'RETURN_HOME' }); s = wr(s, { type: 'REPORT', caseId });
    }
    readyCache = wr(s, { type: 'REFLECT' }); assertValidSliceState(readyCache);
  }
  return structuredClone(readyCache);
}
let fightingCache: SliceState | undefined;
function fighting(): SliceState {
  if (!fightingCache) { let s = wr(ready(), { type: 'ENCOUNTER_TALK' }); s = wr(s, { type: 'SET_POLICY', policy: 'BOTH' }); fightingCache = wr(s, { type: 'ENCOUNTER_FIGHT' }); }
  return structuredClone(fightingCache);
}
function source(): WriterCombatSource { const x = currentWriterCombatSource(fighting()); if (!x) throw new Error('Actual public encounter missing.'); return x; }
function random(...rolls: number[]): ActionRandomStream { let cursor = 0; return { seed: 'writer-declared-slot-only', get cursor() { return cursor; }, nextInt(min, max) { const n = rolls[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected declared slot draw ${n} in ${min}..${max}`); return n; } }; }
function scripted(rolls: number[]) { let cursor = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function(this: DeterministicActionRandomStream, min, max) { original.call(this, min, max); const n = rolls[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected declared round draw ${n} in ${min}..${max}`); return n; }); }
afterEach(() => vi.restoreAllMocks());

describe('Writer independent contemporary opponent and exact inherited continuity', () => {
  it('uses actual Discerner six-slot weights, all 23 real old skills, two new skills and no free resource repair', () => {
    const s = ready(), original = originalDiscerner(), x = source();
    expect(WRITER_COUNT_WHEEL).toBe(DISCERNER_COUNT_WHEEL); expect(WRITER_ENEMY_COUNT_WHEEL).toBe(WRITER_COUNT_WHEEL);
    expect(WRITER_COUNT_WHEEL.map(a => a.weight)).toEqual([15, 20, 25, 20, 15, 5]); expect(WRITER_INHERITED_SKILL_IDS).toHaveLength(23);
    expect(originalAudienceRoots(s)).toEqual(originalAudienceRoots(original));
    for (const id of WRITER_INHERITED_SKILL_IDS) expect(s.progression.mastery[id]).toBe(original.progression.mastery[id]);
    expect(WRITER_INHERITED_SKILL_IDS.filter(id => s.progression.mastery[id] === 0)).toHaveLength(8);
    expect(s.progression.mastery[RECIPROCAL_INSIGHT]).toBe(0); expect(s.progression.mastery[PLAUSIBLE_ARRANGEMENT]).toBe(0);
    expect(s.health).toBe(98); expect(s.mind).toBe(83); expect(s.spirituality).toBe(120);
    expect(writerAbilityWheel(s, null).reduce((n, a) => n + a.weight, 0)).toBeCloseTo(100);
    expect(WRITER_ENEMY_ABILITY_WHEEL.reduce((n, a) => n + a.weight, 0)).toBe(100);
    expect(validateWriterPreparation(x.preparation)).toBe(true); expect(validWriterCombatSource(x)).toBe(true);
    expect(x.body).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemySpirituality: 120 });
    expect(x).toMatchObject({ targetId: 'WR1-LUCIAN-VALE', targetAge: 46, targetSequence: 1, targetCore: 22, thirdPartiesInArea: 0 });
  });
  it('requires completed real life and TALK, exchanging only actual names before voluntary fight or peaceful six-metre exit', () => {
    const initial = promoted(); rejectWriter(initial, { type: 'ENCOUNTER_TALK' }); rejectWriter(ready(), { type: 'ENCOUNTER_FIGHT' });
    const s = wr(ready(), { type: 'ENCOUNTER_TALK' }), p = projectWriterEncounter(s);
    expect(p.scene).toMatchObject({ playerLocation: 'COURT', playerCoordinate: 6, playerTravelMetres: 6, clockSeconds: 6, knownPlayerName: s.character.name, knownEnemyName: '卢西安·维尔', presentMemberIds: [] });
    expect(s.writer.life.practice.participants.every(a => !a.present)).toBe(true); expect(s.combat).toBeNull();
    const left = wr(s, { type: 'LEAVE_ENCOUNTER' }); expect(left.writer.encounter.scene).toMatchObject({ playerLocation: 'READING_ROOM', playerTravelMetres: 12, clockSeconds: 12 });
    expect(left.writer.encounter.enemyHealth).toBe(100); expect(validateWriterEncounter(left)).toBe(true); rejectWriter(left, { type: 'ENCOUNTER_TALK' });
    expect(JSON.stringify(p)).not.toMatch(/（G）|\dG|1250G/);
  });
  it('rejects fabricated commands, actors, original objects, source knowledge, old mastery, seeds and current state', () => {
    expect(validateWriterEncounterCommand({ type: 'SET_POLICY', policy: 'BOTH' })).toBe(true);
    for (const c of [{ type: 'SET_POLICY', policy: 'REWRITE_PAST' }, { type: 'ENCOUNTER_FIGHT', target: 'DCR2-ALRIC-VALE' }, { type: 'SUMMON_ARMY' }]) expect(validateWriterEncounterCommand(c)).toBe(false);
    for (const mutate of [
      (x: WriterCombatSource) => { (x as unknown as { targetId: string }).targetId = 'DCR2-ALRIC-VALE'; },
      (x: WriterCombatSource) => { x.root.presentMemberIds.push('WR1-EVELYN'); },
      (x: WriterCombatSource) => { x.root.knownPlayerName = null; },
      (x: WriterCombatSource) => { x.clubHeld = !x.clubHeld; },
      (x: WriterCombatSource) => { x.randomSeed = 'new-seed'; },
      (x: WriterCombatSource) => { x.mastery['audience.s6.scales']!++; },
      (x: WriterCombatSource) => { x.mastery['imaginary-secret'] = 500; },
      (x: WriterCombatSource) => { (x.materials.weapon as unknown as { id: string }).id = 'WR1-RETURN-BOOK'; },
    ]) { const x = source(); mutate(x); expect(validWriterCombatSource(x)).toBe(false); }
    const s = fighting(); s.writer.encounter.enemySpirituality++; expect(validateWriterEncounter(s)).toBe(false);
  });
});

describe('Writer paid current-action windows, finite resistance and original ability resources', () => {
  it('needs a real pending action, actual name knowledge, policy and sufficient resources; nothing is charged or credited for empty windows', () => {
    const x = source(), r = createWriterRuntime(x), before = { ...r.mastery };
    expect(resolveWriterPlayerSlot(x, r, PLAUSIBLE_ARRANGEMENT, 0, random())).toMatchObject({ paidCost: 0, finiteResult: 'UNAVAILABLE', selectedAbility: 'BLOCK' });
    declareWriterEnemyAction(x, r, 'MIND_PULSE', 0); r.root.knownPlayerName = null;
    expect(resolveWriterPlayerSlot(x, r, RECIPROCAL_INSIGHT, 1, random()).paidCost).toBe(0); r.root.knownPlayerName = x.preparation.playerName;
    x.policy = 'HOLD'; expect(resolveWriterPlayerSlot(x, r, PLAUSIBLE_ARRANGEMENT, 2, random()).paidCost).toBe(0); x.policy = 'BOTH'; r.playerS = 7;
    expect(resolveWriterPlayerSlot(x, r, PLAUSIBLE_ARRANGEMENT, 3, random())).toMatchObject({ paidCost: 0, finiteResult: 'INSUFFICIENT' });
    expect(r.windows.arrangement).toBeNull(); expect(r.mastery).toEqual(before);
  });
  it('pays failed checks, prevents a second paid attempt in the same round and never retries for success', () => {
    const x = source(), r = createWriterRuntime(x); declareWriterEnemyAction(x, r, 'MIND_PULSE', 0);
    const a = resolveWriterPlayerSlot(x, r, PLAUSIBLE_ARRANGEMENT, 0, random(100));
    expect(a).toMatchObject({ paidCost: 8, mindCost: 3, finiteResult: 'FAILED', selfGain: 0, enemyReduction: 0 });
    expect(r.playerS).toBe(x.playerSpirituality - 8); expect(r.playerM).toBe(x.playerMind - 3); expect(r.windows.arrangement).toBeNull();
    expect(resolveWriterPlayerSlot(x, r, PLAUSIBLE_ARRANGEMENT, 1, random())).toMatchObject({ finiteResult: 'ALREADY_ATTEMPTED', paidCost: 0 });
    expect(r.body.arrangementAttempts).toBe(1); expect(r.body.arrangementSuccesses).toBe(0); expect(r.mastery[PLAUSIBLE_ARRANGEMENT]).toBe(x.mastery[PLAUSIBLE_ARRANGEMENT]);
  });
  it('creates a useful post-cast window, affects only its exact subsequent action, and leaves later actions unmitigated', () => {
    const x = source(), r = createWriterRuntime(x); const pending = declareWriterEnemyAction(x, r, 'MIND_PULSE', 0);
    const cast = resolveWriterPlayerSlot(x, r, PLAUSIBLE_ARRANGEMENT, 0, random(1, 100));
    expect(cast).toMatchObject({ paidCost: 8, mindCost: 3, finiteResult: 'PENDING', selfGain: 0, enemyReduction: 0 });
    expect(r.windows.arrangement?.targetActionId).toBe(pending.id); expect(r.windows.arrangement!.expiresAt).toBeGreaterThan(r.root.clockSeconds);
    expect(r.mastery[PLAUSIBLE_ARRANGEMENT]).toBe(x.mastery[PLAUSIBLE_ARRANGEMENT]);
    const actual = resolveWriterEnemySlot(x, r, 'MIND_PULSE', 1, random());
    expect(actual).toMatchObject({ paidCost: 7, rawContribution: 95, selfGain: 55, attackKind: 'MENTAL', mentalPressure: true }); expect(actual.countered).toHaveLength(1);
    expect(r.windows.arrangement).toBeNull(); expect(r.mastery[PLAUSIBLE_ARRANGEMENT]).toBe(x.mastery[PLAUSIBLE_ARRANGEMENT]! + 8);
    expect(resolveWriterEnemySlot(x, r, 'MIND_PULSE', 2, random()).selfGain).toBe(95); expect(r.body.enemySpirituality).toBe(106);
  });
  it('expires before later action without refund, mastery or automatic mitigation and never rewrites earlier evidence', () => {
    const x = source(), r = createWriterRuntime(x), first = resolveWriterEnemySlot(x, r, 'MIND_PULSE', 0, random()), immutable = structuredClone(first);
    declareWriterEnemyAction(x, r, 'MIND_PULSE', 1); resolveWriterPlayerSlot(x, r, PLAUSIBLE_ARRANGEMENT, 1, random(1, 100)); advanceWriterCombatClock(r, 25);
    expect(r.windows.arrangement).toBeNull(); expect(r.expiredWindows).toHaveLength(1); expect(first).toEqual(immutable);
    expect(resolveWriterEnemySlot(x, r, 'MIND_PULSE', 2, random()).selfGain).toBe(95); expect(r.mastery[PLAUSIBLE_ARRANGEMENT]).toBe(x.mastery[PLAUSIBLE_ARRANGEMENT]);
    expect(r.playerS).toBe(x.playerSpirituality - 8);
  });
  it('limits mutual knowledge to the pending intent, with finite observation gain only when the same action really occurs', () => {
    const x = source(), r = createWriterRuntime(x); declareWriterEnemyAction(x, r, 'BODY_STRIKE', 0);
    const clue = resolveWriterPlayerSlot(x, r, RECIPROCAL_INSIGHT, 0, random(1, 100));
    expect(clue).toMatchObject({ paidCost: 6, mindCost: 2, learnedClue: '握紧自己的原杖，准备普通打击', selfGain: 0 });
    const body = resolveWriterEnemySlot(x, r, 'BODY_STRIKE', 1, random());
    expect(body).toMatchObject({ selfGain: 22, threatens: true, playerObservationGain: 36, paidCost: 0 }); expect(r.body.reciprocalSuccesses).toBe(1);
    expect(r.mastery[RECIPROCAL_INSIGHT]).toBe(x.mastery[RECIPROCAL_INSIGHT]! + 8); expect(r.windows.reciprocal).toBeNull();
  });
  it('uses actual 3-spirit attention or 6-spirit ward for one 70% resistance and pays resisted player costs', () => {
    for (const power of ['ATTENTION', 'WARD'] as const) {
      const x = source(), r = createWriterRuntime(x); const defense = resolveWriterEnemySlot(x, r, power, 0, random()); expect(defense.paidCost).toBe(power === 'WARD' ? 6 : 3);
      declareWriterEnemyAction(x, r, 'MIND_PULSE', 1); const denied = resolveWriterPlayerSlot(x, r, RECIPROCAL_INSIGHT, 1, random(1, 50));
      expect(denied).toMatchObject({ paidCost: 6, mindCost: 2, resistanceChance: 70, resistanceRoll: 50, finiteResult: 'RESISTED', learnedClue: null });
      expect(r.windows.ward).toBeNull(); expect(r.windows.attention).toBeNull(); expect(r.windows.reciprocal).toBeNull();
    }
    const x = source(), r = createWriterRuntime(x); declareWriterEnemyAction(x, r, 'MIND_PULSE', 0);
    expect(resolveWriterPlayerSlot(x, r, RECIPROCAL_INSIGHT, 0, random(1, 30))).toMatchObject({ resistanceChance: 30, finiteResult: 'RESISTED' });
  });
  it('uses a finite one-hit 60 ward, handles ordinary rod fallback and retains old learned zero mastery', () => {
    const x = source(), r = createWriterRuntime(x); resolveWriterEnemySlot(x, r, 'WARD', 0, random());
    const mind = resolveWriterPlayerSlot(x, r, 'audience.s4.mind-island', 1, random(1));
    expect(mind.wardAbsorption).toBe(60); expect(mind.selfGain).toBe(Math.max(0, 42 * (1 + x.mastery['audience.s4.mind-island']! / 500) - 60)); expect(r.windows.ward).toBeNull();
    const old = { ...r.mastery }; const scales = resolveWriterPlayerSlot(x, r, 'audience.s6.scales', 2, random()); expect(scales.paidCost).toBe(2); expect(r.mastery).toEqual(old);
    r.body.enemySpirituality = 0;
    expect(resolveWriterEnemySlot(x, r, 'MIND_PULSE', 3, random())).toMatchObject({ selectedAbility: 'BODY_STRIKE', paidCost: 0, selfGain: 22, attackKind: 'BODY' });
    expect(r.materials.weapon.id).toBe('WR1-LUCIAN-ROD');
  });
  it('stops a mind-exhausted living target without turning mental loss into death or a body wound', () => {
    const x = source(), r = createWriterRuntime(x);
    // Isolated action-runtime boundary, not a save, source journal, or natural capture.
    r.body.enemyMind = 1;
    const a = resolveWriterPlayerSlot(x, r, 'audience.s4.mind-island', 0, random(1));
    expect(a).toMatchObject({ paidCost: 4, attackKind: 'MENTAL', mindDamage: 1, threatens: false });
    expect(r.body).toMatchObject({ enemyHealth: 100, enemyMind: 0, enemyStatus: 'SURRENDERED', enemyInjuries: [], enemyRisk: 0 });
    expect(() => declareWriterEnemyAction(x, r, 'BODY_STRIKE', 1)).toThrow();
  });
  it('retains paid old external identity bounds and persistent one-time mental plague without a free army', () => {
    const x = source(), r = createWriterRuntime(x), old = { ...r.mastery };
    expect(resolveWriterPlayerSlot(x, r, 'audience.s3.external-identity', 0, random(1))).toMatchObject({ paidCost: 5, mindCost: 2, identityCreated: true, identityRejoined: true, enemyReduction: 26 });
    resolveWriterPlayerSlot(x, r, 'audience.s4.mental-plague', 1, random(1)); expect(r.body).toMatchObject({ mentalPlague: 1, plagueApplications: 1, infectedRound: x.round });
    expect(resolveWriterPlayerSlot(x, r, 'audience.s4.mental-plague', 2, random()).paidCost).toBe(0); expect(r.mastery).toEqual(old);
    const later = { ...structuredClone(x), round: x.round + 1, body: structuredClone(r.body) }, next = createWriterRuntime(later);
    expect(next.body.enemyMind).toBe(r.body.enemyMind - 4); expect(next.body.mentalPlague).toBe(2); expect(next.plagueMindDamage).toBe(4);
  });
});

describe('Writer deterministic shared resolution, actual sources and normal terminal finance', () => {
  it('separates MENTAL from BODY, keeps exact 30/25/30/15 power and does not turn lost mental contests into wounds', () => {
    const x = source(); scripted([1, 1, 1, 53, 1_000_000]); const result = replayWriterCombatRound(x, 'ATTACK');
    expect(result.round.consequenceDomain).toBe('MENTAL'); expect(result.round.consequenceWeights).toBeNull(); expect(result.round.consequenceRoll).toBeUndefined();
    expect(result.round.writerOutcome).toMatchObject({ playerHealthAfter: x.playerHealth, playerMindAfter: x.playerMind - 10, playerRiskAfter: x.playerRisk });
    expect(result.round.playerAdvantage).toBe(1250 + x.physique * .30 + x.perception * .25 + x.will * .30 + x.knowledge * .15);
  });
  it('allows real ordinary death without revival and physical surrender as a separate living outcome', () => {
    const x = source(); scripted([1, 1, 71, 1, 1_000_000, 100]); const dead = replayWriterCombatRound(x, 'ATTACK');
    expect(dead.outcome).toBe('PLAYER_DEAD'); expect(dead.round.writerOutcome!.playerHealthAfter).toBe(0); expect(dead.round.consequenceDomain).toBe('BODY');
    vi.restoreAllMocks(); scripted([1, 1, 71, 1, 1, 66]); const surrender = replayWriterCombatRound(x, 'ATTACK');
    expect(surrender.outcome).toBe('ENEMY_SURRENDERED'); expect(surrender.round.writerOutcome).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED', weaponLocation: 'COURT' });
  });
  it('deterministically replays the complete round, including exact selected actions, pending windows, costs, checks and RNG cursor', () => {
    const x = source(), result = replayWriterCombatRound(x, 'CONTROL'), o = result.round.writerOutcome!;
    expect(replayWriterCombatRound(x, 'CONTROL')).toEqual(result); expect(validateWriterCombatRound(result.round)).toBe(true); expect(validateWriterRoundOutcome(o)).toBe(true);
    expect(o.rootAfter.clockSeconds).toBe(x.root.clockSeconds + 60); expect(o.windowsAfter).toEqual({ ward: null, attention: null, reciprocal: null, arrangement: null }); expect(o.pendingEnemyActionAfter).toBeNull();
    for (const change of [(round: typeof result.round) => { round.enemyCount = 7; }, (round: typeof result.round) => { round.writerOutcome!.randomCursorAfter++; },
      (round: typeof result.round) => { round.writerOutcome!.playerSpiritualityAfter++; }, (round: typeof result.round) => { round.writerOutcome!.rootAfter.playerTravelMetres++; }]) {
      const altered = structuredClone(result.round); change(altered); expect(validateWriterCombatRound(altered)).toBe(false);
    }
    if (result.outcome === 'CONTINUE') { const next = nextWriterCombatSource(o); expect(validWriterCombatSource(next)).toBe(true); expect(next.playerSpirituality).toBe(Math.min(120, o.playerSpiritualityAfter + 12)); expect(next.body.enemySpirituality).toBe(o.enemySpirituality); }
  });
  it('commits through public combat intent, preserving all original source roots, independent adults and exact history', () => {
    const s = fighting(), old = originalAudienceRoots(s), previous = structuredClone(s.combatHistory), next = step(s, { type: 'COMBAT_ROUND', stance: 'CONTROL' });
    assertValidSliceState(next); expect(validateWriterEncounter(next)).toBe(true); expect(originalAudienceRoots(next)).toEqual(old); expect(next.combatHistory.slice(0, previous.length)).toEqual(previous);
    expect(next.writer.life).toEqual(s.writer.life); expect(validateWriterCombatRound(next.combatHistory.at(-1)!)).toBe(true);
  });
});

/** Isolated terminal-finance verifier input, derived from an actual source.
 * This is never asserted as a natural or whole-save history. */
function terminalFixture(cash: number, actions: number, credit: SliceState['credit'] = 'NORMAL', debts: SliceState['debts'] = [], missedWeeks = 0, playerDead = false) {
  const x = source(), prep = x.preparation;
  prep.before.cash = prep.after.cash = cash; prep.before.actions = actions + 2; prep.after.actions = actions + 1;
  prep.finance.credit = credit; prep.finance.debts = structuredClone(debts); prep.finance.missedWeeks = missedWeeks;
  scripted(playerDead ? [1, 1, 71, 1, 1_000_000, 100] : [1, 1, 71, 1, 1, 66]); const o = replayWriterCombatRound(x, 'ATTACK').round.writerOutcome!; vi.restoreAllMocks();
  const fight = { command: { type: 'ENCOUNTER_FIGHT' }, before: prep.after, after: { ...prep.after, actions }, week: x.week, date: { ...x.date }, finance: structuredClone(prep.finance) };
  const scene = structuredClone(o.rootAfter); if (!playerDead) leaveWriterCombatScene(scene); const revision = x.revision + 1;
  const s = { runId: x.runId, revision, status: playerDead ? 'DEAD' : 'ACTIVE', week: x.week, date: { ...x.date }, cash, actionsRemaining: actions, ...structuredClone(prep.finance),
    health: o.playerHealthAfter, mind: o.playerMindAfter, spirituality: o.playerSpiritualityAfter, injuries: structuredClone(o.playerInjuriesAfter), injuryRisk: o.playerRiskAfter,
    character: { gender: prep.after.gender, coreStats: { ...prep.after.coreStats } }, seer: { pollution: prep.after.pollution, completedSources: [...prep.after.completedSources] },
    progression: { acting: prep.after.acting, mastery: { ...o.masteryAfter } }, random: { seed: x.randomSeed, cursor: o.randomCursorAfter },
    writer: { encounter: { scene, materials: structuredClone(o.materialsAfter), journal: [fight] } }, pulse: 'NONE', billAmount: 0, activeEvent: null, eventQueue: [],
    chronicle: [{ id: `record-${revision}-0`, week: x.week, title: '卢西安的石院冲突结束', text: '明确的单元终局回执' }],
  } as unknown as SliceState;
  if (actions === 0 && !playerDead) {
    const result = resolveSliceWeeklyFinance({ ...prep.finance, cash, week: x.week, revision: x.revision, pulse: 'BILL', billAmount: 0 });
    Object.assign(s, result.state, { revision, weeklyBudget: prep.finance.weeklyBudget });
    for (const receipt of result.receipts) s.chronicle.push({ id: `record-${revision}-${s.chronicle.length}`, week: x.week, ...receipt });
    if (!result.eventId && result.state.pulse === 'ADVANCE') {
      s.week++; s.date = addGameWeeks(x.date, 1); s.actionsRemaining = prep.finance.weeklyBudget; s.lifeTier = s.nextLifeTier; s.pulse = 'NONE'; s.billAmount = 0;
      s.chronicle.push({ id: `record-${revision}-${s.chronicle.length}`, week: s.week, title: '新的一周', text: `日期推进7天，本周${prep.finance.weeklyBudget}次行动。` });
    } else if (result.eventId) s.activeEvent = { id: result.eventId, instanceId: `${s.runId}:${result.eventId}:${revision}:${s.chronicle.length}` };
  }
  return { s, prep, o };
}
describe('Writer exact ordinary zero-AP weekly settlement', () => {
  it('retains the same week with positive remaining actions', () => { const { s, prep, o } = terminalFixture(1000, 2); expect(writerTerminalBudgetMatches(s, prep, o)).toBe(true); s.actionsRemaining++; expect(writerTerminalBudgetMatches(s, prep, o)).toBe(false); });
  it('pays ordinary life bills and existing debt installments with exact receipts and seven-day advancement', () => {
    const { s, prep, o } = terminalFixture(1000, 0, 'NORMAL', [{ id: 'original-debt', source: '原约定账', remaining: 70, weeklyPayment: 30, createdWeek: 0 }]);
    expect(writerTerminalBudgetMatches(s, prep, o)).toBe(true); expect(s.week).toBe(prep.week + 1); expect(s.debts[0]!.remaining).toBe(40);
    const altered = structuredClone(s); altered.debts[0]!.remaining--; expect(writerTerminalBudgetMatches(altered, prep, o)).toBe(false);
    const healed = structuredClone(s); healed.health++; expect(writerTerminalBudgetMatches(healed, prep, o)).toBe(false);
    s.chronicle.pop(); expect(writerTerminalBudgetMatches(s, prep, o)).toBe(false);
  });
  it('preserves interrupted life-bill events and refuses fabricated event instances', () => {
    const { s, prep, o } = terminalFixture(0, 0); expect(writerTerminalBudgetMatches(s, prep, o)).toBe(true); expect(s.activeEvent?.id).toBe('LIFE-BILL-01'); expect(s.week).toBe(prep.week);
    s.activeEvent!.instanceId += '-forged'; expect(writerTerminalBudgetMatches(s, prep, o)).toBe(false);
  });
  it('retains suspended credit liabilities without broad budget tolerance or a hidden refund', () => {
    const { s, prep, o } = terminalFixture(0, 0, 'SUSPENDED', [{ id: 'original-debt', source: '原约定账', remaining: 70, weeklyPayment: 30, createdWeek: 0 }], 4);
    expect(writerTerminalBudgetMatches(s, prep, o)).toBe(true); expect(s.debts).toHaveLength(2); expect(s.debts[0]!.remaining).toBe(70);
    s.debts[1]!.createdWeek++; expect(writerTerminalBudgetMatches(s, prep, o)).toBe(false);
  });
  it('keeps ordinary death terminal without a new week, resource recovery or exit teleport', () => {
    const { s, prep, o } = terminalFixture(1000, 0, 'NORMAL', [], 0, true); expect(s.status).toBe('DEAD'); expect(o.playerHealthAfter).toBe(0); expect(s.writer.encounter.scene.playerLocation).toBe('COURT');
    expect(writerTerminalBudgetMatches(s, prep, o)).toBe(true); s.week++; s.date = addGameWeeks(s.date, 1); expect(writerTerminalBudgetMatches(s, prep, o)).toBe(false);
  });
});
