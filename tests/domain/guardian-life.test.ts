import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { applyGuardianCommand, createGuardianState, validateGuardianState } from '../../src/domain/guardian/index.js';
import { applyGuardianActivity, isGuardianActivity, guardianActions, guardianCases, guardianInside, guardianPractice, GUARDIAN_ENVIRONMENT, validateGuardianLife } from '../../src/domain/guardian/life.js';
import { GUARDIAN_ABILITY_IDS, GUARDIAN_CASE_IDS, type GuardianActivityCommand, type GuardianCaseId, type GuardianCommand } from '../../src/domain/guardian/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source); s.progression.mastery[GUARDIAN_ABILITY_IDS[0]]! += amount;
  });
  return { ctx, award };
}
function dawnPaladin(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/dawn-paladin-v0850/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous); s.guardian = createGuardianState();
  const week = Math.max(s.week, s.dawnPaladin.promotionWeek! + 12);
  s.date = addGameWeeks(s.date, week - s.week); s.week = week;
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.spirituality = 50; s.seer.pollution = 0; s.character.coreStats.will = 26;
  return s;
}
function promoted(): SliceState {
  const s = dawnPaladin(), c = context(s).ctx;
  applyGuardianCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyGuardianCommand(s, { type: 'BUY_POTION', bottleId: s.guardian.bottles[0]!.id }, c);
  applyGuardianCommand(s, { type: 'CONSUME', bottleId: s.guardian.bottles[0]!.id, confirmed: true }, c);
  return s;
}
function nextWeek(s: SliceState) { s.week += 1; s.date = addGameWeeks(s.date, 1); }
function act(s: SliceState, command: GuardianActivityCommand, roll = 1) { const c = context(s, roll); applyGuardianActivity(s, command, c.ctx, c.award); return c; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyGuardianActivity(s, command as GuardianActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: GuardianCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  if (s.guardian.cases[caseId]!.status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: GuardianCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); act(s, { type: 'PERFORM', caseId }); act(s, { type: 'CLOSE', caseId });
  return act(s, { type: 'REPORT', caseId });
}
const messages = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(call => call.join(' ')).join(' ');
const originals = (s: SliceState) => structuredClone([s.warrior, s.gladiator, s.weaponmaster, s.dawnPaladin, s.world, s.town, s.combatHistory]);
const initialPractice = { guardActive: false, playerAttacked: false, probes: 0, playerDamageTaken: 0, allyPresent: false, allyDistance: null, allyHealth: 100, allyDamageTaken: 0, sharedDamage: 0, target: 'INTACT' };

describe('Guardian finite original probes and real nearby sharing', () => {
  it('starts without a posture, attack, summoned ally, injury or copied target', () => {
    const old = dawnPaladin();
    expect(guardianActions(old)).toEqual([]); expect(guardianCases(old)).toEqual([]); expect(guardianPractice(old)).toBeNull(); expect(validateGuardianLife(old)).toBe(true);
    const s = promoted(); expect(s.guardian.practice).toEqual(initialPractice);
    expect(guardianCases(s).map(p => p.id)).toEqual([...GUARDIAN_CASE_IDS]);
    expect(guardianCases(s).every(p => p.observations.length === 0)).toBe(true);
    expect(guardianInside(s)).toBe(false); expect(validateGuardianState(s)).toBe(true);
    expect(GUARDIAN_ENVIRONMENT).toContain('原创G'); expect(GUARDIAN_ENVIRONMENT).toContain('3米');
    expect(guardianCases(s)[2]!.story).toContain('成年院工维拉'); expect(guardianCases(s)[0]!.story).toContain('奥斯温·布莱克特');
  });

  it('rejects malformed shapes, fake allies, remote transfer and healing commands before costs', () => {
    for (const type of ['REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'] as const) expect(isGuardianActivity({ type })).toBe(true);
    expect(isGuardianActivity({ type: 'LEARN_GUIDANCE' })).toBe(false); expect(isGuardianActivity(null as unknown as GuardianCommand)).toBe(false);
    for (const command of [null, {}, { type: 'OBSERVE', caseId: 'invented' }, { type: 'PREPARE', caseId: 'guarded-load', method: 'IMMUNE' }, { type: 'PERFORM', caseId: 'nearby-companion', ally: 'enemy' }, { type: 'PERFORM', caseId: 'nearby-companion', distance: 40 }, { type: 'CLOSE', caseId: 'nearby-companion', heal: true }, { type: 'WITHDRAW', caseId: 'guarded-load', refund: true }, { type: 'REFLECT', extra: true }, { type: 'SUMMON_ALLY' }]) reject(promoted(), command);
  });

  it('observation and last-resource preparation neither enter guard nor move Vera to the marker', () => {
    const s = promoted(), old = originals(s), spirit = s.spirituality;
    for (const caseId of GUARDIAN_CASE_IDS) act(s, { type: 'OBSERVE', caseId });
    begin(s, 'nearby-companion', 'ABILITY'); expect(s.guardian.practice).toEqual(initialPractice); expect(guardianInside(s)).toBe(false);
    expect(s.spirituality).toBe(spirit); expect(originals(s)).toEqual(old); expect(validateGuardianLife(s)).toBe(true);
    reject(s, { type: 'PREPARE', caseId: 'guarded-load', method: 'ABILITY' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    const c = act(s, { type: 'WITHDRAW', caseId: 'nearby-companion' });
    expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled(); expect(s.guardian.practice).toEqual(initialPractice);
    expect(s.guardian.cases['nearby-companion']).toMatchObject({ status: 'OBSERVED', method: null, withdrawals: 1 });
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]); expect(validateGuardianLife(s)).toBe(true);
  });

  it.each([1, 50])('guarding success roll %s accepts exactly one reduced probe and forgoes attack', roll => {
    const s = promoted(); begin(s, 'guarded-load', 'ABILITY'); const health = s.health, spirit = s.spirituality, ap = s.actionsRemaining, old = originals(s);
    const c = act(s, { type: 'PERFORM', caseId: 'guarded-load' }, roll);
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('will', 14); expect([s.health, s.spirituality, s.actionsRemaining]).toEqual([health - 1, spirit - 3, ap - 1]);
    expect(s.guardian.practice).toEqual({ ...initialPractice, guardActive: true, probes: 1, playerDamageTaken: 1 });
    expect(s.guardian.cases['guarded-load']).toMatchObject({ status: 'EXAMINED', outcome: 'GUARD_TESTED', contactOpen: true });
    expect(guardianInside(s)).toBe(true); expect(validateGuardianLife(s)).toBe(true); expect(originals(s)).toEqual(old); expect(c.award).not.toHaveBeenCalled();
    for (const command of [{ type: 'PERFORM', caseId: 'guarded-load' }, { type: 'REPORT', caseId: 'guarded-load' }, { type: 'OBSERVE', caseId: 'lowered-guard' }, { type: 'WITHDRAW', caseId: 'guarded-load' }, { type: 'ENCOUNTER_FIGHT' }]) reject(s, command);
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    const close = act(s, { type: 'CLOSE', caseId: 'guarded-load' });
    expect(s.health).toBe(health - 1); expect(s.guardian.practice).toEqual({ ...initialPractice, probes: 1, playerDamageTaken: 1 });
    expect(close.ctx.check).not.toHaveBeenCalled(); expect(close.award).not.toHaveBeenCalled(); expect(guardianInside(s)).toBe(false); expect(validateGuardianLife(s)).toBe(true);
    reject(s, { type: 'CLOSE', caseId: 'guarded-load' });
  });

  it('failed guard causes two actual damage, keeps paid costs and allows only next-week original retry', () => {
    const s = promoted(); begin(s, 'guarded-load', 'ABILITY'); const health = s.health, spirit = s.spirituality;
    act(s, { type: 'PERFORM', caseId: 'guarded-load' }, 100);
    expect([s.health, s.spirituality]).toEqual([health - 2, spirit - 3]);
    expect(s.guardian.practice).toMatchObject({ guardActive: true, probes: 1, playerDamageTaken: 2, playerAttacked: false });
    expect(s.guardian.cases['guarded-load']).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', contactOpen: true }); expect(validateGuardianLife(s)).toBe(true);
    act(s, { type: 'CLOSE', caseId: 'guarded-load' }); reject(s, { type: 'PREPARE', caseId: 'guarded-load', method: 'ABILITY' });
    nextWeek(s); complete(s, 'guarded-load', 'ABILITY');
    expect(s.guardian.practice).toEqual({ ...initialPractice, probes: 2, playerDamageTaken: 3 }); expect(s.health).toBe(health - 3); expect(validateGuardianLife(s)).toBe(true);
  });

  it.each([1, 100])('an actual attack roll %s lowers protection, marks the original target and costs three health', roll => {
    const s = promoted(); begin(s, 'lowered-guard', 'ABILITY'); const health = s.health, spirit = s.spirituality, old = originals(s);
    act(s, { type: 'PERFORM', caseId: 'lowered-guard' }, roll);
    expect([s.health, s.spirituality]).toEqual([health - 3, spirit - 3]);
    expect(s.guardian.practice).toEqual({ ...initialPractice, playerAttacked: true, probes: 1, playerDamageTaken: 3, target: 'MARKED' });
    expect(s.guardian.cases['lowered-guard']).toMatchObject({ status: roll === 1 ? 'EXAMINED' : 'OBSERVED', outcome: roll === 1 ? 'ATTACK_TESTED' : 'NONE', contactOpen: true });
    expect(originals(s)).toEqual(old); expect(s.guardian.encounter.swordReady).toBe(false); expect(validateGuardianLife(s)).toBe(true);
    act(s, { type: 'CLOSE', caseId: 'lowered-guard' }); expect(s.guardian.practice.target).toBe('MARKED'); expect(s.health).toBe(health - 3);
    if (roll === 100) { nextWeek(s); complete(s, 'lowered-guard', 'ABILITY'); expect(s.guardian.practice.probes).toBe(2); expect(s.health).toBe(health - 6); }
    expect(validateGuardianLife(s)).toBe(true);
  });

  it('nearby success moves the consenting original ally two metres and divides only one six-point probe', () => {
    const s = promoted(); begin(s, 'nearby-companion', 'ABILITY'); const health = s.health, spirit = s.spirituality, old = originals(s);
    const c = act(s, { type: 'PERFORM', caseId: 'nearby-companion' });
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('will', 14); expect([s.health, s.spirituality]).toEqual([health - 3, spirit - 3]);
    expect(s.guardian.practice).toEqual({ ...initialPractice, guardActive: true, probes: 1, playerDamageTaken: 3, allyPresent: true, allyDistance: 2, allyHealth: 97, allyDamageTaken: 3, sharedDamage: 3 });
    expect(messages(c)).toContain('本人沿原两米路径实际走到'); expect(messages(c)).toContain('只发生一次'); expect(validateGuardianLife(s)).toBe(true);
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    const close = act(s, { type: 'CLOSE', caseId: 'nearby-companion' });
    expect(messages(close)).toContain('两米原路径实际走回'); expect([s.health, s.guardian.practice.allyHealth]).toEqual([health - 3, 97]);
    expect(s.guardian.practice).toEqual({ ...initialPractice, probes: 1, playerDamageTaken: 3, allyHealth: 97, allyDamageTaken: 3, sharedDamage: 3 });
    expect(guardianInside(s)).toBe(false); expect(originals(s)).toEqual(old); expect(validateGuardianLife(s)).toBe(true);
    nextWeek(s); expect(s.guardian.practice.allyHealth).toBe(97); expect(validateGuardianLife(s)).toBe(true);
  });

  it('failed sharing retains ally injury through closure, cancelled retry and later ordinary withdrawal', () => {
    const s = promoted(); begin(s, 'nearby-companion', 'ABILITY'); const health = s.health;
    act(s, { type: 'PERFORM', caseId: 'nearby-companion' }, 100);
    expect(s.health).toBe(health); expect(s.guardian.practice).toEqual({ ...initialPractice, guardActive: true, probes: 1, allyPresent: true, allyDistance: 2, allyHealth: 94, allyDamageTaken: 6 });
    act(s, { type: 'CLOSE', caseId: 'nearby-companion' }); nextWeek(s); begin(s, 'nearby-companion', 'ABILITY'); act(s, { type: 'WITHDRAW', caseId: 'nearby-companion' });
    expect(validateGuardianLife(s)).toBe(true); expect(s.guardian.practice.allyHealth).toBe(94);
    complete(s, 'nearby-companion');
    expect(s.guardian.practice).toEqual({ ...initialPractice, probes: 1, allyHealth: 94, allyDamageTaken: 6 });
    expect(s.guardian.cases['nearby-companion']!.outcome).toBe('BOTH_WITHDRAWN'); expect(validateGuardianLife(s)).toBe(true);
  });

  it('success after a failed share retains nine ally injury and exactly three transferred injury', () => {
    const s = promoted(); begin(s, 'nearby-companion', 'ABILITY'); const health = s.health;
    act(s, { type: 'PERFORM', caseId: 'nearby-companion' }, 100); act(s, { type: 'CLOSE', caseId: 'nearby-companion' }); nextWeek(s);
    complete(s, 'nearby-companion', 'ABILITY');
    expect(s.guardian.practice).toEqual({ ...initialPractice, probes: 2, playerDamageTaken: 3, allyHealth: 91, allyDamageTaken: 9, sharedDamage: 3 });
    expect(s.health).toBe(health - 3); expect(validateGuardianLife(s)).toBe(true);
  });

  it('finite ally health stops further probes without trapping preparation or ordinary withdrawal', () => {
    const s = promoted();
    for (let i = 0; i < 15; i += 1) {
      begin(s, 'nearby-companion', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'nearby-companion' }, 100); act(s, { type: 'CLOSE', caseId: 'nearby-companion' }); nextWeek(s);
    }
    expect(s.guardian.practice.allyHealth).toBe(10); expect(s.guardian.practice.allyDamageTaken).toBe(90); expect(validateGuardianLife(s)).toBe(true);
    begin(s, 'nearby-companion', 'ABILITY'); reject(s, { type: 'PERFORM', caseId: 'nearby-companion' });
    act(s, { type: 'WITHDRAW', caseId: 'nearby-companion' }); complete(s, 'nearby-companion');
    expect(s.guardian.practice.allyHealth).toBe(10); expect(s.guardian.practice.probes).toBe(15); expect(validateGuardianLife(s)).toBe(true);
  });

  it.each(GUARDIAN_CASE_IDS)('%s discloses resource gates and keeps zero-cost cancellation available', caseId => {
    const s = promoted(); begin(s, caseId, 'ABILITY'); s.spirituality = 2; reject(s, { type: 'PERFORM', caseId });
    s.spirituality = 3; s.health = 10; reject(s, { type: 'PERFORM', caseId });
    s.actionsRemaining = 0; s.mind = 0; act(s, { type: 'WITHDRAW', caseId }); expect(guardianInside(s)).toBe(false);
  });

  it('three ordinary original removals and reflection reach peaceful100 with no checks, injury or mastery', () => {
    const s = promoted(), mastery = structuredClone(s.progression.mastery), old = originals(s), health = s.health; s.spirituality = 0;
    for (const caseId of GUARDIAN_CASE_IDS) {
      begin(s, caseId); const perform = act(s, { type: 'PERFORM', caseId }, 100);
      expect(perform.ctx.check).not.toHaveBeenCalled(); expect(perform.award).not.toHaveBeenCalled();
      act(s, { type: 'CLOSE', caseId }); expect(act(s, { type: 'REPORT', caseId }).award).not.toHaveBeenCalled();
    }
    expect(s.progression.acting).toBe(75); act(s, { type: 'REFLECT' }); expect(s.progression.acting).toBe(100);
    expect([s.health, s.spirituality]).toEqual([health, 0]); expect(s.guardian.practice).toEqual({ ...initialPractice, target: 'DISMANTLED' });
    expect(s.progression.mastery).toEqual(mastery); expect(originals(s)).toEqual(old); expect(validateGuardianState(s)).toBe(true);
    expect(s.seer.completedSources.filter(x => x.startsWith('guardian-'))).toEqual([...GUARDIAN_CASE_IDS.map(id => `guardian-case:${id}`), 'guardian-reflection']);
    for (const caseId of GUARDIAN_CASE_IDS) { reject(s, { type: 'PREPARE', caseId, method: 'ABILITY' }); reject(s, { type: 'REPORT', caseId }); }
    reject(s, { type: 'REFLECT' });
  });

  it('three successful ability reports reward the existing pool once and preserve all actual injuries', () => {
    const s = promoted(), health = s.health, old = originals(s);
    for (const caseId of GUARDIAN_CASE_IDS) { expect(complete(s, caseId, 'ABILITY').award).toHaveBeenCalledExactlyOnceWith(`guardian-case:${caseId}`, 8); reject(s, { type: 'REPORT', caseId }); }
    act(s, { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(s.progression.mastery[GUARDIAN_ABILITY_IDS[0]]).toBe(24);
    expect(s.health).toBe(health - 7); expect(s.guardian.practice).toEqual({ ...initialPractice, playerAttacked: true, probes: 3, playerDamageTaken: 7, allyHealth: 97, allyDamageTaken: 3, sharedDamage: 3, target: 'MARKED' });
    expect(originals(s)).toEqual(old); expect(validateGuardianState(s)).toBe(true);
  });

  it('failed target strike may be dismantled next week without new paper, healing or lost history', () => {
    const s = promoted(); begin(s, 'lowered-guard', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'lowered-guard' }, 100); act(s, { type: 'CLOSE', caseId: 'lowered-guard' });
    nextWeek(s); complete(s, 'lowered-guard');
    expect(s.guardian.practice).toEqual({ ...initialPractice, playerAttacked: true, probes: 1, playerDamageTaken: 3, target: 'DISMANTLED' }); expect(validateGuardianLife(s)).toBe(true);
  });

  it('public last-AP preparation advances a real week without activating guard or bringing Vera in', () => {
    const s = promoted(); act(s, { type: 'OBSERVE', caseId: 'nearby-companion' }); s.actionsRemaining = 1; s.weeklyBudget = 3; s.debts = [];
    const week = s.week, next = applySliceIntent(s, { type: 'GUARDIAN', command: { type: 'PREPARE', caseId: 'nearby-companion', method: 'ABILITY' } });
    expect(next.week).toBe(week + 1); expect(next.guardian.cases['nearby-companion']!.status).toBe('PREPARED');
    expect(next.guardian.practice).toEqual(initialPractice); expect(guardianInside(next)).toBe(false);
  });

  it.each(GUARDIAN_CASE_IDS)('public last-AP %s real contact waits for zero-AP physical closure', caseId => {
    const s = promoted(); begin(s, caseId, 'ABILITY'); s.actionsRemaining = 1; s.weeklyBudget = 3; s.debts = [];
    const week = s.week, performed = applySliceIntent(s, { type: 'GUARDIAN', command: { type: 'PERFORM', caseId } });
    expect([performed.week, performed.actionsRemaining]).toEqual([week, 0]); expect(guardianInside(performed)).toBe(true);
    expect(() => applySliceIntent(performed, { type: 'ACTION', action: 'REST' })).toThrow();
    const history = structuredClone(performed.guardian.practice), closed = applySliceIntent(performed, { type: 'GUARDIAN', command: { type: 'CLOSE', caseId } });
    expect(closed.week).toBe(week + 1); expect(guardianInside(closed)).toBe(false);
    expect(closed.guardian.practice).toEqual({ ...history, guardActive: false, allyPresent: false, allyDistance: null });
  });

  it('projection exposes actual injury, same original target, arrival and return without mutable references', () => {
    const s = promoted(); begin(s, 'nearby-companion', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'nearby-companion' });
    const cases = guardianCases(s), practice = guardianPractice(s)!;
    expect(practice.guard).toContain('累计受伤3'); expect(practice.companion).toContain('2米'); expect(practice.companion).toContain('健康97/100'); expect(practice.companion).toContain('分担3');
    expect(new Set(cases.map(c => c.story)).size).toBe(3); expect(cases[2]!.result).toContain('只发生一次');
    practice.history.push('invented'); cases[0]!.observations.push('invented'); practice.target = 'copied';
    expect(guardianPractice(s)!.history).not.toContain('invented'); expect(guardianCases(s)[0]!.observations).not.toContain('invented'); expect(s.guardian.practice.target).toBe('INTACT');
    expect(guardianActions(s).find(a => a.command.type === 'CLOSE')!.enabled).toBe(true); expect(guardianActions(s).find(a => a.command.type === 'REPORT')!.enabled).toBe(false);
    act(s, { type: 'CLOSE', caseId: 'nearby-companion' }); expect(guardianPractice(s)!.companion).toContain('不在承压标线'); expect(guardianPractice(s)!.companion).toContain('健康97/100');
  });

  it('rejects forged phantom presence, multiplied damage, healing, copied target and duplicate rewards', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { Object.assign(s.guardian.practice, { summonedAlly: true }); }, s => { s.guardian.practice.guardActive = true; },
      s => { s.guardian.practice.allyPresent = true; }, s => { s.guardian.practice.allyDistance = 40; },
      s => { s.guardian.practice.allyHealth = 99; }, s => { s.guardian.practice.sharedDamage = 3; },
      s => { s.guardian.practice.playerAttacked = true; }, s => { s.guardian.practice.target = 'MARKED'; },
      s => { s.guardian.practice.probes = 1; }, s => { s.guardian.practice.playerDamageTaken = 1; },
      s => { Object.assign(s.guardian, { practice: null }); }, s => { Object.assign(s.guardian.cases, { 'guarded-load': null }); },
      s => { s.seer.completedSources.push('guardian-case:guarded-load'); },
    ];
    for (const change of changes) { const s = promoted(); change(s); expect(validateGuardianLife(s)).toBe(false); }
    const shared = promoted(); complete(shared, 'nearby-companion', 'ABILITY');
    for (const change of [
      (s: SliceState) => { s.guardian.practice.allyHealth = 100; },
      (s: SliceState) => { s.guardian.practice.allyDamageTaken = 6; s.guardian.practice.allyHealth = 94; },
      (s: SliceState) => { s.guardian.practice.playerDamageTaken = 6; },
      (s: SliceState) => { s.guardian.practice.sharedDamage = 6; },
      (s: SliceState) => { s.seer.completedSources.push('guardian-case:nearby-companion'); },
    ]) { const s = structuredClone(shared); change(s); expect(validateGuardianLife(s)).toBe(false); }
  });
});
