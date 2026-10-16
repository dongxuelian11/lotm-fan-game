import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { SeerContext } from '../../src/domain/seer/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { addGameDays, addGameYears, gameDaysBetween } from '../../src/domain/game-calendar.js';
import { applyLongChapterCommand, blockLongChapterHandoff, blockLongChapterCommand, hasLongChapterHandoff, isLongChapterEraClosed, projectLongChapter, validateLongChapterState } from '../../src/domain/long-chapter/index.js';
import { activeFerrymanChannel, applyFerrymanCommand } from '../../src/domain/ferryman/index.js';
import { applyFerrymanEraCommand, blockFerrymanEraCommand, createFerrymanEraState, projectFerrymanEra, validateFerrymanEra, validateFerrymanEraCommand } from '../../src/domain/ferryman/era.js';
import type { FerrymanCommand } from '../../src/domain/ferryman/types.js';

const read = (key = 'final'): SliceState => migrateSliceState(JSON.parse(readFileSync('tests/fixtures/long-chapter-v01390/natural.json', 'utf8'))[key]);
const original = (): SliceState => migrateSliceState(JSON.parse(readFileSync('tests/fixtures/undying-v01260/natural.json', 'utf8')).final);
const context = (): SeerContext => ({ note: vi.fn(), roll: vi.fn(min => min), check: vi.fn(() => { throw new Error('This bridge never rolls.'); }) });
const step = (s: SliceState, command: FerrymanCommand) => applySliceIntent(s, { type: 'FERRYMAN', command });
const handoff = (s = read()) => applySliceIntent(s, { type: 'LONG_CHAPTER', command: { type: 'CONTINUE_FERRYMAN' } });
const introduced = () => step(handoff(), { type: 'LEARN_GUIDANCE' });
const withoutHandoff = (s: SliceState) => { const { handoff: _handoff, ...history } = s.longChapter; return history; };
const balance = (s: SliceState) => ({ date: s.date, week: s.week, cash: s.cash, health: s.health, mind: s.mind, spirituality: s.spirituality, actionsRemaining: s.actionsRemaining });

