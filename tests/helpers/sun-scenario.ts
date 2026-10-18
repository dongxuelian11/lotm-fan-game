import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { createSunState } from '../../src/domain/sun/index.js';
import { openSunRuntimeSession } from '../../src/domain/sun/owned-session.js';
import { sunServiceVerifiedReceipts } from '../../src/domain/sun/services.js';
import { getSunPromotionStabilityPreview } from '../../src/domain/sun/engine.js';
import { SUN_FROZEN_SOURCE_KEYS } from '../../src/domain/sun/source.js';
import type { SunCommand } from '../../src/domain/sun/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from './current-save-format.js';
import { readObjectEntry } from './read-object-entry.js';

export const SUN_SOURCE_FILE = 'tests/fixtures/pure-white-angel-v01940/natural.json';
export const SUN_SOURCE_SHA = '3f13d554046ecffe3512bda22fb4cd14747be2b06dd6dd47185c025d7d9855f1';
export const SUN_CONTROLLED_SEED = 'bard-natural-v029';
export const SUN_SOURCE_CURSOR = 385;
// Both resident services and the paid material route are deterministic. The
// source cursor stays unchanged until this one new promotion d100.
export const SUN_CONTROLLED_CURSOR = 385;
export const SUN_CONTROLLED_CONSUME = {
  type: 'SUN', command: { type: 'CONSUME', compoundId: 'sun-compound-1', confirmed: true },
} as const;
export const sunScenarioHash = (value: unknown): string =>
  createHash('sha256').update(stableStringify(value)).digest('hex');
export const sunInheritedHash = (state: SliceState): string => sunScenarioHash({
  ...Object.fromEntries(SUN_FROZEN_SOURCE_KEYS.map(key => [key, state[key]])),
  world: state.world, combatHistory: state.combatHistory,
});

export function assertUnmodifiedSunInput(): void {
  expect(createHash('sha256').update(readFileSync(SUN_SOURCE_FILE)).digest('hex')).toBe(SUN_SOURCE_SHA);
}

/** Check the entire public root, including inactive inherited chapters. This
 * runs on a raw migrated source before any owned session can freeze/admit it. */
export function assertSunPublicBoundary(view: SliceProjection, state: SliceState): void {
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
  if (state.sun.source) {
    expect(json.includes(state.sun.source.actorId), 'Public root exposed the private original actor').toBe(false);
    expect(json.includes(state.sun.source.historyDigest), 'Public root exposed the original-history digest').toBe(false);
  }
}

/** The authenticated 853-command final state. Migration alone adds current
 * roots: old resources, wounds, seed, people, objects and mastery stay exact. */
export function authenticSunSource(): SliceState {
  assertUnmodifiedSunInput();
  expect(readObjectEntry<unknown[]>(SUN_SOURCE_FILE, 'commands')).toHaveLength(853);
  const historical = readObjectEntry<SliceState>(SUN_SOURCE_FILE, 'final');
  expect([historical.schemaVersion, historical.contentVersion]).toEqual([191, 'pure-white-angel-v191']);
  const original = sunScenarioHash(historical), state = migrateSliceState(historical);
  expect(original).toBe('98e3a20cedfe2fa9cec6be8645a6ea340592e497b6d4300b22d03f5476e4719a');
  expect(sunScenarioHash(historical)).toBe(original);
  for (const [key, value] of Object.entries(historical)) {
    if (key !== 'schemaVersion' && key !== 'contentVersion')
      expect(sunScenarioHash(state[key as keyof SliceState]), `Migration changed ${key}`).toBe(sunScenarioHash(value));
  }
  expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  expect(state).toMatchObject({ revision: 854, week: 196, status: 'ACTIVE',
    date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 3, day: 24 }, health: 100, mind: 98,
    spirituality: 106, cash: 1250, actionsRemaining: 3, lifeTier: 'DESTITUTE',
    progression: { pathwayId: 'sun', sequence: 1, acting: 100 },
    random: { seed: SUN_CONTROLLED_SEED, cursor: SUN_SOURCE_CURSOR },
  });
  expect(state.injuries).toEqual([]);
  expect(state.pureWhiteAngel.promotionWeek).toBe(186);
  expect(state.pureWhiteAngel.bottles.map(bottle => bottle.status)).toEqual(['CONSUMED', 'SUPPLIER', 'SUPPLIER']);
  expect(Object.keys(state.progression.mastery)).toHaveLength(22);
  expect(Object.values(state.progression.mastery).filter(value => value === 0)).toHaveLength(6);
  expect([state.progression.mastery['sun.s1.focused-purification'], state.progression.mastery['sun.s1.warm-radiance-guard']]).toEqual([8, 0]);
  expect(state.lightSeeker.life.site).toMatchObject({ playerLocation: 'ENTRY', operatorLocation: 'SIDE',
    operatorConsent: 'WITHDRAWN', spiritConsent: 'DECLINED', ordinaryExit: 'OPEN', light: { mode: 'OFF' } });
  expect(state.pureWhiteAngel.encounter).toMatchObject({ enemyStatus: 'SURRENDERED', enemyHealth: 70,
    materials: { weapon: { charge: 3, capacity: 4 } } });
  expect(state.sun).toEqual(createSunState());
  assertValidSliceState(state);
  assertSunPublicBoundary(projectSliceState(state), state);
  return state;
}

