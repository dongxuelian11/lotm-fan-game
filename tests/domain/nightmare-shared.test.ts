import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SLICE_LIFE } from '../../src/content/slice-events.js';
import {
  applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState,
} from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createNightmareState } from '../../src/domain/nightmare/index.js';
import { NIGHTMARE_ABILITY_IDS, NIGHTMARE_CASE_IDS } from '../../src/domain/nightmare/types.js';
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
const capture = (): NaturalCapture => currentCapture(JSON.parse(readFileSync(new URL('../fixtures/nightmare-v0220/shared-stage-natural.json', import.meta.url), 'utf8')));
const boundary = (name: 'dream' | 'combat'): BoundaryCapture => currentCapture(JSON.parse(readFileSync(new URL(`../fixtures/nightmare-v0220/shared-${name}-save-boundary.json`, import.meta.url), 'utf8')));
const inheritedAbilities = [...SLEEPLESS_ABILITY_IDS, ...MIDNIGHT_ABILITY_IDS, ...NIGHTMARE_ABILITY_IDS];
const masteryTotal = (s: SliceState) => Object.values(s.progression.mastery).reduce((sum, value) => sum + value, 0);

/** Locate real public boundaries without substituting a manually promoted state. */
function beforeCommand(predicate: (command: SliceIntent) => boolean): SliceState {
  const c = capture();
  let s = createSliceRun(c.final.runId, c.creation, c.seed);
  for (const command of c.commands) {
    if (predicate(command)) return s;
    s = applySliceIntent(s, command);
  }
  throw new Error('The natural capture is missing the requested public boundary.');
}
function firstVerifiedDream(): BoundaryCapture {
  const c = capture();
  let s = createSliceRun(c.final.runId, c.creation, c.seed);
  for (const command of c.commands) {
    const next = applySliceIntent(s, command);
    if (command.type === 'NIGHTMARE' && command.command.type === 'VERIFY'
      && next.nightmare.cases[command.command.caseId]!.status === 'RESOLVED') {
      return { beforeLast: s, lastIntent: command, final: next };
    }
    s = next;
  }
  throw new Error('The natural capture is missing a successful waking verification.');
}

