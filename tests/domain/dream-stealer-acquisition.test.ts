import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { MARAUDER_ABILITY_IDS } from '../../src/domain/marauder/types.js';
import { SWINDLER_ABILITY_IDS } from '../../src/domain/swindler/types.js';
import { CRYPTOLOGIST_ABILITY_IDS } from '../../src/domain/cryptologist/types.js';
import { FIRE_THIEF_ABILITY_IDS } from '../../src/domain/fire-thief/types.js';
import { applyDreamStealerCommand, createDreamStealerState, isDreamStealerAcquisitionCommand, projectDreamStealer, validateDreamStealerCommand, validateDreamStealerState } from '../../src/domain/dream-stealer/index.js';
import { DREAM_STEALER_ABILITIES, DREAM_STEALER_FORMULA_STATUS, DREAM_STEALER_PRICES, DREAM_STEALER_SOURCE_STATUS } from '../../src/domain/dream-stealer/content.js';
import { DREAM_STEALER_ABILITY_IDS, type DreamStealerAcquisitionCommand } from '../../src/domain/dream-stealer/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function fireThief(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/fire-thief-v0840/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.dreamStealer = createDreamStealerState(); s.week = s.fireThief.promotionWeek! + 12;
  s.activeEvent = null; s.eventQueue = []; s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 26;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: DreamStealerAcquisitionCommand, roll = 1) {
  const c = context(s, roll); applyDreamStealerCommand(s, command, c); return c;
}
function taught(s = fireThief()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const b = s.dreamStealer.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() {
  const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.dreamStealer.bottles[0]!.id, confirmed: true }); return s;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyDreamStealerCommand(s, command as DreamStealerAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('DreamStealer S5 finished originals and bounded G promotion', () => {
  it('hides the future channel and creates independent original bottles and practice state', () => {
    const s = createSliceRun('dream-stealer-hidden', sliceDefaultCreationSelection, 'dream-stealer-hidden');
    expect(validateDreamStealerState(s)).toBe(true);
    expect(projectDreamStealer(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', practice: null });
    expect(projectDreamStealer(s).story).toBeUndefined();
    const other = createDreamStealerState(); other.practice.playerPose = 'SEATED'; other.practice.thefts = 1; other.bottles[0]!.labourSteps = 5;
    expect(s.dreamStealer.practice.playerPose).toBe('STANDING'); expect(s.dreamStealer.practice.thefts).toBe(0); expect(s.dreamStealer.bottles[0]!.labourSteps).toBe(0);
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('opens the existing fireThief channel and takes 460 plus one action without revealing a formula or ritual', () => {
    const s = fireThief(), old = structuredClone([s.marauder, s.swindler, s.cryptologist, s.fireThief]);
    expect(validateDreamStealerState(s)).toBe(true);
    expect(projectDreamStealer(s)).toMatchObject({ discovered: true, promoted: false, acting: 0, practice: null });
    const c = act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([29540, 99]); expect(c.check).not.toHaveBeenCalled();
    expect([s.marauder, s.swindler, s.cryptologist, s.fireThief]).toEqual(old);
    expect(DREAM_STEALER_PRICES).toEqual({ guidance: 460, potion: 4800, labourCredit: 4200 });
    expect(DREAM_STEALER_FORMULA_STATUS).toContain('完整配方与晋升仪式细节尚未核实');
    expect(projectDreamStealer(s)).toMatchObject({ formulaKnown: false, formula: [] });
    expect(DREAM_STEALER_FORMULA_STATUS).toContain('不能据未知细节断言无需仪式');
    expect(c.note).toHaveBeenCalledWith('听取窃梦家用药说明', expect.stringContaining('实际核对原瓶、准备原练习室安静场地'));
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five real labour actions and 600 payment per bottle, with no transferable or partial credit', () => {
    const s = taught(), b = s.dreamStealer.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([28940, 94, 'PLAYER']);
    const second = s.dreamStealer.bottles[1]!; expect(second.labourSteps).toBe(0);
    act(s, { type: 'POTION_WORK', bottleId: second.id }); const cash = s.cash; buy(s, 1);
    expect(cash - s.cash).toBe(4800); expect(validateDreamStealerState(s)).toBe(true);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); reject(s, { type: 'POTION_WORK', bottleId: b.id });
    s.cash = 4799; reject(s, { type: 'BUY_POTION', bottleId: s.dreamStealer.bottles[2]!.id });
  });
  it('allows early preparation but requires fireThief digestion100 and twelve complete weeks before drinking', () => {
    const s = fireThief(); s.week = s.fireThief.promotionWeek!; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validateDreamStealerState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week += 11; s.progression.acting = 100;
    expect(projectDreamStealer(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week++; s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(s.progression.sequence).toBe(5);
  });
  it('consumes exactly the selected original and applies all four fixed guided result tiers', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 95, 100, 0, 5], [30, 'SUCCESS', 90, 100, 0, 5], [85, 'FAILURE', 80, 90, 25, 6], [100, 'GREAT_FAILURE', 60, 80, 50, 6]] as const;
    for (const [roll, tier, mind, health, pollution, sequence] of tiers) {
      const s = prepared(), old = { ...s.progression.mastery }, b = s.dreamStealer.bottles[0]!;
      const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 26);
      expect(c.note).toHaveBeenCalledWith('导师完成本次窃梦家服药准备', expect.stringContaining(b.id));
      expect([b.status, b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, pollution, sequence, 'ACTIVE']);
      for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
      expect(s.dreamStealer.bottles.slice(1).every(x => x.status === 'SUPPLIER')).toBe(true);
      if (sequence === 6) expect(s.progression.acting).toBe(100);
      expect(validateDreamStealerState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('requires health above20 and mind above40 without rolling or consuming a bottle at the boundary', () => {
    for (const [health, mind] of [[20, 100], [100, 40], [1, 1]]) {
      const s = prepared(); s.health = health!; s.mind = mind!;
      reject(s, { type: 'CONSUME', bottleId: s.dreamStealer.bottles[0]!.id, confirmed: true });
      expect(s.dreamStealer.bottles[0]!.status).toBe('PLAYER');
      expect(projectDreamStealer(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('先休养');
    }
  });
  it('preserves all old IDs, exact actual loan histories and resolved enemies while adding one zero mastery', () => {
    const s = prepared(), old = structuredClone([s.marauder, s.swindler, s.cryptologist, s.fireThief, s.combatHistory]), stats = { ...s.character.coreStats };
    act(s, { type: 'CONSUME', bottleId: s.dreamStealer.bottles[0]!.id, confirmed: true });
    expect([s.marauder, s.swindler, s.cryptologist, s.fireThief, s.combatHistory]).toEqual(old);
    expect(s.dreamStealer.fireThiefActingAtPromotion).toBe(100);
    expect(s.fireThief.cases['borrowed-flash']).toMatchObject({ borrowedSample: 'FROST', usedCount: 2, sourceRestored: true });
    expect(s.fireThief.cases['separate-windows']).toMatchObject({ borrowedSample: 'COURAGE', usedCount: 2, sourceRestored: true });
    expect(s.fireThief.encounter.status).toBe('RESOLVED');
    expect(Object.keys(s.progression.mastery)).toEqual([...MARAUDER_ABILITY_IDS, ...SWINDLER_ABILITY_IDS, ...CRYPTOLOGIST_ABILITY_IDS, ...FIRE_THIEF_ABILITY_IDS, ...DREAM_STEALER_ABILITY_IDS]);
    expect(DREAM_STEALER_ABILITY_IDS).toEqual(['error.s5.thought-theft']);
    expect(s.progression.mastery['error.s5.thought-theft']).toBe(0);
    expect(s.dreamStealer.practice).toEqual({ playerPose: 'STANDING', targetPaused: false, targetRecovered: true, token: 'TARGET_DESK', thefts: 0, executions: 0, recoveries: 0, tokenMoves: 0 });
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]);
    expect(DREAM_STEALER_ABILITIES).toHaveLength(1);
    expect(DREAM_STEALER_ABILITIES[0]!.description).toContain('本人在同一动作立即执行');
    expect(DREAM_STEALER_SOURCE_STATUS).toContain('不等于同时偷到对应能力');
    expect(DREAM_STEALER_SOURCE_STATUS).toContain('没有自身心智');
    expect(DREAM_STEALER_SOURCE_STATUS).toContain('序列4寄生者');
    expect(projectDreamStealer(s).digestion).toContain('窃梦家扮演0/100');
    expect(validateDreamStealerState(s)).toBe(true);
  });
  it('retains failed originals and waits a real week for the next batch without free delivery to the player', () => {
    const s = taught(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let n = 0; n < 3; n++) { const b = buy(s, n); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.dreamStealer.bottles), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.dreamStealer.bottles.slice(0, 3)).toEqual(originals); expect(s.dreamStealer.bottles).toHaveLength(6);
    expect(s.dreamStealer.bottles[3]).toMatchObject({ id: 'dream-stealer-potion-4', status: 'SUPPLIER', acquiredWeek: null, labourSteps: 0 });
    expect(projectDreamStealer(s).actions.find(a => a.id === 'buy-dream-stealer-potion-4')!.cost).toContain('4800便士');
    expect(validateDreamStealerState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('uses zero actions for actual purchase and confirmed consumption of the selected second original', () => {
    const s = taught(); s.actionsRemaining = 0;
    const first = structuredClone(s.dreamStealer.bottles[0]), second = buy(s, 1);
    act(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
    expect(s.actionsRemaining).toBe(0);
    expect(s.dreamStealer.bottles[0]).toEqual(first);
    expect(second).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_SUCCESS' });
    expect(validateDreamStealerState(s)).toBe(true);
    reject(s, { type: 'REQUEST_SUPPLY' });
    reject(s, { type: 'BUY_POTION', bottleId: s.dreamStealer.bottles[2]!.id });
  });
  it('keeps action costs, location, event and finished-run boundaries atomic', () => {
    const withoutAction = fireThief(); withoutAction.actionsRemaining = 0;
    reject(withoutAction, { type: 'LEARN_GUIDANCE' });
    const withoutCash = fireThief(); withoutCash.cash = 459;
    reject(withoutCash, { type: 'LEARN_GUIDANCE' });
    const dead = prepared(); dead.status = 'DEAD';
    reject(dead, { type: 'CONSUME', bottleId: dead.dreamStealer.bottles[0]!.id, confirmed: true });
    const elsewhere = taught(); elsewhere.world.city = 'ELSEWHERE';
    reject(elsewhere, { type: 'BUY_POTION', bottleId: elsewhere.dreamStealer.bottles[0]!.id });
    const blocked = taught(); blocked.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
    reject(blocked, { type: 'POTION_WORK', bottleId: blocked.dreamStealer.bottles[0]!.id });
  });
  it('rejects invented commands and extra fields while keeping exact life commands outside acquisition', () => {
    const malformed = [null, {}, { type: 'BREW' }, { type: 'CONSUME', bottleId: 'dream-stealer-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'fire-thief-potion-1' }, { type: 'USE', caseId: 'intended-reach' }, { type: 'REFLECT', extra: true }, { type: 'PREPARE', caseId: 'announced-seat', method: 'ASTROLOGY' }];
    for (const command of malformed) {
      expect(validateDreamStealerCommand(command)).toBe(false); expect(isDreamStealerAcquisitionCommand(command)).toBe(false); reject(prepared(), command);
    }
    for (const command of [{ type: 'CLOSE', caseId: 'intended-reach' }, { type: 'PREPARE', caseId: 'empty-performance', method: 'ABILITY' }]) {
      expect(validateDreamStealerCommand(command)).toBe(true); expect(isDreamStealerAcquisitionCommand(command)).toBe(false); reject(promoted(), command);
    }
  });
  it('rejects forged sources, chronology, promotion snapshots, mastery and malformed nested saves without throwing', () => {
    const s = promoted();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.dreamStealer.bottles[0]!.source = 'invented'; },
      t => { t.dreamStealer.bottles[0]!.consumedWeek = t.dreamStealer.promotionWeek! - 1; },
      t => { t.dreamStealer.fireThiefActingAtPromotion = 99; },
      t => { delete t.progression.mastery[MARAUDER_ABILITY_IDS[0]]; },
      t => { t.progression.mastery['error.s5.free-power'] = 0; },
      t => { t.dreamStealer.bottles[1]!.labourSteps = 6; },
      t => { (t.dreamStealer as unknown as Record<string, unknown>).practice = null; },
      t => { t.dreamStealer.practice.playerPose = 'SEATED'; },
      t => { t.dreamStealer.practice.token = 'TARGET_HAND'; },
      t => { t.dreamStealer.practice.targetPaused = true; },
      t => { t.dreamStealer.practice.targetRecovered = false; },
      t => { t.dreamStealer.practice.thefts = 1; },
      t => { t.dreamStealer.practice.executions = 1; },
      t => { t.dreamStealer.practice.recoveries = 1; },
      t => { t.dreamStealer.practice.tokenMoves = 1; },
      t => { (t.dreamStealer.practice as unknown as Record<string, unknown>).storedThought = 'SIT'; },
      t => { (t.dreamStealer.cases as unknown as Record<string, unknown>)['announced-seat'] = null; },
      t => { (t.dreamStealer as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) {
      const t = structuredClone(s); change(t); expect(() => validateDreamStealerState(t)).not.toThrow(); expect(validateDreamStealerState(t)).toBe(false);
    }
  });
  it('projects one bounded S5 capability without exposing mutable practice state', () => {
    const s = promoted(), p = projectDreamStealer(s);
    expect(p.practice).toBeNull();
    expect(p.abilities.map(x => x.id)).toEqual([...DREAM_STEALER_ABILITY_IDS]);
    expect(p).toMatchObject({ promoted: true, formulaKnown: false, formula: [], insideCase: false, cases: [] });
    expect(p.actions.every(a => !a.enabled)).toBe(true);
    p.abilities[0]!.mastery = 99; expect(s.progression.mastery[DREAM_STEALER_ABILITY_IDS[0]]).toBe(0);
    const before = structuredClone(s); projectDreamStealer(s); expect(s).toEqual(before);
  });
  it('accepts only exact finite-case commands and rejects invented dream or thought-storage actions', () => {
    for (const caseId of ['announced-seat', 'intended-reach', 'empty-performance']) {
      for (const type of ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW']) {
        expect(validateDreamStealerCommand({ type, caseId })).toBe(true);
        expect(isDreamStealerAcquisitionCommand({ type, caseId })).toBe(false);
        expect(validateDreamStealerCommand({ type, caseId, target: 'invented' })).toBe(false);
      }
      expect(validateDreamStealerCommand({ type: 'PREPARE', caseId, method: 'ORDINARY' })).toBe(true);
    }
    for (const type of ['STEAL_DREAM', 'STORE_THOUGHT', 'SKIP_SELF_EXECUTION', 'BORROW_POWER', 'PARASITIZE', 'USE', 'WAIT']) {
      expect(validateDreamStealerCommand({ type })).toBe(false);
      reject(promoted(), { type });
    }
  });
  it('leaves both canon-unknown recipe and ritual details unknown and retains original guide and volunteer identities', () => {
    expect(DREAM_STEALER_FORMULA_STATUS).toContain('完整配方与晋升仪式细节尚未核实');
    expect(DREAM_STEALER_FORMULA_STATUS).toContain('不冒充已还原原著仪式');
    expect(DREAM_STEALER_SOURCE_STATUS).toContain('瑟蕾·芬恩');
    expect(DREAM_STEALER_SOURCE_STATUS).toContain('诺汀·布莱尔');
    expect(DREAM_STEALER_SOURCE_STATUS).toContain('艾德温·洛克');
    expect(DREAM_STEALER_SOURCE_STATUS).toContain('没有全局梦境操控');
    expect(DREAM_STEALER_SOURCE_STATUS).toContain('准备同意不会提前');
    expect(DREAM_STEALER_ABILITIES.every(a => a.id === 'error.s5.thought-theft')).toBe(true);
  });
  it('blocks acquisition during actual practice contact, pose, pause or the original token away from its desk', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.dreamStealer.cases['announced-seat']!.contactOpen = true; },
      s => { s.dreamStealer.practice.playerPose = 'SEATED'; },
      s => { s.dreamStealer.practice.playerPose = 'REACHING'; },
      s => { s.dreamStealer.practice.targetPaused = true; },
      s => { s.dreamStealer.practice.token = 'TARGET_HAND'; },
    ];
    for (const mutate of mutations) {
      const s = prepared(); mutate(s);
      reject(s, { type: 'CONSUME', bottleId: s.dreamStealer.bottles[0]!.id, confirmed: true });
      expect(projectDreamStealer(s).insideCase).toBe(true);
    }
  });
  it('preserves exact old FireThief records and actual histories through migration before any new activity', () => {
    const previous = JSON.parse(readFileSync('tests/fixtures/fire-thief-v0840/natural.json', 'utf8')).final;
    const s = migrateSliceState(previous);
    for (const key of ['marauder', 'swindler', 'cryptologist', 'fireThief', 'combatHistory', 'progression'] as const) {
      expect(s[key]).toEqual(previous[key]);
    }
    expect(s.dreamStealer).toEqual(createDreamStealerState());
    expect(validateDreamStealerState(s)).toBe(true);
  });
});
