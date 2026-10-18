import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createJusticeMentorState } from '../../src/domain/justice-mentor/index.js';
import { applyJusticeMentorActivity, blockJusticeMentorLife, createJusticeMentorLifeState, hasJusticeMentorLifeLock, JUSTICE_MENTOR_CASE_IDS, projectJusticeMentorLife, validateJusticeMentorActivityCommand, validateJusticeMentorLife, type JusticeMentorActivityCommand, type JusticeMentorCaseId } from '../../src/domain/justice-mentor/life.js';
const context = (s: SliceState, roll = 1): SeerContext => ({ roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) });
/** Isolated life state; the public campaign replay retains the original sun history. */
function ready(): SliceState {
  const s = createSliceRun('justice-mentor-life', sliceDefaultCreationSelection, 'justice-mentor-life');
  s.justiceMentor = createJusticeMentorState(); s.week = 20; s.justiceMentor.promotionWeek = 19;
  s.progression = { pathwayId: 'sun', sequence: 3, acting: 0, promotionWeek: 19, mastery: { 'sun.s3.shared-radiance': 0, 'sun.s3.clarity-mark': 0, 'sun.s4.purification': 37 } };
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.health = 100; s.mind = 100; s.spirituality = 120; s.actionsRemaining = 100; s.cash = 1000;
  s.character.coreStats = { physique: 30, perception: 30, will: 30, knowledge: 30 }; return s;
}
function act(s: SliceState, command: JusticeMentorActivityCommand, roll = 1) { const ctx = context(s, roll); applyJusticeMentorActivity(s, command, ctx); expect(validateJusticeMentorLife(s), `${command.type}: ${JSON.stringify(s.justiceMentor.life)}`).toBe(true); return ctx; }
function reject(s: SliceState, command: JusticeMentorActivityCommand) { const before = structuredClone(s); expect(() => applyJusticeMentorActivity(s, command, context(s))).toThrow(); expect(s).toEqual(before); }
const attempt = (s: SliceState, id: JusticeMentorCaseId) => s.justiceMentor.life.cases[id].attempts.at(-1)!;
function start(s: SliceState, caseId: JusticeMentorCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  if (s.justiceMentor.life.cases[caseId].status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method }); act(s, { type: 'PERFORM', caseId });
}
function site(s: SliceState, caseId: JusticeMentorCaseId) { act(s, { type: 'CONSENT_OWNER', caseId }); act(s, { type: 'GO_SITE', caseId }); }
function exit(s: SliceState, caseId: JusticeMentorCaseId, close: 'CLOSE' | 'WITHDRAW' = 'CLOSE') {
  if (caseId === 'faded-label' && s.justiceMentor.life.tag.location === 'PLAYER') act(s, { type: 'RETURN_ITEMS', caseId });
  if (s.justiceMentor.life.playerLocation !== 'EXIT') act(s, { type: 'RETURN_PLAYER', caseId });
  act(s, { type: 'INSPECT', caseId }); act(s, { type: close, caseId });
}
function liftSetup(s: SliceState) { site(s, 'paired-lift'); for (const type of ['CONSENT_AYA', 'CONSENT_NIVEN', 'CHECK_ROUTE'] as const) act(s, { type, caseId: 'paired-lift' }); }
function liftFinish(s: SliceState) { for (const type of ['CARRY_CHEST', 'RECEIVE_CHEST', 'RETURN_HELPERS'] as const) act(s, { type, caseId: 'paired-lift' }); }
function labelEvidence(s: SliceState) {
  act(s, { type: 'HYPOTHESIZE', caseId: 'faded-label', hypothesis: 'MISSING_ITEM' });
  for (const type of ['ASK_SELBY', 'ASK_NIVEN', 'READ_REGISTER'] as const) act(s, { type, caseId: 'faded-label' });
  act(s, { type: 'HYPOTHESIZE', caseId: 'faded-label', hypothesis: 'REASSIGNED' }); act(s, { type: 'VERIFY', caseId: 'faded-label' });
}
function sampleSetup(s: SliceState) { site(s, 'shielded-sample'); for (const type of ['CHECK_SCREEN', 'CONSENT_SPIRIT', 'MOVE_SPIRIT'] as const) act(s, { type, caseId: 'shielded-sample' }); }
function finish(s: SliceState, caseId: JusticeMentorCaseId, roll = 1, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  start(s, caseId, method);
  if (caseId === 'paired-lift') { liftSetup(s); if (method === 'ABILITY') act(s, { type: 'ENCOURAGE', caseId }, roll); liftFinish(s); }
  else if (caseId === 'faded-label') { site(s, caseId); if (method === 'ABILITY') act(s, { type: 'REVEAL_GLYPHS', caseId }, roll); if (attempt(s, caseId).glyphs.length === 0) act(s, { type: 'READ_LAMP', caseId }); labelEvidence(s); }
  else { sampleSetup(s); if (method === 'ABILITY') { act(s, { type: 'PURIFY', caseId }, roll); act(s, { type: 'STOP_EFFECT', caseId }); } act(s, { type: 'SEAL_SAMPLE', caseId }); act(s, { type: 'INVITE_SPIRIT_RETURN', caseId }); }
  exit(s, caseId); act(s, { type: 'REPORT', caseId });
}
function toLabel(s: SliceState) { finish(s, 'paired-lift'); start(s, 'faded-label'); }
function toSample(s: SliceState) { finish(s, 'paired-lift'); finish(s, 'faded-label'); start(s, 'shielded-sample'); }