export interface ControlledSunDraw { cursorBefore: number; cursorAfter: number; actual: number; controlled: 1 }

/** EXPLICIT CONTROLLED SUCCESS, not a natural capture. The real RNG always
 * executes and advances; only this exact new promotion d100 is substituted.
 * Old draws, other seeds/ranges and all later draws
 * pass through. Strict replay/reopen requires this identical declared seam. */
export function installControlledSunPromotion() {
  const original = DeterministicActionRandomStream.prototype.nextInt;
  const substituted: ControlledSunDraw[] = [];
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum: number, maximum: number,
  ) {
    const cursorBefore = this.cursor, actual = original.call(this, minimum, maximum);
    if (this.seed === SUN_CONTROLLED_SEED && cursorBefore === SUN_CONTROLLED_CURSOR && minimum === 1 && maximum === 100) {
      substituted.push({ cursorBefore, cursorAfter: this.cursor, actual, controlled: 1 });
      return 1;
    }
    return actual;
  });
  return { original, substituted, restore: () => spy.mockRestore() };
}

export interface ControlledSunSuccess {
  source: SliceState; guided: SliceState; servicesComplete: SliceState;
  beforePreparation: SliceState; beforeConsume: SliceState; success: SliceState;
  commands: SunCommand[];
  cursorAdvancement: ControlledSunDraw & { revision: number; chance: number; roll: number };
}
export function sunScenarioDate(state: SliceState) {
  const frame = state.sun.frame!;
  return addGameDays(state.date, Math.floor((frame.nowSecond - frame.weekAnchor) / 86400));
}

/** This is an explicitly controlled success, never a natural S0 capture.
 * Every suggested command passes the central owned boundary. Both residents
 * complete their actual SERVICE actions, five ordinary jobs per unused original
 * pay the two 1100p balances, and the unique object follows its actual custody
 * route. Real WORK/NEXT_WEEK pay wages/bills and reach the 12-week floor. */
