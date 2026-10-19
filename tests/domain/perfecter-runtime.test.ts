import { beforeAll, describe, expect, it } from 'vitest';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import type { PerfecterCommand } from '../../src/domain/perfecter/types.js';
import {
  applyPerfecterCommand, applyOwnedPerfecterCommand, openPerfecterOwnedHead,
  assertOwnedPerfecterCurrent, ownedPerfecterCommandBlock, projectOwnedPerfecter,
  projectPerfecter, validatePerfecterState, validatePerfecterCommand,
} from '../../src/domain/perfecter/index.js';
import {
  snapshotPerfecterOwnedEngine, type PerfecterOwnedEngine,
  samePerfecter, perfecterDigest,
} from '../../src/domain/perfecter/engine.js';
import { PERFECTER_FROZEN_SOURCE_KEYS } from '../../src/domain/perfecter/source.js';
import { PERFECTER_PROMOTION_STABILITY, PERFECTER_CONSUMPTION, PERFECTER_EPILOGUE_BONUS } from '../../src/domain/perfecter/content.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const context: SeerContext = {
  note() {}, roll() { throw Error('No caller RNG'); }, check() { throw Error('No caller check'); },
};
let source: SliceState, initial: SliceState;
const raw = (state: SliceState, command: PerfecterCommand): SliceState => {
  const next = structuredClone(state); applyPerfecterCommand(next, command, context); next.revision++; return next;
};
beforeAll(() => {
  source = migrateSliceState(readObjectEntry<unknown>(
    'tests/fixtures/civilization-enlightener-v01890/boundary-ordinary-life-after-exit.json', 'final'));
  expect([source.revision, source.week, source.health, source.mind, source.spirituality, source.cash, source.actionsRemaining])
    .toEqual([798, 188, 60, 98, 120, 436, 3]);
  initial = raw(source, { type: 'LEARN_GUIDANCE' });
}, 60_000);

