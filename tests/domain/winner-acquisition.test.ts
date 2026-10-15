import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { MONSTER_ABILITY_IDS } from '../../src/domain/monster/types.js';
import { MACHINE_ABILITY_IDS } from '../../src/domain/machine/types.js';
import { LUCKY_ABILITY_IDS } from '../../src/domain/lucky/types.js';
import { CALAMITY_PRIEST_ABILITY_IDS } from '../../src/domain/calamity-priest/types.js';
import { CALAMITY_PRIEST_GUIDE } from '../../src/domain/calamity-priest/content.js';
import { applyWinnerCommand, createWinnerState, freshWinnerPractice, isWinnerAcquisitionCommand, projectWinner, validateWinnerCommand, validateWinnerState } from '../../src/domain/winner/index.js';
import { WINNER_ABILITIES, WINNER_FORMULA_STATUS, WINNER_GUIDE, WINNER_PRICES, WINNER_SOURCE_STATUS } from '../../src/domain/winner/content.js';
import { WINNER_ABILITY_IDS, WINNER_CASE_IDS, type WinnerAcquisitionCommand } from '../../src/domain/winner/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

const emptyLuck = () => ({ stored: 0, lastAccumulateWeek: null, accumulated: 0, spent: 0 });
function calamityPriest(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/calamity-priest-v0910/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.winner = createWinnerState(); s.week = Math.max(s.week, s.calamityPriest.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 26;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: WinnerAcquisitionCommand, roll = 1) {
  const c = context(s, roll); applyWinnerCommand(s, command, c); return c;
}
function taught(s = calamityPriest()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const b = s.winner.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() {
  const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.winner.bottles[0]!.id, confirmed: true }); return s;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyWinnerCommand(s, command as WinnerAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Winner S5 original bottles, chronology and unfilled finite fortune bank', () => {
  it('hides the future channel and creates independent originals with exactly zero fortune', () => {
    const s = createSliceRun('winner-hidden', sliceDefaultCreationSelection, 'winner-hidden');
    expect(validateWinnerState(s)).toBe(true);
    expect(projectWinner(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', practice: freshWinnerPractice(), luck: { ...emptyLuck(), capacity: 3, summary: '' } });
    expect(projectWinner(s).story).toBeUndefined(); expect(projectWinner(s).battle).toBeUndefined();
    const other = createWinnerState(); other.practice.counter = 'TRAY'; other.bottles[0]!.labourSteps = 5; other.luck.stored = 3;
    expect(s.winner.practice).toEqual(freshWinnerPractice()); expect(s.winner.luck).toEqual(emptyLuck());
    expect(s.winner.bottles[0]!.labourSteps).toBe(0);
    expect(s.winner.encounter).toEqual({ status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null, lastLuckRound: null, staggerReady: false });
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('uses the same original Ada channel and real 460 guidance without a fabricated formula or rite', () => {
    const s = calamityPriest(), old = structuredClone([s.monster, s.machine, s.lucky, s.calamityPriest]);
    expect(validateWinnerState(s)).toBe(true);
    const c = act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([29540, 99]); expect(c.check).not.toHaveBeenCalled();
    expect([s.monster, s.machine, s.lucky, s.calamityPriest]).toEqual(old);
    expect(WINNER_GUIDE).toBe(CALAMITY_PRIEST_GUIDE);
    expect(WINNER_PRICES).toEqual({ guidance: 460, potion: 4800, labourCredit: 4200 });
    expect(projectWinner(s)).toMatchObject({ formulaKnown: false, formula: [], discovered: true });
    expect(WINNER_FORMULA_STATUS).toContain('细节尚未核实');
    expect(WINNER_FORMULA_STATUS).toContain('不能据未知细节断言无需仪式');
    expect(c.note).toHaveBeenCalledWith('听取赢家用药说明', expect.stringContaining('实际核对原瓶、准备原报时铺安静场地'));
    expect(s.winner.luck).toEqual(emptyLuck()); reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges five actual labour actions and 600 only for the selected original, without buying luck', () => {
    const s = taught(), b = s.winner.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([28940, 94, 'PLAYER']);
    const second = s.winner.bottles[1]!; expect(second.labourSteps).toBe(0);
    act(s, { type: 'POTION_WORK', bottleId: second.id }); const cash = s.cash; buy(s, 1);
    expect(cash - s.cash).toBe(4800); expect(s.winner.luck).toEqual(emptyLuck()); expect(validateWinnerState(s)).toBe(true);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); reject(s, { type: 'POTION_WORK', bottleId: b.id });
    s.cash = 4799; reject(s, { type: 'BUY_POTION', bottleId: s.winner.bottles[2]!.id });
  });
  it('permits preparation early but requires exactly 100 old digestion and twelve complete weeks to drink', () => {
    const s = calamityPriest(); s.week = s.calamityPriest.promotionWeek! + 8; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validateWinnerState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week += 3; s.progression.acting = 100;
    expect(projectWinner(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week++; s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 101; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(s.progression.sequence).toBe(5); expect(s.winner.luck).toEqual(emptyLuck());
  });
  it('consumes one selected original through each will26 risk tier and never refunds or fills fortune', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 95, 100, 0, 5], [30, 'SUCCESS', 90, 100, 0, 5], [85, 'FAILURE', 80, 90, 25, 6], [100, 'GREAT_FAILURE', 60, 80, 50, 6]] as const;
    for (const [roll, tier, mind, health, pollution, sequence] of tiers) {
      const s = prepared(), old = { ...s.progression.mastery }, b = s.winner.bottles[0]!;
      const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 26);
      expect(c.note).toHaveBeenCalledWith('导师完成本次赢家服药准备', expect.stringContaining(b.id));
      expect([b.status, b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, pollution, sequence, 'ACTIVE']);
      for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
      expect(s.winner.bottles.slice(1).every(x => x.status === 'SUPPLIER')).toBe(true);
      expect(s.winner.luck).toEqual(emptyLuck()); if (sequence === 6) expect(s.progression.acting).toBe(100);
      expect(validateWinnerState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('keeps health20 and mind40 boundaries atomic before a roll or consumption', () => {
    for (const [health, mind] of [[20, 100], [100, 40], [1, 1]]) {
      const s = prepared(); s.health = health!; s.mind = mind!;
      reject(s, { type: 'CONSUME', bottleId: s.winner.bottles[0]!.id, confirmed: true });
      expect(s.winner.bottles[0]!.status).toBe('PLAYER');
      expect(projectWinner(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('先休养');
    }
  });
  it('preserves all four lower sequences, actual prior combat, mastery and pollution on promotion', () => {
    const s = prepared(), old = structuredClone([s.monster, s.machine, s.lucky, s.calamityPriest, s.combatHistory]), stats = { ...s.character.coreStats };
    s.seer.pollution = 17;
    act(s, { type: 'CONSUME', bottleId: s.winner.bottles[0]!.id, confirmed: true });
    expect([s.monster, s.machine, s.lucky, s.calamityPriest, s.combatHistory]).toEqual(old);
    expect(s.winner.calamityPriestActingAtPromotion).toBe(100); expect(s.calamityPriest.encounter.status).toBe('RESOLVED');
    expect(Object.keys(s.progression.mastery)).toEqual([...MONSTER_ABILITY_IDS, ...MACHINE_ABILITY_IDS, ...LUCKY_ABILITY_IDS, ...CALAMITY_PRIEST_ABILITY_IDS, ...WINNER_ABILITY_IDS]);
    expect(WINNER_ABILITY_IDS).toEqual(['wheel.s5.luck-reserve', 'wheel.s5.ill-fortune']);
    for (const id of WINNER_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    expect(s.winner.practice).toEqual(freshWinnerPractice()); expect(s.winner.luck).toEqual(emptyLuck());
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting, s.seer.pollution]).toEqual([31, 0, 17]);
    expect(projectWinner(s).digestion).toContain('赢家扮演0/100'); expect(validateWinnerState(s)).toBe(true);
  });
  it('retains failed originals and waits a real week for a paid new batch without shadow resources', () => {
    const s = taught(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let n = 0; n < 3; n++) { const b = buy(s, n); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.winner.bottles), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.winner.bottles.slice(0, 3)).toEqual(originals); expect(s.winner.bottles).toHaveLength(6);
    expect(s.winner.bottles[3]).toMatchObject({ id: 'winner-potion-4', status: 'SUPPLIER', acquiredWeek: null, labourSteps: 0 });
    expect(projectWinner(s).actions.find(a => a.id === 'buy-winner-potion-4')!.cost).toContain('4800便士');
    expect(s.winner.luck).toEqual(emptyLuck()); expect(validateWinnerState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('uses zero actions for separately confirmed selected consumption and keeps unused originals', () => {
    const s = taught(); s.actionsRemaining = 0;
    const first = buy(s), second = buy(s, 1); s.character.coreStats.physique = 500; s.character.coreStats.knowledge = 499;
    act(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
    expect(s.actionsRemaining).toBe(0); expect(first.status).toBe('PLAYER'); expect(first.consumedWeek).toBeNull();
    expect(second).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_SUCCESS' }); expect(validateWinnerState(s)).toBe(true);
    expect(s.character.coreStats.physique).toBe(500); expect(s.character.coreStats.knowledge).toBe(500);
    expect(s.spirituality).toBe(31); expect(s.winner.luck).toEqual(emptyLuck());
    reject(s, { type: 'CONSUME', bottleId: first.id, confirmed: true }); reject(s, { type: 'BUY_POTION', bottleId: s.winner.bottles[2]!.id });
  });
  it('keeps costs, events, location, source and ended-run boundaries atomic', () => {
    const withoutAction = calamityPriest(); withoutAction.actionsRemaining = 0; reject(withoutAction, { type: 'LEARN_GUIDANCE' });
    const withoutCash = calamityPriest(); withoutCash.cash = 459; reject(withoutCash, { type: 'LEARN_GUIDANCE' });
    const dead = prepared(); dead.status = 'DEAD'; reject(dead, { type: 'CONSUME', bottleId: dead.winner.bottles[0]!.id, confirmed: true });
    const elsewhere = taught(); elsewhere.world.city = 'ELSEWHERE'; reject(elsewhere, { type: 'BUY_POTION', bottleId: elsewhere.winner.bottles[0]!.id });
    const wrongPath = calamityPriest(); wrongPath.progression.pathwayId = 'abyss'; expect(projectWinner(wrongPath).discovered).toBe(false); reject(wrongPath, { type: 'LEARN_GUIDANCE' });
    const wrongStage = calamityPriest(); wrongStage.progression.sequence = 7; expect(projectWinner(wrongStage).discovered).toBe(false); reject(wrongStage, { type: 'LEARN_GUIDANCE' });
    const blocked = taught(); blocked.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
    reject(blocked, { type: 'POTION_WORK', bottleId: blocked.winner.bottles[0]!.id });
  });
  it('rejects malformed originals, snapshots, nested resources and future power without throwing', () => {
    const s = promoted();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.winner.bottles[0]!.source = 'invented'; },
      t => { t.winner.bottles[0]!.consumedWeek = t.winner.promotionWeek! - 1; },
      t => { t.winner.calamityPriestActingAtPromotion = 99; },
      t => { delete t.progression.mastery[MONSTER_ABILITY_IDS[0]]; },
      t => { t.progression.mastery['wheel.s4.reboot'] = 0; },
      t => { t.winner.bottles[1]!.labourSteps = 6; },
      t => { (t.winner as unknown as Record<string, unknown>).practice = null; },
      t => { t.winner.practice.counter = 'TRAY'; },
      t => { t.winner.practice.ring = 'MAT'; },
      t => { t.winner.practice.note = 'WRITTEN'; },
      t => { t.winner.encounter.staggerReady = true; },
      t => { t.winner.encounter.lastLuckRound = 1; },
      t => { (t.winner.encounter as unknown as Record<string, unknown>).guaranteed = true; },
      t => { (t.winner.practice as unknown as Record<string, unknown>).reroll = true; },
      t => { (t.winner.cases as unknown as Record<string, unknown>)['falling-counter'] = null; },
      t => { t.winner.luck.stored = 3; },
      t => { t.winner.luck.spent = 1; },
      t => { t.winner.luck = { stored: 4, accumulated: 4, spent: 0, lastAccumulateWeek: t.week }; },
      t => { (t.winner as unknown as Record<string, unknown>).luck = null; },
      t => { (t.winner as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) {
      const t = structuredClone(s); change(t); expect(() => validateWinnerState(t)).not.toThrow(); expect(validateWinnerState(t)).toBe(false);
    }
  });
  it('projects detached numeric resources and only two new masteries, with no premature battle', () => {
    const s = promoted(), p = projectWinner(s), before = structuredClone(s);
    expect(p.practice).toEqual(freshWinnerPractice()); expect(p.battle).toBeUndefined(); expect(p.abilities.map(x => x.id)).toEqual([...WINNER_ABILITY_IDS]);
    expect(p).toMatchObject({ promoted: true, formulaKnown: false, formula: [], insideCase: false, cases: [], luck: { ...emptyLuck(), capacity: 3 } });
    expect(p.luck.summary).toContain('0/3'); expect(p.luck.summary).toContain('尚未实际积累');
    p.abilities[0]!.mastery = 99; p.bottles[0]!.source = 'changed public copy'; p.practice.counter = 'CAUGHT'; p.luck.stored = 3;
    expect(s).toEqual(before);
  });
  it('accepts exact finite commands and rejects arbitrary rerolls, transfers, recipes and extra controls', () => {
    for (const caseId of WINNER_CASE_IDS) {
      for (const type of ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW']) {
        expect(validateWinnerCommand({ type, caseId })).toBe(true); expect(isWinnerAcquisitionCommand({ type, caseId })).toBe(false);
        expect(validateWinnerCommand({ type, caseId, target: 'invented' })).toBe(false);
      }
      expect(validateWinnerCommand({ type: 'PREPARE', caseId, method: 'ORDINARY' })).toBe(true);
      expect(validateWinnerCommand({ type: 'PREPARE', caseId, method: 'ABILITY' })).toBe(caseId !== 'honest-account');
    }
    for (const type of ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'REFLECT', 'ACCUMULATE']) {
      expect(validateWinnerCommand({ type })).toBe(true); expect(isWinnerAcquisitionCommand({ type })).toBe(false);
      expect(validateWinnerCommand({ type, amount: 3 })).toBe(false);
    }
    for (const command of [null, {}, { type: 'BREW' }, { type: 'LEARN_FORMULA' }, { type: 'CONSUME', bottleId: 'winner-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'calamity-priest-potion-1' }, { type: 'REROLL' }, { type: 'TRANSFER_LUCK', target: 'ANYONE' }, { type: 'REBOOT' }, { type: 'REFLECT', extra: true }, { type: 'ACCUMULATE', free: true }]) {
      expect(validateWinnerCommand(command)).toBe(false); expect(isWinnerAcquisitionCommand(command)).toBe(false); reject(prepared(), command);
    }
    expect(WINNER_ABILITIES).toHaveLength(2); expect(WINNER_SOURCE_STATUS).toContain('攻击仍可能命中假目标');
    expect(WINNER_SOURCE_STATUS).toContain('普遍等量厄运债'); expect(WINNER_SOURCE_STATUS).toContain('不提前实现序列4');
    expect(WINNER_FORMULA_STATUS).toContain('不冒充已还原原著仪式');
  });
  it('blocks acquisition while the same current or old physical contact remains open', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.winner.cases['falling-counter']!.contactOpen = true; },
      s => { s.winner.practice.counter = 'TRAY'; },
      s => { s.winner.practice.ring = 'MAT'; },
      s => { s.winner.practice.note = 'WRITTEN'; },
      s => { Object.values(s.calamityPriest.cases)[0]!.contactOpen = true; },
      s => { s.calamityPriest.practice.board = 'UNSTABLE'; },
      s => { s.calamityPriest.practice.board = 'FALLEN'; },
      s => { s.calamityPriest.practice.contact = 'FOCUSED'; },
      s => { Object.values(s.lucky.cases)[0]!.contactOpen = true; },
      s => { Object.values(s.machine.cases)[0]!.contactOpen = true; },
      s => { Object.values(s.monster.cases)[0]!.contactOpen = true; },
    ];
    for (const mutate of mutations) {
      const s = prepared(); mutate(s); reject(s, { type: 'CONSUME', bottleId: s.winner.bottles[0]!.id, confirmed: true });
      expect(projectWinner(s).insideCase).toBe(true);
    }
  });
  it('rejects forged supply, duplicate originals and a claimed complete formula', () => {
    const s = taught();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.winner.resupply.requestedWeek = t.week; },
      t => { t.winner.resupply.deliveries = 1; },
      t => { t.winner.bottles[1]!.id = t.winner.bottles[0]!.id; },
      t => { t.winner.bottles[1]!.source = t.calamityPriest.bottles[0]!.id; },
      t => { (t.winner as unknown as Record<string, unknown>).formulaKnown = true; },
      t => { t.calamityPriest.guidanceKnown = false; },
    ];
    for (const change of changes) {
      const t = structuredClone(s); change(t); expect(() => validateWinnerState(t)).not.toThrow(); expect(validateWinnerState(t)).toBe(false);
    }
  });
  it('preserves the prior natural record through migration before any winner acquisition', () => {
    const previous = JSON.parse(readFileSync('tests/fixtures/calamity-priest-v0910/natural.json', 'utf8')).final;
    const s = migrateSliceState(previous);
    for (const key of ['monster', 'machine', 'lucky', 'calamityPriest', 'combatHistory', 'progression'] as const) expect(s[key]).toEqual(previous[key]);
    expect(s.winner).toEqual(createWinnerState()); expect(validateWinnerState(s)).toBe(true);
  });
});
