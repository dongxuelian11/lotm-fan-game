import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createFoolSource, foolFrozenSourceDigest, foolSourceView, type FoolSource } from '../../src/domain/fool/source.js';
import { createFoolMaterials } from '../../src/domain/fool/materials.js';
import { createFoolMaterialAuthority, createFoolMaterialAuthorityFactory, createFoolReplayOrigin, deriveFoolMaterialHost, type FoolMaterialCommandReplayFrame } from '../../src/domain/fool/material-host.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

/** Original-source adapter regression only; does not fabricate a campaign or
 * relax runtime validation. Corruption is confined to disposable test clones. */
let originalCache: SliceState | undefined;
const original = (): SliceState => structuredClone(originalCache ??= migrateSliceState(readObjectEntry<unknown>('tests/fixtures/attendant-mysteries-v01860/natural-battle.json', 'final')));
const same = (a: unknown, b: unknown): void => expect(stableStringify(a)).toBe(stableStringify(b));

describe('Fool per-invocation verified original source', () => {
  it('matches the original source and material constructors without mutating the host', () => {
    const s = original(), bytes = stableStringify(s), prepared = createFoolReplayOrigin(s), expected = createFoolSource(s);
    same(prepared.source, expected); same(prepared.archived, foolSourceView(s, expected));
    const current = createFoolMaterials(prepared.source.materialsOrigin, prepared.materialAuthority([]));
    const legacy = createFoolMaterials(expected.materialsOrigin, createFoolMaterialAuthority(expected, prepared.archived, []));
    same(current, legacy); expect(stableStringify(s)).toBe(bytes);
    expect(Object.isFrozen(prepared.source)).toBe(true); expect(Object.isFrozen(prepared.source.materialsOrigin.sourceSnapshot)).toBe(true);
  }, 30_000);

  it('retains the legacy archived-checkpoint restriction while the new entry verifies a current host', () => {
    const s = original(), source = createFoolSource(s), later = structuredClone(s);
    later.revision++; // Directed source-adapter input only, not a natural campaign transition.
    const prepared = createFoolReplayOrigin(later, source);
    expect(prepared.archived.revision).toBe(source.revision); same(prepared.source, source);
    expect(() => createFoolMaterialAuthorityFactory(source, later)).toThrow('MATERIAL_AUTHORITY_SOURCE_REPLAY_REQUIRED');
    expect(() => createFoolMaterialAuthority(source, later, [])).toThrow('MATERIAL_AUTHORITY_SOURCE_REPLAY_REQUIRED');
  }, 30_000);

  it('rechecks each call and rejects source additions or forged old-town receipts even with updated digests', () => {
    const s = original(), source = createFoolSource(s);
    createFoolReplayOrigin(s, source);
    const extra = { ...structuredClone(source), skipValidation: true } as unknown as FoolSource;
    for (const create of [() => createFoolReplayOrigin(s, extra), () => createFoolMaterialAuthorityFactory(extra, s)]) {
      expect(create).toThrow('MATERIAL_AUTHORITY_SOURCE_REPLAY_REQUIRED');
    }
    const bad = structuredClone(s), forged = structuredClone(source);
    bad.attendantMysteries.town!.journal.at(-1)!.cost.cash++;
    forged.sourceHistoryDigest = foolFrozenSourceDigest(bad);
    const bytes = stableStringify(bad);
    for (const create of [() => createFoolReplayOrigin(bad, forged), () => createFoolMaterialAuthorityFactory(forged, bad)]) {
      expect(create).toThrow('MATERIAL_AUTHORITY_SOURCE_REPLAY_REQUIRED');
    }
    expect(stableStringify(bad)).toBe(bytes);
  }, 30_000);

  it('keeps frame order, exact host, RNG and origin checks on every scoped authority build', () => {
    const s = original(), supplied = createFoolSource(s), prepared = createFoolReplayOrigin(s, supplied);
    const materials = createFoolMaterials(prepared.source.materialsOrigin, prepared.materialAuthority([]));
    const supplier = materials.items.find(item => item.disposition === 'SUPPLIER'); expect(supplier).toBeDefined();
    const frame: FoolMaterialCommandReplayFrame = {
      kind: 'MATERIAL_COMMAND', eventId: 'source-test-event', witnessId: 'source-test-host', revision: supplied.revision + 1,
      locationId: 'base', before: structuredClone(supplied.budget), materialsBefore: materials,
      randomBefore: supplied.random.cursor, randomAfter: supplied.random.cursor,
      command: { type: 'SUPPLIER_WORK', itemId: supplier!.id, proofId: 'source-test-proof' }, check: null,
    };
    const host = deriveFoolMaterialHost(prepared.source, frame), authority = prepared.materialAuthority([frame]);
    expect(authority.verifyHost(host)).toBe(true);
    expect(authority.verifyHost({ ...host, resources: { ...host.resources, cash: host.resources.cash + 1 } })).toBe(false);
    expect(() => prepared.materialAuthority([frame, frame])).toThrow('MATERIAL_AUTHORITY_EVENT_ORDER');
    const wrongDraw = structuredClone(frame); wrongDraw.randomAfter++;
    expect(() => prepared.materialAuthority([wrongDraw])).toThrow('MATERIAL_SERVICE_UNEXPECTED_RNG');
    const wrongOrigin = structuredClone(frame); wrongOrigin.materialsBefore.originDigest += ':forged';
    expect(() => prepared.materialAuthority([wrongOrigin])).toThrow('MATERIAL_FRAME_SAME_SOURCE');
    supplied.materialsOrigin.snapshotDigest += ':forged';
    expect(authority.verifyOrigin(supplied.materialsOrigin)).toBe(false);
    expect(authority.verifyOrigin(prepared.source.materialsOrigin)).toBe(true);
    expect(() => createFoolReplayOrigin(s, supplied)).toThrow('MATERIAL_AUTHORITY_SOURCE_REPLAY_REQUIRED');
    expect(() => createFoolMaterialAuthorityFactory(supplied, s)).toThrow('MATERIAL_AUTHORITY_SOURCE_REPLAY_REQUIRED');
  }, 30_000);
});
