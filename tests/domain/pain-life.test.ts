import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { applyPainCommand, createPainState, projectPain, validatePainState } from '../../src/domain/pain/index.js';
import { applyPainActivity, applyPainLifeProjection, isPainActivity, painActions, painCases, painInside, painPractice, PAIN_ENVIRONMENT, validatePainActivityCommand, validatePainLife } from '../../src/domain/pain/life.js';
import { PAIN_ABILITY_IDS, PAIN_CASE_IDS, type PainActivityCommand, type PainCaseId, type PainCommand } from '../../src/domain/pain/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source); s.progression.mastery[PAIN_ABILITY_IDS[0]]! += amount;
  });
  return { ctx, award };
}
function pleasure(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/pleasure-v0860/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous); s.pain = createPainState();
  const week = Math.max(s.week, s.pleasure.promotionWeek! + 12);
  s.date = addGameWeeks(s.date, week - s.week); s.week = week;
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.spirituality = 50; s.seer.pollution = 0; s.character.coreStats.will = 26; s.character.coreStats.knowledge = 26;
  return s;
}
function promoted(): SliceState {
  const s = pleasure(), c = context(s).ctx;
  applyPainCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyPainCommand(s, { type: 'BUY_POTION', bottleId: s.pain.bottles[0]!.id }, c);
  applyPainCommand(s, { type: 'CONSUME', bottleId: s.pain.bottles[0]!.id, confirmed: true }, c);
  return s;
}
function nextWeek(s: SliceState) { s.week += 1; s.date = addGameWeeks(s.date, 1); }
function act(s: SliceState, command: PainActivityCommand, roll = 1) { const c = context(s, roll); applyPainActivity(s, command, c.ctx, c.award); return c; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyPainActivity(s, command as PainActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: PainCaseId) {
  if (s.pain.cases[caseId]!.status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method: 'ORDINARY' });
}
function complete(s: SliceState, caseId: PainCaseId) {
  begin(s, caseId); act(s, { type: 'PERFORM', caseId }); act(s, { type: 'CLOSE', caseId });
  return act(s, { type: 'REPORT', caseId });
}
const messages = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(call => call.join(' ')).join(' ');
const originals = (s: SliceState) => structuredClone([s.assassin, s.instigator, s.witch, s.pleasure, s.world, s.town, s.combatHistory, s.character.gender, s.pain.encounter]);
const initialPractice = { playerNode: 'ENTRY', companionNode: 'WAITING', marker: 'RACK', tableRows: 0, careNote: 'BLANK', simulatedOnly: true };

