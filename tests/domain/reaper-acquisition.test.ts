import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { HUNTER_ABILITY_IDS } from '../../src/domain/hunter/types.js';
import { PROVOKER_ABILITY_IDS } from '../../src/domain/provoker/types.js';
import { PYROMANIAC_ABILITY_IDS } from '../../src/domain/pyromaniac/types.js';
import { CONSPIRATOR_ABILITY_IDS } from '../../src/domain/conspirator/types.js';
import { applyReaperCommand, createReaperState, isReaperAcquisitionCommand, projectReaper, validateReaperCommand, validateReaperState } from '../../src/domain/reaper/index.js';
import { REAPER_FORMULA_STATUS, REAPER_PRICES, REAPER_SOURCE_STATUS } from '../../src/domain/reaper/content.js';
import { REAPER_ABILITY_IDS, type ReaperAcquisitionCommand } from '../../src/domain/reaper/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function conspirator(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/conspirator-v0740/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.reaper = createReaperState(); s.week = s.conspirator.promotionWeek! + 12;
  s.activeEvent = null; s.eventQueue = []; s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 26;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: ReaperAcquisitionCommand, roll = 1) { const c = context(s, roll); applyReaperCommand(s, command, c); return c; }
function taught(s = conspirator()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const b = s.reaper.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.reaper.bottles[0]!.id, confirmed: true }); return s; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyReaperCommand(s, command as ReaperAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Reaper S5 original supplies and inherited promotion', () => {
  it('hides the future channel and creates independent empty state and original bottles', () => {
    const s = createSliceRun('reaper-hidden', sliceDefaultCreationSelection, 'reaper-hidden');
    expect(validateReaperState(s)).toBe(true);
    expect(projectReaper(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '' });
    expect(projectReaper(s).story).toBeUndefined();
    const other = createReaperState(); other.cases['moving-shutter']!.practice.windowOpen = true; other.bottles[0]!.labourSteps = 5;
    expect(s.reaper.cases['moving-shutter']!.practice.windowOpen).toBe(false); expect(s.reaper.bottles[0]!.labourSteps).toBe(0);
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('does not mistake the existing S6 stage for an already promoted Reaper', () => {
    const s = conspirator();
    expect(validateReaperState(s)).toBe(true);
    expect(projectReaper(s)).toMatchObject({ discovered: true, promoted: false, acting: 0 });
    expect(projectReaper(s).actions.find(a => a.command.type === 'LEARN_GUIDANCE')?.enabled).toBe(true);
  });
  it('takes 420 and one action for guidance while formula and ritual stay unverified', () => {
    const s = conspirator(), prior = structuredClone([s.hunter, s.provoker, s.pyromaniac, s.conspirator]);
    const c = act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([29580, 99]); expect(c.check).not.toHaveBeenCalled();
    expect([s.hunter, s.provoker, s.pyromaniac, s.conspirator]).toEqual(prior);
    expect(REAPER_PRICES).toEqual({ guidance: 420, potion: 4600, labourCredit: 4000 });
    expect(REAPER_FORMULA_STATUS).toContain('完整配方与晋升仪式尚未核实');
    expect(projectReaper(s)).toMatchObject({ formulaKnown: false, formula: [] }); reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five actual labour actions for one bottle and the remaining 600 payment', () => {
    const s = taught(), b = s.reaper.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([28980, 94, 'PLAYER']);
    expect(s.reaper.bottles[1]!.labourSteps).toBe(0); expect(validateReaperState(s)).toBe(true);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); reject(s, { type: 'POTION_WORK', bottleId: b.id });
  });
  it('does not partially discount or move labour credit to another original bottle', () => {
    const s = taught(); act(s, { type: 'POTION_WORK', bottleId: s.reaper.bottles[0]!.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(4600);
    expect(s.reaper.bottles[1]!.labourSteps).toBe(0); s.cash = 4599;
    reject(s, { type: 'BUY_POTION', bottleId: s.reaper.bottles[1]!.id });
  });
  it('allows early preparation but drinking needs S6 digestion100 and twelve complete weeks', () => {
    const s = conspirator(); s.week = s.conspirator.promotionWeek!; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validateReaperState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week += 11; s.progression.acting = 100;
    expect(projectReaper(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week++; s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(s.progression.sequence).toBe(5);
  });
  it.each([[1, 'GREAT_SUCCESS', 95, 100, 0, 5], [30, 'SUCCESS', 90, 100, 0, 5], [85, 'FAILURE', 80, 90, 25, 6], [100, 'GREAT_FAILURE', 60, 80, 50, 6]] as const)('keeps the original bottle and four-tier guided result for roll%s', (roll, tier, mind, health, pollution, sequence) => {
    const s = prepared(), old = { ...s.progression.mastery }, b = s.reaper.bottles[0]!;
    const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
    expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 26);
    expect([b.status, b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, pollution, sequence, 'ACTIVE']);
    for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
    if (sequence === 6) expect(s.progression.acting).toBe(100);
    expect(validateReaperState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
  });
  it.each([[20, 100], [100, 40], [1, 1]] as const)('requires recovery before a low-resource guided attempt H%s M%s without consuming or rolling', (health, mind) => {
    const s = prepared(); s.health = health; s.mind = mind;
    reject(s, { type: 'CONSUME', bottleId: s.reaper.bottles[0]!.id, confirmed: true });
    expect(s.reaper.bottles[0]!.status).toBe('PLAYER');
    expect(projectReaper(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('先休养');
  });
  it('inherits every original ID, adds only two zero masteries and four +1 stats, and does not refill spirituality', () => {
    const s = prepared(), old = structuredClone([s.hunter, s.provoker, s.pyromaniac, s.conspirator]), stats = { ...s.character.coreStats };
    act(s, { type: 'CONSUME', bottleId: s.reaper.bottles[0]!.id, confirmed: true });
    expect([s.hunter, s.provoker, s.pyromaniac, s.conspirator]).toEqual(old); expect(s.reaper.conspiratorActingAtPromotion).toBe(100);
    expect(Object.keys(s.progression.mastery)).toEqual([...HUNTER_ABILITY_IDS, ...PROVOKER_ABILITY_IDS, ...PYROMANIAC_ABILITY_IDS, ...CONSPIRATOR_ABILITY_IDS, ...REAPER_ABILITY_IDS]);
    expect(REAPER_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]);
    expect(projectReaper(s)).toMatchObject({ acting: 0, promoted: true }); expect(projectReaper(s).digestion).toContain('收割者扮演0/100');
    expect(REAPER_SOURCE_STATUS).toContain('丧钟'); expect(REAPER_SOURCE_STATUS).toContain('序列4');
  });
  it('keeps all failed originals and waits a real week before the next priced batch of three', () => {
    const s = taught();
    for (let n = 0; n < 3; n++) { const b = buy(s, n); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.reaper.bottles), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.reaper.bottles.slice(0, 3)).toEqual(originals); expect(s.reaper.bottles).toHaveLength(6);
    expect(s.reaper.bottles[3]).toMatchObject({ id: 'reaper-potion-4', status: 'SUPPLIER', acquiredWeek: null, labourSteps: 0 });
    expect(projectReaper(s).actions.find(a => a.id === 'buy-reaper-potion-4')!.cost).toContain('4600便士');
    expect(validateReaperState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it.each([null, {}, { type: 'BREW' }, { type: 'CONSUME', bottleId: 'reaper-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'conspirator-potion-1' }, { type: 'SIGNAL', caseId: 'guarded-flame' }, { type: 'SIGNAL', caseId: 'moving-shutter', automatic: true }, { type: 'REFLECT', extra: true }, { type: 'PREPARE', caseId: 'timber-seam', method: 'ARTIFACT' }])('rejects invented or malformed commands %# without side effects', command => {
    expect(validateReaperCommand(command)).toBe(false); expect(isReaperAcquisitionCommand(command)).toBe(false); reject(prepared(), command);
  });
  it('accepts the exact independent signal only as an activity', () => {
    const signal = { type: 'SIGNAL', caseId: 'moving-shutter' };
    expect(validateReaperCommand(signal)).toBe(true); expect(isReaperAcquisitionCommand(signal)).toBe(false); reject(promoted(), signal);
  });
  it('rejects forged sources, chronology, snapshots, mastery and malformed nested state without throwing', () => {
    const s = promoted();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.reaper.bottles[0]!.source = 'invented'; }, t => { t.reaper.bottles[0]!.consumedWeek = t.reaper.promotionWeek! - 1; },
      t => { t.reaper.conspiratorActingAtPromotion = 99; }, t => { delete t.progression.mastery[HUNTER_ABILITY_IDS[0]]; },
      t => { t.reaper.bottles[1]!.labourSteps = 6; }, t => { t.reaper.encounter.weakness.observations = 1; },
      t => { (t.reaper.encounter as unknown as Record<string, unknown>).weakness = null; },
      t => { (t.reaper.cases['timber-seam'] as unknown as Record<string, unknown>).practice = null; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateReaperState(t)).not.toThrow(); expect(validateReaperState(t)).toBe(false); }
  });
});
