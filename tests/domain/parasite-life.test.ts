import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyParasiteCommand, createParasiteState, validateParasiteState } from '../../src/domain/parasite/index.js';
import { applyParasiteActivity, createParasiteLifeState, hasParasiteLifeLock, parasiteActivityReason, parasiteLifeActions, projectParasiteLife, validateParasiteActivityCommand, validateParasiteLife, PARASITE_CASE_IDS, type ParasiteActivityCommand, type ParasiteCaseId } from '../../src/domain/parasite/life.js';
import type { ParasiteAbilityId } from '../../src/domain/parasite/types.js';

function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((abilityId: ParasiteAbilityId, amount = 8) => { s.progression.mastery[abilityId] = (s.progression.mastery[abilityId] ?? 0) + amount; });
  return { ctx, award };
}
function oldS5(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/dream-stealer-v01060/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous); s.parasite = createParasiteState();
  const week = Math.max(s.week, s.dreamStealer.promotionWeek! + 12);
  s.date = addGameWeeks(s.date, week - s.week); s.week = week;
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.spirituality = 100; s.seer.pollution = 0; s.character.coreStats.will = 28; s.character.coreStats.knowledge = 24;
  return s;
}
function promoted() {
  const s = oldS5(), c = context(s).ctx;
  applyParasiteCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyParasiteCommand(s, { type: 'BUY_POTION', bottleId: 'parasite-potion-1' }, c);
  applyParasiteCommand(s, { type: 'CONSUME', bottleId: 'parasite-potion-1', confirmed: true }, c);
  return s;
}
function act(s: SliceState, c: ParasiteActivityCommand, roll = 1) {
  const ctx = context(s, roll); applyParasiteActivity(s, c, ctx.ctx, ctx.award);
  expect(validateParasiteLife(s), `invalid life after ${JSON.stringify(c)}`).toBe(true);
  return ctx;
}
function reject(s: SliceState, c: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyParasiteActivity(s, c as ParasiteActivityCommand, ctx.ctx, ctx.award)).toThrow();
  expect(s).toEqual(before); expect(ctx.ctx.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: ParasiteCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  if (s.parasite.life.cases[caseId].status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method });
}
function enter(s: SliceState, caseId: 'shared-senses' | 'limited-control') {
  begin(s, caseId); act(s, { type: 'CONSENT_BASIC', caseId, confirmed: true }); act(s, { type: 'PERFORM', caseId });
}
function fullConsent(s: SliceState) { act(s, { type: 'CONSENT_FULL', caseId: 'limited-control', task: 'MOVE_TOKEN_AND_RETURN', confirmed: true }); }
function ordinary(s: SliceState, caseId: ParasiteCaseId, roll = 1) {
  begin(s, caseId, 'ORDINARY'); act(s, { type: 'PERFORM', caseId }, roll);
  if (caseId === 'shared-senses') act(s, { type: 'RETURN_TO_START', caseId });
  if (caseId === 'limited-control') act(s, { type: 'RETURN_TOKEN', caseId });
  act(s, { type: 'CLOSE', caseId });
  return roll === 1 ? act(s, { type: 'REPORT', caseId }) : null;
}
const notes = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(args => args.join(' ')).join(' ');
const originals = (s: SliceState) => structuredClone([s.marauder, s.swindler, s.cryptologist, s.fireThief, s.dreamStealer, s.world, s.town, s.combatHistory]);
const nextWeek = (s: SliceState) => { s.week += 1; s.date = addGameWeeks(s.date, 1); };

