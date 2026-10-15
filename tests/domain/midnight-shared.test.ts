import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SLICE_LIFE } from '../../src/content/slice-events.js';
import {
  applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState,
} from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createMidnightState } from '../../src/domain/midnight/index.js';
import { MIDNIGHT_ABILITY_IDS, MIDNIGHT_CASE_IDS } from '../../src/domain/midnight/types.js';
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
const capture = (): NaturalCapture => currentCapture(JSON.parse(readFileSync(new URL('../fixtures/midnight-v0210/shared-stage-natural.json', import.meta.url), 'utf8')));
const boundary = (name: 'poem' | 'combat'): BoundaryCapture => currentCapture(JSON.parse(readFileSync(new URL(`../fixtures/midnight-v0210/shared-${name}-save-boundary.json`, import.meta.url), 'utf8')));
const inheritedAbilities = [...SLEEPLESS_ABILITY_IDS, ...MIDNIGHT_ABILITY_IDS];

/** Recover a real public boundary from the original creation, seed and commands. */
function beforeCommand(predicate: (command: SliceIntent) => boolean): SliceState {
  const c = capture();
  let s = createSliceRun(c.final.runId, c.creation, c.seed);
  for (const command of c.commands) {
    if (predicate(command)) return s;
    s = applySliceIntent(s, command);
  }
  throw new Error('The natural capture is missing the requested public boundary.');
}

