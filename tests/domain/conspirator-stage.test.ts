import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyHunterCommand } from '../../src/domain/hunter/index.js';
import { HUNTER_ABILITY_IDS } from '../../src/domain/hunter/types.js';
import { applyProvokerCommand } from '../../src/domain/provoker/index.js';
import { PROVOKER_ABILITY_IDS } from '../../src/domain/provoker/types.js';
import { applyPyromaniacCommand } from '../../src/domain/pyromaniac/index.js';
import { PYROMANIAC_ABILITY_IDS } from '../../src/domain/pyromaniac/types.js';
import { applyConspiratorCommand, createConspiratorState, projectConspirator, validateConspiratorCommand, validateConspiratorState } from '../../src/domain/conspirator/index.js';
import { applyConspiratorActivity, conspiratorActions, conspiratorCases, conspiratorInside, validateConspiratorLife } from '../../src/domain/conspirator/life.js';
import { settleConspiratorEncounter } from '../../src/domain/conspirator/encounter.js';
import { CONSPIRATOR_FORMULA_STATUS, CONSPIRATOR_PRICES, CONSPIRATOR_SOURCE_STATUS } from '../../src/domain/conspirator/content.js';
import { CONSPIRATOR_ABILITY_IDS, CONSPIRATOR_CASE_IDS, type ConspiratorAcquisitionCommand, type ConspiratorActivityCommand, type ConspiratorCaseId } from '../../src/domain/conspirator/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function ordinary(): SliceState {
  const s = createSliceRun('conspirator-domain', sliceDefaultCreationSelection, 'conspirator-fixed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5; s.cash = 50000;
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.conspirator = createConspiratorState(); return s;
}
function context(s: SliceState, roll = 1) {
  const c: SeerContext = {
    roll: vi.fn(min => min), note: vi.fn(),
    check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })),
  };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source);
    s.progression.mastery[CONSPIRATOR_ABILITY_IDS[0]]! += amount;
  });
  return { c, award };
}
function pyromaniac(): SliceState {
  const s = ordinary(), c = context(s).c;
  applyHunterCommand(s, { type: 'DISCOVER' }, c);
  applyHunterCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyHunterCommand(s, { type: 'BUY_POTION', bottleId: s.hunter.bottles[0]!.id }, c);
  applyHunterCommand(s, { type: 'CONSUME', bottleId: s.hunter.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applyProvokerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyProvokerCommand(s, { type: 'BUY_POTION', bottleId: s.provoker.bottles[0]!.id }, c);
  applyProvokerCommand(s, { type: 'CONSUME', bottleId: s.provoker.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  applyPyromaniacCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyPyromaniacCommand(s, { type: 'BUY_POTION', bottleId: s.pyromaniac.bottles[0]!.id }, c);
  applyPyromaniacCommand(s, { type: 'CONSUME', bottleId: s.pyromaniac.bottles[0]!.id, confirmed: true }, c);
  s.week = 31; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...HUNTER_ABILITY_IDS, ...PROVOKER_ABILITY_IDS, ...PYROMANIAC_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 20000; s.actionsRemaining = 100; s.health = 100; s.mind = 100; s.spirituality = 31; s.character.coreStats.will = 25;
  return s;
}
function acquisition(s: SliceState, command: ConspiratorAcquisitionCommand, roll = 1) { const ctx = context(s, roll); applyConspiratorCommand(s, command, ctx.c); return ctx; }
function activity(s: SliceState, command: ConspiratorActivityCommand, roll = 1) { const ctx = context(s, roll); applyConspiratorActivity(s, command, ctx.c, ctx.award); return ctx; }
function taught(s = pyromaniac()) { acquisition(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const b = s.conspirator.bottles[index]!; acquisition(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); acquisition(s, { type: 'CONSUME', bottleId: s.conspirator.bottles[0]!.id, confirmed: true }); return s; }
function rejectAcquisition(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyConspiratorCommand(s, command as ConspiratorAcquisitionCommand, ctx.c)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled();
}
function rejectActivity(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyConspiratorActivity(s, command as ConspiratorActivityCommand, ctx.c, ctx.award)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: ConspiratorCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  activity(s, { type: 'OBSERVE', caseId }); activity(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: ConspiratorCaseId) {
  begin(s, caseId); activity(s, { type: 'PERFORM', caseId }); activity(s, { type: 'CLOSE', caseId });
  if (caseId === 'rejected-detour') { s.week += 1; activity(s, { type: 'PREPARE', caseId, method: 'ORDINARY' }); activity(s, { type: 'PERFORM', caseId }); activity(s, { type: 'CLOSE', caseId }); }
  activity(s, { type: 'REPORT', caseId });
}

describe('Conspirator S6 finite original bottles and inherited promotion', () => {
  it('hides the future channel and creates independent original stocks', () => {
    const s = ordinary(), p = projectConspirator(s), other = createConspiratorState();
    expect(validateConspiratorState(s)).toBe(true);
    expect(p).toMatchObject({ discovered: false, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [], bottles: [], actions: [], abilities: [], cases: [], supplies: '' });
    expect(p.story).toBeUndefined(); other.bottles[0]!.labourSteps = 5; other.cases['rejected-detour']!.notes.push('changed');
    expect(s.conspirator.bottles[0]!.labourSteps).toBe(0); expect(s.conspirator.cases['rejected-detour']!.notes).toEqual([]);
    rejectAcquisition(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges 360 and one action for guidance without inventing a formula', () => {
    const s = pyromaniac(), before = structuredClone([s.hunter, s.provoker, s.pyromaniac]), c = acquisition(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([19640, 99]); expect([s.hunter, s.provoker, s.pyromaniac]).toEqual(before);
    expect(projectConspirator(s)).toMatchObject({ guidanceKnown: true, formulaKnown: false, formula: [] });
    expect(CONSPIRATOR_FORMULA_STATUS).toContain('尚未核实'); expect(CONSPIRATOR_PRICES).toEqual({ guidance: 360, potion: 3320, labourCredit: 3000 });
    expect(c.c.check).not.toHaveBeenCalled(); rejectAcquisition(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five actual labour actions per original bottle and still takes 320 cash', () => {
    const s = taught(), b = s.conspirator.bottles[0]!;
    for (let i = 0; i < 5; i++) acquisition(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.status, b.labourSteps, s.actionsRemaining]).toEqual(['SUPPLIER', 5, 94]);
    rejectAcquisition(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([19320, 94, 'PLAYER']);
    expect(projectConspirator(s).actions.find(a => a.id === 'buy-conspirator-potion-2')!.cost).toContain('3320便士');
    rejectAcquisition(s, { type: 'BUY_POTION', bottleId: b.id }); rejectAcquisition(s, { type: 'POTION_WORK', bottleId: b.id });
    expect(validateConspiratorState(s)).toBe(true);
  });
  it('does not discount partial labour or transfer credit to another original', () => {
    const s = taught(); acquisition(s, { type: 'POTION_WORK', bottleId: s.conspirator.bottles[0]!.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(3320); expect(s.conspirator.bottles[1]!.labourSteps).toBe(0);
    s.cash = 3319; rejectAcquisition(s, { type: 'BUY_POTION', bottleId: s.conspirator.bottles[1]!.id });
  });
  it('allows early preparation but checks acting100 and twelve complete S7 weeks at the separate drink', () => {
    const s = pyromaniac(); s.week = 19; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validateConspiratorState(s)).toBe(true); rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = 30; s.progression.acting = 100;
    expect(projectConspirator(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = 31; s.progression.acting = 99; rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); expect(s.progression.sequence).toBe(6);
  });
  it.each([[1, 'GREAT_SUCCESS', 95, 100, 0, 6], [30, 'SUCCESS', 90, 100, 0, 6], [85, 'FAILURE', 80, 90, 25, 7], [100, 'GREAT_FAILURE', 60, 80, 50, 7]] as const)('records recoverable four-tier drinking roll %s', (roll, tier, mind, health, pollution, sequence) => {
    const s = prepared(), old = structuredClone(s.progression.mastery), b = s.conspirator.bottles[0]!;
    const ctx = acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
    expect(ctx.c.check).toHaveBeenCalledWith('will', 24);
    expect([b.status, b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, pollution, sequence, 'ACTIVE']);
    for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
    if (sequence === 7) expect(s.progression.acting).toBe(100);
    expect(validateConspiratorState(s)).toBe(true); rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
  });
  it('inherits all ten IDs, adds only two zero masteries and four +1 stats without refilling spirituality', () => {
    const s = prepared(), old = structuredClone([s.hunter, s.provoker, s.pyromaniac]), stats = { ...s.character.coreStats };
    acquisition(s, { type: 'CONSUME', bottleId: s.conspirator.bottles[0]!.id, confirmed: true });
    expect([s.hunter, s.provoker, s.pyromaniac]).toEqual(old); expect(s.conspirator.pyromaniacActingAtPromotion).toBe(100);
    expect(Object.keys(s.progression.mastery)).toEqual([...HUNTER_ABILITY_IDS, ...PROVOKER_ABILITY_IDS, ...PYROMANIAC_ABILITY_IDS, ...CONSPIRATOR_ABILITY_IDS]);
    expect(CONSPIRATOR_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]); expect(CONSPIRATOR_SOURCE_STATUS).toContain('序列5');
  });
  it('keeps failed originals and waits for the next real week before delivering fresh priced stock', () => {
    const s = taught();
    for (let i = 0; i < 3; i++) { const b = buy(s, i); acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.conspirator.bottles);
    acquisition(s, { type: 'REQUEST_SUPPLY' }); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' }); rejectAcquisition(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1; acquisition(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.conspirator.bottles.slice(0, 3)).toEqual(originals); expect(s.conspirator.bottles).toHaveLength(6);
    expect(s.conspirator.bottles[3]).toMatchObject({ id: 'conspirator-potion-4', status: 'SUPPLIER', labourSteps: 0 });
    expect(validateConspiratorState(s)).toBe(true); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' });
  });
  it.each([null, {}, { type: 'BREW', batchId: 'conspirator-batch-1' }, { type: 'CONSUME', bottleId: 'conspirator-potion-1', confirmed: false }, { type: 'PREPARE', caseId: 'rejected-detour', method: 'MIND_CONTROL' }, { type: 'REFLECT', extra: true }, { type: 'OBSERVE', caseId: 'invented' }])('rejects malformed or invented public commands %# without mutation', command => {
    expect(validateConspiratorCommand(command)).toBe(false); rejectAcquisition(prepared(), command); rejectActivity(promoted(), command);
  });
  it('rejects forged bottle identity, sources, chronology and inherited mastery in saves', () => {
    const s = promoted();
    for (const change of [(t: SliceState) => { t.conspirator.bottles[0]!.source = 'invented'; }, (t: SliceState) => { t.conspirator.bottles[0]!.consumedWeek = 30; }, (t: SliceState) => { t.conspirator.pyromaniacActingAtPromotion = 99; }, (t: SliceState) => { delete t.progression.mastery[HUNTER_ABILITY_IDS[0]]; }, (t: SliceState) => { t.conspirator.bottles[1]!.labourSteps = 6; }]) { const t = structuredClone(s); change(t); expect(validateConspiratorState(t)).toBe(false); }
  });
});

describe('Conspirator evidence, actual refusal and limited peaceful growth', () => {
  it('keeps the three original cases distinct and hides them before promotion', () => {
    expect(conspiratorCases(pyromaniac())).toEqual([]); const s = promoted();
    expect(conspiratorCases(s).map(x => x.id)).toEqual([...CONSPIRATOR_CASE_IDS]);
    expect(conspiratorCases(s).every(x => x.observations.length === 0)).toBe(true); expect(conspiratorActions(s).some(x => x.command.type === 'OBSERVE')).toBe(true);
  });
  it('requires actual observation, one preparation and a real stop before reporting', () => {
    const s = promoted(); rejectActivity(s, { type: 'PERFORM', caseId: 'warehouse-rosters' }); begin(s, 'warehouse-rosters');
    rejectActivity(s, { type: 'OBSERVE', caseId: 'urgent-handover' }); activity(s, { type: 'PERFORM', caseId: 'warehouse-rosters' });
    expect(conspiratorInside(s)).toBe(true); rejectActivity(s, { type: 'REPORT', caseId: 'warehouse-rosters' });
    const ap = s.actionsRemaining, spirit = s.spirituality; activity(s, { type: 'CLOSE', caseId: 'warehouse-rosters' });
    expect([s.actionsRemaining, s.spirituality]).toEqual([ap, spirit]); activity(s, { type: 'REPORT', caseId: 'warehouse-rosters' });
    expect(s.progression.acting).toBe(25); rejectActivity(s, { type: 'REPORT', caseId: 'warehouse-rosters' }); expect(validateConspiratorState(s)).toBe(true);
  });
  it.each(['ABILITY', 'ORDINARY'] as const)('makes the first detour attempt a real refusal even on successful RNG: %s', method => {
    const s = promoted(); begin(s, 'rejected-detour', method); const beforeSpirit = s.spirituality, ctx = activity(s, { type: 'PERFORM', caseId: 'rejected-detour' }, 1);
    expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled();
    const r = s.conspirator.cases['rejected-detour']!;
    expect(r).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', contactOpen: true, revised: false }); expect(r.notes).toHaveLength(2);
    expect(r.notes.join(' ')).toContain('明确拒绝'); expect(r.notes.join(' ')).toContain('新公开事实');
    expect(beforeSpirit - s.spirituality).toBe(method === 'ABILITY' ? 3 : 0); expect(s.progression.acting).toBe(0);
    expect(conspiratorCases(s).find(x => x.id === 'rejected-detour')!.observations.join(' ')).toContain('明确拒绝'); expect(validateConspiratorState(s)).toBe(true);
  });
  it('preserves rejection on close, prohibits same-week retry and actually revises next week', () => {
    const s = promoted(); begin(s, 'rejected-detour'); activity(s, { type: 'PERFORM', caseId: 'rejected-detour' });
    const notes = [...s.conspirator.cases['rejected-detour']!.notes]; activity(s, { type: 'CLOSE', caseId: 'rejected-detour' });
    rejectActivity(s, { type: 'OBSERVE', caseId: 'rejected-detour' }); rejectActivity(s, { type: 'PREPARE', caseId: 'rejected-detour', method: 'ORDINARY' });
    expect(s.conspirator.cases['rejected-detour']!.notes).toEqual(notes);
    s.week += 1; activity(s, { type: 'PREPARE', caseId: 'rejected-detour', method: 'ORDINARY' });
    expect(s.conspirator.cases['rejected-detour']!.revised).toBe(true); expect(s.conspirator.cases['rejected-detour']!.notes.slice(0, 2)).toEqual(notes);
    activity(s, { type: 'WITHDRAW', caseId: 'rejected-detour' }); expect(s.conspirator.cases['rejected-detour']!.revised).toBe(true);
    expect(validateConspiratorState(s)).toBe(true);
  });
  it('can fail again after evidence-based revision and retains all evidence through a later success', () => {
    const s = promoted(); begin(s, 'rejected-detour'); activity(s, { type: 'PERFORM', caseId: 'rejected-detour' }); activity(s, { type: 'CLOSE', caseId: 'rejected-detour' }); s.week += 1;
    activity(s, { type: 'PREPARE', caseId: 'rejected-detour', method: 'ORDINARY' }); const fail = activity(s, { type: 'PERFORM', caseId: 'rejected-detour' }, 100);
    expect(fail.c.check).toHaveBeenCalledOnce(); expect(s.conspirator.cases['rejected-detour']!.status).toBe('OBSERVED');
    const notes = [...s.conspirator.cases['rejected-detour']!.notes]; activity(s, { type: 'CLOSE', caseId: 'rejected-detour' }); s.week += 1;
    activity(s, { type: 'PREPARE', caseId: 'rejected-detour', method: 'ORDINARY' }); activity(s, { type: 'PERFORM', caseId: 'rejected-detour' }); activity(s, { type: 'CLOSE', caseId: 'rejected-detour' }); activity(s, { type: 'REPORT', caseId: 'rejected-detour' });
    expect(s.conspirator.cases['rejected-detour']!.notes).toEqual(notes); expect(validateConspiratorState(s)).toBe(true);
  });
  it('charges ability costs on failed reasoning, needs a real close and delays retry', () => {
    const s = promoted(); begin(s, 'warehouse-rosters', 'ABILITY'); const spirit = s.spirituality, mind = s.mind;
    activity(s, { type: 'PERFORM', caseId: 'warehouse-rosters' }, 100);
    expect([s.spirituality, s.mind, s.progression.acting]).toEqual([spirit - 3, mind - 5, 0]);
    activity(s, { type: 'CLOSE', caseId: 'warehouse-rosters' }); rejectActivity(s, { type: 'PREPARE', caseId: 'warehouse-rosters', method: 'ORDINARY' });
    s.week += 1; activity(s, { type: 'PREPARE', caseId: 'warehouse-rosters', method: 'ORDINARY' }); expect(validateConspiratorState(s)).toBe(true);
  });
  it('allows ordinary fallback after canceling an unaffordable ability preparation', () => {
    const s = promoted(); begin(s, 'urgent-handover', 'ABILITY'); s.spirituality = 2; rejectActivity(s, { type: 'PERFORM', caseId: 'urgent-handover' });
    const ap = s.actionsRemaining; activity(s, { type: 'WITHDRAW', caseId: 'urgent-handover' }); expect(s.actionsRemaining).toBe(ap);
    activity(s, { type: 'PREPARE', caseId: 'urgent-handover', method: 'ORDINARY' }); activity(s, { type: 'PERFORM', caseId: 'urgent-handover' });
    expect(s.spirituality).toBe(2); expect(s.conspirator.cases['urgent-handover']!.outcome).toBe('BACKUP_USED');
  });
  it('reaches acting100 with three ordinary reports and reflection, without combat or forced persuasion', () => {
    const s = promoted(), spirit = s.spirituality;
    for (const id of CONSPIRATOR_CASE_IDS) complete(s, id);
    expect(s.progression.acting).toBe(75); activity(s, { type: 'REFLECT' });
    expect([s.progression.acting, s.spirituality, s.conspirator.encounter.status]).toEqual([100, spirit, 'AVAILABLE']);
    expect(s.progression.mastery[CONSPIRATOR_ABILITY_IDS[0]]).toBe(24); expect(validateConspiratorState(s)).toBe(true);
    rejectActivity(s, { type: 'REFLECT' });
  });
  it('rejects removed refusal records, forged revision, premature reports and duplicate growth sources', () => {
    const s = promoted(); complete(s, 'rejected-detour');
    for (const change of [(t: SliceState) => { t.conspirator.cases['rejected-detour']!.notes = []; }, (t: SliceState) => { t.conspirator.cases['rejected-detour']!.revised = false; }, (t: SliceState) => { t.conspirator.cases['rejected-detour']!.closes = 0; }, (t: SliceState) => { t.seer.completedSources.push('conspirator-case:rejected-detour'); }, (t: SliceState) => { t.conspirator.cases['urgent-handover']!.revised = true; }]) { const t = structuredClone(s); change(t); expect(validateConspiratorLife(t)).toBe(false); }
  });
  it('keeps a zero-action close available and blocks unrelated activity during open contact', () => {
    const s = promoted(); begin(s, 'warehouse-rosters'); activity(s, { type: 'PERFORM', caseId: 'warehouse-rosters' }); s.actionsRemaining = 0;
    rejectActivity(s, { type: 'OBSERVE', caseId: 'urgent-handover' }); activity(s, { type: 'CLOSE', caseId: 'warehouse-rosters' });
    expect(conspiratorInside(s)).toBe(false); expect(s.actionsRemaining).toBe(0);
  });
});

describe('Conspirator bounded original back-door dispute', () => {
  it('requires an actual report and permits peace without extra acting or mastery', () => {
    const s = promoted(); rejectActivity(s, { type: 'ENCOUNTER_TALK' }); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
    complete(s, 'warehouse-rosters'); const acting = s.progression.acting, ap = s.actionsRemaining, mastery = { ...s.progression.mastery };
    const ctx = activity(s, { type: 'ENCOUNTER_TALK' });
    expect([s.conspirator.encounter.status, s.actionsRemaining, s.progression.acting]).toEqual(['RESOLVED', ap - 1, acting]);
    expect(s.progression.mastery).toEqual(mastery); expect(ctx.award).not.toHaveBeenCalled(); expect(validateConspiratorState(s)).toBe(true);
    rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
  });
  it('keeps a failed conversation and permits only next-week talk retry', () => {
    const s = promoted(); complete(s, 'warehouse-rosters'); activity(s, { type: 'ENCOUNTER_TALK' }, 100);
    expect(s.conspirator.encounter.status).toBe('AVAILABLE'); rejectActivity(s, { type: 'ENCOUNTER_TALK' });
    s.week += 1; activity(s, { type: 'ENCOUNTER_TALK' }); expect(s.conspirator.encounter.status).toBe('RESOLVED');
  });
  it('starts the visible original encounter and settles retreat without moving any possessions or rewarding it', () => {
    const s = promoted(); complete(s, 'warehouse-rosters'); const cash = s.cash;
    activity(s, { type: 'ENCOUNTER_FIGHT' }); expect(s.combat?.encounterId).toBe('CONSPIRATOR_DISPUTE'); expect(validateConspiratorState(s)).toBe(true);
    const ctx = context(s); settleConspiratorEncounter(s, 'RETREATED', ctx.c, ctx.award);
    expect([s.combat, s.cash, s.conspirator.encounter.status]).toEqual([null, cash, 'RETREATED']); expect(ctx.award).not.toHaveBeenCalled();
    expect(validateConspiratorState(s)).toBe(true); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
  });
  it('does not reward a nominal victory without effective participation', () => {
    const s = promoted(); complete(s, 'warehouse-rosters'); activity(s, { type: 'ENCOUNTER_FIGHT' });
    const ctx = context(s); settleConspiratorEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award);
    expect(ctx.award).not.toHaveBeenCalled(); expect(s.conspirator.encounter.status).toBe('RESOLVED');
  });
  it('awards exactly one mastery25 only for effective new combat participation', () => {
    const s = promoted(); complete(s, 'warehouse-rosters'); activity(s, { type: 'ENCOUNTER_FIGHT' });
    s.combatHistory.push({ round: 1, stance: 'ATTACK', first: 'PLAYER', playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1,
      moves: [{ actor: 'PLAYER', label: '实际有限攻势', selfGain: 3, enemyReduction: 0 }], playerAdvantage: 3, enemyAdvantage: 0, winChance: 60, winner: 'PLAYER', consequence: '抵抗结束', consequenceWeights: null, retreat: 'NONE' });
    const ctx = context(s), acting = s.progression.acting;
    settleConspiratorEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award);
    expect(ctx.award).toHaveBeenCalledExactlyOnceWith('conspirator-dispute', 25); expect(s.progression.acting).toBe(acting);
    expect(validateConspiratorState(s)).toBe(true);
    expect(() => settleConspiratorEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award)).toThrow();
    const forged = structuredClone(s); forged.combatHistory[0]!.moves[0]!.selfGain = 0; expect(validateConspiratorState(forged)).toBe(false);
  });
  it('preserves real death and never awards a lost encounter', () => {
    const s = promoted(); complete(s, 'warehouse-rosters'); activity(s, { type: 'ENCOUNTER_FIGHT' }); s.status = 'DEAD';
    const ctx = context(s); settleConspiratorEncounter(s, 'PLAYER_DEAD', ctx.c, ctx.award);
    expect([s.status, s.conspirator.encounter.status, s.combat]).toEqual(['DEAD', 'LOST', null]); expect(ctx.award).not.toHaveBeenCalled();
  });
});
