import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { combatBody, createConquerorEncounterState, createConquerorMaterials, createConquerorScene, validateConquerorPreparation,
  validateConquerorEncounterCommand, validConquerorMaterials, conquerorTerminalBudgetMatches, type ConquerorPreparation } from '../../src/domain/conqueror/encounter.js';
import { FORMATION_MOMENTUM, FOCUSED_FLAME, CONQUEROR_COUNT_WHEEL, CONQUEROR_ENEMY_COUNT_WHEEL, CONQUEROR_ENEMY_ABILITY_WHEEL, CONQUEROR_INHERITED_SKILL_IDS,
  conquerorAbilityWheel, createConquerorRuntime, advanceConquerorCombatClock, resolveConquerorPlayerSlot, resolveConquerorEnemySlot,
  replayConquerorCombatRound, nextConquerorCombatSource, validConquerorCombatSource, validateConquerorCombatRound, validateConquerorRoundOutcome, type ConquerorCombatSource } from '../../src/domain/conqueror/combat.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { resolveSliceWeeklyFinance } from '../../src/domain/slice/weekly-finance.js';
import type { SliceState } from '../../src/domain/slice/types.js';

/** Explicit unit fixture only. No natural source save or old actor is relabelled. */
function source(): ConquerorCombatSource {
  const runId = 'conqueror-explicit-unit', date = { epoch: 'FIFTH_EPOCH' as const, year: 1352, month: 6, day: 28 };
  const mastery = Object.fromEntries([...CONQUEROR_INHERITED_SKILL_IDS, FORMATION_MOMENTUM, FOCUSED_FLAME].map(id => [id, 0]));
  const before = { cash: 1000, actions: 100, health: 100, mind: 100, spirituality: 120, pollution: 0, gender: 'MALE', sequence: 1 as const, acting: 100,
    coreStats: { physique: 10, perception: 20, will: 30, knowledge: 40 }, mastery, completedSources: [], injuries: [], injuryRisk: 0 };
  const preparation: ConquerorPreparation = { week: 1, date, revision: 2, runId, randomSeed: runId, randomCursor: 0, pricePaid: 0, actionsPaid: 1, lifeReflected: true,
    before, after: { ...before, actions: 99 }, finance: { weeklyBudget: 100, lifeTier: 'DESTITUTE', nextLifeTier: 'DESTITUTE', debts: [], missedWeeks: 0, credit: 'NORMAL' } };
  const root = createConquerorScene(); Object.assign(root, { playerLocation: 'YARD', playerCoordinate: 12, observedSourceId: `${runId}:CQ1-YARD:2`, observationWeek: 1, clockSeconds: 12, externalSeconds: 12, playerTravelMetres: 12 });
  return { runId, revision: 4, week: 1, date, round: 1, encounterId: 'CONQUEROR_DISPUTE', targetId: 'CQ1-RONAN-HALE', attemptWeek: 1, startHistoryIndex: 0,
    targetName: '罗南·黑尔', targetAge: 47, targetPathway: 'original-caster', targetSequence: 1, targetCore: 22, targetPerception: 28, actualBody: true, independentMind: true, automaticTrueGod: false,
    playerBodyId: `${runId}:body`, enemyWeapon: 'CQ1-RONAN-IRON-ROD', weaponOwner: 'CQ1-RONAN-HALE', ordinaryExit: 'OPEN', pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false, freeSkillLibrary: false, policy: 'FOCUS_FLAME',
    playerHealth: 100, playerMind: 100, playerSpirituality: 120, playerInjuries: [], playerRisk: 0, ...before.coreStats, mastery: { ...mastery }, preparation, root, materials: createConquerorMaterials(),
    body: combatBody(createConquerorEncounterState()), randomSeed: runId, randomCursor: 0 };
}
function random(...rolls: number[]): ActionRandomStream { let cursor = 0; return { seed: 'declared-conqueror-slot', get cursor() { return cursor; }, nextInt(min, max) { const n = rolls[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected declared draw ${n} in ${min}..${max}`); return n; } }; }
function scripted(rolls: number[]) { let cursor = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function(this: DeterministicActionRandomStream, min, max) { original.call(this, min, max); const n = rolls[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected declared draw ${n} in ${min}..${max}`); return n; }); }
afterEach(() => vi.restoreAllMocks());

