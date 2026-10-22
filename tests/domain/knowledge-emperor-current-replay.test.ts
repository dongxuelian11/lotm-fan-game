import { beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { KNOWLEDGE_EMPEROR_FORMULA_STATUS, KNOWLEDGE_EMPEROR_CONSUMPTION_RISK,
  KNOWLEDGE_EMPEROR_CURRENT_CONSUMPTION_RISK, knowledgeEmperorSourceLabel } from '../../src/domain/knowledge-emperor/content.js';
import { currentKnowledgeEmperorReplayExpectation, KNOWLEDGE_EMPEROR_CAPTURE_GUIDE_INDEX,
  KNOWLEDGE_EMPEROR_CAPTURE_GUIDE_TEXT, KNOWLEDGE_EMPEROR_CURRENT_GUIDE_TEXT } from '../helpers/knowledge-emperor-current-replay.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const boundary = 'tests/fixtures/knowledge-emperor-v02000/boundary-paid500-guidance-freezes-eight-roots.json';
const boundarySha256 = '81eff9989d88e63491bb6ee30aa5bf1bbd10c4a96eb106376fd34b8b38ca305a';
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

describe('Knowledge Emperor exact CURRENT replay expectation adapter', () => {
  it('changes only the pinned guide text leaf while preserving raw source, RNG and all other state', () => {
    expect(fileHash()).toBe(boundarySha256);
    const rawHash = hash(raw), sourceHash = hash(source);
    expect(source.chronicle.some(row => row.id === 'record-665-1019')).toBe(false);
    for (const key of Object.keys(raw) as (keyof SliceState)[]) {
      if (key !== 'schemaVersion' && key !== 'contentVersion') expect(hash(current[key]), key).toBe(hash(raw[key]));
    }
    const prefix = `花1行动、500便士。${knowledgeEmperorSourceLabel()}说明当前渠道记录。${KNOWLEDGE_EMPEROR_FORMULA_STATUS}`;
    expect(prefix + KNOWLEDGE_EMPEROR_CONSUMPTION_RISK).toBe(KNOWLEDGE_EMPEROR_CAPTURE_GUIDE_TEXT);
    expect(prefix + KNOWLEDGE_EMPEROR_CURRENT_CONSUMPTION_RISK).toBe(KNOWLEDGE_EMPEROR_CURRENT_GUIDE_TEXT);
    const before = hash(current), expected = currentKnowledgeEmperorReplayExpectation(current);
    expect(expected.chronicle.flatMap((row, index) => hash(row) === hash(current.chronicle[index]) ? [] : [index]))
      .toEqual([KNOWLEDGE_EMPEROR_CAPTURE_GUIDE_INDEX]);
    expect(expected.chronicle[KNOWLEDGE_EMPEROR_CAPTURE_GUIDE_INDEX]).toEqual({
      ...current.chronicle[KNOWLEDGE_EMPEROR_CAPTURE_GUIDE_INDEX], text: KNOWLEDGE_EMPEROR_CURRENT_GUIDE_TEXT,
    });
    // Guidance uses the final weekly action, so the weekly result is lastResult.
    expect(current.lastResult!.id).toBe('record-665-1021');
    expect(expected.lastResult).toEqual(current.lastResult);
    expect(hash({ ...expected, chronicle: current.chronicle })).toBe(before);
    const mirrored = { ...current, lastResult: { ...current.chronicle[KNOWLEDGE_EMPEROR_CAPTURE_GUIDE_INDEX]! } };
    expect(currentKnowledgeEmperorReplayExpectation(mirrored).lastResult).toEqual(expected.chronicle[KNOWLEDGE_EMPEROR_CAPTURE_GUIDE_INDEX]);
    expect(mirrored.lastResult.text).toBe(KNOWLEDGE_EMPEROR_CAPTURE_GUIDE_TEXT);
    expect(expected.random).toEqual(current.random);
    expect(hash(currentKnowledgeEmperorReplayExpectation(expected))).toBe(hash(expected));
    expect(hash(current)).toBe(before); expect(hash(raw)).toBe(rawHash); expect(hash(source)).toBe(sourceHash);
    expect(fileHash()).toBe(boundarySha256);
    expect(() => currentKnowledgeEmperorReplayExpectation(raw)).toThrow('Migrate the capture');
  });

  it('rejects mismatched guide text or identity and never masks unrelated text changes', () => {
    const guide = current.chronicle[KNOWLEDGE_EMPEROR_CAPTURE_GUIDE_INDEX]!;
    for (const text of [KNOWLEDGE_EMPEROR_CAPTURE_GUIDE_TEXT + ' ', KNOWLEDGE_EMPEROR_CURRENT_GUIDE_TEXT + ' ',
      KNOWLEDGE_EMPEROR_CAPTURE_GUIDE_TEXT.replace('花1行动', '花0行动'), current.chronicle[0]!.text]) {
      const changed = structuredClone(current);
      changed.chronicle[KNOWLEDGE_EMPEROR_CAPTURE_GUIDE_INDEX]!.text = text;
      expect(() => currentKnowledgeEmperorReplayExpectation(changed)).toThrow('Unexpected original Knowledge Emperor guidance');
    }
    for (const change of [{ id: 'record-665-1020' }, { week: 156 }, { title: guide.title + ' ' }]) {
      const changed = structuredClone(current);
      Object.assign(changed.chronicle[KNOWLEDGE_EMPEROR_CAPTURE_GUIDE_INDEX]!, change);
      expect(() => currentKnowledgeEmperorReplayExpectation(changed)).toThrow('Unexpected original Knowledge Emperor guidance');
    }
    expect(() => currentKnowledgeEmperorReplayExpectation({ ...current, lastResult: { ...guide, text: guide.text + ' ' } }))
      .toThrow('Unexpected original Knowledge Emperor guidance');
    expect(() => currentKnowledgeEmperorReplayExpectation({ ...current, lastResult: { ...guide, text: KNOWLEDGE_EMPEROR_CURRENT_GUIDE_TEXT } }))
      .toThrow('Knowledge Emperor guidance lastResult mirror differs');
    expect(() => currentKnowledgeEmperorReplayExpectation({ ...current, chronicle: [...current.chronicle, { ...guide }] }))
      .toThrow('Unexpected duplicate Knowledge Emperor guidance');
    const changed = structuredClone(current);
    changed.chronicle[KNOWLEDGE_EMPEROR_CAPTURE_GUIDE_INDEX - 1]!.text += 'unexpected change';
    const expected = currentKnowledgeEmperorReplayExpectation(changed);
    expect(expected.chronicle[KNOWLEDGE_EMPEROR_CAPTURE_GUIDE_INDEX - 1]).toEqual(changed.chronicle[KNOWLEDGE_EMPEROR_CAPTURE_GUIDE_INDEX - 1]);
    expect(hash(expected)).not.toBe(hash(currentKnowledgeEmperorReplayExpectation(current)));
  });

  it('replays the actual paid guidance command with every private and RNG field exact', () => {
    const before = migrateSliceState(source), beforeHash = hash(before), rawHash = hash(raw);
    expect(intent).toEqual({ type: 'KNOWLEDGE_EMPEROR', command: { type: 'LEARN_GUIDANCE' } });
    const replayed = applySliceIntent(before, intent), expected = currentKnowledgeEmperorReplayExpectation(current);
    expect(hash(replayed)).toBe(hash(expected));
    // The same action also settles the week; preserve its captured RNG exactly.
    expect(replayed.random).toEqual(current.random);
    expect(hash(before)).toBe(beforeHash); expect(hash(raw)).toBe(rawHash); expect(fileHash()).toBe(boundarySha256);
  }, 60_000);

  it('preserves the propagated guide and unrelated lastResult at the actual final capture', () => {
    const final = migrateSliceState(readObjectEntry('tests/fixtures/knowledge-emperor-v02000/natural.json', 'final'));
    const before = hash(final), expected = currentKnowledgeEmperorReplayExpectation(final);
    expect(final.lastResult!.id).not.toBe(final.chronicle[KNOWLEDGE_EMPEROR_CAPTURE_GUIDE_INDEX]!.id);
    expect(hash({ ...expected, chronicle: final.chronicle })).toBe(before);
    expect(expected.lastResult).toEqual(final.lastResult);
    expect(expected.chronicle[KNOWLEDGE_EMPEROR_CAPTURE_GUIDE_INDEX]!.text).toBe(KNOWLEDGE_EMPEROR_CURRENT_GUIDE_TEXT);
    expect(hash(final)).toBe(before);
  }, 60_000);
});
