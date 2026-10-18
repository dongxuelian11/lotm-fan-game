import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { createWhiteTowerState } from '../../src/domain/white-tower/index.js';
import { openWhiteTowerRuntimeSession } from '../../src/domain/white-tower/owned-session.js';
import { whiteTowerPassageVerifiedReceipts } from '../../src/domain/white-tower/passages.js';
import { WHITE_TOWER_FROZEN_SOURCE_KEYS } from '../../src/domain/white-tower/source.js';
import type { WhiteTowerCommand } from '../../src/domain/white-tower/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from './current-save-format.js';
import { readObjectEntry } from './read-object-entry.js';

export const WHITE_TOWER_SOURCE_FILE = 'tests/fixtures/all-knowing-eye-v01920/natural.json';
export const WHITE_TOWER_SOURCE_SHA = 'b838bff34dbf49f3df9968bcfef684a24c184e8320f9b8e6d7a1431bfc75a58f';
export const WHITE_TOWER_CONTROLLED_SEED = 'reader-natural-v023';
export const WHITE_TOWER_SOURCE_CURSOR = 227;
// Three genuine first-build d100s precede the promotion. Their outcomes, and
// any ordinary paid repairs they require, remain completely uncontrolled.
export const WHITE_TOWER_CONTROLLED_CURSOR = 230;
export const WHITE_TOWER_CONTROLLED_CONSUME = {
  type: 'WHITE_TOWER', command: { type: 'CONSUME', compoundId: 'white-tower-compound-1', confirmed: true },
} as const;
export const whiteTowerScenarioHash = (value: unknown): string =>
  createHash('sha256').update(stableStringify(value)).digest('hex');
export const whiteTowerInheritedHash = (state: SliceState): string => whiteTowerScenarioHash({
  ...Object.fromEntries(WHITE_TOWER_FROZEN_SOURCE_KEYS.map(key => [key, state[key]])),
  world: state.world, combatHistory: state.combatHistory,
});

export function assertUnmodifiedWhiteTowerInput(): void {
  expect(createHash('sha256').update(readFileSync(WHITE_TOWER_SOURCE_FILE)).digest('hex')).toBe(WHITE_TOWER_SOURCE_SHA);
}

/** Check the entire public root, including inactive inherited chapters. This
 * runs on a raw migrated source before any owned session can freeze/admit it. */
export function assertWhiteTowerPublicBoundary(view: SliceProjection, state: SliceState): void {
  const forbidden = new Set(['random', 'seed', 'cursor', 'randomSeed', 'randomCursor',
    'randomCursorBefore', 'randomCursorAfter', 'cursorBefore', 'cursorAfter', 'randomBefore', 'randomAfter',
    'randomReceipts', 'sourceDigest', 'historyDigest', 'originalWorldDigest', 'combatHistoryDigest',
    'originalsDigest', 'originalPracticeDigest', 'acquisitionDigest', 'compoundDigest', 'beforeDigest', 'afterDigest',
    'actorId', 'predecessorActorId', 'incumbentActorId', 'custodianActorId']);
  const leaks: string[] = [];
  const visit = (node: unknown, path: string): void => {
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      const next = `${path}.${key}`;
      const inactiveGuard = key === 'actorId' && value === null &&
        ['$.divineHand.life.site.guard.actorId', '$.glory.life.site.guard.actorId'].includes(next);
      if ((forbidden.has(key) && !inactiveGuard) || (key === 'source' && value !== null && typeof value === 'object')) leaks.push(next);
      visit(value, next);
    }
  };
  visit(view, '$');
  expect(leaks, 'Whole public root exposed private replay/identity fields').toEqual([]);
  const json = JSON.stringify(view);
  expect(json.includes(state.random.seed), 'Public root exposed the actual RNG seed').toBe(false);
  if (state.whiteTower.source) {
    expect(json.includes(state.whiteTower.source.actorId), 'Public root exposed the private original actor').toBe(false);
    expect(json.includes(state.whiteTower.source.historyDigest), 'Public root exposed the original-history digest').toBe(false);
  }
}