describe('Midnight Poet actual public acquisition, poetry and growth route', () => {
  it('replays the original creation and seed through every recorded command and milestone', () => {
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
    expect(s.progression).toMatchObject({ pathwayId: 'darkness', sequence: 8, acting: 100 });
    expect(Object.keys(s.progression.mastery)).toEqual(inheritedAbilities);
    expect(s.random.seed).toBe(c.seed);
    expect(projectSliceState(s).maxSpirituality).toBe(45);
    expect(c.combatStart.combat?.encounterId).toBe('MIDNIGHT_DISPUTE');
    expect(c.combatStart.midnight.encounter).toMatchObject({ status: 'FIGHTING', observed: true, bystanderCleared: true });
    expect(c.combatStart.midnight.encounter.startHistoryIndex).toBe(c.combatStart.combatHistory.length);
    expect(c.terminal.combat).toBeNull();
    expect(['RESOLVED', 'RETREATED', 'LOST']).toContain(c.terminal.midnight.encounter.status);
    expect(c.terminal.combatHistory.length).toBeGreaterThan(c.combatStart.combatHistory.length);
    expect(c.terminal.midnight.cases).toEqual(c.practiced.midnight.cases);
  });

  it('migrates frozen 0.20 facts while preserving original fields and adding missing stage defaults', () => {
    const old = JSON.parse(readFileSync(new URL('../fixtures/sleepless-v0200/natural.json', import.meta.url), 'utf8')).final;
    const bytes = JSON.stringify(old);
    expect(old.schemaVersion).toBe(19);
    expect(old.contentVersion).toBe('sleepless-life-v19');
    expect(old).not.toHaveProperty('midnight');
    const next = migrateSliceState(old);
    const { midnight, schemaVersion, contentVersion, ...rest } = next;
    const { schemaVersion: oldSchema, contentVersion: oldContent, ...prior } = old;
    expectPriorFields(next,old);
    expect([oldSchema, oldContent]).toEqual([19, 'sleepless-life-v19']);
    expect([schemaVersion, contentVersion]).toEqual([177,'blood-duke-v177']);
    expect(midnight).toEqual(createMidnightState());
    assertValidSliceState(next);
    expect(migrateSliceState(next)).toEqual(next);
    expect(JSON.stringify(old)).toBe(bytes);
  });

  it('reaches peaceful digestion100 while retaining all three inherited abilities and the original Sleepless history', () => {
    const c = capture(), s = c.practiced, p = projectSliceState(s);
    assertValidSliceState(s);
    expect(s.progression).toMatchObject({ pathwayId: 'darkness', sequence: 8, acting: 100 });
    expect(Object.keys(s.progression.mastery)).toEqual(inheritedAbilities);
    expect(s.midnight.sleeplessActingAtPromotion).toBe(100);
    expect(s.midnight.promotionWeek! - s.progression.promotionWeek!).toBeGreaterThanOrEqual(4);
    expect(s.midnight.reflected).toBe(true);
    for (const caseId of MIDNIGHT_CASE_IDS) {
      expect(s.midnight.cases[caseId]!.status).toBe('RESOLVED');
      expect(s.midnight.cases[caseId]!.attemptWeek).not.toBeNull();
      expect(['POEM', 'TALK']).toContain(s.midnight.cases[caseId]!.method);
      expect(s.seer.completedSources.filter(source => source === `midnight-case:${caseId}`)).toHaveLength(1);
    }
    expect(s.seer.completedSources.filter(source => source === 'midnight-reflection')).toHaveLength(1);
    expect(s.seer.completedSources).not.toContain('midnight-dispute');
    expect(s.midnight.encounter.status).toBe('AVAILABLE');
    expect(s.combat).toBeNull();
    expect(s.combatHistory).toEqual(c.promoted.combatHistory);
    expect(s.sleepless).toEqual(c.promoted.sleepless);
    expect(s.midnight.bottles).toEqual(c.promoted.midnight.bottles);
    expect(Object.values(s.progression.mastery).reduce((sum, value) => sum + value, 0)
      - Object.values(c.promoted.progression.mastery).reduce((sum, value) => sum + value, 0)).toBe(24);
    expect(p.midnight.abilities.map(ability => ability.id)).toEqual([...MIDNIGHT_ABILITY_IDS]);
    expect(p.sleepless.abilities.map(ability => ability.id)).toEqual([...SLEEPLESS_ABILITY_IDS]);
    expect(p.sleepless.acting).toBe(100);
    expect(p.midnight).toMatchObject({ formulaKnown: false, formula: [], acting: 100 });
    expect(p.midnight.environment).toContain('旁人');
    for (const watchId of SLEEPLESS_WATCH_IDS) expect(() => applySliceIntent(s, {
      type: 'SLEEPLESS', command: { type: 'WATCH', watchId, approach: 'REPORT' },
    })).toThrow();
  });

  it('withholds observations and outcomes until actual observation and requires preparation before voiced poetry', () => {
    const s = capture().promoted, before = structuredClone(s), p = projectSliceState(s).midnight;
    for (const caseId of MIDNIGHT_CASE_IDS) {
      expect(p.cases.find(entry => entry.id === caseId)).toMatchObject({ status: 'AVAILABLE', observations: [], result: null });
      for (const method of ['POEM', 'TALK'] as const) expect(() => applySliceIntent(s, {
        type: 'MIDNIGHT', command: { type: 'PERFORM', caseId, method },
      })).toThrow();
      expect(() => applySliceIntent(s, { type: 'MIDNIGHT', command: { type: 'PREPARE', caseId } })).toThrow();
    }
    expect(p.cases.find(entry => entry.id === 'midnight-dispute')).toMatchObject({ observations: [], result: null });
    expect(s.midnight.encounter).toMatchObject({ observed: false, bystanderCleared: false });
    for (const type of ['CLEAR_BYSTANDER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'] as const) expect(() => applySliceIntent(s, {
      type: 'MIDNIGHT', command: { type },
    })).toThrow();
    expect(s).toEqual(before);

    const observed = beforeCommand(command => command.type === 'MIDNIGHT' && command.command.type === 'PREPARE');
    const caseId = MIDNIGHT_CASE_IDS.find(id => observed.midnight.cases[id]!.status === 'OBSERVED')!;
    expect(caseId).toBeDefined();
    expect(projectSliceState(observed).midnight.cases.find(entry => entry.id === caseId)!.observations.length).toBeGreaterThan(0);
    expect(() => applySliceIntent(observed, { type: 'MIDNIGHT', command: { type: 'PERFORM', caseId, method: 'POEM' } })).toThrow('先取得本次同意');
  });

  it('withdraws without an action fee or growth at zero mind, while zero AP still runs normal weekly settlement', () => {
    const c = boundary('poem');
    expect(c.lastIntent).toMatchObject({ type: 'MIDNIGHT', command: { type: 'PERFORM', method: 'POEM' } });
    if (c.lastIntent.type !== 'MIDNIGHT' || c.lastIntent.command.type !== 'PERFORM') throw new Error('Expected a recorded poem boundary.');
    const caseId = c.lastIntent.command.caseId;
    for (const status of ['OBSERVED', 'PREPARED'] as const) {
      const s = structuredClone(c.beforeLast);
      s.midnight.cases[caseId]!.status = status;
      s.actionsRemaining = 1;
      s.mind = 0;
      assertValidSliceState(s);
      const before = structuredClone(s), p = projectSliceState(s).midnight;
      expect(p.actions.find(action => action.command.type === 'WITHDRAW' && action.command.caseId === caseId)).toMatchObject({ enabled: true });
      const next = applySliceIntent(s, { type: 'MIDNIGHT', command: { type: 'WITHDRAW', caseId } });
      assertValidSliceState(next);
      expect(s).toEqual(before);
      expect(next.midnight.cases[caseId]).toEqual({ ...before.midnight.cases[caseId], status: 'WITHDRAWN' });
      expect([next.actionsRemaining, next.cash, next.mind, next.spirituality, next.week]).toEqual([
        before.actionsRemaining, before.cash, before.mind, before.spirituality, before.week,
      ]);
      expect(next.progression).toEqual(before.progression);
      expect(next.seer.completedSources).toEqual(before.seer.completedSources);
      expect(next.midnight.bottles).toEqual(before.midnight.bottles);
      expect(next.random).toEqual(before.random);
      expect(projectSliceState(next).midnight.cases.find(entry => entry.id === caseId)).toMatchObject({ status: 'WITHDRAWN', observations: [], result: null });
      expect(() => applySliceIntent(next, { type: 'MIDNIGHT', command: { type: 'WITHDRAW', caseId } })).toThrow();
    }
    const zero = structuredClone(c.beforeLast);
    zero.actionsRemaining = 0;
    zero.mind = 0;
    const livingCost = SLICE_LIFE[zero.lifeTier].cost;
    zero.cash = livingCost;
    expect(zero.debts).toEqual([]);
    assertValidSliceState(zero);
    const advanced = applySliceIntent(zero, { type: 'MIDNIGHT', command: { type: 'WITHDRAW', caseId } });
    assertValidSliceState(advanced);
    expect(advanced.midnight.cases[caseId]!.status).toBe('WITHDRAWN');
    expect([advanced.week, advanced.actionsRemaining, advanced.cash, advanced.mind, advanced.spirituality]).toEqual([
      zero.week + 1, zero.weeklyBudget, zero.cash - livingCost, 0, zero.spirituality,
    ]);
    expect(advanced.date).not.toEqual(zero.date);
    expect(advanced.progression).toEqual(zero.progression);
    expect(advanced.seer.completedSources).toEqual(zero.seer.completedSources);
    expect(advanced.chronicle.slice(zero.chronicle.length).map(record => record.title)).toContain('本周生活费');
  });

  it('rejects combat before the actual bystander clearance without spending resources or changing the encounter', () => {
    const s = beforeCommand(command => command.type === 'MIDNIGHT' && command.command.type === 'CLEAR_BYSTANDER');
    assertValidSliceState(s);
    expect(s.midnight.encounter).toMatchObject({ status: 'AVAILABLE', observed: true, bystanderCleared: false });
    const before = structuredClone(s);
    expect(projectSliceState(s).midnight.actions.find(action => action.command.type === 'ENCOUNTER_FIGHT')).toMatchObject({ enabled: false });
    expect(() => applySliceIntent(s, { type: 'MIDNIGHT', command: { type: 'ENCOUNTER_FIGHT' } })).toThrow('先让未同意');
    expect(s).toEqual(before);
    expect(s.combat).toBeNull();
    expect(capture().combatStart.midnight.encounter.bystanderCleared).toBe(true);
  });

  it('cannot repeat completed assistance or reflection, or delete, duplicate or fabricate a completion source', () => {
    const original = capture().practiced;
    const s: SliceState = JSON.parse(JSON.stringify(original));
    for (const caseId of MIDNIGHT_CASE_IDS) {
      for (const type of ['OBSERVE', 'PREPARE', 'WITHDRAW'] as const) expect(() => applySliceIntent(s, {
        type: 'MIDNIGHT', command: { type, caseId },
      })).toThrow();
      for (const method of ['POEM', 'TALK'] as const) expect(() => applySliceIntent(s, {
        type: 'MIDNIGHT', command: { type: 'PERFORM', caseId, method },
      })).toThrow();
    }
    expect(() => applySliceIntent(s, { type: 'MIDNIGHT', command: { type: 'REFLECT' } })).toThrow();
    expect(s).toEqual(original);
    for (const source of [...MIDNIGHT_CASE_IDS.map(id => `midnight-case:${id}`), 'midnight-reflection']) {
      const missing = structuredClone(original);
      missing.seer.completedSources = missing.seer.completedSources.filter(id => id !== source);
      expect(() => assertValidSliceState(missing)).toThrow();
      const duplicate = structuredClone(original);
      duplicate.seer.completedSources.push(source);
      expect(() => assertValidSliceState(duplicate)).toThrow();
    }
    const forged = capture().promoted;
    forged.seer.completedSources.push(`midnight-case:${MIDNIGHT_CASE_IDS[0]}`);
    expect(() => assertValidSliceState(forged)).toThrow();
  });

  it('replays the actual poem and combat save boundaries without copying or restoring potion originals', () => {
    for (const name of ['poem', 'combat'] as const) {
      const c = boundary(name), before = structuredClone(c.beforeLast);
      assertValidSliceState(c.beforeLast);
      const next = applySliceIntent(c.beforeLast, c.lastIntent);
      assertValidSliceState(next);
      expect(next).toEqual(c.final);
      expect(c.beforeLast).toEqual(before);
      expect(next.midnight.bottles).toEqual(before.midnight.bottles);
      expect(next.midnight.resupply).toEqual(before.midnight.resupply);
      expect(next.sleepless).toEqual(before.sleepless);
      expect(Object.keys(next.progression.mastery)).toEqual(inheritedAbilities);
      if (name === 'poem') {
        expect(c.lastIntent).toMatchObject({ type: 'MIDNIGHT', command: { type: 'PERFORM', method: 'POEM' } });
        expect(next.progression.acting).toBe(Math.min(100, before.progression.acting + 25));
        expect(next.seer.completedSources.length).toBe(before.seer.completedSources.length + 1);
        expect(next.spirituality).toBe(before.spirituality - 2);
        expect(() => applySliceIntent(next, c.lastIntent)).toThrow();
      } else {
        expect(c.lastIntent.type).toBe('COMBAT_ROUND');
        expect(before.combat?.encounterId).toBe('MIDNIGHT_DISPUTE');
        expect(before.midnight.encounter).toMatchObject({ status: 'FIGHTING', observed: true, bystanderCleared: true });
        expect(next.combatHistory.slice(0, -1)).toEqual(before.combatHistory);
        expect(next.combatHistory).toHaveLength(before.combatHistory.length + 1);
        expect(next.progression.acting).toBe(before.progression.acting);
        expect(next.midnight.cases).toEqual(before.midnight.cases);
      }
    }
  });
});
