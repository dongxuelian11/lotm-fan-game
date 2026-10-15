import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createBlathererState } from '../../src/domain/blatherer/index.js';
import { advanceBlathererLifeClock, applyBlathererActivity, blockBlathererLife, createBlathererLifeState, hasBlathererLifeLock, projectBlathererLife, BLATHERER_CASE_IDS, blathererLifeActions, validateBlathererActivityCommand, validateBlathererLife, type BlathererActivityCommand, type BlathererCaseId } from '../../src/domain/blatherer/life.js';

const ABILITY = 'abyss.s3.limited-murmur';
const context = (s: SliceState, roll = 1): SeerContext => ({ roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) });
/** Isolated directed fixture. It does not claim a natural promotion or naturally successful whisper. */
function ready(): SliceState {
  const s = createSliceRun('blatherer-life', sliceDefaultCreationSelection, 'blatherer-life');
  s.blatherer = createBlathererState(); s.week = 140; s.blatherer.promotionWeek = 139; s.blatherer.devilActingAtPromotion = 100;
  s.progression = { pathwayId: 'abyss', sequence: 3, acting: 0, promotionWeek: 139, mastery: { [ABILITY]: 0, 'abyss.s4.mental-corrosion': 17 } };
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.world.city = 'BACKLUND'; s.health = 100; s.mind = 100; s.spirituality = 120; s.actionsRemaining = 100; s.cash = 1000; s.injuries = [];
  s.character.coreStats = { physique: 30, perception: 30, will: 30, knowledge: 30 }; return s;
}
function act(s: SliceState, command: BlathererActivityCommand, roll = 1) { const ctx = context(s, roll); applyBlathererActivity(s, command, ctx); expect(validateBlathererLife(s), command.type).toBe(true); return ctx; }
function step(s: SliceState, caseId: BlathererCaseId, type: Exclude<BlathererActivityCommand['type'], 'PREPARE' | 'REFLECT'>, roll = 1) { return act(s, { type, caseId } as BlathererActivityCommand, roll); }
function reject(s: SliceState, command: BlathererActivityCommand) { const before = structuredClone(s), ctx = context(s); expect(() => applyBlathererActivity(s, command, ctx)).toThrow(); expect(s).toEqual(before); expect(ctx.check).not.toHaveBeenCalled(); }
const attempt = (s: SliceState, id: BlathererCaseId) => s.blatherer.life.cases[id].attempts.at(-1)!;
function start(s: SliceState, id: BlathererCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { step(s, id, 'OBSERVE'); act(s, { type: 'PREPARE', caseId: id, method }); step(s, id, 'START_CASE'); }
function evidence(s: SliceState, id: BlathererCaseId) { for (const type of ['GO_A', 'READ_CARD', 'WALK_B', 'READ_BELL', 'RETURN_A'] as const) step(s, id, type); }
function finish(s: SliceState, id: BlathererCaseId) { step(s, id, 'RECORD_OUTCOME'); if (s.blatherer.life.card.location === 'PLAYER') step(s, id, 'RETURN_CARD'); for (const type of ['RETURN_START', 'LEAVE_CASE', 'REPORT_CASE'] as const) step(s, id, type); }
function complete(s: SliceState, id: BlathererCaseId, roll = 1, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  start(s, id, method); evidence(s, id);
  if (method === 'ABILITY') { if (id === 'open-corridor') step(s, id, 'ASK_GUIDE_LEAVE'); step(s, id, 'CONSENT_NORA'); step(s, id, 'WHISPER', roll); step(s, id, 'STOP_VOICE'); step(s, id, 'WAIT_CLEAR'); }
  if (id === 'withdrawn-invitation') step(s, id, 'ASK_CURRENT_ANSWER');
  if (method === 'ORDINARY' || !['SUCCESS', 'GREAT_SUCCESS'].includes(String(attempt(s, id).whisperTier))) step(s, id, 'ORDINARY_CHECK');
  finish(s, id);
}

describe('Blatherer finite voice, current consent and physical cleanup', () => {
  it('starts with distinct original adult, card, bell and note and preserves the inferred canon boundary', () => {
    const s = ready(); expect(s.blatherer.life).toEqual(createBlathererLifeState()); expect(validateBlathererLife(s)).toBe(true);
    expect(s.blatherer.life.volunteer).toMatchObject({ id: 'BL3-NORA', name: '诺拉·温特', age: 46, location: 'A' });
    expect(s.blatherer.life.card).toMatchObject({ id: 'BL3-CARD', owner: 'BL3-NORA', quantity: 1, location: 'NORA' });
    expect(s.blatherer.life.bell.id).toBe('BL3-BELL'); expect(s.blatherer.life.note.id).toBe('BL3-NOTE');
    expect(projectBlathererLife(s).story).toContain('推断'); expect(projectBlathererLife(s).story).toContain('G');
  });
  it('START_CASE only opens the scene; no automatic speech, consent, movement or resource charge', () => {
    const s = ready(); start(s, 'conflicting-bell'); expect(s.actionsRemaining).toBe(98); expect(s.spirituality).toBe(120); expect(s.mind).toBe(100);
    expect(attempt(s, 'conflicting-bell')).toMatchObject({ consent: 'UNASKED', whisperTier: null, steps: [], resolutionPaid: false });
    reject(s, { type: 'WHISPER', caseId: 'conflicting-bell' }); reject(s, { type: 'READ_CARD', caseId: 'conflicting-bell' });
  });
  it('requires physical source comparison and actual return to the current listener before casting', () => {
    const s = ready(); start(s, 'conflicting-bell'); step(s, 'conflicting-bell', 'GO_A'); step(s, 'conflicting-bell', 'READ_CARD');
    reject(s, { type: 'WHISPER', caseId: 'conflicting-bell' }); step(s, 'conflicting-bell', 'WALK_B'); step(s, 'conflicting-bell', 'READ_BELL');
    reject(s, { type: 'CONSENT_NORA', caseId: 'conflicting-bell' }); reject(s, { type: 'RETURN_START', caseId: 'conflicting-bell' });
    step(s, 'conflicting-bell', 'RETURN_A'); step(s, 'conflicting-bell', 'CONSENT_NORA'); const ctx = step(s, 'conflicting-bell', 'WHISPER');
    expect(ctx.check).toHaveBeenCalledWith('knowledge', 18); expect(s.spirituality).toBe(116); expect(s.mind).toBe(99); expect(s.actionsRemaining).toBe(97);
    expect(attempt(s, 'conflicting-bell')).toMatchObject({ voiceActive: true, residualSeconds: 30, spiritualitySpent: 4, mindSpent: 1, whisperSourceId: 'BL3-NORA' });
    expect(s.health).toBe(100); reject(s, { type: 'WHISPER', caseId: 'conflicting-bell' });
  });
  for (const [roll, tier, succeeds] of [[1, 'GREAT_SUCCESS', true], [30, 'SUCCESS', true], [85, 'FAILURE', false], [100, 'GREAT_FAILURE', false]] as const) {
    it(`preserves ${tier} cost and records only its actual finite outcome`, () => {
      const s = ready(); complete(s, 'conflicting-bell', roll); expect(attempt(s, 'conflicting-bell').whisperTier).toBe(tier);
      expect(s.actionsRemaining).toBe(96); expect(s.spirituality).toBe(116); expect(s.mind).toBe(99); expect(s.progression.mastery[ABILITY]).toBe(succeeds ? 8 : 0);
      expect(attempt(s, 'conflicting-bell').waitedSeconds).toBe(succeeds ? 30 : 0); expect(attempt(s, 'conflicting-bell').ordinaryChecked).toBe(!succeeds);
    });
  }
  it('STOP_VOICE ends new input without removing successful hesitation; actual wait is mandatory', () => {
    const s = ready(); start(s, 'conflicting-bell'); evidence(s, 'conflicting-bell'); step(s, 'conflicting-bell', 'CONSENT_NORA'); step(s, 'conflicting-bell', 'WHISPER');
    const before = s.blatherer.life.clockSeconds; step(s, 'conflicting-bell', 'STOP_VOICE'); expect(attempt(s, 'conflicting-bell')).toMatchObject({ voiceActive: false, residualSeconds: 30, waitedSeconds: 0 });
    expect(s.blatherer.life.clockSeconds).toBe(before); reject(s, { type: 'RECORD_OUTCOME', caseId: 'conflicting-bell' }); reject(s, { type: 'LEAVE_CASE', caseId: 'conflicting-bell' });
    step(s, 'conflicting-bell', 'WAIT_CLEAR'); expect(s.blatherer.life.clockSeconds).toBe(before + 30); expect(attempt(s, 'conflicting-bell').residualSeconds).toBe(0);
    reject(s, { type: 'WAIT_CLEAR', caseId: 'conflicting-bell' }); finish(s, 'conflicting-bell');
  });
  it('withdraws consent after the invitation attempt, retains the original card and prevents reuse', () => {
    const s = ready(); complete(s, 'conflicting-bell'); start(s, 'withdrawn-invitation'); evidence(s, 'withdrawn-invitation');
    expect(s.blatherer.life.card.location).toBe('NORA'); step(s, 'withdrawn-invitation', 'CONSENT_NORA'); step(s, 'withdrawn-invitation', 'WHISPER');
    expect(attempt(s, 'withdrawn-invitation').consent).toBe('REVOKED'); expect(attempt(s, 'withdrawn-invitation').residualSeconds).toBe(30);
    reject(s, { type: 'WHISPER', caseId: 'withdrawn-invitation' }); reject(s, { type: 'CONSENT_NORA', caseId: 'withdrawn-invitation' }); reject(s, { type: 'RETURN_CARD', caseId: 'withdrawn-invitation' });
    for (const type of ['STOP_VOICE', 'WAIT_CLEAR', 'ASK_CURRENT_ANSWER'] as const) step(s, 'withdrawn-invitation', type);
    expect(attempt(s, 'withdrawn-invitation').currentAnswer).toBe('DECLINED'); finish(s, 'withdrawn-invitation'); expect(s.blatherer.life.card.location).toBe('NORA');
  });
  it('does not charge or cast through a friendly bystander; guide must really walk outside', () => {
    const s = ready(); complete(s, 'conflicting-bell'); complete(s, 'withdrawn-invitation'); start(s, 'open-corridor'); evidence(s, 'open-corridor'); step(s, 'open-corridor', 'CONSENT_NORA');
    expect(s.blatherer.life.guide.location).toBe('B'); const before = { s: s.spirituality, m: s.mind, ap: s.actionsRemaining };
    reject(s, { type: 'WHISPER', caseId: 'open-corridor' }); expect({ s: s.spirituality, m: s.mind, ap: s.actionsRemaining }).toEqual(before);
    const time = s.blatherer.life.clockSeconds; step(s, 'open-corridor', 'ASK_GUIDE_LEAVE'); expect(s.blatherer.life.guide.location).toBe('OUTSIDE');
    expect(s.blatherer.life.clockSeconds - time).toBe(12); expect(s.blatherer.life.guide.moves.at(-2)).toMatchObject({ from: 'B', to: 'START', metres: 8, seconds: 8 });
    step(s, 'open-corridor', 'WHISPER'); expect(attempt(s, 'open-corridor').whisperTier).toBe('GREAT_SUCCESS');
  });
  it('all ordinary routes take exactly thirteen AP, use original evidence, and add no imaginary mastery', () => {
    const s = ready(); s.spirituality = 0; for (const id of BLATHERER_CASE_IDS) complete(s, id, 1, 'ORDINARY'); act(s, { type: 'REFLECT' });
    expect(s.actionsRemaining).toBe(87); expect(s.spirituality).toBe(0); expect(s.mind).toBe(100); expect(s.progression.acting).toBe(100); expect(s.progression.mastery[ABILITY]).toBe(0);
    expect(s.blatherer.life.playerTravelMetres).toBe(48); expect(s.blatherer.life.card).toMatchObject({ location: 'NORA', owner: 'BL3-NORA', travelMetres: 16 });
    expect(hasBlathererLifeLock(s)).toBe(false); for (const id of BLATHERER_CASE_IDS) expect(attempt(s, id)).toMatchObject({ whisperTier: null, result: 'ORDINARY', ordinaryChecked: true });
  });
  it('three successful bounded demonstrations retain all costs, old people and moral strain', () => {
    const s = ready(), old = structuredClone({ criminal: s.criminal, unwinged: s.unwinged, serialKiller: s.serialKiller, demon: s.demon, desireApostle: s.desireApostle, devil: s.devil });
    for (const id of BLATHERER_CASE_IDS) complete(s, id); act(s, { type: 'REFLECT' });
    expect(s.actionsRemaining).toBe(87); expect(s.spirituality).toBe(108); expect(s.mind).toBe(97); expect(s.progression.acting).toBe(100); expect(s.progression.mastery[ABILITY]).toBe(24);
    expect({ criminal: s.criminal, unwinged: s.unwinged, serialKiller: s.serialKiller, demon: s.demon, desireApostle: s.desireApostle, devil: s.devil }).toEqual(old);
    reject(s, { type: 'REFLECT' }); reject(s, { type: 'REPORT_CASE', caseId: 'conflicting-bell' });
  });
  it('returns original card and actual body at zero AP, mind and spirituality after an honest outcome', () => {
    const s = ready(); start(s, 'conflicting-bell'); evidence(s, 'conflicting-bell'); step(s, 'conflicting-bell', 'CONSENT_NORA'); step(s, 'conflicting-bell', 'WHISPER');
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    for (const type of ['STOP_VOICE', 'WAIT_CLEAR', 'RECORD_OUTCOME'] as const) step(s, 'conflicting-bell', type);
    reject(s, { type: 'RETURN_START', caseId: 'conflicting-bell' }); step(s, 'conflicting-bell', 'RETURN_CARD'); step(s, 'conflicting-bell', 'RETURN_START'); step(s, 'conflicting-bell', 'LEAVE_CASE');
    expect(hasBlathererLifeLock(s)).toBe(false); expect(s.actionsRemaining).toBe(0); expect(s.mind).toBe(0); expect(s.spirituality).toBe(0); reject(s, { type: 'REPORT_CASE', caseId: 'conflicting-bell' });
  });
  it('an actual refusal disables voice and leaves the truthful ordinary route available', () => {
    const s = ready(); start(s, 'conflicting-bell'); evidence(s, 'conflicting-bell'); s.blatherer.life.volunteer.willing = false; const ctx = step(s, 'conflicting-bell', 'CONSENT_NORA');
    expect(ctx.check).not.toHaveBeenCalled(); expect(attempt(s, 'conflicting-bell').consent).toBe('DECLINED'); reject(s, { type: 'WHISPER', caseId: 'conflicting-bell' });
    step(s, 'conflicting-bell', 'ORDINARY_CHECK'); finish(s, 'conflicting-bell'); expect(s.progression.mastery[ABILITY]).toBe(0);
  });
  it('reserves a first-resolution AP before opening and permits zero AP preparation cancellation', () => {
    const s = ready(); step(s, 'conflicting-bell', 'OBSERVE'); s.actionsRemaining = 1; reject(s, { type: 'PREPARE', caseId: 'conflicting-bell', method: 'ABILITY' });
    s.actionsRemaining = 2; act(s, { type: 'PREPARE', caseId: 'conflicting-bell', method: 'ABILITY' }); step(s, 'conflicting-bell', 'WITHDRAW'); expect(s.actionsRemaining).toBe(1); expect(hasBlathererLifeLock(s)).toBe(false);
  });
  it('projects failed-resource speech with explicit ordinary fallback and no nonexistent ability result', () => {
    const s = ready(); start(s, 'conflicting-bell'); evidence(s, 'conflicting-bell'); step(s, 'conflicting-bell', 'CONSENT_NORA'); s.spirituality = 3;
    expect(blathererLifeActions(s).find(v => v.command.type === 'WHISPER')).toMatchObject({ enabled: false }); expect(blathererLifeActions(s).find(v => v.command.type === 'ORDINARY_CHECK')).toMatchObject({ enabled: true });
    expect(blockBlathererLife(s, { type: 'WHISPER', caseId: 'conflicting-bell' })).toContain('4灵性');
  });
  it('rejects invented fields, wrong case commands, fabricated sources and remote speech', () => {
    for (const value of [{ type: 'WHISPER', caseId: 'conflicting-bell', targetId: 'ANYONE' }, { type: 'ASK_GUIDE_LEAVE', caseId: 'conflicting-bell' }, { type: 'ASK_CURRENT_ANSWER', caseId: 'open-corridor' }, { type: 'CURE_MADNESS', caseId: 'conflicting-bell' }, { type: 'REFLECT', caseId: 'conflicting-bell' }]) expect(validateBlathererActivityCommand(value)).toBe(false);
  });
  it('replays original identity, movement, source, consent, wait, paid first-resolution and exact outcomes', () => {
    const s = ready(); for (const id of BLATHERER_CASE_IDS) complete(s, id); act(s, { type: 'REFLECT' }); expect(validateBlathererLife(JSON.parse(JSON.stringify(s)) as SliceState)).toBe(true);
    const changes: ((t: SliceState) => void)[] = [
      t => { t.blatherer.life.card.id = 'COPY' as 'BL3-CARD'; }, t => { t.blatherer.life.card.location = 'PLAYER'; }, t => { t.blatherer.life.volunteer.age = 16 as 46; },
      t => { attempt(t, 'conflicting-bell').whisperSourceId = null; }, t => { attempt(t, 'conflicting-bell').spiritualitySpent = 0; }, t => { attempt(t, 'conflicting-bell').mindSpent = 0; },
      t => { attempt(t, 'conflicting-bell').waitedSeconds = 0; }, t => { attempt(t, 'conflicting-bell').playerMoves[1]!.metres = 0; }, t => { attempt(t, 'conflicting-bell').steps[0]!.atSecond++; },
      t => { attempt(t, 'withdrawn-invitation').currentAnswer = 'ACCEPTED' as 'DECLINED'; }, t => { attempt(t, 'withdrawn-invitation').consent = 'GRANTED'; },
      t => { t.blatherer.life.guide.location = 'B'; }, t => { t.blatherer.life.clockSeconds++; }, t => { t.progression.mastery[ABILITY] = 0; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(validateBlathererLife(t)).toBe(false); }
  });
  it('does not heal or move a dead body and rejects nonfinite unaccounted clock changes', () => {
    const s = ready(); start(s, 'conflicting-bell'); step(s, 'conflicting-bell', 'GO_A'); s.health = 0; s.status = 'DEAD'; expect(validateBlathererLife(s)).toBe(true);
    reject(s, { type: 'WITHDRAW', caseId: 'conflicting-bell' }); reject(s, { type: 'RETURN_START', caseId: 'conflicting-bell' });
    expect(() => advanceBlathererLifeClock(s, -1)).toThrow(); expect(() => advanceBlathererLifeClock(s, 0.5)).toThrow();
  });
});
