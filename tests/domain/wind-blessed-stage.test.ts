import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applySailorCommand } from '../../src/domain/sailor/index.js';
import { SAILOR_ABILITY_IDS } from '../../src/domain/sailor/types.js';
import { applyRagerCommand } from '../../src/domain/rager/index.js';
import { RAGER_ABILITY_IDS } from '../../src/domain/rager/types.js';
import { applyNavigatorCommand } from '../../src/domain/navigator/index.js';
import { NAVIGATOR_ABILITY_IDS } from '../../src/domain/navigator/types.js';
import { applyWindBlessedCommand, createWindBlessedState, projectWindBlessed, validateWindBlessedCommand, validateWindBlessedState } from '../../src/domain/wind-blessed/index.js';
import { applyWindBlessedActivity, windBlessedActions, windBlessedCases, windBlessedInside, validateWindBlessedLife } from '../../src/domain/wind-blessed/life.js';
import { settleWindBlessedEncounter } from '../../src/domain/wind-blessed/encounter.js';
import { WIND_BLESSED_FORMULA_STATUS, WIND_BLESSED_PRICES, WIND_BLESSED_SOURCE_STATUS } from '../../src/domain/wind-blessed/content.js';
import { WIND_BLESSED_ABILITY_IDS, WIND_BLESSED_CASE_IDS, type WindBlessedAcquisitionCommand, type WindBlessedActivityCommand, type WindBlessedCaseId } from '../../src/domain/wind-blessed/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function ordinary(): SliceState {
  const s = createSliceRun('windBlessed-domain', sliceDefaultCreationSelection, 'windBlessed-fixed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5; s.cash = 50000;
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.windBlessed = createWindBlessedState(); return s;
}
function context(s: SliceState, roll = 1) {
  const c: SeerContext = {
    roll: vi.fn(min => min), note: vi.fn(),
    check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })),
  };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source);
    s.progression.mastery[WIND_BLESSED_ABILITY_IDS[0]]! += amount;
  });
  return { c, award };
}
function navigator(): SliceState {
  const s = ordinary(), c = context(s).c;
  applySailorCommand(s, { type: 'DISCOVER' }, c);
  applySailorCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applySailorCommand(s, { type: 'BUY_POTION', bottleId: s.sailor.bottles[0]!.id }, c);
  applySailorCommand(s, { type: 'CONSUME', bottleId: s.sailor.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applyRagerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyRagerCommand(s, { type: 'BUY_POTION', bottleId: s.rager.bottles[0]!.id }, c);
  applyRagerCommand(s, { type: 'CONSUME', bottleId: s.rager.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  applyNavigatorCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyNavigatorCommand(s, { type: 'BUY_POTION', bottleId: s.navigator.bottles[0]!.id }, c);
  applyNavigatorCommand(s, { type: 'CONSUME', bottleId: s.navigator.bottles[0]!.id, confirmed: true }, c);
  s.week = 31; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...SAILOR_ABILITY_IDS, ...RAGER_ABILITY_IDS, ...NAVIGATOR_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 20000; s.actionsRemaining = 100; s.health = 100; s.mind = 100; s.spirituality = 31; s.character.coreStats.will = 25;
  return s;
}
function acquisition(s: SliceState, command: WindBlessedAcquisitionCommand, roll = 1) { const ctx = context(s, roll); applyWindBlessedCommand(s, command, ctx.c); return ctx; }
function activity(s: SliceState, command: WindBlessedActivityCommand, roll = 1) { const ctx = context(s, roll); applyWindBlessedActivity(s, command, ctx.c, ctx.award); return ctx; }
function taught(s = navigator()) { acquisition(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const b = s.windBlessed.bottles[index]!; acquisition(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); acquisition(s, { type: 'CONSUME', bottleId: s.windBlessed.bottles[0]!.id, confirmed: true }); return s; }
function rejectAcquisition(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyWindBlessedCommand(s, command as WindBlessedAcquisitionCommand, ctx.c)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled();
}
function rejectActivity(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyWindBlessedActivity(s, command as WindBlessedActivityCommand, ctx.c, ctx.award)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: WindBlessedCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  activity(s, { type: 'OBSERVE', caseId }); activity(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: WindBlessedCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); activity(s, { type: 'PERFORM', caseId });
  activity(s, caseId === 'low-platform' ? { type: 'CLOSE', caseId, returnMethod: 'STAIRS' } : { type: 'CLOSE', caseId });
  activity(s, { type: 'REPORT', caseId });
}


describe('WindBlessed S6 finite original bottles and inherited promotion', () => {
  it('hides the future channel and creates independent original stocks', () => {
    const s = ordinary(), p = projectWindBlessed(s), other = createWindBlessedState();
    expect(validateWindBlessedState(s)).toBe(true);
    expect(p).toMatchObject({ discovered: false, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [], bottles: [], actions: [], abilities: [], cases: [], supplies: '' });
    expect(p.story).toBeUndefined(); other.bottles[0]!.labourSteps = 5; other.flight.position = 'LOW_PLATFORM';
    expect(s.windBlessed.bottles[0]!.labourSteps).toBe(0); expect(s.windBlessed.flight.position).toBe('GROUND');
    rejectAcquisition(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges 360 and one action for guidance without inventing a formula', () => {
    const s = navigator(), before = structuredClone([s.sailor, s.rager, s.navigator]), c = acquisition(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([19640, 99]); expect([s.sailor, s.rager, s.navigator]).toEqual(before);
    expect(projectWindBlessed(s)).toMatchObject({ guidanceKnown: true, formulaKnown: false, formula: [] });
    expect(WIND_BLESSED_FORMULA_STATUS).toContain('尚未核实'); expect(WIND_BLESSED_PRICES).toEqual({ guidance: 360, potion: 3320, labourCredit: 3000 });
    expect(c.c.check).not.toHaveBeenCalled(); rejectAcquisition(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five actual labour actions per original bottle and still takes 320 cash', () => {
    const s = taught(), b = s.windBlessed.bottles[0]!;
    for (let i = 0; i < 5; i++) acquisition(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.status, b.labourSteps, s.actionsRemaining]).toEqual(['SUPPLIER', 5, 94]);
    rejectAcquisition(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([19320, 94, 'PLAYER']);
    expect(projectWindBlessed(s).actions.find(a => a.id === 'buy-wind-blessed-potion-2')!.cost).toContain('3320便士');
    rejectAcquisition(s, { type: 'BUY_POTION', bottleId: b.id }); rejectAcquisition(s, { type: 'POTION_WORK', bottleId: b.id });
    expect(validateWindBlessedState(s)).toBe(true);
  });
  it('does not discount partial labour or transfer credit to another original', () => {
    const s = taught(); acquisition(s, { type: 'POTION_WORK', bottleId: s.windBlessed.bottles[0]!.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(3320); expect(s.windBlessed.bottles[1]!.labourSteps).toBe(0);
    s.cash = 3319; rejectAcquisition(s, { type: 'BUY_POTION', bottleId: s.windBlessed.bottles[1]!.id });
  });
  it('allows early preparation but checks acting100 and twelve complete S7 weeks at the separate drink', () => {
    const s = navigator(); s.week = 19; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validateWindBlessedState(s)).toBe(true); rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = 30; s.progression.acting = 100;
    expect(projectWindBlessed(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = 31; s.progression.acting = 99; rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); expect(s.progression.sequence).toBe(6);
  });
  it.each([[1, 'GREAT_SUCCESS', 95, 100, 0, 6], [30, 'SUCCESS', 90, 100, 0, 6], [85, 'FAILURE', 80, 90, 25, 7], [100, 'GREAT_FAILURE', 60, 80, 50, 7]] as const)('records recoverable four-tier drinking roll %s', (roll, tier, mind, health, pollution, sequence) => {
    const s = prepared(), old = structuredClone(s.progression.mastery), b = s.windBlessed.bottles[0]!;
    const ctx = acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
    expect(ctx.c.check).toHaveBeenCalledWith('will', 24);
    expect([b.status, b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, pollution, sequence, 'ACTIVE']);
    for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
    if (sequence === 7) expect(s.progression.acting).toBe(100);
    expect(validateWindBlessedState(s)).toBe(true); rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
  });
  it('inherits every original Sailor family ID, adds three zero masteries and four +1 stats without refilling spirituality', () => {
    const s = prepared(), old = structuredClone([s.sailor, s.rager, s.navigator]), stats = { ...s.character.coreStats };
    acquisition(s, { type: 'CONSUME', bottleId: s.windBlessed.bottles[0]!.id, confirmed: true });
    expect([s.sailor, s.rager, s.navigator]).toEqual(old); expect(s.windBlessed.navigatorActingAtPromotion).toBe(100);
    expect(Object.keys(s.progression.mastery)).toEqual([...SAILOR_ABILITY_IDS, ...RAGER_ABILITY_IDS, ...NAVIGATOR_ABILITY_IDS, ...WIND_BLESSED_ABILITY_IDS]);
    expect(WIND_BLESSED_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0, 0]);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]); expect(WIND_BLESSED_SOURCE_STATUS).toContain('序列5');
  });
  it('keeps failed originals and waits for the next real week before delivering fresh priced stock', () => {
    const s = taught();
    for (let i = 0; i < 3; i++) { const b = buy(s, i); acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.windBlessed.bottles);
    acquisition(s, { type: 'REQUEST_SUPPLY' }); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' }); rejectAcquisition(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1; acquisition(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.windBlessed.bottles.slice(0, 3)).toEqual(originals); expect(s.windBlessed.bottles).toHaveLength(6);
    expect(s.windBlessed.bottles[3]).toMatchObject({ id: 'wind-blessed-potion-4', status: 'SUPPLIER', labourSteps: 0 });
    expect(validateWindBlessedState(s)).toBe(true); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' });
  });
  it.each([null, {}, { type: 'BREW', batchId: 'wind-blessed-batch-1' }, { type: 'CONSUME', bottleId: 'wind-blessed-potion-1', confirmed: false }, { type: 'PREPARE', caseId: 'low-platform', method: 'MIND_CONTROL' }, { type: 'REFLECT', extra: true }, { type: 'OBSERVE', caseId: 'invented' }])('rejects malformed or invented public commands %# without mutation', command => {
    expect(validateWindBlessedCommand(command)).toBe(false); rejectAcquisition(prepared(), command); rejectActivity(promoted(), command);
  });
  it('rejects forged bottle identity, sources, chronology and inherited mastery in saves', () => {
    const s = promoted();
    for (const change of [(t: SliceState) => { t.windBlessed.bottles[0]!.source = 'invented'; }, (t: SliceState) => { t.windBlessed.bottles[0]!.consumedWeek = 30; }, (t: SliceState) => { t.windBlessed.navigatorActingAtPromotion = 99; }, (t: SliceState) => { delete t.progression.mastery[SAILOR_ABILITY_IDS[0]]; }, (t: SliceState) => { t.windBlessed.bottles[1]!.labourSteps = 6; }]) { const t = structuredClone(s); change(t); expect(validateWindBlessedState(t)).toBe(false); }
  });
});

describe('WindBlessed finite original peaceful practice', () => {
  it('hides the three exact original cases before promotion and reveals observed facts only after observation', () => {
    expect(windBlessedCases(navigator())).toEqual([]);
    const s = promoted(); expect(windBlessedCases(s).map(r => r.id)).toEqual([...WIND_BLESSED_CASE_IDS]);
    expect(windBlessedCases(s).every(r => r.observations.length === 0)).toBe(true);
    activity(s, { type: 'OBSERVE', caseId: 'crosswind-screen' });
    expect(windBlessedCases(s).find(r => r.id === 'crosswind-screen')!.observations.join(' ')).toContain('原风向标');
  });
  it('requires observation and preparation, blocks unrelated work until a real close, and awards once', () => {
    const s = promoted(); rejectActivity(s, { type: 'PERFORM', caseId: 'crosswind-screen' }); begin(s, 'crosswind-screen');
    rejectActivity(s, { type: 'OBSERVE', caseId: 'cutting-target' }); activity(s, { type: 'PERFORM', caseId: 'crosswind-screen' });
    expect(windBlessedInside(s)).toBe(true); rejectActivity(s, { type: 'REPORT', caseId: 'crosswind-screen' });
    const ap = s.actionsRemaining, spirit = s.spirituality; activity(s, { type: 'CLOSE', caseId: 'crosswind-screen' });
    expect([s.actionsRemaining, s.spirituality]).toEqual([ap, spirit]); activity(s, { type: 'REPORT', caseId: 'crosswind-screen' });
    expect(s.progression.acting).toBe(25); rejectActivity(s, { type: 'REPORT', caseId: 'crosswind-screen' }); expect(validateWindBlessedState(s)).toBe(true);
  });
  it.each(['crosswind-screen', 'cutting-target'] as const)('spends three spirituality on failed %s and keeps original object sources for next week', caseId => {
    const s = promoted(); begin(s, caseId, 'ABILITY'); const spirit = s.spirituality, ap = s.actionsRemaining;
    const c = activity(s, { type: 'PERFORM', caseId }, 100);
    expect(c.c.check).toHaveBeenCalledExactlyOnceWith('physique', 14);
    expect([s.spirituality, s.actionsRemaining, s.progression.acting]).toEqual([spirit - 3, ap - 1, 0]);
    expect(c.award).not.toHaveBeenCalled(); expect(s.windBlessed.cases[caseId]).toMatchObject({ contactOpen: true, status: 'OBSERVED', outcome: 'NONE' });
    activity(s, { type: 'CLOSE', caseId }); rejectActivity(s, { type: 'PREPARE', caseId, method: 'ORDINARY' });
    s.week += 1; activity(s, { type: 'PREPARE', caseId, method: 'ORDINARY' });
    expect(validateWindBlessedState(s)).toBe(true);
  });
  it.each([
    ['crosswind-screen', 'ABILITY', 'WIND_STABILIZED'], ['crosswind-screen', 'ORDINARY', 'POLES_FIXED'],
    ['cutting-target', 'ABILITY', 'WIND_CUT'], ['cutting-target', 'ORDINARY', 'SAW_CUT'],
  ] as const)('keeps distinct %s %s results and their actual cost', (caseId, method, outcome) => {
    const s = promoted(), spirit = s.spirituality, cash = s.cash; begin(s, caseId, method);
    const c = activity(s, { type: 'PERFORM', caseId });
    expect(c.c.check).toHaveBeenCalledExactlyOnceWith(method === 'ABILITY' ? 'physique' : 'knowledge', method === 'ABILITY' ? 14 : 10);
    expect([s.spirituality, s.cash, s.windBlessed.cases[caseId]!.outcome]).toEqual([spirit - (method === 'ABILITY' ? 3 : 0), cash, outcome]);
    activity(s, { type: 'CLOSE', caseId }); activity(s, { type: 'REPORT', caseId });
    expect(validateWindBlessedState(s)).toBe(true);
  });
  it('allows canceling an unaffordable ability preparation before a real ordinary alternative', () => {
    const s = promoted(); begin(s, 'cutting-target', 'ABILITY'); s.spirituality = 2;
    rejectActivity(s, { type: 'PERFORM', caseId: 'cutting-target' }); const ap = s.actionsRemaining;
    activity(s, { type: 'WITHDRAW', caseId: 'cutting-target' }); expect(s.actionsRemaining).toBe(ap);
    activity(s, { type: 'PREPARE', caseId: 'cutting-target', method: 'ORDINARY' }); activity(s, { type: 'PERFORM', caseId: 'cutting-target' });
    expect([s.spirituality, s.windBlessed.cases['cutting-target']!.outcome]).toEqual([2, 'SAW_CUT']);
  });
  it('reaches peaceful100 with original ordinary tools and real stairs, without granting flight', () => {
    const s = promoted(), spirit = s.spirituality;
    for (const id of WIND_BLESSED_CASE_IDS) complete(s, id);
    expect(s.progression.acting).toBe(75); activity(s, { type: 'REFLECT' });
    expect([s.progression.acting, s.spirituality, s.windBlessed.encounter.status]).toEqual([100, spirit, 'AVAILABLE']);
    expect(s.windBlessed.flight).toEqual({ position: 'GROUND', ascents: 1, flightReturns: 0, stairReturns: 1 });
    expect(s.progression.mastery[WIND_BLESSED_ABILITY_IDS[0]]).toBe(24); expect(validateWindBlessedState(s)).toBe(true);
    rejectActivity(s, { type: 'REFLECT' });
  });
  it('does not allow a fake return method for ground work or the wrong case', () => {
    const s = promoted(); begin(s, 'crosswind-screen'); activity(s, { type: 'PERFORM', caseId: 'crosswind-screen' });
    for (const command of [{ type: 'CLOSE', caseId: 'crosswind-screen', returnMethod: 'STAIRS' }, { type: 'CLOSE', caseId: 'cutting-target', returnMethod: 'FLIGHT' }, { type: 'CLOSE', caseId: 'low-platform', returnMethod: 'TELEPORT' }]) {
      expect(validateWindBlessedCommand(command)).toBe(false); rejectActivity(s, command);
    }
  });
});

describe('WindBlessed actual low platform position and independent return', () => {
  it('charges the outgoing3, publishes two return choices and never closes from the platform without a return method', () => {
    const s = promoted(); begin(s, 'low-platform', 'ABILITY'); const spirit = s.spirituality;
    activity(s, { type: 'PERFORM', caseId: 'low-platform' });
    expect(s.spirituality).toBe(spirit - 3); expect(s.windBlessed.flight).toEqual({ position: 'LOW_PLATFORM', ascents: 1, flightReturns: 0, stairReturns: 0 });
    expect(projectWindBlessed(s).flight).toEqual(s.windBlessed.flight); expect(windBlessedInside(s)).toBe(true);
    const choices = windBlessedActions(s).filter(a => a.command.type === 'CLOSE');
    expect(choices.map(a => a.command)).toEqual([{ type: 'CLOSE', caseId: 'low-platform', returnMethod: 'STAIRS' }, { type: 'CLOSE', caseId: 'low-platform', returnMethod: 'FLIGHT' }]);
    expect(choices.every(a => a.enabled)).toBe(true);
    rejectActivity(s, { type: 'CLOSE', caseId: 'low-platform' }); rejectActivity(s, { type: 'REPORT', caseId: 'low-platform' });
    rejectActivity(s, { type: 'OBSERVE', caseId: 'cutting-target' }); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
    expect(validateWindBlessedState(s)).toBe(true);
  });
  it('permits a3-spirituality outgoing flight and a free actual stair return at zero action and zero spirituality', () => {
    const s = promoted(); begin(s, 'low-platform', 'ABILITY'); s.spirituality = 3;
    activity(s, { type: 'PERFORM', caseId: 'low-platform' }); s.actionsRemaining = 0;
    const choices = windBlessedActions(s).filter(a => a.command.type === 'CLOSE');
    expect(choices.find(a => a.command.type === 'CLOSE' && a.command.returnMethod === 'STAIRS')!.enabled).toBe(true);
    expect(choices.find(a => a.command.type === 'CLOSE' && a.command.returnMethod === 'FLIGHT')!.enabled).toBe(false);
    rejectActivity(s, { type: 'CLOSE', caseId: 'low-platform', returnMethod: 'FLIGHT' });
    const c = activity(s, { type: 'CLOSE', caseId: 'low-platform', returnMethod: 'STAIRS' });
    expect(c.c.check).not.toHaveBeenCalled(); expect([s.actionsRemaining, s.spirituality]).toEqual([0, 0]);
    expect(s.windBlessed.flight).toEqual({ position: 'GROUND', ascents: 1, flightReturns: 0, stairReturns: 1 });
    expect(windBlessedInside(s)).toBe(false); expect(validateWindBlessedState(s)).toBe(true);
  });
  it('checks and charges a successful return independently, for exactly five total spirituality', () => {
    const s = promoted(); begin(s, 'low-platform', 'ABILITY'); const spirit = s.spirituality;
    activity(s, { type: 'PERFORM', caseId: 'low-platform' }); const ap = s.actionsRemaining;
    const c = activity(s, { type: 'CLOSE', caseId: 'low-platform', returnMethod: 'FLIGHT' });
    expect(c.c.check).toHaveBeenCalledExactlyOnceWith('physique', 14); expect(c.award).not.toHaveBeenCalled();
    expect([s.spirituality, s.actionsRemaining]).toEqual([spirit - 5, ap]);
    expect(s.windBlessed.flight).toEqual({ position: 'GROUND', ascents: 1, flightReturns: 1, stairReturns: 0 });
    expect(s.windBlessed.cases['low-platform']!.closes).toBe(1); expect(validateWindBlessedState(s)).toBe(true);
    rejectActivity(s, { type: 'CLOSE', caseId: 'low-platform', returnMethod: 'FLIGHT' });
  });
  it('retains platform and open contact after a failed paid return, then allows the original stairs without another action', () => {
    const s = promoted(); begin(s, 'low-platform', 'ABILITY'); s.spirituality = 5;
    activity(s, { type: 'PERFORM', caseId: 'low-platform' }); s.actionsRemaining = 0;
    const c = activity(s, { type: 'CLOSE', caseId: 'low-platform', returnMethod: 'FLIGHT' }, 100);
    expect(c.c.check).toHaveBeenCalledExactlyOnceWith('physique', 14); expect(c.award).not.toHaveBeenCalled();
    expect([s.spirituality, s.actionsRemaining]).toEqual([0, 0]);
    expect(s.windBlessed.flight).toEqual({ position: 'LOW_PLATFORM', ascents: 1, flightReturns: 0, stairReturns: 0 });
    expect(s.windBlessed.cases['low-platform']).toMatchObject({ contactOpen: true, closes: 0, outcome: 'FLOWN_TO_PLATFORM', status: 'EXAMINED' });
    expect(validateWindBlessedState(s)).toBe(true); rejectActivity(s, { type: 'CLOSE', caseId: 'low-platform' });
    activity(s, { type: 'CLOSE', caseId: 'low-platform', returnMethod: 'STAIRS' });
    expect(s.spirituality).toBe(0); expect(windBlessedInside(s)).toBe(false); expect(s.windBlessed.flight.stairReturns).toBe(1);
    expect(validateWindBlessedState(s)).toBe(true);
  });
  it('allows a paid second return attempt at zero action without refunding the previous failed return', () => {
    const s = promoted(); begin(s, 'low-platform', 'ABILITY'); s.spirituality = 7;
    activity(s, { type: 'PERFORM', caseId: 'low-platform' }); s.actionsRemaining = 0;
    activity(s, { type: 'CLOSE', caseId: 'low-platform', returnMethod: 'FLIGHT' }, 100);
    activity(s, { type: 'CLOSE', caseId: 'low-platform', returnMethod: 'FLIGHT' });
    expect([s.spirituality, s.actionsRemaining, s.windBlessed.flight.flightReturns, s.windBlessed.cases['low-platform']!.closes]).toEqual([0, 0, 1, 1]);
    expect(validateWindBlessedState(s)).toBe(true);
  });
  it.each(['ABILITY', 'ORDINARY'] as const)('keeps a failed %s ascent onGROUND and requires plain close rather than a fabricated return', method => {
    const s = promoted(); begin(s, 'low-platform', method); const spirit = s.spirituality;
    activity(s, { type: 'PERFORM', caseId: 'low-platform' }, 100);
    expect(s.spirituality).toBe(spirit - (method === 'ABILITY' ? 3 : 0));
    expect(s.windBlessed.flight).toEqual({ position: 'GROUND', ascents: 0, flightReturns: 0, stairReturns: 0 });
    rejectActivity(s, { type: 'CLOSE', caseId: 'low-platform', returnMethod: 'STAIRS' });
    activity(s, { type: 'CLOSE', caseId: 'low-platform' });
    rejectActivity(s, { type: 'PREPARE', caseId: 'low-platform', method }); s.week += 1;
    activity(s, { type: 'PREPARE', caseId: 'low-platform', method }); activity(s, { type: 'PERFORM', caseId: 'low-platform' });
    activity(s, { type: 'CLOSE', caseId: 'low-platform', returnMethod: 'STAIRS' });
    expect(s.windBlessed.cases['low-platform']!.closes).toBe(2); expect(validateWindBlessedState(s)).toBe(true);
  });
  it('ordinary ascent uses knowledge and real stairs without spirituality, then explicitly returns by stairs', () => {
    const s = promoted(); begin(s, 'low-platform', 'ORDINARY'); const spirit = s.spirituality;
    const c = activity(s, { type: 'PERFORM', caseId: 'low-platform' });
    expect(c.c.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect(s.spirituality).toBe(spirit);
    expect(s.windBlessed.cases['low-platform']!.outcome).toBe('STAIRS_TO_PLATFORM');
    expect(s.windBlessed.flight.position).toBe('LOW_PLATFORM');
    activity(s, { type: 'CLOSE', caseId: 'low-platform', returnMethod: 'STAIRS' });
    expect(s.spirituality).toBe(spirit); expect(s.windBlessed.flight.flightReturns).toBe(0);
    expect(windBlessedCases(s).find(r => r.id === 'low-platform')!.result).toContain('当前GROUND');
  });
  it('rejects phantom positions, forged counters, removed contact and a week advance before actual return', () => {
    const s = promoted(); begin(s, 'low-platform', 'ABILITY'); activity(s, { type: 'PERFORM', caseId: 'low-platform' });
    for (const change of [
      (t: SliceState) => { t.windBlessed.flight.position = 'GROUND'; },
      (t: SliceState) => { t.windBlessed.flight.ascents = 2; },
      (t: SliceState) => { t.windBlessed.flight.flightReturns = 1; },
      (t: SliceState) => { t.windBlessed.cases['low-platform']!.contactOpen = false; },
      (t: SliceState) => { t.week += 1; },
      (t: SliceState) => { Object.assign(t.windBlessed.flight, { carriedNpc: 'invented' }); },
    ]) { const t = structuredClone(s); change(t); expect(validateWindBlessedState(t)).toBe(false); }
  });
  it('rejects fake flight progress before promotion and mismatched case results or duplicated report rewards', () => {
    const s = navigator(); s.windBlessed.flight.ascents = 1; s.windBlessed.flight.stairReturns = 1; expect(validateWindBlessedState(s)).toBe(false);
    const p = promoted(); complete(p, 'crosswind-screen');
    for (const change of [
      (t: SliceState) => { t.windBlessed.cases['crosswind-screen']!.outcome = 'WIND_STABILIZED'; },
      (t: SliceState) => { t.windBlessed.cases['crosswind-screen']!.closes = 0; },
      (t: SliceState) => { t.seer.completedSources.push('wind-blessed-case:crosswind-screen'); },
    ]) { const t = structuredClone(p); change(t); expect(validateWindBlessedLife(t)).toBe(false); }
  });
});

function effectiveRound(s: SliceState) {
  s.combatHistory.push({ round: 1, stance: 'ATTACK', first: 'PLAYER', playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1,
    moves: [{ actor: 'PLAYER', label: '本人对原敌的实际有限攻势', selfGain: 3, enemyReduction: 0 }], playerAdvantage: 3, enemyAdvantage: 0, winChance: 60, winner: 'PLAYER', consequence: '抵抗结束', consequenceWeights: null, retreat: 'NONE' });
}
describe('WindBlessed original empty courtyard dispute', () => {
  it('requires a report and actual one-action arrival, permits peace without extra growth or moved possessions', () => {
    const s = promoted(); rejectActivity(s, { type: 'ENCOUNTER_TALK' }); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
    complete(s, 'crosswind-screen'); const acting = s.progression.acting, ap = s.actionsRemaining, cash = s.cash, mastery = { ...s.progression.mastery };
    const c = activity(s, { type: 'ENCOUNTER_TALK' });
    expect([s.windBlessed.encounter.status, s.actionsRemaining, s.progression.acting, s.cash]).toEqual(['RESOLVED', ap - 1, acting, cash]);
    expect(s.progression.mastery).toEqual(mastery); expect(c.award).not.toHaveBeenCalled(); expect(validateWindBlessedState(s)).toBe(true);
    expect(c.c.note).toHaveBeenCalledWith('实际走到原外院并核对现场', expect.stringContaining('鲁恩'));
    rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
  });
  it('keeps refusal and permits a talk retry only in a subsequent real week', () => {
    const s = promoted(); complete(s, 'crosswind-screen'); activity(s, { type: 'ENCOUNTER_TALK' }, 100);
    expect(s.windBlessed.encounter.status).toBe('AVAILABLE'); rejectActivity(s, { type: 'ENCOUNTER_TALK' });
    expect(validateWindBlessedState(s)).toBe(true); s.week += 1;
    activity(s, { type: 'ENCOUNTER_TALK' }); expect(s.windBlessed.encounter.status).toBe('RESOLVED');
  });
  it('prohibits encounter arrival from an open platform even after an earlier valid report', () => {
    const s = promoted(); complete(s, 'crosswind-screen'); begin(s, 'low-platform', 'ABILITY');
    activity(s, { type: 'PERFORM', caseId: 'low-platform' });
    rejectActivity(s, { type: 'ENCOUNTER_TALK' }); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
    activity(s, { type: 'CLOSE', caseId: 'low-platform', returnMethod: 'STAIRS' });
    activity(s, { type: 'ENCOUNTER_FIGHT' }); expect(s.combat?.encounterId).toBe('WIND_BLESSED_DISPUTE');
    expect(validateWindBlessedState(s)).toBe(true);
  });
  it('leaves the old carrier and previous route state unchanged and awards no retreat', () => {
    const s = promoted(); complete(s, 'crosswind-screen'); const previous = structuredClone([s.sailor, s.rager, s.navigator, s.world]), cash = s.cash;
    activity(s, { type: 'ENCOUNTER_FIGHT' }); expect(s.windBlessed.encounter).toMatchObject({ status: 'FIGHTING', attemptWeek: s.week, startHistoryIndex: s.combatHistory.length });
    const c = context(s); settleWindBlessedEncounter(s, 'RETREATED', c.c, c.award);
    expect([s.sailor, s.rager, s.navigator, s.world]).toEqual(previous);
    expect([s.combat, s.cash, s.windBlessed.encounter.status]).toEqual([null, cash, 'RETREATED']); expect(c.award).not.toHaveBeenCalled();
    expect(validateWindBlessedState(s)).toBe(true);
  });
  it('excludes earlier encounter participation from a nominal new victory', () => {
    const s = promoted(); complete(s, 'crosswind-screen'); effectiveRound(s); activity(s, { type: 'ENCOUNTER_FIGHT' });
    const c = context(s); settleWindBlessedEncounter(s, 'ENEMY_SURRENDERED', c.c, c.award);
    expect(c.award).not.toHaveBeenCalled(); expect(s.windBlessed.encounter.status).toBe('RESOLVED'); expect(validateWindBlessedState(s)).toBe(true);
  });
  it.each(['ENEMY_SURRENDERED', 'ENEMY_DEAD'])('awards exactly one mastery25 for a living player who effectively participates: %s', outcome => {
    const s = promoted(); complete(s, 'crosswind-screen'); activity(s, { type: 'ENCOUNTER_FIGHT' }); effectiveRound(s);
    const c = context(s), acting = s.progression.acting, cash = s.cash;
    settleWindBlessedEncounter(s, outcome, c.c, c.award);
    expect(c.award).toHaveBeenCalledExactlyOnceWith('wind-blessed-dispute', 25); expect([s.progression.acting, s.cash]).toEqual([acting, cash]);
    expect(validateWindBlessedState(s)).toBe(true); expect(() => settleWindBlessedEncounter(s, outcome, c.c, c.award)).toThrow();
    const forged = structuredClone(s); forged.combatHistory.at(-1)!.moves[0]!.selfGain = 0; expect(validateWindBlessedState(forged)).toBe(false);
  });
  it('preserves real death and never grants an effective dead player a reward', () => {
    const s = promoted(); complete(s, 'crosswind-screen'); activity(s, { type: 'ENCOUNTER_FIGHT' }); effectiveRound(s); s.status = 'DEAD';
    const c = context(s); settleWindBlessedEncounter(s, 'PLAYER_DEAD', c.c, c.award);
    expect([s.status, s.windBlessed.encounter.status, s.combat]).toEqual(['DEAD', 'LOST', null]); expect(c.award).not.toHaveBeenCalled();
    expect(validateWindBlessedState(s)).toBe(true);
  });
  it('rejects unknown terminal outcomes atomically and stale or invented encounter facts in saves', () => {
    const s = promoted(); complete(s, 'crosswind-screen'); activity(s, { type: 'ENCOUNTER_FIGHT' }); const c = context(s), before = structuredClone(s);
    expect(() => settleWindBlessedEncounter(s, 'INVENTED', c.c, c.award)).toThrow(); expect(s).toEqual(before);
    for (const change of [
      (t: SliceState) => { t.week += 1; },
      (t: SliceState) => { t.windBlessed.flight.position = 'LOW_PLATFORM'; },
      (t: SliceState) => { Object.assign(t.windBlessed.encounter, { borrowedCarrier: true }); },
      (t: SliceState) => { t.windBlessed.encounter.startHistoryIndex = null; },
    ]) { const t = structuredClone(s); change(t); expect(validateWindBlessedState(t)).toBe(false); }
  });
});
