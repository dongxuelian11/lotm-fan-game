import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyUndyingAcquisition, createUndyingState, expectedUndyingCycleDate, projectUndying, validateUndyingCommand, validateUndyingState } from '../../src/domain/undying/index.js';
import { UNDYING_FORMULA_STATUS, UNDYING_LIFECYCLE_BOUNDARY, UNDYING_PRICES, UNDYING_SOURCE_STATUS } from '../../src/domain/undying/content.js';
import { UNDYING_ABILITY_IDS, type UndyingAcquisitionCommand } from '../../src/domain/undying/types.js';
import { applyUndyingRitualCommand, currentUndyingVisit, hasUndyingRitualLock, type UndyingRitualCommand } from '../../src/domain/undying/ritual.js';

/** Original S5 replay retained. Resources and date changes below are unit setup, not natural play. */
function gatekeeper(): SliceState {
  const prior = JSON.parse(readFileSync('tests/fixtures/gatekeeper-v01040/natural.json', 'utf8')).final;
  const s = migrateSliceState(prior), addedWeeks = Math.max(0, s.gatekeeper.promotionWeek! + 12 - s.week);
  s.week += addedWeeks; s.date = addGameWeeks(s.date, addedWeeks); s.undying = createUndyingState();
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 28;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: UndyingAcquisitionCommand, roll = 1) { const c = context(s, roll); applyUndyingAcquisition(s, command, c); return c; }
function ritual(s: SliceState, command: UndyingRitualCommand) { applyUndyingRitualCommand(s, command, context(s)); }
function nextWeek(s: SliceState) { s.week += 1; s.date = addGameWeeks(s.date, 1); }
function taught() { const s = gatekeeper(); apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const b = s.undying.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.undying.bottles[index]!.id, confirmed: true }) as const;
function prepare(s: SliceState) { ritual(s, { type: 'BOOK_RITUAL' }); nextWeek(s); ritual(s, { type: 'BEGIN_RITUAL' }); ritual(s, { type: 'CHECK_PREPARATION', confirmed: true }); }
function ready() { const s = taught(); buy(s); prepare(s); return s; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyUndyingAcquisition(s, command as UndyingAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}
const oldPath = (s: SliceState) => [s.corpsecollector, s.gravedigger, s.spiritmedium, s.spiritGuide, s.gatekeeper];

describe('Undying4 independent potion acquisition and bounded lifecycle registration', () => {
  it('starts undiscovered with three independent originals, no formula and no experienced cycle', () => {
    const s = createSliceRun('undying-hidden', sliceDefaultCreationSelection, 'undying-hidden');
    expect(validateUndyingState(s)).toBe(true);
    expect(projectUndying(s)).toMatchObject({ discovered: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], lifecycle: { promotionDate: null, expectedCycleDate: null, experiencedCycles: 0, status: 'NOT_PROMOTED' } });
    expect(projectUndying(s).story).toBeUndefined();
    const other = createUndyingState(); other.bottles[0]!.labourSteps = 5;
    expect(s.undying.bottles[0]!.labourSteps).toBe(0); reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges 520 and one action, preserves every old Death stage and leaves complete canon unknown', () => {
    const s = gatekeeper(), old = structuredClone(oldPath(s)); apply(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([99480, 99]); expect(oldPath(s)).toEqual(old);
    expect(UNDYING_PRICES).toEqual({ guidance: 520, potion: 6600, labourCredit: 5100 });
    expect(UNDYING_FORMULA_STATUS).toContain('完整主辅配方'); expect(UNDYING_FORMULA_STATUS).toContain('保持未知');
    expect(projectUndying(s).formula).toEqual([]); expect(new Set(s.undying.bottles.map(b => b.source)).size).toBe(3);
    expect(validateUndyingState(s)).toBe(true); reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires all five paid-action jobs on the same original before its price becomes 1500', () => {
    const s = taught(), b = s.undying.bottles[0]!;
    for (let n = 0; n < 5; n++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, s.actionsRemaining, b.status]).toEqual([5, 94, 'SUPPLIER']); reject(s, { type: 'POTION_WORK', bottleId: b.id });
    buy(s); expect([s.cash, b.status, b.acquiredWeek]).toEqual([97980, 'PLAYER', s.week]);
    expect(s.undying.bottles[1]!.labourSteps).toBe(0); expect(s.undying.ritual.visits).toEqual([]);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); expect(validateUndyingState(s)).toBe(true);
  });
  it('does not partially discount, transfer old labour or gift a preparation kit', () => {
    const s = taught(), b = s.undying.bottles[0]!;
    for (let n = 0; n < 4; n++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(6600);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); s.cash = 6599; reject(s, { type: 'BUY_POTION', bottleId: s.undying.bottles[1]!.id });
    expect(s.undying.ritual.visits).toEqual([]); reject(s, dose(s));
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 4], [30, 'SUCCESS', 85, 100, 0, 4], [90, 'FAILURE', 75, 85, 30, 5], [100, 'GREAT_FAILURE', 55, 75, 60, 5]] as const)(
    'roll %s produces %s without replacing the body, spirit or old history', (roll, tier, mind, health, pollution, sequence) => {
      const s = ready(), old = structuredClone(oldPath(s)), mastery = { ...s.progression.mastery }, stats = { ...s.character.coreStats }, date = { ...s.date }, gender = s.character.gender;
      const visit = currentUndyingVisit(s)!, b = s.undying.bottles[0]!; s.actionsRemaining = 0;
      const c = apply(s, dose(s), roll); expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 28);
      expect([b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
      expect(b).toMatchObject({ status: 'CONSUMED', ritualId: visit.id, ritualWindowWeek: s.week, consumedWeek: s.week });
      expect(visit).toMatchObject({ status: 'OPEN', closedWeek: null, consumedBottleId: b.id, kit: { status: 'CONSUMED', location: 'TABLE', sealsIntact: false, consumedWeek: s.week } });
      expect(s.undying.ritual.playerLocation).toBe('HALL'); expect(hasUndyingRitualLock(s)).toBe(true);
      expect(oldPath(s)).toEqual(old); expect(s.character.gender).toBe(gender); expect(s.date).toEqual(date);
      for (const [id, value] of Object.entries(mastery)) expect(s.progression.mastery[id]).toBe(value);
      if (sequence === 4) {
        expect(s.undying.gatekeeperActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
        expect(UNDYING_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0]);
        expect(s.undying.lifecycle).toEqual({ promotionDate: date, expectedCycleDate: expectedUndyingCycleDate(date), experiencedCycles: 0, status: 'REGISTERED_NOT_EXPERIENCED' });
        expect(s.undying.lifecycle.promotionDate).not.toBe(s.date);
        for (const key of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[key]).toBe(stats[key] + 1);
      } else { expect(s.progression.acting).toBe(100); expect(s.undying.lifecycle.status).toBe('NOT_PROMOTED'); }
      expect(validateUndyingState(s)).toBe(true); reject(s, dose(s)); ritual(s, { type: 'END_RITUAL' });
      expect(visit.status).toBe('CLOSED'); expect(s.undying.ritual.playerLocation).toBe('OUTSIDE'); expect(validateUndyingState(s)).toBe(true);
    });
  it('applies only the guided potion floor and pollution cap, never healing the failed player', () => {
    const s = ready(); s.health = 21; s.mind = 41; s.seer.pollution = 90; apply(s, dose(s), 100);
    expect([s.health, s.mind, s.status, s.progression.sequence, s.seer.pollution, s.spirituality]).toEqual([1, 1, 'ACTIVE', 5, 100, 31]);
    expect(validateUndyingState(s)).toBe(true); ritual(s, { type: 'END_RITUAL' }); expect([s.health, s.mind]).toEqual([1, 1]);
  });
  it('checks original ownership, health, full digestion, twelve whole weeks and independent consent before drawing', () => {
    const s = ready(); s.progression.acting = 99; reject(s, dose(s)); s.progression.acting = 100;
    const promotion = s.gatekeeper.promotionWeek; s.gatekeeper.promotionWeek = s.week - 11; reject(s, dose(s)); s.gatekeeper.promotionWeek = promotion;
    s.health = 20; reject(s, dose(s)); s.health = 100; s.mind = 40; reject(s, dose(s)); s.mind = 100;
    reject(s, dose(s, 1));
    for (const command of [{ type: 'CONSUME', bottleId: dose(s).bottleId }, { ...dose(s), confirmed: false }, { ...dose(s), alreadyDead: true }]) { expect(validateUndyingCommand(command)).toBe(false); reject(s, command); }
    nextWeek(s); reject(s, dose(s));
  });
  it('keeps all failed originals and requires a real next week before the fourth priced bottle', () => {
    const s = taught();
    for (let n = 0; n < 3; n++) {
      buy(s, n); prepare(s); apply(s, dose(s, n), 100); ritual(s, { type: 'END_RITUAL' }); s.health = 100; s.mind = 100;
      if (n < 2) reject(s, { type: 'REQUEST_SUPPLY' });
    }
    const originals = structuredClone(s.undying.bottles), visits = structuredClone(s.undying.ritual.visits), ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); reject(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'RECEIVE_SUPPLY' });
    nextWeek(s); apply(s, { type: 'RECEIVE_SUPPLY' }); expect(s.undying.bottles).toHaveLength(6);
    expect(s.undying.bottles.slice(0, 3)).toEqual(originals); expect(s.undying.ritual.visits).toEqual(visits);
    expect(s.undying.bottles[3]).toMatchObject({ id: 'undying-potion-4', stockedWeek: s.week, status: 'SUPPLIER', labourSteps: 0 });
    expect(projectUndying(s).actions.find(a => a.id === 'buy-undying-potion-4')!.cost).toContain('6600便士');
    expect(validateUndyingState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('persists fixed date copies without advancing time, aging witnesses or simulating a cycle', () => {
    const s = ready(); s.date = { epoch: 'FIFTH_EPOCH', year: 2040, month: 2, day: 29 }; const expert = structuredClone(s.undying.ritual.expert);
    apply(s, dose(s)); ritual(s, { type: 'END_RITUAL' });
    expect(s.undying.lifecycle.expectedCycleDate).toEqual({ epoch: 'FIFTH_EPOCH', year: 2100, month: 2, day: 28 });
    const restored = JSON.parse(JSON.stringify(s)) as SliceState, lifecycle = structuredClone(restored.undying.lifecycle);
    nextWeek(restored); expect(restored.undying.lifecycle).toEqual(lifecycle); expect(restored.undying.ritual.expert).toEqual(expert);
    expect(validateUndyingState(restored)).toBe(true); expect(projectUndying(restored).lifecycle.summary).toContain('尚未实际经历（0次）');
    const view = projectUndying(restored); Object.assign(view.lifecycle.promotionDate!, { day: 1 }); expect(restored.undying.lifecycle.promotionDate!.day).toBe(29);
    expect(expectedUndyingCycleDate({ epoch: 'FIFTH_EPOCH', year: 2000, month: 2, day: 29 })).toEqual({ epoch: 'FIFTH_EPOCH', year: 2060, month: 2, day: 29 });
  });
  it('does not reset lifecycle or revive an ordinary dead state', () => {
    const s = ready(); apply(s, dose(s)); ritual(s, { type: 'END_RITUAL' });
    const lifecycle = structuredClone(s.undying.lifecycle), history = structuredClone(oldPath(s)); s.health = 0; s.status = 'DEAD';
    const before = structuredClone(s); projectUndying(s); expect(validateUndyingState(s)).toBe(true); expect(s).toEqual(before);
    reject(s, dose(s)); expect(s.undying.lifecycle).toEqual(lifecycle); expect(oldPath(s)).toEqual(history); expect([s.status, s.health]).toEqual(['DEAD', 0]);
  });
  it('rejects invented cycles, altered anniversaries, copied bottles, missing old mastery and nonexact state', () => {
    const s = ready(); apply(s, dose(s)); ritual(s, { type: 'END_RITUAL' });
    const mutations: ((t: SliceState) => void)[] = [
      t => { Object.assign(t.undying.lifecycle, { experiencedCycles: 1 }); },
      t => { Object.assign(t.undying.lifecycle.expectedCycleDate!, { year: t.date.year + 59 }); },
      t => { Object.assign(t.undying.lifecycle, { status: 'REVIVED' }); },
      t => { t.undying.lifecycle.promotionDate = null; }, t => { t.undying.gatekeeperActingAtPromotion = 99; },
      t => { t.undying.bottles[0]!.source = 'copied gatekeeper potion'; }, t => { t.undying.bottles[1]!.id = t.undying.bottles[0]!.id; },
      t => { t.undying.bottles[0]!.ritualId = 'UDY4-RITUAL-999'; }, t => { delete t.progression.mastery['death.s6.dead-words']; },
      t => { t.progression.mastery['death.s4.free-resurrection'] = 0; }, t => { Object.assign(t.undying, { ritual: null }); },
    ];
    for (const mutate of mutations) { const t = structuredClone(s); mutate(t); expect(() => validateUndyingState(t)).not.toThrow(); expect(validateUndyingState(t)).toBe(false); }
  });
  it('permits unchanged resting gray feather but requires actual old practice cleanup', () => {
    const s = taught(), command = { type: 'BUY_POTION', bottleId: s.undying.bottles[0]!.id } as const;
    expect(s.gatekeeper.companion).toMatchObject({ source: 'SG6-GRAY-FEATHER', status: 'INSIDE', entries: 2, releases: 1, deployments: 2, recalls: 2, feePaid: 24 });
    const companion = structuredClone(s.gatekeeper.companion);
    s.gatekeeper.practice.marker = 'RECIPIENT'; reject(s, command); s.gatekeeper.practice.marker = 'DESK';
    s.gatekeeper.practice.gateOpen = true; reject(s, command); s.gatekeeper.practice.gateOpen = false;
    s.gatekeeper.cases['resting-place']!.contactOpen = true; reject(s, command); s.gatekeeper.cases['resting-place']!.contactOpen = false;
    s.gatekeeper.companion.status = 'DEPLOYED'; reject(s, command); s.gatekeeper.companion.status = 'INSIDE';
    buy(s); expect(s.gatekeeper.companion).toEqual(companion);
    expect(UNDYING_ABILITY_IDS).toEqual(['death.s4.underworld-seal']); expect(UNDYING_SOURCE_STATUS).toContain('摆渡人');
    expect(UNDYING_LIFECYCLE_BOUNDARY).toContain('是否已经历以当前实际保存记录为准'); expect(UNDYING_LIFECYCLE_BOUNDARY).toContain('普通战斗死亡与封存不变');
  });
});
