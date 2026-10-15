import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createIronBloodKnightState } from '../../src/domain/iron-blood-knight/index.js';
import { IRON_BLOOD_KNIGHT_ABILITY_IDS } from '../../src/domain/iron-blood-knight/types.js';
import { applyIronBloodTeamCommand, findIronBloodMember, validateIronBloodTeamState } from '../../src/domain/iron-blood-knight/team.js';
import {
  applyIronBloodActivity, blockIronBloodActivity, createIronBloodLifeState, ironBloodActions, ironBloodInside,
  projectIronBloodLife, validateIronBloodActivityCommand, validateIronBloodLife, IRON_BLOOD_CASE_IDS,
  type IronBloodActivityCommand, type IronBloodCaseId,
} from '../../src/domain/iron-blood-knight/life.js';

const previous = JSON.parse(readFileSync('tests/fixtures/reaper-v0960/natural.json', 'utf8'));
const context = (s: SliceState, roll = 1): SeerContext => ({ roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) });
/** Explicit post-promotion unit fixture; real promotion and all thirty histories are exercised by the separate natural route. */
function ready(): SliceState {
  const s = migrateSliceState(structuredClone(previous.practiced)); s.ironBloodKnight = createIronBloodKnightState();
  s.ironBloodKnight.guidanceKnown = true; s.activeEvent = null; s.eventQueue = []; s.combat = null; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.health = 100; s.mind = 100; s.spirituality = 120; s.actionsRemaining = 100; s.weeklyBudget = 100; s.cash = 30000;
  s.character.coreStats.physique = 30; s.character.coreStats.perception = 30;
  applyIronBloodTeamCommand(s, { type: 'JOIN_COHORT', cohortId: 'G1' }, context(s));
  s.progression.sequence = 4; s.progression.acting = 0; s.progression.promotionWeek = s.week;
  s.ironBloodKnight.promotionWeek = s.week; s.ironBloodKnight.reaperActingAtPromotion = 100;
  for (const id of IRON_BLOOD_KNIGHT_ABILITY_IDS) s.progression.mastery[id] = 0;
  return s;
}
function act(s: SliceState, c: IronBloodActivityCommand, roll = 1) { const ctx = context(s, roll); applyIronBloodActivity(s, c, ctx); expect(validateIronBloodLife(s)).toBe(true); expect(validateIronBloodTeamState(s)).toBe(true); return ctx; }
function reject(s: SliceState, c: unknown) { const before = structuredClone(s), ctx = context(s); expect(() => applyIronBloodActivity(s, c as IronBloodActivityCommand, ctx)).toThrow(); expect(s).toEqual(before); expect(ctx.check).not.toHaveBeenCalled(); expect(ctx.roll).not.toHaveBeenCalled(); }
function nextWeek(s: SliceState) { s.week++; s.date = addGameWeeks(s.date, 1); }
function begin(s: SliceState, caseId: IronBloodCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY', roll = 1) {
  if (s.ironBloodKnight.life.cases[caseId].status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method }); act(s, { type: 'PERFORM', caseId }, roll);
}
function close(s: SliceState, caseId: IronBloodCaseId) {
  const f = s.ironBloodKnight.life.practice;
  if (caseId === 'flame-clearance') act(s, { type: 'RETURN_ORDINARY' }); else act(s, { type: 'RETURN_TOOL' });
  if (f.form !== 'HUMAN') act(s, { type: 'EXIT_FORM' });
  if (caseId === 'linked-carry' && findIronBloodMember(s, 'IB4-01')!.present) act(s, { type: 'STOP_LINK' });
  act(s, { type: 'CLOSE', caseId });
}
function ordinary(s: SliceState, id: IronBloodCaseId) { begin(s, id); if (id === 'linked-carry') act(s, { type: 'LOAD_PULSE' }); close(s, id); act(s, { type: 'REPORT', caseId: id }); }
const mastery = (s: SliceState) => Object.values(s.progression.mastery).reduce((sum, value) => sum + value, 0);

