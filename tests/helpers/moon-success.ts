import { expect, vi } from 'vitest';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { openMoonRuntimeSession } from '../../src/domain/moon/owned-session.js';
import { getMoonPromotionStabilityPreview } from '../../src/domain/moon/engine.js';
import {
  MOON_ARCHIVE, MOON_STATIONS, MOON_SUPPLIER, MOON_VAULT, MOON_WORKSHOP,
} from '../../src/domain/moon/content.js';
import type { MoonCommand } from '../../src/domain/moon/types.js';
import type { MoonServiceCommand, MoonStationId } from '../../src/domain/moon/services.js';
import type { MoonMaterialCommand } from '../../src/domain/moon/materials.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { controlledMoonSource } from './moon-source.js';

export interface ControlledMoonDraw {
  stage: 'S1' | 'S0'; cursorBefore: number; cursorAfter: number;
  actual: number; controlled: 1;
}

/** EXPLICIT CONTROLLED TEST BRANCH, never a natural result or success fixture.
 * Only two declared new d100 draws are substituted: S1 at318, S0 at319.
 * Each real generator call runs first and advances normally. Draws0..317,
 * source bytes, seed, cursor, resources and all receipts remain unedited.
 * Strict replay must reinstall this same seam; replay observations below are
 * not extra committed cursor advancements. Do not nest it with the S1 seam. */
export function installControlledMoonSuccess() {
  const original = DeterministicActionRandomStream.prototype.nextInt;
  const substituted: ControlledMoonDraw[] = [];
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum: number, maximum: number,
  ) {
    const cursorBefore = this.cursor, actual = original.call(this, minimum, maximum);
    if (this.seed === 'apothecary-rebuild-first' && minimum === 1 && maximum === 100 &&
        (cursorBefore === 318 || cursorBefore === 319)) {
      substituted.push({ stage: cursorBefore === 318 ? 'S1' : 'S0', cursorBefore,
        cursorAfter: this.cursor, actual, controlled: 1 });
      return 1;
    }
    return actual;
  });
  return { substituted, restore: () => spy.mockRestore() };
}

export interface ControlledMoonSuccess {
  source: SliceState;
  beforeConsume: SliceState;
  success: SliceState;
  commands: MoonCommand[];
  /** Exactly the committed advances after the unchanged670-command source. */
  cursorAdvancements: (ControlledMoonDraw & { revision: number; chance: number; roll: number })[];
}

/** One bounded full-slice construction through real public/owned commands.
 * All money and AP are earned/spent through ordinary work/week commands.
 * NORTH and REED retain their authored failed first departures; later attempts
 * use the same people, equipment and finite purchased oil. No field is patched.
 * The caller owns the seam lifecycle, including all later strict save replays. */
