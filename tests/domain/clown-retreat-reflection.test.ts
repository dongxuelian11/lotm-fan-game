import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyClownAdventure, clownAdventureActions, validateClownAdventure } from '../../src/domain/clown/adventure.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

const id = 'retreat-reflection', source = `clown-practice:${id}`;
const command = { type: 'PRACTICE', practiceId: id } as const;
const lessons = ['quiet-support', 'unexpected-stage', 'balance-rehearsal', 'paper-target', 'composed-apology'];
// Synthetic domain boundary fixture, not a captured natural playthrough or a full promoted save.
function fixture() {
  const s = createSliceRun('synthetic-retreat-reflection', sliceDefaultCreationSelection, 'reflection-boundary');
  s.activeEvent = null; s.eventQueue = []; s.week = 20; s.actionsRemaining = 3;
  s.world.city = 'BACKLUND';
  s.progression = { ...s.progression, pathwayId: 'diviner', sequence: 8, acting: 80 };
  s.clown.practices = [...lessons];
  s.seer.completedSources = lessons.map(x => `clown-practice:${x}`);
  s.clown.rescue.status = 'RETREATED';
  return s;
}
function context(roll = 1) {
  const c: SeerContext = {
    roll: vi.fn(() => { throw new Error('Reflection must not draw a mastery recipient'); }),
    check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 15, difficulty, modifiers: [], roll })),
    note: vi.fn(),
  };
  return c;
}
const action = (s: SliceState) => clownAdventureActions(s).find(x => x.id === id);

describe('finite S8 retreat reflection (synthetic boundary states)', () => {
  it('uses the existing public PRACTICE payload without a schema extension', () => {
    expect(validateSlicePayload({ type: 'CLOWN', command })).toBe(true);
    expect(validateSlicePayload({ type: 'CLOWN', command: { ...command, award: 100 } })).toBe(false);
  });
  it('spends one action for will 12, grants growth once, and preserves every other saved fact', () => {
    const s = fixture(), before = structuredClone(s), c = context(), award = vi.fn();
    expect(action(s)?.enabled).toBe(true);
    applyClownAdventure(s, command, c, award);
    const expected = structuredClone(before);
    expected.actionsRemaining--;
    expected.progression.acting = 100;
    expected.clown.trainingAttempts[id] = s.week;
    expected.clown.practices.push(id);
    expected.seer.completedSources.push(source);
    expect(s).toEqual(expected);
    expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 12);
    expect(award).not.toHaveBeenCalled(); expect(c.roll).not.toHaveBeenCalled();
    expect(validateClownAdventure(s)).toBe(true); expect(action(s)).toBeUndefined();
    expect(() => applyClownAdventure(s, command, c, award)).toThrow();
    expect(s).toEqual(expected);
  });
  it('failure spends AP, locks this week, allows next-week retry without erasing withdrawal', () => {
    const s = fixture(), c = context(100), award = vi.fn();
    applyClownAdventure(s, command, c, award);
    expect(s.actionsRemaining).toBe(2); expect(s.progression.acting).toBe(80);
    expect(s.clown.practices).not.toContain(id); expect(s.seer.completedSources).not.toContain(source);
    expect(action(s)).toMatchObject({ enabled: false, reason: '本周已经尝试过，下周再练。' });
    const before = structuredClone(s);
    expect(() => applyClownAdventure(s, command, c, award)).toThrow(); expect(s).toEqual(before);
    expect(validateClownAdventure(s)).toBe(true);
    s.week++; expect(action(s)?.enabled).toBe(true);
    applyClownAdventure(s, command, context(), award);
    expect(s.progression.acting).toBe(100); expect(s.actionsRemaining).toBe(1);
    expect(s.clown.rescue).toEqual(before.clown.rescue); expect(award).not.toHaveBeenCalled();
  });
  it('caps growth at 100 even if the one-time old study supplied eight points', () => {
    const s = fixture(); s.progression.acting = 88;
    applyClownAdventure(s, command, context(), vi.fn()); expect(s.progression.acting).toBe(100);
  });
  it.each(['AVAILABLE', 'FIGHTING', 'RESCUED', 'LOST'] as const)('cannot replace a %s escort outcome', status => {
    const s = fixture(); s.clown.rescue.status = status;
    expect(action(s)).toBeUndefined(); const before = structuredClone(s);
    expect(() => applyClownAdventure(s, command, context(), vi.fn())).toThrow(); expect(s).toEqual(before);
  });
  it.each([
    ['dead', (s: SliceState) => { s.status = 'DEAD'; }],
    ['S7', (s: SliceState) => { s.progression.sequence = 7; }],
    ['other pathway', (s: SliceState) => { s.progression.pathwayId = 'reader'; }],
    ['incomplete practice', (s: SliceState) => { s.clown.practices.pop(); }],
    ['full acting', (s: SliceState) => { s.progression.acting = 100; }],
    ['no AP', (s: SliceState) => { s.actionsRemaining = 0; }],
  ] as const)('rejects %s without costs', (_, modify) => {
    const s = fixture(); modify(s); const before = structuredClone(s);
    expect(action(s)?.enabled ?? false).toBe(false);
    expect(() => applyClownAdventure(s, command, context(), vi.fn())).toThrow(); expect(s).toEqual(before);
  });
  it('accepts retained completion at S7 and rejects mismatched source/practice/attempt records', () => {
    const s = fixture(); applyClownAdventure(s, command, context(), vi.fn());
    s.progression.sequence = 7; s.progression.acting = 0;
    expect(validateClownAdventure(s)).toBe(true);
    for (const corrupt of [
      (x: SliceState) => { x.seer.completedSources = x.seer.completedSources.filter(v => v !== source); },
      (x: SliceState) => { x.clown.practices = x.clown.practices.filter(v => v !== id); },
      (x: SliceState) => { delete x.clown.trainingAttempts[id]; },
      (x: SliceState) => { x.clown.practices = x.clown.practices.filter(v => v !== lessons[0]); },
      (x: SliceState) => { x.clown.rescue.status = 'RESCUED'; },
      (x: SliceState) => { x.clown.trainingAttempts[id] = x.week + 1; },
    ]) { const invalid = structuredClone(s); corrupt(invalid); expect(validateClownAdventure(invalid)).toBe(false); }
  });
});
