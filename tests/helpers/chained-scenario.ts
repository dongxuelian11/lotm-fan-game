import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { createChainedState, getChainedPromotionStabilityPreview } from '../../src/domain/chained/index.js';
import { openChainedRuntimeSession, type ChainedRuntimeSession } from '../../src/domain/chained/owned-session.js';
import { CHAINED_FROZEN_SOURCE_KEYS } from '../../src/domain/chained/source.js';
import type { ChainedCommand } from '../../src/domain/chained/types.js';
import { getAbominationCurrentSite } from '../../src/domain/abomination/life.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { readObjectEntry } from './read-object-entry.js';
export { hermitPublicLeaks as chainedPublicLeaks } from './hermit-scenario.js';

export const CHAINED_SOURCE_FILE = 'tests/fixtures/abomination-v02030/natural.json';
export const CHAINED_SOURCE_SHA = '0d99439f4e950a633e20fdba372fb0e59beb41982ccff5fe6a27fd2834adf442';
export const CHAINED_SOURCE_COMMAND_COUNT = 778;
export const CHAINED_SOURCE_CURSOR = 291;
export const chainedHash = (value: unknown): string => createHash('sha256').update(stableStringify(value)).digest('hex');
export const chainedInheritedHash = (state: SliceState): string => chainedHash({
  ...Object.fromEntries(CHAINED_FROZEN_SOURCE_KEYS.map(key => [key, state[key]])),
  world: state.world, combatHistory: state.combatHistory,
});
export function assertChainedSourceUnmodified(): void {
  expect(createHash('sha256').update(readFileSync(CHAINED_SOURCE_FILE)).digest('hex')).toBe(CHAINED_SOURCE_SHA);
}
/** Read the actual 778-command endpoint once. No old campaign replay and no
 * replacement body, money, random stream, original room or original bottle. */
export function authenticChainedSource(): SliceState {
  assertChainedSourceUnmodified();
  const raw = readObjectEntry<SliceState>(CHAINED_SOURCE_FILE, 'final');
  const before = chainedHash(raw), state = migrateSliceState(raw);
  expect(chainedHash(raw)).toBe(before);
  expect(state).toMatchObject({ revision: 779, week: 175, status: 'ACTIVE', health: 100, mind: 48,
    spirituality: 82, cash: 180, actionsRemaining: 2, injuryRisk: 0, injuries: [],
    date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 10, day: 28 },
    progression: { pathwayId: 'chained', sequence: 1, acting: 100 },
    random: { seed: 'prisoner-natural-v057', cursor: CHAINED_SOURCE_CURSOR }, seer: { pollution: 0 } });
  expect(state.character.coreStats.will).toBe(25);
  expect(state.abomination.promotionWeek).toBe(169);
  expect(state.abomination.bottles.map(bottle => bottle.outcome)).toEqual(['FAILURE', 'SUCCESS', null]);
  expect(state.abomination.life.reflected).toBe(true);
  expect(state.abomination.life.pulse).toMatchObject({ resolved: true });
  expect(getAbominationCurrentSite(state)).toMatchObject({ playerLocation: 'START', playerTravelMetres: 188,
    volunteer: { id: 'SD3-ELSA', age: 43, alive: true, location: 'OUTSIDE', form: 'HUMAN' },
    guide: { id: 'HARLAN', location: 'OUTSIDE' }, clothing: { id: 'SD3-CLOTHES', location: 'ELSA', worn: true },
    bag: { id: 'SD3-BAG', location: 'ELSA' } });
  expect(state.abomination.encounter.enemyStatus).toBe('SURRENDERED');
  expect(state.abomination.encounter.enemyInjuries.some(injury => injury.severity === 'HEAVY' && injury.treatedRevision === null)).toBe(true);
  expect(state.chained).toStrictEqual(createChainedState());
  expect(chainedInheritedHash(state)).toBe(chainedInheritedHash(raw));
  return state;
}
export function executeChained(session: ChainedRuntimeSession, command: ChainedCommand): SliceState {
  const draft = session.prepare({ type: 'CHAINED', command }, session.inspect().revision);
  session.commit(draft);
  return session.snapshot();
}
/** Follow enabled public recommendations, paying for actual rest and work
 * before leaving the original START. This fixture never fills resources. */
export function preparedChainedScenario() {
  const source = authenticChainedSource();
  const guided = applySliceIntent(source, { type: 'CHAINED', command: { type: 'LEARN_GUIDANCE' } });
  const session = openChainedRuntimeSession(guided);
  const commands: ChainedCommand[] = [{ type: 'LEARN_GUIDANCE' }];
  for (let step = 0; step < 400; step++) {
    const panel = session.projectChained(), action = panel.actions.find(candidate => candidate.preferredAction);
    const state = session.snapshot();
    if (action?.command.type === 'CONSUME') {
      expect(action.enabled).toBe(true);
      expect(action.label).toContain('70%');
      expect(getChainedPromotionStabilityPreview(state.chained, action.command.compoundId))
        .toMatchObject({ prepared: true, chance: 70 });
      expect(chainedInheritedHash(state)).toBe(chainedInheritedHash(source));
      assertChainedSourceUnmodified();
      return { source, guided, beforeConsume: state, session, commands };
    }
    if (!action?.enabled) throw Error(`Chained route blocked: ${JSON.stringify({
      week: state.week, cash: state.cash, actions: state.actionsRemaining,
      location: state.chained.frame?.location, scene: state.chained.scene, action, last: commands.slice(-8),
    })}`);
    executeChained(session, action.command);
    commands.push(structuredClone(action.command));
  }
  throw Error('Chained paid preparation did not reach enabled real consumption within 400 commands.');
}
/** Test-only future draws still advance the real random stream. The original
 * 778 results stay untouched. Keep active during controlled cold-replay checks. */
export function controlledChainedRolls(rolls: Readonly<Record<number, number>> = {}) {
  const original = DeterministicActionRandomStream.prototype.nextInt;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum: number, maximum: number,
  ) {
    const cursor = this.cursor, actual = original.call(this, minimum, maximum);
    return this.seed === 'prisoner-natural-v057' && cursor >= CHAINED_SOURCE_CURSOR && minimum === 1 && maximum === 100
      ? rolls[cursor] ?? 1 : actual;
  });
  return () => spy.mockRestore();
}
