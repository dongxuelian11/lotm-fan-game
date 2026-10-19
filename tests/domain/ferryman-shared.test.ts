import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSliceRun, applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
import { FERRYMAN_ABILITY_IDS } from '../../src/domain/ferryman/types.js';
import { FERRYMAN_CASE_IDS } from '../../src/domain/ferryman/life.js';
import { activeFerrymanChannel } from '../../src/domain/ferryman/index.js';
interface Capture {
  creation: Parameters<typeof createSliceRun>[1]; seed: string; prefixCount: number; commands: SliceIntent[];
  departureStart: SliceState; handoffStart: SliceState; guidanceStart: SliceState; promoted: SliceState; practiced: SliceState;
  combatStart: SliceState; beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState;
  sharedPublicPrefix?: number; branch?: string;
}
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
const previous = (name: string): Capture => JSON.parse(readFileSync(`tests/fixtures/${name}/natural.json`, 'utf8'));
function read(name = 'natural'): Capture {
  const capture: Capture = JSON.parse(readFileSync(`tests/fixtures/ferryman-v01490/${name}.json`, 'utf8'));
  for (const k of ['departureStart', 'handoffStart', 'guidanceStart', 'promoted', 'practiced', 'combatStart', 'beforeLast', 'final'] as const) if (capture[k]) capture[k] = migrateSliceState(capture[k]);
  return capture;
}
const roots = ['corpsecollector', 'gravedigger', 'spiritmedium', 'spiritGuide', 'gatekeeper', 'undying'] as const;
function oldHistory(s: SliceState, before: SliceState) { for (const root of roots) expect(s[root]).toEqual(before[root]); expect(s.runId).toBe(before.runId); expect(s.random.seed).toBe(before.random.seed); expect(s.character.gender).toBe(before.character.gender); }
function replay(c: Capture): SliceState { let s = createSliceRun(c.final.runId, c.creation, c.seed); for (const command of c.commands) s = applySliceIntent(s, command); return s; }

