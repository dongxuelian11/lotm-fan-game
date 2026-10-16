import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyArbiterCommand } from '../../src/domain/arbiter/index.js';
import { ARBITER_ABILITY_IDS } from '../../src/domain/arbiter/types.js';
import { applySheriffCommand } from '../../src/domain/sheriff/index.js';
import { SHERIFF_ABILITY_IDS } from '../../src/domain/sheriff/types.js';
import { applyInterrogatorCommand } from '../../src/domain/interrogator/index.js';
import { INTERROGATOR_ABILITY_IDS } from '../../src/domain/interrogator/types.js';
import { applyJudgeCommand, createJudgeState, projectJudge, validateJudgeCommand, validateJudgeState } from '../../src/domain/judge/index.js';
import { applyJudgeActivity } from '../../src/domain/judge/life.js';
import { hasJudgeDisputeOpponent, settleJudgeEncounter } from '../../src/domain/judge/encounter.js';
import { JUDGE_FORMULA_STATUS, JUDGE_SOURCE_STATUS } from '../../src/domain/judge/content.js';
import { JUDGE_ABILITY_IDS, JUDGE_CASE_IDS, type JudgeAcquisitionCommand, type JudgeActivityCommand, type JudgeCaseId } from '../../src/domain/judge/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function ordinary(): SliceState {
  const s = createSliceRun('judge-stage', sliceDefaultCreationSelection, 'judge-fixed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5; s.cash = 50000;
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.judge = createJudgeState(); return s;
}
function context(s: SliceState, roll = 1) {
  const c: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => { if (s.seer.completedSources.includes(source)) return; s.seer.completedSources.push(source); s.progression.mastery[JUDGE_ABILITY_IDS[0]]! += amount; });
  return { c, award };
}
/** Prior acting is a completed-history fixture; every original bottle is acquired through its real command. */
function interrogator(): SliceState {
  const s = ordinary(), c = context(s).c;
  applyArbiterCommand(s, { type: 'DISCOVER' }, c); applyArbiterCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyArbiterCommand(s, { type: 'BUY_POTION', bottleId: s.arbiter.bottles[0]!.id }, c); applyArbiterCommand(s, { type: 'CONSUME', bottleId: s.arbiter.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applySheriffCommand(s, { type: 'LEARN_GUIDANCE' }, c); applySheriffCommand(s, { type: 'BUY_POTION', bottleId: s.sheriff.bottles[0]!.id }, c); applySheriffCommand(s, { type: 'CONSUME', bottleId: s.sheriff.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  applyInterrogatorCommand(s, { type: 'LEARN_GUIDANCE' }, c); applyInterrogatorCommand(s, { type: 'BUY_POTION', bottleId: s.interrogator.bottles[0]!.id }, c); applyInterrogatorCommand(s, { type: 'CONSUME', bottleId: s.interrogator.bottles[0]!.id, confirmed: true }, c);
  s.week = 31; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...ARBITER_ABILITY_IDS, ...SHERIFF_ABILITY_IDS, ...INTERROGATOR_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 20000; s.actionsRemaining = 100; s.health = 100; s.mind = 100; s.spirituality = 31; s.character.coreStats.will = 25; s.character.coreStats.knowledge = 25;
  return s;
}
function acquisition(s: SliceState, command: JudgeAcquisitionCommand, roll = 1) { const ctx = context(s, roll); applyJudgeCommand(s, command, ctx.c); return ctx; }
function activity(s: SliceState, command: JudgeActivityCommand, roll = 1) { const ctx = context(s, roll); applyJudgeActivity(s, command, ctx.c, ctx.award); return ctx; }
function taught(s = interrogator()) { acquisition(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const bottle = s.judge.bottles[index]!; acquisition(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); acquisition(s, { type: 'CONSUME', bottleId: s.judge.bottles[0]!.id, confirmed: true }); return s; }
function rejectAcquisition(s: SliceState, command: unknown) { const before = structuredClone(s), ctx = context(s); expect(() => applyJudgeCommand(s, command as JudgeAcquisitionCommand, ctx.c)).toThrow(); expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); }
function rejectActivity(s: SliceState, command: unknown) { const before = structuredClone(s), ctx = context(s); expect(() => applyJudgeActivity(s, command as JudgeActivityCommand, ctx.c, ctx.award)).toThrow(); expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled(); }
function begin(s: SliceState, caseId: JudgeCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { activity(s, { type: 'OBSERVE', caseId }); activity(s, { type: 'PREPARE', caseId, method }); }
function complete(s: SliceState, caseId: JudgeCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  begin(s, caseId, method); activity(s, { type: 'PERFORM', caseId }); activity(s, { type: 'CLOSE', caseId });
  activity(s, { type: 'REPORT', caseId });
}
function firstReport() { const s = promoted(); complete(s, 'calm-room'); return s; }

describe('Judge independent S6 originals, guidance and promotion', () => {
  it('hides the undiscovered channel and creates no formula or supply', () => {
    const s = ordinary(), other = createJudgeState();
    expect(validateJudgeState(s)).toBe(true);
    expect(projectJudge(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', practice: { audience: 'READY', boundary: 'CLEAR', token: 'ON_TABLE', lineTestedBy: 'NONE', tokenTestedBy: 'NONE' } });
    expect(projectJudge(s).story).toBeUndefined(); other.bottles[0]!.labourSteps = 5; expect(s.judge.bottles[0]!.labourSteps).toBe(0);
    expect(JUDGE_FORMULA_STATUS).toContain('尚未核实'); expect(JUDGE_SOURCE_STATUS).toContain('法官权威'); rejectAcquisition(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges 360p and one AP for guidance, without inventing resources or a complete recipe', () => {
    const s = interrogator(), cash = s.cash, ap = s.actionsRemaining, oldInterrogator = structuredClone(s.interrogator);
    acquisition(s, { type: 'LEARN_GUIDANCE' }); expect([s.cash, s.actionsRemaining]).toEqual([cash - 360, ap - 1]); expect(s.interrogator).toEqual(oldInterrogator);
    expect(projectJudge(s)).toMatchObject({ guidanceKnown: true, formulaKnown: false, formula: [] }); rejectAcquisition(s, { type: 'LEARN_GUIDANCE' }); expect(validateJudgeState(s)).toBe(true);
  });
  it('charges five bottle-specific labours then 320p without transfer, refund or partial credit', () => {
    const s = taught(), [first, second] = s.judge.bottles, cash = s.cash, ap = s.actionsRemaining;
    for (let n = 0; n < 5; n += 1) acquisition(s, { type: 'POTION_WORK', bottleId: first!.id });
    expect(s.cash).toBe(cash); expect(s.actionsRemaining).toBe(ap - 5); rejectAcquisition(s, { type: 'POTION_WORK', bottleId: first!.id });
    buy(s); expect(s.cash).toBe(cash - 320); expect(second!.labourSteps).toBe(0); rejectAcquisition(s, { type: 'BUY_POTION', bottleId: first!.id }); expect(validateJudgeState(s)).toBe(true);
  });
  it('requires actual original, separate confirmation, consumed100 and twelve complete Interrogator weeks', () => {
    const s = taught(); rejectAcquisition(s, { type: 'CONSUME', bottleId: s.judge.bottles[0]!.id, confirmed: true }); buy(s);
    rejectAcquisition(s, { type: 'CONSUME', bottleId: s.judge.bottles[0]!.id, confirmed: false });
    s.progression.acting = 99; rejectAcquisition(s, { type: 'CONSUME', bottleId: s.judge.bottles[0]!.id, confirmed: true }); s.progression.acting = 100;
    s.week -= 1; rejectAcquisition(s, { type: 'CONSUME', bottleId: s.judge.bottles[0]!.id, confirmed: true }); s.week += 1;
    acquisition(s, { type: 'CONSUME', bottleId: s.judge.bottles[0]!.id, confirmed: true }); expect(validateJudgeState(s)).toBe(true);
  });
  it.each([{ roll: 1, mind: 95 }, { roll: 30, mind: 90 }])('promotes at roll $roll preserving all original mastery without gifting resources', ({ roll, mind }) => {
    const s = prepared(), old = structuredClone(s.progression.mastery), stats = { ...s.character.coreStats }, spirituality = s.spirituality;
    acquisition(s, { type: 'CONSUME', bottleId: s.judge.bottles[0]!.id, confirmed: true }, roll);
    expect(s.progression).toMatchObject({ pathwayId: 'justiciar', sequence: 6, acting: 0, mastery: { ...old, 'justiciar.s6.authority': 0, 'justiciar.s6.prohibition': 0 } });
    expect(s.judge).toMatchObject({ promotionWeek: 31, interrogatorActingAtPromotion: 100 }); expect([s.mind, s.spirituality]).toEqual([mind, spirituality]);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    rejectAcquisition(s, { type: 'BUY_POTION', bottleId: s.judge.bottles[1]!.id }); expect(validateJudgeState(s)).toBe(true);
  });
  it.each([{ roll: 80, mind: 80, health: 90, pollution: 25 }, { roll: 100, mind: 60, health: 80, pollution: 50 }])('keeps failed roll $roll recoverable while spending exactly the selected original', ({ roll, mind, health, pollution }) => {
    const s = prepared(), old = structuredClone(s.progression); acquisition(s, { type: 'CONSUME', bottleId: s.judge.bottles[0]!.id, confirmed: true }, roll);
    expect(s.progression).toEqual(old); expect([s.mind, s.health, s.seer.pollution, s.status]).toEqual([mind, health, pollution, 'ACTIVE']); expect(s.judge.bottles[0]!.status).toBe('CONSUMED'); expect(validateJudgeState(s)).toBe(true);
  });
  it('requires all originals to fail, one request AP and the next real week before a paid new batch', () => {
    const s = taught(); rejectAcquisition(s, { type: 'REQUEST_SUPPLY' });
    for (let i = 0; i < 3; i += 1) { const b = buy(s, i); acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 80); }
    const ap = s.actionsRemaining; acquisition(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' });
    s.week += 1; acquisition(s, { type: 'RECEIVE_SUPPLY' }); expect(s.judge.bottles).toHaveLength(6); expect(s.judge.bottles[3]!).toMatchObject({ id: 'judge-potion-4', status: 'SUPPLIER', labourSteps: 0 }); expect(validateJudgeState(s)).toBe(true);
    const forged = structuredClone(s); forged.judge.bottles[3]!.source = forged.judge.bottles[0]!.source; expect(validateJudgeState(forged)).toBe(false);
  });
});

describe('Judge courtyard dispute and strict save boundaries', () => {
  it('requires a real report and establishes only the original reachable courtyard opponent', () => {
    const s = promoted(); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
    complete(s, 'calm-room'); const ap = s.actionsRemaining; activity(s, { type: 'ENCOUNTER_FIGHT' });
    expect(s.actionsRemaining).toBe(ap - 1); expect(s.combat?.encounterId).toBe('JUDGE_DISPUTE'); expect(hasJudgeDisputeOpponent(s)).toBe(true); expect(validateJudgeState(s)).toBe(true);
    const ctx = context(s); settleJudgeEncounter(s, 'RETREATED', ctx.c, ctx.award);
    expect(ctx.award).not.toHaveBeenCalled(); expect(s.combat).toBeNull(); expect(s.judge.encounter.status).toBe('RETREATED'); expect(validateJudgeState(s)).toBe(true);
  });
  it('awards only living effective participation once, without extra acting or healing', () => {
    const s = firstReport(), acting = s.progression.acting; activity(s, { type: 'ENCOUNTER_FIGHT' });
    s.combatHistory.push({ round: 1, stance: 'ATTACK', first: 'PLAYER', playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1, moves: [{ actor: 'PLAYER', label: '真实原地打击', selfGain: 1, enemyReduction: 0 }], playerAdvantage: 1, enemyAdvantage: 0, winChance: 60, winner: 'PLAYER', consequence: '抵抗结束', consequenceWeights: null, retreat: 'NONE' });
    const ctx = context(s), health = s.health, sp = s.spirituality; settleJudgeEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award);
    expect(ctx.award).toHaveBeenCalledExactlyOnceWith('judge-dispute', 25); expect([s.progression.acting, s.health, s.spirituality]).toEqual([acting, health, sp]); expect(validateJudgeState(s)).toBe(true);
    expect(() => settleJudgeEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award)).toThrow();
  });
  it('preserves real death without revival or reward, and gives no award for an empty victory', () => {
    const s = firstReport(); activity(s, { type: 'ENCOUNTER_FIGHT' }); s.status = 'DEAD'; s.health = 0; const ctx = context(s);
    settleJudgeEncounter(s, 'PLAYER_DEAD', ctx.c, ctx.award);
    expect([s.status, s.health, s.judge.encounter.status, s.combat]).toEqual(['DEAD', 0, 'LOST', null]); expect(ctx.award).not.toHaveBeenCalled(); expect(validateJudgeState(s)).toBe(true);
    const empty = firstReport(); activity(empty, { type: 'ENCOUNTER_FIGHT' }); const other = context(empty);
    settleJudgeEncounter(empty, 'ENEMY_SURRENDERED', other.c, other.award); expect(other.award).not.toHaveBeenCalled(); expect(validateJudgeState(empty)).toBe(true);
  });
  it('talk respects refusal and a later voluntary result, with no free acting or mastery', () => {
    const s = firstReport(), before = structuredClone(s.progression); activity(s, { type: 'ENCOUNTER_TALK' }, 100);
    expect(s.judge.encounter.status).toBe('AVAILABLE'); rejectActivity(s, { type: 'ENCOUNTER_TALK' });
    s.week += 1; activity(s, { type: 'ENCOUNTER_TALK' }); expect(s.judge.encounter.status).toBe('RESOLVED'); expect(s.progression).toEqual(before); expect(validateJudgeState(s)).toBe(true);
  });
  it('rejects malformed commands before any spending or checks', () => {
    const s = promoted();
    for (const c of [{ type: 'HANDLE_MOON', method: 'FOOD' }, { type: 'OBSERVE', caseId: 'future-spirit' }, { type: 'PREPARE', caseId: 'marked-line', method: 'ABILITY', free: true }, { type: 'VERIFY', caseId: 'shared-token' }, { type: 'COMPOSE' }, { type: 'BUY_GIFTS' }]) {
      expect(validateJudgeCommand(c)).toBe(false); rejectActivity(s, c);
    }
    rejectAcquisition(s, { type: 'CONSUME', bottleId: 'interrogator-potion-1', confirmed: true });
  });
  it('rejects counterfeit practice, acting, duplicated award and original provenance', () => {
    const s = firstReport();
    const mutations: ((v: SliceState) => void)[] = [
      v => { v.judge.practice.boundary = 'HELD'; },
      v => { v.judge.practice.token = 'HELD_ON_TABLE'; },
      v => { v.progression.acting += 25; },
      v => { v.seer.completedSources.push('judge-case:calm-room'); },
      v => { v.judge.bottles[0]!.source = 'free conjured potion'; },
      v => { (v.judge as unknown as Record<string, unknown>).magnify = 10; },
      v => { (v.judge as unknown as Record<string, unknown>).practice = []; },
    ];
    for (const mutate of mutations) { const forged = structuredClone(s); mutate(forged); expect(validateJudgeState(forged)).toBe(false); }
  });
});

