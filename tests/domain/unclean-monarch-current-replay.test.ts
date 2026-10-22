import { beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { UNCLEAN_MONARCH_FORMULA_STATUS, UNCLEAN_MONARCH_CONSUMPTION_RISK,
  UNCLEAN_MONARCH_CURRENT_CONSUMPTION_RISK, uncleanMonarchSourceLabel } from '../../src/domain/unclean-monarch/content.js';
import { currentUncleanMonarchReplayExpectation, UNCLEAN_MONARCH_CAPTURE_GUIDE_INDEX,
  UNCLEAN_MONARCH_CAPTURE_GUIDE_TEXT, UNCLEAN_MONARCH_CURRENT_GUIDE_TEXT } from '../helpers/unclean-monarch-current-replay.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const boundary = 'tests/fixtures/unclean-monarch-v02020/boundary-paid500-guidance-freezes-eight-roots.json';
const boundarySha256 = '544dbf00ab7935e1c0bf001d103795cc7c7adf54e8d6497f724fac79d68d18a8';
const hash = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
const fileHash = () => createHash('sha256').update(readFileSync(boundary)).digest('hex');
let raw: SliceState, current: SliceState, source: SliceState, intent: SliceIntent;

// One preserved guidance boundary proves the exact expectation change without
// replaying the historical campaign or rewriting any capture member.
beforeAll(() => {
  const captured = JSON.parse(readFileSync(boundary, 'utf8')) as { beforeLast: SliceState; final: SliceState; lastIntent: SliceIntent };
  raw = captured.final; source = captured.beforeLast; intent = captured.lastIntent;
  current = migrateSliceState(raw);
}, 60_000);

describe('Unclean Monarch exact CURRENT replay expectation adapter', () => {
  it('changes only the two pinned guide text leaves while preserving raw source, RNG and all other state', () => {
    expect(fileHash()).toBe(boundarySha256);
    const rawHash = hash(raw), sourceHash = hash(source);
    expect(source.chronicle.some(row => row.id === 'record-720-1135')).toBe(false);
    for (const key of Object.keys(raw) as (keyof SliceState)[]) {
      if (key !== 'schemaVersion' && key !== 'contentVersion') expect(hash(current[key]), key).toBe(hash(raw[key]));
    }
    const prefix = `花1行动、500便士。${uncleanMonarchSourceLabel()}说明当前渠道记录。${UNCLEAN_MONARCH_FORMULA_STATUS}`;
    expect(prefix + UNCLEAN_MONARCH_CONSUMPTION_RISK).toBe(UNCLEAN_MONARCH_CAPTURE_GUIDE_TEXT);
    expect(prefix + UNCLEAN_MONARCH_CURRENT_CONSUMPTION_RISK).toBe(UNCLEAN_MONARCH_CURRENT_GUIDE_TEXT);
    const before = hash(current), expected = currentUncleanMonarchReplayExpectation(current);
    expect(expected.chronicle.flatMap((row, index) => hash(row) === hash(current.chronicle[index]) ? [] : [index]))
      .toEqual([UNCLEAN_MONARCH_CAPTURE_GUIDE_INDEX]);
    expect(expected.chronicle[UNCLEAN_MONARCH_CAPTURE_GUIDE_INDEX]).toEqual({
      ...current.chronicle[UNCLEAN_MONARCH_CAPTURE_GUIDE_INDEX], text: UNCLEAN_MONARCH_CURRENT_GUIDE_TEXT,
    });
    expect(expected.lastResult).toEqual({ ...current.lastResult, text: UNCLEAN_MONARCH_CURRENT_GUIDE_TEXT });
    expect(expected.lastResult).toEqual(expected.chronicle[UNCLEAN_MONARCH_CAPTURE_GUIDE_INDEX]);
    expect(hash({ ...expected, chronicle: current.chronicle, lastResult: current.lastResult })).toBe(before);
    expect(expected.random).toEqual(current.random);
    expect(hash(currentUncleanMonarchReplayExpectation(expected))).toBe(hash(expected));
    expect(hash(current)).toBe(before); expect(hash(raw)).toBe(rawHash); expect(hash(source)).toBe(sourceHash);
    expect(fileHash()).toBe(boundarySha256);
    expect(() => currentUncleanMonarchReplayExpectation(raw)).toThrow('Migrate the capture');
  });

  it('rejects mismatched guide text or identity and never masks unrelated text changes', () => {
    const guide = current.chronicle[UNCLEAN_MONARCH_CAPTURE_GUIDE_INDEX]!;
    for (const text of [UNCLEAN_MONARCH_CAPTURE_GUIDE_TEXT + ' ', UNCLEAN_MONARCH_CURRENT_GUIDE_TEXT + ' ',
      UNCLEAN_MONARCH_CAPTURE_GUIDE_TEXT.replace('花1行动', '花0行动'), current.chronicle[0]!.text]) {
      const changed = structuredClone(current);
      changed.chronicle[UNCLEAN_MONARCH_CAPTURE_GUIDE_INDEX]!.text = text;
      expect(() => currentUncleanMonarchReplayExpectation(changed)).toThrow('Unexpected original Unclean Monarch guidance');
    }
    for (const change of [{ id: 'record-720-1136' }, { week: 182 }, { title: guide.title + ' ' }]) {
      const changed = structuredClone(current);
      Object.assign(changed.chronicle[UNCLEAN_MONARCH_CAPTURE_GUIDE_INDEX]!, change);
      expect(() => currentUncleanMonarchReplayExpectation(changed)).toThrow('Unexpected original Unclean Monarch guidance');
    }
    expect(() => currentUncleanMonarchReplayExpectation({ ...current, lastResult: { ...guide, text: guide.text + ' ' } }))
      .toThrow('Unexpected original Unclean Monarch guidance');
    expect(() => currentUncleanMonarchReplayExpectation({ ...current, lastResult: { ...guide, text: UNCLEAN_MONARCH_CURRENT_GUIDE_TEXT } }))
      .toThrow('Unclean Monarch guidance lastResult mirror differs');
    expect(() => currentUncleanMonarchReplayExpectation({ ...current, chronicle: [...current.chronicle, { ...guide }] }))
      .toThrow('Unexpected duplicate Unclean Monarch guidance');
    const changed = structuredClone(current);
    changed.chronicle[UNCLEAN_MONARCH_CAPTURE_GUIDE_INDEX - 1]!.text += 'unexpected change';
    const expected = currentUncleanMonarchReplayExpectation(changed);
    expect(expected.chronicle[UNCLEAN_MONARCH_CAPTURE_GUIDE_INDEX - 1]).toEqual(changed.chronicle[UNCLEAN_MONARCH_CAPTURE_GUIDE_INDEX - 1]);
    expect(hash(expected)).not.toBe(hash(currentUncleanMonarchReplayExpectation(current)));
  });

  it('replays the actual paid guidance command with every private and RNG field exact', () => {
    const before = migrateSliceState(source), beforeHash = hash(before), rawHash = hash(raw);
    expect(intent).toEqual({ type: 'UNCLEAN_MONARCH', command: { type: 'LEARN_GUIDANCE' } });
    const replayed = applySliceIntent(before, intent), expected = currentUncleanMonarchReplayExpectation(current);
    expect(hash(replayed)).toBe(hash(expected));
    expect(replayed.random).toEqual(before.random);
    expect(hash(before)).toBe(beforeHash); expect(hash(raw)).toBe(rawHash); expect(fileHash()).toBe(boundarySha256);
  }, 60_000);

  it('preserves the propagated guide and unrelated lastResult at the actual final capture', () => {
    const final = migrateSliceState(readObjectEntry('tests/fixtures/unclean-monarch-v02020/natural.json', 'final'));
    const before = hash(final), expected = currentUncleanMonarchReplayExpectation(final);
    expect(final.lastResult!.id).not.toBe(final.chronicle[UNCLEAN_MONARCH_CAPTURE_GUIDE_INDEX]!.id);
    expect(hash({ ...expected, chronicle: final.chronicle })).toBe(before);
    expect(expected.lastResult).toEqual(final.lastResult);
    expect(expected.chronicle[UNCLEAN_MONARCH_CAPTURE_GUIDE_INDEX]!.text).toBe(UNCLEAN_MONARCH_CURRENT_GUIDE_TEXT);
    expect(hash(final)).toBe(before);
  }, 60_000);
});
