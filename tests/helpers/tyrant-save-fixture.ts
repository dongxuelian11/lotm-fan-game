import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { openTyrantRuntimeSession } from '../../src/domain/tyrant/owned-session.js';
import { TYRANT_FROZEN_SOURCE_KEYS, tyrantSourceBlock } from '../../src/domain/tyrant/source.js';
import { tyrantCurrentGates } from '../../src/domain/tyrant/engine.js';
import type { TyrantCommand } from '../../src/domain/tyrant/types.js';
import type { ThunderGodActivityCommand, ThunderGodCaseId } from '../../src/domain/thunder-god/life.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { ready, tg } from '../domain/thunder-god-directed-helper.js';
import { readObjectEntry } from './read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from './current-save-format.js';

export const TYRANT_SAVE_SOURCE = 'tests/fixtures/thunder-god-v01930/boundary-step-701-action.json';
export const TYRANT_SAVE_SOURCE_SHA = '6d721f6e2376085b77026c8a9373fbed5b005ee8a2413d27cdf5f02a4303f708';
export const TYRANT_SAVE_SEED = 'sailor-natural-v026';
export const TYRANT_SAVE_FIRST_CONTROLLED_CURSOR = 271;
export const TYRANT_SAVE_CONSUME = {
  type: 'TYRANT', command: { type: 'CONSUME', compoundId: 'tyrant-compound-1', confirmed: true },
} as const;
export const tyrantSaveHash = (value: unknown): string => createHash('sha256').update(stableStringify(value)).digest('hex');
export function assertUnmodifiedTyrantSaveInput(): void {
  expect(createHash('sha256').update(readFileSync(TYRANT_SAVE_SOURCE)).digest('hex')).toBe(TYRANT_SAVE_SOURCE_SHA);
}

/** Explicit controlled S0 branch, never a natural-success capture. The actual
 * original RNG executes first. Only this seed's ten new S0 d100s are replaced;
 * all 270 historical draws and the natural S1 promotion draw remain untouched.
 * The identical declared control must remain installed during strict reopen. */
export function installTyrantSaveControl() {
  const original = DeterministicActionRandomStream.prototype.nextInt;
  const draws: { cursorBefore: number; cursorAfter: number; actual: number; controlled: 30 }[] = [];
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum: number, maximum: number,
  ) {
    const cursorBefore = this.cursor, actual = original.call(this, minimum, maximum);
    if (this.seed === TYRANT_SAVE_SEED && cursorBefore >= 271 && cursorBefore <= 280 && minimum === 1 && maximum === 100) {
      draws.push({ cursorBefore, cursorAfter: this.cursor, actual, controlled: 30 });
      return 30;
    }
    return actual;
  });
  return { draws, restore: () => spy.mockRestore() };
}

/** All resources, time, three failed original bottles and old history stay
 * genuine. The paid recovered descendant promotes with the unchanged next36.
 * Ordinary practice honestly awards acting, with no invented power mastery. */
