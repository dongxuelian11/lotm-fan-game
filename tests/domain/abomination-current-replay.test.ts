import { beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stableStringify } from '../../src/domain/canonical.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { ABOMINATION_FORMULA_STATUS, ABOMINATION_CONSUMPTION_RISK,
  ABOMINATION_CURRENT_CONSUMPTION_RISK, abominationSourceLabel } from '../../src/domain/abomination/content.js';
import { currentAbominationReplayExpectation, ABOMINATION_CAPTURE_GUIDE_INDEX,
  ABOMINATION_CAPTURE_GUIDE_TEXT, ABOMINATION_CURRENT_GUIDE_TEXT } from '../helpers/abomination-current-replay.js';

const boundary = 'tests/fixtures/abomination-v02030/boundary-paid500-guidance-freezes-eight-roots.json';
const boundarySha256 = 'a0bff7c77c02ce82d6ef706aa98b7c7f41adcfc0571444f1b096e07c714ed3e4';
const hash = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
const fileHash = () => createHash('sha256').update(readFileSync(boundary)).digest('hex');
let raw: SliceState, current: SliceState, source: SliceState;

// One preserved guidance boundary proves the exact expectation change without
// replaying the historical campaign or rewriting any capture member.
beforeAll(() => {
  const captured = JSON.parse(readFileSync(boundary, 'utf8')) as { beforeLast: SliceState; final: SliceState };
  raw = captured.final; source = captured.beforeLast;
  current = migrateSliceState(raw);
}, 60_000);

describe('Abomination exact CURRENT replay expectation adapter', () => {
  it('changes only the two pinned guide text leaves while preserving raw source, RNG and all other state', () => {
    expect(fileHash()).toBe(boundarySha256);
    const rawHash = hash(raw), sourceHash = hash(source);
    expect(source.chronicle.some(row => row.id === 'record-644-1052')).toBe(false);
    for (const key of Object.keys(raw) as (keyof SliceState)[]) {
      if (key !== 'schemaVersion' && key !== 'contentVersion') expect(hash(current[key]), key).toBe(hash(raw[key]));
    }
    const prefix = `花1行动、500便士。${abominationSourceLabel()}说明当前渠道记录。${ABOMINATION_FORMULA_STATUS}`;
    expect(prefix + ABOMINATION_CONSUMPTION_RISK).toBe(ABOMINATION_CAPTURE_GUIDE_TEXT);
    expect(prefix + ABOMINATION_CURRENT_CONSUMPTION_RISK).toBe(ABOMINATION_CURRENT_GUIDE_TEXT);
    const before = hash(current), expected = currentAbominationReplayExpectation(current);
    expect(expected.chronicle.flatMap((row, index) => hash(row) === hash(current.chronicle[index]) ? [] : [index]))
      .toEqual([ABOMINATION_CAPTURE_GUIDE_INDEX]);
    expect(expected.chronicle[ABOMINATION_CAPTURE_GUIDE_INDEX]).toEqual({
      ...current.chronicle[ABOMINATION_CAPTURE_GUIDE_INDEX], text: ABOMINATION_CURRENT_GUIDE_TEXT,
    });
    expect(expected.lastResult).toEqual({ ...current.lastResult, text: ABOMINATION_CURRENT_GUIDE_TEXT });
    expect(expected.lastResult).toEqual(expected.chronicle[ABOMINATION_CAPTURE_GUIDE_INDEX]);
    expect(hash({ ...expected, chronicle: current.chronicle, lastResult: current.lastResult })).toBe(before);
    expect(expected.random).toEqual(current.random);
    expect(hash(currentAbominationReplayExpectation(expected))).toBe(hash(expected));
    expect(hash(current)).toBe(before); expect(hash(raw)).toBe(rawHash); expect(hash(source)).toBe(sourceHash);
    expect(fileHash()).toBe(boundarySha256);
    expect(() => currentAbominationReplayExpectation(raw)).toThrow('Migrate the capture');
  });

  it('rejects mismatched guide text or identity and never masks unrelated text changes', () => {
    const guide = current.chronicle[ABOMINATION_CAPTURE_GUIDE_INDEX]!;
    for (const text of [ABOMINATION_CAPTURE_GUIDE_TEXT + ' ', ABOMINATION_CURRENT_GUIDE_TEXT + ' ',
      ABOMINATION_CAPTURE_GUIDE_TEXT.replace('花1行动', '花0行动'), current.chronicle[0]!.text]) {
      const changed = structuredClone(current);
      changed.chronicle[ABOMINATION_CAPTURE_GUIDE_INDEX]!.text = text;
      expect(() => currentAbominationReplayExpectation(changed)).toThrow('Unexpected original Abomination guidance');
    }
    for (const change of [{ id: 'record-644-1053' }, { week: 149 }, { title: guide.title + ' ' }]) {
      const changed = structuredClone(current);
      Object.assign(changed.chronicle[ABOMINATION_CAPTURE_GUIDE_INDEX]!, change);
      expect(() => currentAbominationReplayExpectation(changed)).toThrow('Unexpected original Abomination guidance');
    }
    expect(() => currentAbominationReplayExpectation({ ...current, lastResult: { ...guide, text: guide.text + ' ' } }))
      .toThrow('Unexpected original Abomination guidance');
    expect(() => currentAbominationReplayExpectation({ ...current, lastResult: { ...guide, text: ABOMINATION_CURRENT_GUIDE_TEXT } }))
      .toThrow('Abomination guidance lastResult mirror differs');
    expect(() => currentAbominationReplayExpectation({ ...current, chronicle: [...current.chronicle, { ...guide }] }))
      .toThrow('Unexpected duplicate Abomination guidance');
    const changed = structuredClone(current);
    changed.chronicle[ABOMINATION_CAPTURE_GUIDE_INDEX - 1]!.text += 'unexpected change';
    const expected = currentAbominationReplayExpectation(changed);
    expect(expected.chronicle[ABOMINATION_CAPTURE_GUIDE_INDEX - 1]).toEqual(changed.chronicle[ABOMINATION_CAPTURE_GUIDE_INDEX - 1]);
    expect(hash(expected)).not.toBe(hash(currentAbominationReplayExpectation(current)));
  });
});
