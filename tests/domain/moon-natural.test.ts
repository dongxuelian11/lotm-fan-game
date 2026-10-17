import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { openMoonRuntimeSession, type MoonRuntimeSession } from '../../src/domain/moon/owned-session.js';
import { MOON_FROZEN_SOURCE_KEYS } from '../../src/domain/moon/source.js';
import {
  PREFIX, actualReceipts, assertGlobalPublic, assertCaptureFreeze, assertCaptureManifest, assertPublicAction, authenticateInputs, boundaryKind, bytes,
  capturePublic, compactHash, hash, historicalMoonPublic, historicalMoonState, json, loadCapture, migrateCapturedMoonState,
  outcome, readBoundary, same, type Freeze, type LoadedCapture, type Manifest,
} from '../helpers/moon-capture.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';

/** One exact replay of every NEW command. Original670 is byte-authenticated
 * and strictly migrated/validated, never rerun. No producer/dist import, die
 * substitution, outcome search, fixture writes or skips. Historical private
 * hashes permit only reviewed version tags and the exact empty Darkness root. */
let data: LoadedCapture | undefined;
beforeAll(() => { data = loadCapture(); }, 180_000);
afterAll(() => { if (data) authenticateInputs(data.pins); }, 180_000);

function safeCapture(projection: ReturnType<typeof projectSliceState>, state: SliceState) {
  assertGlobalPublic(projection, state); return capturePublic(projection, state);
}
const capturedHash = (state: SliceState): string => hash(historicalMoonState(state));
function publicOnly(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    // Public bottle/person provenance and check modifier labels legitimately
    // use a string `source`; the private frozen source is an object.
    if (key === 'source') expect(typeof child).toBe('string');
    expect(['random', 'seed', 'cursor', 'sourceDigest', 'historyDigest', 'frame', 'randomReceipts', 'financeReceipts']).not.toContain(key);
    publicOnly(child);
  }
}
function preserveOriginal(state: SliceState, original: SliceState, before: SliceState): void {
  expect(state.runId).toBe(original.runId); expect(state.random.seed).toBe(original.random.seed);
  expect(state.random.cursor).toBeGreaterThanOrEqual(original.random.cursor);
  for (const key of MOON_FROZEN_SOURCE_KEYS.filter(key => key !== 'beautyGoddess')) {
    // Only the existing original partner rest and original paper-use records
    // can evolve during genuine S1 practice. Never replace their identities.
    const live = structuredClone(state[key]);
    if (key === 'summoningMaster') (live as SliceState['summoningMaster']).life.partner = structuredClone(original.summoningMaster.life.partner);
    if (key === 'witchKing') (live as SliceState['witchKing']).life.papers = structuredClone(original.witchKing.life.papers);
    same(live, original[key], `Original ${key} history changed`);
  }
  same(state.beautyGoddess.bottles.slice(0, 3), original.beautyGoddess.bottles);
  same(state.beautyGoddess.acquisitionJournal.slice(0, original.beautyGoddess.acquisitionJournal.length), original.beautyGoddess.acquisitionJournal);
  same(state.combatHistory, original.combatHistory); same(state.beautyGoddess.encounter, original.beautyGoddess.encounter);
  for (const [id, value] of Object.entries(original.progression.mastery)) expect(state.progression.mastery[id], id).toBe(value);
  for (const key of ['name', 'age'] as const) expect(state.character[key]).toBe(original.character[key]);
  const partner = state.summoningMaster.life.partner, originalPartner = original.summoningMaster.life.partner;
  for (const key of ['id', 'bodyId', 'homeId'] as const) expect(partner[key]).toBe(originalPartner[key]);
  same(partner.restHistory.slice(0, originalPartner.restHistory.length), originalPartner.restHistory);
  if (before.moon.guidanceKnown) {
    for (const key of [...MOON_FROZEN_SOURCE_KEYS, 'world', 'combatHistory'] as const) same(state[key], before[key], `Sealed S1 ${key} changed`);
    same(state.moon.source, before.moon.source, 'Moon retains its exact actual S1 handoff');
  }
}

