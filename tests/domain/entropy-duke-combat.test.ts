import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { createFrenzyMageLifeState } from '../../src/domain/frenzy-mage/life.js';
import { combatBody, createEntropyDukeEncounterState, entropyDukeTerminalBudgetMatches, validateEntropyDukeEncounterCommand, validateEntropyDukePreparation, type EntropyDukePreparation } from '../../src/domain/entropy-duke/encounter.js';
import { AMPLIFICATION, PROLONGATION, ENTROPY_DUKE_COUNT_WHEEL, ENTROPY_DUKE_ENEMY_ABILITY_WHEEL, ENTROPY_DUKE_GIFT_GROUND,
  advanceEntropyDukeCombatClock, createEntropyDukeRuntime, entropyDukeAbilityWheel, nextEntropyDukeCombatSource, replayEntropyDukeCombatRound,
  resolveEntropyDukeEnemySlot, resolveEntropyDukePlayerSlot, validateEntropyDukeCombatRound, validateEntropyDukeRoundOutcome, validEntropyDukeCombatSource,
  type EntropyDukeCombatSource, type EntropyDukeRoundOutcome } from '../../src/domain/entropy-duke/combat.js';
import type { EntropyDukeSceneRoot } from '../../src/domain/entropy-duke/life.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { resolveSliceWeeklyFinance } from '../../src/domain/slice/weekly-finance.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';

/** Declared UNIT-only source: no natural command history or recorded draw is changed. */
function source(): EntropyDukeCombatSource {
  const root: EntropyDukeSceneRoot = createFrenzyMageLifeState(); root.introducedWeek = 1; root.playerLocation = 'A'; root.volunteer.location = 'OUTSIDE'; root.guide.location = 'OUTSIDE';
  root.parcel.location = root.ball.location = root.paper.location = 'OUTSIDE'; root.clockSeconds = 16; root.playerTravelMetres = 4; root.guideTravelMetres = 4;
  const gifts = [{ id: 'BR7-GIFT-1', location: 'PLAYER' as const, destination: null, givenWeek: null }];
  const before = { cash: 1000, actions: 100, health: 100, mind: 100, spirituality: 120, pollution: 0, sequence: 2 as const, acting: 100, coreStats: { physique: 10, perception: 20, will: 30, knowledge: 40 },
    mastery: { [AMPLIFICATION]: 0, [PROLONGATION]: 0 }, completedSources: [], injuries: [], injuryRisk: 0, gifts };
  const date = { epoch: 'FIFTH_EPOCH' as const, year: 1349, month: 6, day: 28 };
  return { runId: 'entropy-combat-declared-unit', revision: 4, week: 1, date, round: 1, encounterId: 'ENTROPY_DUKE_DISPUTE', targetId: 'ED2-OSWIN', attemptWeek: 1, startHistoryIndex: 0,
    targetName: '奥斯温·格雷', targetAge: 46, targetPathway: 'original-caster', targetSequence: 3, targetCore: 22, actualBody: true, independentMind: true, enemyWeapon: 'ED2-OSWIN-ROD', weaponOwner: 'ED2-OSWIN', yardId: 'FM3-DELIVERY-PRACTICE', enemyPosition: 'BETWEEN_A_AND_B', enemyDistanceMetres: 2,
    ordinaryExit: 'OPEN', pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false, freeSkillLibrary: false, playerHealth: 100, playerMind: 98, playerSpirituality: 120, playerInjuries: [], playerRisk: 0,
    ...before.coreStats, mastery: { ...before.mastery }, clubHeld: false, gifts: structuredClone(gifts),
    preparation: { week: 1, date, revision: 2, runId: 'entropy-combat-declared-unit', randomSeed: 'entropy-combat-declared-unit', randomCursor: 0, mindPaid: 2, lifeJournalLength: 1, lifeClockSeconds: 0, before, after: { ...before, mind: 98 },
      finance: { weeklyBudget: 100, lifeTier: 'DESTITUTE', nextLifeTier: 'DESTITUTE', debts: [], missedWeeks: 0, credit: 'NORMAL' } },
    root, body: combatBody(createEntropyDukeEncounterState()), randomSeed: 'entropy-combat-declared-unit', randomCursor: 0 };
}
function random(...rolls: number[]): ActionRandomStream { let cursor = 0; return { seed: 'declared-slot-unit', get cursor() { return cursor; }, nextInt(min, max) { const n = rolls[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected declared draw ${n} in ${min}..${max}`); return n; } }; }
function scripted(rolls: number[]) {
  let cursor = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function(this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = rolls[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected directed draw ${n} in ${min}..${max}`); return n;
  });
}
afterEach(() => vi.restoreAllMocks());
const deviation = 'black-emperor.s3.ordered-deviation', bribery = 'black-emperor.s7.bribery-weakening';