export function controlledSunSuccess(control: ReturnType<typeof installControlledSunPromotion>): ControlledSunSuccess {
  const source = authenticSunSource(), original = sunScenarioHash(source);
  let state = applySliceIntent(source, { type: 'SUN', command: { type: 'LEARN_GUIDANCE' } });
  const guided = state, commands: SunCommand[] = [{ type: 'LEARN_GUIDANCE' }];
  const session = openSunRuntimeSession(state);
  let servicesComplete: SliceState | undefined;
  let beforePreparation: SliceState | undefined, beforeConsume: SliceState | undefined;
  while (state.progression.sequence !== 0) {
    const panel = session.projectSun(), action = panel.actions.find(candidate => candidate.preferredAction);
    const diagnostic = () => JSON.stringify({ last: commands.slice(-5), week: state.week, cash: state.cash,
      actions: state.actionsRemaining, health: state.health, location: state.sun.frame!.location,
      next: action?.command, reason: action?.reason ?? panel.nextStep });
    if (commands.length >= 300 || !action || !action.enabled) throw Error(`Controlled Sun route stalled: ${diagnostic()}`);
    const command = action.command;
    if (command.type === 'STABILIZE_PROMOTION') beforePreparation = state;
    if (command.type === 'CONSUME') {
      expect(command).toEqual(SUN_CONTROLLED_CONSUME.command);
      expect(state.random.cursor).toBe(SUN_CONTROLLED_CURSOR);
      beforeConsume = state;
    }
    const revision = state.revision, cursor = state.random.cursor;
    try {
      const draft = session.prepare({ type: 'SUN', command }, revision);
      expect(session.inspect().revision).toBe(revision);
      session.commit(draft); state = session.snapshot();
    } catch (error) { throw Error(`Controlled Sun command failed: ${diagnostic()}; ${String(error)}`); }
    commands.push(structuredClone(command));
    expect(state.status).toBe('ACTIVE');
    expect(state.revision).toBe(revision + 1);
    expect(state.random.cursor).toBe(cursor + (command.type === 'CONSUME' ? 1 : 0));
    expect(state.sun.journal.at(-1)!.command).toEqual(command);
    if (!servicesComplete && sunServiceVerifiedReceipts(state.sun.services!).length === 2) servicesComplete = state;
  }
  if (!servicesComplete || !beforePreparation || !beforeConsume) throw Error('Controlled Sun route omitted a real milestone');
  const root = beforeConsume.sun, last = state.sun.journal.at(-1)!, receipt = last.randomReceipts[0]!;
  const draw = control.substituted.find(value => value.cursorBefore === SUN_CONTROLLED_CURSOR);
  if (!draw) throw Error('The declared Sun promotion draw control was not observed');
  expect(state.sun.journal.flatMap(event => event.randomReceipts)).toHaveLength(1);
  expect(receipt).toMatchObject({ cursorBefore: 385, cursorAfter: 386, check: { chance: 74, roll: 1 } });
  expect(beforeConsume.week - source.pureWhiteAngel.promotionWeek!).toBeGreaterThanOrEqual(12);
  expect(getSunPromotionStabilityPreview(root, 'sun-compound-1')).toMatchObject({ prepared: true, preparedChance: 74 });
  expect(sunServiceVerifiedReceipts(root.services!).map(item => item.serviceId).sort()).toEqual(['stair-evacuation', 'washhouse-heat']);
  const services = commands.filter(command => command.type === 'SERVICE');
  expect(services.filter(command => command.command.serviceId === 'washhouse-heat').map(command => command.command.type))
    .toEqual(['SURVEY', 'STOP_SERVICE', 'BUY_SUPPLIES', 'COOL_AND_FIT', 'RUN_HEAT_SERVICE', 'VERIFY_SERVICE']);
  expect(services.filter(command => command.command.serviceId === 'stair-evacuation').map(command => command.command.type))
    .toEqual(['SURVEY', 'BUY_SUPPLIES', 'CLEAR_STAIR', 'CARRY_RESIDENT', 'VERIFY_SERVICE']);
  expect(root.materials!.characteristics.map(item => item.holder)).toEqual(['EMBODIED', 'COMPOUND', 'COMPOUND']);
  expect(root.materials!.characteristics.slice(1).map(item => item.labour.length)).toEqual([5, 5]);
  expect(root.materials!.receipts.filter(item => item.command.type === 'ACQUIRE_CHARACTERISTIC').map(item => item.effect.cashCost)).toEqual([1100, 1100]);
  const verifications = root.materials!.receipts.filter(item => item.command.type === 'VERIFY_UNIQUENESS');
  // The actual recommended route exhausts this week's actions after the first
  // vacancy visit. The following week must pay and inspect the current seal
  // again; an old successful visit is not a transferable current permission.
  // The actual weekly bill also leaves less than 60p, so real WORK must earn
  // the original 180p wage before the second paid visit can proceed.
  expect(verifications.map(item => item.command)).toEqual([
    { type: 'VERIFY_UNIQUENESS', step: 'CHAIN' }, { type: 'VERIFY_UNIQUENESS', step: 'VACANCY' },
    { type: 'VERIFY_UNIQUENESS', step: 'VACANCY' },
  ]);
  expect(verifications.map(item => item.effect)).toEqual([
    { actions: 1, cashCost: 60, seconds: 1800 }, { actions: 1, cashCost: 60, seconds: 1800 },
    { actions: 1, cashCost: 60, seconds: 1800 },
  ]);
  const previousVacancy = verifications[1]!, currentVacancy = verifications[2]!;
  expect(currentVacancy.week).toBe(previousVacancy.week + 1);
  const firstVisit = root.journal.find(event => event.id === previousVacancy.eventId)!;
  expect(firstVisit.after.budget.actions).toBe(0);
  const renewal = root.journal.filter(event => event.revision > previousVacancy.revision && event.revision < currentVacancy.revision);
  expect(renewal.map(event => event.command)).toEqual([{ type: 'NEXT_WEEK' }, { type: 'WORK' }]);
  const renewalWeek = renewal[0]!, renewalWork = renewal[1]!;
  expect(renewalWeek.after.budget.week).toBe(renewalWeek.before.budget.week + 1);
  expect(renewalWeek.after.budget.actions).toBe(3);
  expect(renewalWeek.after.budget.cash).toBeLessThan(60);
  expect(renewalWeek.financeReceipts.length).toBeGreaterThan(0);
  expect(renewalWeek.after.nowSecond).toBe(renewalWeek.after.weekAnchor);
  expect(renewalWork.before).toEqual(renewalWeek.after);
  expect(renewalWork.after.budget.cash).toBe(renewalWork.before.budget.cash + 180);
  expect(renewalWork.after.budget.actions).toBe(2);
  expect(renewalWork.after.nowSecond - renewalWork.before.nowSecond).toBe(28800);
  expect(renewalWork.after.finance.wagePaidWeek).toBe(currentVacancy.week);
  expect(renewalWork.after.random).toEqual(renewalWork.before.random);
  expect(root.materials!.uniqueness.checks.map(item => item.eventId)).toEqual([verifications[0]!.eventId, currentVacancy.eventId]);
  for (const verification of verifications) {
    const event = root.journal.find(item => item.id === verification.eventId)!;
    expect(event.after.budget.cash).toBe(event.before.budget.cash - 60);
    expect(event.after.budget.actions).toBe(event.before.budget.actions - 1);
  }
  expect(root.materials!.receipts.filter(item => item.command.type === 'ACQUIRE_UNIQUENESS')).toHaveLength(1);
  expect(root.materials!.uniqueness).toMatchObject({ id: 'SU0-U1', holder: 'COMPOUND', compoundId: 'sun-compound-1' });
  const preparation = root.journal.find(event => event.command.type === 'STABILIZE_PROMOTION')!;
  expect(preparation.after.budget.cash).toBe(preparation.before.budget.cash - 100);
  expect(preparation.after.budget.actions).toBe(preparation.before.budget.actions - 1);
  expect(preparation.after.budget.spirituality).toBe(preparation.before.budget.spirituality - 12);
  expect(preparation.after.budget.mind).toBe(preparation.before.budget.mind - 8);
  expect(preparation.after.nowSecond - preparation.before.nowSecond).toBe(3600);
  const prepared = root.promotionStability.preparations.at(-1)!;
  expect(prepared.receipts).toHaveLength(4);
  expect(prepared.expiresSecond - prepared.preparedSecond).toBe(604800);
  const work = root.journal.filter(event => event.command.type === 'WORK');
  expect(work.length).toBeGreaterThan(0);
  expect(new Set(work.map(event => event.before.budget.week)).size).toBe(work.length);
  for (const event of work) expect(event.after.budget.cash - event.before.budget.cash).toBe(source.character.weeklyWage);
  expect(root.journal.some(event => event.financeReceipts.length > 0)).toBe(true);
  expect(root.source).toEqual(guided.sun.source);
  expect(beforeConsume.random).toEqual(source.random);
  expect(beforeConsume.progression.mastery).toEqual(source.progression.mastery);
  expect(state.sun.materials!.characteristics.map(item => item.holder)).toEqual(['FUSED', 'FUSED', 'FUSED']);
  expect(state.sun.materials!.uniqueness.holder).toBe('FUSED');
  expect(sunScenarioHash(source)).toBe(original);
  expect(sunInheritedHash(state)).toBe(sunInheritedHash(source));
  return { source, guided, servicesComplete, beforePreparation, beforeConsume, success: state, commands,
    cursorAdvancement: { ...draw, revision: last.revision, chance: receipt.check.chance, roll: receipt.check.roll } };
}
