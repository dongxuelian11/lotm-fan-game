import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyMonsterCommand } from '../../src/domain/monster/index.js';
import { MONSTER_ABILITY_IDS } from '../../src/domain/monster/types.js';
import { applyMachineCommand } from '../../src/domain/machine/index.js';
import { MACHINE_ABILITY_IDS } from '../../src/domain/machine/types.js';
import { applyLuckyCommand } from '../../src/domain/lucky/index.js';
import { LUCKY_ABILITY_IDS } from '../../src/domain/lucky/types.js';
import { applyCalamityPriestCommand, createCalamityPriestState, projectCalamityPriest, validateCalamityPriestCommand, validateCalamityPriestState } from '../../src/domain/calamity-priest/index.js';
import { applyCalamityPriestActivity, calamityPriestActions, calamityPriestCases, calamityPriestInside, validateCalamityPriestLife } from '../../src/domain/calamity-priest/life.js';
import { hasCalamityPriestDisputeOpponent, settleCalamityPriestEncounter } from '../../src/domain/calamity-priest/encounter.js';
import { CALAMITY_PRIEST_FORMULA_STATUS, CALAMITY_PRIEST_SOURCE_STATUS } from '../../src/domain/calamity-priest/content.js';
import { CALAMITY_PRIEST_ABILITY_IDS, CALAMITY_PRIEST_CASE_IDS, type CalamityPriestAcquisitionCommand, type CalamityPriestActivityCommand, type CalamityPriestCaseId } from '../../src/domain/calamity-priest/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function ordinary(): SliceState {
  const s = createSliceRun('calamity-priest-stage', sliceDefaultCreationSelection, 'calamity-priest-fixed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5; s.cash = 50000;
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.calamityPriest = createCalamityPriestState(); return s;
}
function context(s: SliceState, roll = 1) {
  const c: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => { if (s.seer.completedSources.includes(source)) return; s.seer.completedSources.push(source); s.progression.mastery[CALAMITY_PRIEST_ABILITY_IDS[0]]! += amount; });
  return { c, award };
}
/** Prior acting is a completed-history fixture; every original bottle is acquired through its real command. */
function lucky(): SliceState {
  const s = ordinary(), c = context(s).c;
  applyMonsterCommand(s, { type: 'DISCOVER' }, c); applyMonsterCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyMonsterCommand(s, { type: 'BUY_POTION', bottleId: s.monster.bottles[0]!.id }, c); applyMonsterCommand(s, { type: 'CONSUME', bottleId: s.monster.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applyMachineCommand(s, { type: 'LEARN_GUIDANCE' }, c); applyMachineCommand(s, { type: 'BUY_POTION', bottleId: s.machine.bottles[0]!.id }, c); applyMachineCommand(s, { type: 'CONSUME', bottleId: s.machine.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  applyLuckyCommand(s, { type: 'LEARN_GUIDANCE' }, c); applyLuckyCommand(s, { type: 'BUY_POTION', bottleId: s.lucky.bottles[0]!.id }, c); applyLuckyCommand(s, { type: 'CONSUME', bottleId: s.lucky.bottles[0]!.id, confirmed: true }, c);
  s.week = 31; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...MONSTER_ABILITY_IDS, ...MACHINE_ABILITY_IDS, ...LUCKY_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 20000; s.actionsRemaining = 100; s.health = 100; s.mind = 100; s.spirituality = 31; s.character.coreStats.will = 25; s.character.coreStats.knowledge = 25;
  return s;
}
function acquisition(s: SliceState, command: CalamityPriestAcquisitionCommand, roll = 1) { const ctx = context(s, roll); applyCalamityPriestCommand(s, command, ctx.c); return ctx; }
function activity(s: SliceState, command: CalamityPriestActivityCommand, roll = 1) { const ctx = context(s, roll); applyCalamityPriestActivity(s, command, ctx.c, ctx.award); return ctx; }
function taught(s = lucky()) { acquisition(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const bottle = s.calamityPriest.bottles[index]!; acquisition(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); acquisition(s, { type: 'CONSUME', bottleId: s.calamityPriest.bottles[0]!.id, confirmed: true }); return s; }
function rejectAcquisition(s: SliceState, command: unknown) { const before = structuredClone(s), ctx = context(s); expect(() => applyCalamityPriestCommand(s, command as CalamityPriestAcquisitionCommand, ctx.c)).toThrow(); expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); }
function rejectActivity(s: SliceState, command: unknown) { const before = structuredClone(s), ctx = context(s); expect(() => applyCalamityPriestActivity(s, command as CalamityPriestActivityCommand, ctx.c, ctx.award)).toThrow(); expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled(); }
function begin(s: SliceState, caseId: CalamityPriestCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { activity(s, { type: 'OBSERVE', caseId }); activity(s, { type: 'PREPARE', caseId, method }); }
function complete(s: SliceState, caseId: CalamityPriestCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  begin(s, caseId, method); activity(s, { type: 'PERFORM', caseId }); activity(s, { type: 'CLOSE', caseId });
  activity(s, { type: 'REPORT', caseId });
}
function firstReport() { const s = promoted(); complete(s, 'rain-rack'); return s; }

describe('CalamityPriest independent S6 originals, guidance and promotion', () => {
  it('hides the undiscovered channel and creates no formula or supply', () => {
    const s = ordinary(), other = createCalamityPriestState();
    expect(validateCalamityPriestState(s)).toBe(true);
    expect(projectCalamityPriest(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', practice: { hazard: 'UNASSESSED', board: 'RESTING', contact: 'NONE' } });
    expect(projectCalamityPriest(s).story).toBeUndefined(); other.bottles[0]!.labourSteps = 5; expect(s.calamityPriest.bottles[0]!.labourSteps).toBe(0);
    expect(CALAMITY_PRIEST_FORMULA_STATUS).toContain('尚未核实'); expect(CALAMITY_PRIEST_SOURCE_STATUS).toContain('第四部第178章'); rejectAcquisition(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges 360p and one AP for guidance, without inventing resources or a complete recipe', () => {
    const s = lucky(), cash = s.cash, ap = s.actionsRemaining, oldLucky = structuredClone(s.lucky);
    acquisition(s, { type: 'LEARN_GUIDANCE' }); expect([s.cash, s.actionsRemaining]).toEqual([cash - 360, ap - 1]); expect(s.lucky).toEqual(oldLucky);
    expect(projectCalamityPriest(s)).toMatchObject({ guidanceKnown: true, formulaKnown: false, formula: [] }); rejectAcquisition(s, { type: 'LEARN_GUIDANCE' }); expect(validateCalamityPriestState(s)).toBe(true);
  });
  it('charges five bottle-specific labours then 320p without transfer, refund or partial credit', () => {
    const s = taught(), [first, second] = s.calamityPriest.bottles, cash = s.cash, ap = s.actionsRemaining;
    for (let n = 0; n < 5; n += 1) acquisition(s, { type: 'POTION_WORK', bottleId: first!.id });
    expect(s.cash).toBe(cash); expect(s.actionsRemaining).toBe(ap - 5); rejectAcquisition(s, { type: 'POTION_WORK', bottleId: first!.id });
    buy(s); expect(s.cash).toBe(cash - 320); expect(second!.labourSteps).toBe(0); rejectAcquisition(s, { type: 'BUY_POTION', bottleId: first!.id }); expect(validateCalamityPriestState(s)).toBe(true);
  });
  it('requires actual original, separate confirmation, consumed100 and twelve complete Lucky weeks', () => {
    const s = taught(); rejectAcquisition(s, { type: 'CONSUME', bottleId: s.calamityPriest.bottles[0]!.id, confirmed: true }); buy(s);
    rejectAcquisition(s, { type: 'CONSUME', bottleId: s.calamityPriest.bottles[0]!.id, confirmed: false });
    s.progression.acting = 99; rejectAcquisition(s, { type: 'CONSUME', bottleId: s.calamityPriest.bottles[0]!.id, confirmed: true }); s.progression.acting = 100;
    s.week -= 1; rejectAcquisition(s, { type: 'CONSUME', bottleId: s.calamityPriest.bottles[0]!.id, confirmed: true }); s.week += 1;
    acquisition(s, { type: 'CONSUME', bottleId: s.calamityPriest.bottles[0]!.id, confirmed: true }); expect(validateCalamityPriestState(s)).toBe(true);
  });
  it.each([{ roll: 1, mind: 95 }, { roll: 30, mind: 90 }])('promotes at roll $roll preserving all original mastery without gifting resources', ({ roll, mind }) => {
    const s = prepared(), old = structuredClone(s.progression.mastery), stats = { ...s.character.coreStats }, spirituality = s.spirituality;
    acquisition(s, { type: 'CONSUME', bottleId: s.calamityPriest.bottles[0]!.id, confirmed: true }, roll);
    expect(s.progression).toMatchObject({ pathwayId: 'wheel', sequence: 6, acting: 0, mastery: { ...old, 'wheel.s6.disaster-awareness': 0, 'wheel.s6.disaster-attraction': 0, 'wheel.s6.mental-storm': 0 } });
    expect(s.calamityPriest).toMatchObject({ promotionWeek: 31, luckyActingAtPromotion: 100 }); expect([s.mind, s.spirituality]).toEqual([mind, spirituality]);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    rejectAcquisition(s, { type: 'BUY_POTION', bottleId: s.calamityPriest.bottles[1]!.id }); expect(validateCalamityPriestState(s)).toBe(true);
  });
  it.each([{ roll: 80, mind: 80, health: 90, pollution: 25 }, { roll: 100, mind: 60, health: 80, pollution: 50 }])('keeps failed roll $roll recoverable while spending exactly the selected original', ({ roll, mind, health, pollution }) => {
    const s = prepared(), old = structuredClone(s.progression); acquisition(s, { type: 'CONSUME', bottleId: s.calamityPriest.bottles[0]!.id, confirmed: true }, roll);
    expect(s.progression).toEqual(old); expect([s.mind, s.health, s.seer.pollution, s.status]).toEqual([mind, health, pollution, 'ACTIVE']); expect(s.calamityPriest.bottles[0]!.status).toBe('CONSUMED'); expect(validateCalamityPriestState(s)).toBe(true);
  });
  it('requires all originals to fail, one request AP and the next real week before a paid new batch', () => {
    const s = taught(); rejectAcquisition(s, { type: 'REQUEST_SUPPLY' });
    for (let i = 0; i < 3; i += 1) { const b = buy(s, i); acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 80); }
    const ap = s.actionsRemaining; acquisition(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' });
    s.week += 1; acquisition(s, { type: 'RECEIVE_SUPPLY' }); expect(s.calamityPriest.bottles).toHaveLength(6); expect(s.calamityPriest.bottles[3]!).toMatchObject({ id: 'calamity-priest-potion-4', status: 'SUPPLIER', labourSteps: 0 }); expect(validateCalamityPriestState(s)).toBe(true);
    const forged = structuredClone(s); forged.calamityPriest.bottles[3]!.source = forged.calamityPriest.bottles[0]!.source; expect(validateCalamityPriestState(forged)).toBe(false);
  });
});

describe('CalamityPriest courtyard dispute and strict save boundaries', () => {
  it('requires a real report and establishes only the original reachable courtyard opponent', () => {
    const s = promoted(); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
    complete(s, 'rain-rack'); const ap = s.actionsRemaining; activity(s, { type: 'ENCOUNTER_FIGHT' });
    expect(s.actionsRemaining).toBe(ap - 1); expect(s.combat?.encounterId).toBe('CALAMITY_PRIEST_DISPUTE'); expect(hasCalamityPriestDisputeOpponent(s)).toBe(true); expect(validateCalamityPriestState(s)).toBe(true);
    const ctx = context(s); settleCalamityPriestEncounter(s, 'RETREATED', ctx.c, ctx.award);
    expect(ctx.award).not.toHaveBeenCalled(); expect(s.combat).toBeNull(); expect(s.calamityPriest.encounter.status).toBe('RETREATED'); expect(validateCalamityPriestState(s)).toBe(true);
  });
  it('awards only living effective participation once, without extra acting or healing', () => {
    const s = firstReport(), acting = s.progression.acting; activity(s, { type: 'ENCOUNTER_FIGHT' });
    s.combatHistory.push({ round: 1, stance: 'ATTACK', first: 'PLAYER', playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1, moves: [{ actor: 'PLAYER', label: '真实原地打击', selfGain: 1, enemyReduction: 0 }], playerAdvantage: 1, enemyAdvantage: 0, winChance: 60, winner: 'PLAYER', consequence: '抵抗结束', consequenceWeights: null, retreat: 'NONE' });
    const ctx = context(s), health = s.health, sp = s.spirituality; settleCalamityPriestEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award);
    expect(ctx.award).toHaveBeenCalledExactlyOnceWith('calamity-priest-dispute', 25); expect([s.progression.acting, s.health, s.spirituality]).toEqual([acting, health, sp]); expect(validateCalamityPriestState(s)).toBe(true);
    expect(() => settleCalamityPriestEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award)).toThrow();
  });
  it('preserves real death without revival or reward, and gives no award for an empty victory', () => {
    const s = firstReport(); activity(s, { type: 'ENCOUNTER_FIGHT' }); s.status = 'DEAD'; s.health = 0; const ctx = context(s);
    settleCalamityPriestEncounter(s, 'PLAYER_DEAD', ctx.c, ctx.award);
    expect([s.status, s.health, s.calamityPriest.encounter.status, s.combat]).toEqual(['DEAD', 0, 'LOST', null]); expect(ctx.award).not.toHaveBeenCalled(); expect(validateCalamityPriestState(s)).toBe(true);
    const empty = firstReport(); activity(empty, { type: 'ENCOUNTER_FIGHT' }); const other = context(empty);
    settleCalamityPriestEncounter(empty, 'ENEMY_SURRENDERED', other.c, other.award); expect(other.award).not.toHaveBeenCalled(); expect(validateCalamityPriestState(empty)).toBe(true);
  });
  it('talk respects refusal and a later voluntary result, with no free acting or mastery', () => {
    const s = firstReport(), before = structuredClone(s.progression); activity(s, { type: 'ENCOUNTER_TALK' }, 100);
    expect(s.calamityPriest.encounter.status).toBe('AVAILABLE'); rejectActivity(s, { type: 'ENCOUNTER_TALK' });
    s.week += 1; activity(s, { type: 'ENCOUNTER_TALK' }); expect(s.calamityPriest.encounter.status).toBe('RESOLVED'); expect(s.progression).toEqual(before); expect(validateCalamityPriestState(s)).toBe(true);
  });
  it('rejects malformed commands before any spending or checks', () => {
    const s = promoted();
    for (const c of [{ type: 'HANDLE_MOON', method: 'FOOD' }, { type: 'OBSERVE', caseId: 'future-spirit' }, { type: 'PREPARE', caseId: 'isolated-board', method: 'ABILITY', free: true }, { type: 'VERIFY', caseId: 'willing-focus' }, { type: 'COMPOSE' }]) {
      expect(validateCalamityPriestCommand(c)).toBe(false); rejectActivity(s, c);
    }
    rejectAcquisition(s, { type: 'CONSUME', bottleId: 'lucky-potion-1', confirmed: true });
  });
  it('rejects counterfeit practice, acting, duplicated award and original provenance', () => {
    const s = firstReport();
    const mutations: ((v: SliceState) => void)[] = [
      v => { v.calamityPriest.practice.board = 'FALLEN'; },
      v => { v.calamityPriest.practice.contact = 'FOCUSED'; },
      v => { v.progression.acting += 25; },
      v => { v.seer.completedSources.push('calamity-priest-case:rain-rack'); },
      v => { v.calamityPriest.bottles[0]!.source = 'free conjured potion'; },
      v => { (v.calamityPriest as unknown as Record<string, unknown>).luckPool = 10; },
      v => { (v.calamityPriest as unknown as Record<string, unknown>).practice = []; },
    ];
    for (const mutate of mutations) { const forged = structuredClone(s); mutate(forged); expect(validateCalamityPriestState(forged)).toBe(false); }
  });
});

describe('Calamity Priest finite original practice and actual cleanup', () => {
  it.each(CALAMITY_PRIEST_CASE_IDS)('keeps failed %s costs and contact until explicit zero-AP cleanup', id => {
    const s = promoted();
    for (const earlier of CALAMITY_PRIEST_CASE_IDS.slice(0, CALAMITY_PRIEST_CASE_IDS.indexOf(id))) complete(s, earlier, 'ORDINARY');
    begin(s, id); const ap = s.actionsRemaining, sp = s.spirituality;
    activity(s, { type: 'PERFORM', caseId: id }, 100);
    expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, sp - 3]);
    expect(s.calamityPriest.cases[id]).toMatchObject({ status: 'OBSERVED', contactOpen: true, outcome: 'NONE' });
    expect(s.calamityPriest.practice).toEqual({ hazard: id === 'rain-rack' ? 'NOTICED' : 'SECURED', board: id === 'rain-rack' ? 'RESTING' : id === 'isolated-board' ? 'UNSTABLE' : 'SECURED', contact: id === 'willing-focus' ? 'FOCUSED' : 'NONE' });
    expect(validateCalamityPriestState(s)).toBe(true); expect(calamityPriestInside(s)).toBe(true);
    rejectActivity(s, { type: 'REPORT', caseId: id }); rejectActivity(s, { type: 'WITHDRAW', caseId: id }); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; s.health = 1;
    activity(s, { type: 'CLOSE', caseId: id });
    expect([s.actionsRemaining, s.spirituality, s.health, s.mind]).toEqual([0, 0, 1, 0]);
    expect(s.calamityPriest.practice).toEqual({ hazard: 'SECURED', board: id === 'rain-rack' ? 'RESTING' : 'SECURED', contact: id === 'willing-focus' ? 'RELEASED' : 'NONE' });
    expect(validateCalamityPriestState(s)).toBe(true); expect(calamityPriestInside(s)).toBe(false);
    s.actionsRemaining = 10; s.mind = 50;
    rejectActivity(s, { type: 'PREPARE', caseId: id, method: 'ORDINARY' });
    s.week += 1; activity(s, { type: 'PREPARE', caseId: id, method: 'ORDINARY' });
    activity(s, { type: 'PERFORM', caseId: id }); activity(s, { type: 'CLOSE', caseId: id }); activity(s, { type: 'REPORT', caseId: id });
    expect(s.calamityPriest.cases[id]!.closes).toBe(2); expect(validateCalamityPriestState(s)).toBe(true);
  });
  it('checks actual original rain damage and closes by moving the original box and fixing supports', () => {
    const s = promoted(); begin(s, 'rain-rack'); const ctx = activity(s, { type: 'PERFORM', caseId: 'rain-rack' });
    expect(s.calamityPriest.practice.hazard).toBe('NOTICED');
    const notes = JSON.stringify(vi.mocked(ctx.c.note).mock.calls);
    expect(notes).toContain('实际看清原雨痕'); expect(notes).toContain('不能由预感直接宣布全部未来');
    rejectActivity(s, { type: 'REPORT', caseId: 'rain-rack' });
    const closed = activity(s, { type: 'CLOSE', caseId: 'rain-rack' });
    expect(closed.c.note).toHaveBeenCalledWith('实际结束本次接触', expect.stringContaining('同一原箱实际移到原干燥低位'));
    expect(s.calamityPriest.practice.hazard).toBe('SECURED'); activity(s, { type: 'REPORT', caseId: 'rain-rack' });
    expect(validateCalamityPriestState(s)).toBe(true);
  });
  it('does not reset an already repaired rain support after a failed check and actual cleanup', () => {
    const s = promoted(); begin(s, 'rain-rack'); activity(s, { type: 'PERFORM', caseId: 'rain-rack' }, 100); activity(s, { type: 'CLOSE', caseId: 'rain-rack' });
    expect(s.calamityPriest.practice.hazard).toBe('SECURED'); s.week += 1;
    activity(s, { type: 'PREPARE', caseId: 'rain-rack', method: 'ABILITY' }); activity(s, { type: 'PERFORM', caseId: 'rain-rack' });
    expect(s.calamityPriest.practice.hazard).toBe('SECURED'); expect(validateCalamityPriestState(s)).toBe(true);
  });
  it('really resets the same clamped board at preparation and releases it only at paid PERFORM', () => {
    const s = firstReport(); const town = structuredClone(s.town); begin(s, 'isolated-board');
    expect(s.calamityPriest.practice.board).toBe('RESTING'); expect(calamityPriestInside(s)).toBe(false); expect(validateCalamityPriestState(s)).toBe(true);
    const sp = s.spirituality; const done = activity(s, { type: 'PERFORM', caseId: 'isolated-board' });
    expect([s.spirituality, s.calamityPriest.practice.board]).toEqual([sp - 3, 'FALLEN']);
    expect(JSON.stringify(vi.mocked(done.c.note).mock.calls)).toContain('原夹具实际松开');
    expect(JSON.stringify(vi.mocked(done.c.note).mock.calls)).toContain('实际落入原接物盘一次');
    expect(calamityPriestCases(s)[1]!.result).toContain('接触仍在'); rejectActivity(s, { type: 'PERFORM', caseId: 'isolated-board' });
    activity(s, { type: 'CLOSE', caseId: 'isolated-board' });
    expect(s.calamityPriest.practice.board).toBe('SECURED'); expect(s.town).toEqual(town);
    activity(s, { type: 'REPORT', caseId: 'isolated-board' }); expect(validateCalamityPriestState(s)).toBe(true);
  });
  it('physically secures the original board on withdrawal without free cost or extra stock', () => {
    const s = firstReport(); begin(s, 'isolated-board'); const ap = s.actionsRemaining, sp = s.spirituality, town = structuredClone(s.town);
    const done = activity(s, { type: 'WITHDRAW', caseId: 'isolated-board' });
    expect([s.actionsRemaining, s.spirituality]).toEqual([ap, sp]); expect(s.town).toEqual(town);
    expect(s.calamityPriest.practice.board).toBe('SECURED');
    expect(s.calamityPriest.cases['isolated-board']).toMatchObject({ status: 'OBSERVED', method: null, withdrawals: 1, closes: 0 });
    expect(JSON.stringify(vi.mocked(done.c.note).mock.calls)).toContain('实际卸下本次支好的原板');
    expect(validateCalamityPriestState(s)).toBe(true);
    activity(s, { type: 'PREPARE', caseId: 'isolated-board', method: 'ORDINARY' });
    expect(s.calamityPriest.practice.board).toBe('RESTING'); expect(validateCalamityPriestState(s)).toBe(true);
  });
  it('checks adult consent and ends mental storm by stopping and waiting for its short actual effect', () => {
    const s = firstReport(); complete(s, 'isolated-board'); begin(s, 'willing-focus');
    const done = activity(s, { type: 'PERFORM', caseId: 'willing-focus' });
    expect(s.calamityPriest.practice.contact).toBe('FOCUSED');
    const notes = JSON.stringify(vi.mocked(done.c.note).mock.calls);
    expect(notes).toContain('当前明确自愿的成年佩林'); expect(notes).toContain('没有被强迫作答或改写意愿');
    rejectActivity(s, { type: 'REPORT', caseId: 'willing-focus' });
    const closed = activity(s, { type: 'CLOSE', caseId: 'willing-focus' });
    expect(closed.c.note).toHaveBeenCalledWith('实际结束本次接触', expect.stringContaining('等候这段短暂眩晕或混乱实际过去'));
    expect(s.calamityPriest.practice.contact).toBe('RELEASED'); activity(s, { type: 'REPORT', caseId: 'willing-focus' });
    expect(s.calamityPriest.cases['willing-focus']!.outcome).toBe('FOCUS_RECORDED'); expect(validateCalamityPriestState(s)).toBe(true);
  });
  it('offers a genuinely ordinary zero-spirituality route to three reports and peaceful100', () => {
    const s = promoted(); s.spirituality = 0; const ap = s.actionsRemaining;
    for (const id of CALAMITY_PRIEST_CASE_IDS) complete(s, id, 'ORDINARY'); activity(s, { type: 'REFLECT' });
    expect([s.actionsRemaining, s.spirituality, s.progression.acting]).toEqual([ap - 13, 0, 100]);
    expect(s.calamityPriest.practice).toEqual({ hazard: 'SECURED', board: 'SECURED', contact: 'NONE' });
    expect(calamityPriestCases(s).every(r => r.result!.includes('普通方法'))).toBe(true);
    expect(validateCalamityPriestState(s)).toBe(true); rejectActivity(s, { type: 'REFLECT' });
  });
  it('permits later ability preparation after an ordinary failed focus test without forging past mental effects', () => {
    const s = firstReport(); complete(s, 'isolated-board', 'ORDINARY'); begin(s, 'willing-focus', 'ORDINARY');
    activity(s, { type: 'PERFORM', caseId: 'willing-focus' }, 100); activity(s, { type: 'CLOSE', caseId: 'willing-focus' });
    expect(s.calamityPriest.practice.contact).toBe('NONE'); s.week += 1;
    activity(s, { type: 'PREPARE', caseId: 'willing-focus', method: 'ABILITY' }); expect(validateCalamityPriestState(s)).toBe(true);
    activity(s, { type: 'PERFORM', caseId: 'willing-focus' }); expect(s.calamityPriest.practice.contact).toBe('FOCUSED'); expect(validateCalamityPriestState(s)).toBe(true);
  });
  it('validates an exact source-bound practice shape and does not add a luck pool or threat oracle', () => {
    const s = promoted(); expect(validateCalamityPriestLife(s)).toBe(true);
    expect(calamityPriestActions(s).some(a => a.command.type === 'OBSERVE' && a.enabled)).toBe(true);
    for (const mutate of [
      (v: SliceState) => { v.calamityPriest.practice.hazard = 'SECURED'; },
      (v: SliceState) => { v.calamityPriest.practice.contact = 'RELEASED'; },
      (v: SliceState) => { v.calamityPriest.practice.board = 'UNSTABLE'; },
      (v: SliceState) => { (v.calamityPriest as unknown as Record<string, unknown>).threat = { known: true }; },
    ]) { const forged = structuredClone(s); mutate(forged); expect(validateCalamityPriestState(forged)).toBe(false); }
  });
});