describe('Ferryman exact public prefixes, finite sources and shared state boundary', () => {
  it('replays the exact428-command long chapter prefix through current-era promotion, practice and actual combat outcome', () => {
    const c = read(), old = previous('long-chapter-v01390'); expect(c.prefixCount).toBe(428); expect(c.commands.slice(0, 428)).toEqual(old.commands); expect(c.seed).toBe(old.seed);
    expect(c.departureStart).toEqual(migrateSliceState(old.final));
    expect(c.departureStart).toMatchObject({ week: 3235, health: 55, mind: 68, spirituality: 104, cash: 194, actionsRemaining: 1, longChapter: { handoff: null } });
    expect(c.commands[428]).toEqual({ type: 'LONG_CHAPTER', command: { type: 'CONTINUE_FERRYMAN' } });
    const result = replay(c); expect(result).toEqual(c.final); assertValidSliceState(result); oldHistory(result, c.departureStart);
    expect(result.longChapter).toEqual(c.handoffStart.longChapter);
    expect(result.undying.encounter).toMatchObject({ status: 'AVAILABLE', enemy: { health: 100, weaponLocation: 'HAND' } });
  }, 60000);
  it('separately replays the422-command original-era branch without forcing a cycle or reviving Owen', () => {
    const c = read('original'), old = previous('undying-v01260'); expect(c.prefixCount).toBe(422); expect(c.commands.slice(0, 422)).toEqual(old.commands); expect(c.seed).toBe(old.seed);
    const expected = migrateSliceState(old.final); for (const [index, id] of [[606, 'record-370-606'], [611, 'record-373-611']] as const) { expect(expected.chronicle[index]!.id).toBe(id); expect(c.departureStart.chronicle[index]!.id).toBe(id); expect(c.departureStart.chronicle[index]!.text).toContain('完成原记忆准备后，可在长期章节'); expect(expected.chronicle[index]!.text).toContain('六十年周期尚未实际经历'); expected.chronicle[index]!.text = c.departureStart.chronicle[index]!.text; } expect(c.departureStart).toEqual(expected); const result = replay(c); expect(result).toEqual(c.final); assertValidSliceState(result);
    expect(result.progression.sequence).toBe(3); expect(activeFerrymanChannel(result)?.id).toBe('ORIGINAL'); expect(result.undying.lifecycle.experiencedCycles).toBe(0); expect(result.longChapter.handoff).toBeNull();
    expect(result.undying.encounter.enemy).toMatchObject({ status: 'DEAD', health: 0, weaponLocation: 'YARD' }); oldHistory(result, c.departureStart);
  }, 60000);
  it('replays all actual one-command boundaries without mutating their input or generating old people', () => {
    const entries = JSON.parse(readFileSync('tests/fixtures/ferryman-v01490/boundaries.json', 'utf8')) as Record<string, Boundary>; expect(Object.keys(entries).length).toBeGreaterThan(5);
    for (const b of Object.values(entries)) {
      const state = migrateSliceState(b.beforeLast), expected = migrateSliceState(b.final), bytes = JSON.stringify(state), intent = JSON.stringify(b.lastIntent); assertValidSliceState(state); assertValidSliceState(expected);
      expect(applySliceIntent(state, b.lastIntent)).toEqual(expected); expect(JSON.stringify(state)).toBe(bytes); expect(JSON.stringify(b.lastIntent)).toBe(intent);
      if (state.longChapter.handoff !== null) { expect(expected.longChapter).toEqual(state.longChapter); oldHistory(expected, state); }
    }
  }, 60000);
  it('retains three current cases, actual report outcomes, paper destinations and all exhausted bottles', () => {
    const c = read(), s = c.practiced; assertValidSliceState(s); expect(s.progression).toMatchObject({ pathwayId: 'death', sequence: 3, acting: 100 });
    expect(Object.keys(s.ferryman.life.cases)).toEqual([...FERRYMAN_CASE_IDS]); expect(Object.values(s.ferryman.life.cases).every(v => v.status === 'RESOLVED')).toBe(true); expect(s.ferryman.life.reflected).toBe(true); expect(projectSliceState(s).ferryman.insideCase).toBe(false);
    const source = activeFerrymanChannel(s)!; expect(source.id).toBe('POST_CYCLE'); expect(source.provider.id).toBe('FR3-HANNA'); expect(source.preparedWeek).toBeNull(); expect(source.preparations).toHaveLength(3);
    for (const bottle of source.bottles.filter(v => v.status === 'CONSUMED')) { expect(bottle.preparationWeek).toBe(bottle.consumedWeek); expect(bottle.consumedWeek).toBeGreaterThanOrEqual(s.undying.promotionWeek! + 12); expect(source.preparationWindows.some(w => w.bottleId === bottle.id && w.outcome === 'CONSUMED')).toBe(true); }
    expect(source.bottles.filter(v => ['SUCCESS', 'GREAT_SUCCESS'].includes(v.outcome ?? ''))).toHaveLength(1);
    expect(s.ferryman.undyingActingAtPromotion).toBe(100); expect(FERRYMAN_ABILITY_IDS.every(id => Object.hasOwn(s.progression.mastery, id))).toBe(true); oldHistory(s, c.departureStart); expect(s.longChapter).toEqual(c.handoffStart.longChapter);
  });
  it('keeps independent Rowan resources, original club and actual paid power sequence', () => {
    const c = read(), s = c.final, e = s.ferryman.encounter; assertValidSliceState(s); expect(s.combat).toBeNull(); expect(e.terminal).not.toBeNull(); expect(e.targetId).toBe('FR3-ROWAN');
    expect(e.enemySpirituality).toBe(120 - e.powerUses.ECHO_STRIKE * 5 - e.powerUses.SEAL_WARD * 4 - e.powerUses.FOCUS * 4);
    const rounds = s.combatHistory.filter(r => r.ferrymanOutcome); expect(rounds.length).toBeGreaterThan(0); let spent = 0;
    for (const r of rounds) { const out = r.ferrymanOutcome!; expect(out.source).toMatchObject({ targetId: 'FR3-ROWAN', enemyWeapon: 'FR3-ROWAN-CLUB', ordinaryExit: true, pursuit: false, distanceMetres: 2 }); spent += out.enemyActions.reduce((n, a) => n + a.paidCost, 0); expect(out.enemySpirituality).toBe(120 - spent); }
    expect(e.enemySpirituality).toBe(120 - spent); expect(s.longChapter).toEqual(c.handoffStart.longChapter); oldHistory(s, c.departureStart);
    if (s.status === 'DEAD') { expect(s.health).toBe(0); expect(s.ending?.kind).toBe('DEATH'); for (const command of [{ type: 'FERRYMAN', command: { type: 'ERA_REST' } }, { type: 'LONG_CHAPTER', command: { type: 'AWAIT_REVIVAL' } }] as SliceIntent[]) expect(() => applySliceIntent(s, command)).toThrow(); }
  });
  it('rejects stale old-epoch actions after real handoff and preserves failed public input', () => {
    const s = read().handoffStart, bytes = JSON.stringify(s);
    const stale: SliceIntent[] = [{ type: 'UNDYING', command: { type: 'LEARN_GUIDANCE' } }, { type: 'LONG_CHAPTER', command: { type: 'REST' } }, { type: 'LONG_CHAPTER', command: { type: 'ENTER_RECEPTION' } }, { type: 'ACTION', action: 'WORK' }];
    for (const command of stale) expect(() => applySliceIntent(s, command)).toThrow(); expect(JSON.stringify(s)).toBe(bytes);
  });
  it('uses a genuine alternate peaceful prefix if the actual optional battle killed the player', () => {
    const actual = read(); if (actual.final.status !== 'DEAD') return;
    expect(existsSync('tests/fixtures/ferryman-v01490/peaceful.json')).toBe(true); const peace = read('peaceful');
    expect(peace.branch).toBe('BEFORE_OPTIONAL_FIGHT'); expect(peace.prefixCount).toBe(428); expect(peace.seed).toBe(actual.seed); expect(peace.sharedPublicPrefix).toBeTypeOf('number'); const split = peace.sharedPublicPrefix!;
    expect(peace.commands.slice(0, split)).toEqual(actual.commands.slice(0, split)); expect(actual.commands[split]).toEqual({ type: 'FERRYMAN', command: { type: 'ENCOUNTER_FIGHT' } }); expect(peace.commands[split]).toEqual({ type: 'FERRYMAN', command: { type: 'LEAVE_ENCOUNTER' } });
    expect(peace.commands.at(-1)).toEqual({ type: 'FERRYMAN', command: { type: 'ERA_WORK' } }); const result = replay(peace); expect(result).toEqual(peace.final); assertValidSliceState(result); expect(result.status).toBe('ACTIVE'); expect(result.health).toBeGreaterThan(0); expect(actual.final.status).toBe('DEAD'); oldHistory(result, actual.departureStart);
  }, 60000);
});
