import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyUnshadowedCommand, createUnshadowedState, validateUnshadowedState } from '../../src/domain/unshadowed/index.js';
import type { UnshadowedCommand } from '../../src/domain/unshadowed/types.js';
import { currentUnshadowedVisit, hasUnshadowedRitualLock, canConsumeUnshadowedRitual, projectUnshadowedRitual, validateUnshadowedRitualState, UNSHADOWED_EMOTION_DECLARATION, UNSHADOWED_RITUAL_PRICE, unshadowedEmotionBasis } from '../../src/domain/unshadowed/ritual.js';
function ready(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/priest-of-light-v01030/natural.json', 'utf8')).final); s.unshadowed = createUnshadowedState();
  s.week = Math.max(s.week, s.priestOfLight.promotionWeek! + 12); s.actionsRemaining = 100; s.weeklyBudget = 100; s.cash = 100000; s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 28; s.activeEvent = null; s.eventQueue = []; s.combat = null;
  act(s, { type: 'LEARN_FORMULA' }); act(s, { type: 'BUY_MATERIALS', batchId: 'unshadowed-batch-1' }); act(s, { type: 'BREW', batchId: 'unshadowed-batch-1' }); return s;
}
function context(s: SliceState, roll = 1): SeerContext { return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) }; }
function act(s: SliceState, command: UnshadowedCommand, roll = 1) { const c = context(s, roll); applyUnshadowedCommand(s, command, c); return c; }
function reject(s: SliceState, command: unknown) { const before = structuredClone(s), c = context(s); expect(() => applyUnshadowedCommand(s, command as UnshadowedCommand, c)).toThrow(); expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled(); }
function enter(s: SliceState) { act(s, { type: 'BOOK_RITUAL' }); s.week++; act(s, { type: 'BEGIN_RITUAL' }); }
function separate(s: SliceState) { enter(s); act(s, { type: 'DECLARE_EMOTION', subjectId: 'UD4-MIRIEL', confirmed: true }); act(s, { type: 'SEPARATE_EMOTION', confirmed: true }); }
const dose = { type: 'CONSUME', bottleId: 'unshadowed-batch-1:bottle', confirmed: true } as const;

