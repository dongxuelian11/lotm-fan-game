import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { createAbyssState, getAbyssPromotionStabilityPreview } from '../../src/domain/abyss/index.js';
import { openAbyssRuntimeSession, type AbyssRuntimeSession } from '../../src/domain/abyss/owned-session.js';
import { ABYSS_FROZEN_SOURCE_KEYS } from '../../src/domain/abyss/source.js';
import type { AbyssCommand } from '../../src/domain/abyss/types.js';
import { getUncleanMonarchCurrentSite } from '../../src/domain/unclean-monarch/life.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { readObjectEntry } from './read-object-entry.js';
export { hermitPublicLeaks as abyssPublicLeaks } from './hermit-scenario.js';

export const ABYSS_SOURCE_FILE = 'tests/fixtures/unclean-monarch-v02020/natural.json';
export const ABYSS_SOURCE_SHA = '44f863ff2286be6aff77275d5c8455b2641680214d5b879e285d9d976b6d3ada';
export const ABYSS_SOURCE_COMMAND_COUNT = 821;
export const ABYSS_SOURCE_CURSOR = 145;
export const abyssHash = (value: unknown): string => createHash('sha256').update(stableStringify(value)).digest('hex');
export const abyssInheritedHash = (state: SliceState): string => abyssHash({
  ...Object.fromEntries(ABYSS_FROZEN_SOURCE_KEYS.map(key => [key, state[key]])),
  world: state.world, combatHistory: state.combatHistory,
});
export function assertAbyssSourceUnmodified(): void {
  expect(createHash('sha256').update(readFileSync(ABYSS_SOURCE_FILE)).digest('hex')).toBe(ABYSS_SOURCE_SHA);
}
/** Genuine 821-command endpoint. Migration adds only absent chapter roots;
 * neither the original living body nor its money, RNG or old room is edited. */
export function authenticAbyssSource(): SliceState {
  assertAbyssSourceUnmodified();
  const raw = readObjectEntry<SliceState>(ABYSS_SOURCE_FILE, 'final');
  const before = abyssHash(raw), state = migrateSliceState(raw);
  expect(abyssHash(raw)).toBe(before);
  expect(state).toMatchObject({ revision: 822, week: 198, status: 'ACTIVE', health: 100, mind: 92,
    spirituality: 110, cash: 210, actionsRemaining: 2, injuryRisk: 0,
    date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 4, day: 7 },
    progression: { pathwayId: 'abyss', sequence: 1, acting: 100 },
    random: { seed: 'criminal-natural-v054', cursor: ABYSS_SOURCE_CURSOR }, seer: { pollution: 0 } });
  expect(state.uncleanMonarch.promotionWeek).toBe(192);
  expect(state.uncleanMonarch.bottles.map(bottle => bottle.outcome)).toEqual(['GREAT_SUCCESS', null, null]);
  expect(state.uncleanMonarch.life.reflected).toBe(true);
  expect(state.uncleanMonarch.life.pulse).toMatchObject({ resolved: true });
  expect(getUncleanMonarchCurrentSite(state)).toMatchObject({ playerLocation: 'START', playerTravelMetres: 164,
    volunteer: { id: 'BL3-NORA', age: 46, alive: true, location: 'OUTSIDE' },
    guide: { id: 'ROAN', location: 'OUTSIDE' }, card: { id: 'BL3-CARD', location: 'NORA', travelMetres: 72 } });
  expect(state.abyss).toStrictEqual(createAbyssState());
  expect(abyssInheritedHash(state)).toBe(abyssInheritedHash(raw));
  return state;
}
export function executeAbyss(session: AbyssRuntimeSession, command: AbyssCommand): SliceState {
  const draft = session.prepare({ type: 'ABYSS', command }, session.inspect().revision);
  session.commit(draft);
  return session.snapshot();
}
/** Public paid preparation, including actual WORK/REST/NEXT_WEEK when selected
 * by the current recommendation. The untouched source is never resource-filled. */
export function preparedAbyssScenario() {
  const source = authenticAbyssSource();
  const guided = applySliceIntent(source, { type: 'ABYSS', command: { type: 'LEARN_GUIDANCE' } });
  const session = openAbyssRuntimeSession(guided);
  const commands: AbyssCommand[] = [{ type: 'LEARN_GUIDANCE' }];
  for (let step = 0; step < 400; step++) {
    const panel = session.projectAbyss(), action = panel.actions.find(candidate => candidate.preferredAction);
    const state = session.snapshot();
    if (action?.command.type === 'CONSUME') {
      expect(action.enabled).toBe(true);
      expect(action.label).toContain('70%');
      expect(getAbyssPromotionStabilityPreview(state.abyss, action.command.compoundId))
        .toMatchObject({ prepared: true, chance: 70 });
      expect(abyssInheritedHash(state)).toBe(abyssInheritedHash(source));
      assertAbyssSourceUnmodified();
      return { source, guided, beforeConsume: state, session, commands };
    }
    if (!action?.enabled) throw Error(`Abyss route blocked: ${JSON.stringify({
      week: state.week, cash: state.cash, actions: state.actionsRemaining,
      location: state.abyss.frame?.location, scene: state.abyss.scene, action, last: commands.slice(-8),
    })}`);
    executeAbyss(session, action.command);
    commands.push(structuredClone(action.command));
  }
  throw Error('Abyss paid preparation did not reach an enabled real consumption within 400 commands.');
}
/** Test-only future-draw seam. All 821 captured commands retain their real
 * results; every future draw still advances the actual stream. Keep this seam
 * active during controlled cold-replay assertions. Never a natural capture. */
export function controlledAbyssRolls(rolls: Readonly<Record<number, number>> = {}) {
  const original = DeterministicActionRandomStream.prototype.nextInt;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum: number, maximum: number,
  ) {
    const cursor = this.cursor, actual = original.call(this, minimum, maximum);
    return this.seed === 'criminal-natural-v054' && cursor >= ABYSS_SOURCE_CURSOR && minimum === 1 && maximum === 100
      ? rolls[cursor] ?? 1 : actual;
  });
  return () => spy.mockRestore();
}
