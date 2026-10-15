import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyReaderCommand } from '../../src/domain/reader/index.js';
import { READER_ABILITY_IDS } from '../../src/domain/reader/types.js';
import { applyReasonerCommand } from '../../src/domain/reasoner/index.js';
import { REASONER_ABILITY_IDS } from '../../src/domain/reasoner/types.js';
import { applyDetectiveCommand } from '../../src/domain/detective/index.js';
import { DETECTIVE_ABILITY_IDS } from '../../src/domain/detective/types.js';
import { applyPolymathCommand, createPolymathState, projectPolymath, validatePolymathCommand, validatePolymathState } from '../../src/domain/polymath/index.js';
import { applyPolymathActivity, polymathActions, polymathCases, polymathInside, validatePolymathLife } from '../../src/domain/polymath/life.js';
import { settlePolymathEncounter } from '../../src/domain/polymath/encounter.js';
import { POLYMATH_FORMULA_STATUS, POLYMATH_PRICES, POLYMATH_SOURCE_STATUS } from '../../src/domain/polymath/content.js';
import { POLYMATH_ABILITY_IDS, POLYMATH_CASE_IDS, type PolymathAcquisitionCommand, type PolymathActivityCommand, type PolymathCaseId } from '../../src/domain/polymath/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function ordinary(): SliceState {
  const s = createSliceRun('polymath-domain', sliceDefaultCreationSelection, 'polymath-fixed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5; s.cash = 50000;
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.polymath = createPolymathState(); return s;
}
function context(s: SliceState, roll = 1) {
  const c: SeerContext = {
    roll: vi.fn(min => min), note: vi.fn(),
    check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })),
  };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source);
    s.progression.mastery[POLYMATH_ABILITY_IDS[0]]! += amount;
  });
  return { c, award };
}
function detective(): SliceState {
  const s = ordinary(), c = context(s).c;
  applyReaderCommand(s, { type: 'DISCOVER' }, c);
  applyReaderCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyReaderCommand(s, { type: 'BUY_POTION', bottleId: s.reader.bottles[0]!.id }, c);
  applyReaderCommand(s, { type: 'CONSUME', bottleId: s.reader.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applyReasonerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyReasonerCommand(s, { type: 'BUY_POTION', bottleId: s.reasoner.bottles[0]!.id }, c);
  applyReasonerCommand(s, { type: 'CONSUME', bottleId: s.reasoner.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  applyDetectiveCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyDetectiveCommand(s, { type: 'BUY_POTION', bottleId: s.detective.bottles[0]!.id }, c);
  applyDetectiveCommand(s, { type: 'CONSUME', bottleId: s.detective.bottles[0]!.id, confirmed: true }, c);
  s.week = 31; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...READER_ABILITY_IDS, ...REASONER_ABILITY_IDS, ...DETECTIVE_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 20000; s.actionsRemaining = 100; s.health = 100; s.mind = 100; s.spirituality = 31; s.character.coreStats.will = 25;
  return s;
}
function acquisition(s: SliceState, command: PolymathAcquisitionCommand, roll = 1) { const ctx = context(s, roll); applyPolymathCommand(s, command, ctx.c); return ctx; }
function activity(s: SliceState, command: PolymathActivityCommand, roll = 1) { const ctx = context(s, roll); applyPolymathActivity(s, command, ctx.c, ctx.award); return ctx; }
function taught(s = detective()) { acquisition(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const b = s.polymath.bottles[index]!; acquisition(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); acquisition(s, { type: 'CONSUME', bottleId: s.polymath.bottles[0]!.id, confirmed: true }); return s; }
function rejectAcquisition(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyPolymathCommand(s, command as PolymathAcquisitionCommand, ctx.c)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled();
}
function rejectActivity(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyPolymathActivity(s, command as PolymathActivityCommand, ctx.c, ctx.award)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: PolymathCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  activity(s, { type: 'OBSERVE', caseId });
  if (method === 'ABILITY') activity(s, { type: 'ANALYSE', caseId });
  activity(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: PolymathCaseId) {
  begin(s, caseId); activity(s, { type: 'PERFORM', caseId }); activity(s, { type: 'CLOSE', caseId });
  activity(s, { type: 'REPORT', caseId });
}

describe('Polymath S6 finite original bottles and inherited promotion', () => {
  it('hides the future channel and creates independent original stocks', () => {
    const s = ordinary(), p = projectPolymath(s), other = createPolymathState();
    expect(validatePolymathState(s)).toBe(true);
    expect(p).toMatchObject({ discovered: false, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [], bottles: [], actions: [], abilities: [], cases: [], supplies: '' });
    expect(p.story).toBeUndefined(); other.bottles[0]!.labourSteps = 5; other.samples.FLASH.observedWeek = 5;
    expect(s.polymath.bottles[0]!.labourSteps).toBe(0); expect(s.polymath.samples.FLASH.observedWeek).toBeNull();
    rejectAcquisition(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges 360 and one action for guidance without inventing a formula', () => {
    const s = detective(), before = structuredClone([s.reader, s.reasoner, s.detective]), c = acquisition(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([19640, 99]); expect([s.reader, s.reasoner, s.detective]).toEqual(before);
    expect(projectPolymath(s)).toMatchObject({ guidanceKnown: true, formulaKnown: false, formula: [] });
    expect(POLYMATH_FORMULA_STATUS).toContain('尚未核实'); expect(POLYMATH_PRICES).toEqual({ guidance: 360, potion: 3320, labourCredit: 3000 });
    expect(c.c.check).not.toHaveBeenCalled(); rejectAcquisition(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five actual labour actions per original bottle and still takes 320 cash', () => {
    const s = taught(), b = s.polymath.bottles[0]!;
    for (let i = 0; i < 5; i++) acquisition(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.status, b.labourSteps, s.actionsRemaining]).toEqual(['SUPPLIER', 5, 94]);
    rejectAcquisition(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([19320, 94, 'PLAYER']);
    expect(projectPolymath(s).actions.find(a => a.id === 'buy-polymath-potion-2')!.cost).toContain('3320便士');
    rejectAcquisition(s, { type: 'BUY_POTION', bottleId: b.id }); rejectAcquisition(s, { type: 'POTION_WORK', bottleId: b.id });
    expect(validatePolymathState(s)).toBe(true);
  });
  it('does not discount partial labour or transfer credit to another original', () => {
    const s = taught(); acquisition(s, { type: 'POTION_WORK', bottleId: s.polymath.bottles[0]!.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(3320); expect(s.polymath.bottles[1]!.labourSteps).toBe(0);
    s.cash = 3319; rejectAcquisition(s, { type: 'BUY_POTION', bottleId: s.polymath.bottles[1]!.id });
  });
  it('allows early preparation but checks acting100 and twelve complete S7 weeks at the separate drink', () => {
    const s = detective(); s.week = 19; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validatePolymathState(s)).toBe(true); rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = 30; s.progression.acting = 100;
    expect(projectPolymath(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = 31; s.progression.acting = 99; rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); expect(s.progression.sequence).toBe(6);
  });
  it.each([[1, 'GREAT_SUCCESS', 95, 100, 0, 6], [30, 'SUCCESS', 90, 100, 0, 6], [85, 'FAILURE', 80, 90, 25, 7], [100, 'GREAT_FAILURE', 60, 80, 50, 7]] as const)('records recoverable four-tier drinking roll %s', (roll, tier, mind, health, pollution, sequence) => {
    const s = prepared(), old = structuredClone(s.progression.mastery), b = s.polymath.bottles[0]!;
    const ctx = acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
    expect(ctx.c.check).toHaveBeenCalledWith('will', 24);
    expect([b.status, b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, pollution, sequence, 'ACTIVE']);
    for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
    if (sequence === 7) expect(s.progression.acting).toBe(100);
    expect(validatePolymathState(s)).toBe(true); rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
  });
  it('inherits every original Reader family ID, adds two zero masteries and four +1 stats without refilling spirituality', () => {
    const s = prepared(), old = structuredClone([s.reader, s.reasoner, s.detective]), stats = { ...s.character.coreStats };
    acquisition(s, { type: 'CONSUME', bottleId: s.polymath.bottles[0]!.id, confirmed: true });
    expect([s.reader, s.reasoner, s.detective]).toEqual(old); expect(s.polymath.detectiveActingAtPromotion).toBe(100);
    expect(Object.keys(s.progression.mastery)).toEqual([...READER_ABILITY_IDS, ...REASONER_ABILITY_IDS, ...DETECTIVE_ABILITY_IDS, ...POLYMATH_ABILITY_IDS]);
    expect(POLYMATH_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]); expect(POLYMATH_SOURCE_STATUS).toContain('序列5');
  });
  it('keeps failed originals and waits for the next real week before delivering fresh priced stock', () => {
    const s = taught();
    for (let i = 0; i < 3; i++) { const b = buy(s, i); acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.polymath.bottles);
    acquisition(s, { type: 'REQUEST_SUPPLY' }); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' }); rejectAcquisition(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1; acquisition(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.polymath.bottles.slice(0, 3)).toEqual(originals); expect(s.polymath.bottles).toHaveLength(6);
    expect(s.polymath.bottles[3]).toMatchObject({ id: 'polymath-potion-4', status: 'SUPPLIER', labourSteps: 0 });
    expect(validatePolymathState(s)).toBe(true); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' });
  });
  it.each([null, {}, { type: 'BREW', batchId: 'polymath-batch-1' }, { type: 'CONSUME', bottleId: 'polymath-potion-1', confirmed: false }, { type: 'PREPARE', caseId: 'thin-frost', method: 'MIND_CONTROL' }, { type: 'REFLECT', extra: true }, { type: 'OBSERVE', caseId: 'invented' }])('rejects malformed or invented public commands %# without mutation', command => {
    expect(validatePolymathCommand(command)).toBe(false); rejectAcquisition(prepared(), command); rejectActivity(promoted(), command);
  });
  it('rejects forged bottle identity, sources, chronology and inherited mastery in saves', () => {
    const s = promoted();
    for (const change of [(t: SliceState) => { t.polymath.bottles[0]!.source = 'invented'; }, (t: SliceState) => { t.polymath.bottles[0]!.consumedWeek = 30; }, (t: SliceState) => { t.polymath.detectiveActingAtPromotion = 99; }, (t: SliceState) => { delete t.progression.mastery[READER_ABILITY_IDS[0]]; }, (t: SliceState) => { t.polymath.bottles[1]!.labourSteps = 6; }]) { const t = structuredClone(s); change(t); expect(validatePolymathState(t)).toBe(false); }
  });
});


describe('Polymath distinct observed, understood and successfully imitated samples', () => {
  it('hides unseen samples and exposes no hidden capability pool or internal dates', () => {
    const s = promoted(); expect(projectPolymath(s).samples).toEqual([]); expect(polymathCases(detective())).toEqual([]);
    expect(polymathCases(s).map(x => x.id)).toEqual([...POLYMATH_CASE_IDS]);
    expect(polymathActions(s).some(x => x.command.type === 'OBSERVE' && x.enabled)).toBe(true);
    activity(s, { type: 'OBSERVE', caseId: 'flash-study' });
    const samples = projectPolymath(s).samples;
    expect(samples).toHaveLength(1); expect(samples[0]).toMatchObject({ id: 'FLASH', observed: true, understood: false, learned: false });
    expect(Object.keys(samples[0]!).sort()).toEqual(['id', 'label', 'observed', 'understood', 'learned', 'source', 'boundary'].sort());
    expect(samples[0]!.source).toContain('诺亚'); expect(samples[0]!.source).toContain('明确同意');
    expect(s.polymath.samples.FROST.observedWeek).toBeNull(); expect(s.polymath.samples.COURAGE.observedWeek).toBeNull();
    expect(validatePolymathState(s)).toBe(true);
  });
  it('requires the exact observed sample before analysis or ability preparation', () => {
    const s = promoted(); rejectActivity(s, { type: 'ANALYSE', caseId: 'flash-study' });
    rejectActivity(s, { type: 'PREPARE', caseId: 'flash-study', method: 'ABILITY' });
    const before = [s.spirituality, s.progression.acting], mastery = { ...s.progression.mastery };
    const observed = activity(s, { type: 'OBSERVE', caseId: 'flash-study' });
    expect(observed.c.check).not.toHaveBeenCalled(); expect(polymathInside(s)).toBe(false);
    expect(s.polymath.samples.FLASH).toEqual({ observedWeek: s.week, understoodWeek: null, learnedWeek: null, analysisAttemptWeek: null });
    expect([s.spirituality, s.progression.acting]).toEqual(before); expect(s.progression.mastery).toEqual(mastery);
    rejectActivity(s, { type: 'PREPARE', caseId: 'flash-study', method: 'ABILITY' });
    rejectActivity(s, { type: 'ANALYSE', caseId: 'thin-frost' });
    rejectActivity(s, { type: 'OBSERVE', caseId: 'flash-study' });
  });
  it('successful knowledge14 analysis costs one AP but no spirituality, mastery or acting and does not teach', () => {
    const s = promoted(); activity(s, { type: 'OBSERVE', caseId: 'flash-study' });
    const ap = s.actionsRemaining, spirit = s.spirituality, mastery = { ...s.progression.mastery };
    const ctx = activity(s, { type: 'ANALYSE', caseId: 'flash-study' });
    expect(ctx.c.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14); expect(ctx.award).not.toHaveBeenCalled();
    expect([s.actionsRemaining, s.spirituality, s.progression.acting]).toEqual([ap - 1, spirit, 0]);
    expect(s.progression.mastery).toEqual(mastery); expect(polymathInside(s)).toBe(false);
    expect(s.polymath.samples.FLASH).toMatchObject({ understoodWeek: s.week, learnedWeek: null, analysisAttemptWeek: s.week });
    expect(projectPolymath(s).samples[0]).toMatchObject({ observed: true, understood: true, learned: false });
    rejectActivity(s, { type: 'ANALYSE', caseId: 'flash-study' }); expect(validatePolymathState(s)).toBe(true);
  });
  it('failed analysis cannot be rerolled this week and never affects an unseen sample', () => {
    const s = promoted(); activity(s, { type: 'OBSERVE', caseId: 'thin-frost' });
    const spirit = s.spirituality, mastery = { ...s.progression.mastery };
    const ctx = activity(s, { type: 'ANALYSE', caseId: 'thin-frost' }, 100);
    expect(ctx.award).not.toHaveBeenCalled(); expect([s.spirituality, s.progression.acting]).toEqual([spirit, 0]); expect(s.progression.mastery).toEqual(mastery);
    expect(s.polymath.samples.FROST).toMatchObject({ observedWeek: s.week, understoodWeek: null, learnedWeek: null, analysisAttemptWeek: s.week });
    rejectActivity(s, { type: 'ANALYSE', caseId: 'thin-frost' }); rejectActivity(s, { type: 'PREPARE', caseId: 'thin-frost', method: 'ABILITY' });
    s.week += 1; activity(s, { type: 'ANALYSE', caseId: 'thin-frost' });
    expect(s.polymath.samples.FROST.understoodWeek).toBe(s.week); expect(s.polymath.samples.FLASH.observedWeek).toBeNull();
    expect(validatePolymathState(s)).toBe(true);
  });
  it('allows an ordinary comparison immediately after failed analysis without learning the sample', () => {
    const s = promoted(); activity(s, { type: 'OBSERVE', caseId: 'flash-study' }); activity(s, { type: 'ANALYSE', caseId: 'flash-study' }, 100);
    activity(s, { type: 'PREPARE', caseId: 'flash-study', method: 'ORDINARY' });
    const spirit = s.spirituality, ctx = activity(s, { type: 'PERFORM', caseId: 'flash-study' });
    expect(ctx.c.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect(s.spirituality).toBe(spirit);
    expect(s.polymath.samples.FLASH).toMatchObject({ understoodWeek: null, learnedWeek: null });
    expect(s.polymath.cases['flash-study']!.outcome).toBe('FLASH_COMPARED');
    activity(s, { type: 'CLOSE', caseId: 'flash-study' }); activity(s, { type: 'REPORT', caseId: 'flash-study' });
    expect(validatePolymathState(s)).toBe(true);
  });
  it('learns only after actual successful knowledge16, 3S weaker imitation and still requires CLOSE', () => {
    const s = promoted(); begin(s, 'flash-study', 'ABILITY');
    expect(s.polymath.samples.FLASH.learnedWeek).toBeNull(); const spirit = s.spirituality, ap = s.actionsRemaining;
    const ctx = activity(s, { type: 'PERFORM', caseId: 'flash-study' });
    expect(ctx.c.check).toHaveBeenCalledExactlyOnceWith('knowledge', 16); expect(ctx.award).not.toHaveBeenCalled();
    expect([s.actionsRemaining, s.spirituality, s.progression.acting]).toEqual([ap - 1, spirit - 3, 0]);
    expect(s.polymath.samples.FLASH.learnedWeek).toBe(s.week); expect(projectPolymath(s).samples[0]!.learned).toBe(true);
    expect(polymathCases(s)[0]!.result).toContain('弱于'); expect(polymathCases(s)[0]!.result).toContain('没有造成伤害');
    expect(polymathInside(s)).toBe(true); rejectActivity(s, { type: 'REPORT', caseId: 'flash-study' });
    rejectActivity(s, { type: 'ANALYSE', caseId: 'thin-frost' }); expect(validatePolymathState(s)).toBe(true);
    s.actionsRemaining = 0; const exit = activity(s, { type: 'CLOSE', caseId: 'flash-study' });
    expect(s.actionsRemaining).toBe(0); expect(polymathInside(s)).toBe(false); expect(s.spirituality).toBe(spirit - 3);
    expect(vi.mocked(exit.c.note).mock.calls.flat().join(' ')).toContain('确认短效已经结束');
  });
  it('retains costs and understanding after failed imitation, with no same-week reattempt', () => {
    const s = promoted(); begin(s, 'flash-study', 'ABILITY'); const spirit = s.spirituality, sample = { ...s.polymath.samples.FLASH };
    activity(s, { type: 'PERFORM', caseId: 'flash-study' }, 100);
    expect(s.spirituality).toBe(spirit - 3); expect(s.polymath.samples.FLASH).toEqual(sample);
    expect(s.polymath.cases['flash-study']).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', contactOpen: true });
    activity(s, { type: 'CLOSE', caseId: 'flash-study' });
    rejectActivity(s, { type: 'PREPARE', caseId: 'flash-study', method: 'ABILITY' });
    rejectActivity(s, { type: 'PREPARE', caseId: 'flash-study', method: 'ORDINARY' });
    s.week += 1; activity(s, { type: 'PREPARE', caseId: 'flash-study', method: 'ABILITY' }); activity(s, { type: 'PERFORM', caseId: 'flash-study' });
    expect(s.polymath.samples.FLASH.learnedWeek).toBe(s.week); expect(s.spirituality).toBe(spirit - 6); expect(validatePolymathState(s)).toBe(true);
  });
  it('can fail ordinary comparison, analyse in a later week, then prepare imitation without erasing the failed attempt', () => {
    const s = promoted(); begin(s, 'flash-study'); activity(s, { type: 'PERFORM', caseId: 'flash-study' }, 100); activity(s, { type: 'CLOSE', caseId: 'flash-study' });
    const attempt = s.polymath.cases['flash-study']!.attemptWeek;
    s.week += 1; activity(s, { type: 'ANALYSE', caseId: 'flash-study' }); activity(s, { type: 'PREPARE', caseId: 'flash-study', method: 'ABILITY' });
    expect(s.polymath.cases['flash-study']!.attemptWeek).toBe(attempt); expect(validatePolymathState(s)).toBe(true);
  });
  it('allows cancelling an unaffordable imitation and selecting ordinary comparison without giving back AP', () => {
    const s = promoted(); begin(s, 'thin-frost', 'ABILITY'); s.spirituality = 2; rejectActivity(s, { type: 'PERFORM', caseId: 'thin-frost' });
    const ap = s.actionsRemaining; activity(s, { type: 'WITHDRAW', caseId: 'thin-frost' }); expect(s.actionsRemaining).toBe(ap);
    activity(s, { type: 'PREPARE', caseId: 'thin-frost', method: 'ORDINARY' }); activity(s, { type: 'PERFORM', caseId: 'thin-frost' });
    expect(s.spirituality).toBe(2); expect(s.polymath.samples.FROST.learnedWeek).toBeNull(); expect(validatePolymathState(s)).toBe(true);
  });
  it('returns the actual original cup to its original place after limited surface frost without creating items', () => {
    const s = promoted(), inventory = structuredClone([s.seer.batches, s.seer.bottles, s.polymath.bottles]), cash = s.cash;
    begin(s, 'thin-frost', 'ABILITY'); activity(s, { type: 'PERFORM', caseId: 'thin-frost' });
    const result = polymathCases(s).find(p => p.id === 'thin-frost')!.result!;
    expect(result).toContain('这只原杯温水水面'); expect(result).toContain('未冻结任何人'); expect(result).toContain('不自动加入战斗');
    const exit = activity(s, { type: 'CLOSE', caseId: 'thin-frost' });
    expect(vi.mocked(exit.c.note).mock.calls.flat().join(' ')).toContain('原杯归还原位');
    expect([s.seer.batches, s.seer.bottles, s.polymath.bottles]).toEqual(inventory); expect(s.cash).toBe(cash); expect(validatePolymathState(s)).toBe(true);
  });
  it.each(['ABILITY', 'ORDINARY'] as const)('honours adult willing recipient limits and actual stopping for %s', method => {
    const s = promoted(); begin(s, 'willing-chorus', method); const spirit = s.spirituality;
    activity(s, { type: 'PERFORM', caseId: 'willing-chorus' });
    const result = polymathCases(s).find(p => p.id === 'willing-chorus')!.result!;
    expect(result).toContain('成年同伴'); expect(result).toContain(method === 'ABILITY' ? '没有控心' : '没有施加非凡鼓舞');
    expect(s.spirituality).toBe(spirit - (method === 'ABILITY' ? 3 : 0));
    const exit = activity(s, { type: 'CLOSE', caseId: 'willing-chorus' });
    expect(vi.mocked(exit.c.note).mock.calls.flat().join(' ')).toContain('依本人决定');
    expect(s.polymath.samples.COURAGE.learnedWeek).toBe(method === 'ABILITY' ? s.week : null); expect(validatePolymathState(s)).toBe(true);
  });
  it('reaches peaceful100 from three ordinary reports and reflection without learning any samples', () => {
    const s = promoted(), spirit = s.spirituality;
    for (const id of POLYMATH_CASE_IDS) complete(s, id);
    expect(s.progression.acting).toBe(75); activity(s, { type: 'REFLECT' });
    expect([s.progression.acting, s.spirituality, s.polymath.encounter.status]).toEqual([100, spirit, 'AVAILABLE']);
    expect(s.progression.mastery[POLYMATH_ABILITY_IDS[0]]).toBe(24);
    expect(Object.values(s.polymath.samples).every(x => x.observedWeek !== null && x.understoodWeek === null && x.learnedWeek === null)).toBe(true);
    rejectActivity(s, { type: 'REFLECT' }); rejectActivity(s, { type: 'REPORT', caseId: 'flash-study' }); expect(validatePolymathState(s)).toBe(true);
  });
  it('rejects forged learning, wrong sample source/chronology, invented pools and duplicate awards', () => {
    const s = promoted(); complete(s, 'flash-study');
    const changes = [
      (t: SliceState) => { t.polymath.samples.FLASH.learnedWeek = t.week; },
      (t: SliceState) => { t.polymath.samples.FROST.understoodWeek = t.week; },
      (t: SliceState) => { t.polymath.samples.FLASH.observedWeek = t.week + 1; },
      (t: SliceState) => { t.polymath.samples.FLASH.analysisAttemptWeek = t.week - 1; },
      (t: SliceState) => { Object.assign(t.polymath.samples, { TELEPORT: { observedWeek: t.week } }); },
      (t: SliceState) => { Object.assign(t.polymath.samples.FLASH, { npcAbilities: ['unknown'] }); },
      (t: SliceState) => { t.polymath.cases['flash-study']!.outcome = 'FLASH_IMITATED'; },
      (t: SliceState) => { t.polymath.cases['flash-study']!.closes = 0; },
      (t: SliceState) => { t.seer.completedSources.push('polymath-case:flash-study'); },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(validatePolymathState(t)).toBe(false); }
  });
  it('keeps only a single original preparation or open contact and rejects advancing the week while still inside', () => {
    const s = promoted(); begin(s, 'flash-study'); rejectActivity(s, { type: 'OBSERVE', caseId: 'thin-frost' });
    activity(s, { type: 'PERFORM', caseId: 'flash-study' });
    rejectAcquisition(s, { type: 'LEARN_GUIDANCE' }); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
    s.week += 1; expect(validatePolymathLife(s)).toBe(false);
  });
});

describe('Polymath actual original empty courtyard dispute', () => {
  it('requires a report and an actual one-AP visit, without learning FLASH from the encounter', () => {
    const s = promoted(); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' }); complete(s, 'flash-study');
    const ap = s.actionsRemaining, ctx = activity(s, { type: 'ENCOUNTER_FIGHT' });
    expect(s.actionsRemaining).toBe(ap - 1); expect(s.combat?.encounterId).toBe('POLYMATH_DISPUTE');
    expect(s.polymath.encounter).toMatchObject({ status: 'FIGHTING', attemptWeek: s.week, startHistoryIndex: s.combatHistory.length });
    expect(s.polymath.samples.FLASH.learnedWeek).toBeNull();
    const notes = vi.mocked(ctx.c.note).mock.calls.flat().join(' ');
    for (const text of ['伊恩', '普通短棍', '2米', '净空', '没有旁人', '原固定灯照', '原出口']) expect(notes).toContain(text);
    expect(validatePolymathState(s)).toBe(true);
  });
  it('offers peace without bonus acting/mastery and retains refusal until a later real week', () => {
    const s = promoted(); complete(s, 'flash-study'); activity(s, { type: 'ENCOUNTER_TALK' }, 100);
    expect(s.polymath.encounter.status).toBe('AVAILABLE'); rejectActivity(s, { type: 'ENCOUNTER_TALK' });
    s.week += 1; const acting = s.progression.acting, mastery = { ...s.progression.mastery }, ctx = activity(s, { type: 'ENCOUNTER_TALK' });
    expect(s.polymath.encounter.status).toBe('RESOLVED'); expect(s.progression.acting).toBe(acting); expect(s.progression.mastery).toEqual(mastery);
    expect(ctx.award).not.toHaveBeenCalled(); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' }); expect(validatePolymathState(s)).toBe(true);
  });
  it.each(['RETREATED', 'PLAYER_DEAD'] as const)('retains actual %s outcome without rewards or moving possessions', outcome => {
    const s = promoted(); complete(s, 'flash-study'); const oldDetective = structuredClone(s.detective), cash = s.cash, inventory = structuredClone([s.seer.batches, s.seer.bottles, s.polymath.bottles]);
    activity(s, { type: 'ENCOUNTER_FIGHT' }); if (outcome === 'PLAYER_DEAD') s.status = 'DEAD';
    const ctx = context(s); settlePolymathEncounter(s, outcome, ctx.c, ctx.award);
    expect(s.polymath.encounter.status).toBe(outcome === 'PLAYER_DEAD' ? 'LOST' : 'RETREATED');
    expect(s.combat).toBeNull(); expect(ctx.award).not.toHaveBeenCalled(); expect(s.detective).toEqual(oldDetective);
    expect(s.cash).toBe(cash); expect([s.seer.batches, s.seer.bottles, s.polymath.bottles]).toEqual(inventory); expect(validatePolymathState(s)).toBe(true);
  });
  it('awards mastery25 once only for actual effective surviving participation, never a nominal win', () => {
    const empty = promoted(); complete(empty, 'flash-study'); activity(empty, { type: 'ENCOUNTER_FIGHT' });
    const noWork = context(empty); settlePolymathEncounter(empty, 'ENEMY_SURRENDERED', noWork.c, noWork.award); expect(noWork.award).not.toHaveBeenCalled();
    const s = promoted(); complete(s, 'flash-study'); activity(s, { type: 'ENCOUNTER_FIGHT' });
    s.combatHistory.push({ round: 1, stance: 'ATTACK', first: 'PLAYER', playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1,
      moves: [{ actor: 'PLAYER', label: '实际有限动作', selfGain: 3, enemyReduction: 0 }], playerAdvantage: 3, enemyAdvantage: 0, winChance: 60, winner: 'PLAYER', consequence: '抵抗结束', consequenceWeights: null, retreat: 'NONE' });
    const ctx = context(s), acting = s.progression.acting; settlePolymathEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award);
    expect(ctx.award).toHaveBeenCalledExactlyOnceWith('polymath-dispute', 25); expect(s.progression.acting).toBe(acting);
    expect(validatePolymathState(s)).toBe(true); expect(() => settlePolymathEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award)).toThrow();
    const forged = structuredClone(s); forged.combatHistory[0]!.moves[0]!.selfGain = 0; expect(validatePolymathState(forged)).toBe(false);
  });
  it('rejects stale fighting weeks and invented encounter powers', () => {
    const s = promoted(); complete(s, 'flash-study'); activity(s, { type: 'ENCOUNTER_FIGHT' });
    const stale = structuredClone(s); stale.week += 1; expect(validatePolymathState(stale)).toBe(false);
    const foreign = structuredClone(s); Object.assign(foreign.polymath.encounter, { frozenEnemy: true }); expect(validatePolymathState(foreign)).toBe(false);
  });
});