/** The genuine 666-command final state. Migration is the only transformation:
 * no old resources, wounds, seed, original people/objects or mastery are edited. */
export function authenticWhiteTowerSource(): SliceState {
  assertUnmodifiedWhiteTowerInput();
  expect(readObjectEntry<unknown[]>(WHITE_TOWER_SOURCE_FILE, 'commands')).toHaveLength(666);
  const historical = readObjectEntry<SliceState>(WHITE_TOWER_SOURCE_FILE, 'final');
  expect([historical.schemaVersion, historical.contentVersion]).toEqual([189, 'all-knowing-eye-v189']);
  const original = whiteTowerScenarioHash(historical), state = migrateSliceState(historical);
  expect(whiteTowerScenarioHash(historical)).toBe(original);
  for (const [key, value] of Object.entries(historical)) {
    if (key !== 'schemaVersion' && key !== 'contentVersion')
      expect(whiteTowerScenarioHash(state[key as keyof SliceState]), `Migration changed ${key}`).toBe(whiteTowerScenarioHash(value));
  }
  expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  expect(state).toMatchObject({ revision: 667, week: 146, status: 'ACTIVE',
    date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 4, day: 8 }, health: 70, mind: 86,
    spirituality: 120, cash: 1390, actionsRemaining: 3, lifeTier: 'DESTITUTE',
    progression: { pathwayId: 'white-tower', sequence: 1, acting: 100 },
    random: { seed: WHITE_TOWER_CONTROLLED_SEED, cursor: WHITE_TOWER_SOURCE_CURSOR },
  });
  expect(state.injuries).toEqual([{ id: 'reader-rebuild-natural:combat:2:PLAYER:664:0',
    severity: 'HEAVY', acquiredRevision: 664, treatedRevision: null }]);
  expect(state.allKnowingEye.promotionWeek).toBe(136);
  expect(Object.keys(state.progression.mastery)).toHaveLength(21);
  expect(Object.values(state.progression.mastery).filter(value => value === 0)).toHaveLength(6);
  expect([state.progression.mastery['reader.s1.bounded-insight'], state.progression.mastery['reader.s1.pending-forecast']]).toEqual([0, 8]);
  expect(state.whiteTower).toEqual(createWhiteTowerState());
  assertValidSliceState(state);
  assertWhiteTowerPublicBoundary(projectSliceState(state), state);
  return state;
}

export interface ControlledWhiteTowerDraw { cursorBefore: number; cursorAfter: number; actual: number; controlled: 1 }

/** EXPLICIT CONTROLLED SUCCESS, not a natural capture. The real RNG always
 * executes and advances; only this exact new promotion d100 is substituted.
 * Old draws, the three new build draws, other seeds/ranges and all later draws
 * pass through. Strict replay/reopen requires this identical declared seam. */
export function installControlledWhiteTowerPromotion() {
  const original = DeterministicActionRandomStream.prototype.nextInt;
  const substituted: ControlledWhiteTowerDraw[] = [];
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum: number, maximum: number,
  ) {
    const cursorBefore = this.cursor, actual = original.call(this, minimum, maximum);
    if (this.seed === WHITE_TOWER_CONTROLLED_SEED && cursorBefore === WHITE_TOWER_CONTROLLED_CURSOR && minimum === 1 && maximum === 100) {
      substituted.push({ cursorBefore, cursorAfter: this.cursor, actual, controlled: 1 });
      return 1;
    }
    return actual;
  });
  return { original, substituted, restore: () => spy.mockRestore() };
}

export interface ControlledWhiteTowerSuccess {
  source: SliceState; guided: SliceState; healed: SliceState; passagesComplete: SliceState;
  beforePreparation: SliceState; beforeConsume: SliceState; success: SliceState;
  commands: WhiteTowerCommand[];
  cursorAdvancement: ControlledWhiteTowerDraw & { revision: number; chance: number; roll: number };
}
export function whiteTowerScenarioDate(state: SliceState) {
  const frame = state.whiteTower.frame!;
  return addGameDays(state.date, Math.floor((frame.nowSecond - frame.weekAnchor) / 86400));
}

