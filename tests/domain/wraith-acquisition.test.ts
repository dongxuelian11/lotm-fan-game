import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { PRISONER_ABILITY_IDS } from '../../src/domain/prisoner/types.js';
import { MADMAN_ABILITY_IDS } from '../../src/domain/madman/types.js';
import { WEREWOLF_ABILITY_IDS } from '../../src/domain/werewolf/types.js';
import { ZOMBIE_ABILITY_IDS } from '../../src/domain/zombie/types.js';
import { ZOMBIE_GUIDE } from '../../src/domain/zombie/content.js';
import { applyWraithCommand, createWraithState, freshWraithPractice, isWraithAcquisitionCommand, projectWraith, validateWraithCommand, validateWraithState } from '../../src/domain/wraith/index.js';
import { WRAITH_ABILITIES, WRAITH_FORMULA_STATUS, WRAITH_GUIDE, WRAITH_PRICES, WRAITH_SOURCE_STATUS } from '../../src/domain/wraith/content.js';
import { WRAITH_ABILITY_IDS, WRAITH_CASE_IDS, type WraithAcquisitionCommand } from '../../src/domain/wraith/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function zombie(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/zombie-v0900/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.wraith = createWraithState(); s.week = Math.max(s.week, s.zombie.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 26;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: WraithAcquisitionCommand, roll = 1) {
  const c = context(s, roll); applyWraithCommand(s, command, c); return c;
}
function taught(s = zombie()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const b = s.wraith.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() {
  const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.wraith.bottles[0]!.id, confirmed: true }); return s;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyWraithCommand(s, command as WraithAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Wraith S5 original finished bottles and inherited history', () => {
  it('hides the future channel and creates independent originals without free movement or possession', () => {
    const s = createSliceRun('wraith-hidden', sliceDefaultCreationSelection, 'wraith-hidden');
    expect(validateWraithState(s)).toBe(true);
    expect(projectWraith(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', practice: freshWraithPractice(), moon: { pending: false, summary: '', history: [] } });
    expect(projectWraith(s).story).toBeUndefined(); expect(projectWraith(s).battle).toBeUndefined();
    const other = createWraithState(); other.practice.form = 'WRAITH'; other.practice.host = 'NOLAN'; other.bottles[0]!.labourSteps = 5; other.encounter.staggerReady = true;
    expect(s.wraith.practice).toEqual(freshWraithPractice());
    expect(s.wraith.bottles[0]!.labourSteps).toBe(0);
    expect(s.wraith.encounter).toEqual({ status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null, lastPossessionRound: null, staggerReady: false });
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('keeps the original Harlen channel and charges 460 plus one action without inventing a formula or rite', () => {
    const s = zombie(), old = structuredClone([s.prisoner, s.madman, s.werewolf, s.zombie]);
    expect(validateWraithState(s)).toBe(true);
    const c = act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([29540, 99]); expect(c.check).not.toHaveBeenCalled();
    expect([s.prisoner, s.madman, s.werewolf, s.zombie]).toEqual(old);
    expect(WRAITH_GUIDE).toBe(ZOMBIE_GUIDE);
    expect(WRAITH_PRICES).toEqual({ guidance: 460, potion: 4800, labourCredit: 4200 });
    expect(projectWraith(s)).toMatchObject({ formulaKnown: false, formula: [], discovered: true });
    expect(WRAITH_FORMULA_STATUS).toContain('细节尚未核实');
    expect(WRAITH_FORMULA_STATUS).toContain('不能据未知细节断言无需仪式');
    expect(c.note).toHaveBeenCalledWith('听取怨魂用药说明', expect.stringContaining('实际核对原瓶、准备原旧工坊安静场地'));
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five actual labour actions and 600 payment for just the selected bottle', () => {
    const s = taught(), b = s.wraith.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([28940, 94, 'PLAYER']);
    const second = s.wraith.bottles[1]!; expect(second.labourSteps).toBe(0);
    act(s, { type: 'POTION_WORK', bottleId: second.id }); const cash = s.cash; buy(s, 1);
    expect(cash - s.cash).toBe(4800); expect(validateWraithState(s)).toBe(true);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); reject(s, { type: 'POTION_WORK', bottleId: b.id });
    s.cash = 4799; reject(s, { type: 'BUY_POTION', bottleId: s.wraith.bottles[2]!.id });
  });
  it('allows early preparation but requires zombie digestion100 and twelve complete weeks to drink', () => {
    const s = zombie(); s.week = s.zombie.promotionWeek! + 8; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validateWraithState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week += 3; s.progression.acting = 100;
    expect(projectWraith(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week++; s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 101; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(s.progression.sequence).toBe(5);
  });
  it('consumes the selected original and applies all four risk tiers through will26', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 95, 100, 0, 5], [30, 'SUCCESS', 90, 100, 0, 5], [85, 'FAILURE', 80, 90, 25, 6], [100, 'GREAT_FAILURE', 60, 80, 50, 6]] as const;
    for (const [roll, tier, mind, health, pollution, sequence] of tiers) {
      const s = prepared(), old = { ...s.progression.mastery }, b = s.wraith.bottles[0]!;
      const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 26);
      expect(c.note).toHaveBeenCalledWith('导师完成本次怨魂服药准备', expect.stringContaining(b.id));
      expect([b.status, b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, pollution, sequence, 'ACTIVE']);
      for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
      expect(s.wraith.bottles.slice(1).every(x => x.status === 'SUPPLIER')).toBe(true);
      if (sequence === 6) expect(s.progression.acting).toBe(100);
      expect(validateWraithState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('keeps the health20 and mind40 boundaries atomic without a roll or consumption', () => {
    for (const [health, mind] of [[20, 100], [100, 40], [1, 1]]) {
      const s = prepared(); s.health = health!; s.mind = mind!;
      reject(s, { type: 'CONSUME', bottleId: s.wraith.bottles[0]!.id, confirmed: true });
      expect(s.wraith.bottles[0]!.status).toBe('PLAYER');
      expect(projectWraith(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('先休养');
    }
  });
  it('preserves every lower original, risk fact, mastery, practice and resolved enemy record on promotion', () => {
    const s = prepared(), old = structuredClone([s.prisoner, s.madman, s.werewolf, s.zombie, s.combatHistory]), stats = { ...s.character.coreStats };
    act(s, { type: 'CONSUME', bottleId: s.wraith.bottles[0]!.id, confirmed: true });
    expect([s.prisoner, s.madman, s.werewolf, s.zombie, s.combatHistory]).toEqual(old);
    expect(s.wraith.zombieActingAtPromotion).toBe(100); expect(s.zombie.encounter.status).toBe('RESOLVED');
    expect(s.zombie.moon.history.map(x => x.week)).toEqual([46, 51]);
    expect(s.wraith.moon).toEqual({ pendingWeek: null, history: [] });
    expect(Object.keys(s.progression.mastery)).toEqual([...PRISONER_ABILITY_IDS, ...MADMAN_ABILITY_IDS, ...WEREWOLF_ABILITY_IDS, ...ZOMBIE_ABILITY_IDS, ...WRAITH_ABILITY_IDS]);
    expect(WRAITH_ABILITY_IDS).toEqual(['chained.s5.reflection-step', 'chained.s5.spirit-possession']);
    for (const id of WRAITH_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    expect(s.wraith.practice).toEqual(freshWraithPractice());
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]);
    expect(projectWraith(s).digestion).toContain('怨魂扮演0/100'); expect(validateWraithState(s)).toBe(true);
  });
  it('retains failed originals and waits a real week for a separately purchased finite batch', () => {
    const s = taught(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let n = 0; n < 3; n++) { const b = buy(s, n); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.wraith.bottles), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.wraith.bottles.slice(0, 3)).toEqual(originals); expect(s.wraith.bottles).toHaveLength(6);
    expect(s.wraith.bottles[3]).toMatchObject({ id: 'wraith-potion-4', status: 'SUPPLIER', acquiredWeek: null, labourSteps: 0 });
    expect(projectWraith(s).actions.find(a => a.id === 'buy-wraith-potion-4')!.cost).toContain('4800便士');
    expect(validateWraithState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('uses zero actions for purchase and separately confirmed consumption at the last-action boundary', () => {
    const s = taught(); s.actionsRemaining = 0;
    const first = structuredClone(s.wraith.bottles[0]), second = buy(s, 1);
    act(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
    expect(s.actionsRemaining).toBe(0); expect(s.wraith.bottles[0]).toEqual(first);
    expect(second).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_SUCCESS' }); expect(validateWraithState(s)).toBe(true);
    reject(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'BUY_POTION', bottleId: s.wraith.bottles[2]!.id });
  });
  it('keeps costs, events, location and ended-run boundaries atomic', () => {
    const withoutAction = zombie(); withoutAction.actionsRemaining = 0; reject(withoutAction, { type: 'LEARN_GUIDANCE' });
    const withoutCash = zombie(); withoutCash.cash = 459; reject(withoutCash, { type: 'LEARN_GUIDANCE' });
    const dead = prepared(); dead.status = 'DEAD'; reject(dead, { type: 'CONSUME', bottleId: dead.wraith.bottles[0]!.id, confirmed: true });
    const elsewhere = taught(); elsewhere.world.city = 'ELSEWHERE'; reject(elsewhere, { type: 'BUY_POTION', bottleId: elsewhere.wraith.bottles[0]!.id });
    const blocked = taught(); blocked.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
    reject(blocked, { type: 'POTION_WORK', bottleId: blocked.wraith.bottles[0]!.id });
  });
  it('rejects forged sources, snapshots, future mastery and malformed nested records without throwing', () => {
    const s = promoted();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.wraith.bottles[0]!.source = 'invented'; },
      t => { t.wraith.bottles[0]!.consumedWeek = t.wraith.promotionWeek! - 1; },
      t => { t.wraith.zombieActingAtPromotion = 99; },
      t => { delete t.progression.mastery[PRISONER_ABILITY_IDS[0]]; },
      t => { t.progression.mastery['chained.s4.curse-source'] = 0; },
      t => { t.wraith.bottles[1]!.labourSteps = 6; },
      t => { (t.wraith as unknown as Record<string, unknown>).practice = null; },
      t => { t.wraith.practice.form = 'WRAITH'; },
      t => { t.wraith.practice.node = 'ALCOVE'; },
      t => { t.wraith.practice.note = 'WRITTEN'; },
      t => { t.wraith.practice.mirror = 'OPEN'; },
      t => { t.wraith.encounter.staggerReady = true; },
      t => { t.wraith.practice.host = 'NOLAN'; },
      t => { (t.wraith.encounter as unknown as Record<string, unknown>).possession = 'PERMANENT'; },
      t => { (t.wraith.practice as unknown as Record<string, unknown>).secretThought = 'forged'; },
      t => { (t.wraith.cases as unknown as Record<string, unknown>)['reflected-room'] = null; },
      t => { t.wraith.moon.history.push({ week: 51, method: 'GUARDED', mentalCost: 10 }); },
      t => { t.wraith.moon.pendingWeek = 51; },
      t => { (t.wraith as unknown as Record<string, unknown>).moon = null; },
      t => { (t.wraith as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) {
      const t = structuredClone(s); change(t); expect(() => validateWraithState(t)).not.toThrow(); expect(validateWraithState(t)).toBe(false);
    }
  });
  it('projects only two new detached masteries and no invented battle before the scene starts', () => {
    const s = promoted(), p = projectWraith(s), before = structuredClone(s);
    expect(p.practice).toEqual(freshWraithPractice()); expect(p.battle).toBeUndefined(); expect(p.abilities.map(x => x.id)).toEqual([...WRAITH_ABILITY_IDS]);
    expect(p).toMatchObject({ promoted: true, formulaKnown: false, formula: [], insideCase: false, cases: [] });
    expect(p.actions.every(a => !a.enabled)).toBe(true);
    p.abilities[0]!.mastery = 99; p.bottles[0]!.source = 'changed public copy'; p.practice.host = 'NOLAN'; p.moon.history.push({ week: 60, method: 'ALONE', mentalCost: 20 });
    expect(s).toEqual(before);
  });
  it('accepts only finite commands, two ability practices and an ordinary account', () => {
    for (const caseId of WRAITH_CASE_IDS) {
      for (const type of ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW']) {
        expect(validateWraithCommand({ type, caseId })).toBe(true); expect(isWraithAcquisitionCommand({ type, caseId })).toBe(false);
        expect(validateWraithCommand({ type, caseId, target: 'invented' })).toBe(false);
      }
      expect(validateWraithCommand({ type: 'PREPARE', caseId, method: 'ORDINARY' })).toBe(true);
      expect(validateWraithCommand({ type: 'PREPARE', caseId, method: 'ABILITY' })).toBe(caseId !== 'honest-account');
      expect(validateWraithCommand({ type: 'CATALYZE', caseId })).toBe(false);
    }
    for (const type of ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'REFLECT']) {
      expect(validateWraithCommand({ type })).toBe(true); expect(isWraithAcquisitionCommand({ type })).toBe(false);
    }
    for (const method of ['GUARDED', 'ALONE']) {
      expect(validateWraithCommand({ type: 'HANDLE_MOON', method })).toBe(true);
      expect(isWraithAcquisitionCommand({ type: 'HANDLE_MOON', method })).toBe(false);
      expect(validateWraithCommand({ type: 'HANDLE_MOON', method, heal: true })).toBe(false);
    }
    for (const command of [null, {}, { type: 'BREW' }, { type: 'CONSUME', bottleId: 'wraith-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'zombie-potion-1' }, { type: 'MIRROR_JUMP', destination: 'ANYWHERE' }, { type: 'READ_HIDDEN_MIND' }, { type: 'CURSE_SOURCE' }, { type: 'REFLECT', extra: true }, { type: 'HANDLE_MOON', method: 'SWALLOW_SOUL', free: true }]) {
      expect(validateWraithCommand(command)).toBe(false); expect(isWraithAcquisitionCommand(command)).toBe(false); reject(prepared(), command);
    }
  });
  it('distinguishes real reflective surfaces, resistible possession, replacing curses and unknown recipe or rite', () => {
    expect(WRAITH_ABILITIES).toHaveLength(2);
    expect(WRAITH_SOURCE_STATUS).toContain('真实反射面');
    expect(WRAITH_SOURCE_STATUS).toContain('更高位格可排斥附身并迫使显形');
    expect(WRAITH_SOURCE_STATUS).toContain('不是所有初晋怨魂的统一距离');
    expect(WRAITH_SOURCE_STATUS).toContain('序列4为木偶');
    expect(WRAITH_SOURCE_STATUS).toContain('不三重叠收');
    expect(WRAITH_SOURCE_STATUS).toContain('不是原著附身必备条件');
    expect(WRAITH_FORMULA_STATUS).toContain('不冒充已还原原著仪式');
    const wrongPath = zombie(); wrongPath.progression.pathwayId = 'abyss';
    expect(projectWraith(wrongPath).discovered).toBe(false); reject(wrongPath, { type: 'LEARN_GUIDANCE' });
    const wrongStage = zombie(); wrongStage.progression.sequence = 7;
    expect(projectWraith(wrongStage).discovered).toBe(false); reject(wrongStage, { type: 'LEARN_GUIDANCE' });
  });
  it('blocks acquisition while any actual old contact, old moon or new scene remains open', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.wraith.cases['reflected-room']!.contactOpen = true; },
      s => { s.wraith.practice.form = 'WRAITH'; },
      s => { s.wraith.practice.node = 'ALCOVE'; },
      s => { s.wraith.practice.mirror = 'OPEN'; },
      s => { s.wraith.practice.host = 'NOLAN'; },
      s => { s.wraith.practice.flag = 'RAISED'; },
      s => { s.wraith.practice.note = 'WRITTEN'; },
      s => { s.wraith.moon.pendingWeek = s.week; },
      s => { Object.values(s.zombie.cases)[0]!.contactOpen = true; },
      s => { s.zombie.practice.body = 'BRACED'; },
      s => { s.zombie.practice.cold = 'ICED'; },
      s => { s.zombie.practice.spirit = 'PRESENT'; },
      s => { s.zombie.moon.pendingWeek = s.week; },
      s => { s.werewolf.moon.pendingWeek = s.week; },
      s => { Object.values(s.werewolf.cases)[0]!.sceneOpen = true; },
      s => { Object.values(s.madman.cases)[0]!.burstOpen = true; },
      s => { Object.values(s.prisoner.cases)[0]!.holding = true; },
    ];
    for (const mutate of mutations) {
      const s = prepared(); mutate(s); reject(s, { type: 'CONSUME', bottleId: s.wraith.bottles[0]!.id, confirmed: true });
      expect(projectWraith(s).insideCase).toBe(true);
    }
  });
  it('rejects forged resupply, duplicate originals and a claimed complete formula', () => {
    const s = taught();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.wraith.resupply.requestedWeek = t.week; },
      t => { t.wraith.resupply.deliveries = 1; },
      t => { t.wraith.bottles[1]!.id = t.wraith.bottles[0]!.id; },
      t => { t.wraith.bottles[1]!.source = t.zombie.bottles[0]!.id; },
      t => { (t.wraith as unknown as Record<string, unknown>).formulaKnown = true; },
      t => { t.zombie.guidanceKnown = false; },
    ];
    for (const change of changes) {
      const t = structuredClone(s); change(t); expect(() => validateWraithState(t)).not.toThrow(); expect(validateWraithState(t)).toBe(false);
    }
    for (const command of [{ type: 'LEARN_FORMULA' }, { type: 'BUY_MATERIALS', batchId: 'wraith-batch-1' }, { type: 'BREW', batchId: 'wraith-batch-1' }]) reject(s, command);
  });
  it('keeps unused purchased originals and caps base stats without filling spirituality', () => {
    const s = taught(); const first = buy(s), second = buy(s, 1);
    s.character.coreStats.physique = 500; s.character.coreStats.knowledge = 499;
    act(s, { type: 'CONSUME', bottleId: first.id, confirmed: true });
    expect(second.status).toBe('PLAYER'); expect(second.consumedWeek).toBeNull();
    expect(s.character.coreStats.physique).toBe(500); expect(s.character.coreStats.knowledge).toBe(500);
    expect(s.spirituality).toBe(31); expect(validateWraithState(s)).toBe(true);
    reject(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
  });
  it('preserves the actual old natural record through migration before any new action', () => {
    const previous = JSON.parse(readFileSync('tests/fixtures/zombie-v0900/natural.json', 'utf8')).final;
    const s = migrateSliceState(previous);
    for (const key of ['prisoner', 'madman', 'werewolf', 'zombie', 'combatHistory', 'progression'] as const) expect(s[key]).toEqual(previous[key]);
    expect(s.wraith).toEqual(createWraithState()); expect(validateWraithState(s)).toBe(true);
  });
});
