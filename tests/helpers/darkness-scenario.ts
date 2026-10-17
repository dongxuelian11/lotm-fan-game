import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { addGameDays, compareGameDates } from '../../src/domain/game-calendar.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { createDarknessState } from '../../src/domain/darkness/index.js';
import { getDarknessPromotionStabilityPreview } from '../../src/domain/darkness/engine.js';
import { openDarknessRuntimeSession } from '../../src/domain/darkness/owned-session.js';
import type { DarknessCommand } from '../../src/domain/darkness/types.js';
import {
  DARKNESS_ARCHIVE, DARKNESS_SUPPLIER, DARKNESS_VAULT, DARKNESS_WORKSHOP,
} from '../../src/domain/darkness/content.js';
import {
  DARKNESS_EVACUATION_LOCATION, DARKNESS_EVACUATION_POINTS, DARKNESS_RESIDENT_IDS,
  type DarknessEvacuationCommand, type DarknessEvacuationPoint,
} from '../../src/domain/darkness/evacuation.js';
import { DARKNESS_FUTURE_BRANCH } from '../../src/domain/darkness/material-content.js';
import type { DarknessMaterialCommand } from '../../src/domain/darkness/materials.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from './current-save-format.js';
import { readObjectEntry } from './read-object-entry.js';

export const DARKNESS_SOURCE_BOUNDARY = 'tests/fixtures/misfortune-knight-v01910/boundary-three-honest-reports-reflected.json';
export const DARKNESS_SOURCE_SNAPSHOT = 'tests/fixtures/misfortune-knight-v01910/snapshot-practiced.json';
export const DARKNESS_ORIGINAL_DEATH = 'tests/fixtures/misfortune-knight-v01910/natural.json';
export const DARKNESS_SOURCE_PINS = [
  [DARKNESS_SOURCE_BOUNDARY, '6e5889192d3a0c697640fc0bc1fadd680c7b8526088a11d8f920b602cf34b79f'],
  [DARKNESS_SOURCE_SNAPSHOT, '470d3ae9700186d8488b27663a9c64060053a011cd57bed3a5054a275bf7b6ee'],
  [DARKNESS_ORIGINAL_DEATH, '597112414e673dbb446dd17d860bd88541ca5007f6310d552c41f96b12462ae8'],
] as const;
export const DARKNESS_CONTROLLED_SEED = 'sleepless-natural-v020';
export const DARKNESS_CONTROLLED_CURSOR = 348;
export const DARKNESS_CONTROLLED_CONSUME = {
  type: 'DARKNESS', command: { type: 'CONSUME', compoundId: 'darkness-compound-1', confirmed: true },
} as const;
export const darknessScenarioHash = (value: unknown): string =>
  createHash('sha256').update(stableStringify(value)).digest('hex');

export function assertUnmodifiedDarknessInputs(): void {
  for (const [file, sha] of DARKNESS_SOURCE_PINS)
    expect(createHash('sha256').update(readFileSync(file)).digest('hex'), file).toBe(sha);
}

/** The real, alive 679-command boundary, not the later 694-command death.
 * Migration is the sole transformation; every historical field except the two
 * format labels must remain identical. No seed, budget, clock or history edit. */
export function authenticDarknessSource(): SliceState {
  assertUnmodifiedDarknessInputs();
  const historical = readObjectEntry<SliceState>(DARKNESS_SOURCE_BOUNDARY, 'final');
  expect(historical).toEqual(JSON.parse(readFileSync(DARKNESS_SOURCE_SNAPSHOT, 'utf8')));
  expect([historical.schemaVersion, historical.contentVersion]).toEqual([188, 'misfortune-knight-v188']);
  const before = darknessScenarioHash(historical), source = migrateSliceState(historical);
  expect(darknessScenarioHash(historical)).toBe(before);
  for (const [key, value] of Object.entries(historical)) {
    if (key !== 'schemaVersion' && key !== 'contentVersion')
      expect(source[key as keyof SliceState], `Migration changed historical ${key}`).toEqual(value);
  }
  expect([source.schemaVersion, source.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  expect(source).toMatchObject({ revision: 680, week: 158, status: 'ACTIVE',
    date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 7, day: 1 },
    health: 100, mind: 97, spirituality: 112, cash: 400, actionsRemaining: 3,
    injuries: [], injuryRisk: 0, progression: { pathwayId: 'darkness', sequence: 1, acting: 100 },
    random: { seed: DARKNESS_CONTROLLED_SEED, cursor: DARKNESS_CONTROLLED_CURSOR },
  });
  expect(source.darkness).toEqual(createDarknessState());
  assertValidSliceState(source);
  return source;
}

export interface ControlledDarknessDraw {
  cursorBefore: number; cursorAfter: number; actual: number; controlled: 1;
}

/** EXPLICIT CONTROLLED BRANCH, never a natural success capture. The real RNG
 * always runs and advances first. Only the first new d100 at seed/cursor348 is
 * substituted, and strict replays require this same declared test seam.
 * Draws0..347, other ranges, other seeds and later draws pass through intact. */
export function installControlledDarknessPromotion() {
  const original = DeterministicActionRandomStream.prototype.nextInt;
  const substituted: ControlledDarknessDraw[] = [];
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum: number, maximum: number,
  ) {
    const cursorBefore = this.cursor, actual = original.call(this, minimum, maximum);
    if (this.seed === DARKNESS_CONTROLLED_SEED && cursorBefore === DARKNESS_CONTROLLED_CURSOR && minimum === 1 && maximum === 100) {
      substituted.push({ cursorBefore, cursorAfter: this.cursor, actual, controlled: 1 });
      return 1;
    }
    return actual;
  });
  return { original, substituted, restore: () => spy.mockRestore() };
}

