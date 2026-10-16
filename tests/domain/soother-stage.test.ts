import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applySleeplessCommand } from '../../src/domain/sleepless/index.js';
import { SLEEPLESS_ABILITY_IDS } from '../../src/domain/sleepless/types.js';
import { applyMidnightCommand } from '../../src/domain/midnight/index.js';
import { MIDNIGHT_ABILITY_IDS } from '../../src/domain/midnight/types.js';
import { applyNightmareCommand } from '../../src/domain/nightmare/index.js';
import { NIGHTMARE_ABILITY_IDS } from '../../src/domain/nightmare/types.js';
import { applySootherCommand, createSootherState, projectSoother, validateSootherCommand, validateSootherState } from '../../src/domain/soother/index.js';
import { applySootherActivity, sootherActions, sootherCases, sootherInside, validateSootherLife } from '../../src/domain/soother/life.js';
import { settleSootherEncounter } from '../../src/domain/soother/encounter.js';
import { SOOTHER_FORMULA_STATUS, SOOTHER_PRICES, SOOTHER_SOURCE_STATUS } from '../../src/domain/soother/content.js';
import { SOOTHER_ABILITY_IDS, SOOTHER_CASE_IDS, type SootherAcquisitionCommand, type SootherActivityCommand, type SootherCaseId } from '../../src/domain/soother/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function ordinary(): SliceState {
  const s = createSliceRun('soother-domain', sliceDefaultCreationSelection, 'soother-fixed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5; s.cash = 50000;
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.soother = createSootherState(); return s;
}
function context(s: SliceState, roll = 1) {
  const c: SeerContext = {
    roll: vi.fn(min => min), note: vi.fn(),
    check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })),
  };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source);
    s.progression.mastery[SOOTHER_ABILITY_IDS[0]]! += amount;
  });
  return { c, award };
}
function nightmare(): SliceState {
  const s = ordinary(), c = context(s).c;
  applySleeplessCommand(s, { type: 'DISCOVER' }, c);
  applySleeplessCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applySleeplessCommand(s, { type: 'BUY_POTION', bottleId: s.sleepless.bottles[0]!.id }, c);
  applySleeplessCommand(s, { type: 'CONSUME', bottleId: s.sleepless.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applyMidnightCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyMidnightCommand(s, { type: 'BUY_POTION', bottleId: s.midnight.bottles[0]!.id }, c);
  applyMidnightCommand(s, { type: 'CONSUME', bottleId: s.midnight.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  applyNightmareCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyNightmareCommand(s, { type: 'BUY_POTION', bottleId: s.nightmare.bottles[0]!.id }, c);
  applyNightmareCommand(s, { type: 'CONSUME', bottleId: s.nightmare.bottles[0]!.id, confirmed: true }, c);
  s.week = 31; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...SLEEPLESS_ABILITY_IDS, ...MIDNIGHT_ABILITY_IDS, ...NIGHTMARE_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 20000; s.actionsRemaining = 100; s.health = 100; s.mind = 100; s.spirituality = 31; s.character.coreStats.will = 25;
  return s;
}
function acquisition(s: SliceState, command: SootherAcquisitionCommand, roll = 1) { const ctx = context(s, roll); applySootherCommand(s, command, ctx.c); return ctx; }
function activity(s: SliceState, command: SootherActivityCommand, roll = 1) { const ctx = context(s, roll); applySootherActivity(s, command, ctx.c, ctx.award); return ctx; }
function taught(s = nightmare()) { acquisition(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const b = s.soother.bottles[index]!; acquisition(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); acquisition(s, { type: 'CONSUME', bottleId: s.soother.bottles[0]!.id, confirmed: true }); return s; }
function rejectAcquisition(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applySootherCommand(s, command as SootherAcquisitionCommand, ctx.c)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled();
}
function rejectActivity(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applySootherActivity(s, command as SootherActivityCommand, ctx.c, ctx.award)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: SootherCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  activity(s, { type: 'OBSERVE', caseId }); activity(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: SootherCaseId) {
  begin(s, caseId); activity(s, { type: 'PERFORM', caseId }); activity(s, { type: 'CLOSE', caseId });
  if (caseId === 'echo-at-wall') { s.week += 1; activity(s, { type: 'PREPARE', caseId, method: 'ORDINARY' }); activity(s, { type: 'PERFORM', caseId }); activity(s, { type: 'CLOSE', caseId }); }
  activity(s, { type: 'REPORT', caseId });
}

describe('Soother S6 finite original bottles and inherited promotion', () => {
  it('hides the future channel and creates independent original stocks', () => {
    const s = ordinary(), p = projectSoother(s), other = createSootherState();
    expect(validateSootherState(s)).toBe(true);
    expect(p).toMatchObject({ discovered: false, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [], bottles: [], actions: [], abilities: [], cases: [], supplies: '' });
    expect(p.story).toBeUndefined(); other.bottles[0]!.labourSteps = 5; other.cases['echo-at-wall']!.notes.push('changed');
    expect(s.soother.bottles[0]!.labourSteps).toBe(0); expect(s.soother.cases['echo-at-wall']!.notes).toEqual([]);
    rejectAcquisition(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges 360 and one action for guidance without inventing a formula', () => {
    const s = nightmare(), before = structuredClone([s.sleepless, s.midnight, s.nightmare]), c = acquisition(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([19640, 99]); expect([s.sleepless, s.midnight, s.nightmare]).toEqual(before);
    expect(projectSoother(s)).toMatchObject({ guidanceKnown: true, formulaKnown: false, formula: [] });
    expect(SOOTHER_FORMULA_STATUS).toContain('尚未核实'); expect(SOOTHER_PRICES).toEqual({ guidance: 360, potion: 3320, labourCredit: 3000 });
    expect(c.c.check).not.toHaveBeenCalled(); rejectAcquisition(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five actual labour actions per original bottle and still takes 320 cash', () => {
    const s = taught(), b = s.soother.bottles[0]!;
    for (let i = 0; i < 5; i++) acquisition(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.status, b.labourSteps, s.actionsRemaining]).toEqual(['SUPPLIER', 5, 94]);
    rejectAcquisition(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([19320, 94, 'PLAYER']);
    expect(projectSoother(s).actions.find(a => a.id === 'buy-soother-potion-2')!.cost).toContain('3320便士');
    rejectAcquisition(s, { type: 'BUY_POTION', bottleId: b.id }); rejectAcquisition(s, { type: 'POTION_WORK', bottleId: b.id });
    expect(validateSootherState(s)).toBe(true);
  });
  it('does not discount partial labour or transfer credit to another original', () => {
    const s = taught(); acquisition(s, { type: 'POTION_WORK', bottleId: s.soother.bottles[0]!.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(3320); expect(s.soother.bottles[1]!.labourSteps).toBe(0);
    s.cash = 3319; rejectAcquisition(s, { type: 'BUY_POTION', bottleId: s.soother.bottles[1]!.id });
  });
  it('allows early preparation but checks acting100 and twelve complete S7 weeks at the separate drink', () => {
    const s = nightmare(); s.week = 19; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validateSootherState(s)).toBe(true); rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = 30; s.progression.acting = 100;
    expect(projectSoother(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = 31; s.progression.acting = 99; rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); expect(s.progression.sequence).toBe(6);
  });
  it.each([[1, 'GREAT_SUCCESS', 95, 100, 0, 6], [30, 'SUCCESS', 90, 100, 0, 6], [85, 'FAILURE', 80, 90, 25, 7], [100, 'GREAT_FAILURE', 60, 80, 50, 7]] as const)('records recoverable four-tier drinking roll %s', (roll, tier, mind, health, pollution, sequence) => {
    const s = prepared(), old = structuredClone(s.progression.mastery), b = s.soother.bottles[0]!;
    const ctx = acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
    expect(ctx.c.check).toHaveBeenCalledWith('will', 24);
    expect([b.status, b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, pollution, sequence, 'ACTIVE']);
    for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
    if (sequence === 7) expect(s.progression.acting).toBe(100);
    expect(validateSootherState(s)).toBe(true); rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
  });
  it('inherits every original Sleepless family ID, adds two zero masteries and four +1 stats without refilling spirituality', () => {
    const s = prepared(), old = structuredClone([s.sleepless, s.midnight, s.nightmare]), stats = { ...s.character.coreStats };
    acquisition(s, { type: 'CONSUME', bottleId: s.soother.bottles[0]!.id, confirmed: true });
    expect([s.sleepless, s.midnight, s.nightmare]).toEqual(old); expect(s.soother.nightmareActingAtPromotion).toBe(100);
    expect(Object.keys(s.progression.mastery)).toEqual([...SLEEPLESS_ABILITY_IDS, ...MIDNIGHT_ABILITY_IDS, ...NIGHTMARE_ABILITY_IDS, ...SOOTHER_ABILITY_IDS]);
    expect(SOOTHER_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]); expect(SOOTHER_SOURCE_STATUS).toContain('序列5');
  });
  it('keeps failed originals and waits for the next real week before delivering fresh priced stock', () => {
    const s = taught();
    for (let i = 0; i < 3; i++) { const b = buy(s, i); acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.soother.bottles);
    acquisition(s, { type: 'REQUEST_SUPPLY' }); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' }); rejectAcquisition(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1; acquisition(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.soother.bottles.slice(0, 3)).toEqual(originals); expect(s.soother.bottles).toHaveLength(6);
    expect(s.soother.bottles[3]).toMatchObject({ id: 'soother-potion-4', status: 'SUPPLIER', labourSteps: 0 });
    expect(validateSootherState(s)).toBe(true); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' });
  });
  it.each([null, {}, { type: 'BREW', batchId: 'soother-batch-1' }, { type: 'CONSUME', bottleId: 'soother-potion-1', confirmed: false }, { type: 'PREPARE', caseId: 'echo-at-wall', method: 'MIND_CONTROL' }, { type: 'REFLECT', extra: true }, { type: 'OBSERVE', caseId: 'invented' }])('rejects malformed or invented public commands %# without mutation', command => {
    expect(validateSootherCommand(command)).toBe(false); rejectAcquisition(prepared(), command); rejectActivity(promoted(), command);
  });
  it('rejects forged bottle identity, sources, chronology and inherited mastery in saves', () => {
    const s = promoted();
    for (const change of [(t: SliceState) => { t.soother.bottles[0]!.source = 'invented'; }, (t: SliceState) => { t.soother.bottles[0]!.consumedWeek = 30; }, (t: SliceState) => { t.soother.nightmareActingAtPromotion = 99; }, (t: SliceState) => { delete t.progression.mastery[SLEEPLESS_ABILITY_IDS[0]]; }, (t: SliceState) => { t.soother.bottles[1]!.labourSteps = 6; }]) { const t = structuredClone(s); change(t); expect(validateSootherState(t)).toBe(false); }
  });
});

describe('Soother actual local boundaries and limited peaceful growth', () => {
  it('keeps the three original cases distinct and hides them before promotion', () => {
    expect(sootherCases(nightmare())).toEqual([]); const s = promoted();
    expect(sootherCases(s).map(x => x.id)).toEqual([...SOOTHER_CASE_IDS]);
    expect(sootherCases(s).every(x => x.observations.length === 0)).toBe(true); expect(sootherActions(s).some(x => x.command.type === 'OBSERVE')).toBe(true);
  });
  it('requires actual observation, one preparation and a real stop before reporting', () => {
    const s = promoted(); rejectActivity(s, { type: 'PERFORM', caseId: 'restless-wolf' }); begin(s, 'restless-wolf');
    rejectActivity(s, { type: 'OBSERVE', caseId: 'remembered-name' }); activity(s, { type: 'PERFORM', caseId: 'restless-wolf' });
    expect(sootherInside(s)).toBe(true); rejectActivity(s, { type: 'REPORT', caseId: 'restless-wolf' });
    const ap = s.actionsRemaining, spirit = s.spirituality; activity(s, { type: 'CLOSE', caseId: 'restless-wolf' });
    expect([s.actionsRemaining, s.spirituality]).toEqual([ap, spirit]); activity(s, { type: 'REPORT', caseId: 'restless-wolf' });
    expect(s.progression.acting).toBe(25); rejectActivity(s, { type: 'REPORT', caseId: 'restless-wolf' }); expect(validateSootherState(s)).toBe(true);
  });
  it.each(['ABILITY', 'ORDINARY'] as const)('makes the first echo-at-wall attempt a definite excessive imprint boundary independent of RNG: %s', method => {
    const s = promoted(); begin(s, 'echo-at-wall', method); const beforeSpirit = s.spirituality, ctx = activity(s, { type: 'PERFORM', caseId: 'echo-at-wall' }, 1);
    expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled();
    const r = s.soother.cases['echo-at-wall']!;
    expect(r).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', contactOpen: true, revised: false }); expect(r.notes).toHaveLength(2);
    expect(r.notes.join(' ')).toContain('过强'); expect(r.notes.join(' ')).toContain('下一真实周');
    expect(beforeSpirit - s.spirituality).toBe(method === 'ABILITY' ? 3 : 0); expect(s.progression.acting).toBe(0);
    expect(sootherCases(s).find(x => x.id === 'echo-at-wall')!.observations.join(' ')).toContain('过强'); expect(validateSootherState(s)).toBe(true);
  });
  it('preserves the excessive imprint on close, prohibits same-week retry and actually revises next week', () => {
    const s = promoted(); begin(s, 'echo-at-wall'); activity(s, { type: 'PERFORM', caseId: 'echo-at-wall' });
    const notes = [...s.soother.cases['echo-at-wall']!.notes]; activity(s, { type: 'CLOSE', caseId: 'echo-at-wall' });
    rejectActivity(s, { type: 'OBSERVE', caseId: 'echo-at-wall' }); rejectActivity(s, { type: 'PREPARE', caseId: 'echo-at-wall', method: 'ORDINARY' });
    expect(s.soother.cases['echo-at-wall']!.notes).toEqual(notes);
    s.week += 1; activity(s, { type: 'PREPARE', caseId: 'echo-at-wall', method: 'ORDINARY' });
    expect(s.soother.cases['echo-at-wall']!.revised).toBe(true); expect(s.soother.cases['echo-at-wall']!.notes.slice(0, 2)).toEqual(notes);
    activity(s, { type: 'WITHDRAW', caseId: 'echo-at-wall' }); expect(s.soother.cases['echo-at-wall']!.revised).toBe(true);
    expect(validateSootherState(s)).toBe(true);
  });
  it('can fail again after the agreed limited comparison revision and retains all evidence through a later success', () => {
    const s = promoted(); begin(s, 'echo-at-wall'); activity(s, { type: 'PERFORM', caseId: 'echo-at-wall' }); activity(s, { type: 'CLOSE', caseId: 'echo-at-wall' }); s.week += 1;
    activity(s, { type: 'PREPARE', caseId: 'echo-at-wall', method: 'ORDINARY' }); const fail = activity(s, { type: 'PERFORM', caseId: 'echo-at-wall' }, 100);
    expect(fail.c.check).toHaveBeenCalledOnce(); expect(s.soother.cases['echo-at-wall']!.status).toBe('OBSERVED');
    const notes = [...s.soother.cases['echo-at-wall']!.notes]; activity(s, { type: 'CLOSE', caseId: 'echo-at-wall' }); s.week += 1;
    activity(s, { type: 'PREPARE', caseId: 'echo-at-wall', method: 'ORDINARY' }); activity(s, { type: 'PERFORM', caseId: 'echo-at-wall' }); activity(s, { type: 'CLOSE', caseId: 'echo-at-wall' }); activity(s, { type: 'REPORT', caseId: 'echo-at-wall' });
    expect(s.soother.cases['echo-at-wall']!.notes).toEqual(notes); expect(validateSootherState(s)).toBe(true);
  });
  it('charges ability costs on failed focused practice, needs a real close and delays retry', () => {
    const s = promoted(); begin(s, 'restless-wolf', 'ABILITY'); const spirit = s.spirituality, mind = s.mind;
    activity(s, { type: 'PERFORM', caseId: 'restless-wolf' }, 100);
    expect([s.spirituality, s.mind, s.progression.acting]).toEqual([spirit - 3, mind - 5, 0]);
    activity(s, { type: 'CLOSE', caseId: 'restless-wolf' }); rejectActivity(s, { type: 'PREPARE', caseId: 'restless-wolf', method: 'ORDINARY' });
    s.week += 1; activity(s, { type: 'PREPARE', caseId: 'restless-wolf', method: 'ORDINARY' }); expect(validateSootherState(s)).toBe(true);
  });
  it('allows ordinary fallback after canceling an unaffordable ability preparation', () => {
    const s = promoted(); begin(s, 'remembered-name', 'ABILITY'); s.spirituality = 2; rejectActivity(s, { type: 'PERFORM', caseId: 'remembered-name' });
    const ap = s.actionsRemaining; activity(s, { type: 'WITHDRAW', caseId: 'remembered-name' }); expect(s.actionsRemaining).toBe(ap);
    activity(s, { type: 'PREPARE', caseId: 'remembered-name', method: 'ORDINARY' }); activity(s, { type: 'PERFORM', caseId: 'remembered-name' });
    expect(s.spirituality).toBe(2); expect(s.soother.cases['remembered-name']!.outcome).toBe('NAME_RECORDED');
  });
  it('reaches acting100 with three ordinary reports and reflection, without combat or spirit coercion', () => {
    const s = promoted(), spirit = s.spirituality;
    for (const id of SOOTHER_CASE_IDS) complete(s, id);
    expect(s.progression.acting).toBe(75); activity(s, { type: 'REFLECT' });
    expect([s.progression.acting, s.spirituality, s.soother.encounter.status]).toEqual([100, spirit, 'AVAILABLE']);
    expect(s.progression.mastery[SOOTHER_ABILITY_IDS[0]]).toBe(24); expect(validateSootherState(s)).toBe(true);
    rejectActivity(s, { type: 'REFLECT' });
  });
  it('rejects removed boundary records, forged revision, premature reports and duplicate growth sources', () => {
    const s = promoted(); complete(s, 'echo-at-wall');
    for (const change of [(t: SliceState) => { t.soother.cases['echo-at-wall']!.notes = []; }, (t: SliceState) => { t.soother.cases['echo-at-wall']!.revised = false; }, (t: SliceState) => { t.soother.cases['echo-at-wall']!.closes = 0; }, (t: SliceState) => { t.seer.completedSources.push('soother-case:echo-at-wall'); }, (t: SliceState) => { t.soother.cases['remembered-name']!.revised = true; }]) { const t = structuredClone(s); change(t); expect(validateSootherLife(t)).toBe(false); }
  });
  it('keeps a zero-action close available and blocks unrelated activity during open contact', () => {
    const s = promoted(); begin(s, 'restless-wolf'); activity(s, { type: 'PERFORM', caseId: 'restless-wolf' }); s.actionsRemaining = 0;
    rejectActivity(s, { type: 'OBSERVE', caseId: 'remembered-name' }); activity(s, { type: 'CLOSE', caseId: 'restless-wolf' });
    expect(sootherInside(s)).toBe(false); expect(s.actionsRemaining).toBe(0);
  });
});

describe('Soother bounded original night courtyard dispute', () => {
  it('requires an actual report and permits peace without extra acting or mastery', () => {
    const s = promoted(); rejectActivity(s, { type: 'ENCOUNTER_TALK' }); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
    complete(s, 'restless-wolf'); const acting = s.progression.acting, ap = s.actionsRemaining, mastery = { ...s.progression.mastery };
    const ctx = activity(s, { type: 'ENCOUNTER_TALK' });
    expect([s.soother.encounter.status, s.actionsRemaining, s.progression.acting]).toEqual(['RESOLVED', ap - 1, acting]);
    expect(s.progression.mastery).toEqual(mastery); expect(ctx.award).not.toHaveBeenCalled(); expect(validateSootherState(s)).toBe(true);
    rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
  });
  it('keeps a failed conversation and permits only next-week talk retry', () => {
    const s = promoted(); complete(s, 'restless-wolf'); activity(s, { type: 'ENCOUNTER_TALK' }, 100);
    expect(s.soother.encounter.status).toBe('AVAILABLE'); rejectActivity(s, { type: 'ENCOUNTER_TALK' });
    s.week += 1; activity(s, { type: 'ENCOUNTER_TALK' }); expect(s.soother.encounter.status).toBe('RESOLVED');
  });
  it('starts the visible original encounter and settles retreat without moving any possessions or rewarding it', () => {
    const s = promoted(); complete(s, 'restless-wolf'); const cash = s.cash;
    activity(s, { type: 'ENCOUNTER_FIGHT' }); expect(s.combat?.encounterId).toBe('SOOTHER_DISPUTE'); expect(validateSootherState(s)).toBe(true);
    const ctx = context(s); settleSootherEncounter(s, 'RETREATED', ctx.c, ctx.award);
    expect([s.combat, s.cash, s.soother.encounter.status]).toEqual([null, cash, 'RETREATED']); expect(ctx.award).not.toHaveBeenCalled();
    expect(validateSootherState(s)).toBe(true); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
  });
  it('does not reward a nominal victory without effective participation', () => {
    const s = promoted(); complete(s, 'restless-wolf'); activity(s, { type: 'ENCOUNTER_FIGHT' });
    const ctx = context(s); settleSootherEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award);
    expect(ctx.award).not.toHaveBeenCalled(); expect(s.soother.encounter.status).toBe('RESOLVED');
  });
  it('awards exactly one mastery25 only for effective new combat participation', () => {
    const s = promoted(); complete(s, 'restless-wolf'); activity(s, { type: 'ENCOUNTER_FIGHT' });
    s.combatHistory.push({ round: 1, stance: 'ATTACK', first: 'PLAYER', playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1,
      moves: [{ actor: 'PLAYER', label: '实际有限攻势', selfGain: 3, enemyReduction: 0 }], playerAdvantage: 3, enemyAdvantage: 0, winChance: 60, winner: 'PLAYER', consequence: '抵抗结束', consequenceWeights: null, retreat: 'NONE' });
    const ctx = context(s), acting = s.progression.acting;
    settleSootherEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award);
    expect(ctx.award).toHaveBeenCalledExactlyOnceWith('soother-dispute', 25); expect(s.progression.acting).toBe(acting);
    expect(validateSootherState(s)).toBe(true);
    expect(() => settleSootherEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award)).toThrow();
    const forged = structuredClone(s); forged.combatHistory[0]!.moves[0]!.selfGain = 0; expect(validateSootherState(forged)).toBe(false);
  });
  it('preserves real death and never awards a lost encounter', () => {
    const s = promoted(); complete(s, 'restless-wolf'); activity(s, { type: 'ENCOUNTER_FIGHT' }); s.status = 'DEAD';
    const ctx = context(s); settleSootherEncounter(s, 'PLAYER_DEAD', ctx.c, ctx.award);
    expect([s.status, s.soother.encounter.status, s.combat]).toEqual(['DEAD', 'LOST', null]); expect(ctx.award).not.toHaveBeenCalled();
  });
});

describe('Soother distinct results, actual departures and no borrowed spirit authority', () => {
  it('spends 3 spirituality and will14 to pacify only the visible wolf, then observes its own fading at CLOSE', () => {
    const s = promoted(); begin(s, 'restless-wolf', 'ABILITY'); const spirit = s.spirituality, cash = s.cash;
    const ctx = activity(s, { type: 'PERFORM', caseId: 'restless-wolf' });
    expect(ctx.c.check).toHaveBeenCalledExactlyOnceWith('will', 14);
    expect([s.spirituality, s.cash, s.soother.cases['restless-wolf']!.outcome]).toEqual([spirit - 3, cash, 'WOLF_PACIFIED']);
    const result = sootherCases(s).find(x => x.id === 'restless-wolf')!.result!;
    expect(result).toContain('这只野狼幽魂的躁动已平静'); expect(result).not.toContain('自行淡去');
    expect(sootherInside(s)).toBe(true); const exit = activity(s, { type: 'CLOSE', caseId: 'restless-wolf' });
    expect(exit.c.note).toHaveBeenCalledWith('实际结束本次接触并离开', expect.stringContaining('实际观察这只已经平静的野狼幽魂自行淡去'));
    expect(sootherCases(s).find(x => x.id === 'restless-wolf')!.result).toContain('自行淡去');
    expect(validateSootherState(s)).toBe(true);
  });
  it('ordinary wolf isolation produces observation without pretending pacification or free items', () => {
    const s = promoted(), spirit = s.spirituality, cash = s.cash; complete(s, 'restless-wolf');
    expect([s.spirituality, s.cash, s.soother.cases['restless-wolf']!.outcome]).toEqual([spirit, cash, 'WOLF_OBSERVED']);
    const result = sootherCases(s).find(x => x.id === 'restless-wolf')!.result!;
    expect(result).toContain('没有施加安抚'); expect(result).toContain('不能断言它已平静或消散');
    expect(result).not.toContain('实际观察这只已经平静');
  });
  it('failed wolf pacification still costs spirituality and leaves the original spirit intact', () => {
    const s = promoted(); begin(s, 'restless-wolf', 'ABILITY'); const spirit = s.spirituality;
    const failed = activity(s, { type: 'PERFORM', caseId: 'restless-wolf' }, 100);
    expect(s.spirituality).toBe(spirit - 3); expect(failed.award).not.toHaveBeenCalled();
    const exit = activity(s, { type: 'CLOSE', caseId: 'restless-wolf' });
    expect(vi.mocked(exit.c.note).mock.calls.flat().join(' ')).toContain('未成功安抚的幽魂没有被消灭、收走或宣告消散');
    expect(s.soother.cases['restless-wolf']!.outcome).toBe('NONE'); expect(validateSootherState(s)).toBe(true);
  });
  it.each(['ABILITY', 'ORDINARY'] as const)('keeps the excessive echo unknown after the actual revised %s comparison', method => {
    const s = promoted(); begin(s, 'echo-at-wall', method); activity(s, { type: 'PERFORM', caseId: 'echo-at-wall' });
    activity(s, { type: 'CLOSE', caseId: 'echo-at-wall' }); s.week += 1;
    activity(s, { type: 'PREPARE', caseId: 'echo-at-wall', method });
    const preparation = sootherCases(s).find(x => x.id === 'echo-at-wall')!.preparation!;
    expect(preparation).toContain('原导师'); expect(preparation).toContain('有限对照');
    const ctx = activity(s, { type: 'PERFORM', caseId: 'echo-at-wall' });
    expect(ctx.c.check).toHaveBeenCalledExactlyOnceWith(method === 'ABILITY' ? 'will' : 'knowledge', method === 'ABILITY' ? 14 : 10);
    const r = s.soother.cases['echo-at-wall']!, result = sootherCases(s).find(x => x.id === 'echo-at-wall')!.result!;
    expect(r.outcome).toBe(method === 'ABILITY' ? 'ECHO_COMPARED' : 'WINDOW_CHECKED');
    expect(result).toContain(method === 'ABILITY' ? '强烈恐惧烙印未被单独清除' : '风动原窗扣');
    if (method === 'ORDINARY') expect(result).toContain('没有施加安抚或宣布净化');
    expect(sootherInside(s)).toBe(true); activity(s, { type: 'CLOSE', caseId: 'echo-at-wall' });
    activity(s, { type: 'REPORT', caseId: 'echo-at-wall' }); expect(validateSootherState(s)).toBe(true);
  });
  it.each(['ABILITY', 'ORDINARY'] as const)('lets Lia herself stop the finite remembered-name %s contact', method => {
    const s = promoted(); begin(s, 'remembered-name', method); const spirit = s.spirituality;
    activity(s, { type: 'PERFORM', caseId: 'remembered-name' });
    expect(s.spirituality).toBe(spirit - (method === 'ABILITY' ? 3 : 0));
    const result = sootherCases(s).find(x => x.id === 'remembered-name')!.result!;
    expect(result).toContain('莉娅本人'); expect(result).toContain('完整死亡真相');
    expect(s.soother.cases['remembered-name']!.outcome).toBe(method === 'ABILITY' ? 'NAME_PACIFIED' : 'NAME_RECORDED');
    const exit = activity(s, { type: 'CLOSE', caseId: 'remembered-name' });
    expect(vi.mocked(exit.c.note).mock.calls.flat().join(' ')).toContain('依莉娅本人停止的决定');
    expect(validateSootherState(s)).toBe(true);
  });
  it('rejects mismatched method outcomes, foreign spirit fields and a week advance while contact remains open', () => {
    const s = promoted(); complete(s, 'restless-wolf');
    const forged = structuredClone(s); forged.soother.cases['restless-wolf']!.outcome = 'WOLF_PACIFIED'; expect(validateSootherState(forged)).toBe(false);
    const extra = structuredClone(s); Object.assign(extra.soother.cases['restless-wolf']!, { boundSpirit: true }); expect(validateSootherState(extra)).toBe(false);
    begin(s, 'remembered-name'); activity(s, { type: 'PERFORM', caseId: 'remembered-name' }); s.week += 1; expect(validateSootherState(s)).toBe(false);
  });
  it('retains old nightmare encounter untouched and clears only the current control state on every terminal outcome', () => {
    for (const outcome of ['RETREATED', 'ENEMY_SURRENDERED', 'PLAYER_DEAD']) {
      const s = promoted(); complete(s, 'restless-wolf');
      const oldNightmare = structuredClone(s.nightmare);
      activity(s, { type: 'ENCOUNTER_FIGHT' });
      expect(s.soother.encounter).toMatchObject({ status: 'FIGHTING', pressure: 0, dreamLocked: false, attemptWeek: s.week, startHistoryIndex: s.combatHistory.length });
      s.soother.encounter.pressure = 2; s.soother.encounter.dreamLocked = true;
      if (outcome === 'PLAYER_DEAD') s.status = 'DEAD';
      const ctx = context(s); settleSootherEncounter(s, outcome, ctx.c, ctx.award);
      expect(s.soother.encounter).toMatchObject({ pressure: 0, dreamLocked: false });
      expect(s.nightmare).toEqual(oldNightmare); expect(s.combat).toBeNull(); expect(ctx.award).not.toHaveBeenCalled();
      expect(validateSootherState(s)).toBe(true);
    }
  });
  it('rejects control outside the new encounter, impossible lock pressure and stale fighting location', () => {
    const s = promoted(); complete(s, 'restless-wolf');
    const idle = structuredClone(s); idle.soother.encounter.pressure = 1; expect(validateSootherState(idle)).toBe(false);
    activity(s, { type: 'ENCOUNTER_FIGHT' });
    const lock = structuredClone(s); lock.soother.encounter.dreamLocked = true; expect(validateSootherState(lock)).toBe(false);
    const stale = structuredClone(s); stale.week += 1; expect(validateSootherState(stale)).toBe(false);
    const foreign = structuredClone(s); Object.assign(foreign.soother.encounter, { observed: true }); expect(validateSootherState(foreign)).toBe(false);
  });
});
