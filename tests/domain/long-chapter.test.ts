import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { addGameDays, addGameYears, gameDaysBetween } from '../../src/domain/game-calendar.js';
import { validateUndyingState } from '../../src/domain/undying/index.js';
import { validateGatekeeperLife } from '../../src/domain/gatekeeper/life.js';
import { applyLongChapterCommand, blockLongChapterCommand, createLongChapterState, hasLongChapterLock, isLongChapterEraClosed, longChapterBlocksOrdinaryPulse, projectLongChapter, validateLongChapterCommand, validateLongChapterState } from '../../src/domain/long-chapter/index.js';
import { LONG_CHAPTER_SUPPORT_IDS, type LongChapterCommand } from '../../src/domain/long-chapter/types.js';

const origin = { epoch: 'FIFTH_EPOCH' as const, year: 1349, month: 6, day: 28 };
/** Explicit isolated unit fixture: the real peaceful S4 capture, with a roomy unit-test budget.
 * The public natural route is covered separately by the integration runner. */
function ready(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/undying-v01260/natural.json', 'utf8')).practiced);
  s.longChapter = createLongChapterState(); s.actionsRemaining = 12; s.cash = 5000;
  return s;
}
function ctx(): SeerContext { return { note: vi.fn(), roll: vi.fn(min => min), check: vi.fn(() => { throw new Error('No new roll belongs to the finite cycle'); }) }; }
function act(s: SliceState, command: LongChapterCommand) {
  const context = ctx(); applyLongChapterCommand(s, command, context);
  expect(validateLongChapterState(s)).toBe(true); expect(validateUndyingState(s)).toBe(true); expect(validateGatekeeperLife(s)).toBe(true);
  return context;
}
function reject(s: SliceState, command: LongChapterCommand) { const old = structuredClone(s); expect(() => applyLongChapterCommand(s, command, ctx())).toThrow(); expect(s).toEqual(old); }
function review(s: SliceState) { act(s, { type: 'REVIEW' }); }
function prepare(s: SliceState) {
  review(s); if (s.gatekeeper.companion.status === 'INSIDE') act(s, { type: 'RELEASE_GRAY_FEATHER' });
  for (const taskId of LONG_CHAPTER_SUPPORT_IDS) act(s, { type: 'PREPARE_SUPPORT', taskId });
  act(s, { type: 'BOOK_IN' }); act(s, { type: 'PAY_RESIDENCE', confirmed: true });
}
function death(s = ready()) { prepare(s); act(s, { type: 'LIVE_TO_CYCLE', confirmed: true }); return s; }
function awake(s = death()) { act(s, { type: 'AWAIT_REVIVAL' }); return s; }
function recovered(s = awake()) {
  act(s, { type: 'BOOK_OUT' }); act(s, { type: 'RECOVER_IDENTITY' }); act(s, { type: 'RECOVER_CASE' }); act(s, { type: 'RECOVER_WITNESS' }); return s;
}
function setDate(s: SliceState, date: SliceState['date']) { s.date = date; s.week = Math.floor(gameDaysBetween(origin, date) / 7) + 1; }

