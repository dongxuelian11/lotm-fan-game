import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyAncientAlchemistCommand, createAncientAlchemistState } from '../../src/domain/ancient-alchemist/index.js';
import { ANCIENT_ALCHEMIST_ABILITY_IDS } from '../../src/domain/ancient-alchemist/types.js';
import {
  ANCIENT_ALCHEMIST_CASE_IDS, ANCIENT_ALCHEMIST_LIFE_ENVIRONMENT,
  applyAncientAlchemistActivity, createAncientAlchemistLifeState, ancientAlchemistActivityReason,
  ancientAlchemistLifeActions, projectAncientAlchemistLife, validateAncientAlchemistLife,
  validateAncientAlchemistActivityCommand, hasAncientAlchemistLifeLock,
  getAncientAlchemistGuardSegment, consumeAncientAlchemistGuardSegment, availableAncientAlchemistGuard,
  type AncientAlchemistActivityCommand, type AncientAlchemistCaseId, type AncientAlchemistLifeAbilityId,
} from '../../src/domain/ancient-alchemist/life.js';

// Explicit directed unit fixtures; all old natural history is retained, fixed rolls are not natural-play claims.
function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((id: AncientAlchemistLifeAbilityId, amount = 8) => { s.progression.mastery[id] = (s.progression.mastery[id] ?? 0) + amount; });
  return { ctx, award };
}
function setWeek(s: SliceState, week: number) { s.date = addGameWeeks(s.date, week - s.week); s.week = week; }
function previous() {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/druid-v01160/natural.json', 'utf8')).final);
  s.ancientAlchemist = createAncientAlchemistState(); setWeek(s, Math.max(s.week, s.druid.promotionWeek! + 12));
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.actionsRemaining = 200; s.weeklyBudget = 200; s.cash = 40000; s.health = 100; s.mind = 100; s.spirituality = 100;
  s.character.coreStats.will = 28; s.character.coreStats.knowledge = 28;
  return s;
}
function promoted() {
  const s = previous(), { ctx } = context(s), id = s.ancientAlchemist.bottles[0]!.id;
  applyAncientAlchemistCommand(s, { type: 'LEARN_GUIDANCE' }, ctx);
  applyAncientAlchemistCommand(s, { type: 'BUY_POTION', bottleId: id }, ctx);
  applyAncientAlchemistCommand(s, { type: 'CONSUME', bottleId: id, confirmed: true }, ctx);
  expect(validateAncientAlchemistLife(s)).toBe(true); return s;
}
function act(s: SliceState, command: AncientAlchemistActivityCommand, roll = 1) {
  const c = context(s, roll); applyAncientAlchemistActivity(s, command, c.ctx, c.award);
  expect(validateAncientAlchemistLife(s), `invalid after ${JSON.stringify(command)}`).toBe(true); return c;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyAncientAlchemistActivity(s, command as AncientAlchemistActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: AncientAlchemistCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  const l = s.ancientAlchemist.life;
  if (l.cases[caseId].status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  if (caseId !== 'honest-handover' && !l.kits.some(k => k.status === 'PLAYER' && k.caseId === caseId)) act(s, { type: 'BUY_KIT', caseId, kitId: l.kits.find(k => k.status === 'SUPPLIER')!.id });
  act(s, { type: 'PREPARE', caseId, method });
}
function close(s: SliceState, caseId: AncientAlchemistCaseId, test = true) {
  const a = s.ancientAlchemist.life.cases[caseId].attempts.at(-1)!;
  if (caseId === 'living-stem') { if (!a.observationHours) act(s, { type: 'OBSERVE_RECOVERY', caseId }); if (!a.returned) act(s, { type: 'RETURN_SAMPLE', caseId }); }
  if (caseId === 'living-fibre') {
    if (!a.stopped) { if (test && !a.tested) act(s, { type: 'TEST_MATRIX', caseId }); act(s, { type: 'STOP_MATRIX', caseId }); }
    if (!a.returned) act(s, { type: 'RETURN_SAMPLE', caseId });
  }
  if (caseId === 'honest-handover' && !a.returned) act(s, { type: 'HAND_OVER', caseId });
  return act(s, { type: 'CLOSE', caseId });
}
function finish(s: SliceState, caseId: AncientAlchemistCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); act(s, { type: 'PERFORM', caseId }); close(s, caseId); return act(s, { type: 'REPORT', caseId });
}
function ready(caseId: AncientAlchemistCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  const s = promoted(); for (const id of ANCIENT_ALCHEMIST_CASE_IDS) { if (id === caseId) break; finish(s, id); }
  begin(s, caseId, method); return s;
}
function nextWeek(s: SliceState) { setWeek(s, s.week + 1); s.actionsRemaining = 200; s.mind = 100; s.spirituality = 100; }
function originals(s: SliceState) { return structuredClone([s.cultivator, s.physician, s.harvestpriest, s.biologist, s.druid, s.character, s.combatHistory, s.world, s.town]); }
const notes = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(call => call.join(' ')).join(' ');
function makeGuard(s: SliceState) { act(s, { type: 'PREPARE_GUARD', kitId: s.ancientAlchemist.life.guardKits.find(k => k.status === 'SUPPLIER')!.id }); return s.ancientAlchemist.life.guards.at(-1)!; }
function spendGuard(s: SliceState) { for (let n = 0; n < 3; n += 1) { const p = getAncientAlchemistGuardSegment(s)!; expect(consumeAncientAlchemistGuardSegment(s, p.guardId, p.segmentId)).toBe(true); } }

describe('Ancient Alchemist finite life, actual original materials and guard segments', () => {
  it('keeps a dormant exact baseline, discloses G limits, and does not mutate old domains or grant a free guard', () => {
    const old = previous(); expect(old.ancientAlchemist.life).toEqual(createAncientAlchemistLifeState()); expect(validateAncientAlchemistLife(old)).toBe(true);
    expect(ancientAlchemistLifeActions(old)).toEqual([]); expect(projectAncientAlchemistLife(old)).toEqual({ cases: [], insideCase: false, environment: '', practice: null });
    const s = promoted(), before = structuredClone(s), p = projectAncientAlchemistLife(s);
    expect(p.cases.map(c => c.id)).toEqual([...ANCIENT_ALCHEMIST_CASE_IDS]); expect(p.cases.every(c => c.observations.length === 0)).toBe(true); expect(s).toEqual(before);
    expect(s.ancientAlchemist.life.kits).toHaveLength(3); expect(s.ancientAlchemist.life.guardKits).toHaveLength(3); expect(s.ancientAlchemist.life.guards).toEqual([]); expect(getAncientAlchemistGuardSegment(s)).toBeNull();
    for (const phrase of ['原创G', '现实实验教程', '灵魂创造', '复活', '无限物', '原马伦结局', '无自动补充']) expect(ANCIENT_ALCHEMIST_LIFE_ENVIRONMENT).toContain(phrase);
  });

  it('completes ordinary cases in fifteen AP with two paid kits, real six hours/sixty seconds/routes, and no mastery', () => {
    const s = promoted(), old = originals(s), ap = s.actionsRemaining, cash = s.cash, spirit = s.spirituality, mastery = structuredClone(s.progression.mastery);
    for (const id of ANCIENT_ALCHEMIST_CASE_IDS) expect(finish(s, id).award).not.toHaveBeenCalled(); act(s, { type: 'REFLECT' });
    expect(ap - s.actionsRemaining).toBe(15); expect(cash - s.cash).toBe(160); expect(s.spirituality).toBe(spirit); expect(s.progression.acting).toBe(100); expect(s.progression.mastery).toEqual(mastery);
    expect(s.ancientAlchemist.life.stem).toMatchObject({ id: 'AA4-STEM-1', potId: 'AA4-POT-1', living: true, position: 'GUIDE_BENCH', holder: 'GUIDE', damage: 'SUPPORTED', observationHours: 6, returns: 1 });
    expect(s.ancientAlchemist.life.matrices[0]).toMatchObject({ id: 'AA4-MATRIX-1', kitId: 'AA4-KIT-2', state: 'WOVEN_PAD', test: 'ORDINARY_SUPPORT', elapsedSeconds: 60, remainingSeconds: 0, holder: 'GUIDE_WASTE', stopped: true });
    expect(s.ancientAlchemist.life.record).toMatchObject({ id: 'AA4-RECORD-1', holder: 'NORA', distanceMetres: 4, handovers: 1 });
    expect(s.ancientAlchemist.life.cases['living-fibre'].attempts[0]!.distanceMetres).toBe(2); expect(originals(s)).toEqual(old); expect(hasAncientAlchemistLifeLock(s)).toBe(false);
    reject(s, { type: 'REPORT', caseId: 'living-stem' }); reject(s, { type: 'REFLECT' });
  });

  it('awards the two new IDs only after genuine paid ability results and actual cleanup, while third ability entry stays ordinary', () => {
    const s = promoted(), old = originals(s), spirit = s.spirituality;
    for (const [index, id] of ANCIENT_ALCHEMIST_CASE_IDS.entries()) {
      begin(s, id, 'ABILITY'); const c = act(s, { type: 'PERFORM', caseId: id });
      expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', id === 'honest-handover' ? 10 : 18); expect(c.award).not.toHaveBeenCalled(); reject(s, { type: 'REPORT', caseId: id });
      close(s, id); const report = act(s, { type: 'REPORT', caseId: id });
      if (id === 'honest-handover') expect(report.award).not.toHaveBeenCalled(); else expect(report.award).toHaveBeenCalledExactlyOnceWith(ANCIENT_ALCHEMIST_ABILITY_IDS[index], 8);
    }
    expect(s.spirituality).toBe(spirit - 8); expect(ANCIENT_ALCHEMIST_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([8, 8]); expect(originals(s)).toEqual(old);
    expect(s.ancientAlchemist.life.cases['honest-handover'].attempts[0]).toMatchObject({ method: 'ORDINARY', spiritualityCost: 0 });
  });

  it('requires actual bought material, retains the same unused kit on withdrawal, and lets uncast preparation cross a week', () => {
    const s = promoted(); act(s, { type: 'OBSERVE', caseId: 'living-stem' });
    reject(s, { type: 'PREPARE', caseId: 'living-stem', method: 'ABILITY' }); reject(s, { type: 'BUY_KIT', caseId: 'living-stem', kitId: 'invented' });
    act(s, { type: 'BUY_KIT', caseId: 'living-stem', kitId: 'AA4-KIT-1' }); reject(s, { type: 'BUY_KIT', caseId: 'living-stem', kitId: 'AA4-KIT-2' });
    act(s, { type: 'PREPARE', caseId: 'living-stem', method: 'ABILITY' }); const ap = s.actionsRemaining, spirit = s.spirituality;
    s.actionsRemaining = 0; s.spirituality = 0; act(s, { type: 'WITHDRAW', caseId: 'living-stem' });
    expect(s.actionsRemaining).toBe(0); expect(s.ancientAlchemist.life.kits[0]).toMatchObject({ id: 'AA4-KIT-1', status: 'PLAYER', consumedWeek: null });
    s.actionsRemaining = ap; s.spirituality = spirit; act(s, { type: 'PREPARE', caseId: 'living-stem', method: 'ABILITY' }); expect(hasAncientAlchemistLifeLock(s)).toBe(false);
    nextWeek(s); act(s, { type: 'PERFORM', caseId: 'living-stem' }); expect(s.ancientAlchemist.life.kits[0]!.status).toBe('CONSUMED'); close(s, 'living-stem');
  });

  it('retains failure costs and the same visibly unresolved living stem, permits zero-budget real cleanup, and retries only next week', () => {
    const s = ready('living-stem'), cash = s.cash; s.actionsRemaining = 1; s.spirituality = 4;
    act(s, { type: 'PERFORM', caseId: 'living-stem' }, 100); expect(s.actionsRemaining).toBe(0); expect(s.spirituality).toBe(0); expect(s.cash).toBe(cash);
    expect(s.ancientAlchemist.life.stem).toMatchObject({ living: true, damage: 'SHALLOW_UNRESOLVED', observationHours: 0, holder: 'PLAYER' });
    reject(s, { type: 'RETURN_SAMPLE', caseId: 'living-stem' }); reject(s, { type: 'CLOSE', caseId: 'living-stem' }); expect(() => applySliceIntent(s, { type: 'ACTION', action: 'REST' })).toThrow();
    s.mind = 0; act(s, { type: 'OBSERVE_RECOVERY', caseId: 'living-stem' }); act(s, { type: 'RETURN_SAMPLE', caseId: 'living-stem' }); act(s, { type: 'CLOSE', caseId: 'living-stem' });
    expect(s.progression.acting).toBe(0); s.actionsRemaining = 100; s.mind = 100; s.spirituality = 100;
    act(s, { type: 'BUY_KIT', caseId: 'living-stem', kitId: 'AA4-KIT-2' }); reject(s, { type: 'PREPARE', caseId: 'living-stem', method: 'ABILITY' });
    nextWeek(s); begin(s, 'living-stem', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'living-stem' }); close(s, 'living-stem'); act(s, { type: 'REPORT', caseId: 'living-stem' });
    expect(s.ancientAlchemist.life.stem).toMatchObject({ id: 'AA4-STEM-1', living: true, damage: 'STABILIZED', observationHours: 12 });
    expect(s.ancientAlchemist.life.cases['living-stem'].attempts.map(a => a.kitId)).toEqual(['AA4-KIT-1', 'AA4-KIT-2']);
  });

  it('registers only a genuinely later material batch, preserves all three failed originals, and never creates a kit on perform', () => {
    const s = promoted();
    for (let i = 0; i < 3; i += 1) { begin(s, 'living-stem', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'living-stem' }, 100); close(s, 'living-stem'); if (i < 2) nextWeek(s); }
    const oldKits = structuredClone(s.ancientAlchemist.life.kits); expect(oldKits.every(k => k.status === 'CONSUMED')).toBe(true);
    act(s, { type: 'REQUEST_KITS' }); reject(s, { type: 'RECEIVE_KITS' }); reject(s, { type: 'REQUEST_KITS' });
    nextWeek(s); const ap = s.actionsRemaining; act(s, { type: 'RECEIVE_KITS' }); expect(s.actionsRemaining).toBe(ap - 1);
    expect(s.ancientAlchemist.life.kits.slice(0, 3)).toEqual(oldKits); expect(s.ancientAlchemist.life.kits.slice(3).map(k => [k.id, k.status])).toEqual([['AA4-KIT-4', 'SUPPLIER'], ['AA4-KIT-5', 'SUPPLIER'], ['AA4-KIT-6', 'SUPPLIER']]);
    reject(s, { type: 'PREPARE', caseId: 'living-stem', method: 'ABILITY' }); reject(s, { type: 'REQUEST_KITS' });
  });

  it('performs one actual original half-kilogram test, expires at sixty seconds, and returns the same inert matrix via two metres', () => {
    const s = ready('living-fibre'); act(s, { type: 'PERFORM', caseId: 'living-fibre' });
    const m = s.ancientAlchemist.life.matrices[0]!;
    expect(m).toMatchObject({ id: 'AA4-MATRIX-1', state: 'ACTIVE', remainingSeconds: 60, elapsedSeconds: 0, test: 'NONE' });
    reject(s, { type: 'RETURN_SAMPLE', caseId: 'living-fibre' }); act(s, { type: 'TEST_MATRIX', caseId: 'living-fibre' });
    expect(m).toMatchObject({ remainingSeconds: 50, elapsedSeconds: 10, test: 'BRACED_WEIGHT' }); reject(s, { type: 'TEST_MATRIX', caseId: 'living-fibre' });
    const result = act(s, { type: 'STOP_MATRIX', caseId: 'living-fibre' }); expect(notes(result)).toContain('再经过50秒');
    expect(m).toMatchObject({ id: 'AA4-MATRIX-1', state: 'INERT', remainingSeconds: 0, elapsedSeconds: 60, holder: 'TRAY' }); reject(s, { type: 'STOP_MATRIX', caseId: 'living-fibre' });
    act(s, { type: 'RETURN_SAMPLE', caseId: 'living-fibre' }); expect(m.holder).toBe('GUIDE_WASTE'); expect(s.ancientAlchemist.life.tray).toMatchObject({ id: 'AA4-TRAY-1', weightId: 'AA4-WEIGHT-1', weightKg: 0.5, position: 'GUIDE_BENCH' });
    act(s, { type: 'CLOSE', caseId: 'living-fibre' }); act(s, { type: 'REPORT', caseId: 'living-fibre' });
  });

  it('allows safe expiry without a test but refuses reward and requires a new kit on a later attempt', () => {
    const s = ready('living-fibre'); act(s, { type: 'PERFORM', caseId: 'living-fibre' }); close(s, 'living-fibre', false);
    expect(s.ancientAlchemist.life.matrices[0]).toMatchObject({ elapsedSeconds: 60, test: 'NONE', state: 'INERT', holder: 'GUIDE_WASTE' });
    reject(s, { type: 'REPORT', caseId: 'living-fibre' }); expect(s.ancientAlchemist.life.cases['living-fibre'].status).toBe('OBSERVED');
    nextWeek(s); finish(s, 'living-fibre', 'ABILITY'); expect(s.ancientAlchemist.life.matrices.map(m => m.id)).toEqual(['AA4-MATRIX-1', 'AA4-MATRIX-2']);
    expect(s.ancientAlchemist.life.cases['living-fibre'].attempts.map(a => a.kitId)).toEqual(['AA4-KIT-2', 'AA4-KIT-3']);
  });

  it('keeps failed matrix material inert and pays four spirituality without faking reactive proof', () => {
    const s = ready('living-fibre'), before = s.spirituality; act(s, { type: 'PERFORM', caseId: 'living-fibre' }, 100); act(s, { type: 'TEST_MATRIX', caseId: 'living-fibre' });
    expect(s.ancientAlchemist.life.matrices[0]).toMatchObject({ state: 'INERT', test: 'NO_RESPONSE', remainingSeconds: 0, elapsedSeconds: 10 });
    close(s, 'living-fibre'); expect(s.spirituality).toBe(before - 4); expect(s.ancientAlchemist.life.kits[1]!.status).toBe('CONSUMED'); reject(s, { type: 'REPORT', caseId: 'living-fibre' });
  });

  it('freezes actual kit IDs and six-hour/sixty-second findings on the same paper handed once to the original willing adult', () => {
    const s = ready('honest-handover'), spirit = s.spirituality; act(s, { type: 'PERFORM', caseId: 'honest-handover' });
    expect(s.ancientAlchemist.life.record.holder).toBe('PLAYER'); const content = s.ancientAlchemist.life.record.revisions[0]!;
    for (const phrase of ['AA4-KIT-1', 'AA4-KIT-2', 'AA4-STEM-1', 'AA4-MATRIX-1', '实际观察6小时', '实际60秒', '灵魂、复活、无限物均未证实']) expect(content).toContain(phrase);
    reject(s, { type: 'CLOSE', caseId: 'honest-handover' }); act(s, { type: 'HAND_OVER', caseId: 'honest-handover' }); reject(s, { type: 'HAND_OVER', caseId: 'honest-handover' });
    expect(s.ancientAlchemist.life.recipient).toMatchObject({ id: 'AA4-NORA-BELL', adult: true, willing: true, position: 'ORIGINAL_TABLE_2M' });
    expect(s.ancientAlchemist.life.record).toMatchObject({ holder: 'NORA', distanceMetres: 4, handovers: 1 }); act(s, { type: 'CLOSE', caseId: 'honest-handover' }); act(s, { type: 'REPORT', caseId: 'honest-handover' });
    expect(s.ancientAlchemist.life.record.revisions[0]).toBe(content); expect(s.spirituality).toBe(spirit);
  });

  it('retains rejected incomplete writing, physically returns the same paper, and amends it next week without inventing another record', () => {
    const s = ready('honest-handover'); act(s, { type: 'PERFORM', caseId: 'honest-handover' }, 100); close(s, 'honest-handover');
    const failed = s.ancientAlchemist.life.record.revisions[0]; expect(s.ancientAlchemist.life.record).toMatchObject({ id: 'AA4-RECORD-1', holder: 'GUIDE', distanceMetres: 4, handovers: 0 });
    reject(s, { type: 'REPORT', caseId: 'honest-handover' }); nextWeek(s); finish(s, 'honest-handover', 'ABILITY');
    expect(s.ancientAlchemist.life.record).toMatchObject({ id: 'AA4-RECORD-1', holder: 'NORA', distanceMetres: 8, handovers: 1 }); expect(s.ancientAlchemist.life.record.revisions).toHaveLength(2); expect(s.ancientAlchemist.life.record.revisions[0]).toBe(failed);
  });

  it('makes exactly three physical guard segments using a paid original kit, prevents replacement, consumes each once and returns the spent original', () => {
    const s = promoted(), ap = s.actionsRemaining, cash = s.cash, spirit = s.spirituality, old = originals(s), g = makeGuard(s);
    expect(s.actionsRemaining).toBe(ap - 1); expect(s.cash).toBe(cash - 120); expect(s.spirituality).toBe(spirit - 4);
    expect(g).toMatchObject({ id: 'AA4-GUARD-1', kitId: 'AA4-GUARD-KIT-1', holder: 'PLAYER', returnedWeek: null }); expect(g.segments.map(p => p.id)).toEqual(['AA4-GUARD-1-SEGMENT-1', 'AA4-GUARD-1-SEGMENT-2', 'AA4-GUARD-1-SEGMENT-3']);
    expect(s.ancientAlchemist.life.guardKits[0]).toMatchObject({ status: 'CONSUMED', guardId: g.id }); reject(s, { type: 'PREPARE_GUARD', kitId: 'AA4-GUARD-KIT-2' }); reject(s, { type: 'RETURN_GUARD' });
    const first = getAncientAlchemistGuardSegment(s)!; expect(consumeAncientAlchemistGuardSegment(s, first.guardId, first.segmentId)).toBe(true); expect(consumeAncientAlchemistGuardSegment(s, first.guardId, first.segmentId)).toBe(false);
    expect(consumeAncientAlchemistGuardSegment(s, 'invented', first.segmentId)).toBe(false); for (let i = 0; i < 2; i += 1) { const part = getAncientAlchemistGuardSegment(s)!; expect(consumeAncientAlchemistGuardSegment(s, part.guardId, part.segmentId)).toBe(true); }
    expect(availableAncientAlchemistGuard(s)).toBeNull(); expect(getAncientAlchemistGuardSegment(s)).toBeNull(); expect(s.spirituality).toBe(spirit - 4); // Combat owns its separate activation cost, never duplicated here.
    expect(validateAncientAlchemistLife(s)).toBe(true); s.actionsRemaining = 0; act(s, { type: 'RETURN_GUARD' }); expect(g).toMatchObject({ holder: 'GUIDE', returnedWeek: s.week }); expect(s.ancientAlchemist.life.guardReturnDistanceMetres).toBe(2);
    s.actionsRemaining = 100; const replacement = makeGuard(s); expect(replacement.id).toBe('AA4-GUARD-2'); expect(s.ancientAlchemist.life.guards[0]).toEqual(g); expect(originals(s)).toEqual(old);
  });

  it('does not fabricate guards with insufficient resources or during a case, and restocks only actual later-week material', () => {
    const blocked = ready('living-stem'); reject(blocked, { type: 'PREPARE_GUARD', kitId: 'AA4-GUARD-KIT-1' }); act(blocked, { type: 'PERFORM', caseId: 'living-stem' }); reject(blocked, { type: 'PREPARE_GUARD', kitId: 'AA4-GUARD-KIT-1' });
    const s = promoted(); s.cash = 119; reject(s, { type: 'PREPARE_GUARD', kitId: 'AA4-GUARD-KIT-1' }); s.cash = 10000; s.spirituality = 3; reject(s, { type: 'PREPARE_GUARD', kitId: 'AA4-GUARD-KIT-1' }); s.spirituality = 100;
    for (let i = 0; i < 3; i += 1) { makeGuard(s); spendGuard(s); act(s, { type: 'RETURN_GUARD' }); }
    const originals = structuredClone(s.ancientAlchemist.life.guards); act(s, { type: 'REQUEST_GUARD_KITS' }); reject(s, { type: 'RECEIVE_GUARD_KITS' }); nextWeek(s); act(s, { type: 'RECEIVE_GUARD_KITS' });
    expect(s.ancientAlchemist.life.guardKits).toHaveLength(6); expect(s.ancientAlchemist.life.guardKits[3]!.id).toBe('AA4-GUARD-KIT-4'); expect(s.ancientAlchemist.life.guards).toEqual(originals); expect(makeGuard(s).id).toBe('AA4-GUARD-4');
  });

  it('rejects malformed commands and local state fabrication, and exposes disabled actions without mutating public projection', () => {
    for (const command of [null, { type: 'REFLECT', free: true }, { type: 'PREPARE_GUARD' }, { type: 'BUY_KIT', caseId: 'honest-handover', kitId: 'AA4-KIT-1' }, { type: 'OBSERVE_RECOVERY', caseId: 'living-fibre' }, { type: 'RETURN_SAMPLE', caseId: 'honest-handover' }, { type: 'PREPARE', caseId: 'living-stem', method: 'REVIVE' }]) expect(validateAncientAlchemistActivityCommand(command)).toBe(false);
    const s = promoted(); const baseline = structuredClone(s); expect(ancientAlchemistLifeActions(s).some(a => a.command.type === 'PREPARE_GUARD' && a.enabled)).toBe(true); expect(ancientAlchemistActivityReason(s, { type: 'REPORT', caseId: 'living-stem' })).not.toBeNull(); projectAncientAlchemistLife(s); expect(s).toEqual(baseline);
    const mutations: ((x: SliceState) => void)[] = [x => { x.ancientAlchemist.life.kits[0]!.status = 'CONSUMED'; }, x => { x.ancientAlchemist.life.stem.observationHours = 6; }, x => { x.ancientAlchemist.life.record.holder = 'NORA'; }, x => { x.ancientAlchemist.life.guardKits[0]!.status = 'CONSUMED'; }];
    for (const change of mutations) { const x = structuredClone(s); change(x); expect(validateAncientAlchemistLife(x)).toBe(false); reject(x, { type: 'OBSERVE', caseId: 'living-stem' }); }
    const done = promoted(); for (const id of ANCIENT_ALCHEMIST_CASE_IDS) finish(done, id); done.ancientAlchemist.life.record.revisions[0] = 'claim of permanent life'; expect(validateAncientAlchemistLife(done)).toBe(false);
  });
});