describe('Pain ordinary peaceful simulations preserve actual people, props and consequences', () => {
  it('starts three distinct simulations with original Lavinie, marker and papers, without actual disease', () => {
    const old = pleasure(); expect(painActions(old)).toEqual([]); expect(painCases(old)).toEqual([]); expect(painPractice(old)).toBeNull(); expect(validatePainLife(old)).toBe(true);
    const s = promoted(), cases = painCases(s);
    expect(s.pain.practice).toEqual(initialPractice); expect(painInside(s)).toBe(false); expect(validatePainState(s)).toBe(true);
    expect(cases.map(p => p.id)).toEqual([...PAIN_CASE_IDS]); expect(new Set(cases.map(p => p.story)).size).toBe(3);
    expect(cases.every(p => p.observations.length === 0)).toBe(true);
    expect(cases[0]!.story).toContain('成年演员拉维妮'); expect(cases[0]!.story).toContain('PN5-MARKER-1'); expect(cases[0]!.story).toContain('四米');
    expect(cases[1]!.story).toContain('PN5-CASE-NOTES-1'); expect(cases[1]!.story).toContain('纯虚构模拟');
    expect(cases[2]!.story).toContain('PN5-CARE-NOTE-1'); expect(cases[2]!.story).toContain('她没有生病');
    expect(PAIN_ENVIRONMENT).toContain('不发能力掌握奖励'); expect(PAIN_ENVIRONMENT).toContain('盟友也没有默认免疫');
  });

  it('accepts only exact ordinary commands and rejects disease, fake healing and copied prop instructions', () => {
    for (const type of ['REFLECT', 'BUY_SUPPLIES', 'PREPARE_MIRROR', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'ENCOUNTER_AID'] as const) { expect(isPainActivity({ type })).toBe(true); expect(validatePainActivityCommand({ type })).toBe(true); }
    expect(isPainActivity({ type: 'LEARN_GUIDANCE' })).toBe(false); expect(isPainActivity(null as unknown as PainCommand)).toBe(false);
    for (const command of [null, {}, { type: 'OBSERVE', caseId: 'invented' }, { type: 'PREPARE', caseId: 'exit-markers', method: 'ABILITY' }, { type: 'PREPARE', caseId: 'symptom-table', method: 'DISEASE' }, { type: 'PERFORM', caseId: 'exit-markers', infect: true }, { type: 'CLOSE', caseId: 'exit-markers', teleport: true }, { type: 'CLOSE', caseId: 'care-handoff', heal: true }, { type: 'REPORT', caseId: 'symptom-table', mastery: 8 }, { type: 'WITHDRAW', caseId: 'exit-markers', refund: true }, { type: 'REFLECT', extra: true }, { type: 'ENCOUNTER_AID', cure: true }, { type: 'COPY_NOTE' }]) { expect(validatePainActivityCommand(command)).toBe(false); reject(promoted(), command); }
    expect(painActions(promoted()).some(a => a.command.type === 'PREPARE' && a.command.method !== 'ORDINARY')).toBe(false);
  });

  it.each(PAIN_CASE_IDS)('%s observation and preparation do not move people, write paper or open contact', caseId => {
    const s = promoted(), old = originals(s), ap = s.actionsRemaining, spirit = s.spirituality;
    const observed = act(s, { type: 'OBSERVE', caseId }), prepared = act(s, { type: 'PREPARE', caseId, method: 'ORDINARY' });
    expect(observed.ctx.check).not.toHaveBeenCalled(); expect(prepared.ctx.check).not.toHaveBeenCalled();
    expect(s.pain.practice).toEqual(initialPractice); expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 2, spirit]);
    expect(painInside(s)).toBe(false); expect(originals(s)).toEqual(old); expect(validatePainLife(s)).toBe(true);
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    const cancelled = act(s, { type: 'WITHDRAW', caseId }); expect(cancelled.award).not.toHaveBeenCalled();
    expect(s.pain.practice).toEqual(initialPractice); expect(s.pain.cases[caseId]).toMatchObject({ status: 'OBSERVED', method: null, withdrawals: 1, attemptWeek: null });
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]); expect(validatePainLife(s)).toBe(true);
    reject(s, { type: 'WITHDRAW', caseId }); reject(s, { type: 'CLOSE', caseId });
  });

  it.each([1, 100])('roll%s preserves actual four-metre outward walk and same marker before accepting a report', roll => {
    const s = promoted(); begin(s, 'exit-markers'); const before = [s.health, s.mind, s.spirituality], old = originals(s), ap = s.actionsRemaining;
    const c = act(s, { type: 'PERFORM', caseId: 'exit-markers' }, roll);
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect(c.award).not.toHaveBeenCalled();
    expect(s.pain.practice).toEqual({ ...initialPractice, playerNode: 'SAFE_MARK', companionNode: 'SAFE_MARK', marker: 'DOOR_MARK' });
    expect(s.actionsRemaining).toBe(ap - 1); expect([s.health, s.mind, s.spirituality]).toEqual(before); expect(originals(s)).toEqual(old);
    expect(s.pain.cases['exit-markers']).toMatchObject({ status: roll === 1 ? 'EXAMINED' : 'OBSERVED', outcome: roll === 1 ? 'EXIT_REHEARSED' : 'NONE', contactOpen: true });
    expect(messages(c)).toContain('沿原净空四米通路实际走到'); expect(painInside(s)).toBe(true); expect(validatePainLife(s)).toBe(true);
    reject(s, { type: 'REPORT', caseId: 'exit-markers' }); reject(s, { type: 'WITHDRAW', caseId: 'exit-markers' });
    reject(s, { type: 'OBSERVE', caseId: 'symptom-table' }); reject(s, { type: 'BUY_SUPPLIES' }); reject(s, { type: 'ENCOUNTER_FIGHT' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    const closed = act(s, { type: 'CLOSE', caseId: 'exit-markers' });
    expect(messages(closed)).toContain('同一条净空四米原路径实际走回'); expect(messages(closed)).toContain('放回原架');
    expect(s.pain.practice).toEqual(initialPractice); expect(s.pain.cases['exit-markers']!.closes).toBe(1);
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]); expect(closed.award).not.toHaveBeenCalled();
    expect(painInside(s)).toBe(false); expect(validatePainLife(s)).toBe(true); reject(s, { type: 'CLOSE', caseId: 'exit-markers' });
  });

  it.each([1, 100])('roll%s keeps exactly three real rows on the original fictional sheet through closure', roll => {
    const s = promoted(); begin(s, 'symptom-table'); const old = originals(s), resources = [s.health, s.mind, s.spirituality];
    const c = act(s, { type: 'PERFORM', caseId: 'symptom-table' }, roll);
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect(s.pain.practice).toEqual({ ...initialPractice, tableRows: 3 });
    expect(messages(c)).toContain('0、1、2个G回合'); expect(messages(c)).toContain('没有实际感染者'); expect(validatePainLife(s)).toBe(true);
    const closed = act(s, { type: 'CLOSE', caseId: 'symptom-table' });
    expect(messages(closed)).toContain('同一张PN5-CASE-NOTES-1放回原文件夹'); expect(s.pain.practice.tableRows).toBe(3);
    expect([s.health, s.mind, s.spirituality]).toEqual(resources); expect(originals(s)).toEqual(old); expect(validatePainLife(s)).toBe(true);
    if (roll === 100) {
      reject(s, { type: 'REPORT', caseId: 'symptom-table' }); reject(s, { type: 'PREPARE', caseId: 'symptom-table', method: 'ORDINARY' });
      nextWeek(s); begin(s, 'symptom-table'); act(s, { type: 'WITHDRAW', caseId: 'symptom-table' }); expect(s.pain.practice.tableRows).toBe(3);
      complete(s, 'symptom-table'); expect(s.pain.practice.tableRows).toBe(3); expect(s.pain.cases['symptom-table']!.closes).toBe(2); expect(validatePainLife(s)).toBe(true);
    }
  });

  it('successful welfare handoff really transfers the same original paper and leaves it with the recipient', () => {
    const s = promoted(); begin(s, 'care-handoff'); const old = originals(s), resources = [s.health, s.mind, s.spirituality];
    const c = act(s, { type: 'PERFORM', caseId: 'care-handoff' });
    expect(s.pain.practice.careNote).toBe('HANDED_OVER'); expect(s.pain.cases['care-handoff']!.outcome).toBe('CARE_HANDED');
    expect(messages(c)).toContain('亲手把同一张PN5-CARE-NOTE-1交给'); expect(painPractice(s)!.care).toContain('由拉维妮保管');
    const closed = act(s, { type: 'CLOSE', caseId: 'care-handoff' }); expect(messages(closed)).toContain('继续由拉维妮保管');
    expect(s.pain.practice.careNote).toBe('HANDED_OVER'); expect([s.health, s.mind, s.spirituality]).toEqual(resources);
    expect(originals(s)).toEqual(old); expect(validatePainLife(s)).toBe(true); expect(act(s, { type: 'REPORT', caseId: 'care-handoff' }).award).not.toHaveBeenCalled();
  });

  it('failed welfare check leaves writing in hand, returns that written paper, then retries without erasing it', () => {
    const s = promoted(); begin(s, 'care-handoff'); const old = originals(s), spirit = s.spirituality;
    const failed = act(s, { type: 'PERFORM', caseId: 'care-handoff' }, 100);
    expect(messages(failed)).toContain('仍由你拿着'); expect(s.pain.practice.careNote).toBe('WRITTEN'); expect(painPractice(s)!.care).toContain('仍在你手上');
    expect(s.pain.cases['care-handoff']).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', contactOpen: true }); expect(validatePainLife(s)).toBe(true);
    const closed = act(s, { type: 'CLOSE', caseId: 'care-handoff' }); expect(messages(closed)).toContain('实际放回原桌');
    expect(s.pain.practice.careNote).toBe('WRITTEN'); expect(painPractice(s)!.care).toContain('书写保留，尚未交付');
    reject(s, { type: 'REPORT', caseId: 'care-handoff' }); reject(s, { type: 'PREPARE', caseId: 'care-handoff', method: 'ORDINARY' });
    nextWeek(s); begin(s, 'care-handoff'); act(s, { type: 'WITHDRAW', caseId: 'care-handoff' }); expect(s.pain.practice.careNote).toBe('WRITTEN');
    complete(s, 'care-handoff'); expect(s.pain.practice.careNote).toBe('HANDED_OVER'); expect(s.pain.cases['care-handoff']!.closes).toBe(2);
    expect(s.spirituality).toBe(spirit); expect(originals(s)).toEqual(old); expect(validatePainState(s)).toBe(true);
  });

  it.each(PAIN_CASE_IDS)('%s failed checks require real closure and a new week before a paid retry', caseId => {
    const s = promoted(); begin(s, caseId); const mastery = structuredClone(s.progression.mastery), ap = s.actionsRemaining;
    act(s, { type: 'PERFORM', caseId }, 100); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'PREPARE', caseId, method: 'ORDINARY' }); reject(s, { type: 'REPORT', caseId });
    act(s, { type: 'CLOSE', caseId }); reject(s, { type: 'PREPARE', caseId, method: 'ORDINARY' });
    nextWeek(s); complete(s, caseId); expect(s.pain.cases[caseId]!.closes).toBe(2);
    expect(s.progression.acting).toBe(25); expect(s.progression.mastery).toEqual(mastery); expect(validatePainLife(s)).toBe(true);
  });

  it('three checked ordinary reports and reflection reach peaceful100 without any disease, injury or mastery', () => {
    const s = promoted(), mastery = structuredClone(s.progression.mastery), old = originals(s), health = s.health, mind = s.mind; s.spirituality = 0;
    for (const caseId of PAIN_CASE_IDS) {
      begin(s, caseId); const perform = act(s, { type: 'PERFORM', caseId });
      expect(perform.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect(perform.award).not.toHaveBeenCalled();
      act(s, { type: 'CLOSE', caseId }); expect(act(s, { type: 'REPORT', caseId }).award).not.toHaveBeenCalled();
    }
    expect(s.progression.acting).toBe(75); expect(act(s, { type: 'REFLECT' }).award).not.toHaveBeenCalled(); expect(s.progression.acting).toBe(100);
    expect([s.health, s.mind, s.spirituality]).toEqual([health, mind, 0]);
    expect(s.pain.practice).toEqual({ ...initialPractice, tableRows: 3, careNote: 'HANDED_OVER' });
    expect(s.progression.mastery).toEqual(mastery); expect(s.progression.mastery['assassin.s5.disease']).toBe(0); expect(originals(s)).toEqual(old); expect(validatePainState(s)).toBe(true);
    expect(s.seer.completedSources.filter(x => x.startsWith('pain-'))).toEqual([...PAIN_CASE_IDS.map(id => `pain-case:${id}`), 'pain-reflection']);
    for (const caseId of PAIN_CASE_IDS) { reject(s, { type: 'PREPARE', caseId, method: 'ORDINARY' }); reject(s, { type: 'REPORT', caseId }); }
    reject(s, { type: 'REFLECT' });
  });

  it('cancellation and reporting cannot bypass actual other preparations, exhausted actions or locality', () => {
    const s = promoted(); act(s, { type: 'OBSERVE', caseId: 'symptom-table' }); begin(s, 'exit-markers');
    reject(s, { type: 'PREPARE', caseId: 'symptom-table', method: 'ORDINARY' }); reject(s, { type: 'ENCOUNTER_FIGHT' });
    s.actionsRemaining = 0; reject(s, { type: 'PERFORM', caseId: 'exit-markers' }); act(s, { type: 'WITHDRAW', caseId: 'exit-markers' });
    s.actionsRemaining = 5; begin(s, 'exit-markers'); act(s, { type: 'PERFORM', caseId: 'exit-markers' });
    s.world.city = 'TINGEN'; reject(s, { type: 'CLOSE', caseId: 'exit-markers' });
    s.world.city = 'BACKLUND'; act(s, { type: 'CLOSE', caseId: 'exit-markers' }); expect(validatePainLife(s)).toBe(true);
  });

  it('inherited purchases and zero-action preparation use the original finite Witch inventory only', () => {
    const s = promoted(), old = structuredClone([s.assassin, s.instigator, s.pleasure]), tools = structuredClone(s.witch.tools), cash = s.cash, ap = s.actionsRemaining, spirit = s.spirituality;
    const c = act(s, { type: 'BUY_SUPPLIES' });
    expect([s.actionsRemaining, s.cash, s.spirituality]).toEqual([ap - 1, cash - 60, spirit]);
    expect(s.witch.tools).toMatchObject({ kitsBought: tools.kitsBought + 1, powderHeld: tools.powderHeld + 3, mirrorsHeld: tools.mirrorsHeld + 1, powderUsed: tools.powderUsed, mirrorsUsed: tools.mirrorsUsed, lastPurchaseWeek: s.week });
    expect(c.award).not.toHaveBeenCalled(); reject(s, { type: 'BUY_SUPPLIES' });
    if (s.witch.tools.mirrorPrepared) reject(s, { type: 'PREPARE_MIRROR' });
    else { s.actionsRemaining = 0; act(s, { type: 'PREPARE_MIRROR' }); expect(s.actionsRemaining).toBe(0); expect(s.witch.tools.mirrorPrepared).toBe(true); reject(s, { type: 'PREPARE_MIRROR' }); }
    expect(s.witch.tools.mirrorsHeld).toBe(tools.mirrorsHeld + 1); expect(s.spirituality).toBe(spirit); expect([s.assassin, s.instigator, s.pleasure]).toEqual(old); expect(s.pain.practice).toEqual(initialPractice);
  });

  it('public last-action preparation advances a real week with everyone and all props still outside contact', () => {
    const s = promoted(); act(s, { type: 'OBSERVE', caseId: 'exit-markers' }); s.actionsRemaining = 1; s.weeklyBudget = 3; s.debts = [];
    const week = s.week, next = applySliceIntent(s, { type: 'PAIN', command: { type: 'PREPARE', caseId: 'exit-markers', method: 'ORDINARY' } });
    expect(next.week).toBe(week + 1); expect(next.pain.cases['exit-markers']!.status).toBe('PREPARED');
    expect(next.pain.practice).toEqual(initialPractice); expect(painInside(next)).toBe(false);
  });

  it.each(PAIN_CASE_IDS)('public last-action %s keeps actual contact open until zero-action physical closure', caseId => {
    const s = promoted(); begin(s, caseId); s.actionsRemaining = 1; s.weeklyBudget = 3; s.debts = [];
    const week = s.week, performed = applySliceIntent(s, { type: 'PAIN', command: { type: 'PERFORM', caseId } });
    expect([performed.week, performed.actionsRemaining]).toEqual([week, 0]); expect(painInside(performed)).toBe(true);
    expect(() => applySliceIntent(performed, { type: 'ACTION', action: 'REST' })).toThrow(); expect(() => applySliceIntent(performed, { type: 'ACTION', action: 'WORK' })).toThrow();
    const physical = structuredClone(performed.pain.practice), closed = applySliceIntent(performed, { type: 'PAIN', command: { type: 'CLOSE', caseId } });
    expect(closed.week).toBe(week + 1); expect(painInside(closed)).toBe(false);
    expect(closed.pain.practice).toEqual({ ...physical, playerNode: 'ENTRY', companionNode: 'WAITING', marker: 'RACK' });
    expect(closed.pain.cases[caseId]!.closes).toBe(1); expect(validatePainLife(closed)).toBe(true);
  });

  it('projection returns detached actual location, paper history and ordinary actions with inherited disease state intact', () => {
    const s = promoted(); begin(s, 'exit-markers'); act(s, { type: 'PERFORM', caseId: 'exit-markers' });
    const acquisition = projectPain(s), p = applyPainLifeProjection(s, acquisition), practice = painPractice(s)!, cases = painCases(s);
    expect(p.diseaseState).toEqual(acquisition.diseaseState); expect(p.bodyChange).toBe(acquisition.bodyChange); expect(p.inheritedTools).toBe(acquisition.inheritedTools);
    expect(practice.position).toContain('四米外原安全标线'); expect(p.insideCase).toBe(true); expect(p.practice).toEqual(practice);
    expect(p.actions.find(a => a.command.type === 'CLOSE')!.enabled).toBe(true); expect(p.actions.find(a => a.command.type === 'REPORT')!.enabled).toBe(false);
    expect(new Set(p.actions.map(a => a.id)).size).toBe(p.actions.length);
    practice.history.push('invented'); cases[0]!.observations.push('invented'); practice.position = 'teleported';
    expect(painPractice(s)!.history).not.toContain('invented'); expect(painCases(s)[0]!.observations).not.toContain('invented'); expect(s.pain.practice.playerNode).toBe('SAFE_MARK');
    act(s, { type: 'CLOSE', caseId: 'exit-markers' }); expect(painPractice(s)!.position).toContain('实际返回入口和原等候点');
    expect(acquisition.actions).toEqual([]); expect(acquisition.cases).toEqual([]);
  });

  it('detects physical presence independently of forged contact flags', () => {
    for (const key of ['playerNode', 'companionNode', 'marker'] as const) {
      const s = promoted(); Object.assign(s.pain.practice, { [key]: key === 'marker' ? 'DOOR_MARK' : 'SAFE_MARK' });
      expect(painInside(s)).toBe(true); expect(validatePainLife(s)).toBe(false);
    }
  });

  it('rejects forged disease practice, phantom paper, remote bodies and invalid outcome or repeated reward records', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { Object.assign(s.pain.practice, { infected: true }); }, s => { Object.assign(s.pain.practice, { simulatedOnly: false }); },
      s => { s.pain.practice.tableRows = 3; }, s => { s.pain.practice.tableRows = 1; }, s => { s.pain.practice.careNote = 'WRITTEN'; }, s => { s.pain.practice.careNote = 'HANDED_OVER'; },
      s => { s.pain.practice.playerNode = 'SAFE_MARK'; }, s => { s.pain.practice.companionNode = 'SAFE_MARK'; }, s => { s.pain.practice.marker = 'DOOR_MARK'; },
      s => { Object.assign(s.pain, { practice: null }); }, s => { Object.assign(s.pain.cases, { 'exit-markers': null }); },
      s => { Object.assign(s.pain.cases['exit-markers']!, { method: 'ABILITY' }); }, s => { s.pain.cases['exit-markers']!.closes = 1; },
      s => { s.seer.completedSources.push('pain-case:exit-markers'); }, s => { s.seer.completedSources.push('pain-reflection'); },
    ];
    for (const change of changes) { const s = promoted(); change(s); expect(validatePainLife(s)).toBe(false); }
    const actual = promoted(); complete(actual, 'symptom-table'); complete(actual, 'care-handoff');
    for (const change of [
      (s: SliceState) => { s.pain.practice.tableRows = 0; }, (s: SliceState) => { s.pain.practice.tableRows = 6; },
      (s: SliceState) => { s.pain.practice.careNote = 'BLANK'; }, (s: SliceState) => { s.pain.practice.careNote = 'WRITTEN'; },
      (s: SliceState) => { s.pain.cases['care-handoff']!.outcome = 'TABLE_COMPARED'; }, (s: SliceState) => { s.pain.cases['care-handoff']!.contactOpen = true; },
      (s: SliceState) => { s.seer.completedSources.push('pain-case:symptom-table'); },
    ]) { const s = structuredClone(actual); change(s); expect(validatePainLife(s)).toBe(false); }
  });
});