describe('Justice Mentor finite G cooperation, original evidence and inherited purification', () => {
  it('creates separate original adults, original resources and explicitly G techniques', () => {
    const s = ready(), l = s.justiceMentor.life; expect(validateJusticeMentorLife(s)).toBe(true);
    expect(l.selby).toMatchObject({ id: 'JM3-SELBY', age: 48 }); expect(l.aya).toMatchObject({ id: 'JM3-AYA', age: 37, energy: 100 }); expect(l.niven).toMatchObject({ id: 'JM3-NIVEN', age: 44, energy: 100 });
    expect(l.sample).toMatchObject({ id: 'JM3-SAMPLE', quantity: 1, contamination: 2 }); expect(l.lamp.oil).toBe(2); expect(l.seal.remaining).toBe(1);
    const view = projectJusticeMentorLife(s); expect(view.story).toContain('原创G'); expect(view.story).toContain('第三案只继承序列4净化'); expect(view.cases.every(x => x.title.startsWith('G'))).toBe(true);
  });
  it('detaches every projected original object and hides unread glyphs and unknown label conclusions', () => {
    const s = ready(), view = projectJusticeMentorLife(s); expect(JSON.stringify(view)).not.toContain('OLD_BAY'); expect(JSON.stringify(view)).not.toContain('REASSIGNED'); expect(view.tag).not.toHaveProperty('originalGlyphs');
    view.aya.energy = 0; view.sample.contamination = 0; view.seal.remaining = 0; view.screen.placed = true; view.cases[0]!.attempts.push({} as never);
    expect(s.justiceMentor.life.aya.energy).toBe(100); expect(s.justiceMentor.life.sample.contamination).toBe(2); expect(s.justiceMentor.life.seal.remaining).toBe(1); expect(s.justiceMentor.life.screen.placed).toBe(false); expect(s.justiceMentor.life.cases['paired-lift'].attempts).toEqual([]);
  });
  it('physically visits the original owner at BENCH and cannot reuse another person’s permission', () => {
    const s = ready(); start(s, 'paired-lift'); reject(s, { type: 'GO_SITE', caseId: 'paired-lift' }); act(s, { type: 'CONSENT_OWNER', caseId: 'paired-lift' });
    expect(s.justiceMentor.life).toMatchObject({ playerLocation: 'EXIT', playerTravelMetres: 16, clockSeconds: 18 }); expect(s.justiceMentor.life.selby.location).toBe('BENCH');
    act(s, { type: 'GO_SITE', caseId: 'paired-lift' }); act(s, { type: 'CHECK_ROUTE', caseId: 'paired-lift' }); reject(s, { type: 'CARRY_CHEST', caseId: 'paired-lift' });
    act(s, { type: 'CONSENT_AYA', caseId: 'paired-lift' }); reject(s, { type: 'CARRY_CHEST', caseId: 'paired-lift' }); act(s, { type: 'CONSENT_NIVEN', caseId: 'paired-lift' });
    expect(blockJusticeMentorLife(s, { type: 'CARRY_CHEST', caseId: 'paired-lift' })).toBeNull();
  });
  it('moves precisely two original helpers and one original chest eight metres, without replenishing energy', () => {
    const s = ready(); start(s, 'paired-lift'); liftSetup(s); const { aya, niven, chest } = s.justiceMentor.life;
    const ctx = act(s, { type: 'ENCOURAGE', caseId: 'paired-lift' }); expect(ctx.check).toHaveBeenCalledExactlyOnceWith('will', 18); expect(s.spirituality).toBe(114);
    expect([aya.energy, niven.energy]).toEqual([100, 100]); expect(chest.location).toBe('START'); act(s, { type: 'CARRY_CHEST', caseId: 'paired-lift' });
    expect(aya).toMatchObject({ location: 'BENCH', energy: 97, travelMetres: 8 }); expect(niven).toMatchObject({ location: 'BENCH', energy: 97, travelMetres: 8 }); expect(chest).toMatchObject({ location: 'BENCH', custody: 'HELPERS', travelMetres: 8 });
    expect(s.justiceMentor.life.playerLocation).toBe('BENCH'); expect(s.justiceMentor.life.aya).toBe(aya); expect(s.justiceMentor.life.niven).toBe(niven); expect(s.justiceMentor.life.chest).toBe(chest);
    reject(s, { type: 'CARRY_CHEST', caseId: 'paired-lift' }); reject(s, { type: 'RETURN_PLAYER', caseId: 'paired-lift' }); reject(s, { type: 'RETURN_HELPERS', caseId: 'paired-lift' });
    act(s, { type: 'RECEIVE_CHEST', caseId: 'paired-lift' }); act(s, { type: 'RETURN_HELPERS', caseId: 'paired-lift' }); exit(s, 'paired-lift'); act(s, { type: 'REPORT', caseId: 'paired-lift' });
    expect([aya.energy, niven.energy]).toEqual([95, 95]); expect([aya.travelMetres, niven.travelMetres, chest.travelMetres]).toEqual([16, 16, 8]); expect(s.justiceMentor.life.playerTravelMetres).toBe(32); expect(chest).toMatchObject({ location: 'BENCH', custody: 'OWNER' }); expect(s.progression.mastery['sun.s3.shared-radiance']).toBe(8);
  });
  it('charges a failed encouragement once and allows ordinary carrying with real energy costs', () => {
    const s = ready(); start(s, 'paired-lift'); liftSetup(s); act(s, { type: 'ENCOURAGE', caseId: 'paired-lift' }, 100);
    expect(attempt(s, 'paired-lift')).toMatchObject({ abilityTier: 'GREAT_FAILURE', spiritualitySpent: 6, carried: false }); reject(s, { type: 'ENCOURAGE', caseId: 'paired-lift' }); s.spirituality = 0; s.actionsRemaining = 0;
    liftFinish(s); exit(s, 'paired-lift'); expect(s.justiceMentor.life.aya.energy).toBe(92); expect(s.justiceMentor.life.niven.energy).toBe(92); expect(attempt(s, 'paired-lift').result).toBe('ORDINARY'); expect(hasJusticeMentorLifeLock(s)).toBe(false);
    reject(s, { type: 'REPORT', caseId: 'paired-lift' }); s.actionsRemaining = 1; act(s, { type: 'REPORT', caseId: 'paired-lift' }); expect(s.progression.mastery['sun.s3.shared-radiance']).toBe(0);
  });
  it('does not coerce a declining helper or invent a replacement', () => {
    const s = ready(); s.justiceMentor.life.aya.willing = false; start(s, 'paired-lift'); liftSetup(s);
    reject(s, { type: 'ENCOURAGE', caseId: 'paired-lift' }); reject(s, { type: 'CARRY_CHEST', caseId: 'paired-lift' }); exit(s, 'paired-lift'); act(s, { type: 'REPORT', caseId: 'paired-lift' });
    expect(attempt(s, 'paired-lift')).toMatchObject({ refused: true, result: 'ORDINARY', carried: false, abilityTier: null }); expect(s.justiceMentor.life.chest.location).toBe('START'); expect(s.justiceMentor.life.aya.energy).toBe(100); expect(s.spirituality).toBe(120);
  });
  it('requires current helper consent after encouragement and does not award an unused success', () => {
    const s = ready(); start(s, 'paired-lift'); liftSetup(s); act(s, { type: 'ENCOURAGE', caseId: 'paired-lift' }); s.justiceMentor.life.niven.willing = false;
    reject(s, { type: 'CARRY_CHEST', caseId: 'paired-lift' }); exit(s, 'paired-lift'); act(s, { type: 'REPORT', caseId: 'paired-lift' }); expect(s.progression.mastery['sun.s3.shared-radiance']).toBe(0); expect(s.spirituality).toBe(114); expect(s.justiceMentor.life.chest.location).toBe('START');
  });
  it('reserves ordinary return energy even when encouragement succeeds', () => {
    const s = ready(); start(s, 'paired-lift'); liftSetup(s); s.justiceMentor.life.aya.energy = 7;
    reject(s, { type: 'ENCOURAGE', caseId: 'paired-lift' }); reject(s, { type: 'CARRY_CHEST', caseId: 'paired-lift' }); expect(validateJusticeMentorLife(s)).toBe(false);
  });
  it('keeps ordinary custody and return open after the owner and helpers stop cooperation', () => {
    const s = ready(); start(s, 'paired-lift'); liftSetup(s); act(s, { type: 'CARRY_CHEST', caseId: 'paired-lift' }); s.justiceMentor.life.selby.willing = false; s.justiceMentor.life.aya.willing = false; s.justiceMentor.life.niven.willing = false; s.health = 0; s.mind = 0; s.spirituality = 0; s.actionsRemaining = 0;
    act(s, { type: 'STOP_CONTACT', caseId: 'paired-lift' }); act(s, { type: 'RECEIVE_CHEST', caseId: 'paired-lift' }); act(s, { type: 'RETURN_HELPERS', caseId: 'paired-lift' }); exit(s, 'paired-lift'); expect(hasJusticeMentorLifeLock(s)).toBe(false); expect(s.justiceMentor.life.chest.custody).toBe('OWNER'); expect(s.justiceMentor.life.aya.energy).toBe(92);
  });
  it('records owner refusal after a real face-to-face visit and permits an honest ordinary report', () => {
    const s = ready(); s.justiceMentor.life.selby.willing = false; start(s, 'paired-lift'); act(s, { type: 'CONSENT_OWNER', caseId: 'paired-lift' }); reject(s, { type: 'GO_SITE', caseId: 'paired-lift' }); exit(s, 'paired-lift'); act(s, { type: 'REPORT', caseId: 'paired-lift' });
    expect(s.justiceMentor.life.playerTravelMetres).toBe(16); expect(s.justiceMentor.life.clockSeconds).toBe(20); expect(s.justiceMentor.life.chest.travelMetres).toBe(0); expect(s.progression.acting).toBe(25);
  });
  it('does not leak unread glyphs or a corrected hypothesis through disabled action reasons', () => {
    const s = ready(); toLabel(s); site(s, 'faded-label'); const before = JSON.stringify(projectJusticeMentorLife(s)); expect(before).not.toContain('OLD_BAY'); expect(before).not.toContain('REASSIGNED');
    reject(s, { type: 'READ_REGISTER', caseId: 'faded-label' }); reject(s, { type: 'VERIFY', caseId: 'faded-label' }); reject(s, { type: 'HYPOTHESIZE', caseId: 'faded-label', hypothesis: 'REASSIGNED' });
    const ctx = act(s, { type: 'REVEAL_GLYPHS', caseId: 'faded-label' }); expect(ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 18);
    const after = JSON.stringify(projectJusticeMentorLife(s)); expect(after).toContain('OLD_BAY'); expect(after).toContain('SECOND_SHIFT'); expect(after).not.toContain('REASSIGNED'); expect(attempt(s, 'faded-label')).toMatchObject({ glyphs: ['OLD_BAY', 'SECOND_SHIFT'], hypothesis: null, registerRead: false, verified: false });
  });
  it('requires a retained wrong hypothesis, actual witnesses and original record before correction', () => {
    const s = ready(); toLabel(s); site(s, 'faded-label'); act(s, { type: 'REVEAL_GLYPHS', caseId: 'faded-label' });
    reject(s, { type: 'ASK_SELBY', caseId: 'faded-label' }); reject(s, { type: 'HYPOTHESIZE', caseId: 'faded-label', hypothesis: 'REASSIGNED' }); act(s, { type: 'HYPOTHESIZE', caseId: 'faded-label', hypothesis: 'MISSING_ITEM' });
    act(s, { type: 'ASK_SELBY', caseId: 'faded-label' }); reject(s, { type: 'READ_REGISTER', caseId: 'faded-label' }); act(s, { type: 'ASK_NIVEN', caseId: 'faded-label' }); reject(s, { type: 'VERIFY', caseId: 'faded-label' }); reject(s, { type: 'HYPOTHESIZE', caseId: 'faded-label', hypothesis: 'REASSIGNED' });
    act(s, { type: 'READ_REGISTER', caseId: 'faded-label' }); expect(projectJusticeMentorLife(s).actions.some(x => x.command.type === 'HYPOTHESIZE' && x.command.hypothesis === 'REASSIGNED' && x.enabled)).toBe(true);
    act(s, { type: 'HYPOTHESIZE', caseId: 'faded-label', hypothesis: 'REASSIGNED' }); act(s, { type: 'VERIFY', caseId: 'faded-label' }); exit(s, 'faded-label'); act(s, { type: 'REPORT', caseId: 'faded-label' });
    expect(attempt(s, 'faded-label')).toMatchObject({ hypothesisHistory: ['MISSING_ITEM', 'REASSIGNED'], playerTravelMetres: 48, verified: true, result: 'ABILITY' }); expect(s.justiceMentor.life.chest.location).toBe('BENCH'); expect(s.justiceMentor.life.tag.location).toBe('OWNER'); expect(s.justiceMentor.life.register.location).toBe('OWNER'); expect(s.progression.mastery['sun.s3.clarity-mark']).toBe(8);
  });
  it('retains failed mark cost and consumes real original lamp oil for ordinary reading', () => {
    const s = ready(); toLabel(s); site(s, 'faded-label'); act(s, { type: 'REVEAL_GLYPHS', caseId: 'faded-label' }, 100); expect(attempt(s, 'faded-label').glyphs).toEqual([]); reject(s, { type: 'REVEAL_GLYPHS', caseId: 'faded-label' });
    const before = s.justiceMentor.life.clockSeconds; act(s, { type: 'READ_LAMP', caseId: 'faded-label' }); expect(s.justiceMentor.life.clockSeconds - before).toBe(4); expect(s.justiceMentor.life.lamp.oil).toBe(1); reject(s, { type: 'READ_LAMP', caseId: 'faded-label' });
    labelEvidence(s); exit(s, 'faded-label'); act(s, { type: 'REPORT', caseId: 'faded-label' }); expect(attempt(s, 'faded-label')).toMatchObject({ result: 'ORDINARY', spiritualitySpent: 6, lampOilSpent: 1 }); expect(s.progression.mastery['sun.s3.clarity-mark']).toBe(0);
  });
  it('does not grant insight from unavailable ordinary lamp supplies', () => {
    const s = ready(); toLabel(s); site(s, 'faded-label'); s.justiceMentor.life.lamp.oil = 0; reject(s, { type: 'READ_LAMP', caseId: 'faded-label' }); expect(attempt(s, 'faded-label').glyphs).toEqual([]);
  });
  it('requires actual return of both original records and tools, even after permission withdrawal', () => {
    const s = ready(); toLabel(s); site(s, 'faded-label'); s.justiceMentor.life.selby.willing = false; s.spirituality = 0; s.actionsRemaining = 0;
    reject(s, { type: 'RETURN_PLAYER', caseId: 'faded-label' }); reject(s, { type: 'CLOSE', caseId: 'faded-label' }); act(s, { type: 'RETURN_ITEMS', caseId: 'faded-label' }); expect(s.justiceMentor.life.playerLocation).toBe('BENCH'); expect(s.justiceMentor.life.tag.location).toBe('OWNER'); expect(s.justiceMentor.life.register.location).toBe('OWNER');
    exit(s, 'faded-label'); expect(attempt(s, 'faded-label').playerTravelMetres).toBe(32); expect(hasJusticeMentorLifeLock(s)).toBe(false);
  });
  it('respects an unavailable witness rather than forging a record-based conclusion', () => {
    const s = ready(); toLabel(s); site(s, 'faded-label'); act(s, { type: 'REVEAL_GLYPHS', caseId: 'faded-label' }); act(s, { type: 'HYPOTHESIZE', caseId: 'faded-label', hypothesis: 'MISSING_ITEM' }); s.justiceMentor.life.niven.willing = false;
    reject(s, { type: 'ASK_NIVEN', caseId: 'faded-label' }); reject(s, { type: 'READ_REGISTER', caseId: 'faded-label' }); exit(s, 'faded-label'); act(s, { type: 'REPORT', caseId: 'faded-label' }); expect(attempt(s, 'faded-label')).toMatchObject({ verified: false, result: 'ORDINARY', hypothesisHistory: ['MISSING_ITEM'] }); expect(s.progression.mastery['sun.s3.clarity-mark']).toBe(0);
  });
  it('requires the existing friendly spirit to actually leave before any inherited purification', () => {
    const s = ready(); toSample(s); site(s, 'shielded-sample'); reject(s, { type: 'PURIFY', caseId: 'shielded-sample' }); act(s, { type: 'CHECK_SCREEN', caseId: 'shielded-sample' }); reject(s, { type: 'PURIFY', caseId: 'shielded-sample' }); act(s, { type: 'CONSENT_SPIRIT', caseId: 'shielded-sample' });
    expect(s.justiceMentor.life.elm.location).toBe('TABLE'); reject(s, { type: 'PURIFY', caseId: 'shielded-sample' }); act(s, { type: 'MOVE_SPIRIT', caseId: 'shielded-sample' }); expect(s.justiceMentor.life.elm).toMatchObject({ id: 'JM3-ELM', friendly: true, location: 'SIDE', travelMetres: 4 }); expect(s.justiceMentor.life.playerLocation).toBe('TABLE');
    const ctx = act(s, { type: 'PURIFY', caseId: 'shielded-sample' }); expect(ctx.check).toHaveBeenCalledExactlyOnceWith('will', 18); expect(s.justiceMentor.life.sample.contamination).toBe(0); expect(attempt(s, 'shielded-sample').lightActive).toBe(true);
  });
  it('uses the same sample, box and one seal and grants only inherited purification mastery', () => {
    const s = ready(); toSample(s); sampleSetup(s); const original = s.justiceMentor.life.sample, elm = s.justiceMentor.life.elm;
    act(s, { type: 'PURIFY', caseId: 'shielded-sample' }); reject(s, { type: 'SEAL_SAMPLE', caseId: 'shielded-sample' }); reject(s, { type: 'INVITE_SPIRIT_RETURN', caseId: 'shielded-sample' }); reject(s, { type: 'RETURN_PLAYER', caseId: 'shielded-sample' });
    act(s, { type: 'STOP_EFFECT', caseId: 'shielded-sample' }); expect(elm.location).toBe('SIDE'); act(s, { type: 'SEAL_SAMPLE', caseId: 'shielded-sample' }); expect(original).toMatchObject({ quantity: 1, contamination: 0, location: 'BOX', boxId: 'JM3-SAMPLE-BOX', sealed: true }); expect(s.justiceMentor.life.sample).toBe(original); expect(s.justiceMentor.life.seal.remaining).toBe(0);
    reject(s, { type: 'SEAL_SAMPLE', caseId: 'shielded-sample' }); reject(s, { type: 'RETURN_PLAYER', caseId: 'shielded-sample' }); act(s, { type: 'INVITE_SPIRIT_RETURN', caseId: 'shielded-sample' }); expect(elm).toMatchObject({ location: 'TABLE', travelMetres: 8 }); exit(s, 'shielded-sample'); act(s, { type: 'REPORT', caseId: 'shielded-sample' });
    expect(s.progression.mastery['sun.s4.purification']).toBe(45); expect(Object.keys(s.progression.mastery).filter(x => x.startsWith('sun.s3.')).sort()).toEqual(['sun.s3.clarity-mark', 'sun.s3.shared-radiance']); expect(attempt(s, 'shielded-sample')).toMatchObject({ playerTravelMetres: 24, spiritTravelMetres: 8, sealSpent: 1, result: 'ABILITY' });
  });
  it('does not relabel failed purification as clean when sealing the original strength-two sample', () => {
    const s = ready(); toSample(s); sampleSetup(s); act(s, { type: 'PURIFY', caseId: 'shielded-sample' }, 100); reject(s, { type: 'PURIFY', caseId: 'shielded-sample' }); s.spirituality = 0; s.actionsRemaining = 0;
    act(s, { type: 'STOP_EFFECT', caseId: 'shielded-sample' }); act(s, { type: 'SEAL_SAMPLE', caseId: 'shielded-sample' }); act(s, { type: 'INVITE_SPIRIT_RETURN', caseId: 'shielded-sample' }); exit(s, 'shielded-sample');
    expect(s.justiceMentor.life.sample).toMatchObject({ contamination: 2, sealed: true, location: 'BOX' }); expect(s.justiceMentor.life.seal.remaining).toBe(0); expect(attempt(s, 'shielded-sample')).toMatchObject({ abilityTier: 'GREAT_FAILURE', spiritualitySpent: 6, result: 'ORDINARY' }); s.actionsRemaining = 1; act(s, { type: 'REPORT', caseId: 'shielded-sample' }); expect(s.progression.mastery['sun.s4.purification']).toBe(37);
  });
  it('respects initial spirit refusal and completes ordinary containment without casting', () => {
    const s = ready(); toSample(s); site(s, 'shielded-sample'); act(s, { type: 'CHECK_SCREEN', caseId: 'shielded-sample' }); s.justiceMentor.life.elm.willing = false; act(s, { type: 'CONSENT_SPIRIT', caseId: 'shielded-sample' });
    reject(s, { type: 'MOVE_SPIRIT', caseId: 'shielded-sample' }); reject(s, { type: 'PURIFY', caseId: 'shielded-sample' }); act(s, { type: 'SEAL_SAMPLE', caseId: 'shielded-sample' }); exit(s, 'shielded-sample'); act(s, { type: 'REPORT', caseId: 'shielded-sample' });
    expect(s.justiceMentor.life.elm).toMatchObject({ location: 'TABLE', travelMetres: 0 }); expect(s.justiceMentor.life.sample).toMatchObject({ contamination: 2, sealed: true }); expect(attempt(s, 'shielded-sample').abilityTier).toBeNull(); expect(s.progression.mastery['sun.s4.purification']).toBe(37);
  });
  it('does not cast using revoked spirit consent and allows the original spirit to remain at SIDE', () => {
    const s = ready(); toSample(s); sampleSetup(s); s.justiceMentor.life.elm.willing = false; reject(s, { type: 'PURIFY', caseId: 'shielded-sample' }); act(s, { type: 'SEAL_SAMPLE', caseId: 'shielded-sample' }); act(s, { type: 'INVITE_SPIRIT_RETURN', caseId: 'shielded-sample' }); exit(s, 'shielded-sample'); act(s, { type: 'REPORT', caseId: 'shielded-sample' });
    expect(s.justiceMentor.life.elm).toMatchObject({ location: 'SIDE', travelMetres: 4 }); expect(attempt(s, 'shielded-sample')).toMatchObject({ spiritDisposition: 'STAY_SIDE', spiritTravelMetres: 4, result: 'ORDINARY', abilityTier: null }); expect(hasJusticeMentorLifeLock(s)).toBe(false);
  });
  it('permits a voluntary refusal to return after a real successful purification without teleporting the spirit', () => {
    const s = ready(); toSample(s); sampleSetup(s); act(s, { type: 'PURIFY', caseId: 'shielded-sample' }); act(s, { type: 'STOP_EFFECT', caseId: 'shielded-sample' }); act(s, { type: 'SEAL_SAMPLE', caseId: 'shielded-sample' }); s.justiceMentor.life.elm.willing = false;
    act(s, { type: 'INVITE_SPIRIT_RETURN', caseId: 'shielded-sample' }); exit(s, 'shielded-sample'); act(s, { type: 'REPORT', caseId: 'shielded-sample' }); expect(s.justiceMentor.life.elm.location).toBe('SIDE'); expect(s.progression.mastery['sun.s4.purification']).toBe(45); expect(hasJusticeMentorLifeLock(s)).toBe(false);
  });
  it('checks the actual original screen rather than granting friendly immunity by identity', () => {
    const s = ready(); toSample(s); site(s, 'shielded-sample'); s.justiceMentor.life.screen.intact = false; reject(s, { type: 'CHECK_SCREEN', caseId: 'shielded-sample' }); reject(s, { type: 'PURIFY', caseId: 'shielded-sample' }); act(s, { type: 'SEAL_SAMPLE', caseId: 'shielded-sample' }); exit(s, 'shielded-sample');
    expect(s.justiceMentor.life.sample.contamination).toBe(2); expect(s.justiceMentor.life.elm.location).toBe('TABLE');
  });
  it('charges exactly four one-AP stages per case and one reflection, preserving all original costs', () => {
    const s = ready(), old = structuredClone({ unshadowed: s.unshadowed, priestOfLight: s.priestOfLight });
    for (const id of JUSTICE_MENTOR_CASE_IDS) finish(s, id); expect(s.actionsRemaining).toBe(88); expect(s.spirituality).toBe(102); expect(s.progression.acting).toBe(75); act(s, { type: 'REFLECT' });
    expect(s.actionsRemaining).toBe(87); expect(s.progression.acting).toBe(100); expect(s.justiceMentor.life).toMatchObject({ playerLocation: 'EXIT', playerTravelMetres: 104, clockSeconds: 171, reflected: true }); expect(s.justiceMentor.life.aya.energy).toBe(95); expect(s.justiceMentor.life.lamp.oil).toBe(2); expect(s.justiceMentor.life.seal.remaining).toBe(0);
    expect({ unshadowed: s.unshadowed, priestOfLight: s.priestOfLight }).toEqual(old); reject(s, { type: 'REFLECT' }); for (const id of JUSTICE_MENTOR_CASE_IDS) reject(s, { type: 'REPORT', caseId: id }); expect(s.progression.mastery).toEqual({ 'sun.s3.shared-radiance': 8, 'sun.s3.clarity-mark': 8, 'sun.s4.purification': 45 });
  });
  it('supports all three ordinary paths without a single random check or magical mastery', () => {
    const s = ready(); for (const id of JUSTICE_MENTOR_CASE_IDS) finish(s, id, 100, 'ORDINARY'); act(s, { type: 'REFLECT' });
    expect(s.spirituality).toBe(120); expect(s.justiceMentor.life.aya.energy).toBe(92); expect(s.justiceMentor.life.lamp.oil).toBe(1); expect(s.justiceMentor.life.sample).toMatchObject({ contamination: 2, sealed: true }); expect(s.progression.mastery).toEqual({ 'sun.s3.shared-radiance': 0, 'sun.s3.clarity-mark': 0, 'sun.s4.purification': 37 });
    expect(JUSTICE_MENTOR_CASE_IDS.every(id => attempt(s, id).abilityTier === null && attempt(s, id).result === 'ORDINARY')).toBe(true);
  });
  it('leaves failed checks paid when a later-week ordinary attempt resumes unfinished original work', () => {
    const s = ready(); start(s, 'paired-lift'); liftSetup(s); act(s, { type: 'ENCOURAGE', caseId: 'paired-lift' }, 100); exit(s, 'paired-lift', 'WITHDRAW');
    expect(s.justiceMentor.life.cases['paired-lift'].status).toBe('OBSERVED'); reject(s, { type: 'REPORT', caseId: 'paired-lift' }); reject(s, { type: 'PREPARE', caseId: 'paired-lift', method: 'ORDINARY' }); s.week++;
    reject(s, { type: 'PREPARE', caseId: 'paired-lift', method: 'ABILITY' }); start(s, 'paired-lift', 'ORDINARY'); reject(s, { type: 'GO_SITE', caseId: 'paired-lift' }); liftSetup(s); reject(s, { type: 'ENCOURAGE', caseId: 'paired-lift' }); liftFinish(s); exit(s, 'paired-lift'); act(s, { type: 'REPORT', caseId: 'paired-lift' });
    expect(s.justiceMentor.life.cases['paired-lift'].attempts).toHaveLength(2); expect(s.spirituality).toBe(114); expect(s.justiceMentor.life.aya.energy).toBe(92); expect(s.progression.mastery['sun.s3.shared-radiance']).toBe(0);
  });
  it('blocks last-AP preparation and permits paid preparation withdrawal without a refund', () => {
    const s = ready(); act(s, { type: 'OBSERVE', caseId: 'paired-lift' }); s.actionsRemaining = 1; reject(s, { type: 'PREPARE', caseId: 'paired-lift', method: 'ABILITY' }); s.actionsRemaining = 4;
    for (let n = 0; n < 2; n++) { act(s, { type: 'PREPARE', caseId: 'paired-lift', method: 'ABILITY' }); expect(hasJusticeMentorLifeLock(s)).toBe(true); act(s, { type: 'WITHDRAW', caseId: 'paired-lift' }); }
    expect(s.actionsRemaining).toBe(2); expect(s.justiceMentor.life.cases['paired-lift'].withdrawals).toBe(2); expect(hasJusticeMentorLifeLock(s)).toBe(false);
  });
  it('enforces ordered cases, current city, original prior-scene closure and the living promoted player', () => {
    const s = ready(); reject(s, { type: 'OBSERVE', caseId: 'faded-label' }); reject(s, { type: 'REFLECT' }); s.world.city = 'ELSEWHERE'; reject(s, { type: 'OBSERVE', caseId: 'paired-lift' }); s.world.city = 'BACKLUND';
    s.unshadowed.ritual.playerLocation = 'HALL'; reject(s, { type: 'OBSERVE', caseId: 'paired-lift' }); s.unshadowed.ritual.playerLocation = 'OUTSIDE'; s.progression.sequence = 4; reject(s, { type: 'OBSERVE', caseId: 'paired-lift' }); s.progression.sequence = 3; s.status = 'DEAD'; reject(s, { type: 'OBSERVE', caseId: 'paired-lift' });
  });
  it('rejects malformed commands, cross-case abilities and injected fields', () => {
    for (const command of [null, [], {}, { type: 'REFLECT', caseId: 'paired-lift' }, { type: 'PURIFY', caseId: 'paired-lift' }, { type: 'HYPOTHESIZE', caseId: 'faded-label', hypothesis: 'INNOCENT' }, { type: 'PREPARE', caseId: 'paired-lift', method: 'FREE' }, { type: 'CARRY_CHEST', caseId: 'paired-lift', helpers: 3 }, { type: 'MOVE_SPIRIT', caseId: 'shielded-sample', friendlyImmune: true }]) expect(validateJusticeMentorActivityCommand(command)).toBe(false);
    expect(validateJusticeMentorActivityCommand({ type: 'HYPOTHESIZE', caseId: 'faded-label', hypothesis: 'MISSING_ITEM' })).toBe(true); expect(validateJusticeMentorActivityCommand({ type: 'REFLECT' })).toBe(true);
  });
  it('validates a pristine unpromoted state and rejects pre-created work or identities', () => {
    const s = ready(); s.justiceMentor.promotionWeek = null; expect(validateJusticeMentorLife(s)).toBe(true); s.justiceMentor.life.clockSeconds = 1; expect(validateJusticeMentorLife(s)).toBe(false); s.justiceMentor.life = createJusticeMentorLifeState(); expect(validateJusticeMentorLife(s)).toBe(true);
    (s.justiceMentor.life.aya as unknown as { id: string }).id = 'UD4-ALDEN'; expect(validateJusticeMentorLife(s)).toBe(false);
  });
  it('rejects forged resources, travel, extra helpers, altered evidence and free sample purification', () => {
    const original = ready(); for (const id of JUSTICE_MENTOR_CASE_IDS) finish(original, id, 100); act(original, { type: 'REFLECT' });
    const corruptions: ((s: SliceState) => void)[] = [
      s => { s.justiceMentor.life.aya.energy++; }, s => { s.justiceMentor.life.niven.travelMetres = 0; }, s => { s.justiceMentor.life.chest.travelMetres = 16; }, s => { s.justiceMentor.life.chest.location = 'START'; },
      s => { (s.justiceMentor.life as unknown as Record<string, unknown>).thirdHelper = {}; }, s => { s.justiceMentor.life.playerTravelMetres--; }, s => { s.justiceMentor.life.clockSeconds--; },
      s => { s.justiceMentor.life.lamp.oil = 2; }, s => { s.justiceMentor.life.sample.contamination = 0; }, s => { s.justiceMentor.life.seal.remaining = 1; }, s => { s.justiceMentor.life.sample.quantity = 2 as never; },
      s => { attempt(s, 'faded-label').hypothesisHistory = ['REASSIGNED']; }, s => { attempt(s, 'faded-label').registerRead = false; }, s => { attempt(s, 'paired-lift').spiritualitySpent = 0; }, s => { attempt(s, 'shielded-sample').spiritTravelMetres = 0; },
      s => { attempt(s, 'shielded-sample').lightActive = true; }, s => { s.progression.acting = 99; }, s => { s.seer.completedSources.push('justice-mentor-reflection'); },
    ];
    for (const corrupt of corruptions) { const s = structuredClone(original); corrupt(s); expect(validateJusticeMentorLife(s)).toBe(false); }
  });
  it('allows separately elapsed encounter seconds without erasing paid life time', () => {
    const s = ready(); for (const id of JUSTICE_MENTOR_CASE_IDS) finish(s, id); act(s, { type: 'REFLECT' });
    const lifeSeconds = s.justiceMentor.life.clockSeconds;
    // The encounter adapter advances this shared clock by 60 seconds per real round.
    s.justiceMentor.life.clockSeconds += 60;
    expect(validateJusticeMentorLife(s)).toBe(true);
    expect(projectJusticeMentorLife(s).clockSeconds).toBe(lifeSeconds + 60);
    s.justiceMentor.life.clockSeconds = lifeSeconds - 1;
    expect(validateJusticeMentorLife(s)).toBe(false);
  });
  it('does not allow repeat checks or completed stories to manufacture fresh people or supplies', () => {
    const s = ready(); for (const id of JUSTICE_MENTOR_CASE_IDS) finish(s, id); const before = structuredClone(s.justiceMentor.life); s.week++;
    for (const id of JUSTICE_MENTOR_CASE_IDS) { reject(s, { type: 'OBSERVE', caseId: id }); reject(s, { type: 'PREPARE', caseId: id, method: 'ABILITY' }); }
    expect(s.justiceMentor.life).toEqual(before); expect(validateJusticeMentorLife(s)).toBe(true);
  });
});