describe('Entropy Duke finite combat kernel', () => {
  it('retains real S3 count and six slot weights, no Wheel luck fields', () => {
    expect(ENTROPY_DUKE_COUNT_WHEEL.map(x => x.weight)).toEqual([12, 20, 25, 23, 14, 6]);
    expect(entropyDukeAbilityWheel({} as SliceState, null).map(x => x.weight)).toEqual([30, 15, 25, 10, 15, 5]);
    expect(ENTROPY_DUKE_ENEMY_ABILITY_WHEEL.reduce((n, x) => n + x.weight, 0)).toBe(100);
    expect(validEntropyDukeCombatSource(source())).toBe(true); expect(validateEntropyDukePreparation(source().preparation)).toBe(true);
    expect(Object.keys(source())).not.toContain('luck'); expect(validateEntropyDukeEncounterCommand({ type: 'PREPARE_ENCOUNTER' })).toBe(true);
    expect(validateEntropyDukeEncounterCommand({ type: 'ENCOUNTER_FIGHT', reset: true })).toBe(false);
  });
  it('charges failed amplification exactly and only amplifies the current own body action', () => {
    const x = source(), failed = createEntropyDukeRuntime(x), a = resolveEntropyDukePlayerSlot(x, failed, AMPLIFICATION, 0, random(100));
    expect([a.paidCost, a.mindCost, failed.playerS, failed.playerM]).toEqual([6, 1, 114, 97]); expect(a.succeeded).toBe(false); expect(a.selfGain).toBe(a.rawContribution); expect(failed.mastery[AMPLIFICATION]).toBe(0);
    const r = createEntropyDukeRuntime(x), success = resolveEntropyDukePlayerSlot(x, r, AMPLIFICATION, 0, random(1));
    expect(success.selfGain).toBe(success.rawContribution * 1.5); expect(r.mastery[AMPLIFICATION]).toBe(8); expect(r.pending).toEqual([]);
    const next = resolveEntropyDukePlayerSlot(x, r, 'BODY_FOLLOWUP', 1, random()); expect(next.selfGain).toBeCloseTo(41.405 * .65); expect(next.masteryApplied).toEqual([]);
  });
  it('keeps inherited magnify cost4 and ordinary fallback without resource overdraft', () => {
    const x = source(), r = createEntropyDukeRuntime(x); r.playerS = 4; r.playerM = 0;
    const a = resolveEntropyDukePlayerSlot(x, r, AMPLIFICATION, 0, random()); expect(a.selectedAbility).toBe('black-emperor.s4.magnify'); expect(a.paidCost).toBe(4); expect(r.playerS).toBe(0); expect(a.check).toBeNull();
    const b = resolveEntropyDukePlayerSlot(x, r, AMPLIFICATION, 1, random()); expect(b.paidCost).toBe(0); expect(b.selfGain).toBe(b.rawContribution); expect(r.playerM).toBe(0);
  });
  it('requires a still-active own pending effect and charges failure without extending', () => {
    const x = source(), r = createEntropyDukeRuntime(x); const absent = resolveEntropyDukePlayerSlot(x, r, PROLONGATION, 0, random()); expect(absent.paidCost).toBe(0);
    resolveEntropyDukePlayerSlot(x, r, deviation, 1, random(1)); const deadline = r.pending[0]!.expiresAt;
    const failed = resolveEntropyDukePlayerSlot(x, r, PROLONGATION, 2, random(100)); expect([failed.paidCost, failed.mindCost]).toEqual([5, 1]); expect(r.pending[0]!.expiresAt).toBe(deadline); expect(r.mastery[PROLONGATION]).toBe(0);
  });
  it('extends once by30 seconds, never stacks, and awards only when added time is actually used', () => {
    const x = source(), r = createEntropyDukeRuntime(x); resolveEntropyDukePlayerSlot(x, r, deviation, 0, random(1));
    const original = r.pending[0]!.expiresAt; const a = resolveEntropyDukePlayerSlot(x, r, PROLONGATION, 1, random(1)); expect(a.succeeded).toBe(true); expect(r.pending[0]!.expiresAt).toBe(original + 30); expect(r.pending[0]!.remaining).toBe(1); expect(r.mastery[PROLONGATION]).toBe(0);
    const noStack = resolveEntropyDukePlayerSlot(x, r, PROLONGATION, 2, random()); expect(noStack.paidCost).toBe(0);
    advanceEntropyDukeCombatClock(r, original - r.root.clockSeconds); const enemy = resolveEntropyDukeEnemySlot(x, r, 'ARC_BOLT', 3, random());
    expect([enemy.rawContribution, enemy.selfGain, enemy.paidCost]).toEqual([70, 35, 5]); expect(r.mastery[PROLONGATION]).toBe(8); expect(r.pending).toEqual([]);
    const completed = resolveEntropyDukePlayerSlot(x, r, PROLONGATION, 4, random()); expect(completed.paidCost).toBe(0); expect(r.mastery[PROLONGATION]).toBe(8);
  });
  it('expires at the exact bound and cannot edit a completed outcome', () => {
    const x = source(), r = createEntropyDukeRuntime(x); resolveEntropyDukePlayerSlot(x, r, deviation, 0, random(1)); advanceEntropyDukeCombatClock(r, 25);
    expect(r.pending).toEqual([]); expect(resolveEntropyDukePlayerSlot(x, r, PROLONGATION, 1, random()).paidCost).toBe(0);
    expect(resolveEntropyDukeEnemySlot(x, r, 'ARC_BOLT', 2, random()).selfGain).toBe(70);
  });
  it('uses original gifts once and keeps the inherited3-spirituality exploit fallback', () => {
    const x = source(), r = createEntropyDukeRuntime(x); const a = resolveEntropyDukePlayerSlot(x, r, bribery, 0, random());
    expect(a.giftId).toBe('BR7-GIFT-1'); expect(r.gifts[0]).toEqual({ id: 'BR7-GIFT-1', location: 'GIVEN', destination: ENTROPY_DUKE_GIFT_GROUND, givenWeek: 1 });
    r.playerS = 3; const b = resolveEntropyDukePlayerSlot(x, r, PROLONGATION, 1, random()); expect(b.selectedAbility).toBe('black-emperor.s4.exploit'); expect(b.paidCost).toBe(3); expect(r.pending[0]!.remaining).toBe(2);
    expect(resolveEntropyDukeEnemySlot(x, r, 'WARD', 2, random()).enemyReduction).toBe(30); expect(r.pending[0]!.remaining).toBe(2);
    expect(resolveEntropyDukeEnemySlot(x, r, 'BODY_STRIKE', 3, random()).selfGain).toBeCloseTo(20 * (1 - .35 * .65)); expect(r.pending[0]!.remaining).toBe(1);
    resolveEntropyDukeEnemySlot(x, r, 'BODY_STRIKE', 4, random()); expect(r.pending).toEqual([]); expect(r.gifts).toHaveLength(1);
  });
  it('opponent pays actual finite resource and keeps independent defense, composure and mental action', () => {
    const x = source(), r = createEntropyDukeRuntime(x); resolveEntropyDukePlayerSlot(x, r, deviation, 0, random(1));
    const composed = resolveEntropyDukeEnemySlot(x, r, 'COMPOSE', 1, random()); expect([composed.paidCost, r.body.enemySpirituality]).toEqual([4, 116]); expect(r.pending).toEqual([]);
    const resisted = resolveEntropyDukePlayerSlot(x, r, deviation, 2, random(1)); expect(resisted.resisted).toBe(true); expect(resisted.paidCost).toBe(5); expect(resisted.succeeded).toBe(false);
    const pressure = resolveEntropyDukeEnemySlot(x, r, 'MENTAL_PRESSURE', 3, random()); expect([pressure.attackKind, pressure.mentalPressure, pressure.threatens]).toEqual(['MIND', true, false]); expect(r.body.enemySpirituality).toBe(111);
    r.body.enemySpirituality = 3; const dry = resolveEntropyDukeEnemySlot(x, r, 'ARC_BOLT', 4, random()); expect(dry.attackKind).toBe('BODY'); expect(dry.paidCost).toBe(0); expect(r.body.enemySpirituality).toBe(3);
  });
  it('replays real seed and rejects outcome, cursor, gift, mastery and enemy-resource tampering', () => {
    const x = source(), { round } = replayEntropyDukeCombatRound(x, 'ATTACK'); expect(validateEntropyDukeCombatRound(round)).toBe(true); const o = round.entropyDukeOutcome!; expect(validateEntropyDukeRoundOutcome(o)).toBe(true);
    for (const change of [(v: EntropyDukeRoundOutcome) => { v.enemySpirituality++; }, (v: EntropyDukeRoundOutcome) => { v.randomCursorAfter++; }, (v: EntropyDukeRoundOutcome) => { v.masteryAfter[AMPLIFICATION]!++; }, (v: EntropyDukeRoundOutcome) => { v.giftsAfter = []; }, (v: EntropyDukeRoundOutcome) => { v.playerMindAfter++; }]) { const bad = structuredClone(o); change(bad); expect(validateEntropyDukeRoundOutcome(bad)).toBe(false); }
    if (o.continuing) { const next = nextEntropyDukeCombatSource(o); expect(next.playerSpirituality).toBe(Math.min(120, o.playerSpiritualityAfter + 12)); expect(validEntropyDukeCombatSource(next)).toBe(true); }
  });
  it('uses actual BODY damage source, independent enemy weapon and mental-only consequences', () => {
    scripted([1, 1, 400, 90, 1000000]); const mental = replayEntropyDukeCombatRound(source(), 'DEFEND');
    expect(mental.round.consequenceDomain).toBe('MENTAL'); expect(mental.round.entropyDukeOutcome!.playerMindAfter).toBe(88); expect(mental.round.entropyDukeOutcome!.playerHealthAfter).toBe(100); expect(mental.round.consequenceWeights).toBeNull(); vi.restoreAllMocks();
    scripted([1, 1, 1, 1, 1, 1, 100]); const body = replayEntropyDukeCombatRound(source(), 'ATTACK');
    expect(body.outcome).toBe('ENEMY_DEAD'); expect(body.round.consequenceDomain).toBe('BODY'); expect(body.round.entropyDukeOutcome!.weaponLocation).toBe('COURT');
  });
});

