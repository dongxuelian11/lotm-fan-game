import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { LAWYER_ABILITY_IDS } from '../../src/domain/lawyer/types.js';
import { BARBARIAN_ABILITY_IDS } from '../../src/domain/barbarian/types.js';
import { BRIBER_ABILITY_IDS } from '../../src/domain/briber/types.js';
import { CORRUPTION_BARON_ABILITY_IDS } from '../../src/domain/corruption-baron/types.js';
import { CORRUPTION_BARON_GUIDE } from '../../src/domain/corruption-baron/content.js';
import { applyMentorDisorderCommand, createMentorDisorderState, freshMentorDisorderPractice, isMentorDisorderAcquisitionCommand, projectMentorDisorder, validateMentorDisorderCommand, validateMentorDisorderState } from '../../src/domain/mentor-disorder/index.js';
import { MENTOR_DISORDER_ABILITIES, MENTOR_DISORDER_FORMULA_STATUS, MENTOR_DISORDER_GUIDE, MENTOR_DISORDER_PRICES, MENTOR_DISORDER_SOURCE_STATUS } from '../../src/domain/mentor-disorder/content.js';
import { MENTOR_DISORDER_ABILITY_IDS, MENTOR_DISORDER_CASE_IDS, type MentorDisorderAcquisitionCommand } from '../../src/domain/mentor-disorder/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function corruptionBaron(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/corruption-baron-v0920/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.mentorDisorder = createMentorDisorderState(); s.week = Math.max(s.week, s.corruptionBaron.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 26;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: MentorDisorderAcquisitionCommand, roll = 1) {
  const c = context(s, roll); applyMentorDisorderCommand(s, command, c); return c;
}
function taught(s = corruptionBaron()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const b = s.mentorDisorder.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() {
  const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.mentorDisorder.bottles[0]!.id, confirmed: true }); return s;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyMentorDisorderCommand(s, command as MentorDisorderAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Mentor of Disorder S5 original bottles and finite acquisition', () => {
  it('hides the future channel and creates separate originals without pending effects', () => {
    const s = createSliceRun('mentor-disorder-hidden', sliceDefaultCreationSelection, 'mentor-disorder-hidden');
    expect(validateMentorDisorderState(s)).toBe(true);
    expect(projectMentorDisorder(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', practice: { markers: 'SORTED', route: 'READY', note: 'BLANK' }, gifts: { held: 0, given: 0, summary: '' } });
    expect(projectMentorDisorder(s).story).toBeUndefined();
    const other = createMentorDisorderState(); other.practice.markers = 'MIXED'; other.bottles[0]!.labourSteps = 5; other.encounter.status = 'LOST';
    expect(s.mentorDisorder.practice).toEqual({ markers: 'SORTED', route: 'READY', note: 'BLANK' });
    expect(s.mentorDisorder.bottles[0]!.labourSteps).toBe(0);
    expect(s.mentorDisorder.encounter).toEqual({ status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null });
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('keeps the original Mireille channel and charges 460 plus one action without inventing a formula or rite', () => {
    const s = corruptionBaron(), old = structuredClone([s.lawyer, s.barbarian, s.briber, s.corruptionBaron]);
    expect(validateMentorDisorderState(s)).toBe(true);
    const c = act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([29540, 99]); expect(c.check).not.toHaveBeenCalled();
    expect([s.lawyer, s.barbarian, s.briber, s.corruptionBaron]).toEqual(old);
    expect(MENTOR_DISORDER_GUIDE).toBe(CORRUPTION_BARON_GUIDE);
    expect(MENTOR_DISORDER_PRICES).toEqual({ guidance: 460, potion: 4800, labourCredit: 4200 });
    expect(projectMentorDisorder(s)).toMatchObject({ formulaKnown: false, formula: [], discovered: true });
    expect(MENTOR_DISORDER_FORMULA_STATUS).toContain('细节尚未核实');
    expect(MENTOR_DISORDER_FORMULA_STATUS).toContain('不能据未知细节断言无需仪式');
    expect(c.note).toHaveBeenCalledWith('听取混乱导师用药说明', expect.stringContaining('实际核对原瓶、准备原契约铺安静场地'));
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five actual labour actions and 600 payment for just the selected bottle', () => {
    const s = taught(), b = s.mentorDisorder.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([28940, 94, 'PLAYER']);
    const second = s.mentorDisorder.bottles[1]!; expect(second.labourSteps).toBe(0);
    act(s, { type: 'POTION_WORK', bottleId: second.id }); const cash = s.cash; buy(s, 1);
    expect(cash - s.cash).toBe(4800); expect(validateMentorDisorderState(s)).toBe(true);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); reject(s, { type: 'POTION_WORK', bottleId: b.id });
    s.cash = 4799; reject(s, { type: 'BUY_POTION', bottleId: s.mentorDisorder.bottles[2]!.id });
  });
  it('allows early preparation but requires corruptionBaron digestion100 and twelve complete weeks to drink', () => {
    const s = corruptionBaron(); s.week = s.corruptionBaron.promotionWeek!; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validateMentorDisorderState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week += 11; s.progression.acting = 100;
    expect(projectMentorDisorder(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week++; s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(s.progression.sequence).toBe(5);
  });
  it('consumes the selected original and applies all four risk tiers through will26', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 95, 100, 0, 5], [30, 'SUCCESS', 90, 100, 0, 5], [85, 'FAILURE', 80, 90, 25, 6], [100, 'GREAT_FAILURE', 60, 80, 50, 6]] as const;
    for (const [roll, tier, mind, health, pollution, sequence] of tiers) {
      const s = prepared(), old = { ...s.progression.mastery }, b = s.mentorDisorder.bottles[0]!;
      const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 26);
      expect(c.note).toHaveBeenCalledWith('导师完成本次混乱导师服药准备', expect.stringContaining(b.id));
      expect([b.status, b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, pollution, sequence, 'ACTIVE']);
      for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
      expect(s.mentorDisorder.bottles.slice(1).every(x => x.status === 'SUPPLIER')).toBe(true);
      if (sequence === 6) expect(s.progression.acting).toBe(100);
      expect(validateMentorDisorderState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('keeps the health20 and mind40 boundaries atomic without a roll or consumption', () => {
    for (const [health, mind] of [[20, 100], [100, 40], [1, 1]]) {
      const s = prepared(); s.health = health!; s.mind = mind!;
      reject(s, { type: 'CONSUME', bottleId: s.mentorDisorder.bottles[0]!.id, confirmed: true });
      expect(s.mentorDisorder.bottles[0]!.status).toBe('PLAYER');
      expect(projectMentorDisorder(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('先休养');
    }
  });
  it('preserves every lower original, risk fact, mastery, practice and resolved enemy record on promotion', () => {
    const s = prepared(), old = structuredClone([s.lawyer, s.barbarian, s.briber, s.corruptionBaron, s.combatHistory]), stats = { ...s.character.coreStats };
    act(s, { type: 'CONSUME', bottleId: s.mentorDisorder.bottles[0]!.id, confirmed: true });
    expect([s.lawyer, s.barbarian, s.briber, s.corruptionBaron, s.combatHistory]).toEqual(old);
    expect(s.mentorDisorder.corruptionBaronActingAtPromotion).toBe(100); expect(s.corruptionBaron.encounter.status).toBe('RESOLVED');
    expect(Object.keys(s.progression.mastery)).toEqual([...LAWYER_ABILITY_IDS, ...BARBARIAN_ABILITY_IDS, ...BRIBER_ABILITY_IDS, ...CORRUPTION_BARON_ABILITY_IDS, ...MENTOR_DISORDER_ABILITY_IDS]);
    expect(MENTOR_DISORDER_ABILITY_IDS).toEqual(['black-emperor.s5.disorder']);
    for (const id of MENTOR_DISORDER_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    expect(s.mentorDisorder.practice).toEqual(freshMentorDisorderPractice());
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]);
    expect(projectMentorDisorder(s).digestion).toContain('混乱导师扮演0/100'); expect(validateMentorDisorderState(s)).toBe(true);
  });
  it('retains failed originals and waits a real week for a separately purchased finite batch', () => {
    const s = taught(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let n = 0; n < 3; n++) { const b = buy(s, n); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.mentorDisorder.bottles), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.mentorDisorder.bottles.slice(0, 3)).toEqual(originals); expect(s.mentorDisorder.bottles).toHaveLength(6);
    expect(s.mentorDisorder.bottles[3]).toMatchObject({ id: 'mentor-disorder-potion-4', status: 'SUPPLIER', acquiredWeek: null, labourSteps: 0 });
    expect(projectMentorDisorder(s).actions.find(a => a.id === 'buy-mentor-disorder-potion-4')!.cost).toContain('4800便士');
    expect(validateMentorDisorderState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('uses zero actions for purchase and separately confirmed consumption at the last-action boundary', () => {
    const s = taught(); s.actionsRemaining = 0;
    const first = structuredClone(s.mentorDisorder.bottles[0]), second = buy(s, 1);
    act(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
    expect(s.actionsRemaining).toBe(0); expect(s.mentorDisorder.bottles[0]).toEqual(first);
    expect(second).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_SUCCESS' }); expect(validateMentorDisorderState(s)).toBe(true);
    reject(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'BUY_POTION', bottleId: s.mentorDisorder.bottles[2]!.id });
  });
  it('keeps costs, events, location and ended-run boundaries atomic', () => {
    const withoutAction = corruptionBaron(); withoutAction.actionsRemaining = 0; reject(withoutAction, { type: 'LEARN_GUIDANCE' });
    const withoutCash = corruptionBaron(); withoutCash.cash = 459; reject(withoutCash, { type: 'LEARN_GUIDANCE' });
    const dead = prepared(); dead.status = 'DEAD'; reject(dead, { type: 'CONSUME', bottleId: dead.mentorDisorder.bottles[0]!.id, confirmed: true });
    const elsewhere = taught(); elsewhere.world.city = 'ELSEWHERE'; reject(elsewhere, { type: 'BUY_POTION', bottleId: elsewhere.mentorDisorder.bottles[0]!.id });
    const blocked = taught(); blocked.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
    reject(blocked, { type: 'POTION_WORK', bottleId: blocked.mentorDisorder.bottles[0]!.id });
  });
  it('rejects forged sources, snapshots, future mastery and malformed nested records without throwing', () => {
    const s = promoted();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.mentorDisorder.bottles[0]!.source = 'invented'; },
      t => { t.mentorDisorder.bottles[0]!.consumedWeek = t.mentorDisorder.promotionWeek! - 1; },
      t => { t.mentorDisorder.corruptionBaronActingAtPromotion = 99; },
      t => { delete t.progression.mastery[LAWYER_ABILITY_IDS[0]]; },
      t => { t.progression.mastery['black-emperor.s4.magnify'] = 0; },
      t => { t.mentorDisorder.bottles[1]!.labourSteps = 6; },
      t => { (t.mentorDisorder as unknown as Record<string, unknown>).practice = null; },
      t => { t.mentorDisorder.practice.markers = 'MIXED'; },
      t => { t.mentorDisorder.practice.route = 'MARKED'; },
      t => { t.mentorDisorder.practice.note = 'WRITTEN'; },
      t => { (t.mentorDisorder.encounter as unknown as Record<string, unknown>).pendingDisorder = true; },
      t => { (t.mentorDisorder.practice as unknown as Record<string, unknown>).inventedObject = 'forged'; },
      t => { (t.mentorDisorder.cases as unknown as Record<string, unknown>)['paired-trays'] = null; },
      t => { (t.mentorDisorder as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) {
      const t = structuredClone(s); change(t); expect(() => validateMentorDisorderState(t)).not.toThrow(); expect(validateMentorDisorderState(t)).toBe(false);
    }
  });
  it('projects only one new detached mastery and the actual original gift inventory', () => {
    const s = promoted(), p = projectMentorDisorder(s), before = structuredClone(s);
    expect(p.practice).toEqual(freshMentorDisorderPractice()); expect(p.abilities.map(x => x.id)).toEqual([...MENTOR_DISORDER_ABILITY_IDS]);
    expect(p.gifts.held).toBe(s.briber.gifts.filter(g => g.location === 'PLAYER').length);
    p.practice.markers = 'MIXED';
    expect(p).toMatchObject({ promoted: true, formulaKnown: false, formula: [], insideCase: false, cases: [] });
    expect(p.actions.every(a => !a.enabled)).toBe(true);
    p.abilities[0]!.mastery = 99; p.bottles[0]!.source = 'changed public copy';
    expect(s).toEqual(before);
  });
  it('accepts only actual finite commands and keeps the written account ordinary', () => {
    for (const caseId of MENTOR_DISORDER_CASE_IDS) {
      for (const type of ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW']) {
        expect(validateMentorDisorderCommand({ type, caseId })).toBe(true); expect(isMentorDisorderAcquisitionCommand({ type, caseId })).toBe(false);
        expect(validateMentorDisorderCommand({ type, caseId, target: 'invented' })).toBe(false);
      }
      expect(validateMentorDisorderCommand({ type: 'PREPARE', caseId, method: 'ORDINARY' })).toBe(true);
      expect(validateMentorDisorderCommand({ type: 'PREPARE', caseId, method: 'ABILITY' })).toBe(caseId !== 'honest-account');
    }
    for (const type of ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'REFLECT', 'BUY_GIFTS']) {
      expect(validateMentorDisorderCommand({ type })).toBe(true); expect(isMentorDisorderAcquisitionCommand({ type })).toBe(false);
    }
    for (const command of [null, {}, { type: 'BREW' }, { type: 'CONSUME', bottleId: 'mentor-disorder-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'corruption-baron-potion-1' }, { type: 'REWRITE_WORLD' }, { type: 'MAGNIFY' }, { type: 'TELEPORT' }, { type: 'REFLECT', extra: true }, { type: 'PERFORM', caseId: 'paired-trays', free: true }]) {
      expect(validateMentorDisorderCommand(command)).toBe(false); expect(isMentorDisorderAcquisitionCommand(command)).toBe(false); reject(prepared(), command);
    }
  });
  it('bounds the single disorder ability and keeps the complete recipe and ritual unknown', () => {
    expect(MENTOR_DISORDER_ABILITIES).toHaveLength(1);
    expect(MENTOR_DISORDER_SOURCE_STATUS).toContain('已有移动方向与实际飞行轨迹');
    expect(MENTOR_DISORDER_SOURCE_STATUS).toContain('不能据此承诺自动免疫');
    expect(MENTOR_DISORDER_SOURCE_STATUS).toContain('4赋予、放大、利用');
    expect(MENTOR_DISORDER_SOURCE_STATUS).toContain('三分钟后的自身混乱是特定手套负面效果');
    expect(MENTOR_DISORDER_SOURCE_STATUS).toContain('不是魔法的普遍条件');
    expect(MENTOR_DISORDER_FORMULA_STATUS).toContain('不冒充已还原原著仪式');
    const wrongPath = corruptionBaron(); wrongPath.progression.pathwayId = 'chained';
    expect(projectMentorDisorder(wrongPath).discovered).toBe(false); reject(wrongPath, { type: 'LEARN_GUIDANCE' });
  });
  it('blocks acquisition while current originals or lower-sequence contacts remain unsettled', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.mentorDisorder.cases['paired-trays']!.contactOpen = true; },
      s => { s.mentorDisorder.practice.markers = 'MIXED'; },
      s => { s.mentorDisorder.practice.markers = 'COLLECTED'; },
      s => { s.mentorDisorder.practice.note = 'WRITTEN'; },
      s => { s.mentorDisorder.practice.route = 'MARKED'; },
      s => { s.corruptionBaron.cases['clause-order']!.contactOpen = true; },
      s => { s.corruptionBaron.practice.clauseOrder = 'ADJUSTED'; },
      s => { s.corruptionBaron.practice.marker = 'SIDE_POCKET'; },
      s => { s.corruptionBaron.practice.route = 'DIVERTED'; },
      s => { Object.values(s.briber.cases)[0]!.contactOpen = true; },
      s => { Object.values(s.barbarian.cases)[0]!.contactOpen = true; },
      s => { Object.values(s.lawyer.cases)[0]!.contactOpen = true; },
    ];
    for (const mutate of mutations) {
      const s = prepared(); mutate(s); reject(s, { type: 'CONSUME', bottleId: s.mentorDisorder.bottles[0]!.id, confirmed: true });
      expect(projectMentorDisorder(s).insideCase).toBe(true);
    }
  });
  it('rejects forged resupply, duplicate originals and a claimed complete formula', () => {
    const s = taught();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.mentorDisorder.resupply.requestedWeek = t.week; },
      t => { t.mentorDisorder.resupply.deliveries = 1; },
      t => { t.mentorDisorder.bottles[1]!.id = t.mentorDisorder.bottles[0]!.id; },
      t => { t.mentorDisorder.bottles[1]!.source = t.corruptionBaron.bottles[0]!.id; },
      t => { (t.mentorDisorder as unknown as Record<string, unknown>).formulaKnown = true; },
      t => { t.corruptionBaron.guidanceKnown = false; },
    ];
    for (const change of changes) {
      const t = structuredClone(s); change(t); expect(() => validateMentorDisorderState(t)).not.toThrow(); expect(validateMentorDisorderState(t)).toBe(false);
    }
    for (const command of [{ type: 'LEARN_FORMULA' }, { type: 'BUY_MATERIALS', batchId: 'mentor-disorder-batch-1' }, { type: 'BREW', batchId: 'mentor-disorder-batch-1' }]) reject(s, command);
  });
  it('keeps unused purchased originals and caps base stats without filling spirituality', () => {
    const s = taught(); const first = buy(s), second = buy(s, 1);
    s.character.coreStats.physique = 500; s.character.coreStats.knowledge = 499;
    act(s, { type: 'CONSUME', bottleId: first.id, confirmed: true });
    expect(second.status).toBe('PLAYER'); expect(second.consumedWeek).toBeNull();
    expect(s.character.coreStats.physique).toBe(500); expect(s.character.coreStats.knowledge).toBe(500);
    expect(s.spirituality).toBe(31); expect(validateMentorDisorderState(s)).toBe(true);
    reject(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
  });
  it('preserves the actual old natural record through migration before any new action', () => {
    const previous = JSON.parse(readFileSync('tests/fixtures/corruption-baron-v0920/natural.json', 'utf8')).final;
    const s = migrateSliceState(previous);
    for (const key of ['lawyer', 'barbarian', 'briber', 'corruptionBaron', 'combatHistory', 'progression'] as const) expect(s[key]).toEqual(previous[key]);
    expect(s.mentorDisorder).toEqual(createMentorDisorderState()); expect(validateMentorDisorderState(s)).toBe(true);
  });
});
