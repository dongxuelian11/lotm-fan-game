import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyMisfortuneMageCommand, createMisfortuneMageState } from '../../src/domain/misfortune-mage/index.js';
import type { MisfortuneMageAbilityId } from '../../src/domain/misfortune-mage/types.js';
import {
  applyMisfortuneMageActivity, createMisfortuneMageLifeState, hasMisfortuneMageLifeLock,
  projectMisfortuneMageLife, misfortuneMageActivityReason, misfortuneMageLifeActions,
  validateMisfortuneMageActivityCommand, validateMisfortuneMageLife,
  MISFORTUNE_MAGE_CASE_IDS, MISFORTUNE_MAGE_LIFE_ENVIRONMENT,
  type MisfortuneMageActivityCommand, type MisfortuneMageCaseId,
} from '../../src/domain/misfortune-mage/life.js';

// Explicit directed unit fixtures do not claim natural RNG success or change the real saved route.
function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((id: MisfortuneMageAbilityId, amount = 8) => { s.progression.mastery[id] = (s.progression.mastery[id] ?? 0) + amount; });
  return { ctx, award };
}
function setWeek(s: SliceState, week: number) { s.date = addGameWeeks(s.date, week - s.week); s.week = week; }
function previous(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/winner-v01130/natural.json', 'utf8')).final);
  s.misfortuneMage = createMisfortuneMageState(); setWeek(s, Math.max(s.week, s.winner.promotionWeek! + 12));
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.cash = 40000; s.health = 100; s.mind = 100; s.spirituality = 100;
  s.character.coreStats.will = 28; s.character.coreStats.knowledge = 28;
  return s;
}
function promoted() {
  const s = previous(), { ctx } = context(s);
  applyMisfortuneMageCommand(s, { type: 'LEARN_GUIDANCE' }, ctx);
  applyMisfortuneMageCommand(s, { type: 'BUY_POTION', bottleId: 'misfortune-mage-potion-1' }, ctx);
  applyMisfortuneMageCommand(s, { type: 'CONSUME', bottleId: 'misfortune-mage-potion-1', confirmed: true }, ctx);
  expect(validateMisfortuneMageLife(s)).toBe(true); return s;
}
function act(s: SliceState, command: MisfortuneMageActivityCommand, roll = 1) {
  const c = context(s, roll); applyMisfortuneMageActivity(s, command, c.ctx, c.award);
  expect(validateMisfortuneMageLife(s), `invalid after ${JSON.stringify(command)}`).toBe(true); return c;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyMisfortuneMageActivity(s, command as MisfortuneMageActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: MisfortuneMageCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  if (s.misfortuneMage.life.cases[caseId].status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method });
}
function close(s: SliceState, caseId: MisfortuneMageCaseId, confirm = true) {
  const a = s.misfortuneMage.life.cases[caseId].attempts.at(-1)!;
  if (caseId === 'uncertain-weight' && !a.secured) act(s, { type: 'SECURE_WEIGHT', caseId });
  if (caseId === 'willing-throw' && !a.returned) act(s, { type: 'RETURN_BAG', caseId });
  if (caseId === 'honest-forecast' && confirm && !a.accountConfirmed) act(s, { type: 'CONFIRM_ACCOUNT', caseId, claim: 'LIMITED' });
  return act(s, { type: 'CLOSE', caseId });
}
function finish(s: SliceState, caseId: MisfortuneMageCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); act(s, { type: 'PERFORM', caseId }); close(s, caseId); return act(s, { type: 'REPORT', caseId });
}
function throwReady(method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  const s = promoted(); finish(s, 'uncertain-weight'); begin(s, 'willing-throw', method); return s;
}
function noteReady() {
  const s = promoted(); finish(s, 'uncertain-weight'); finish(s, 'willing-throw'); begin(s, 'honest-forecast'); return s;
}
function nextWeek(s: SliceState) { setWeek(s, s.week + 1); s.actionsRemaining = 100; s.mind = 100; s.spirituality = 100; }
const notes = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(call => call.join(' ')).join(' ');
function originals(s: SliceState) {
  const { luck: _luck, ...winner } = s.winner;
  return structuredClone([s.monster, s.machine, s.lucky, s.calamityPriest, winner, s.character, s.combatHistory, s.world, s.town]);
}

