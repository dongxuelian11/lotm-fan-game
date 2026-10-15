import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyAudienceCommand } from '../../src/domain/audience/index.js';
import { AUDIENCE_ABILITY_IDS } from '../../src/domain/audience/types.js';
import { applyMindreaderCommand } from '../../src/domain/mindreader/index.js';
import { MINDREADER_ABILITY_IDS } from '../../src/domain/mindreader/types.js';
import { applyPsychologistCommand } from '../../src/domain/psychologist/index.js';
import { PSYCHOLOGIST_ABILITY_IDS } from '../../src/domain/psychologist/types.js';
import { applyHypnotistCommand, createHypnotistState, projectHypnotist, validateHypnotistCommand, validateHypnotistState } from '../../src/domain/hypnotist/index.js';
import { applyHypnotistActivity, hypnotistActions, hypnotistCases, hypnotistInside, validateHypnotistLife } from '../../src/domain/hypnotist/life.js';
import { settleHypnotistEncounter } from '../../src/domain/hypnotist/encounter.js';
import { HYPNOTIST_FORMULA_STATUS, HYPNOTIST_PRICES, HYPNOTIST_SOURCE_STATUS } from '../../src/domain/hypnotist/content.js';
import { HYPNOTIST_ABILITY_IDS, HYPNOTIST_CASE_IDS, type HypnotistAcquisitionCommand, type HypnotistActivityCommand, type HypnotistCaseId } from '../../src/domain/hypnotist/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function ordinary(): SliceState {
  const s = createSliceRun('hypnotist-domain', sliceDefaultCreationSelection, 'hypnotist-fixed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5; s.cash = 50000;
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.hypnotist = createHypnotistState(); return s;
}
function context(s: SliceState, roll = 1) {
  const c: SeerContext = {
    roll: vi.fn(min => min), note: vi.fn(),
    check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })),
  };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source);
    s.progression.mastery[HYPNOTIST_ABILITY_IDS[0]]! += amount;
  });
  return { c, award };
}
function psychologist(): SliceState {
  const s = ordinary(), c = context(s).c;
  applyAudienceCommand(s, { type: 'DISCOVER' }, c);
  applyAudienceCommand(s, { type: 'LEARN_FORMULA' }, c);
  applyAudienceCommand(s, { type: 'BUY_MATERIALS', batchId: s.audience.batches[0]!.id }, c);
  applyAudienceCommand(s, { type: 'BREW', batchId: s.audience.batches[0]!.id }, c);
  applyAudienceCommand(s, { type: 'CONSUME', bottleId: s.audience.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applyMindreaderCommand(s, { type: 'LEARN_FORMULA' }, c);
  applyMindreaderCommand(s, { type: 'BUY_MATERIALS', batchId: s.mindreader.batches[0]!.id }, c);
  applyMindreaderCommand(s, { type: 'BREW', batchId: s.mindreader.batches[0]!.id }, c);
  applyMindreaderCommand(s, { type: 'CONSUME', bottleId: s.mindreader.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  applyPsychologistCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyPsychologistCommand(s, { type: 'BUY_POTION', bottleId: s.psychologist.bottles[0]!.id }, c);
  applyPsychologistCommand(s, { type: 'CONSUME', bottleId: s.psychologist.bottles[0]!.id, confirmed: true }, c);
  s.week = 31; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...AUDIENCE_ABILITY_IDS, ...MINDREADER_ABILITY_IDS, ...PSYCHOLOGIST_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 20000; s.actionsRemaining = 100; s.health = 100; s.mind = 100; s.spirituality = 31; s.character.coreStats.will = 25;
  return s;
}
function acquisition(s: SliceState, command: HypnotistAcquisitionCommand, roll = 1) { const ctx = context(s, roll); applyHypnotistCommand(s, command, ctx.c); return ctx; }
function activity(s: SliceState, command: HypnotistActivityCommand, roll = 1) { const ctx = context(s, roll); applyHypnotistActivity(s, command, ctx.c, ctx.award); return ctx; }
function taught(s = psychologist()) { acquisition(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const b = s.hypnotist.bottles[index]!; acquisition(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); acquisition(s, { type: 'CONSUME', bottleId: s.hypnotist.bottles[0]!.id, confirmed: true }); return s; }
function rejectAcquisition(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyHypnotistCommand(s, command as HypnotistAcquisitionCommand, ctx.c)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled();
}
function rejectActivity(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyHypnotistActivity(s, command as HypnotistActivityCommand, ctx.c, ctx.award)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: HypnotistCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  activity(s, { type: 'OBSERVE', caseId }); activity(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: HypnotistCaseId) {
  begin(s, caseId); activity(s, { type: 'PERFORM', caseId }); activity(s, { type: 'CLOSE', caseId });
  if (caseId === 'protected-choice') { s.week += 1; activity(s, { type: 'PREPARE', caseId, method: 'ORDINARY' }); activity(s, { type: 'PERFORM', caseId }); activity(s, { type: 'CLOSE', caseId }); }
  activity(s, { type: 'REPORT', caseId });
}

describe('Hypnotist S6 finite original bottles and inherited promotion', () => {
  it('hides the future channel and creates independent original stocks', () => {
    const s = ordinary(), p = projectHypnotist(s), other = createHypnotistState();
    expect(validateHypnotistState(s)).toBe(true);
    expect(p).toMatchObject({ discovered: false, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [], bottles: [], actions: [], abilities: [], cases: [], supplies: '' });
    expect(p.story).toBeUndefined(); other.bottles[0]!.labourSteps = 5; other.cases['protected-choice']!.notes.push('changed');
    expect(s.hypnotist.bottles[0]!.labourSteps).toBe(0); expect(s.hypnotist.cases['protected-choice']!.notes).toEqual([]);
    rejectAcquisition(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges 360 and one action for guidance without inventing a formula', () => {
    const s = psychologist(), before = structuredClone([s.audience, s.mindreader, s.psychologist]), c = acquisition(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([19640, 99]); expect([s.audience, s.mindreader, s.psychologist]).toEqual(before);
    expect(projectHypnotist(s)).toMatchObject({ guidanceKnown: true, formulaKnown: false, formula: [] });
    expect(HYPNOTIST_FORMULA_STATUS).toContain('尚未核实'); expect(HYPNOTIST_PRICES).toEqual({ guidance: 360, potion: 3320, labourCredit: 3000 });
    expect(c.c.check).not.toHaveBeenCalled(); rejectAcquisition(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five actual labour actions per original bottle and still takes 320 cash', () => {
    const s = taught(), b = s.hypnotist.bottles[0]!;
    for (let i = 0; i < 5; i++) acquisition(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.status, b.labourSteps, s.actionsRemaining]).toEqual(['SUPPLIER', 5, 94]);
    rejectAcquisition(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([19320, 94, 'PLAYER']);
    expect(projectHypnotist(s).actions.find(a => a.id === 'buy-hypnotist-potion-2')!.cost).toContain('3320便士');
    rejectAcquisition(s, { type: 'BUY_POTION', bottleId: b.id }); rejectAcquisition(s, { type: 'POTION_WORK', bottleId: b.id });
    expect(validateHypnotistState(s)).toBe(true);
  });
  it('does not discount partial labour or transfer credit to another original', () => {
    const s = taught(); acquisition(s, { type: 'POTION_WORK', bottleId: s.hypnotist.bottles[0]!.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(3320); expect(s.hypnotist.bottles[1]!.labourSteps).toBe(0);
    s.cash = 3319; rejectAcquisition(s, { type: 'BUY_POTION', bottleId: s.hypnotist.bottles[1]!.id });
  });
  it('allows early preparation but checks acting100 and twelve complete S7 weeks at the separate drink', () => {
    const s = psychologist(); s.week = 19; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validateHypnotistState(s)).toBe(true); rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = 30; s.progression.acting = 100;
    expect(projectHypnotist(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = 31; s.progression.acting = 99; rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); expect(s.progression.sequence).toBe(6);
  });
  it.each([[1, 'GREAT_SUCCESS', 95, 100, 0, 6], [30, 'SUCCESS', 90, 100, 0, 6], [85, 'FAILURE', 80, 90, 25, 7], [100, 'GREAT_FAILURE', 60, 80, 50, 7]] as const)('records recoverable four-tier drinking roll %s', (roll, tier, mind, health, pollution, sequence) => {
    const s = prepared(), old = structuredClone(s.progression.mastery), b = s.hypnotist.bottles[0]!;
    const ctx = acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
    expect(ctx.c.check).toHaveBeenCalledWith('will', 24);
    expect([b.status, b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, pollution, sequence, 'ACTIVE']);
    for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
    if (sequence === 7) expect(s.progression.acting).toBe(100);
    expect(validateHypnotistState(s)).toBe(true); rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
  });
  it('inherits every original Audience family ID, adds four zero masteries and four +1 stats without refilling spirituality', () => {
    const s = prepared(), old = structuredClone([s.audience, s.mindreader, s.psychologist]), stats = { ...s.character.coreStats };
    acquisition(s, { type: 'CONSUME', bottleId: s.hypnotist.bottles[0]!.id, confirmed: true });
    expect([s.audience, s.mindreader, s.psychologist]).toEqual(old); expect(s.hypnotist.psychologistActingAtPromotion).toBe(100);
    expect(Object.keys(s.progression.mastery)).toEqual([...AUDIENCE_ABILITY_IDS, ...MINDREADER_ABILITY_IDS, ...PSYCHOLOGIST_ABILITY_IDS, ...HYPNOTIST_ABILITY_IDS]);
    expect(HYPNOTIST_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0, 0, 0]);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]); expect(HYPNOTIST_SOURCE_STATUS).toContain('序列5');
  });
  it('keeps failed originals and waits for the next real week before delivering fresh priced stock', () => {
    const s = taught();
    for (let i = 0; i < 3; i++) { const b = buy(s, i); acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.hypnotist.bottles);
    acquisition(s, { type: 'REQUEST_SUPPLY' }); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' }); rejectAcquisition(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1; acquisition(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.hypnotist.bottles.slice(0, 3)).toEqual(originals); expect(s.hypnotist.bottles).toHaveLength(6);
    expect(s.hypnotist.bottles[3]).toMatchObject({ id: 'hypnotist-potion-4', status: 'SUPPLIER', labourSteps: 0 });
    expect(validateHypnotistState(s)).toBe(true); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' });
  });
  it.each([null, {}, { type: 'BREW', batchId: 'hypnotist-batch-1' }, { type: 'CONSUME', bottleId: 'hypnotist-potion-1', confirmed: false }, { type: 'PREPARE', caseId: 'protected-choice', method: 'MIND_CONTROL' }, { type: 'REFLECT', extra: true }, { type: 'OBSERVE', caseId: 'invented' }])('rejects malformed or invented public commands %# without mutation', command => {
    expect(validateHypnotistCommand(command)).toBe(false); rejectAcquisition(prepared(), command); rejectActivity(promoted(), command);
  });
  it('rejects forged bottle identity, sources, chronology and inherited mastery in saves', () => {
    const s = promoted();
    for (const change of [(t: SliceState) => { t.hypnotist.bottles[0]!.source = 'invented'; }, (t: SliceState) => { t.hypnotist.bottles[0]!.consumedWeek = 30; }, (t: SliceState) => { t.hypnotist.psychologistActingAtPromotion = 99; }, (t: SliceState) => { delete t.progression.mastery[AUDIENCE_ABILITY_IDS[0]]; }, (t: SliceState) => { t.hypnotist.bottles[1]!.labourSteps = 6; }]) { const t = structuredClone(s); change(t); expect(validateHypnotistState(t)).toBe(false); }
  });
});

describe('Hypnotist consent, actual refusal and limited peaceful growth', () => {
  it('keeps the three original cases distinct and hides them before promotion', () => {
    expect(hypnotistCases(psychologist())).toEqual([]); const s = promoted();
    expect(hypnotistCases(s).map(x => x.id)).toEqual([...HYPNOTIST_CASE_IDS]);
    expect(hypnotistCases(s).every(x => x.observations.length === 0)).toBe(true); expect(hypnotistActions(s).some(x => x.command.type === 'OBSERVE')).toBe(true);
  });
  it('requires actual observation, one preparation and a real stop before reporting', () => {
    const s = promoted(); rejectActivity(s, { type: 'PERFORM', caseId: 'focused-reading' }); begin(s, 'focused-reading');
    rejectActivity(s, { type: 'OBSERVE', caseId: 'unnoticed-passage' }); activity(s, { type: 'PERFORM', caseId: 'focused-reading' });
    expect(hypnotistInside(s)).toBe(true); rejectActivity(s, { type: 'REPORT', caseId: 'focused-reading' });
    const ap = s.actionsRemaining, spirit = s.spirituality; activity(s, { type: 'CLOSE', caseId: 'focused-reading' });
    expect([s.actionsRemaining, s.spirituality]).toEqual([ap, spirit]); activity(s, { type: 'REPORT', caseId: 'focused-reading' });
    expect(s.progression.acting).toBe(25); rejectActivity(s, { type: 'REPORT', caseId: 'focused-reading' }); expect(validateHypnotistState(s)).toBe(true);
  });
  it.each(['ABILITY', 'ORDINARY'] as const)('makes the first protected-choice attempt a real refusal even on successful RNG: %s', method => {
    const s = promoted(); begin(s, 'protected-choice', method); const beforeSpirit = s.spirituality, ctx = activity(s, { type: 'PERFORM', caseId: 'protected-choice' }, 1);
    expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled();
    const r = s.hypnotist.cases['protected-choice']!;
    expect(r).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', contactOpen: true, revised: false }); expect(r.notes).toHaveLength(2);
    expect(r.notes.join(' ')).toContain('明确拒绝'); expect(r.notes.join(' ')).toContain('新公开事实');
    expect(beforeSpirit - s.spirituality).toBe(method === 'ABILITY' ? 3 : 0); expect(s.progression.acting).toBe(0);
    expect(hypnotistCases(s).find(x => x.id === 'protected-choice')!.observations.join(' ')).toContain('明确拒绝'); expect(validateHypnotistState(s)).toBe(true);
  });
  it('preserves rejection on close, prohibits same-week retry and actually revises next week', () => {
    const s = promoted(); begin(s, 'protected-choice'); activity(s, { type: 'PERFORM', caseId: 'protected-choice' });
    const notes = [...s.hypnotist.cases['protected-choice']!.notes]; activity(s, { type: 'CLOSE', caseId: 'protected-choice' });
    rejectActivity(s, { type: 'OBSERVE', caseId: 'protected-choice' }); rejectActivity(s, { type: 'PREPARE', caseId: 'protected-choice', method: 'ORDINARY' });
    expect(s.hypnotist.cases['protected-choice']!.notes).toEqual(notes);
    s.week += 1; activity(s, { type: 'PREPARE', caseId: 'protected-choice', method: 'ORDINARY' });
    expect(s.hypnotist.cases['protected-choice']!.revised).toBe(true); expect(s.hypnotist.cases['protected-choice']!.notes.slice(0, 2)).toEqual(notes);
    activity(s, { type: 'WITHDRAW', caseId: 'protected-choice' }); expect(s.hypnotist.cases['protected-choice']!.revised).toBe(true);
    expect(validateHypnotistState(s)).toBe(true);
  });
  it('can fail again after accepted observation-only revision and retains all evidence through a later success', () => {
    const s = promoted(); begin(s, 'protected-choice'); activity(s, { type: 'PERFORM', caseId: 'protected-choice' }); activity(s, { type: 'CLOSE', caseId: 'protected-choice' }); s.week += 1;
    activity(s, { type: 'PREPARE', caseId: 'protected-choice', method: 'ORDINARY' }); const fail = activity(s, { type: 'PERFORM', caseId: 'protected-choice' }, 100);
    expect(fail.c.check).toHaveBeenCalledOnce(); expect(s.hypnotist.cases['protected-choice']!.status).toBe('OBSERVED');
    const notes = [...s.hypnotist.cases['protected-choice']!.notes]; activity(s, { type: 'CLOSE', caseId: 'protected-choice' }); s.week += 1;
    activity(s, { type: 'PREPARE', caseId: 'protected-choice', method: 'ORDINARY' }); activity(s, { type: 'PERFORM', caseId: 'protected-choice' }); activity(s, { type: 'CLOSE', caseId: 'protected-choice' }); activity(s, { type: 'REPORT', caseId: 'protected-choice' });
    expect(s.hypnotist.cases['protected-choice']!.notes).toEqual(notes); expect(validateHypnotistState(s)).toBe(true);
  });
  it('charges ability costs on failed focused practice, needs a real close and delays retry', () => {
    const s = promoted(); begin(s, 'focused-reading', 'ABILITY'); const spirit = s.spirituality, mind = s.mind;
    activity(s, { type: 'PERFORM', caseId: 'focused-reading' }, 100);
    expect([s.spirituality, s.mind, s.progression.acting]).toEqual([spirit - 3, mind - 5, 0]);
    activity(s, { type: 'CLOSE', caseId: 'focused-reading' }); rejectActivity(s, { type: 'PREPARE', caseId: 'focused-reading', method: 'ORDINARY' });
    s.week += 1; activity(s, { type: 'PREPARE', caseId: 'focused-reading', method: 'ORDINARY' }); expect(validateHypnotistState(s)).toBe(true);
  });
  it('allows ordinary fallback after canceling an unaffordable ability preparation', () => {
    const s = promoted(); begin(s, 'unnoticed-passage', 'ABILITY'); s.spirituality = 2; rejectActivity(s, { type: 'PERFORM', caseId: 'unnoticed-passage' });
    const ap = s.actionsRemaining; activity(s, { type: 'WITHDRAW', caseId: 'unnoticed-passage' }); expect(s.actionsRemaining).toBe(ap);
    activity(s, { type: 'PREPARE', caseId: 'unnoticed-passage', method: 'ORDINARY' }); activity(s, { type: 'PERFORM', caseId: 'unnoticed-passage' });
    expect(s.spirituality).toBe(2); expect(s.hypnotist.cases['unnoticed-passage']!.outcome).toBe('PASSAGE_COMPARED');
  });
  it('reaches acting100 with three ordinary reports and reflection, without combat or forced hypnosis', () => {
    const s = promoted(), spirit = s.spirituality;
    for (const id of HYPNOTIST_CASE_IDS) complete(s, id);
    expect(s.progression.acting).toBe(75); activity(s, { type: 'REFLECT' });
    expect([s.progression.acting, s.spirituality, s.hypnotist.encounter.status]).toEqual([100, spirit, 'AVAILABLE']);
    expect(s.progression.mastery[HYPNOTIST_ABILITY_IDS[0]]).toBe(24); expect(validateHypnotistState(s)).toBe(true);
    rejectActivity(s, { type: 'REFLECT' });
  });
  it('rejects removed refusal records, forged revision, premature reports and duplicate growth sources', () => {
    const s = promoted(); complete(s, 'protected-choice');
    for (const change of [(t: SliceState) => { t.hypnotist.cases['protected-choice']!.notes = []; }, (t: SliceState) => { t.hypnotist.cases['protected-choice']!.revised = false; }, (t: SliceState) => { t.hypnotist.cases['protected-choice']!.closes = 0; }, (t: SliceState) => { t.seer.completedSources.push('hypnotist-case:protected-choice'); }, (t: SliceState) => { t.hypnotist.cases['unnoticed-passage']!.revised = true; }]) { const t = structuredClone(s); change(t); expect(validateHypnotistLife(t)).toBe(false); }
  });
  it('keeps a zero-action close available and blocks unrelated activity during open contact', () => {
    const s = promoted(); begin(s, 'focused-reading'); activity(s, { type: 'PERFORM', caseId: 'focused-reading' }); s.actionsRemaining = 0;
    rejectActivity(s, { type: 'OBSERVE', caseId: 'unnoticed-passage' }); activity(s, { type: 'CLOSE', caseId: 'focused-reading' });
    expect(hypnotistInside(s)).toBe(false); expect(s.actionsRemaining).toBe(0);
  });
});

describe('Hypnotist bounded original back-door dispute', () => {
  it('requires an actual report and permits peace without extra acting or mastery', () => {
    const s = promoted(); rejectActivity(s, { type: 'ENCOUNTER_TALK' }); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
    complete(s, 'focused-reading'); const acting = s.progression.acting, ap = s.actionsRemaining, mastery = { ...s.progression.mastery };
    const ctx = activity(s, { type: 'ENCOUNTER_TALK' });
    expect([s.hypnotist.encounter.status, s.actionsRemaining, s.progression.acting]).toEqual(['RESOLVED', ap - 1, acting]);
    expect(s.progression.mastery).toEqual(mastery); expect(ctx.award).not.toHaveBeenCalled(); expect(validateHypnotistState(s)).toBe(true);
    rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
  });
  it('keeps a failed conversation and permits only next-week talk retry', () => {
    const s = promoted(); complete(s, 'focused-reading'); activity(s, { type: 'ENCOUNTER_TALK' }, 100);
    expect(s.hypnotist.encounter.status).toBe('AVAILABLE'); rejectActivity(s, { type: 'ENCOUNTER_TALK' });
    s.week += 1; activity(s, { type: 'ENCOUNTER_TALK' }); expect(s.hypnotist.encounter.status).toBe('RESOLVED');
  });
  it('starts the visible original encounter and settles retreat without moving any possessions or rewarding it', () => {
    const s = promoted(); complete(s, 'focused-reading'); const cash = s.cash;
    activity(s, { type: 'ENCOUNTER_FIGHT' }); expect(s.combat?.encounterId).toBe('HYPNOTIST_DISPUTE'); expect(validateHypnotistState(s)).toBe(true);
    const ctx = context(s); settleHypnotistEncounter(s, 'RETREATED', ctx.c, ctx.award);
    expect([s.combat, s.cash, s.hypnotist.encounter.status]).toEqual([null, cash, 'RETREATED']); expect(ctx.award).not.toHaveBeenCalled();
    expect(validateHypnotistState(s)).toBe(true); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
  });
  it('does not reward a nominal victory without effective participation', () => {
    const s = promoted(); complete(s, 'focused-reading'); activity(s, { type: 'ENCOUNTER_FIGHT' });
    const ctx = context(s); settleHypnotistEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award);
    expect(ctx.award).not.toHaveBeenCalled(); expect(s.hypnotist.encounter.status).toBe('RESOLVED');
  });
  it('awards exactly one mastery25 only for effective new combat participation', () => {
    const s = promoted(); complete(s, 'focused-reading'); activity(s, { type: 'ENCOUNTER_FIGHT' });
    s.combatHistory.push({ round: 1, stance: 'ATTACK', first: 'PLAYER', playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1,
      moves: [{ actor: 'PLAYER', label: '实际有限攻势', selfGain: 3, enemyReduction: 0 }], playerAdvantage: 3, enemyAdvantage: 0, winChance: 60, winner: 'PLAYER', consequence: '抵抗结束', consequenceWeights: null, retreat: 'NONE' });
    const ctx = context(s), acting = s.progression.acting;
    settleHypnotistEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award);
    expect(ctx.award).toHaveBeenCalledExactlyOnceWith('hypnotist-dispute', 25); expect(s.progression.acting).toBe(acting);
    expect(validateHypnotistState(s)).toBe(true);
    expect(() => settleHypnotistEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award)).toThrow();
    const forged = structuredClone(s); forged.combatHistory[0]!.moves[0]!.selfGain = 0; expect(validateHypnotistState(forged)).toBe(false);
  });
  it('preserves real death and never awards a lost encounter', () => {
    const s = promoted(); complete(s, 'focused-reading'); activity(s, { type: 'ENCOUNTER_FIGHT' }); s.status = 'DEAD';
    const ctx = context(s); settleHypnotistEncounter(s, 'PLAYER_DEAD', ctx.c, ctx.award);
    expect([s.status, s.hypnotist.encounter.status, s.combat]).toEqual(['DEAD', 'LOST', null]); expect(ctx.award).not.toHaveBeenCalled();
  });
});

describe('Hypnotist canon limits remain explicit in actual case results', () => {
  it('confirms actual short-task attention before the hypnosis check and keeps the agreed stop signal', () => {
    const s = promoted(); begin(s, 'focused-reading', 'ABILITY');
    const ctx = activity(s, { type: 'PERFORM', caseId: 'focused-reading' });
    expect(ctx.c.check).toHaveBeenCalledExactlyOnceWith('will', 12);
    expect(ctx.c.note).toHaveBeenCalledWith('本人实际集中注意', expect.stringContaining('实际集中于眼前公开文字'));
    expect(hypnotistCases(s).find(x => x.id === 'focused-reading')!.result).toContain('原壁钟停止');
    expect(s.hypnotist.cases['focused-reading']!.contactOpen).toBe(true);
    const exit = activity(s, { type: 'CLOSE', caseId: 'focused-reading' });
    expect(exit.c.note).toHaveBeenCalledWith('实际结束本次事项并退出', expect.stringContaining('停止本次全部精神影响'));
    expect(validateHypnotistState(s)).toBe(true);
  });
  it('shows the revised accepted proposal rather than the rejected attention-diversion instruction', () => {
    const s = promoted(); begin(s, 'protected-choice', 'ABILITY'); activity(s, { type: 'PERFORM', caseId: 'protected-choice' });
    activity(s, { type: 'CLOSE', caseId: 'protected-choice' }); s.week += 1;
    activity(s, { type: 'PREPARE', caseId: 'protected-choice', method: 'ABILITY' });
    const preparation = hypnotistCases(s).find(x => x.id === 'protected-choice')!.preparation!;
    expect(preparation).toContain('旁观说明'); expect(preparation).toContain('不碰原箱');
    expect(preparation).not.toContain('第一次会遭');
    const ctx = activity(s, { type: 'PERFORM', caseId: 'protected-choice' });
    expect(ctx.c.check).toHaveBeenCalledOnce(); expect(ctx.c.note).toHaveBeenCalledWith('本人实际集中注意', expect.stringContaining('没有移开看护注意'));
  });
  it.each([1, 100])('speaks to break psychological invisibility on either result, roll %s', roll => {
    const s = promoted(); begin(s, 'unnoticed-passage', 'ABILITY'); const ctx = activity(s, { type: 'PERFORM', caseId: 'unnoticed-passage' }, roll);
    const notes = vi.mocked(ctx.c.note).mock.calls.flat().join(' ');
    expect(notes).toContain('亲口'); expect(notes).toContain('当场破除');
    expect(hypnotistInside(s)).toBe(true); activity(s, { type: 'CLOSE', caseId: 'unnoticed-passage' });
    expect(hypnotistInside(s)).toBe(false); expect(validateHypnotistState(s)).toBe(true);
  });
  it('never treats ordinary movement as a supernatural invisibility result', () => {
    const s = promoted(); begin(s, 'unnoticed-passage', 'ORDINARY'); const spirit = s.spirituality;
    const ctx = activity(s, { type: 'PERFORM', caseId: 'unnoticed-passage' }, 100);
    expect(s.spirituality).toBe(spirit);
    expect(vi.mocked(ctx.c.note).mock.calls.flat().join(' ')).toContain('本次没有使用心理学隐身');
  });
  it('rejects a forged week advance while the actual practice site is still open', () => {
    const s = promoted(); begin(s, 'focused-reading'); activity(s, { type: 'PERFORM', caseId: 'focused-reading' });
    s.week += 1; expect(validateHypnotistLife(s)).toBe(false);
  });
  it('rejects encounter survey commands and extra persistent mental-control fields', () => {
    expect(validateHypnotistCommand({ type: 'OBSERVE_ENCOUNTER' })).toBe(false);
    const s = promoted(); Object.assign(s.hypnotist.encounter, { observed: true }); expect(validateHypnotistState(s)).toBe(false);
    const t = promoted(); Object.assign(t.hypnotist.cases['focused-reading']!, { controlled: true }); expect(validateHypnotistState(t)).toBe(false);
  });
});