describe('Ferryman one-way completed-residence bridge', () => {
  it('uses the exact real 428-command residence ending, not its earlier old-era branch', () => {
    const s = read();
    expect(balance(s)).toEqual({ date: { epoch: 'FIFTH_EPOCH', year: 1411, month: 6, day: 26 }, week: 3235, cash: 194, health: 55, mind: 68, spirituality: 104, actionsRemaining: 1 });
    expect(s.longChapter.newLife).toMatchObject({ works: 3, rests: 1, weeks: 1 });
    expect(s.longChapter.handoff).toBeNull(); expect(s.undying.life.book.location).toBe('PLAYER');
    expect(s.longChapter.recoveredSources).toHaveLength(3); expect(validateLongChapterState(s)).toBe(true);
  });
  it('records only the compact real departure balance without resources, time, RNG or old-history changes', () => {
    const before = read(), s = handoff(before);
    expect(s.longChapter.handoff).toEqual({ target: 'FERRYMAN', ...balance(before) });
    expect(balance(s)).toEqual(balance(before)); expect(withoutHandoff(s)).toEqual(withoutHandoff(before));
    expect(s.undying).toEqual(before.undying); expect(s.gatekeeper).toEqual(before.gatekeeper); expect(s.spiritGuide).toEqual(before.spiritGuide);
    expect(s.progression).toEqual(before.progression); expect(s.random).toEqual(before.random); expect(s.ferryman.era).toEqual(createFerrymanEraState());
    expect(isLongChapterEraClosed(s)).toBe(true); expect(hasLongChapterHandoff(s)).toBe(true); assertValidSliceState(s);
    expect(migrateSliceState(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
  it('requires actual partial recovery, the original book/reply and physical departure', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.longChapter.phase = 'AMNESIAC'; }, s => { s.longChapter.phase = 'CYCLE_DEAD'; },
      s => { s.longChapter.mentallyStable = false; }, s => { s.longChapter.recoveredSources.pop(); },
      s => { s.longChapter.location = 'RECEPTION'; s.longChapter.body!.location = 'LC-RECEPTION'; },
      s => { s.undying.life.book.location = 'CARE_CHEST'; }, s => { s.longChapter.objects.find(o => o.id === 'SG6-REPLY-1')!.location = 'CARE_CHEST'; },
      s => { s.longChapter.recoveredSources[0]!.sourceId = 'invented'; }, s => { s.cash += 1; },
      s => { s.health = 0; s.status = 'DEAD'; }, s => { s.pulse = 'BILL'; },
    ];
    for (const mutate of mutations) { const s = read(); mutate(s); const before = structuredClone(s); expect(blockLongChapterHandoff(s)).not.toBeNull(); expect(() => applyLongChapterCommand(s, { type: 'CONTINUE_FERRYMAN' }, context())).toThrow(); expect(s).toEqual(before); }
  });
  it('makes every former residence mutation unavailable, including revival and repeated handoff', () => {
    const s = handoff(), before = structuredClone(s);
    for (const type of ['CONTINUE_FERRYMAN', 'ENTER_RECEPTION', 'LEAVE_RECEPTION', 'WORK', 'REST', 'NEXT_WEEK', 'AWAIT_REVIVAL', 'BOOK_IN', 'BOOK_OUT'] as const) {
      expect(blockLongChapterCommand(s, { type })).not.toBeNull(); expect(() => applyLongChapterCommand(s, { type }, context())).toThrow();
    }
    expect(s).toEqual(before); expect(projectLongChapter(s).actions).toEqual([]); expect(projectLongChapter(s).body).toContain('居所离开时位置');
    expect(projectFerrymanEra(s).available).toBe(true); expect(projectFerrymanEra(s).history[1]).toContain('尚未实际介绍');
  });
  it('validates completed residence against historical scalars while the current body and wallet change', () => {
    const s = handoff(), history = structuredClone(s.longChapter);
    // Isolated validator fixture: the current domain owns these live values, not the residence validator.
    s.date = addGameDays(s.date, 7); s.week += 1; s.cash = 23; s.actionsRemaining = 2; s.health = 45; s.mind = 51; s.spirituality = 12;
    s.injuries.push({ id: 'current-injury-unit', severity: 'HEAVY', acquiredRevision: s.revision, treatedRevision: null }); s.injuryRisk = 2;
    expect(validateLongChapterState(s)).toBe(true); expect(s.longChapter).toEqual(history);
    s.progression.sequence = 3; s.status = 'DEAD'; s.health = 0;
    expect(validateLongChapterState(s)).toBe(true); expect(blockLongChapterCommand(s, { type: 'AWAIT_REVIVAL' })).not.toBeNull();
    expect(blockFerrymanEraCommand(s, { type: 'ERA_REST' })).not.toBeNull();
  });
  it.each(['cash', 'health', 'mind', 'spirituality', 'actionsRemaining', 'week'] as const)('rejects a forged historical handoff %s even after current-era changes', field => {
    const s = handoff(); s.longChapter.handoff![field] += 1; expect(validateLongChapterState(s)).toBe(false);
  });
  it('rejects rewritten recovery dates, old calendar remainder and historical custodians', () => {
    const a = handoff(); a.longChapter.recoveredSources[0]!.date = addGameDays(a.date, 7); expect(validateLongChapterState(a)).toBe(false);
    const b = handoff(); b.longChapter.calendarRemainderDays = (b.longChapter.calendarRemainderDays + 1) % 7; expect(validateLongChapterState(b)).toBe(false);
    const c = handoff(); c.longChapter.custodians.at(-1)!.ageAtStart += 1; expect(validateLongChapterState(c)).toBe(false);
  });
  it('retains a real canceled old residence as history after later promotion or ordinary death', () => {
    const s = original(); applyLongChapterCommand(s, { type: 'REVIEW' }, context()); applyLongChapterCommand(s, { type: 'CANCEL' }, context());
    const history = structuredClone(s.longChapter); s.progression.sequence = 3; s.status = 'DEAD'; s.health = 0;
    expect(validateLongChapterState(s)).toBe(true); expect(s.longChapter).toEqual(history); expect(s.longChapter.handoff).toBeNull();
  });
});

describe('Ferryman explicitly costed post-cycle current life', () => {
  it('can first earn ordinary living money at the new reception without buying professional guidance', () => {
    let s = handoff(); const history = structuredClone(s.longChapter);
    s = step(s, { type: 'ERA_ENTER' }); expect(s.ferryman.channels).toEqual([]);
    s = step(s, { type: 'ERA_WORK' }); expect(s.cash).toBe(218); expect(s.actionsRemaining).toBe(0);
    s = step(s, { type: 'ERA_NEXT_WEEK' }); expect(s.cash).toBe(194); expect(s.actionsRemaining).toBe(4);
    const metres = s.ferryman.era.travelledMetres; s = step(s, { type: 'LEARN_GUIDANCE' });
    expect(s.cash).toBe(74); expect(s.actionsRemaining).toBe(3); expect(s.ferryman.era.travelledMetres).toBe(metres);
    expect(s.longChapter).toEqual(history); assertValidSliceState(s);
  });
  it('copies the same-week emergency flag from genuine residence actions and never resets it on arrival', () => {
    let s = applySliceIntent(read(), { type: 'LONG_CHAPTER', command: { type: 'ENTER_RECEPTION' } });
    s = applySliceIntent(s, { type: 'LONG_CHAPTER', command: { type: 'REST' } });
    for (let week = 0; week < 3; week++) {
      s = applySliceIntent(s, { type: 'LONG_CHAPTER', command: { type: 'NEXT_WEEK' } });
      for (let rest = 0; rest < 4; rest++) s = applySliceIntent(s, { type: 'LONG_CHAPTER', command: { type: 'REST' } });
    }
    expect(s.cash).toBe(18); expect(s.actionsRemaining).toBe(0);
    s = applySliceIntent(s, { type: 'LONG_CHAPTER', command: { type: 'WORK' } });
    s = applySliceIntent(s, { type: 'LONG_CHAPTER', command: { type: 'LEAVE_RECEPTION' } }); s = handoff(s);
    expect(s.ferryman.era.emergencyWorkUsed).toBe(true); expect(s.ferryman.era.emergencyWorks).toBe(0);
    s = step(s, { type: 'ERA_ENTER' }); expect(s.ferryman.era.emergencyWorkUsed).toBe(true);
    // Guard-only low-cash fixture proves that changing channels does not grant another emergency action.
    const poor = structuredClone(s); poor.cash = 0; expect(blockFerrymanEraCommand(poor, { type: 'ERA_WORK' })).not.toBeNull();
    s = step(s, { type: 'ERA_NEXT_WEEK' }); expect(s.ferryman.era.emergencyWorkUsed).toBe(false); expect(s.actionsRemaining).toBe(4);
  });
  it('charges the actual new introduction and walks twelve real metres without refilling AP or resources', () => {
    const before = handoff(), s = step(before, { type: 'LEARN_GUIDANCE' });
    expect(s.cash).toBe(74); expect(s.actionsRemaining).toBe(0); expect(s.date).toEqual(before.date);
    expect([s.health, s.mind, s.spirituality]).toEqual([55, 68, 104]);
    expect(s.ferryman.era).toMatchObject({ location: 'RECEPTION', elapsedSeconds: 12, travelledMetres: 12 });
    expect(activeFerrymanChannel(s)).toMatchObject({ id: 'POST_CYCLE', introducedWeek: 3235, provider: { id: 'FR3-HANNA' } });
    expect(s.longChapter).toEqual(before.longChapter); assertValidSliceState(s);
  });
  it('requires AP exhaustion and pays real seven-day living costs while preserving the old four-day calendar remainder', () => {
    const before = introduced(), s = step(before, { type: 'ERA_NEXT_WEEK' });
    expect(s.date).toEqual(addGameDays(before.date, 7)); expect(s.week).toBe(before.week + 1); expect(s.cash).toBe(50); expect(s.actionsRemaining).toBe(4);
    expect(s.ferryman.era).toMatchObject({ weeksAdvanced: 1, expenses: 24 }); expect(s.longChapter).toEqual(before.longChapter);
    expect(s.longChapter.calendarRemainderDays).toBe(4); expect(blockFerrymanEraCommand(s, { type: 'ERA_NEXT_WEEK' })).not.toBeNull();
    expect(validateFerrymanEra(s)).toBe(true); expect(migrateSliceState(JSON.parse(JSON.stringify(s)))).toEqual(s);
    const forged = structuredClone(s); forged.date = addGameDays(forged.date, 1); expect(validateFerrymanEra(forged)).toBe(false);
  });
  it('works and rests at their declared current-era costs, reducing real pollution without replacing old records', () => {
    let s = step(introduced(), { type: 'ERA_NEXT_WEEK' }); const history = structuredClone(s.longChapter);
    s = step(s, { type: 'ERA_WORK' }); expect(s.cash).toBe(74); expect(s.actionsRemaining).toBe(3);
    // Explicit isolated failed-potion recovery resource fixture; no success or consumed bottle is fabricated.
    s.seer.pollution = 9; s = step(s, { type: 'ERA_REST' });
    expect(s.cash).toBe(66); expect(s.actionsRemaining).toBe(2); expect([s.health, s.mind, s.spirituality, s.seer.pollution]).toEqual([60, 76, 114, 5]);
    expect(s.ferryman.era).toMatchObject({ works: 1, rests: 1, income: 24, expenses: 32 }); expect(s.longChapter).toEqual(history);
  });
  it('requires actual ordinary arrival/exit and does not reopen the residence or remote provider', () => {
    let s = introduced(); const before = structuredClone(s.longChapter), resources = balance(s);
    s = step(s, { type: 'ERA_LEAVE' }); expect(s.ferryman.era.location).toBe('OUTSIDE'); expect(blockFerrymanEraCommand(s, { type: 'ERA_WORK' })).not.toBeNull();
    s = step(s, { type: 'ERA_ENTER' }); expect(s.ferryman.era).toMatchObject({ location: 'RECEPTION', travelledMetres: 36, elapsedSeconds: 36 });
    expect(balance(s)).toEqual(resources); expect(s.longChapter).toEqual(before); expect(isLongChapterEraClosed(s)).toBe(true);
  });
  it('keeps death final and rejects unknown or payload-bearing era commands', () => {
    const s = introduced(); s.status = 'DEAD'; s.health = 0;
    for (const type of ['ERA_ENTER', 'ERA_LEAVE', 'ERA_WORK', 'ERA_REST', 'ERA_NEXT_WEEK', 'ERA_CARE'] as const) expect(() => applyFerrymanEraCommand(s, { type }, context())).toThrow();
    expect(projectFerrymanEra(s).available).toBe(true); expect(validateFerrymanEraCommand({ type: 'ERA_REST', free: true })).toBe(false); expect(validateFerrymanEraCommand({ type: 'AWAIT_REVIVAL' })).toBe(false);
  });
  it('uses normal injury treatment and later actual rest, without an immediate body or risk reset', () => {
    let s = step(introduced(), { type: 'ERA_NEXT_WEEK' }); s = step(s, { type: 'ERA_WORK' });
    s.health = 75; s.injuryRisk = 2; s.injuries.push({ id: 'era-heavy-unit', severity: 'HEAVY', acquiredRevision: s.revision, treatedRevision: null });
    const oldBody = structuredClone(s.longChapter.body); s = step(s, { type: 'ERA_CARE' });
    expect(s.cash).toBe(14); expect(s.health).toBe(75); expect(s.injuryRisk).toBe(2); expect(s.injuries[0]!.treatedRevision).not.toBeNull();
    s = step(s, { type: 'ERA_REST' }); expect(s.health).toBe(80); expect(s.injuries).toHaveLength(0); expect(s.injuryRisk).toBe(0); expect(s.longChapter.body).toEqual(oldBody);
  });
  it('keeps the S4 second-anniversary guard but does not trigger it after actual S3 eligibility', () => {
    const s = introduced(), second = addGameYears(s.undying.lifecycle.expectedCycleDate!, 60);
    // Deliberate guard-only date/sequence fixture. Full promotion and actual clock are tested by the public route.
    s.date = { ...second, day: second.day - 1 }; s.week = Math.floor(gameDaysBetween({ epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 }, s.date) / 7) + 1;
    expect(blockFerrymanEraCommand(s, { type: 'ERA_NEXT_WEEK' })).toContain('第二个六十年');
    s.progression.sequence = 3; expect(blockFerrymanEraCommand(s, { type: 'ERA_NEXT_WEEK' })).toBeNull();
    const cycles = s.undying.lifecycle.experiencedCycles, due = structuredClone(s.undying.lifecycle.expectedCycleDate);
    applyFerrymanEraCommand(s, { type: 'ERA_NEXT_WEEK' }, context()); expect(s.undying.lifecycle.experiencedCycles).toBe(cycles); expect(s.undying.lifecycle.expectedCycleDate).toEqual(due); expect(s.health).toBe(55);
  });
  it('keeps original-era normal life separate and does not invent post-cycle resources', () => {
    const s = original(), before = structuredClone(s); expect(projectFerrymanEra(s).available).toBe(false);
    expect(() => applyFerrymanCommand(s, { type: 'ERA_WORK' }, context())).toThrow(); expect(s).toEqual(before); expect(s.ferryman.era).toEqual(createFerrymanEraState());
  });
});
