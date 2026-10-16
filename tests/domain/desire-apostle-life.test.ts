import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyDesireApostleCommand, createDesireApostleState, validateDesireApostleState } from '../../src/domain/desire-apostle/index.js';
import { applyDesireApostleActivity, desireApostleActions, desireApostleCases, desireApostleInside, desireApostlePractice, isDesireApostleActivity, validateDesireApostleLife, DESIRE_APOSTLE_ENVIRONMENT } from '../../src/domain/desire-apostle/life.js';
import { DESIRE_APOSTLE_ABILITY_IDS, DESIRE_APOSTLE_CASE_IDS, type DesireApostleActivityCommand, type DesireApostleCaseId, type DesireApostleCommand } from '../../src/domain/desire-apostle/types.js';

function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source); s.progression.mastery[DESIRE_APOSTLE_ABILITY_IDS[0]]! += amount;
  });
  return { ctx, award };
}
function demon(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/demon-v0890/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous); s.desireApostle = createDesireApostleState();
  const week = Math.max(s.week, s.demon.promotionWeek! + 12);
  s.date = addGameWeeks(s.date, week - s.week); s.week = week;
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.spirituality = 50; s.seer.pollution = 0; s.character.coreStats.will = 26; s.character.coreStats.knowledge = 26;
  return s;
}
function promoted(): SliceState {
  const s = demon(), ctx = context(s).ctx;
  applyDesireApostleCommand(s, { type: 'LEARN_GUIDANCE' }, ctx);
  applyDesireApostleCommand(s, { type: 'BUY_POTION', bottleId: s.desireApostle.bottles[0]!.id }, ctx);
  applyDesireApostleCommand(s, { type: 'CONSUME', bottleId: s.desireApostle.bottles[0]!.id, confirmed: true }, ctx);
  return s;
}
function nextWeek(s: SliceState) { s.week += 1; s.date = addGameWeeks(s.date, 1); s.actionsRemaining = 100; }
function act(s: SliceState, command: DesireApostleActivityCommand, roll = 1) { const c = context(s, roll); applyDesireApostleActivity(s, command, c.ctx, c.award); return c; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyDesireApostleActivity(s, command as DesireApostleActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: DesireApostleCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  if (s.desireApostle.cases[caseId]!.status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: DesireApostleCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); act(s, { type: 'PERFORM', caseId });
  if (method === 'ABILITY') act(s, { type: 'CATALYZE', caseId: 'eager-rehearsal' });
  act(s, { type: 'CLOSE', caseId }); return act(s, { type: 'REPORT', caseId });
}
function rehearsal() { const s = promoted(); complete(s, 'calm-boundary'); begin(s, 'eager-rehearsal', 'ABILITY'); return s; }
const messages = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(call => call.join(' ')).join(' ');
const originals = (s: SliceState) => structuredClone([s.criminal, s.unwinged, s.serialKiller, s.demon, s.world, s.town, s.combatHistory]);
const initialPractice = { emotion: 'CALM', seed: 'NONE', pauseObserved: false, ledger: 'GUIDE', note: 'BLANK' };

describe('DesireApostle finite current-emotion practice and original records', () => {
  it('starts without a seed or hidden observation and exposes only the three original cases', () => {
    const old = demon();
    expect(desireApostleActions(old)).toEqual([]); expect(desireApostleCases(old)).toEqual([]); expect(desireApostlePractice(old)).toBeNull();
    expect(validateDesireApostleLife(old)).toBe(true);
    const s = promoted();
    expect(s.desireApostle.practice).toEqual(initialPractice); expect(desireApostleInside(s)).toBe(false);
    expect(desireApostleCases(s).map(p => p.id)).toEqual([...DESIRE_APOSTLE_CASE_IDS]);
    expect(desireApostleCases(s).every(p => p.observations.length === 0)).toBe(true);
    expect(validateDesireApostleState(s)).toBe(true);
    expect(DESIRE_APOSTLE_ENVIRONMENT).toContain('原创G'); expect(DESIRE_APOSTLE_ENVIRONMENT).toContain('不是原著深渊');
    expect(desireApostleCases(s)[0]!.story).toContain('蕾娜'); expect(desireApostleCases(s)[1]!.story).toContain('米蕾尔');
  });

  it('rejects fabricated case, ability, target and command data before any cost or check', () => {
    expect(isDesireApostleActivity({ type: 'CATALYZE', caseId: 'eager-rehearsal' })).toBe(true);
    expect(isDesireApostleActivity({ type: 'LEARN_GUIDANCE' })).toBe(false);
    expect(isDesireApostleActivity(null as unknown as DesireApostleCommand)).toBe(false);
    for (const command of [null, {}, { type: 'OBSERVE', caseId: 'invented' }, { type: 'PREPARE', caseId: 'calm-boundary', method: 'ABILITY' }, { type: 'PREPARE', caseId: 'honest-account', method: 'ABILITY' }, { type: 'CATALYZE', caseId: 'calm-boundary' }, { type: 'PERFORM', caseId: 'eager-rehearsal', emotion: 'STRONG' }, { type: 'CATALYZE', caseId: 'eager-rehearsal', target: 'other' }, { type: 'CLOSE', caseId: 'honest-account', refund: true }, { type: 'REFLECT', extra: true }, { type: 'FORCE_LOYALTY' }]) reject(promoted(), command);
  });

  it('uses only an ordinary calm boundary and really returns the same ledger even after failure', () => {
    const s = promoted(), old = originals(s); begin(s, 'calm-boundary');
    expect(desireApostleActions(s).some(a => a.command.type === 'PREPARE' && a.command.caseId === 'calm-boundary' && a.command.method === 'ABILITY')).toBe(false);
    const spirit = s.spirituality, ap = s.actionsRemaining, c = act(s, { type: 'PERFORM', caseId: 'calm-boundary' }, 100);
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, spirit]);
    expect(s.desireApostle.practice).toEqual({ ...initialPractice, ledger: 'PLAYER' });
    expect(messages(c)).toContain('DA5-LEDGER-1'); expect(desireApostleInside(s)).toBe(true); expect(validateDesireApostleLife(s)).toBe(true);
    reject(s, { type: 'CATALYZE', caseId: 'eager-rehearsal' }); reject(s, { type: 'REPORT', caseId: 'calm-boundary' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    const close = act(s, { type: 'CLOSE', caseId: 'calm-boundary' });
    expect(messages(close)).toContain('亲手把同一本DA5-LEDGER-1交还'); expect(s.desireApostle.practice).toEqual(initialPractice);
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]); expect(close.ctx.check).not.toHaveBeenCalled();
    expect(desireApostleInside(s)).toBe(false); expect(validateDesireApostleLife(s)).toBe(true); expect(originals(s)).toEqual(old);
    s.mind = 100; s.actionsRemaining = 5; reject(s, { type: 'PREPARE', caseId: 'calm-boundary', method: 'ORDINARY' });
    nextWeek(s); const report = complete(s, 'calm-boundary'); expect(report.award).not.toHaveBeenCalled(); expect(validateDesireApostleState(s)).toBe(true);
  });

  it('plants for 1 AP and 3 spirit, then catalyzes in that paid action at 0 AP for 2 spirit', () => {
    const s = rehearsal(), old = originals(s), mastery = structuredClone(s.progression.mastery);
    expect(s.desireApostle.practice).toEqual(initialPractice);
    s.actionsRemaining = 1; s.spirituality = 5;
    const plant = act(s, { type: 'PERFORM', caseId: 'eager-rehearsal' });
    expect(plant.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14);
    expect([s.actionsRemaining, s.spirituality]).toEqual([0, 2]);
    expect(s.desireApostle.cases['eager-rehearsal']).toMatchObject({ status: 'PREPARED', attemptWeek: s.week, method: 'ABILITY', contactOpen: true, outcome: 'NONE' });
    expect(s.desireApostle.practice).toEqual({ ...initialPractice, emotion: 'STRONG', seed: 'PLANTED' });
    expect(plant.award).not.toHaveBeenCalled(); expect(s.progression.mastery).toEqual(mastery); expect(validateDesireApostleState(s)).toBe(true);
    const actions = desireApostleActions(s);
    expect(actions.find(a => a.command.type === 'CATALYZE')).toMatchObject({ enabled: true, cost: expect.stringContaining('另2灵性') });
    expect(actions.some(a => ['PERFORM', 'WITHDRAW'].includes(a.command.type))).toBe(false);
    for (const command of [{ type: 'PERFORM', caseId: 'eager-rehearsal' }, { type: 'WITHDRAW', caseId: 'eager-rehearsal' }, { type: 'REPORT', caseId: 'eager-rehearsal' }, { type: 'ENCOUNTER_FIGHT' }]) reject(s, command);
    const catalyst = act(s, { type: 'CATALYZE', caseId: 'eager-rehearsal' });
    expect(catalyst.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14); expect([s.actionsRemaining, s.spirituality]).toEqual([0, 0]);
    expect(s.desireApostle.practice).toMatchObject({ seed: 'SPENT', pauseObserved: true });
    expect(s.desireApostle.cases['eager-rehearsal']).toMatchObject({ status: 'EXAMINED', outcome: 'CATALYSIS_CHECKED', contactOpen: true });
    expect(catalyst.award).not.toHaveBeenCalled(); expect(validateDesireApostleLife(s)).toBe(true);
    reject(s, { type: 'CATALYZE', caseId: 'eager-rehearsal' });
    act(s, { type: 'CLOSE', caseId: 'eager-rehearsal' });
    expect(s.desireApostle.practice).toMatchObject({ seed: 'SPENT', emotion: 'CALM', pauseObserved: true });
    expect([s.actionsRemaining, s.spirituality]).toEqual([0, 0]); expect(desireApostleInside(s)).toBe(false);
    s.actionsRemaining = 1; const report = act(s, { type: 'REPORT', caseId: 'eager-rehearsal' });
    expect(report.award).toHaveBeenCalledExactlyOnceWith('desire-apostle-case:eager-rehearsal', 8);
    expect(s.progression.acting).toBe(50); expect(validateDesireApostleState(s)).toBe(true); expect(originals(s)).toEqual(old);
    reject(s, { type: 'REPORT', caseId: 'eager-rehearsal' });
  });

  it('can stop a successful seed at zero AP and zero spirit without refund, then retry only next week', () => {
    const s = rehearsal(); s.actionsRemaining = 1; s.spirituality = 3;
    act(s, { type: 'PERFORM', caseId: 'eager-rehearsal' });
    expect([s.actionsRemaining, s.spirituality]).toEqual([0, 0]);
    expect(desireApostleActions(s).find(a => a.command.type === 'CATALYZE')).toMatchObject({ enabled: false, reason: expect.stringContaining('还需2灵性') });
    expect(desireApostleActions(s).find(a => a.command.type === 'CLOSE')).toMatchObject({ enabled: true });
    reject(s, { type: 'CATALYZE', caseId: 'eager-rehearsal' });
    const attempt = s.week, c = act(s, { type: 'CLOSE', caseId: 'eager-rehearsal' });
    expect(messages(c)).toContain('实际等过'); expect(messages(c)).toContain('种子实际到期');
    expect(s.desireApostle.practice).toEqual({ ...initialPractice, seed: 'EXPIRED' });
    expect(s.desireApostle.cases['eager-rehearsal']).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', contactOpen: false, attemptWeek: attempt, closes: 1 });
    expect([s.actionsRemaining, s.spirituality]).toEqual([0, 0]); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
    expect(validateDesireApostleState(s)).toBe(true); reject(s, { type: 'CLOSE', caseId: 'eager-rehearsal' });
    s.actionsRemaining = 5; reject(s, { type: 'PREPARE', caseId: 'eager-rehearsal', method: 'ORDINARY' });
    nextWeek(s); const report = complete(s, 'eager-rehearsal');
    expect(report.award).not.toHaveBeenCalled(); expect(s.desireApostle.practice).toEqual(initialPractice);
    expect(s.desireApostle.cases['eager-rehearsal']!.closes).toBe(2); expect(validateDesireApostleState(s)).toBe(true);
  });

  it('keeps paid planting failure and paid catalysis failure separate without an effect or reward', () => {
    const failedPlant = rehearsal(); failedPlant.spirituality = 5; failedPlant.actionsRemaining = 1;
    const plant = act(failedPlant, { type: 'PERFORM', caseId: 'eager-rehearsal' }, 100);
    expect([failedPlant.actionsRemaining, failedPlant.spirituality]).toEqual([0, 2]);
    expect(failedPlant.desireApostle.practice).toMatchObject({ emotion: 'STRONG', seed: 'NONE', pauseObserved: false });
    expect(failedPlant.desireApostle.cases['eager-rehearsal']).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', contactOpen: true });
    expect(plant.award).not.toHaveBeenCalled(); reject(failedPlant, { type: 'CATALYZE', caseId: 'eager-rehearsal' });
    act(failedPlant, { type: 'CLOSE', caseId: 'eager-rehearsal' }); expect(validateDesireApostleState(failedPlant)).toBe(true);
    const failedCatalyst = rehearsal(); failedCatalyst.spirituality = 5; failedCatalyst.actionsRemaining = 1;
    act(failedCatalyst, { type: 'PERFORM', caseId: 'eager-rehearsal' });
    const catalyst = act(failedCatalyst, { type: 'CATALYZE', caseId: 'eager-rehearsal' }, 100);
    expect([failedCatalyst.actionsRemaining, failedCatalyst.spirituality]).toEqual([0, 0]);
    expect(failedCatalyst.desireApostle.practice).toMatchObject({ emotion: 'STRONG', seed: 'SPENT', pauseObserved: false });
    expect(failedCatalyst.desireApostle.cases['eager-rehearsal']).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', contactOpen: true });
    expect(catalyst.award).not.toHaveBeenCalled(); reject(failedCatalyst, { type: 'CATALYZE', caseId: 'eager-rehearsal' });
    act(failedCatalyst, { type: 'CLOSE', caseId: 'eager-rehearsal' });
    expect(failedCatalyst.desireApostle.practice.seed).toBe('SPENT'); expect(validateDesireApostleState(failedCatalyst)).toBe(true);
    reject(failedCatalyst, { type: 'REPORT', caseId: 'eager-rehearsal' });
  });

  it('checks actual current emotion instead of treating an existing seed as sufficient', () => {
    const s = rehearsal(); act(s, { type: 'PERFORM', caseId: 'eager-rehearsal' });
    s.desireApostle.practice.emotion = 'CALM';
    expect(desireApostleActions(s).find(a => a.command.type === 'CATALYZE')).toMatchObject({ enabled: false, reason: expect.stringContaining('情绪平稳') });
    reject(s, { type: 'CATALYZE', caseId: 'eager-rehearsal' });
    act(s, { type: 'CLOSE', caseId: 'eager-rehearsal' });
    expect(s.desireApostle.practice.seed).toBe('EXPIRED'); expect(validateDesireApostleState(s)).toBe(true);
  });

  it('writes and physically hands over the same original note even after failure and on retry', () => {
    const s = promoted(); complete(s, 'calm-boundary'); complete(s, 'eager-rehearsal'); begin(s, 'honest-account');
    const old = originals(s), spirit = s.spirituality, c = act(s, { type: 'PERFORM', caseId: 'honest-account' }, 100);
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect(s.spirituality).toBe(spirit);
    expect(s.desireApostle.practice.note).toBe('WRITTEN'); expect(messages(c)).toContain('DA5-NOTE-1');
    expect(desireApostleInside(s)).toBe(true); expect(validateDesireApostleState(s)).toBe(true);
    reject(s, { type: 'REPORT', caseId: 'honest-account' });
    s.actionsRemaining = 0; s.spirituality = 0; const close = act(s, { type: 'CLOSE', caseId: 'honest-account' });
    expect(messages(close)).toContain('亲手把已经写过的同一张DA5-NOTE-1'); expect(messages(close)).toContain('失败文字也保留');
    expect(s.desireApostle.practice.note).toBe('HANDED_OVER'); expect(desireApostleInside(s)).toBe(false);
    nextWeek(s); begin(s, 'honest-account'); const retry = act(s, { type: 'PERFORM', caseId: 'honest-account' });
    expect(messages(retry)).toContain('罗安亲手递来同一张DA5-NOTE-1'); expect(messages(retry)).toContain('之前的失败文字保留');
    act(s, { type: 'CLOSE', caseId: 'honest-account' }); const report = act(s, { type: 'REPORT', caseId: 'honest-account' });
    expect(report.award).not.toHaveBeenCalled(); expect(s.desireApostle.cases['honest-account']!.closes).toBe(2);
    expect(originals(s)).toEqual(old); expect(validateDesireApostleState(s)).toBe(true);
  });

  it('permits 3 ordinary reports and reflection to G100 without fake mastery or changes to Demon history', () => {
    const s = promoted(), old = originals(s), mastery = structuredClone(s.progression.mastery), spirit = s.spirituality;
    for (const caseId of DESIRE_APOSTLE_CASE_IDS) {
      const report = complete(s, caseId); expect(report.award).not.toHaveBeenCalled(); expect(validateDesireApostleState(s)).toBe(true);
    }
    expect(s.progression.acting).toBe(75); expect(s.desireApostle.practice).toEqual({ ...initialPractice, note: 'HANDED_OVER' });
    const reflection = act(s, { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(s.progression.mastery).toEqual(mastery); expect(s.spirituality).toBe(spirit);
    expect(reflection.award).not.toHaveBeenCalled(); expect(messages(reflection)).toContain('不是原著深渊');
    expect(desireApostlePractice(s)?.history.join(' ')).toContain('普通自愿配合不计能力效果');
    expect(originals(s)).toEqual(old); expect(validateDesireApostleState(s)).toBe(true);
    reject(s, { type: 'REFLECT' });
  });

  it('cancels only unstarted preparation at zero resources and validates the one paid PREPARED exception', () => {
    const s = rehearsal(); s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    const c = act(s, { type: 'WITHDRAW', caseId: 'eager-rehearsal' });
    expect(c.ctx.check).not.toHaveBeenCalled(); expect(s.desireApostle.practice).toEqual(initialPractice);
    expect(s.desireApostle.cases['eager-rehearsal']).toMatchObject({ status: 'OBSERVED', method: null, withdrawals: 1 });
    expect(validateDesireApostleLife(s)).toBe(true);
    const pending = rehearsal(); act(pending, { type: 'PERFORM', caseId: 'eager-rehearsal' });
    expect(validateDesireApostleLife(pending)).toBe(true);
    const corruptions: ((copy: SliceState) => void)[] = [
      copy => { copy.desireApostle.cases['eager-rehearsal']!.attemptWeek = null; },
      copy => { copy.desireApostle.cases['eager-rehearsal']!.contactOpen = false; },
      copy => { copy.desireApostle.cases['eager-rehearsal']!.method = 'ORDINARY'; },
      copy => { copy.desireApostle.cases['eager-rehearsal']!.status = 'OBSERVED'; },
      copy => { copy.desireApostle.practice.seed = 'NONE'; },
      copy => { copy.desireApostle.practice.pauseObserved = true; },
      copy => { copy.desireApostle.practice.ledger = 'PLAYER'; },
      copy => { copy.desireApostle.practice.note = 'WRITTEN'; },
      copy => { copy.seer.completedSources.push('desire-apostle-case:eager-rehearsal'); },
      copy => { copy.progression.acting += 25; },
    ];
    for (const corrupt of corruptions) { const copy = structuredClone(pending); corrupt(copy); expect(validateDesireApostleLife(copy)).toBe(false); }
  });
});