describe('Perfecter authoritative raw replay and private owned transitions', () => {
  it('inherits the exact wounded original body, resources, devices and all twenty-one skills', () => {
    expect([initial.cash, initial.actionsRemaining, initial.health, initial.mind, initial.spirituality])
      .toEqual([336, 2, 60, 98, 120]);
    expect(initial.injuries).toEqual(source.injuries);
    expect(initial.random).toEqual(source.random);
    expect(initial.perfecter.source!.originalDevices).toEqual(source.alchemist.life.creations);
    expect(initial.alchemist.life.creations.map(device => [device.charge, device.durability])).toEqual([[0, 100], [0, 95]]);
    expect(initial.progression.mastery).toEqual(source.progression.mastery);
    expect(Object.keys(initial.progression.mastery)).toHaveLength(21);
    expect(Object.values(initial.progression.mastery).filter(value => value === 0)).toHaveLength(8);
    for (const key of PERFECTER_FROZEN_SOURCE_KEYS) expect(initial[key]).toEqual(source[key]);
    expect(projectPerfecter(initial).abilities).toHaveLength(21);
    expect(projectPerfecter(initial).abilities.some(ability => ability.id.startsWith('paragon.s0.'))).toBe(false);
  });
  it('matches raw and owned actions while keeping old handles and snapshots independent', () => {
    let state = structuredClone(initial), head = openPerfecterOwnedHead(state);
    const commands: PerfecterCommand[] = [{ type: 'CLINIC' }, { type: 'REST' }, { type: 'NEXT_WEEK' },
      { type: 'WORK' }, { type: 'TRAVEL', to: 'backlund:professional-handoff' }];
    for (const command of commands) {
      const expected = raw(state, command), draft = structuredClone(state), before = structuredClone(state);
      const old = snapshotPerfecterOwnedEngine(head);
      expect(ownedPerfecterCommandBlock(state, command, head)).toBeNull();
      expect(projectOwnedPerfecter(state, head)).toEqual(projectPerfecter(state));
      expect(state).toEqual(before);
      const next = applyOwnedPerfecterCommand(draft, command, context, head); draft.revision++;
      expect(draft).toEqual(expected);
      expect(snapshotPerfecterOwnedEngine(head)).toEqual(old);
      expect(() => assertOwnedPerfecterCurrent(draft, head)).toThrow();
      assertOwnedPerfecterCurrent(draft, next);
      const snapshot = snapshotPerfecterOwnedEngine(next); snapshot.frame!.budget.cash = 999999;
      expect(snapshotPerfecterOwnedEngine(next).frame!.budget.cash).not.toBe(999999);
      state = draft; head = next;
    }
    expect(state.random).toEqual(initial.random);
    expect(validatePerfecterState(state)).toBe(true);
    for (const key of PERFECTER_FROZEN_SOURCE_KEYS) expect(state[key]).toEqual(source[key]);
  }, 60_000);
  it('pays ordinary clinic fees, retains treated wounds until later rest, and posts real weekly finance', () => {
    let state = raw(initial, { type: 'CLINIC' });
    expect(state.cash).toBe(initial.cash - 60);
    expect(state.health).toBe(60);
    expect(state.injuries.find(injury => injury.severity === 'HEAVY')!.treatedRevision).toBe(state.revision);
    state = raw(state, { type: 'REST' });
    expect(state.health).toBe(68);
    expect(state.injuries).toHaveLength(2);
    expect(state.actionsRemaining).toBe(0);
    const before = state.cash;
    state = raw(state, { type: 'NEXT_WEEK' });
    expect(state.cash).toBe(before - 30);
    expect(state.actionsRemaining).toBe(3);
    expect(state.week).toBe(initial.week + 1);
    expect(state.health).toBe(68);
    state = raw(state, { type: 'WORK' });
    expect(state.cash).toBe(before - 30 + 180);
    expect(ownedPerfecterCommandBlock(state, { type: 'WORK' }, openPerfecterOwnedHead(state))).not.toBeNull();
    state = raw(state, { type: 'REST' });
    state = raw(state, { type: 'REST' });
    expect(state.health).toBe(84);
    expect(state.injuries).toEqual([]);
    expect(state.alchemist.life.creations).toEqual(source.alchemist.life.creations);
  }, 60_000);
  it('rejects forged handles, extension flags, altered current resources and event receipts', () => {
    expect(() => snapshotPerfecterOwnedEngine({} as PerfecterOwnedEngine)).toThrow();
    expect(validatePerfecterCommand({ type: 'WORK', skipValidation: true })).toBe(false);
    expect(validatePerfecterCommand({ type: 'CONSUME', compoundId: 'x', confirmed: true, roll: 1 })).toBe(false);
    const state = raw(initial, { type: 'CLINIC' });
    const tampered = structuredClone(state); tampered.perfecter.journal[0]!.notes.push('Forged outcome');
    expect(validatePerfecterState(tampered)).toBe(false);
    const cash = structuredClone(state); cash.cash++;
    expect(validatePerfecterState(cash)).toBe(false);
    const device = structuredClone(state); device.alchemist.life.creations[0]!.charge = 100;
    expect(validatePerfecterState(device)).toBe(false);
  }, 60_000);
  it('offers ordinary city return with actual time and contains no hidden state in public projections', () => {
    let state = raw(initial, { type: 'TRAVEL', to: 'backlund:sealed-vault' });
    const departure = state.perfecter.frame!.nowSecond, cash = state.cash;
    state = raw(state, { type: 'RETURN_ON_FOOT' });
    expect(state.cash).toBe(cash);
    expect(state.perfecter.frame!.nowSecond).toBe(departure + 7200);
    expect(state.perfecter.frame!.location).toBe('backlund:civic-repair-workshop');
    const publicValue = projectOwnedPerfecter(state, openPerfecterOwnedHead(state)), text = JSON.stringify(publicValue);
    expect(text).not.toMatch(/sourceDigest|historyDigest|randomReceipts|"seed"|"cursor"|原创G|原著未知/);
    expect(text).not.toContain(state.random.seed);
    expect(text).not.toContain(state.perfecter.source!.historyDigest);
    const copy = structuredClone(publicValue); copy.abilities[0]!.mastery = 999;
    expect(projectPerfecter(state).abilities[0]!.mastery).not.toBe(999);
    expect(projectPerfecter(state).sections.some(section => section.id === 'recent-action')).toBe(true);
  }, 60_000);
  it('uses the ordinary check formula for finite seventy-percent prepared chances', () => {
    expect(source.character.coreStats.will).toBe(25);
    const chance = computeCheckChance({ baseAbility: source.character.coreStats.will,
      difficulty: PERFECTER_CONSUMPTION.difficulty,
      modifiers: [{ source: 'Actual paid preparation', value: PERFECTER_PROMOTION_STABILITY.effectiveBonus }] });
    expect(chance).toBe(70);
    expect(computeCheckChance({ baseAbility: 25, difficulty: 45,
      modifiers: [{ source: 'Finite observed practice', value: PERFECTER_EPILOGUE_BONUS }] })).toBe(70);
    expect(samePerfecter({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(perfecterDigest({ a: 1, b: 2 })).toBe(perfecterDigest({ b: 2, a: 1 }));
  });
});
