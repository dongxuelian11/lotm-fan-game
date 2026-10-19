import { beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stableStringify } from '../../src/domain/canonical.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DIVINE_HAND_GUIDE, DIVINE_HAND_FORMULA_STATUS, DIVINE_HAND_CONSUMPTION_RISK,
  DIVINE_HAND_CURRENT_CONSUMPTION_RISK } from '../../src/domain/divine-hand/content.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { currentDivineHandReplayExpectation, DIVINE_HAND_CAPTURE_GUIDE_INDEX,
  DIVINE_HAND_CAPTURE_GUIDE_TEXT, DIVINE_HAND_CURRENT_GUIDE_TEXT } from '../helpers/divine-hand-current-replay.js';

const natural = 'tests/fixtures/divine-hand-v01980/natural.json';
const hash = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
const insertionHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
let raw: SliceState, current: SliceState;

// Uses only the preserved peaceful287 snapshot and original158 prefix. No boundary package or command
// replay is required to audit this one CURRENT expectation difference.
beforeAll(() => {
  raw = JSON.parse(readFileSync('tests/fixtures/divine-hand-v01980/snapshot-recoveredBeforeEncounter.json', 'utf8')) as SliceState;
  current = migrateSliceState(raw);
}, 60_000);

describe('Divine Hand exact CURRENT replay expectation adapter', () => {
  it('changes only the one pinned guide text while raw capture and migration stay exact', () => {
    expect(insertionHash(raw)).toBe('eb9bc7d243a5ffd4704a0d8047c66cf27acbe69dcc447c6075e6b738d057828d');
    const source = readObjectEntry<SliceState>(natural, 'prefixFinal');
    expect(insertionHash(source)).toBe('1908adb35d936bd5651ef7cd1ca9cbeffc55e3b3568ee21ff5798741ab3a2332');
    expect(source.chronicle.some(row => row.id === 'record-604-937')).toBe(false);
    for (const key of Object.keys(raw) as (keyof SliceState)[]) {
      if (key !== 'schemaVersion' && key !== 'contentVersion') expect(hash(current[key]), key).toBe(hash(raw[key]));
    }
    const prefix = `花1行动、500便士。${DIVINE_HAND_GUIDE}说明原渠道记录。${DIVINE_HAND_FORMULA_STATUS}`;
    expect(prefix + DIVINE_HAND_CONSUMPTION_RISK).toBe(DIVINE_HAND_CAPTURE_GUIDE_TEXT);
    expect(prefix + DIVINE_HAND_CURRENT_CONSUMPTION_RISK).toBe(DIVINE_HAND_CURRENT_GUIDE_TEXT);
    const before = hash(current), expected = currentDivineHandReplayExpectation(current);
    expect(expected.chronicle.flatMap((row, index) => hash(row) === hash(current.chronicle[index]) ? [] : [index]))
      .toEqual([DIVINE_HAND_CAPTURE_GUIDE_INDEX]);
    expect(expected.chronicle[DIVINE_HAND_CAPTURE_GUIDE_INDEX]).toEqual({
      ...current.chronicle[DIVINE_HAND_CAPTURE_GUIDE_INDEX], text: DIVINE_HAND_CURRENT_GUIDE_TEXT,
    });
    expect(hash({ ...expected, chronicle: current.chronicle })).toBe(before);
    expect(hash(currentDivineHandReplayExpectation(expected))).toBe(hash(expected));
    expect(hash(current)).toBe(before);
    expect(insertionHash(raw)).toBe('eb9bc7d243a5ffd4704a0d8047c66cf27acbe69dcc447c6075e6b738d057828d');
    expect(() => currentDivineHandReplayExpectation(raw)).toThrow('Migrate the capture');
  });

  it('guards whole old/new texts and the exact record and lastResult mirror without hiding other changes', () => {
    const guide = current.chronicle[DIVINE_HAND_CAPTURE_GUIDE_INDEX]!;
    const mirrored = { ...current, lastResult: { ...guide } }, before = hash(mirrored);
    const expected = currentDivineHandReplayExpectation(mirrored);
    expect(expected.lastResult).toEqual(expected.chronicle[DIVINE_HAND_CAPTURE_GUIDE_INDEX]);
    expect(expected.lastResult!.text).toBe(DIVINE_HAND_CURRENT_GUIDE_TEXT);
    expect(hash(mirrored)).toBe(before);
    for (const text of [DIVINE_HAND_CAPTURE_GUIDE_TEXT + ' ', DIVINE_HAND_CURRENT_GUIDE_TEXT + ' ',
      DIVINE_HAND_CAPTURE_GUIDE_TEXT.replace('花1行动', '花0行动')]) {
      const changed = structuredClone(current);
      changed.chronicle[DIVINE_HAND_CAPTURE_GUIDE_INDEX]!.text = text;
      expect(() => currentDivineHandReplayExpectation(changed)).toThrow('Unexpected original Divine Hand guidance');
    }
    for (const change of [{ id: 'record-604-938' }, { week: 148 }, { title: guide.title + ' ' }]) {
      const changed = structuredClone(current);
      Object.assign(changed.chronicle[DIVINE_HAND_CAPTURE_GUIDE_INDEX]!, change);
      expect(() => currentDivineHandReplayExpectation(changed)).toThrow('Unexpected original Divine Hand guidance');
    }
    expect(() => currentDivineHandReplayExpectation({ ...mirrored, lastResult: { ...guide, text: guide.text + ' ' } }))
      .toThrow('Unexpected original Divine Hand guidance');
    expect(() => currentDivineHandReplayExpectation({ ...mirrored, lastResult: { ...guide, text: DIVINE_HAND_CURRENT_GUIDE_TEXT } }))
      .toThrow('Divine Hand guidance lastResult mirror differs');
    expect(() => currentDivineHandReplayExpectation({ ...current, chronicle: [...current.chronicle, { ...guide }] }))
      .toThrow('Unexpected duplicate Divine Hand guidance');
    const unexpected = structuredClone(expected);
    unexpected.chronicle[DIVINE_HAND_CAPTURE_GUIDE_INDEX - 1]!.text += 'unexpected change';
    expect(hash(unexpected)).not.toBe(hash(currentDivineHandReplayExpectation(mirrored)));
  });

});
