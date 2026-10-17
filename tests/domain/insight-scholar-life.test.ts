import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createInsightScholarState } from '../../src/domain/insight-scholar/index.js';
import { applyInsightScholarActivity, blockInsightScholarLife, createInsightScholarLifeState, INSIGHT_SCHOLAR_CASE_IDS, hasInsightScholarLifeLock, projectInsightScholarLife, validateInsightScholarActivityCommand, validateInsightScholarLife, type InsightScholarActivityCommand, type InsightScholarCaseId } from '../../src/domain/insight-scholar/life.js';
const context = (s: SliceState, roll = 1): SeerContext => ({ roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) });
/** Isolated post-promotion setup; the public replay covers the unchanged original reader history. */
function ready(): SliceState {
  const s = createSliceRun('insight-scholar-life', sliceDefaultCreationSelection, 'insight-scholar-life');
  s.insightScholar = createInsightScholarState(); s.week = 20; s.insightScholar.promotionWeek = 19;
  s.progression = { pathwayId: 'white-tower', sequence: 3, acting: 0, promotionWeek: 19, mastery: { 'reader.s3.evidence-link': 0, 'reader.s3.method-analysis': 0 } };
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.health = 100; s.mind = 100; s.spirituality = 120; s.actionsRemaining = 100; s.cash = 1000;
  s.character.coreStats = { physique: 30, perception: 30, will: 30, knowledge: 30 }; return s;
}
function act(s: SliceState, command: InsightScholarActivityCommand, roll = 1) { const ctx = context(s, roll); applyInsightScholarActivity(s, command, ctx); expect(validateInsightScholarLife(s), `${command.type}: ${JSON.stringify(s.insightScholar.life)}`).toBe(true); return ctx; }
function reject(s: SliceState, command: InsightScholarActivityCommand) { const before = structuredClone(s); expect(() => applyInsightScholarActivity(s, command, context(s))).toThrow(); expect(s).toEqual(before); }
const attempt = (s: SliceState, id: InsightScholarCaseId) => s.insightScholar.life.cases[id].attempts.at(-1)!;
function start(s: SliceState, caseId: InsightScholarCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  if (s.insightScholar.life.cases[caseId].status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method }); act(s, { type: 'PERFORM', caseId });
}
function close(s: SliceState, caseId: InsightScholarCaseId) { act(s, { type: 'INSPECT', caseId }); act(s, { type: 'CLOSE', caseId }); }
function copySetup(s: SliceState) { act(s, { type: 'CONSENT_OWNER', caseId: 'copy-discrepancy' }); act(s, { type: 'READ_BOTH', caseId: 'copy-discrepancy' }); }
function copyEvidence(s: SliceState) {
  if (!attempt(s, 'copy-discrepancy').compared) act(s, { type: 'MANUAL_COMPARE', caseId: 'copy-discrepancy' });
  act(s, { type: 'HYPOTHESIZE', caseId: 'copy-discrepancy', hypothesis: 'MISSING_DELIVERY' });
  act(s, { type: 'ASK_OWNER', caseId: 'copy-discrepancy' });
  act(s, { type: 'HYPOTHESIZE', caseId: 'copy-discrepancy', hypothesis: 'COPY_ERROR' });
  act(s, { type: 'VERIFY', caseId: 'copy-discrepancy' });
}
function copyReturn(s: SliceState) { act(s, { type: 'RETURN_PAPERS', caseId: 'copy-discrepancy' }); act(s, { type: 'RETURN_PLAYER', caseId: 'copy-discrepancy' }); }
function methodSetup(s: SliceState) { for (const type of ['CONSENT_OWNER', 'READ_RECORD', 'CONSENT_RECORDER', 'DEMONSTRATE_FIRST'] as const) act(s, { type, caseId: 'known-method' }); }
function methodEvidence(s: SliceState) {
  act(s, { type: 'PREDICT', caseId: 'known-method', prediction: 'LIT' });
  for (const type of ['DEMONSTRATE_SECOND', 'OBSERVE_RESULT', 'REVISE', 'RETURN_BOX'] as const) act(s, { type, caseId: 'known-method' });
}
function routeSetup(s: SliceState) { for (const type of ['CONSENT_OWNER', 'READ_ROUTE', 'SCOUT'] as const) act(s, { type, caseId: 'revised-route' }); }
function routeEvidence(s: SliceState) {
  act(s, { type: 'CHOOSE_ROUTE', caseId: 'revised-route', route: 'SHORT' }); act(s, { type: 'CHOOSE_ROUTE', caseId: 'revised-route', route: 'SIDE' });
  for (const type of ['TAKE_PARCEL', 'RETURN_PLAYER', 'RETURN_PARCEL'] as const) act(s, { type, caseId: 'revised-route' });
}
function finish(s: SliceState, caseId: InsightScholarCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY', roll = 1) {
  start(s, caseId, method);
  if (caseId === 'copy-discrepancy') { copySetup(s); if (method === 'ABILITY') act(s, { type: 'COMPARE', caseId }, roll); copyEvidence(s); copyReturn(s); }
  else if (caseId === 'known-method') { methodSetup(s); if (method === 'ABILITY') act(s, { type: 'ANALYZE', caseId }, roll); methodEvidence(s); }
  else { routeSetup(s); if (method === 'ABILITY') act(s, { type: 'INFER', caseId }, roll); routeEvidence(s); }
  close(s, caseId); act(s, { type: 'REPORT', caseId });
}
function toMethod(s: SliceState) { finish(s, 'copy-discrepancy'); start(s, 'known-method'); }
function toRoute(s: SliceState) { finish(s, 'copy-discrepancy'); finish(s, 'known-method'); start(s, 'revised-route'); }