describe('Parasite finite original people, independent consent and actual cleanup', () => {
  it('keeps pristine originals and hides life before promotion', () => {
    const old = oldS5(); expect(validateParasiteLife(old)).toBe(true);
    expect(parasiteLifeActions(old)).toEqual([]); expect(projectParasiteLife(old)).toEqual({ cases: [], insideCase: false, environment: '', practice: null });
    const s = promoted(); expect(s.parasite.life).toEqual(createParasiteLifeState()); expect(validateParasiteState(s)).toBe(true);
    expect(projectParasiteLife(s).cases.map(c => c.id)).toEqual([...PARASITE_CASE_IDS]);
    expect(projectParasiteLife(s).environment).toContain('原创G');
  });

  it.each([null, {}, { type: 'PERFORM', caseId: 'fake-host' }, { type: 'CONSENT_BASIC', caseId: 'shared-senses', confirmed: false }, { type: 'CONSENT_FULL', caseId: 'limited-control', confirmed: true }, { type: 'CONSENT_FULL', caseId: 'limited-control', confirmed: true, task: 'ANYTHING' }, { type: 'PERFORM', caseId: 'shared-senses', clone: true }, { type: 'EXIT_HOST', caseId: 'deferred-seat' }, { type: 'RELEASE_THOUGHT', caseId: 'deferred-seat', mode: 'TRANSFER' }, { type: 'REFLECT', reward: 100 }])('rejects malformed and unbounded commands before mutation: %j', command => {
    expect(validateParasiteActivityCommand(command)).toBe(false); reject(promoted(), command);
  });

  it('observation and paid preparation neither enter nor imply any consent, and withdrawal stays affordable', () => {
    const s = promoted(), before = originals(s), cash = s.cash;
    begin(s, 'limited-control');
    expect(s.cash).toBe(cash - 80); expect(s.parasite.life.paidKits).toBe(1);
    expect(s.parasite.life.cases['limited-control']).toMatchObject({ basicConsent: false, fullConsent: false, safetyReserved: true });
    expect(s.parasite.life.player.entries).toBe(0); expect(hasParasiteLifeLock(s)).toBe(false); reject(s, { type: 'PERFORM', caseId: 'limited-control' });
    fullConsent(s); expect(s.parasite.life.cases['limited-control'].basicConsent).toBe(false); reject(s, { type: 'PERFORM', caseId: 'limited-control' });
    s.actionsRemaining = 0; s.spirituality = 0; s.cash = 0; s.mind = 0;
    act(s, { type: 'WITHDRAW', caseId: 'limited-control' });
    expect(s.parasite.life.cases['limited-control']).toMatchObject({ basicConsent: false, fullConsent: false, safetyReserved: false });
    expect(s.parasite.life.paidKits).toBe(1); expect(originals(s)).toEqual(before);
  });

  it('cannot prepare a paid entry without the fee; ordinary method remains available with zero cash/spirit', () => {
    const s = promoted(); act(s, { type: 'OBSERVE', caseId: 'shared-senses' }); s.cash = 79;
    reject(s, { type: 'PREPARE', caseId: 'shared-senses', method: 'ABILITY' });
    s.cash = 0; s.spirituality = 0; ordinary(s, 'shared-senses'); expect(s.parasite.life.paidKits).toBe(0); expect(s.progression.acting).toBe(25);
  });

  it('shares one actual moving location without a spare player body or thought reading, then separates at that location', () => {
    const s = promoted(), old = originals(s); enter(s, 'shared-senses');
    expect(s.parasite.life.player).toMatchObject({ presence: 'INSIDE_HOST', location: 'DESK', entries: 1, exits: 0 });
    expect(s.parasite.life.host).toMatchObject({ mode: 'BASIC', control: 'HOST', awareness: 'AWARE' });
    expect(projectParasiteLife(s).practice!.mode).toContain('不读隐藏思想');
    act(s, { type: 'WALK_ROUTE', caseId: 'shared-senses' });
    expect(s.parasite.life.host.location).toBe('ROUTE_END'); expect(s.parasite.life.player.location).toBe('ROUTE_END');
    for (const c of [{ type: 'WALK_ROUTE', caseId: 'shared-senses' }, { type: 'CLOSE', caseId: 'shared-senses' }, { type: 'RETURN_TO_START', caseId: 'shared-senses' }, { type: 'PERFORM', caseId: 'deferred-seat' }]) reject(s, c);
    s.actionsRemaining = 0; s.spirituality = 0; s.cash = 0; s.mind = 0;
    const c = act(s, { type: 'EXIT_HOST', caseId: 'shared-senses' }); expect(notes(c)).toContain('四米终点');
    expect(s.parasite.life.player).toMatchObject({ presence: 'OUTSIDE', location: 'ROUTE_END', entries: 1, exits: 1 }); expect(hasParasiteLifeLock(s)).toBe(true);
    reject(s, { type: 'CLOSE', caseId: 'shared-senses' });
    act(s, { type: 'RETURN_TO_START', caseId: 'shared-senses' }); act(s, { type: 'CLOSE', caseId: 'shared-senses' });
    expect(s.parasite.life.host).toMatchObject({ location: 'DESK', walks: 2, exertion: 2 }); expect(hasParasiteLifeLock(s)).toBe(false); expect(originals(s)).toEqual(old);
    expect([s.actionsRemaining, s.spirituality, s.cash, s.mind]).toEqual([0, 0, 0, 0]);
  });

  it('keeps FULL separate and bounds it to one actual token lift and return', () => {
    const s = promoted(), old = originals(s); enter(s, 'limited-control');
    reject(s, { type: 'TAKE_TOKEN', caseId: 'limited-control' }); expect(s.parasite.life.host.tokenMoves).toBe(0);
    fullConsent(s); act(s, { type: 'TAKE_TOKEN', caseId: 'limited-control' });
    expect(s.parasite.life.host).toMatchObject({ token: 'HOST_HAND', mode: 'FULL', control: 'BOUNDED_TOKEN_TASK', tokenMoves: 1, exertion: 1 });
    reject(s, { type: 'TAKE_TOKEN', caseId: 'limited-control' }); reject(s, { type: 'EXIT_HOST', caseId: 'limited-control' }); reject(s, { type: 'CLOSE', caseId: 'limited-control' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    act(s, { type: 'RETURN_TOKEN', caseId: 'limited-control' });
    expect(s.parasite.life.host).toMatchObject({ token: 'DESK', mode: 'BASIC', control: 'HOST', tokenMoves: 2, exertion: 2 }); expect(s.parasite.life.cases['limited-control'].fullConsent).toBe(false);
    reject(s, { type: 'TAKE_TOKEN', caseId: 'limited-control' });
    act(s, { type: 'EXIT_HOST', caseId: 'limited-control' }); act(s, { type: 'CLOSE', caseId: 'limited-control' });
    s.actionsRemaining = 2; s.mind = 100; const report = act(s, { type: 'REPORT', caseId: 'limited-control' });
    expect(report.award).toHaveBeenCalledExactlyOnceWith('error.s4.parasitism', 8); expect(originals(s)).toEqual(old); expect(validateParasiteState(s)).toBe(true);
  });

  it('allows declining FULL before entry through the ordinary method without any fake power reward', () => {
    const s = promoted(); begin(s, 'limited-control'); act(s, { type: 'CONSENT_BASIC', caseId: 'limited-control', confirmed: true });
    act(s, { type: 'WITHDRAW', caseId: 'limited-control' }); const report = ordinary(s, 'limited-control')!;
    expect(report.award).not.toHaveBeenCalled(); expect(s.parasite.life.player.entries).toBe(0); expect(s.parasite.life.host.tokenMoves).toBe(2);
    expect(s.parasite.life.cases['limited-control'].fullConsent).toBe(false); expect(s.parasite.life.paidKits).toBe(1);
  });

  it('can decline FULL after actual entry by supervised exit, retaining the interrupted attempt until next real week', () => {
    const s = promoted(); enter(s, 'limited-control'); act(s, { type: 'EXIT_HOST', caseId: 'limited-control' });
    expect(s.parasite.life.cases['limited-control']).toMatchObject({ status: 'OBSERVED', lastOutcome: 'INTERRUPTED', checkedSuccess: true, taskComplete: false });
    act(s, { type: 'CLOSE', caseId: 'limited-control' }); reject(s, { type: 'REPORT', caseId: 'limited-control' }); reject(s, { type: 'PREPARE', caseId: 'limited-control', method: 'ORDINARY' });
    nextWeek(s); ordinary(s, 'limited-control'); expect(s.parasite.life.cases['limited-control'].attempts).toBe(2); expect(s.parasite.life.player.entries).toBe(1);
  });

  it('failed host entry spends actual resources and retains paid exit availability until closure', () => {
    const s = promoted(); begin(s, 'shared-senses'); act(s, { type: 'CONSENT_BASIC', caseId: 'shared-senses', confirmed: true });
    const ap = s.actionsRemaining, spirit = s.spirituality; const c = act(s, { type: 'PERFORM', caseId: 'shared-senses' }, 100);
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('will', 18); expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, spirit - 4]);
    expect(s.parasite.life.player.entries).toBe(0); expect(s.parasite.life.host.location).toBe('DESK'); expect(hasParasiteLifeLock(s)).toBe(true);
    s.actionsRemaining = 0; s.spirituality = 0; act(s, { type: 'CLOSE', caseId: 'shared-senses' });
    s.actionsRemaining = 100; reject(s, { type: 'PREPARE', caseId: 'shared-senses', method: 'ABILITY' });
    nextWeek(s); ordinary(s, 'shared-senses'); expect(s.parasite.life.cases['shared-senses'].closes).toBe(2); expect(s.parasite.life.paidKits).toBe(1);
  });

  it('stores an actual current intention without immediate own-body execution, and rejects remote chair execution', () => {
    const s = promoted(); begin(s, 'deferred-seat');
    expect(s.parasite.life.thought.pending).toBe('NONE'); const spirit = s.spirituality; act(s, { type: 'PERFORM', caseId: 'deferred-seat' });
    expect(s.spirituality).toBe(spirit - 4); expect(s.parasite.life.player.pose).toBe('STANDING');
    expect(s.parasite.life.thought).toMatchObject({ pending: 'SIT_ON_PR4_CHAIR_1', targetPaused: true, targetPose: 'STANDING', thefts: 1, executions: 0 });
    reject(s, { type: 'RELEASE_THOUGHT', caseId: 'deferred-seat', mode: 'EXECUTE' }); reject(s, { type: 'CLOSE', caseId: 'deferred-seat' });
    act(s, { type: 'STEP_TO_CHAIR', caseId: 'deferred-seat' });
    expect(s.parasite.life.player.pose).toBe('STANDING');
    act(s, { type: 'RELEASE_THOUGHT', caseId: 'deferred-seat', mode: 'EXECUTE' });
    expect(s.parasite.life.player).toMatchObject({ pose: 'SEATED', location: 'CHAIR_FRONT' }); expect(s.parasite.life.thought).toMatchObject({ pending: 'NONE', targetPaused: false, recoveries: 1, executions: 1 });
    reject(s, { type: 'RELEASE_THOUGHT', caseId: 'deferred-seat', mode: 'EXECUTE' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    act(s, { type: 'RETURN_TO_START', caseId: 'deferred-seat' }); act(s, { type: 'CLOSE', caseId: 'deferred-seat' });
    expect(s.parasite.life.player).toMatchObject({ pose: 'STANDING', location: 'DESK' }); expect(hasParasiteLifeLock(s)).toBe(false);
    s.actionsRemaining = 1; s.mind = 100; const report = act(s, { type: 'REPORT', caseId: 'deferred-seat' }); expect(report.award).toHaveBeenCalledExactlyOnceWith('error.s4.deferred-thought', 8);
  });

  it.each([false, true])('can discard without ever executing, including after ordinary chair approach=%s', approach => {
    const s = promoted(); begin(s, 'deferred-seat'); act(s, { type: 'PERFORM', caseId: 'deferred-seat' });
    if (approach) act(s, { type: 'STEP_TO_CHAIR', caseId: 'deferred-seat' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; const c = act(s, { type: 'RELEASE_THOUGHT', caseId: 'deferred-seat', mode: 'DISCARD' });
    expect(notes(c)).toContain('原创G'); expect(s.parasite.life.player.pose).toBe('STANDING'); expect(s.parasite.life.thought).toMatchObject({ executions: 0, discards: 1, recoveries: 1, pending: 'NONE', targetPaused: false });
    if (approach) act(s, { type: 'RETURN_TO_START', caseId: 'deferred-seat' });
    act(s, { type: 'CLOSE', caseId: 'deferred-seat' }); expect(hasParasiteLifeLock(s)).toBe(false);
  });

  it('failed thought theft preserves Alice actually sitting and never fabricates a stored action', () => {
    const s = promoted(); begin(s, 'deferred-seat'); act(s, { type: 'PERFORM', caseId: 'deferred-seat' }, 100);
    expect(s.parasite.life.thought).toMatchObject({ targetPose: 'SEATED', pending: 'NONE', thefts: 0, executions: 0 }); expect(s.parasite.life.player.pose).toBe('STANDING');
    reject(s, { type: 'RELEASE_THOUGHT', caseId: 'deferred-seat', mode: 'DISCARD' }); act(s, { type: 'CLOSE', caseId: 'deferred-seat' });
    expect(s.parasite.life.thought.targetPose).toBe('STANDING'); nextWeek(s); ordinary(s, 'deferred-seat');
  });

  it('all three ordinary paths and reflection reach100 with no abilities, clones, or resource floor', () => {
    const s = promoted(), old = originals(s), mastery = structuredClone(s.progression.mastery); s.spirituality = 0; s.cash = 0;
    for (const id of PARASITE_CASE_IDS) expect(ordinary(s, id)!.award).not.toHaveBeenCalled();
    act(s, { type: 'REFLECT' }); expect(s.progression.acting).toBe(100); expect(s.progression.mastery).toEqual(mastery);
    expect(s.parasite.life.host).toMatchObject({ exertion: 4, walks: 2, tokenMoves: 2 }); expect(s.parasite.life.player.entries).toBe(0); expect(s.parasite.life.thought.thefts).toBe(0);
    expect(originals(s)).toEqual(old); expect(validateParasiteState(s)).toBe(true); reject(s, { type: 'REFLECT' });
    for (const caseId of PARASITE_CASE_IDS) reject(s, { type: 'REPORT', caseId });
  });

  it.each(PARASITE_CASE_IDS)('ordinary failed %s preserves actual physical motions and accumulated labour across a later retry', caseId => {
    const s = promoted(); s.spirituality = 0; ordinary(s, caseId, 100);
    const labour = s.parasite.life.host.exertion; nextWeek(s); ordinary(s, caseId);
    expect(s.parasite.life.host.exertion).toBe(labour * 2); expect(s.parasite.life.cases[caseId].attempts).toBe(2); expect(s.parasite.life.cases[caseId].closes).toBe(2);
  });

  it('projects every current cleanup and blocks cross-scene actions without hiding the actual body facts', () => {
    const s = promoted(); enter(s, 'limited-control');
    const actions = parasiteLifeActions(s), exit = actions.find(a => a.command.type === 'EXIT_HOST');
    expect(exit?.enabled).toBe(true); expect(actions.find(a => a.command.type === 'TAKE_TOKEN')?.enabled).toBe(false);
    expect(parasiteActivityReason(s, { type: 'OBSERVE', caseId: 'deferred-seat' })).toContain('先实际结束');
    const p = projectParasiteLife(s); expect(p.insideCase).toBe(true); expect(p.practice!.location).toContain('外部无可操控第二身体'); expect(p.practice!.token).toContain('唯一PR4-TOKEN-1');
    expect(p.practice!.consent).toContain('不能从BASIC推导'); expect(p.practice!.cost).toContain('已预留');
  });

  it('rejects counterfeit body, consent, token, delayed intent, rewards and malformed nested saves', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.parasite.life.player.presence = 'INSIDE_HOST'; },
      s => { s.parasite.life.player.location = 'ROUTE_END'; },
      s => { s.parasite.life.host.token = 'HOST_HAND'; },
      s => { s.parasite.life.host.exertion = 1; },
      s => { s.parasite.life.host.mode = 'FULL'; },
      s => { s.parasite.life.cases['shared-senses'].fullConsent = true; },
      s => { s.parasite.life.thought.pending = 'SIT_ON_PR4_CHAIR_1'; },
      s => { s.parasite.life.thought.executions = 1; },
      s => { s.parasite.life.reflected = true; },
      s => { s.progression.acting = 25; },
      s => { s.seer.completedSources.push('parasite-case:limited-control'); },
      s => { (s.parasite.life as unknown as Record<string, unknown>).extraBody = true; },
      s => { (s.parasite.life as unknown as Record<string, unknown>).host = null; },
    ];
    for (const mutate of mutations) { const s = promoted(); mutate(s); expect(validateParasiteLife(s)).toBe(false); }
    const active = promoted(); enter(active, 'limited-control'); fullConsent(active); act(active, { type: 'TAKE_TOKEN', caseId: 'limited-control' });
    const noConsent = structuredClone(active); noConsent.parasite.life.cases['limited-control'].fullConsent = false; expect(validateParasiteLife(noConsent)).toBe(false);
    const noSafety = structuredClone(active); noSafety.parasite.life.cases['limited-control'].safetyReserved = false; expect(validateParasiteLife(noSafety)).toBe(false);
    const old = oldS5(); old.parasite.life.host.exertion = 1; expect(validateParasiteLife(old)).toBe(false);
  });
});