export function genuineTyrantSavePredecessor() {
  assertUnmodifiedTyrantSaveInput();
  const historical = readObjectEntry<SliceState>(TYRANT_SAVE_SOURCE, 'final');
  const historicalHash = tyrantSaveHash(historical), source = migrateSliceState(historical);
  expect([source.schemaVersion, source.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  expect(source).toMatchObject({ revision: 702, week: 169, status: 'ACTIVE', cash: 210, actionsRemaining: 2,
    health: 93, mind: 85, spirituality: 120, seer: { pollution: 20 }, progression: { sequence: 2 },
    random: { seed: TYRANT_SAVE_SEED, cursor: 270 } });
  expect(source.thunderGod.bottles.map(b => b.outcome)).toEqual(['FAILURE', 'FAILURE', 'FAILURE']);
  for (const key of TYRANT_FROZEN_SOURCE_KEYS) expect(source[key]).toEqual(historical[key]);
  const commands: SliceIntent[] = [];
  let s = tg(source, { type: 'REQUEST_RECOVERY_V1', bottleId: 'thunder-god-potion-1' }, commands);
  const requestedWeek = s.week;
  s = tg(ready(s, { afterWeek: requestedWeek }, commands), { type: 'RECOVER_CHARACTERISTIC_V1', bottleId: 'thunder-god-potion-1' }, commands);
  const bottleId = s.thunderGod.bottles.at(-1)!.id;
  expect(bottleId).toBe('thunder-god-potion-4');
  for (let n = 0; n < 5; n++) s = tg(ready(s, {}, commands), { type: 'POTION_WORK', bottleId }, commands);
  s = ready(s, { cash: 300, ap: 1, health: 100, mind: 100, spirituality: 120, pollution: 0 }, commands);
  s = tg(s, { type: 'BUY_POTION', bottleId }, commands);
  s = tg(s, { type: 'PREPARE_PROMOTION' }, commands);
  s = tg(s, { type: 'STABILIZE_PROMOTION', bottleId }, commands);
  s = tg(s, { type: 'CONSUME', bottleId, confirmed: true }, commands);
  expect(s.progression.sequence).toBe(1);
  expect(s.thunderGod.acquisitionJournal.at(-1)).toMatchObject({ randomBefore: 270, randomAfter: 271,
    check: { roll: 36, chance: 70, tier: 'SUCCESS' } });
  expect(s.thunderGod.bottles.slice(0, 3)).toEqual(source.thunderGod.bottles);
  const promoted = s;
  const act = (...actions: ThunderGodActivityCommand[]): void => {
    for (const command of actions) s = tg(s, command, commands);
  };
  const enter = (caseId: ThunderGodCaseId): void => {
    s = ready(s, {}, commands); act({ type: 'OBSERVE', caseId });
    if (s.thunderGod.life.target.purchasedWeek === null) { s = ready(s, { cash: 40 }, commands); act({ type: 'BUY_TARGET' }); }
    if (s.thunderGod.life.pad.purchasedWeek === null) { s = ready(s, { cash: 20 }, commands); act({ type: 'BUY_PAD' }); }
    s = ready(s, { cash: 10, health: 6, mind: 10, spirituality: 10 }, commands);
    act({ type: 'WALK_TO_SITE' }, { type: 'INVITE', caseId, method: 'ORDINARY' }, { type: 'READ_SOURCE' },
      { type: 'CONSENT', permission: 'OWNER' }, { type: 'CONSENT', permission: 'TECHNICIAN' },
      { type: 'DECLINE_CONSENT', permission: 'ABILITY' }, { type: 'AGREE_RETURN' }, { type: 'ENTER_SITE' });
  };
  const target = (): void => act({ type: 'PLACE_TARGET' }, { type: 'STEP_BACK' }, { type: 'CLEAR_ADULTS' }, { type: 'OBSERVE_TARGET' });
  const finish = (caseId: ThunderGodCaseId): void => {
    const life = s.thunderGod.life;
    if (life.pending || life.target.pulse === 'ARMED' || life.pad.registered) act({ type: 'STOP_PULSE' });
    if (s.thunderGod.life.target.hood === 'CLOSED') act({ type: 'CLEAR_HOOD' });
    if (s.thunderGod.life.target.location === 'HOLDER') act({ type: 'RETRIEVE_TARGET' });
    if (s.thunderGod.life.pad.location === 'WORN') act({ type: 'RETURN_PAD' });
    act({ type: 'EXIT_SITE' }, { type: 'LEAVE' });
    s = ready(s, {}, commands); act({ type: 'REPORT', caseId });
  };
  enter('located-target'); target(); act({ type: 'MANUAL_INSPECT' }); finish('located-target');
  enter('personal-impact'); act({ type: 'WEAR_PAD' }, { type: 'CLEAR_ADULTS' }, { type: 'REGISTER_IMPACT' }, { type: 'HAND_RESET' }); finish('personal-impact');
  enter('obscured-return'); target();
  act({ type: 'CHANGE_CONDITIONS' }, { type: 'WITHDRAW_CONSENT', permission: 'OWNER' }, { type: 'STOP_PULSE' }, { type: 'CLEAR_HOOD' }, { type: 'RETRIEVE_TARGET' });
  finish('obscured-return'); s = ready(s, {}, commands); act({ type: 'REFLECT' });
  s = ready(s, { cash: 100, health: 100, mind: 100, spirituality: 120, pollution: 0 }, commands);
  expect(s.random).toEqual({ seed: TYRANT_SAVE_SEED, cursor: 271 });
  expect(s.progression.acting).toBe(100);
  expect(Object.values(s.thunderGod.life.cases).every(c => c.status === 'RESOLVED' && c.result === 'ORDINARY' && c.returned && !c.contactOpen)).toBe(true);
  expect(tyrantSourceBlock(s)).toBeNull();
  expect(tyrantSaveHash(historical)).toBe(historicalHash);
  assertValidSliceState(s);
  return { source, promoted, predecessor: s, commands };
}

export interface TyrantSaveFixture extends ReturnType<typeof genuineTyrantSavePredecessor> {
  guided: SliceState; beforeConsume: SliceState; success: SliceState; tyrantCommands: TyrantCommand[];
}

/** Public intents and branded owned drafts are the only mutation route. Work,
 * food bills, later-week original-remnant recovery, real sea voyages, hostile
 * damage and paid healing all remain in the strict-replay journal. */
export function controlledTyrantSaveFixture(): TyrantSaveFixture {
  const inherited = genuineTyrantSavePredecessor();
  let state = applySliceIntent(inherited.predecessor, { type: 'TYRANT', command: { type: 'LEARN_GUIDANCE' } });
  const guided = state, session = openTyrantRuntimeSession(state), tyrantCommands: TyrantCommand[] = [{ type: 'LEARN_GUIDANCE' }];
  const run = (command: TyrantCommand): void => {
    if (tyrantCommands.length > 400) throw Error('Finite controlled Tyrant route exceeded its declared command budget');
    const revision = state.revision;
    try {
      const draft = session.prepare({ type: 'TYRANT', command }, revision);
      session.commit(draft); state = session.snapshot();
    } catch (error) { throw Error(`Controlled Tyrant route failed at ${JSON.stringify(command)}: week=${state.week}, cash=${state.cash}, actions=${state.actionsRemaining}; ${String(error)}`); }
    tyrantCommands.push(structuredClone(command));
    expect(state.revision).toBe(revision + 1); expect(state.status).toBe('ACTIVE');
  };
  const next = (): void => run({ type: 'NEXT_WEEK' });
  const act = (command: TyrantCommand): void => { if (!state.actionsRemaining) next(); run(command); };
  const move = (to: string): void => { if (state.tyrant.frame!.location !== to) act({ type: 'TRAVEL', to }); };
  const material = (command: Extract<TyrantCommand, { type: 'MATERIAL' }>['command']): void => act({ type: 'MATERIAL', command });
  // Establish the paid finite budget before any expiring coast evidence exists.
  while (state.cash < 4000 || state.week < inherited.promoted.week + 12) {
    if (!state.actionsRemaining) next();
    run({ type: state.wagePaidWeek === state.week ? 'REST' : 'WORK' });
  }
  move('TY0-ORIGINAL-COVE');
  for (const bottleId of ['thunder-god-potion-2', 'thunder-god-potion-3'] as const) {
    if (!state.actionsRemaining) next();
    run({ type: 'MATERIAL', command: { type: 'ASK_LEGACY_PERMISSION', bottleId } });
    material({ type: 'INVESTIGATE_LEGACY_REMAINS', bottleId });
    run({ type: 'MATERIAL', command: { type: 'SEAL_LEGACY_REMAINS', bottleId } });
  }
  next();
  for (const bottleId of ['thunder-god-potion-2', 'thunder-god-potion-3'] as const) {
    run({ type: 'MATERIAL', command: { type: 'ASK_LEGACY_PERMISSION', bottleId } });
    material({ type: 'RECOVER_LEGACY_REMAINS', bottleId });
  }
  move('TY0-SUPPLIER'); material({ type: 'BUY_COMPOUND', batchId: 'tyrant-carrier-1' });
  move('TY0-ARCHIVE'); material({ type: 'VERIFY_UNIQUENESS', step: 'CHAIN' });
  move('TY0-VAULT'); if (state.actionsRemaining < 2) next();
  material({ type: 'VERIFY_UNIQUENESS', step: 'VACANCY' }); material({ type: 'ACQUIRE_UNIQUENESS' });
  for (const coastId of ['north', 'south', 'east'] as const) {
    move(`TYRANT0-${coastId.toUpperCase()}`); act({ type: 'COAST', command: { type: 'SURVEY', coastId } });
    if (!state.actionsRemaining) next();
    run({ type: 'COAST', command: { type: 'ASK_PERMISSION', coastId } });
    run({ type: 'COAST', command: { type: 'FULFILL', coastId } });
    run({ type: 'COAST', command: { type: 'RETURN_TO_HARBOR', coastId } }); next();
    act({ type: 'COAST', command: { type: 'REVIEW_NEXT_WEEK', coastId } });
    run({ type: 'COAST', command: { type: 'RETURN_TO_HARBOR', coastId } });
  }
  move('TYRANT0-SUN-CHALLENGE'); act({ type: 'CHALLENGE', command: { type: 'BEGIN' } });
  while (state.tyrant.challenge!.position < 60) run({ type: 'CHALLENGE', command: { type: 'WITHDRAW' } });
  run({ type: 'CHALLENGE', command: { type: 'BREAK_CONTACT' } });
  move('TY0-WORKSHOP');
  while (state.health < 90 || state.mind < 78 || state.injuries.length) {
    act({ type: state.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null) ? 'CLINIC' : 'REST' });
  }
  expect(tyrantCurrentGates(state.tyrant).ready).toBe(true);
  material({ type: 'COMPOSE_POTION', batchId: 'tyrant-carrier-1' });
  act({ type: 'STABILIZE_PROMOTION', compoundId: 'tyrant-compound-1' });
  const beforeConsume = state;
  expect(beforeConsume.random.cursor).toBe(280);
  run(TYRANT_SAVE_CONSUME.command);
  expect(state.progression.sequence).toBe(0);
  expect(state.random).toEqual({ seed: TYRANT_SAVE_SEED, cursor: 281 });
  expect(state.tyrant.journal.flatMap(e => e.randomReceipts)).toHaveLength(10);
  for (const key of TYRANT_FROZEN_SOURCE_KEYS) expect(state[key]).toEqual(inherited.predecessor[key]);
  assertValidSliceState(state);
  return { ...inherited, guided, beforeConsume, success: state, tyrantCommands };
}