describe('Moon212 compressed exact original670 natural continuation', () => {
  it('authenticates the complete compressed input, original prefix and exact first-instance boundary index', () => {
    const { checkpoint: cp, pins, rows } = data!;
    expect(cp.commandCount).toBe(PREFIX + pins.newCommands);
    expect(rows).toHaveLength(pins.newCommands);
    expect(cp.boundaries).toHaveLength(pins.selectedBoundaries);
    expect(cp.boundaries.length).toBeLessThanOrEqual(30);
    expect(cp.initialStateSha256).toBe(pins.initialStateSha256);
    expect(cp.finalStateSha256).toBe(pins.finalStateSha256);
    const freeze = json<Freeze>('freeze.json'), unchangedFreeze = hash(freeze);
    expect(() => assertCaptureFreeze(freeze, pins)).not.toThrow();
    const alteredFreeze = structuredClone(freeze);
    alteredFreeze.files[0]!.sha256 = '0'.repeat(64);
    expect(() => assertCaptureFreeze(alteredFreeze, pins)).toThrow();
    // Updating the internal checksum cannot legitimize replacement evidence.
    alteredFreeze.sha256 = compactHash(alteredFreeze.files);
    expect(() => assertCaptureFreeze(alteredFreeze, pins)).toThrow();
    expect(hash(freeze)).toBe(unchangedFreeze);
    const manifest = JSON.parse(bytes(pins.inputManifest).toString('utf8')) as Manifest;
    const actualFiles = manifest.files.map(item => item.file), unchangedManifest = hash(manifest);
    expect(() => assertCaptureManifest(manifest, actualFiles)).not.toThrow();
    expect(() => assertCaptureManifest(manifest, actualFiles.slice(1))).toThrow();
    const omittedManifest = structuredClone(manifest); omittedManifest.files.shift();
    expect(() => assertCaptureManifest(omittedManifest, actualFiles)).toThrow();
    expect(hash(manifest)).toBe(unchangedManifest);
  });

  it('keeps raw209 separate from current migration and removes only the exact inactive Darkness root from audit views', () => {
    const { prefixFinal, initial, pins } = data!, rawHash = hash(prefixFinal), currentHash = hash(initial);
    expect([prefixFinal.schemaVersion, prefixFinal.contentVersion]).toEqual([209, 'moon-v209']);
    expect(Object.hasOwn(prefixFinal, 'darkness')).toBe(false);
    expect([initial.schemaVersion, initial.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(Object.keys(initial).sort()).toEqual([...Object.keys(prefixFinal), 'darkness'].sort());
    same(historicalMoonState(initial), prefixFinal);
    expect(capturedHash(initial)).toBe(pins.initialStateSha256);
    expect(currentHash).not.toBe(rawHash);
    const unexpectedState = { ...initial, unexpectedRoot: { retained: true } };
    expect(Object.hasOwn(historicalMoonState(unexpectedState), 'unexpectedRoot')).toBe(true);
    expect(capturedHash(unexpectedState)).not.toBe(pins.initialStateSha256);
    const alteredDarkness = { ...initial, darkness: { ...initial.darkness, guidanceKnown: true } };
    expect(() => historicalMoonState(alteredDarkness)).toThrow();
    const extendedDarkness = { ...initial, darkness: { ...initial.darkness, unexpected: true } };
    expect(() => historicalMoonState(extendedDarkness)).toThrow();
    const injectedLegacy = { ...prefixFinal, darkness: initial.darkness };
    expect(() => migrateCapturedMoonState(injectedLegacy)).toThrow();
    const projection = projectSliceState(initial), publicHash = hash(projection);
    const historical = historicalMoonPublic(projection, initial);
    expect(Object.hasOwn(historical, 'darkness')).toBe(false);
    expect(Object.keys(historical).sort()).toEqual(Object.keys(projection).filter(key => key !== 'darkness').sort());
    const unexpectedPublic = { ...projection, unexpectedPublicRoot: { retained: true } };
    expect(Object.hasOwn(historicalMoonPublic(unexpectedPublic, initial), 'unexpectedPublicRoot')).toBe(true);
    const alteredPublic = { ...projection, darkness: { ...projection.darkness, promoted: true } };
    expect(() => capturePublic(alteredPublic, initial)).toThrow();
    expect(() => capturePublic(projection, alteredDarkness)).toThrow();
    expect(hash(prefixFinal)).toBe(rawHash); expect(hash(initial)).toBe(currentHash); expect(hash(projection)).toBe(publicHash);
  });

  it('replays every recorded new action with exact historical private, RNG, public, receipt and final-outcome equality', () => {
    const { checkpoint: cp, original, pins, rows, summary } = data!;
    let state = data!.initial, session: MoonRuntimeSession | null = null;
    let view = safeCapture(projectSliceState(state), state), opened = 0;
    expect(capturedHash(state)).toBe(cp.initialStateSha256); expect(hash(state.random)).toBe(cp.initialRandomSha256);
    expect(hash(view)).toBe(cp.initialPublicSha256); publicOnly(view);
    const seen = new Set<string>(), visited: Array<{ kind: string; commandCount: number }> = [];
    for (const [index, row] of rows.entries()) {
      const before = state;
      expect(row.commandCount).toBe(PREFIX + index + 1); expect(before.status).toBe('ACTIVE');
      expect(capturedHash(before), `Private before ${row.commandCount}`).toBe(row.beforeStateSha256);
      expect(before.random).toEqual(row.randomBefore); expect(hash(before.random)).toBe(row.randomBeforeSha256);
      expect(hash(view), `Public before ${row.commandCount}`).toBe(row.publicBeforeSha256);
      expect(validateSlicePayload(row.intent)).toBe(true); assertPublicAction(view, row);
      if (session) {
        expect(row.intent.type).toBe('MOON');
        const draft = session.prepare(row.intent, before.revision);
        state = session.snapshotDraft(draft); view = safeCapture(session.projectDraft(draft), state);
        expect(session.inspect()).toEqual({ runId: before.runId, revision: before.revision, status: before.status });
        expect(capturedHash(before), 'Draft leaves predecessor intact').toBe(row.beforeStateSha256);
        expect(capturedHash(state), `Private draft ${row.commandCount}`).toBe(row.afterStateSha256);
        expect(hash(view), `Public draft ${row.commandCount}`).toBe(row.publicAfterSha256);
        session.commit(draft);
        expect(session.inspect()).toEqual({ runId: state.runId, revision: state.revision, status: state.status });
      } else {
        state = applySliceIntent(before, row.intent);
        if (state.moon.guidanceKnown) { session = openMoonRuntimeSession(state); opened++; }
        view = safeCapture(session ? session.project() : projectSliceState(state), state);
      }
      expect(capturedHash(before), 'A real action cannot rewrite its predecessor').toBe(row.beforeStateSha256);
      expect(capturedHash(state), `Private after ${row.commandCount}`).toBe(row.afterStateSha256);
      expect(state.random).toEqual(row.randomAfter); expect(hash(state.random)).toBe(row.randomAfterSha256);
      expect(hash(view), `Public after ${row.commandCount}`).toBe(row.publicAfterSha256);
      expect([state.revision, state.week]).toEqual([row.revision, row.week]);
      expect(state.revision).toBe(before.revision + 1); expect(outcome(view)).toEqual(row.selectionOutcome);
      same(actualReceipts(state, before), row.receipts, `Actual receipts ${row.commandCount}`);
      publicOnly(view); preserveOriginal(state, original, before);
      const kind = boundaryKind(row.intent, outcome(view));
      const chosen = kind !== null && !seen.has(kind) && visited.length < 30;
      const indexed = cp.boundaries.filter(item => item.commandCount === row.commandCount);
      expect(indexed).toHaveLength(chosen ? 1 : 0);
      if (chosen) {
        seen.add(kind); visited.push({ kind, commandCount: row.commandCount });
        expect(indexed[0]!.kind).toBe(kind);
        const captured = readBoundary(indexed[0]!, row);
        same(captured.beforeLast, historicalMoonState(before)); same(captured.final, historicalMoonState(state)); same(captured.public, view);
      }
    }
    expect(opened).toBe(state.moon.guidanceKnown ? 1 : 0);
    expect(visited).toEqual(cp.boundaries.map(({ kind, commandCount }) => ({ kind, commandCount })));
    same(historicalMoonState(state), cp.state); expect(capturedHash(state)).toBe(pins.finalStateSha256);
    expect(hash(state.random)).toBe(pins.finalRandomSha256); expect(hash(view)).toBe(pins.finalPublicSha256);
    same(view, summary.public); expect(outcome(view)).toEqual(pins.finalOutcome);
    expect([state.revision, state.week, state.progression.sequence]).toEqual([pins.finalRevision, pins.finalWeek, pins.finalSequence]);
    expect(cp.policy.beautyDoses).toBe(rows.filter(row => row.intent.type === 'BEAUTY_GODDESS' && row.intent.command.type === 'CONSUME').length);
    expect(cp.policy.moonDoses).toBe(rows.filter(row => row.intent.type === 'MOON' && row.intent.command.type === 'CONSUME').length);
    expect(cp.policy.reported).toBe(rows.some(row => row.intent.type === 'MOON' && row.intent.command.type === 'EPILOGUE' && row.intent.command.command.type === 'REPORT'));
    if (pins.stage === 'NATURAL_FINITE_MOON_REPORTED') expect(state.moon.epilogue?.reported).toBe(true);
    assertValidSliceState(state);
    if (session) {
      const reopened = openMoonRuntimeSession(state);
      same(reopened.snapshot(), state); same(safeCapture(reopened.project(), state), view);
    }
    if (state.status === 'DEAD' || state.status === 'SLICE_COMPLETE') {
      expect(view.canAct).toBe(false);
      expect(view.moon.actions.every(action => !action.enabled)).toBe(true);
      if (session) {
        expect(() => session!.prepare({ type: 'MOON', command: { type: 'REST' } }, state.revision)).toThrow();
        same(session.snapshot(), state);
      }
    }
  }, 600_000);
});
