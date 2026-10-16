import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyCataclysmPriestCommand, createCataclysmPriestState, projectCataclysmPriest, validateCataclysmPriestState, validateCataclysmPriestCommand } from '../../src/domain/cataclysm-priest/index.js';
import { CATACLYSM_PRIEST_ABILITY_IDS, type CataclysmPriestCommand } from '../../src/domain/cataclysm-priest/types.js';
import { CATACLYSM_PRIEST_PRICES, CATACLYSM_PRIEST_FORMULA_STATUS, CATACLYSM_PRIEST_SOURCE_STATUS } from '../../src/domain/cataclysm-priest/content.js';
import { currentCataclysmPriestVisit } from '../../src/domain/cataclysm-priest/ritual.js';

/** Historic S5 replay stays intact. Time, resources and check stats below are explicit unit setup. */
function singer(): SliceState {
  const prior = JSON.parse(readFileSync('tests/fixtures/ocean-singer-v01020/natural.json', 'utf8')).final;
  const s = migrateSliceState(prior); s.cataclysmPriest = createCataclysmPriestState();
  s.week = Math.max(s.week, s.oceanSinger.promotionWeek! + 12); s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.cash = 100000; s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0;
  s.character.coreStats.will = 28; s.character.coreStats.physique = 16; return s;
}
function context(s: SliceState, roll = 1): SeerContext { return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) }; }
function act(s: SliceState, command: CataclysmPriestCommand, roll = 1) { const c = context(s, roll); applyCataclysmPriestCommand(s, command, c); return c; }
function taught() { const s = singer(); act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, i = 0) { const b = s.cataclysmPriest.bottles[i]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
function enter(s: SliceState) { act(s, { type: 'BOOK_RITUAL' }); s.week++; act(s, { type: 'BEGIN_RITUAL' }); act(s, { type: 'CLEAR_COAST' }); act(s, { type: 'CHECK_PREPARATION', confirmed: true }); act(s, { type: 'START_QUAKE', confirmed: true }); }
function ready() { const s = taught(); buy(s); enter(s); return s; }
const dose = (s: SliceState, i = 0) => ({ type: 'CONSUME', bottleId: s.cataclysmPriest.bottles[i]!.id, confirmed: true }) as const;
function reject(s: SliceState, command: unknown) { const before = structuredClone(s), c = context(s); expect(() => applyCataclysmPriestCommand(s, command as CataclysmPriestCommand, c)).toThrow(); expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled(); }
const oldPath = (s: SliceState) => [s.sailor, s.rager, s.navigator, s.windBlessed, s.oceanSinger];

describe('Cataclysm Priest independent originals and deferred S4 promotion', () => {
  it('starts hidden with three independent original bottles and no invented formula', () => {
    const s = createSliceRun('cp4-hidden', sliceDefaultCreationSelection, 'cp4-hidden');
    expect(validateCataclysmPriestState(s)).toBe(true); expect(projectCataclysmPriest(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [] });
    expect(projectCataclysmPriest(s).story).toBeUndefined(); expect(s.cataclysmPriest.bottles).toHaveLength(3);
    const other = createCataclysmPriestState(); other.bottles[0]!.labourSteps = 5; expect(s.cataclysmPriest.bottles[0]!.labourSteps).toBe(0); reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges 520 and one real action, preserving every old original and ability', () => {
    const s = singer(), old = structuredClone(oldPath(s)), mastery = structuredClone(s.progression.mastery);
    act(s, { type: 'LEARN_GUIDANCE' }); expect([s.cash, s.actionsRemaining]).toEqual([99480, 99]); expect(oldPath(s)).toEqual(old); expect(s.progression.mastery).toEqual(mastery);
    expect(CATACLYSM_PRIEST_PRICES).toEqual({ guidance: 520, potion: 7200, labourCredit: 6300 }); expect(CATACLYSM_PRIEST_FORMULA_STATUS).toContain('保持未知'); expect(CATACLYSM_PRIEST_SOURCE_STATUS).toContain('海王3'); expect(validateCataclysmPriestState(s)).toBe(true); reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five actual per-bottle work actions for the 6300 credit', () => {
    const s = taught(), first = s.cataclysmPriest.bottles[0]!, second = s.cataclysmPriest.bottles[1]!;
    for (let i = 0; i < 4; i++) act(s, { type: 'POTION_WORK', bottleId: first.id });
    const beforeSecond = s.cash; buy(s, 1); expect(beforeSecond - s.cash).toBe(7200); expect(second.labourSteps).toBe(0);
    act(s, { type: 'POTION_WORK', bottleId: first.id }); const beforeFirst = s.cash; buy(s); expect(beforeFirst - s.cash).toBe(900);
    expect(s.actionsRemaining).toBe(94); reject(s, { type: 'POTION_WORK', bottleId: first.id }); reject(s, { type: 'BUY_POTION', bottleId: first.id }); expect(validateCataclysmPriestState(s)).toBe(true);
  });
  it.each([{ roll: 1, outcome: 'GREAT_SUCCESS', health: 100, mind: 92, pollution: 0 }, { roll: 30, outcome: 'SUCCESS', health: 100, mind: 85, pollution: 0 }, { roll: 75, outcome: 'FAILURE', health: 85, mind: 75, pollution: 30 }, { roll: 100, outcome: 'GREAT_FAILURE', health: 75, mind: 55, pollution: 60 }])('records raw $outcome while retaining S5 and current original body', ({ roll, outcome, health, mind, pollution }) => {
    const s = ready(), old = structuredClone(oldPath(s)), stats = structuredClone(s.character.coreStats), mastery = structuredClone(s.progression.mastery), actions = s.actionsRemaining, gender = s.character.gender;
    const c = act(s, dose(s), roll), v = currentCataclysmPriestVisit(s)!;
    expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 28); expect([s.health, s.mind, s.seer.pollution]).toEqual([health, mind, pollution]);
    expect(s.cataclysmPriest.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome, consumedWeek: s.week, ritualId: v.id }); expect(v).toMatchObject({ phase: 'DRUNK', elapsedSeconds: 0, rawOutcome: outcome, finishedSuccess: false, pendingBottleId: s.cataclysmPriest.bottles[0]!.id });
    expect(v.kit.status).toBe('CONSUMED'); expect(s.progression.sequence).toBe(5); expect(s.progression.acting).toBe(100); expect(s.character.coreStats).toEqual(stats); expect(s.progression.mastery).toEqual(mastery); expect(oldPath(s)).toEqual(old); expect(s.actionsRemaining).toBe(actions); expect(s.character.gender).toBe(gender); expect(s.spirituality).toBe(31);
    expect(projectCataclysmPriest(s).bottles[0]!.status).toContain('暂定'); expect(validateCataclysmPriestState(s)).toBe(true); reject(s, dose(s));
  });
  it('awards S4 once only after the second actual temporal hazard', () => {
    const s = ready(), old = structuredClone(oldPath(s)), stats = structuredClone(s.character.coreStats), mastery = structuredClone(s.progression.mastery); act(s, dose(s));
    act(s, { type: 'HOLD_POSITION' }, 30); expect(s.progression.sequence).toBe(5); expect(s.health).toBe(96); expect(currentCataclysmPriestVisit(s)!.elapsedSeconds).toBe(60); expect(validateCataclysmPriestState(s)).toBe(true);
    act(s, { type: 'HOLD_POSITION' }, 75); expect(s.progression.sequence).toBe(4); expect(s.health).toBe(84); expect(s.progression.acting).toBe(0); expect(s.cataclysmPriest.oceanSingerActingAtPromotion).toBe(100); expect(s.cataclysmPriest.promotionWeek).toBe(s.week);
    expect(s.progression.mastery).toEqual({ ...mastery, ...Object.fromEntries(CATACLYSM_PRIEST_ABILITY_IDS.map(id => [id, 0])) }); for (const key of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[key]).toBe(stats[key] + 1);
    expect(oldPath(s)).toEqual(old); expect(s.spirituality).toBe(31); expect(currentCataclysmPriestVisit(s)!.finishedSuccess).toBe(true); expect(s.cataclysmPriest.ritual.playerLocation).toBe('PLATFORM'); expect(validateCataclysmPriestState(s)).toBe(true);
    reject(s, { type: 'HOLD_POSITION' }); act(s, { type: 'END_RITUAL' }); expect(s.cataclysmPriest.ritual.playerLocation).toBe('RIDGE'); reject(s, dose(s)); expect(validateCataclysmPriestState(s)).toBe(true);
  });
  it('retains S5 after unsuccessful potion even if both sea stages are survived', () => {
    const s = ready(); act(s, dose(s), 75); act(s, { type: 'HOLD_POSITION' }); act(s, { type: 'HOLD_POSITION' }); act(s, { type: 'END_RITUAL' });
    expect(s.progression.sequence).toBe(5); expect(s.progression.acting).toBe(100); expect(s.cataclysmPriest.promotionWeek).toBeNull(); expect(s.cataclysmPriest.ritual.visits[0]!.finishedSuccess).toBe(false); expect(validateCataclysmPriestState(s)).toBe(true);
  });
  it('replenishes real next-week originals after three raw successful rolls followed by withdrawal', () => {
    const s = taught();
    for (let i = 0; i < 3; i++) { buy(s, i); enter(s); act(s, dose(s, i), 1); act(s, { type: 'LEAVE_RITUAL' }); s.health = 100; s.mind = 100; }
    expect(s.cataclysmPriest.bottles.every(b => b.outcome === 'GREAT_SUCCESS' && b.status === 'CONSUMED')).toBe(true); expect(s.progression.sequence).toBe(5); expect(validateCataclysmPriestState(s)).toBe(true);
    const history = structuredClone(s.cataclysmPriest.ritual.visits); act(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'RECEIVE_SUPPLY' }); s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.cataclysmPriest.bottles).toHaveLength(6); expect(s.cataclysmPriest.bottles[3]).toMatchObject({ id: 'cataclysm-priest-potion-4', stockedWeek: s.week, status: 'SUPPLIER', outcome: null }); expect(s.cataclysmPriest.ritual.visits).toEqual(history); expect(validateCataclysmPriestState(s)).toBe(true);
  });
  it.each(['health', 'mind', 'acting', 'weeks', 'confirmation'] as const)('enforces exact $0 consumption gate before rolling or spending the bottle', gate => {
    const s = ready(); if (gate === 'health') s.health = 20; if (gate === 'mind') s.mind = 40; if (gate === 'acting') s.progression.acting = 99; if (gate === 'weeks') s.oceanSinger.promotionWeek = s.week - 11;
    reject(s, gate === 'confirmation' ? { ...dose(s), confirmed: false } : dose(s));
  });
  it('does not accept a raw-success bottle as proof that S4 was actually completed', () => {
    const s = ready(); act(s, dose(s)); const forged = structuredClone(s); forged.cataclysmPriest.promotionWeek = s.week; forged.cataclysmPriest.oceanSingerActingAtPromotion = 100; forged.progression.sequence = 4; forged.progression.acting = 0; for (const id of CATACLYSM_PRIEST_ABILITY_IDS) forged.progression.mastery[id] = 0;
    expect(validateCataclysmPriestState(forged)).toBe(false); expect(validateCataclysmPriestState(s)).toBe(true);
  });
  it('strictly rejects alternate bottles, implicit consent and injected phase facts', () => {
    for (const command of [{ type: 'CONSUME', bottleId: 'ocean-singer-potion-2', confirmed: true }, { type: 'CONSUME', bottleId: 'cataclysm-priest-potion-1' }, { type: 'START_QUAKE', confirmed: true, staffCleared: true }, { type: 'HOLD_POSITION', survived: true }, { type: 'LEARN_GUIDANCE', free: true }]) expect(validateCataclysmPriestCommand(command)).toBe(false);
  });
});