describe('Misfortune Mage finite G life and one real inherited luck reserve', () => {
  it('stays dormant before promotion and keeps uncertainty, original identities and the old real reserve', () => {
    const old = previous(), luck = structuredClone(old.winner.luck);
    expect(validateMisfortuneMageLife(old)).toBe(true); expect(misfortuneMageLifeActions(old)).toEqual([]);
    expect(projectMisfortuneMageLife(old).practice).toBeNull(); expect(old.misfortuneMage.life).toEqual(createMisfortuneMageLifeState());
    const s = promoted(), before = structuredClone(s);
    expect(s.winner.luck).toEqual(luck); expect(Object.hasOwn(s.misfortuneMage, 'luck')).toBe(false);
    expect(Object.hasOwn(s.misfortuneMage.life, 'luck')).toBe(false); expect(projectMisfortuneMageLife(s).luck).toMatchObject(luck);
    expect(projectMisfortuneMageLife(s).cases.map(c => c.id)).toEqual([...MISFORTUNE_MAGE_CASE_IDS]);
    expect(projectMisfortuneMageLife(s).cases.every(c => c.observations.length === 0)).toBe(true); expect(s).toEqual(before);
    expect(MISFORTUNE_MAGE_LIFE_ENVIRONMENT).toContain('未在原文核实'); expect(MISFORTUNE_MAGE_LIFE_ENVIRONMENT).toContain('第六部第77章');
    expect(MISFORTUNE_MAGE_LIFE_ENVIRONMENT).toContain('原创G'); expect(MISFORTUNE_MAGE_LIFE_ENVIRONMENT).toContain('没有第二幸运池');
  });

  it('finishes all three ordinary cases and reflection with real costs, no new ability mastery and no old story edits', () => {
    const s = promoted(), old = originals(s), luck = structuredClone(s.winner.luck), ap = s.actionsRemaining, spirit = s.spirituality;
    for (const id of MISFORTUNE_MAGE_CASE_IDS) expect(finish(s, id).award).not.toHaveBeenCalled();
    act(s, { type: 'REFLECT' }); expect(ap - s.actionsRemaining).toBe(13); expect(s.spirituality).toBe(spirit);
    expect(s.progression.acting).toBe(100); expect(s.progression.mastery['wheel.s4.precaution-practice']).toBe(0); expect(s.progression.mastery['wheel.s4.bounded-misfortune']).toBe(0);
    expect(s.winner.luck).toEqual(luck); expect(originals(s)).toEqual(old);
    expect(s.misfortuneMage.life.weight).toMatchObject({ position: 'GUIDE', cordHolder: 'GUIDE', handovers: 1, resets: 0 });
    expect(s.misfortuneMage.life.bag).toMatchObject({ position: 'OWNER', distanceMetres: 4, handovers: 1, consented: false, effectActive: false });
    expect(s.misfortuneMage.life.note).toMatchObject({ holder: 'GUIDE', handovers: 1, accepted: true });
    for (const id of MISFORTUNE_MAGE_CASE_IDS) reject(s, { type: 'REPORT', caseId: id }); reject(s, { type: 'REFLECT' });
  });

  it('accumulates only on the original winner ledger, once each actual week, at cap three, without healing', () => {
    const s = promoted(), old = originals(s), before = structuredClone(s.winner.luck), ap = s.actionsRemaining;
    s.health = 50; s.mind = 50; s.spirituality = 11;
    const result = act(s, { type: 'ACCUMULATE' });
    expect(s.winner.luck).toEqual({ stored: before.stored + 1, accumulated: before.accumulated + 1, spent: before.spent, lastAccumulateWeek: s.week });
    expect(s.misfortuneMage.life.accumulations).toEqual([{ week: s.week, actionCost: 1, storedBefore: before.stored, storedAfter: before.stored + 1, accumulatedAfter: before.accumulated + 1, spentAtTime: before.spent }]);
    expect([s.health, s.mind, s.spirituality, s.actionsRemaining]).toEqual([50, 50, 11, ap - 1]);
    expect(result.ctx.check).not.toHaveBeenCalled(); expect(result.award).not.toHaveBeenCalled(); reject(s, { type: 'ACCUMULATE' });
    finish(s, 'uncertain-weight'); finish(s, 'willing-throw', 'ABILITY');
    expect(s.winner.luck.stored).toBe(2); expect(misfortuneMageActivityReason(s, { type: 'ACCUMULATE' })).toContain('本真实周'); reject(s, { type: 'ACCUMULATE' });
    nextWeek(s); act(s, { type: 'ACCUMULATE' }); expect(s.winner.luck.stored).toBe(3);
    expect(s.winner.luck.stored).toBe(s.winner.luck.accumulated - s.winner.luck.spent); expect(originals(s)).toEqual(old);
  });

  it('blocks accumulation away from the actual guide, in battles/events and during old contacts or preparations', () => {
    const base = promoted();
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.world.city = 'TINGEN'; }, s => { s.winner.guidanceKnown = false; },
      s => { s.activeEvent = {} as NonNullable<SliceState['activeEvent']>; }, s => { s.combat = {} as NonNullable<SliceState['combat']>; },
      s => { s.winner.cases['falling-counter']!.contactOpen = true; }, s => { s.winner.practice.ring = 'MAT'; },
      s => { s.machine.cases[Object.keys(s.machine.cases)[0]!]!.status = 'PREPARED'; },
      s => { s.calamityPriest.practice.board = 'UNSTABLE'; },
    ];
    for (const mutate of mutations) { const s = structuredClone(base); mutate(s); reject(s, { type: 'ACCUMULATE' }); }
  });

  it('can prepare on the last AP without contact lock and cancel at zero AP/spirit instead of paying an unaffordable attempt', () => {
    const s = promoted(); act(s, { type: 'OBSERVE', caseId: 'uncertain-weight' }); s.actionsRemaining = 1;
    act(s, { type: 'PREPARE', caseId: 'uncertain-weight', method: 'ABILITY' });
    expect(hasMisfortuneMageLifeLock(s)).toBe(false); expect(s.actionsRemaining).toBe(0);
    expect(misfortuneMageLifeActions(s).some(a => a.command.type === 'CLOSE' && a.enabled)).toBe(false);
    s.spirituality = 0; reject(s, { type: 'PERFORM', caseId: 'uncertain-weight' });
    act(s, { type: 'WITHDRAW', caseId: 'uncertain-weight' }); expect(s.misfortuneMage.life.weight.position).toBe('GUIDE');
    expect(s.misfortuneMage.life.cases['uncertain-weight']).toMatchObject({ status: 'OBSERVED', method: null, withdrawals: 1, attempts: [] });
    expect([s.actionsRemaining, s.spirituality]).toEqual([0, 0]);
  });

  it('permits ordinary week progression for a preparation and rechecks the present person before actual performance', () => {
    const s = throwReady(), week = s.week; expect(hasMisfortuneMageLifeLock(s)).toBe(false);
    nextWeek(s); const result = act(s, { type: 'PERFORM', caseId: 'willing-throw' });
    expect(s.misfortuneMage.life.cases['willing-throw'].attempts[0]?.week).toBe(week + 1);
    expect(notes(result)).toContain('当面重新确认塞拉'); close(s, 'willing-throw');
  });

  it('requires the same intact original cord and ordinary securing even after a paid successful warning', () => {
    const s = promoted(), old = originals(s), luck = structuredClone(s.winner.luck); begin(s, 'uncertain-weight', 'ABILITY');
    s.actionsRemaining = 1; s.spirituality = 3; const result = act(s, { type: 'PERFORM', caseId: 'uncertain-weight' });
    expect(result.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 18); expect(result.award).not.toHaveBeenCalled();
    expect(s.misfortuneMage.life.cases['uncertain-weight'].attempts[0]).toMatchObject({ outcome: 'POSSIBLE_SLIP', success: true, spiritualityCost: 3, luckSpent: 0, secured: false, returned: false });
    expect(s.misfortuneMage.life.weight).toMatchObject({ position: 'SUSPENDED', cordHolder: 'PLAYER', cordIntact: true });
    expect(projectMisfortuneMageLife(s).cases[0]?.result).toContain('实际归还与收束后');
    reject(s, { type: 'CLOSE', caseId: 'uncertain-weight' }); reject(s, { type: 'REPORT', caseId: 'uncertain-weight' });
    expect(() => applySliceIntent(s, { type: 'ACTION', action: 'WORK' })).toThrow(); reject(s, { type: 'ACCUMULATE' });
    s.mind = 0; act(s, { type: 'SECURE_WEIGHT', caseId: 'uncertain-weight' });
    expect(s.misfortuneMage.life.weight.position).toBe('TRAY'); reject(s, { type: 'SECURE_WEIGHT', caseId: 'uncertain-weight' });
    act(s, { type: 'CLOSE', caseId: 'uncertain-weight' }); expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]);
    expect(s.winner.luck).toEqual(luck); expect(originals(s)).toEqual(old);
    s.mind = 100; s.actionsRemaining = 1;
    expect(act(s, { type: 'REPORT', caseId: 'uncertain-weight' }).award).toHaveBeenCalledExactlyOnceWith('wheel.s4.precaution-practice', 8);
  });

  it('preserves an inconclusive warning, lets ordinary securing close it, and retries the same reset weight only next week', () => {
    const s = promoted(); begin(s, 'uncertain-weight', 'ABILITY'); const spirit = s.spirituality;
    const result = act(s, { type: 'PERFORM', caseId: 'uncertain-weight' }, 100);
    expect(notes(result)).toContain('预警未能确认'); expect(s.spirituality).toBe(spirit - 3);
    expect(s.misfortuneMage.life.cases['uncertain-weight'].attempts[0]).toMatchObject({ outcome: 'INCONCLUSIVE', success: false });
    close(s, 'uncertain-weight'); reject(s, { type: 'REPORT', caseId: 'uncertain-weight' }); reject(s, { type: 'PREPARE', caseId: 'uncertain-weight', method: 'ORDINARY' });
    nextWeek(s); expect(finish(s, 'uncertain-weight').award).not.toHaveBeenCalled();
    expect(s.misfortuneMage.life.weight).toMatchObject({ id: 'MM4-WEIGHT-1', cordId: 'MM4-CORD-1', resets: 1, handovers: 2 });
    expect(s.misfortuneMage.life.cases['uncertain-weight'].attempts.map(a => [a.success, a.outcome, a.spiritualityCost])).toEqual([[false, 'INCONCLUSIVE', 3], [true, 'INSPECTED', 0]]);
  });

  it.each([1, 100])('uses one actual G throw and real old luck, retains paid success/failure and walks four metres at roll %s', roll => {
    const s = throwReady(), old = originals(s), luck = structuredClone(s.winner.luck), health = s.health;
    s.actionsRemaining = 1; s.spirituality = 5;
    const result = act(s, { type: 'PERFORM', caseId: 'willing-throw' }, roll), passed = roll === 1;
    expect(result.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 18); expect(result.award).not.toHaveBeenCalled();
    expect(s.misfortuneMage.life.cases['willing-throw'].attempts[0]).toMatchObject({ success: passed, outcome: passed ? 'MISS' : 'HIT', spiritualityCost: 5, luckSpent: 1, returned: false });
    expect(s.winner.luck).toEqual({ ...luck, stored: luck.stored - 1, spent: luck.spent + 1 });
    expect(s.misfortuneMage.life.bag).toMatchObject({ id: 'MM4-BAG-1', position: 'MAT', owner: 'SELLA', distanceMetres: 0, effectActive: passed });
    reject(s, { type: 'CLOSE', caseId: 'willing-throw' }); reject(s, { type: 'ACCUMULATE' });
    expect(() => applySliceIntent(s, { type: 'ACTION', action: 'REST' })).toThrow();
    s.mind = 0; act(s, { type: 'RETURN_BAG', caseId: 'willing-throw' }); reject(s, { type: 'RETURN_BAG', caseId: 'willing-throw' });
    act(s, { type: 'CLOSE', caseId: 'willing-throw' });
    expect(s.misfortuneMage.life.bag).toMatchObject({ position: 'OWNER', distanceMetres: 4, handovers: 1, consented: false, effectActive: false });
    expect([s.actionsRemaining, s.spirituality, s.health]).toEqual([0, 0, health]); expect(originals(s)).toEqual(old);
    s.mind = 100; s.actionsRemaining = 1;
    if (passed) expect(act(s, { type: 'REPORT', caseId: 'willing-throw' }).award).toHaveBeenCalledExactlyOnceWith('wheel.s4.bounded-misfortune', 8);
    else reject(s, { type: 'REPORT', caseId: 'willing-throw' });
  });

  it.each([1, 100])('ordinary throwing observes HIT without changing it or spending lucky reserves, including failed recording %s', roll => {
    const s = throwReady('ORDINARY'), luck = structuredClone(s.winner.luck), spirit = s.spirituality;
    const result = act(s, { type: 'PERFORM', caseId: 'willing-throw' }, roll); expect(result.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10);
    expect(s.misfortuneMage.life.cases['willing-throw'].attempts[0]).toMatchObject({ outcome: 'HIT', spiritualityCost: 0, luckSpent: 0, success: roll === 1 });
    expect(s.misfortuneMage.life.bag.effectActive).toBe(false); close(s, 'willing-throw');
    expect(s.misfortuneMage.life.bag.distanceMetres).toBe(4); expect(s.spirituality).toBe(spirit); expect(s.winner.luck).toEqual(luck);
  });

  it('withdraws renewed consent before the actual throw without charging and explicitly renews for a later attempt', () => {
    const s = throwReady(), luck = structuredClone(s.winner.luck), spirit = s.spirituality;
    s.actionsRemaining = 0; act(s, { type: 'WITHDRAW_CONSENT', caseId: 'willing-throw' });
    expect(s.misfortuneMage.life.cases['willing-throw'].attempts).toEqual([]);
    expect(s.misfortuneMage.life.bag).toMatchObject({ position: 'OWNER', consented: false, effectActive: false, distanceMetres: 0, handovers: 0, consentWithdrawals: 1, cancelledConsents: 1 });
    expect(s.winner.luck).toEqual(luck); expect(s.spirituality).toBe(spirit); reject(s, { type: 'PERFORM', caseId: 'willing-throw' });
    reject(s, { type: 'WITHDRAW_CONSENT', caseId: 'willing-throw' }); nextWeek(s);
    begin(s, 'willing-throw', 'ORDINARY'); act(s, { type: 'PERFORM', caseId: 'willing-throw' }); close(s, 'willing-throw');
    expect(s.misfortuneMage.life.bag.handovers).toBe(1); expect(s.winner.practice.ring).toBe('OWNER');
  });

  it.each([1, 100])('withdraws after a paid throw at roll %s but cannot substitute consent withdrawal for real object return', roll => {
    const s = throwReady(); act(s, { type: 'PERFORM', caseId: 'willing-throw' }, roll);
    const luck = structuredClone(s.winner.luck), spirit = s.spirituality;
    act(s, { type: 'WITHDRAW_CONSENT', caseId: 'willing-throw' });
    expect(s.misfortuneMage.life.bag).toMatchObject({ position: 'MAT', consented: false, effectActive: false, distanceMetres: 0, consentWithdrawals: 1 });
    reject(s, { type: 'CLOSE', caseId: 'willing-throw' }); reject(s, { type: 'WITHDRAW_CONSENT', caseId: 'willing-throw' });
    close(s, 'willing-throw'); expect(s.misfortuneMage.life.bag.distanceMetres).toBe(4);
    expect(s.winner.luck).toEqual(luck); expect(s.spirituality).toBe(spirit);
  });

  it('never borrows luck for a throw; a zero-resource prepared choice can be cancelled and changed to ordinary', () => {
    const s = throwReady(); s.winner.luck.spent += s.winner.luck.stored; s.winner.luck.stored = 0; s.spirituality = 0;
    const before = structuredClone(s.winner.luck); reject(s, { type: 'PERFORM', caseId: 'willing-throw' });
    act(s, { type: 'WITHDRAW', caseId: 'willing-throw' }); begin(s, 'willing-throw', 'ORDINARY');
    act(s, { type: 'PERFORM', caseId: 'willing-throw' }); close(s, 'willing-throw');
    expect(s.winner.luck).toEqual(before); expect(s.spirituality).toBe(0);
  });

  it('retries a failed ability throw only next week with new consent and the same returned bag, retaining both four-metre routes', () => {
    const s = throwReady(); act(s, { type: 'PERFORM', caseId: 'willing-throw' }, 100); close(s, 'willing-throw');
    const spent = s.winner.luck.spent; reject(s, { type: 'PREPARE', caseId: 'willing-throw', method: 'ABILITY' });
    nextWeek(s); finish(s, 'willing-throw', 'ABILITY');
    expect(s.misfortuneMage.life.bag).toMatchObject({ id: 'MM4-BAG-1', owner: 'SELLA', position: 'OWNER', distanceMetres: 8, handovers: 2 });
    expect(s.misfortuneMage.life.cases['willing-throw'].attempts.map(a => a.outcome)).toEqual(['HIT', 'MISS']);
    expect(s.winner.luck.spent).toBe(spent + 1); expect(s.winner.practice.ring).toBe('OWNER');
  });

  it('rejects GUARANTEED visibly without losing the same original paper, rerolling, refunding or claiming new authority', () => {
    const s = noteReady(), old = originals(s); const performed = act(s, { type: 'PERFORM', caseId: 'honest-forecast' });
    expect(performed.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10);
    const text = [...s.misfortuneMage.life.note.writings], ap = s.actionsRemaining, spirit = s.spirituality, luck = structuredClone(s.winner.luck);
    expect(s.misfortuneMage.life.note).toMatchObject({ id: 'MM4-NOTE-1', holder: 'PLAYER', accepted: false });
    const rejected = act(s, { type: 'CONFIRM_ACCOUNT', caseId: 'honest-forecast', claim: 'GUARANTEED' });
    expect(notes(rejected)).toContain('保证未来的说法被当面拒绝'); expect(rejected.ctx.check).not.toHaveBeenCalled(); expect(rejected.award).not.toHaveBeenCalled();
    expect(s.misfortuneMage.life.note.writings).toEqual(text); expect(s.misfortuneMage.life.note.holder).toBe('PLAYER');
    expect(s.misfortuneMage.life.cases['honest-forecast']).toMatchObject({ contactOpen: true, status: 'OBSERVED' });
    expect(s.misfortuneMage.life.cases['honest-forecast'].attempts[0]?.rejectedClaims).toBe(1); reject(s, { type: 'REPORT', caseId: 'honest-forecast' });
    act(s, { type: 'CONFIRM_ACCOUNT', caseId: 'honest-forecast', claim: 'LIMITED' });
    reject(s, { type: 'CONFIRM_ACCOUNT', caseId: 'honest-forecast', claim: 'LIMITED' }); reject(s, { type: 'REPORT', caseId: 'honest-forecast' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; act(s, { type: 'CLOSE', caseId: 'honest-forecast' });
    expect(s.misfortuneMage.life.note).toMatchObject({ holder: 'GUIDE', handovers: 1, accepted: true }); expect(s.winner.luck).toEqual(luck); expect(originals(s)).toEqual(old);
    expect(ap).toBeGreaterThan(0); expect(spirit).toBeGreaterThan(0);
  });

  it('cannot report a failed account merely by accepting LIMITED, and corrects the same paper next week with prior text retained', () => {
    const s = noteReady(); act(s, { type: 'PERFORM', caseId: 'honest-forecast' }, 100); close(s, 'honest-forecast');
    const first = s.misfortuneMage.life.note.writings[0]; reject(s, { type: 'REPORT', caseId: 'honest-forecast' });
    reject(s, { type: 'PREPARE', caseId: 'honest-forecast', method: 'ORDINARY' }); nextWeek(s);
    expect(finish(s, 'honest-forecast').award).not.toHaveBeenCalled();
    expect(s.misfortuneMage.life.note).toMatchObject({ id: 'MM4-NOTE-1', owner: 'GUIDE', holder: 'GUIDE', handovers: 2 });
    expect(s.misfortuneMage.life.note.writings).toHaveLength(2); expect(s.misfortuneMage.life.note.writings[0]).toBe(first); expect(first).toContain('核对失败');
    expect(s.misfortuneMage.life.note.writings.every(text => text.includes('不保证未来') && text.includes('唯一旧幸运账'))).toBe(true);
  });

  it('can close an unconfirmed account safely without earning a report or being locked in a correction loop', () => {
    const s = noteReady(); act(s, { type: 'PERFORM', caseId: 'honest-forecast' });
    close(s, 'honest-forecast', false); expect(hasMisfortuneMageLifeLock(s)).toBe(false); reject(s, { type: 'REPORT', caseId: 'honest-forecast' });
    nextWeek(s); finish(s, 'honest-forecast'); expect(s.misfortuneMage.life.note.handovers).toBe(2);
  });

  it('writes actual failed warning and throw costs alongside the real accumulated/spent ledger', () => {
    const s = promoted(); begin(s, 'uncertain-weight', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'uncertain-weight' }, 100); close(s, 'uncertain-weight');
    nextWeek(s); finish(s, 'uncertain-weight'); begin(s, 'willing-throw', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'willing-throw' }, 100); close(s, 'willing-throw');
    nextWeek(s); finish(s, 'willing-throw'); begin(s, 'honest-forecast'); act(s, { type: 'PERFORM', caseId: 'honest-forecast' });
    const text = s.misfortuneMage.life.note.writings[0]!;
    expect(text).toContain('INCONCLUSIVE/核对失败/实耗3灵性'); expect(text).toContain('HIT/核对失败/实耗5灵性及1幸运');
    expect(text).toContain(`累计${s.winner.luck.accumulated}、支出${s.winner.luck.spent}、现存${s.winner.luck.stored}`);
    close(s, 'honest-forecast');
  });

  it('strictly validates command fields and prevents paper ability, wrong-target cleanup and extra policy fields', () => {
    for (const command of [
      { type: 'ACCUMULATE', amount: 3 }, { type: 'REFLECT', caseId: 'honest-forecast' },
      { type: 'SECURE_WEIGHT', caseId: 'willing-throw' }, { type: 'RETURN_BAG', caseId: 'uncertain-weight' },
      { type: 'WITHDRAW_CONSENT', caseId: 'honest-forecast' }, { type: 'CONFIRM_ACCOUNT', caseId: 'honest-forecast', claim: 'CERTAIN' },
      { type: 'PERFORM', caseId: 'willing-throw', winnerPolicy: 'SPEND_FIRST' }, { type: 'OBSERVE', caseId: 'old-ring' },
    ]) expect(validateMisfortuneMageActivityCommand(command)).toBe(false);
    const s = noteReady(); act(s, { type: 'WITHDRAW', caseId: 'honest-forecast' });
    reject(s, { type: 'PREPARE', caseId: 'honest-forecast', method: 'ABILITY' });
  });

  it('rejects fabricated original objects, return routes, true predictions, reward state and extra luck pools before mutation', () => {
    const s = throwReady(); act(s, { type: 'PERFORM', caseId: 'willing-throw' });
    const mutations: ((copy: SliceState) => void)[] = [
      copy => { (copy.misfortuneMage.life.weight as { id: string }).id = 'NEW-WEIGHT'; },
      copy => { (copy.misfortuneMage.life.weight as { cordId: string }).cordId = 'NEW-ROPE'; },
      copy => { copy.misfortuneMage.life.weight.resets += 1; },
      copy => { copy.misfortuneMage.life.weight.cordIntact = false as true; },
      copy => { copy.misfortuneMage.life.bag.position = 'OWNER'; },
      copy => { copy.misfortuneMage.life.bag.distanceMetres = 4; },
      copy => { copy.misfortuneMage.life.bag.consented = false; },
      copy => { copy.misfortuneMage.life.bag.effectActive = false; },
      copy => { copy.misfortuneMage.life.note.holder = 'PLAYER'; },
      copy => { copy.misfortuneMage.life.cases['willing-throw'].attempts[0]!.luckSpent = 0; },
      copy => { copy.progression.acting = 100; },
      copy => { Object.assign(copy.misfortuneMage.life, { luck: { stored: 3 } }); },
      copy => { copy.winner.luck.stored += 1; },
    ];
    for (const mutate of mutations) { const copy = structuredClone(s); mutate(copy); expect(validateMisfortuneMageLife(copy)).toBe(false); reject(copy, { type: 'RETURN_BAG', caseId: 'willing-throw' }); }
    close(s, 'willing-throw'); expect(validateMisfortuneMageLife(JSON.parse(JSON.stringify(s)) as SliceState)).toBe(true);
  });

  it('rejects falsified accumulation history and a duplicated weekly gain while projecting the real old reserve read-only', () => {
    const s = promoted(); act(s, { type: 'ACCUMULATE' }); const before = structuredClone(s); projectMisfortuneMageLife(s); expect(s).toEqual(before);
    for (const mutate of [
      (copy: SliceState) => { copy.misfortuneMage.life.accumulations.push(structuredClone(copy.misfortuneMage.life.accumulations[0]!)); },
      (copy: SliceState) => { copy.misfortuneMage.life.accumulations[0]!.storedAfter = 2; },
      (copy: SliceState) => { copy.misfortuneMage.life.accumulations[0]!.spentAtTime += 1; },
      (copy: SliceState) => { copy.misfortuneMage.life.accumulations[0]!.week = copy.week + 1; },
    ]) { const copy = structuredClone(s); mutate(copy); expect(validateMisfortuneMageLife(copy)).toBe(false); }
  });
});
