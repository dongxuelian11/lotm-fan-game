import { describe, expect, it, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import * as sourceModule from '../../src/domain/fool/source.js';
import type { FoolBudget, FoolSource } from '../../src/domain/fool/source.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import {
  applyFoolEscapeCommand, createFoolEscapeState, foolEscapeCheckInput,
  validateFoolEscapeState, type FoolEscapeCommand, type FoolEscapeState,
} from '../../src/domain/fool/escape.js';
import {
  buildFoolEscapeInitial, createFoolEscapeAuthority, createFoolEscapeHostReplayCursor,
  deriveFoolEscapeHost, type FoolEscapeReplayFrame, type FoolEscapeStartFrame,
} from '../../src/domain/fool/escape-host.js';
import { FOOL_ESCAPE_WORLD_RECORD } from '../../src/domain/fool/escape-content.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const same = (a: unknown, b: unknown): void => expect(stableStringify(a)).toBe(stableStringify(b));
let originalCache: { archived: SliceState; source: FoolSource } | undefined;
function fixture() {
  if (!originalCache) {
    const archived = migrateSliceState(readObjectEntry<unknown>('tests/fixtures/attendant-mysteries-v01860/natural-battle.json', 'final'));
    originalCache = { archived, source: sourceModule.createFoolSource(archived) };
  }
  const { archived, source } = structuredClone(originalCache);
  // Directed adapter input, not a claimed promotion or campaign capture. Keep
  // the independently verified predecessor and its actual resources/RNG intact.
  const start: FoolEscapeStartFrame = {
    eventId: `F208:${source.runId}:${source.revision + 10}`, revision: source.revision + 10,
    command: { type: 'START_ESCAPE' }, before: { ...structuredClone(source.budget), sequence: 0 },
    now: 1000, location: FOOL_ESCAPE_WORLD_RECORD.location,
  };
  return { archived, source, start };
}
function frameFor(source: FoolSource, state: FoolEscapeState, before: FoolBudget,
  revision: number, cursor: number, type: FoolEscapeCommand['type']): FoolEscapeReplayFrame {
  const command: FoolEscapeCommand = { type }, environment = { conditionId: state.scene.conditionId, lineOfSight: true };
  const random = new DeterministicActionRandomStream(source.random.seed, cursor);
  const input = foolEscapeCheckInput(state, command, { now: state.scene.now, stats: before.coreStats, environment });
  const check = input ? resolveNormalCheck({ ...input, roll: random.nextInt(1, 100) }) : null;
  return {
    eventId: `F208:${source.runId}:${revision}`, revision, before: structuredClone(before), now: state.scene.now,
    escapeBefore: structuredClone(state), command, environment, check, randomBefore: cursor, randomAfter: random.cursor,
  };
}

