import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyAlchemistCommand, createAlchemistState } from '../../src/domain/alchemist/index.js';
import type { AlchemistAcquisitionCommand } from '../../src/domain/alchemist/types.js';
import {
  ALCHEMIST_DRAIN_CONSEQUENCE, ALCHEMIST_GARDEN_SOURCE, ALCHEMIST_PLOT_PRICE, ALCHEMIST_RITUAL_BOUNDARY,
  alchemistRitualActions, applyAlchemistRitualCommand, canConsumeAlchemistRitual, closeAlchemistRitual,
  createAlchemistRitualState, currentAlchemistPlot, hasAlchemistRitualLock, projectAlchemistRitual,
  validateAlchemistRitualCommand, validateAlchemistRitualState, type AlchemistRitualCommand,
} from '../../src/domain/alchemist/ritual.js';

/** Explicit prior-S5 unit setup, never presented as natural chronological play. */
function astronomer(): SliceState {
  const s = createSliceRun('alchemist-ritual-fixture', sliceDefaultCreationSelection, 'alchemist-ritual-fixture');
  s.activeEvent = null; s.eventQueue = []; s.week = 43; s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.world.city = 'BACKLUND';
  s.savant.discovered = true; s.savant.guidanceKnown = true; s.archaeologist.guidanceKnown = true;
  s.appraiser.guidanceKnown = true; s.artisan.guidanceKnown = true; s.artisan.promotionWeek = 19;
  s.astronomer.guidanceKnown = true; s.astronomer.promotionWeek = 31;
  s.progression.pathwayId = 'paragon'; s.progression.sequence = 5; s.progression.acting = 100;
  s.character.coreStats.knowledge = 25; s.character.coreStats.will = 25;
  s.alchemist = createAlchemistState(); s.alchemist.guidanceKnown = true;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: AlchemistRitualCommand) { const c = context(s); applyAlchemistRitualCommand(s, command, c); return c; }
