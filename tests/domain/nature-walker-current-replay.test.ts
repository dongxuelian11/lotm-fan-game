import { beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { NATURE_WALKER_FORMULA_STATUS, NATURE_WALKER_CONSUMPTION_RISK,
  NATURE_WALKER_CURRENT_CONSUMPTION_RISK, natureWalkerSourceLabel } from '../../src/domain/nature-walker/content.js';
import { currentNatureWalkerReplayExpectation, NATURE_WALKER_CAPTURE_GUIDE_INDEX,
  NATURE_WALKER_CAPTURE_GUIDE_TEXT, NATURE_WALKER_CURRENT_GUIDE_TEXT, currentNatureWalkerPublicReplayExpectation,
  NATURE_WALKER_CAPTURE_PUBLIC_RISK, NATURE_WALKER_CURRENT_PUBLIC_RISK } from '../helpers/nature-walker-current-replay.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const boundary = 'tests/fixtures/nature-walker-v02070/boundary-paid500-guidance-freezes-eight-roots-and-original-pad50-guard.json';
const boundarySha256 = 'ad0a05ca6026554a8e8c67948f1da3c43ab0a65f9ee90f649a3046e373760313';
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

describe('Nature Walker exact CURRENT replay expectation adapter', () => {
  it('changes only the two pinned guide text leaves while preserving raw source, RNG and all other state', () => {
    expect(fileHash()).toBe(boundarySha256);
    const rawHash = hash(raw), sourceHash = hash(source);
    expect(source.chronicle.some(row => row.id === 'record-853-1323')).toBe(false);
    for (const key of Object.keys(raw) as (keyof SliceState)[]) {
      if (key !== 'schemaVersion' && key !== 'contentVersion') expect(hash(current[key]), key).toBe(hash(raw[key]));
    }
    const prefix = `花1行动、500便士。${natureWalkerSourceLabel()}说明当前渠道记录。${NATURE_WALKER_FORMULA_STATUS}`;
    expect(prefix + NATURE_WALKER_CONSUMPTION_RISK).toBe(NATURE_WALKER_CAPTURE_GUIDE_TEXT);
    expect(prefix + NATURE_WALKER_CURRENT_CONSUMPTION_RISK).toBe(NATURE_WALKER_CURRENT_GUIDE_TEXT);
    const before = hash(current), expected = currentNatureWalkerReplayExpectation(current);
    expect(expected.chronicle.flatMap((row, index) => hash(row) === hash(current.chronicle[index]) ? [] : [index]))
      .toEqual([NATURE_WALKER_CAPTURE_GUIDE_INDEX]);
    expect(expected.chronicle[NATURE_WALKER_CAPTURE_GUIDE_INDEX]).toEqual({
      ...current.chronicle[NATURE_WALKER_CAPTURE_GUIDE_INDEX], text: NATURE_WALKER_CURRENT_GUIDE_TEXT,
    });
    expect(expected.lastResult).toEqual({ ...current.lastResult, text: NATURE_WALKER_CURRENT_GUIDE_TEXT });
    expect(expected.lastResult).toEqual(expected.chronicle[NATURE_WALKER_CAPTURE_GUIDE_INDEX]);
    expect(hash({ ...expected, chronicle: current.chronicle, lastResult: current.lastResult })).toBe(before);
    expect(expected.random).toEqual(current.random);
    expect(hash(currentNatureWalkerReplayExpectation(expected))).toBe(hash(expected));
    expect(hash(current)).toBe(before); expect(hash(raw)).toBe(rawHash); expect(hash(source)).toBe(sourceHash);
    expect(fileHash()).toBe(boundarySha256);
    expect(() => currentNatureWalkerReplayExpectation(raw)).toThrow('Migrate the capture');
  });

  it('rejects mismatched guide text or identity and never masks unrelated text changes', () => {
    const guide = current.chronicle[NATURE_WALKER_CAPTURE_GUIDE_INDEX]!;
    for (const text of [NATURE_WALKER_CAPTURE_GUIDE_TEXT + ' ', NATURE_WALKER_CURRENT_GUIDE_TEXT + ' ',
      NATURE_WALKER_CAPTURE_GUIDE_TEXT.replace('花1行动', '花0行动'), current.chronicle[0]!.text]) {
      const changed = structuredClone(current);
      changed.chronicle[NATURE_WALKER_CAPTURE_GUIDE_INDEX]!.text = text;
      expect(() => currentNatureWalkerReplayExpectation(changed)).toThrow('Unexpected original Nature Walker guidance');
    }
    for (const change of [{ id: 'record-853-1324' }, { week: 213 }, { title: guide.title + ' ' }]) {
      const changed = structuredClone(current);
      Object.assign(changed.chronicle[NATURE_WALKER_CAPTURE_GUIDE_INDEX]!, change);
      expect(() => currentNatureWalkerReplayExpectation(changed)).toThrow('Unexpected original Nature Walker guidance');
    }
    expect(() => currentNatureWalkerReplayExpectation({ ...current, lastResult: { ...guide, text: guide.text + ' ' } }))
      .toThrow('Unexpected original Nature Walker guidance');
    expect(() => currentNatureWalkerReplayExpectation({ ...current, lastResult: { ...guide, text: NATURE_WALKER_CURRENT_GUIDE_TEXT } }))
      .toThrow('Nature Walker guidance lastResult mirror differs');
    expect(() => currentNatureWalkerReplayExpectation({ ...current, chronicle: [...current.chronicle, { ...guide }] }))
      .toThrow('Unexpected duplicate Nature Walker guidance');
    const changed = structuredClone(current);
    changed.chronicle[NATURE_WALKER_CAPTURE_GUIDE_INDEX - 1]!.text += 'unexpected change';
    const expected = currentNatureWalkerReplayExpectation(changed);
    expect(expected.chronicle[NATURE_WALKER_CAPTURE_GUIDE_INDEX - 1]).toEqual(changed.chronicle[NATURE_WALKER_CAPTURE_GUIDE_INDEX - 1]);
    expect(hash(expected)).not.toBe(hash(currentNatureWalkerReplayExpectation(current)));
  });

  it('replays the actual paid guidance command with every private and RNG field exact', () => {
    const before = migrateSliceState(source), beforeHash = hash(before), rawHash = hash(raw);
    expect(intent).toEqual({ type: 'NATURE_WALKER', command: { type: 'LEARN_GUIDANCE' } });
    const replayed = applySliceIntent(before, intent), expected = currentNatureWalkerReplayExpectation(current);
    expect(hash(replayed)).toBe(hash(expected));
    expect(replayed.random).toEqual(before.random);
    expect(hash(before)).toBe(beforeHash); expect(hash(raw)).toBe(rawHash); expect(fileHash()).toBe(boundarySha256);
  }, 60_000);

  it('preserves the propagated guide and unrelated lastResult at the actual final capture', () => {
    const final = migrateSliceState(readObjectEntry('tests/fixtures/nature-walker-v02070/natural.json', 'final'));
    const before = hash(final), expected = currentNatureWalkerReplayExpectation(final);
    expect(final.lastResult!.id).not.toBe(final.chronicle[NATURE_WALKER_CAPTURE_GUIDE_INDEX]!.id);
    expect(hash({ ...expected, chronicle: final.chronicle })).toBe(before);
    expect(expected.lastResult).toEqual(final.lastResult);
    expect(expected.chronicle[NATURE_WALKER_CAPTURE_GUIDE_INDEX]!.text).toBe(NATURE_WALKER_CURRENT_GUIDE_TEXT);
    expect(hash(final)).toBe(before);
  }, 60_000);

  it('adapts only the two exact public prose leaves across all104 preserved rows', async () => {
    const path = 'tests/fixtures/nature-walker-v02070/public.jsonl';
    const originalHash = createHash('sha256').update(readFileSync(path)).digest('hex');
    expect(originalHash).toBe('52ceb71c23b98ee1f0490deb4564939ed4fba517e5203ba8c4a1fbb4f0db6258');
    expect(NATURE_WALKER_CAPTURE_PUBLIC_RISK).toBe(NATURE_WALKER_CONSUMPTION_RISK);
    expect(NATURE_WALKER_CURRENT_PUBLIC_RISK).toBe(NATURE_WALKER_CURRENT_CONSUMPTION_RISK);
    type Body = { natureWalker: ReturnType<typeof projectSliceState>['natureWalker'] };
    const input = createReadStream(path, { encoding: 'utf8' }), lines = createInterface({ input, crlfDelay: Infinity });
    const inventories = new Set<string>(); let count = 0;
    try {
      for await (const line of lines) {
        const row = JSON.parse(line) as { step: number; before: Body; after: Body };
        expect(row.step).toBe(852 + count++);
        for (const side of ['before', 'after'] as const) {
          const captured = row[side], before = hash(captured), expected = currentNatureWalkerPublicReplayExpectation(captured);
          inventories.add(captured.natureWalker.supplies);
          expect(Object.keys(expected.natureWalker).filter(key => {
            const k = key as keyof Body['natureWalker']; return hash(expected.natureWalker[k]) !== hash(captured.natureWalker[k]);
          }).sort()).toEqual(['risk', 'supplies']);
          expect(hash({ ...expected, natureWalker: { ...expected.natureWalker,
            risk: captured.natureWalker.risk, supplies: captured.natureWalker.supplies } })).toBe(before);
          expect(hash(currentNatureWalkerPublicReplayExpectation(expected))).toBe(hash(expected));
          expect(hash(captured)).toBe(before);
          if (row.step === 852) {
            expect(hash(expected.natureWalker)).toBe(hash(projectSliceState(side === 'before' ? migrateSliceState(source) : current).natureWalker));
          }
        }
      }
    } finally { lines.close(); input.destroy(); }
    expect(count).toBe(104); expect(inventories.size).toBe(3);
    expect(createHash('sha256').update(readFileSync(path)).digest('hex')).toBe(originalHash);
  }, 60_000);

  it('rejects altered public risk or supplies while keeping unrelated public changes observable', () => {
    const captured = { natureWalker: projectSliceState(current).natureWalker }, before = hash(captured);
    const expected = currentNatureWalkerPublicReplayExpectation(captured);
    for (const risk of [NATURE_WALKER_CAPTURE_PUBLIC_RISK + ' ', NATURE_WALKER_CURRENT_PUBLIC_RISK + ' ', '']) {
      expect(() => currentNatureWalkerPublicReplayExpectation({ natureWalker: { ...captured.natureWalker, risk } }))
        .toThrow('Unexpected original Nature Walker public risk');
    }
    for (const supplies of [captured.natureWalker.supplies + ' ', captured.natureWalker.supplies.replace('尚持3瓶', '尚持4瓶'), '']) {
      expect(() => currentNatureWalkerPublicReplayExpectation({ natureWalker: { ...captured.natureWalker, supplies } }))
        .toThrow('Unexpected original Nature Walker public supplies');
    }
    const changed = { natureWalker: { ...captured.natureWalker, nextStep: captured.natureWalker.nextStep + 'unexpected change' } };
    expect(currentNatureWalkerPublicReplayExpectation(changed).natureWalker.nextStep).toBe(changed.natureWalker.nextStep);
    expect(hash(currentNatureWalkerPublicReplayExpectation(changed))).not.toBe(hash(expected));
    expect(hash(captured)).toBe(before);
  });
});
