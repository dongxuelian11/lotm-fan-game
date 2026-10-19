import { describe, expect, it, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { projectFool } from '../../src/domain/fool/index.js';
import { openFoolRuntimeSession, type FoolRuntimeDraft } from '../../src/domain/fool/owned-session.js';
import * as engine from '../../src/domain/fool/engine.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

// The actual predecessor is only migrated and continued through normal commands.
// No resources, RNG, source, journal, or authority are fabricated for these tests.
let sourceCache: SliceState | undefined;
const guided = (): SliceState => structuredClone(sourceCache ??= applySliceIntent(
  migrateSliceState(readObjectEntry<unknown>('tests/fixtures/attendant-mysteries-v01860/natural-battle.json', 'final')),
  { type: 'FOOL', command: { type: 'LEARN_GUIDANCE' } },
));
const work: SliceIntent = { type: 'FOOL', command: { type: 'RECEPTION_WORK' } };
const same = (actual: unknown, expected: unknown): void => { expect(stableStringify(actual)).toBe(stableStringify(expected)); };

describe('Fool private owned runtime', () => {
  it('shares exact raw slice publication, full projections, budgets, RNG, and receipts', () => {
    let strict = guided(); const session = openFoolRuntimeSession(strict);
    same(session.project(), projectSliceState(strict));
    for (const intent of [work, work, work, { type: 'FOOL', command: { type: 'RECEPTION_NEXT_WEEK' } }] as SliceIntent[]) {
      const previous = strict;
      strict = applySliceIntent(strict, intent);
      const draft = session.prepare(intent, previous.revision);
      same(session.snapshot(), previous);
      same(session.snapshotDraft(draft), strict);
      same(session.projectDraftFool(draft), projectFool(strict));
      expect(session.inspectDraft(draft)).toEqual({ runId: strict.runId, revision: strict.revision, status: strict.status });
      session.commit(draft); same(session.snapshot(), strict);
    }
    same(session.project(), projectSliceState(strict));
    same(openFoolRuntimeSession(session.snapshot()).snapshot(), strict);
  }, 60_000);

  it('detaches constructor inputs, command objects, snapshots, and both public projection forms', () => {
    const input = guided(), expected = structuredClone(input), session = openFoolRuntimeSession(input);
    input.cash = 0; input.random.cursor++; input.fool.source!.character.name = 'external edit';
    const snapshot = session.snapshot(); snapshot.fool.frame!.budget.cash = 0; snapshot.chronicle.length = 0;
    const publicFool = session.projectFool(); publicFool.actions.length = 0; publicFool.resources.health = -1;
    const publicSlice = session.project(); publicSlice.chronicle.length = 0;
    same(session.snapshot(), expected);
    const intent = structuredClone(work), draft = session.prepare(intent, expected.revision);
    (intent as { type: 'FOOL'; command: { type: string } }).command.type = 'RECEPTION_REST';
    const detached = session.snapshotDraft(draft); detached.random.cursor++; detached.fool.journal.length = 0;
    session.projectDraftFool(draft).actions.length = 0;
    session.commit(draft); same(session.snapshot(), applySliceIntent(expected, work));
  }, 30_000);

  it('rejects forged, cloned, cross-session, discarded, consumed and sibling-stale drafts', () => {
    const first = openFoolRuntimeSession(guided()), second = openFoolRuntimeSession(guided());
    const revision = first.inspect().revision;
    const a = first.prepare(work, revision), sibling = first.prepare(work, revision), foreign = second.prepare(work, revision);
    for (const fake of [{}, { ...a }, structuredClone(a), foreign] as FoolRuntimeDraft[]) {
      expect(() => first.snapshotDraft(fake)).toThrow(); expect(() => first.commit(fake)).toThrow();
    }
    first.discard(sibling); expect(() => first.commit(sibling)).toThrow();
    const stale = first.prepare(work, revision); first.commit(a);
    expect(() => first.commit(a)).toThrow(); expect(() => first.commit(stale)).toThrow();
    expect(() => first.prepare(work, revision)).toThrow();
    expect(second.inspect().revision).toBe(revision);
  }, 30_000);

  it('keeps rejected and discarded preparation entirely isolated and retries identically', () => {
    const session = openFoolRuntimeSession(guided()), before = session.snapshot(), revision = before.revision;
    for (const invalid of [
      { type: 'FOOL', command: { type: 'LEARN_GUIDANCE' } },
      { type: 'FOOL', command: { type: 'START_ESCAPE' } },
      { type: 'FOOL', command: { type: 'RECEPTION_WORK', skipReplay: true } },
      { type: 'FOOL', command: { type: 'RECEPTION_WORK' }, verified: true },
      { type: 'ATTENDANT_MYSTERIES', command: { type: 'RECEPTION_WORK' } },
    ] as unknown as SliceIntent[]) expect(() => session.prepare(invalid, revision)).toThrow();
    same(session.snapshot(), before);
    const a = session.prepare(work, revision), expected = session.snapshotDraft(a); session.discard(a);
    const b = session.prepare(work, revision); same(session.snapshotDraft(b), expected); same(session.snapshot(), before);
  }, 30_000);

  it('strictly reopens arbitrary snapshots and rejects corrupted saved history and extra fields', () => {
    const authentic = applySliceIntent(guided(), work);
    const alterations: ((state: SliceState) => void)[] = [
      state => { state.fool.journal[0]!.command = { type: 'RECEPTION_REST' }; },
      state => { state.fool.journal[0]!.afterDigest = state.fool.journal[0]!.beforeDigest; },
      state => { (state.fool.journal[0]!.command as unknown as Record<string, unknown>).verified = true; },
      state => { state.fool.source!.character.name = 'forged original'; },
      state => { state.random.cursor++; },
      state => { (state.fool as unknown as Record<string, unknown>).verified = true; },
      state => { state.character.age = 0; },
      state => { (state.hunter as unknown as Record<string, unknown>).verified = true; },
    ];
    for (const change of alterations) { const state = structuredClone(authentic); change(state); expect(() => openFoolRuntimeSession(state)).toThrow(); }
  }, 30_000);

  it('retains one strict reconstruction per open, never caches failed ingress, and keeps raw validation strict', () => {
    const input = guided(), replay = vi.spyOn(engine, 'replayFool'), opening = vi.spyOn(engine, 'openFoolOwnedEngine');
    try {
      const session = openFoolRuntimeSession(input);
      expect(opening).toHaveBeenCalledTimes(1); expect(replay).not.toHaveBeenCalled();
      const original = session.snapshot(); session.projectFool(); session.project();
      const draft = session.prepare(work, original.revision); session.projectDraftFool(draft); session.commit(draft);
      session.projectFool(); expect(opening).toHaveBeenCalledTimes(1); expect(replay).not.toHaveBeenCalled();
      same(openFoolRuntimeSession(session.snapshot()).snapshot(), session.snapshot());
      expect(opening).toHaveBeenCalledTimes(2); expect(replay).not.toHaveBeenCalled();
      // This malformed outer field is checked after the Fool engine was built.
      // Its failed opening must neither return nor cache that partial result.
      const damaged = session.snapshot(); damaged.lastCheck = {} as SliceState['lastCheck'];
      expect(() => openFoolRuntimeSession(damaged)).toThrow();
      expect(opening).toHaveBeenCalledTimes(3);
      same(openFoolRuntimeSession(session.snapshot()).snapshot(), session.snapshot());
      expect(opening).toHaveBeenCalledTimes(4); expect(replay).not.toHaveBeenCalled();
      assertValidSliceState(session.snapshot());
      expect(replay).toHaveBeenCalledTimes(1); expect(opening).toHaveBeenCalledTimes(4);
    } finally { replay.mockRestore(); opening.mockRestore(); }
  }, 30_000);
});
