import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyMysticCommand, createMysticState, validateMysticState } from '../../src/domain/mystic/index.js';
import { applyMysticActivity, createMysticLifeState, hasMysticLifeLock, mysticActivityReason, mysticLifeActions, projectMysticLife, validateMysticActivityCommand, validateMysticLife, MYSTIC_CASE_IDS, type MysticActivityCommand, type MysticCaseId } from '../../src/domain/mystic/life.js';
import type { MysticAbilityId } from '../../src/domain/mystic/types.js';

/** Directed transition fixtures. The natural replay retains its own unmodified random stream. */
function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((id: MysticAbilityId, amount = 8) => { s.progression.mastery[id] = (s.progression.mastery[id] ?? 0) + amount; });
  return { ctx, award };
}
function oldS5(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/star-mystic-v01090/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous); s.mystic = createMysticState();
  const week = Math.max(s.week, s.starMystic.promotionWeek! + 12);
  s.date = addGameWeeks(s.date, week - s.week); s.week = week;
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.cash = 30000; s.actionsRemaining = 200; s.weeklyBudget = 200; s.health = 100; s.mind = 100; s.spirituality = 100; s.seer.pollution = 0;
  s.character.coreStats.will = 28;
  return s;
}
function promoted() {
  const s = oldS5(), c = context(s).ctx;
  applyMysticCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  if (s.starMystic.practice.lenses === 'SUPPLIER') applyMysticCommand(s, { type: 'BUY_LENSES' }, c);
  applyMysticCommand(s, { type: 'ACQUIRE_SAMPLE' }, c);
  applyMysticCommand(s, { type: 'OPEN_ANALYSIS' }, c);
  for (let n = 0; n < 3; n++) applyMysticCommand(s, { type: 'ANALYZE_SAMPLE' }, c);
  applyMysticCommand(s, { type: 'CLOSE_ANALYSIS' }, c);
  applyMysticCommand(s, { type: 'RETURN_SAMPLE' }, c);
  applyMysticCommand(s, { type: 'BUY_POTION', bottleId: 'mystic-potion-1' }, c);
  applyMysticCommand(s, { type: 'CONSUME', bottleId: 'mystic-potion-1', confirmed: true }, c);
  return s;
}
function act(s: SliceState, command: MysticActivityCommand, roll = 1) {
  const c = context(s, roll); applyMysticActivity(s, command, c.ctx, c.award);
  expect(validateMysticLife(s), `invalid Mystic life after ${JSON.stringify(command)}`).toBe(true);
  return c;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyMysticActivity(s, command as MysticActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: MysticCaseId, method: 'ORDINARY' | 'ABILITY' = 'ORDINARY') {
  const r = s.mystic.life.cases[caseId];
  if (r.status === 'AVAILABLE' || caseId !== 'sealed-story' && r.status === 'OBSERVED') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: MysticCaseId, method: 'ORDINARY' | 'ABILITY' = 'ORDINARY') {
  begin(s, caseId, method); act(s, { type: 'PERFORM', caseId });
  if (caseId === 'shared-eye') act(s, { type: 'RETURN_ROUTE', caseId });
  act(s, { type: 'CLOSE', caseId }); return act(s, { type: 'REPORT', caseId });
}
const nextWeek = (s: SliceState) => { s.week += 1; s.date = addGameWeeks(s.date, 1); };
const notes = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(args => args.join(' ')).join(' ');
const originals = (s: SliceState) => structuredClone([s.pryer, s.combatScholar, s.wizard, s.scrollProfessor, s.starMystic, s.mystic.ritual, s.combatHistory, s.world, s.town, s.character]);
function finished(ability = true) {
  const s = promoted(); complete(s, 'sealed-story'); complete(s, 'bell-test', ability ? 'ABILITY' : 'ORDINARY'); complete(s, 'shared-eye', ability ? 'ABILITY' : 'ORDINARY'); act(s, { type: 'REFLECT' }); return s;
}
function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reverseKeys(v)]));
  return value;
}