/** Every suggested step is committed through the central owned boundary.
 * Real clinic/rest heal the inherited heavy injury; real WORK/NEXT_WEEK pay
 * both original characteristics, finite ordinary supplies and later bills.
 * The calendar really reaches the authored July custody date. No synthetic
 * host, successful receipt, raw S0, resource refill or historical replacement. */
export function controlledWhiteTowerSuccess(control: ReturnType<typeof installControlledWhiteTowerPromotion>): ControlledWhiteTowerSuccess {
  const source = authenticWhiteTowerSource(), original = whiteTowerScenarioHash(source);
  let state = applySliceIntent(source, { type: 'WHITE_TOWER', command: { type: 'LEARN_GUIDANCE' } });
  const guided = state, commands: WhiteTowerCommand[] = [{ type: 'LEARN_GUIDANCE' }];
  const session = openWhiteTowerRuntimeSession(state);
  let healed: SliceState | undefined, passagesComplete: SliceState | undefined;
  let beforePreparation: SliceState | undefined, beforeConsume: SliceState | undefined;
  while (state.progression.sequence !== 0) {
    const panel = session.projectWhiteTower(), action = panel.actions.find(candidate => candidate.preferredAction);
    const diagnostic = () => JSON.stringify({ last: commands.slice(-5), week: state.week, cash: state.cash,
      actions: state.actionsRemaining, health: state.health, location: state.whiteTower.frame!.location,
      next: action?.command, reason: action?.reason ?? panel.nextStep });
    if (commands.length >= 300 || !action || !action.enabled) throw Error(`Controlled WhiteTower route stalled: ${diagnostic()}`);
    const command = action.command;
    if (command.type === 'STABILIZE_PROMOTION') beforePreparation = state;
    if (command.type === 'CONSUME') {
      expect(command).toEqual(WHITE_TOWER_CONTROLLED_CONSUME.command);
      expect(state.random.cursor).toBe(WHITE_TOWER_CONTROLLED_CURSOR);
      beforeConsume = state;
    }
    const revision = state.revision, cursor = state.random.cursor;
    try {
      const draft = session.prepare({ type: 'WHITE_TOWER', command }, revision);
      session.commit(draft); state = session.snapshot();
    } catch (error) { throw Error(`Controlled WhiteTower command failed: ${diagnostic()}; ${String(error)}`); }
    commands.push(structuredClone(command));
    expect(state.status).toBe('ACTIVE');
    expect(state.revision).toBe(revision + 1);
    const draws = command.type === 'CONSUME' || command.type === 'PASSAGE' && command.command.type === 'BUILD' ? 1 : 0;
    expect(state.random.cursor).toBe(cursor + draws);
    expect(state.whiteTower.journal.at(-1)!.command).toEqual(command);
    if (!healed && !state.injuries.length && state.health >= 80) healed = state;
    if (!passagesComplete && whiteTowerPassageVerifiedReceipts(state.whiteTower.passages!).length === 3) passagesComplete = state;
  }
  if (!healed || !passagesComplete || !beforePreparation || !beforeConsume) throw Error('Controlled WhiteTower route omitted a real milestone');
  const last = state.whiteTower.journal.at(-1)!, receipt = last.randomReceipts[0]!;
  const draw = control.substituted.find(value => value.cursorBefore === WHITE_TOWER_CONTROLLED_CURSOR);
  if (!draw) throw Error('The declared WhiteTower promotion draw control was not observed');
  expect(state.whiteTower.journal.flatMap(event => event.randomReceipts)).toHaveLength(4);
  expect(receipt).toMatchObject({ cursorBefore: 230, cursorAfter: 231, check: { chance: 70, roll: 1 } });
  expect(whiteTowerScenarioHash(source)).toBe(original);
  expect(whiteTowerInheritedHash(state)).toBe(whiteTowerInheritedHash(source));
  return { source, guided, healed, passagesComplete, beforePreparation, beforeConsume, success: state, commands,
    cursorAdvancement: { ...draw, revision: last.revision, chance: receipt.check.chance, roll: receipt.check.roll } };
}