export function controlledMoonSuccess(
  control: ReturnType<typeof installControlledMoonSuccess>,
): ControlledMoonSuccess {
  const source = controlledMoonSource();
  let state = applySliceIntent(source, { type: 'MOON', command: { type: 'LEARN_GUIDANCE' } });
  const commands: MoonCommand[] = [{ type: 'LEARN_GUIDANCE' }];
  const session = openMoonRuntimeSession(state);
  const step = (command: MoonCommand): void => {
    if (commands.length >= 220) throw Error('Controlled Moon success exceeded its bounded public route');
    const before = { revision: state.revision, cursor: state.random.cursor };
    try {
      const draft = session.prepare({ type: 'MOON', command }, before.revision);
      session.commit(draft);
      state = session.snapshot();
    } catch (error) {
      throw new Error(`Controlled Moon success blocked at ${JSON.stringify(command)}: ${String(error)}`);
    }
    commands.push(structuredClone(command));
    expect(state.status).toBe('ACTIVE');
    expect(state.revision).toBe(before.revision + 1);
    expect(state.random.cursor).toBe(before.cursor + (command.type === 'CONSUME' ? 1 : 0));
    expect(state.moon.journal.at(-1)!.command).toEqual(command);
  };
  const nextWeek = (): void => {
    if (state.actionsRemaining && state.wagePaidWeek !== state.week) step({ type: 'WORK' });
    step({ type: 'NEXT_WEEK' });
  };
  const afford = (cash: number, actions = 1): void => {
    while (state.cash < cash || state.actionsRemaining < actions) {
      if (state.actionsRemaining && state.wagePaidWeek !== state.week) step({ type: 'WORK' });
      else step({ type: 'NEXT_WEEK' });
    }
  };
  const travel = (to: string): void => {
    if (state.moon.frame!.location !== to) { afford(2); step({ type: 'TRAVEL', to }); }
  };
  const service = (stationId: MoonStationId, type: MoonServiceCommand['type']): void =>
    step({ type: 'SERVICE', command: { type, stationId } });
  const material = (command: MoonMaterialCommand): void => step({ type: 'MATERIAL', command });

  for (const definition of MOON_STATIONS) {
    const station = () => state.moon.services!.stations.find(s => s.id === definition.id)!;
    travel(definition.location);
    afford(0); service(definition.id, 'INSPECT');
    afford(36); service(definition.id, 'BUY_SUPPLIES'); service(definition.id, 'FIT');
    let attempts = 0;
    while (!station().arrivalEventId) {
      if (++attempts > 8) throw Error(`No real arrival after eight published windows at ${definition.id}`);
      if (station().damaged) {
        afford(12); service(definition.id, 'BUY_SPARE'); service(definition.id, 'REPAIR_DAMAGE');
      }
      // Reserve the actual action before booking. Waiting never restores it.
      afford(0);
      service(definition.id, 'BOOK');
      if (state.moon.frame!.nowSecond < station().bookings.at(-1)!.window.startSecond)
        service(definition.id, 'WAIT');
      service(definition.id, 'CONDUCT_SERVICE');
    }
    service(definition.id, 'VERIFY');
    expect(station().passengers.every(p => p.status === 'ARRIVED' && p.location === p.destination)).toBe(true);
  }

  travel(MOON_SUPPLIER);
  for (const bottleId of ['beauty-goddess-potion-2', 'beauty-goddess-potion-3'] as const) {
    afford(120); material({ type: 'INVESTIGATE_LEGACY_REMAINS', bottleId });
    const week = state.moon.materials!.legacyRemains.find(r => r.originalBottleId === bottleId)!.investigatedWeek!;
    while (state.week <= week) nextWeek();
    afford(0); material({ type: 'RECOVER_LEGACY_REMAINS', bottleId });
  }
  travel(MOON_ARCHIVE);
  afford(30); material({ type: 'VERIFY_UNIQUENESS', step: 'CHAIN' });
  travel(MOON_VAULT);
  // Vacancy verification and physical handoff belong to the same actual week.
  afford(270, 2);
  material({ type: 'VERIFY_UNIQUENESS', step: 'VACANCY' });
  material({ type: 'ACQUIRE_UNIQUENESS' });
  travel(MOON_SUPPLIER);
  afford(360, 0); material({ type: 'BUY_COMPOUND', batchId: 'moon-carrier-1' });
  travel(MOON_WORKSHOP);
  while (state.health < 80 || state.mind < 78 || state.spirituality < 42) {
    afford(0); step({ type: 'REST' });
  }
  expect(state.injuries).toEqual([]);
  // Pay composition, preparation and consumption in one real week at the
  // original room, with the three separate actions already available.
  afford(220, 3);
  material({ type: 'COMPOSE_POTION', batchId: 'moon-carrier-1' });
  const compoundId = state.moon.materials!.compounds.at(-1)!.id;
  expect(getMoonPromotionStabilityPreview(state.moon, compoundId)).toMatchObject({ eligible: true, preparedChance: 70 });
  step({ type: 'STABILIZE_PROMOTION', compoundId });
  const beforeConsume = state;
  step({ type: 'CONSUME', compoundId, confirmed: true });
  expect(state.progression.sequence).toBe(0);
  expect(state.random).toEqual({ seed: source.random.seed, cursor: 320 });
  const first = source.beautyGoddess.acquisitionJournal.find(e => e.cursorBefore === 318 && e.check)!;
  const last = state.moon.journal.at(-1)!, receipt = last.randomReceipts[0]!;
  const s1 = control.substituted.find(draw => draw.stage === 'S1');
  const s0 = control.substituted.find(draw => draw.stage === 'S0');
  if (!s1 || !s0) throw Error('The two explicitly declared controlled draws were not observed');
  const cursorAdvancements: ControlledMoonSuccess['cursorAdvancements'] = [
    { ...s1, revision: first.revision, chance: first.check!.chance, roll: first.check!.roll },
    { ...s0, revision: last.revision, chance: receipt.check.chance, roll: receipt.check.roll },
  ];
  expect(cursorAdvancements.map(draw => [draw.stage, draw.cursorBefore, draw.cursorAfter, draw.roll, draw.chance]))
    .toEqual([['S1', 318, 319, 1, 44], ['S0', 319, 320, 1, 70]]);
  expect(state.moon.journal.flatMap(event => event.randomReceipts)).toHaveLength(1);
  return { source, beforeConsume, success: state, commands, cursorAdvancements };
}
