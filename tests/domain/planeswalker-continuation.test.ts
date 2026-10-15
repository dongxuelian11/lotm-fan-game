import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceIntent } from '../../src/domain/slice/types.js';
import { actualBoundary, actualSnapshot, planeswalkerFixturePath } from './planeswalker-fixture-helper.js';
import { peacefulStart, wandererPeacefulPath, oldDoorRoots } from './planeswalker-directed-helper.js';

describe('Planeswalker actual707-command continuation retains the208-command old peaceful branch', () => {
  it('replays all499 new public commands from the unchanged old final without new RNG or state edits', () => {
    const commands = readObjectEntry<SliceIntent[]>(planeswalkerFixturePath, 'commands'), prefix = readObjectEntry<SliceIntent[]>(wandererPeacefulPath, 'commands');
    expect(prefix).toHaveLength(208); expect(commands).toHaveLength(707); expect(commands.slice(0, 208)).toEqual(prefix);
    const initial = peacefulStart(); expect(actualSnapshot('departureStart')).toEqual(initial);
    expect(readObjectEntry<{ newRandomChanges: boolean }>(planeswalkerFixturePath, 'provenance').newRandomChanges).toBe(false);
    let s = initial;
    for (const intent of commands.slice(208)) { expect(validateSlicePayload(intent)).toBe(true); s = applySliceIntent(s, intent); }
    expect(s).toEqual(actualSnapshot()); expect(oldDoorRoots(s)).toEqual(oldDoorRoots(initial)); expect(s.random.seed).toBe(initial.random.seed); assertValidSliceState(s);
  }, 90_000);
  it.each(['first-visit-paid-new-kit', 'first-actual-offworld-departure', 'first-outbound-failure', 'pw2-copper-verify', 'first-actual-paid-return',
    'nine-places-actual-qualified', 'buy-independent-bottle-and-three-original-worms', 'paid140-current-week-original-auxiliary-check',
    'actual-potion-failure', 'actual-potion-failure-2', 'promotion', 'symbolic-transit-paid-window', 'symbolic-transit-actual-offworld-body-and-parcel',
    'symbolic-transit-paid-actual-return', 'original-light-pattern-read', 'pattern-reproduction-actual-ordinary-fallback', 'withdrawn-transit-current-permission',
    'three-practices-reflection', 'original-enemy-approach', 'original-enemy-fight', 'combat-first', 'combat-terminal'])('replays actual%s boundary without changing its input', name => {
      const b = actualBoundary(name), before = structuredClone(b.beforeLast), intent = structuredClone(b.lastIntent);
      expect(applySliceIntent(b.beforeLast, b.lastIntent)).toEqual(b.final); expect(b.beforeLast).toEqual(before); expect(b.lastIntent).toEqual(intent); assertValidSliceState(b.final);
    });
  it('preserves35 original visits including17 paid failures, three consumed independent auxiliary kits and actual8/0 mastery', () => {
    const s = actualSnapshot(), r = s.planeswalker.ritual;
    expect(r.visits).toHaveLength(35); expect(r.visits.filter(v => v.result === 'OUTBOUND_FAILURE')).toHaveLength(17);
    expect(r.visits.filter(v => v.result === 'HELPED')).toHaveLength(9); expect(r.visits.filter(v => v.result === 'VERIFIED')).toHaveLength(9);
    expect(r.offworldLegs).toBe(36); expect(r.visits.reduce((n, v) => n + v.paid.pennies, 0)).toBe(1050);
    expect(s.planeswalker.bottles.map(b => b.outcome)).toEqual(['FAILURE', 'GREAT_FAILURE', 'SUCCESS']);
    expect(s.planeswalker.bottles.every(b => b.auxiliaryKit.items.every(i => i.status === 'CONSUMED'))).toBe(true);
    expect([s.progression.mastery['door.s2.symbolic-transit'], s.progression.mastery['door.s2.pattern-reproduction']]).toEqual([8, 0]);
    expect(s.wanderer.life).toMatchObject({ suit: { protectionSeconds: 90 }, energy: { remaining: 1, spent: 1 }, packet: { location: 'REMOTE' } }); assertValidSliceState(s);
  });
  it('retains the actual fourth-round lethal98 on the common65/30/5 wheel without replacing the earlier outcome', () => {
    const s = actualSnapshot(), rounds = s.combatHistory.filter(r => r.planeswalkerOutcome), last = rounds.at(-1)!;
    expect(rounds).toHaveLength(4); expect(last.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 }); expect(last.consequenceRoll).toBe(98);
    expect(s).toMatchObject({ status: 'DEAD', health: 0, combat: null, ending: { kind: 'DEATH' } });
    expect(s.planeswalker.encounter.terminal?.outcome).toBe('PLAYER_DEAD'); assertValidSliceState(s);
  });
});