/** Reconciliation unit freezes all inputs before the terminal result; uses the
 * production shared finance resolver, never relaxes combat resource equality. */
function terminalFinance(finance: Partial<EntropyDukePreparation['finance']> = {}, cash = 1000, actions = 2) {
  const x = source(); x.preparation.before.actions = x.preparation.after.actions = actions; x.preparation.before.cash = x.preparation.after.cash = cash;
  Object.assign(x.preparation.finance, finance); const result = replayEntropyDukeCombatRound(x, 'RETREAT'), o = result.round.entropyDukeOutcome!, prep = x.preparation;
  const s = { revision: o.source.revision + 1, runId: x.runId, week: prep.week, date: { ...prep.date }, status: 'ACTIVE', cash, actionsRemaining: actions - 2,
    health: o.playerHealthAfter, mind: o.playerMindAfter, spirituality: o.playerSpiritualityAfter, injuries: structuredClone(o.playerInjuriesAfter), injuryRisk: o.playerRiskAfter,
    briber: { gifts: structuredClone(o.giftsAfter) }, progression: { mastery: { ...o.masteryAfter }, acting: prep.after.acting }, seer: { pollution: prep.after.pollution, completedSources: [...prep.after.completedSources] },
    character: { coreStats: { ...prep.after.coreStats } }, random: { cursor: o.randomCursorAfter }, ...structuredClone(prep.finance), pulse: 'NONE', billAmount: 0, activeEvent: null, eventQueue: [], chronicle: [] } as unknown as SliceState;
  s.chronicle.push({ id: `record-${s.revision}-0`, week: prep.week, title: '原奥斯温冲突结束', text: '沿普通出口离开。' });
  if (actions === 2) {
    const billing = resolveSliceWeeklyFinance({ ...prep.finance, cash, week: prep.week, revision: o.source.revision, pulse: 'BILL', billAmount: 0 }); Object.assign(s, billing.state); s.revision = o.source.revision + 1;
    for (const receipt of billing.receipts) s.chronicle.push({ id: `record-${s.revision}-${s.chronicle.length}`, week: prep.week, ...receipt });
    if (billing.eventId) s.activeEvent = { id: billing.eventId, instanceId: `${s.runId}:${billing.eventId}:${s.revision}:${s.chronicle.length}` };
    else { s.week++; s.date = addGameWeeks(prep.date, 1); s.actionsRemaining = prep.finance.weeklyBudget; s.lifeTier = s.nextLifeTier; s.pulse = 'NONE'; s.billAmount = 0;
      s.chronicle.push({ id: `record-${s.revision}-${s.chronicle.length}`, week: s.week, title: '新的一周', text: `日期推进7天，本周${prep.finance.weeklyBudget}次行动。` }); }
  }
  return { s, o, prep };
}
describe('Entropy Duke exact zero-action terminal finance', () => {
  it('accepts paid bill and exact week advance without refilling combat resources', () => {
    const { s, o, prep } = terminalFinance(); expect(entropyDukeTerminalBudgetMatches(s, prep, o)).toBe(true); expect(s.week).toBe(prep.week + 1);
    for (const change of [(v: SliceState) => { v.spirituality++; }, (v: SliceState) => { v.mind++; }, (v: SliceState) => { v.cash++; }, (v: SliceState) => { v.actionsRemaining--; }, (v: SliceState) => { v.week++; }, (v: SliceState) => { v.random.cursor++; }, (v: SliceState) => { v.progression.mastery[AMPLIFICATION]!++; }]) { const bad = structuredClone(s); change(bad); expect(entropyDukeTerminalBudgetMatches(bad, prep, o)).toBe(false); }
  });
  it('accepts unpaid billing interruption and rejects invented event IDs and receipts', () => {
    const { s, o, prep } = terminalFinance({}, 0); expect(s.activeEvent?.id).toBe('LIFE-BILL-01'); expect(s.week).toBe(prep.week); expect(entropyDukeTerminalBudgetMatches(s, prep, o)).toBe(true);
    s.activeEvent!.instanceId += ':forged'; expect(entropyDukeTerminalBudgetMatches(s, prep, o)).toBe(false);
  });
  it('accepts existing debt repayment, notice/suspension and new debt exemption exactly', () => {
    for (const missedWeeks of [0, 1, 3]) {
      const f = { debts: [{ id: 'old-debt', source: '约定账目', remaining: 100, weeklyPayment: 30, createdWeek: 0 }], missedWeeks, credit: 'NORMAL' as const };
      const { s, o, prep } = terminalFinance(f, 30); expect(entropyDukeTerminalBudgetMatches(s, prep, o)).toBe(true);
      const bad = structuredClone(s); bad.debts[0]!.remaining--; expect(entropyDukeTerminalBudgetMatches(bad, prep, o)).toBe(false);
    }
    const fresh = terminalFinance({ debts: [{ id: 'new-debt', source: '本周账目', remaining: 100, weeklyPayment: 30, createdWeek: 1 }] }, 1000); expect(fresh.s.debts[0]!.remaining).toBe(100); expect(entropyDukeTerminalBudgetMatches(fresh.s, fresh.prep, fresh.o)).toBe(true);
    const suspended = terminalFinance({ credit: 'SUSPENDED', missedWeeks: 4 }, 0); expect(suspended.s.debts.length).toBe(1); expect(entropyDukeTerminalBudgetMatches(suspended.s, suspended.prep, suspended.o)).toBe(true);
  });
  it('retains strict same-week cash/actions when a terminal round leaves action budget', () => {
    const { s, o, prep } = terminalFinance({}, 1000, 3); expect(entropyDukeTerminalBudgetMatches(s, prep, o)).toBe(true);
    s.week++; expect(entropyDukeTerminalBudgetMatches(s, prep, o)).toBe(false); s.week--; s.actionsRemaining++; expect(entropyDukeTerminalBudgetMatches(s, prep, o)).toBe(false);
  });
});

