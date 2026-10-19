import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { createHermitState, getHermitPromotionStabilityPreview } from '../../src/domain/hermit/index.js';
import { openHermitRuntimeSession, type HermitRuntimeSession } from '../../src/domain/hermit/owned-session.js';
import { HERMIT_FROZEN_SOURCE_KEYS } from '../../src/domain/hermit/source.js';
import type { HermitCommand } from '../../src/domain/hermit/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

export const HERMIT_SOURCE_FILE = 'tests/fixtures/knowledge-emperor-v02000/snapshot-recoveredBeforeEncounter.json';
export const HERMIT_SOURCE_SHA = '7dfb8d05d6dfd262aa804fd6e8a4a1c0256dccffbdebdd0dcad4e77e830b0cb7';
export const HERMIT_SOURCE_CURSOR = 346;
export const hermitHash = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
export const hermitInheritedHash = (state: SliceState) => hermitHash({
  ...Object.fromEntries(HERMIT_FROZEN_SOURCE_KEYS.map(key => [key, state[key]])),
  world: state.world, combatHistory: state.combatHistory,
});
export function assertHermitSourceUnmodified() {
  expect(createHash('sha256').update(readFileSync(HERMIT_SOURCE_FILE)).digest('hex')).toBe(HERMIT_SOURCE_SHA);
}
export function authenticHermitSource(): SliceState {
  assertHermitSourceUnmodified();
  const raw = JSON.parse(readFileSync(HERMIT_SOURCE_FILE, 'utf8')) as SliceState;
  const state = migrateSliceState(raw);
  expect(state).toMatchObject({ revision: 828, week: 194, status: 'ACTIVE', health: 100, mind: 100,
    spirituality: 120, cash: 645, actionsRemaining: 3,
    progression: { pathwayId: 'hermit', sequence: 1, acting: 100 },
    random: { seed: 'pryer-natural-v048', cursor: HERMIT_SOURCE_CURSOR } });
  expect(state.knowledgeEmperor.promotionWeek).toBe(185);
  expect(state.knowledgeEmperor.bottles.map(bottle => bottle.outcome)).toEqual(['FAILURE', 'FAILURE', 'SUCCESS']);
  expect(state.knowledgeEmperor.life.site).toMatchObject({ playerEnergy: 18, playerLocation: 'OUTSIDE', body: 'SOLID',
    iris: { energy: 54, location: 'OUTSIDE', consent: 'CLOSED' },
    record: { id: 'PM3-BOUNDARY-RECORD', quantity: 1, location: 'OWNER' },
    archive: { id: 'SG2-ARCHIVE-LEAF', quantity: 1, location: 'B' } });
  expect(state.hermit).toEqual(createHermitState());
  expect(hermitInheritedHash(state)).toBe(hermitInheritedHash(raw));
  return state;
}
export function executeHermit(session: HermitRuntimeSession, command: HermitCommand): SliceState {
  const draft = session.prepare({ type: 'HERMIT', command }, session.inspect().revision);
  session.commit(draft);
  return session.snapshot();
}
/** Follow only enabled public recommendations; no prebuilt scene, inventory or receipt authority. */
export function preparedHermitScenario() {
  const source = authenticHermitSource();
  const guided = applySliceIntent(source, { type: 'HERMIT', command: { type: 'LEARN_GUIDANCE' } });
  const session = openHermitRuntimeSession(guided);
  const commands: HermitCommand[] = [{ type: 'LEARN_GUIDANCE' }];
  for (let step = 0; step < 320; step++) {
    const panel = session.projectHermit();
    const action = panel.actions.find(candidate => candidate.preferredAction);
    const state = session.snapshot();
    if (action?.command.type === 'CONSUME') {
      expect(action.enabled).toBe(true);
      expect(action.label).toContain('70%');
      expect(getHermitPromotionStabilityPreview(state.hermit, action.command.compoundId))
        .toMatchObject({ prepared: true, chance: 70 });
      return { source, guided, beforeConsume: state, session, commands };
    }
    if (!action?.enabled) throw Error(`Hermit route blocked: ${JSON.stringify({
      week: state.week, cash: state.cash, actions: state.actionsRemaining,
      location: state.hermit.frame?.location, scene: state.hermit.scene, action, last: commands.slice(-8),
    })}`);
    executeHermit(session, action.command);
    commands.push(structuredClone(action.command));
  }
  throw Error('Hermit paid preparation did not reach an enabled real consumption within 320 commands.');
}
/** Test-only future d100 seam. Old history is untouched and every actual draw still advances.
 * Keep this same seam active for cold replay of a controlled state. This is not a natural capture.
 * Overrides are keyed by the observed cursor, because paid investigations also draw d100s. */
export function controlledHermitRolls(rolls: Readonly<Record<number, number>> = {}) {
  const original = DeterministicActionRandomStream.prototype.nextInt;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum: number, maximum: number,
  ) {
    const cursor = this.cursor;
    const actual = original.call(this, minimum, maximum);
    return this.seed === 'pryer-natural-v048' && cursor >= HERMIT_SOURCE_CURSOR && minimum === 1 && maximum === 100
      ? rolls[cursor] ?? 1 : actual;
  });
  return () => spy.mockRestore();
}
/** Public actor IDs identify actual bodies or explicit movement commands; they are not private RNG/evidence. */
export function hermitPublicLeaks(view: unknown): string[] {
  const forbidden = new Set(['random', 'seed', 'cursor', 'randomSeed', 'randomCursor', 'randomCursorBefore',
    'randomCursorAfter', 'cursorBefore', 'cursorAfter', 'randomBefore', 'randomAfter', 'randomReceipts',
    'sourceDigest', 'historyDigest', 'originalWorldDigest', 'combatHistoryDigest', 'originalsDigest',
    'acquisitionDigest', 'compoundDigest', 'beforeDigest', 'afterDigest', 'preparationRoll',
    'predecessorActorId', 'incumbentActorId', 'custodianActorId']);
  const errors: string[] = [];
  const visit = (value: unknown, path: string): void => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      if (forbidden.has(key) || key === 'source' && child !== null && typeof child === 'object') errors.push(childPath);
      visit(child, childPath);
    }
  };
  visit(view, '$');
  return errors;
}
