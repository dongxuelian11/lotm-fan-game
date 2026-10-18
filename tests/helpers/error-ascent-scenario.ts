import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { createErrorAscentState } from '../../src/domain/error-ascent/index.js';
import { openErrorAscentRuntimeSession, type ErrorAscentRuntimeSession } from '../../src/domain/error-ascent/owned-session.js';
import { ERROR_ASCENT_FROZEN_SOURCE_KEYS } from '../../src/domain/error-ascent/source.js';
import type { ErrorAscentCommand } from '../../src/domain/error-ascent/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { readObjectEntry } from './read-object-entry.js';

export const ERROR_ASCENT_SOURCE_FILE = 'tests/fixtures/time-worm-v01970/natural.json';
export const ERROR_ASCENT_SOURCE_SHA = 'e9920991623fdd3f1b8ecf4e5c8049720f362145462703d6b804afa9dfd390cf';
export const ERROR_ASCENT_FINAL_SHA = 'abfce49e9f21e1599f4b9abb1c2e34e15afeb8a2fbe177e2926b3ac4f2d49191';
export const ERROR_ASCENT_CONTROLLED_SEED = 'marauder-natural-v038';
export const ERROR_ASCENT_CONTROLLED_CURSOR = 397;
export const errorAscentScenarioHash = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
export const errorAscentInheritedHash = (s: SliceState) => errorAscentScenarioHash({
  ...Object.fromEntries(ERROR_ASCENT_FROZEN_SOURCE_KEYS.map(key => [key, s[key]])), world: s.world, combatHistory: s.combatHistory,
});
export function assertUnmodifiedErrorAscentInput(): void {
  expect(createHash('sha256').update(readFileSync(ERROR_ASCENT_SOURCE_FILE)).digest('hex')).toBe(ERROR_ASCENT_SOURCE_SHA);
}
/** Read the retained final snapshot. The original 656 commands are never replayed here. */
export function authenticErrorAscentSource(): SliceState {
  assertUnmodifiedErrorAscentInput();
  expect(readObjectEntry<unknown[]>(ERROR_ASCENT_SOURCE_FILE, 'commands')).toHaveLength(656);
  const raw = readObjectEntry<SliceState>(ERROR_ASCENT_SOURCE_FILE, 'final');
  expect(errorAscentScenarioHash(raw)).toBe(ERROR_ASCENT_FINAL_SHA);
  const state = migrateSliceState(raw);
  for (const [key, value] of Object.entries(raw)) if (!['schemaVersion', 'contentVersion'].includes(key))
    expect(errorAscentScenarioHash(state[key as keyof SliceState]), `Changed inherited ${key}`).toBe(errorAscentScenarioHash(value));
  expect(errorAscentScenarioHash(raw)).toBe(ERROR_ASCENT_FINAL_SHA);
  expect(state).toMatchObject({ schemaVersion: 216, contentVersion: 'error-ascent-v216', revision: 657, week: 147,
    status: 'ACTIVE', health: 70, mind: 96, spirituality: 112, cash: 867, actionsRemaining: 3,
    progression: { pathwayId: 'error', sequence: 1, acting: 100 },
    character: { coreStats: { physique: 29, perception: 28, will: 26, knowledge: 26 } },
    random: { seed: ERROR_ASCENT_CONTROLLED_SEED, cursor: ERROR_ASCENT_CONTROLLED_CURSOR } });
  expect(state.injuries).toHaveLength(1);
  expect(state.injuries[0]).toMatchObject({ severity: 'HEAVY', treatedRevision: null });
  expect(state.timeWorm.promotionWeek).toBe(139);
  expect(Object.keys(state.progression.mastery)).toHaveLength(16);
  expect(state.errorAscent).toEqual(createErrorAscentState());
  assertValidSliceState(state);
  return state;
}
export function errorAscentPublicLeaks(value: unknown): string[] {
  const forbidden = new Set(['random', 'seed', 'cursor', 'randomSeed', 'randomCursor', 'randomCursorBefore', 'randomCursorAfter',
    'cursorBefore', 'cursorAfter', 'randomBefore', 'randomAfter', 'randomReceipts', 'sourceDigest', 'historyDigest',
    'originalWorldDigest', 'combatHistoryDigest', 'originalsDigest', 'acquisitionDigest', 'compoundDigest', 'beforeDigest', 'afterDigest',
    'actorId', 'predecessorActorId', 'incumbentActorId', 'custodianActorId', 'preparationRoll']);
  const found: string[] = [];
  const visit = (v: unknown, path: string): void => {
    if (!v || typeof v !== 'object') return;
    for (const [key, item] of Object.entries(v)) {
      const next = `${path}.${key}`;
      const inheritedNull = key === 'actorId' && item === null && ['$.divineHand.life.site.guard.actorId', '$.glory.life.site.guard.actorId'].includes(next);
      if (forbidden.has(key) && !inheritedNull || key === 'source' && item !== null && typeof item === 'object') found.push(next);
      visit(item, next);
    }
  };
  visit(value, '$'); return found;
}
/** Controlled future continuation only: all original draws and every later draw stay genuine. */
export function installControlledErrorAscentReplacement(roll = 1) {
  const original = DeterministicActionRandomStream.prototype.nextInt;
  const substituted: { cursorBefore: number; cursorAfter: number; actual: number; controlled: number }[] = [];
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, min: number, max: number,
  ) {
    const cursorBefore = this.cursor, actual = original.call(this, min, max);
    if (this.seed === ERROR_ASCENT_CONTROLLED_SEED && cursorBefore === ERROR_ASCENT_CONTROLLED_CURSOR && min === 1 && max === 100) {
      substituted.push({ cursorBefore, cursorAfter: this.cursor, actual, controlled: roll }); return roll;
    }
    return actual;
  });
  return { substituted, restore: () => spy.mockRestore() };
}
export function stepErrorAscent(session: ErrorAscentRuntimeSession, command: ErrorAscentCommand): SliceState {
  const before = session.inspect(), draft = session.prepare({ type: 'ERROR_ASCENT', command }, before.revision);
  expect(session.inspect()).toEqual(before);
  expect(session.inspectDraft(draft).revision).toBe(before.revision + 1);
  session.commit(draft);
  return session.snapshot();
}
export interface PreparedErrorAscentRoute {
  source: SliceState; guided: SliceState; beforeReplace: SliceState; commands: ErrorAscentCommand[];
  replace: Extract<ErrorAscentCommand, { type: 'RITUAL' }>;
}
export function preparedErrorAscentRoute(): PreparedErrorAscentRoute {
  const source = authenticErrorAscentSource(), inherited = errorAscentInheritedHash(source);
  const freeze = (value: unknown): void => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return;
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  };
  for (const key of ERROR_ASCENT_FROZEN_SOURCE_KEYS) freeze(source[key]);
  freeze(source.world); freeze(source.combatHistory);
  const guided = applySliceIntent(source, { type: 'ERROR_ASCENT', command: { type: 'LEARN_GUIDANCE' } });
  const session = openErrorAscentRuntimeSession(guided), commands: ErrorAscentCommand[] = [{ type: 'LEARN_GUIDANCE' }];
  for (;;) {
    const panel = session.projectErrorAscent(), action = panel.actions.find(x => x.preferredAction);
    if (commands.length > 360 || !action?.enabled) throw Error(`Error preparation stopped: ${JSON.stringify({
      last: commands.slice(-4), at: session.snapshot().errorAscent.frame?.location, advice: panel.nextStep,
      week: session.snapshot().week, booking: session.snapshot().errorAscent.ritual?.booking,
      workWeeks: session.snapshot().errorAscent.journal.filter(e => e.command.type === 'WORK').map(e => e.before.budget.week),
      command: action?.command, reason: action?.reason, resources: panel.resources,
    })}`);
    if (action.command.type === 'RITUAL' && action.command.command.type === 'REPLACE') {
      const beforeReplace = session.snapshot(), events = beforeReplace.errorAscent.journal;
      console.info('Error219 actual preparation costs', JSON.stringify({
        sourceWeek: source.week, readyWeek: beforeReplace.week, commandCount: commands.length,
        booking: beforeReplace.errorAscent.ritual!.booking,
        cashBefore: source.cash, cashAfter: beforeReplace.cash, actionsRemaining: beforeReplace.actionsRemaining,
        paidWorkWeeks: events.filter(e => e.command.type === 'WORK').map(e => e.before.budget.week),
        commandCounts: Object.fromEntries([...new Set(commands.map(c => c.type === 'MATERIAL' || c.type === 'RITUAL' ? c.command.type : c.type))]
          .map(type => [type, commands.filter(c => (c.type === 'MATERIAL' || c.type === 'RITUAL' ? c.command.type : c.type) === type).length])),
        paidCosts: events.filter(e => e.command.type !== 'WORK' && e.after.budget.cash !== e.before.budget.cash)
          .map(e => ({ type: e.command.type === 'MATERIAL' || e.command.type === 'RITUAL' ? e.command.command.type : e.command.type,
            week: e.before.budget.week, cashChange: e.after.budget.cash - e.before.budget.cash,
            actionsBefore: e.before.budget.actions, actionsAfter: e.after.budget.actions })),
      }));
      return { source, guided, beforeReplace, commands, replace: structuredClone(action.command) };
    }
    const state = stepErrorAscent(session, action.command);
    commands.push(structuredClone(action.command));
    expect(state.status).toBe('ACTIVE');
    expect(state.random).toEqual(source.random);
    expect(errorAscentInheritedHash(state)).toBe(inherited);
  }
}
