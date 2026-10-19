import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { applyDruidCommand, createDruidState, validateDruidCommand, validateDruidState } from '../../src/domain/druid/index.js';
import { applyDruidActivity, druidActions, druidCases, druidInside, druidPractice, isDruidActivity, validateDruidLife, DRUID_ENVIRONMENT } from '../../src/domain/druid/life.js';
import { DRUID_ABILITY_IDS, DRUID_CASE_IDS, DRUID_STUDY_SOURCE_IDS, freshDruidPractice, type DruidActivityCommand, type DruidCaseId } from '../../src/domain/druid/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

const previous = JSON.parse(readFileSync('tests/fixtures/biologist-v0940/natural.json', 'utf8'));
function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source); s.progression.mastery[DRUID_ABILITY_IDS[0]]! += amount;
  });
  return { ctx, award };
}
/** Controlled unit resources on the living, pre-dispute branch; the old terminal death is never revived. */
function biologist(): SliceState {
  const s = migrateSliceState(structuredClone(previous.practiced)); s.druid = createDruidState();
  const week = Math.max(s.week, s.biologist.promotionWeek! + 12);
  s.date = addGameWeeks(s.date, week - s.week); s.week = week;
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.spirituality = 50; s.seer.pollution = 0; s.character.coreStats.will = 26; s.character.coreStats.knowledge = 26;
  return s;
}
function promoted(): SliceState {
  const s = biologist(), c = context(s).ctx;
  applyDruidCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  for (const sourceId of DRUID_STUDY_SOURCE_IDS) applyDruidCommand(s, { type: 'STUDY', sourceId }, c);
  applyDruidCommand(s, { type: 'WRITE_RECORD' }, c);
  applyDruidCommand(s, { type: 'PREPARE_RITE' }, c);
  applyDruidCommand(s, { type: 'BUY_POTION', bottleId: s.druid.bottles[0]!.id }, c);
  applyDruidCommand(s, { type: 'CONSUME', bottleId: s.druid.bottles[0]!.id, confirmed: true }, c);
  return s;
}
function act(s: SliceState, command: DruidActivityCommand, roll = 1) { const c = context(s, roll); applyDruidActivity(s, command, c.ctx, c.award); return c; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyDruidActivity(s, command as DruidActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: DruidCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  if (s.druid.cases[caseId]!.status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: DruidCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); act(s, { type: 'PERFORM', caseId });
  if (caseId === 'known-soil') act(s, { type: 'RETURN', caseId, method: 'ORDINARY' });
  act(s, { type: 'CLOSE', caseId }); return act(s, { type: 'REPORT', caseId });
}
function nextWeek(s: SliceState) { s.week += 1; s.date = addGameWeeks(s.date, 1); }
const originals = (s: SliceState) => structuredClone([s.cultivator, s.physician, s.harvestpriest, s.biologist]);
const messages = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(call => call.join(' ')).join(' ');

describe('Druid actual shallow-soil body passage and original-object life', () => {
  it('starts from the living pre-dispute branch, preserves all old objects and opens only actual Druid life', () => {
    expect(previous.practiced.status).toBe('ACTIVE'); expect(previous.final.status).toBe('DEAD');
    const before = biologist(), old = originals(before);
    expect(druidActions(before)).toEqual([]); expect(druidCases(before)).toEqual([]); expect(validateDruidLife(before)).toBe(true);
    const s = promoted();
    expect(s.status).toBe('ACTIVE'); expect(s.druid.practice).toEqual(freshDruidPractice()); expect(originals(s)).toEqual(old);
    expect(druidCases(s).map(c => c.id)).toEqual([...DRUID_CASE_IDS]); expect(druidCases(s).every(c => c.observations.length === 0)).toBe(true);
    expect(druidInside(s)).toBe(false); expect(validateDruidState(s)).toBe(true);
    const projection = druidPractice(s); projection.marker = 'FAR'; expect(s.druid.practice.marker).toBe('BOX');
  });

  it('physically takes the same body and marker to FAR, then separately charges and checks an ability return', () => {
    const s = promoted(); begin(s, 'known-soil', 'ABILITY'); const spirit = s.spirituality, ap = s.actionsRemaining, old = originals(s);
    const outbound = act(s, { type: 'PERFORM', caseId: 'known-soil' });
    expect(outbound.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14);
    expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, spirit - 3]);
    expect(s.druid.practice).toMatchObject({ position: 'FAR', marker: 'FAR', soil: 'SETTLED', returnAttempted: false });
    expect(messages(outbound)).toContain('原身体携同一DR5-MARKER-1'); expect(validateDruidState(s)).toBe(true);
    reject(s, { type: 'CLOSE', caseId: 'known-soil' }); reject(s, { type: 'WITHDRAW', caseId: 'known-soil' }); reject(s, { type: 'REPORT', caseId: 'known-soil' });
    reject(s, { type: 'OBSERVE', caseId: 'paired-growth' }); reject(s, { type: 'ENCOUNTER_FIGHT' });
    const returned = act(s, { type: 'RETURN', caseId: 'known-soil', method: 'ABILITY' });
    expect(returned.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14);
    expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, spirit - 6]);
    expect(s.druid.practice).toMatchObject({ position: 'NEAR', marker: 'NEAR', soil: 'SETTLED', returnAttempted: true });
    expect(druidInside(s)).toBe(true); expect(validateDruidState(s)).toBe(true); expect(returned.award).not.toHaveBeenCalled();
    reject(s, { type: 'RETURN', caseId: 'known-soil', method: 'ABILITY' });
    const closed = act(s, { type: 'CLOSE', caseId: 'known-soil' }); expect(closed.ctx.check).not.toHaveBeenCalled();
    expect(s.druid.practice.marker).toBe('BOX'); expect(druidInside(s)).toBe(false); expect(originals(s)).toEqual(old);
    const report = act(s, { type: 'REPORT', caseId: 'known-soil' }); expect(report.award).toHaveBeenCalledExactlyOnceWith('druid-case:known-soil', 8);
    expect(s.progression.acting).toBe(25); expect(validateDruidState(s)).toBe(true); reject(s, { type: 'REPORT', caseId: 'known-soil' });
  });

  it('retains a failed paid return at FAR, forbids a second roll, and always permits the original ordinary exit', () => {
    const s = promoted(); begin(s, 'known-soil', 'ABILITY'); s.actionsRemaining = 1; s.spirituality = 6;
    act(s, { type: 'PERFORM', caseId: 'known-soil' }); const failed = act(s, { type: 'RETURN', caseId: 'known-soil', method: 'ABILITY' }, 100);
    expect(failed.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14); expect([s.actionsRemaining, s.spirituality]).toEqual([0, 0]);
    expect(s.druid.practice).toMatchObject({ position: 'FAR', marker: 'FAR', soil: 'SETTLED', returnAttempted: true });
    expect(s.druid.cases['known-soil']).toMatchObject({ status: 'EXAMINED', contactOpen: true, closes: 0 }); expect(validateDruidState(s)).toBe(true);
    s.spirituality = 30; reject(s, { type: 'RETURN', caseId: 'known-soil', method: 'ABILITY' });
    s.spirituality = 0; s.mind = 0;
    const actions = druidActions(s);
    expect(actions.find(a => a.id === 'known-soil-return-ability')?.enabled).toBe(false);
    expect(actions.find(a => a.id === 'known-soil-return-ordinary')?.enabled).toBe(true);
    expect(actions.find(a => a.id === 'known-soil-close')?.enabled).toBe(false);
    const returned = act(s, { type: 'RETURN', caseId: 'known-soil', method: 'ORDINARY' });
    expect(returned.ctx.check).not.toHaveBeenCalled(); expect(returned.award).not.toHaveBeenCalled();
    expect(messages(returned)).toContain('实际从FAR走回NEAR'); expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]);
    expect(s.druid.practice.marker).toBe('NEAR'); expect(druidInside(s)).toBe(true);
    act(s, { type: 'CLOSE', caseId: 'known-soil' }); expect(s.druid.practice.marker).toBe('BOX'); expect(druidInside(s)).toBe(false);
    expect(validateDruidState(s)).toBe(true); reject(s, { type: 'CLOSE', caseId: 'known-soil' });
  });

  it('allows a 3-spirit outbound without requiring 6, with no free ability return or resource refill', () => {
    const s = promoted(); begin(s, 'known-soil', 'ABILITY'); s.spirituality = 3;
    act(s, { type: 'PERFORM', caseId: 'known-soil' }); expect(s.spirituality).toBe(0);
    reject(s, { type: 'RETURN', caseId: 'known-soil', method: 'ABILITY' });
    act(s, { type: 'RETURN', caseId: 'known-soil', method: 'ORDINARY' }); act(s, { type: 'CLOSE', caseId: 'known-soil' });
    expect(s.spirituality).toBe(0); expect(s.druid.practice).toMatchObject({ position: 'NEAR', marker: 'BOX', returnAttempted: false });
    expect(validateDruidState(s)).toBe(true);
  });

  it('charges a failed ability outbound without relocating the body or allowing phantom RETURN', () => {
    const s = promoted(); begin(s, 'known-soil', 'ABILITY'); s.actionsRemaining = 1; s.spirituality = 3;
    act(s, { type: 'PERFORM', caseId: 'known-soil' }, 100);
    expect([s.actionsRemaining, s.spirituality]).toEqual([0, 0]);
    expect(s.druid.practice).toMatchObject({ position: 'NEAR', marker: 'NEAR', soil: 'SETTLED', returnAttempted: false });
    expect(s.druid.cases['known-soil']).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', contactOpen: true });
    reject(s, { type: 'RETURN', caseId: 'known-soil', method: 'ORDINARY' });
    act(s, { type: 'CLOSE', caseId: 'known-soil' }); expect(validateDruidState(s)).toBe(true);
    s.actionsRemaining = 20; reject(s, { type: 'PREPARE', caseId: 'known-soil', method: 'ORDINARY' }); nextWeek(s);
    begin(s, 'known-soil'); act(s, { type: 'PERFORM', caseId: 'known-soil' });
    act(s, { type: 'RETURN', caseId: 'known-soil', method: 'ORDINARY' }); act(s, { type: 'CLOSE', caseId: 'known-soil' });
    const report = act(s, { type: 'REPORT', caseId: 'known-soil' }); expect(report.award).not.toHaveBeenCalled();
    expect(s.progression.mastery[DRUID_ABILITY_IDS[0]]).toBe(0); expect(validateDruidState(s)).toBe(true);
  });

  it('keeps an actual ordinary arrival even when the subsequent knowledge check fails', () => {
    const s = promoted(); begin(s, 'known-soil'); const spirit = s.spirituality;
    const failed = act(s, { type: 'PERFORM', caseId: 'known-soil' }, 100);
    expect(failed.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect(s.spirituality).toBe(spirit);
    expect(s.druid.practice).toMatchObject({ position: 'FAR', marker: 'FAR' }); expect(s.druid.cases['known-soil']!.outcome).toBe('NONE');
    expect(druidCases(s)[0]!.result).toContain('本人及同一原标记仍在FAR'); expect(validateDruidState(s)).toBe(true);
    reject(s, { type: 'CLOSE', caseId: 'known-soil' }); act(s, { type: 'RETURN', caseId: 'known-soil', method: 'ORDINARY' });
    act(s, { type: 'CLOSE', caseId: 'known-soil' }); reject(s, { type: 'REPORT', caseId: 'known-soil' }); expect(validateDruidState(s)).toBe(true);
  });

  it('awards no outbound ability mastery when an ordinary successful outbound uses a paid ability return', () => {
    const s = promoted(); begin(s, 'known-soil'); const spirit = s.spirituality;
    act(s, { type: 'PERFORM', caseId: 'known-soil' }); act(s, { type: 'RETURN', caseId: 'known-soil', method: 'ABILITY' });
    act(s, { type: 'CLOSE', caseId: 'known-soil' }); const report = act(s, { type: 'REPORT', caseId: 'known-soil' });
    expect(s.spirituality).toBe(spirit - 3); expect(report.award).not.toHaveBeenCalled(); expect(s.progression.mastery[DRUID_ABILITY_IDS[0]]).toBe(0);
    expect(validateDruidState(s)).toBe(true);
  });

  it('makes a last-AP preparation cancelable without magic, movement, or returning preparation cost', () => {
    const s = promoted(); act(s, { type: 'OBSERVE', caseId: 'known-soil' }); s.actionsRemaining = 1;
    const spirit = s.spirituality; act(s, { type: 'PREPARE', caseId: 'known-soil', method: 'ABILITY' });
    expect(s.druid.practice).toMatchObject({ position: 'NEAR', marker: 'NEAR' }); expect(druidInside(s)).toBe(false);
    expect(validateDruidState(s)).toBe(true); expect(s.actionsRemaining).toBe(0);
    act(s, { type: 'WITHDRAW', caseId: 'known-soil' });
    expect(s.druid.practice).toEqual(freshDruidPractice()); expect([s.actionsRemaining, s.spirituality]).toEqual([0, spirit]);
    expect(s.druid.cases['known-soil']).toMatchObject({ status: 'OBSERVED', method: null, withdrawals: 1 }); expect(validateDruidState(s)).toBe(true);
  });

  it('only ordinarily observes the same original seedlings and preserves existing water, crops, and records', () => {
    const s = promoted(); complete(s, 'known-soil'); act(s, { type: 'OBSERVE', caseId: 'paired-growth' });
    reject(s, { type: 'PREPARE', caseId: 'paired-growth', method: 'ABILITY' }); const old = originals(s), spirit = s.spirituality;
    begin(s, 'paired-growth'); const failed = act(s, { type: 'PERFORM', caseId: 'paired-growth' }, 100);
    expect(failed.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect(s.druid.practice.seedlings).toBe('OBSERVED');
    expect(s.druid.cases['paired-growth']!.outcome).toBe('NONE'); expect(s.spirituality).toBe(spirit); expect(originals(s)).toEqual(old);
    act(s, { type: 'CLOSE', caseId: 'paired-growth' }); expect(s.druid.practice.seedlings).toBe('RESTING'); expect(validateDruidState(s)).toBe(true);
    nextWeek(s); complete(s, 'paired-growth'); expect(s.druid.cases['paired-growth']!.outcome).toBe('GROWTH_CHECKED');
    expect(originals(s)).toEqual(old); expect(s.progression.mastery[DRUID_ABILITY_IDS[0]]).toBe(0); expect(validateDruidState(s)).toBe(true);
  });

  it('writes and hands over the same original note even on failure, then later supplements that same paper', () => {
    const s = promoted(); complete(s, 'known-soil'); complete(s, 'paired-growth'); act(s, { type: 'OBSERVE', caseId: 'honest-record' });
    reject(s, { type: 'PREPARE', caseId: 'honest-record', method: 'ABILITY' }); begin(s, 'honest-record');
    const failed = act(s, { type: 'PERFORM', caseId: 'honest-record' }, 100);
    expect(s.druid.practice.note).toBe('WRITTEN'); expect(messages(failed)).toContain('原字迹保留');
    expect(validateDruidState(s)).toBe(true); act(s, { type: 'CLOSE', caseId: 'honest-record' });
    expect(s.druid.practice.note).toBe('HANDED_OVER'); reject(s, { type: 'REPORT', caseId: 'honest-record' });
    nextWeek(s); begin(s, 'honest-record'); const supplemented = act(s, { type: 'PERFORM', caseId: 'honest-record' });
    expect(messages(supplemented)).toContain('保留上次原字迹并补记'); expect(s.druid.practice.note).toBe('WRITTEN');
    act(s, { type: 'CLOSE', caseId: 'honest-record' }); const report = act(s, { type: 'REPORT', caseId: 'honest-record' });
    expect(report.award).not.toHaveBeenCalled(); expect(s.druid.practice.note).toBe('HANDED_OVER'); expect(validateDruidState(s)).toBe(true);
  });

  it('completes all-ordinary peaceful acting100 without invented Druid or inherited mastery, items, or water', () => {
    const s = promoted(), old = originals(s), mastery = structuredClone(s.progression.mastery), spirit = s.spirituality;
    reject(s, { type: 'OBSERVE', caseId: 'paired-growth' }); reject(s, { type: 'REFLECT' });
    for (const caseId of DRUID_CASE_IDS) expect(complete(s, caseId).award).not.toHaveBeenCalled();
    const reflection = act(s, { type: 'REFLECT' }); expect(reflection.award).not.toHaveBeenCalled();
    expect(s.progression.acting).toBe(100); expect(s.progression.mastery).toEqual(mastery); expect(s.spirituality).toBe(spirit); expect(originals(s)).toEqual(old);
    expect(s.druid.practice).toEqual({ ...freshDruidPractice(), note: 'HANDED_OVER' }); expect(validateDruidState(s)).toBe(true);
    expect(s.seer.completedSources.filter(source => source.startsWith('druid-case:'))).toHaveLength(3); reject(s, { type: 'REFLECT' });
  });

  it('projects the complete 6-spirit estimate and exposes only actual ordinary later-case methods', () => {
    const s = promoted(); act(s, { type: 'OBSERVE', caseId: 'known-soil' });
    expect(druidActions(s).find(a => a.id === 'known-soil-ability')?.cost).toContain('往返预计6灵性');
    begin(s, 'known-soil', 'ABILITY'); expect(druidActions(s).find(a => a.id === 'known-soil-perform')?.cost).toContain('往返预计6灵性');
    expect(DRUID_ENVIRONMENT).toContain('独立知识14'); expect(DRUID_ENVIRONMENT).toContain('不催生、不复制');
    act(s, { type: 'PERFORM', caseId: 'known-soil' }); act(s, { type: 'RETURN', caseId: 'known-soil', method: 'ORDINARY' });
    act(s, { type: 'CLOSE', caseId: 'known-soil' }); act(s, { type: 'REPORT', caseId: 'known-soil' });
    act(s, { type: 'OBSERVE', caseId: 'paired-growth' });
    expect(druidActions(s).filter(a => a.command.type === 'PREPARE' && a.command.caseId === 'paired-growth').map(a => a.command)).toEqual([{ type: 'PREPARE', caseId: 'paired-growth', method: 'ORDINARY' }]);
  });

  it('rejects forged position, original-object, chronology, and outcome combinations', () => {
    const s = promoted(); begin(s, 'known-soil', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'known-soil' });
    for (const mutate of [
      (v: SliceState) => { v.druid.practice.marker = 'BOX'; },
      (v: SliceState) => { v.druid.practice.soil = 'SOFTENED'; },
      (v: SliceState) => { v.druid.cases['known-soil']!.contactOpen = false; },
      (v: SliceState) => { v.druid.cases['known-soil']!.status = 'OBSERVED'; v.druid.cases['known-soil']!.outcome = 'NONE'; },
      (v: SliceState) => { v.druid.practice.seedlings = 'OBSERVED'; },
      (v: SliceState) => { v.druid.practice.note = 'WRITTEN'; },
      (v: SliceState) => { nextWeek(v); },
    ]) { const forged = structuredClone(s); mutate(forged); expect(validateDruidLife(forged)).toBe(false); }
    const fresh = promoted(); fresh.druid.practice.returnAttempted = true; expect(validateDruidLife(fresh)).toBe(false);
  });

  it('rejects malformed returns, wrong original cases and unexpected fields before any mutation or roll', () => {
    const s = promoted(); begin(s, 'known-soil'); act(s, { type: 'PERFORM', caseId: 'known-soil' });
    for (const command of [
      { type: 'RETURN', caseId: 'known-soil' }, { type: 'RETURN', caseId: 'known-soil', method: 'FREE' },
      { type: 'RETURN', caseId: 'paired-growth', method: 'ORDINARY' },
      { type: 'RETURN', caseId: 'known-soil', method: 'ORDINARY', freeAbility: true },
      { type: 'CLOSE', caseId: 'known-soil', returnMethod: 'ABILITY' },
    ]) { expect(validateDruidCommand(command)).toBe(false); reject(s, command); }
    expect(isDruidActivity({ type: 'RETURN', caseId: 'known-soil', method: 'ORDINARY' })).toBe(true);
    expect(isDruidActivity({ type: 'STUDY', sourceId: 'ordinary-animals' })).toBe(false);
  });

  it('holds the last-AP public week through the actual return, and advances only after separate CLOSE', () => {
    const s = promoted(); begin(s, 'known-soil'); s.actionsRemaining = 1; s.weeklyBudget = 3; s.debts = [];
    const week = s.week, moved = applySliceIntent(s, { type: 'DRUID', command: { type: 'PERFORM', caseId: 'known-soil' } });
    expect([moved.week, moved.actionsRemaining]).toEqual([week, 0]); expect(moved.druid.practice).toMatchObject({ position: 'FAR', marker: 'FAR' });
    expect(() => applySliceIntent(moved, { type: 'ACTION', action: 'REST' })).toThrow();
    expect(() => applySliceIntent(moved, { type: 'DRUID', command: { type: 'CLOSE', caseId: 'known-soil' } })).toThrow();
    const returned = applySliceIntent(moved, { type: 'DRUID', command: { type: 'RETURN', caseId: 'known-soil', method: 'ORDINARY' } });
    expect([returned.week, returned.actionsRemaining]).toEqual([week, 0]); expect(returned.druid.practice).toMatchObject({ position: 'NEAR', marker: 'NEAR' });
    expect(returned.druid.cases['known-soil']!.contactOpen).toBe(true);
    const closed = applySliceIntent(returned, { type: 'DRUID', command: { type: 'CLOSE', caseId: 'known-soil' } });
    expect(closed.week).toBe(week + 1); expect(closed.druid.practice).toMatchObject({ position: 'NEAR', marker: 'BOX' }); expect(druidInside(closed)).toBe(false);
  });
});
