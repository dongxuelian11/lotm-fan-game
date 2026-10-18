import { beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { stableStringify } from '../../src/domain/canonical.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { TIME_WORM_GUIDE, TIME_WORM_FORMULA_STATUS, TIME_WORM_CONSUMPTION_RISK,
  TIME_WORM_CURRENT_CONSUMPTION_RISK } from '../../src/domain/time-worm/content.js';
import { projectTimeWormCombat } from '../../src/domain/time-worm/combat.js';
import { projectTimeWormLifeReceipt, projectTimeWormRoundOutcome } from '../../src/domain/time-worm/public.js';
import { projectFateTrojanRoundOutcome } from '../../src/domain/fate-trojan/public.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { currentTimeWormReplayExpectation, TIME_WORM_CAPTURE_GUIDE_INDEX,
  TIME_WORM_CAPTURE_GUIDE_TEXT, TIME_WORM_CURRENT_GUIDE_TEXT } from '../helpers/time-worm-current-replay.js';

const natural = 'tests/fixtures/time-worm-v01970/natural.json';
const hash = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
const insertionHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
let raw: SliceState, current: SliceState;

// Uses only the preserved natural final/prefix. No boundary package or command
// replay is required to audit this one CURRENT expectation difference.
beforeAll(() => {
  raw = readObjectEntry<SliceState>(natural, 'final');
  current = migrateSliceState(raw);
}, 60_000);

