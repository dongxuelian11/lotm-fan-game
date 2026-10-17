import { beforeAll, describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { sha256Hex } from '../../src/domain/checksum.js';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { createFoolState, createOwnedFoolReplayCanonical, replayFool, transitionPreparedFool } from '../../src/domain/fool/engine.js';
import { validateFoolState } from '../../src/domain/fool/index.js';
import type { FoolState } from '../../src/domain/fool/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

/** Serialization/tamper regressions. Synthetic
 * snapshot mutations are disposable; no natural fixture or capture is changed. */
const record = (v: object): Record<string, unknown> => v as unknown as Record<string, unknown>;
const strictCanonical = (root: FoolState): string => { const { journal: _journal, ...rest } = root; return stableStringify(rest); };
const assertBytesAndHash = (root: FoolState, serialize: () => string): void => {
  const expected = strictCanonical(root), actual = serialize();
  expect(actual).toBe(expected); expect(sha256Hex(actual)).toBe(sha256Hex(expected));
};
let guided: SliceState;
beforeAll(() => {
  const source = migrateSliceState(readObjectEntry<unknown>('tests/fixtures/attendant-mysteries-v01860/natural-battle.json', 'final'));
  guided = applySliceIntent(source, { type: 'FOOL', command: { type: 'LEARN_GUIDANCE' } });
}, 90_000);

describe('Fool private replay canonical byte reuse', () => {
  it('matches full stable serialization and SHA at every dynamic snapshot', () => {
    const root = structuredClone(guided.fool), serialize = createOwnedFoolReplayCanonical(root);
    assertBytesAndHash(root, serialize);
    const steps: Array<() => void> = [
      () => { root.frame!.budget.cash++; },
      () => { root.frame!.budget.mastery['10'] = 10; root.frame!.budget.mastery['2'] = 2; },
      () => { root.fatePeople['10'] = { health: 10, injuries: ['quote" slash\\ newline\n 中文\u0000'] }; root.fatePeople['2'] = { health: -0, injuries: [] }; },
      () => { root.materials = structuredClone(root.materials!); root.materials.items[0]!.lastProofId = 'new-proof'; },
      () => { root.frame!.budget.injuries.push({ id: 'directed-byte-test', severity: 'LIGHT', acquiredRevision: 1, treatedRevision: null }); },
    ];
    for (const step of steps) { step(); assertBytesAndHash(root, serialize); }
  });

  it('includes new origin-reference bytes and falls back for replaced source', () => {
    const mutations: Array<(value: Record<string, unknown>) => void> = [
      value => { value.added = { '10': 'ten', '2': 'two', text: '"\\中文' }; },
      value => { delete value.snapshotDigest; },
      value => { (value.uniquenessCustody as Array<{ sealId: string }>)[0]!.sealId += ':changed'; },
    ];
    for (const mutate of mutations) {
      const root = structuredClone(guided.fool), serialize = createOwnedFoolReplayCanonical(root);
      assertBytesAndHash(root, serialize);
      root.materials!.origin = structuredClone(root.materials!.origin);
      mutate(record(root.materials!.origin)); assertBytesAndHash(root, serialize);
    }
    const root = structuredClone(guided.fool), serialize = createOwnedFoolReplayCanonical(root);
    assertBytesAndHash(root, serialize);
    root.source = structuredClone(root.source!);
    root.source.budget.cash++; record(root.source).added = 'must remain in full fallback';
    assertBytesAndHash(root, serialize);
  });

  it('retains all unknown or missing shallow fields through the original serializer', () => {
    const mutations: Array<(root: FoolState) => void> = [
      root => { record(root).extra = { nested: ['new-root-value'] }; },
      root => { record(root)['10'] = 10; record(root)['2'] = 2; },
      root => { delete record(root).atFate; },
      root => { record(root.materials!).extra = { nested: ['new-material-value'] }; },
      root => { record(root.materials!)['10'] = 10; record(root.materials!)['2'] = 2; },
      root => { delete record(root.materials!).status; },
      root => { root.materials = null; },
    ];
    for (const mutate of mutations) {
      const root = structuredClone(guided.fool), serialize = createOwnedFoolReplayCanonical(root);
      assertBytesAndHash(root, serialize); mutate(root); assertBytesAndHash(root, serialize);
    }
    const blank = createFoolState(); assertBytesAndHash(blank, createOwnedFoolReplayCanonical(blank));
    const bad = structuredClone(guided.fool), serialize = createOwnedFoolReplayCanonical(bad);
    assertBytesAndHash(bad, serialize); bad.frame!.budget.cash = Number.NaN;
    expect(() => strictCanonical(bad)).toThrow(); expect(serialize).toThrow();
    bad.frame!.budget.cash = 25;
    Object.setPrototypeOf(bad.materials!, { nonPlain: true });
    expect(() => strictCanonical(bad)).toThrow(); expect(serialize).toThrow();
  });

  it('fully revalidates source/origin additions, deletions and nested tampering on later calls', () => {
    const mutations: Array<(state: SliceState) => void> = [
      state => { record(state.fool.source!).added = true; },
      state => { delete record(state.fool.source!).worldDigest; },
      state => { state.fool.source!.materialsOrigin.uniquenessCustody[0]!.sealId += ':forged'; },
      state => { record(state.fool.materials!.origin).added = true; },
      state => { delete record(state.fool.materials!.origin).snapshotDigest; },
      state => { state.fool.materials!.origin.sourceSnapshot.batches[0]!.materials[0]!.name += ':forged'; },
    ];
    for (const mutate of mutations) {
      const state = structuredClone(guided); replayFool(state, state.fool); mutate(state);
      const unchanged = stableStringify(state);
      expect(() => replayFool(state, state.fool)).toThrow();
      expect(validateFoolState(state)).toBe(false);
      expect(() => applySliceIntent(state, { type: 'FOOL', command: { type: 'RECEPTION_WORK' } })).toThrow();
      expect(stableStringify(state)).toBe(unchanged);
    }
  }, 120_000);

  it('does not retain cached bytes in returned prepared operations and rejects altered output on full replay', () => {
    const mutate: Array<(root: FoolState) => void> = [
      root => { root.source!.budget.cash++; },
      root => { root.materials!.origin.snapshotDigest += ':forged'; },
    ];
    for (const change of mutate) {
      const state = structuredClone(guided), prepared = replayFool(state, state.fool);
      expect(Object.keys(prepared.context).sort()).toEqual(['archived', 'materialFrames', 'fateReceipts', 'escapeStart', 'escapeFrames', 'materialAuthority', 'fogReplay'].sort());
      change(prepared.root); const before = stableStringify(prepared.root), expectedBefore = sha256Hex(strictCanonical(prepared.root));
      // Existing low-level prepared API does not promise immediate source/origin
      // rejection for a reception action. Its full digests must still include the
      // change, and a complete subsequent replay must reject the resulting root.
      const result = transitionPreparedFool(prepared, { type: 'RECEPTION_WORK' }, state.revision + 1);
      expect(result.journal.at(-1)!.beforeDigest).toBe(expectedBefore);
      expect(result.journal.at(-1)!.afterDigest).toBe(sha256Hex(strictCanonical(result)));
      expect(stableStringify(prepared.root)).toBe(before);
      expect(() => replayFool(state, result)).toThrow();
    }
  }, 90_000);
});
