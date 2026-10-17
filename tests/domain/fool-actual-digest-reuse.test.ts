import { beforeAll, describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { replayFool, previewFool, transitionFool } from '../../src/domain/fool/engine.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

let actual: SliceState;
beforeAll(() => {
  let s = migrateSliceState(readObjectEntry<unknown>('tests/fixtures/attendant-mysteries-v01860/natural-battle.json', 'final'));
  s = applySliceIntent(s, { type: 'FOOL', command: { type: 'LEARN_GUIDANCE' } });
  for (let i = 0; i < 3; i++) s = applySliceIntent(s, { type: 'FOOL', command: { type: 'RECEPTION_WORK' } });
  actual = s;
}, 30_000);

describe('Fool generated digest continuity inside one strict replay', () => {
  it('reconstructs every full event and current root, with unchanged input and RNG', () => {
    const before = stableStringify(actual), result = replayFool(actual, actual.fool);
    expect(stableStringify(result.root)).toBe(stableStringify(actual.fool));
    expect(result.root.frame!.random).toEqual(actual.random);
    for (let i = 1; i < result.root.journal.length; i++) expect(result.root.journal[i]!.beforeDigest).toBe(result.root.journal[i - 1]!.afterDigest);
    expect(stableStringify(actual)).toBe(before);
  }, 30_000);
  it('rejects altered before or after digests, including a forged matching adjoining pair', () => {
    const changes = [
      (s: SliceState) => { s.fool.journal[1]!.beforeDigest = 'f'.repeat(64); },
      (s: SliceState) => { s.fool.journal[0]!.afterDigest = 'f'.repeat(64); },
      (s: SliceState) => { s.fool.journal[0]!.afterDigest = s.fool.journal[1]!.beforeDigest = 'f'.repeat(64); },
    ];
    for (const change of changes) { const s = structuredClone(actual); change(s); expect(() => replayFool(s, s.fool)).toThrow(); }
  }, 30_000);
  it('rejects changed middle action costs and nested fog receipts', () => {
    const cost = structuredClone(actual); cost.fool.journal[1]!.after.budget.cash++;
    expect(() => replayFool(cost, cost.fool)).toThrow();
    const fog = structuredClone(actual); fog.fool.fog!.journal[0]!.cost.cash++;
    expect(() => replayFool(fog, fog.fool)).toThrow();
  }, 30_000);
  it('keeps independent preview and transition strict after a previous accepted call', () => {
    replayFool(actual, actual.fool);
    expect(previewFool(actual, actual.fool, { type: 'RECEPTION_NEXT_WEEK' }, actual.revision + 1)).toBeNull();
    const next = transitionFool(actual, actual.fool, { type: 'RECEPTION_NEXT_WEEK' }, actual.revision + 1);
    expect(next.journal.at(-1)!.beforeDigest).toBe(actual.fool.journal.at(-1)!.afterDigest);
    const bad = structuredClone(actual); bad.fool.journal.at(-1)!.afterDigest = '0'.repeat(64);
    expect(previewFool(bad, bad.fool, { type: 'RECEPTION_NEXT_WEEK' }, bad.revision + 1)).not.toBeNull();
    expect(() => transitionFool(bad, bad.fool, { type: 'RECEPTION_NEXT_WEEK' }, bad.revision + 1)).toThrow();
  }, 30_000);
});
