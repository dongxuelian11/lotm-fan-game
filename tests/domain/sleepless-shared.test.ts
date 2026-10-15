import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState,
} from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createSleeplessState } from '../../src/domain/sleepless/index.js';
import { SLEEPLESS_ABILITY_IDS, SLEEPLESS_WATCH_IDS } from '../../src/domain/sleepless/types.js';

interface NaturalCapture {
  creation: Parameters<typeof createSliceRun>[1];
  seed: string;
  commands: SliceIntent[];
  promoted: SliceState;
  practiced: SliceState;
  combatStart: SliceState;
  terminal: SliceState;
  final: SliceState;
}
interface BoundaryCapture { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }

const currentCapture=(capture:any)=>{for(const key of Object.keys(capture)){const value=capture[key];if(value&&typeof value==='object'&&Number.isInteger(value.schemaVersion))capture[key]=migrateSliceState(value);}return capture;};
const expectPriorFields=(next:any,old:any)=>{for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect(next[key]).toEqual(old[key]);};
const capture = (): NaturalCapture => currentCapture(JSON.parse(readFileSync(new URL('../fixtures/sleepless-v0200/shared-stage-natural.json', import.meta.url), 'utf8')));
const boundary = (name: 'watch' | 'combat'): BoundaryCapture => currentCapture(JSON.parse(readFileSync(new URL(`../fixtures/sleepless-v0200/shared-${name}-save-boundary.json`, import.meta.url), 'utf8')));