describe('Unshadowed concrete original emotion, current people and same-carrier return', () => {
  it('pays for one new vessel and kit, waits a real week and actually enters the hall', () => {
    const s = ready(), cash = s.cash, ap = s.actionsRemaining, people = structuredClone([s.unshadowed.ritual.guide, s.unshadowed.ritual.expert]); act(s, { type: 'BOOK_RITUAL' }); const v = currentUnshadowedVisit(s)!;
    expect(UNSHADOWED_RITUAL_PRICE).toBe(320); expect([s.cash, s.actionsRemaining]).toEqual([cash - 320, ap - 1]); expect(v).toMatchObject({ id: 'UD4-RITUAL-1', phase: 'BOOKED', siteId: 'UD4-HALL', plannedWeek: s.week + 1, anchor: null }); expect(v.vessel).toMatchObject({ id: 'UD4-VESSEL-1', status: 'EMPTY', location: 'SUPPLIER', ownerId: 'UD4-CELIA' }); expect(v.kit).toMatchObject({ id: 'UD4-KIT-1', status: 'SEALED', location: 'SUPPLIER' }); expect(hasUnshadowedRitualLock(s)).toBe(false); reject(s, { type: 'BEGIN_RITUAL' });
    s.week++; act(s, { type: 'BEGIN_RITUAL' }); expect(s.actionsRemaining).toBe(ap - 2); expect(s.unshadowed.ritual.playerLocation).toBe('HALL'); expect([s.unshadowed.ritual.guide, s.unshadowed.ritual.expert]).toEqual(people); expect(v.vessel.location).toBe('TABLE'); expect(v.anchor).toBeNull(); expect(hasUnshadowedRitualLock(s)).toBe(true); expect(validateUnshadowedState(s)).toBe(true);
  });
  it('keeps registered original basis order after persisted object keys are reordered', () => {
    const s = ready(); act(s, { type: 'BOOK_RITUAL' }); const basis = unshadowedEmotionBasis(s), projection = projectUnshadowedRitual(s);
    const reverse = <T extends Record<string, unknown>>(cases: T): T => Object.fromEntries(Object.entries(cases).reverse()) as T;
    s.bard.cases = reverse(s.bard.cases); s.lightprayer.cases = reverse(s.lightprayer.cases); s.sunpriest.cases = reverse(s.sunpriest.cases); s.notary.cases = reverse(s.notary.cases); s.priestOfLight.cases = reverse(s.priestOfLight.cases);
    expect(unshadowedEmotionBasis(s)).toEqual(basis); expect(projectUnshadowedRitual(s)).toEqual(projection);
    expect(basis.filter(b => b.id.startsWith('bard:case:')).map(b => b.id)).toEqual(['bard:case:newcomer-reading', 'bard:case:troubled-carrier', 'bard:case:evening-shift']);
    expect(validateUnshadowedState(s)).toBe(true);
  });
  it('requires an explicit roleplay declaration rooted in actual old guidance and completed cases', () => {
    const s = ready(); enter(s); reject(s, dose); reject(s, { type: 'SEPARATE_EMOTION', confirmed: true }); reject(s, { type: 'DECLARE_EMOTION', subjectId: 'UD4-MIRIEL', confirmed: false }); const old = structuredClone([s.bard, s.lightprayer, s.sunpriest, s.notary, s.priestOfLight]);
    act(s, { type: 'DECLARE_EMOTION', subjectId: 'UD4-MIRIEL', confirmed: true }); const v = currentUnshadowedVisit(s)!;
    expect(v.anchor).toMatchObject({ id: 'UD4-EMOTION-1', subjectId: 'UD4-MIRIEL', reason: UNSHADOWED_EMOTION_DECLARATION, location: 'SELF', felt: true, memoriesRetained: true, separatedWeek: null, returnedWeek: null }); expect(v.anchor!.basis.some(b => b.id === 'bard:original-guidance')).toBe(true); expect(v.anchor!.basis.some(b => b.id.startsWith('bard:case:'))).toBe(true); expect(v.anchor!.basis.some(b => b.id === 'priest-of-light:promotion' && b.week === s.priestOfLight.promotionWeek)).toBe(true);
    expect([s.bard, s.lightprayer, s.sunpriest, s.notary, s.priestOfLight]).toEqual(old); expect(projectUnshadowedRitual(s).boundary).toContain('取消并留在5'); expect(validateUnshadowedState(s)).toBe(true);
  });
  it('separates only the declared original emotion without rewriting old memories or consuming the potion', () => {
    const s = ready(); enter(s); act(s, { type: 'DECLARE_EMOTION', subjectId: 'UD4-MIRIEL', confirmed: true }); const v = currentUnshadowedVisit(s)!, basis = structuredClone(v.anchor!.basis), ap = s.actionsRemaining; act(s, { type: 'SEPARATE_EMOTION', confirmed: true });
    expect(v.anchor).toMatchObject({ location: 'VESSEL', felt: false, memoriesRetained: true, separatedWeek: s.week }); expect(v.anchor!.basis).toEqual(basis); expect(v.vessel).toMatchObject({ status: 'FULL', anchorId: v.anchor!.id }); expect(v.kit.status).toBe('IN_USE'); expect(s.unshadowed.bottles[0]!.status).toBe('PREPARED'); expect(s.actionsRemaining).toBe(ap); expect(canConsumeUnshadowedRitual(s)).toBe(true); reject(s, { type: 'SEPARATE_EMOTION', confirmed: true }); reject(s, { type: 'END_RITUAL' }); expect(validateUnshadowedState(s)).toBe(true);
  });
  it.each(['guide-away', 'guide-unwilling', 'guide-dead', 'expert-away', 'expert-unwilling', 'expert-dead'] as const)('does not recreate unavailable original people before entering: %s', kind => {
    const s = ready(); act(s, { type: 'BOOK_RITUAL' }); s.week++;
    const p = kind.startsWith('guide') ? s.unshadowed.ritual.guide : s.unshadowed.ritual.expert;
    if (kind.endsWith('away')) p.location = 'AWAY'; if (kind.endsWith('unwilling')) p.willing = false; if (kind.endsWith('dead')) p.alive = false;
    const before = structuredClone(p); reject(s, { type: 'BEGIN_RITUAL' }); act(s, { type: 'CANCEL_RITUAL' }); expect(p).toEqual(before); expect(s.unshadowed.ritual.visits[0]!.anchor).toBeNull(); expect(validateUnshadowedRitualState(s)).toBe(true);
  });
  it('rechecks current staff before separation and potion, rather than trusting previous agreement', () => {
    const s = ready(); enter(s); act(s, { type: 'DECLARE_EMOTION', subjectId: 'UD4-MIRIEL', confirmed: true }); s.unshadowed.ritual.expert.willing = false; reject(s, { type: 'SEPARATE_EMOTION', confirmed: true }); s.unshadowed.ritual.expert.willing = true; act(s, { type: 'SEPARATE_EMOTION', confirmed: true }); s.unshadowed.ritual.guide.location = 'AWAY'; reject(s, dose); reject(s, { type: 'CANCEL_RITUAL' }); expect(currentUnshadowedVisit(s)!.anchor).toMatchObject({ location: 'VESSEL', felt: false });
  });
  it.each(['missing-vessel', 'destroyed-vessel', 'missing-kit', 'damaged-kit', 'expert-refuses', 'guide-away'] as const)('preserves pending absence and refuses fake return when %s', kind => {
    const s = ready(); separate(s); act(s, dose, 30); const v = currentUnshadowedVisit(s)!;
    if (kind === 'missing-vessel') v.vessel.location = 'MISSING'; if (kind === 'destroyed-vessel') { v.vessel.status = 'DESTROYED'; v.vessel.intact = false; }
    if (kind === 'missing-kit') v.kit.location = 'MISSING'; if (kind === 'damaged-kit') v.kit.status = 'DAMAGED'; if (kind === 'expert-refuses') s.unshadowed.ritual.expert.willing = false; if (kind === 'guide-away') s.unshadowed.ritual.guide.location = 'AWAY';
    const cash = s.cash; reject(s, { type: 'RETURN_EMOTION' }); reject(s, { type: 'CANCEL_RITUAL' }); reject(s, { type: 'END_RITUAL' }); expect(v.anchor).toMatchObject({ location: 'VESSEL', felt: false }); expect(s.progression.sequence).toBe(5); expect(s.cash).toBe(cash); expect(s.unshadowed.ritual.activeVisitId).toBe(v.id); expect(s.unshadowed.bottles[0]!.status).toBe('CONSUMED'); expect(validateUnshadowedRitualState(s)).toBe(true);
  });
  it('refuses return when the original player body is no longer actually in the hall', () => {
    const s = ready(); separate(s); act(s, dose, 30); s.unshadowed.ritual.playerLocation = 'OUTSIDE';
    reject(s, { type: 'RETURN_EMOTION' }); reject(s, { type: 'CANCEL_RITUAL' }); reject(s, { type: 'END_RITUAL' });
    expect(currentUnshadowedVisit(s)!.anchor).toMatchObject({ location: 'VESSEL', felt: false }); expect(s.progression.sequence).toBe(5); expect(s.unshadowed.bottles[0]!.status).toBe('CONSUMED');
    expect(validateUnshadowedRitualState(s)).toBe(false);
  });
  it('can wait for the original willing professional to return without changing the original carrier', () => {
    const s = ready(); separate(s); act(s, dose, 30); const v = currentUnshadowedVisit(s)!, vessel = structuredClone(v.vessel); s.unshadowed.ritual.expert.location = 'AWAY'; reject(s, { type: 'RETURN_EMOTION' }); expect(v.vessel).toEqual(vessel);
    s.unshadowed.ritual.expert.location = 'HALL'; act(s, { type: 'RETURN_EMOTION' }); expect(v.anchor!.returnedFromVesselId).toBe(vessel.id); expect(v.vessel.id).toBe(vessel.id); expect(s.progression.sequence).toBe(4); expect(validateUnshadowedState(s)).toBe(true);
  });
  it('explicit cancellation before drinking actually returns the same original emotion then exits', () => {
    const s = ready(); separate(s); const v = currentUnshadowedVisit(s)!, cash = s.cash, health = s.health; act(s, { type: 'CANCEL_RITUAL' });
    expect(v).toMatchObject({ phase: 'ABORTED', pendingBottleId: null, finishedSuccess: false, closedWeek: s.week }); expect(v.anchor).toMatchObject({ location: 'RETURNED', felt: true, returnedFromVesselId: v.vessel.id }); expect(v.vessel).toMatchObject({ status: 'EMPTY', anchorId: null }); expect(v.kit.status).toBe('IN_USE'); expect(s.unshadowed.bottles[0]!.status).toBe('PREPARED'); expect([s.progression.sequence, s.health, s.cash]).toEqual([5, health, cash]); expect(s.unshadowed.ritual.playerLocation).toBe('OUTSIDE'); expect(validateUnshadowedState(s)).toBe(true);
  });
  it('explicitly abandoning a raw-success promotion returns emotion but never promotes or refunds', () => {
    const s = ready(); separate(s); act(s, dose, 30); const v = currentUnshadowedVisit(s)!, cash = s.cash, mind = s.mind, stats = structuredClone(s.character.coreStats), mastery = structuredClone(s.progression.mastery); act(s, { type: 'CANCEL_RITUAL' });
    expect(v).toMatchObject({ phase: 'ABORTED', rawOutcome: 'SUCCESS', finishedSuccess: false, abortedReason: 'PLAYER_CANCELLED' }); expect(v.anchor).toMatchObject({ location: 'RETURNED', felt: true }); expect(v.kit.status).toBe('CONSUMED'); expect([s.progression.sequence, s.progression.acting, s.cash, s.mind]).toEqual([5, 100, cash, mind]); expect(s.character.coreStats).toEqual(stats); expect(s.progression.mastery).toEqual(mastery); expect(validateUnshadowedState(s)).toBe(true); reject(s, { type: 'RETURN_EMOTION' });
  });
  it('can cancel before declaring without inventing a strongest emotion or a return', () => {
    const s = ready(); enter(s); const v = currentUnshadowedVisit(s)!, cash = s.cash; act(s, { type: 'CANCEL_RITUAL' }); expect(v.anchor).toBeNull(); expect(v.vessel).toMatchObject({ status: 'EMPTY', anchorId: null, returnedWeek: null }); expect(v.kit.status).toBe('SEALED'); expect(s.cash).toBe(cash); expect(s.progression.sequence).toBe(5); expect(validateUnshadowedState(s)).toBe(true);
  });
  it('blocks old-body ice shortcuts and preserves the original old ice history', () => {
    const s = ready(); s.priestOfLight.ritual.location = 'ICE'; reject(s, { type: 'BOOK_RITUAL' }); s.priestOfLight.ritual.location = 'GUIDE'; const old = structuredClone(s.priestOfLight); separate(s); act(s, dose); act(s, { type: 'RETURN_EMOTION' }); act(s, { type: 'END_RITUAL' }); expect(s.priestOfLight).toEqual(old);
  });
  it('keeps the first cancelled original visit while buying a new independent vessel next time', () => {
    const s = ready(); separate(s); act(s, { type: 'CANCEL_RITUAL' }); const old = structuredClone(s.unshadowed.ritual.visits[0]); act(s, { type: 'BOOK_RITUAL' }); const v = currentUnshadowedVisit(s)!; expect(v.vessel.id).toBe('UD4-VESSEL-2'); expect(v.kit.id).toBe('UD4-KIT-2'); expect(v.anchor).toBeNull(); expect(s.unshadowed.ritual.visits[0]).toEqual(old); reject(s, { type: 'BEGIN_RITUAL' }); s.week++; act(s, { type: 'BEGIN_RITUAL' }); expect(validateUnshadowedState(s)).toBe(true);
  });
  it('serializes actual same-carrier return and rejects changed original people, subject, basis or return identity', () => {
    const s = ready(); separate(s); act(s, dose); act(s, { type: 'RETURN_EMOTION' }); act(s, { type: 'END_RITUAL' }); const copy: SliceState = JSON.parse(JSON.stringify(s)); expect(validateUnshadowedState(copy)).toBe(true); expect(projectUnshadowedRitual(copy)).toEqual(projectUnshadowedRitual(s));
    const corruptions = [(v: SliceState) => { v.unshadowed.ritual.guide.id = 'UD4-MIRIEL-COPY'; }, (v: SliceState) => { v.unshadowed.ritual.visits[0]!.anchor!.basis[0]!.id = 'invented-childhood'; }, (v: SliceState) => { v.unshadowed.ritual.visits[0]!.anchor!.returnedFromVesselId = 'UD4-VESSEL-2'; }, (v: SliceState) => { v.unshadowed.ritual.visits[0]!.vessel.anchorId = 'UD4-EMOTION-1'; }, (v: SliceState) => { v.unshadowed.ritual.visits[0]!.anchor!.memoriesRetained = false as true; }];
    for (const corrupt of corruptions) { const bad = structuredClone(s); corrupt(bad); expect(validateUnshadowedRitualState(bad)).toBe(false); }
  });
});
