import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { CRIMINAL_ABILITY_IDS } from '../../src/domain/criminal/types.js';
import { UNWINGED_ABILITY_IDS } from '../../src/domain/unwinged/types.js';
import { SERIAL_KILLER_ABILITY_IDS } from '../../src/domain/serial-killer/types.js';
import { DEMON_ABILITY_IDS } from '../../src/domain/demon/types.js';
import { DEMON_GUIDE } from '../../src/domain/demon/content.js';
import { applyDesireApostleCommand, createDesireApostleState, freshDesireApostlePractice, isDesireApostleAcquisitionCommand, projectDesireApostle, validateDesireApostleCommand, validateDesireApostleState } from '../../src/domain/desire-apostle/index.js';
import { DESIRE_APOSTLE_ABILITIES, DESIRE_APOSTLE_FORMULA_STATUS, DESIRE_APOSTLE_GUIDE, DESIRE_APOSTLE_PRICES, DESIRE_APOSTLE_SOURCE_STATUS } from '../../src/domain/desire-apostle/content.js';
import { DESIRE_APOSTLE_ABILITY_IDS, DESIRE_APOSTLE_CASE_IDS, type DesireApostleAcquisitionCommand } from '../../src/domain/desire-apostle/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function demon(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/demon-v0890/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.desireApostle = createDesireApostleState(); s.week = Math.max(s.week, s.demon.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 26;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: DesireApostleAcquisitionCommand, roll = 1) {
  const c = context(s, roll); applyDesireApostleCommand(s, command, c); return c;
}
function taught(s = demon()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const b = s.desireApostle.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() {
  const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.desireApostle.bottles[0]!.id, confirmed: true }); return s;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyDesireApostleCommand(s, command as DesireApostleAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Desire Apostle S5 original finished bottles and conditional abilities', () => {
  it('hides the future channel and creates independent originals without free emotion or seeds', () => {
    const s = createSliceRun('desire-apostle-hidden', sliceDefaultCreationSelection, 'desire-apostle-hidden');
    expect(validateDesireApostleState(s)).toBe(true);
    expect(projectDesireApostle(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', practice: null });
    expect(projectDesireApostle(s).story).toBeUndefined(); expect(projectDesireApostle(s).battle).toBeUndefined();
    const other = createDesireApostleState(); other.practice.emotion = 'STRONG'; other.practice.seed = 'PLANTED'; other.bottles[0]!.labourSteps = 5; other.encounter.seedPlanted = true;
    expect(s.desireApostle.practice).toEqual({ emotion: 'CALM', seed: 'NONE', pauseObserved: false, ledger: 'GUIDE', note: 'BLANK' });
    expect(s.desireApostle.bottles[0]!.labourSteps).toBe(0);
    expect(s.desireApostle.encounter).toEqual({ status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null, emotion: 'CALM', seedPlanted: false, lastSeedRound: null, staggerReady: false });
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('keeps the original Roan channel and charges 460 plus one action without inventing a formula or rite', () => {
    const s = demon(), old = structuredClone([s.criminal, s.unwinged, s.serialKiller, s.demon]);
    expect(validateDesireApostleState(s)).toBe(true);
    const c = act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([29540, 99]); expect(c.check).not.toHaveBeenCalled();
    expect([s.criminal, s.unwinged, s.serialKiller, s.demon]).toEqual(old);
    expect(DESIRE_APOSTLE_GUIDE).toBe(DEMON_GUIDE);
    expect(DESIRE_APOSTLE_PRICES).toEqual({ guidance: 460, potion: 4800, labourCredit: 4200 });
    expect(projectDesireApostle(s)).toMatchObject({ formulaKnown: false, formula: [], discovered: true });
    expect(DESIRE_APOSTLE_FORMULA_STATUS).toContain('细节尚未核实');
    expect(DESIRE_APOSTLE_FORMULA_STATUS).toContain('不能据未知细节断言无需仪式');
    expect(c.note).toHaveBeenCalledWith('听取欲望使徒用药说明', expect.stringContaining('实际核对原瓶、准备原旧货库练习室安静场地'));
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five actual labour actions and 600 payment for just the selected bottle', () => {
    const s = taught(), b = s.desireApostle.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([28940, 94, 'PLAYER']);
    const second = s.desireApostle.bottles[1]!; expect(second.labourSteps).toBe(0);
    act(s, { type: 'POTION_WORK', bottleId: second.id }); const cash = s.cash; buy(s, 1);
    expect(cash - s.cash).toBe(4800); expect(validateDesireApostleState(s)).toBe(true);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); reject(s, { type: 'POTION_WORK', bottleId: b.id });
    s.cash = 4799; reject(s, { type: 'BUY_POTION', bottleId: s.desireApostle.bottles[2]!.id });
  });
  it('allows early preparation but requires demon digestion100 and twelve complete weeks to drink', () => {
    const s = demon(); s.week = s.demon.promotionWeek!; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validateDesireApostleState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week += 11; s.progression.acting = 100;
    expect(projectDesireApostle(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week++; s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(s.progression.sequence).toBe(5);
  });
  it('consumes the selected original and applies all four risk tiers through will26', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 95, 100, 0, 5], [30, 'SUCCESS', 90, 100, 0, 5], [85, 'FAILURE', 80, 90, 25, 6], [100, 'GREAT_FAILURE', 60, 80, 50, 6]] as const;
    for (const [roll, tier, mind, health, pollution, sequence] of tiers) {
      const s = prepared(), old = { ...s.progression.mastery }, b = s.desireApostle.bottles[0]!;
      const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 26);
      expect(c.note).toHaveBeenCalledWith('导师完成本次欲望使徒服药准备', expect.stringContaining(b.id));
      expect([b.status, b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, pollution, sequence, 'ACTIVE']);
      for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
      expect(s.desireApostle.bottles.slice(1).every(x => x.status === 'SUPPLIER')).toBe(true);
      if (sequence === 6) expect(s.progression.acting).toBe(100);
      expect(validateDesireApostleState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('keeps the health20 and mind40 boundaries atomic without a roll or consumption', () => {
    for (const [health, mind] of [[20, 100], [100, 40], [1, 1]]) {
      const s = prepared(); s.health = health!; s.mind = mind!;
      reject(s, { type: 'CONSUME', bottleId: s.desireApostle.bottles[0]!.id, confirmed: true });
      expect(s.desireApostle.bottles[0]!.status).toBe('PLAYER');
      expect(projectDesireApostle(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('先休养');
    }
  });
  it('preserves every lower original, risk fact, mastery, practice and resolved enemy record on promotion', () => {
    const s = prepared(), old = structuredClone([s.criminal, s.unwinged, s.serialKiller, s.demon, s.combatHistory]), stats = { ...s.character.coreStats };
    act(s, { type: 'CONSUME', bottleId: s.desireApostle.bottles[0]!.id, confirmed: true });
    expect([s.criminal, s.unwinged, s.serialKiller, s.demon, s.combatHistory]).toEqual(old);
    expect(s.desireApostle.demonActingAtPromotion).toBe(100); expect(s.demon.encounter.status).toBe('RESOLVED');
    expect(s.unwinged.conscienceLost).toBe(true); expect(s.demon.strain).toBe(3);
    expect(Object.keys(s.progression.mastery)).toEqual([...CRIMINAL_ABILITY_IDS, ...UNWINGED_ABILITY_IDS, ...SERIAL_KILLER_ABILITY_IDS, ...DEMON_ABILITY_IDS, ...DESIRE_APOSTLE_ABILITY_IDS]);
    expect(DESIRE_APOSTLE_ABILITY_IDS).toEqual(['abyss.s5.emotion-seed', 'abyss.s5.catalysis']);
    for (const id of DESIRE_APOSTLE_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    expect(s.desireApostle.practice).toEqual(freshDesireApostlePractice());
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]);
    expect(projectDesireApostle(s).digestion).toContain('欲望使徒扮演0/100'); expect(validateDesireApostleState(s)).toBe(true);
  });
  it('retains failed originals and waits a real week for a separately purchased finite batch', () => {
    const s = taught(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let n = 0; n < 3; n++) { const b = buy(s, n); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.desireApostle.bottles), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.desireApostle.bottles.slice(0, 3)).toEqual(originals); expect(s.desireApostle.bottles).toHaveLength(6);
    expect(s.desireApostle.bottles[3]).toMatchObject({ id: 'desire-apostle-potion-4', status: 'SUPPLIER', acquiredWeek: null, labourSteps: 0 });
    expect(projectDesireApostle(s).actions.find(a => a.id === 'buy-desire-apostle-potion-4')!.cost).toContain('4800便士');
    expect(validateDesireApostleState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('uses zero actions for purchase and separately confirmed consumption at the last-action boundary', () => {
    const s = taught(); s.actionsRemaining = 0;
    const first = structuredClone(s.desireApostle.bottles[0]), second = buy(s, 1);
    act(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
    expect(s.actionsRemaining).toBe(0); expect(s.desireApostle.bottles[0]).toEqual(first);
    expect(second).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_SUCCESS' }); expect(validateDesireApostleState(s)).toBe(true);
    reject(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'BUY_POTION', bottleId: s.desireApostle.bottles[2]!.id });
  });
  it('keeps costs, events, location and ended-run boundaries atomic', () => {
    const withoutAction = demon(); withoutAction.actionsRemaining = 0; reject(withoutAction, { type: 'LEARN_GUIDANCE' });
    const withoutCash = demon(); withoutCash.cash = 459; reject(withoutCash, { type: 'LEARN_GUIDANCE' });
    const dead = prepared(); dead.status = 'DEAD'; reject(dead, { type: 'CONSUME', bottleId: dead.desireApostle.bottles[0]!.id, confirmed: true });
    const elsewhere = taught(); elsewhere.world.city = 'ELSEWHERE'; reject(elsewhere, { type: 'BUY_POTION', bottleId: elsewhere.desireApostle.bottles[0]!.id });
    const blocked = taught(); blocked.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
    reject(blocked, { type: 'POTION_WORK', bottleId: blocked.desireApostle.bottles[0]!.id });
  });
  it('rejects forged sources, snapshots, future mastery and malformed nested records without throwing', () => {
    const s = promoted();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.desireApostle.bottles[0]!.source = 'invented'; },
      t => { t.desireApostle.bottles[0]!.consumedWeek = t.desireApostle.promotionWeek! - 1; },
      t => { t.desireApostle.demonActingAtPromotion = 99; },
      t => { delete t.progression.mastery[CRIMINAL_ABILITY_IDS[0]]; },
      t => { t.progression.mastery['abyss.s4.mental-corrosion'] = 0; },
      t => { t.desireApostle.bottles[1]!.labourSteps = 6; },
      t => { (t.desireApostle as unknown as Record<string, unknown>).practice = null; },
      t => { t.desireApostle.practice.seed = 'PLANTED'; },
      t => { t.desireApostle.practice.ledger = 'PLAYER'; },
      t => { t.desireApostle.practice.note = 'WRITTEN'; },
      t => { t.desireApostle.practice.emotion = 'STRONG'; },
      t => { t.desireApostle.encounter.staggerReady = true; },
      t => { t.desireApostle.encounter.seedPlanted = true; },
      t => { (t.desireApostle.encounter as unknown as Record<string, unknown>).emotion = 'FURIOUS_FOREVER'; },
      t => { (t.desireApostle.practice as unknown as Record<string, unknown>).secretThought = 'forged'; },
      t => { (t.desireApostle.cases as unknown as Record<string, unknown>)['calm-boundary'] = null; },
      t => { (t.desireApostle as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) {
      const t = structuredClone(s); change(t); expect(() => validateDesireApostleState(t)).not.toThrow(); expect(validateDesireApostleState(t)).toBe(false);
    }
  });
  it('projects only two new detached masteries and no invented battle before the scene starts', () => {
    const s = promoted(), p = projectDesireApostle(s), before = structuredClone(s);
    expect(p.practice).toBeNull(); expect(p.battle).toBeUndefined(); expect(p.abilities.map(x => x.id)).toEqual([...DESIRE_APOSTLE_ABILITY_IDS]);
    expect(p).toMatchObject({ promoted: true, formulaKnown: false, formula: [], insideCase: false, cases: [] });
    expect(p.actions.every(a => !a.enabled)).toBe(true);
    p.abilities[0]!.mastery = 99; p.bottles[0]!.source = 'changed public copy';
    expect(s).toEqual(before);
  });
  it('accepts only the actual finite commands and keeps calm and account cases ordinary', () => {
    for (const caseId of DESIRE_APOSTLE_CASE_IDS) {
      for (const type of ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW']) {
        expect(validateDesireApostleCommand({ type, caseId })).toBe(true); expect(isDesireApostleAcquisitionCommand({ type, caseId })).toBe(false);
        expect(validateDesireApostleCommand({ type, caseId, target: 'invented' })).toBe(false);
      }
      expect(validateDesireApostleCommand({ type: 'PREPARE', caseId, method: 'ORDINARY' })).toBe(true);
      expect(validateDesireApostleCommand({ type: 'PREPARE', caseId, method: 'ABILITY' })).toBe(caseId === 'eager-rehearsal');
      expect(validateDesireApostleCommand({ type: 'CATALYZE', caseId })).toBe(caseId === 'eager-rehearsal');
    }
    for (const type of ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'REFLECT']) {
      expect(validateDesireApostleCommand({ type })).toBe(true); expect(isDesireApostleAcquisitionCommand({ type })).toBe(false);
    }
    for (const command of [null, {}, { type: 'BREW' }, { type: 'CONSUME', bottleId: 'desire-apostle-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'demon-potion-1' }, { type: 'FORCE_FEAR' }, { type: 'READ_HIDDEN_MIND' }, { type: 'BURN_HORN' }, { type: 'REFLECT', extra: true }, { type: 'CATALYZE', caseId: 'eager-rehearsal', free: true }]) {
      expect(validateDesireApostleCommand(command)).toBe(false); expect(isDesireApostleAcquisitionCommand(command)).toBe(false); reject(prepared(), command);
    }
  });
  it('bounds source abilities to strong emotion and calm blocking while leaving the full recipe and ritual unknown', () => {
    expect(DESIRE_APOSTLE_ABILITIES).toHaveLength(2);
    expect(DESIRE_APOSTLE_SOURCE_STATUS).toContain('强烈情绪波动或明显欲望');
    expect(DESIRE_APOSTLE_SOURCE_STATUS).toContain('情绪平稳、欲望内敛');
    expect(DESIRE_APOSTLE_SOURCE_STATUS).toContain('不是通用施法时间');
    expect(DESIRE_APOSTLE_SOURCE_STATUS).toContain('序列4是魔鬼');
    expect(DESIRE_APOSTLE_SOURCE_STATUS).toContain('不是原著魔法的通用条件');
    expect(DESIRE_APOSTLE_FORMULA_STATUS).toContain('不冒充已还原原著仪式');
    const wrongPath = demon(); wrongPath.progression.pathwayId = 'chained';
    expect(projectDesireApostle(wrongPath).discovered).toBe(false); reject(wrongPath, { type: 'LEARN_GUIDANCE' });
  });
  it('blocks acquisition while new contact, pending seeds, original records or old demon effects remain open', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.desireApostle.cases['calm-boundary']!.contactOpen = true; },
      s => { s.desireApostle.practice.ledger = 'PLAYER'; },
      s => { s.desireApostle.practice.note = 'WRITTEN'; },
      s => { s.desireApostle.practice.seed = 'PLANTED'; },
      s => { s.demon.cases['loading-lane']!.contactOpen = true; },
      s => { s.demon.practice.body = 'ENLARGED'; },
      s => { s.demon.practice.flame = 'LIT'; },
    ];
    for (const mutate of mutations) {
      const s = prepared(); mutate(s); reject(s, { type: 'CONSUME', bottleId: s.desireApostle.bottles[0]!.id, confirmed: true });
      expect(projectDesireApostle(s).insideCase).toBe(true);
    }
  });
  it('rejects forged resupply, duplicate originals and a claimed complete formula', () => {
    const s = taught();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.desireApostle.resupply.requestedWeek = t.week; },
      t => { t.desireApostle.resupply.deliveries = 1; },
      t => { t.desireApostle.bottles[1]!.id = t.desireApostle.bottles[0]!.id; },
      t => { t.desireApostle.bottles[1]!.source = t.demon.bottles[0]!.id; },
      t => { (t.desireApostle as unknown as Record<string, unknown>).formulaKnown = true; },
      t => { t.demon.guidanceKnown = false; },
    ];
    for (const change of changes) {
      const t = structuredClone(s); change(t); expect(() => validateDesireApostleState(t)).not.toThrow(); expect(validateDesireApostleState(t)).toBe(false);
    }
    for (const command of [{ type: 'LEARN_FORMULA' }, { type: 'BUY_MATERIALS', batchId: 'desire-apostle-batch-1' }, { type: 'BREW', batchId: 'desire-apostle-batch-1' }]) reject(s, command);
  });
  it('keeps unused purchased originals and caps base stats without filling spirituality', () => {
    const s = taught(); const first = buy(s), second = buy(s, 1);
    s.character.coreStats.physique = 500; s.character.coreStats.knowledge = 499;
    act(s, { type: 'CONSUME', bottleId: first.id, confirmed: true });
    expect(second.status).toBe('PLAYER'); expect(second.consumedWeek).toBeNull();
    expect(s.character.coreStats.physique).toBe(500); expect(s.character.coreStats.knowledge).toBe(500);
    expect(s.spirituality).toBe(31); expect(validateDesireApostleState(s)).toBe(true);
    reject(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
  });
  it('preserves the actual old natural record through migration before any new action', () => {
    const previous = JSON.parse(readFileSync('tests/fixtures/demon-v0890/natural.json', 'utf8')).final;
    const s = migrateSliceState(previous);
    for (const key of ['criminal', 'unwinged', 'serialKiller', 'demon', 'combatHistory', 'progression'] as const) expect(s[key]).toEqual(previous[key]);
    expect(s.desireApostle).toEqual(createDesireApostleState()); expect(validateDesireApostleState(s)).toBe(true);
  });
});