function acquire(s: SliceState, command: AlchemistAcquisitionCommand, roll = 1) { const c = context(s, roll); applyAlchemistCommand(s, command, c); return c; }
function buy(s: SliceState, index = 0) { const bottle = s.alchemist.bottles[index]!; acquire(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
function prepared() { const s = astronomer(); buy(s); return s; }
function enter(s: SliceState) { apply(s, { type: 'PURCHASE_PLOT' }); s.week += 1; apply(s, { type: 'OPEN_RITUAL' }); }
function survey(s: SliceState) { enter(s); apply(s, { type: 'SURVEY' }); }
function qualify(s: SliceState) { survey(s); apply(s, { type: 'DRAIN_LIFE', confirmed: true }); }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyAlchemistRitualCommand(s, command as AlchemistRitualCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled(); expect(c.roll).not.toHaveBeenCalled();
}
function rejectDose(s: SliceState, index = 0) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyAlchemistCommand(s, { type: 'CONSUME', bottleId: s.alchemist.bottles[index]!.id, confirmed: true }, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Alchemist original living garden and irreversible finite life extraction', () => {
  it('starts with no land, plants, life or reusable window and independent state instances', () => {
    const s = createSliceRun('alchemist-hidden', sliceDefaultCreationSelection, 'alchemist-hidden');
    expect(createAlchemistRitualState()).toEqual({ playerLocation: 'OUTSIDE', activePlotId: null, plots: [] });
    expect(validateAlchemistRitualState(s)).toBe(true);
    expect(hasAlchemistRitualLock(s)).toBe(false); expect(canConsumeAlchemistRitual(s)).toBe(false);
    expect(projectAlchemistRitual(s)).toMatchObject({ plots: [], currentPlotId: null, livePlants: 0, deadPlants: 0, soilVitality: 0, poolWaterLitres: 0, boundary: '', source: '', consequence: '' });
    expect(alchemistRitualActions(s)).toEqual([]);
    const first = createAlchemistRitualState(), second = createAlchemistRitualState();
    first.activePlotId = 'AL4-PLOT-1'; expect(second.activePlotId).toBeNull(); expect(second.plots).toEqual([]);
  });

  it('actually pays for one owned bounded plot, fourteen unique living originals, live soil and 80L', () => {
    const s = prepared(), cash = s.cash, ap = s.actionsRemaining;
    const c = apply(s, { type: 'PURCHASE_PLOT' }), g = currentAlchemistPlot(s)!;
    expect([s.cash, s.actionsRemaining]).toEqual([cash - ALCHEMIST_PLOT_PRICE, ap - 1]);
    expect(g).toMatchObject({ id: 'AL4-PLOT-1', source: ALCHEMIST_GARDEN_SOURCE, owner: 'PLAYER', bounded: true, widthMetres: 6, lengthMetres: 4, paidPennies: 720, status: 'PURCHASED', purchasedWeek: 43, plannedWeek: 44, openedWeek: null, drainedWeek: null, windowWeek: null });
    expect(g.plants).toHaveLength(14); expect(new Set(g.plants.map(p => p.id)).size).toBe(14);
    expect(g.plants.slice(0, 12).every(p => p.kind === 'LAND' && p.location === g.id)).toBe(true);
    expect(g.plants.slice(12).every(p => p.kind === 'AQUATIC' && p.location === g.pool.id)).toBe(true);
    expect(g.plants.every(p => p.owner === 'PLAYER' && p.status === 'LIVING' && p.source.includes(p.id))).toBe(true);
    expect(g.soil).toMatchObject({ id: `${g.id}-SOIL`, owner: 'PLAYER', location: g.id, status: 'LIVING', vitality: 100 });
    expect(g.pool).toMatchObject({ id: `${g.id}-POOL`, owner: 'PLAYER', location: g.id, status: 'FILLED', waterLitres: 80 });
    expect(c.check).not.toHaveBeenCalled(); expect(c.roll).not.toHaveBeenCalled();
    expect(hasAlchemistRitualLock(s)).toBe(false); expect(canConsumeAlchemistRitual(s)).toBe(false);
    expect(projectAlchemistRitual(s)).toMatchObject({ currentPlotId: g.id, livePlants: 14, deadPlants: 0, soilVitality: 100, poolWaterLitres: 80, windowOpen: false });
    expect(validateAlchemistRitualState(s)).toBe(true);
  });

  it('requires a living guided Astronomer, actual owned potion, full payment and one action', () => {
    const s = astronomer(); reject(s, { type: 'PURCHASE_PLOT' }); buy(s);
    s.alchemist.guidanceKnown = false; reject(s, { type: 'PURCHASE_PLOT' }); s.alchemist.guidanceKnown = true;
    s.progression.sequence = 4; reject(s, { type: 'PURCHASE_PLOT' }); s.progression.sequence = 5;
    s.cash = 719; reject(s, { type: 'PURCHASE_PLOT' }); s.cash = 720;
    s.actionsRemaining = 0; reject(s, { type: 'PURCHASE_PLOT' }); s.actionsRemaining = 1;
    s.health = 0; reject(s, { type: 'PURCHASE_PLOT' }); s.health = 100;
    s.mind = 0; reject(s, { type: 'PURCHASE_PLOT' }); s.mind = 100;
    s.astronomer.cases['catalogue-check']!.contactOpen = true; reject(s, { type: 'PURCHASE_PLOT' }); s.astronomer.cases['catalogue-check']!.contactOpen = false;
    apply(s, { type: 'PURCHASE_PLOT' }); expect([s.cash, s.actionsRemaining]).toEqual([0, 0]);
    reject(s, { type: 'PURCHASE_PLOT' });
  });

  it('leaves ordinary time unlocked while waiting and requires actual next-week one-action entry', () => {
    const s = prepared(); apply(s, { type: 'PURCHASE_PLOT' }); reject(s, { type: 'OPEN_RITUAL' });
    reject(s, { type: 'SURVEY' }); reject(s, { type: 'DRAIN_LIFE', confirmed: true }); rejectDose(s);
    expect(hasAlchemistRitualLock(s)).toBe(false);
    s.week += 1; s.actionsRemaining = 0; reject(s, { type: 'OPEN_RITUAL' });
    s.actionsRemaining = 1; const cash = s.cash; apply(s, { type: 'OPEN_RITUAL' });
    expect(s.actionsRemaining).toBe(0); expect(s.cash).toBe(cash);
    expect(s.alchemist.ritual.playerLocation).toBe('PLOT'); expect(hasAlchemistRitualLock(s)).toBe(true);
    expect(canConsumeAlchemistRitual(s)).toBe(false); expect(validateAlchemistRitualState(s)).toBe(true);
    reject(s, { type: 'OPEN_RITUAL' }); reject(s, { type: 'DRAIN_LIFE', confirmed: true });
    apply(s, { type: 'SURVEY' }); apply(s, { type: 'DRAIN_LIFE', confirmed: true });
    expect(s.actionsRemaining).toBe(0); expect(canConsumeAlchemistRitual(s)).toBe(true);
  });

  it('exposes exact living sources and consequences before a separate destructive confirmation', () => {
    const s = prepared(); enter(s); const originals = structuredClone(currentAlchemistPlot(s)!), c = apply(s, { type: 'SURVEY' });
    const g = currentAlchemistPlot(s)!;
    expect(g.plants).toEqual(originals.plants); expect(g.soil).toEqual(originals.soil); expect(g.pool).toEqual(originals.pool);
    expect(g.surveyedWeek).toBe(s.week); expect(g.drainConfirmed).toBe(false); expect(canConsumeAlchemistRitual(s)).toBe(false);
    expect(c.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining(ALCHEMIST_DRAIN_CONSEQUENCE));
    reject(s, { type: 'SURVEY' }); reject(s, { type: 'DRAIN_LIFE' }); reject(s, { type: 'DRAIN_LIFE', confirmed: false });
    reject(s, { type: 'DRAIN_LIFE', confirmed: 'true' }); reject(s, { type: 'DRAIN_LIFE', confirmed: true, vitality: 0 });
    rejectDose(s); expect(validateAlchemistRitualState(s)).toBe(true);
  });

  it('drains every actual original without RNG, extra AP, free recovery or consuming the potion', () => {
    const s = prepared(); survey(s); s.actionsRemaining = 0;
    const g = currentAlchemistPlot(s)!, ids = g.plants.map(p => p.id), resources = [s.cash, s.health, s.mind, s.spirituality], originalBottle = structuredClone(s.alchemist.bottles[0]);
    const c = apply(s, { type: 'DRAIN_LIFE', confirmed: true });
    expect(g.plants.map(p => p.id)).toEqual(ids); expect(g.plants.every(p => p.status === 'DEAD')).toBe(true);
    expect(g).toMatchObject({ drainConfirmed: true, drainedWeek: s.week, windowWeek: s.week });
    expect(g.soil).toMatchObject({ status: 'SAND', vitality: 0 }); expect(g.pool).toMatchObject({ status: 'DRY', waterLitres: 0 });
    expect([s.cash, s.health, s.mind, s.spirituality]).toEqual(resources); expect(s.actionsRemaining).toBe(0);
    expect(s.alchemist.bottles[0]).toEqual(originalBottle); expect(c.check).not.toHaveBeenCalled(); expect(c.roll).not.toHaveBeenCalled();
    expect(canConsumeAlchemistRitual(s)).toBe(true); expect(validateAlchemistRitualState(s)).toBe(true);
    reject(s, { type: 'DRAIN_LIFE', confirmed: true }); reject(s, { type: 'SURVEY' });
  });

  it.each(['PURCHASED', 'SURVEYED'] as const)('can leave %s land at zero AP and retain living owned originals without refund', stage => {
    const s = prepared();
    if (stage === 'PURCHASED') apply(s, { type: 'PURCHASE_PLOT' }); else survey(s);
    const g = currentAlchemistPlot(s)!, originals = structuredClone([g.plants, g.soil, g.pool]), bottle = structuredClone(s.alchemist.bottles[0]);
    s.actionsRemaining = 0; s.health = 57; s.mind = 64; const resources = [s.cash, s.health, s.mind, s.spirituality];
    const leave = alchemistRitualActions(s).find(a => a.command.type === 'LEAVE_RITUAL'); expect(leave?.enabled).toBe(true);
    apply(s, { type: 'LEAVE_RITUAL' });
    expect(g.status).toBe(stage === 'PURCHASED' ? 'CANCELLED' : 'CLOSED'); expect(g.closedWeek).toBe(s.week);
    expect([g.plants, g.soil, g.pool]).toEqual(originals); expect(s.alchemist.bottles[0]).toEqual(bottle);
    expect([s.cash, s.health, s.mind, s.spirituality]).toEqual(resources); expect(s.actionsRemaining).toBe(0);
    expect(s.alchemist.ritual.playerLocation).toBe('OUTSIDE'); expect(hasAlchemistRitualLock(s)).toBe(false);
    expect(validateAlchemistRitualState(s)).toBe(true); reject(s, { type: 'OPEN_RITUAL' });
  });

  it('leaving after drain destroys the window but preserves original dead plants, sand and dry pool', () => {
    const s = prepared(); qualify(s); const g = currentAlchemistPlot(s)!, originals = structuredClone([g.plants, g.soil, g.pool]); s.actionsRemaining = 0;
    apply(s, { type: 'LEAVE_RITUAL' });
    expect(g.status).toBe('CLOSED'); expect(g.windowWeek).toBe(s.week); expect(g.consumedBottleId).toBeNull();
    expect([g.plants, g.soil, g.pool]).toEqual(originals); expect(s.alchemist.bottles[0]!.status).toBe('PLAYER');
    expect(s.alchemist.ritual.activePlotId).toBeNull(); expect(canConsumeAlchemistRitual(s)).toBe(false); expect(hasAlchemistRitualLock(s)).toBe(false);
    rejectDose(s); reject(s, { type: 'OPEN_RITUAL' }); expect(validateAlchemistRitualState(s)).toBe(true);
    expect(projectAlchemistRitual(s)).toMatchObject({ livePlants: 0, deadPlants: 14, soilVitality: 0, poolWaterLitres: 0, windowOpen: false });
    expect(projectAlchemistRitual(s).plots[0]!.summary).toContain('14株原植物死亡');
  });

  it('keeps the zero-action exit available when the player cannot perform further ritual actions', () => {
    const s = prepared(); survey(s); s.actionsRemaining = 0; s.health = 0; s.mind = 0;
    const g = currentAlchemistPlot(s)!, resources = structuredClone([g.plants, g.soil, g.pool]);
    expect(alchemistRitualActions(s).find(a => a.command.type === 'LEAVE_RITUAL')?.enabled).toBe(true);
    apply(s, { type: 'LEAVE_RITUAL' });
    expect([s.actionsRemaining, s.health, s.mind]).toEqual([0, 0, 0]);
    expect([g.plants, g.soil, g.pool]).toEqual(resources); expect(hasAlchemistRitualLock(s)).toBe(false);
  });

  it('a second attempt buys distinct actual originals with new money and another real-week wait', () => {
    const s = prepared(); qualify(s); apply(s, { type: 'LEAVE_RITUAL' });
    const old = structuredClone(s.alchemist.ritual.plots[0]!), cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'PURCHASE_PLOT' }); const next = currentAlchemistPlot(s)!;
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 720, ap - 1]);
    expect(next.id).toBe('AL4-PLOT-2'); expect(next.plants.every(p => p.status === 'LIVING')).toBe(true);
    expect(next.plants.every(p => old.plants.every(previous => previous.id !== p.id))).toBe(true);
    expect(next.soil.id).not.toBe(old.soil.id); expect(next.pool.id).not.toBe(old.pool.id);
    expect(s.alchemist.ritual.plots[0]).toEqual(old); reject(s, { type: 'OPEN_RITUAL' }); expect(hasAlchemistRitualLock(s)).toBe(false);
    s.week += 1; apply(s, { type: 'OPEN_RITUAL' }); apply(s, { type: 'SURVEY' }); apply(s, { type: 'DRAIN_LIFE', confirmed: true });
    expect(canConsumeAlchemistRitual(s)).toBe(true); expect(s.alchemist.ritual.plots[0]).toEqual(old);
    expect(validateAlchemistRitualState(s)).toBe(true);
  });

  it('does not turn a cancelled living garden into a recycled original plot', () => {
    const s = prepared(); apply(s, { type: 'PURCHASE_PLOT' }); apply(s, { type: 'LEAVE_RITUAL' });
    const old = structuredClone(s.alchemist.ritual.plots[0]); apply(s, { type: 'PURCHASE_PLOT' });
    expect(s.alchemist.ritual.plots[0]).toEqual(old); expect(currentAlchemistPlot(s)!.id).toBe('AL4-PLOT-2');
    expect(s.alchemist.ritual.plots[0]!.plants.every(p => p.status === 'LIVING')).toBe(true);
    expect(validateAlchemistRitualState(s)).toBe(true);
  });

  it.each([[1, 'GREAT_SUCCESS', 4], [30, 'SUCCESS', 4], [90, 'FAILURE', 5], [100, 'GREAT_FAILURE', 5]] as const)(
    'actual potion roll%s closes the same original land and retains its irreversible consequences', (roll, tier, sequence) => {
      const s = prepared(); qualify(s); s.actionsRemaining = 0;
      const g = currentAlchemistPlot(s)!, originals = structuredClone([g.plants, g.soil, g.pool]), bottle = s.alchemist.bottles[0]!;
      const c = acquire(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledTimes(1); expect(c.check).toHaveBeenCalledWith('will', 28);
      expect(s.progression.sequence).toBe(sequence); expect(s.actionsRemaining).toBe(0);
      expect(bottle).toMatchObject({ status: 'CONSUMED', outcome: tier, consumedWeek: s.week, ritualId: g.id, ritualWindowWeek: s.week });
      expect(g).toMatchObject({ status: 'CLOSED', consumedBottleId: bottle.id, closedWeek: s.week });
      expect([g.plants, g.soil, g.pool]).toEqual(originals); expect(s.alchemist.ritual.playerLocation).toBe('OUTSIDE');
      expect(canConsumeAlchemistRitual(s)).toBe(false); expect(hasAlchemistRitualLock(s)).toBe(false); expect(validateAlchemistRitualState(s)).toBe(true);
      if (sequence === 5) {
        buy(s, 1); rejectDose(s, 1); s.actionsRemaining = 1;
        const history = structuredClone(g); apply(s, { type: 'PURCHASE_PLOT' });
        expect(s.alchemist.ritual.plots[0]).toEqual(history); expect(currentAlchemistPlot(s)!.id).toBe('AL4-PLOT-2'); reject(s, { type: 'OPEN_RITUAL' });
      }
    },
  );

  it('cannot close as potion consumption by naming a bottle that has not actually been consumed', () => {
    const s = prepared(); qualify(s); const before = structuredClone(s);
    expect(() => closeAlchemistRitual(s, s.alchemist.bottles[0]!.id)).toThrow(); expect(s).toEqual(before);
    expect(canConsumeAlchemistRitual(s)).toBe(true);
  });

  it.each(['empty', 'dead-plant', 'moved-plant', 'duplicate-plant', 'foreign-owner', 'no-water', 'sand'] as const)(
    'does not let %s land qualify as the actual living area', change => {
      const s = prepared(); survey(s); const g = currentAlchemistPlot(s)!;
      if (change === 'empty') g.plants = [];
      if (change === 'dead-plant') g.plants[0]!.status = 'DEAD';
      if (change === 'moved-plant') g.plants[0]!.location = 'OTHER-PLOT';
      if (change === 'duplicate-plant') g.plants[1]!.id = g.plants[0]!.id;
      if (change === 'foreign-owner') Object.assign(g.plants[0]!, { owner: 'NURSERY' });
      if (change === 'no-water') g.pool.waterLitres = 0;
      if (change === 'sand') { g.soil.status = 'SAND'; g.soil.vitality = 0; }
      expect(validateAlchemistRitualState(s)).toBe(false); reject(s, { type: 'DRAIN_LIFE', confirmed: true }); expect(canConsumeAlchemistRitual(s)).toBe(false);
    },
  );

  it.each(['next-week', 'outside', 'dead-player', 'revived-plant', 'restored-soil', 'refilled-pool', 'missing-consent', 'missing-survey'] as const)(
    'rejects stale or forged drained window: %s', change => {
      const s = prepared(); qualify(s); const g = currentAlchemistPlot(s)!;
      if (change === 'next-week') s.week += 1;
      if (change === 'outside') s.alchemist.ritual.playerLocation = 'OUTSIDE';
      if (change === 'dead-player') s.health = 0;
      if (change === 'revived-plant') g.plants[0]!.status = 'LIVING';
      if (change === 'restored-soil') { g.soil.status = 'LIVING'; g.soil.vitality = 100; }
      if (change === 'refilled-pool') { g.pool.status = 'FILLED'; g.pool.waterLitres = 80; }
      if (change === 'missing-consent') g.drainConfirmed = false;
      if (change === 'missing-survey') g.surveyedWeek = null;
      expect(canConsumeAlchemistRitual(s)).toBe(false); expect(validateAlchemistRitualState(s)).toBe(false); rejectDose(s);
    },
  );

  it('retains source and temporal identity through serialization and rejects malformed original records', () => {
    const s = prepared(); qualify(s); apply(s, { type: 'LEAVE_RITUAL' });
    const restored = JSON.parse(JSON.stringify(s)) as SliceState; expect(validateAlchemistRitualState(restored)).toBe(true);
    for (const change of [
      (v: SliceState) => { v.alchemist.ritual.plots[0]!.source = 'empty land permit'; },
      (v: SliceState) => { v.alchemist.ritual.plots[0]!.paidPennies = 0; },
      (v: SliceState) => { v.alchemist.ritual.plots[0]!.purchasedWeek = v.week; },
      (v: SliceState) => { v.alchemist.ritual.plots[0]!.plannedWeek = v.alchemist.ritual.plots[0]!.purchasedWeek; },
      (v: SliceState) => { v.alchemist.ritual.plots[0]!.plants[0]!.source = 'replacement plant'; },
      (v: SliceState) => { v.alchemist.ritual.plots[0]!.consumedBottleId = v.alchemist.bottles[0]!.id; },
      (v: SliceState) => { Object.assign(v.alchemist.ritual.plots[0]!, { extraLife: 100 }); },
      (v: SliceState) => { Object.assign(v.alchemist.ritual.plots[0]!, { pool: null }); },
    ]) {
      const invalid = structuredClone(restored); change(invalid); expect(validateAlchemistRitualState(invalid)).toBe(false);
    }
  });

  it('publishes G uncertainty, exact old land outcomes and independent actions without raw state aliasing', () => {
    const s = prepared(); survey(s);
    let view = projectAlchemistRitual(s);
    expect(view.boundary).toBe(ALCHEMIST_RITUAL_BOUNDARY); expect(view.boundary).toContain('完整条件待核'); expect(view.boundary).toContain('方案G');
    expect(view.consequence).toBe(ALCHEMIST_DRAIN_CONSEQUENCE); expect(view.plots[0]!.plants).toHaveLength(14);
    expect(alchemistRitualActions(s).find(a => a.command.type === 'DRAIN_LIFE')).toMatchObject({ enabled: true, command: { type: 'DRAIN_LIFE', confirmed: true } });
    view.plots[0]!.plants[0]!.status = 'bad'; expect(currentAlchemistPlot(s)!.plants[0]!.status).toBe('LIVING');
    apply(s, { type: 'DRAIN_LIFE', confirmed: true }); apply(s, { type: 'LEAVE_RITUAL' });
    view = projectAlchemistRitual(s); expect(view.plots[0]!.soil.vitality).toBe(0); expect(view.plots[0]!.pool.waterLitres).toBe(0);
    expect(view.plots[0]!.deadPlants).toBe(14); expect(view.plots[0]!.summary).toContain('后果仍保留');
  });

  it('accepts only fixed ritual intents and the explicit independent destructive true payload', () => {
    for (const type of ['PURCHASE_PLOT', 'OPEN_RITUAL', 'SURVEY', 'LEAVE_RITUAL']) expect(validateAlchemistRitualCommand({ type })).toBe(true);
    expect(validateAlchemistRitualCommand({ type: 'DRAIN_LIFE', confirmed: true })).toBe(true);
    for (const command of [null, [], { type: 'DRAIN_LIFE' }, { type: 'DRAIN_LIFE', confirmed: false }, { type: 'DRAIN_LIFE', confirmed: 1 }, { type: 'SURVEY', confirmed: true }, { type: 'SET_LIFE', vitality: 100 }, { type: 'REVIVE_PLOT' }, { type: 'PURCHASE_PLOT', plants: 0 }]) expect(validateAlchemistRitualCommand(command)).toBe(false);
  });
});