describe('Nightmare actual public acquisition, dream records and waking verification', () => {
  it('replays every original command and milestone through peaceful growth and the actual encounter', { tags: ['historical-replay'] }, () => {
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
    expect(s.progression).toMatchObject({ pathwayId: 'darkness', sequence: 7, acting: 100 });
    expect(Object.keys(s.progression.mastery)).toEqual(inheritedAbilities);
    expect(s.random.seed).toBe(c.seed);
    expect(projectSliceState(s).maxSpirituality).toBe(60);
    expect(c.combatStart.combat?.encounterId).toBe('NIGHTMARE_DISPUTE');
    expect(c.combatStart.nightmare.encounter).toMatchObject({ status: 'FIGHTING', observed: true, bystanderCleared: true, pressure: 0, dreamLocked: false });
    expect(c.combatStart.nightmare.encounter.startHistoryIndex).toBe(c.combatStart.combatHistory.length);
    expect(c.terminal.combat).toBeNull();
    expect(['RESOLVED', 'RETREATED', 'LOST']).toContain(c.terminal.nightmare.encounter.status);
    expect(c.terminal.nightmare.encounter).toMatchObject({ pressure: 0, dreamLocked: false });
    expect(c.terminal.combatHistory.length).toBeGreaterThan(c.combatStart.combatHistory.length);
    expect(c.terminal.nightmare.cases).toEqual(c.practiced.nightmare.cases);
  });

  it('migrates frozen 0.21 facts while preserving original fields and adding missing stage defaults', () => {
    const old = JSON.parse(readFileSync(new URL('../fixtures/midnight-v0210/natural.json', import.meta.url), 'utf8')).final;
    const bytes = JSON.stringify(old);
    expect(old.schemaVersion).toBe(20);
    expect(old.contentVersion).toBe('midnight-life-v20');
    expect(old).not.toHaveProperty('nightmare');
    const next = migrateSliceState(old);
    const { nightmare, schemaVersion, contentVersion, ...rest } = next;
    const { schemaVersion: oldSchema, contentVersion: oldContent, ...prior } = old;
    expectPriorFields(next,old);
    expect([oldSchema, oldContent]).toEqual([20, 'midnight-life-v20']);
    expect([schemaVersion, contentVersion]).toEqual([CURRENT_SCHEMA_VERSION,CURRENT_CONTENT_VERSION]);
    expect(nightmare).toEqual(createNightmareState());
    assertValidSliceState(next);
    expect(migrateSliceState(next)).toEqual(next);
    expect(JSON.stringify(old)).toBe(bytes);
  });

  it('reaches peaceful digestion100 with three waking verifications, seven abilities and read-only S9/S8 histories', () => {
    const c = capture(), s = c.practiced, p = projectSliceState(s);
    assertValidSliceState(s);
    expect(s.progression).toMatchObject({ pathwayId: 'darkness', sequence: 7, acting: 100 });
    expect(Object.keys(s.progression.mastery)).toEqual(inheritedAbilities);
    expect(s.nightmare.midnightActingAtPromotion).toBe(100);
    expect(s.nightmare.promotionWeek! - s.midnight.promotionWeek!).toBeGreaterThanOrEqual(8);
    expect(s.nightmare.reflected).toBe(true);
    for (const caseId of NIGHTMARE_CASE_IDS) {
      expect(s.nightmare.cases[caseId]!.status).toBe('RESOLVED');
      expect(s.nightmare.cases[caseId]!.attemptWeek).not.toBeNull();
      expect(s.nightmare.cases[caseId]!.dreamRecord).toEqual(expect.any(String));
      expect(s.seer.completedSources.filter(source => source === `nightmare-case:${caseId}`)).toHaveLength(1);
      expect(p.nightmare.cases.find(entry => entry.id === caseId)!.result).toEqual(expect.any(String));
    }
    expect(s.seer.completedSources.filter(source => source === 'nightmare-reflection')).toHaveLength(1);
    expect(s.seer.completedSources).not.toContain('nightmare-dispute');
    expect(s.nightmare.encounter.status).toBe('AVAILABLE');
    expect(s.combat).toBeNull();
    expect(s.combatHistory).toEqual(c.promoted.combatHistory);
    expect(s.sleepless).toEqual(c.promoted.sleepless);
    expect(s.midnight).toEqual(c.promoted.midnight);
    expect(s.nightmare.bottles).toEqual(c.promoted.nightmare.bottles);
    expect(masteryTotal(s) - masteryTotal(c.promoted)).toBe(24);
    expect(p.nightmare.abilities.map(ability => ability.id)).toEqual([...NIGHTMARE_ABILITY_IDS]);
    expect(p.sleepless.abilities.map(ability => ability.id)).toEqual([...SLEEPLESS_ABILITY_IDS]);
    expect(p.midnight.abilities.map(ability => ability.id)).toEqual([...MIDNIGHT_ABILITY_IDS]);
    expect([p.sleepless.acting, p.midnight.acting]).toEqual([100, 100]);
    expect(p.sleepless.actions).toEqual([]);
    expect(p.midnight.actions).toEqual([]);
    expect(p.nightmare).toMatchObject({ formulaKnown: false, formula: [], acting: 100 });
    expect(p.nightmare.environment).toContain('待核线索');
    for (const watchId of SLEEPLESS_WATCH_IDS) expect(() => applySliceIntent(s, {
      type: 'SLEEPLESS', command: { type: 'WATCH', watchId, approach: 'REPORT' },
    })).toThrow();
    for (const caseId of MIDNIGHT_CASE_IDS) expect(() => applySliceIntent(s, {
      type: 'MIDNIGHT', command: { type: 'PERFORM', caseId, method: 'TALK' },
    })).toThrow();
    for (const type of ['SLEEPLESS', 'MIDNIGHT'] as const) expect(() => applySliceIntent(s, { type, command: { type: 'REFLECT' } })).toThrow();
  });

  it('withholds dream records before preparation and refuses combat before actual bystander clearance', () => {
    const s = capture().promoted, before = structuredClone(s), p = projectSliceState(s).nightmare;
    for (const caseId of NIGHTMARE_CASE_IDS) {
      expect(p.cases.find(entry => entry.id === caseId)).toMatchObject({ status: 'AVAILABLE', observations: [], dreamRecord: null, result: null });
      for (const type of ['PREPARE', 'SESSION', 'VERIFY'] as const) expect(() => applySliceIntent(s, {
        type: 'NIGHTMARE', command: { type, caseId },
      })).toThrow();
    }
    expect(p.cases.find(entry => entry.id === 'nightmare-dispute')).toMatchObject({ observations: [], dreamRecord: null, result: null });
    for (const type of ['CLEAR_BYSTANDER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'] as const) expect(() => applySliceIntent(s, {
      type: 'NIGHTMARE', command: { type },
    })).toThrow();
    expect(s).toEqual(before);
    const observed = beforeCommand(command => command.type === 'NIGHTMARE' && command.command.type === 'PREPARE');
    const caseId = NIGHTMARE_CASE_IDS.find(id => observed.nightmare.cases[id]!.status === 'OBSERVED')!;
    expect(caseId).toBeDefined();
    expect(projectSliceState(observed).nightmare.cases.find(entry => entry.id === caseId)).toMatchObject({ dreamRecord: null, result: null });
    expect(() => applySliceIntent(observed, { type: 'NIGHTMARE', command: { type: 'SESSION', caseId } })).toThrow('先取得同意');
    const uncleared = beforeCommand(command => command.type === 'NIGHTMARE' && command.command.type === 'CLEAR_BYSTANDER');
    const unchanged = structuredClone(uncleared);
    expect(uncleared.nightmare.encounter).toMatchObject({ status: 'AVAILABLE', observed: true, bystanderCleared: false });
    expect(projectSliceState(uncleared).nightmare.actions.find(action => action.command.type === 'ENCOUNTER_FIGHT')).toMatchObject({ enabled: false });
    expect(() => applySliceIntent(uncleared, { type: 'NIGHTMARE', command: { type: 'ENCOUNTER_FIGHT' } })).toThrow('先让搬运工');
    expect(uncleared).toEqual(unchanged);
  });

  it('awards nothing for a recorded subjective dream and grants25 acting plus8 mastery only after waking verification', () => {
    const dream = boundary('dream');
    expect(dream.lastIntent).toMatchObject({ type: 'NIGHTMARE', command: { type: 'SESSION' } });
    if (dream.lastIntent.type !== 'NIGHTMARE' || dream.lastIntent.command.type !== 'SESSION') throw new Error('Expected a recorded dream session boundary.');
    const caseId = dream.lastIntent.command.caseId, s = dream.final;
    assertValidSliceState(s);
    expect(s.nightmare.cases[caseId]).toMatchObject({ status: 'DREAM_RECORDED', attemptWeek: null, dreamRecord: expect.any(String) });
    expect(s.progression).toEqual(dream.beforeLast.progression);
    expect(s.seer.completedSources).toEqual(dream.beforeLast.seer.completedSources);
    expect(s.spirituality).toBe(dream.beforeLast.spirituality - 4);
    expect(projectSliceState(s).nightmare.cases.find(entry => entry.id === caseId)).toMatchObject({ dreamRecord: s.nightmare.cases[caseId]!.dreamRecord, result: null });
    expect(projectSliceState(s).nightmare.environment).toContain('可能失真或被欺骗');
    const verified = firstVerifiedDream();
    if (verified.lastIntent.type !== 'NIGHTMARE' || verified.lastIntent.command.type !== 'VERIFY') throw new Error('Expected waking verification.');
    const verifiedId = verified.lastIntent.command.caseId;
    expect(verified.beforeLast.nightmare.cases[verifiedId]!.status).toBe('DREAM_RECORDED');
    expect(verified.final.nightmare.cases[verifiedId]).toMatchObject({ status: 'RESOLVED', dreamRecord: verified.beforeLast.nightmare.cases[verifiedId]!.dreamRecord });
    expect(verified.final.progression.acting).toBe(verified.beforeLast.progression.acting + 25);
    expect(masteryTotal(verified.final) - masteryTotal(verified.beforeLast)).toBe(8);
    expect(verified.final.spirituality).toBe(verified.beforeLast.spirituality);
    expect(verified.final.seer.completedSources).toEqual([...verified.beforeLast.seer.completedSources, `nightmare-case:${verifiedId}`]);
    expect(projectSliceState(verified.final).nightmare.cases.find(entry => entry.id === verifiedId)!.result).toEqual(expect.any(String));
  });

  it('withdraws at zero mind without an AP fee or growth and preserves normal zero-AP weekly settlement', () => {
    const c = boundary('dream');
    if (c.lastIntent.type !== 'NIGHTMARE' || c.lastIntent.command.type !== 'SESSION') throw new Error('Expected a dream session boundary.');
    const caseId = c.lastIntent.command.caseId;
    for (const status of ['OBSERVED', 'PREPARED', 'DREAM_RECORDED'] as const) {
      const s = structuredClone(status === 'DREAM_RECORDED' ? c.final : c.beforeLast);
      s.nightmare.cases[caseId]!.status = status;
      s.actionsRemaining = 1;
      s.mind = 0;
      assertValidSliceState(s);
      const before = structuredClone(s);
      expect(projectSliceState(s).nightmare.actions.find(action => action.command.type === 'WITHDRAW' && action.command.caseId === caseId)).toMatchObject({ enabled: true });
      const next = applySliceIntent(s, { type: 'NIGHTMARE', command: { type: 'WITHDRAW', caseId } });
      assertValidSliceState(next);
      expect(s).toEqual(before);
      expect(next.nightmare.cases[caseId]).toEqual({ ...before.nightmare.cases[caseId], status: 'WITHDRAWN' });
      expect([next.actionsRemaining, next.cash, next.mind, next.spirituality, next.week]).toEqual([before.actionsRemaining, before.cash, before.mind, before.spirituality, before.week]);
      expect(next.progression).toEqual(before.progression);
      expect(next.seer.completedSources).toEqual(before.seer.completedSources);
      expect(next.nightmare.bottles).toEqual(before.nightmare.bottles);
      expect(next.random).toEqual(before.random);
      expect(projectSliceState(next).nightmare.cases.find(entry => entry.id === caseId)).toMatchObject({ status: 'WITHDRAWN', dreamRecord: before.nightmare.cases[caseId]!.dreamRecord, result: null });
      expect(() => applySliceIntent(next, { type: 'NIGHTMARE', command: { type: 'WITHDRAW', caseId } })).toThrow();
    }
    const zero = structuredClone(c.beforeLast);
    zero.actionsRemaining = 0;
    zero.mind = 0;
    const livingCost = SLICE_LIFE[zero.lifeTier].cost;
    zero.cash = livingCost;
    expect(zero.debts.every(debt => debt.remaining === 0)).toBe(true);
    assertValidSliceState(zero);
    const advanced = applySliceIntent(zero, { type: 'NIGHTMARE', command: { type: 'WITHDRAW', caseId } });
    assertValidSliceState(advanced);
    expect(advanced.nightmare.cases[caseId]!.status).toBe('WITHDRAWN');
    expect([advanced.week, advanced.actionsRemaining, advanced.cash, advanced.mind, advanced.spirituality]).toEqual([zero.week + 1, zero.weeklyBudget, zero.cash - livingCost, 0, zero.spirituality]);
    expect(advanced.date).not.toEqual(zero.date);
    expect(advanced.debts).toEqual(zero.debts);
    expect(advanced.progression).toEqual(zero.progression);
    expect(advanced.seer.completedSources).toEqual(zero.seer.completedSources);
    expect(advanced.chronicle.slice(zero.chronicle.length).map(record => record.title)).toContain('本周生活费');
  });

  it('cannot repeat completed assistance or reflection, or delete, duplicate or forge a completion source', () => {
    const original = capture().practiced, s = structuredClone(original);
    for (const caseId of NIGHTMARE_CASE_IDS) {
      for (const type of ['OBSERVE', 'PREPARE', 'SESSION', 'VERIFY', 'WITHDRAW'] as const) expect(() => applySliceIntent(s, {
        type: 'NIGHTMARE', command: { type, caseId },
      })).toThrow();
    }
    expect(() => applySliceIntent(s, { type: 'NIGHTMARE', command: { type: 'REFLECT' } })).toThrow();
    expect(s).toEqual(original);
    for (const source of [...NIGHTMARE_CASE_IDS.map(id => `nightmare-case:${id}`), 'nightmare-reflection']) {
      const missing = structuredClone(original);
      missing.seer.completedSources = missing.seer.completedSources.filter(id => id !== source);
      expect(() => assertValidSliceState(missing)).toThrow();
      const duplicate = structuredClone(original);
      duplicate.seer.completedSources.push(source);
      expect(() => assertValidSliceState(duplicate)).toThrow();
    }
    const forged = capture().promoted;
    forged.seer.completedSources.push(`nightmare-case:${NIGHTMARE_CASE_IDS[0]}`);
    expect(() => assertValidSliceState(forged)).toThrow();
    const fabricated = structuredClone(original);
    fabricated.nightmare.cases[NIGHTMARE_CASE_IDS[0]]!.dreamRecord = 'An invented objective verdict replacing the recorded experience.';
    expect(() => assertValidSliceState(fabricated)).toThrow();
  });

  it('replays both actual dream and combat save boundaries without restoring originals or changing inherited histories', () => {
    for (const name of ['dream', 'combat'] as const) {
      const c = boundary(name), before = structuredClone(c.beforeLast);
      assertValidSliceState(c.beforeLast);
      const next = applySliceIntent(c.beforeLast, c.lastIntent);
      assertValidSliceState(next);
      expect(next).toEqual(c.final);
      expect(c.beforeLast).toEqual(before);
      expect(next.nightmare.bottles).toEqual(before.nightmare.bottles);
      expect(next.nightmare.resupply).toEqual(before.nightmare.resupply);
      expect(next.sleepless).toEqual(before.sleepless);
      expect(next.midnight).toEqual(before.midnight);
      expect(Object.keys(next.progression.mastery)).toEqual(inheritedAbilities);
      if (name === 'dream') {
        expect(c.lastIntent).toMatchObject({ type: 'NIGHTMARE', command: { type: 'SESSION' } });
        expect(next.progression).toEqual(before.progression);
        expect(next.seer.completedSources).toEqual(before.seer.completedSources);
        expect(next.spirituality).toBe(before.spirituality - 4);
        expect(() => applySliceIntent(next, c.lastIntent)).toThrow();
      } else {
        expect(c.lastIntent.type).toBe('COMBAT_ROUND');
        expect(before.combat?.encounterId).toBe('NIGHTMARE_DISPUTE');
        expect(before.nightmare.encounter).toMatchObject({ status: 'FIGHTING', observed: true, bystanderCleared: true });
        expect(next.combatHistory.slice(0, -1)).toEqual(before.combatHistory);
        expect(next.combatHistory).toHaveLength(before.combatHistory.length + 1);
        expect(next.progression.acting).toBe(before.progression.acting);
        expect(next.nightmare.cases).toEqual(before.nightmare.cases);
        if (next.combat === null) expect(next.nightmare.encounter).toMatchObject({ pressure: 0, dreamLocked: false });
      }
    }
  });
});
