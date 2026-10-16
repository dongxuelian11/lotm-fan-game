import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createWitchKingState } from '../../src/domain/witch-king/index.js';
import { WITCH_KING_ABILITY_IDS } from '../../src/domain/witch-king/types.js';
import { applyWitchKingActivity, createWitchKingLifeState, hasWitchKingLifeLock, preparedWitchKingPaper, projectWitchKingLife, validateWitchKingActivityCommand, validateWitchKingLife, type WitchKingActivityCommand, type WitchKingCaseId } from '../../src/domain/witch-king/life.js';
const context = (s: SliceState, roll = 1): SeerContext => ({ roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) });
/** Narrow post-promotion fixture, not a claim of natural acquisition. */
function ready(): SliceState { const s = createSliceRun('witch-king-life', sliceDefaultCreationSelection, 'witch-king-life'); s.witchKing = createWitchKingState(); s.week = 20; s.witchKing.promotionWeek = 19; s.progression = { pathwayId: 'moon', sequence: 4, acting: 0, promotionWeek: 19, mastery: Object.fromEntries(WITCH_KING_ABILITY_IDS.map(id => [id, 0])) }; s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.health = 100; s.mind = 100; s.spirituality = 120; s.actionsRemaining = 100; s.cash = 1000; s.character.coreStats = { physique: 30, perception: 30, will: 30, knowledge: 30 }; return s; }
function act(s: SliceState, c: WitchKingActivityCommand, roll = 1) { const ctx = context(s, roll); applyWitchKingActivity(s, c, ctx); expect(validateWitchKingLife(s)).toBe(true); return ctx; }
function reject(s: SliceState, c: WitchKingActivityCommand) { const before = structuredClone(s); expect(() => applyWitchKingActivity(s, c, context(s))).toThrow(); expect(s).toEqual(before); }
function prepare(s: SliceState, caseId: WitchKingCaseId, method: 'ABILITY' | 'ORDINARY') { if (s.witchKing.life.cases[caseId].status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId }); act(s, { type: 'PREPARE', caseId, method }); }
function close(s: SliceState, caseId: WitchKingCaseId) { if (s.witchKing.life.practice.location === 'END') act(s, { type: 'RETURN', method: 'ORDINARY' }); if (s.witchKing.life.cases[caseId].effectActive) act(s, { type: 'STOP_EFFECT', caseId }); act(s, { type: 'INSPECT', caseId }); act(s, { type: 'CLOSE', caseId }); }
function finish(s: SliceState, caseId: WitchKingCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') { prepare(s, caseId, method); if (caseId === 'paper-trial' && method === 'ABILITY') act(s, { type: 'PREPARE_PAPER', paperId: s.witchKing.life.papers.find(p => p.status === 'HELD')!.id }); act(s, { type: 'PERFORM', caseId }); close(s, caseId); act(s, { type: 'REPORT', caseId }); }
const mastery = (s: SliceState) => Object.values(s.progression.mastery).reduce((a, b) => a + b, 0);

describe('Witch King finite original paper, target and six-metre return', () => {
  it('purchases three unique sourceful originals and explicitly prepares exactly one at its real cost', () => {
    const s = ready(); expect(s.witchKing.life.papers).toEqual([]); reject(s, { type: 'PREPARE_PAPER', paperId: 'WK4-PAPER-1-1' });
    act(s, { type: 'BUY_PAPERS' }); expect(s.cash).toBe(940); expect(s.actionsRemaining).toBe(99); expect(s.witchKing.life.papers.map(p => p.id)).toEqual(['WK4-PAPER-1-1', 'WK4-PAPER-1-2', 'WK4-PAPER-1-3']); expect(s.witchKing.life.papers.every(p => p.status === 'HELD' && p.source.includes('60便士'))).toBe(true);
    act(s, { type: 'PREPARE_PAPER', paperId: 'WK4-PAPER-1-2' }); expect(s.actionsRemaining).toBe(98); expect(s.spirituality).toBe(117); expect(preparedWitchKingPaper(s)?.id).toBe('WK4-PAPER-1-2'); reject(s, { type: 'PREPARE_PAPER', paperId: 'WK4-PAPER-1-1' }); reject(s, { type: 'BUY_PAPERS' });
  });
  it('includes explicit paper preparation within the paid case preparation, then consumes that original and leaves the pad with its instructor', () => {
    const s = ready(); act(s, { type: 'BUY_PAPERS' }); prepare(s, 'paper-trial', 'ABILITY'); const ap = s.actionsRemaining;
    reject(s, { type: 'PERFORM', caseId: 'paper-trial' }); act(s, { type: 'PREPARE_PAPER', paperId: 'WK4-PAPER-1-3' }); expect(s.actionsRemaining).toBe(ap); expect(s.spirituality).toBe(117);
    act(s, { type: 'PERFORM', caseId: 'paper-trial' }); expect(s.witchKing.life.papers[2]).toMatchObject({ status: 'CONSUMED', preparedWeek: 20, consumedWeek: 20, consumedBy: 'PAPER_TRIAL', combatRound: null }); expect(s.health).toBe(100); expect(mastery(s)).toBe(5);
    reject(s, { type: 'CLOSE', caseId: 'paper-trial' }); close(s, 'paper-trial'); act(s, { type: 'REPORT', caseId: 'paper-trial' }); expect(mastery(s)).toBe(13); expect(s.progression.acting).toBe(25); expect(s.witchKing.life.padId).toBe('WK4-PAD'); expect(s.witchKing.life.instructor.location).toBe('WK4-YARD'); reject(s, { type: 'REPORT', caseId: 'paper-trial' });
  });
  it('failed substitution still consumes the original, costs two health and closes without resources; real next-week retry uses another paper', () => {
    const s = ready(); act(s, { type: 'BUY_PAPERS' }); prepare(s, 'paper-trial', 'ABILITY'); act(s, { type: 'PREPARE_PAPER', paperId: 'WK4-PAPER-1-1' }); act(s, { type: 'PERFORM', caseId: 'paper-trial' }, 100);
    expect(s.health).toBe(98); expect(s.spirituality).toBe(117); expect(mastery(s)).toBe(0); expect(s.witchKing.life.cases['paper-trial'].effectActive).toBe(false);
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; close(s, 'paper-trial'); expect(hasWitchKingLifeLock(s)).toBe(false);
    s.actionsRemaining = 100; s.spirituality = 100; s.mind = 100; reject(s, { type: 'PREPARE', caseId: 'paper-trial', method: 'ABILITY' }); s.week++; finish(s, 'paper-trial', 'ABILITY'); expect(s.witchKing.life.papers.filter(p => p.status === 'CONSUMED')).toHaveLength(2); expect(s.health).toBe(98); expect(s.cash).toBe(940);
  });
  it('never restores consumed batches and only sells a real next-week batch after all originals were used', () => {
    const s = ready(); act(s, { type: 'BUY_PAPERS' });
    for (let i = 0; i < 3; i++) { prepare(s, 'paper-trial', 'ABILITY'); act(s, { type: 'PREPARE_PAPER', paperId: `WK4-PAPER-1-${i + 1}` }); act(s, { type: 'PERFORM', caseId: 'paper-trial' }, 100); close(s, 'paper-trial'); if (i < 2) s.week++; }
    act(s, { type: 'BUY_PAPERS' }); expect(s.witchKing.life.paperPurchases).toBe(2); expect(s.witchKing.life.papers).toHaveLength(6); expect(s.witchKing.life.papers.slice(0, 3).every(p => p.status === 'CONSUMED')).toBe(true); expect(s.witchKing.life.papers[3]!.id).toBe('WK4-PAPER-2-1'); expect(s.cash).toBe(880); reject(s, { type: 'BUY_PAPERS' });
  });
  it('arrow misses only the original backstop and a later successful arrow breaks the same finite target', () => {
    const s = ready(); finish(s, 'paper-trial'); prepare(s, 'arrow-target', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'arrow-target' }, 100); expect(s.spirituality).toBe(116); expect(s.witchKing.life.target).toMatchObject({ id: 'WK4-TARGET', status: 'INTACT', misses: 1 }); expect(mastery(s)).toBe(0); close(s, 'arrow-target'); s.week++; finish(s, 'arrow-target', 'ABILITY'); expect(s.witchKing.life.target).toMatchObject({ status: 'BROKEN', misses: 1 }); expect(mastery(s)).toBe(13); reject(s, { type: 'OBSERVE', caseId: 'arrow-target' });
  });
  it('requires the actual body and same held folio to return before stopping the field, even with no resources', () => {
    const s = ready(); finish(s, 'paper-trial'); finish(s, 'arrow-target'); prepare(s, 'moon-return', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'moon-return' }); expect(s.spirituality).toBe(115); const folio = s.witchKing.life.practice.folio; expect(s.witchKing.life.practice).toMatchObject({ field: 'MOON', location: 'END', outboundTrips: 1, returns: 0 }); expect(folio.location).toBe('END');
    reject(s, { type: 'CLOSE', caseId: 'moon-return' }); reject(s, { type: 'STOP_EFFECT', caseId: 'moon-return' }); s.spirituality = 0; s.actionsRemaining = 0; s.mind = 0;
    act(s, { type: 'RETURN', method: 'ORDINARY' }); expect(s.witchKing.life.practice.folio).toBe(folio); expect(folio.location).toBe('START'); expect(s.witchKing.life.practice.field).toBe('MOON'); act(s, { type: 'STOP_EFFECT', caseId: 'moon-return' }); act(s, { type: 'INSPECT', caseId: 'moon-return' }); act(s, { type: 'CLOSE', caseId: 'moon-return' }); expect(hasWitchKingLifeLock(s)).toBe(false); expect(s.health).toBe(100);
  });
  it('charges failed optional moon return, leaves the body at END and preserves a zero-cost ordinary way home', () => {
    const s = ready(); finish(s, 'paper-trial'); finish(s, 'arrow-target'); prepare(s, 'moon-return', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'moon-return' }); act(s, { type: 'RETURN', method: 'ABILITY' }, 100); expect(s.spirituality).toBe(113); expect(s.witchKing.life.practice.location).toBe('END'); reject(s, { type: 'RETURN', method: 'ABILITY' }); close(s, 'moon-return'); expect(s.witchKing.life.practice.returns).toBe(1);
  });
  it('ordinary three-case route reaches acting100 with actual marking and walking, but no ability mastery or free paper', () => {
    const s = ready(); for (const id of ['paper-trial', 'arrow-target', 'moon-return'] as const) finish(s, id); act(s, { type: 'REFLECT' }); expect(s.progression.acting).toBe(100); expect(mastery(s)).toBe(0); expect(s.spirituality).toBe(120); expect(s.witchKing.life.papers).toEqual([]); expect(s.witchKing.life.target.status).toBe('MARKED'); expect(s.witchKing.life.practice).toMatchObject({ location: 'START', outboundTrips: 1, returns: 1, field: 'NONE' }); reject(s, { type: 'REFLECT' });
  });
  it('cancellation does not erase or duplicate an explicitly prepared original and lost instructor consent blocks practice', () => {
    const s = ready(); act(s, { type: 'BUY_PAPERS' }); prepare(s, 'paper-trial', 'ABILITY'); act(s, { type: 'PREPARE_PAPER', paperId: 'WK4-PAPER-1-1' }); act(s, { type: 'WITHDRAW', caseId: 'paper-trial' }); expect(preparedWitchKingPaper(s)?.id).toBe('WK4-PAPER-1-1'); prepare(s, 'paper-trial', 'ABILITY'); s.witchKing.life.instructor.willing = false; reject(s, { type: 'PERFORM', caseId: 'paper-trial' }); act(s, { type: 'WITHDRAW', caseId: 'paper-trial' }); expect(s.cash).toBe(940);
  });
  it('can cancel a next-week retry after failed paper use without erasing its consumed original history', () => {
    const s = ready(); act(s, { type: 'BUY_PAPERS' }); prepare(s, 'paper-trial', 'ABILITY'); act(s, { type: 'PREPARE_PAPER', paperId: 'WK4-PAPER-1-1' }); act(s, { type: 'PERFORM', caseId: 'paper-trial' }, 100); close(s, 'paper-trial');
    const consumed = structuredClone(s.witchKing.life.papers[0]); s.week++; prepare(s, 'paper-trial', 'ABILITY'); act(s, { type: 'WITHDRAW', caseId: 'paper-trial' });
    expect(s.witchKing.life.cases['paper-trial']).toMatchObject({ status: 'OBSERVED', method: null, paperId: null, attemptWeek: 20 }); expect(s.witchKing.life.papers[0]).toEqual(consumed); expect(s.health).toBe(98);
  });
  it('rejects forged originals, future consumption and unknown summoning commands; projections are detached', () => {
    const s = ready(); act(s, { type: 'BUY_PAPERS' }); const view = projectWitchKingLife(s); view.papers[0]!.status = 'CONSUMED'; expect(s.witchKing.life.papers[0]!.status).toBe('HELD'); s.witchKing.life.papers[0]!.source = 'FREE_COPY'; expect(validateWitchKingLife(s)).toBe(false);
    for (const c of [{ type: 'SUMMON_GATE' }, { type: 'PREPARE_PAPER', paperId: 'COPY' }, { type: 'BUY_PAPERS', count: 999 }, { type: 'RETURN', method: 'TELEPORT' }, { type: 'PERFORM', caseId: 'paper-trial', invincible: true }]) expect(validateWitchKingActivityCommand(c)).toBe(false);
    const fresh = ready(); fresh.witchKing.promotionWeek = null; expect(validateWitchKingLife(fresh)).toBe(true); fresh.witchKing.life.target.misses = 1; expect(validateWitchKingLife(fresh)).toBe(false); expect(createWitchKingLifeState().papers).toEqual([]);
  });
});
