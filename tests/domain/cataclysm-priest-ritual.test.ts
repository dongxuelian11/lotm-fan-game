import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyCataclysmPriestCommand, createCataclysmPriestState, validateCataclysmPriestState } from '../../src/domain/cataclysm-priest/index.js';
import type { CataclysmPriestCommand } from '../../src/domain/cataclysm-priest/types.js';
import { canConsumeCataclysmPriestRitual, currentCataclysmPriestVisit, hasCataclysmPriestRitualLock, projectCataclysmPriestRitual, validateCataclysmPriestRitualState, CATACLYSM_PRIEST_RITUAL_PRICE } from '../../src/domain/cataclysm-priest/ritual.js';

/** Fixed resources and rolls here are test scaffolding, never a natural-play claim. */
function ready(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/ocean-singer-v01020/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous); s.cataclysmPriest = createCataclysmPriestState();
  s.week = Math.max(s.week, s.oceanSinger.promotionWeek! + 12); s.actionsRemaining = 100; s.weeklyBudget = 100; s.cash = 100000;
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 28; s.character.coreStats.physique = 16;
  act(s, { type: 'LEARN_GUIDANCE' }); act(s, { type: 'BUY_POTION', bottleId: 'cataclysm-priest-potion-1' }); return s;
}
function context(s: SliceState, roll = 1): SeerContext { return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) }; }
function act(s: SliceState, command: CataclysmPriestCommand, roll = 1) { const c = context(s, roll); applyCataclysmPriestCommand(s, command, c); return c; }
function reject(s: SliceState, command: unknown) { const before = structuredClone(s), c = context(s); expect(() => applyCataclysmPriestCommand(s, command as CataclysmPriestCommand, c)).toThrow(); expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled(); }
function enter(s: SliceState) { act(s, { type: 'BOOK_RITUAL' }); s.week++; act(s, { type: 'BEGIN_RITUAL' }); }
function trigger(s: SliceState) { enter(s); act(s, { type: 'CLEAR_COAST' }); act(s, { type: 'CHECK_PREPARATION', confirmed: true }); act(s, { type: 'START_QUAKE', confirmed: true }); }
const dose = { type: 'CONSUME', bottleId: 'cataclysm-priest-potion-1', confirmed: true } as const;