describe('first actual long chapter, guarded original body and limited new life', () => {
  it('starts empty and advertises concrete irreversible consequences before either confirmation', () => {
    const s = ready(); expect(validateLongChapterState(s)).toBe(true); expect(s.longChapter).toEqual(createLongChapterState());
    const old = structuredClone(s); review(s); expect(s.date).toEqual(old.date); expect(s.cash).toBe(old.cash); expect(hasLongChapterLock(s)).toBe(false);
    const v = projectLongChapter(s); expect(v.consequences.join(' ')).toContain('83岁故去'); expect(v.consequences.join(' ')).toContain('零利息'); expect(v.boundary).toContain('不宣称原著未来');
    expect(v.actions.find(a => a.command.type === 'PAY_RESIDENCE')?.command).toEqual({ type: 'PAY_RESIDENCE', confirmed: true });
  });
  it('uses four distinct actual support jobs and two separate confirmations, with no free wages', () => {
    const s = ready(), cash = s.cash, ap = s.actionsRemaining, date = structuredClone(s.date); prepare(s);
    expect(s.cash).toBe(cash - 160); expect(s.actionsRemaining).toBe(ap - 6); expect(s.longChapter.supportTasks).toHaveLength(4);
    expect(s.date).toEqual(date); expect(s.longChapter.phase).toBe('RESIDING'); expect(s.health).toBe(100);
    reject(s, { type: 'PREPARE_SUPPORT', taskId: 'SORT_RECORDS' }); reject(s, { type: 'PAY_RESIDENCE', confirmed: true });
  });
  it('requires an actual release of the same gray feather before paid residence', () => {
    const s = ready(), spirit = structuredClone(s.gatekeeper.companion); review(s); act(s, { type: 'BOOK_IN' });
    expect(blockLongChapterCommand(s, { type: 'PAY_RESIDENCE', confirmed: true })).toContain('原灰羽'); reject(s, { type: 'PAY_RESIDENCE', confirmed: true });
    act(s, { type: 'RELEASE_GRAY_FEATHER' }); expect(s.gatekeeper.companion).toEqual({ ...spirit, status: 'OUTSIDE', releases: spirit.releases + 1 });
    expect(s.spiritGuide.messenger.replyReceived).toBe(true); reject(s, { type: 'RELEASE_GRAY_FEATHER' });
  });
  it('moves the same original book and existing reply, keeping the original three entries and desk counts', () => {
    const s = ready(), book = structuredClone(s.undying.life.book); review(s); act(s, { type: 'BOOK_IN' });
    expect(s.undying.life.book).toEqual({ ...book, location: 'CARE_CHEST' }); expect(hasLongChapterLock(s)).toBe(true);
    expect(s.longChapter.objects.map(o => o.id)).toEqual(['UDY4-BOOK-1', 'SG6-REPLY-1']); reject(s, { type: 'CANCEL' });
    act(s, { type: 'BOOK_OUT' }); expect(s.undying.life.book).toEqual(book); expect(hasLongChapterLock(s)).toBe(false);
    act(s, { type: 'CANCEL' }); expect(s.longChapter.phase).toBe('CANCELLED'); expect(s.cash).toBe(5000);
  });
  it('can cancel paid residence only after physical collection, with no refund or second charge', () => {
    const s = ready(); prepare(s); const cash = s.cash, date = structuredClone(s.date);
    reject(s, { type: 'CANCEL' }); act(s, { type: 'BOOK_OUT' }); act(s, { type: 'CANCEL' }); expect(s.cash).toBe(cash); expect(s.date).toEqual(date);
    review(s); expect(s.longChapter.phase).toBe('RESIDING'); reject(s, { type: 'PAY_RESIDENCE', confirmed: true }); act(s, { type: 'BOOK_IN' }); act(s, { type: 'LIVE_TO_CYCLE', confirmed: true }); expect(s.cash).toBe(cash);
  });
  it('lands on the saved actual promotion anniversary, with exact days and weeks rather than 60*52', () => {
    const s = ready(), expected = structuredClone(s.undying.lifecycle.expectedCycleDate!), promotion = structuredClone(s.undying.lifecycle.promotionDate!), departure = structuredClone(s.date);
    const result = death(s); expect(result.date).toEqual(expected); expect(result.undying.lifecycle.promotionDate).toEqual(promotion);
    expect(result.longChapter.elapsedDays).toBe(gameDaysBetween(departure, expected));
    expect(result.week).toBe(Math.floor(gameDaysBetween(origin, expected) / 7) + 1); expect(result.longChapter.calendarRemainderDays).toBe(gameDaysBetween(origin, expected) % 7);
    expect(result.longChapter.cycleDeathDate).not.toEqual(addGameYears(departure, 60));
  });
  it('persists a separate cycle-dead ACTIVE state without treating ordinary lethal injury as a revival entrance', () => {
    const s = death(); expect(s.status).toBe('ACTIVE'); expect(s.health).toBe(0); expect(s.undying.lifecycle.status).toBe('CYCLE_DEAD'); expect(s.longChapter.body?.id).toBe(`${s.runId}:body`);
    expect(validateLongChapterState(JSON.parse(JSON.stringify(s)))).toBe(true); reject(s, { type: 'BOOK_OUT' }); reject(s, { type: 'WORK' }); reject(s, { type: 'LIVE_TO_CYCLE', confirmed: true });
    for (const status of ['ACTIVE', 'DEAD'] as const) { const ordinary = ready(); ordinary.status = status; ordinary.health = 0; reject(ordinary, { type: 'REVIEW' }); reject(ordinary, { type: 'AWAIT_REVIVAL' }); }
  });
  it('really waits seven days, reviving only the same body with bounded G health/mind/spirit and no reward', () => {
    const s = death(), before = structuredClone(s), body = s.longChapter.body!.id; act(s, { type: 'AWAIT_REVIVAL' });
    expect(s.date).toEqual(addGameDays(before.date, 7)); expect(s.week).toBe(before.week + 1); expect(s.longChapter.body!.id).toBe(body); expect(s.longChapter.body!.location).toBe('LC-CARE-HOUSE');
    expect(s.health).toBe(50); expect(s.mind).toBe(60); expect(s.spirituality).toBe(before.spirituality); expect(s.injuries).toEqual(before.injuries); expect(s.cash).toBe(before.cash);
    expect(s.undying.lifecycle.experiencedCycles).toBe(1); expect(s.progression).toEqual(before.progression); expect(s.longChapter.recoveredSources).toEqual([]); reject(s, { type: 'AWAIT_REVIVAL' });
  });
  it('records real custodial generations and Evelyn death while leaving Jory unknown and Owen history untouched', () => {
    const s = ready(), owen = structuredClone(s.undying.encounter); death(s);
    expect(s.longChapter.custodians.map(p => p.id)).toEqual(['LC-ADA-FENN', 'LC-MILES-REED', 'LC-LENA-VOSS']);
    expect(s.longChapter.custodians[1]!.startedDate).toEqual(addGameYears(s.longChapter.departureDate!, 25));
    expect(s.longChapter.custodians[2]!.startedDate).toEqual(addGameYears(s.longChapter.departureDate!, 50));
    expect(s.longChapter.people.find(p => p.id === 'EVELYN-VOSS')).toMatchObject({ kind: 'DEATH', date: addGameYears(s.longChapter.departureDate!, 39) });
    expect(s.longChapter.people.find(p => p.id === 'UDY4-JORY')!.kind).toBe('UNKNOWN'); expect(s.undying.encounter).toEqual(owen);
    expect(s.undying.life.witness.age).toBe(44); expect(s.undying.life.witness.alive).toBe(true); // Explicit old historical record, not a current NPC.
  });
  it('does not invent generations or a death if residence starts too late for their dates', () => {
    const s = ready(), due = s.undying.lifecycle.expectedCycleDate!; setDate(s, { ...due, year: due.year - 10 }); death(s);
    expect(s.longChapter.custodians.map(p => p.id)).toEqual(['LC-ADA-FENN']); expect(s.longChapter.people.some(p => p.id === 'EVELYN-VOSS')).toBe(false);
    expect(projectLongChapter(s).people.join(' ')).not.toContain('当前登记93岁');
  });
  it('retains original potion evidence but marks every actually held old death bottle unusable', () => {
    const s = ready(), bottle = s.undying.bottles.find(b => b.status === 'SUPPLIER')!;
    bottle.status = 'PLAYER'; bottle.acquiredWeek = s.undying.promotionWeek; const old = structuredClone(bottle);
    death(s); const disposal = s.longChapter.objects.find(o => o.id === bottle.id); expect(disposal).toMatchObject({ disposition: 'EXPIRED', location: 'OLD_LOCATION', quantity: 1 });
    expect(bottle).toEqual(old); expect(projectLongChapter(s).objects.join(' ')).toContain('已过期，不属于当代可用库存');
  });
  it('uses three ordered one-action recoveries from real pages and a physically returned original, with no full-memory or mastery gift', () => {
    const s = awake(), old = structuredClone(s.progression); reject(s, { type: 'RECOVER_IDENTITY' }); act(s, { type: 'BOOK_OUT' });
    reject(s, { type: 'RECOVER_CASE' }); act(s, { type: 'RECOVER_IDENTITY' }); expect(s.longChapter.recoveredSources).toHaveLength(1); expect(s.longChapter.mentallyStable).toBe(false);
    reject(s, { type: 'RECOVER_IDENTITY' }); act(s, { type: 'RECOVER_CASE' }); act(s, { type: 'RECOVER_WITNESS' });
    expect(s.actionsRemaining).toBe(1); expect(s.longChapter.phase).toBe('PARTIAL_RECOVERY'); expect(s.longChapter.mentallyStable).toBe(true); expect(s.progression).toEqual(old);
    expect(s.longChapter.recoveredSources.map(r => r.objectId)).toEqual(['UDY4-BOOK-1', 'SG6-REPLY-1', 'LC-HANDOVER-1']); expect(projectLongChapter(s).memory.join(' ')).toContain('未寻回其余人生记忆');
  });
  it('treats reading projected external evidence separately from actually recovered memory', () => {
    const s = awake(), before = structuredClone(s); const v = projectLongChapter(s); expect(v.memory.join(' ')).toContain('外部原记录'); expect(v.currentIdentity).toContain('尚未记起名字');
    v.memory.push('fake'); v.actions.length = 0; expect(s).toEqual(before); expect(s.longChapter.recoveredSources).toEqual([]);
  });
  it('offers limited current ordinary work/rest, exact seven-day bills, and real exit/reentry', () => {
    const s = recovered(), cash = s.cash, date = structuredClone(s.date), progression = structuredClone(s.progression);
    act(s, { type: 'WORK' }); expect(s.cash).toBe(cash + 24); expect(s.actionsRemaining).toBe(0); act(s, { type: 'NEXT_WEEK' }); expect(s.cash).toBe(cash); expect(s.date).toEqual(addGameDays(date, 7)); expect(s.actionsRemaining).toBe(4);
    act(s, { type: 'REST' }); expect([s.health, s.mind, s.spirituality]).toEqual([55, 68, Math.min(120, s.longChapter.body!.entrySpirituality + 10)]); expect(s.cash).toBe(cash - 8);
    act(s, { type: 'LEAVE_RECEPTION' }); expect(s.longChapter.body!.location).toBe('LC-OUTSIDE'); reject(s, { type: 'WORK' }); act(s, { type: 'ENTER_RECEPTION' }); expect(s.longChapter.body!.location).toBe('LC-RECEPTION'); expect(s.progression).toEqual(progression);
  });
  it('gives only one actual low-cash supplemental work action each new week, without an infinite debt or wage loop', () => {
    const s = ready(), oldDebts = structuredClone(s.debts); s.cash = 160; recovered(awake(death(s))); act(s, { type: 'WORK' }); act(s, { type: 'NEXT_WEEK' });
    act(s, { type: 'WORK' }); act(s, { type: 'REST' }); act(s, { type: 'REST' }); act(s, { type: 'REST' }); expect(s.cash).toBe(0); expect(s.actionsRemaining).toBe(0);
    reject(s, { type: 'NEXT_WEEK' }); act(s, { type: 'WORK' }); expect(s.cash).toBe(24); expect(s.longChapter.newLife.emergencyWorkUsed).toBe(true); reject(s, { type: 'WORK' }); act(s, { type: 'NEXT_WEEK' }); expect(s.debts).toEqual(oldDebts); expect(s.debts.every(d => d.remaining === 0)).toBe(true);
  });
  it('stops before silently crossing the anniversary and offers a one-time seven-point deadline route even at zero AP/cash', () => {
    const s = ready(), due = s.undying.lifecycle.expectedCycleDate!; setDate(s, addGameDays(s.date, gameDaysBetween(s.date, due) - 3)); s.actionsRemaining = 0; s.cash = 0;
    expect(longChapterBlocksOrdinaryPulse(s)).toBe(true); review(s); expect(s.longChapter.deadlinePreparationRemaining).toBe(7);
    act(s, { type: 'RELEASE_GRAY_FEATHER' }); for (const taskId of LONG_CHAPTER_SUPPORT_IDS) act(s, { type: 'PREPARE_SUPPORT', taskId });
    act(s, { type: 'DEADLINE_SUPPORT' }); act(s, { type: 'BOOK_IN' }); act(s, { type: 'PAY_RESIDENCE', confirmed: true });
    expect(s.cash).toBe(0); expect(s.actionsRemaining).toBe(0); expect(s.longChapter.deadlinePreparationRemaining).toBe(0); expect(s.longChapter.paidPennies).toBe(0);
    act(s, { type: 'LIVE_TO_CYCLE', confirmed: true }); expect(s.date).toEqual(due);
  });
  it('can acquire the one-time deadline budget after an earlier review, but cannot farm it by cancelling', () => {
    const s = ready(); review(s); expect(s.longChapter.deadlinePreparationGranted).toBe(false);
    setDate(s, addGameDays(s.date, gameDaysBetween(s.date, s.undying.lifecycle.expectedCycleDate!) - 7)); s.actionsRemaining = 0;
    review(s); act(s, { type: 'PREPARE_SUPPORT', taskId: 'SORT_RECORDS' }); expect(s.longChapter.deadlinePreparationRemaining).toBe(6);
    act(s, { type: 'CANCEL' }); review(s); expect(s.longChapter.deadlinePreparationRemaining).toBe(6); reject(s, { type: 'PREPARE_SUPPORT', taskId: 'SORT_RECORDS' });
  });
  it('rejects entry with wounds, outstanding debt, ongoing aid, forged originals or a missing real reply', () => {
    const changes: ((s: SliceState) => void)[] = [s => { s.debts.push({ id: 'UNIT', source: 'test', remaining: 10, weeklyPayment: 1, createdWeek: s.week }); }, s => { s.aid = 'ACCEPTED'; }, s => { s.spiritGuide.messenger.replyReceived = false; }, s => { s.undying.life.book.entries[0]!.text = 'forged'; }];
    for (const change of changes) { const s = ready(); change(s); reject(s, { type: 'REVIEW' }); }
    const s = ready(); review(s); act(s, { type: 'RELEASE_GRAY_FEATHER' }); act(s, { type: 'BOOK_IN' }); s.health = 79; reject(s, { type: 'PAY_RESIDENCE', confirmed: true });
  });
  it('leaves the earlier five death domains frozen after the one actual agreed spirit release', () => {
    const s = ready(); prepare(s); const keys = ['corpsecollector', 'gravedigger', 'spiritmedium', 'spiritGuide', 'gatekeeper'] as const;
    const old = keys.map(k => structuredClone(s[k])); act(s, { type: 'LIVE_TO_CYCLE', confirmed: true }); recovered(awake(s));
    for (const [i, key] of keys.entries()) expect(s[key]).toEqual(old[i]); expect(isLongChapterEraClosed(s)).toBe(true); expect(hasLongChapterLock(s)).toBe(true);
  });
  it('rejects arbitrary commands, omitted confirmations and invented memory payloads', () => {
    for (const command of [{ type: 'REVIVE' }, { type: 'PAY_RESIDENCE' }, { type: 'LIVE_TO_CYCLE', confirmed: false }, { type: 'RECOVER_CASE', memory: 'everything' }, { type: 'PREPARE_SUPPORT', taskId: 'FREE_MONEY' }, { type: 'WORK', count: 10 }]) expect(validateLongChapterCommand(command)).toBe(false);
    expect(validateLongChapterCommand({ type: 'LIVE_TO_CYCLE', confirmed: true })).toBe(true);
  });
  it('rejects corrupted death/body, original ownership, cash, calendar and recovery provenance on load', () => {
    const s = recovered();
    const changes: ((x: SliceState) => void)[] = [x => { x.longChapter.body!.id = 'another-body'; }, x => { x.longChapter.bookWithdrawals = 10; }, x => { x.longChapter.objects[1]!.id = 'new-copy'; }, x => { x.longChapter.recoveredSources[1]!.sourceId = 'invented'; }, x => { x.cash += 1; }, x => { x.week += 1; }, x => { x.longChapter.custodians[2]!.id = 'LC-ADA-FENN'; }, x => { x.health = 100; }, x => { x.longChapter.revivedDate!.day += 1; }, x => { x.undying.lifecycle.experiencedCycles = 0; }];
    for (const change of changes) { const broken = structuredClone(s); change(broken); expect(validateLongChapterState(broken)).toBe(false); }
    const dead = death(); dead.health = 1; expect(validateLongChapterState(dead)).toBe(false);
  });
});