import { ENTROPY_DUKE_CASE_IDS, replayEntropyDukeLifeRoot, type EntropyDukeActivityCommand, type EntropyDukeCaseId } from '../../src/domain/entropy-duke/life.js';
import { ENTROPY_DUKE_PREPARATION_IDS } from '../../src/domain/entropy-duke/types.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { hasEntropyDukeDisputeOpponent, validateEntropyDukeEncounter } from '../../src/domain/entropy-duke/encounter.js';
import { directedInitial3, dose, ed, promoted, rejectEntropyDuke, rejectIntent, step } from './entropy-duke-directed-helper.js';
function ordinary(s: SliceState, caseId: EntropyDukeCaseId): SliceState {
  const commands: EntropyDukeActivityCommand[] = [{ type: 'OBSERVE', caseId }, { type: 'PREPARE', caseId, method: 'ORDINARY' }, { type: 'WALK', caseId, to: 'A' }, { type: 'CHECK_ORIGINALS', caseId }, { type: 'TAKE_BALL', caseId },
    { type: 'ORDINARY_THROW', caseId }, { type: 'WAIT_FLIGHT', caseId }, { type: 'WALK', caseId, to: 'B' }, { type: 'READ_RESULT', caseId }, { type: 'TAKE_RESULT', caseId }, { type: 'WALK', caseId, to: 'A' },
    { type: 'RETURN_OBJECTS', caseId }, { type: 'WALK', caseId, to: 'START' }, { type: 'INSPECT', caseId }, { type: 'LEAVE', caseId }, { type: 'REPORT', caseId }];
  for (const c of commands) s = ed(s, c); return s;
}
let readyCache: SliceState | undefined;
function ready() { if (!readyCache) { let s = promoted(); for (const id of ENTROPY_DUKE_CASE_IDS) s = ordinary(s, id); readyCache = ed(s, { type: 'REFLECT' }); } return structuredClone(readyCache); }
const fight = (s = ready()) => ed(ed(ed(s, { type: 'PREPARE_ENCOUNTER' }), { type: 'ENCOUNTER_TALK' }), { type: 'ENCOUNTER_FIGHT' });
function financialReady(cash: number, finance: Partial<Pick<SliceState, 'debts' | 'missedWeeks' | 'credit' | 'lifeTier' | 'nextLifeTier'>> = {}) {
  let s = directedInitial3(); s.actionsRemaining = s.weeklyBudget = 100 - ready().actionsRemaining + 2; s.cash -= ready().cash - cash; Object.assign(s, finance);
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] }); let selected: number | null = null;
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 128; cursor++) { const rng = new DeterministicActionRandomStream(s.random.seed, cursor), potion = rng.nextInt(1, 100);
    rng.nextInt(1, 100); rng.nextInt(1, 100); if (potion > 5 && potion <= chance && rng.nextInt(1, 100) <= 50) { selected = cursor; break; } }
  expect(selected).not.toBeNull(); s.random.cursor = selected!; assertValidSliceState(s);
  s = ed(s, { type: 'LEARN_GUIDANCE' }); for (const taskId of ENTROPY_DUKE_PREPARATION_IDS) s = ed(s, { type: 'PREPARE_TASK', taskId });
  s = ed(s, { type: 'BUY_POTION', bottleId: 'entropy-duke-potion-1' }); s = ed(s, { type: 'PREPARE_PROMOTION' }); s = ed(s, dose);
  for (const id of ENTROPY_DUKE_CASE_IDS) s = ordinary(s, id); s = ed(s, { type: 'REFLECT' }); expect(s.actionsRemaining).toBe(2); expect(s.cash).toBe(cash); return s;
}
/** Opt-in evidence capture only. A fresh directory under output/ is mandatory;
 * neither published natural evidence nor an earlier directed capture can be replaced. */