describe('Conqueror original opponent and finite paid action replay', () => {
  it('keeps Hunter six action slots, all 21 inherited skill ids and only two new skill ids', () => {
    expect(CONQUEROR_COUNT_WHEEL.map(x => x.weight)).toEqual([10, 15, 25, 25, 15, 10]); expect(CONQUEROR_ENEMY_COUNT_WHEEL).toBe(CONQUEROR_COUNT_WHEEL);
    expect(CONQUEROR_INHERITED_SKILL_IDS).toHaveLength(21); const wheel = conquerorAbilityWheel({} as SliceState, null);
    expect(wheel.reduce((n, a) => n + a.weight, 0)).toBeCloseTo(100); expect(CONQUEROR_ENEMY_ABILITY_WHEEL.reduce((n, a) => n + a.weight, 0)).toBe(100);
    expect(wheel.filter(a => a.id.startsWith('hunter.s1.')).map(a => a.id)).toEqual([FORMATION_MOMENTUM, FOCUSED_FLAME]);
    expect(CONQUEROR_INHERITED_SKILL_IDS.every(id => wheel.some(a => a.id === id))).toBe(true);
    expect(validateConquerorPreparation(source().preparation)).toBe(true); expect(validConquerorCombatSource(source())).toBe(true);
  });
  it('accepts only explicit TALK/FIGHT/LEAVE and exact strategy shapes', () => {
    for (const type of ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']) expect(validateConquerorEncounterCommand({ type })).toBe(true);
    expect(validateConquerorEncounterCommand({ type: 'SET_POLICY', policy: 'FOCUS_FLAME' })).toBe(true);
    for (const c of [{ type: 'SET_POLICY', policy: 'FREE_ARMY' }, { type: 'ENCOUNTER_FIGHT', target: 'WW2-ORREN-VOSS' }, { type: 'CALL_COMPANIONS' }, { type: 'PREPARE_ENCOUNTER' }]) expect(validateConquerorEncounterCommand(c)).toBe(false);
  });
  it('retains inherited zero mastery as learned and refuses absent or unowned resource effects', () => {
    const x = source(), r = createConquerorRuntime(x);
    expect(resolveConquerorPlayerSlot(x, r, 'hunter.s9.physical-enhancement', 0, random()).selfGain).toBe(28);
    expect(resolveConquerorPlayerSlot(x, r, 'hunter.s7.compressed-fireball', 1, random())).toMatchObject({ paidCost: 3, selfGain: 36, attackKind: 'FIRE' });
    expect(r.mastery['hunter.s7.flame-control']).toBe(0);
    const water = structuredClone(r.materials.water); const weather = resolveConquerorPlayerSlot(x, r, 'hunter.s2.storm', 2, random());
    expect(weather).toMatchObject({ selectedAbility: 'STRIKE', paidCost: 0, selfGain: 12 }); expect(r.materials.water).toEqual(water);
    delete x.mastery['hunter.s7.compressed-fireball']; expect(resolveConquerorPlayerSlot(x, r, 'hunter.s7.compressed-fireball', 3, random())).toMatchObject({ selectedAbility: 'BLOCK', paidCost: 0, enemyReduction: 10 });
  });
  it('never casts or charges formation momentum without a real participating team', () => {
    const x = source(), r = createConquerorRuntime(x), before = { ...r.mastery };
    for (const id of [FORMATION_MOMENTUM, 'hunter.s4.comrade-link', 'hunter.s3.formation-link', 'hunter.s3.coordinated-action'] as const) {
      const a = resolveConquerorPlayerSlot(x, r, id, 0, random()); expect(a).toMatchObject({ selectedAbility: 'BLOCK', formationCast: false, actualMemberIds: [], paidCost: 0, mindCost: 0, selfGain: 0, enemyReduction: 10 }); expect(a.fallbackReason).toContain('没有实际');
    }
    expect(r.playerS).toBe(120); expect(r.playerM).toBe(100); expect(r.mastery).toEqual(before);
  });
  it('requires the chosen flame policy, learned skill and enough finite resources', () => {
    const x = source(), r = createConquerorRuntime(x); x.policy = 'HOLD';
    expect(resolveConquerorPlayerSlot(x, r, FOCUSED_FLAME, 0, random())).toMatchObject({ selectedAbility: 'STRIKE', paidCost: 0, selfGain: 12 });
    x.policy = 'FOCUS_FLAME'; r.playerS = 7;
    expect(resolveConquerorPlayerSlot(x, r, FOCUSED_FLAME, 1, random())).toMatchObject({ selectedAbility: 'STRIKE', paidCost: 0 });
    r.playerS = 120; r.playerM = 2; expect(resolveConquerorPlayerSlot(x, r, FOCUSED_FLAME, 2, random()).paidCost).toBe(0);
    expect(r.body.focusedAttempts).toBe(0); expect(r.materials.weapon.heatingPulses).toBe(0);
  });
  it('pays failed focused flame without heat, damage, mastery or refundable resources', () => {
    const x = source(), r = createConquerorRuntime(x), a = resolveConquerorPlayerSlot(x, r, FOCUSED_FLAME, 0, random(100));
    expect(a).toMatchObject({ paidCost: 8, mindCost: 2, succeeded: false, selfGain: 0, heatingDegrees: 0, threatens: false });
    expect(r.playerS).toBe(112); expect(r.playerM).toBe(98); expect(r.body.focusedAttempts).toBe(1); expect(r.body.focusedSuccesses).toBe(0); expect(r.mastery[FOCUSED_FLAME]).toBe(0); expect(r.materials).toEqual(createConquerorMaterials());
  });
  it('heats and deforms only Ronan’s single original iron rod, then uses actual unarmed fallback', () => {
    const x = source(), r = createConquerorRuntime(x);
    for (let i = 0; i < 3; i++) expect(resolveConquerorPlayerSlot(x, r, FOCUSED_FLAME, i, random(1))).toMatchObject({ paidCost: 8, mindCost: 2, selfGain: 95, heatingDegrees: 260, materialSourceId: 'CQ1-RONAN-OWNED-IRON-1' });
    expect(r.materials.weapon).toMatchObject({ id: 'CQ1-RONAN-IRON-ROD', owner: 'CQ1-RONAN-HALE', massKg: 2, location: 'YARD', condition: 80, deformations: 1, heatingPulses: 3, temperatureC: 785 });
    expect(validConquerorMaterials(r.materials)).toBe(true); expect(r.body.weaponLocation).toBe('YARD'); expect(r.mastery[FOCUSED_FLAME]).toBe(24);
    const strike = resolveConquerorEnemySlot(x, r, 'BODY_STRIKE', 3, random()); expect(strike).toMatchObject({ selectedAbility: 'BODY_STRIKE', selfGain: 14, paidCost: 0, threatens: true });
    expect(r.playerH).toBe(100); expect(r.materials.weapon.condition).toBe(80);
  });
  it('uses a single already-paid 30-second ward and retains positive residual fire risk', () => {
    const x = source(), r = createConquerorRuntime(x); const ward = resolveConquerorEnemySlot(x, r, 'WARD', 0, random());
    expect(ward.paidCost).toBe(6); expect(r.ward).not.toBeNull(); const flame = resolveConquerorPlayerSlot(x, r, FOCUSED_FLAME, 1, random(1));
    expect(flame).toMatchObject({ rawContribution: 95, selfGain: 35, paidCost: 8, threatens: true }); expect(flame.countered).toHaveLength(1); expect(r.ward).toBeNull();
    expect(resolveConquerorPlayerSlot(x, r, FOCUSED_FLAME, 2, random(1)).selfGain).toBe(95); expect(r.body.enemySpirituality).toBe(114);
  });
  it('does not turn fully countered inherited fire into a bodily attack or hit mental pressure with a ward', () => {
    const x = source(), r = createConquerorRuntime(x); resolveConquerorEnemySlot(x, r, 'WARD', 0, random());
    const mental = resolveConquerorPlayerSlot(x, r, 'hunter.s8.provocation', 1, random()); expect(mental).toMatchObject({ attackKind: 'MIND', mentalPressure: true, threatens: false }); expect(r.ward).not.toBeNull();
    const fire = resolveConquerorPlayerSlot(x, r, 'hunter.s7.compressed-fireball', 2, random()); expect(fire).toMatchObject({ rawContribution: 36, selfGain: 0, threatens: false, paidCost: 3 }); expect(r.ward).toBeNull();
  });
  it('expires actual-time wards without cost refunds or restored durability', () => {
    const x = source(), r = createConquerorRuntime(x); resolveConquerorEnemySlot(x, r, 'WARD', 0, random()); advanceConquerorCombatClock(r, 25);
    expect(r.ward).toBeNull(); expect(r.expiredWards).toHaveLength(1); expect(r.body.enemySpirituality).toBe(114);
    for (let i = 0; i < 3; i++) resolveConquerorPlayerSlot(x, r, FOCUSED_FLAME, i + 1, random(1));
    const condition = r.materials.weapon.condition; advanceConquerorCombatClock(r, 1200); expect(r.materials.weapon.temperatureC).toBe(20); expect(r.materials.weapon.condition).toBe(condition); expect(r.materials.weapon.location).toBe('YARD');
  });
  it('spends the same finite enemy water and spirituality while cooling, never recreating a damaged weapon', () => {
    const x = source(), r = createConquerorRuntime(x);
    for (let i = 0; i < 3; i++) resolveConquerorPlayerSlot(x, r, FOCUSED_FLAME, i, random(1));
    const before = r.materials.weapon.temperatureC, a = resolveConquerorEnemySlot(x, r, 'COOL_WEAPON', 3, random());
    expect(a).toMatchObject({ paidCost: 3, coolingLitres: 2, materialSourceId: 'CQ1-RONAN-OWNED-WATER-1' }); expect(r.materials.water).toMatchObject({ remainingLitres: 18, uses: 1 });
    expect(r.materials.weapon.temperatureC).toBe(before - 205); expect(r.materials.weapon.condition).toBe(80); expect(r.body.enemySpirituality).toBe(117);
    r.materials.water.remainingLitres = 0; r.materials.water.uses = 10; const fallback = resolveConquerorEnemySlot(x, r, 'COOL_WEAPON', 4, random());
    expect(fallback).toMatchObject({ selectedAbility: 'BODY_STRIKE', paidCost: 0, coolingLitres: 0 }); expect(r.materials.water.remainingLitres).toBe(0);
  });
  it('keeps exact weighted Hunter base, no-threat risk, and separate actual mental consequences', () => {
    const x = source(); x.playerInjuries = [{ id: 'unit-injury', severity: 'LIGHT', acquiredRevision: 1, treatedRevision: null }]; x.playerRisk = 2;
    scripted([1, 1, 41, 31, 1_000_000]); const quiet = replayConquerorCombatRound(x, 'ATTACK').round;
    expect(quiet.playerAdvantage).toBe(1250 + 10 * .35 + 20 * .30 + 30 * .20 + 40 * .15); expect(quiet.consequenceWeights).toBeNull(); expect(quiet.conquerorOutcome!.playerRiskAfter).toBe(2); expect(quiet.consequenceDomain).toBeUndefined();
    vi.restoreAllMocks(); scripted([1, 1, 41, 86, 1_000_000]); const mental = replayConquerorCombatRound(x, 'ATTACK').round;
    expect(mental.consequenceDomain).toBe('MENTAL'); expect(mental.consequenceWeights).toBeNull(); expect(mental.consequenceRoll).toBeUndefined(); expect(mental.conquerorOutcome).toMatchObject({ playerHealthAfter: 100, playerMindAfter: 90, playerRiskAfter: 2 });
  });
  it('leaves ordinary player death terminal and enemy heavy-injury surrender physical', () => {
    scripted([1, 1, 41, 51, 1_000_000, 100]); const death = replayConquerorCombatRound(source(), 'ATTACK');
    expect(death.outcome).toBe('PLAYER_DEAD'); expect(death.round.conquerorOutcome!.playerHealthAfter).toBe(0); expect(death.round.consequenceDomain).toBe('BODY');
    vi.restoreAllMocks(); scripted([1, 1, 1, 51, 1, 66]); const surrender = replayConquerorCombatRound(source(), 'ATTACK');
    expect(surrender.outcome).toBe('ENEMY_SURRENDERED'); expect(surrender.round.conquerorOutcome).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED', weaponLocation: 'HAND' });
    expect(surrender.round.conquerorOutcome!.enemyInjuries).toHaveLength(1);
  });
  it('uses actual six enemy slots and deterministic full-round replay including all source costs', () => {
    scripted([100, 100, 41, 51, 41, 51, 41, 51, 41, 51, 41, 51, 41, 51, 1_000_000, 1]);
    const six = replayConquerorCombatRound(source(), 'ATTACK'); expect(six.round.playerCount).toBe(6); expect(six.round.enemyCount).toBe(6); expect(six.round.moves).toHaveLength(12);
    expect(six.round.conquerorOutcome!.rootAfter.clockSeconds).toBe(72); vi.restoreAllMocks();
    const first = replayConquerorCombatRound(source(), 'DEFEND'); expect(validateConquerorCombatRound(first.round)).toBe(true); expect(validateConquerorRoundOutcome(first.round.conquerorOutcome)).toBe(true);
    const bad = structuredClone(first.round); bad.enemyCount = 7; expect(validateConquerorCombatRound(bad)).toBe(false);
    const changed = structuredClone(first.round); changed.conquerorOutcome!.materialsAfter.water.remainingLitres++; expect(validateConquerorCombatRound(changed)).toBe(false);
    if (first.outcome === 'CONTINUE') {
      const next = nextConquerorCombatSource(first.round.conquerorOutcome!); expect(validConquerorCombatSource(next)).toBe(true);
      expect(next.playerSpirituality).toBe(Math.min(120, first.round.conquerorOutcome!.playerSpiritualityAfter + 12)); expect(next.body.enemySpirituality).toBe(first.round.conquerorOutcome!.enemySpirituality);
    }
  });
  it('uses ordinary physical fallback after the independent opponent spends all spirituality', () => {
    const x = source(), r = createConquerorRuntime(x); r.body.enemySpirituality = 0; r.body.powerUses.FIRE_JET = 15;
    const a = resolveConquerorEnemySlot(x, r, 'FIRE_JET', 0, random());
    expect(a).toMatchObject({ selectedAbility: 'BODY_STRIKE', paidCost: 0, selfGain: 22, attackKind: 'BODY' });
    expect(r.body.enemySpirituality).toBe(0); expect(r.body.powerUses.FIRE_JET).toBe(15); expect(r.materials.weapon.id).toBe('CQ1-RONAN-IRON-ROD');
  });
  it('rejects forged old opponents, phantom members, material clones, seed/date and mastery replacement', () => {
    for (const mutate of [
      (x: ConquerorCombatSource) => { (x as unknown as {targetId: string}).targetId = 'WW2-ORREN-VOSS'; },
      (x: ConquerorCombatSource) => { x.root.presentMemberIds.push('IBK-MEMBER-01'); },
      (x: ConquerorCombatSource) => { (x.materials.weapon as unknown as { sourceId: string }).sourceId = 'CQ1-LIFE-IRON-1'; },
      (x: ConquerorCombatSource) => { x.randomSeed = 'replacement'; },
      (x: ConquerorCombatSource) => { x.date = { ...x.date, day: x.date.day + 1 }; },
      (x: ConquerorCombatSource) => { x.mastery['hunter.s7.flame-control'] = 8; },
      (x: ConquerorCombatSource) => { x.mastery['imaginary-power'] = 0; },
      (x: ConquerorCombatSource) => { x.materials.water.remainingLitres++; },
    ]) { const x = source(); mutate(x); expect(validConquerorCombatSource(x)).toBe(false); }
  });
});

/** Focused ordinary-finance receipt fixture. It exercises the terminal verifier,
 * not the natural acquisition replay or a whole-save assertion. */
function terminalFixture(cash: number, actions: number, credit: SliceState['credit'] = 'NORMAL', debts: SliceState['debts'] = [], missedWeeks = 0, playerDead = false) {
  const x = source(), prep = x.preparation;
  prep.before.cash = prep.after.cash = cash; prep.before.actions = actions + 2; prep.after.actions = actions + 1; prep.finance.credit = credit; prep.finance.debts = structuredClone(debts); prep.finance.missedWeeks = missedWeeks;
  scripted(playerDead ? [1, 1, 41, 51, 1_000_000, 100] : [1, 1, 1, 51, 1, 66]); const o = replayConquerorCombatRound(x, 'ATTACK').round.conquerorOutcome!; vi.restoreAllMocks();
  const fight = { command: { type: 'ENCOUNTER_FIGHT' }, before: prep.after, after: { ...prep.after, actions }, week: x.week, date: { ...x.date }, finance: structuredClone(prep.finance) };
  const scene = structuredClone(o.rootAfter);
  if (!playerDead) { scene.playerLocation = 'WORKSHOP'; scene.playerCoordinate = 0; scene.clockSeconds += 12; scene.externalSeconds += 12; scene.playerTravelMetres += 12; }
  const materials = structuredClone(o.materialsAfter); materials.weapon.temperatureC = Math.max(20, materials.weapon.temperatureC - (playerDead ? 0 : 12));
  const revision = x.revision + 1;
  const s = { runId: x.runId, revision, status: playerDead ? 'DEAD' : 'ACTIVE', week: x.week, date: { ...x.date }, cash, actionsRemaining: actions, ...structuredClone(prep.finance),
    health: o.playerHealthAfter, mind: o.playerMindAfter, spirituality: o.playerSpiritualityAfter, injuries: structuredClone(o.playerInjuriesAfter), injuryRisk: o.playerRiskAfter,
    character: { gender: prep.after.gender, coreStats: { ...prep.after.coreStats } }, seer: { pollution: prep.after.pollution, completedSources: [...prep.after.completedSources] },
    progression: { acting: prep.after.acting, mastery: { ...o.masteryAfter } }, random: { seed: x.randomSeed, cursor: o.randomCursorAfter },
    conqueror: { encounter: { scene, materials, journal: [fight] } }, pulse: 'NONE', billAmount: 0, activeEvent: null, eventQueue: [],
    chronicle: [{ id: `record-${revision}-0`, week: x.week, title: '罗南的外院冲突结束', text: '明确的单元终局回执' }],
  } as unknown as SliceState;
  if (actions === 0 && !playerDead) {
    const result = resolveSliceWeeklyFinance({ ...prep.finance, cash, week: x.week, revision: x.revision, pulse: 'BILL', billAmount: 0 });
    Object.assign(s, result.state, { revision, weeklyBudget: prep.finance.weeklyBudget });
    for (const r of result.receipts) s.chronicle.push({ id: `record-${revision}-${s.chronicle.length}`, week: x.week, ...r });
    if (!result.eventId && result.state.pulse === 'ADVANCE') {
      s.week++; s.date = addGameWeeks(x.date, 1); s.actionsRemaining = prep.finance.weeklyBudget; s.lifeTier = s.nextLifeTier; s.pulse = 'NONE'; s.billAmount = 0;
      s.chronicle.push({ id: `record-${revision}-${s.chronicle.length}`, week: s.week, title: '新的一周', text: `日期推进7天，本周${prep.finance.weeklyBudget}次行动。` });
    } else if (result.eventId) s.activeEvent = { id: result.eventId, instanceId: `${s.runId}:${result.eventId}:${revision}:${s.chronicle.length}` };
  }
  return { s, prep, o };
}
describe('Conqueror exact ordinary zero-action weekly settlement', () => {
  it('keeps the same week and finances when actual remaining actions are positive', () => {
    const { s, prep, o } = terminalFixture(1000, 2); expect(conquerorTerminalBudgetMatches(s, prep, o)).toBe(true);
    s.actionsRemaining++; expect(conquerorTerminalBudgetMatches(s, prep, o)).toBe(false);
  });
  it('replays an ordinary paid bill and real debt installment, with receipts and seven-day advance', () => {
    const { s, prep, o } = terminalFixture(1000, 0, 'NORMAL', [{ id: 'original-debt', source: '原约定账', remaining: 70, weeklyPayment: 30, createdWeek: 0 }]);
    expect(conquerorTerminalBudgetMatches(s, prep, o)).toBe(true); expect(s.week).toBe(prep.week + 1); expect(s.debts[0]!.remaining).toBe(40);
    const changed = structuredClone(s); changed.debts[0]!.remaining = 39; expect(conquerorTerminalBudgetMatches(changed, prep, o)).toBe(false);
    const missing = structuredClone(s); missing.chronicle.pop(); expect(conquerorTerminalBudgetMatches(missing, prep, o)).toBe(false);
    const free = structuredClone(s); free.spirituality++; expect(conquerorTerminalBudgetMatches(free, prep, o)).toBe(false);
  });
  it('matches an interrupted life bill exactly without an invented new week or event id', () => {
    const { s, prep, o } = terminalFixture(0, 0); expect(conquerorTerminalBudgetMatches(s, prep, o)).toBe(true); expect(s.activeEvent?.id).toBe('LIFE-BILL-01'); expect(s.week).toBe(prep.week);
    s.activeEvent!.instanceId += '-forged'; expect(conquerorTerminalBudgetMatches(s, prep, o)).toBe(false);
  });
  it('never starts a new week or restores resources after ordinary player death', () => {
    const { s, prep, o } = terminalFixture(1000, 0, 'NORMAL', [], 0, true);
    expect(o.playerHealthAfter).toBe(0); expect(s.status).toBe('DEAD'); expect(conquerorTerminalBudgetMatches(s, prep, o)).toBe(true);
    s.week++; s.date = addGameWeeks(s.date, 1); expect(conquerorTerminalBudgetMatches(s, prep, o)).toBe(false);
  });
  it('preserves exact existing debt keys and new suspended-credit liabilities', () => {
    const { s, prep, o } = terminalFixture(0, 0, 'SUSPENDED', [{ id: 'original-debt', source: '原约定账', remaining: 70, weeklyPayment: 30, createdWeek: 0 }], 4);
    expect(conquerorTerminalBudgetMatches(s, prep, o)).toBe(true); expect(s.debts).toHaveLength(2); expect(s.debts[0]!.remaining).toBe(70);
    const changed = structuredClone(s); changed.debts[1]!.createdWeek++; expect(conquerorTerminalBudgetMatches(changed, prep, o)).toBe(false);
  });
});
