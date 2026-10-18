import { describe, expect, it, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { ANCIENT_SCHOLAR_CASE_IDS, ANCIENT_SCHOLAR_LIFE_ENVIRONMENT, applyAncientScholarActivity, blockAncientScholarActivity,
  createAncientScholarLifeState, hasAncientScholarLifeLock, hasAncientScholarPastSample, hasAncientScholarTagSource, hasAncientScholarFragment,
  ancientScholarLifeActions, projectAncientScholarLife, validateAncientScholarLife, validateAncientScholarActivityCommand,
  type AncientScholarActivityCommand } from '../../src/domain/ancient-scholar/life.js';
import { ancientScholarPracticeFixture as fixture, ancientScholarPracticeContext as context, practiceAct as act, practiceBegin as begin,
  practiceClose as close, practiceOrdinary as ordinary } from './ancient-scholar-practice-fixture.js';
import type { SliceState } from '../../src/domain/slice/types.js';
const notes = (ctx: ReturnType<typeof context>) => vi.mocked(ctx.note).mock.calls.flat().join(' ');
function reject(s: SliceState, command: unknown) { const before = structuredClone(s), ctx = context(s); expect(() => applyAncientScholarActivity(s, command as AncientScholarActivityCommand, ctx)).toThrow(); expect(s).toEqual(before); expect(ctx.check).not.toHaveBeenCalled(); }
function allOrdinary(s: SliceState) { for (const id of ANCIENT_SCHOLAR_CASE_IDS) ordinary(s, id); act(s, { type: 'REFLECT' }); }

describe('Ancient Scholar finite historical practice with actual sources', () => {
  it('starts with no free sample, lit fragment, image, borrowed reserve or digestion', () => {
    const s = fixture(); expect(s.ancientScholar.life).toEqual(createAncientScholarLifeState()); expect(validateAncientScholarLife(s)).toBe(true);
    expect(hasAncientScholarPastSample(s)).toBe(false); expect(hasAncientScholarTagSource(s)).toBe(false); expect(hasAncientScholarFragment(s)).toBe(false);
    const before = structuredClone(s), p = projectAncientScholarLife(s); expect(p.cases.map(c => c.id)).toEqual([...ANCIENT_SCHOLAR_CASE_IDS]);
    expect(p.practice!.facts.join(' ')).toContain('最多30秒G'); p.practice!.borrowedReserve = 99; expect(s).toEqual(before);
  });
  it('requires the new reception and actual verified records, not names alone', () => {
    const s = fixture(); s.ancientScholar.ritual.location = 'VAULT'; expect(ancientScholarLifeActions(s)).toEqual([]); reject(s, { type: 'OBSERVE', caseId: 'past-reserve' });
    s.ancientScholar.ritual.location = 'RECEPTION'; s.ancientScholar.ritual.records[0]!.verifiedDate = null; reject(s, { type: 'OBSERVE', caseId: 'past-reserve' });
  });
  it('completes three different ordinary reports in 13AP without granting ability mastery or changing old facts', () => {
    const s = fixture(), old = structuredClone([s.bizarroSorcerer, s.marionettist, s.magician, s.world]), ap = s.actionsRemaining, sp = s.spirituality, cash = s.cash, mastery = structuredClone(s.progression.mastery);
    allOrdinary(s); expect(validateAncientScholarLife(s)).toBe(true); expect(ap - s.actionsRemaining).toBe(13); expect(s.progression.acting).toBe(100);
    expect(s.spirituality).toBe(sp); expect(s.cash).toBe(cash); expect(s.progression.mastery).toEqual(mastery); expect([s.bizarroSorcerer, s.marionettist, s.magician, s.world]).toEqual(old);
    expect(s.bizarroSorcerer.life.mouse).toMatchObject({ alive: true, status: 'RELEASED', completeOutcome: 'FAILURE' }); reject(s, { type: 'REFLECT' }); reject(s, { type: 'REPORT', caseId: 'old-tag' });
  });
  it('captures only the actual current self, pays current upkeep and never permanently heals or refills', () => {
    const s = fixture(); s.health = 73; s.mind = 82; s.spirituality = 37; begin(s, 'past-reserve', 'ABILITY');
    expect(s.ancientScholar.life.sample).toMatchObject({ health: 73, mind: 82, spirituality: 37, bodyId: `${s.runId}:body`, sequence: 3 }); expect(s.spirituality).toBe(33);
    act(s, { type: 'BORROW_PAST' }); expect(s.spirituality).toBe(31); expect(s.ancientScholar.life.practice.borrowedReserve).toBe(6); expect(validateAncientScholarLife(s)).toBe(true);
    act(s, { type: 'USE_BORROWED_RESERVE' }); expect(s.spirituality).toBe(31); expect(s.ancientScholar.life.practice).toMatchObject({ borrowedReserve: 4, reserveSpent: 2, borrowRemainingSeconds: 20 });
    close(s, 'past-reserve'); act(s, { type: 'REPORT', caseId: 'past-reserve' }); expect(s.health).toBe(73); expect(s.mind).toBe(82); expect(s.spirituality).toBe(31);
    expect(s.ancientScholar.life.practice.borrowedReserve).toBe(0); expect(s.progression.mastery['diviner.s3.borrow-past']).toBe(8); expect(validateAncientScholarLife(s)).toBe(true);
  });
  it('does not let borrowed reserve pay maintenance or repeat the same action', () => {
    const s = fixture(); begin(s, 'past-reserve', 'ABILITY'); act(s, { type: 'BORROW_PAST' }); reject(s, { type: 'BORROW_PAST' });
    act(s, { type: 'USE_BORROWED_RESERVE' }); reject(s, { type: 'USE_BORROWED_RESERVE' });
    const t = fixture(); begin(t, 'past-reserve', 'ABILITY'); t.spirituality = 1; reject(t, { type: 'BORROW_PAST' });
  });
  it('will not call a weaker observed reserve stronger when current resources are greater', () => {
    const s = fixture(); s.spirituality = 10; begin(s, 'past-reserve', 'ABILITY'); s.spirituality = 50;
    expect(blockAncientScholarActivity(s, { type: 'BORROW_PAST' })).toContain('差额'); reject(s, { type: 'BORROW_PAST' }); act(s, { type: 'FINISH_ORDINARY' }); close(s, 'past-reserve');
  });
  it('retains failed borrowed-power cost and allows ordinary completion without fake mastery', () => {
    const s = fixture(); begin(s, 'past-reserve', 'ABILITY'); const ctx = act(s, { type: 'BORROW_PAST' }, 100); expect(notes(ctx)).toContain('费用不退');
    expect(s.spirituality).toBe(114); expect(s.ancientScholar.life.practice.borrowedReserve).toBe(0); reject(s, { type: 'BORROW_PAST' });
    act(s, { type: 'FINISH_ORDINARY' }); close(s, 'past-reserve'); act(s, { type: 'REPORT', caseId: 'past-reserve' }); expect(s.progression.mastery['diviner.s3.borrow-past']).toBe(0); expect(validateAncientScholarLife(s)).toBe(true);
  });
  it('allows an actual failed attempt to close, then retry only in the next real week', () => {
    const s = fixture(); begin(s, 'past-reserve', 'ABILITY'); act(s, { type: 'BORROW_PAST' }, 100); close(s, 'past-reserve');
    expect(validateAncientScholarLife(s)).toBe(true); reject(s, { type: 'PREPARE', caseId: 'past-reserve', method: 'ABILITY' });
    s.week++; s.date = addGameWeeks(s.date, 1); begin(s, 'past-reserve', 'ABILITY'); act(s, { type: 'BORROW_PAST' }); act(s, { type: 'USE_BORROWED_RESERVE' }); close(s, 'past-reserve'); act(s, { type: 'REPORT', caseId: 'past-reserve' });
    expect(s.ancientScholar.life.cases['past-reserve'].closes).toBe(2); expect(validateAncientScholarLife(s)).toBe(true);
  });
  it('projects only the real familiar one-gram original, moves its distinct image, and leaves property untouched', () => {
    const s = fixture(); ordinary(s, 'past-reserve'); const old = structuredClone(s.bizarroSorcerer); begin(s, 'old-tag', 'ABILITY');
    expect(hasAncientScholarTagSource(s)).toBe(true); act(s, { type: 'PROJECT_TAG' }); const image = s.ancientScholar.life.practice.image!;
    expect(image.id).not.toBe(image.sourceId); expect(image).toMatchObject({ sourceId: 'BR4-TAG-1', massGrams: 1, remainingSeconds: 30, position: 'NEAR' });
    reject(s, { type: 'PROJECT_TAG' }); act(s, { type: 'MOVE_TAG_IMAGE' }); expect(s.ancientScholar.life.practice.image!.position).toBe('FAR'); expect(s.bizarroSorcerer).toEqual(old);
    close(s, 'old-tag'); act(s, { type: 'REPORT', caseId: 'old-tag' }); expect(s.ancientScholar.life.practice.image).toBeNull(); expect(s.bizarroSorcerer).toEqual(old); expect(validateAncientScholarLife(s)).toBe(true);
  });
  it('keeps failed projection costs and never substitutes a fake live person or contaminated bell', () => {
    const s = fixture(); ordinary(s, 'past-reserve'); begin(s, 'old-tag', 'ABILITY'); const before = s.spirituality; act(s, { type: 'PROJECT_TAG' }, 100);
    expect(s.spirituality).toBe(before - 4); expect(s.ancientScholar.life.practice.image).toBeNull(); reject(s, { type: 'PROJECT_TAG', sourceId: 'ARC-BELL-1' }); reject(s, { type: 'PROJECT_TAG', personId: 'DORN' });
    act(s, { type: 'FINISH_ORDINARY' }); close(s, 'old-tag'); act(s, { type: 'REPORT', caseId: 'old-tag' }); expect(s.progression.mastery['diviner.s3.historical-projection']).toBe(0);
  });
  it('hides only the same body in its lit fragment, blocks all other actions, and returns to the original point', () => {
    const s = fixture(); ordinary(s, 'past-reserve'); ordinary(s, 'old-tag'); begin(s, 'lit-fragment', 'ABILITY'); expect(hasAncientScholarFragment(s)).toBe(true);
    act(s, { type: 'HIDE_IN_HISTORY' }); expect(s.ancientScholar.life.practice).toMatchObject({ ownerAt: 'OWN_HISTORY', shelterRemainingSeconds: 10 }); expect(hasAncientScholarLifeLock(s)).toBe(true);
    reject(s, { type: 'FINISH_ORDINARY' }); reject(s, { type: 'CLOSE', caseId: 'lit-fragment' }); reject(s, { type: 'REFLECT' });
    close(s, 'lit-fragment'); act(s, { type: 'REPORT', caseId: 'lit-fragment' }); expect(s.ancientScholar.life.practice.ownerAt).toBe('PRESENT_MAT'); expect(hasAncientScholarLifeLock(s)).toBe(false); expect(validateAncientScholarLife(s)).toBe(true);
  });
  it('lets failed shelter stay at the original point and closes with the actual cost preserved', () => {
    const s = fixture(); ordinary(s, 'past-reserve'); ordinary(s, 'old-tag'); begin(s, 'lit-fragment', 'ABILITY'); const spirit = s.spirituality;
    act(s, { type: 'HIDE_IN_HISTORY' }, 100); expect(s.ancientScholar.life.practice.ownerAt).toBe('PRESENT_MAT'); expect(s.spirituality).toBe(spirit - 4);
    act(s, { type: 'FINISH_ORDINARY' }); close(s, 'lit-fragment'); act(s, { type: 'REPORT', caseId: 'lit-fragment' }); act(s, { type: 'REFLECT' }); expect(s.progression.acting).toBe(100); expect(validateAncientScholarLife(s)).toBe(true);
  });
  it('rejects forged samples, permanent effects, duplicate rewards and invalid keys without RNG', () => {
    for (const cmd of [{ type: 'OBSERVE', caseId: 'past-reserve', sample: { spirituality: 999 } }, { type: 'PROJECT_TAG', sourceId: 'ANGEL' }, { type: 'HIDE_IN_HISTORY', destination: 'ELSEWHERE' }, { type: 'RETURN_TO_PRESENT', copySelf: true }]) {
      expect(validateAncientScholarActivityCommand(cmd)).toBe(false); reject(fixture(), cmd);
    }
    const s = fixture(); allOrdinary(s); expect(validateAncientScholarLife(JSON.parse(stableStringify(s)))).toBe(true);
    for (const change of [(x: SliceState) => { x.ancientScholar.life.sample!.bodyId = 'another-body'; }, (x: SliceState) => { x.ancientScholar.life.sample!.spirituality = 999; }, (x: SliceState) => { x.ancientScholar.life.fragment!.revision = x.revision + 1; }, (x: SliceState) => { x.ancientScholar.life.practice.borrowedReserve = 2; }, (x: SliceState) => { x.seer.completedSources.push('ancient-scholar-reflection'); }]) { const copy = structuredClone(s); change(copy); expect(validateAncientScholarLife(copy)).toBe(false); }
  });
  it('does not let unfinished effects or a mismatched case close remotely', () => {
    const s = fixture(); begin(s, 'past-reserve', 'ABILITY'); reject(s, { type: 'CLOSE', caseId: 'old-tag' }); reject(s, { type: 'REPORT', caseId: 'past-reserve' });
    act(s, { type: 'RETURN_TO_PRESENT' }); act(s, { type: 'WITHDRAW', caseId: 'past-reserve' }); expect(validateAncientScholarLife(s)).toBe(true); expect(s.ancientScholar.life.cases['past-reserve'].withdrawals).toBe(1);
  });
  it('labels beginner limits as G and never uses the advanced three-image protagonist ceiling', () => {
    for (const phrase of ['初晋原创G', '1个普通影像/30秒', '3影像/5分钟/15分钟', '隔绝300年不自动消化', '未知秘密', '旧多恩死亡不变']) expect(ANCIENT_SCHOLAR_LIFE_ENVIRONMENT).toContain(phrase);
    const s = fixture(); expect(ancientScholarLifeActions(s).every(a => a.id.startsWith('AS3-LIFE:'))).toBe(true);
  });
});