describe('Mystic personally researched bounded life', () => {
  it('is pristine and hidden at S5, with three different sourced scenes after actual promotion', () => {
    const old = oldS5(); expect(validateMysticLife(old)).toBe(true); expect(mysticLifeActions(old)).toEqual([]);
    expect(projectMysticLife(old)).toEqual({ cases: [], insideCase: false, environment: '', practice: null });
    const s = promoted(); expect(s.mystic.life).toEqual(createMysticLifeState()); expect(validateMysticState(s)).toBe(true);
    const p = projectMysticLife(s); expect(p.cases.map(c => c.id)).toEqual([...MYSTIC_CASE_IDS]); expect(new Set(p.cases.map(c => c.story)).size).toBe(3);
    expect(p.cases.every(c => !c.observations.length)).toBe(true); expect(p.environment).toContain('没有任意故事成真');
    expect(p.practice!.story).toContain('艾妲·诺尔'); expect(p.practice!.route).toContain('MY4-MARKER-1'); expect(p.practice!.sight).not.toContain('蓝色横线');
  });

  it.each([null, {}, { type: 'OBSERVE', caseId: 'arbitrary-story' }, { type: 'PREPARE', caseId: 'sealed-story', method: 'ABILITY' }, { type: 'PERFORM', caseId: 'bell-test', story: '丑小鸭' }, { type: 'PERFORM', caseId: 'shared-eye', target: 'UNKNOWN_PERSON' }, { type: 'PERFORM', caseId: 'shared-eye', range: 1000 }, { type: 'RETURN_ROUTE', caseId: 'bell-test' }, { type: 'PUBLISH_STORY' }, { type: 'PUBLISH_STORY', confirmed: false }, { type: 'PUBLISH_STORY', confirmed: true, caseId: 'unknown' }, { type: 'REFLECT', mastery: 500 }])('rejects malformed or unbounded instructions before any change: %j', command => {
    expect(validateMysticActivityCommand(command)).toBe(false); reject(promoted(), command);
  });

  it('requires each actual prior report, and never unlocks echo just from potion or access', () => {
    const s = promoted(); expect(s.mystic.life.echoLearned).toBe(false);
    reject(s, { type: 'OBSERVE', caseId: 'bell-test' }); reject(s, { type: 'OBSERVE', caseId: 'shared-eye' }); reject(s, { type: 'PUBLISH_STORY', confirmed: true }); reject(s, { type: 'REFLECT' });
    act(s, { type: 'OBSERVE', caseId: 'sealed-story' }); const l = s.mystic.life;
    expect(l.story.readerIds).toHaveLength(5); expect(l.story.readerIds.filter(id => id === 'PLAYER')).toHaveLength(1);
    expect(l.story.corroborated).toBe(true); expect(l.echoLearned).toBe(false); expect(l.story.learnedWeek).toBeNull();
    reject(s, { type: 'OBSERVE', caseId: 'sealed-story' }); reject(s, { type: 'REPORT', caseId: 'sealed-story' });
  });

  it('research uses actual original evidence and separate ordinary positioning, paid check and closure', () => {
    const s = promoted(), old = originals(s), ap = s.actionsRemaining, sp = s.spirituality, mastery = structuredClone(s.progression.mastery);
    begin(s, 'sealed-story'); expect(s.mystic.life.story).toMatchObject({ recordLocation: 'TABLE', notesLocation: 'TABLE' }); expect(s.mystic.life.bell.location).toBe('TABLE'); expect(s.spirituality).toBe(sp);
    const c = act(s, { type: 'PERFORM', caseId: 'sealed-story' }); expect(c.ctx.check).toHaveBeenCalledWith('knowledge', 18); expect(c.award).not.toHaveBeenCalled();
    expect(s.spirituality).toBe(sp - 3); expect(s.mystic.life.echoLearned).toBe(true); expect(s.mystic.life.story.learnedWeek).toBe(s.week); expect(s.progression.acting).toBe(0);
    expect(s.mystic.life.history[0]).toMatchObject({ sourceId: 'MY4-STORY-1', kind: 'RESEARCH', audience: 5, spiritualitySpent: 3, closed: false });
    expect(hasMysticLifeLock(s)).toBe(true); reject(s, { type: 'REPORT', caseId: 'sealed-story' }); reject(s, { type: 'PUBLISH_STORY', confirmed: true });
    act(s, { type: 'CLOSE', caseId: 'sealed-story' }); expect(s.mystic.life.story.recordLocation).toBe('ARCHIVE'); expect(s.mystic.life.bell.location).toBe('RACK');
    act(s, { type: 'REPORT', caseId: 'sealed-story' }); expect(s.actionsRemaining).toBe(ap - 4); expect(s.progression.acting).toBe(25); expect(s.progression.mastery).toEqual(mastery); expect(originals(s)).toEqual(old);
  });

  it('failed research consumes 3S with no lesson and can safely retry only next real week', () => {
    const s = promoted(); begin(s, 'sealed-story'); const sp = s.spirituality, mastery = structuredClone(s.progression.mastery);
    act(s, { type: 'PERFORM', caseId: 'sealed-story' }, 100); expect(s.spirituality).toBe(sp - 3); expect(s.mystic.life.echoLearned).toBe(false); expect(s.mystic.life.story.learnedWeek).toBeNull();
    expect(s.mystic.life.history[0]!.outcome).toBe('GREAT_FAILURE'); expect(s.progression.mastery).toEqual(mastery); reject(s, { type: 'REPORT', caseId: 'sealed-story' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; act(s, { type: 'CLOSE', caseId: 'sealed-story' }); expect(hasMysticLifeLock(s)).toBe(false);
    s.actionsRemaining = 10; s.mind = 100; s.spirituality = 20; reject(s, { type: 'PREPARE', caseId: 'sealed-story', method: 'ORDINARY' }); nextWeek(s);
    complete(s, 'sealed-story'); expect(s.mystic.life.history).toHaveLength(2); expect(s.mystic.life.history.map(h => h.spiritualitySpent)).toEqual([3, 3]); expect(s.mystic.life.story.readerIds).toHaveLength(5); expect(s.progression.acting).toBe(25);
  });

  it('cancels zero-AP preparations and never grants free research or refunds', () => {
    const s = promoted(); begin(s, 'sealed-story'); const ap = s.actionsRemaining, sp = s.spirituality;
    expect(hasMysticLifeLock(s)).toBe(false); s.actionsRemaining = 0; s.mind = 0;
    act(s, { type: 'WITHDRAW', caseId: 'sealed-story' }); expect(s.mystic.life.story.notesLocation).toBe('FOLDER'); expect(s.mystic.life.bell.location).toBe('RACK'); expect(s.mystic.life.echoLearned).toBe(false);
    expect(s.spirituality).toBe(sp); expect(s.actionsRemaining).toBe(0); expect(ap).toBeGreaterThan(0); expect(s.mystic.life.cases['sealed-story'].attempts).toBe(0);
  });

  it('three successful ability reports produce exactly100 acting and only two bounded mastery awards', () => {
    const s = promoted(), old = originals(s), ap = s.actionsRemaining, sp = s.spirituality, cash = s.cash;
    complete(s, 'sealed-story'); const bell = complete(s, 'bell-test', 'ABILITY'), eye = complete(s, 'shared-eye', 'ABILITY'); act(s, { type: 'REFLECT' });
    expect([s.actionsRemaining, s.spirituality, s.cash, s.progression.acting]).toEqual([ap - 13, sp - 9, cash, 100]);
    expect(bell.award).toHaveBeenCalledExactlyOnceWith('hermit.s4.mystical-reenactment', 8); expect(eye.award).toHaveBeenCalledExactlyOnceWith('hermit.s4.shared-sight', 8);
    expect(s.mystic.life.sight.player.distanceMetres).toBe(0); expect(s.mystic.life.sight.participant.distanceMetres).toBe(12); expect(originals(s)).toEqual(old); expect(validateMysticState(s)).toBe(true);
    for (const caseId of MYSTIC_CASE_IDS) reject(s, { type: 'REPORT', caseId }); reject(s, { type: 'REFLECT' });
  });

  it('ordinary bell and actual player-walk alternatives finish without ability mastery', () => {
    const s = promoted(), mastery = structuredClone(s.progression.mastery), sp = s.spirituality;
    complete(s, 'sealed-story'); const bell = complete(s, 'bell-test'), eye = complete(s, 'shared-eye'); act(s, { type: 'REFLECT' });
    expect(bell.award).not.toHaveBeenCalled(); expect(eye.award).not.toHaveBeenCalled(); expect(s.progression.mastery).toEqual(mastery); expect(s.spirituality).toBe(sp - 3); expect(s.progression.acting).toBe(100);
    expect(s.mystic.life.bell).toMatchObject({ ordinaryRings: 1, clapper: 'STILL', echoActive: false, lastPerception: 'ORDINARY_RING' });
    expect(s.mystic.life.sight.player).toEqual({ location: 'ROOM', walks: 2, distanceMetres: 12 }); expect(s.mystic.life.sight.participant.walks).toBe(0); expect(s.mystic.life.sight.ordinaryViews).toBe(1); expect(s.mystic.life.sight.sharedViews).toBe(0);
  });

  it('a real consenting bell ability trial leaves the real clapper still and closes its60-second bound at0AP', () => {
    const s = promoted(); complete(s, 'sealed-story'); begin(s, 'bell-test', 'ABILITY'); const sp = s.spirituality;
    const c = act(s, { type: 'PERFORM', caseId: 'bell-test' }); expect(c.ctx.check).toHaveBeenCalledWith('knowledge', 18); expect(s.spirituality).toBe(sp - 3);
    expect(s.mystic.life.bell).toMatchObject({ clapper: 'STILL', ordinaryRings: 0, echoActive: true, remainingSeconds: 60, effectFactor: 1, lastPerception: 'DELAYED_SOUND' });
    expect(notes(c)).toContain('原铃仍静止'); reject(s, { type: 'REPORT', caseId: 'bell-test' }); s.actionsRemaining = 0; s.mind = 0; s.spirituality = 0;
    act(s, { type: 'CLOSE', caseId: 'bell-test' }); expect(s.mystic.life.bell).toMatchObject({ location: 'RACK', consentWeek: null, echoActive: false, remainingSeconds: 0, effectFactor: 0 }); expect(hasMysticLifeLock(s)).toBe(false);
  });

  it('resisted echo costs3S but grants no sound or lesson, and requires fresh next-week consent', () => {
    const s = promoted(); complete(s, 'sealed-story'); begin(s, 'bell-test', 'ABILITY'); const sp = s.spirituality;
    act(s, { type: 'PERFORM', caseId: 'bell-test' }, 100); expect(s.spirituality).toBe(sp - 3); expect(s.mystic.life.bell.echoActive).toBe(false); expect(s.mystic.life.bell.lastPerception).toBe('NONE');
    act(s, { type: 'CLOSE', caseId: 'bell-test' }); nextWeek(s); reject(s, { type: 'PREPARE', caseId: 'bell-test', method: 'ABILITY' });
    complete(s, 'bell-test', 'ABILITY'); expect(s.mystic.life.cases['bell-test'].attempts).toBe(2); expect(s.mystic.life.cases['bell-test'].observations).toBe(2);
  });

  it('public disclosure really delivers one copy to100 new original adults, weakens future attempts and cannot reverse', () => {
    const s = promoted(); complete(s, 'sealed-story'); const st = structuredClone(s.mystic.life.story), mastery = structuredClone(s.progression.mastery), acting = s.progression.acting, ap = s.actionsRemaining;
    const publish = act(s, { type: 'PUBLISH_STORY', confirmed: true }); expect(s.actionsRemaining).toBe(ap - 1); expect(s.progression.mastery).toEqual(mastery); expect(s.progression.acting).toBe(acting); expect(publish.award).not.toHaveBeenCalled();
    expect(s.mystic.life.story.readerIds).toHaveLength(105); expect(new Set(s.mystic.life.story.readerIds).size).toBe(105); expect(s.mystic.life.story.readerIds.slice(0, 5)).toEqual(st.readerIds);
    expect(s.mystic.life.story).toMatchObject({ learnedWeek: st.learnedWeek, publicationWeek: s.week, publicationId: 'MY4-PUBLIC-COPY-1', recipientGroup: 'MY4-READING-GROUP-1' });
    reject(s, { type: 'PUBLISH_STORY', confirmed: true }); reject(s, { type: 'UNPUBLISH_STORY' });
    begin(s, 'bell-test', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'bell-test' }); expect(s.mystic.life.bell.effectFactor).toBe(0.15); expect(s.mystic.life.bell.lastPerception).toBe('FAINT_DELAYED_SOUND');
    expect(s.mystic.life.history[0]!.audience).toBe(5); expect(s.mystic.life.history[1]).toMatchObject({ audience: 105, effectFactor: 0.15 });
    act(s, { type: 'CLOSE', caseId: 'bell-test' }); act(s, { type: 'REPORT', caseId: 'bell-test' }); expect(s.mystic.life.echoLearned).toBe(true); expect(projectMysticLife(s).practice!.story).toContain('不可逆');
  });

  it('publishing after a private trial keeps that actual private effect snapshot', () => {
    const s = promoted(); complete(s, 'sealed-story'); complete(s, 'bell-test', 'ABILITY'); const h = structuredClone(s.mystic.life.history);
    act(s, { type: 'PUBLISH_STORY', confirmed: true }); expect(s.mystic.life.history).toEqual(h); expect(s.mystic.life.history[1]).toMatchObject({ audience: 5, effectFactor: 1 });
    expect(validateMysticLife(s)).toBe(true); expect(projectMysticLife(s).practice!.history.join(' ')).toContain('当时知情5人、效力1');
  });

  it('shared-eye moves only the actual consenting adult and does not reveal unknown marker on failure', () => {
    const s = promoted(); complete(s, 'sealed-story'); complete(s, 'bell-test'); begin(s, 'shared-eye', 'ABILITY');
    expect(s.mystic.life.sight.player.location).toBe('ROOM'); expect(s.mystic.life.sight.participant.location).toBe('ROOM'); expect(projectMysticLife(s).practice!.sight).not.toContain('蓝色横线');
    const sp = s.spirituality; act(s, { type: 'PERFORM', caseId: 'shared-eye' }, 100); expect(s.spirituality).toBe(sp - 3);
    expect(s.mystic.life.sight.participant).toEqual({ location: 'MARK', walks: 1, distanceMetres: 6 }); expect(s.mystic.life.sight.player.walks).toBe(0); expect(s.mystic.life.sight.eyeActive).toBe(false); expect(s.mystic.life.sight.markerSeen).toBe(false);
    expect(projectMysticLife(s).practice!.sight).not.toContain('蓝色横线'); reject(s, { type: 'CLOSE', caseId: 'shared-eye' }); reject(s, { type: 'REPORT', caseId: 'shared-eye' });
    s.actionsRemaining = 0; s.mind = 0; s.spirituality = 0; act(s, { type: 'RETURN_ROUTE', caseId: 'shared-eye' }); act(s, { type: 'CLOSE', caseId: 'shared-eye' }); expect(hasMysticLifeLock(s)).toBe(false);
    expect(s.mystic.life.sight.participant.distanceMetres).toBe(12); expect(s.progression.acting).toBe(50);
  });

  it('successful shared-eye views the current original marker while player remainsROOM, then requires real return', () => {
    const s = promoted(); complete(s, 'sealed-story'); complete(s, 'bell-test'); begin(s, 'shared-eye', 'ABILITY');
    act(s, { type: 'PERFORM', caseId: 'shared-eye' }); expect(s.mystic.life.sight).toMatchObject({ eyeActive: true, markerSeen: true, sharedViews: 1 }); expect(s.mystic.life.sight.player.location).toBe('ROOM'); expect(projectMysticLife(s).practice!.sight).toContain('蓝色横线');
    reject(s, { type: 'CLOSE', caseId: 'shared-eye' }); reject(s, { type: 'REPORT', caseId: 'shared-eye' });
    act(s, { type: 'RETURN_ROUTE', caseId: 'shared-eye' }); expect(hasMysticLifeLock(s)).toBe(true); expect(s.mystic.life.sight.participant.distanceMetres).toBe(12);
    act(s, { type: 'CLOSE', caseId: 'shared-eye' }); expect(s.mystic.life.sight.eyeActive).toBe(false); expect(s.mystic.life.sight.consentWeek).toBeNull(); expect(s.mystic.life.sight.markerSeen).toBe(true);
    act(s, { type: 'REPORT', caseId: 'shared-eye' });
  });

  it('withdrawal closes an active eye immediately but cannot teleport the adult home or unlock travel', () => {
    const s = promoted(); complete(s, 'sealed-story'); complete(s, 'bell-test'); begin(s, 'shared-eye', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'shared-eye' }); s.actionsRemaining = 0;
    act(s, { type: 'WITHDRAW', caseId: 'shared-eye' }); expect(s.mystic.life.sight.eyeActive).toBe(false); expect(s.mystic.life.sight.consentWeek).toBeNull(); expect(s.mystic.life.sight.participant.location).toBe('MARK'); expect(hasMysticLifeLock(s)).toBe(true);
    expect(s.mystic.life.cases['shared-eye'].withdrawalPending).toBe(true); reject(s, { type: 'WITHDRAW', caseId: 'shared-eye' }); reject(s, { type: 'CLOSE', caseId: 'shared-eye' });
    act(s, { type: 'RETURN_ROUTE', caseId: 'shared-eye' }); act(s, { type: 'CLOSE', caseId: 'shared-eye' }); expect(hasMysticLifeLock(s)).toBe(false); expect(s.progression.mastery['hermit.s4.shared-sight']).toBe(0); expect(s.mystic.life.sight.markerSeen).toBe(true);
    nextWeek(s); s.actionsRemaining = 10; complete(s, 'shared-eye', 'ABILITY'); expect(s.mystic.life.sight.participant.distanceMetres).toBe(24); expect(s.mystic.life.history.at(-2)!.withdrawn).toBe(true);
  });

  it('ordinary walking also needs a separate actual return and cannot gain sharing mastery', () => {
    const s = promoted(); complete(s, 'sealed-story'); complete(s, 'bell-test'); begin(s, 'shared-eye'); const c = act(s, { type: 'PERFORM', caseId: 'shared-eye' });
    expect(c.ctx.check).not.toHaveBeenCalled(); expect(s.mystic.life.sight.player).toEqual({ location: 'MARK', walks: 1, distanceMetres: 6 }); expect(s.mystic.life.sight.participant.walks).toBe(0);
    reject(s, { type: 'CLOSE', caseId: 'shared-eye' }); s.actionsRemaining = 0; act(s, { type: 'WITHDRAW', caseId: 'shared-eye' }); expect(s.mystic.life.sight.player.location).toBe('MARK');
    act(s, { type: 'RETURN_ROUTE', caseId: 'shared-eye' }); act(s, { type: 'CLOSE', caseId: 'shared-eye' }); expect(s.mystic.life.sight.player.distanceMetres).toBe(12); expect(s.progression.mastery['hermit.s4.shared-sight']).toBe(0);
  });

  it('prepared cross-week consent can be canceled safely and must be renewed before implementation', () => {
    const s = promoted(); complete(s, 'sealed-story'); begin(s, 'bell-test', 'ABILITY'); nextWeek(s); reject(s, { type: 'PERFORM', caseId: 'bell-test' });
    s.actionsRemaining = 0; act(s, { type: 'WITHDRAW', caseId: 'bell-test' }); expect(hasMysticLifeLock(s)).toBe(false); s.actionsRemaining = 10;
    complete(s, 'bell-test', 'ABILITY'); expect(s.mystic.life.cases['bell-test'].observations).toBe(2); expect(s.mystic.life.cases['bell-test'].preparations).toBe(2);
  });

  it('advertises zero-AP cleanup for every exhausted active scene and rejects free implementation', () => {
    const s = promoted(); begin(s, 'sealed-story'); s.spirituality = 2; reject(s, { type: 'PERFORM', caseId: 'sealed-story' }); s.spirituality = 3; s.actionsRemaining = 1;
    act(s, { type: 'PERFORM', caseId: 'sealed-story' }, 100); expect(s.actionsRemaining).toBe(0); expect(s.spirituality).toBe(0);
    const actions = mysticLifeActions(s); expect(actions.find(a => a.command.type === 'CLOSE' && 'caseId' in a.command && a.command.caseId === 'sealed-story')?.enabled).toBe(true);
    act(s, { type: 'CLOSE', caseId: 'sealed-story' }); expect(hasMysticLifeLock(s)).toBe(false);
  });

  it('all three life histories survive JSON round-trip and property order changes', () => {
    const s = finished(); act(s, { type: 'PUBLISH_STORY', confirmed: true });
    expect(validateMysticLife(JSON.parse(JSON.stringify(s)) as SliceState)).toBe(true);
    expect(validateMysticLife(reverseKeys(s) as SliceState)).toBe(true); expect(validateMysticState(s)).toBe(true);
  });

  it.each([
    (s: SliceState) => { s.mystic.life.story.readerIds.push('UNRECORDED_READER'); },
    (s: SliceState) => { s.mystic.life.echoLearned = false; },
    (s: SliceState) => { s.mystic.life.story.learnedWeek = null; },
    (s: SliceState) => { s.mystic.life.story.corroborated = false; },
    (s: SliceState) => { s.mystic.life.publicDisclosed = true; },
    (s: SliceState) => { s.mystic.life.sight.participant.distanceMetres = 0; },
    (s: SliceState) => { s.mystic.life.sight.participant.location = 'MARK'; },
    (s: SliceState) => { s.mystic.life.sight.eyeActive = true; },
    (s: SliceState) => { s.mystic.life.bell.echoActive = true; },
    (s: SliceState) => { s.mystic.life.history[0]!.spiritualitySpent = 0; },
    (s: SliceState) => { s.mystic.life.history[1]!.effectFactor = 0.15; },
    (s: SliceState) => { s.mystic.life.history[1]!.audience = 105; },
    (s: SliceState) => { s.mystic.life.history[2]!.sourceId = 'MY4-STORY-1'; },
    (s: SliceState) => { s.mystic.life.cases['shared-eye'].closes = 0; },
    (s: SliceState) => { s.seer.completedSources.push('mystic-case:bell-test'); },
    (s: SliceState) => { s.progression.acting = 75; },
  ])('rejects invented knowledge, audience, mastery source, closure or geometry %j', mutate => {
    const s = finished(); mutate(s); expect(validateMysticLife(s)).toBe(false);
  });

  it('retains source snapshots and reports old practice unchanged through every new action', () => {
    const s = promoted(), old = originals(s); complete(s, 'sealed-story'); act(s, { type: 'PUBLISH_STORY', confirmed: true }); complete(s, 'bell-test', 'ABILITY'); complete(s, 'shared-eye', 'ABILITY'); act(s, { type: 'REFLECT' });
    expect(originals(s)).toEqual(old); expect(s.starMystic.practice.markerSeen).toBe(true); expect(s.mystic.life.sight.markerId).toBe('MY4-MARKER-1');
    expect(mysticActivityReason(s, { type: 'PUBLISH_STORY', confirmed: true })).toContain('已经公开');
  });
});