describe('Insight Scholar candidate G: original evidence, actual demonstrations and revised physical routes', () => {
  it('keeps unique original adults and objects, marks all three extensions G and detaches projection data', () => {
    const s = ready(), l = s.insightScholar.life; expect(validateInsightScholarLife(s)).toBe(true);
    expect(l.fenna).toMatchObject({ id: 'IS3-FENNA', age: 42 }); expect(l.osric).toMatchObject({ id: 'IS3-OSRIC', age: 51, present: true });
    expect(l.box).toMatchObject({ id: 'IS3-BOX', owner: 'IS3-FENNA', charges: 2, demonstrations: 0 });
    const view = projectInsightScholarLife(s); expect(view.title).toContain('候选（G扩展）'); expect(view.story).toContain('未作原著证实'); expect(view.cases.every(c => c.title.includes('G'))).toBe(true);
    view.box.charges = 0; view.original.location = 'PLAYER'; view.cases[0]!.attempts.push({} as never);
    expect(l.box.charges).toBe(2); expect(l.original.location).toBe('DESK'); expect(l.cases['copy-discrepancy'].attempts).toEqual([]);
  });
  it('requires current owner permission and actual reading, and does not leak the owner signature through disabled VERIFY', () => {
    const s = ready(); start(s, 'copy-discrepancy'); reject(s, { type: 'READ_BOTH', caseId: 'copy-discrepancy' }); reject(s, { type: 'COMPARE', caseId: 'copy-discrepancy' });
    const early = projectInsightScholarLife(s); expect(early.cases[0]!.observations.join(' ')).not.toContain('12份已逐项交齐');
    expect(early.actions.find(a => a.command.type === 'VERIFY')?.reason).not.toContain('抄件漏2份');
    copySetup(s); expect(s.insightScholar.life).toMatchObject({ playerLocation: 'DESK', playerTravelMetres: 2, original: { location: 'PLAYER' }, copy: { location: 'PLAYER' } });
    reject(s, { type: 'HYPOTHESIZE', caseId: 'copy-discrepancy', hypothesis: 'COPY_ERROR' }); reject(s, { type: 'VERIFY', caseId: 'copy-discrepancy' });
  });
  it('links only the actual two papers and lets a wrong hypothesis be revised after the owner presents new evidence', () => {
    const s = ready(); start(s, 'copy-discrepancy'); copySetup(s); const original = s.insightScholar.life.original, copy = s.insightScholar.life.copy;
    const ctx = act(s, { type: 'COMPARE', caseId: 'copy-discrepancy' }); expect(ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 18); expect(s.spirituality).toBe(114);
    expect(attempt(s, 'copy-discrepancy')).toMatchObject({ compared: true, ownerEvidenceRead: false, verified: false });
    act(s, { type: 'HYPOTHESIZE', caseId: 'copy-discrepancy', hypothesis: 'MISSING_DELIVERY' }); reject(s, { type: 'HYPOTHESIZE', caseId: 'copy-discrepancy', hypothesis: 'COPY_ERROR' });
    act(s, { type: 'ASK_OWNER', caseId: 'copy-discrepancy' }); expect(s.insightScholar.life.playerLocation).toBe('EXIT'); reject(s, { type: 'VERIFY', caseId: 'copy-discrepancy' });
    act(s, { type: 'HYPOTHESIZE', caseId: 'copy-discrepancy', hypothesis: 'COPY_ERROR' }); act(s, { type: 'VERIFY', caseId: 'copy-discrepancy' }); reject(s, { type: 'CLOSE', caseId: 'copy-discrepancy' });
    copyReturn(s); close(s, 'copy-discrepancy'); act(s, { type: 'REPORT', caseId: 'copy-discrepancy' });
    expect(attempt(s, 'copy-discrepancy').hypothesisHistory).toEqual(['MISSING_DELIVERY', 'COPY_ERROR']); expect(s.insightScholar.life.original).toBe(original); expect(s.insightScholar.life.copy).toBe(copy);
    expect(original.location).toBe('DESK'); expect(copy.location).toBe('DESK'); expect(s.insightScholar.life.playerTravelMetres).toBe(8); expect(s.progression.mastery['reader.s3.evidence-link']).toBe(8);
  });
  it('charges failed evidence-link once and reaches a fully evidenced ordinary conclusion without retrying it', () => {
    const s = ready(); start(s, 'copy-discrepancy'); copySetup(s); act(s, { type: 'COMPARE', caseId: 'copy-discrepancy' }, 100);
    expect(attempt(s, 'copy-discrepancy')).toMatchObject({ abilityTier: 'GREAT_FAILURE', spiritualitySpent: 6, compared: false }); reject(s, { type: 'COMPARE', caseId: 'copy-discrepancy' });
    copyEvidence(s); copyReturn(s); close(s, 'copy-discrepancy'); act(s, { type: 'REPORT', caseId: 'copy-discrepancy' });
    expect(attempt(s, 'copy-discrepancy')).toMatchObject({ manualCompared: true, result: 'ORDINARY', verified: true }); expect(s.spirituality).toBe(114); expect(s.progression.mastery['reader.s3.evidence-link']).toBe(0);
  });
  it('allows ordinary paper evidence and physical return at zero AP and spirituality', () => {
    const s = ready(); start(s, 'copy-discrepancy'); copySetup(s); s.actionsRemaining = 0; s.spirituality = 0;
    reject(s, { type: 'COMPARE', caseId: 'copy-discrepancy' }); copyEvidence(s); copyReturn(s); close(s, 'copy-discrepancy');
    expect(hasInsightScholarLifeLock(s)).toBe(false); expect(s).toMatchObject({ actionsRemaining: 0, spirituality: 0 }); reject(s, { type: 'REPORT', caseId: 'copy-discrepancy' });
  });
  it('honors current owner refusal with no paper movement, no ability charge and an honest ordinary report', () => {
    const s = ready(); s.insightScholar.life.fenna.willing = false; start(s, 'copy-discrepancy'); act(s, { type: 'CONSENT_OWNER', caseId: 'copy-discrepancy' });
    reject(s, { type: 'READ_BOTH', caseId: 'copy-discrepancy' }); close(s, 'copy-discrepancy'); act(s, { type: 'REPORT', caseId: 'copy-discrepancy' });
    expect(attempt(s, 'copy-discrepancy')).toMatchObject({ refused: true, result: 'ORDINARY', verified: false }); expect(s.insightScholar.life.original.location).toBe('DESK'); expect(s.spirituality).toBe(120);
  });
  it('does not reuse owner permission as recorder consent or analyze an operation that was never witnessed', () => {
    const s = ready(); toMethod(s); act(s, { type: 'CONSENT_OWNER', caseId: 'known-method' }); act(s, { type: 'READ_RECORD', caseId: 'known-method' });
    reject(s, { type: 'DEMONSTRATE_FIRST', caseId: 'known-method' }); reject(s, { type: 'ANALYZE', caseId: 'known-method' });
    act(s, { type: 'CONSENT_RECORDER', caseId: 'known-method' }); reject(s, { type: 'ANALYZE', caseId: 'known-method' });
    act(s, { type: 'DEMONSTRATE_FIRST', caseId: 'known-method' }); expect(s.insightScholar.life.box).toMatchObject({ charges: 1, output: 'LIT', demonstrations: 1 });
    expect(blockInsightScholarLife(s, { type: 'ANALYZE', caseId: 'known-method' })).toBeNull();
  });
  it('consumes the same two real stored charges, records an incorrect prediction and corrects understanding only after actual DARK', () => {
    const s = ready(); toMethod(s); methodSetup(s); const box = s.insightScholar.life.box;
    const ctx = act(s, { type: 'ANALYZE', caseId: 'known-method' }); expect(ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 18);
    expect(projectInsightScholarLife(s).cases[1]!.observations.join(' ')).not.toContain('第二次已实际操作');
    reject(s, { type: 'DEMONSTRATE_SECOND', caseId: 'known-method' }); reject(s, { type: 'OBSERVE_RESULT', caseId: 'known-method' }); reject(s, { type: 'REVISE', caseId: 'known-method' });
    act(s, { type: 'PREDICT', caseId: 'known-method', prediction: 'LIT' }); expect(box.output).toBe('LIT');
    act(s, { type: 'DEMONSTRATE_SECOND', caseId: 'known-method' }); expect(box).toMatchObject({ charges: 0, selector: 'DARK', output: 'DARK', demonstrations: 2 });
    reject(s, { type: 'PREDICT', caseId: 'known-method', prediction: 'DARK' }); reject(s, { type: 'REVISE', caseId: 'known-method' });
    act(s, { type: 'OBSERVE_RESULT', caseId: 'known-method' }); act(s, { type: 'REVISE', caseId: 'known-method' }); act(s, { type: 'RETURN_BOX', caseId: 'known-method' });
    close(s, 'known-method'); act(s, { type: 'REPORT', caseId: 'known-method' });
    expect(s.insightScholar.life.box).toBe(box); expect(box).toMatchObject({ id: 'IS3-BOX', owner: 'IS3-FENNA', location: 'OWNER', charges: 0 });
    expect(attempt(s, 'known-method')).toMatchObject({ prediction: 'LIT', revised: true, observedResult: true, demonstrationsPerformed: 2, playerTravelMetres: 6 });
    expect(s.progression.mastery['reader.s3.method-analysis']).toBe(8); expect(s.spirituality).toBe(115);
  });
  it('method-analysis success and failure never change the actual box result or permanently grant its ability', () => {
    const good = ready(), failed = ready();
    for (const [s, roll] of [[good, 1], [failed, 100]] as const) { finish(s, 'copy-discrepancy'); finish(s, 'known-method', 'ABILITY', roll); }
    expect(good.insightScholar.life.box).toEqual(failed.insightScholar.life.box); expect(failed.insightScholar.life.box.charges).toBe(0);
    expect(failed.spirituality).toBe(115); expect(attempt(failed, 'known-method')).toMatchObject({ abilityTier: 'GREAT_FAILURE', result: 'ORDINARY', prediction: 'LIT', revised: true });
    expect(failed.progression.mastery).toEqual({ 'reader.s3.evidence-link': 0, 'reader.s3.method-analysis': 0 });
    expect(failed.polymath).toEqual(good.polymath); expect(failed.mysticismMagister).toEqual(good.mysticismMagister);
  });
  it('ordinary prediction and two actual demonstrations need no ability or spirituality', () => {
    const s = ready(); finish(s, 'copy-discrepancy'); start(s, 'known-method', 'ORDINARY'); s.spirituality = 0; s.actionsRemaining = 0;
    methodSetup(s); methodEvidence(s); close(s, 'known-method'); expect(hasInsightScholarLifeLock(s)).toBe(false); expect(s.insightScholar.life.box.charges).toBe(0); expect(s.spirituality).toBe(0);
  });
  it('respects the original recorder refusal and returns the same unspent original box by a real route', () => {
    const s = ready(); toMethod(s); s.insightScholar.life.osric.willing = false;
    for (const type of ['CONSENT_OWNER', 'READ_RECORD', 'CONSENT_RECORDER'] as const) act(s, { type, caseId: 'known-method' });
    reject(s, { type: 'DEMONSTRATE_FIRST', caseId: 'known-method' }); reject(s, { type: 'ANALYZE', caseId: 'known-method' });
    act(s, { type: 'RETURN_BOX', caseId: 'known-method' }); close(s, 'known-method'); act(s, { type: 'REPORT', caseId: 'known-method' });
    expect(s.insightScholar.life.box).toMatchObject({ charges: 2, demonstrations: 0, location: 'OWNER' }); expect(attempt(s, 'known-method').refused).toBe(true);
  });
  it('honors a recorder withdrawal between demonstrations and does not refund the first charge', () => {
    const s = ready(); toMethod(s); methodSetup(s); act(s, { type: 'PREDICT', caseId: 'known-method', prediction: 'DARK' }); s.insightScholar.life.osric.willing = false;
    reject(s, { type: 'DEMONSTRATE_SECOND', caseId: 'known-method' }); act(s, { type: 'RETURN_BOX', caseId: 'known-method' }); close(s, 'known-method'); act(s, { type: 'REPORT', caseId: 'known-method' });
    expect(s.insightScholar.life.box).toMatchObject({ charges: 1, demonstrations: 1, output: 'LIT' }); expect(attempt(s, 'known-method')).toMatchObject({ refused: true, revised: false, result: 'ORDINARY' });
  });
  it('can abandon after the first real demo then resume next week without recreating charges or rerolling', () => {
    const s = ready(); toMethod(s); methodSetup(s); act(s, { type: 'ANALYZE', caseId: 'known-method' }, 100);
    act(s, { type: 'RETURN_BOX', caseId: 'known-method' }); close(s, 'known-method'); const prior = structuredClone(attempt(s, 'known-method'));
    reject(s, { type: 'PREPARE', caseId: 'known-method', method: 'ORDINARY' }); s.week++;
    reject(s, { type: 'PREPARE', caseId: 'known-method', method: 'ABILITY' }); start(s, 'known-method', 'ORDINARY');
    for (const type of ['CONSENT_OWNER', 'READ_RECORD', 'CONSENT_RECORDER'] as const) act(s, { type, caseId: 'known-method' });
    reject(s, { type: 'DEMONSTRATE_FIRST', caseId: 'known-method' }); methodEvidence(s); close(s, 'known-method'); act(s, { type: 'REPORT', caseId: 'known-method' });
    expect(s.insightScholar.life.box).toMatchObject({ charges: 0, demonstrations: 2 }); expect(s.insightScholar.life.cases['known-method'].attempts[0]).toEqual(prior);
    expect(attempt(s, 'known-method').demonstrationsPerformed).toBe(1); expect(s.spirituality).toBe(115); expect(s.progression.mastery['reader.s3.method-analysis']).toBe(0);
  });
  it('requires reading the actual old map and personally scouting before route inference', () => {
    const s = ready(); toRoute(s); reject(s, { type: 'INFER', caseId: 'revised-route' }); reject(s, { type: 'SCOUT', caseId: 'revised-route' });
    act(s, { type: 'CONSENT_OWNER', caseId: 'revised-route' }); act(s, { type: 'READ_ROUTE', caseId: 'revised-route' }); reject(s, { type: 'INFER', caseId: 'revised-route' });
    act(s, { type: 'SCOUT', caseId: 'revised-route' }); expect(attempt(s, 'revised-route')).toMatchObject({ oldRouteRead: true, scouted: true, playerTravelMetres: 6 }); expect(s.insightScholar.life.playerLocation).toBe('JUNCTION');
  });
  it('lets an actual blocked short-route choice be corrected into a six-metre walk without opening the barrier or teleporting the parcel', () => {
    const s = ready(); toRoute(s); routeSetup(s); const parcel = s.insightScholar.life.parcel, barrier = s.insightScholar.life.barrier;
    act(s, { type: 'INFER', caseId: 'revised-route' }); expect(parcel.location).toBe('STORE'); expect(barrier.state).toBe('CLOSED');
    act(s, { type: 'CHOOSE_ROUTE', caseId: 'revised-route', route: 'SHORT' }); expect(s.insightScholar.life.playerLocation).toBe('JUNCTION'); expect(attempt(s, 'revised-route').playerTravelMetres).toBe(6);
    reject(s, { type: 'TAKE_PARCEL', caseId: 'revised-route' }); reject(s, { type: 'CHOOSE_ROUTE', caseId: 'revised-route', route: 'SHORT' });
    act(s, { type: 'CHOOSE_ROUTE', caseId: 'revised-route', route: 'SIDE' }); expect(s.insightScholar.life.playerLocation).toBe('STORE'); expect(attempt(s, 'revised-route').playerTravelMetres).toBe(12);
    act(s, { type: 'TAKE_PARCEL', caseId: 'revised-route' }); reject(s, { type: 'RETURN_PARCEL', caseId: 'revised-route' });
    act(s, { type: 'RETURN_PLAYER', caseId: 'revised-route' }); expect(attempt(s, 'revised-route').playerTravelMetres).toBe(20); act(s, { type: 'RETURN_PARCEL', caseId: 'revised-route' }); close(s, 'revised-route'); act(s, { type: 'REPORT', caseId: 'revised-route' });
    expect(s.insightScholar.life.parcel).toBe(parcel); expect(s.insightScholar.life.barrier).toBe(barrier); expect(parcel.location).toBe('OWNER'); expect(barrier.state).toBe('CLOSED');
    expect(attempt(s, 'revised-route').routeHistory).toEqual(['SHORT', 'SIDE']); expect(s.progression.mastery['reader.s3.evidence-link']).toBe(8);
  });
  it('failed inference preserves cost and still permits the ordinary real side route at zero resources', () => {
    const s = ready(); toRoute(s); routeSetup(s); act(s, { type: 'INFER', caseId: 'revised-route' }, 100); reject(s, { type: 'INFER', caseId: 'revised-route' }); s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    routeEvidence(s); close(s, 'revised-route'); expect(hasInsightScholarLifeLock(s)).toBe(false);
    expect(attempt(s, 'revised-route')).toMatchObject({ abilityTier: 'GREAT_FAILURE', spiritualitySpent: 6, result: 'ORDINARY', playerTravelMetres: 20 }); expect(s.insightScholar.life.barrier.state).toBe('CLOSED');
  });
  it('can abandon at the actual store with no parcel then walk eight metres out at zero AP, mind and spirituality', () => {
    const s = ready(); toRoute(s); routeSetup(s); act(s, { type: 'CHOOSE_ROUTE', caseId: 'revised-route', route: 'SIDE' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; reject(s, { type: 'CLOSE', caseId: 'revised-route' });
    act(s, { type: 'RETURN_PLAYER', caseId: 'revised-route' }); close(s, 'revised-route'); expect(s.insightScholar.life.parcel.location).toBe('STORE'); expect(s.insightScholar.life.cases['revised-route'].status).toBe('OBSERVED'); expect(hasInsightScholarLifeLock(s)).toBe(false);
  });
  it('finishes three ordinary cases and reflection without any supernatural learning or changes to old reader facts', () => {
    const s = ready(), old = { prophet: structuredClone(s.prophet), polymath: structuredClone(s.polymath), mysticismMagister: structuredClone(s.mysticismMagister) };
    for (const id of INSIGHT_SCHOLAR_CASE_IDS) finish(s, id); act(s, { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(s.actionsRemaining).toBe(87); expect(s.spirituality).toBe(120); expect(s.insightScholar.life.playerTravelMetres).toBe(34);
    expect(s.progression.mastery).toEqual({ 'reader.s3.evidence-link': 0, 'reader.s3.method-analysis': 0 }); expect(s.prophet).toEqual(old.prophet); expect(s.polymath).toEqual(old.polymath); expect(s.mysticismMagister).toEqual(old.mysticismMagister);
    reject(s, { type: 'REPORT', caseId: 'copy-discrepancy' }); reject(s, { type: 'REFLECT' });
  });
  it('awards only the two new limited masteries on actual successful and evidenced reports', () => {
    const s = ready(); for (const id of INSIGHT_SCHOLAR_CASE_IDS) finish(s, id, 'ABILITY'); act(s, { type: 'REFLECT' });
    expect(s.progression.mastery).toEqual({ 'reader.s3.evidence-link': 16, 'reader.s3.method-analysis': 8 }); expect(s.spirituality).toBe(103); expect(s.insightScholar.life.box.charges).toBe(0); expect(hasInsightScholarLifeLock(s)).toBe(false);
  });
  it('requires two AP for preparation, keeps cancellation costs and exposes the real ordinary exit', () => {
    const s = ready(); act(s, { type: 'OBSERVE', caseId: 'copy-discrepancy' }); s.actionsRemaining = 1; reject(s, { type: 'PREPARE', caseId: 'copy-discrepancy', method: 'ABILITY' });
    s.actionsRemaining = 2; act(s, { type: 'PREPARE', caseId: 'copy-discrepancy', method: 'ABILITY' }); expect(hasInsightScholarLifeLock(s)).toBe(true); act(s, { type: 'WITHDRAW', caseId: 'copy-discrepancy' }); expect(s.actionsRemaining).toBe(1); expect(hasInsightScholarLifeLock(s)).toBe(false);
    s.actionsRemaining = 2; start(s, 'copy-discrepancy'); copySetup(s); s.spirituality = 0;
    const view = projectInsightScholarLife(s); expect(view.actions.find(a => a.command.type === 'MANUAL_COMPARE')?.enabled).toBe(true); expect(view.actions.find(a => a.command.type === 'COMPARE')?.enabled).toBe(false);
    reject(s, { type: 'OBSERVE', caseId: 'known-method' }); copyReturn(s); close(s, 'copy-discrepancy'); expect(s.actionsRemaining).toBe(0);
  });
  it('rejects arbitrary targets, extra truth payloads, cross-case actions and premature reports', () => {
    for (const c of [{ type: 'COMPARE', caseId: 'copy-discrepancy', target: 'UNKNOWN_PERSON' }, { type: 'ANALYZE', caseId: 'known-method', learnAll: true }, { type: 'HYPOTHESIZE', caseId: 'copy-discrepancy', hypothesis: 'LIAR' }, { type: 'PREDICT', caseId: 'known-method', prediction: 'COPY_SKILL' }, { type: 'DEMONSTRATE_SECOND', caseId: 'revised-route' }, { type: 'CHOOSE_ROUTE', caseId: 'revised-route', route: 'TELEPORT' }, { type: 'REFLECT', bonus: 100 }]) expect(validateInsightScholarActivityCommand(c)).toBe(false);
    expect(validateInsightScholarActivityCommand({ type: 'CHOOSE_ROUTE', caseId: 'revised-route', route: 'SHORT' })).toBe(true);
    const s = ready(); reject(s, { type: 'REPORT', caseId: 'copy-discrepancy' });
  });
  it('keeps identities and real consumptions valid across a saved-state round trip', () => {
    const s = ready(); for (const id of INSIGHT_SCHOLAR_CASE_IDS) finish(s, id, 'ABILITY', 100); act(s, { type: 'REFLECT' });
    const restored = JSON.parse(JSON.stringify(s)) as SliceState; expect(validateInsightScholarLife(restored)).toBe(true); expect(projectInsightScholarLife(restored)).toEqual(projectInsightScholarLife(s));
    restored.insightScholar.life.box.charges = 2; expect(validateInsightScholarLife(restored)).toBe(false);
    const wrongIdentity = structuredClone(s); wrongIdentity.insightScholar.life.parcel.id = 'SECOND_PARCEL' as never; expect(validateInsightScholarLife(wrongIdentity)).toBe(false);
  });
  it('leaves a pristine life state before promotion and permits real external battle time afterwards', () => {
    const s = ready(); s.insightScholar.promotionWeek = null; expect(validateInsightScholarLife(s)).toBe(true); s.insightScholar.life.clockSeconds++; expect(validateInsightScholarLife(s)).toBe(false);
    s.insightScholar.promotionWeek = 19; expect(validateInsightScholarLife(s)).toBe(true); expect(createInsightScholarLifeState().box.charges).toBe(2);
  });
});