describe('Cataclysm Priest real original coast and two temporal hazards', () => {
  it('charges the original site and kit, waits a real week, and physically brings willing people to platform', () => {
    const s = ready(), cash = s.cash, ap = s.actionsRemaining, expert = structuredClone(s.cataclysmPriest.ritual.expert); act(s, { type: 'BOOK_RITUAL' }); const v = currentCataclysmPriestVisit(s)!;
    expect(CATACLYSM_PRIEST_RITUAL_PRICE).toBe(420); expect([s.cash, s.actionsRemaining]).toEqual([cash - 420, ap - 1]); expect(v).toMatchObject({ siteId: 'CP4-SITE-1', phase: 'BOOKED', plannedWeek: s.week + 1 }); expect(v.kit).toMatchObject({ id: 'CP4-KIT-1', location: 'SUPPLIER', status: 'SEALED' }); expect(hasCataclysmPriestRitualLock(s)).toBe(false);
    reject(s, { type: 'BEGIN_RITUAL' }); reject(s, dose); s.week++; act(s, { type: 'BEGIN_RITUAL' });
    expect(s.actionsRemaining).toBe(ap - 2); expect(s.cataclysmPriest.ritual.playerLocation).toBe('PLATFORM'); expect(s.cataclysmPriest.ritual.assistants.map(p => p.location)).toEqual(['PLATFORM', 'PLATFORM']); expect(s.cataclysmPriest.ritual.expert).toEqual(expert); expect(hasCataclysmPriestRitualLock(s)).toBe(true); expect(validateCataclysmPriestState(s)).toBe(true);
  });
  it('requires actual clearing and two distinct explicit confirmations before the quake', () => {
    const s = ready(); enter(s); reject(s, { type: 'CHECK_PREPARATION', confirmed: true }); reject(s, { type: 'START_QUAKE', confirmed: true });
    act(s, { type: 'CLEAR_COAST' }); expect(s.cataclysmPriest.ritual.assistants.map(p => p.location)).toEqual(['RIDGE', 'RIDGE']); reject(s, { type: 'CHECK_PREPARATION' }); act(s, { type: 'CHECK_PREPARATION', confirmed: true });
    expect(currentCataclysmPriestVisit(s)!.site.earthquakeOccurred).toBe(false); reject(s, { type: 'START_QUAKE', confirmed: false }); reject(s, dose); act(s, { type: 'START_QUAKE', confirmed: true });
    expect(currentCataclysmPriestVisit(s)!.site).toMatchObject({ earthquakeOccurred: true, gauge: 'CRACKED', lowerWalkway: 'DAMAGED', sea: 'DRAWDOWN', platformFlooded: false }); expect(canConsumeCataclysmPriestRitual(s)).toBe(true); expect(validateCataclysmPriestState(s)).toBe(true);
  });
  it.each(['expert-away', 'expert-unwilling', 'assistant-dead', 'assistant-away'] as const)('does not restore unavailable original staff: %s', kind => {
    const s = ready(); act(s, { type: 'BOOK_RITUAL' }); s.week++;
    if (kind === 'expert-away') s.cataclysmPriest.ritual.expert.location = 'AWAY'; if (kind === 'expert-unwilling') s.cataclysmPriest.ritual.expert.willing = false;
    if (kind === 'assistant-dead') s.cataclysmPriest.ritual.assistants[0]!.alive = false; if (kind === 'assistant-away') s.cataclysmPriest.ritual.assistants[1]!.location = 'AWAY';
    const people = structuredClone([s.cataclysmPriest.ritual.expert, s.cataclysmPriest.ritual.assistants]); reject(s, { type: 'BEGIN_RITUAL' }); act(s, { type: 'LEAVE_RITUAL' }); expect([s.cataclysmPriest.ritual.expert, s.cataclysmPriest.ritual.assistants]).toEqual(people); expect(validateCataclysmPriestRitualState(s)).toBe(true);
  });
  it('rechecks staff at trigger rather than trusting a former confirmation', () => {
    const s = ready(); enter(s); act(s, { type: 'CLEAR_COAST' }); act(s, { type: 'CHECK_PREPARATION', confirmed: true }); s.cataclysmPriest.ritual.expert.willing = false;
    reject(s, { type: 'START_QUAKE', confirmed: true }); act(s, { type: 'LEAVE_RITUAL' }); expect(s.cataclysmPriest.ritual.expert.willing).toBe(false); expect(s.cataclysmPriest.ritual.visits[0]!.site.earthquakeOccurred).toBe(false);
  });
  it('refuses a missing original kit or broken seal before consuming any bottle', () => {
    const s = ready(); trigger(s); currentCataclysmPriestVisit(s)!.kit.location = 'MISSING'; reject(s, dose); currentCataclysmPriestVisit(s)!.kit.location = 'PLATFORM'; currentCataclysmPriestVisit(s)!.kit.sealsIntact = false; reject(s, dose);
    act(s, { type: 'LEAVE_RITUAL' }); expect(s.cataclysmPriest.bottles[0]!.status).toBe('PLAYER'); expect(s.cataclysmPriest.ritual.visits[0]!.kit.sealsIntact).toBe(false); expect(validateCataclysmPriestRitualState(s)).toBe(true);
  });
  it('records first and return waves as real 60-second checks without a second action cost', () => {
    const s = ready(); trigger(s); act(s, dose); const ap = s.actionsRemaining, c1 = act(s, { type: 'HOLD_POSITION' }, 75), v = currentCataclysmPriestVisit(s)!;
    expect(c1.check).toHaveBeenCalledExactlyOnceWith('physique', 16); expect(v).toMatchObject({ phase: 'FIRST_WAVE', elapsedSeconds: 60, finishedSuccess: false }); expect(v.hazards).toEqual([{ stage: 1, elapsedSeconds: 60, tier: 'FAILURE', healthBefore: 100, healthDamage: 12, healthAfter: 88 }]); expect(v.site).toMatchObject({ gauge: 'BROKEN', lowerWalkway: 'WASHED_OUT', sea: 'FIRST_WAVE', platformFlooded: true });
    const c2 = act(s, { type: 'HOLD_POSITION' }, 30); expect(c2.check).toHaveBeenCalledExactlyOnceWith('physique', 16); expect(v).toMatchObject({ phase: 'ENDED', elapsedSeconds: 120, finishedSuccess: true }); expect(v.hazards[1]).toMatchObject({ stage: 2, healthBefore: 88, healthAfter: 84, healthDamage: 4 }); expect(s.actionsRemaining).toBe(ap); expect(v.site.sea).toBe('RECEDED'); expect(s.cataclysmPriest.ritual.playerLocation).toBe('PLATFORM'); expect(validateCataclysmPriestState(s)).toBe(true);
  });
  it('keeps successful raw potion provisional when withdrawing after the first real wave', () => {
    const s = ready(); trigger(s); const cash = s.cash, mastery = structuredClone(s.progression.mastery), stats = structuredClone(s.character.coreStats); act(s, dose, 30); act(s, { type: 'HOLD_POSITION' }, 75); const health = s.health; act(s, { type: 'LEAVE_RITUAL' }); const v = s.cataclysmPriest.ritual.visits[0]!;
    expect([s.progression.sequence, s.progression.acting, s.health, s.cash]).toEqual([5, 100, health, cash]); expect(s.progression.mastery).toEqual(mastery); expect(s.character.coreStats).toEqual(stats); expect(v).toMatchObject({ phase: 'ABORTED', rawOutcome: 'SUCCESS', finishedSuccess: false, abortedReason: 'WITHDRAWN', elapsedSeconds: 120 }); expect(v.hazards).toHaveLength(1);
    expect(v.site).toMatchObject({ sea: 'RECEDED', gauge: 'BROKEN', lowerWalkway: 'WASHED_OUT' }); expect(v.kit.status).toBe('CONSUMED'); expect(s.cataclysmPriest.bottles[0]!.status).toBe('CONSUMED'); expect(s.cataclysmPriest.ritual.playerLocation).toBe('RIDGE'); expect(hasCataclysmPriestRitualLock(s)).toBe(false); expect(validateCataclysmPriestState(s)).toBe(true);
  });
  it('withdraws before drinking without cancelling an already-triggered sea event', () => {
    const s = ready(); trigger(s); const cash = s.cash; const c = act(s, { type: 'LEAVE_RITUAL' }), v = s.cataclysmPriest.ritual.visits[0]!;
    expect(c.check).not.toHaveBeenCalled(); expect(v).toMatchObject({ phase: 'ABORTED', elapsedSeconds: 120, pendingBottleId: null, rawOutcome: null }); expect(v.site).toMatchObject({ sea: 'RECEDED', gauge: 'BROKEN', lowerWalkway: 'WASHED_OUT' }); expect(v.kit.status).toBe('SEALED'); expect(s.cataclysmPriest.bottles[0]!.status).toBe('PLAYER'); expect(s.health).toBe(100); expect(s.cash).toBe(cash); expect(validateCataclysmPriestState(s)).toBe(true);
  });
  it('cancels before trigger without inventing quake damage, refunds or player ownership of the kit', () => {
    const s = ready(); act(s, { type: 'BOOK_RITUAL' }); const cash = s.cash; act(s, { type: 'LEAVE_RITUAL' }); const v = s.cataclysmPriest.ritual.visits[0]!;
    expect(v).toMatchObject({ phase: 'ABORTED', enteredWeek: null, elapsedSeconds: 0 }); expect(v.kit).toMatchObject({ location: 'SUPPLIER', status: 'SEALED' }); expect(v.site).toMatchObject({ sea: 'CALM', gauge: 'INTACT', lowerWalkway: 'INTACT', earthquakeOccurred: false }); expect(s.cash).toBe(cash); expect(validateCataclysmPriestState(s)).toBe(true);
  });
  it('buys a new original site and kit for a later actual week while retaining old damage', () => {
    const s = ready(); trigger(s); act(s, dose, 75); act(s, { type: 'LEAVE_RITUAL' }); const old = structuredClone(s.cataclysmPriest.ritual.visits[0]);
    act(s, { type: 'BUY_POTION', bottleId: 'cataclysm-priest-potion-2' }); const cash = s.cash; act(s, { type: 'BOOK_RITUAL' }); const v = currentCataclysmPriestVisit(s)!;
    expect(s.cash).toBe(cash - 420); expect(v.siteId).toBe('CP4-SITE-2'); expect(v.kit.id).toBe('CP4-KIT-2'); expect(v.site.gaugeId).toBe('CP4-GAUGE-2'); expect(v.site.walkwayId).toBe('CP4-WALKWAY-2'); reject(s, { type: 'BEGIN_RITUAL' }); s.week++; act(s, { type: 'BEGIN_RITUAL' }); expect(s.cataclysmPriest.ritual.visits[0]).toEqual(old); expect(validateCataclysmPriestState(s)).toBe(true);
  });
  it.each([1, 100])('potion roll %i gives no immunity from lethal first-wave damage', roll => {
    const s = ready(); trigger(s); s.health = 21; s.mind = 41; act(s, dose, roll); const before = s.health; expect(before).toBe(roll === 1 ? 21 : 1); act(s, { type: 'HOLD_POSITION' }, 100);
    const v = s.cataclysmPriest.ritual.visits[0]!; expect(s.status).toBe('DEAD'); expect(s.health).toBe(0); expect(s.cataclysmPriest.ritual.playerLocation).toBe('PLATFORM'); expect(v).toMatchObject({ phase: 'DEAD', elapsedSeconds: 120, finishedSuccess: false, abortedReason: 'DIED' }); expect(v.hazards[0]).toMatchObject({ healthBefore: before, healthAfter: 0, healthDamage: before }); expect(v.site.sea).toBe('RECEDED'); expect(v.kit.status).toBe('CONSUMED'); expect(s.progression.sequence).toBe(5); expect(s.cataclysmPriest.promotionWeek).toBeNull(); reject(s, { type: 'LEAVE_RITUAL' }); reject(s, { type: 'END_RITUAL' }); expect(validateCataclysmPriestState(s)).toBe(true);
  });
  it('can die in the return wave after surviving the first, with no last-instant promotion', () => {
    const s = ready(); trigger(s); s.health = 30; act(s, dose); act(s, { type: 'HOLD_POSITION' }, 100); expect(s.health).toBe(5); expect(s.status).toBe('ACTIVE'); act(s, { type: 'HOLD_POSITION' }, 100);
    expect(s.status).toBe('DEAD'); expect(s.progression.sequence).toBe(5); expect(s.cataclysmPriest.ritual.visits[0]!.hazards).toHaveLength(2); expect(validateCataclysmPriestState(s)).toBe(true);
  });
  it('cannot close early, consume twice, skip time, or repeat the ended wave', () => {
    const s = ready(); trigger(s); reject(s, { type: 'HOLD_POSITION' }); reject(s, { type: 'END_RITUAL' }); act(s, dose); reject(s, dose); reject(s, { type: 'END_RITUAL' }); act(s, { type: 'HOLD_POSITION' }); reject(s, { type: 'END_RITUAL' }); act(s, { type: 'HOLD_POSITION' }); reject(s, { type: 'HOLD_POSITION' }); act(s, { type: 'END_RITUAL' }); reject(s, { type: 'END_RITUAL' });
    expect(validateCataclysmPriestState(s)).toBe(true);
  });
  it('preserves plain serialized hazard history, current stage and immutable original identities', () => {
    const s = ready(); trigger(s); act(s, dose, 30); act(s, { type: 'HOLD_POSITION' }, 75); const copy: SliceState = JSON.parse(JSON.stringify(s));
    expect(validateCataclysmPriestState(copy)).toBe(true); expect(projectCataclysmPriestRitual(copy)).toEqual(projectCataclysmPriestRitual(s));
    for (const change of [(x: SliceState) => { x.cataclysmPriest.ritual.visits[0]!.site.gauge = 'INTACT'; }, (x: SliceState) => { x.cataclysmPriest.ritual.visits[0]!.elapsedSeconds = 120; }, (x: SliceState) => { x.cataclysmPriest.ritual.visits[0]!.hazards[0]!.healthAfter = 100; }, (x: SliceState) => { x.cataclysmPriest.ritual.visits[0]!.kit.id = 'CP4-KIT-2'; }, (x: SliceState) => { x.cataclysmPriest.ritual.visits[0]!.finishedSuccess = true; }]) { const forged = structuredClone(s); change(forged); expect(validateCataclysmPriestState(forged)).toBe(false); }
  });
});
