import { beforeAll, describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { sha256Hex } from '../../src/domain/checksum.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { createFoolMaterials, applyFoolMaterialCommand, projectFoolMaterials, type FoolMaterialAuthority } from '../../src/domain/fool/materials.js';
import { createFoolReplayOrigin, deriveFoolMaterialHost, type FoolMaterialCommandReplayFrame } from '../../src/domain/fool/material-host.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

/** Directed origin/adapter checks, not a natural
 * campaign. The historical fixture and production source remain untouched. */
const same = (a: unknown, b: unknown): void => expect(stableStringify(a)).toBe(stableStringify(b));
let sourceHost: SliceState;
let prepared: ReturnType<typeof createFoolReplayOrigin>;
function workFrame(): FoolMaterialCommandReplayFrame {
  const source = prepared.source;
  const materials = createFoolMaterials(source.materialsOrigin, prepared.materialAuthority([]));
  const item = materials.items.find(item => item.disposition === 'SUPPLIER')!;
  return { kind: 'MATERIAL_COMMAND', eventId: 'origin-reuse-work', witnessId: 'origin-reuse-host',
    revision: source.revision + 1, locationId: 'base', before: structuredClone(source.budget), materialsBefore: materials,
    randomBefore: source.random.cursor, randomAfter: source.random.cursor,
    command: { type: 'SUPPLIER_WORK', itemId: item.id, proofId: 'origin-reuse-proof' }, check: null };
}

describe('Fool immutable expected-origin reuse', () => {
  beforeAll(() => {
    sourceHost = migrateSliceState(readObjectEntry<unknown>('tests/fixtures/attendant-mysteries-v01860/natural-battle.json', 'final'));
    prepared = createFoolReplayOrigin(sourceHost);
  }, 30_000);

  it('matches strict public derivation through the material transaction and projection', () => {
    const frame = workFrame(), before = stableStringify(frame), sourceBefore = stableStringify(prepared.source);
    const strictHost = deriveFoolMaterialHost(prepared.source, frame);
    // Expected values come from the public strict derive API. This test-local
    // exact-value reference grants only the one independently derived work frame.
    const reference: FoolMaterialAuthority = {
      verifyOrigin: origin => stableStringify(origin) === stableStringify(prepared.source.materialsOrigin),
      verifyHost: host => stableStringify(host) === stableStringify(strictHost),
      verifyWorldReceipt: (proof, host) => stableStringify(host) === stableStringify(strictHost) && stableStringify(proof) === stableStringify(strictHost.proof),
      verifyConsumption: () => false, verifyTransport: () => false,
    };
    const scoped = prepared.materialAuthority([frame]);
    const actual = applyFoolMaterialCommand(frame.materialsBefore, frame.command, strictHost, scoped);
    const expected = applyFoolMaterialCommand(frame.materialsBefore, frame.command, strictHost, reference);
    same(actual, expected); same(projectFoolMaterials(actual.state), projectFoolMaterials(expected.state));
    expect(stableStringify(frame)).toBe(before); expect(stableStringify(prepared.source)).toBe(sourceBefore);
    expect(frame.randomAfter).toBe(frame.randomBefore); same(prepared.source.random, sourceHost.random);
    expect(scoped.verifyHost(strictHost)).toBe(true);
    expect(scoped.verifyWorldReceipt(strictHost.proof!, strictHost)).toBe(true);
    const changed = structuredClone(strictHost); changed.resources.cash++;
    expect(scoped.verifyHost(changed)).toBe(false);
    const forgedProof = structuredClone(strictHost.proof!); forgedProof.sourceEventId += ':forged';
    expect(scoped.verifyWorldReceipt(forgedProof, strictHost)).toBe(false);
  }, 30_000);

  it('freshly checks an already accepted candidate object and material frame on reuse', () => {
    const authority = prepared.materialAuthority([]), candidate = structuredClone(prepared.source.materialsOrigin);
    expect(authority.verifyOrigin(candidate)).toBe(true);
    candidate.uniquenessCustody[0]!.sealId += ':forged';
    expect(authority.verifyOrigin(candidate)).toBe(false);
    expect(prepared.materialAuthority([]).verifyOrigin(candidate)).toBe(false);
    const frame = workFrame(); prepared.materialAuthority([frame]);
    frame.materialsBefore.origin.uniquenessCustody[0]!.sealId += ':forged';
    // Matching object identity and the unchanged original digest are insufficient.
    expect(() => prepared.materialAuthority([frame])).toThrow('MATERIAL_FRAME_SAME_SOURCE');
    frame.materialsBefore.originDigest = sha256Hex(stableStringify(frame.materialsBefore.origin));
    // Rehashing the forgery is also insufficient.
    expect(() => prepared.materialAuthority([frame])).toThrow('MATERIAL_FRAME_SAME_SOURCE');
    expect(authority.verifyOrigin(prepared.source.materialsOrigin)).toBe(true);
  }, 30_000);

  it('keeps every order, budget and RNG check on repeated authority builds', () => {
    const frame = workFrame(); prepared.materialAuthority([frame]);
    expect(() => prepared.materialAuthority([frame, frame])).toThrow('MATERIAL_AUTHORITY_EVENT_ORDER');
    const wrongRandom = structuredClone(frame); wrongRandom.randomAfter++;
    expect(() => prepared.materialAuthority([wrongRandom])).toThrow('MATERIAL_SERVICE_UNEXPECTED_RNG');
    const wrongBudget = structuredClone(frame); wrongBudget.before.health = 0;
    expect(() => prepared.materialAuthority([wrongBudget])).toThrow('MATERIAL_FRAME_REAL_LIVING_BUDGET');
    const wrongSource = structuredClone(frame); wrongSource.materialsBefore.originDigest += ':forged';
    expect(() => prepared.materialAuthority([wrongSource])).toThrow('MATERIAL_FRAME_SAME_SOURCE');
    expect(() => prepared.materialAuthority([frame])).not.toThrow();
  }, 30_000);

  it('keeps public derivation fresh and binds separate invocations to the current source', () => {
    const supplied = structuredClone(prepared.source), bound = createFoolReplayOrigin(sourceHost, supplied), frame = workFrame();
    deriveFoolMaterialHost(supplied, frame);
    supplied.materialsOrigin.uniquenessCustody[0]!.sealId += ':forged';
    expect(() => deriveFoolMaterialHost(supplied, frame)).toThrow('MATERIAL_FRAME_SAME_SOURCE');
    expect(bound.materialAuthority([]).verifyOrigin(supplied.materialsOrigin)).toBe(false);
    expect(bound.materialAuthority([]).verifyOrigin(bound.source.materialsOrigin)).toBe(true);
    expect(() => createFoolReplayOrigin(sourceHost, supplied)).toThrow('MATERIAL_AUTHORITY_SOURCE_REPLAY_REQUIRED');
    expect(Object.isFrozen(bound.source.materialsOrigin.uniquenessCustody[0])).toBe(true);
  }, 30_000);
});
