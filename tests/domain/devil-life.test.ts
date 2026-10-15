import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyDevilCommand, createDevilState } from '../../src/domain/devil/index.js';
import { DEVIL_ABILITY_IDS, type DevilAbilityId } from '../../src/domain/devil/types.js';
import {
  applyDevilActivity, createDevilLifeState, devilActivityReason, devilLifeActions,
  hasDevilLifeLock, projectDevilLife, validateDevilActivityCommand, validateDevilLife,
  DEVIL_CASE_IDS, DEVIL_LIFE_ENVIRONMENT, type DevilActivityCommand, type DevilCaseId,
} from '../../src/domain/devil/life.js';

// Directed domain tests continue the real S5 fixture. Modified resources/rolls are not natural-play evidence.
function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((id: DevilAbilityId, amount = 8) => { s.progression.mastery[id] = (s.progression.mastery[id] ?? 0) + amount; });
  return { ctx, award };
}
function previous(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/desire-apostle-v01110/natural.json', 'utf8')).final);
  s.devil = createDevilState();
  const week = Math.max(s.week, s.desireApostle.promotionWeek! + 12); s.date = addGameWeeks(s.date, week - s.week); s.week = week;
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.cash = 40000; s.health = 100; s.mind = 100; s.spirituality = 100;
  s.character.coreStats.will = 28; s.character.coreStats.knowledge = 28;
  return s;
}
function promoted() {
  const s = previous(), { ctx } = context(s);
  applyDevilCommand(s, { type: 'LEARN_GUIDANCE' }, ctx);
  applyDevilCommand(s, { type: 'BUY_POTION', bottleId: 'devil-potion-1' }, ctx);
  applyDevilCommand(s, { type: 'CONSUME', bottleId: 'devil-potion-1', confirmed: true }, ctx);
  return s;
}
function act(s: SliceState, command: DevilActivityCommand, roll = 1) {
  const c = context(s, roll); applyDevilActivity(s, command, c.ctx, c.award);
  expect(validateDevilLife(s), `invalid after ${JSON.stringify(command)}`).toBe(true);
  return c;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyDevilActivity(s, command as DevilActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: DevilCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  if (s.devil.life.cases[caseId].status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method });
}
function finish(s: SliceState, caseId: DevilCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); act(s, { type: 'PERFORM', caseId });
  if (method === 'ABILITY') act(s, { type: 'CATALYZE', caseId: 'stage-decision' });
  if (caseId === 'returned-invitation' && s.devil.life.invitation.playerNode === 'SHELF') act(s, { type: 'RETURN_ROUTE', caseId });
  if (caseId === 'bounded-account') act(s, { type: 'CONFIRM_ACCOUNT', caseId, claim: 'LIMITED' });
  act(s, { type: 'CLOSE', caseId }); return act(s, { type: 'REPORT', caseId });
}
const nextWeek = (s: SliceState) => { s.week += 1; s.date = addGameWeeks(s.date, 1); s.actionsRemaining = 100; };
const notes = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(x => x.join(' ')).join(' ');
const originals = (s: SliceState) => structuredClone([s.criminal, s.unwinged, s.serialKiller, s.demon, s.desireApostle, s.character, s.combatHistory, s.world, s.town]);
function planted() { const s = promoted(); begin(s, 'stage-decision', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'stage-decision' }); return s; }
function accountReady() { const s = promoted(); finish(s, 'stage-decision'); finish(s, 'returned-invitation'); begin(s, 'bounded-account'); return s; }
function reverseKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(reverseKeys);
  return v !== null && typeof v === 'object' ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reverseKeys(x)])) : v;
}

