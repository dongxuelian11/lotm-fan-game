import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { applySliceIntent, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { applyScrollProfessorActivity, validateScrollProfessorLife } from '../../src/domain/scroll-professor/life.js';
import { applyStarMysticCommand, createStarMysticState, freshStarMysticPractice, validateStarMysticCommand, validateStarMysticState } from '../../src/domain/star-mystic/index.js';
import { applyStarMysticActivity, isStarMysticActivity, starMysticActions, starMysticCases, starMysticInside, starMysticPractice, STAR_MYSTIC_ENVIRONMENT, validateStarMysticLife } from '../../src/domain/star-mystic/life.js';
import { STAR_MYSTIC_ABILITY_IDS, STAR_MYSTIC_CASE_IDS, type StarMysticActivityCommand, type StarMysticCaseId, type StarMysticCommand, type StarMysticWorkshopCommand } from '../../src/domain/star-mystic/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

/** Directed domain fixtures test transitions; these are not the natural replay's random outcomes. */
function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source); s.progression.mastery[STAR_MYSTIC_ABILITY_IDS[0]]! += amount;
  });
  return { ctx, award };
}
function scrollProfessor(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/scroll-professor-v0870/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous); s.starMystic = createStarMysticState();
  const week = Math.max(s.week, s.scrollProfessor.promotionWeek! + 12);
  s.date = addGameWeeks(s.date, week - s.week); s.week = week;
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.spirituality = 50; s.seer.pollution = 0; s.character.coreStats.will = 26; s.character.coreStats.knowledge = 26;
  return s;
}
function promoted(): SliceState {
  const s = scrollProfessor(), { ctx } = context(s);
  applyStarMysticCommand(s, { type: 'LEARN_GUIDANCE' }, ctx);
  applyStarMysticCommand(s, { type: 'BUY_POTION', bottleId: s.starMystic.bottles[0]!.id }, ctx);
  applyStarMysticCommand(s, { type: 'CONSUME', bottleId: s.starMystic.bottles[0]!.id, confirmed: true }, ctx);
  return s;
}
function nextWeek(s: SliceState) { s.week += 1; s.date = addGameWeeks(s.date, 1); }
function act(s: SliceState, command: StarMysticActivityCommand, roll = 1) { const c = context(s, roll); applyStarMysticActivity(s, command, c.ctx, c.award); return c; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyStarMysticActivity(s, command as StarMysticActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: StarMysticCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  if (s.starMystic.cases[caseId]!.status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: StarMysticCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); act(s, { type: 'PERFORM', caseId }); act(s, { type: 'CLOSE', caseId });
  return act(s, { type: 'REPORT', caseId });
}
function reach(s: SliceState, caseId: StarMysticCaseId) {
  for (const id of STAR_MYSTIC_CASE_IDS) { if (id === caseId) break; complete(s, id); }
}
const messages = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(call => call.join(' ')).join(' ');
const originals = (s: SliceState) => structuredClone([s.pryer, s.combatScholar, s.wizard, s.scrollProfessor, s.world, s.town, s.combatHistory]);
const publicText = (s: SliceState) => JSON.stringify(projectSliceState(s).starMystic);


describe('Star mystic actual observation, one original pair of glasses and finite willing practice', () => {
  it('preserves old originals and starts without gifted glasses or prematurely public marker knowledge', () => {
    const old = scrollProfessor();
    expect(starMysticActions(old)).toEqual([]); expect(starMysticCases(old)).toEqual([]); expect(starMysticPractice(old)).toBeNull(); expect(validateStarMysticLife(old)).toBe(true);
    const s = promoted();
    expect(originals(s)).toEqual(originals(old)); expect(s.starMystic.practice).toEqual(freshStarMysticPractice());
    expect(starMysticCases(s).map(c => c.id)).toEqual([...STAR_MYSTIC_CASE_IDS]); expect(new Set(starMysticCases(s).map(c => c.story)).size).toBe(3);
    expect(starMysticCases(s).every(c => c.observations.length === 0)).toBe(true); expect(starMysticInside(s)).toBe(false);
    expect(publicText(s)).not.toContain('三道水平刻痕'); expect(publicText(s)).not.toContain('伊蕾手中');
    expect(validateStarMysticState(s)).toBe(true); expect(STAR_MYSTIC_ENVIRONMENT).toContain('序列4神秘再现');
  });

  it('buys and wears exactly one original for 1 AP and 80p, retaining it through ordinary days', () => {
    const s = promoted(), ap = s.actionsRemaining, cash = s.cash, old = originals(s), resources = [s.health, s.mind, s.spirituality];
    const bought = act(s, { type: 'BUY_LENSES' });
    expect([s.actionsRemaining, s.cash]).toEqual([ap - 1, cash - 80]); expect(s.starMystic.practice.lenses).toBe('WORN');
    expect(messages(bought)).toContain('SM5-LENS-1'); expect(bought.ctx.check).not.toHaveBeenCalled(); expect(bought.award).not.toHaveBeenCalled();
    expect([s.health, s.mind, s.spirituality]).toEqual(resources); expect(originals(s)).toEqual(old); reject(s, { type: 'BUY_LENSES' });
    nextWeek(s); expect(s.starMystic.practice.lenses).toBe('WORN'); expect(starMysticInside(s)).toBe(false); expect(validateStarMysticLife(s)).toBe(true);
    expect(starMysticActions(s).some(a => a.command.type === 'BUY_LENSES')).toBe(false);
    const poor = promoted(); poor.cash = 79; reject(poor, { type: 'BUY_LENSES' });
    const noTime = promoted(); noTime.actionsRemaining = 0; reject(noTime, { type: 'BUY_LENSES' });
  });

  it('requires owned worn lenses for intentional sight but ordinary observation and preparation reveal no hidden details', () => {
    const s = promoted(), initial = structuredClone(s.starMystic.practice);
    act(s, { type: 'OBSERVE', caseId: 'veiled-marker' });
    reject(s, { type: 'PREPARE', caseId: 'veiled-marker', method: 'ABILITY' });
    act(s, { type: 'PREPARE', caseId: 'veiled-marker', method: 'ORDINARY' });
    expect(s.starMystic.practice).toEqual(initial); expect(starMysticInside(s)).toBe(false);
    expect(publicText(s)).not.toContain('三道水平刻痕'); expect(publicText(s)).not.toContain('伊蕾手中');
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    const withdrawn = act(s, { type: 'WITHDRAW', caseId: 'veiled-marker' });
    expect(withdrawn.award).not.toHaveBeenCalled(); expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]);
    expect(s.starMystic.practice).toEqual(initial); expect(validateStarMysticLife(s)).toBe(true);
    reject(s, { type: 'CLOSE', caseId: 'veiled-marker' }); reject(s, { type: 'WITHDRAW', caseId: 'veiled-marker' });
  });

  it.each([1, 100])('sight roll%s actually holds the same lenses and pays 3 spirit plus 2 mind before possible knowledge', roll => {
    const s = promoted(); act(s, { type: 'BUY_LENSES' }); begin(s, 'veiled-marker', 'ABILITY');
    const old = originals(s), resources = [s.spirituality, s.mind], ap = s.actionsRemaining;
    expect(publicText(s)).not.toContain('三道水平刻痕');
    const performed = act(s, { type: 'PERFORM', caseId: 'veiled-marker' }, roll);
    expect(performed.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14); expect(performed.award).not.toHaveBeenCalled();
    expect(s.actionsRemaining).toBe(ap - 1); expect([s.spirituality, s.mind]).toEqual([resources[0]! - 3, resources[1]! - 2]);
    expect(s.starMystic.practice).toMatchObject({ lenses: 'HELD', screen: 'SHUT', markerSeen: roll === 1 });
    expect(starMysticInside(s)).toBe(true); expect(validateStarMysticLife(s)).toBe(true); expect(originals(s)).toEqual(old);
    if (roll === 1) expect(publicText(s)).toContain('三道水平刻痕'); else { expect(publicText(s)).not.toContain('三道水平刻痕'); expect(messages(performed)).toContain('视觉纷乱'); }
    reject(s, { type: 'REPORT', caseId: 'veiled-marker' }); reject(s, { type: 'WITHDRAW', caseId: 'veiled-marker' }); reject(s, { type: 'BUY_KIT' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    const closed = act(s, { type: 'CLOSE', caseId: 'veiled-marker' });
    expect(messages(closed)).toContain('同一副原厚镜片眼镜实际戴回'); expect(closed.award).not.toHaveBeenCalled();
    expect(s.starMystic.practice).toMatchObject({ lenses: 'WORN', screen: 'SHUT', markerSeen: roll === 1 });
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]); expect(starMysticInside(s)).toBe(false); expect(validateStarMysticLife(s)).toBe(true);
    if (roll === 1) expect(starMysticPractice(s)!.history.join(' ')).toContain('三道水平刻痕'); else expect(starMysticPractice(s)!.history).toEqual([]);
  });

  it.each([1, 100])('ordinary marker roll%s keeps the original curtain physically open until actual closure', roll => {
    const s = promoted(); begin(s, 'veiled-marker'); const resources = [s.spirituality, s.mind], old = originals(s);
    const performed = act(s, { type: 'PERFORM', caseId: 'veiled-marker' }, roll);
    expect(performed.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect([s.spirituality, s.mind]).toEqual(resources);
    expect(s.starMystic.practice).toMatchObject({ lenses: 'SUPPLIER', screen: 'OPEN', markerSeen: roll === 1 }); expect(validateStarMysticLife(s)).toBe(true);
    act(s, { type: 'CLOSE', caseId: 'veiled-marker' }); expect(s.starMystic.practice.screen).toBe('SHUT'); expect(s.starMystic.practice.markerSeen).toBe(roll === 1);
    expect(originals(s)).toEqual(old); expect(validateStarMysticLife(s)).toBe(true);
    if (roll === 100) {
      reject(s, { type: 'REPORT', caseId: 'veiled-marker' }); reject(s, { type: 'PREPARE', caseId: 'veiled-marker', method: 'ORDINARY' });
      nextWeek(s); complete(s, 'veiled-marker'); expect(s.starMystic.practice.markerSeen).toBe(true); expect(s.starMystic.cases['veiled-marker']!.closes).toBe(2); expect(validateStarMysticLife(s)).toBe(true);
    }
  });

  it('does not permit ability costs to overdraw spirit or mind and allows cancellation at zero AP', () => {
    const s = promoted(); act(s, { type: 'BUY_LENSES' }); begin(s, 'veiled-marker', 'ABILITY');
    s.spirituality = 2; reject(s, { type: 'PERFORM', caseId: 'veiled-marker' }); s.spirituality = 3; s.mind = 1;
    reject(s, { type: 'PERFORM', caseId: 'veiled-marker' }); s.actionsRemaining = 0;
    act(s, { type: 'WITHDRAW', caseId: 'veiled-marker' }); expect(s.starMystic.practice.lenses).toBe('WORN'); expect(s.spirituality).toBe(3); expect(s.mind).toBe(1);
  });

  it.each([1, 100])('direct cage roll%s requires the actual volunteer walk and no lens, scroll or health cost', roll => {
    const s = promoted(); reach(s, 'willing-cage'); begin(s, 'willing-cage', 'ABILITY');
    const old = originals(s), spirit = s.spirituality, health = s.health;
    expect(s.starMystic.practice.companionNode).toBe('WAITING');
    const performed = act(s, { type: 'PERFORM', caseId: 'willing-cage' }, roll);
    expect(performed.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14); expect(s.spirituality).toBe(spirit - 3); expect(s.health).toBe(health);
    expect(s.starMystic.practice).toMatchObject({ lenses: 'SUPPLIER', companionNode: 'MARK', cageActive: roll === 1 });
    expect(s.starMystic.cases['willing-cage']!.outcome).toBe(roll === 1 ? 'CAGE_CHECKED' : 'NONE');
    expect(messages(performed)).toContain('实际步行两米'); expect(originals(s)).toEqual(old); expect(validateStarMysticLife(s)).toBe(true);
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    const closed = act(s, { type: 'CLOSE', caseId: 'willing-cage' });
    expect(messages(closed)).toContain('自由沿原地面实际步行两米返回'); expect(s.starMystic.practice).toMatchObject({ companionNode: 'WAITING', cageActive: false });
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]); expect(closed.award).not.toHaveBeenCalled(); expect(starMysticInside(s)).toBe(false); expect(validateStarMysticLife(s)).toBe(true);
  });

  it('ordinary volunteer boundary remains freely chosen and never becomes a cage', () => {
    const s = promoted(); reach(s, 'willing-cage'); s.spirituality = 0; begin(s, 'willing-cage');
    const performed = act(s, { type: 'PERFORM', caseId: 'willing-cage' });
    expect(performed.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect(s.spirituality).toBe(0);
    expect(s.starMystic.practice).toMatchObject({ companionNode: 'MARK', cageActive: false }); expect(s.starMystic.cases['willing-cage']!.outcome).toBe('BOUNDARY_CHECKED');
    expect(messages(performed)).toContain('自愿短暂停步'); act(s, { type: 'CLOSE', caseId: 'willing-cage' });
    expect(act(s, { type: 'REPORT', caseId: 'willing-cage' }).award).not.toHaveBeenCalled(); expect(validateStarMysticLife(s)).toBe(true);
  });

  it.each([1, 100])('weather comparison roll%s preserves a real six-metre outward walk and actual seen weather even on failed interpretation', roll => {
    const s = promoted(); reach(s, 'uncertain-chart'); begin(s, 'uncertain-chart'); const resources = [s.health, s.mind, s.spirituality], old = originals(s);
    const performed = act(s, { type: 'PERFORM', caseId: 'uncertain-chart' }, roll);
    expect(performed.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect([s.health, s.mind, s.spirituality]).toEqual(resources);
    expect(s.starMystic.practice).toMatchObject({ playerNode: 'COURTYARD', weatherSeen: true }); expect(starMysticPractice(s)!.history.join(' ')).toContain('当时当地阴天');
    expect(messages(performed)).toContain('实际步行六米'); expect(validateStarMysticLife(s)).toBe(true); expect(originals(s)).toEqual(old);
    s.actionsRemaining = 0; const closed = act(s, { type: 'CLOSE', caseId: 'uncertain-chart' });
    expect(messages(closed)).toContain('实际步行六米返回原教学室'); expect(s.starMystic.practice).toMatchObject({ playerNode: 'ROOM', weatherSeen: true });
    expect(starMysticPractice(s)!.history.join(' ')).toContain('不证明未来天气'); expect(validateStarMysticLife(s)).toBe(true);
    if (roll === 100) { s.actionsRemaining = 100; reject(s, { type: 'REPORT', caseId: 'uncertain-chart' }); nextWeek(s); complete(s, 'uncertain-chart'); expect(s.starMystic.cases['uncertain-chart']!.closes).toBe(2); }
  });

  it('all ordinary reports and reflection reach peaceful acting100 without any gifted item or mastery', () => {
    const s = promoted(), old = originals(s), mastery = structuredClone(s.progression.mastery); s.spirituality = 0;
    for (const id of STAR_MYSTIC_CASE_IDS) expect(complete(s, id).award).not.toHaveBeenCalled();
    expect(s.progression.acting).toBe(75); expect(act(s, { type: 'REFLECT' }).award).not.toHaveBeenCalled();
    expect(s.progression.acting).toBe(100); expect(s.progression.mastery).toEqual(mastery); expect(originals(s)).toEqual(old);
    expect(s.starMystic.practice).toEqual({ ...freshStarMysticPractice(), markerSeen: true, weatherSeen: true });
    expect(s.seer.completedSources.filter(x => x.startsWith('star-mystic-'))).toEqual([...STAR_MYSTIC_CASE_IDS.map(id => `star-mystic-case:${id}`), 'star-mystic-reflection']);
    expect(validateStarMysticState(s)).toBe(true); reject(s, { type: 'REFLECT' }); reject(s, { type: 'REPORT', caseId: 'veiled-marker' });
  });

  it('awards only successful actual first-two ability reports once and never reports a future forecast as a new ability', () => {
    const s = promoted(); act(s, { type: 'BUY_LENSES' });
    for (const caseId of ['veiled-marker', 'willing-cage'] as const) {
      const reported = complete(s, caseId, 'ABILITY'); expect(reported.award).toHaveBeenCalledExactlyOnceWith(`star-mystic-case:${caseId}`, 8); reject(s, { type: 'REPORT', caseId });
    }
    begin(s, 'uncertain-chart'); act(s, { type: 'WITHDRAW', caseId: 'uncertain-chart' });
    reject(s, { type: 'PREPARE', caseId: 'uncertain-chart', method: 'ABILITY' });
    expect(starMysticActions(s).some(a => a.command.type === 'PREPARE' && a.command.caseId === 'uncertain-chart' && a.command.method === 'ABILITY')).toBe(false);
    expect(complete(s, 'uncertain-chart').award).not.toHaveBeenCalled(); act(s, { type: 'REFLECT' }); expect(validateStarMysticState(s)).toBe(true);
  });

  it('delegates the same workshop commands to actual old materials and records current maker5 without rewriting old maker6', () => {
    const s = promoted(), previousScrolls = structuredClone(s.scrollProfessor.workshop.scrolls);
    const compare = (command: StarMysticWorkshopCommand) => {
      const expected = structuredClone(s), direct = context(expected), actual = context(s);
      applyScrollProfessorActivity(expected, command, direct.ctx, direct.award); applyStarMysticActivity(s, command, actual.ctx, actual.award);
      expect(s).toEqual(expected); expect(vi.mocked(actual.ctx.check).mock.calls).toEqual(vi.mocked(direct.ctx.check).mock.calls);
    };
    compare({ type: 'BUY_KIT' }); const material = s.scrollProfessor.workshop.materials.find(m => m.status === 'HELD')!, spirit = s.spirituality;
    compare({ type: 'CRAFT_SCROLL', kind: 'IMPACT' });
    const scroll = s.scrollProfessor.workshop.scrolls.at(-1)!;
    expect(scroll).toMatchObject({ kind: 'IMPACT', makerSequence: 5, materialId: material.id, authorized: false, status: 'HELD' }); expect(s.spirituality).toBe(spirit - 2);
    expect(s.scrollProfessor.workshop.scrolls.slice(0, previousScrolls.length)).toEqual(previousScrolls); expect(previousScrolls.every(x => x.makerSequence === 6)).toBe(true);
    s.actionsRemaining = 0; compare({ authorized: true, scrollId: scroll.id, type: 'AUTHORIZE_SCROLL' });
    expect(s.scrollProfessor.workshop.scrolls.at(-1)!.authorized).toBe(true); expect(s.actionsRemaining).toBe(0);
    compare({ type: 'AUTHORIZE_SCROLL', scrollId: scroll.id, authorized: false });
    const usedOriginal = previousScrolls.find(x => x.status === 'USED');
    expect(usedOriginal).toBeDefined(); reject(s, { type: 'AUTHORIZE_SCROLL', scrollId: usedOriginal!.id, authorized: true });
    expect(validateScrollProfessorLife(s)).toBe(true); expect(validateStarMysticLife(s)).toBe(true);
    expect(starMysticActions(s).filter(a => 'caseId' in a.command).every(a => 'caseId' in a.command && (STAR_MYSTIC_CASE_IDS as readonly string[]).includes(a.command.caseId))).toBe(true);
  });

  it('keeps actual old spell lessons necessary rather than gifting a full library with promotion', () => {
    const s = promoted(); s.wizard.lessons['light-touch'] = { learned: false, attemptWeek: null };
    reject(s, { type: 'CRAFT_SCROLL', kind: 'IMPACT' }); const cash = s.cash, ap = s.actionsRemaining;
    const learned = act(s, { type: 'LEARN_SPELL', spellId: 'light-touch' });
    expect(learned.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 12); expect(s.wizard.lessons['light-touch']!.learned).toBe(true);
    expect([s.actionsRemaining, s.cash]).toEqual([ap - 1, cash - 60]); reject(s, { type: 'LEARN_SPELL', spellId: 'invented-story-magic' });
  });

  it.each(STAR_MYSTIC_CASE_IDS)('%s uses the public final AP without advancing the week until actual zero-AP cleanup', caseId => {
    const s = promoted(); reach(s, caseId); begin(s, caseId); s.actionsRemaining = 1;
    const week = s.week, performed = applySliceIntent(s, { type: 'STAR_MYSTIC', command: { type: 'PERFORM', caseId } });
    expect([performed.week, performed.actionsRemaining]).toEqual([week, 0]); expect(starMysticInside(performed)).toBe(true);
    expect(() => applySliceIntent(performed, { type: 'ACTION', action: 'WORK' })).toThrow(); expect(() => applySliceIntent(performed, { type: 'ACTION', action: 'REST' })).toThrow();
    const knowledge = [performed.starMystic.practice.markerSeen, performed.starMystic.practice.weatherSeen];
    const closed = applySliceIntent(performed, { type: 'STAR_MYSTIC', command: { type: 'CLOSE', caseId } });
    expect(closed.week).toBe(week + 1); expect(starMysticInside(closed)).toBe(false);
    expect(closed.starMystic.practice).toMatchObject({ screen: 'SHUT', cageActive: false, companionNode: 'WAITING', playerNode: 'ROOM' });
    expect([closed.starMystic.practice.markerSeen, closed.starMystic.practice.weatherSeen]).toEqual(knowledge); expect(validateStarMysticLife(closed)).toBe(true);
  });

  it('returns detached public projection histories and never leaks the marker from private facts before actual success', () => {
    const s = promoted(); act(s, { type: 'BUY_LENSES' }); begin(s, 'veiled-marker', 'ABILITY');
    expect(publicText(s)).not.toContain('三道水平刻痕'); act(s, { type: 'PERFORM', caseId: 'veiled-marker' }); act(s, { type: 'CLOSE', caseId: 'veiled-marker' });
    const practice = starMysticPractice(s)!, cases = starMysticCases(s); practice.history.push('invented'); cases[0]!.observations.push('invented');
    expect(starMysticPractice(s)!.history).not.toContain('invented'); expect(starMysticCases(s)[0]!.observations).not.toContain('invented');
    expect(publicText(s)).toContain('历史知识'); expect(publicText(s)).toContain('三道水平刻痕');
    expect(new Set(starMysticActions(s).map(a => a.id)).size).toBe(starMysticActions(s).length);
  });

  it('rejects malformed commands, forged inventory or foresight and detects physical presence independently of a contact flag', () => {
    expect(isStarMysticActivity(null as unknown as StarMysticCommand)).toBe(false); expect(isStarMysticActivity({ type: 'LEARN_GUIDANCE' })).toBe(false);
    for (const command of [null, {}, { type: 'BUY_LENSES', free: true }, { type: 'OBSERVE', caseId: 'invented' }, { type: 'PREPARE', caseId: 'uncertain-chart', method: 'ABILITY' }, { type: 'PERFORM', caseId: 'veiled-marker', reveal: 'all' }, { type: 'CLOSE', caseId: 'willing-cage', teleport: true }, { type: 'REPORT', caseId: 'willing-cage', mastery: 8 }, { type: 'REFLECT', forecast: true }, { type: 'CREATE_STORY_SPELL' }]) { expect(validateStarMysticCommand(command)).toBe(false); reject(promoted(), command); }
    const changes: ((s: SliceState) => void)[] = [
      s => { s.starMystic.practice.screen = 'OPEN'; }, s => { s.starMystic.practice.lenses = 'HELD'; }, s => { s.starMystic.practice.cageActive = true; },
      s => { s.starMystic.practice.companionNode = 'MARK'; }, s => { s.starMystic.practice.playerNode = 'COURTYARD'; },
    ];
    for (const change of changes) { const s = promoted(); change(s); expect(starMysticInside(s)).toBe(true); expect(validateStarMysticLife(s)).toBe(false); }
    for (const change of [
      (s: SliceState) => { s.starMystic.practice.markerSeen = true; }, (s: SliceState) => { s.starMystic.practice.weatherSeen = true; },
      (s: SliceState) => { Object.assign(s.starMystic.practice, { copiedLenses: 1 }); }, (s: SliceState) => { Object.assign(s.starMystic, { practice: null }); },
      (s: SliceState) => { Object.assign(s.starMystic.cases, { 'veiled-marker': null }); }, (s: SliceState) => { s.starMystic.cases['veiled-marker']!.closes = 1; },
      (s: SliceState) => { s.seer.completedSources.push('star-mystic-case:veiled-marker'); }, (s: SliceState) => { s.seer.completedSources.push('star-mystic-reflection'); },
    ]) { const s = promoted(); change(s); expect(validateStarMysticLife(s)).toBe(false); }
  });
});