describe('Time Worm exact CURRENT replay expectation adapter', () => {
  it('changes only the one pinned guide text while raw capture and migration stay exact', () => {
    expect(insertionHash(raw)).toBe('d3ea705e1189adffe7476998f80994a2b4a8d0fb6d04421b07d89248873e0acc');
    const source = readObjectEntry<SliceState>(natural, 'prefixFinal');
    expect(insertionHash(source)).toBe('c6f1aa074a01229bb1041e07e792c5e7839e449df8cd6a26ed6e1e569db54380');
    expect(source.chronicle.some(row => row.id === 'record-565-863')).toBe(false);
    for (const key of Object.keys(raw) as (keyof SliceState)[]) {
      if (key !== 'schemaVersion' && key !== 'contentVersion') expect(hash(current[key]), key).toBe(hash(raw[key]));
    }
    const prefix = `花1行动、500便士。${TIME_WORM_GUIDE}说明原渠道记录。${TIME_WORM_FORMULA_STATUS}`;
    expect(prefix + TIME_WORM_CONSUMPTION_RISK).toBe(TIME_WORM_CAPTURE_GUIDE_TEXT);
    expect(prefix + TIME_WORM_CURRENT_CONSUMPTION_RISK).toBe(TIME_WORM_CURRENT_GUIDE_TEXT);
    const before = hash(current), expected = currentTimeWormReplayExpectation(current);
    expect(expected.chronicle.flatMap((row, index) => hash(row) === hash(current.chronicle[index]) ? [] : [index]))
      .toEqual([TIME_WORM_CAPTURE_GUIDE_INDEX]);
    expect(expected.chronicle[TIME_WORM_CAPTURE_GUIDE_INDEX]).toEqual({
      ...current.chronicle[TIME_WORM_CAPTURE_GUIDE_INDEX], text: TIME_WORM_CURRENT_GUIDE_TEXT,
    });
    expect(hash({ ...expected, chronicle: current.chronicle })).toBe(before);
    expect(hash(currentTimeWormReplayExpectation(expected))).toBe(hash(expected));
    expect(hash(current)).toBe(before);
    expect(insertionHash(raw)).toBe('d3ea705e1189adffe7476998f80994a2b4a8d0fb6d04421b07d89248873e0acc');
    expect(() => currentTimeWormReplayExpectation(raw)).toThrow('Migrate the capture');
  });

  it('guards whole old/new texts and the exact record and lastResult mirror without hiding other changes', () => {
    const guide = current.chronicle[TIME_WORM_CAPTURE_GUIDE_INDEX]!;
    const mirrored = { ...current, lastResult: { ...guide } }, before = hash(mirrored);
    const expected = currentTimeWormReplayExpectation(mirrored);
    expect(expected.lastResult).toEqual(expected.chronicle[TIME_WORM_CAPTURE_GUIDE_INDEX]);
    expect(expected.lastResult!.text).toBe(TIME_WORM_CURRENT_GUIDE_TEXT);
    expect(hash(mirrored)).toBe(before);
    for (const text of [TIME_WORM_CAPTURE_GUIDE_TEXT + ' ', TIME_WORM_CURRENT_GUIDE_TEXT + ' ',
      TIME_WORM_CAPTURE_GUIDE_TEXT.replace('花1行动', '花0行动')]) {
      const changed = structuredClone(current);
      changed.chronicle[TIME_WORM_CAPTURE_GUIDE_INDEX]!.text = text;
      expect(() => currentTimeWormReplayExpectation(changed)).toThrow('Unexpected original Time Worm guidance');
    }
    for (const change of [{ id: 'record-565-864' }, { week: 131 }, { title: guide.title + ' ' }]) {
      const changed = structuredClone(current);
      Object.assign(changed.chronicle[TIME_WORM_CAPTURE_GUIDE_INDEX]!, change);
      expect(() => currentTimeWormReplayExpectation(changed)).toThrow('Unexpected original Time Worm guidance');
    }
    expect(() => currentTimeWormReplayExpectation({ ...mirrored, lastResult: { ...guide, text: guide.text + ' ' } }))
      .toThrow('Unexpected original Time Worm guidance');
    expect(() => currentTimeWormReplayExpectation({ ...mirrored, lastResult: { ...guide, text: TIME_WORM_CURRENT_GUIDE_TEXT } }))
      .toThrow('Time Worm guidance lastResult mirror differs');
    expect(() => currentTimeWormReplayExpectation({ ...current, chronicle: [...current.chronicle, { ...guide }] }))
      .toThrow('Unexpected duplicate Time Worm guidance');
    const unexpected = structuredClone(expected);
    unexpected.chronicle[TIME_WORM_CAPTURE_GUIDE_INDEX - 1]!.text += 'unexpected change';
    expect(hash(unexpected)).not.toBe(hash(currentTimeWormReplayExpectation(mirrored)));
  });

  it('compares public evidence through the same positive projection without altering historical evidence', () => {
    const before = hash(current), rawBefore = hash(raw), view = projectSliceState(current);
    const last = raw.lastCombatRound!.timeWormOutcome!;
    const expected = projectTimeWormRoundOutcome(last);
    expect(view.lastCombatRound!.timeWormOutcome).toEqual(expected);
    expect(projectTimeWormCombat(current).lastActionSequence)
      .toEqual([...expected.playerActions, ...expected.enemyActions].sort((a, b) => a.order - b.order));
    expect(view.timeWorm.life.ledger).toEqual(raw.timeWorm.life.journal.map(projectTimeWormLifeReceipt));
    const index = raw.combatHistory.findIndex(round => round.fateTrojanOutcome);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(view.combatHistory[index]!.fateTrojanOutcome)
      .toEqual(projectFateTrojanRoundOutcome(raw.combatHistory[index]!.fateTrojanOutcome!));
    expect(last).toHaveProperty('source'); expect(last).toHaveProperty('randomCursorAfter');
    expect(expected).not.toHaveProperty('source'); expect(expected).not.toHaveProperty('randomCursorAfter');
    for (const action of [...expected.playerActions, ...expected.enemyActions]) {
      expect(action).not.toHaveProperty('randomCursorBefore'); expect(action).not.toHaveProperty('randomCursorAfter');
    }
    expect(hash(current)).toBe(before); expect(hash(raw)).toBe(rawBefore);
  }, 60_000);
});