describe('Devil finite current-emotion life and original choices', () => {
  it('stays pristine and dormant before4 and declares unknown canon separately from G', () => {
    const old = previous(); expect(validateDevilLife(old)).toBe(true); expect(devilLifeActions(old)).toEqual([]);
    expect(projectDevilLife(old)).toEqual({ cases: [], insideCase: false, environment: '', practice: null });
    const s = promoted(); expect(s.devil.life).toEqual(createDevilLifeState()); expect(validateDevilLife(s)).toBe(true);
    expect(projectDevilLife(s).cases.map(x => x.id)).toEqual([...DEVIL_CASE_IDS]);
    expect(projectDevilLife(s).cases.every(x => x.observations.length === 0)).toBe(true);
    expect(DEVIL_LIFE_ENVIRONMENT).toContain('完整配方、仪式与4新能力全表仍未知');
    expect(DEVIL_LIFE_ENVIRONMENT).toContain('三案可普通完成的和平100只是有限有成本G替代');
    expect(DEVIL_LIFE_ENVIRONMENT).toContain('堕落长笛是物品');
  });

  it.each([null, {}, { type: 'OBSERVE', caseId: 'eager-rehearsal' }, { type: 'CATALYZE', caseId: 'returned-invitation' }, { type: 'WITHDRAW_CONSENT', caseId: 'bounded-account' }, { type: 'RETURN_ROUTE', caseId: 'stage-decision' }, { type: 'CONFIRM_ACCOUNT', caseId: 'bounded-account', claim: 'OWN_SOUL' }, { type: 'PERFORM', caseId: 'stage-decision', emotion: 'STRONG' }, { type: 'CATALYZE', caseId: 'stage-decision', target: 'FERRAN' }, { type: 'COMPOSE', heal: true }, { type: 'REFLECT', reward: 100 }])('rejects fabricated commands without cost or RNG: %j', command => {
    expect(validateDevilActivityCommand(command)).toBe(false); reject(promoted(), command);
  });

  it('completes all three by actual ordinary choices without new mastery, old-history changes or healing', () => {
    const s = promoted(), old = originals(s), mastery = structuredClone(s.progression.mastery);
    const ap = s.actionsRemaining, vitals = [s.health, s.mind, s.spirituality, s.cash, s.seer.pollution];
    for (const id of DEVIL_CASE_IDS) finish(s, id); act(s, { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(s.actionsRemaining).toBe(ap - 13); expect(s.progression.mastery).toEqual(mastery);
    expect(originals(s)).toEqual(old); expect([s.health, s.mind, s.spirituality, s.cash, s.seer.pollution]).toEqual(vitals);
    expect(s.devil.life.stage).toMatchObject({ readings: 1, programHolder: 'MIREL', seed: 'NONE', emotion: 'CALM', pauseSeconds: 0 });
    expect(s.devil.life.invitation).toMatchObject({ declined: true, shelfPlacements: 1, walks: 2, distanceMetres: 2, holder: 'GUIDE' });
    expect(s.devil.life.account).toMatchObject({ accepted: true, claim: 'LIMITED', holder: 'GUIDE', handovers: 1 });
    expect(projectDevilLife(s).practice?.history.join(' ')).toContain('我就读这一段');
    for (const id of DEVIL_CASE_IDS) reject(s, { type: 'REPORT', caseId: id }); reject(s, { type: 'REFLECT' });
  });

  it('keeps prepared cancellation separate from a paid trial and requires the previous real report', () => {
    const s = promoted(); reject(s, { type: 'OBSERVE', caseId: 'returned-invitation' }); reject(s, { type: 'REFLECT' });
    begin(s, 'stage-decision', 'ABILITY'); const sp = s.spirituality;
    reject(s, { type: 'CLOSE', caseId: 'stage-decision' }); reject(s, { type: 'REPORT', caseId: 'stage-decision' });
    s.actionsRemaining = 0; act(s, { type: 'WITHDRAW', caseId: 'stage-decision' });
    expect(s.spirituality).toBe(sp); expect(s.devil.life.stage.readings).toBe(0); expect(s.devil.life.cases['stage-decision'].withdrawals).toBe(1);
    expect(hasDevilLifeLock(s)).toBe(false); expect(s.progression.acting).toBe(0);
  });

  it('charges4S for actual seed, then separately3S at0AP and awards both G skills only after actual close/report', () => {
    const s = promoted(), old = originals(s), mastery = structuredClone(s.progression.mastery);
    begin(s, 'stage-decision', 'ABILITY'); s.actionsRemaining = 1; s.spirituality = 7;
    const plant = act(s, { type: 'PERFORM', caseId: 'stage-decision' });
    expect(plant.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 18); expect([s.actionsRemaining, s.spirituality]).toEqual([0, 3]);
    expect(s.devil.life.stage).toMatchObject({ emotion: 'STRONG', consented: true, seed: 'PLANTED', pauseSeconds: 0, programHolder: 'MIREL' });
    expect(s.devil.life.cases['stage-decision'].attempts[0]).toMatchObject({ success: false, actionCost: 1, spiritualityCost: 4, seed: 'PLANTED', catalysis: null });
    expect(projectDevilLife(s).practice?.seedState).toBe('PLANTED'); expect(plant.award).not.toHaveBeenCalled(); expect(s.progression.mastery).toEqual(mastery);
    expect(devilLifeActions(s).find(a => a.command.type === 'CATALYZE')).toMatchObject({ enabled: true });
    for (const type of ['PERFORM', 'REPORT', 'WITHDRAW']) reject(s, { type, caseId: 'stage-decision' });
    const catalyst = act(s, { type: 'CATALYZE', caseId: 'stage-decision' });
    expect(catalyst.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 18); expect([s.actionsRemaining, s.spirituality]).toEqual([0, 0]);
    expect(s.devil.life.stage).toMatchObject({ seed: 'SPENT', pauseSeconds: 30 }); expect(catalyst.award).not.toHaveBeenCalled();
    reject(s, { type: 'CATALYZE', caseId: 'stage-decision' }); reject(s, { type: 'WITHDRAW_CONSENT', caseId: 'stage-decision' });
    act(s, { type: 'CLOSE', caseId: 'stage-decision' });
    expect(s.devil.life.stage).toMatchObject({ seed: 'SPENT', emotion: 'CALM', consented: false, pauseSeconds: 0, waitedSeconds: 60 });
    expect(hasDevilLifeLock(s)).toBe(false); s.actionsRemaining = 1;
    const report = act(s, { type: 'REPORT', caseId: 'stage-decision' });
    expect(report.award.mock.calls).toEqual(DEVIL_ABILITY_IDS.map(id => [id, 8]));
    expect(s.progression.acting).toBe(25); expect(originals(s)).toEqual(old);
  });

  it('lets the same Mirel explicitly withdraw at0AP, expires paid seed, and still requires true close', () => {
    const s = planted(), old = originals(s), paid = s.spirituality; s.actionsRemaining = 0;
    const withdraw = act(s, { type: 'WITHDRAW_CONSENT', caseId: 'stage-decision' });
    expect(notes(withdraw)).toContain('这一次到这里'); expect(s.spirituality).toBe(paid); expect(withdraw.ctx.check).not.toHaveBeenCalled();
    expect(s.devil.life.stage).toMatchObject({ emotion: 'CALM', consented: false, seed: 'EXPIRED', consentWithdrawals: 1, programHolder: 'MIREL' });
    expect(hasDevilLifeLock(s)).toBe(true); expect(s.devil.life.cases['stage-decision'].attempts[0]).toMatchObject({ spiritualityCost: 4, consentWithdrawn: true, success: false });
    reject(s, { type: 'CATALYZE', caseId: 'stage-decision' }); reject(s, { type: 'REPORT', caseId: 'stage-decision' });
    act(s, { type: 'CLOSE', caseId: 'stage-decision' }); expect(hasDevilLifeLock(s)).toBe(false);
    s.actionsRemaining = 10; reject(s, { type: 'PREPARE', caseId: 'stage-decision', method: 'ABILITY' });
    nextWeek(s); finish(s, 'stage-decision', 'ABILITY');
    expect(s.devil.life.stage).toMatchObject({ readings: 2, consentWithdrawals: 1, waitedSeconds: 120 });
    expect(s.devil.life.cases['stage-decision'].attempts.map(x => x.spiritualityCost)).toEqual([4, 7]); expect(originals(s)).toEqual(old);
  });

  it('offers stopping at insufficient catalyst spirit and really waits even with no AP, spirit, mind or health', () => {
    const s = planted(); s.actionsRemaining = 0; s.spirituality = 2;
    expect(devilLifeActions(s).find(x => x.command.type === 'CATALYZE')).toMatchObject({ enabled: false, reason: expect.stringContaining('3灵性') });
    reject(s, { type: 'CATALYZE', caseId: 'stage-decision' }); s.spirituality = 0; s.mind = 0; s.health = 0;
    const close = act(s, { type: 'CLOSE', caseId: 'stage-decision' });
    expect([s.actionsRemaining, s.spirituality, s.mind, s.health]).toEqual([0, 0, 0, 0]); expect(close.ctx.check).not.toHaveBeenCalled();
    expect(s.devil.life.stage).toMatchObject({ seed: 'EXPIRED', waitedSeconds: 60, programHolder: 'MIREL' });
    expect(s.progression.acting).toBe(0); expect(hasDevilLifeLock(s)).toBe(false);
  });

  it.each(['seed', 'catalysis'] as const)('keeps paid %s failure and allows only next-real-week retry', failure => {
    const s = promoted(); begin(s, 'stage-decision', 'ABILITY'); const sp = s.spirituality;
    act(s, { type: 'PERFORM', caseId: 'stage-decision' }, failure === 'seed' ? 100 : 1);
    if (failure === 'catalysis') act(s, { type: 'CATALYZE', caseId: 'stage-decision' }, 100);
    expect(s.spirituality).toBe(sp - (failure === 'seed' ? 4 : 7)); expect(s.devil.life.stage.pauseSeconds).toBe(0);
    act(s, { type: 'CLOSE', caseId: 'stage-decision' }); reject(s, { type: 'REPORT', caseId: 'stage-decision' });
    reject(s, { type: 'PREPARE', caseId: 'stage-decision', method: 'ABILITY' });
    nextWeek(s); finish(s, 'stage-decision', 'ABILITY');
    expect(s.devil.life.cases['stage-decision'].attempts.map(x => x.success)).toEqual([false, true]);
    expect(s.devil.life.cases['stage-decision'].attempts[0]).toMatchObject({ seed: failure === 'seed' ? 'FAILED' : 'SPENT', catalysis: failure === 'seed' ? null : false });
  });

  it('physically hands calm Reina one invitation, keeps her refusal and failed route, then retries only that record', () => {
    const s = promoted(); finish(s, 'stage-decision'); begin(s, 'returned-invitation');
    expect(s.devil.life.invitation).toMatchObject({ holder: 'REINA', emotion: 'CALM', declined: false });
    const before = structuredClone(s.devil.life.invitation); reject(s, { type: 'PREPARE', caseId: 'returned-invitation', method: 'ABILITY' }); expect(s.devil.life.invitation).toEqual(before);
    const fail = act(s, { type: 'PERFORM', caseId: 'returned-invitation' }, 100);
    expect(fail.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10);
    expect(s.devil.life.invitation).toMatchObject({ id: 'DV4-INVITATION-1', holder: 'PLAYER', declined: true, shelfPlacements: 1, playerNode: 'SHELF', walks: 1, distanceMetres: 1, emotion: 'CALM' });
    reject(s, { type: 'CLOSE', caseId: 'returned-invitation' }); reject(s, { type: 'REPORT', caseId: 'returned-invitation' });
    s.actionsRemaining = 0; s.spirituality = 0; act(s, { type: 'RETURN_ROUTE', caseId: 'returned-invitation' }); act(s, { type: 'CLOSE', caseId: 'returned-invitation' });
    const returned = structuredClone(s.devil.life.invitation); expect(returned).toMatchObject({ holder: 'GUIDE', playerNode: 'GUIDE', walks: 2, distanceMetres: 2 });
    nextWeek(s); begin(s, 'returned-invitation');
    expect(devilLifeActions(s).some(a => a.enabled && a.command.type === 'PREPARE' && a.command.method === 'ABILITY' && a.command.caseId === 'returned-invitation')).toBe(false);
    act(s, { type: 'PERFORM', caseId: 'returned-invitation' }); expect(s.devil.life.invitation).toEqual(returned);
    reject(s, { type: 'RETURN_ROUTE', caseId: 'returned-invitation' }); act(s, { type: 'CLOSE', caseId: 'returned-invitation' }); act(s, { type: 'REPORT', caseId: 'returned-invitation' });
    expect(s.devil.life.invitation).toEqual(returned); expect(s.devil.life.cases['returned-invitation'].attempts.map(x => x.success)).toEqual([false, true]);
  });

  it('exposes the calm no-entry reason rather than allowing ability-preparation to fabricate emotion', () => {
    const s = promoted(); finish(s, 'stage-decision'); act(s, { type: 'OBSERVE', caseId: 'returned-invitation' });
    const action = devilLifeActions(s).find(a => a.command.type === 'PREPARE' && a.command.caseId === 'returned-invitation' && a.command.method === 'ABILITY');
    expect(action).toMatchObject({ enabled: false, reason: expect.stringContaining('CALM') });
    reject(s, { type: 'PREPARE', caseId: 'returned-invitation', method: 'ABILITY' });
    expect(s.devil.life.invitation.emotion).toBe('CALM');
  });

  it('rejects a GUARANTEED account and accepts explicit0AP correction on the same handed-over original paper', () => {
    const s = accountReady(), old = originals(s); act(s, { type: 'PERFORM', caseId: 'bounded-account' });
    expect(s.devil.life.account).toMatchObject({ id: 'DV4-NOTE-1', holder: 'PLAYER', accepted: false, claim: null });
    const written = structuredClone(s.devil.life.account.writings); s.actionsRemaining = 0;
    const rejected = act(s, { type: 'CONFIRM_ACCOUNT', caseId: 'bounded-account', claim: 'GUARANTEED' });
    expect(notes(rejected)).toContain('支持不了这个保证'); expect(s.devil.life.account.accepted).toBe(false); expect(rejected.award).not.toHaveBeenCalled();
    act(s, { type: 'CLOSE', caseId: 'bounded-account' }); s.actionsRemaining = 1; reject(s, { type: 'REPORT', caseId: 'bounded-account' });
    s.actionsRemaining = 0; const corrected = act(s, { type: 'CONFIRM_ACCOUNT', caseId: 'bounded-account', claim: 'LIMITED' });
    expect(corrected.ctx.check).not.toHaveBeenCalled(); expect(s.devil.life.account).toMatchObject({ id: 'DV4-NOTE-1', holder: 'GUIDE', accepted: true, claim: 'LIMITED', claims: ['GUARANTEED', 'LIMITED'], corrections: 1, handovers: 1 });
    expect(s.devil.life.account.writings).toEqual(written); expect(s.progression.acting).toBe(50);
    expect(devilLifeActions(s).find(x => x.command.type === 'CONFIRM_ACCOUNT' && x.command.claim === 'LIMITED')?.enabled).toBe(false);
    s.actionsRemaining = 1; act(s, { type: 'REPORT', caseId: 'bounded-account' }); expect(s.progression.acting).toBe(75); expect(originals(s)).toEqual(old);
  });

  it('does not turn failed writing into success through LIMITED and preserves mistakes on the same paper next week', () => {
    const s = accountReady(); act(s, { type: 'PERFORM', caseId: 'bounded-account' }, 100);
    const oldText = s.devil.life.account.writings[0]; expect(oldText).toContain('知识10核对失败');
    act(s, { type: 'CONFIRM_ACCOUNT', caseId: 'bounded-account', claim: 'LIMITED' }); act(s, { type: 'CLOSE', caseId: 'bounded-account' });
    reject(s, { type: 'REPORT', caseId: 'bounded-account' }); reject(s, { type: 'PREPARE', caseId: 'bounded-account', method: 'ORDINARY' });
    nextWeek(s); finish(s, 'bounded-account');
    expect(s.devil.life.account.writings).toHaveLength(2); expect(s.devil.life.account.writings[0]).toBe(oldText);
    expect(s.devil.life.account).toMatchObject({ id: 'DV4-NOTE-1', holder: 'GUIDE', handovers: 2, accepted: true });
    expect(s.devil.life.cases['bounded-account'].attempts.map(x => x.success)).toEqual([false, true]);
  });

  it('delegates COMPOSE to the original paid one-strain rule without restoring resources, body or old history', () => {
    const s = promoted(); s.demon.strain = 2;
    const before = structuredClone(s), ap = s.actionsRemaining;
    const c = act(s, { type: 'COMPOSE' });
    expect(s.actionsRemaining).toBe(ap - 1); expect(s.demon.strain).toBe(1); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
    const expected = structuredClone(before); expected.actionsRemaining -= 1; expected.demon.strain -= 1;
    expect(s).toEqual(expected);
    act(s, { type: 'COMPOSE' }); reject(s, { type: 'COMPOSE' });
    expect(devilActivityReason(s, { type: 'COMPOSE' })).toContain('紧绷为0');
  });

  it('roundtrips live paid seeds, withdrawn consent, actual routes, rejected and corrected papers independent of key order', () => {
    const checkpoints: SliceState[] = [];
    const seed = planted(); checkpoints.push(structuredClone(seed)); act(seed, { type: 'WITHDRAW_CONSENT', caseId: 'stage-decision' }); checkpoints.push(structuredClone(seed));
    const paper = accountReady(); act(paper, { type: 'PERFORM', caseId: 'bounded-account' }); act(paper, { type: 'CONFIRM_ACCOUNT', caseId: 'bounded-account', claim: 'GUARANTEED' }); checkpoints.push(structuredClone(paper));
    act(paper, { type: 'CLOSE', caseId: 'bounded-account' }); act(paper, { type: 'CONFIRM_ACCOUNT', caseId: 'bounded-account', claim: 'LIMITED' }); checkpoints.push(structuredClone(paper));
    for (const s of checkpoints) expect(validateDevilLife(JSON.parse(JSON.stringify(reverseKeys(s))))).toBe(true);
  });

  it('rejects forged free success, lost originals, impossible route or unpaid catalyst state', () => {
    const original = planted();
    const corruptions: ((s: SliceState) => void)[] = [
      s => { s.devil.life.stage.programHolder = 'PLAYER' as never; },
      s => { s.devil.life.stage.emotion = 'CALM'; },
      s => { s.devil.life.stage.consented = false; },
      s => { s.devil.life.cases['stage-decision'].attempts[0]!.spiritualityCost = 0; },
      s => { s.devil.life.cases['stage-decision'].attempts[0]!.success = true; },
      s => { s.devil.life.stage.pauseSeconds = 30; },
      s => { s.devil.life.invitation.walks = 2; },
      s => { s.devil.life.account.accepted = true; },
      s => { s.devil.life.reflected = true; },
      s => { s.devil.life.cases['stage-decision'].closes += 1; },
      s => { s.devil.life.stage.programId = 'NEW-COPY' as never; },
    ];
    for (const corrupt of corruptions) { const s = structuredClone(original); corrupt(s); expect(validateDevilLife(s)).toBe(false); }
  });
});
