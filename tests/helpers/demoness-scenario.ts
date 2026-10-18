import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { openDemonessRuntimeSession, type DemonessRuntimeSession } from '../../src/domain/demoness/owned-session.js';
import { DEMONESS_FROZEN_SOURCE_KEYS } from '../../src/domain/demoness/source.js';
import type { DemonessCommand } from '../../src/domain/demoness/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import {
  APOCALYPSE_ACTUAL688_PATH, APOCALYPSE_ACTUAL688_SHA256,
  APOCALYPSE_LEGACY854_PATH, APOCALYPSE_LEGACY854_SHA256,
  controlledApocalypseS1Source, recoveryBudget,
} from './apocalypse-original-recovery-scenario.js';

export const demonessHash = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
export const demonessInheritedHash = (s: SliceState) => demonessHash({
  ...Object.fromEntries(DEMONESS_FROZEN_SOURCE_KEYS.map(key => [key, s[key]])),
  world: s.world, combatHistory: s.combatHistory,
});
export function assertDemonessSourceUnmodified(): void {
  for (const [path, hash] of [[APOCALYPSE_ACTUAL688_PATH, APOCALYPSE_ACTUAL688_SHA256],
    [APOCALYPSE_LEGACY854_PATH, APOCALYPSE_LEGACY854_SHA256]])
    expect(createHash('sha256').update(readFileSync(path!)).digest('hex')).toBe(hash);
}

export function commitDemoness(session: DemonessRuntimeSession, command: DemonessCommand): void {
  const draft = session.prepare({ type: 'DEMONESS', command }, session.inspect().revision);
  session.commit(draft);
}
export function executeDemoness(session: DemonessRuntimeSession, command: DemonessCommand): SliceState {
  commitDemoness(session, command);
  return session.snapshot();
}

interface PreparedScenario { source: SliceState; guided: SliceState; beforeConsume: SliceState; commands: DemonessCommand[] }
let prepared: PreparedScenario | undefined;
/** One lazy source per test file. The S1 source is the untouched actual688 plus
 * paid same-original recovery, a labelled controlled future dose and real life
 * reflection. No historical854 sixth dose, acting/mastery edit or free stock. */
export function preparedDemonessScenario(): PreparedScenario & { session: DemonessRuntimeSession } {
  if (prepared) return { ...prepared, session: openDemonessRuntimeSession(structuredClone(prepared.beforeConsume)) };
  assertDemonessSourceUnmodified();
  const source = recoveryBudget(controlledApocalypseS1Source(), { cash: 100, ap: 1 });
  const guided = applySliceIntent(source, { type: 'DEMONESS', command: { type: 'LEARN_GUIDANCE' } });
  const session = openDemonessRuntimeSession(guided), commands: DemonessCommand[] = [{ type: 'LEARN_GUIDANCE' }];
  for (let n = 0; n < 320; n++) {
    const action = session.projectDemoness().actions.find(item => item.preferredAction);
    if (action?.enabled && action.command.type === 'CONSUME') {
      const beforeConsume = session.snapshot();
      prepared = { source, guided, beforeConsume, commands };
      return { ...prepared, session };
    }
    if (!action?.enabled) throw Error('Real paid Demoness route blocked: ' + JSON.stringify({ action, last: commands.slice(-8) }));
    commitDemoness(session, action.command); commands.push(structuredClone(action.command));
  }
  throw Error('Finite paid Demoness preparation did not reach a ready dose within 320 commands.');
}

/** Only explicitly selected future d100s change. Actual cursor advancement,
 * inherited receipts and all payments remain unchanged. Keep this seam active
 * through cold validation of any state produced with it. */
export function controlledDemonessRolls(source: Pick<SliceState, 'random'>, rolls: Readonly<Record<number, number>>): () => void {
  const seed = source.random.seed, original = DeterministicActionRandomStream.prototype.nextInt;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum: number, maximum: number,
  ) {
    const cursor = this.cursor, actual = original.call(this, minimum, maximum);
    return this.seed === seed && minimum === 1 && maximum === 100 && Object.hasOwn(rolls, cursor) ? rolls[cursor]! : actual;
  });
  return () => spy.mockRestore();
}

export function demonessPublicLeaks(value: unknown): string[] {
  const forbidden = new Set(['random', 'seed', 'cursor', 'randomSeed', 'randomCursor', 'randomBefore', 'randomAfter',
    'randomCursorBefore', 'randomCursorAfter', 'cursorBefore', 'cursorAfter', 'sourceDigest', 'historyDigest',
    'originalWorldDigest', 'combatHistoryDigest', 'originalsDigest', 'compoundDigest', 'beforeDigest', 'afterDigest']);
  const leaks: string[] = [];
  function visit(v: unknown, path: string): void {
    if (!v || typeof v !== 'object') return;
    for (const [key, child] of Object.entries(v)) {
      const next = path + '.' + key;
      if (forbidden.has(key) || key === 'source' && child !== null && typeof child === 'object') leaks.push(next);
      visit(child, next);
    }
  }
  visit(value, '$'); return leaks;
}