describe('Fool owned sequential escape host cursor', () => {
  it('strictly verifies the source once and advances independently forked prefixes', () => {
    const { source, archived, start } = fixture(), verify = vi.spyOn(sourceModule, 'validateFoolSource');
    try {
      const cursor = createFoolEscapeHostReplayCursor(source, archived, start), initial = cursor.snapshot();
      expect(verify).toHaveBeenCalledTimes(1); expect(Object.isFrozen(cursor)).toBe(true);
      const fork = cursor.fork(); expect(Object.isFrozen(fork)).toBe(true);
      const first = frameFor(source, initial, start.before, start.revision + 1, source.random.cursor, 'WAIT');
      const a = cursor.advance(first), b = fork.advance(first); same(a, b);
      const second = frameFor(source, a.state, start.before, first.revision + 1, first.randomAfter, 'WAIT');
      cursor.advance(second);
      expect(cursor.matches(cursor.snapshot())).toBe(true); expect(verify).toHaveBeenCalledTimes(1);
      expect(fork.snapshot().journal).toHaveLength(1); expect(cursor.snapshot().journal).toHaveLength(2);
    } finally { verify.mockRestore(); }
  }, 60_000);

  it('matches strict original and every exact standalone transition including an actual deterministic check', () => {
    const { source, archived, start } = fixture(), cursor = createFoolEscapeHostReplayCursor(source, archived, start);
    let strict = createFoolEscapeState(buildFoolEscapeInitial(source, start), createFoolEscapeAuthority(source, archived, start, [], true));
    let before = structuredClone(start.before), revision = start.revision, randomCursor = source.random.cursor;
    const frames: FoolEscapeReplayFrame[] = [];
    same(cursor.snapshot(), strict);
    for (const type of ['WAIT', 'BYPASS', 'WITHDRAW', 'REPORT'] as const) {
      if (strict.scene.status === 'DEAD') break;
      const frame = frameFor(source, strict, before, ++revision, randomCursor, type);
      frames.push(frame);
      const authority = createFoolEscapeAuthority(source, archived, start, frames), host = deriveFoolEscapeHost(source, frame);
      const expected = applyFoolEscapeCommand(strict, frame.command, host, authority), actual = cursor.advance(frame);
      same(actual, { ...expected, host }); same(cursor.snapshot(), expected.state);
      expect(validateFoolEscapeState(actual.state, authority)).toBe(true);
      strict = expected.state; before = { ...before, ...expected.effect.resourcesAfter }; randomCursor = frame.randomAfter;
    }
    expect(frames.find(frame => frame.command.type === 'BYPASS')!.check).not.toBeNull();
    expect(randomCursor).toBe(source.random.cursor + 1);
  }, 90_000);

  it('rejects forged source/original input and cannot import a saved state or supplied verified flag', () => {
    const { source, archived, start } = fixture();
    const badSource = structuredClone(source); badSource.materialsOrigin.snapshotDigest += ':forged';
    expect(() => createFoolEscapeHostReplayCursor(badSource, archived, start)).toThrow('ESCAPE_AUTHORITY_SOURCE_REPLAY_REQUIRED');
    expect(() => createFoolEscapeHostReplayCursor({ ...source, verified: true } as unknown as FoolSource, archived, start)).toThrow('ESCAPE_AUTHORITY_SOURCE_REPLAY_REQUIRED');
    const noncanonical = Object.assign(Object.create({ verified: true }) as FoolSource, source);
    expect(() => createFoolEscapeHostReplayCursor(noncanonical, archived, start)).toThrow('ESCAPE_AUTHORITY_SOURCE_REPLAY_REQUIRED');
    expect(() => createFoolEscapeHostReplayCursor(source, archived, { ...start, location: 'elsewhere' })).toThrow('ESCAPE_ORIGINAL_WORLD_ARRIVAL_REQUIRED');
    const cursor = createFoolEscapeHostReplayCursor(source, archived, start);
    expect(() => createFoolEscapeHostReplayCursor(cursor.snapshot() as unknown as FoolSource, archived, start)).toThrow('ESCAPE_AUTHORITY_SOURCE_REPLAY_REQUIRED');
    const badArchived = structuredClone(archived), rebound = structuredClone(source);
    badArchived.attendantMysteries.town!.journal.at(-1)!.cost.cash++;
    rebound.sourceHistoryDigest = sourceModule.foolFrozenSourceDigest(badArchived);
    expect(() => createFoolEscapeHostReplayCursor(rebound, badArchived, start)).toThrow('ESCAPE_AUTHORITY_SOURCE_REPLAY_REQUIRED');
  }, 90_000);

  it('rejects stale revisions, changed prefixes, fabricated checks and invalid hosts without committing anything', () => {
    const { source, archived, start } = fixture(), cursor = createFoolEscapeHostReplayCursor(source, archived, start);
    const state = cursor.snapshot(), correct = frameFor(source, state, start.before, start.revision + 1, source.random.cursor, 'BYPASS');
    const mutations: Array<(frame: FoolEscapeReplayFrame) => void> = [
      frame => { frame.revision = start.revision; frame.eventId = start.eventId; },
      frame => { frame.eventId += ':wrong'; },
      frame => { frame.escapeBefore.scene.bodies[0]!.health--; },
      frame => { frame.escapeBefore.initial.originReceiptId += ':wrong'; },
      frame => { Object.setPrototypeOf(frame.escapeBefore, { verified: true }); },
      frame => { frame.now--; },
      frame => { frame.before.health--; },
      frame => { frame.before.status = 'DEAD'; },
      frame => { frame.randomAfter++; },
      frame => { frame.randomBefore = source.random.cursor - 1; },
      frame => { frame.check = { ...frame.check!, roll: frame.check!.roll === 100 ? 1 : frame.check!.roll + 1 }; },
      frame => { frame.command = { ...frame.command, verified: true } as unknown as FoolEscapeCommand; },
    ];
    for (const mutate of mutations) {
      const bad = structuredClone(correct); mutate(bad);
      expect(() => cursor.advance(bad)).toThrow(); same(cursor.snapshot(), state);
    }
    const actual = cursor.advance(correct); expect(actual.host.check).toEqual(correct.check);
    const committed = cursor.snapshot(); expect(() => cursor.advance(correct)).toThrow('ESCAPE_AUTHORITY_PREFIX_MISMATCH');
    same(cursor.snapshot(), committed);
    if (committed.scene.status !== 'DEAD') {
      const next = frameFor(source, committed, { ...start.before, ...actual.effect.resourcesAfter }, correct.revision + 1, correct.randomAfter, 'WAIT');
      const staleRandom = { ...next, randomBefore: correct.randomBefore, randomAfter: correct.randomBefore };
      expect(() => cursor.advance(staleRandom)).toThrow('ESCAPE_AUTHORITY_PREFIX_MISMATCH'); same(cursor.snapshot(), committed);
      expect(() => cursor.advance(next)).not.toThrow();
    }
  }, 60_000);

  it('detaches inputs, snapshots, result hosts/effects and every mutable fork', () => {
    const { source, archived, start } = fixture(), originalSource = structuredClone(source), originalStart = structuredClone(start);
    const cursor = createFoolEscapeHostReplayCursor(source, archived, start), initial = cursor.snapshot();
    source.random.seed += ':changed'; source.character.name = 'changed-caller';
    start.before.coreStats.will++; start.before.injuries.length = 0;
    archived.character.name = 'changed-archive'; same(cursor.snapshot(), initial);
    const left = cursor.fork(), right = cursor.fork();
    const frame = frameFor(originalSource, initial, originalStart.before, originalStart.revision + 1, originalSource.random.cursor, 'WAIT');
    const result = left.advance(frame), committed = left.snapshot();
    frame.command.type = 'WITHDRAW'; frame.before.coreStats.will++; frame.environment.conditionId += ':changed';
    result.state.initial.bodies[0]!.health = 0; result.state.journal.length = 0;
    result.effect.resourcesAfter.health = 0; result.host.stats = { ...result.host.stats, will: result.host.stats.will + 1 }; result.host.environment.conditionId += ':changed';
    const exported = left.snapshot(); exported.scene.bodies[0]!.health = 0;
    same(left.snapshot(), committed); same(right.snapshot(), initial); same(cursor.snapshot(), initial);
    expect(left.matches(exported)).toBe(false); expect(left.matches(result.state)).toBe(false); expect(left.matches({ verified: true })).toBe(false);
    expect(left.matches({ bad: Number.NaN })).toBe(false);
    const retreat = frameFor(originalSource, initial, originalStart.before, originalStart.revision + 2, originalSource.random.cursor, 'WITHDRAW');
    right.advance(retreat); same(left.snapshot(), committed); same(cursor.snapshot(), initial);
    expect(right.matches(left.snapshot())).toBe(false);
  }, 60_000);

  it('keeps standalone saved-state replay strict after a cursor was opened', () => {
    const { source, archived, start } = fixture(), cursor = createFoolEscapeHostReplayCursor(source, archived, start);
    const frame = frameFor(source, cursor.snapshot(), start.before, start.revision + 1, source.random.cursor, 'WAIT');
    const result = cursor.advance(frame), authority = createFoolEscapeAuthority(source, archived, start, [frame]);
    const bad = structuredClone(result.state); bad.journal[0]!.effect.elapsedSeconds++;
    expect(cursor.matches(bad)).toBe(false); expect(validateFoolEscapeState(bad, authority)).toBe(false);
    expect(() => applyFoolEscapeCommand(bad, frame.command, result.host, authority)).toThrow('ESCAPE_STATE_REPLAY_FAILED');
    same(cursor.snapshot(), result.state);
  }, 60_000);
});
