import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { createBizarroSorcererState } from '../../src/domain/bizarro-sorcerer/index.js';
import { BIZARRO_SORCERER_ABILITY_IDS } from '../../src/domain/bizarro-sorcerer/types.js';
import {
  applyBizarroActivity, bizarroActions, bizarroCases, bizarroInside, bizarroPractice,
  blockBizarroActivity, createBizarroLifeState, isBizarroActivity, projectBizarroLife,
  validateBizarroActivityCommand, validateBizarroLife, BIZARRO_CASE_IDS, BIZARRO_ENVIRONMENT,
  type BizarroActivityCommand, type BizarroCaseId,
} from '../../src/domain/bizarro-sorcerer/life.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

const previous = JSON.parse(readFileSync('tests/fixtures/marionettist-v0950/natural.json', 'utf8'));
const context = (s: SliceState, roll = 1): SeerContext => ({ roll: vi.fn(min => min), note: vi.fn(),
  check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) });
/** Explicitly directed post-promotion unit fixture, derived from the old natural
 * living practice checkpoint. This does not assert an actual S4 ritual/promotion;
 * the new public-command natural route verifies that separately. Never revive
 * the old terminal branch or rewrite its one original Dorn body. */
function ready(): SliceState {
  const s = migrateSliceState(structuredClone(previous.practiced));
  s.bizarroSorcerer = createBizarroSorcererState();
  const week = Math.max(s.week, s.marionettist.promotionWeek! + 12);
  s.date = addGameWeeks(s.date, week - s.week); s.week = week;
  s.progression.sequence = 4; s.progression.acting = 0; s.progression.promotionWeek = week;
  s.bizarroSorcerer.promotionWeek = week; s.bizarroSorcerer.marionettistActingAtPromotion = 100;
  for (const id of BIZARRO_SORCERER_ABILITY_IDS) s.progression.mastery[id] = 0;
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100; s.spirituality = 120; s.seer.pollution = 0;
  s.character.coreStats.knowledge = 30; s.character.coreStats.will = 30; s.character.coreStats.perception = 30;
  return s;
}
function act(s: SliceState, command: BizarroActivityCommand, roll = 1) {
  const ctx = context(s, roll); applyBizarroActivity(s, command, ctx);
  expect(validateBizarroLife(s)).toBe(true); return ctx;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyBizarroActivity(s, command as BizarroActivityCommand, ctx)).toThrow();
  expect(s).toEqual(before); expect(ctx.check).not.toHaveBeenCalled(); expect(ctx.roll).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: BizarroCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  if (s.bizarroSorcerer.life.cases[caseId].status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method }); act(s, { type: 'PERFORM', caseId });
}
function close(s: SliceState, caseId: BizarroCaseId) { act(s, { type: 'RETURN_ORDINARY' }); act(s, { type: 'CLOSE', caseId }); }
function ordinary(s: SliceState, caseId: BizarroCaseId) { begin(s, caseId); close(s, caseId); act(s, { type: 'REPORT', caseId }); }
function capture(s: SliceState) {
  act(s, { type: 'CAPTURE_MOUSE' }); act(s, { type: 'BEGIN_MOUSE_CONTROL' }); act(s, { type: 'COMPLETE_MOUSE_CONTROL', confirmedDeath: true });
}
function nextWeek(s: SliceState) { s.week++; s.date = addGameWeeks(s.date, 1); }
const mastery = (s: SliceState) => Object.values(s.progression.mastery).reduce((sum, v) => sum + v, 0);

