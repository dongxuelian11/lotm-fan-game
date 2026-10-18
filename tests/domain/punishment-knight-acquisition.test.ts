import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { ARBITER_ABILITY_IDS } from '../../src/domain/arbiter/types.js';
import { SHERIFF_ABILITY_IDS } from '../../src/domain/sheriff/types.js';
import { INTERROGATOR_ABILITY_IDS } from '../../src/domain/interrogator/types.js';
import { JUDGE_ABILITY_IDS } from '../../src/domain/judge/types.js';
import { JUDGE_GUIDE } from '../../src/domain/judge/content.js';
import { applyPunishmentKnightCommand, createPunishmentKnightState, freshPunishmentKnightPractice, isPunishmentKnightAcquisitionCommand, projectPunishmentKnight, validatePunishmentKnightCommand, validatePunishmentKnightState } from '../../src/domain/punishment-knight/index.js';
import { PUNISHMENT_KNIGHT_ABILITIES, PUNISHMENT_KNIGHT_FORMULA_STATUS, PUNISHMENT_KNIGHT_GUIDE, PUNISHMENT_KNIGHT_PRICES, PUNISHMENT_KNIGHT_SOURCE_STATUS } from '../../src/domain/punishment-knight/content.js';
import { PUNISHMENT_KNIGHT_ABILITY_IDS, PUNISHMENT_KNIGHT_CASE_IDS, type PunishmentKnightAcquisitionCommand } from '../../src/domain/punishment-knight/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function judge(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/judge-v0930/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.punishmentKnight = createPunishmentKnightState(); s.week = Math.max(s.week, s.judge.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 26;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: PunishmentKnightAcquisitionCommand, roll = 1) {
  const c = context(s, roll); applyPunishmentKnightCommand(s, command, c); return c;
}
function taught(s = judge()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const b = s.punishmentKnight.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() {
  const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.punishmentKnight.bottles[0]!.id, confirmed: true }); return s;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyPunishmentKnightCommand(s, command as PunishmentKnightAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Punishment Knight S5 original bottles and finite acquisition', () => {
  it('hides the future channel and creates separate originals without pending effects', () => {
    const s = createSliceRun('punishment-knight-hidden', sliceDefaultCreationSelection, 'punishment-knight-hidden');
    expect(validatePunishmentKnightState(s)).toBe(true);
    expect(projectPunishmentKnight(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', practice: { pad: 'STAND', partner: 'FREE', rule: 'NONE', note: 'BLANK' } });
    expect(projectPunishmentKnight(s).story).toBeUndefined();
    const other = createPunishmentKnightState(); other.practice.pad = 'MAT'; other.bottles[0]!.labourSteps = 5; other.encounter.status = 'LOST';
    expect(s.punishmentKnight.practice).toEqual({ pad: 'STAND', partner: 'FREE', rule: 'NONE', note: 'BLANK' });
    expect(s.punishmentKnight.bottles[0]!.labourSteps).toBe(0);
    expect(s.punishmentKnight.encounter).toEqual({ status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null });
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('keeps the original Vina channel and charges 460 plus one action without inventing a formula or rite', () => {
    const s = judge(), old = structuredClone([s.arbiter, s.sheriff, s.interrogator, s.judge]);
    expect(validatePunishmentKnightState(s)).toBe(true);
    const c = act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([29540, 99]); expect(c.check).not.toHaveBeenCalled();
    expect([s.arbiter, s.sheriff, s.interrogator, s.judge]).toEqual(old);
    expect(PUNISHMENT_KNIGHT_GUIDE).toBe(JUDGE_GUIDE);
    expect(PUNISHMENT_KNIGHT_PRICES).toEqual({ guidance: 460, potion: 4800, labourCredit: 4200 });
    expect(projectPunishmentKnight(s)).toMatchObject({ formulaKnown: false, formula: [], discovered: true });
    expect(PUNISHMENT_KNIGHT_FORMULA_STATUS).toContain('细节尚未核实');
    expect(PUNISHMENT_KNIGHT_FORMULA_STATUS).toContain('不能据未知细节断言无需仪式');
    expect(c.note).toHaveBeenCalledWith('听取惩戒骑士用药说明', expect.stringContaining('实际核对原瓶、准备原调解处安静场地'));
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five actual labour actions and 600 payment for just the selected bottle', () => {
    const s = taught(), b = s.punishmentKnight.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([28940, 94, 'PLAYER']);
    const second = s.punishmentKnight.bottles[1]!; expect(second.labourSteps).toBe(0);
    act(s, { type: 'POTION_WORK', bottleId: second.id }); const cash = s.cash; buy(s, 1);
    expect(cash - s.cash).toBe(4800); expect(validatePunishmentKnightState(s)).toBe(true);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); reject(s, { type: 'POTION_WORK', bottleId: b.id });
    s.cash = 4799; reject(s, { type: 'BUY_POTION', bottleId: s.punishmentKnight.bottles[2]!.id });
  });
  it('allows early preparation but requires judge digestion100 and twelve complete weeks to drink', () => {
    const s = judge(); s.week = s.judge.promotionWeek!; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validatePunishmentKnightState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week += 11; s.progression.acting = 100;
    expect(projectPunishmentKnight(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week++; s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(s.progression.sequence).toBe(5);
  });
  it('consumes the selected original and applies all four risk tiers through will26', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 95, 100, 0, 5], [30, 'SUCCESS', 90, 100, 0, 5], [85, 'FAILURE', 80, 90, 25, 6], [100, 'GREAT_FAILURE', 60, 80, 50, 6]] as const;
    for (const [roll, tier, mind, health, pollution, sequence] of tiers) {
      const s = prepared(), old = { ...s.progression.mastery }, b = s.punishmentKnight.bottles[0]!;
      const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 26);
      expect(c.note).toHaveBeenCalledWith('导师完成本次惩戒骑士服药准备', expect.stringContaining(b.id));
      expect([b.status, b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, pollution, sequence, 'ACTIVE']);
      for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
      expect(s.punishmentKnight.bottles.slice(1).every(x => x.status === 'SUPPLIER')).toBe(true);
      if (sequence === 6) expect(s.progression.acting).toBe(100);
      expect(validatePunishmentKnightState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('keeps the health20 and mind40 boundaries atomic without a roll or consumption', () => {
    for (const [health, mind] of [[20, 100], [100, 40], [1, 1]]) {
      const s = prepared(); s.health = health!; s.mind = mind!;
      reject(s, { type: 'CONSUME', bottleId: s.punishmentKnight.bottles[0]!.id, confirmed: true });
      expect(s.punishmentKnight.bottles[0]!.status).toBe('PLAYER');
      expect(projectPunishmentKnight(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('先休养');
    }
  });
  it('preserves every lower original, risk fact, mastery, practice and resolved enemy record on promotion', () => {
    const s = prepared(), old = structuredClone([s.arbiter, s.sheriff, s.interrogator, s.judge, s.combatHistory]), stats = { ...s.character.coreStats };
    act(s, { type: 'CONSUME', bottleId: s.punishmentKnight.bottles[0]!.id, confirmed: true });
    expect([s.arbiter, s.sheriff, s.interrogator, s.judge, s.combatHistory]).toEqual(old);
    expect(s.punishmentKnight.judgeActingAtPromotion).toBe(100); expect(s.judge.encounter.status).toBe('RESOLVED');
    expect(Object.keys(s.progression.mastery)).toEqual([...ARBITER_ABILITY_IDS, ...SHERIFF_ABILITY_IDS, ...INTERROGATOR_ABILITY_IDS, ...JUDGE_ABILITY_IDS, ...PUNISHMENT_KNIGHT_ABILITY_IDS]);
    expect(PUNISHMENT_KNIGHT_ABILITY_IDS).toEqual(['justiciar.s5.punishment', 'justiciar.s5.confinement', 'justiciar.s5.wound-verdict']);
    for (const id of PUNISHMENT_KNIGHT_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    expect(s.punishmentKnight.practice).toEqual(freshPunishmentKnightPractice());
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]);
    expect(projectPunishmentKnight(s).digestion).toContain('惩戒骑士扮演0/100'); expect(validatePunishmentKnightState(s)).toBe(true);
  });
  it('retains failed originals and waits a real week for a separately purchased finite batch', () => {
    const s = taught(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let n = 0; n < 3; n++) { const b = buy(s, n); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.punishmentKnight.bottles), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.punishmentKnight.bottles.slice(0, 3)).toEqual(originals); expect(s.punishmentKnight.bottles).toHaveLength(6);
    expect(s.punishmentKnight.bottles[3]).toMatchObject({ id: 'punishment-knight-potion-4', status: 'SUPPLIER', acquiredWeek: null, labourSteps: 0 });
    expect(projectPunishmentKnight(s).actions.find(a => a.id === 'buy-punishment-knight-potion-4')!.cost).toContain('4800便士');
    expect(validatePunishmentKnightState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('uses zero actions for purchase and separately confirmed consumption at the last-action boundary', () => {
    const s = taught(); s.actionsRemaining = 0;
    const first = structuredClone(s.punishmentKnight.bottles[0]), second = buy(s, 1);
    act(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
    expect(s.actionsRemaining).toBe(0); expect(s.punishmentKnight.bottles[0]).toEqual(first);
    expect(second).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_SUCCESS' }); expect(validatePunishmentKnightState(s)).toBe(true);
    reject(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'BUY_POTION', bottleId: s.punishmentKnight.bottles[2]!.id });
  });
  it('keeps costs, events, location and ended-run boundaries atomic', () => {
    const withoutAction = judge(); withoutAction.actionsRemaining = 0; reject(withoutAction, { type: 'LEARN_GUIDANCE' });
    const withoutCash = judge(); withoutCash.cash = 459; reject(withoutCash, { type: 'LEARN_GUIDANCE' });
    const dead = prepared(); dead.status = 'DEAD'; reject(dead, { type: 'CONSUME', bottleId: dead.punishmentKnight.bottles[0]!.id, confirmed: true });
    const elsewhere = taught(); elsewhere.world.city = 'ELSEWHERE'; reject(elsewhere, { type: 'BUY_POTION', bottleId: elsewhere.punishmentKnight.bottles[0]!.id });
    const blocked = taught(); blocked.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
    reject(blocked, { type: 'POTION_WORK', bottleId: blocked.punishmentKnight.bottles[0]!.id });
  });
  it('rejects forged sources, snapshots, future mastery and malformed nested records without throwing', () => {
    const s = promoted();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.punishmentKnight.bottles[0]!.source = 'invented'; },
      t => { t.punishmentKnight.bottles[0]!.consumedWeek = t.punishmentKnight.promotionWeek! - 1; },
      t => { t.punishmentKnight.judgeActingAtPromotion = 99; },
      t => { delete t.progression.mastery[ARBITER_ABILITY_IDS[0]]; },
      t => { t.progression.mastery['justiciar.s4.deprivation'] = 0; },
      t => { t.punishmentKnight.bottles[1]!.labourSteps = 6; },
      t => { (t.punishmentKnight as unknown as Record<string, unknown>).practice = null; },
      t => { t.punishmentKnight.practice.pad = 'MAT'; },
      t => { t.punishmentKnight.practice.partner = 'HELD'; },
      t => { t.punishmentKnight.practice.note = 'WRITTEN'; },
      t => { (t.punishmentKnight.encounter as unknown as Record<string, unknown>).prohibitionPending = true; },
      t => { (t.punishmentKnight.practice as unknown as Record<string, unknown>).inventedObject = 'forged'; },
      t => { (t.punishmentKnight.cases as unknown as Record<string, unknown>)['breach-and-pad'] = null; },
      t => { (t.punishmentKnight as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) {
      const t = structuredClone(s); change(t); expect(() => validatePunishmentKnightState(t)).not.toThrow(); expect(validatePunishmentKnightState(t)).toBe(false);
    }
  });
  it('projects three detached new masteries and the same finite practice state', () => {
    const s = promoted(), p = projectPunishmentKnight(s), before = structuredClone(s);
    expect(p.practice).toEqual(freshPunishmentKnightPractice()); expect(p.abilities.map(x => x.id)).toEqual([...PUNISHMENT_KNIGHT_ABILITY_IDS]);
    p.practice.pad = 'MAT';
    expect(p).toMatchObject({ promoted: true, formulaKnown: false, formula: [], insideCase: false, cases: [] });
    expect(p.actions.every(a => !a.enabled)).toBe(true);
    p.abilities[0]!.mastery = 99; p.bottles[0]!.source = 'changed public copy';
    expect(s).toEqual(before);
  });
  it('accepts only actual finite commands and keeps the written account ordinary', () => {
    for (const caseId of PUNISHMENT_KNIGHT_CASE_IDS) {
      for (const type of ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW']) {
        expect(validatePunishmentKnightCommand({ type, caseId })).toBe(true); expect(isPunishmentKnightAcquisitionCommand({ type, caseId })).toBe(false);
        expect(validatePunishmentKnightCommand({ type, caseId, target: 'invented' })).toBe(false);
      }
      expect(validatePunishmentKnightCommand({ type: 'PREPARE', caseId, method: 'ORDINARY' })).toBe(true);
      expect(validatePunishmentKnightCommand({ type: 'PREPARE', caseId, method: 'ABILITY' })).toBe(caseId !== 'wound-record');
    }
    for (const type of ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'REFLECT']) {
      expect(validatePunishmentKnightCommand({ type })).toBe(true); expect(isPunishmentKnightAcquisitionCommand({ type })).toBe(false);
    }
    for (const command of [null, {}, { type: 'BREW' }, { type: 'CONSUME', bottleId: 'punishment-knight-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'judge-potion-1' }, { type: 'REWRITE_WORLD' }, { type: 'MAGNIFY' }, { type: 'TELEPORT' }, { type: 'REFLECT', extra: true }, { type: 'PERFORM', caseId: 'breach-and-pad', free: true }]) {
      expect(validatePunishmentKnightCommand(command)).toBe(false); expect(isPunishmentKnightAcquisitionCommand(command)).toBe(false); reject(prepared(), command);
    }
  });
  it('bounds all three effects and keeps the complete recipe and ritual unknown', () => {
    expect(PUNISHMENT_KNIGHT_ABILITIES).toHaveLength(3);
    expect(PUNISHMENT_KNIGHT_SOURCE_STATUS).toContain('目标仍实际飞行');
    expect(PUNISHMENT_KNIGHT_SOURCE_STATUS).toContain('实际肩伤');
    expect(PUNISHMENT_KNIGHT_SOURCE_STATUS).toContain('不支持无伤目标一句话必杀');
    expect(PUNISHMENT_KNIGHT_SOURCE_STATUS).toContain('序列4能力剥夺');
    expect(PUNISHMENT_KNIGHT_SOURCE_STATUS).toContain('非法律宣告');
    expect(PUNISHMENT_KNIGHT_SOURCE_STATUS).toContain('不获得官方身份或组织归属');
    expect(PUNISHMENT_KNIGHT_FORMULA_STATUS).toContain('不冒充已还原原著仪式');
    expect(PUNISHMENT_KNIGHT_ABILITIES[2]!.description).toContain('不伪奖能力掌握');
    const wrongPath = judge(); wrongPath.progression.pathwayId = 'chained';
    expect(projectPunishmentKnight(wrongPath).discovered).toBe(false); reject(wrongPath, { type: 'LEARN_GUIDANCE' });
  });
  it('blocks acquisition while current originals or lower-sequence contacts remain unsettled', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.punishmentKnight.cases['breach-and-pad']!.contactOpen = true; },
      s => { s.punishmentKnight.practice.pad = 'MAT'; },
      s => { s.punishmentKnight.practice.partner = 'HELD'; },
      s => { s.punishmentKnight.practice.rule = 'DECLARED'; },
      s => { s.punishmentKnight.practice.rule = 'BREACHED'; },
      s => { s.punishmentKnight.practice.note = 'WRITTEN'; },
      s => { s.judge.cases['calm-room']!.contactOpen = true; },
      s => { s.judge.practice.audience = 'ATTENTIVE'; },
      s => { s.judge.practice.boundary = 'HELD'; },
      s => { s.judge.practice.token = 'OUTSIDE_TABLE'; },
      s => { Object.values(s.interrogator.cases)[0]!.contactOpen = true; },
      s => { Object.values(s.sheriff.cases)[0]!.contactOpen = true; },
      s => { Object.values(s.arbiter.cases)[0]!.contactOpen = true; },
    ];
    for (const mutate of mutations) {
      const s = prepared(); mutate(s); reject(s, { type: 'CONSUME', bottleId: s.punishmentKnight.bottles[0]!.id, confirmed: true });
      expect(projectPunishmentKnight(s).insideCase).toBe(true);
    }
  });
  it('rejects forged resupply, duplicate originals and a claimed complete formula', () => {
    const s = taught();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.punishmentKnight.resupply.requestedWeek = t.week; },
      t => { t.punishmentKnight.resupply.deliveries = 1; },
      t => { t.punishmentKnight.bottles[1]!.id = t.punishmentKnight.bottles[0]!.id; },
      t => { t.punishmentKnight.bottles[1]!.source = t.judge.bottles[0]!.id; },
      t => { (t.punishmentKnight as unknown as Record<string, unknown>).formulaKnown = true; },
      t => { t.judge.guidanceKnown = false; },
    ];
    for (const change of changes) {
      const t = structuredClone(s); change(t); expect(() => validatePunishmentKnightState(t)).not.toThrow(); expect(validatePunishmentKnightState(t)).toBe(false);
    }
    for (const command of [{ type: 'LEARN_FORMULA' }, { type: 'BUY_MATERIALS', batchId: 'punishment-knight-batch-1' }, { type: 'BREW', batchId: 'punishment-knight-batch-1' }]) reject(s, command);
  });
  it('keeps unused purchased originals and caps base stats without filling spirituality', () => {
    const s = taught(); const first = buy(s), second = buy(s, 1);
    s.character.coreStats.physique = 500; s.character.coreStats.knowledge = 499;
    act(s, { type: 'CONSUME', bottleId: first.id, confirmed: true });
    expect(second.status).toBe('PLAYER'); expect(second.consumedWeek).toBeNull();
    expect(s.character.coreStats.physique).toBe(500); expect(s.character.coreStats.knowledge).toBe(500);
    expect(s.spirituality).toBe(31); expect(validatePunishmentKnightState(s)).toBe(true);
    reject(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
  });
  it('preserves the actual old natural record through migration before any new action', () => {
    const previous = JSON.parse(readFileSync('tests/fixtures/judge-v0930/natural.json', 'utf8')).final;
    const s = migrateSliceState(previous);
    for (const key of ['arbiter', 'sheriff', 'interrogator', 'judge', 'combatHistory', 'progression'] as const) expect(s[key]).toEqual(previous[key]);
    expect(s.punishmentKnight).toEqual(createPunishmentKnightState()); expect(validatePunishmentKnightState(s)).toBe(true);
  });
});