export interface ControlledDarknessSuccess {
  source: SliceState;
  guided: SliceState;
  evacuated: SliceState;
  beforeFuture: SliceState;
  beforePreparation: SliceState;
  beforeConsume: SliceState;
  success: SliceState;
  commands: DarknessCommand[];
  /** The one committed draw; repeated replay observations are not extra draws. */
  cursorAdvancement: ControlledDarknessDraw & { revision: number; chance: number; roll: number };
}

export function darknessScenarioDate(state: SliceState) {
  const frame = state.darkness.frame!;
  return addGameDays(state.date, Math.floor((frame.nowSecond - frame.weekAnchor) / 86400));
}

/** Full central-owned route from authentic S1. Actual work pays every bill;
 * actual NEXT_WEEK events reach the authored1353 custody date. Four original
 * adults consent and walk every segment. The two failed original residues are
 * located for cash, then recovered at the same site after a real week.
 * No host fixture, fake receipt, resource refill, raw S0 edit or journal skip.
 * Caller retains the seam for any strict save/reopen/replay of the result. */
export function controlledDarknessSuccess(
  control: ReturnType<typeof installControlledDarknessPromotion>,
): ControlledDarknessSuccess {
  const source = authenticDarknessSource();
  let state = applySliceIntent(source, { type: 'DARKNESS', command: { type: 'LEARN_GUIDANCE' } });
  const guided = state, commands: DarknessCommand[] = [{ type: 'LEARN_GUIDANCE' }];
  const session = openDarknessRuntimeSession(state);
  const step = (command: DarknessCommand): void => {
    if (commands.length >= 240) throw Error('Controlled Darkness route exceeded240 real commands');
    const before = { revision: state.revision, cursor: state.random.cursor };
    try {
      const draft = session.prepare({ type: 'DARKNESS', command }, before.revision);
      session.commit(draft); state = session.snapshot();
    } catch (error) {
      throw new Error(`Controlled Darkness blocked at ${JSON.stringify(command)} (week${state.week}, AP${state.actionsRemaining}, cash${state.cash}): ${String(error)}`);
    }
    commands.push(structuredClone(command));
    expect(state.status).toBe('ACTIVE');
    expect(state.revision).toBe(before.revision + 1);
    expect(state.random.cursor).toBe(before.cursor + (command.type === 'CONSUME' ? 1 : 0));
    expect(state.darkness.journal.at(-1)!.command).toEqual(command);
  };
  const nextWeek = (): void => {
    if (state.actionsRemaining > 0 && state.wagePaidWeek !== state.week) step({ type: 'WORK' });
    step({ type: 'NEXT_WEEK' });
  };
  const afford = (cash: number, actions = 1): void => {
    while (state.cash < cash || state.actionsRemaining < actions) {
      if (state.actionsRemaining > 0 && state.wagePaidWeek !== state.week) step({ type: 'WORK' });
      else step({ type: 'NEXT_WEEK' });
    }
  };
  const travel = (to: string): void => {
    if (state.darkness.frame!.location !== to) { afford(0); step({ type: 'TRAVEL', to }); }
  };
  const evacuation = (command: DarknessEvacuationCommand): void => step({ type: 'EVACUATION', command });
  const go = (to: DarknessEvacuationPoint): void => {
    while (state.darkness.evacuation!.position !== to) {
      const at = DARKNESS_EVACUATION_POINTS.indexOf(state.darkness.evacuation!.position);
      const direction = to > state.darkness.evacuation!.position ? 1 : -1;
      evacuation({ type: 'WALK', to: DARKNESS_EVACUATION_POINTS[at + direction]!, pace: 'CAREFUL' });
    }
  };
  const material = (command: DarknessMaterialCommand): void => step({ type: 'MATERIAL', command });

  travel(DARKNESS_EVACUATION_LOCATION);
  evacuation({ type: 'SURVEY_DAY' }); evacuation({ type: 'BUY_SUPPLIES' });
  for (const residentId of DARKNESS_RESIDENT_IDS) {
    go(state.darkness.evacuation!.residents.find(p => p.id === residentId)!.position);
    evacuation({ type: 'REGISTER_RESIDENT', residentId });
  }
  go(110); evacuation({ type: 'ORDINARY_RETURN' });
  // All AP were honestly spent on guidance, travel and daylight survey.
  // Return physically before crossing a week; reserve night and report AP.
  afford(0, 2);
  // NEXT_WEEK arrives at midnight, when WAIT_NIGHT correctly refuses to skip
  // an unopened night. Eight hours of real work reach daylight and pay wages.
  step({ type: 'WORK' });
  evacuation({ type: 'WAIT_NIGHT' }); evacuation({ type: 'BEGIN_NIGHT' });
  evacuation({ type: 'LIGHT', lampId: 'DN-LAMP-1' });
  go(25); evacuation({ type: 'OBSERVE', hazard: 'FALSE_LIGHT' }); evacuation({ type: 'SHIELD_FALSE_LIGHT' });
  go(55); evacuation({ type: 'OBSERVE', hazard: 'NOISE' }); evacuation({ type: 'RELAY_INSTRUCTIONS' });
  for (const residentId of DARKNESS_RESIDENT_IDS) {
    go(state.darkness.evacuation!.residents.find(p => p.id === residentId)!.position);
    evacuation({ type: 'ESCORT', residentId }); go(110);
  }
  evacuation({ type: 'ORDINARY_RETURN' }); evacuation({ type: 'REPORT' });
  const evacuated = state;

  travel(DARKNESS_SUPPLIER);
  for (const bottleId of ['misfortune-knight-potion-1', 'misfortune-knight-potion-2'] as const) {
    afford(120); material({ type: 'INVESTIGATE_LEGACY_REMAINS', bottleId });
    const investigated = state.darkness.materials!.legacyRemains.find(r => r.originalBottleId === bottleId)!.investigatedWeek!;
    while (state.week <= investigated) nextWeek();
    afford(0); material({ type: 'RECOVER_LEGACY_REMAINS', bottleId });
  }
  travel(DARKNESS_ARCHIVE);
  const beforeFuture = state;
  expect(compareGameDates(darknessScenarioDate(state), DARKNESS_FUTURE_BRANCH.transferDate)).toBeLessThan(0);
  while (compareGameDates(darknessScenarioDate(state), DARKNESS_FUTURE_BRANCH.transferDate) < 0) nextWeek();
  afford(30); material({ type: 'VERIFY_UNIQUENESS', step: 'CHAIN' });
  travel(DARKNESS_VAULT);
  afford(270, 2);
  material({ type: 'VERIFY_UNIQUENESS', step: 'VACANCY' }); material({ type: 'ACQUIRE_UNIQUENESS' });
  travel(DARKNESS_SUPPLIER);
  afford(360, 0); material({ type: 'BUY_COMPOUND', batchId: 'darkness-carrier-1' });
  travel(DARKNESS_WORKSHOP);
  while (state.health < 80 || state.mind < 78 || state.spirituality < 42 || state.injuries.length > 0) {
    afford(0); step({ type: 'REST' });
  }
  afford(220, 3);
  material({ type: 'COMPOSE_POTION', batchId: 'darkness-carrier-1' });
  const beforePreparation = state, compoundId = 'darkness-compound-1';
  expect(getDarknessPromotionStabilityPreview(state.darkness, compoundId)).toMatchObject({ eligible: true, prepared: false, preparedChance: 70 });
  step({ type: 'STABILIZE_PROMOTION', compoundId });
  const beforeConsume = state;
  step(DARKNESS_CONTROLLED_CONSUME.command);
  expect(state.progression.sequence).toBe(0);
  const last = state.darkness.journal.at(-1)!, receipt = last.randomReceipts[0]!;
  const observed = control.substituted.find(draw => draw.cursorBefore === DARKNESS_CONTROLLED_CURSOR);
  if (!observed) throw Error('The declared one-draw Darkness control was not observed');
  expect(state.darkness.journal.flatMap(event => event.randomReceipts)).toHaveLength(1);
  expect(receipt).toMatchObject({ cursorBefore: 348, cursorAfter: 349, check: { chance: 70, roll: 1 } });
  return { source, guided, evacuated, beforeFuture, beforePreparation, beforeConsume, success: state, commands,
    cursorAdvancement: { ...observed, revision: last.revision, chance: receipt.check.chance, roll: receipt.check.roll } };
}