describe('Sleepless actual public watch and growth route', () => {
  it('replays every original public command and reaches all captured milestones without changing the seed', () => {
    const c = capture();
    let s = createSliceRun(c.final.runId, c.creation, c.seed);
    const milestones = [c.promoted, c.practiced, c.combatStart, c.terminal, c.final];
    const reached = new Set<number>();
    for (const command of c.commands) {
      s = applySliceIntent(s, command);
      assertValidSliceState(s);
      for (const [index, state] of milestones.entries()) if (s.revision === state.revision) {
        expect(s).toEqual(state);
        reached.add(index);
      }
    }
    expect(s).toEqual(c.final);
    expect(reached.size).toBe(milestones.length);
    expect(s.progression.pathwayId).toBe('darkness');
    expect(s.progression.sequence).toBe(9);
    expect(s.progression.acting).toBe(100);
    expect(Object.keys(s.progression.mastery)).toEqual([...SLEEPLESS_ABILITY_IDS]);
    expect(s.random.seed).toBe(c.seed);
    expect(projectSliceState(s).maxSpirituality).toBe(30);
    expect(s.combatHistory.length).toBeGreaterThan(0);
  });

  it('migrates frozen 0.19 records while preserving original fields and adding missing stage defaults', () => {
    const old = JSON.parse(readFileSync(new URL('../fixtures/vampire-v0190/natural.json', import.meta.url), 'utf8')).final;
    const bytes = JSON.stringify(old);
    expect(old.schemaVersion).toBe(18);
    expect(old.contentVersion).toBe('vampire-life-v18');
    expect(old).not.toHaveProperty('sleepless');
    const next = migrateSliceState(old);
    const { sleepless, schemaVersion, contentVersion, ...rest } = next;
    const { schemaVersion: oldSchema, contentVersion: oldContent, ...prior } = old;
    expectPriorFields(next,old);
    expect([oldSchema, oldContent]).toEqual([18, 'vampire-life-v18']);
    expect([schemaVersion, contentVersion]).toEqual([177,'blood-duke-v177']);
    expect(sleepless).toEqual(createSleeplessState());
    assertValidSliceState(next);
    expect(migrateSliceState(next)).toEqual(next);
    expect(JSON.stringify(old)).toBe(bytes);
  });

  it('reaches 100 digestion through three actual peaceful watches and reflection with only three S9 abilities', () => {
    const s = capture().practiced, p = projectSliceState(s).sleepless;
    assertValidSliceState(s);
    expect(s.progression).toMatchObject({ pathwayId: 'darkness', sequence: 9, acting: 100 });
    expect(s.sleepless.reflected).toBe(true);
    for (const watchId of SLEEPLESS_WATCH_IDS) {
      expect(s.sleepless.watches[watchId].status).toBe('RESOLVED');
      expect(s.sleepless.watches[watchId].attemptWeek).not.toBeNull();
      expect(['OBSERVE', 'REPORT']).toContain(s.sleepless.watches[watchId].method);
      expect(s.seer.completedSources.filter(source => source === `sleepless-watch:${watchId}`)).toHaveLength(1);
    }
    expect(s.seer.completedSources.filter(source => source === 'sleepless-reflection')).toHaveLength(1);
    expect(s.seer.completedSources).not.toContain('sleepless-dispute');
    expect(s.sleepless.encounter.status).toBe('AVAILABLE');
    expect(s.combat).toBeNull();
    expect(s.combatHistory).toEqual([]);
    expect(Object.keys(s.progression.mastery)).toEqual([...SLEEPLESS_ABILITY_IDS]);
    expect(Object.values(s.progression.mastery).reduce((sum, value) => sum + value, 0)).toBe(24);
    expect(p.abilities.map(ability => ability.id)).toEqual([...SLEEPLESS_ABILITY_IDS]);
    expect(p.formulaKnown).toBe(false);
    expect(p.formula).toEqual([]);
    expect(p.environment).toContain('白天仍要休整');
  });

  it('keeps observations and results unknown until the player personally surveys each original site', () => {
    const s = capture().promoted, p = projectSliceState(s).sleepless, before = structuredClone(s);
    for (const watchId of SLEEPLESS_WATCH_IDS) {
      const projected = p.watches.find(watch => watch.id === watchId)!;
      expect(projected).toMatchObject({ status: 'AVAILABLE', observations: [], result: null });
      for (const approach of ['OBSERVE', 'REPORT'] as const) expect(() => applySliceIntent(s, {
        type: 'SLEEPLESS', command: { type: 'WATCH', watchId, approach },
      })).toThrow('先当面接班');
    }
    const encounter = p.watches.find(watch => watch.id === 'sleepless-watch')!;
    expect(encounter.observations).toEqual([]);
    expect(encounter.result).toBeNull();
    expect(s.sleepless.encounter).toMatchObject({ observed: false, night: false });
    for (const type of ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'] as const) expect(() => applySliceIntent(s, {
      type: 'SLEEPLESS', command: { type },
    })).toThrow('先亲自查看');
    expect(s).toEqual(before);
  });

  it('never repeats a completed watch or reflection, including after serializing the real state', () => {
    const s: SliceState = JSON.parse(JSON.stringify(capture().practiced)), before = structuredClone(s);
    for (const watchId of SLEEPLESS_WATCH_IDS) {
      expect(() => applySliceIntent(s, { type: 'SLEEPLESS', command: { type: 'SURVEY', watchId } })).toThrow('不重复成长');
      for (const approach of ['OBSERVE', 'REPORT'] as const) expect(() => applySliceIntent(s, {
        type: 'SLEEPLESS', command: { type: 'WATCH', watchId, approach },
      })).toThrow('不重复成长');
    }
    expect(() => applySliceIntent(s, { type: 'SLEEPLESS', command: { type: 'REFLECT' } })).toThrow('已反思');
    expect(s).toEqual(before);
    assertValidSliceState(s);
  });

  it('rejects each missing original watch or reflection source instead of inventing replacement growth', () => {
    for (const source of [...SLEEPLESS_WATCH_IDS.map(id => `sleepless-watch:${id}`), 'sleepless-reflection']) {
      const s = capture().practiced;
      assertValidSliceState(s);
      expect(s.seer.completedSources).toContain(source);
      s.seer.completedSources = s.seer.completedSources.filter(id => id !== source);
      expect(() => assertValidSliceState(s)).toThrow();
    }
    const forged = capture().promoted;
    forged.seer.completedSources.push('sleepless-watch:quiet-warehouse');
    expect(() => assertValidSliceState(forged)).toThrow();
  });

  it('replays the actual watch save boundary once and preserves original potion ownership and provenance', () => {
    const c = boundary('watch'), before = structuredClone(c.beforeLast);
    expect(c.lastIntent.type).toBe('SLEEPLESS');
    assertValidSliceState(c.beforeLast);
    const next = applySliceIntent(c.beforeLast, c.lastIntent);
    assertValidSliceState(next);
    expect(next).toEqual(c.final);
    expect(c.beforeLast).toEqual(before);
    expect(next.sleepless.bottles).toEqual(c.beforeLast.sleepless.bottles);
    expect(next.sleepless.resupply).toEqual(c.beforeLast.sleepless.resupply);
    expect(next.seer.completedSources.length).toBe(c.beforeLast.seer.completedSources.length + 1);
    expect(next.progression.acting).toBe(Math.min(100, c.beforeLast.progression.acting + 25));
    expect(() => applySliceIntent(next, c.lastIntent)).toThrow();
  });

  it('replays the actual combat save boundary with one new recorded round and no copied originals', () => {
    const c = boundary('combat'), before = structuredClone(c.beforeLast);
    expect(c.lastIntent.type).toBe('COMBAT_ROUND');
    expect(c.beforeLast.combat?.encounterId).toBe('SLEEPLESS_WATCH');
    expect(c.beforeLast.sleepless.encounter).toMatchObject({ status: 'FIGHTING', observed: true, night: true });
    assertValidSliceState(c.beforeLast);
    const next = applySliceIntent(c.beforeLast, c.lastIntent);
    assertValidSliceState(next);
    expect(next).toEqual(c.final);
    expect(c.beforeLast).toEqual(before);
    expect(next.combatHistory.slice(0, -1)).toEqual(c.beforeLast.combatHistory);
    expect(next.combatHistory).toHaveLength(c.beforeLast.combatHistory.length + 1);
    expect(next.sleepless.bottles).toEqual(c.beforeLast.sleepless.bottles);
    expect(next.sleepless.resupply).toEqual(c.beforeLast.sleepless.resupply);
    expect(next.progression.acting).toBe(c.beforeLast.progression.acting);
    expect(Object.keys(next.progression.mastery)).toEqual([...SLEEPLESS_ABILITY_IDS]);
  });

  it('starts the optional encounter from a real observed night and keeps completed peaceful growth intact', () => {
    const c = capture(), start = c.combatStart;
    expect(start.combat?.encounterId).toBe('SLEEPLESS_WATCH');
    expect(start.sleepless.encounter).toMatchObject({ status: 'FIGHTING', observed: true, night: true });
    expect(start.sleepless.encounter.startHistoryIndex).toBe(start.combatHistory.length);
    expect(start.progression.acting).toBe(100);
    expect(start.sleepless.watches).toEqual(c.practiced.sleepless.watches);
    expect(c.terminal.sleepless.watches).toEqual(c.practiced.sleepless.watches);
    expect(c.terminal.combat).toBeNull();
    expect(['RESOLVED', 'RETREATED', 'LOST']).toContain(c.terminal.sleepless.encounter.status);
    expect(c.terminal.progression.acting).toBe(100);
    assertValidSliceState(c.terminal);
  });
});