describe('Iron Blood Knight finite original life practice', () => {
  it('retains exact original tools, cold three-metre ground and semantic SQLite key order', () => {
    const s = ready(), fresh = createIronBloodLifeState(); expect(fresh.practice.beam).toMatchObject({ id: 'IB4-BEAM-1', massKg: 12, holder: 'CRADLE' });
    expect(fresh.practice.crate).toMatchObject({ id: 'IB4-CRATE-1', massKg: 14, holder: 'CRADLE' }); expect(fresh.practice.route.distanceMetres).toBe(3);
    expect(validateIronBloodLife(JSON.parse(stableStringify(s)))).toBe(true); const beforePromotion = migrateSliceState(structuredClone(previous.practiced));
    expect(validateIronBloodLife(beforePromotion)).toBe(true); expect(validateIronBloodLife(JSON.parse(stableStringify(beforePromotion)))).toBe(true);
  });
  it('actually pays steel posture, holds the one beam and requires real return plus explicit form exit', () => {
    const s = ready(), sp = s.spirituality, ap = s.actionsRemaining, total = mastery(s); begin(s, 'steel-load', 'ABILITY');
    expect(s.spirituality).toBe(sp - 3); expect(s.actionsRemaining).toBe(ap - 3); expect(s.ironBloodKnight.life.practice).toMatchObject({ form: 'STEEL', beam: { holder: 'OWNER' } });
    reject(s, { type: 'CLOSE', caseId: 'steel-load' }); reject(s, { type: 'REPORT', caseId: 'steel-load' });
    act(s, { type: 'RETURN_TOOL' }); reject(s, { type: 'CLOSE', caseId: 'steel-load' }); act(s, { type: 'EXIT_FORM' }); act(s, { type: 'CLOSE', caseId: 'steel-load' });
    act(s, { type: 'REPORT', caseId: 'steel-load' }); expect(mastery(s) - total).toBe(8); expect(s.progression.acting).toBe(25);
    expect(s.ironBloodKnight.life.practice.beam).toMatchObject({ id: 'IB4-BEAM-1', massKg: 12, holder: 'CRADLE' });
  });
  it('steel failure causes actual damage, retains cost and permits zero-resource cleanup', () => {
    const s = ready(), health = s.health, sp = s.spirituality; begin(s, 'steel-load', 'ABILITY', 100);
    expect(s.health).toBe(health - 2); expect(s.spirituality).toBe(sp - 3); s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    close(s, 'steel-load'); expect(ironBloodInside(s)).toBe(false); expect(s.mind).toBe(0); expect(s.health).toBe(health - 2);
    s.actionsRemaining = 10; s.mind = 100; reject(s, { type: 'REPORT', caseId: 'steel-load' }); reject(s, { type: 'PREPARE', caseId: 'steel-load', method: 'ORDINARY' });
    nextWeek(s); ordinary(s, 'steel-load');
  });
  it('ordinary comparisons finish all three and reflection without magic mastery', () => {
    const s = ready(), total = mastery(s), sp = s.spirituality;
    for (const id of IRON_BLOOD_CASE_IDS) ordinary(s, id); act(s, { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(mastery(s)).toBe(total); expect(s.spirituality).toBe(sp); expect(s.health).toBe(96);
    expect(s.ironBloodKnight.life.reflected).toBe(true); reject(s, { type: 'REFLECT' }); reject(s, { type: 'REPORT', caseId: 'linked-carry' });
    expect(findIronBloodMember(s, 'IB4-01')!.health).toBe(100); expect(ironBloodInside(s)).toBe(false);
  });
  it('the two original members only arrive on paid implementation, then actually share once', () => {
    const s = ready(); ordinary(s, 'steel-load'); const original = findIronBloodMember(s, 'IB4-01')!, sp = s.spirituality;
    act(s, { type: 'OBSERVE', caseId: 'linked-carry' }); act(s, { type: 'PREPARE', caseId: 'linked-carry', method: 'ABILITY' });
    expect(original.present).toBe(false); act(s, { type: 'PERFORM', caseId: 'linked-carry' }); expect(findIronBloodMember(s, 'IB4-01')).toBe(original);
    expect(s.ironBloodKnight.team.members.filter(m => m.present).map(m => m.id)).toEqual(['IB4-01', 'IB4-02']);
    act(s, { type: 'START_LINK' }); expect(s.spirituality).toBe(sp - 3); reject(s, { type: 'START_LINK' }); act(s, { type: 'LOAD_PULSE' });
    expect(s.health).toBe(98); expect(original.health).toBe(99); expect(findIronBloodMember(s, 'IB4-02')!.health).toBe(99);
    expect(s.ironBloodKnight.life.cases['linked-carry'].pulse).toEqual({ ownerDamage: 2, memberIds: ['IB4-01', 'IB4-02'], memberDamage: 1 });
    reject(s, { type: 'LOAD_PULSE' }); s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    act(s, { type: 'STOP_LINK' }); expect(original).toMatchObject({ health: 99, present: false, location: 'HOME' });
    reject(s, { type: 'CLOSE', caseId: 'linked-carry' }); act(s, { type: 'RETURN_TOOL' }); act(s, { type: 'CLOSE', caseId: 'linked-carry' });
    expect(ironBloodInside(s)).toBe(false); expect(original.health).toBe(99); s.actionsRemaining = 1; s.mind = 100; const total = mastery(s); act(s, { type: 'REPORT', caseId: 'linked-carry' }); expect(mastery(s) - total).toBe(8);
  });
  it('a prepared link rechecks current health and consent before actual arrival', () => {
    const s = ready(); ordinary(s, 'steel-load'); act(s, { type: 'OBSERVE', caseId: 'linked-carry' });
    const m = findIronBloodMember(s, 'IB4-02')!; m.willing = false; reject(s, { type: 'PREPARE', caseId: 'linked-carry', method: 'ABILITY' }); m.willing = true;
    act(s, { type: 'PREPARE', caseId: 'linked-carry', method: 'ABILITY' }); m.health = 79; reject(s, { type: 'PERFORM', caseId: 'linked-carry' });
    expect(m.present).toBe(false); act(s, { type: 'WITHDRAW', caseId: 'linked-carry' }); ordinary(s, 'linked-carry'); expect(m.health).toBe(79);
  });
  it('capacity and invited bodies alone never share damage without an actual link', () => {
    const s = ready(); ordinary(s, 'steel-load'); begin(s, 'linked-carry', 'ABILITY'); const total = mastery(s);
    act(s, { type: 'LOAD_PULSE' }); expect(s.health).toBe(96); expect(findIronBloodMember(s, 'IB4-01')!.health).toBe(100);
    expect(s.ironBloodKnight.life.cases['linked-carry'].result).toBe('ORDINARY'); reject(s, { type: 'START_LINK' });
    close(s, 'linked-carry'); act(s, { type: 'REPORT', caseId: 'linked-carry' }); expect(mastery(s)).toBe(total);
  });
  it('leaving a link before its pulse does not refund spirituality or invent shared damage', () => {
    const s = ready(); ordinary(s, 'steel-load'); begin(s, 'linked-carry', 'ABILITY'); const sp = s.spirituality;
    act(s, { type: 'START_LINK' }); act(s, { type: 'STOP_LINK' }); reject(s, { type: 'START_LINK' }); act(s, { type: 'LOAD_PULSE' });
    expect(s.spirituality).toBe(sp - 3); expect(s.health).toBe(96); expect(findIronBloodMember(s, 'IB4-01')!.health).toBe(100); close(s, 'linked-carry');
  });
  it('an aborted actual link can be prepared ordinarily next week without refunding its cost or closing history', () => {
    const s = ready(); ordinary(s, 'steel-load'); begin(s, 'linked-carry', 'ABILITY'); const sp = s.spirituality, attemptWeek = s.week;
    act(s, { type: 'START_LINK' }); act(s, { type: 'STOP_LINK' }); close(s, 'linked-carry');
    expect(s.ironBloodKnight.life.cases['linked-carry']).toMatchObject({ result: 'NONE', closes: 1, attemptWeek, linkStarted: true });
    nextWeek(s); act(s, { type: 'PREPARE', caseId: 'linked-carry', method: 'ORDINARY' });
    expect(s.ironBloodKnight.life.cases['linked-carry']).toMatchObject({ result: 'NONE', closes: 1, attemptWeek, linkStarted: false });
    expect(s.spirituality).toBe(sp - 3); expect(findIronBloodMember(s, 'IB4-01')!).toMatchObject({ health: 100, present: false });
    act(s, { type: 'PERFORM', caseId: 'linked-carry' }); act(s, { type: 'LOAD_PULSE' }); close(s, 'linked-carry'); act(s, { type: 'REPORT', caseId: 'linked-carry' });
    expect(s.health).toBe(96); expect(s.spirituality).toBe(sp - 3); expect(s.ironBloodKnight.life.cases['linked-carry'].closes).toBe(2);
  });
  it('flame form travels the original ground route in two independently paid legs', () => {
    const s = ready(); ordinary(s, 'steel-load'); ordinary(s, 'linked-carry'); begin(s, 'flame-clearance', 'ABILITY');
    const f = s.ironBloodKnight.life.practice, clothes = structuredClone(f.clothes), sp = s.spirituality;
    expect(f.ownerNode).toBe('NEAR'); act(s, { type: 'FLAME_OUT' }); expect(f).toMatchObject({ form: 'FLAME', ownerNode: 'FAR' });
    reject(s, { type: 'CLOSE', caseId: 'flame-clearance' }); reject(s, { type: 'FLAME_OUT' }); act(s, { type: 'FLAME_BACK' });
    expect(f.ownerNode).toBe('NEAR'); expect(s.spirituality).toBe(sp - 6); expect(f.clothes).toEqual(clothes); reject(s, { type: 'CLOSE', caseId: 'flame-clearance' });
    act(s, { type: 'EXIT_FORM' }); act(s, { type: 'CLOSE', caseId: 'flame-clearance' }); act(s, { type: 'REPORT', caseId: 'flame-clearance' });
  });
  it('failed return preserves the far-end original body and permits real ordinary return at zero resources', () => {
    const s = ready(); ordinary(s, 'steel-load'); ordinary(s, 'linked-carry'); begin(s, 'flame-clearance', 'ABILITY'); act(s, { type: 'FLAME_OUT' });
    const sp = s.spirituality; act(s, { type: 'FLAME_BACK' }, 100); expect(s.spirituality).toBe(sp - 3); expect(s.ironBloodKnight.life.practice.ownerNode).toBe('FAR');
    reject(s, { type: 'FLAME_BACK' }); s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; act(s, { type: 'EXIT_FORM' });
    expect(s.ironBloodKnight.life.practice.ownerNode).toBe('FAR'); reject(s, { type: 'CLOSE', caseId: 'flame-clearance' });
    act(s, { type: 'RETURN_ORDINARY' }); act(s, { type: 'CLOSE', caseId: 'flame-clearance' }); expect(ironBloodInside(s)).toBe(false);
  });
  it('failed outward movement never grants a capability result or a same-week retry', () => {
    const s = ready(); ordinary(s, 'steel-load'); ordinary(s, 'linked-carry'); begin(s, 'flame-clearance', 'ABILITY');
    act(s, { type: 'FLAME_OUT' }, 100); expect(s.ironBloodKnight.life.practice.ownerNode).toBe('NEAR'); close(s, 'flame-clearance');
    reject(s, { type: 'REPORT', caseId: 'flame-clearance' }); reject(s, { type: 'PREPARE', caseId: 'flame-clearance', method: 'ORDINARY' });
    nextWeek(s); ordinary(s, 'flame-clearance'); expect(s.ironBloodKnight.life.cases['flame-clearance'].result).toBe('ORDINARY');
  });
  it('reports actual public state and cleanup commands without exposing mutable references', () => {
    const s = ready(); begin(s, 'steel-load', 'ABILITY'); const view = projectIronBloodLife(s);
    expect(view.insideCase).toBe(true); expect(view.practice.form).toBe('STEEL'); expect(view.cases[0]!.observations.join(' ')).toContain('12公斤');
    expect(ironBloodActions(s).find(a => a.command.type === 'RETURN_TOOL')).toMatchObject({ enabled: true, cost: '0行动 · 0灵性' });
    view.practice.beam.holder = 'CRADLE'; expect(s.ironBloodKnight.life.practice.beam.holder).toBe('OWNER');
  });
  it('rejects forged objects, forms, rewards and command extras while accepting SQLite key sorting', () => {
    const s = ready(); ordinary(s, 'steel-load'); expect(validateIronBloodLife(JSON.parse(stableStringify(s)))).toBe(true);
    const forged = structuredClone(s); forged.ironBloodKnight.life.practice.beam.massKg = 14 as 12; expect(validateIronBloodLife(forged)).toBe(false);
    const form = structuredClone(s); form.ironBloodKnight.life.practice.form = 'STEEL'; expect(validateIronBloodLife(form)).toBe(false);
    const extraReward = structuredClone(s); extraReward.seer.completedSources.push('iron-blood-case:steel-load'); expect(validateIronBloodLife(extraReward)).toBe(false);
    expect(validateIronBloodActivityCommand({ type: 'FLAME_OUT', target: 'MOON' })).toBe(false); expect(validateIronBloodActivityCommand({ type: 'PREPARE', caseId: 'steel-load', method: 'FREE' })).toBe(false);
  });
  it('keeps current ritual and ready encounters mutually exclusive with life practice', () => {
    const s = ready(); s.ironBloodKnight.encounter.status = 'READY'; reject(s, { type: 'OBSERVE', caseId: 'steel-load' });
    expect(blockIronBloodActivity(s, { type: 'OBSERVE', caseId: 'steel-load' })).toContain('遭遇');
  });
});