function captureDirectedFinanceBoundaries(boundaries: Record<string, { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }>): void {
  const requested = process.env.ENTROPY_DUKE_DIRECTED_CAPTURE_DIR;
  if (!requested) return;
  const directory = resolve(requested), insideOutput = relative(resolve('output'), directory);
  if (!insideOutput || insideOutput === '..' || insideOutput.startsWith(`..${sep}`) || isAbsolute(insideOutput)) throw new Error('ENTROPY_DUKE_DIRECTED_CAPTURE_DIR must name a fresh directory inside output/.');
  if (existsSync(directory)) throw new Error(`Refusing to replace an existing directed capture directory: ${directory}`);
  mkdirSync(dirname(directory), { recursive: true }); mkdirSync(directory);
  const index: Record<string, string> = {};
  for (const [name, boundary] of Object.entries(boundaries)) {
    const filename = `${name}.json`; index[name] = filename;
    writeFileSync(resolve(directory, filename), JSON.stringify({ provenance: 'DECLARED_UNIT_FINANCIAL_BRANCH_NOT_NATURAL',
      sourceDeclaration: 'The original living 555-command Frenzy Mage prefix is retained. Before the first Entropy Duke journal, this unit declares maturity, cash, action budget and financial variants, and selects a bounded cursor on the original seed. Every acquisition, ordinary practice, preparation and terminal command afterward executes through the public API. This is directed boundary coverage, not the natural campaign.',
      ...boundary }), { flag: 'wx' });
  }
  writeFileSync(resolve(directory, 'directed.index.json'), JSON.stringify(index, null, 2), { flag: 'wx' });
}
describe('Entropy Duke original room encounter through public commands', () => {
  it('walks both original people OUTSIDE with original items before independent enemy combat', () => {
    const before = ready(), s = fight(before), e = s.entropyDuke.encounter;
    expect(hasEntropyDukeDisputeOpponent(s)).toBe(true); expect(validateEntropyDukeEncounter(s)).toBe(true);
    expect(s.frenzyMage.life.volunteer).toMatchObject({ id: 'FM3-DARIAN', age: 42, alive: true, location: 'OUTSIDE' }); expect(s.frenzyMage.life.guide.location).toBe('OUTSIDE');
    for (const item of [s.frenzyMage.life.parcel, s.frenzyMage.life.ball, s.frenzyMage.life.paper]) expect(item).toMatchObject({ holder: 'GUIDE', location: 'OUTSIDE' });
    expect(e.clearance).toMatchObject({ darianMetres: 8, guideMetres: 4, elapsedSeconds: 16 }); expect(s.frenzyMage.life.clockSeconds - before.frenzyMage.life.clockSeconds).toBe(16);
    expect(e.enemyHealth).toBe(100); expect(e.enemyMind).toBe(100); expect(e.enemySpirituality).toBe(120); expect(s.frenzyMage.encounter).toEqual(before.frenzyMage.encounter); expect(s.combatHistory).toEqual(before.combatHistory);
    rejectIntent(s, { type: 'ACTION', action: 'REST' }); const bad = structuredClone(s); bad.frenzyMage.life.guide.location = 'START'; expect(validateEntropyDukeEncounter(bad)).toBe(false);
  }, 10_000); // Includes the cold original prefix and three complete public practice cases.
  it('keeps preparation costs and ordinary exit without respawning or rewriting old history', () => {
    const before = ready(), prepared = ed(before, { type: 'PREPARE_ENCOUNTER' }); expect(prepared.mind).toBe(before.mind - 2); rejectEntropyDuke(prepared, { type: 'PREPARE_ENCOUNTER' });
    const left = ed(ed(prepared, { type: 'ENCOUNTER_TALK' }), { type: 'LEAVE_ENCOUNTER' }); expect(left.frenzyMage.life.playerLocation).toBe('START'); expect(left.entropyDuke.encounter.enemyHealth).toBe(100); expect(left.combatHistory).toEqual(before.combatHistory);
    expect(left.frenzyMage.life.clockSeconds - before.frenzyMage.life.clockSeconds).toBe(20); rejectEntropyDuke(left, { type: 'ENCOUNTER_TALK' }); assertValidSliceState(left);
  });
  it('settles actual0AP terminal into paid week, interrupted bill, old debt notice and suspension', () => {
    const variants: [number, Parameters<typeof financialReady>[1]][] = [[1000, {}], [0, {}], [30, { debts: [{ id: 'old', source: '约定账目', remaining: 100, weeklyPayment: 30, createdWeek: 1 }], missedWeeks: 1 }],
      [30, { debts: [{ id: 'old', source: '约定账目', remaining: 100, weeklyPayment: 30, createdWeek: 1 }], missedWeeks: 3 }], [0, { credit: 'SUSPENDED', missedWeeks: 4 }]];
    const names = ['zero-ap-paid-bill-and-advance', 'zero-ap-unpaid-bill-interruption', 'zero-ap-second-missed-payment-notice', 'zero-ap-fourth-missed-payment-suspension', 'zero-ap-suspended-shortfall-new-debt'] as const;
    const captured: Parameters<typeof captureDirectedFinanceBoundaries>[0] = {};
    for (const [variantIndex, [cash, finance]] of variants.entries()) {
      const original = financialReady(cash, finance), fighting = fight(original); expect(fighting.actionsRemaining).toBe(0); const lastIntent: SliceIntent = { type: 'COMBAT_ROUND', stance: 'RETREAT' }; const s = step(fighting, lastIntent);
      expect(s.entropyDuke.encounter.status).toBe('RETREATED'); const debugOutcome = s.combatHistory.at(-1)!.entropyDukeOutcome!; expect(validateEntropyDukeEncounter(s), JSON.stringify({cash,finance,life:!!replayEntropyDukeLifeRoot(s), budget:entropyDukeTerminalBudgetMatches(s,s.entropyDuke.encounter.preparation!,debugOutcome),revision:s.revision,sourceRevision:debugOutcome.source.revision,week:s.week,pulse:s.pulse,actions:s.actionsRemaining,actualCash:s.cash,activeEvent:s.activeEvent,chronicle:s.chronicle.slice(-6),resources:[s.health,s.mind,s.spirituality],outcome:[debugOutcome.playerHealthAfter,debugOutcome.playerMindAfter,debugOutcome.playerSpiritualityAfter]})).toBe(true); assertValidSliceState(s);
      const o = s.combatHistory.at(-1)!.entropyDukeOutcome!; expect(s.health).toBe(o.playerHealthAfter); expect(s.spirituality).toBe(o.playerSpiritualityAfter); expect(s.mind).toBe(o.playerMindAfter);
      for (const mutate of [(v: SliceState) => { v.cash++; }, (v: SliceState) => { v.spirituality++; }, (v: SliceState) => { v.mind++; }, (v: SliceState) => { v.actionsRemaining++; }, (v: SliceState) => { v.random.cursor++; }]) { const bad = structuredClone(s); mutate(bad); expect(validateEntropyDukeEncounter(bad)).toBe(false); }
      if (process.env.ENTROPY_DUKE_DIRECTED_CAPTURE_DIR) captured[names[variantIndex]!] = { beforeLast: structuredClone(fighting), lastIntent: structuredClone(lastIntent), final: structuredClone(s) };
    }
    captureDirectedFinanceBoundaries(captured);
  }, 10_000);
});