describe('Bizarro Sorcerer finite original bodies and actual post-promotion life', () => {
  it('accepts canonical SQLite key ordering without weakening available-case or unpromoted-state values', () => {
    const beforePromotion = migrateSliceState(structuredClone(previous.practiced));
    expect(validateBizarroLife(beforePromotion)).toBe(true);
    const sortedBefore = JSON.parse(stableStringify(beforePromotion));
    expect(validateBizarroLife(sortedBefore)).toBe(true);
    const sortedAfter = JSON.parse(stableStringify(ready()));
    expect(validateBizarroLife(sortedAfter)).toBe(true);
    sortedBefore.bizarroSorcerer.life.mouse.spirituality = 5;
    expect(validateBizarroLife(sortedBefore)).toBe(false);
    sortedAfter.bizarroSorcerer.life.cases['two-flames'].closes = 1;
    expect(validateBizarroLife(sortedAfter)).toBe(false);
  });
  it('migrates original MM5 facts without reviving its terminal player or Dorn body', () => {
    const old = structuredClone(previous.final), migrated = migrateSliceState(old);
    expect(migrated.status).toBe(old.status); expect(migrated.health).toBe(old.health);
    expect(migrated.marionettist).toEqual(old.marionettist); expect(migrated.combatHistory).toEqual(old.combatHistory);
    expect(migrated.bizarroSorcerer.life).toEqual(createBizarroLifeState());
    const s = ready(), before = structuredClone(s.marionettist);
    expect(previous.practiced.status).toBe('ACTIVE'); expect(validateBizarroLife(s)).toBe(true);
    capture(s); expect(s.marionettist).toEqual(before);
    expect(s.bizarroSorcerer.life.mouse.id).not.toBe(s.marionettist.puppet.target?.id);
  });
  it('starts with capacity rather than free bodies or fifty ready worms, and projects independent public data', () => {
    const s = ready(), l = s.bizarroSorcerer.life;
    expect(l.worms).toEqual({ capacity: 50, split: 0, assigned: 0, recalled: 0, lost: 0 });
    expect(l.mouse).toMatchObject({ id: 'BR4-MOUSE-1', nature: 'ORDINARY_WILD_MOUSE', alive: true, status: 'WILD', location: 'WILD' });
    expect(bizarroInside(s)).toBe(false); expect(bizarroCases(s).map(v => v.id)).toEqual([...BIZARRO_CASE_IDS]);
    const p = projectBizarroLife(s); p.practice.tag.holder = 'MOUSE'; p.worms.split = 50;
    expect(l.practice.tag.holder).toBe('CARRIER'); expect(l.worms.split).toBe(0);
    const f = bizarroPractice(s); f.flamesLit[0] = true; expect(l.practice.flamesLit).toEqual([false, false]);
    expect(BIZARRO_ENVIRONMENT).toContain('没有历史投影');
  });
  it('strictly rejects invented target, load, resurrection and missing irreversible confirmation commands', () => {
    const s = ready();
    for (const c of [null, { type: 'COMPLETE_MOUSE_CONTROL' }, { type: 'COMPLETE_MOUSE_CONTROL', confirmedDeath: false },
      { type: 'COMPLETE_MOUSE_CONTROL', confirmedDeath: true, targetId: 'MM5-DORN' }, { type: 'CAPTURE_MOUSE', count: 50 },
      { type: 'ASSIGN_WORM', count: 50 }, { type: 'SWAP_OUT', destination: 'EMPTY' }, { type: 'PUPPET_ILLUSION', load: 'HUMAN' },
      { type: 'DISMISS_MOUSE' }, { type: 'RESURRECT' }, { type: 'BORROW_MOUSE_ABILITY' }, { type: 'PREPARE', caseId: 'one-way-gift', method: 'PLANT' }]) {
      expect(validateBizarroActivityCommand(c)).toBe(false); reject(s, c);
    }
    expect(isBizarroActivity({ type: 'COMPLETE_MOUSE_CONTROL', confirmedDeath: true })).toBe(true);
    expect(isBizarroActivity({ type: 'DISMISS_MOUSE', confirmedLoss: true })).toBe(true);
  });
  it('does not open life before promotion or inside a real ritual, and dead players cannot use it', () => {
    const s = ready(); s.progression.sequence = 5;
    expect(bizarroActions(s)).toEqual([]); expect(bizarroCases(s)).toEqual([]); reject(s, { type: 'CAPTURE_MOUSE' });
    s.progression.sequence = 4; s.bizarroSorcerer.ritual.phase = 'ASSEMBLED'; reject(s, { type: 'CAPTURE_MOUSE' });
    s.bizarroSorcerer.ritual.phase = 'UNSEEN'; s.status = 'DEAD'; reject(s, { type: 'CAPTURE_MOUSE' });
  });
  it('ordinary comparisons and reflection reach 100 without killing, magic or fake mastery', () => {
    const s = ready(), before = structuredClone(s.marionettist), startMastery = mastery(s), startS = s.spirituality, startAP = s.actionsRemaining;
    for (const id of BIZARRO_CASE_IDS) ordinary(s, id);
    act(s, { type: 'REFLECT' }); expect(s.progression.acting).toBe(100); expect(mastery(s)).toBe(startMastery);
    expect(s.spirituality).toBe(startS); expect(s.actionsRemaining).toBe(startAP - 13);
    expect(s.bizarroSorcerer.life.mouse.status).toBe('WILD'); expect(s.bizarroSorcerer.life.mouse.alive).toBe(true);
    expect(s.bizarroSorcerer.life.worms.split).toBe(0); expect(s.marionettist).toEqual(before); expect(bizarroInside(s)).toBe(false);
    for (const id of BIZARRO_CASE_IDS) reject(s, { type: 'REPORT', caseId: id });
    reject(s, { type: 'REFLECT' });
  });
  it('ordinary live capture costs one actual action and failure cannot reroll until next real week', () => {
    const s = ready(), ap = s.actionsRemaining, sp = s.spirituality;
    const ctx = act(s, { type: 'CAPTURE_MOUSE' }, 100); expect(ctx.check).toHaveBeenCalledWith('knowledge', 12);
    expect(s.actionsRemaining).toBe(ap - 1); expect(s.spirituality).toBe(sp); expect(s.bizarroSorcerer.life.mouse.status).toBe('WILD');
    reject(s, { type: 'CAPTURE_MOUSE' }); nextWeek(s); act(s, { type: 'CAPTURE_MOUSE' });
    expect(s.bizarroSorcerer.life.mouse.status).toBe('HELD'); expect(bizarroInside(s)).toBe(true);
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; act(s, { type: 'RELEASE_MOUSE' });
    expect(s.bizarroSorcerer.life.mouse).toMatchObject({ alive: true, status: 'RELEASED', location: 'RELEASE_SITE' });
    expect(bizarroInside(s)).toBe(false); reject(s, { type: 'CAPTURE_MOUSE' });
  });
  it('has distinct real 3s and 12s weak-target control, paid costs and an irreversible original death', () => {
    const s = ready(), l = s.bizarroSorcerer.life, sp = s.spirituality, ap = s.actionsRemaining;
    act(s, { type: 'CAPTURE_MOUSE' }); reject(s, { type: 'COMPLETE_MOUSE_CONTROL', confirmedDeath: true });
    act(s, { type: 'BEGIN_MOUSE_CONTROL' }); expect(l.mouse).toMatchObject({ alive: true, status: 'INITIAL_CONTROL', elapsedSeconds: 3 });
    expect(s.spirituality).toBe(sp - 3); reject(s, { type: 'BEGIN_MOUSE_CONTROL' });
    act(s, { type: 'COMPLETE_MOUSE_CONTROL', confirmedDeath: true });
    expect(l.mouse).toMatchObject({ alive: false, status: 'CONTROLLED', elapsedSeconds: 15, location: 'CARRIER', spirituality: 6 });
    expect(s.spirituality).toBe(sp - 11); expect(s.actionsRemaining).toBe(ap - 1); expect(bizarroInside(s)).toBe(false);
    reject(s, { type: 'RELEASE_MOUSE' }); reject(s, { type: 'COMPLETE_MOUSE_CONTROL', confirmedDeath: true });
    nextWeek(s); expect(validateBizarroLife(s)).toBe(true);
    act(s, { type: 'DISMISS_MOUSE', confirmedLoss: true }); expect(l.mouse).toMatchObject({ alive: false, status: 'INERT', location: 'CARRIER' });
    reject(s, { type: 'CAPTURE_MOUSE' }); reject(s, { type: 'BEGIN_MOUSE_CONTROL' });
  });
  it.each(['BEGIN_MOUSE_CONTROL', 'COMPLETE_MOUSE_CONTROL'] as const)('a failed %s retains costs and the actual living release', type => {
    const s = ready(); act(s, { type: 'CAPTURE_MOUSE' });
    if (type === 'COMPLETE_MOUSE_CONTROL') act(s, { type: 'BEGIN_MOUSE_CONTROL' });
    const sp = s.spirituality; act(s, type === 'COMPLETE_MOUSE_CONTROL' ? { type, confirmedDeath: true } : { type }, 100);
    expect(s.spirituality).toBe(sp - (type === 'BEGIN_MOUSE_CONTROL' ? 3 : 8));
    expect(s.bizarroSorcerer.life.mouse).toMatchObject({ alive: true, status: 'RELEASED', location: 'RELEASE_SITE' });
    reject(s, { type: 'CAPTURE_MOUSE' }); reject(s, { type: 'COMPLETE_MOUSE_CONTROL', confirmedDeath: true });
  });
  it('insufficient spirituality cannot force a conversion; living release stays available with zero resources', () => {
    const s = ready(); act(s, { type: 'CAPTURE_MOUSE' }); act(s, { type: 'BEGIN_MOUSE_CONTROL' });
    s.spirituality = 7; reject(s, { type: 'COMPLETE_MOUSE_CONTROL', confirmedDeath: true });
    s.spirituality = 0; s.actionsRemaining = 0; s.mind = 0; act(s, { type: 'RELEASE_MOUSE' });
    expect(s.bizarroSorcerer.life.mouse.alive).toBe(true);
  });
  it('uses two actual original flames and two separate paid legs; ending cannot teleport', () => {
    const s = ready(), sp = s.spirituality, beforeMastery = mastery(s); begin(s, 'two-flames', 'ABILITY');
    expect(s.bizarroSorcerer.life.practice.flamesLit).toEqual([true, true]);
    act(s, { type: 'FLAME_OUT' }); expect(s.bizarroSorcerer.life.practice.ownerAt).toBe('FAR');
    reject(s, { type: 'FLAME_OUT' }); reject(s, { type: 'CLOSE', caseId: 'two-flames' }); reject(s, { type: 'REPORT', caseId: 'two-flames' });
    act(s, { type: 'FLAME_BACK' }); expect(s.bizarroSorcerer.life.practice.ownerAt).toBe('NEAR');
    expect(s.spirituality).toBe(sp - 6); close(s, 'two-flames');
    expect(s.bizarroSorcerer.life.practice.flamesLit).toEqual([false, false]);
    act(s, { type: 'REPORT', caseId: 'two-flames' }); expect(mastery(s) - beforeMastery).toBe(8);
  });
  it('failed return retains the far-end body and costs, with a real zero-resource ordinary exit', () => {
    const s = ready(); begin(s, 'two-flames', 'ABILITY'); act(s, { type: 'FLAME_OUT' });
    const sp = s.spirituality; act(s, { type: 'FLAME_BACK' }, 100);
    expect(s.bizarroSorcerer.life.practice.ownerAt).toBe('FAR'); expect(s.spirituality).toBe(sp - 3);
    reject(s, { type: 'FLAME_BACK' }); s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    close(s, 'two-flames'); expect(s.bizarroSorcerer.life.practice.ownerAt).toBe('NEAR'); expect(bizarroInside(s)).toBe(false);
    expect(s.spirituality).toBe(0); expect(s.actionsRemaining).toBe(0); expect(s.mind).toBe(0);
  });
  it('a failed first ability attempt cannot report or reroll; actual ordinary retry next week remains possible', () => {
    const s = ready(); begin(s, 'two-flames', 'ABILITY'); act(s, { type: 'FLAME_OUT' }, 100);
    close(s, 'two-flames'); reject(s, { type: 'REPORT', caseId: 'two-flames' });
    reject(s, { type: 'PREPARE', caseId: 'two-flames', method: 'ORDINARY' });
    nextWeek(s); ordinary(s, 'two-flames'); expect(s.bizarroSorcerer.life.cases['two-flames'].result).toBe('ORDINARY');
  });
  it('only an actual assigned worm permits original-mouse illusion and real finite spirituality consumption', () => {
    const s = ready(); ordinary(s, 'two-flames'); capture(s); begin(s, 'one-way-gift', 'ABILITY');
    reject(s, { type: 'PUPPET_ILLUSION' }); const sp = s.spirituality, mind = s.mind, beforeMastery = mastery(s);
    act(s, { type: 'ASSIGN_WORM' }); expect(s.bizarroSorcerer.life.worms).toEqual({ capacity: 50, split: 1, assigned: 1, recalled: 0, lost: 0 });
    expect(s.mind).toBe(mind - 2); reject(s, { type: 'ASSIGN_WORM' });
    act(s, { type: 'PUPPET_ILLUSION' }); expect(s.bizarroSorcerer.life.mouse.spirituality).toBe(3);
    expect(s.bizarroSorcerer.life.practice.illusionActive).toBe(true); reject(s, { type: 'PUPPET_ILLUSION' });
    act(s, { type: 'RETURN_ORDINARY' }); expect(s.bizarroSorcerer.life.practice.illusionActive).toBe(false);
    reject(s, { type: 'CLOSE', caseId: 'one-way-gift' }); act(s, { type: 'RECALL_WORM' });
    expect(s.spirituality).toBe(sp - 7); expect(s.mind).toBe(mind - 2);
    expect(s.bizarroSorcerer.life.worms).toEqual({ capacity: 50, split: 1, assigned: 0, recalled: 1, lost: 0 });
    act(s, { type: 'CLOSE', caseId: 'one-way-gift' }); act(s, { type: 'REPORT', caseId: 'one-way-gift' });
    expect(mastery(s) - beforeMastery).toBe(8); expect(s.bizarroSorcerer.life.practice.tag).toEqual({ id: 'BR4-TAG-1', massGrams: 1, holder: 'CARRIER' });
  });
  it('explicit dismissal without recall loses the actual worm and applies real irreversible costs', () => {
    const s = ready(); ordinary(s, 'two-flames'); capture(s); begin(s, 'one-way-gift', 'ABILITY'); act(s, { type: 'ASSIGN_WORM' });
    const mind = s.mind; s.spirituality = 0; s.actionsRemaining = 0;
    reject(s, { type: 'RECALL_WORM' }); expect(bizarroActions(s).find(a => a.command.type === 'DISMISS_MOUSE')?.cost).toContain('精神−10');
    act(s, { type: 'DISMISS_MOUSE', confirmedLoss: true }); expect(s.mind).toBe(mind - 10); expect(s.seer.pollution).toBe(10);
    expect(s.bizarroSorcerer.life.worms).toEqual({ capacity: 50, split: 1, assigned: 0, recalled: 0, lost: 1 });
    expect(s.bizarroSorcerer.life.mouse).toMatchObject({ alive: false, status: 'INERT', location: 'NEAR' });
    close(s, 'one-way-gift'); expect(s.bizarroSorcerer.life.mouse.location).toBe('CARRIER'); expect(bizarroInside(s)).toBe(false);
    reject(s, { type: 'RECALL_WORM' }); reject(s, { type: 'DISMISS_MOUSE', confirmedLoss: true });
  });
  it('a failed granted illusion keeps spent mouse spirituality when later completed by ordinary comparison', () => {
    const s = ready(); ordinary(s, 'two-flames'); capture(s); begin(s, 'one-way-gift', 'ABILITY'); act(s, { type: 'ASSIGN_WORM' });
    act(s, { type: 'PUPPET_ILLUSION' }, 100); act(s, { type: 'RECALL_WORM' }); close(s, 'one-way-gift');
    expect(s.bizarroSorcerer.life.mouse.spirituality).toBe(3); nextWeek(s);
    reject(s, { type: 'PREPARE', caseId: 'one-way-gift', method: 'ABILITY' });
    const beforeMastery = mastery(s); ordinary(s, 'one-way-gift'); expect(mastery(s)).toBe(beforeMastery);
    expect(s.bizarroSorcerer.life.mouse.spirituality).toBe(3); expect(s.bizarroSorcerer.life.mouse.illusionUses).toBe(1);
  });
  it('requires actual walking to the remote pad before swapping the original bodies and their carried originals', () => {
    const s = ready(); ordinary(s, 'two-flames'); ordinary(s, 'one-way-gift'); capture(s); begin(s, 'paired-positions', 'ABILITY');
    const l = s.bizarroSorcerer.life, sp = s.spirituality, beforeMastery = mastery(s);
    expect(l.mouse.location).toBe('NEAR'); expect(l.practice.tag.holder).toBe('MOUSE'); reject(s, { type: 'SWAP_OUT' });
    act(s, { type: 'WALK_MOUSE_FAR' }); expect(l.mouse.location).toBe('FAR'); expect(l.practice.ownerAt).toBe('NEAR');
    act(s, { type: 'SWAP_OUT' }); expect(l.mouse.location).toBe('NEAR'); expect(l.practice.ownerAt).toBe('FAR');
    expect(l.practice.tag.holder).toBe('MOUSE'); expect(l.practice.carrier.holder).toBe('OWNER');
    expect(projectBizarroLife(s).positions.tag).toContain('NEAR'); expect(projectBizarroLife(s).positions.ownerItem).toContain('FAR');
    reject(s, { type: 'CLOSE', caseId: 'paired-positions' }); act(s, { type: 'SWAP_BACK' });
    expect(l.mouse.location).toBe('FAR'); expect(l.practice.ownerAt).toBe('NEAR'); expect(s.spirituality).toBe(sp - 4);
    reject(s, { type: 'CLOSE', caseId: 'paired-positions' }); close(s, 'paired-positions');
    expect(l.mouse.location).toBe('CARRIER'); expect(l.practice.tag.holder).toBe('CARRIER');
    act(s, { type: 'REPORT', caseId: 'paired-positions' }); expect(mastery(s) - beforeMastery).toBe(8);
  });
  it('ordinary return after one swap really retrieves the same mouse, retaining independent carried items', () => {
    const s = ready(); ordinary(s, 'two-flames'); ordinary(s, 'one-way-gift'); capture(s); begin(s, 'paired-positions', 'ABILITY');
    act(s, { type: 'WALK_MOUSE_FAR' }); act(s, { type: 'SWAP_OUT' });
    s.spirituality = 0; s.actionsRemaining = 0; close(s, 'paired-positions');
    expect(s.bizarroSorcerer.life.practice.ownerAt).toBe('NEAR'); expect(s.bizarroSorcerer.life.mouse.location).toBe('CARRIER');
    expect(s.bizarroSorcerer.life.mouse.alive).toBe(false); expect(s.bizarroSorcerer.life.practice.tag.id).toBe('BR4-TAG-1');
    expect(s.spirituality).toBe(0); expect(s.actionsRemaining).toBe(0);
  });
  it('released mouse still allows the full ordinary route and no fabricated plant or wooden puppet ability', () => {
    const s = ready(); act(s, { type: 'CAPTURE_MOUSE' }); act(s, { type: 'RELEASE_MOUSE' }); ordinary(s, 'two-flames');
    act(s, { type: 'OBSERVE', caseId: 'one-way-gift' }); reject(s, { type: 'PREPARE', caseId: 'one-way-gift', method: 'ABILITY' });
    ordinary(s, 'one-way-gift'); ordinary(s, 'paired-positions'); act(s, { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(s.bizarroSorcerer.life.mouse).toMatchObject({ alive: true, status: 'RELEASED' });
    expect(bizarroCases(s).find(c => c.id === 'one-way-gift')!.observations.join(' ')).toContain('木块仍是无生命物');
  });
  it('refuses to deploy a dismissed body even if ability preparation was made while it was controlled', () => {
    const s = ready(); ordinary(s, 'two-flames'); capture(s); act(s, { type: 'OBSERVE', caseId: 'one-way-gift' });
    act(s, { type: 'PREPARE', caseId: 'one-way-gift', method: 'ABILITY' }); act(s, { type: 'DISMISS_MOUSE', confirmedLoss: true });
    reject(s, { type: 'PERFORM', caseId: 'one-way-gift' }); act(s, { type: 'WITHDRAW', caseId: 'one-way-gift' });
    ordinary(s, 'one-way-gift');
  });
  it('cannot reopen effects after physically returning or use extinguished flames', () => {
    const s = ready(); begin(s, 'two-flames', 'ABILITY'); act(s, { type: 'RETURN_ORDINARY' });
    reject(s, { type: 'FLAME_OUT' }); act(s, { type: 'CLOSE', caseId: 'two-flames' });
    reject(s, { type: 'FLAME_OUT' }); expect(s.bizarroSorcerer.life.practice.flamesLit).toEqual([false, false]);
  });
  it('rejects duplicate bodies, missing/extra worms, resurrection, phantom movement and forged report state', () => {
    const pristine = ready(); capture(pristine);
    const mutations: ((s: SliceState) => void)[] = [
      s => { (s.bizarroSorcerer.life.mouse as unknown as { id: string }).id = 'BR4-MOUSE-2'; },
      s => { s.bizarroSorcerer.life.mouse.alive = true; },
      s => { s.bizarroSorcerer.life.mouse.status = 'RELEASED'; },
      s => { s.bizarroSorcerer.life.mouse.spirituality = 7; },
      s => { s.bizarroSorcerer.life.worms.assigned = 1; },
      s => { s.bizarroSorcerer.life.worms.split = 1; },
      s => { s.bizarroSorcerer.life.practice.ownerAt = 'FAR'; },
      s => { s.bizarroSorcerer.life.practice.tag.holder = 'MOUSE'; },
      s => { s.bizarroSorcerer.life.practice.flamesLit[0] = true; },
      s => { s.bizarroSorcerer.life.practice.illusionActive = true; },
      s => { s.bizarroSorcerer.life.cases['two-flames'].status = 'RESOLVED'; },
      s => { s.bizarroSorcerer.life.reflected = true; },
    ];
    for (const mutate of mutations) { const s = structuredClone(pristine); mutate(s); expect(validateBizarroLife(s)).toBe(false); }
  });
  it('keeps open physical scenes on the same week and original city, while the closed carrier may travel', () => {
    const s = ready(); capture(s); expect(validateBizarroLife(s)).toBe(true);
    nextWeek(s); s.world.city = 'TINGEN'; expect(validateBizarroLife(s)).toBe(true);
    reject(s, { type: 'OBSERVE', caseId: 'two-flames' }); s.world.city = 'BACKLUND'; begin(s, 'two-flames', 'ABILITY');
    const c = structuredClone(s); nextWeek(c); expect(validateBizarroLife(c)).toBe(false);
    const city = structuredClone(s); city.world.city = 'TINGEN'; expect(validateBizarroLife(city)).toBe(false);
    expect(blockBizarroActivity(s, { type: 'CAPTURE_MOUSE' })).not.toBeNull();
  });
});
